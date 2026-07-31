# Lingrow

Flashcard-style vocabulary collections with pronunciation practice.

## Cloud sync (Supabase + email magic link)

Sign in with an **email magic link** to store collections in Supabase. Settings are stored per user. Without sign-in, data stays in browser local storage.

### One-time setup

1. Create a free [Supabase](https://supabase.com) project.
2. In **SQL Editor**, run [`supabase/schema.sql`](./supabase/schema.sql).
3. Under **Authentication → Providers**, enable **Email** (magic link / OTP). Disable **GitHub** if it was turned on earlier.
4. In Supabase **Authentication → URL Configuration**, add redirect URLs:
   - `https://ek-so.github.io/lingrow/app.html`
   - `http://localhost:5173/lingrow/app.html` (local)
5. Set **Site URL** to `https://ek-so.github.io/lingrow/app.html` (or your local app URL while developing).
6. Copy project URL + anon key into `.env.local`:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

7. For GitHub Pages deploy, add the same values as repository secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### Site URLs

- Homepage: https://ek-so.github.io/lingrow/
- App: https://ek-so.github.io/lingrow/app.html
- Privacy: https://ek-so.github.io/lingrow/privacy.html
- Terms: https://ek-so.github.io/lingrow/terms.html
