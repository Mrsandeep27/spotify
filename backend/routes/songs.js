const express = require('express');
const router = express.Router();
const play = require('play-dl');

// Search songs on YouTube
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    if (!q) return res.status(400).json({ error: 'Query is required' });

    const results = await play.search(q, {
      source: { youtube: 'video' },
      limit: parseInt(limit),
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
    res.status(500).json({ error: 'Search failed', detail: error.message });
  }
});

// Stream audio — pipe directly to client
router.get('/stream/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    const stream = await play.stream(url, { quality: 2 });

    res.setHeader('Content-Type', stream.type === 'opus' ? 'audio/ogg' : 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    stream.stream.pipe(res);

    req.on('close', () => {
      try { stream.stream.destroy(); } catch (_) {}
    });
  } catch (error) {
    console.error('Stream error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Stream failed', detail: error.message });
    }
  }
});

// Get stream URL (redirect) — used by the app's audio player directly
router.get('/stream-url/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    const info = await play.video_info(url);
    const formats = info.format.filter(
      (f) => f.mimeType?.includes('audio') && f.url
    );

    if (!formats.length) {
      return res.status(404).json({ error: 'No audio format found' });
    }

    // Pick best quality audio format
    const best = formats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
    res.json({ streamUrl: best.url });
  } catch (error) {
    console.error('Stream URL error:', error.message);
    res.status(500).json({ error: 'Failed to get stream URL', detail: error.message });
  }
});

// Get song metadata
router.get('/info/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const info = await play.video_info(url);
    const v = info.video_details;

    res.json({
      id: v.id,
      title: v.title,
      artist: v.channel?.name || 'Unknown Artist',
      thumbnail: v.thumbnails?.[v.thumbnails.length - 1]?.url || '',
      duration: v.durationRaw,
      durationMs: (v.durationInSec || 0) * 1000,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
