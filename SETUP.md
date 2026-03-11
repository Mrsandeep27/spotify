# Spofity — Setup Guide

## What's built
- React Native (Expo) Android APK
- Node.js backend on Railway (free tier)
- YouTube audio (no ads)
- Google + Email login (Railway — fully self-hosted, no third-party auth)
- Group Jam sessions (like Spotify Jam)
- Save + Like songs
- Volume Booster + EQ
- Spotify-identical dark UI

---

## Step 1 — Deploy to Railway (auth + backend, everything in one)

### 1a. Create Railway project
1. Go to [railway.app](https://railway.app) → sign up
2. New Project → Deploy from GitHub repo → select your repo
3. Set the **Root Directory** to `backend`
4. Railway auto-detects Node.js and deploys automatically

### 1b. Add a PostgreSQL database
1. In your Railway project → **+ New** → **Database** → **PostgreSQL**
2. Railway auto-sets `DATABASE_URL` as an environment variable — nothing to copy manually

### 1c. Set environment variables in Railway
Go to your backend service → **Variables** tab → add these two:
```
JWT_SECRET        = (run this to generate one: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
GOOGLE_CLIENT_ID  = YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
```

### 1d. Get Google Client ID (for Google Sign-In)
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. APIs & Services → Credentials → Create **OAuth 2.0 Client ID** → Web application
3. Copy the Client ID → paste as `GOOGLE_CLIENT_ID` in Railway variables
4. Also paste it in `app/src/screens/auth/LoginScreen.js` → replace `YOUR_GOOGLE_WEB_CLIENT_ID`

### 1e. Run the DB migration (one time only)
After first deploy, open Railway shell for your backend service and run:
```bash
node db/migrate.js
```

### 1f. Copy Railway URL into the app
1. Railway → your backend service → **Settings** → copy the domain URL
2. Paste it into `app/src/config/api.js` as `API_BASE_URL`

---

## Step 2 — Install & Run the App

```bash
cd app
npm install
npx expo start
```

Scan the QR code with **Expo Go** app on your phone to test.

---

## Step 3 — Build APK

### First time setup:
```bash
npm install -g eas-cli
eas login
eas build:configure
```

### Build APK:
```bash
cd app
eas build --platform android --profile preview
```

EAS builds the APK in the cloud (free for personal use).
Download the `.apk` from the EAS dashboard and install on your phone.

---

## Step 4 — Install on Friends' Phones

1. Download the `.apk` file
2. Send via WhatsApp / Google Drive
3. On Android: Settings → Install unknown apps → Allow → Install APK

---

## Features Guide

### Playing Music
- Search any song → tap to play
- Streams from YouTube (no ads in the app)

### Liking Songs
- Tap the heart button in the Player
- View liked songs in Library tab

### Downloading (offline)
- In Library → tap the download icon on any song
- Downloaded songs play without internet

### Group Jam Session
- Open Player → tap "Start Jam"
- Share the 6-character code with friends
- Friends: tap "Join with Code" → enter code
- Host controls playback for everyone

### Volume Booster
- Player → tap "Volume" button
- Slide to boost up to 150%
- Use EQ presets (Bass Boost, Rock, Pop, etc.)
- Fine-tune each frequency band

---

## Folder Structure

```
Spofity/
├── backend/              # Node.js server → deploy to Railway
│   ├── server.js
│   ├── db/
│   │   ├── index.js      # PostgreSQL pool
│   │   └── migrate.js    # Create tables (run once)
│   ├── middleware/
│   │   └── auth.js       # JWT verification
│   ├── routes/
│   │   ├── auth.js       # Register / Login / Google OAuth
│   │   ├── songs.js      # YouTube search + stream
│   │   └── session.js    # Group session management
│   └── services/
│       └── socket.js     # Real-time sync
└── app/                  # React Native (Expo) → build APK
    ├── App.js
    └── src/
        ├── screens/      # All screens
        ├── components/
        ├── navigation/
        ├── services/
        │   └── authService.js  # JWT auth against Railway backend
        ├── store/        # Zustand global state
        ├── theme/        # Colors
        └── config/
            └── api.js    # Railway URL + all endpoints
```
