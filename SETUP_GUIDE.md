# Fitness Tracker - Setup Guide

Congratulations! Your fitness tracking app has been scaffolded successfully. Follow these steps to get it running on your local machine.

## ✅ Completed Steps

- ✅ Next.js project structure created
- ✅ Prisma ORM configured
- ✅ Database schema designed
- ✅ API routes created (activities, leaderboards, Strava auth)
- ✅ UI pages built (home, dashboard, leaderboard, activity form)
- ✅ Scoring algorithm implemented
- ✅ Project builds successfully

## 🚀 Next Steps to Run the App

### Step 1: Set Up PostgreSQL Database

You need a PostgreSQL database running locally or in the cloud.

**Option A: Local PostgreSQL**
```bash
# On Windows (using PostgreSQL installer or Chocolatey):
choco install postgresql
# Then create a database:
psql -U postgres
# In psql:
CREATE DATABASE fitness_tracker;
```

**Option B: Cloud PostgreSQL (Recommended)**
- **Supabase:** https://supabase.com (free tier available)
- **Railway:** https://railway.app
- **Vercel Postgres:** https://vercel.com/postgres
- **Render:** https://render.com

### Step 2: Update Environment Variables

Edit `.env.local` with your actual database URL:

```
DATABASE_URL="postgresql://username:password@localhost:5432/fitness_tracker"
```

For Supabase, it looks like:
```
DATABASE_URL="postgresql://[user]:[password]@[host]:5432/[database]"
```

### Step 3: Initialize Database

Run Prisma migrations to create tables:

```bash
npx prisma db push
```

You can also view your database with:
```bash
npx prisma studio
```

### Step 4: (Optional) Configure Strava Integration

To enable automatic Strava activity syncing:

1. Visit https://www.strava.com/settings/api
2. Register your application
3. Note your **Client ID** and **Client Secret**
4. Set in `.env.local`:
   ```
   STRAVA_CLIENT_ID="your_client_id"
   STRAVA_CLIENT_SECRET="your_client_secret"
   ```

### Step 5: (Optional) Configure AWS S3

For screenshot uploads:

1. Create AWS S3 bucket
2. Generate access keys
3. Set in `.env.local`:
   ```
   AWS_ACCESS_KEY_ID="your_key"
   AWS_SECRET_ACCESS_KEY="your_secret"
   AWS_S3_BUCKET_NAME="fitness-tracker-uploads"
   ```

### Step 6: Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📊 Testing the App

### Create Test Data

1. Click "Log Activity" on the home page
2. Fill in the form with sample data:
   - Category: Run
   - Distance: 5
   - Pace: 6
   - With friend: Yes
3. Click "Log Activity"
4. Check the dashboard to see your logged activities

### View Leaderboards

- Go to /leaderboard
- Try switching between Individual and Team views
- Filter by week

## 🔧 Project Structure

```
fitness-tracker/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API routes
│   │   ├── activities/     # Activity pages
│   │   ├── dashboard/      # Dashboard page
│   │   ├── leaderboard/    # Leaderboard page
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Home page
│   ├── lib/
│   │   ├── scoring.ts      # Scoring logic
│   │   └── prisma.ts       # Prisma client
│   └── styles/
│       └── globals.css     # Global styles
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── migrations/         # Database migrations
├── .env.example            # Environment template
├── .env.local              # Local environment (git-ignored)
├── package.json
├── tsconfig.json
├── next.config.ts
└── README.md
```

## 🎯 Key Features Ready to Use

### Activity Logging
- Support for Run, Cycle, Swim, Walk/Hike, Troop Games
- Distance and pace tracking
- Friend/companion logging
- Screenshot proofs

### Scoring System
- **Run:** `distance × (12 - pace) / 2`
- **Cycle:** `distance / 1.7`
- **Swim:** `distance (m) / 50`
- **Hike:** `distance × 1.6`
- **Troop Games:** `5 points`
- **Friend Bonus:** `+1 point`

### Leaderboards
- Individual rankings with category breakdown
- Team/Column rankings with averages
- Weekly and all-time views

## 🔌 API Endpoints

All endpoints return JSON:

```bash
# Log activity
POST /api/activities
{ "category": "RUN", "distance": 5, "pace": 6, "userId": "...", "columnId": "..." }

# Get activities
GET /api/activities?userId=...&weekNumber=1

# Get leaderboards
GET /api/leaderboard?type=individual&weekNumber=1
GET /api/leaderboard?type=team

# Strava OAuth
GET /api/auth/strava
GET /api/auth/strava/callback?code=...
```

## 🚀 Deployment

### Deploy to Vercel (Recommended)

1. Push code to GitHub
2. Visit https://vercel.com
3. Connect your repository
4. Add environment variables in Vercel dashboard
5. Deploy

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### Deploy with Docker

```bash
docker build -t fitness-tracker .
docker run -e DATABASE_URL="..." fitness-tracker
```

## 🐛 Troubleshooting

**Issue:** Database connection fails
- **Solution:** Check `DATABASE_URL` in `.env.local` and verify PostgreSQL is running

**Issue:** Activities not showing
- **Solution:** Ensure demo user and column exist in database

**Issue:** Strava login fails
- **Solution:** Verify Client ID/Secret in `.env.local` and redirect URI is correct

**Issue:** Build fails
- **Solution:** Run `npm install` and `npx prisma db push`

## 📝 Common Tasks

### Add a new user
```bash
npx prisma studio
# Navigate to Users table and insert new record
```

### Create a column/team
```bash
npx prisma studio
# Navigate to Columns table and insert new record
```

### View database
```bash
npx prisma studio
```

### Reset database
```bash
npx prisma migrate reset
```

### Check logs
```bash
tail -f .env.local  # Check environment is loaded
npm run dev         # Check for runtime errors
```

## 📚 Additional Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Strava API Docs](https://developers.strava.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 💡 Next Features to Add

- [ ] User authentication (NextAuth.js)
- [ ] File upload to S3
- [ ] Activity editing/deletion
- [ ] Weekly email reports
- [ ] Mobile app (React Native)
- [ ] Real-time notifications
- [ ] Activity comments/discussion
- [ ] Achievement badges
- [ ] Custom scoring rules per team
- [ ] Export to CSV/PDF

## ❓ Need Help?

1. Check README.md for more info
2. Review API route implementations in `src/app/api/`
3. Check Prisma schema in `prisma/schema.prisma`
4. Check console logs with `npm run dev`
5. Use `npx prisma studio` for database inspection

---

**Happy tracking! 🏃‍♂️🚴‍♂️🏊‍♂️**
