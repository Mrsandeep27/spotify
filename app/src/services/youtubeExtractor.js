// YouTube audio stream extraction.
//
// PRIMARY: WebView loads YouTube embed page → YouTube's own player
// deciphers signatures → we capture the deciphered audio URL from
// XHR interception or performance.getEntries().
//
// FALLBACK: Direct page scrape for any direct (non-ciphered) URLs.

import { extractViaWebView, isWebViewReady } from './webViewBridge';

function fetchT(url, opts = {}, ms = 15000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
}

// ═══════════════════════════════════════════
// Method 1: WebView embed extraction
// YouTube's own player handles all decryption
// ═══════════════════════════════════════════
async function tryWebView(videoId) {
  if (!isWebViewReady()) {
    console.log('[YT] WebView not ready');
    return null;
  }

  try {
    console.log('[YT] Loading YouTube embed in WebView...');
    const url = await extractViaWebView(videoId);
    if (url) {
      console.log('[YT] WebView captured audio URL');
      return url;
    }
  } catch (err) {
    console.warn('[YT] WebView error:', err.message);
  }
  return null;
}

// ═══════════════════════════════════════════
// Method 2: Direct page scrape (for non-ciphered URLs only)
// ═══════════════════════════════════════════
async function tryPageScrape(videoId) {
  try {
    console.log('[YT] Page scrape...');
    const res = await fetchT(
      `https://m.youtube.com/watch?v=${videoId}&bpctr=9999999999`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      }
    );
    if (!res.ok) return null;
    const html = await res.text();

    const prMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s);
    if (!prMatch) return null;
    const pr = JSON.parse(prMatch[1]);
    if (pr?.playabilityStatus?.status !== 'OK') return null;

    const sd = pr?.streamingData;
    if (!sd) return null;

    const allFmts = [...(sd.adaptiveFormats || []), ...(sd.formats || [])];
    const directAudio = allFmts.filter(f => f.mimeType?.includes('audio') && f.url);

    if (directAudio.length > 0) {
      directAudio.sort((a, b) => {
        const aAac = (a.mimeType || '').includes('mp4a') ? 1 : 0;
        const bAac = (b.mimeType || '').includes('mp4a') ? 1 : 0;
        if (bAac !== aAac) return bAac - aAac;
        return (b.bitrate || 0) - (a.bitrate || 0);
      });
      console.log('[YT] Direct audio URL from page scrape');
      return directAudio[0].url;
    }

    // HLS fallback
    if (sd.hlsManifestUrl) {
      console.log('[YT] HLS manifest from page scrape');
      return sd.hlsManifestUrl;
    }
  } catch (err) {
    console.warn('[YT] Page scrape error:', err.message);
  }
  return null;
}

// ═══════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════
export async function getStreamUrl(videoId) {
  if (!videoId) throw new Error('Invalid video ID');

  console.log(`\n[YT] ═══ Stream for: ${videoId} ═══`);
  const t = Date.now();

  // Method 1: WebView (YouTube's own player deciphers)
  const webViewUrl = await tryWebView(videoId);
  if (webViewUrl) {
    console.log(`[YT] ═══ OK via WebView in ${Date.now() - t}ms ═══\n`);
    return webViewUrl;
  }

  // Method 2: Direct page scrape (non-ciphered URLs only)
  const scrapeUrl = await tryPageScrape(videoId);
  if (scrapeUrl) {
    console.log(`[YT] ═══ OK via scrape in ${Date.now() - t}ms ═══\n`);
    return scrapeUrl;
  }

  console.error(`[YT] ═══ FAILED after ${Date.now() - t}ms ═══\n`);
  throw new Error('Could not get audio stream. Try again.');
}
