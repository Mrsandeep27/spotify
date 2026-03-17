// Client-side YouTube stream URL extraction
// Runs on the user's phone (residential IP) so YouTube doesn't block it

const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

const CLIENTS = [
  // Mobile web — best match for a phone request
  {
    name: 'MWEB',
    headers: { 'X-YouTube-Client-Name': '2', 'X-YouTube-Client-Version': '2.20241209.01.00' },
    context: {
      client: { clientName: 'MWEB', clientVersion: '2.20241209.01.00', hl: 'en', gl: 'US' },
    },
  },
  // TV embedded — often returns direct URLs
  {
    name: 'TV_EMBEDDED',
    headers: { 'X-YouTube-Client-Name': '85', 'X-YouTube-Client-Version': '2.0' },
    context: {
      client: { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.0', hl: 'en', gl: 'US' },
      thirdParty: { embedUrl: 'https://www.youtube.com/' },
    },
  },
  // Standard web
  {
    name: 'WEB',
    headers: { 'X-YouTube-Client-Name': '1', 'X-YouTube-Client-Version': '2.20241209.01.00' },
    context: {
      client: { clientName: 'WEB', clientVersion: '2.20241209.01.00', hl: 'en', gl: 'US' },
    },
  },
];

function extractUrl(format) {
  if (format.url) return format.url;
  // Try parsing signatureCipher — URL without signature may still work for some videos
  const cipher = format.signatureCipher || format.cipher;
  if (cipher) {
    const match = cipher.match(/url=([^&]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

export async function getStreamUrl(videoId) {
  const errors = [];

  for (const client of CLIENTS) {
    try {
      const res = await fetch(
        `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}&prettyPrint=false`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...client.headers,
          },
          body: JSON.stringify({
            videoId,
            context: client.context,
            playbackContext: { contentPlaybackContext: { html5Preference: 'HTML5_PREF_WANTS' } },
          }),
        }
      );

      if (!res.ok) {
        errors.push(`${client.name}: HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();

      if (data?.playabilityStatus?.status !== 'OK') {
        errors.push(`${client.name}: ${data?.playabilityStatus?.status || 'unknown'}`);
        continue;
      }

      const formats = [
        ...(data?.streamingData?.adaptiveFormats || []),
        ...(data?.streamingData?.formats || []),
      ];

      // Find audio formats with usable URLs, sorted by bitrate
      const audioFormats = formats
        .filter((f) => f.mimeType?.includes('audio') && extractUrl(f))
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

      const url = audioFormats.length > 0 ? extractUrl(audioFormats[0]) : null;
      if (url) {
        console.log(`[YT] Stream URL via ${client.name}, bitrate: ${audioFormats[0].bitrate}`);
        return url;
      }

      errors.push(`${client.name}: no audio URL in ${formats.length} formats`);
    } catch (e) {
      errors.push(`${client.name}: ${e.message}`);
    }
  }

  // Fallback: try fetching the mobile YouTube page and parsing ytInitialPlayerResponse
  try {
    const url = await extractFromPage(videoId);
    if (url) return url;
  } catch (e) {
    errors.push(`page-extract: ${e.message}`);
  }

  throw new Error(`No stream URL found: ${errors.join('; ')}`);
}

// Fallback: fetch YouTube mobile page and extract embedded player response
async function extractFromPage(videoId) {
  const res = await fetch(`https://m.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    },
  });

  const html = await res.text();
  const match = html.match(/var\s+ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/);
  if (!match) return null;

  const data = JSON.parse(match[1]);
  const formats = [
    ...(data?.streamingData?.adaptiveFormats || []),
    ...(data?.streamingData?.formats || []),
  ];

  const audioFormats = formats
    .filter((f) => f.mimeType?.includes('audio') && extractUrl(f))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

  const url = audioFormats.length > 0 ? extractUrl(audioFormats[0]) : null;
  if (url) console.log('[YT] Stream URL via page extraction');
  return url;
}
