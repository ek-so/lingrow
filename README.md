# Lingrow

Flashcard-style vocabulary collections with pronunciation practice.

## Google sync

Sign in with Google to store collections in a **Lingrow Collections** spreadsheet in your Drive (Sheets). Settings are stored per Google user. Without sign-in, data stays in browser local storage.

1. Create an OAuth **Web** client ID in Google Cloud Console.
2. Enable **Google Sheets API** and **Google Drive API**.
3. Add authorized JavaScript origins (e.g. `http://localhost:5173`, `https://ek-so.github.io`).
4. Copy `.env.example` to `.env.local` and set `VITE_GOOGLE_CLIENT_ID`.
5. For GitHub Pages deploy, add the same variable as a repository secret and pass it into the build step.

On first visit, Lingrow suggests signing in so collections can sync to Google; you can continue locally instead.
