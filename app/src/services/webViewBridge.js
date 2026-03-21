// Bridge for extracting deciphered YouTube audio URLs via WebView.
//
// The WebView navigates directly to YouTube's embed page.
// injectedJavaScriptBeforeContentLoaded intercepts XHR/fetch BEFORE
// YouTube's player scripts run, capturing deciphered audio URLs.

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

export function extractViaWebView(videoId) {
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
      reject(new Error('WebView extraction timeout'));
    }, 25000);

    // Navigate WebView directly to YouTube embed page
    // mute=1 prevents audio from WebView, but player still deciphers URLs
    _setSource({
      uri: `https://www.youtube.com/embed/${videoId}?autoplay=1&html5=1&mute=1`,
    });
  });
}

export function onWebViewMessage(data) {
  if (data.type === 'audioUrl' && data.url) {
    const resolve = _resolveFunc;
    cleanup();
    if (resolve) resolve(data.url);
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
