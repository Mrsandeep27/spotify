import React, { useRef, useEffect, useCallback, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  registerWebView,
  unregisterWebView,
  onWebViewMessage,
} from '../services/webViewBridge';

// Injected BEFORE YouTube's scripts load.
// Intercepts all network requests to capture deciphered audio stream URLs.
const INTERCEPT_JS = `
(function() {
  var found = false;

  function sendUrl(url) {
    if (found) return;
    found = true;
    url = url.replace(/&range=[^&]+/g, '');
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'audioUrl', url:url}));
  }

  function isAudioUrl(url) {
    return url.indexOf('googlevideo.com/videoplayback') !== -1 &&
      (url.indexOf('mime=audio') !== -1 ||
       url.indexOf('mime%3Daudio') !== -1 ||
       url.indexOf('itag/140') !== -1 ||
       url.indexOf('itag/251') !== -1 ||
       url.indexOf('itag/250') !== -1 ||
       url.indexOf('itag/249') !== -1);
  }

  // Intercept XMLHttpRequest
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (!found && typeof url === 'string' && isAudioUrl(url)) {
      sendUrl(url);
    }
    return origOpen.apply(this, arguments);
  };

  // Intercept fetch
  var origFetch = window.fetch;
  window.fetch = function(input) {
    var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    if (!found && isAudioUrl(url)) {
      sendUrl(url);
    }
    return origFetch.apply(this, arguments);
  };

  true;
})();
`;

// Injected AFTER page loads — clicks play button and polls for URLs
const POST_LOAD_JS = `
(function() {
  // Try to click play button
  function clickPlay() {
    var btns = document.querySelectorAll('.ytp-large-play-button, .ytp-play-button, button[aria-label*="Play"]');
    for (var i = 0; i < btns.length; i++) {
      try { btns[i].click(); } catch(e) {}
    }
    // Also try video element
    var video = document.querySelector('video');
    if (video) {
      try { video.play(); } catch(e) {}
    }
  }

  // Click play after short delays
  setTimeout(clickPlay, 1000);
  setTimeout(clickPlay, 2000);
  setTimeout(clickPlay, 4000);

  // Poll performance entries as backup
  var pollCount = 0;
  var interval = setInterval(function() {
    pollCount++;
    try {
      var entries = performance.getEntries();
      for (var i = 0; i < entries.length; i++) {
        var name = entries[i].name || '';
        if (name.indexOf('googlevideo.com/videoplayback') !== -1) {
          if (name.indexOf('mime=audio') !== -1 || name.indexOf('mime%3Daudio') !== -1 ||
              name.indexOf('itag/140') !== -1 || name.indexOf('itag/251') !== -1) {
            clearInterval(interval);
            var cleanUrl = name.replace(/&range=[^&]+/g, '');
            window.ReactNativeWebView.postMessage(JSON.stringify({type:'audioUrl', url:cleanUrl}));
            return;
          }
        }
      }
    } catch(e) {}
    if (pollCount > 40) clearInterval(interval);
  }, 500);

  true;
})();
`;

export default function HiddenWebView() {
  const webViewRef = useRef(null);
  const [source, setSource] = useState({ uri: 'about:blank' });

  useEffect(() => {
    registerWebView({ setSource });
    return () => unregisterWebView();
  }, []);

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[WebView]', data.type, data.type === 'error' ? data.message : '');
      onWebViewMessage(data);
    } catch (e) {
      console.warn('[WebView] Parse error:', e.message);
    }
  }, []);

  return (
    <View style={{ width: 0, height: 0, overflow: 'hidden', position: 'absolute', top: -1000 }}>
      <WebView
        ref={webViewRef}
        source={source}
        injectedJavaScriptBeforeContentLoaded={INTERCEPT_JS}
        injectedJavaScript={POST_LOAD_JS}
        onMessage={handleMessage}
        onError={(e) => {
          console.warn('[WebView] Error:', e.nativeEvent?.description);
          onWebViewMessage({ type: 'error', message: e.nativeEvent?.description || 'Load error' });
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        originWhitelist={['*']}
        mixedContentMode="always"
        userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36"
        style={{ width: 1, height: 1, opacity: 0 }}
      />
    </View>
  );
}
