# Lingrow

Flashcard-style vocabulary collections with pronunciation practice.

## Cloud sync (Supabase + GitHub)

Sign in with **GitHub** to store collections in Supabase. Settings are stored per user. Without sign-in, data stays in browser local storage.

### One-time setup

1. Create a free [Supabase](https://supabase.com) project.
2. In **SQL Editor**, run [`supabase/schema.sql`](./supabase/schema.sql).
3. Enable **GitHub** under Authentication → Providers.
4. Create a GitHub OAuth App (GitHub → Settings → Developer settings → OAuth Apps):
   - Homepage URL: `https://ek-so.github.io/lingrow/`
   - Authorization callback URL: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
5. Paste the GitHub Client ID/Secret into Supabase’s GitHub provider settings.
6. In Supabase Auth → URL configuration, add redirect URLs:
   - `https://ek-so.github.io/lingrow/app.html`
   - `http://localhost:5173/lingrow/app.html` (local)
7. Copy project URL + anon key into `.env.local`:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

8. For GitHub Pages deploy, add the same values as repository secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### Site URLs

- Homepage: https://ek-so.github.io/lingrow/
- App: https://ek-so.github.io/lingrow/app.html
- Privacy: https://ek-so.github.io/lingrow/privacy.html
- Terms: https://ek-so.github.io/lingrow/terms.html
