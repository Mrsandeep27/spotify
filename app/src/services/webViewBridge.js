// Bridge for running YouTube's decipher in a WebView.
//
// The decipher functions (b0, kt, Ka) are LOCAL to the player JS IIFE.
// We modify the player JS to inject a hook INSIDE the closure that
// exposes the decipher function on the global _yt_player object.
// Then we eval the modified JS in the WebView and call it.

let _setSource = null;
let _resolveFunc = null;
let _rejectFunc = null;
let _timeoutId = null;

export function registerWebView(ref) {
  _setSource = ref.setSource;
}

export function unregisterWebView() {
  _setSource = null;
}

export function isWebViewReady() {
  return _setSource !== null;
}

/**
 * Runs the modified player JS in the WebView and calls the decipher function.
 * @param {string} modifiedJs - Player JS with injected decipher hook
 * @param {string} encryptedSig - The encrypted signature to decipher
 * @returns {Promise<string>} - The deciphered signature
 */
export function evalInWebView(modifiedJs, encryptedSig) {
  return new Promise((resolve, reject) => {
    if (!_setSource) {
      reject(new Error('WebView not registered'));
      return;
    }

    cleanup();
    _resolveFunc = resolve;
    _rejectFunc = reject;

    _timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('WebView timeout (30s)'));
    }, 30000);

    // Escape </ to <\/ so it doesn't break HTML script tags
    // In JS, <\/ evaluates to </ so functionality is preserved
    const safeJs = modifiedJs.replace(/<\//g, '<\\/');

    // Escape the signature for safe embedding in JS string
    const safeSig = encryptedSig
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<script>
var _yt_player = {};
try {
  ${safeJs}

  if (typeof _yt_player.decipher === 'function') {
    var sig = '${safeSig}';
    var result = _yt_player.decipher(sig);
    if (result && typeof result === 'string') {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'result', sig:result}));
    } else {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'error', message:'decipher returned: ' + typeof result + ' ' + String(result)}));
    }
  } else {
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'error', message:'_yt_player.decipher not defined. Keys: ' + Object.keys(_yt_player).slice(0,10).join(',')}));
  }
} catch(e) {
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'error', message:'JS error: ' + (e.message || String(e)).substring(0,200)}));
}
<\/script></body></html>`;

    _setSource({ html, baseUrl: 'https://www.youtube.com' });
  });
}

export function onWebViewMessage(data) {
  if (data.type === 'result' && data.sig) {
    const resolve = _resolveFunc;
    cleanup();
    if (resolve) resolve(data.sig);
  } else if (data.type === 'error') {
    const reject = _rejectFunc;
    cleanup();
    if (reject) reject(new Error(data.message || 'WebView error'));
  }
}

function cleanup() {
  if (_timeoutId) clearTimeout(_timeoutId);
  _timeoutId = null;
  _resolveFunc = null;
  _rejectFunc = null;
}
