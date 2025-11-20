# Arciva PWA QA & Acceptance Tests

## Smoke Tests
1. `pnpm install` (workspace root) to ensure dependencies are up to date.
2. `cd frontend && pnpm dev -- --host 0.0.0.0` for local development; Safari/Chrome on device can hit via LAN tunnel.
3. `pnpm build && pnpm preview --host 0.0.0.0` to mimic production before final QA.
4. Clear previous service worker registrations for `localhost` via Chrome DevTools > Application before re-testing.

## Installability Checklist
- **Manifest**: At preview URL, open `/manifest.webmanifest` and Chrome DevTools > Application > Manifest. Confirm `name/short_name`, `display: standalone`, `start_url`, `scope`, colors, and maskable icons resolve without 404s.
- **Service Worker**: Confirm `sw.js` is registered (Application > Service Workers) and in control of the page immediately after first load.
- **App Shell Cache**: Toggle DevTools Network tab to "Offline" and refresh—Arciva’s frame, navigation, and branding should appear rather than Chrome’s default offline page.
- **Icons**: Inspect the 192px and 512px icons plus maskable preview in DevTools. Ensure no unintended cropping.

## Install UX Tests
1. **Android Chrome**
   - Open the app, interact once, and watch for the install hint button.
   - Tap "Install" → `beforeinstallprompt.prompt()` should fire → accept.
   - Launch Arciva from the new icon; app opens standalone and offline refresh works.
2. **iOS Safari**
   - Browse to the HTTPS preview URL.
   - Verify inline hint instructs “Share → Add to Home Screen”.
   - Perform the flow, launch Arciva from the icon, and confirm there is no Safari chrome.
   - Go offline and relaunch to confirm cached shell renders.

## Regression Checklist
- Navigation between `/` and `/projects/:id` still works when opened via installed icon (deep link + BrowserRouter base path validation).
- Bulk export jobs continue to stream because runtime caching ignores API responses.
- Dev server workflows unaffected (PWA dev mode is opt-in and only toggled when requested via `vite-plugin-pwa`).

## Acceptance Criteria Recap
- Manifest includes Arciva branding, start URL `/`, scope `/`, standalone display, theme/background colors, and 192/512 maskable icons.
- `registerSW()` call in `src/main.tsx` registers the generated service worker (auto-update) and caches app shell assets.
- `public/icons/icon-192.png` and `icon-512.png` exist and are referenced via manifest + Workbox cache.
- Install hint component surfaces the CTA on Android and the Share-sheet instructions on iOS, both dismissible.
- Offline refresh after initial load shows Arciva UI instead of a network error.
