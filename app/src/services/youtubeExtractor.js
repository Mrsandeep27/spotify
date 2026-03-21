// YouTube audio stream extraction with in-process signature decryption.
//
// No WebView needed. Runs YouTube's player JS directly in React Native's
// JavaScript engine with browser API stubs. This is the same approach
// used by yt-dlp (runs cipher JS in a JS interpreter).
//
// Flow:
// 1. Fetch YouTube watch page → get cipher data + player JS URL
// 2. Fetch player JS → find decipher function names
// 3. Modify player JS: replace window=this with stubs, inject decipher hook
// 4. Execute modified JS with new Function() — decipher runs natively
// 5. Build final URL with deciphered signature

function fetchT(url, opts = {}, ms = 15000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
}

// Cache
let cachedDecipher = null;
let cachedPlayerUrl = null;
let cacheExpiry = 0;

// ═══════════════════════════════════════════
// Browser stubs so YouTube's JS doesn't crash
// ═══════════════════════════════════════════
const BROWSER_STUBS = `
var document={
  createElement:function(){return{style:{},setAttribute:function(){},appendChild:function(){},addEventListener:function(){},removeEventListener:function(){},getElementsByTagName:function(){return[]},querySelector:function(){return null},classList:{add:function(){},remove:function(){},contains:function(){return false}}}},
  getElementById:function(){return null},
  querySelector:function(){return null},
  querySelectorAll:function(){return[]},
  addEventListener:function(){},
  removeEventListener:function(){},
  createEvent:function(){return{initEvent:function(){}}},
  createTextNode:function(){return{}},
  createDocumentFragment:function(){return{appendChild:function(){},querySelector:function(){return null},querySelectorAll:function(){return[]}}},
  head:{appendChild:function(){},removeChild:function(){},querySelector:function(){return null}},
  body:{appendChild:function(){},removeChild:function(){},querySelector:function(){return null},classList:{add:function(){},remove:function(){}}},
  documentElement:{style:{},getAttribute:function(){return null},classList:{add:function(){},remove:function(){}}},
  cookie:'',
  domain:'youtube.com',
  readyState:'complete',
  hidden:false,
  visibilityState:'visible',
  hasFocus:function(){return true},
  title:''
};
var navigator={userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7)',platform:'Linux armv8l',language:'en-US',languages:['en-US','en'],onLine:true,cookieEnabled:true,hardwareConcurrency:8,maxTouchPoints:5,mediaDevices:{enumerateDevices:function(){return Promise.resolve([])}}};
var location={href:'https://www.youtube.com/',hostname:'www.youtube.com',protocol:'https:',search:'',pathname:'/',origin:'https://www.youtube.com',hash:''};
var screen={width:1080,height:2400,availWidth:1080,availHeight:2400,colorDepth:24};
var XMLHttpRequest=function(){this.open=function(){};this.send=function(){};this.setRequestHeader=function(){};this.addEventListener=function(){};this.readyState=0;this.status=0;this.response=null;};
var fetch=function(){return Promise.resolve({ok:false,status:0,json:function(){return Promise.resolve({})},text:function(){return Promise.resolve('')}})};
var setTimeout=function(f,t){try{if(t===0||t===undefined)f();}catch(e){}return 0;};
var setInterval=function(){return 0};
var clearTimeout=function(){};
var clearInterval=function(){};
var requestAnimationFrame=function(){return 0};
var cancelAnimationFrame=function(){};
var performance={now:function(){return Date.now()},mark:function(){},measure:function(){},getEntries:function(){return[]},getEntriesByName:function(){return[]},getEntriesByType:function(){return[]}};
var CSS={supports:function(){return false}};
var matchMedia=function(){return{matches:false,addListener:function(){},removeListener:function(){},addEventListener:function(){},removeEventListener:function(){}}};
var MutationObserver=function(){this.observe=function(){};this.disconnect=function(){};this.takeRecords=function(){return[]}};
var IntersectionObserver=function(){this.observe=function(){};this.disconnect=function(){};this.unobserve=function(){}};
var ResizeObserver=function(){this.observe=function(){};this.disconnect=function(){};this.unobserve=function(){}};
var Event=function(){};
var CustomEvent=function(){};
var MediaSource=function(){};MediaSource.isTypeSupported=function(){return false};
var AudioContext=function(){this.createGain=function(){return{gain:{value:1},connect:function(){}}};this.createAnalyser=function(){return{connect:function(){}}};this.destination={}};
var Image=function(){};
var Worker=function(){this.postMessage=function(){};this.terminate=function(){}};
var WebSocket=function(){this.send=function(){};this.close=function(){}};
var BroadcastChannel=function(){this.postMessage=function(){};this.close=function(){}};
var localStorage={getItem:function(){return null},setItem:function(){},removeItem:function(){}};
var sessionStorage={getItem:function(){return null},setItem:function(){},removeItem:function(){}};
var indexedDB=null;
var self=window;
var top=window;
var parent=window;
var frames=window;
`;

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

  return {
    encSig: params.s,
    sp: params.sp || 'sig',
    baseUrl: params.url,
    playerJsUrl,
  };
}

