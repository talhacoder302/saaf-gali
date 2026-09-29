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

   Optional (the app runs without them, the feature is just switched off):

   | Feature | Variables |
   | --- | --- |
   | Photo uploads (Cloudflare R2) | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` |
   | Email (Resend) | `RESEND_API_KEY`, `EMAIL_FROM` |
   | Web push | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (generate keys with `npx web-push generate-vapid-keys`) |

   `MONGODB_DB_NAME` defaults to `saaf_gali`.

3. In Atlas, allow your IP address under **Network Access**.

4. Seed the database (creates the `saaf_gali` database with default settings; later modules add demo data):

   ```bash
   npm run seed
   ```

5. Start the dev server:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

## Useful URLs

| URL | What |
| --- | --- |
| `/` | Landing page |
| `/login` | Login (placeholder until the auth module) |
| `/admin` | Admin panel shell |
| `/supervisor`, `/worker`, `/resident` | Mobile shells with bottom navigation |
| `/api/health` | JSON health check: database status and which optional features are on |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run seed` | Seed the database using `.env.local` |

## Deploying to Hostinger (Node.js hosting)

1. Push to GitHub and connect the repo in hPanel (or upload the files).
2. Build command: `npm run build`. Start command: `npm start`.
3. Add the same environment variables as `.env.local` in hPanel, plus `AUTH_TRUST_HOST=true` and `AUTH_URL` set to your domain.
4. In Atlas, allow the Hostinger server IP under Network Access.

## Project notes

See [CLAUDE.md](CLAUDE.md) for folder rules, the data model and coding conventions.
