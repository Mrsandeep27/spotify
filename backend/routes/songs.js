const express = require('express');
const router = express.Router();
const play = require('play-dl');
const ytdl = require('@distube/ytdl-core');

// Search songs on YouTube
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    if (!q) return res.status(400).json({ error: 'Query is required' });

    const results = await play.search(q, {
      source: { youtube: 'video' },
      limit: Math.max(1, parseInt(limit) || 20),
    });

    const songs = results.map((video) => ({
      id: video.id,
      title: video.title,
      artist: video.channel?.name || 'Unknown Artist',
      thumbnail: video.thumbnails?.[video.thumbnails.length - 1]?.url || '',
      thumbnailSmall: video.thumbnails?.[0]?.url || '',
      duration: video.durationRaw || '0:00',
      durationMs: (video.durationInSec || 0) * 1000,
      url: `https://www.youtube.com/watch?v=${video.id}`,
    }));

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

    const stream = ytdl(url, { filter: 'audioonly', quality: 'highestaudio' });

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
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    if (!ytdl.validateID(videoId)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }

    const info = await ytdl.getInfo(url);
    const format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' });

    if (!format?.url) return res.status(404).json({ error: 'No audio format found' });

    res.json({ streamUrl: format.url });
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

    const info = await ytdl.getInfo(url);
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
    const queries = [
      'top hits 2024',
      'trending music 2024',
      'best songs 2024',
    ];
    const q = queries[Math.floor(Math.random() * queries.length)];
    const results = await play.search(q, {
      source: { youtube: 'video' },
      limit: 10,
    });

    const songs = results.map((video) => ({
      id: video.id,
      title: video.title,
      artist: video.channel?.name || 'Unknown Artist',
      thumbnail: video.thumbnails?.[video.thumbnails.length - 1]?.url || '',
      duration: video.durationRaw || '0:00',
      durationMs: (video.durationInSec || 0) * 1000,
    }));

    res.json({ songs });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
