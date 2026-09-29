@AGENTS.md

# Saaf Gali

A web app to manage street cleaning (gali ki safai) teams in Rawalpindi and Islamabad. One Next.js project handles both frontend and backend. The app is built in modules; see "Module log" at the bottom for what exists so far.

## Big picture

- Areas are divided into Blocks and Streets (galiyan). Each street has Households (ghar).
- Area Managers and Supervisors are assigned to areas. Workers (safai walay) are assigned duties on streets.
- Workers prove work with before/after photos + GPS + time.
- Every household pays a monthly fee (Rs.100, 150 or custom). We track paid, pending, defaulters, advance payments and total monthly collection.
- We track expenses (supplies, repairs, salaries) and show a transparent public "hisaab" per area.
- Residents can file complaints with photos.
- Notifications: in-app, email (Resend), web push, and WhatsApp share links (wa.me, no paid API).

## Tech stack (use exactly this)

- Next.js 16 (App Router, `src/` directory) + TypeScript strict. Next 16 has breaking changes: read `node_modules/next/dist/docs/` before using an API you are unsure about (e.g. `middleware` is now `proxy`, error boundaries get `retry`, request APIs are async).
- Tailwind CSS v4 + shadcn/ui + lucide-react
- MongoDB Atlas + Mongoose (cached global connection in `src/lib/db.ts`)
- Auth.js (NextAuth v5), Credentials provider: login with mobile number + password, bcrypt hashing (`bcryptjs`, pure JS so it installs on Hostinger), JWT sessions with `role` and `areaIds` in the token
- Zod + React Hook Form
- TanStack Table, Recharts, date-fns (+ `@date-fns/tz` for Asia/Karachi)
- Cloudflare R2 via `@aws-sdk/client-s3` + pre-signed URLs; `browser-image-compression` before upload
- Resend + React Email; `web-push` (VAPID) for push notifications
- `@react-pdf/renderer` for receipts and reports; SheetJS (`xlsx`, installed from the SheetJS CDN tarball) for Excel import/export
- Serwist for PWA (added in a later module)
- next-intl with two languages: English (`en`) and Urdu (`ur`, RTL, Noto Nastaliq Urdu font). No locale in the URL; the choice is stored in the `NEXT_LOCALE` cookie. Admin screens default to English; worker and resident screens must have both languages.
- npm as package manager (the app deploys to Hostinger Node.js hosting)

## Folder rules

| Folder | What goes there |
| --- | --- |
| `src/app/(public)` | Public pages (landing, public hisaab) |
| `src/app/(auth)` | Login, forgot password |
| `src/app/admin` | Super admin + area manager |
| `src/app/supervisor` | Supervisor screens (mobile-first) |
| `src/app/worker` | Worker screens (mobile-first, big buttons, icons) |
| `src/app/resident` | Resident portal (mobile-first) |
| `src/app/api` | Route handlers (thin: validate, call a service, return) |
| `src/server` | All business logic as services. Database queries live ONLY here. |
| `src/models` | Mongoose models |
| `src/lib` | db, env, auth helpers, formatting and other utils |
| `src/components/ui` | shadcn/ui components (generated, edit with care) |
| `src/components/shared` | Components used by more than one role |
| `src/components/{admin,supervisor,worker,resident}` | Role-specific components |
| `src/i18n` | next-intl config and messages (`en.json`, `ur.json`) |
| `scripts` | Seed and utility scripts (run with `tsx`) |

- Pages and components never import from `src/models` directly. They call `src/server` services through Server Actions or route handlers.
- Scripts in `scripts/` may use models directly (they run outside a request, with no session).
- Pages never call email or push directly. Always go through `notify()` in `src/server/notify.ts`.
- `src/lib/env.ts` is the only place that reads `process.env` on the server. Check `features.storage`, `features.email` and `features.push` before using R2, Resend or web push; those features must degrade gracefully when keys are missing.
- Every user-facing string lives in `src/i18n/en.json` and `src/i18n/ur.json`. Add both when adding a key.
- Use logical Tailwind classes (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `border-s`, `text-start`) so layouts flip correctly in Urdu RTL.

## Data model

Later modules implement these models in `src/models`.

