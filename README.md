# Saaf Gali

Street cleaning management for Rawalpindi and Islamabad: areas and streets, workers and duty roster, photo proof of work, monthly household fees, expenses and a transparent public hisaab. English and Urdu.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui, MongoDB Atlas (Mongoose) and next-intl.

## Requirements

- Node.js 20.9 or newer (22 LTS recommended)
- npm
- A MongoDB Atlas cluster (free tier is fine)

## Setup

1. Install packages:

   ```bash
   npm install
   ```

2. Create your env file and fill it in:

   ```bash
   cp .env.example .env.local
   ```

   Required:

   | Variable | What it is |
   | --- | --- |
   | `MONGODB_URI` | Atlas connection string, e.g. `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/` |
   | `AUTH_SECRET` | Random secret for sessions. Generate with `npx auth secret` |
   | `SEED_ADMIN_MOBILE` | Mobile number of the first super admin, e.g. `03001234567` (any format like `+92 300 1234567` works) |
   | `SEED_ADMIN_PASSWORD` | That super admin's password (8 to 72 characters) |

   Optional (the app runs without them, the feature is just switched off):

   | Feature | Variables |
   | --- | --- |
   | Photo uploads (Cloudflare R2) | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` |
   | Email (Resend) | `RESEND_API_KEY`, `EMAIL_FROM` |
   | Web push | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (generate keys with `npx web-push generate-vapid-keys`) |

   `MONGODB_DB_NAME` defaults to `saaf_gali`.

3. In Atlas, allow your IP address under **Network Access**.

4. Seed the database. This creates the `saaf_gali` database, default settings, four demo areas (Satellite Town and G-11 come with blocks and streets), your super admin and some demo users. It is safe to run again; existing users, passwords and your own changes are left alone.

   ```bash
   npm run seed
   ```

   Demo logins (password `Safai@1234` for all of them):

   | Role | Name | Mobile |
   | --- | --- | --- |
   | Area manager | Imran Qureshi (Satellite Town, Bahria Town Phase 4) | 0300-5550101 |
   | Area manager | Sadia Malik (G-11, I-8) | 0321-5550102 |
   | Supervisor | Tariq Mehmood (Satellite Town) | 0333-5550103 |
   | Worker | Muhammad Aslam (Satellite Town) | 0301-5550105 |
   | Resident | Ayesha Siddiqui (Satellite Town) | 0322-5550109 |
   | Committee | Col. (R) Khalid Mahmood (Satellite Town) | 0300-5550112 |

5. Start the dev server:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

## Useful URLs

| URL | What |
| --- | --- |
| `/` | Landing page |
| `/login` | Login with mobile number and password |
| `/admin` | Admin panel (super admin, area manager) |
| `/admin/users` | Users: search, filter, add, edit, disable, reset password |
| `/admin/areas` | Areas: add, edit, archive; open one to manage its blocks, streets and team |
| `/supervisor`, `/worker`, `/resident` | Mobile screens for each role (residents and committee members use `/resident`) |
| `/{role}/profile` | Profile: language, change password, logout |
| `/api/health` | JSON health check: database status and which optional features are on |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm test` | Unit tests (Vitest) |
| `npm run seed` | Seed the database using `.env.local` |

## Deploying to Hostinger (Node.js hosting)

1. Push to GitHub and connect the repo in hPanel (or upload the files).
2. Build command: `npm run build`. Start command: `npm start`.
3. Add the same environment variables as `.env.local` in hPanel, plus `AUTH_TRUST_HOST=true` and `AUTH_URL` set to your domain.
4. In Atlas, allow the Hostinger server IP under Network Access.

## Project notes

See [CLAUDE.md](CLAUDE.md) for folder rules, the data model and coding conventions.
