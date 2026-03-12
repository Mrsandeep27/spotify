# Sandy5

A Spotify-inspired music streaming app for Android. Streams audio from YouTube with no ads, fully self-hosted authentication, group listening sessions, offline downloads, and a volume booster with EQ.

## Features

- **YouTube Audio Streaming** - Search and play any song, powered by YouTube (ad-free)
- **Self-Hosted Auth** - Email + Google Sign-In via custom JWT backend (no Firebase/Supabase dependency)
- **Admin Approval System** - New users require admin approval before accessing the app
- **Device Tracking** - Logs devices and login history for admin monitoring
- **Group Jam Sessions** - Listen together in real-time with friends using a 6-character room code
- **Save & Like Songs** - Build your personal library
- **Offline Downloads** - Download songs for offline playback
- **Volume Booster + EQ** - Boost volume up to 150% with equalizer presets (Bass Boost, Rock, Pop, Vocal, etc.)
- **Spotify-Like Dark UI** - Clean, familiar dark theme interface

## Tech Stack

| Layer | Tech |
|-------|------|
| Mobile App | React Native (Expo SDK 51) |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Auth | Custom JWT (30-day tokens) |
| Real-time | Socket.io |
| Audio | YouTube via play-dl + expo-av |
| State | Zustand |
| Hosting | Railway (free tier) |
| Build | EAS Build (Expo) |

## Project Structure

```
Sandy5/
├── backend/                  # Node.js server (deploy to Railway)
│   ├── server.js             # Express + Socket.io entry point
│   ├── db/
│   │   ├── index.js          # PostgreSQL connection pool
│   │   └── migrate.js        # Table creation (run once)
│   ├── middleware/
│   │   └── auth.js           # JWT verification middleware
│   ├── routes/
│   │   ├── auth.js           # Register / Login / Google OAuth
│   │   ├── songs.js          # YouTube search + audio streaming
│   │   ├── session.js        # Group Jam session management
│   │   └── admin.js          # Admin user approval + device logs
│   └── services/
│       └── socket.js         # Real-time playback sync
│
├── app/                      # React Native (Expo) Android app
│   ├── App.js
│   ├── app.json              # Expo config + EAS project ID
│   ├── assets/               # App icon, splash screen
│   └── src/
│       ├── config/
│       │   └── api.js        # Backend URL + API endpoints
│       ├── navigation/
│       │   ├── AppNavigator.js    # Auth flow + root navigator
│       │   └── MainNavigator.js   # Bottom tabs (Home/Search/Library)
│       ├── screens/
│       │   ├── auth/
│       │   │   ├── LoginScreen.js          # Email + Google login
│       │   │   └── PendingApprovalScreen.js # Waiting for admin approval
│       │   ├── HomeScreen.js          # Featured songs + genres
│       │   ├── SearchScreen.js        # Search with auto-suggest
│       │   ├── LibraryScreen.js       # Liked songs + downloads
│       │   ├── PlayerScreen.js        # Full player with controls
│       │   ├── GroupSessionScreen.js  # Jam session create/join
│       │   └── VolumeBoosterScreen.js # Volume + EQ controls
│       ├── components/
│       │   ├── MiniPlayer.js   # Floating mini player
│       │   └── SongCard.js     # Reusable song list item
│       ├── services/
│       │   ├── authService.js     # JWT auth + device tracking
│       │   ├── audioPlayer.js     # expo-av audio playback
│       │   └── socketService.js   # Socket.io client
│       ├── store/
│       │   └── useStore.js        # Zustand global state
│       └── theme/
│           └── colors.js          # App color palette
```

## Quick Start

### 1. Deploy Backend to Railway

```bash
# Railway auto-deploys from GitHub
# Set root directory to: backend
# Add PostgreSQL database service
```

Set these environment variables in Railway:

| Variable | Value |
|----------|-------|
| `JWT_SECRET` | Random 64-byte hex string |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `ADMIN_SECRET` | Strong random string for admin API |
| `ADMIN_EMAILS` | Comma-separated auto-approved emails |

### 2. Configure the App

Update `app/src/config/api.js` with your Railway backend URL.

### 3. Run Locally

```bash
cd app
npm install
npx expo start
```

### 4. Build APK

```bash
npm install -g eas-cli
cd app
eas build --platform android --profile preview
```

Download the `.apk` from the [EAS dashboard](https://expo.dev) and share with friends.

## Admin API

All admin endpoints require the `x-admin-secret` header.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/users` | GET | List all users |
| `/api/admin/pending` | GET | List users pending approval |
| `/api/admin/users/:id/approve` | POST | Approve a user |
| `/api/admin/users/:id/reject` | POST | Reject a user |
| `/api/admin/users/:id` | GET | Get user details + devices |
| `/api/admin/logins` | GET | View login logs |

Example:
```bash
curl -H "x-admin-secret: YOUR_SECRET" https://your-backend.railway.app/api/admin/pending
```

## License

Private - Personal use only.
