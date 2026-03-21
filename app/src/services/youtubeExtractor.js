// YouTube audio stream extraction with in-process cipher decryption.
//
// Runs YouTube's player JS directly in React Native's JS engine.
// Browser API stubs prevent DOM-related crashes.
// Decipher hook injected early in the code (before DOM code runs).

function fetchT(url, opts = {}, ms = 15000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
}

let cachedDecipher = null;
let cachedPlayerUrl = null;
let cacheExpiry = 0;

// ═══════════════════════════════════════════
// Browser stubs — window object with all properties
// ═══════════════════════════════════════════
function makeBrowserStubs() {
  const noop = function () {};
  const noopObj = function () { return {}; };
  const el = function () {
    return {
      style: {}, setAttribute: noop, getAttribute: function () { return null; },
      appendChild: noop, removeChild: noop, addEventListener: noop,
      removeEventListener: noop, getElementsByTagName: function () { return []; },
      querySelector: function () { return null; }, querySelectorAll: function () { return []; },
      classList: { add: noop, remove: noop, contains: function () { return false; }, toggle: noop },
      getBoundingClientRect: function () { return { top: 0, left: 0, width: 0, height: 0 }; },
      insertBefore: noop, replaceChild: noop, cloneNode: function () { return el(); },
      hasAttribute: function () { return false; }, removeAttribute: noop,
      dispatchEvent: noop, textContent: '', innerHTML: '', innerText: '',
      parentNode: null, parentElement: null, childNodes: [], children: [],
      firstChild: null, lastChild: null, nextSibling: null,
      offsetWidth: 0, offsetHeight: 0, clientWidth: 0, clientHeight: 0,
    };
  };

  const doc = {
    createElement: el, createElementNS: el, createTextNode: function () { return {}; },
    createDocumentFragment: function () { return { appendChild: noop, querySelector: function () { return null; }, querySelectorAll: function () { return []; } }; },
    getElementById: function () { return null; }, querySelector: function () { return null; },
    querySelectorAll: function () { return []; }, getElementsByClassName: function () { return []; },
    getElementsByTagName: function () { return []; }, addEventListener: noop,
    removeEventListener: noop, createEvent: function () { return { initEvent: noop }; },
    head: el(), body: el(), documentElement: el(),
    cookie: '', domain: 'youtube.com', readyState: 'complete',
    hidden: false, visibilityState: 'visible', hasFocus: function () { return true; },
    title: '', location: { href: 'https://www.youtube.com/', hostname: 'www.youtube.com', protocol: 'https:', search: '', pathname: '/', origin: 'https://www.youtube.com', hash: '' },
  };

  const win = {
    document: doc,
    navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7)', platform: 'Linux armv8l', language: 'en-US', languages: ['en-US', 'en'], onLine: true, cookieEnabled: true, hardwareConcurrency: 8, maxTouchPoints: 5, mediaDevices: { enumerateDevices: function () { return Promise.resolve([]); } }, sendBeacon: noop, },
    location: doc.location,
    screen: { width: 1080, height: 2400, availWidth: 1080, availHeight: 2400, colorDepth: 24 },
    history: { pushState: noop, replaceState: noop, back: noop, forward: noop, go: noop, length: 1 },
    XMLHttpRequest: function () { this.open = noop; this.send = noop; this.setRequestHeader = noop; this.addEventListener = noop; this.removeEventListener = noop; this.readyState = 0; this.status = 0; this.response = null; this.responseText = ''; },
    fetch: function () { return Promise.resolve({ ok: false, status: 0, json: function () { return Promise.resolve({}); }, text: function () { return Promise.resolve(''); } }); },
    setTimeout: function (f) { try { if (typeof f === 'function') f(); } catch (e) {} return 0; },
    setInterval: function () { return 0; },
    clearTimeout: noop, clearInterval: noop,
    requestAnimationFrame: function () { return 0; }, cancelAnimationFrame: noop,
    performance: { now: function () { return Date.now(); }, mark: noop, measure: noop, getEntries: function () { return []; }, getEntriesByName: function () { return []; }, getEntriesByType: function () { return []; } },
    CSS: { supports: function () { return false; } },
    matchMedia: function () { return { matches: false, addListener: noop, removeListener: noop, addEventListener: noop, removeEventListener: noop }; },
    getComputedStyle: function () { return { getPropertyValue: function () { return ''; } }; },
    MutationObserver: function () { this.observe = noop; this.disconnect = noop; this.takeRecords = function () { return []; }; },
    IntersectionObserver: function () { this.observe = noop; this.disconnect = noop; this.unobserve = noop; },
    ResizeObserver: function () { this.observe = noop; this.disconnect = noop; this.unobserve = noop; },
    Event: function () {},
    CustomEvent: function () {},
    MediaSource: function () {},
    AudioContext: function () { this.createGain = function () { return { gain: { value: 1 }, connect: noop }; }; this.destination = {}; },
    Image: function () {},
    Worker: function () { this.postMessage = noop; this.terminate = noop; },
    WebSocket: function () { this.send = noop; this.close = noop; },
    BroadcastChannel: function () { this.postMessage = noop; this.close = noop; },
    localStorage: { getItem: function () { return null; }, setItem: noop, removeItem: noop },
    sessionStorage: { getItem: function () { return null; }, setItem: noop, removeItem: noop },
    indexedDB: null,
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: noop,
    postMessage: noop,
    innerWidth: 1080, innerHeight: 2400, outerWidth: 1080, outerHeight: 2400,
    devicePixelRatio: 2,
    scrollX: 0, scrollY: 0, pageXOffset: 0, pageYOffset: 0,
    scrollTo: noop, scroll: noop, scrollBy: noop,
    open: noop, close: noop, focus: noop, blur: noop,
    atob: function (s) { /* basic atob */ try { var b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='; var o = ''; for (var i = 0; i < s.length;) { var e1 = b.indexOf(s.charAt(i++)); var e2 = b.indexOf(s.charAt(i++)); var e3 = b.indexOf(s.charAt(i++)); var e4 = b.indexOf(s.charAt(i++)); var n = (e1 << 18) | (e2 << 12) | (e3 << 6) | e4; o += String.fromCharCode((n >> 16) & 255); if (e3 !== 64) o += String.fromCharCode((n >> 8) & 255); if (e4 !== 64) o += String.fromCharCode(n & 255); } return o; } catch (e) { return ''; } },
    btoa: function (s) { try { var b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='; var o = ''; for (var i = 0; i < s.length;) { var c1 = s.charCodeAt(i++); var c2 = s.charCodeAt(i++); var c3 = s.charCodeAt(i++); o += b.charAt(c1 >> 2); o += b.charAt(((c1 & 3) << 4) | (c2 >> 4)); o += b.charAt(isNaN(c2) ? 64 : ((c2 & 15) << 2) | (c3 >> 6)); o += b.charAt(isNaN(c3) ? 64 : c3 & 63); } return o; } catch (e) { return ''; } },
  };

  win.MediaSource.isTypeSupported = function () { return false; };
  win.self = win;
  win.top = win;
  win.parent = win;
  win.frames = win;
  win.globalThis = win;
  win.window = win;

  return win;
}

// ═══════════════════════════════════════════
// Step 1: Fetch YouTube page
// ═══════════════════════════════════════════
async function fetchVideoInfo(videoId) {
  console.log('[YT] Fetching page...');
  const res = await fetchT(
    `https://m.youtube.com/watch?v=${videoId}&bpctr=9999999999&has_verified=1`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
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

  audio.sort((a, b) => {
    const aAac = (a.mimeType || '').includes('mp4a') ? 1 : 0;
    const bAac = (b.mimeType || '').includes('mp4a') ? 1 : 0;
    if (bAac !== aAac) return bAac - aAac;
    return (b.bitrate || 0) - (a.bitrate || 0);
  });

  const direct = audio.find(f => f.url);
  if (direct) return { directUrl: direct.url };

  const ciphered = audio.find(f => f.signatureCipher || f.cipher);
  if (!ciphered) throw new Error('No streams available');

  const cipherStr = ciphered.signatureCipher || ciphered.cipher;
  const params = {};
  cipherStr.split('&').forEach(p => {
    const [k, ...v] = p.split('=');
    params[k] = decodeURIComponent(v.join('='));
  });

  return { encSig: params.s, sp: params.sp || 'sig', baseUrl: params.url, playerJsUrl };
}

// ═══════════════════════════════════════════
// Step 2: Build decipher from player JS
// ═══════════════════════════════════════════
async function buildDecipher(playerJsUrl) {
  if (cachedDecipher && cachedPlayerUrl === playerJsUrl && Date.now() < cacheExpiry) {
    return cachedDecipher;
  }

  console.log('[YT] Fetching player JS...');
  const res = await fetchT(playerJsUrl, {}, 25000);
  if (!res.ok) throw new Error(`Player JS HTTP ${res.status}`);
  let js = await res.text();
  console.log('[YT] Player JS:', js.length, 'bytes');

  // Find decipher call pattern
  const dp = /(\w+)\((\d+)\s*,\s*(\d+)\s*,\s*(\w+)\((\d+)\s*,\s*(\d+)\s*,\s*\w+\.s\)\)/;
  const dm = js.match(dp);
  if (!dm) throw new Error('Decipher pattern not found');
  const [fullMatch, ktN, ktA1, ktA2, b0N, b0A1, b0A2] = dm;

  // Find Ka wrapper
  const near = js.substring(dm.index, dm.index + 200);
  const km = near.match(/(\w+)\((\d+)\s*,\s*(\d+)\s*,\s*\w+\)\s*\}/);
  let body;
  if (km) {
    body = `return ${km[1]}(${km[2]},${km[3]},${ktN}(${ktA1},${ktA2},${b0N}(${b0A1},${b0A2},sig)));`;
  } else {
    body = `return ${ktN}(${ktA1},${ktA2},${b0N}(${b0A1},${b0A2},sig));`;
  }

  // Inject decipher hook at IIFE end — NOT at call site (it's inside an if block)
  const iifeEnd = js.lastIndexOf('})(_yt_player)');
  if (iifeEnd === -1) throw new Error('IIFE end not found');
  const hook = `\ng.decipher=function(sig){try{${body}}catch(e){return null;}};\n`;
  js = js.substring(0, iifeEnd) + hook + js.substring(iifeEnd);

  // Replace "var window=this;" with our stub window object
  // The IIFE is: (function(g){ var window=this; ...code... })(_yt_player)
  // We replace "var window=this;" so window = our stubs instead of globalThis
  js = js.replace(
    'var window=this;',
    'var window=__stubWindow__;var document=window.document;var navigator=window.navigator;var location=window.location;var screen=window.screen;var history=window.history;var localStorage=window.localStorage;var sessionStorage=window.sessionStorage;var performance=window.performance;var CSS=window.CSS;var matchMedia=window.matchMedia;var getComputedStyle=window.getComputedStyle;var setTimeout=window.setTimeout;var setInterval=window.setInterval;var clearTimeout=window.clearTimeout;var clearInterval=window.clearInterval;var requestAnimationFrame=window.requestAnimationFrame;var cancelAnimationFrame=window.cancelAnimationFrame;var fetch=window.fetch;var XMLHttpRequest=window.XMLHttpRequest;var MutationObserver=window.MutationObserver;var IntersectionObserver=window.IntersectionObserver;var ResizeObserver=window.ResizeObserver;var Event=window.Event;var CustomEvent=window.CustomEvent;var MediaSource=window.MediaSource;var AudioContext=window.AudioContext;var Image=window.Image;var Worker=window.Worker;var WebSocket=window.WebSocket;var BroadcastChannel=window.BroadcastChannel;var atob=window.atob;var btoa=window.btoa;var indexedDB=null;var self=window;var top=window;var parent=window;'
  );

  console.log('[YT] Executing player JS...');
  const t = Date.now();

  try {
    const stubWindow = makeBrowserStubs();
    // Execute: the JS declares var _yt_player={} and runs the IIFE
    // After execution, _yt_player.decipher should be defined
    const fn = new Function('__stubWindow__', `
      try {
        ${js}
      } catch(e) {
        // Ignore DOM-related errors — decipher hook is already defined
      }
      return typeof _yt_player !== 'undefined' ? _yt_player : null;
    `);

    const result = fn(stubWindow);
    console.log('[YT] Executed in', Date.now() - t, 'ms');

    if (!result || typeof result.decipher !== 'function') {
      throw new Error('decipher not defined after execution');
    }

    cachedDecipher = result.decipher;
    cachedPlayerUrl = playerJsUrl;
    cacheExpiry = Date.now() + 2 * 3600 * 1000;
    return result.decipher;
  } catch (e) {
    throw new Error(`JS exec failed: ${e.message}`);
  }
}

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════
export async function getStreamUrl(videoId) {
  if (!videoId) throw new Error('Invalid video ID');

  console.log(`\n[YT] ═══ Stream for: ${videoId} ═══`);
  const t = Date.now();

  const info = await fetchVideoInfo(videoId);
  if (info.directUrl) {
    console.log(`[YT] ═══ OK (direct) ${Date.now() - t}ms ═══\n`);
    return info.directUrl;
  }

  const decipher = await buildDecipher(info.playerJsUrl);
  const decSig = decipher(info.encSig);
  if (!decSig) throw new Error('Decipher returned empty');

  const finalUrl = `${info.baseUrl}&${info.sp}=${encodeURIComponent(decSig)}`;
  console.log(`[YT] ═══ OK in ${Date.now() - t}ms ═══\n`);
  return finalUrl;
}
