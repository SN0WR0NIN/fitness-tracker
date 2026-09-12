#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const input = process.argv[2];
if (!input) { console.error('Usage: node scripts/validate-operational-backup.cjs backup.json'); process.exit(2); }
let backup;
try { if (fs.statSync(input).size > 64 * 1024 * 1024) throw new Error('File exceeds 64MB limit'); backup = JSON.parse(fs.readFileSync(input, 'utf8')); }
catch { console.error('Backup file is missing, oversized or invalid JSON.'); process.exit(2); }
const validator = path.join(__dirname, 'validate-operational-backup-v6.cjs');
if (backup.version !== 7) { const result = spawnSync(process.execPath, [validator, input], { stdio: 'inherit' }); process.exit(result.status ?? 2); }
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-v7-validation-'));
let core;
try { const filename = path.join(temporary, 'core.json'); fs.writeFileSync(filename, JSON.stringify({ ...backup, version: 6 }), { mode: 0o600 }); core = spawnSync(process.execPath, [validator, filename], { encoding: 'utf8' }); }
finally { fs.rmSync(temporary, { recursive: true, force: true }); }
if (core.status !== 0) { console.error(core.stderr || 'Core backup validation failed.'); process.exit(1); }
const errors = []; const check = (value, message) => { if (!value) errors.push(message); };
check(Array.isArray(backup.pointsLogs), 'Version 7 requires a pointsLogs array.');
const activities = new Map(backup.activities.map(a => [a.id, a]));
for (const activity of backup.activities) {
  for (const key of ['basePointsOverride','totalPointsOverride']) { const value = activity[key]; if (value !== undefined && value !== null) check(typeof value === 'number' && Number.isFinite(value) && value >= 0, `Invalid ${key}.`); }
  if (activity.totalPointsOverride !== undefined && activity.totalPointsOverride !== null) check(Math.abs(activity.totalPointsOverride * 2 - Math.round(activity.totalPointsOverride * 2)) < 1e-9, 'Total score override must use 0.5-point increments.');
  if (activity.proofUrls !== undefined) {
    check(Array.isArray(activity.proofUrls), 'proofUrls must be an array when present.');
    if (Array.isArray(activity.proofUrls)) {
      check(activity.proofUrls.length <= 5, 'An activity backup cannot contain more than five proof references.');
      check(new Set(activity.proofUrls).size === activity.proofUrls.length, 'Activity proof references must be unique.');
      for (const proof of activity.proofUrls) check(typeof proof === 'string' && proof.length > 0 && proof.length <= 2048, 'Invalid activity proof reference.');
      if (activity.proofUrls.length && activity.proofUrl !== undefined && activity.proofUrl !== null) check(activity.proofUrls[0] === activity.proofUrl, 'Legacy primary proof must match the first proofUrls entry.');
    }
  }
}
const logIds = new Set(); const activityIds = new Set();
for (const log of Array.isArray(backup.pointsLogs) ? backup.pointsLogs : []) {
  if (!log || typeof log !== 'object') { errors.push('Invalid PointsLog record.'); continue; }
  check(typeof log.id === 'string' && log.id.length > 0 && !logIds.has(log.id), 'Invalid or duplicate PointsLog id.');
  check(activities.has(log.activityId) && !activityIds.has(log.activityId), 'Missing or duplicate PointsLog activity reference.');
  logIds.add(log.id); activityIds.add(log.activityId);
  for (const key of ['basePoints','friendBonus','totalPoints']) check(typeof log[key] === 'number' && Number.isFinite(log[key]) && log[key] >= 0, 'Invalid score breakdown amount.');
  check(log.totalPoints === activities.get(log.activityId)?.points, 'PointsLog total differs from activity.'); check(Number.isFinite(Date.parse(log.createdAt)), 'PointsLog creation time is missing.');
}
check(activityIds.size === activities.size, 'A complete v7 snapshot requires one PointsLog per activity.');
if (backup.counts) for (const [key, count] of Object.entries(backup.counts)) check(Array.isArray(backup[key]) && backup[key].length === count, 'Recorded collection count mismatch.');
if (errors.length) { console.error([...new Set(errors)].join('\n')); process.exit(1); }
console.log(JSON.stringify({ valid: true, version: 7, activities: activities.size, pointsLogs: logIds.size, binaryObjectsIncluded: false }));
