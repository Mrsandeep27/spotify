// Client-side YouTube audio stream extraction
// Runs on user's phone (residential IP) — bypasses cloud IP blocking.
//
// Methods (in order):
// 1. Piped API — public YouTube proxies that handle cipher/PoToken
// 2. Invidious API — another set of public YouTube proxies
// 3. Cobalt API — popular media extraction service
// 4. YouTube page scrape — parse ytInitialPlayerResponse from watch page
// 5. Innertube direct — YouTube's internal API (only works for non-ciphered)

// ── Timeout wrapper ──
function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

// ── Pick best audio stream from a list ──
function pickBestAudio(streams) {
  if (!streams || streams.length === 0) return null;
  // Prefer AAC/mp4a for Android, then highest bitrate
  const sorted = [...streams].sort((a, b) => {
    const mime = (f) => f.mimeType || f.type || f.codec || '';
    const aAac = mime(a).includes('mp4a') || mime(a).includes('audio/mp4') ? 1 : 0;
    const bAac = mime(b).includes('mp4a') || mime(b).includes('audio/mp4') ? 1 : 0;
    if (bAac !== aAac) return bAac - aAac;
    return (b.bitrate || 0) - (a.bitrate || 0);
  });
  return sorted[0];
}

// ═══════════════════════════════════════════════════════════════
// METHOD 1: Piped API
// ═══════════════════════════════════════════════════════════════
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.r4fo.com',
  'https://pipedapi.leptons.xyz',
  'https://api.piped.yt',
  'https://pipedapi.darkness.services',
  'https://pipedapi.drgns.space',
];

