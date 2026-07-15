# Mama Uhai — Backlog

Tracking document for ongoing development. Last updated: 2026-07-14.

---

## ✅ Done (live on production)

### Accounts & sample data
- [x] Seed database with realistic Ugandan sample data: 2 admins, 5 doctors, 5 health workers, 5 mothers
- [x] Payments, reviews, and medical records — new tables, working APIs, sample data (didn't exist before)
- [x] Remove hardcoded demo credentials from the public login page
- [x] Idempotent seeding — safe to re-run against production without duplicating data

### Admin tools
- [x] Admin can create users, reset passwords, assign roles
- [x] Lock / unlock / suspend / reactivate accounts, forced password change at next login
- [x] Admin-only "Demo Accounts" viewer (never shows plaintext passwords)
- [x] "Password Requests" approval queue

### Login & security
- [x] Forgot-password flow: user requests → admin approves → temp password issued
- [x] QR code login: scan with the phone's native camera app (real URL-based QR, not just an in-app scanner) or approve from another already-signed-in device
- [x] `trust proxy` fix so QR links correctly use `https://` behind Render
- [x] Closed a bug where the public registration endpoint could create `admin` accounts directly

### Mama AI
- [x] Offline knowledge base (39 entries: pregnancy, nutrition, medications, antenatal care, danger signs, breastfeeding, newborn care, family planning, vaccinations, postpartum care) — works with zero internet, zero API key
- [x] Voice output (read-aloud) via the browser's built-in text-to-speech
- [x] Graceful fallback design: cloud model (if configured) tried first, falls back to offline KB on any error — never shows an error to the mother

### Design / branding
- [x] User-provided mother-and-baby photo added as background on the login screen and all three dashboard hero banners
- [x] Photo layered under the existing brand-color gradient so text/buttons stay legible

### Real-time
- [x] Socket.io sync for messages, appointments, notifications, account status changes, password reset approvals

---

## 🔧 In Progress (built + tested locally, not yet pushed)

- [ ] **Installable phone app (PWA)** — manifest, app icons, service worker built and verified locally (manifest loads, service worker activates, correct content-types). Not yet confirmed: real install-prompt trigger in Chrome, not yet pushed to production.
- [ ] **Gemini SDK migration** — the originally-integrated `@google/generative-ai` package is now deprecated by Google. Migrating to the current `@google/genai` SDK. New package installed; `routes/mama-ai.js` not yet updated to use it; not tested.

---

## 📋 Not started / known gaps

- [ ] Mama AI cloud upgrade requires a real `GEMINI_API_KEY` (or `GROQ_API_KEY`) — needs to be obtained from the account owner's own Google AI Studio / Groq account and set in Render's environment variables. Not something that can be provisioned on the owner's behalf.
- [ ] Doctor and Health Worker roles currently share an identical dashboard (My Patients, Messages, Sign out) — no role-specific views yet.
- [ ] Payments and reviews have no dedicated management UI outside the mother's Digital Passport (e.g. no provider-facing "my reviews" or "my payments" screen).
- [ ] No email/SMS provider configured — forgot-password routes to an admin instead of sending a reset link/text.
- [ ] Offline knowledge base content (`data/mama-ai-kb.js`), especially danger-sign and medication entries, has not had a clinical review.
- [ ] Temporary passwords issued by admin actions are shown once in a browser `alert()` and not logged anywhere in-app — if lost, a new reset is required.
