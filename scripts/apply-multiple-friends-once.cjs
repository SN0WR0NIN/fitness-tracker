// One-use development codemod, restricted to this feature branch. Removed
// before PR/release. Does not connect to any database or deployed application.
const fs = require('node:fs');
const cp = require('node:child_process');
if (process.env.GITHUB_REF !== 'refs/heads/feature/multiple-activity-friends') throw new Error('Wrong branch');
if (cp.execFileSync('git', ['rev-parse', 'HEAD^'], {encoding:'utf8'}).trim() !== '92918d52d29f311ee8d0abb27d1deac4cf902697') throw new Error('Unexpected source revision');
function one(s, from, to) {
  const count = typeof from === 'string' ? s.split(from).length - 1 : [...s.matchAll(new RegExp(from.source, from.flags.replaceAll('g','')+'g'))].length;
  if (count !== 1) throw new Error(`Expected one match (${count}): ${String(from).slice(0,120)}`);
  return s.replace(from, () => to);
}
function all(s, from, to) { if (!s.includes(from)) throw new Error(`Missing ${from}`); return s.replaceAll(from,to); }
function edit(path, fn) { const before=fs.readFileSync(path,'utf8'); const after=fn(before); if(before===after)throw new Error(`No change: ${path}`); fs.writeFileSync(path,after); console.log(path); }
const pickerImport = "import FriendMultiSelect from '@/components/FriendMultiSelect';\n";
const idsImport = "import { activityFriendIds } from '@/lib/friend-selection';\n";
const friendSchema = 'companionUserIds: z.array(z.string().min(1).max(200)).max(100).optional(),';
edit('prisma/schema.prisma', s => one(s,'  companionUserId String?','  companionUserIds String[]   @default([])\n  companionUserId String?'));
edit('src/lib/activities.ts', s => {
  s="import { resolveActivityFriends } from '@/lib/activity-friends';\n"+idsImport+s;
  s=one(s,'  companionUserId?: string;','  companionUserId?: string;\n  companionUserIds?: string[];');
  s=one(s,'  companionUserId?: string | null;','  companionUserId?: string | null;\n  companionUserIds?: string[];');
  s=one(s,/  const completedWithFriend = !!input.companionUserId;[\s\S]*?\n  const scoring/,"  const friends = await resolveActivityFriends(prisma, input.userId, input);\n  const completedWithFriend = friends.completedWithFriend;\n\n  const scoring");
  s=one(s,'      completedWithFriend,\n      companionUserId: input.companionUserId,\n      companion: companionName,','      ...friends,');
  s=one(s,/    let newCompanionUserId = activity.companionUserId;[\s\S]*?\n    const scoring/,`    let newCompanionUserIds = activityFriendIds(activity);
    let newCompanionUserId = activity.companionUserId;
    let newCompanionName = activity.companion;
    let newCompletedWithFriend = activity.completedWithFriend;
    if (input.companionUserIds !== undefined || input.companionUserId !== undefined) {
      const friends = await resolveActivityFriends(tx, activity.userId, input);
      newCompanionUserIds = friends.companionUserIds;
      newCompanionUserId = friends.companionUserId;
      newCompanionName = friends.companion;
      newCompletedWithFriend = friends.completedWithFriend;
    } else if (input.companionName !== undefined) {
      const trimmed = input.companionName?.trim() || null;
      newCompanionUserIds = [];
      newCompanionUserId = null;
      newCompanionName = trimmed;
      newCompletedWithFriend = !!trimmed;
    }

    const scoring`);
  return one(s,'        companionUserId: newCompanionUserId,','        companionUserIds: newCompanionUserIds,\n        companionUserId: newCompanionUserId,');
});
for (const path of ['src/app/api/activities/route.ts','src/app/api/admin/activities/create/route.ts','src/app/api/admin/activities/[id]/route.ts','src/app/api/activities/[id]/route.ts']) {
  edit(path, s => {
    s=one(s,/companionUserId:\s*z\./, friendSchema+'\n  companionUserId: z.');
    if(path==='src/app/api/activities/route.ts') s=one(s,'      companionUserId: validatedData.companionUserId,','      companionUserId: validatedData.companionUserId,\n      companionUserIds: validatedData.companionUserIds,');
    if(path==='src/app/api/admin/activities/create/route.ts') {
      s=one(s,'      companionUserId: data.companionUserId,','      companionUserId: data.companionUserId,\n      companionUserIds: data.companionUserIds,');
      s=one(s,'      requestedStatus: data.approvalMode,','      requestedStatus: data.approvalMode,\n      companionUserIds: created.companionUserIds,');
    }
    if (!s.includes('ActivityEditError')) {
      s="import { ActivityEditError } from '@/lib/activity-duplicates';\n"+s;
      s=one(s,'    if (error instanceof ZodError)',"    if (error instanceof ActivityEditError) return NextResponse.json({ error: error.message }, { status: error.status });\n    if (error instanceof ZodError)");
    }
    return s;
  });
}
edit('src/lib/activity-corrections.ts', s => {
  s="import { resolveActivityFriends } from '@/lib/activity-friends';\nimport { activityFriendIds, sameFriendSelection } from '@/lib/friend-selection';\n"+s;
  s=one(s,'  companionUserId: z.string().min(1).nullable(),','  companionUserId: z.string().min(1).nullable(),\n  '+friendSchema);
  s=one(s,'companionUserId: activity.companionUserId, proofUrl: activity.proofUrl,','companionUserId: activity.companionUserId, companionUserIds: activityFriendIds(activity), proofUrl: activity.proofUrl,');
  s=one(s,/  if \(proposed.companionUserId === activity.userId\)[\s\S]*?\n  const category/,`  const friends = await resolveActivityFriends(tx, activity.userId, proposed);
  let companion = friends.companion;
  if (!friends.companionUserIds.length && !activity.companionUserId && activity.companion && activity.completedWithFriend) {
    // Retain the existing admin-verified manual companion, as before. Members
    // cannot manufacture a manual bonus by supplying a free-text name.
    companion = activity.companion;
  }
  const category`);
  s=one(s,'companionUserId: proposed.companionUserId, companion, completedWithFriend: Boolean(companion)','companionUserId: friends.companionUserId, companionUserIds: friends.companionUserIds, companion, completedWithFriend: Boolean(companion)');
  s=one(s,'const unchanged = Object.entries(values).every(([key,value]) => original[key as keyof CorrectionSnapshot] === value);',"const unchanged = Object.entries(values).filter(([key]) => !['companionUserId','companionUserIds'].includes(key)).every(([key,value]) => original[key as keyof CorrectionSnapshot] === value) && sameFriendSelection(original, values);");
  return one(s,'companionUserId:raw.companionUserId,proofUrl:raw.proofUrl','companionUserId:raw.companionUserId,companionUserIds:raw.companionUserIds,proofUrl:raw.proofUrl');
});
edit('src/lib/feature-response.ts', s => {
  s="import { ActivityEditError } from '@/lib/activity-duplicates';\n"+s;
  return one(s,'export function featureErrorResponse(error: unknown) {',"export function featureErrorResponse(error: unknown) {\n  if (error instanceof ActivityEditError) return NextResponse.json({error:error.message},{status:error.status});");
});
edit('src/components/NewActivityForm.tsx', s => {
  s=one(s,"'use client';", "'use client';\n"+pickerImport);
  s=all(s,'companionUserId','companionUserIds');
  s=all(s,'setCompanionUserId','setCompanionUserIds');
  s=one(s,'companionUserIds: string;','companionUserIds: string[]; companionUserId?: string;');
  s=one(s,'companionUserIds?: string;','companionUserIds?: string[]; companionUserId?: string;');
  s=one(s,"const [companionUserIds, setCompanionUserIds] = useState('');","const [companionUserIds, setCompanionUserIds] = useState<string[]>([]);");
  s=one(s,"setCompanionUserIds(draft.companionUserIds || '');","setCompanionUserIds(Array.isArray(draft.companionUserIds) ? draft.companionUserIds.filter((id) => typeof id === 'string' && id !== userId) : draft.companionUserId ? [draft.companionUserId] : []);");
  s=all(s,"setCompanionUserIds('')",'setCompanionUserIds([])');
  s=all(s,'Boolean(companionUserIds)','companionUserIds.length > 0');
  s=one(s,'withFriend && !companionUserIds','withFriend && companionUserIds.length === 0');
  s=one(s,'Select the registered friend who joined you.','Select at least one registered friend who joined you.');
  s=one(s,'companionUserIds: withFriend ? companionUserIds : undefined,','companionUserIds: withFriend ? companionUserIds : [],');
  s=one(s,'title="Add a teammate" subtitle={`A registered companion adds the official ${scoringRules.friendBonus}-point friend bonus.`}','title="Run with friends" subtitle={`Select the friends who joined you. The official ${scoringRules.friendBonus}-point bonus is awarded once per activity.`}');
  s=one(s,'I completed this with a registered participant','I completed this with friends');
  return one(s,/            \{withFriend \? <div className="mt-4"><label[\s\S]*?<\/div> : null\}/,'            {withFriend ? <div className="mt-4"><FriendMultiSelect users={users} value={companionUserIds} onChange={setCompanionUserIds} excludeUserId={userId} loading={usersLoading} disabled={submitting || maintenanceMode || Boolean(usersError)} />{usersError ? <p role="alert" className="mt-2 text-xs text-rose-300">{usersError} <button type="button" onClick={() => setUsersLoadAttempt((attempt) => attempt + 1)} className="min-h-11 font-black underline">Retry</button></p> : null}</div> : null}');
});
edit('src/components/AdminCreateActivityForm.tsx', s => {
  s=one(s,"'use client';", "'use client';\n"+pickerImport);
  s=all(s,'companionUserId','companionUserIds'); s=all(s,'setCompanionUserId','setCompanionUserIds');
  s=one(s,"const [companionUserIds, setCompanionUserIds] = useState('');","const [companionUserIds, setCompanionUserIds] = useState<string[]>([]);");
  s=all(s,"setCompanionUserIds('')",'setCompanionUserIds([])');
  s=all(s,'Boolean(companionUserIds)','companionUserIds.length > 0');
  s=one(s,'companionUserIds === userId','companionUserIds.includes(userId)');
  s=one(s,'companionUserIds: companionUserIds || undefined,','companionUserIds,');
  s=one(s,'if (event.target.value === companionUserIds) setCompanionUserIds([]);','setCompanionUserIds((current) => current.filter((id) => id !== event.target.value));');
  return one(s,/<label className="block">Companion [^\n]*?<\/label>/,'<FriendMultiSelect users={users} value={companionUserIds} onChange={setCompanionUserIds} excludeUserId={userId} disabled={submitting || uploading || !userId} />');
});
edit('src/components/PendingActivityEditor.tsx', s => {
  s=one(s,"'use client';", "'use client';\n"+pickerImport+idsImport);
  s=one(s,'companionUserId: string | null;','companionUserId: string | null; companionUserIds?: string[];');
  s=one(s,"useState(activity.companionUserId ?? '')",'useState<string[]>(activityFriendIds(activity))');
  s=all(s,'companionUserId: companion || null','companionUserIds: companion');
  s=one(s,'You can correct your companion here.','You can update the friends who joined you here.');
  return one(s,/<label>Companion<select[\s\S]*?<\/select><\/label>/,'<div className="sm:col-span-2"><FriendMultiSelect users={users} value={companion} onChange={setCompanion} disabled={busy} /></div>');
});
edit('src/components/ActivityCorrectionForm.tsx', s => {
  s=one(s,"'use client';", "'use client';\n"+pickerImport+idsImport);
  s=one(s,"useState(original.companionUserId ?? '')",'useState<string[]>(activityFriendIds(original))');
  s=one(s,'companionUserId:companion || null','companionUserId:companion[0] ?? null,companionUserIds:companion');
  return one(s,/<label className="text-sm font-bold">Registered companion[\s\S]*?<\/label>/,'<div className="sm:col-span-2"><FriendMultiSelect users={users} value={companion} onChange={setCompanion} disabled={busy || uploading || locked} />{original.companionName && !original.companionUserId && !companion.length ? <p className="mt-2 text-xs text-slate-400">Existing admin-verified companion: {original.companionName}. Kept unless registered friends are selected.</p> : null}</div>');
});
edit('src/components/AdminActivityReview.tsx', s => {
  s=one(s,"'use client';", "'use client';\n"+pickerImport+idsImport);
  s=one(s,'  companionUserId: string | null;','  companionUserId: string | null;\n  companionUserIds?: string[];');
  s=one(s,"companionSelect: '', companionName: ''","companionSelect: '', companionUserIds: [] as string[], companionName: ''");
  s=one(s,"companionSelect: activity.companionUserId ?? (activity.completedWithFriend ? '__manual__' : ''),","companionSelect: activityFriendIds(activity).length ? '__registered__' : (activity.completedWithFriend ? '__manual__' : ''),\n      companionUserIds: activityFriendIds(activity),");
  s=one(s,'else body.companionUserId = editForm.companionSelect || null;',"else body.companionUserIds = editForm.companionSelect === '__registered__' ? editForm.companionUserIds : [];");
  s=all(s,'companionSelect: string; companionName: string','companionSelect: string; companionUserIds: string[]; companionName: string');
  s=one(s,/<label className="text-xs text-slate-500">Companion<select[\s\S]*?<\/select><\/label>/,'<div className="sm:col-span-2 xl:col-span-4"><label className="text-xs text-slate-400">Friend entry type<select aria-label="Friend entry type" value={editForm.companionSelect} onChange={(event) => setEditForm((current) => ({ ...current, companionSelect: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"><option value="">Solo activity</option><option value="__registered__">Registered friends</option><option value="__manual__">Friend not registered (admin verified)</option></select></label>{editForm.companionSelect === \'__registered__\' ? <div className="mt-3"><FriendMultiSelect users={users} value={editForm.companionUserIds} onChange={(ids) => setEditForm((current) => ({ ...current, companionUserIds: ids }))} excludeUserId={activity.user.id} disabled={saving} /></div> : null}</div>');
  return one(s,'<Detail label="Companion"','<Detail label="Friends"');
});
edit('src/app/dashboard/page.tsx', s => {
  s=one(s,'  companionUserId: string | null;','  companionUserId: string | null;\n  companionUserIds: string[];');
  s=one(s,'        companionUserId: true,','        companionUserId: true,\n        companionUserIds: true,');
  return one(s,'where: { id: { not: userId } },',"where: { id: { not: userId }, role: 'MEMBER', columnId: { not: null } },");
});
edit('src/app/admin/activities/page.tsx', s => {
  s=one(s,'  companionUserId: string | null;','  companionUserId: string | null;\n  companionUserIds: string[];');
  return one(s,'    prisma.user.findMany({\n      select:',"    prisma.user.findMany({\n      where: { role: 'MEMBER', columnId: { not: null } },\n      select:");
});
edit('src/app/api/users/route.ts', s => one(s,'where: { id: { not: session.user.id } },',"where: { id: { not: session.user.id }, role: 'MEMBER', columnId: { not: null } },"));
edit('src/app/api/admin/export/route.ts', s => one(s,'companionUserId: true, proofUrl: true','companionUserId: true, companionUserIds: true, proofUrl: true'));
edit('src/app/api/admin/import/link/route.ts', s => {
  s="import { resolveActivityFriends } from '@/lib/activity-friends';\n"+idsImport+s;
  return one(s,"      await tx.activity.updateMany({ where: { companionUserId: sourceId }, data: { companionUserId: targetId, companion: target.name } });",`      const related = await tx.activity.findMany({ where: { OR: [{ companionUserId: sourceId }, { companionUserIds: { has: sourceId } }] } });
      for (const activity of related) {
        const companionUserIds = activityFriendIds(activity).map((id) => id === sourceId ? targetId : id);
        const friends = await resolveActivityFriends(tx, activity.userId, { companionUserIds });
        await tx.activity.update({ where: { id: activity.id }, data: friends });
      }`);
});
edit('src/app/api/admin/users/[id]/route.ts', s => one(s,"    // Activities and weekly scores cascade-delete automatically via the schema's onDelete: Cascade",`    const friendReferences = await prisma.activity.count({ where: { userId: { not: id }, companionUserIds: { has: id } } });
    if (friendReferences) return NextResponse.json({ error: 'This participant is recorded as a friend on existing activities. Review those friend selections before deleting this account.' }, { status: 409 });

    // Activities and weekly scores cascade-delete automatically via the schema's onDelete: Cascade`));
