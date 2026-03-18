// Client-side YouTube audio stream extraction
// Strategy: Piped/Invidious proxies first (they handle cipher/PoToken),
// then direct Innertube clients as fallback.
// Runs on user's phone (residential IP) — won't get blocked.

// ── Timeout wrapper for fetch ──
function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

// ── Piped API instances (handle all YouTube complexity server-side) ──
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.in.projectsegfau.lt',
  'https://pipedapi.r4fo.com',
  'https://pipedapi.us.projectsegfau.lt',
];

async function tryPiped(videoId) {
  for (const instance of PIPED_INSTANCES) {
    try {
      const url = `${instance}/streams/${videoId}`;
      console.log(`[YT] Trying Piped: ${instance}`);

      const res = await fetchWithTimeout(url, {}, 8000);
      if (!res.ok) {
        console.warn(`[YT] Piped ${instance} HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const streams = data.audioStreams;
      if (!streams || streams.length === 0) {
        console.warn(`[YT] Piped ${instance}: no audio streams`);
        continue;
      }

      // Prefer mp4a/AAC for Android compatibility, then highest bitrate
      const sorted = [...streams].sort((a, b) => {
        const aIsAac = (a.mimeType || '').includes('mp4a') || (a.codec || '').includes('mp4a') ? 1 : 0;
        const bIsAac = (b.mimeType || '').includes('mp4a') || (b.codec || '').includes('mp4a') ? 1 : 0;
        if (bIsAac !== aIsAac) return bIsAac - aIsAac;
        return (b.bitrate || 0) - (a.bitrate || 0);
      });

      const best = sorted[0];
      if (!best.url) {
        console.warn(`[YT] Piped ${instance}: stream has no URL`);
        continue;
      }

      // Validate the URL actually works
      const valid = await validateUrl(best.url);
      if (!valid) {
        console.warn(`[YT] Piped ${instance}: URL validation failed`);
        continue;
      }

      console.log(`[YT] Got stream via Piped (${instance}), bitrate: ${best.bitrate}`);
      return best.url;
    } catch (err) {
      console.warn(`[YT] Piped ${instance} error:`, err.message);
      continue;
    }
  }
  return null;
}

// ── Invidious API instances ──
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.protokoll-11.dev',
  'https://invidious.privacyredirect.com',
];

async function tryInvidious(videoId) {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const url = `${instance}/api/v1/videos/${videoId}`;
      console.log(`[YT] Trying Invidious: ${instance}`);

      const res = await fetchWithTimeout(url, {}, 8000);
      if (!res.ok) {
        console.warn(`[YT] Invidious ${instance} HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const formats = data.adaptiveFormats || [];
      const audioFormats = formats.filter(
        (f) => f.type?.startsWith('audio/') && f.url
      );

      if (audioFormats.length === 0) {
        console.warn(`[YT] Invidious ${instance}: no audio formats`);
        continue;
      }

      // Prefer AAC, then highest bitrate
      const sorted = [...audioFormats].sort((a, b) => {
        const aIsAac = (a.type || '').includes('mp4a') ? 1 : 0;
        const bIsAac = (b.type || '').includes('mp4a') ? 1 : 0;
        if (bIsAac !== aIsAac) return bIsAac - aIsAac;
        return (b.bitrate || 0) - (a.bitrate || 0);
      });

      const best = sorted[0];
      const valid = await validateUrl(best.url);
      if (!valid) {
        console.warn(`[YT] Invidious ${instance}: URL validation failed`);
        continue;
      }

      console.log(`[YT] Got stream via Invidious (${instance}), bitrate: ${best.bitrate}`);
      return best.url;
    } catch (err) {
      console.warn(`[YT] Invidious ${instance} error:`, err.message);
      continue;
    }
  }
  return null;
}

// ── Direct Innertube clients (fallback) ──
const INNERTUBE_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';

const INNERTUBE_CLIENTS = [
  {
    name: 'TVHTML5_EMBEDDED',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0)',
    },
    body: {
      context: {
        client: {
          clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
          clientVersion: '2.0',
          hl: 'en',
          gl: 'US',
        },
        thirdParty: { embedUrl: 'https://www.youtube.com' },
      },
      contentCheckOk: true,
      racyCheckOk: true,
    },
  },
  {
    name: 'ANDROID',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
      'X-YouTube-Client-Name': '3',
      'X-YouTube-Client-Version': '19.09.37',
    },
    body: {
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: '19.09.37',
          androidSdkVersion: 30,
          hl: 'en',
          gl: 'US',
        },
      },
      contentCheckOk: true,
      racyCheckOk: true,
    },
  },
  {
    name: 'IOS',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)',
      'X-YouTube-Client-Name': '5',
      'X-YouTube-Client-Version': '19.09.3',
    },
    body: {
      context: {
        client: {
          clientName: 'IOS',
          clientVersion: '19.09.3',
          deviceMake: 'Apple',
          deviceModel: 'iPhone14,3',
          hl: 'en',
          gl: 'US',
        },
      },
      contentCheckOk: true,
      racyCheckOk: true,
    },
  },
];

