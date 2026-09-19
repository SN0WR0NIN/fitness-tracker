# Fitness Tracker - Full Stack Application

A comprehensive fitness activity tracking web application built with Next.js, featuring activity logging, Strava integration, and real-time leaderboards with point-based scoring.

## Features

✅ **Activity Logging**
- Support for Run, Cycle, Swim, Walk/Hike, and Troop Games
- Distance, pace, and proof screenshot tracking
- Friend/companion participation tracking

✅ **Smart Scoring System**
- Dynamic point calculation based on activity type and metrics
- Bonus points for group activities
- Weekly and all-time leaderboards

✅ **Strava Integration**
- OAuth authentication with Strava
- Automatic activity synchronization

✅ **Leaderboards**
- Individual rankings with category breakdowns
- Team/Column rankings with average points per member
- Weekly and all-time views

✅ **Responsive UI**
- Built with Tailwind CSS
- Lucide icons for visual consistency
- Mobile-friendly design

## Tech Stack

- **Frontend:** Next.js 16+, React, Tailwind CSS, Lucide Icons
- **Backend:** Next.js API Routes, Node.js
- **Database:** PostgreSQL (Prisma ORM)
- **Authentication:** Clerk shared login
- **External APIs:** Strava OAuth
- **File Storage:** AWS S3 (configured)
- **Validation:** Zod

## Getting Started

### Prerequisites

- Node.js 22+ and npm
- PostgreSQL database
- Strava API credentials (optional but recommended)
- AWS S3 bucket (optional for file uploads)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` with your configuration:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/fitness_tracker"
   STRAVA_CLIENT_ID="your_strava_client_id"
   STRAVA_CLIENT_SECRET="your_strava_client_secret"
   STRAVA_REDIRECT_URI="http://localhost:3000/api/auth/strava/callback"
   STRAVA_INTEGRATION_ENABLED="false"
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
   CLERK_SECRET_KEY="sk_test_..."
   NEXTAUTH_URL="http://localhost:3000"
   AWS_REGION="us-east-1"
   AWS_ACCESS_KEY_ID="your_aws_access_key"
   AWS_SECRET_ACCESS_KEY="your_aws_secret_key"
   AWS_S3_BUCKET_NAME="fitness-tracker-uploads"
   ```

   Clerk provides the shared account used across the KG apps. On Vercel, the Clerk
   Marketplace integration may expose the equivalent prefixed variables
   `NEXT_PUBLIC_AUTHENTICATION_CLERK_PUBLISHABLE_KEY` and
   `AUTHENTICATION_CLERK_SECRET_KEY`; the app supports both names.

   Strava is disabled unless `STRAVA_INTEGRATION_ENABLED` is explicitly set to `true`. This keeps the connection controls and OAuth/sync endpoints unavailable while the Strava athlete limit is restricted.

3. **Set up the database:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open the app:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Clerk E2E configuration

The Stay Active E2E workflow uses a disposable local PostgreSQL database and real
Clerk development sessions. Add these **GitHub Actions repository secrets** from
the same dedicated Clerk development instance (enable email and password login;
do not require username/name fields):

- `E2E_CLERK_PUBLISHABLE_KEY` (`pk_test_...`)
- `E2E_CLERK_SECRET_KEY` (`sk_test_...`)

Do not reuse the shared production instance or its keys. The workflow maps these
secrets to the app's standard Clerk environment variables for both build and
runtime and refuses production keys or non-local databases. Fork PRs do not have
access to secrets; a trusted maintainer must run them from an approved branch.

CI generates a fresh 32-byte `CLERK_ENCRYPTION_KEY` for each job, masks it in
logs, and shares it with subsequent build and runtime steps through `GITHUB_ENV`.
Clerk requires this key because the middleware explicitly supplies `secretKey`
(including support for Vercel Marketplace's prefixed key). No third repository
secret is needed. This ephemeral key is only for CI; deployed environments using
this middleware must configure their own stable `CLERK_ENCRYPTION_KEY`.

Playwright's setup project obtains a Clerk testing token. Each authenticated test
creates uniquely named, synthetic `+clerk_test` users and deletes only the Clerk
IDs it created during teardown. Their verified emails link to existing local
fixtures through the real application code, asserting that IDs and roles survive.
Forced workflow cancellation may interrupt cleanup; any orphaned development
users are tagged `privateMetadata.purpose = fitness-tracker-e2e` for review.
Do not bulk-delete unrelated Clerk users. Browser traces are disabled because
they can contain live session credentials.

`prisma db push` does not create the raw SQL season tables. CI applies
`season-week-finalization.sql`, `finalized-week-guard.sql`, then
`season-week-finalization-security.sql` **after** `scripts/e2e-bootstrap.cjs`
creates/seeds `ChallengeSetting`. `scripts/check-e2e-season.cjs` checks the active
season, finalization table, triggers and RLS before the app starts.

For a merge gate, require the complete workflow to pass, including the repeated
daily-bonus checks, no-retry privacy/recovery check, v7 backup and disposable
restore drill. A successful build or Vercel preview alone does not verify login
or data safety. Cross-app shared-login verification remains a separate release check.

## Scoring Algorithm

Points are calculated based on activity type and metrics:

- **Run:** `distance * (12 - pace) / 2`
- **Cycle:** `distance / 1.7`
- **Swim:** `distance (meters) / 50`
- **Walk/Hike:** `distance * 1.6`
- **Troop Games:** `5 points`
- **Friend Bonus:** `+1 point` for group activities

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── activities/        # Activity logging endpoint
│   │   ├── leaderboard/       # Leaderboard data endpoint
│   │   └── auth/strava/       # Strava OAuth routes
│   ├── activities/            # Activity pages
│   ├── dashboard/             # User dashboard
│   ├── leaderboard/           # Leaderboards page
│   └── page.tsx               # Home page
├── lib/
│   ├── scoring.ts             # Scoring logic
│   └── prisma.ts              # Prisma client
└── styles/                    # Global styles

prisma/
├── schema.prisma              # Database schema
```

## API Routes

- `POST /api/activities` - Create new activity
- `GET /api/activities` - Fetch activities
- `GET /api/leaderboard` - Get leaderboards (individual/team)
- `GET /api/auth/strava` - Initiate Strava OAuth
- `GET /api/auth/strava/callback` - Handle OAuth callback

## Development

```bash
npm run dev      # Development server
npm run build    # Production build
npm start        # Start production server
npm run lint     # Run linter
```

## Deployment

Deploy to [Vercel](https://vercel.com) for the easiest setup:

1. Push to GitHub
2. Connect to Vercel
3. Set environment variables
4. Deploy

## Next Steps

- [ ] Set up PostgreSQL database
- [ ] Configure Strava OAuth credentials
- [ ] Implement file uploads to S3
- [ ] Add authentication with NextAuth.js
- [ ] Import existing data from Google Sheets
- [ ] Deploy to production

## License

MIT
