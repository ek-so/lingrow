# Lingrow

Flashcard-style vocabulary collections with pronunciation practice.

## Google sync

Sign in with Google to store collections in a **Lingrow Collections** spreadsheet in your Drive. Settings are stored per Google user. Without sign-in, data stays in browser local storage.

The app ships with a Google OAuth Web client ID. In Google Cloud Console for that client, keep Authorized JavaScript origins updated (`https://ek-so.github.io`, `http://localhost:5173`) and leave **Google Sheets API** + **Google Drive API** enabled. Optional override: `VITE_GOOGLE_CLIENT_ID`.
