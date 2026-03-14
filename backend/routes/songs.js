const express = require('express');
const router = express.Router();
const path = require('path');
const { execFile } = require('child_process');

// Path to yt-dlp binary (downloaded by postinstall on Linux/Render)
const YTDLP = path.join(__dirname, '..', 'yt-dlp');

// YouTube Innertube API — for search
const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const INNERTUBE_CONTEXT = {
  client: { clientName: 'WEB', clientVersion: '2.20241209.01.00', hl: 'en', gl: 'US' },
};

// Run yt-dlp to get the best audio stream URL
function ytdlpGetUrl(videoId) {
  return new Promise((resolve, reject) => {
    const args = [
      '--no-warnings',
      '--no-playlist',
      '-f', 'bestaudio/best',
      '--get-url',
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    // Pass cookies if available
    if (process.env.YOUTUBE_COOKIE) {
      // Write cookie header format yt-dlp understands via --add-header
      args.push('--add-header', `Cookie:${process.env.YOUTUBE_COOKIE}`);
    }

    execFile(YTDLP, args, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      const url = stdout.trim().split('\n')[0];
      if (!url) return reject(new Error('No URL returned by yt-dlp'));
      resolve(url);
    });
  });
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

// Validate YouTube video ID
function isValidVideoId(id) {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
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

// Get stream URL — used by the app's audio player
router.get('/stream-url/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    if (!isValidVideoId(videoId)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }

    const streamUrl = await ytdlpGetUrl(videoId);
    console.log('Stream URL found via yt-dlp for', videoId);
    res.json({ streamUrl });
  } catch (error) {
    console.error('Stream URL error:', error.message);
    res.status(500).json({ error: 'Failed to get stream URL' });
  }
});

// Stream audio — pipe directly (fallback endpoint)
router.get('/stream/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    if (!isValidVideoId(videoId)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }

    // Get URL via yt-dlp then redirect to it
    const streamUrl = await ytdlpGetUrl(videoId);
    res.redirect(streamUrl);
  } catch (error) {
    console.error('Stream error:', error.message);
    if (!res.headersSent) res.status(500).json({ error: 'Stream failed' });
  }
});

// Get song metadata
router.get('/info/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    if (!isValidVideoId(videoId)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }

    const results = await innertubeSearch(videoId, 1);
    if (!results.length) return res.status(404).json({ error: 'Not found' });
    res.json(results[0]);
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
