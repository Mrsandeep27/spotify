// YouTube audio stream extraction with signature decryption.
//
// The signature decipher functions (b0, kt, Ka) are LOCAL variables
// inside the player JS IIFE closure: (function(g){...})(_yt_player)
//
// To call them, we:
// 1. Fetch the player JS (1.5MB)
// 2. Find the decipher function names & args via regex
// 3. Inject g.decipher = function(sig){...} INSIDE the IIFE (before closing)
// 4. Eval the modified JS in a WebView
// 5. Call _yt_player.decipher(encryptedSig)
// 6. Get the deciphered signature, build the final audio URL

import { evalInWebView, isWebViewReady } from './webViewBridge';

function fetchT(url, opts = {}, ms = 15000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
}

// Cache
let cachedPlayerJs = null;
let cachedPlayerUrl = null;
let cacheExpiry = 0;

// ═══════════════════════════════════════════
// Step 1: Fetch YouTube page, get cipher data
// ═══════════════════════════════════════════
async function fetchVideoInfo(videoId) {
  console.log('[YT] Fetching page...');
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

  const prMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s);
  if (!prMatch) throw new Error('No player response');
  const pr = JSON.parse(prMatch[1]);
  if (pr?.playabilityStatus?.status !== 'OK') {
    throw new Error(`${pr?.playabilityStatus?.status}: ${pr?.playabilityStatus?.reason || ''}`);
  }

  const sd = pr?.streamingData;
  if (!sd) throw new Error('No streaming data');

  const jsMatch = html.match(/"jsUrl"\s*:\s*"([^"]+)"/);
  if (!jsMatch) throw new Error('No player JS URL');
  const playerJsUrl = 'https://www.youtube.com' + jsMatch[1];

  const allFmts = [...(sd.adaptiveFormats || []), ...(sd.formats || [])];
  const audio = allFmts.filter(f => f.mimeType?.includes('audio'));
  if (!audio.length) throw new Error('No audio formats');

  // Sort: AAC first, then highest bitrate
  audio.sort((a, b) => {
    const aAac = (a.mimeType || '').includes('mp4a') ? 1 : 0;
    const bAac = (b.mimeType || '').includes('mp4a') ? 1 : 0;
    if (bAac !== aAac) return bAac - aAac;
    return (b.bitrate || 0) - (a.bitrate || 0);
  });

  // Check direct URL
  const direct = audio.find(f => f.url);
  if (direct) return { directUrl: direct.url };

  // Get ciphered format
  const ciphered = audio.find(f => f.signatureCipher || f.cipher);
  if (!ciphered) throw new Error('No streams available');

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

// ═══════════════════════════════════════════
// Step 2: Fetch and modify player JS
// ═══════════════════════════════════════════
async function getModifiedPlayerJs(playerJsUrl) {
  if (cachedPlayerJs && cachedPlayerUrl === playerJsUrl && Date.now() < cacheExpiry) {
    console.log('[YT] Using cached player JS');
    return cachedPlayerJs;
  }

  console.log('[YT] Fetching player JS...');
  const res = await fetchT(playerJsUrl, {}, 25000);
  if (!res.ok) throw new Error(`Player JS HTTP ${res.status}`);
  const js = await res.text();
  console.log('[YT] Player JS:', js.length, 'bytes');

  // Find decipher pattern: kt(32,1268,b0(29,5694,C.s))
  const dp = /(\w+)\((\d+)\s*,\s*(\d+)\s*,\s*(\w+)\((\d+)\s*,\s*(\d+)\s*,\s*\w+\.s\)\)/;
  const dm = js.match(dp);
  if (!dm) throw new Error('Decipher pattern not found');

  const [, ktN, ktA1, ktA2, b0N, b0A1, b0A2] = dm;

  // Find Ka wrapper near the decipher call
  const near = js.substring(dm.index, dm.index + 200);
  const km = near.match(/(\w+)\((\d+)\s*,\s*(\d+)\s*,\s*\w+\)\s*\}/);

  let decipherBody;
  if (km) {
    decipherBody = `return ${km[1]}(${km[2]},${km[3]},${ktN}(${ktA1},${ktA2},${b0N}(${b0A1},${b0A2},sig)));`;
    console.log(`[YT] Decipher: ${km[1]}(${km[2]},${km[3]}, ${ktN}(${ktA1},${ktA2}, ${b0N}(${b0A1},${b0A2}, sig)))`);
  } else {
    decipherBody = `return ${ktN}(${ktA1},${ktA2},${b0N}(${b0A1},${b0A2},sig));`;
    console.log(`[YT] Decipher: ${ktN}(${ktA1},${ktA2}, ${b0N}(${b0A1},${b0A2}, sig))`);
  }

  // Find the IIFE end: })(_yt_player);
  const iifeEnd = js.lastIndexOf('})(_yt_player)');
  if (iifeEnd === -1) throw new Error('IIFE end not found');

  // Inject decipher hook INSIDE the closure, before })(_yt_player)
  // g === _yt_player, so g.decipher becomes _yt_player.decipher
  const hook = `\ng.decipher=function(sig){try{${decipherBody}}catch(e){return null;}};\n`;
  const modifiedJs = js.substring(0, iifeEnd) + hook + js.substring(iifeEnd);

  console.log('[YT] Injected decipher hook at position', iifeEnd);

  // Cache for 2 hours
  cachedPlayerJs = modifiedJs;
  cachedPlayerUrl = playerJsUrl;
  cacheExpiry = Date.now() + 2 * 3600 * 1000;

  return modifiedJs;
}

// ═══════════════════════════════════════════
// Step 3: Run decipher in WebView
// ═══════════════════════════════════════════
async function decipherSig(modifiedJs, encSig) {
  if (!isWebViewReady()) throw new Error('WebView not ready');
  console.log('[YT] Running decipher in WebView...');
  return await evalInWebView(modifiedJs, encSig);
}

// ═══════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════
export async function getStreamUrl(videoId) {
  if (!videoId) throw new Error('Invalid video ID');

  console.log(`\n[YT] ═══ Stream for: ${videoId} ═══`);
  const t = Date.now();

  // Step 1: Video info
  const info = await fetchVideoInfo(videoId);
  if (info.directUrl) {
    console.log(`[YT] ═══ OK (direct) ${Date.now() - t}ms ═══\n`);
    return info.directUrl;
  }

  // Step 2: Modified player JS
  const modifiedJs = await getModifiedPlayerJs(info.playerJsUrl);

  // Step 3: Decipher
  const decSig = await decipherSig(modifiedJs, info.encSig);
  if (!decSig) throw new Error('Decipher returned empty');

  // Step 4: Build URL
  const finalUrl = `${info.baseUrl}&${info.sp}=${encodeURIComponent(decSig)}`;
  console.log(`[YT] ═══ OK in ${Date.now() - t}ms ═══\n`);
  return finalUrl;
}
