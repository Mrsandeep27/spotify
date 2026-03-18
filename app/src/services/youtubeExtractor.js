// Client-side YouTube stream URL extraction with cipher decryption
// Runs on the user's phone (residential IP) — YouTube won't block it

const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

// ── Cipher cache (reused across songs, refreshed every hour) ──
let cipherCache = null;
let cipherCacheExpiry = 0;

// ── Get or refresh the cipher context ──
async function getCipher() {
  if (cipherCache && Date.now() < cipherCacheExpiry) return cipherCache;

  // 1. Fetch YouTube homepage to find the player JS URL
  const html = await fetch('https://m.youtube.com/', {
    headers: { 'User-Agent': UA },
  }).then((r) => r.text());

  const playerMatch = html.match(
    /\/s\/player\/([a-zA-Z0-9_-]+)\/player_ias\.vflset\/[^"]+?\/base\.js/
  );
  if (!playerMatch) throw new Error('Cannot find player JS URL');

  // 2. Fetch the player JS
  const playerUrl = `https://www.youtube.com${playerMatch[0]}`;
  const js = await fetch(playerUrl).then((r) => r.text());

  // 3. Extract signatureTimestamp (needed for Innertube player request)
  const stsMatch = js.match(/signatureTimestamp[=:](\d+)/);
  const sts = stsMatch ? parseInt(stsMatch[1], 10) : 0;

  // 4. Extract cipher operations
  const operations = extractCipherOps(js);

  cipherCache = { sts, operations, playerUrl };
  cipherCacheExpiry = Date.now() + 3600000; // 1 hour
  console.log('[YT] Cipher loaded, sts:', sts, 'ops:', operations.length);
  return cipherCache;
}

// ── Extract cipher operations from player JS ──
function extractCipherOps(js) {
  // Find the top-level cipher function name
  // YouTube uses several patterns to reference it
  const namePatterns = [
    /\b[a-zA-Z0-9]+\s*&&\s*[a-zA-Z0-9]+\.set\([^,]+\s*,\s*encodeURIComponent\(([a-zA-Z0-9$]+)\(/,
    /\bm=([a-zA-Z0-9$]{2,})\(decodeURIComponent\(h\.s\)\)/,
    /\bc\s*&&\s*d\.set\([^,]+\s*,\s*(?:encodeURIComponent\s*\()([a-zA-Z0-9$]+)\(/,
    /\bc\s*&&\s*[a-z]\.set\([^,]+\s*,\s*([a-zA-Z0-9$]+)\(/,
    /\bc\s*&&\s*[a-z]\.set\([^,]+\s*,\s*encodeURIComponent\(([a-zA-Z0-9$]+)\(/,
    /([a-zA-Z0-9$]+)\s*=\s*function\(\s*a\s*\)\s*\{\s*a\s*=\s*a\.split\(\s*""\s*\)/,
  ];

  let funcName = null;
  for (const p of namePatterns) {
    const m = js.match(p);
    if (m) {
      funcName = m[1];
      break;
    }
  }
  if (!funcName) throw new Error('Cannot find cipher function name');

  // Find the cipher function body: funcName=function(a){a=a.split("");...}
  const esc = funcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const funcRe = new RegExp(
    `(?:var\\s+)?${esc}\\s*=\\s*function\\(a\\)\\{a=a\\.split\\(""\\);([^}]+)\\}`
  );
  const bodyMatch = js.match(funcRe);
  if (!bodyMatch) throw new Error('Cannot find cipher function body');

  const body = bodyMatch[1];

  // Find the helper object name (e.g. Xy in Xy.ab(a, 42))
  const helperMatch = body.match(/;([a-zA-Z0-9$]+)\./);
  if (!helperMatch) throw new Error('Cannot find helper object name');
  const helperName = helperMatch[1];

  // Find the helper object definition: var Xy={ab:function(a,b){...}, ...};
  const hEsc = helperName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const helperRe = new RegExp(`var\\s+${hEsc}\\s*=\\s*\\{([\\s\\S]*?)\\};`);
  const helperDef = js.match(helperRe);
  if (!helperDef) throw new Error('Cannot find helper object');

  // Classify each method: reverse, splice, or swap
  const methods = {};
  const methodRe = /([a-zA-Z0-9]+)\s*:\s*function\s*\(a(?:,\s*b)?\)\s*\{([\s\S]*?)\}/g;
  let mm;
  while ((mm = methodRe.exec(helperDef[1]))) {
    const impl = mm[2];
    if (impl.includes('reverse')) methods[mm[1]] = 'reverse';
    else if (impl.includes('splice')) methods[mm[1]] = 'splice';
    else methods[mm[1]] = 'swap';
  }

  // Parse operations from the cipher function body
  const opsRe = new RegExp(
    `${hEsc}\\.([a-zA-Z0-9]+)\\(a,(\\d+)\\)`,
    'g'
  );
  const ops = [];
  let om;
  while ((om = opsRe.exec(body))) {
    const type = methods[om[1]];
    if (type) ops.push({ type, param: parseInt(om[2], 10) });
  }

  // Also handle calls without a second param (reverse)
  const opsRe2 = new RegExp(`${hEsc}\\.([a-zA-Z0-9]+)\\(a\\)`, 'g');
  // Rescan body for paramless calls
  while ((om = opsRe2.exec(body))) {
    const type = methods[om[1]];
    if (type === 'reverse') ops.push({ type: 'reverse', param: 0 });
  }

  if (ops.length === 0) throw new Error('No cipher operations extracted');
  return ops;
}

// ── Apply cipher operations to decrypt a signature ──
function decipherSignature(sig, operations) {
  const a = sig.split('');
  for (const op of operations) {
    switch (op.type) {
      case 'reverse':
        a.reverse();
        break;
      case 'splice':
        a.splice(0, op.param);
        break;
      case 'swap': {
        const idx = op.param % a.length;
        const tmp = a[0];
        a[0] = a[idx];
        a[idx] = tmp;
        break;
      }
    }
  }
  return a.join('');
}

// ── Build a playable URL from a format object ──
function buildUrl(format, operations) {
  if (format.url) return format.url;

  const cipher = format.signatureCipher || format.cipher;
  if (!cipher) return null;

  const params = {};
  cipher.split('&').forEach((pair) => {
    const [k, ...v] = pair.split('=');
    params[k] = decodeURIComponent(v.join('='));
  });

  const url = params.url;
  const sig = params.s;
  const sp = params.sp || 'signature';
  if (!url || !sig) return null;

  const deciphered = decipherSignature(sig, operations);
  return `${url}&${sp}=${encodeURIComponent(deciphered)}`;
}

// ── Main: get a playable audio stream URL ──
export async function getStreamUrl(videoId) {
  // Step 1: get cipher context (cached)
  const cipher = await getCipher();

  // Step 2: request video info via Innertube with correct signatureTimestamp
  const res = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}&prettyPrint=false`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-YouTube-Client-Name': '2',
        'X-YouTube-Client-Version': '2.20241209.01.00',
        'User-Agent': UA,
      },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: 'MWEB',
            clientVersion: '2.20241209.01.00',
            hl: 'en',
            gl: 'US',
          },
        },
        playbackContext: {
          contentPlaybackContext: {
            signatureTimestamp: cipher.sts,
            html5Preference: 'HTML5_PREF_WANTS',
          },
        },
      }),
    }
  );

  if (!res.ok) throw new Error(`Innertube HTTP ${res.status}`);
  const data = await res.json();

  if (data?.playabilityStatus?.status !== 'OK') {
    // Fallback: try extracting from YouTube page directly
    console.warn('[YT] Innertube status:', data?.playabilityStatus?.status, '— trying page fallback');
    return await extractFromPage(videoId, cipher);
  }

  const formats = [
    ...(data?.streamingData?.adaptiveFormats || []),
    ...(data?.streamingData?.formats || []),
  ];

  // Find best audio format
  const audioUrl = pickBestAudio(formats, cipher.operations);
  if (audioUrl) {
    console.log('[YT] Stream URL via Innertube MWEB');
    return audioUrl;
  }

  // Fallback to page extraction
  return await extractFromPage(videoId, cipher);
}

// ── Pick best audio URL from format list ──
function pickBestAudio(formats, operations) {
  const audioFormats = formats
    .filter((f) => f.mimeType?.includes('audio'))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

  for (const fmt of audioFormats) {
    const url = buildUrl(fmt, operations);
    if (url) return url;
  }
  return null;
}

// ── Fallback: extract from mobile YouTube page ──
async function extractFromPage(videoId, cipher) {
  const res = await fetch(`https://m.youtube.com/watch?v=${videoId}`, {
    headers: { 'User-Agent': UA },
  });

  const html = await res.text();
  const match = html.match(/var\s+ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/);
  if (!match) throw new Error('No ytInitialPlayerResponse in page');

  const data = JSON.parse(match[1]);
  if (data?.playabilityStatus?.status !== 'OK') {
    throw new Error(`Page playability: ${data?.playabilityStatus?.status}`);
  }

  const formats = [
    ...(data?.streamingData?.adaptiveFormats || []),
    ...(data?.streamingData?.formats || []),
  ];

  const audioUrl = pickBestAudio(formats, cipher.operations);
  if (audioUrl) {
    console.log('[YT] Stream URL via page extraction');
    return audioUrl;
  }

  throw new Error('No audio format found in page data');
}
