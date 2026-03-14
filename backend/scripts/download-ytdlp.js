#!/usr/bin/env node
// Downloads yt-dlp binary on Linux (Render) — skips on other platforms
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

if (process.platform !== 'linux') {
  console.log('Skipping yt-dlp download (not Linux)');
  process.exit(0);
}

const dest = path.join(__dirname, '..', 'yt-dlp');
if (fs.existsSync(dest)) {
  console.log('yt-dlp already exists, skipping download');
  process.exit(0);
}

try {
  console.log('Downloading yt-dlp...');
  execSync(
    `curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "${dest}" && chmod +x "${dest}"`,
    { stdio: 'inherit' }
  );
  console.log('yt-dlp downloaded successfully');
} catch (e) {
  console.warn('yt-dlp download failed:', e.message);
}
