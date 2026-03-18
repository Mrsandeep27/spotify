import React, { useRef, useEffect, useCallback } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  registerWebView,
  unregisterWebView,
  onStreamUrlCaptured,
  onWebViewError,
} from '../services/webViewBridge';

// JavaScript injected BEFORE YouTube page loads.
// Intercepts all network requests to capture deciphered audio stream URLs.
const INJECTED_JS_BEFORE = `
(function() {
  var captured = false;

  // Intercept XMLHttpRequest
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (!captured && typeof url === 'string' &&
        url.indexOf('googlevideo.com/videoplayback') !== -1) {
      // Check if it's an audio URL
      var isAudio = url.indexOf('mime=audio') !== -1 ||
                    url.indexOf('mime%3Daudio') !== -1 ||
                    url.indexOf('itag/140') !== -1 ||
                    url.indexOf('itag/251') !== -1 ||
                    url.indexOf('itag/250') !== -1 ||
                    url.indexOf('itag/249') !== -1;
      if (isAudio) {
        captured = true;
        // Strip range parameter to get full stream URL
        var cleanUrl = url.replace(/&range=[^&]+/, '').replace(/\\?range=[^&]+&?/, '?');
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'audioUrl',
          url: cleanUrl
        }));
      }
    }
    return origOpen.apply(this, arguments);
  };

  // Intercept fetch
  var origFetch = window.fetch;
  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    if (!captured && url.indexOf('googlevideo.com/videoplayback') !== -1) {
      var isAudio = url.indexOf('mime=audio') !== -1 ||
                    url.indexOf('mime%3Daudio') !== -1 ||
                    url.indexOf('itag/140') !== -1 ||
                    url.indexOf('itag/251') !== -1;
      if (isAudio) {
        captured = true;
        var cleanUrl = url.replace(/&range=[^&]+/, '').replace(/\\?range=[^&]+&?/, '?');
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'audioUrl',
          url: cleanUrl
        }));
      }
    }
    return origFetch.apply(this, arguments);
  };

  // Fallback: also intercept video element src changes
  var origCreateElement = document.createElement.bind(document);
  document.createElement = function(tag) {
    var el = origCreateElement(tag);
    if (tag === 'video' || tag === 'audio') {
      var origSetSrc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
      if (origSetSrc && origSetSrc.set) {
        Object.defineProperty(el, 'src', {
          set: function(val) {
            if (!captured && val && val.indexOf('googlevideo.com') !== -1) {
              captured = true;
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'audioUrl',
                url: val
              }));
            }
            origSetSrc.set.call(this, val);
          },
          get: function() { return origSetSrc.get.call(this); }
        });
      }
    }
    return el;
  };

  // Safety timeout: if nothing captured in 15s, report error
  setTimeout(function() {
    if (!captured) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error',
        message: 'No audio URL captured in 15s'
      }));
    }
  }, 15000);

  true;
})();
`;

export default function HiddenWebView() {
  const webViewRef = useRef(null);

  useEffect(() => {
    if (webViewRef.current) {
      registerWebView(webViewRef.current);
    }
    return () => unregisterWebView();
  }, []);

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'audioUrl' && data.url) {
        console.log('[WebView] Captured audio URL:', data.url.substring(0, 100));
        onStreamUrlCaptured(data.url);
      } else if (data.type === 'error') {
        console.warn('[WebView] Error:', data.message);
        onWebViewError(data.message);
      }
    } catch (e) {
      console.warn('[WebView] Message parse error:', e.message);
    }
  }, []);

  const handleError = useCallback((syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.warn('[WebView] Load error:', nativeEvent.description);
    onWebViewError(nativeEvent.description || 'WebView load error');
  }, []);

  return (
    <View style={{ width: 0, height: 0, overflow: 'hidden', position: 'absolute' }}>
      <WebView
        ref={webViewRef}
        source={{ uri: 'about:blank' }}
        injectedJavaScriptBeforeContentLoaded={INJECTED_JS_BEFORE}
        onMessage={handleMessage}
        onError={handleError}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36"
        style={{ width: 1, height: 1 }}
      />
    </View>
  );
}
