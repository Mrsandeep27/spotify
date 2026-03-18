// Client-side YouTube audio stream extraction
// PRIMARY: WebView-based (YouTube's own JS deciphers signatures)
// FALLBACK: Piped/Invidious proxies (when available)
//
// Runs on user's phone (residential IP).

import { extractViaWebView, isWebViewReady } from './webViewBridge';

// ── Timeout wrapper ──
function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

// ── Pick best audio stream ──
function pickBestAudio(streams) {
  if (!streams || streams.length === 0) return null;
  const sorted = [...streams].sort((a, b) => {
    const mime = (f) => f.mimeType || f.type || f.codec || '';
    const aAac = mime(a).includes('mp4a') || mime(a).includes('audio/mp4') ? 1 : 0;
    const bAac = mime(b).includes('mp4a') || mime(b).includes('audio/mp4') ? 1 : 0;
    if (bAac !== aAac) return bAac - aAac;
    return (b.bitrate || 0) - (a.bitrate || 0);
  });
  return sorted[0];
}

// ═══════════════════════════════════════════════
// METHOD 1: WebView (YouTube's own player deciphers)
// ═══════════════════════════════════════════════
async function tryWebView(videoId) {
  if (!isWebViewReady()) {
    console.log('[YT] WebView not ready yet');
    return null;
  }

  try {
    console.log('[YT] Trying WebView extraction...');
    const url = await extractViaWebView(videoId);
    if (url) {
      console.log('[YT] ✓ WebView OK');
      return url;
    }
  } catch (err) {
    console.warn('[YT] WebView error:', err.message);
  }
  return null;
}

// ═══════════════════════════════════════════════
// METHOD 2: Piped API (public YouTube proxies)
// ═══════════════════════════════════════════════
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.r4fo.com',
  'https://pipedapi.leptons.xyz',
  'https://api.piped.yt',
  'https://pipedapi.darkness.services',
];

async function tryPiped(videoId) {
  for (const instance of PIPED_INSTANCES) {
    try {
      const res = await fetchWithTimeout(`${instance}/streams/${videoId}`, {}, 8000);
      if (!res.ok) continue;
      const data = await res.json();
      const best = pickBestAudio(data.audioStreams);
      if (best?.url) {
        console.log(`[YT] ✓ Piped OK (${instance})`);
        return best.url;
      }
    } catch (err) { /* skip */ }
  }
  return null;
}

// ═══════════════════════════════════════════════
// METHOD 3: Invidious API
// ═══════════════════════════════════════════════
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.protokoll-11.dev',
  'https://vid.puffyan.us',
  'https://inv.tux.pizza',
  'https://invidious.lunar.icu',
];

async function tryInvidious(videoId) {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetchWithTimeout(`${instance}/api/v1/videos/${videoId}`, {}, 8000);
      if (!res.ok) continue;
      const data = await res.json();
      const audio = (data.adaptiveFormats || []).filter(f => f.type?.startsWith('audio/') && f.url);
      const best = pickBestAudio(audio);
      if (best?.url) {
        console.log(`[YT] ✓ Invidious OK (${instance})`);
        return best.url;
      }
    } catch (err) { /* skip */ }
  }
  return null;
}

// ═══════════════════════════════════════════════
// MAIN: Try all methods
// ═══════════════════════════════════════════════
export async function getStreamUrl(videoId) {
  if (!videoId || typeof videoId !== 'string') {
    throw new Error('Invalid video ID');
  }

  console.log(`\n[YT] ═══ Getting stream for: ${videoId} ═══`);
  const t = Date.now();

  // Method 1: WebView (most reliable — uses YouTube's own player)
  const webViewUrl = await tryWebView(videoId);
  if (webViewUrl) {
    console.log(`[YT] ═══ SUCCESS via WebView in ${Date.now() - t}ms ═══\n`);
    return webViewUrl;
  }

  // Method 2: Piped proxies
  const pipedUrl = await tryPiped(videoId);
  if (pipedUrl) {
    console.log(`[YT] ═══ SUCCESS via Piped in ${Date.now() - t}ms ═══\n`);
    return pipedUrl;
  }

  // Method 3: Invidious proxies
  const invUrl = await tryInvidious(videoId);
  if (invUrl) {
    console.log(`[YT] ═══ SUCCESS via Invidious in ${Date.now() - t}ms ═══\n`);
    return invUrl;
  }

  console.error(`[YT] ═══ ALL METHODS FAILED after ${Date.now() - t}ms ═══\n`);
  throw new Error('Could not get audio stream. All extraction methods failed. Check your internet connection and try again.');
}
