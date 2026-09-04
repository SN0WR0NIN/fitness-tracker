import Link from 'next/link';
import { BadgeCheck, Bike, Footprints, Medal, ShieldCheck, Sparkles, Users, Waves } from 'lucide-react';
import Navbar from '@/components/Navbar';
import HeroAtmosphere from '@/components/HeroAtmosphere';
import { getChallengeSettings } from '@/lib/admin-control';

export const dynamic = 'force-dynamic';

function getDaysRemaining(endDate: Date) {
  return Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86_400_000));
}

export default async function RulesPage() {
  const settings = await getChallengeSettings();
  const rules = settings.scoringRules;
  const daysRemaining = getDaysRemaining(settings.endDate);
  const formatDate = (date: Date) => date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main>
        <section className="hero-stage border-b border-white/10 bg-slate-950">
          <HeroAtmosphere />
          <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_auto] lg:px-8 lg:py-20">
            <div>
              <p className="hero-reveal text-xs font-black uppercase tracking-[0.22em] text-lime-300">The official playbook</p>
              <h1 className="athletic-display hero-reveal hero-reveal-delay-1 mt-5 text-6xl leading-[0.88] sm:text-8xl">Know the rules.<br /><span className="text-orange-400">Own the race.</span></h1>
              <p className="hero-reveal hero-reveal-delay-2 mt-6 max-w-2xl leading-7 text-slate-400">Every activity earns points from distance, pace, and verified bonuses. These values always reflect the live challenge settings.</p>
            </div>
            <div className="hero-reveal hero-reveal-delay-2 grid min-w-64 grid-cols-2 gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
              <div><p className="text-xs uppercase tracking-wider text-slate-500">Starts</p><p className="mt-2 font-black">{formatDate(settings.startDate)}</p></div>
              <div><p className="text-xs uppercase tracking-wider text-slate-500">Ends</p><p className="mt-2 font-black">{formatDate(settings.endDate)}</p></div>
              <div className="col-span-2 mt-2 border-t border-white/10 pt-4"><p className="athletic-display text-5xl text-lime-300">{daysRemaining}</p><p className="text-xs uppercase tracking-[0.18em] text-slate-500">days remaining</p></div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <section>
            <SectionTitle icon={<Sparkles />} title="Scoring at a glance" />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <RuleCard icon={<Footprints />} tone="text-lime-300 bg-lime-300/10" title="Running" score={`${rules.runBasePerKm} pt / km base`} detail={`Pace bonuses: +${rules.runFastBonusPerKm}/km below ${rules.runFastPaceThreshold}:00, +${rules.runMediumBonusPerKm}/km below ${rules.runMediumPaceThreshold}:00, and +${rules.runStandardBonusPerKm}/km up to ${rules.runSlowPaceThreshold}:00.`} />
              <RuleCard icon={<Bike />} tone="text-cyan-300 bg-cyan-300/10" title="Cycling" score={`1 pt / ${rules.cycleKmPerPoint} km`} detail="Road, mountain, and indoor rides are accepted with clear activity evidence." />
              <RuleCard icon={<Waves />} tone="text-violet-300 bg-violet-300/10" title="Swimming" score={`1 pt / ${rules.swimMetersPerPoint} m`} detail="Pool, open-water, and triathlon swim legs all count." />
              <RuleCard icon={<Footprints />} tone="text-orange-300 bg-orange-300/10" title="Walking / hiking" score={`${rules.walkPointsPerKm} pt / km`} detail={`A minimum distance of ${rules.walkMinimumKm} km is required for points.`} />
            </div>
          </section>

          <section>
            <SectionTitle icon={<Medal />} title="Bonus points" />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <RuleCard icon={<Users />} tone="text-fuchsia-300 bg-fuchsia-300/10" title="With a friend" score={`+${rules.friendBonus} pts`} detail="Choose a registered participant who completed the same activity. Both participants should log it." />
              <RuleCard icon={<Medal />} tone="text-yellow-300 bg-yellow-300/10" title="Troop activity / games" score={`+${rules.troopGamePoints} pts`} detail="Official group physical activities and organised sports games count as one session." />
            </div>
          </section>

          <section>
            <SectionTitle icon={<ShieldCheck />} title="Proof requirements" />
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
              {['Show the activity date, distance, and your name or profile.', 'Submit evidence from the day the activity occurred.', 'Strava, Garmin Connect, Apple Fitness, Google Fit, and Polar screenshots are accepted.', 'Running evidence should include pace so the correct pace band can be verified.', 'Points are added only after an administrator approves the submission.'].map((requirement, index) => (
                <div key={requirement} className="flex gap-4 border-b border-white/5 px-5 py-4 last:border-0"><span className="font-black text-lime-300">{String(index + 1).padStart(2, '0')}</span><p className="text-sm leading-6 text-slate-300">{requirement}</p></div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-lime-300/20 bg-lime-300/[0.06] p-7 text-center">
            <BadgeCheck className="mx-auto h-8 w-8 text-lime-300" />
            <h2 className="athletic-display mt-4 text-3xl">Ready to earn points?</h2>
            <p className="mt-2 text-sm text-slate-400">Log an activity and start climbing the live leaderboard.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/activities/new" className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-black transition hover:bg-orange-400">Log activity</Link><Link href="/leaderboard" className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black transition hover:bg-white/10">View leaderboard</Link></div>
          </section>
        </div>
      </main>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <div className="flex items-center gap-3 border-b border-white/10 pb-3"><span className="text-lime-300 [&>svg]:h-5 [&>svg]:w-5">{icon}</span><h2 className="athletic-display text-2xl">{title}</h2></div>;
}

function RuleCard({ icon, tone, title, score, detail }: { icon: React.ReactNode; tone: string; title: string; score: string; detail: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-1 hover:border-white/20"><div className="flex items-start justify-between gap-4"><span className={`rounded-xl p-2.5 [&>svg]:h-5 [&>svg]:w-5 ${tone}`}>{icon}</span><span className="font-black text-lime-300">{score}</span></div><h3 className="mt-5 text-lg font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p></div>;
}
