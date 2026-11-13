# DriveNow — Functionality Roadmap
Updated: 13 November 2026
Status: Product planning. Features below are not live unless explicitly marked as demo.

## Product strategy
A UK marketplace for verified learner drivers and approved/licensed instructors to book on-demand, scheduled, or block driving lessons. Launch the smallest reliable version in Leeds; expand after verifying supply and successful lesson fulfilment.

## What already exists (demo)
- Responsive learner and instructor interfaces, example profiles, sample requests, simulated lesson status changes and demo reviews.
- Learner and instructor sign-up flows and Supabase integration scaffolding; real sign-ups and external verification are not yet connected.
- One-time learner sign-up driving skill score (1–10). After each completed lesson, learner rates instructor (1–5 stars), instructor scores learner (1–10); first instructor assessment supersedes learner self-score and instructor-only averages apply thereafter.
- Easy skip-details demo mode, separate from any production account/verification process.
- GitHub Pages deployment.

## Phase 0 — Secure accounts and backend (P0 / prerequisite)
- [ ] Connect Supabase Auth and email confirmation, password reset, account deletion.
- [ ] Apply versioned schema migrations and test database RLS for learner and instructor roles.
- [ ] Add private admin review tools, verified/pending/rejected states and audit logs.
- [ ] Plan secure learner provisional entitlement and instructor ADI/trainee authorisation, ID and insurance checks. Declarations are not verification.
- [ ] Separate demo mode, staging, production, data and permissions; real bookings must be server-authorised.
**Acceptance:** two independent users can register/sign in; one cannot read or change the other's private profile or verification status.

## Phase 1 — Availability calendar and booking discovery (P0 / next feature)
### Instructor schedule
- [x] DEMO: Set weekly recurring hours and one-off openings (single-browser localStorage, not live).
- [ ] PRODUCTION: Set recurring hours through authenticated instructor-managed shared database.
- [x] DEMO: Add/remove full-day or partial-day blackout dates and see booked/requested lessons.
- [ ] PRODUCTION: Persist exceptions and external commitments in shared database.
- [ ] Configure lesson durations (60/90/120 min), hourly price, pickup service area, transmission, travel/setup buffer and minimum notice.
- [ ] View a mobile day/week calendar with free, held and booked states.
- [ ] "Available now" opt-in and ability to offer last-minute cancellations.
- [ ] Choose whether each slot can be instant-confirmed or requires instructor acceptance.

### Learner booking entry points — three clear options
1. **Book now:** find an available verified instructor for an imminent lesson, accounting for travel and notice.
2. **Book ahead:** browse specific calendar dates and open slots for a one-off lesson.
3. **Block booking:** see instructors who can accommodate a **series** of lessons, then reserve the series together.

### Block booking requirements (part of the booking engine, not just a discount package)
- [x] DEMO: **Block booking** option beside Book now and Book ahead; same time weekly or individually selected dates.
- [ ] PRODUCTION: Authenticate and persist book-now, book-ahead and block bookings across users.
- [ ] Learner selects number of lessons (suggest starting with 5 or 10), lesson duration, transmission, postcode/area, preferred instructor, first date and preferred days/times.
- [ ] Offer **same day/time every week** (e.g. five Tuesdays at 6pm) and **choose dates individually**.
- [x] DEMO: Filter recurring start times to those with a complete 5/10-lesson series (same browser only).
- [ ] PRODUCTION: Show shared inventory, conflict reasons and alternative date patterns.
- [ ] In a single calendar, show each proposed session, total lesson-hours, individual prices, potential package savings (if offered), and total block price before checkout.
- [ ] Reserve all selected slots atomically; handle conflicts by suggesting replacement slots rather than silently double-booking or charging for unavailable lessons.
- [ ] Booking status / payment rules: hold all chosen slots briefly; confirm all on successful authorised payment/acceptance; release holds on expiry/decline/error.
- [ ] Store lessons separately while linking them with one `block_booking_id`; support lesson-by-lesson completion, review, rescheduling, cancellation and refund/credit rules.
- [ ] Instructor diary must visibly distinguish a series of block bookings from single lessons.
- [ ] No automatic recurring payments or upfront charges before terms, cancellation policy and refund handling are implemented.
**Acceptance:** a learner can find and reserve a set of 5 available consecutive weekly lessons with one instructor; the instructor sees all five in their calendar; a second competing booking cannot take any of those slots. When one date is unavailable, the app proposes alternatives and never silently books a partial block.

### Booking integrity / architecture
- [ ] Persist availability rules, exceptions, slot holds and reservations in PostgreSQL using Europe/London timezone and daylight-saving-safe date calculations.
- [ ] Derive candidate slots from windows, durations, travel buffers and existing bookings.
- [ ] Reject overlapping holds/bookings atomically in backend, not only in browser.
- [ ] Booking lifecycle: available -> held -> confirmed/requested -> in_progress -> completed; plus expired/declined/cancelled/refunded.
- [ ] Learner and instructor see the same committed schedule.
**Acceptance:** two different accounts cannot book an overlapping slot, even when they click simultaneously.

