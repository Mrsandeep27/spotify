// Bridge between youtubeExtractor and the HiddenWebView component.
// Uses a global event system so the service layer can talk to the React component.

let _resolveStream = null;
let _rejectStream = null;
let _webViewRef = null;
let _timeoutId = null;

// Called by HiddenWebView component on mount
export function registerWebView(ref) {
  _webViewRef = ref;
}

export function unregisterWebView() {
  _webViewRef = null;
}

// Called by youtubeExtractor to request a stream URL
export function extractViaWebView(videoId) {
  return new Promise((resolve, reject) => {
    if (!_webViewRef) {
      reject(new Error('WebView not ready'));
      return;
    }

    // Clean up any previous request
    if (_timeoutId) clearTimeout(_timeoutId);
    if (_rejectStream) _rejectStream(new Error('Cancelled'));

    _resolveStream = resolve;
    _rejectStream = reject;

    // Timeout after 20 seconds
    _timeoutId = setTimeout(() => {
      _rejectStream = null;
      _resolveStream = null;
      reject(new Error('WebView extraction timeout'));
    }, 20000);

    // Tell WebView to load the embed page
    if (_webViewRef.injectJavaScript) {
      _webViewRef.injectJavaScript(`
        window.location.href = 'https://www.youtube.com/embed/${videoId}?autoplay=1&html5=1';
        true;
      `);
    }
  });
}

// Called by HiddenWebView when it captures an audio URL
export function onStreamUrlCaptured(url) {
  if (_timeoutId) clearTimeout(_timeoutId);
  _timeoutId = null;

  if (_resolveStream) {
    const resolve = _resolveStream;
    _resolveStream = null;
    _rejectStream = null;
    resolve(url);
  }
}

// Called by HiddenWebView on error
export function onWebViewError(error) {
  if (_timeoutId) clearTimeout(_timeoutId);
  _timeoutId = null;

  if (_rejectStream) {
    const reject = _rejectStream;
    _resolveStream = null;
    _rejectStream = null;
    reject(new Error(error));
  }
}

export function isWebViewReady() {
  return _webViewRef !== null;
}
