// Bridge for running YouTube's decipher in a WebView.
// Two approaches:
// 1. Load player JS from CDN, call decipher if functions are global
// 2. Fallback: load modified JS with injected decipher hook

let _setSource = null;
let _injectJS = null;
let _resolveFunc = null;
let _rejectFunc = null;
let _timeoutId = null;

export function registerWebView(ref) {
  _setSource = ref.setSource;
  _injectJS = ref.injectJS;
}

export function unregisterWebView() {
  _setSource = null;
  _injectJS = null;
}

export function isWebViewReady() {
  return _setSource !== null;
}

// Approach 1: Load player JS from CDN, try calling decipher globally
export function evalInWebView(modifiedJs, encryptedSig, playerJsUrl, decipherExpr) {
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

    // Escape sig for safe embedding
    const safeSig = encryptedSig.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');

    // Try loading player JS from CDN and calling decipher directly
    const html = `<!DOCTYPE html>
<html><head></head><body>
<script src="${playerJsUrl}" onload="tryDecipher()" onerror="onLoadError()"><\/script>
<script>
var sig = '${safeSig}';

function tryDecipher() {
  try {
    // The decipher expression uses function names extracted from the player JS
    var result = (function() { return ${decipherExpr}; })();
    if (result && typeof result === 'string') {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'result',sig:result}));
      return;
    }
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:'decipher returned: ' + typeof result}));
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:'decipher error: ' + e.message}));
  }
}

function onLoadError() {
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:'Failed to load player JS'}));
}

// Safety timeout
setTimeout(function() {
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:'Page timeout'}));
}, 20000);
<\/script>
</body></html>`;

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
