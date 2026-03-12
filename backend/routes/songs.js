const express = require('express');
const router = express.Router();
const ytdl = require('@distube/ytdl-core');

// Parse cookie string into array format required by @distube/ytdl-core
const parsedCookies = process.env.YOUTUBE_COOKIE
  ? process.env.YOUTUBE_COOKIE.split(';').map((c) => {
      const [name, ...rest] = c.trim().split('=');
      return { name: name.trim(), value: rest.join('=').trim() };
    }).filter((c) => c.name)
  : undefined;

const agent = parsedCookies ? ytdl.createAgent(parsedCookies) : undefined;
const ytdlOptions = agent ? { agent } : {};

// YouTube Innertube API — works from any IP, same API the browser uses
const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const INNERTUBE_CONTEXT = {
  client: {
    clientName: 'WEB',
    clientVersion: '2.20241209.01.00',
    hl: 'en',
    gl: 'US',
  },
};

async function innertubeStreamUrl(videoId) {
  // Android client returns direct (non-obfuscated) stream URLs
  const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-YouTube-Client-Name': '3',
      'X-YouTube-Client-Version': '19.09.37',
      'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
    },
    body: JSON.stringify({
      videoId,
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: '19.09.37',
          androidSdkVersion: 30,
          hl: 'en',
          gl: 'US',
        },
      },
    }),
  });

  if (!res.ok) throw new Error(`Innertube player error: ${res.status}`);
  const data = await res.json();

  const formats = [
    ...(data?.streamingData?.adaptiveFormats || []),
    ...(data?.streamingData?.formats || []),
  ];

  const audioFormats = formats
    .filter((f) => f.mimeType?.includes('audio') && f.url)
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

  return audioFormats[0]?.url || null;
}

async function innertubeSearch(query, limit = 20) {
  const res = await fetch(
    `https://www.youtube.com/youtubei/v1/search?key=${INNERTUBE_KEY}&prettyPrint=false`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-YouTube-Client-Name': '1',
        'X-YouTube-Client-Version': '2.20241209.01.00',
        'Origin': 'https://www.youtube.com',
        'Referer': 'https://www.youtube.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({ query, context: INNERTUBE_CONTEXT }),
    }
  );

  if (!res.ok) throw new Error(`Innertube error: ${res.status}`);
  const data = await res.json();

  const sections =
    data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
      ?.sectionListRenderer?.contents || [];

  const songs = [];
  for (const section of sections) {
    for (const item of section?.itemSectionRenderer?.contents || []) {
      const vr = item.videoRenderer;
      if (!vr?.videoId) continue;

      const durationText = vr.lengthText?.simpleText || '0:00';
      const parts = durationText.split(':').map(Number);
      const durationSec =
        parts.length === 3
          ? parts[0] * 3600 + parts[1] * 60 + parts[2]
          : parts[0] * 60 + (parts[1] || 0);

      songs.push({
        id: vr.videoId,
        title: vr.title?.runs?.[0]?.text || 'Unknown',
        artist:
          vr.ownerText?.runs?.[0]?.text ||
          vr.shortBylineText?.runs?.[0]?.text ||
          'Unknown Artist',
        thumbnail: vr.thumbnail?.thumbnails?.slice(-1)[0]?.url || '',
        thumbnailSmall: vr.thumbnail?.thumbnails?.[0]?.url || '',
        duration: durationText,
        durationMs: durationSec * 1000,
        url: `https://www.youtube.com/watch?v=${vr.videoId}`,
      });

      if (songs.length >= limit) return songs;
    }
  }
  return songs;
}

// Search songs on YouTube
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    if (!q) return res.status(400).json({ error: 'Query is required' });

    const songs = await innertubeSearch(q, Math.max(1, parseInt(limit) || 20));
    res.json({ songs });
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Stream audio — pipe directly to client
router.get('/stream/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    if (!ytdl.validateID(videoId)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }

    res.setHeader('Content-Type', 'audio/webm');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    const stream = ytdl(url, { filter: 'audioonly', quality: 'highestaudio', ...ytdlOptions });

    stream.pipe(res);

    stream.on('error', (err) => {
      console.error('Stream error:', err.message);
      if (!res.headersSent) res.status(500).json({ error: 'Stream failed' });
    });

    req.on('close', () => stream.destroy());
  } catch (error) {
    console.error('Stream error:', error.message);
    if (!res.headersSent) res.status(500).json({ error: 'Stream failed' });
  }
});

// Get stream URL — used by the app's audio player directly
router.get('/stream-url/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;

    if (!ytdl.validateID(videoId)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }

    // Use Innertube Android client (returns direct URLs, no rate-limit issues)
    const streamUrl = await innertubeStreamUrl(videoId);
    if (!streamUrl) return res.status(404).json({ error: 'No audio format found' });

    console.log('Stream URL found via Innertube for', videoId);
    res.json({ streamUrl });
  } catch (error) {
    console.error('Stream URL error:', error.message);
    res.status(500).json({ error: 'Failed to get stream URL' });
  }
});

// Get song metadata
router.get('/info/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    const info = await ytdl.getInfo(url, ytdlOptions);
    const v = info.videoDetails;

    res.json({
      id: v.videoId,
      title: v.title,
      artist: v.author?.name || 'Unknown Artist',
      thumbnail: v.thumbnails?.[v.thumbnails.length - 1]?.url || '',
      duration: v.lengthSeconds ? new Date(v.lengthSeconds * 1000).toISOString().substr(14, 5) : '0:00',
      durationMs: (parseInt(v.lengthSeconds) || 0) * 1000,
    });
  } catch (error) {
    console.error('Info error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get trending / featured songs
router.get('/featured', async (req, res) => {
  try {
    const queries = ['top hits 2024', 'trending music 2024', 'best songs 2024'];
    const q = queries[Math.floor(Math.random() * queries.length)];
    const songs = await innertubeSearch(q, 10);
    res.json({ songs });
  } catch (error) {
    console.error('Featured error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
