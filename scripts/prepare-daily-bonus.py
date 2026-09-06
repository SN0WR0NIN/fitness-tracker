from pathlib import Path

def edit(path, before, after, count=1):
    p=Path(path); content=p.read_text(); actual=content.count(before)
    if actual != count: raise RuntimeError(f'{path}: expected {count} anchors, got {actual}: {before[:70]}')
    p.write_text(content.replace(before, after))

def between(path,start,end,replacement):
    p=Path(path); t=p.read_text(); assert t.count(start)==1 and t.count(end)==1,path
    a=t.index(start); b=t.index(end,a); p.write_text(t[:a]+replacement+t[b:])

edit('src/lib/scoring.ts',"const friendBonus = input.completedWithFriend ? rules.friendBonus : 0;","// Daily allocation is enforced by planDailyActivityScores in the server ledger.\n  // The standalone calculation represents a maximum eligible estimate only.\n  const friendBonus = input.completedWithFriend && input.category !== 'TROOP_GAMES' && basePoints > 0 ? rules.friendBonus : 0;")
edit('src/lib/scoring.ts','* - Friend bonus: +3pts, only when completed with a verified registered companion.','* - Friend bonus: +3 per participant / Singapore day / eligible sport; maximum 12 across four sports.\n *   No extra bonus for Troop Games, repeated same-sport entries, or extra friends.')

p='src/lib/activity-corrections.ts'
edit(p,"import { randomUUID }", "import { reconcileParticipantScores } from '@/lib/scoring-ledger';\nimport { planDailyActivityScores } from '@/lib/daily-friend-bonus';\nimport { randomUUID }")
edit(p,"const scoring = calculateActivityPoints({ category, distance, pace: proposed.pace ?? undefined, completedWithFriend: Boolean(companion) }, settings.scoringRules);", "const siblings = await tx.activity.findMany({ where: { userId: activity.userId, id: { not: activity.id } } });\n  const candidate = { ...activity, category, distance, pace: proposed.pace, occurredAt, completedWithFriend: Boolean(companion) };\n  const scoring = planDailyActivityScores([...siblings, candidate], settings.scoringRules, settings.startDate).find(item => item.activity.id === activity.id)!.scoring;")
edit(p,'DEFAULT_SCORING_RULES, calculateActivityPoints, resolveEffectiveCategory','DEFAULT_SCORING_RULES, resolveEffectiveCategory')
between(p,"      const weeks = [...new Set([activity.weekStart.toISOString(),updated.weekStart.toISOString()])].sort();",'      applied=correctionSnapshot(updated);',"      await reconcileParticipantScores(tx, activity.userId);\n")
edit(p,'      applied=correctionSnapshot(updated);','      applied=correctionSnapshot(await tx.activity.findUniqueOrThrow({where:{id:activity.id}}));')

p='src/lib/duplicate-review.ts'
edit(p,"import { randomUUID }", "import { reconcileParticipantScores, scoringTransaction } from '@/lib/scoring-ledger';\nimport { randomUUID }")
between(p,'const categoryScoreField = {','export function duplicatePairKey','')
between(p,"    if (duplicate.status === 'APPROVED') {",'    const rejectionReason =', '')
edit(p, "    const pairKey = await writeDecision(tx, {\n      firstId: pair.firstId,\n      secondId: pair.secondId,\n      status: 'DUPLICATE',", "    await reconcileParticipantScores(tx, duplicate.userId);\n    const pairKey = await writeDecision(tx, {\n      firstId: pair.firstId,\n      secondId: pair.secondId,\n      status: 'DUPLICATE',")
edit(p, 'return { pairKey, duplicateActivityId: duplicate.id, keptActivityId: kept.id, activity: updated };', 'return { pairKey, duplicateActivityId: duplicate.id, keptActivityId: kept.id, activity: await tx.activity.findUniqueOrThrow({where:{id:updated.id}}) };')
edit(p, 'return prisma.$transaction(async (tx: Prisma.TransactionClient) => {','return scoringTransaction(async (tx: Prisma.TransactionClient) => {',2)
edit(p, "  }, { isolationLevel: 'Serializable' });", '  });',2)