## Live scheduling milestone (13 November 2026)
- [x] Create three RLS-secured Supabase instructor live scheduling tables (directory, weekly windows and exceptions).
- [x] Link schedules to authenticated instructor profile IDs; only the owner may write.
- [x] Allow instructors to opt in to publishing their TEST availability; default private.
- [x] Connect responsive instructor edit screen and signed-in learner slot/block previews across devices, with Refresh/30-second polling.
- [x] Add one-off cancellation/extra availability table with per-instructor write restrictions and published read rules.
- [x] Add Today/Tomorrow/next-hour instructor shortcuts, remove control, and labelled last-minute availability in learner test search.
- [x] Merge regular and one-off hours without duplicates; blockouts and minimum notice still apply.
- [x] Deliver opt-in, matching cancellation watch preferences and private in-app inbox, with automatic server-side alert creation on newly posted or published cancellations.
- [x] Add top-bar unread bell, per-user read controls and cross-device inbox polling.
- [ ] Connect cancellations to actual confirmed lessons, add email/phone push delivery with permission and secure worker, and fill slots with transactional reservations.
- [ ] Verify instructor sign-up and cross-device behaviour with two independently created test accounts.
- [ ] Implement server-side holds and shared booking data before enabling even test reservations.
- [ ] Independently verify credentials before listing any instructor as approved or offering paid lessons.

## Phase 2 — Payments, communication, and cancellations (P0 for launch)
- [ ] Investigate Stripe Connect for payment collection, fee display, instructor onboarding and payouts.
- [ ] Payment confirmation tied to validated booking and available slot hold; no charge for an unavailable slot.
- [ ] Upfront disclosure of cancellation, rescheduling and refund policy; special rules for block booking individual sessions vs the whole package.
- [ ] Email confirmations, cancellation alerts, reminders; native push notifications later.
- [ ] Support, disputes, no-shows and admin reconciliation.
**Acceptance:** single and block booking payments, refund and failed-payment flows tested in sandbox.

## Phase 3 — Verification, trust, and ratings (P0 for launch)
- [ ] Implement authorised independent learner provisional licence checking and verified instructor/vehicle/insurance validation.
- [ ] Prevent unverified accounts booking or providing real paid instruction.
- [ ] Link learner-to-instructor 1–5 reviews and instructor-to-learner 1–10 skill assessments to completed authenticated lessons; one submission per party per lesson.
- [ ] Learner rates their own skill only at signup, never after lessons.
- [ ] Once first instructor score is submitted, learner displayed skill becomes the arithmetic average of instructor assessments only (retain original signup value for provenance); label score source/count.
- [ ] Review moderation, reporting, abuse prevention, safeguarding and privacy.
**Acceptance:** nobody can rate a lesson they did not complete or edit their own verification/skill assessment as another role.

## Phase 4 — Retention and instructor productivity (P1)
- [ ] Rebook instructor, repeat weekly block packages, rescheduling, saved preferences.
- [ ] Waitlist for fully booked days, cancellation slot alerts and optional instructor calendar sync.
- [ ] Automated instructor diary-gap prompts and reliable travel buffers.
- [ ] Lesson notes, driving skill milestones, learner progress; don't conflate skill scores with DVSA test readiness.
- [ ] Private messages and customer support escalation.

## Phase 5 — App Store and Google Play launch (P1)
- [ ] Native shell (e.g. Capacitor), mobile QA, accessibility, location permission flow and notification opt-in.
- [ ] Apple TestFlight and Google Play closed testing.
- [ ] Privacy policy, data removal, demo credentials for app reviewers, app-store assets, bug/performance testing.
- [ ] Launch only after a functional production booking and verification system exists.

## Progress note (13 November 2026)
The instructor availability diary, learner three-way slot browser and block-booking demo UI are now built. They are local-only prototypes, **not** live marketplace inventory. The next milestone is the shared authenticated database and truly atomic reservation holds.

## Important sequencing
1. **Build schedule demo UI first** to validate instructor weekly hours and learner one-off/block booking navigation.
2. **Connect secure multi-user database and slot reservation engine** before any availability is claimed as live.
3. Add **block booking series hold/confirmation**, including alternate-slot selection and pricing clarity.
4. Implement verified paid transactions, completion rules and trusted reviews before public launch.

## Key product questions to resolve before backend implementation
- Should block bookings include only a fixed recurring time or allow an arbitrary set of dates? **Recommendation: both**, prioritise recurring first.
- Should block booking include discounts? **Recommendation: optional instructor-controlled offers**, not essential for first release.
- Which durations/counts? **Provisional start: 5 or 10 lessons, 60/90/120 minutes**; validate with real instructors.
- Does booking confirm instantly or await acceptance? **Recommendation: instructor opted-in instant confirmation, otherwise explicit request/acceptance with expiry**.
- How are no-shows, unused block sessions, reschedules and refunds handled?

## Pilot success measurements
- Verified instructors, weekly available inventory, blocks with enough available slots.
- Search-to-booking conversion and time to confirmation; attempted double-bookings (zero successful).
- Block completion/rebooking, payment/refund failure rates, cancellation/no-show rates.
- Instructor utilisation and repeat learner booking rates.