- **User**: name, mobile (unique, Pakistani format 03XXXXXXXXX), email (optional), passwordHash, role (super_admin | area_manager | supervisor | worker | resident | committee), areaIds[], householdId (for residents), language (en | ur), status (active | disabled), pushSubscriptions[], lastLoginAt
- **Area**: name, city (Rawalpindi | Islamabad), description, managerIds[], supervisorIds[], committeeIds[], defaultMonthlyFee, status
- **Block**: areaId, name
- **Street**: areaId, blockId, name, location {lat, lng} optional, supervisorId
- **Household**: areaId, blockId, streetId, houseNumber, ownerName, occupantType (owner | tenant), contactName, mobile, email, monthlyFee, status (active | vacant | exempt), notes. Unique index on (streetId, houseNumber).
- **Worker**: userId (optional, if they have a phone), name, mobile, cnic, address, monthlySalary, joiningDate, areaIds[], status
- **Duty**: workerId, streetId, areaId, date, shift (morning | evening), status (scheduled | in_progress | completed | missed | reassigned), reassignedTo
- **WorkLog**: dutyId, workerId, streetId, startPhotoUrl, endPhotoUrl, startAt, endAt, startLocation, endLocation, supervisorStatus (pending | approved | redo), supervisorNote
- **Complaint**: householdId, areaId, streetId, raisedBy, category (garbage | drain | sweeping | other), description, photoUrls[], status (new | assigned | resolved | confirmed | reopened), assignedTo, resolvedAt, resolutionPhotoUrl, rating
- **FeeBill**: householdId, areaId, streetId, month ("YYYY-MM"), amount, paidAmount, status (unpaid | partial | paid | exempt). Unique index on (householdId, month).
- **Payment**: householdId, billIds[], amount, method (cash | bank | jazzcash | easypaisa), receivedBy, receiptNumber (unique, sequential per area), paidAt, monthsCovered[]
- **Expense**: areaId, category (supplies | repair | fuel | salary | transport | misc), description, amount, date, receiptPhotoUrl, createdBy, approvalStatus (auto | pending | approved | rejected), approvedBy
- **Salary**: workerId, month, baseSalary, daysPresent, deductions, advances, netPaid, paidAt, expenseId
- **Advance**: workerId, amount, date, note, recoveredInMonth
- **Notification**: userId, type, title, body, link, read, channelsSent[]
- **ActivityLog**: actorId, areaId, action, entity, entityId, meta
- **Settings**: singleton; organisation name, logo, receipt prefix, fee due day, expense approval limit (above this amount needs committee approval), currency PKR

## Coding rules

- Money is stored as whole rupees (integers). Timezone is Asia/Karachi for all dates and months (helpers in `src/lib/format.ts`).
- All database access happens in `src/server` services. Pages and components call services through Server Actions or route handlers.
- Every server function checks the session, the role and the user's areaIds. A supervisor or resident must never see another area's data. Enforce this in the query, not only in the UI.
- Validate every input with Zod.
- No `any` types. Reusable components. Loading skeletons, empty states and error messages on every page.
- Mobile-first for worker, supervisor and resident screens. Test at 375px width.
- Write an ActivityLog entry for every create, update, delete, approve and payment action.
- Keep `scripts/seed.ts` updated with realistic demo data for each module (Pakistani names, Rawalpindi/Islamabad areas like Satellite Town, Bahria Town Phase 4, G-11, I-8).

## Commit rules

- Commit messages must read like a normal developer wrote them: short, plain English, sentence case, varied wording.
  Good examples: "Setup completed", "Login is working now", "Added areas and streets pages", "Fixed fee total on dashboard", "Receipts now download as PDF", "Cleaned up household form".
- Do NOT use prefixes like feat:, fix:, chore:, core:. No emojis. No Co-Authored-By or other trailers.
- Make several small commits per module (one per meaningful piece of work), not one giant commit.
- Push to origin main at the end of each module.
- Never commit `.env.local` or any secret. Check staged files before every commit.

## Definition of done for every module

- `npm run lint`, `npx tsc --noEmit` and `npm run build` all pass with zero errors.
- Seed data updated and working.
- CLAUDE.md updated with anything new.
- Commits pushed.
- Give a short summary: what was built, how to test it in the browser, and anything the owner needs to do.

## Gotchas

- Layouts type `children` explicitly (`{ children: React.ReactNode }`) instead of Next's generated `LayoutProps`, so `npx tsc --noEmit` works on a fresh clone without a build first.
- shadcn components import `cn` from the `cn` package; app code imports it from `@/lib/utils`. `form.tsx` came from the `new-york-v4` registry because the new registry replaced `form` with `field`; both are installed.
- Radix direction is set once in `src/components/shared/providers.tsx` (`DirectionProvider`), so menus and sheets open on the correct side in Urdu.
- Error boundaries (`error.tsx`) receive `retry` (Next 16.3), not `reset`.
- Scripts run with `tsx --env-file-if-exists=.env.local`, so they see the same env as the app.
- npm 11 skips some package install scripts (esbuild, @swc/core, unrs-resolver). Everything works without them; do not add `--ignore-scripts` workarounds.

## Module log

### Module 0: setup

- Next.js 16 + Tailwind v4 + shadcn/ui scaffold, all stack libraries installed.
- `src/lib/env.ts` (Zod-validated env, `features` flags), `src/lib/db.ts` (cached Mongoose connection), `src/lib/format.ts` (PKR and Asia/Karachi month helpers), `src/lib/roles.ts` (roles and their home paths).
- `src/server/notify.ts`: `notify()` stub that only logs for now.
- `src/server/health.ts` + `GET /api/health`: reports database status and which optional features are on.
- i18n: `src/i18n/request.ts` reads the `NEXT_LOCALE` cookie; `setLocale` server action in `src/i18n/actions.ts`; `LanguageSwitcher` component.
- App shells: admin sidebar (`src/components/admin/admin-shell.tsx`), bottom nav for worker, supervisor and resident (`src/components/shared/bottom-nav-shell.tsx`). Nav items not built yet show as "Soon".
- Landing page at `/`, placeholder login page at `/login`.
- `src/models/Settings.ts` (singleton) and `scripts/seed.ts`, which creates the `saaf_gali` database with default settings.