async function tryPiped(videoId) {
  for (const instance of PIPED_INSTANCES) {
    try {
      console.log(`[YT] Piped: ${instance}`);
      const res = await fetchWithTimeout(`${instance}/streams/${videoId}`, {}, 10000);
      if (!res.ok) { console.warn(`[YT] Piped ${res.status}`); continue; }

      const data = await res.json();
      const streams = data.audioStreams;
      if (!streams || streams.length === 0) { console.warn('[YT] Piped: no streams'); continue; }

      const best = pickBestAudio(streams);
      if (!best?.url) { console.warn('[YT] Piped: no URL in stream'); continue; }

      console.log(`[YT] ✓ Piped OK (${instance}) bitrate:${best.bitrate}`);
      return best.url;
    } catch (err) {
      console.warn(`[YT] Piped ${instance}:`, err.message);
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// METHOD 2: Invidious API
// ═══════════════════════════════════════════════════════════════
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.protokoll-11.dev',
  'https://invidious.privacyredirect.com',
  'https://vid.puffyan.us',
  'https://inv.tux.pizza',
  'https://invidious.lunar.icu',
];

async function tryInvidious(videoId) {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      console.log(`[YT] Invidious: ${instance}`);
      const res = await fetchWithTimeout(`${instance}/api/v1/videos/${videoId}`, {}, 10000);
      if (!res.ok) { console.warn(`[YT] Invidious ${res.status}`); continue; }

      const data = await res.json();
      const formats = data.adaptiveFormats || [];
      const audio = formats.filter(f => f.type?.startsWith('audio/') && f.url);
      if (audio.length === 0) { console.warn('[YT] Invidious: no audio'); continue; }

      const best = pickBestAudio(audio);
      if (!best?.url) continue;

      console.log(`[YT] ✓ Invidious OK (${instance}) bitrate:${best.bitrate}`);
      return best.url;
    } catch (err) {
      console.warn(`[YT] Invidious ${instance}:`, err.message);
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// METHOD 3: Cobalt API (popular extraction service)
// ═══════════════════════════════════════════════════════════════
const COBALT_INSTANCES = [
  'https://api.cobalt.tools',
  'https://cobalt-api.ayo.tf',
];

async function tryCobalt(videoId) {
  for (const instance of COBALT_INSTANCES) {
    try {
      console.log(`[YT] Cobalt: ${instance}`);
      const res = await fetchWithTimeout(
        `${instance}/api/json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            url: `https://www.youtube.com/watch?v=${videoId}`,
            isAudioOnly: true,
            aFormat: 'mp3',
            filenamePattern: 'basic',
          }),
        },
        12000
      );

      if (!res.ok) { console.warn(`[YT] Cobalt ${res.status}`); continue; }

      const data = await res.json();
      if (data.status === 'stream' || data.status === 'redirect') {
        if (data.url) {
          console.log(`[YT] ✓ Cobalt OK (${instance})`);
          return data.url;
        }
      }
      console.warn(`[YT] Cobalt status: ${data.status}`);
    } catch (err) {
      console.warn(`[YT] Cobalt ${instance}:`, err.message);
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// METHOD 4: YouTube watch page scrape
// Parse ytInitialPlayerResponse from the mobile watch page
// ═══════════════════════════════════════════════════════════════
async function tryPageScrape(videoId) {
  try {
    console.log(`[YT] Page scrape: m.youtube.com`);
    const res = await fetchWithTimeout(
      `https://m.youtube.com/watch?v=${videoId}&pbj=1&bpctr=9999999999`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
      12000
    );

    if (!res.ok) { console.warn(`[YT] Page scrape HTTP ${res.status}`); return null; }

    const html = await res.text();

    // Extract ytInitialPlayerResponse
    const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
    if (!match) { console.warn('[YT] Page: no ytInitialPlayerResponse'); return null; }

    let playerData;
    try { playerData = JSON.parse(match[1]); }
    catch { console.warn('[YT] Page: JSON parse failed'); return null; }

    const status = playerData?.playabilityStatus?.status;
    if (status !== 'OK') {
      console.warn(`[YT] Page: playability ${status}`);
      return null;
    }

    const streaming = playerData?.streamingData;
    if (!streaming) { console.warn('[YT] Page: no streamingData'); return null; }

    const allFormats = [...(streaming.adaptiveFormats || []), ...(streaming.formats || [])];

    // Only direct URLs (no cipher to deal with)
    const directAudio = allFormats.filter(f => f.mimeType?.includes('audio') && f.url);

    if (directAudio.length > 0) {
      const best = pickBestAudio(directAudio);
      if (best?.url) {
        console.log(`[YT] ✓ Page scrape OK (direct URL) bitrate:${best.bitrate}`);
        return best.url;
      }
    }

    // Try HLS manifest if available
    if (streaming.hlsManifestUrl) {
      console.log(`[YT] ✓ Page scrape OK (HLS manifest)`);
      return streaming.hlsManifestUrl;
    }

    console.warn(`[YT] Page: ${allFormats.length} formats but none direct`);
    return null;
  } catch (err) {
    console.warn(`[YT] Page scrape error:`, err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// METHOD 5: Direct Innertube API
// ═══════════════════════════════════════════════════════════════
const INNERTUBE_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';

const INNERTUBE_CLIENTS = [
  {
    name: 'TVHTML5_EMBEDDED',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0)' },
    body: {
      context: {
        client: { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.0', hl: 'en', gl: 'US' },
        thirdParty: { embedUrl: 'https://www.youtube.com' },
      },
      contentCheckOk: true, racyCheckOk: true,
    },
  },
  {
    name: 'IOS_MUSIC',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'com.google.ios.youtubemusic/7.04 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X)',
      'X-YouTube-Client-Name': '26',
      'X-YouTube-Client-Version': '7.04',
    },
    body: {
      context: {
        client: {
          clientName: 'IOS_MUSIC', clientVersion: '7.04',
          deviceMake: 'Apple', deviceModel: 'iPhone16,2',
          osName: 'iPhone', osVersion: '17.5.1.21F90',
          hl: 'en', gl: 'US',
        },
      },
      contentCheckOk: true, racyCheckOk: true,
    },
  },
  {
    name: 'ANDROID_MUSIC',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'com.google.android.apps.youtube.music/7.04.51 (Linux; U; Android 14) gzip',
      'X-YouTube-Client-Name': '21',
      'X-YouTube-Client-Version': '7.04.51',
    },
    body: {
      context: {
        client: {
          clientName: 'ANDROID_MUSIC', clientVersion: '7.04.51',
          androidSdkVersion: 34, hl: 'en', gl: 'US',
        },
      },
      contentCheckOk: true, racyCheckOk: true,
    },
  },
];

async function tryInnertube(videoId) {
  for (const client of INNERTUBE_CLIENTS) {
    try {
      console.log(`[YT] Innertube: ${client.name}`);
      const body = { ...client.body, videoId };
      const res = await fetchWithTimeout(
        INNERTUBE_URL,
        { method: 'POST', headers: client.headers, body: JSON.stringify(body) },
        10000
      );

      if (!res.ok) { console.warn(`[YT] Innertube ${client.name} HTTP ${res.status}`); continue; }

      const data = await res.json();
      const status = data?.playabilityStatus?.status;
      if (status !== 'OK') {
        console.warn(`[YT] Innertube ${client.name}: ${status} — ${data?.playabilityStatus?.reason || ''}`);
        continue;
      }

      const allFormats = [
        ...(data?.streamingData?.adaptiveFormats || []),
        ...(data?.streamingData?.formats || []),
      ];

      // Only direct URLs
      const directAudio = allFormats.filter(f => f.mimeType?.includes('audio') && f.url);

      if (directAudio.length > 0) {
        const best = pickBestAudio(directAudio);
        if (best?.url) {
          console.log(`[YT] ✓ Innertube ${client.name} OK bitrate:${best.bitrate}`);
          return best.url;
        }
      }

      // Try HLS
      if (data?.streamingData?.hlsManifestUrl) {
        console.log(`[YT] ✓ Innertube ${client.name} OK (HLS)`);
        return data.streamingData.hlsManifestUrl;
      }

      const ciphered = allFormats.filter(f => f.signatureCipher || f.cipher).length;
      console.warn(`[YT] Innertube ${client.name}: 0 direct, ${ciphered} ciphered`);
    } catch (err) {
      console.warn(`[YT] Innertube ${client.name}:`, err.message);
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// MAIN: Try all methods in order
// ═══════════════════════════════════════════════════════════════
export async function getStreamUrl(videoId) {
  if (!videoId || typeof videoId !== 'string') {
    throw new Error('Invalid video ID');
  }

  console.log(`\n[YT] ═══ Getting stream for: ${videoId} ═══`);
  const t = Date.now();

  const methods = [
    { name: 'Piped', fn: () => tryPiped(videoId) },
    { name: 'Invidious', fn: () => tryInvidious(videoId) },
    { name: 'Cobalt', fn: () => tryCobalt(videoId) },
    { name: 'PageScrape', fn: () => tryPageScrape(videoId) },
    { name: 'Innertube', fn: () => tryInnertube(videoId) },
  ];

  for (const method of methods) {
    try {
      const url = await method.fn();
      if (url) {
        console.log(`[YT] ═══ SUCCESS via ${method.name} in ${Date.now() - t}ms ═══\n`);
        return url;
      }
    } catch (err) {
      console.warn(`[YT] ${method.name} error:`, err.message);
    }
  }

  console.error(`[YT] ═══ ALL METHODS FAILED after ${Date.now() - t}ms ═══\n`);
  throw new Error('Could not get audio stream. All extraction methods failed. Check your internet connection and try again.');
}
