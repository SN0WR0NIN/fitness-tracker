import type { EdoTransaction } from '@/lib/types';

export type ProjectedTransaction = EdoTransaction & {
  projectedBalance: number;
  movedForCap: boolean;
};

export function projectMonth(rows: EdoTransaction[], openingBalance: number, maxBalance = 48) {
  const remaining = rows
    .filter((row) => row.status === 'APPROVED')
    .sort((a, b) => a.occurred_on.localeCompare(b.occurred_on) || a.created_at.localeCompare(b.created_at));
  const ordered: ProjectedTransaction[] = [];
  let balance = openingBalance;

  while (remaining.length) {
    const current = remaining[0];
    const hours = Number(current.hours);

    if (current.transaction_type === 'CLAIM') {
      if (balance - hours < -0.0001) throw new Error(`${current.event_id} would make the EDO balance negative.`);
      remaining.shift();
      balance = Math.max(0, balance - hours);
      ordered.push({ ...current, projectedBalance: balance, movedForCap: false });
      continue;
    }

    if (balance + hours <= maxBalance + 0.0001) {
      remaining.shift();
      balance = Math.min(maxBalance, balance + hours);
      ordered.push({ ...current, projectedBalance: balance, movedForCap: false });
      continue;
    }

    const claimIndex = remaining.findIndex((candidate, index) => index > 0 && candidate.transaction_type === 'CLAIM' && balance - Number(candidate.hours) >= -0.0001);
    if (claimIndex === -1) throw new Error(`${current.event_id} would exceed ${maxBalance}h and no eligible same-month claim can be moved ahead of it.`);

    const [claim] = remaining.splice(claimIndex, 1);
    balance = Math.max(0, balance - Number(claim.hours));
    ordered.push({ ...claim, projectedBalance: balance, movedForCap: true });
  }

  return { ordered, closingBalance: balance };
}

export function warningFor(balance: number) {
  if (balance >= 40) return 'CRITICAL' as const;
  if (balance >= 25) return 'WARNING' as const;
  return 'NORMAL' as const;
}