async function tryInnertube(videoId) {
  for (const client of INNERTUBE_CLIENTS) {
    try {
      console.log(`[YT] Trying Innertube ${client.name}`);

      const body = { ...client.body, videoId };
      const res = await fetchWithTimeout(
        INNERTUBE_URL,
        {
          method: 'POST',
          headers: client.headers,
          body: JSON.stringify(body),
        },
        10000
      );

      if (!res.ok) {
        console.warn(`[YT] Innertube ${client.name} HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const status = data?.playabilityStatus?.status;
      if (status !== 'OK') {
        console.warn(`[YT] Innertube ${client.name}: ${status} — ${data?.playabilityStatus?.reason || ''}`);
        continue;
      }

      const formats = [
        ...(data?.streamingData?.adaptiveFormats || []),
        ...(data?.streamingData?.formats || []),
      ];

      // Only pick formats with DIRECT urls (no cipher)
      const audioFormats = formats.filter(
        (f) => f.mimeType?.includes('audio') && f.url
      );

      if (audioFormats.length === 0) {
        const ciphered = formats.filter((f) => f.signatureCipher || f.cipher).length;
        console.warn(
          `[YT] Innertube ${client.name}: 0 direct audio URLs (${ciphered} ciphered, ${formats.length} total)`
        );
        continue;
      }

      // Prefer AAC
      const sorted = [...audioFormats].sort((a, b) => {
        const aIsAac = (a.mimeType || '').includes('mp4a') ? 1 : 0;
        const bIsAac = (b.mimeType || '').includes('mp4a') ? 1 : 0;
        if (bIsAac !== aIsAac) return bIsAac - aIsAac;
        return (b.bitrate || 0) - (a.bitrate || 0);
      });

      const best = sorted[0];
      const valid = await validateUrl(best.url);
      if (!valid) {
        console.warn(`[YT] Innertube ${client.name}: URL validation failed`);
        continue;
      }

      console.log(`[YT] Got stream via Innertube ${client.name}, bitrate: ${best.bitrate}`);
      return best.url;
    } catch (err) {
      console.warn(`[YT] Innertube ${client.name} error:`, err.message);
      continue;
    }
  }
  return null;
}

// ── Validate a URL is reachable and returns audio ──
async function validateUrl(url) {
  try {
    const res = await fetchWithTimeout(
      url,
      { method: 'HEAD' },
      5000
    );
    // Accept 200 or 206 (partial content, common for media)
    if (res.status === 200 || res.status === 206) return true;
    // Some servers don't support HEAD, try a small GET range
    if (res.status === 405) {
      const res2 = await fetchWithTimeout(
        url,
        { headers: { Range: 'bytes=0-1024' } },
        5000
      );
      return res2.status === 200 || res2.status === 206;
    }
    console.warn(`[YT] URL validation: status ${res.status}`);
    return false;
  } catch (err) {
    console.warn(`[YT] URL validation error:`, err.message);
    return false;
  }
}

// ── Main export ──
export async function getStreamUrl(videoId) {
  if (!videoId || typeof videoId !== 'string') {
    throw new Error('Invalid video ID');
  }

  console.log(`[YT] === Getting stream for: ${videoId} ===`);
  const startTime = Date.now();

  // 1. Try Piped (most reliable — handles all YouTube complexity)
  try {
    const url = await tryPiped(videoId);
    if (url) {
      console.log(`[YT] Success via Piped in ${Date.now() - startTime}ms`);
      return url;
    }
  } catch (err) {
    console.warn('[YT] Piped chain error:', err.message);
  }

  // 2. Try Invidious
  try {
    const url = await tryInvidious(videoId);
    if (url) {
      console.log(`[YT] Success via Invidious in ${Date.now() - startTime}ms`);
      return url;
    }
  } catch (err) {
    console.warn('[YT] Invidious chain error:', err.message);
  }

  // 3. Try direct Innertube
  try {
    const url = await tryInnertube(videoId);
    if (url) {
      console.log(`[YT] Success via Innertube in ${Date.now() - startTime}ms`);
      return url;
    }
  } catch (err) {
    console.warn('[YT] Innertube chain error:', err.message);
  }

  const elapsed = Date.now() - startTime;
  console.error(`[YT] ALL methods failed after ${elapsed}ms for: ${videoId}`);
  throw new Error(
    'Could not get audio stream. All extraction methods failed. Check your internet connection and try again.'
  );
}
