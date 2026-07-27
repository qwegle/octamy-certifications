# Octamy Mobile

Expo learner app for Octamy career certifications, Practice Pass, private AI interview practice, certificates, and consent-controlled recruiter evidence visibility. This is a self-contained Expo SDK 57 project; run every command from `mobile/` and do not use the retired `octamy-mobile/OctamyMobile` scaffold.

## Requirements

- Node.js 20+
- npm
- Xcode/iOS Simulator or Android Studio/emulator
- A development/EAS build for SQLCipher, camera, microphone, and full native validation (Expo Go is not the release runtime)

## Configure

```bash
cp .env.example .env
```

Set only the public API origin:

```env
EXPO_PUBLIC_API_URL=http://localhost:8080
```

`EXPO_PUBLIC_API_URL` must be the origin of the existing Octamy server, without `/api`. Production builds reject non-HTTPS origins. Expo embeds every `EXPO_PUBLIC_*` value in the client bundle, so never put API keys, JWT secrets, payment secrets, or credentials there. Physical devices need a reachable development origin; Android Emulator commonly uses `http://10.0.2.2:8080`.

## Run and validate

```bash
npm ci
npm start
npm run typecheck
npx expo-doctor
```

EAS profiles are defined in `eas.json`; production environment values belong in EAS environment configuration, not the repository.

## Core architecture

- `src/lib/api-client.ts`: typed `/api/...` transport, SecureStore token bridge, JSON/multipart handling, request cancellation/timeouts, and normalized `ApiError` values.
- `src/lib/query.ts`: in-memory TanStack Query cache with bounded retry, conservative stale times, NetInfo online state, AppState focus state, and no generic offline mutation queue.
- `src/features/auth`: verified register/login/me/logout/password-reset wrappers, secure native persistence, guarded web storage fallback, bootstrap validation, and a read-only offline session state.
- `src/app/_layout.tsx`: splash-safe route gate plus Query, session, feedback, theme, safe-area, and gesture providers.
- Feature server state stays in Query; passwords and JWTs never enter Query or SQLite. Feature repositories register user-data cleaners so logout can purge drafts, outboxes, and local clips.

Unauthenticated users can access the auth group and public certificate verification. Authenticated users are routed to the five learner tabs. A stored session is validated with `GET /api/auth/me`; an invalid/expired `401` clears it. When validation is unavailable, a previously validated user may see an explicitly read-only offline shell.

## Verified backend limitations

- Google OAuth is labeled “Continue with Google on Octamy website.” The backend returns its JWT to web `/login#token=...`; it has no native callback/token exchange, so closing the browser never creates a native session.
- Logout invalidates this app’s local token. The server has no refresh token, revocation, device-session list, or “sign out all devices” contract.
- Password-reset email links open the Octamy website; the mobile app does not ingest reset tokens.
- Exam recovery is device-local because no active-session or progress-save endpoint exists. Final submission is replayed only with the same server-issued `sessionId`.
- Practice Pass access is authoritative only from `GET /api/me/subscription`; browser return or payment status never grants access.
- Camera video is local rehearsal media only. There is no learner interview/profile video upload or recruiter-video endpoint.
- Recruiter discovery/public-link controls are separate from selected per-recruiter grants. Grants are purpose-bound, expiring, revocable, and learner-auditable; they exclude Interview Studio, recordings, answers, question data, and raw integrity evidence.
- There is no verified learner account-deletion endpoint or approved in-app web deletion contract. Because account creation is present, store submission remains blocked until the backend/product supplies one and updates `docs/API-CONTRACT.md`.
- External web checkout must remain storefront/region policy-gated. The backend has no App Store/Play receipt validation or restore-purchase contract.

Before store submission, confirm ownership of `com.octamy.mobile`, final production artwork and metadata, EAS credentials, privacy/data-safety disclosures, external-payment policy eligibility, and the account-deletion contract.

## Permissions and privacy

Octamy requests camera and microphone access only after the learner accepts the local-video disclosure and initiates recording. Camera video and microphone audio are kept in user-scoped, backup-excluded app cache; they are never uploaded, sent to AI, attached to a profile, or shared with recruiters. Learners can delete one recording, delete all recordings, or remove them by signing out/uninstalling, and the operating system may reclaim cache files earlier. Android app-data backup is disabled. The iOS photo-library usage string is declared for store metadata completeness, but this release has no photo-picker flow and requests no photo-library or Android media-library permission.

Interview Studio text/code responses are sent only after explicit AI-processing consent, are private practice data, are retained by the server for 30 days, and can be deleted from the session screen. Exam recovery data stays on the same device until successful submission, explicit expiry cleanup, or sign-out. Practice recovery is device-local; no cross-device progress API exists.

Recruiter discovery and public evidence-passport-by-link are separate, off-by-default server-confirmed controls under **Profile → Privacy & evidence**. Selected evidence grants are separately purpose-bound, expiring, and revocable. Local videos and Interview Studio are always excluded; Practice answers/raw events are excluded, while an eligible summary may be shared only when the learner explicitly selects it in a grant.

## Account deletion and store-policy blockers

Account deletion is available in-app at **Profile → Privacy & evidence → Email account deletion support**. It opens a pre-addressed request to `support@octamy.com`; support must verify and process deletion because the verified backend has no learner deletion endpoint. Since the app supports account creation, production store submission remains blocked until product/backend provides a store-compliant deletion contract and updates `docs/API-CONTRACT.md`.

Practice Pass currently uses a Cashfree external web-checkout handoff. Browser return and payment status never grant access; only the signed server webhook plus authoritative `GET /api/me/subscription` state can do so. This flow has no Apple/Google in-app purchase, receipt validation, restore-purchase, or subscription-management API and must be storefront/region policy-gated before release. Apple App Review and Google Play billing policy may reject unrestricted external checkout for digital access.

The bundle identifiers `com.octamy.mobile`, artwork, store metadata, EAS credentials, privacy manifests/data-safety answers, support operations, and production `EXPO_PUBLIC_API_URL` must be confirmed by the release owner before submission.
