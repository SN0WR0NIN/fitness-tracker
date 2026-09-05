#!/usr/bin/env node
const fs = require('node:fs');

const path = process.argv[2];
if (!path) {
  console.error('Usage: node scripts/validate-operational-backup.cjs /path/to/kg-backup.json');
  process.exit(2);
}

let backup;
try {
  backup = JSON.parse(fs.readFileSync(path, 'utf8'));
} catch (error) {
  console.error(`Could not read backup: ${error.message}`);
  process.exit(2);
}

const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const array = (value, name) => {
  assert(Array.isArray(value), `${name} must be an array`);
  return Array.isArray(value) ? value : [];
};
const optionalArray = (value, name) => value === undefined ? [] : array(value, name);
const uniqueIds = (rows, name) => {
  const seen = new Set();
  for (const row of rows) {
    assert(row && typeof row.id === 'string' && row.id.length > 0, `${name} contains a row without an id`);
    if (!row || typeof row.id !== 'string') continue;
    assert(!seen.has(row.id), `${name} contains duplicate id ${row.id}`);
    seen.add(row.id);
  }
  return seen;
};

assert(backup?.format === 'kg-stay-active-operational-backup', 'Unexpected backup format');
assert(backup?.version === 1, 'Unsupported backup version');
assert(typeof backup?.exportedAt === 'string' && Number.isFinite(Date.parse(backup.exportedAt)), 'exportedAt must be an ISO date');
assert(backup?.challenge && typeof backup.challenge === 'object', 'challenge settings are missing');

const columns = array(backup?.columns, 'columns');
const users = array(backup?.users, 'users');
const activities = array(backup?.activities, 'activities');
const weeklyScores = array(backup?.weeklyScores, 'weeklyScores');
const profileSettings = optionalArray(backup?.profileSettings, 'profileSettings');
const weeklyGoals = optionalArray(backup?.weeklyGoals, 'weeklyGoals');
const rankingSnapshots = optionalArray(backup?.rankingSnapshots, 'rankingSnapshots');
array(backup?.announcements, 'announcements');
array(backup?.audit, 'audit');

const columnIds = uniqueIds(columns, 'columns');
const userIds = uniqueIds(users, 'users');
uniqueIds(activities, 'activities');
uniqueIds(weeklyScores, 'weeklyScores');
uniqueIds(rankingSnapshots, 'rankingSnapshots');

for (const user of users) {
  if (user?.columnId != null) assert(columnIds.has(user.columnId), `User ${user.id} references missing column ${user.columnId}`);
}

const stravaIds = new Set();
for (const activity of activities) {
  assert(userIds.has(activity?.userId), `Activity ${activity?.id} references missing user ${activity?.userId}`);
  assert(columnIds.has(activity?.columnId), `Activity ${activity?.id} references missing column ${activity?.columnId}`);
  if (activity?.stravaActivityId) {
    assert(!stravaIds.has(activity.stravaActivityId), `Duplicate Strava activity id ${activity.stravaActivityId}`);
    stravaIds.add(activity.stravaActivityId);
  }
  assert(['PENDING', 'APPROVED', 'REJECTED'].includes(activity?.status), `Activity ${activity?.id} has invalid status ${activity?.status}`);
  assert(typeof activity?.points === 'number' && Number.isFinite(activity.points) && activity.points >= 0, `Activity ${activity?.id} has invalid points`);
}

const scoreKeys = new Set();
for (const score of weeklyScores) {
  assert(userIds.has(score?.userId), `WeeklyScore ${score?.id} references missing user ${score?.userId}`);
  assert(columnIds.has(score?.columnId), `WeeklyScore ${score?.id} references missing column ${score?.columnId}`);
  const key = `${score?.userId}|${score?.weekStart}`;
  assert(!scoreKeys.has(key), `Duplicate participant/week score ${key}`);
  scoreKeys.add(key);
  for (const field of ['totalPoints', 'runPoints', 'cyclePoints', 'swimPoints', 'hikePoints', 'troopGamePoints']) {
    assert(typeof score?.[field] === 'number' && Number.isFinite(score[field]) && score[field] >= 0, `WeeklyScore ${score?.id} has invalid ${field}`);
  }
}

const profileUsers = new Set();
for (const row of profileSettings) {
  assert(userIds.has(row?.userId), `Profile settings reference missing user ${row?.userId}`);
  assert(!profileUsers.has(row?.userId), `Duplicate profile settings for user ${row?.userId}`);
  profileUsers.add(row?.userId);
}

const goalKeys = new Set();
for (const row of weeklyGoals) {
  assert(userIds.has(row?.userId), `Weekly goal references missing user ${row?.userId}`);
  const key = `${row?.userId}|${row?.weekStart}`;
  assert(!goalKeys.has(key), `Duplicate weekly goal ${key}`);
  goalKeys.add(key);
  assert(typeof row?.target === 'number' && Number.isFinite(row.target) && row.target > 0, `Weekly goal ${key} has invalid target`);
}

if (errors.length) {
  console.error(`Backup validation failed with ${errors.length} problem(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Backup validation passed.');
console.log(JSON.stringify({
  exportedAt: backup.exportedAt,
  columns: columns.length,
  users: users.length,
  activities: activities.length,
  weeklyScores: weeklyScores.length,
  profileSettings: profileSettings.length,
  weeklyGoals: weeklyGoals.length,
  rankingSnapshots: rankingSnapshots.length,
  excludes: backup.excludes || [],
}, null, 2));
