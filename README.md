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
- **Authentication:** NextAuth.js (configured)
- **External APIs:** Strava OAuth
- **File Storage:** AWS S3 (configured)
- **Validation:** Zod

## Getting Started

### Prerequisites

- Node.js 18+ and npm
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
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your_secret_key_here"
   AWS_REGION="us-east-1"
   AWS_ACCESS_KEY_ID="your_aws_access_key"
   AWS_SECRET_ACCESS_KEY="your_aws_secret_key"
   AWS_S3_BUCKET_NAME="fitness-tracker-uploads"
   ```

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
