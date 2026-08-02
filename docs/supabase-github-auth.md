# Supabase ↔ GitHub authentication (Lingrow)

Recovery checklist for reconnecting GitHub sign-in if OAuth or env config breaks. The app uses Supabase Auth with the GitHub provider and PKCE (`src/lib/supabase.ts`, `src/lib/auth-context.tsx`).

## 1. Create or restore the GitHub OAuth App

1. Open GitHub → **Settings** → **Developer settings** → **OAuth Apps** (org: org settings → Developer settings).
2. Create a new OAuth App (or edit the existing Lingrow one).
3. Set:
   - **Application name:** anything recognizable (e.g. `Lingrow`)
   - **Homepage URL:** production site, e.g. `https://ek-so.github.io/lingrow/`
   - **Authorization callback URL:** Supabase’s callback (not your app URL):

     ```text
     https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
     ```

     Find `YOUR_PROJECT_REF` in Supabase → **Project Settings** → **API** → Project URL.
4. Create the app, then generate a **Client secret**.
5. Copy **Client ID** and **Client secret** — you need both in Supabase next.

## 2. Enable GitHub in Supabase Auth

1. Supabase Dashboard → your project → **Authentication** → **Providers** → **GitHub**.
2. Enable the provider.
3. Paste the GitHub **Client ID** and **Client secret**.
4. Save.

## 3. Allow your app redirect URLs in Supabase

Supabase must whitelist where users land after GitHub. Lingrow builds the redirect as:

```text
{origin}{BASE_URL}app.html#/
```

Examples:

| Environment | Redirect URL to allow |
|-------------|------------------------|
| Production (GitHub Pages) | `https://ek-so.github.io/lingrow/app.html#/` |
| Local Vite | `http://localhost:5173/app.html#/` (port may differ) |

Steps:

1. **Authentication** → **URL Configuration**.
2. **Site URL:** set to the primary app URL (e.g. production `…/app.html` or the Pages root you prefer).
3. **Redirect URLs:** add every environment you use (prod + local). Include the hash form above so HashRouter callbacks work.
4. Save.

If sign-in “succeeds” on GitHub but the app never gets a session, this list is the usual culprit.

## 4. Wire env vars in the app

Copy `.env.example` → `.env` (local) or set the same keys in CI / hosting secrets:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Both come from Supabase → **Project Settings** → **API**.

- Without these, the UI shows that GitHub sign-in is disabled (`isSupabaseConfigured()`).
- Rebuild/redeploy after changing Vite env vars — they are baked in at build time.

## 5. Database (only if cloud sync also broke)

Auth can work while sync fails. Schema lives in `supabase/schema.sql`.

1. Supabase → **SQL Editor**.
2. Run `supabase/schema.sql` if tables/policies are missing.
3. Confirm RLS policies allow the signed-in `auth.uid()` to read/write their rows.

## 6. Smoke-test the flow

1. Open the app → Profile (or login prompt) → **Sign in with GitHub**.
2. Expect redirect: app → Supabase → GitHub → Supabase callback → back to `…/app.html#/`.
3. Confirm a session appears (signed-in user on Profile) and cloud sync can load/save collections.

## Quick troubleshooting

| Symptom | Check |
|---------|--------|
| Button disabled / “not configured” | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`; rebuild |
| GitHub error: redirect_uri mismatch | GitHub OAuth App callback must be exactly `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` |
| Returns to app but still signed out | Supabase **Redirect URLs** must include `…/app.html#/`; PKCE + `detectSessionInUrl` are already enabled in code |
| Wrong GitHub account / revoked access | GitHub → Settings → Applications → Authorized OAuth Apps → revoke and sign in again |
| Sync errors after sign-in | Re-run `supabase/schema.sql`; check Auth users exist under **Authentication** → **Users** |

## Code touchpoints (for this repo)

- Client + PKCE: `src/lib/supabase.ts` (`authRedirectTo`, `flowType: "pkce"`)
- OAuth call: `src/lib/auth-context.tsx` → `signInWithOAuth({ provider: "github", … })`
- Callback bootstrap: `src/lib/auth-bootstrap.ts`
- Env template: `.env.example`
