#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const input = process.argv[2];
if (!input) { console.error('Usage: node scripts/validate-operational-backup.cjs /path/to/kg-backup.json'); process.exit(2); }
let backup;
try { backup = JSON.parse(fs.readFileSync(input, 'utf8')); } catch (error) { console.error(`Could not read backup: ${error.message}`); process.exit(2); }
const legacyValidator = path.join(__dirname, 'validate-operational-backup-v1-v5.cjs');
if (backup.version !== 6) {
  const result = spawnSync(process.execPath, [legacyValidator, input], { stdio: 'inherit' });
  process.exit(result.status ?? 2);
}
// Retain all previously shipped v1-v5 checks unchanged. The temporary copy is
// owner-readable only, never uploaded, and is removed even if validation fails.
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-backup-validation-'));
let core;
try {
  const corePath = path.join(temporary, 'core.json');
  fs.writeFileSync(corePath, JSON.stringify({ ...backup, version: 5 }), { mode: 0o600 });
  core = spawnSync(process.execPath, [legacyValidator, corePath], { encoding: 'utf8' });
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
if (core.status !== 0) { console.error(core.stderr || 'Core backup validation failed'); process.exit(core.status ?? 2); }
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const arrays = {};
for (const key of ['activityCorrections', 'notificationPreferences', 'achievementDefinitions', 'userAchievements', 'weeklyResultRebuilds']) {
  check(Array.isArray(backup[key]), `${key} must be an array for version 6`);
  arrays[key] = Array.isArray(backup[key]) ? backup[key] : [];
}
const users = new Set(backup.users.map((u) => u.id));
const activities = new Set(backup.activities.map((a) => a.id));
const results = new Set((backup.weeklyResults || []).map((w) => `${w.season_key ?? w.seasonKey}|${w.week_number ?? w.weekNumber}`));
const unique = (rows, key, label) => {
  const seen = new Set();
  for (const row of rows) { const value = key(row); check(typeof value === 'string' && value.length > 0 && !seen.has(value), `${label} has an invalid or duplicate key`); seen.add(value); }
  return seen;
};
const defs = unique(arrays.achievementDefinitions, (r) => r?.id, 'Achievement definitions');
for (const d of arrays.achievementDefinitions) {
  check(typeof d.target === 'number' && Number.isFinite(d.target) && d.target > 0, 'Achievement target must be positive');
  check(['bronze', 'silver', 'gold'].includes(d.tier), 'Achievement tier is invalid');
}
unique(arrays.activityCorrections, (r) => r?.id, 'Corrections');
const open = new Set();
for (const c of arrays.activityCorrections) {
  check(users.has(c.user_id), 'Correction references missing user');
  check(typeof c.activity_id === 'string' && c.activity_id.length > 0, 'Correction is missing activity id');
  check(['OPEN', 'APPROVED', 'REJECTED', 'CANCELLED', 'STALE'].includes(c.status), 'Correction status is invalid');
  check(c.original && typeof c.original === 'object' && !Array.isArray(c.original) && c.proposed && typeof c.proposed === 'object' && !Array.isArray(c.proposed), 'Correction snapshots are missing');
  if (c.reviewed_by_id != null) check(users.has(c.reviewed_by_id), 'Correction references missing reviewer');
  if (c.status === 'OPEN') { check(!open.has(c.activity_id), 'More than one open request for the same activity'); open.add(c.activity_id); }
  // Historical snapshots deliberately survive deletion of the source activity.
  if (c.status === 'APPROVED') check(c.applied && c.reviewed_at && c.decision_reason, 'Approved correction is missing applied state or review history');
}
unique(arrays.notificationPreferences, (r) => r?.user_id, 'Notification preferences');
for (const p of arrays.notificationPreferences) {
  check(users.has(p.user_id), 'Notification preference references missing user');
  for (const key of ['activity_reviews', 'correction_updates', 'achievements', 'weekly_results', 'goal_reminders']) check(typeof p[key] === 'boolean', 'Notification preference must be boolean');
}
unique(arrays.userAchievements, (r) => `${r?.user_id}|${r?.season_key}|${r?.achievement_id}`, 'User achievements');
for (const a of arrays.userAchievements) {
  check(users.has(a.user_id) && defs.has(a.achievement_id), 'User achievement references missing user or definition');
  check(typeof a.season_key === 'string' && a.season_key.length > 0, 'Achievement season is missing');
  check(typeof a.current_value === 'number' && Number.isFinite(a.current_value) && a.current_value >= 0, 'Achievement progress is invalid');
  check(typeof a.unlocked === 'boolean', 'Achievement unlocked flag must be boolean');
}
unique(arrays.weeklyResultRebuilds, (r) => `${r?.season_key}|${r?.week_number}`, 'Result rebuild markers');
for (const w of arrays.weeklyResultRebuilds) check(results.has(`${w.season_key}|${w.week_number}`), 'Rebuild marker references missing finalized result');
const forbidden = new Set(['password', 'passwordHash', 'temporaryPassword', 'stravaAccessToken', 'stravaRefreshToken']);
function inspect(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) { check(!forbidden.has(key), `Backup contains forbidden secret field ${key}`); inspect(child); }
}
inspect(backup);
if (errors.length) { console.error(`Backup validation failed:\n${errors.join('\n')}`); process.exit(1); }
console.log('Backup validation passed.');
console.log(JSON.stringify({ version: 6, users: users.size, activities: activities.size, ...Object.fromEntries(Object.entries(arrays).map(([key, rows]) => [key, rows.length])) }, null, 2));