edit('scripts/validate-operational-backup.cjs', s => one(s,"const forbidden = new Set",`// The additional array is optional so earlier v6 backups remain valid.
function checkFriends(row, ownerId, liveReferences) {
  const ids = row?.companionUserIds;
  if (ids === undefined) return;
  check(Array.isArray(ids), 'Activity friends must be an array');
  if (!Array.isArray(ids)) return;
  check(ids.length <= 100 && new Set(ids).size === ids.length, 'Activity friend selection is too large or duplicated');
  for (const id of ids) check(typeof id === 'string' && id.length > 0 && id !== ownerId && (!liveReferences || users.has(id)), 'Activity friend reference is invalid');
  if (ids.length) check(row.companionUserId === ids[0], 'Legacy first companion must match the selected friends');
}
for (const activity of backup.activities) checkFriends(activity, activity.userId, true);
for (const correction of arrays.activityCorrections) {
  for (const snapshot of [correction.original,correction.proposed,correction.applied]) if (snapshot) checkFriends(snapshot, correction.user_id, false);
}
const forbidden = new Set`));
edit('prisma/multiple-activity-friends.sql', s => all(s,'FROM PUBLIC,anon,authenticated;','FROM PUBLIC;')+`
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION app_internal.validate_activity_friends(), app_internal.guard_activity_friend_delete(), app_internal.enrich_multi_friend_backup() FROM %I',r);
    END IF;
  END LOOP;
END $$;
`);
