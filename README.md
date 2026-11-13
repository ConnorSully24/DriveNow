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
