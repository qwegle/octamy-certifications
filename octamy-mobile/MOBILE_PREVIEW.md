# Retired mobile preview

> **RETIRED — DO NOT BUILD OR RELEASE.** Everything under `octamy-mobile/` is an obsolete scaffold retained only for history. Its API assumptions, storage, notifications, exam, certificate, payment, and production-readiness claims are not supported release contracts.

The supported Expo SDK 57 learner app is `mobile/`. Start with:

```bash
cd mobile
npm ci
cp .env.example .env
# Set EXPO_PUBLIC_API_URL to a reachable Octamy server origin, without /api.
npm start
```

Use a development/EAS build—not Expo Go—for SQLCipher, camera, microphone, and full native validation. See `mobile/README.md` for setup/store blockers and `mobile/docs/API-CONTRACT.md` for verified backend behavior. The former “production-ready” claim for this scaffold is withdrawn.
