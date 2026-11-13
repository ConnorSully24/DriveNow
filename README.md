
### Supabase test project connected (13 November 2026)

A Supabase test project has been connected to the GitHub Pages build using **public, browser-safe** project URL and Supabase publishable key. The workflow reads repository Actions variables when present, otherwise uses the public fallback values. No secret/service-role key, database password, or personal credentials are stored in the repository. To rotate the public key, update the repository variables or the workflow fallback.

The `drivenow_initial_profiles_20261113` SQL migration was applied successfully. Four RLS-protected tables now exist: learner_profiles, learner_verifications, instructor_profiles and instructor_verifications, with signup triggers for both roles. Verified/approved status **cannot** be self-assigned by ordinary users. Real email sign-up still requires configuring Auth **Site URL** and redirect allowlist in the Supabase dashboard, and should be tested with fictional identities. **Real driving entitlement and instructor verification are NOT enabled; the booking and diary remain browser-local demo systems.**

---
## Availability calendar and block-booking demo (13 November 2026)

The app now has **three learner booking options**: Book now (starts in the next 6 hours with at least 30 minutes notice), Book ahead (single available lesson), and Block booking (5 or 10 lessons). Block booking supports a recurring **same day/time every week** pattern or **individually chosen dates**. The recurring option only offers a time when **all** sessions are available; custom selection retains its dates as the learner browses. The demo checkout lists every session and the total illustrative price (no discounts or payments yet).

In **Instructor → Availability diary**, an instructor can change their demo weekly working windows, add/remove multiple windows for a weekday, and block full days or partial days. Existing bookings remain visible and cannot be overwritten with a time-off block. The instructor's changes immediately affect the learner's available demo slots **within the same browser**. Each confirmed demo booking creates a requested lesson; a multi-lesson block has a shared `blockBookingId` and individual diary entries.

### Test the end-to-end flow
1. Open the GitHub Pages DriveNow demo. Choose **Instructor** on the demo switcher, open **Availability diary**, select a sample instructor, and add time off or a recurring opening.
2. Switch to **Learner**, choose **Book ahead**, select that instructor/date and see how the open starts change.
3. Choose **Block booking**, select 5 or 10 sessions and try the recurring weekly option. Change the start date if no complete series appears. Alternatively, choose **Pick dates individually** and select each slot on separate dates.
4. Review the block summary, send a *demo* request, then return to the instructor dashboard to accept it and see the entries in the diary.
5. Re-run an overlapping search. Already requested/confirmed/completed lesson times and a 15-minute turnaround buffer are excluded, unless declined or cancelled.
6. Use **Reset demo** to restore sample working hours, clear blocked dates and clear demo lessons. This also clears saved demo lesson ratings.

### Important production limitations
- **No real shared availability, booking guarantees, payments or instructors.** Browser `localStorage` is device-local. Changes made on an instructor's phone do *not* update another person's phone.
- Real inventory requires authenticated, verified instructor ownership, database tables for windows/time-off/lesson holds, timezone-safe scheduling (Europe/London), transactional no-double-booking constraints, and server-side multi-slot reservation. A React client cannot guarantee no double-booking across users.
- Block booking changes, payments, rescheduling, cancellation/refund rules and travel-time buffers need full backend and marketplace policy work before launch.
- `npm run test:schedule` runs automated tests of UK clock calculations, weekly availability, blocked periods, booked-slot exclusion, 15-minute turnaround, and full-series validation. GitHub Actions executes these tests before each build.

---

## Learner + instructor accounts (November 2026)

The **Account** screen now starts with a choice between **Learner** and **Instructor**. Both lead to different UK eligibility steps and one email/password sign-in backed by Supabase Auth when configured. Instructor registration offers ADI / trainee / Northern Ireland authorisation declarations, teaching-car transmission selection, and an age-21 check. These are **declarations only**: no external DVLA, DVSA or DVA approval is claimed.

For usability testing, either account can be explored instantly with **Skip sign-up / Try demo**. It does not create a database account, store personal data, bypass real verification or enable paid bookings. Demo mode appears when Supabase is unconfigured, or explicitly when `VITE_ENABLE_DEMO_MODE=true`. The GitHub Pages workflow currently enables this staging-only flag. **Remove it for production public onboarding**.

### Enabling real account creation

1. Create a Supabase project, enable Email authentication and **Confirm email** (use test addresses initially). Configure the hosted Site URL and redirect URLs.
2. Review and run `supabase-schema.sql` in the SQL Editor. This sets up **learner and instructor** profile and verification tables; signup triggers create role-specific profiles and cannot mark people verified.
3. Add the public `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or the legacy `VITE_SUPABASE_ANON_KEY`) to the **build-time** environment on your hosting provider. For GitHub Pages, add these values under **Repository Settings > Secrets and variables > Actions > Variables**; the deployment workflow already passes them to Vite. They are public project settings, not a private database password. Never expose a service-role or secret key in frontend code.
4. For test staging, keep `VITE_ENABLE_DEMO_MODE=true`. For public onboarding, remove or set false and establish a privacy notice, verified-email settings, anti-abuse controls, account deletion, UK data-protection handling, and a secure review system.
5. Test both role signups, email confirmation, sign-in, sign-out, denied cross-user reads (RLS), and that **verification cannot be changed by the user**.

**Not yet live:** No Supabase project credentials are configured in this repo, no trusted verification integration exists, no identity documents are uploaded, and the existing booking/instructor dashboards remain demo data only. Instructors must be independently validated before being permitted to take paid lessons.

---

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

## Learner skill scoring and instructor ratings (November 2026)

- A **learner** gives their own skill an initial score (1–10) **once during sign-up**. The initial score is stored in `learner_profiles.self_assessed_skill` by the Supabase authentication signup trigger when the backend is configured. The learner is NOT asked to reassess after a lesson.
- After a **completed** lesson, the **learner** rates the **instructor** from 1 to 5 stars. That rating can only be saved once per lesson in the prototype.
- After a **completed** lesson, the **instructor** assesses the **learner** from 1 to 10. That assessment can only be saved once per lesson in the prototype.
- The learner's displayed skill starts at the self-rating and, as soon as one instructor score exists, becomes the arithmetic mean of **instructor scores only**, rounded to one decimal. Sign-up rating never contributes to that average.
- Sample demo ratings persist in this browser's local demo state. In test mode, learners can skip personal details and optionally select a different initial skill level (defaults to 5/10). They can run a demo lesson to completion, review the instructor, switch to the instructor dashboard, and rate the learner.
- **Backend work remains:** real lesson records, authenticated post-lesson feedback, server-side proof of completion, participant-scoped write permissions, review rate limiting, and abuse handling. Demo ratings are not public production reviews or verified skill records.
- For existing Supabase projects, rerun the latest `supabase-schema.sql` so the learner profile includes `self_assessed_skill`. Existing rows can remain null until a migration/backfill strategy is agreed.
