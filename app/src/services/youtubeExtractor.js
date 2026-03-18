// Client-side YouTube stream URL extraction
// Tries multiple Innertube clients — some return direct URLs (no cipher needed)
// Runs on the user's phone (residential IP) so YouTube won't block it

const INNERTUBE_BASE = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';

// Clients ordered by reliability for getting direct audio URLs
const CLIENTS = [
  {
    name: 'ANDROID',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
      'X-YouTube-Client-Name': '3',
      'X-YouTube-Client-Version': '19.09.37',
    },
    context: {
      client: {
        clientName: 'ANDROID',
        clientVersion: '19.09.37',
        androidSdkVersion: 30,
        hl: 'en',
        gl: 'US',
      },
    },
  },
  {
    name: 'IOS',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)',
      'X-YouTube-Client-Name': '5',
      'X-YouTube-Client-Version': '19.09.3',
    },
    context: {
      client: {
        clientName: 'IOS',
        clientVersion: '19.09.3',
        deviceMake: 'Apple',
        deviceModel: 'iPhone14,3',
        hl: 'en',
        gl: 'US',
      },
    },
  },
  {
    name: 'TVHTML5_EMBEDDED',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0)',
      'X-YouTube-Client-Name': '85',
      'X-YouTube-Client-Version': '2.0',
    },
    context: {
      client: {
        clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
        clientVersion: '2.0',
        hl: 'en',
        gl: 'US',
      },
      thirdParty: {
        embedUrl: 'https://www.youtube.com',
      },
    },
  },
  {
    name: 'MWEB',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
      'X-YouTube-Client-Name': '2',
      'X-YouTube-Client-Version': '2.20241209.01.00',
    },
    context: {
      client: {
        clientName: 'MWEB',
        clientVersion: '2.20241209.01.00',
        hl: 'en',
        gl: 'US',
      },
    },
  },
];

// Pick best audio URL — prefer MP4/AAC (works on all Android devices)
function pickBestAudio(formats) {
  if (!formats || !formats.length) return null;

  const audioFormats = formats
    .filter((f) => f.mimeType?.startsWith('audio/') && f.url)
    .sort((a, b) => {
      // Prefer mp4a (AAC) over opus/webm — better Android compatibility
      const aIsMp4 = a.mimeType?.includes('mp4a') ? 1 : 0;
      const bIsMp4 = b.mimeType?.includes('mp4a') ? 1 : 0;
      if (bIsMp4 !== aIsMp4) return bIsMp4 - aIsMp4;
      // Then prefer higher bitrate
      return (b.bitrate || 0) - (a.bitrate || 0);
    });

  if (audioFormats.length > 0) {
    console.log('[YT] Found', audioFormats.length, 'audio formats with direct URLs');
    return audioFormats[0].url;
  }

  // If no audio-only, try combined formats (video+audio) as fallback
  const combined = formats
    .filter((f) => f.mimeType?.includes('audio') && f.url)
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

  return combined.length > 0 ? combined[0].url : null;
}

// Try a single Innertube client
async function tryClient(client, videoId) {
  const body = {
    videoId,
    context: client.context,
    contentCheckOk: true,
    racyCheckOk: true,
  };

  const res = await fetch(INNERTUBE_BASE, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.warn(`[YT] ${client.name} HTTP ${res.status}`);
    return null;
  }

  const data = await res.json();
  const status = data?.playabilityStatus?.status;

  if (status !== 'OK') {
    console.warn(`[YT] ${client.name} status: ${status} — ${data?.playabilityStatus?.reason || ''}`);
    return null;
  }

  const formats = [
    ...(data?.streamingData?.adaptiveFormats || []),
    ...(data?.streamingData?.formats || []),
  ];

  console.log(`[YT] ${client.name} returned ${formats.length} formats`);

  // Count how many have direct URLs vs cipher
  const directCount = formats.filter((f) => f.url).length;
  const cipherCount = formats.filter((f) => f.signatureCipher || f.cipher).length;
  console.log(`[YT] ${client.name}: ${directCount} direct, ${cipherCount} ciphered`);

  const url = pickBestAudio(formats);
  if (url) {
    console.log(`[YT] Got stream URL via ${client.name}`);
    return url;
  }

  return null;
}

// Main export: get a playable audio stream URL
export async function getStreamUrl(videoId) {
  console.log('[YT] Getting stream URL for:', videoId);

  const errors = [];

  // Try each client in order
  for (const client of CLIENTS) {
    try {
      const url = await tryClient(client, videoId);
      if (url) return url;
    } catch (err) {
      console.warn(`[YT] ${client.name} error:`, err.message);
      errors.push(`${client.name}: ${err.message}`);
    }
  }

  // All clients failed — try page scrape as last resort
  try {
    console.log('[YT] All clients failed, trying page scrape...');
    return await extractFromPage(videoId);
  } catch (err) {
    errors.push(`PageScrape: ${err.message}`);
  }

  throw new Error(`All extraction methods failed: ${errors.join('; ')}`);
}

// Last resort: scrape the mobile YouTube page
async function extractFromPage(videoId) {
  const res = await fetch(`https://m.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  const html = await res.text();

  // Try multiple patterns for the player response
  const patterns = [
    /var\s+ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var|<\/script)/s,
    /ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s,
  ];

  let data = null;
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        data = JSON.parse(match[1]);
        break;
      } catch (_) {
        continue;
      }
    }
  }

  if (!data) {
    // Check if consent page
    if (html.includes('consent.youtube.com') || html.includes('CONSENT')) {
      throw new Error('YouTube returned consent page');
    }
    throw new Error('No player response in page');
  }

  if (data?.playabilityStatus?.status !== 'OK') {
    throw new Error(`Page status: ${data?.playabilityStatus?.status}`);
  }

  const formats = [
    ...(data?.streamingData?.adaptiveFormats || []),
    ...(data?.streamingData?.formats || []),
  ];

  const directFormats = formats.filter((f) => f.url && f.mimeType?.includes('audio'));
  if (directFormats.length > 0) {
    console.log('[YT] Got stream URL via page scrape');
    return directFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0].url;
  }

  throw new Error(`No direct audio URLs in page (${formats.length} total formats, all ciphered)`);
}