// ═══════════════════════════════════════════
// Step 2: Build decipher function from player JS
// ═══════════════════════════════════════════
async function buildDecipher(playerJsUrl) {
  if (cachedDecipher && cachedPlayerUrl === playerJsUrl && Date.now() < cacheExpiry) {
    console.log('[YT] Using cached decipher');
    return cachedDecipher;
  }

  console.log('[YT] Fetching player JS...');
  const res = await fetchT(playerJsUrl, {}, 25000);
  if (!res.ok) throw new Error(`Player JS HTTP ${res.status}`);
  let js = await res.text();
  console.log('[YT] Player JS:', js.length, 'bytes');

  // Find decipher pattern
  const dp = /(\w+)\((\d+)\s*,\s*(\d+)\s*,\s*(\w+)\((\d+)\s*,\s*(\d+)\s*,\s*\w+\.s\)\)/;
  const dm = js.match(dp);
  if (!dm) throw new Error('Decipher pattern not found');
  const [fullMatch, ktN, ktA1, ktA2, b0N, b0A1, b0A2] = dm;
  console.log(`[YT] Found: ${ktN}(${ktA1},${ktA2},${b0N}(${b0A1},${b0A2},s))`);

  // Find Ka wrapper
  const near = js.substring(dm.index, dm.index + 200);
  const km = near.match(/(\w+)\((\d+)\s*,\s*(\d+)\s*,\s*\w+\)\s*\}/);
  let decipherBody;
  if (km) {
    decipherBody = `return ${km[1]}(${km[2]},${km[3]},${ktN}(${ktA1},${ktA2},${b0N}(${b0A1},${b0A2},sig)));`;
  } else {
    decipherBody = `return ${ktN}(${ktA1},${ktA2},${b0N}(${b0A1},${b0A2},sig));`;
  }

  // Find IIFE end
  const iifeEnd = js.lastIndexOf('})(_yt_player)');
  if (iifeEnd === -1) throw new Error('IIFE end not found');

  // Replace var window=this; with our stubs
  js = js.replace('var window=this;', 'var window=typeof globalThis!=="undefined"?globalThis:this;\n' + BROWSER_STUBS);

  // Inject decipher hook right AFTER the decipher call pattern
  // (early enough that DOM errors later won't prevent it from being defined)
  const hookPoint = dm.index + fullMatch.length;
  // Find next statement end (;) after the hook point
  let insertAt = js.indexOf(';', hookPoint);
  if (insertAt === -1) insertAt = iifeEnd;
  else insertAt += 1;

  const hook = `\ng.decipher=function(sig){try{${decipherBody}}catch(e){return null;}};\n`;
  js = js.substring(0, insertAt) + hook + js.substring(insertAt);

  console.log('[YT] Modified JS, injected decipher hook at', insertAt);

  // Execute the modified JS
  console.log('[YT] Executing player JS...');
  const startExec = Date.now();

  try {
    const _yt_player = {};
    // Wrap in try/catch so DOM-related errors don't crash
    const wrappedJs = `var _yt_player=arguments[0];try{${js}}catch(e){}`;
    const fn = new Function(wrappedJs);
    fn(_yt_player);

    if (typeof _yt_player.decipher !== 'function') {
      throw new Error('decipher function not defined after execution');
    }

    console.log(`[YT] Player JS executed in ${Date.now() - startExec}ms`);

    cachedDecipher = _yt_player.decipher;
    cachedPlayerUrl = playerJsUrl;
    cacheExpiry = Date.now() + 2 * 3600 * 1000;

    return _yt_player.decipher;
  } catch (e) {
    throw new Error(`JS execution failed: ${e.message}`);
  }
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

  // Step 2: Build & run decipher
  const decipher = await buildDecipher(info.playerJsUrl);

  // Step 3: Decipher signature
  const decSig = decipher(info.encSig);
  if (!decSig) throw new Error('Decipher returned empty');
  console.log('[YT] Signature deciphered, length:', decSig.length);

  // Step 4: Build URL
  const finalUrl = `${info.baseUrl}&${info.sp}=${encodeURIComponent(decSig)}`;
  console.log(`[YT] ═══ OK in ${Date.now() - t}ms ═══\n`);
  return finalUrl;
}
