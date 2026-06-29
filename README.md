# Integral Revenue Management

Digital shift reports, QR-code ticket check-in/check-out, and a centralized revenue dashboard
for parking garages — built the same way as Integral Valet: Next.js + Postgres + Vercel,
wrapped in Capacitor for Android/iOS.

## Roles
- **Super Admin** — full platform control, including creating Admin accounts
- **Admin** — manages garages and Garage Managers, cannot create other Admins
- **Garage Manager** — scoped to one garage, creates Employee accounts, sees that garage's reports
- **Employee** — scoped to one garage, checks vehicles in/out and submits their own shift reports

## What's built

### Ticketing (check-in / check-out)
- Check in a vehicle: optional unit number, vehicle make/model/color/plate, parking location
- Generates a sequential ticket number and a QR code, ready to print (2 copies — customer +
  garage) on any printer reachable through your browser's print dialog
- Check out: scan the QR code with a **handheld USB/Bluetooth scanner** (these work as
  keyboard-emulation devices — no special integration needed, just an always-focused text
  field) or type the ticket number by hand
- Duration and fee are calculated automatically from the garage's hourly rate (billed by the
  hour, rounded up)
- Every completed transaction is **automatically linked to that employee's shift report for
  the day** — the report's cash/credit card revenue updates itself, no manual re-entry
- An "Active Tickets" view shows every vehicle currently parked, with the ability to cancel a
  mistaken check-in

### Digital shift reports
- Fillable on any device, with live-calculated gross/net totals
- Each report shows its linked ticket transactions (ticket number, amount, unit number)
- Submitting locks the report permanently — only Super Admin/Admin can still correct it after
  the fact

### Central Revenue dashboard
- Super Admin/Admin filter by garage, employee, and date range
- Aggregate totals and CSV export

### Garages & Users
- Add/remove garage locations, set the hourly parking rate used in fee calculation
- Role-scoped account creation at every level

## What's intentionally generic right now — needs your input to finish

**Credit card processing**: card payments are currently just *recorded* (payment method +
optional note) rather than actually *processed* through a payment gateway. Real card processing
needs:
1. A merchant account with a processor (Stripe and Square are the common choices — Stripe
   Terminal or Square's hardware both support physical card readers for in-person/garage use)
2. A business account with that processor (separate signup, like the Apple/Google developer
   accounts we set up for Integral Valet)
3. Either a physical card reader (tap/swipe/chip) connected via their SDK, or — if you're
   actually using a separate freestanding card terminal at the garage already — this app can
   simply keep recording the outcome like it does now, with no processor integration needed at
   all

Let me know which situation you're in and we'll wire up the real integration.

**Thermal printing**: the "print" button opens your browser's normal print dialog, styled to
fit an 80mm thermal receipt width. This works directly if your thermal printer is set up as a
regular system printer (most USB and many network thermal printers support this via a driver).
If you're using a printer that only accepts raw ESC/POS commands with no driver, that needs a
small native bridge — let me know what printer model you have and I'll figure out the right
approach.

## Local setup
```bash
npm install
cp .env.example .env
npx prisma db push
npm run db:seed
npm run dev
```

Demo accounts (after seeding):

| Role | Username | Password |
|---|---|---|
| Super Admin | superadmin | superadmin123 |
| Admin | admin | admin123 |
| Garage Manager | manager | manager123 |
| Employee | employee | employee123 |

## Deployment
Same process as Integral Valet:
1. Push this folder to its own GitHub repo
2. Import into Vercel
3. Add a Postgres database (Neon recommended) and set `DATABASE_URL` + `JWT_SECRET` as
   environment variables in Vercel
4. Run `npx prisma db push` and `npm run db:seed` once against the production database
5. For Android/iOS, set up a Capacitor wrapper project pointing at the live URL, same as we did
   for Integral Valet

## Design notes / assumptions made
- **Net total** = gross total minus an optional "Adjustments" field (refunds, cash drawer
  shortages, etc.)
- **Fee calculation** bills by the hour, rounded up (61 minutes = 2 hours billed). Let me know
  if your actual pricing model is different (per-minute, grace period, daily max, etc.) and
  I'll adjust the formula.
- **Ticket numbers** are sequential per garage (0001, 0002, ...) — short and easy to read on a
  printed receipt or hand-typed at checkout. The QR code itself encodes a separate, longer,
  unguessable token so tickets can't be spoofed by guessing numbers.
- Submitted shift reports can still be corrected by Super Admin/Admin — useful for fixing a
  genuine data-entry mistake without removing the lock protection for everyone else.

