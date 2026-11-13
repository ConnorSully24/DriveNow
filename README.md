## Learner onboarding (November 2026)

The **Learner account** screens now include a three-step UK learner sign-up flow: legal name / DOB / postcode, provisional-licence and eyesight declarations, and email/password account creation. Age 17+ is enforced for the initial pilot, with an explicit note that age-16 mobility exceptions need a separate manual review pathway. A sign-in view and read-only licence-verification status are also provided.

**Important:** This is not yet a live licence checking system. The DVLA's share-code service uses a code and the last eight characters of a licence number; DriveNow does NOT collect these in the frontend. Never ask users to email or upload licence photos before you have a trusted verification provider, a privacy policy and secure server-side storage. Accounts must NEVER be marked verified based on self-declarations or a user's browser. The current booking experience is an independent demo that needs server-side verification gating before launch.

### Connecting real sign-ups

1. Create a Supabase project and review UK data protection, children's privacy, security and retention requirements before processing real learner data.
2. In the Supabase **SQL Editor**, review and run `supabase-schema.sql`. This creates user-owned profile tables, a read-only `learner_verifications` table and an auth trigger. Only a trusted backend can assign `verified`.
3. In Supabase **Authentication**, enable email confirmations. Configure the Site URL and redirect allowlist for your deployment (GitHub Pages or Render). For the pilot, configure signup rate limits/CAPTCHA and abuse protection.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Supabase project's **public** credentials in the Render build environment or GitHub Actions **build-time** variables. **Never use a service-role key, database password, Stripe secret, or private credential in a `VITE_` variable.** The GitHub Actions workflow will need these two public values explicitly in the Build step when enabled.
5. Implement the server-side licence check (provider/manual review with authorised DVLA access), privacy notice, authenticated account deletion, admin review and server-side booking eligibility checks. Do not launch paid bookings until those work.

Without env configuration, the account screens can be previewed and navigated; clicking create account never sends data or falsely claims account creation.

---

# DriveNow – on-demand driving lesson prototype

A polished, responsive UK driving lesson marketplace concept. Built as a **frontend-only demo** using React, TypeScript and Vite. Installable as a Progressive Web App (PWA) when hosted over HTTPS.

> **Important:** This is a prototype, not a live booking platform. All instructor profiles, ratings, prices, estimated arrival times, and availability are **fictional sample data**. No real payments, bookings, SMS, DVSA checks, routing, or instructor notifications occur.

## Run it locally

Prerequisites: Node.js 20.19+ or 22.12+ and npm.

```bash
npm install
npm run dev
```

Open the local URL shown by Vite, usually http://localhost:5173.

To check the production build:

```bash
npm run build
npm run preview
```

## Demo walkthrough

1. Open **Discover** as a learner and tap **Find a lesson**.
2. Set the location, lesson length, transmission and preferred time.
3. Select a fictional instructor and send a demo request. No card is required.
4. Change the role to **Instructor** using the sidebar (or bottom nav on mobile).
5. Select the matching instructor profile, **Accept** the request, **Mark as arrived**, **Start demo lesson**, then **Complete lesson**.
6. Switch back to the **Learner** role and open **My lessons** to see the updated status. Instructor demo earnings are updated when a lesson is completed.
7. Use **Reset demo** in the sidebar to clear the local demo data.

The demo persists lesson requests in **your own browser's `localStorage`**. Role-switching works on one browser/device. It does **not** sync between different devices.

## Publish (free static hosting)

### GitHub Pages

1. Create a new GitHub repository, e.g. `drivenow-mvp`, and upload/commit the project files.
2. In the repository, choose **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The included `.github/workflows/deploy.yml` builds and deploys the app to GitHub Pages when you push to `main`.
4. After deployment, open the GitHub Pages URL shown in **Settings → Pages**. It may take a few minutes for GitHub to complete the workflow.

> GitHub Pages on a private repository depends on your GitHub plan and Pages eligibility. Public repositories can expose all source code. Do not add secrets to this frontend.

### Install on iPhone

Once hosted over HTTPS, open the site in Safari. Tap **Share → Add to Home Screen → Add**. Some iOS versions may display **Open as Web App**. Offline support is basic and will only work for resources already cached from a previous visit.

## Project structure

- `src/App.tsx` — mobile learner/instructor flows and interactions
- `src/model.ts` — fictional instructors, types and local demo storage
- `src/styles.css` — responsive styling
- `public/manifest.webmanifest`, `public/sw.js` — PWA manifest and basic offline caching
- `.github/workflows/deploy.yml` — GitHub Pages deployment

## Before going live

The demo must **not** be used to accept real learners or instructor payments. A real marketplace needs:

- Secure learner and instructor accounts, profiles, age/safeguarding policy and privacy notices
- DVSA ADI registration checks, licence/insurance verification and appropriate professional review
- Real instructor calendars with availability locking and cancellation rules
- Geocoding, maps, pickup coverage zones and trustworthy ETA calculations
- Backend database, API, messaging/notifications and real-time booking state
- Payment provider marketplace accounts, refunds/payouts and tax/compliance review
- Support, abuse prevention, GDPR/data retention and incident handling

## Technology

- React 18, TypeScript, Vite 6, lucide-react
- No API keys, server, Firebase, Stripe or payment credentials needed for the demo
- Prices displayed in GBP (£), UK-centric copy and sample Leeds location

© 2026 DriveNow concept. All example profiles fictional.
