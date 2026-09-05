import Link from 'next/link';
import { Award, Check, Crown, Medal, Sparkles, Trophy } from 'lucide-react';
import type { ProfileAchievement } from '@/lib/participant-profile';

const categoryOrder: ProfileAchievement['category'][] = ['Milestones', 'Consistency', 'Social', 'Variety', 'Competition'];

const tierStyles = {
  bronze: 'border-orange-400/20 bg-orange-400/8 text-orange-200',
  silver: 'border-slate-300/20 bg-slate-300/8 text-slate-200',
  gold: 'border-yellow-300/25 bg-yellow-300/10 text-yellow-100',
};

const tierIcon = {
  bronze: Medal,
  silver: Award,
  gold: Crown,
};

export default function TrophyCabinet({ achievements, compact = false }: { achievements: ProfileAchievement[]; compact?: boolean }) {
  const unlocked = achievements.filter((achievement) => achievement.unlocked);
  const closest = achievements
    .filter((achievement) => !achievement.unlocked)
    .sort((a, b) => b.progress - a.progress)[0] ?? null;
  const latestUnlocked = [...unlocked].reverse()[0] ?? null;

  if (compact) {
    return (
      <section className="rounded-2xl border border-yellow-300/15 bg-gradient-to-br from-yellow-300/8 via-white/[0.04] to-orange-400/5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-yellow-300/10 p-2.5 text-yellow-300"><Trophy className="h-5 w-5" /></span>
            <div><p className="text-xs font-black uppercase tracking-[0.16em] text-yellow-300">Trophy cabinet</p><h2 className="mt-1 text-xl font-black">{unlocked.length} of {achievements.length} unlocked</h2><p className="mt-1 text-sm text-slate-500">Milestones, consistency, teamwork and competitive achievements.</p></div>
          </div>
          <Link href="/trophies" className="rounded-xl border border-yellow-300/20 px-4 py-2 text-sm font-black text-yellow-200 transition hover:bg-yellow-300/10">Open cabinet</Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {latestUnlocked ? <FeaturedCard eyebrow="Latest unlocked" achievement={latestUnlocked} /> : <EmptyFeature label="Your first trophy appears after an approved activity." />}
          {closest ? <FeaturedCard eyebrow="Closest next" achievement={closest} /> : <EmptyFeature label="Every available trophy is unlocked." />}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-yellow-300/15 bg-[radial-gradient(circle_at_top_left,_rgba(253,224,71,0.14),_transparent_38%),rgba(255,255,255,0.04)] p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-yellow-300"><Sparkles className="h-4 w-4" />Achievement collection</p><h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Trophy Cabinet</h1><p className="mt-3 max-w-2xl text-slate-400">Achievements celebrate consistency and participation without changing leaderboard points.</p></div>
          <div className="rounded-2xl border border-yellow-300/15 bg-slate-950/50 px-5 py-4"><p className="text-xs uppercase tracking-wider text-slate-500">Unlocked</p><p className="mt-1 text-3xl font-black text-yellow-300">{unlocked.length}<span className="text-lg text-slate-500"> / {achievements.length}</span></p></div>
        </div>
      </section>

      {closest ? <section className="rounded-2xl border border-sky-300/15 bg-sky-300/[0.05] p-5"><p className="text-xs font-black uppercase tracking-wider text-sky-300">Closest to unlock</p><div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black">{closest.name}</p><p className="mt-1 text-sm text-slate-400">{closest.description}</p></div><p className="text-sm font-bold text-sky-200">{closest.progressLabel}</p></div><Progress value={closest.progress} /></section> : null}

      {categoryOrder.map((category) => {
        const items = achievements.filter((achievement) => achievement.category === category);
        if (!items.length) return null;
        return <section key={category} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Collection</p><h2 className="mt-1 text-xl font-black">{category}</h2></div><span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-slate-400">{items.filter((item) => item.unlocked).length}/{items.length}</span></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map((achievement) => <TrophyCard key={achievement.name} achievement={achievement} />)}</div></section>;
      })}
    </div>
  );
}

function TrophyCard({ achievement }: { achievement: ProfileAchievement }) {
  const Icon = tierIcon[achievement.tier];
  return <article className={`rounded-2xl border p-4 ${achievement.unlocked ? tierStyles[achievement.tier] : 'border-white/5 bg-black/10 text-slate-400'}`}><div className="flex items-start gap-3"><span className={`rounded-xl p-2.5 ${achievement.unlocked ? 'bg-white/10' : 'bg-white/5 text-slate-600'}`}>{achievement.unlocked ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-black">{achievement.name}</p><span className="rounded-full bg-black/15 px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-wider">{achievement.tier}</span></div><p className="mt-1 text-xs leading-5 opacity-70">{achievement.description}</p><p className="mt-3 text-xs font-bold opacity-80">{achievement.progressLabel}</p>{achievement.unlocked ? null : <Progress value={achievement.progress} />}</div></div></article>;
}

function FeaturedCard({ eyebrow, achievement }: { eyebrow: string; achievement: ProfileAchievement }) {
  return <div className="rounded-xl border border-white/8 bg-black/10 p-4"><p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500">{eyebrow}</p><p className="mt-2 font-black text-slate-100">{achievement.name}</p><p className="mt-1 text-xs text-slate-500">{achievement.progressLabel}</p>{achievement.unlocked ? null : <Progress value={achievement.progress} />}</div>;
}

function EmptyFeature({ label }: { label: string }) {
  return <div className="rounded-xl border border-white/8 bg-black/10 p-4 text-sm text-slate-500">{label}</div>;
}

function Progress({ value }: { value: number }) {
  return <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-yellow-300" style={{ width: `${Math.max(3, Math.min(100, value * 100))}%` }} /></div>;
}
