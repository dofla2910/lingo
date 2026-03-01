# Repository Guidelines

## Project Structure & Module Organization
- `src/`: main web app (Svelte + Vite).
  - `src/lib/components/`: UI sections and modals (`TimerSection.svelte`, `AuthPairingPanel.svelte`, etc.).
  - `src/lib/lingo/`: shared app logic (`store.js`, `schema.js`, `supabaseClient.js`, `utils.js`).
  - `src/styles/`: global styles (`lingo.css`), design tokens, reusable classes.
- `public/`, `icons/`, `resources/`: static assets, PWA icons, native icon/splash sources.
- `supabase/`: SQL schema/migrations for backend data model.
- `android/`, `ios/`: Capacitor native projects.
- `docs/`: release and deployment guides.

## Build, Test, and Development Commands
- `npm run dev`: start local Vite dev server.
- `npm run build`: production web build to `dist/` (required before PR merge).
- `npm run preview`: preview production build locally.
- `npm run mobile:sync`: build web + generate native assets + sync Capacitor.
- `npm run mobile:build:android:aab`: Android release bundle.
- `npm run mobile:build:ios:ipa:adhoc`: iOS Ad Hoc archive + `.ipa` export (macOS/Xcode).

## Coding Style & Naming Conventions
- Use 2-space indentation in Svelte, JS, and CSS.
- Svelte component filenames: `PascalCase.svelte`.
- Utility/store modules: `camelCase` exports, grouped by domain in `src/lib/lingo/`.
- Keep UI text in Vietnamese unless a feature explicitly needs English.
- Prefer small, focused components; move shared logic to `store.js`/`utils.js`.

## Testing Guidelines
- No automated test suite is configured yet.
- Minimum validation for each change:
  1. `npm run build` passes.
  2. Manual QA on desktop + mobile viewport.
  3. Verify critical flows touched (auth, room pairing, events, gallery upload, settings, PWA install prompt).
- For Supabase changes, include SQL in `supabase/` and verify with a clean test room/account.

## Commit & Pull Request Guidelines
- Follow existing commit style: imperative, concise, feature-first (e.g., `Add modal scroll-lock`, `Fix OAuth callback URL handling`).
- Keep commits scoped to one concern.
- PR should include:
  - What changed and why.
  - Any env/schema updates (`.env`, Supabase SQL).
  - Screenshots/GIFs for UI updates.
  - Manual test notes (devices/viewports/flows checked).

## Security & Configuration Tips
- Never commit secrets. Use `.env.local` for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Review `vercel.json` and auth redirect URLs when changing domain/auth behavior.
