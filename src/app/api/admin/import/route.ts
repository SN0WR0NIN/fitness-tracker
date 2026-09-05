import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireAdmin } from '@/lib/adminGuard';
import { prisma } from '@/lib/prisma';
import { getChallengeSettings } from '@/lib/admin-control';
import { ImportSchema, participantKey, placeholderId, prepareRow, hash, normalizeName } from '@/lib/historical-import';
import { writeHistoricalImport } from '@/lib/historical-import-writer';

export const maxDuration = 60;

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const text = await request.text();
    if (text.length > 1000000) return NextResponse.json({ error: 'Import file is too large.' }, { status: 413 });
    const parsed = ImportSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid import.' }, { status: 400 });
    const input = parsed.data;
    const settings = await getChallengeSettings();
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const [users, columns, existing] = await Promise.all([
        tx.user.findMany({ select: { id: true, name: true, columnId: true } }),
        tx.column.findMany({ select: { id: true } }),
        tx.activity.findMany({ select: { id: true, userId: true, category: true, distance: true, occurredAt: true, proofUrl: true } }),
      ]);
      const seen = new Set<string>();
      const preview = input.rows.filter((row) => normalizeName(row.name) !== 'test').map((row) => {
        const prepared = prepareRow(row, settings.scoringRules, settings.startDate);
        const key = participantKey(row);
        const mapping = input.mappings[key];
        const userId = mapping?.userId === 'NEW' ? placeholderId(key) : mapping?.userId;
        const duplicate = seen.has(prepared.id) || existing.some((activity) => activity.id === prepared.id);
        seen.add(prepared.id);
        const possibleDuplicate = !duplicate && existing.some((activity) => (activity.userId === userId || (row.proofUrl && activity.proofUrl === row.proofUrl)) && activity.category === prepared.category && activity.distance === row.distance && Math.abs(activity.occurredAt.getTime() - prepared.occurredAt.getTime()) < 60000);
        const error = !mapping || !columns.some((column) => column.id === mapping.columnId) || (mapping.userId !== 'NEW' && !users.some((user) => user.id === mapping.userId)) ? 'Choose a participant and column.' : null;
        return { ...row, ...prepared, key, userId, columnId: mapping?.columnId, duplicate, possibleDuplicate, error, skipped: input.skip.includes(prepared.id) };
      });
      const previewHash = hash(preview);
      if (!input.commit) return { preview, previewHash };
      if (input.previewHash !== previewHash) throw new Error('Data changed. Preview again before importing.');
      const selected = preview.filter((row) => !row.duplicate && !row.skipped);
      if (selected.some((row) => row.error || row.possibleDuplicate)) throw new Error('Resolve mappings and skip possible duplicates before importing.');
      await writeHistoricalImport(tx, selected.map((row) => ({ ...row, userId: row.userId!, columnId: row.columnId!, createParticipant: input.mappings[row.key].userId === 'NEW' })), guard.userId);
      return { imported: selected.length, skipped: preview.length - selected.length };
    }, { isolationLevel: 'Serializable', timeout: 40000, maxWait: 5000 });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const safe = ['Data changed.', 'Resolve mappings'].some((prefix) => message.startsWith(prefix));
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNKNOWN';
    if (!safe) console.error('Historical import failed', { code });
    const reason = code === 'P2028' ? 'The database transaction timed out.' : code === 'P2034' || code === 'P2002' ? 'Another update conflicted with this import.' : 'Import could not finish.';
    return NextResponse.json({ error: safe ? message : `${reason} Preview again to check what remains before retrying.`, code: safe ? undefined : code }, { status: 409 });
  }
}
