# Lingrow

Flashcard-style vocabulary collections with pronunciation practice.

## Google sync

Sign in with Google to store collections in a **Lingrow Collections** spreadsheet in your Drive. Settings are stored per Google user. Without sign-in, data stays in browser local storage.

For sign-in to work, the site build needs a Google OAuth **Web** client ID (`VITE_GOOGLE_CLIENT_ID`). Create one in Google Cloud Console, enable Sheets + Drive APIs, and add authorized JavaScript origins (`http://localhost:5173`, `https://ek-so.github.io`). Set the value in `.env.local` locally and as the GitHub Actions secret `VITE_GOOGLE_CLIENT_ID` for Pages deploys.
