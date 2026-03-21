// YouTube audio stream extraction with signature decryption.
//
// Flow:
// 1. Fetch YouTube watch page → get signatureCipher data + player JS URL
// 2. Analyze player JS → find decipher function names & args
// 3. Load player JS in WebView from YouTube CDN → call decipher function
// 4. Build final URL with deciphered signature
//
// The player JS is loaded from YouTube's own CDN in the WebView,
// so the decipher functions run in their original context.

import { evalInWebView, isWebViewReady } from './webViewBridge';

// ── Timeout fetch ──
function fetchT(url, opts = {}, ms = 15000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
}

// ── Cache ──
let cachedAnalysis = null;
let cacheExpiry = 0;

// ═══════════════════════════════════════════════
// Step 1: Fetch YouTube page
// ═══════════════════════════════════════════════
async function fetchVideoInfo(videoId) {
  console.log('[YT] Fetching page for', videoId);
  const res = await fetchT(
    `https://m.youtube.com/watch?v=${videoId}&bpctr=9999999999&has_verified=1`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    }
  );

  if (!res.ok) throw new Error(`Page HTTP ${res.status}`);
  const html = await res.text();

  // Extract player response
  const prMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s);
  if (!prMatch) throw new Error('No player response in page');

  const pr = JSON.parse(prMatch[1]);
  if (pr?.playabilityStatus?.status !== 'OK') {
    throw new Error(`Video ${pr?.playabilityStatus?.status}: ${pr?.playabilityStatus?.reason || ''}`);
  }

  const sd = pr?.streamingData;
  if (!sd) throw new Error('No streaming data');

  // Player JS URL
  const jsMatch = html.match(/"jsUrl"\s*:\s*"([^"]+)"/);
  if (!jsMatch) throw new Error('No player JS URL');
  const playerJsUrl = 'https://www.youtube.com' + jsMatch[1];

  // Audio formats
  const allFmts = [...(sd.adaptiveFormats || []), ...(sd.formats || [])];
  const audio = allFmts.filter(f => f.mimeType?.includes('audio'));
  if (!audio.length) throw new Error('No audio formats');

  // Prefer AAC, highest bitrate
  audio.sort((a, b) => {
    const aAac = a.mimeType.includes('mp4a') ? 1 : 0;
    const bAac = b.mimeType.includes('mp4a') ? 1 : 0;
    if (bAac !== aAac) return bAac - aAac;
    return (b.bitrate || 0) - (a.bitrate || 0);
  });

  // Check for direct URL
  const direct = audio.find(f => f.url);
  if (direct) {
    console.log('[YT] Direct audio URL found!');
    return { directUrl: direct.url };
  }

  // Get ciphered format
  const ciphered = audio.find(f => f.signatureCipher || f.cipher);
  if (!ciphered) throw new Error('No audio streams available');

  const cipherStr = ciphered.signatureCipher || ciphered.cipher;
  const params = {};
  cipherStr.split('&').forEach(p => {
    const [k, ...v] = p.split('=');
    params[k] = decodeURIComponent(v.join('='));
  });

  return {
    encSig: params.s,
    sp: params.sp || 'sig',
    baseUrl: params.url,
    playerJsUrl,
  };
}

// ═══════════════════════════════════════════════
// Step 2: Analyze player JS for decipher pattern
// ═══════════════════════════════════════════════
async function analyzePlayerJs(playerJsUrl) {
  if (cachedAnalysis && Date.now() < cacheExpiry && cachedAnalysis.url === playerJsUrl) {
    return cachedAnalysis;
  }

  console.log('[YT] Fetching player JS...');
  const res = await fetchT(playerJsUrl, {}, 20000);
  if (!res.ok) throw new Error(`Player JS HTTP ${res.status}`);
  const js = await res.text();
  console.log('[YT] Player JS:', js.length, 'bytes');

  // Find: kt(32,1268,b0(29,5694,C.s))
  const dp = /(\w+)\((\d+)\s*,\s*(\d+)\s*,\s*(\w+)\((\d+)\s*,\s*(\d+)\s*,\s*\w+\.s\)\)/;
  const dm = js.match(dp);
  if (!dm) throw new Error('Decipher pattern not found');

  const [, ktN, ktA1, ktA2, b0N, b0A1, b0A2] = dm;
  console.log(`[YT] Pattern: ${ktN}(${ktA1},${ktA2},${b0N}(${b0A1},${b0A2},s))`);

  // Find Ka wrapper near the decipher
  const near = js.substring(dm.index, dm.index + 200);
  const km = near.match(/(\w+)\((\d+)\s*,\s*(\d+)\s*,\s*\w+\)\s*\}/);
  let expr;
  if (km) {
    expr = `${km[1]}(${km[2]},${km[3]},${ktN}(${ktA1},${ktA2},${b0N}(${b0A1},${b0A2},sig)))`;
    console.log(`[YT] Full chain: ${km[1]}(${km[2]},${km[3]}, ${ktN}(...))`);
  } else {
    expr = `${ktN}(${ktA1},${ktA2},${b0N}(${b0A1},${b0A2},sig))`;
  }

  const analysis = { url: playerJsUrl, decipherExpr: expr };
  cachedAnalysis = analysis;
  cacheExpiry = Date.now() + 2 * 3600 * 1000;
  return analysis;
}

// ═══════════════════════════════════════════════
// Step 3: Decipher in WebView
// ═══════════════════════════════════════════════
async function decipher(playerJsUrl, decipherExpr, encSig) {
  if (!isWebViewReady()) throw new Error('WebView not ready');

  console.log('[YT] Deciphering in WebView...');
  return await evalInWebView(null, encSig, playerJsUrl, decipherExpr);
}

// ═══════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════
export async function getStreamUrl(videoId) {
  if (!videoId) throw new Error('Invalid video ID');

  console.log(`\n[YT] ═══ Stream for: ${videoId} ═══`);
  const t = Date.now();

  // Step 1: Get video info
  const info = await fetchVideoInfo(videoId);
  if (info.directUrl) {
    console.log(`[YT] ═══ OK (direct) ${Date.now() - t}ms ═══\n`);
    return info.directUrl;
  }

  // Step 2: Analyze player JS
  const analysis = await analyzePlayerJs(info.playerJsUrl);

  // Step 3: Decipher signature
  const decSig = await decipher(info.playerJsUrl, analysis.decipherExpr, info.encSig);
  if (!decSig) throw new Error('Decipher returned empty');

  // Step 4: Build URL
  const finalUrl = `${info.baseUrl}&${info.sp}=${encodeURIComponent(decSig)}`;
  console.log(`[YT] ═══ OK ${Date.now() - t}ms ═══\n`);
  return finalUrl;
}
