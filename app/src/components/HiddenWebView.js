import React, { useRef, useEffect, useCallback, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  registerWebView,
  unregisterWebView,
  onWebViewMessage,
} from '../services/webViewBridge';

export default function HiddenWebView() {
  const webViewRef = useRef(null);
  const [source, setSource] = useState({ html: '<html><body></body></html>', baseUrl: 'https://www.youtube.com' });

  useEffect(() => {
    registerWebView({
      setSource: (newSource) => setSource(newSource),
      injectJS: (js) => webViewRef.current?.injectJavaScript(js),
    });
    return () => unregisterWebView();
  }, []);

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[WebView]', data.type, data.type === 'error' ? data.message : '(sig received)');
      onWebViewMessage(data);
    } catch (e) {
      console.warn('[WebView] Parse error:', e.message);
    }
  }, []);

  return (
    <View style={{ width: 0, height: 0, overflow: 'hidden', position: 'absolute', top: -100 }}>
      <WebView
        ref={webViewRef}
        source={source}
        onMessage={handleMessage}
        onError={(e) => {
          console.warn('[WebView] Load error:', e.nativeEvent?.description);
          onWebViewMessage({ type: 'error', message: e.nativeEvent?.description || 'Load error' });
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36"
        style={{ width: 1, height: 1, opacity: 0 }}
      />
    </View>
  );
}
