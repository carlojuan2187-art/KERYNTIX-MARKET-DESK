# KERYNTIX MARKET DESK bilingual interface — 2026-10-31

## Behavior
- English (`en`) is the default for new and legacy accounts without a stored preference.
- Spanish (`es`) is available from the EN / ES selector in the login page and authenticated application top bar.
- The browser preference is stored as `ftrade.language` in local storage.
- For authenticated users, the selected preference is synchronized with `PATCH /auth/me`.
- The selected language at registration is included in the registration request.
- Country names use `Intl.DisplayNames` with the selected locale; dates, times, numbers and relative times use locale-aware formatting.

## Translation coverage
- Shared dictionary: `src/i18n/translation.ts`.
- The dictionary contains 1,032 unique source keys at implementation time.
- Dynamic messages from the API and notification center are translated through the same helper.

## Validation
- 42 TypeScript / TSX files statically parsed with zero syntax errors.
- Zero unresolved relative imports.
- 927 literal translation calls checked; zero missing dictionary keys.
- Zero duplicate dictionary keys.
- Zero untranslated Spanish static JSX text or string attributes found by the static scan.
- Vite build and Playwright E2E were not run: npm dependencies could not be installed in the build environment. Run `npm ci`, `npm run build`, and `npm run test:e2e` in CI or a local environment with package registry access before production deployment.