p='src/lib/historical-import-writer.ts'
edit(p,"import { randomUUID }", "import { reconcileParticipantScores } from './scoring-ledger';\nimport { randomUUID }")
edit(p,'  );\n}', '  );\n  for (const userId of [...new Set(rows.map(row => row.userId))].sort()) await reconcileParticipantScores(tx, userId);\n}')
p='src/app/api/admin/import/link/route.ts'
edit(p,"import { resolveActivityFriends }", "import { reconcileParticipantScores } from '@/lib/scoring-ledger';\nimport { resolveActivityFriends }")
edit(p,"      await tx.weeklyScore.deleteMany({ where: { userId: sourceId } });", "      await tx.weeklyScore.deleteMany({ where: { userId: sourceId } });\n      await reconcileParticipantScores(tx, targetId);")

for p in ['src/components/NewActivityForm.tsx','src/components/AdminCreateActivityForm.tsx']:
    edit(p,"'use client';", "'use client';\nimport { useDailyFriendBonus } from '@/components/useDailyFriendBonus';")
    edit(p,'  const effectiveCategory = resolveEffectiveCategory(category, paceNumber, scoringRules);', '  const effectiveCategory = resolveEffectiveCategory(category, paceNumber, scoringRules);\n  const dailyBonus = useDailyFriendBonus(userId, activityDate, effectiveCategory);')
p='src/components/NewActivityForm.tsx'
edit(p,'completedWithFriend: withFriend && companionUserIds.length > 0,','completedWithFriend: withFriend && companionUserIds.length > 0 && dailyBonus.available,')
edit(p,'withFriend, companionUserIds, scoringRules]);','withFriend, companionUserIds, scoringRules, dailyBonus.available]);')
edit(p,'The official ${scoringRules.friendBonus}-point bonus is awarded once per activity.','The ${scoringRules.friendBonus}-point bonus is awarded once per sport per Singapore day, up to ${4 * scoringRules.friendBonus} points across four sports.')
edit(p,'          <FormSection number="4" title="Attach proof"','          {withFriend ? <p role="status" className="text-sm text-sky-200">{dailyBonus.message}</p> : null}\n          <FormSection number="4" title="Attach proof"')
p='src/components/AdminCreateActivityForm.tsx'
edit(p,'completedWithFriend: companionUserIds.length > 0,','completedWithFriend: companionUserIds.length > 0 && dailyBonus.available,')
edit(p,'paceNumber, companionUserIds, scoringRules]);','paceNumber, companionUserIds, scoringRules, dailyBonus.available]);')
edit(p,'disabled={submitting || uploading || !userId} />','disabled={submitting || uploading || !userId} />\n          {companionUserIds.length ? <p role="status" className="text-sm text-sky-200">{dailyBonus.message}</p> : null}')
p='src/components/FriendMultiSelect.tsx'
edit(p,'The friend bonus is awarded once per activity, not per person.','The friend bonus is awarded once per sport per Singapore day, not per entry or per person. Troop Games has no friend bonus.')
p='src/app/rules/page.tsx'
edit(p,'Choose a registered participant who completed the same activity. Both participants should log it.','Select the registered friends who joined you. Earn the friend bonus once per sport per Singapore calendar day: running, cycling, swimming and walking/hiking. Repeated same-sport entries and additional friends do not add another bonus. Each participant must log their own activity. Troop Games has no friend bonus.')
p='MULTIPLE_FRIENDS.md'
edit(p,'An activity earns the configured friend bonus once, never once per friend.', 'The configured friend bonus is earned once per participant, Singapore calendar day and eligible sport (Run, Cycle, Swim, Walk/Hike). With the current +3 setting, the maximum daily bonus is +12. It is never paid again for a repeated sport, extra friends or Troop Games.')
p='scripts/recompute-scores.js'
f=Path(p); t=f.read_text();
if t.startswith('#!'): a,b=t.split('\n',1); t=a+'\n'+"throw new Error('Retired per-entry scoring script. Use Admin Settings & scoring: Recalculate with the daily-bonus ledger.');\n"+b
else: t="throw new Error('Retired per-entry scoring script. Use Admin Settings & scoring: Recalculate with the daily-bonus ledger.');\n"+t
f.write_text(t)
p='.github/workflows/e2e.yml'
edit(p,'src/lib/friend-selection.ts src/lib/activity-friends.ts src/components/FriendMultiSelect.tsx','src/lib/friend-selection.ts src/lib/activity-friends.ts src/components/FriendMultiSelect.tsx src/lib/daily-friend-bonus.ts src/lib/scoring-ledger.ts src/lib/activities.ts src/components/useDailyFriendBonus.ts src/app/api/activities/friend-bonus/route.ts')
