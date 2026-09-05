export type EdoRole = 'OFFICER' | 'SUPERVISOR' | 'ADMIN';
export type EdoTransactionType = 'GRANT' | 'CLAIM';
export type EdoTransactionStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'VOID';
export type WarningLevel = 'NORMAL' | 'WARNING' | 'CRITICAL';

export type EdoAccess = {
  user_id: string;
  officer_id: string | null;
  role: EdoRole;
  column_code: string;
};

export type EdoOfficer = {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  rank: string | null;
  officer_no: string | null;
  column_code: string;
  is_active: boolean;
  starting_balance: number | string;
  starting_balance_date: string | null;
};

export type EdoTransaction = {
  id: string;
  event_id: string;
  officer_id: string;
  column_code: string;
  occurred_on: string;
  transaction_type: EdoTransactionType;
  hours: number | string;
  status: EdoTransactionStatus;
  source: string;
  notes: string | null;
  proof_url: string | null;
  effective_order: number | null;
  running_balance: number | string | null;
  processing_note: string | null;
  rejection_reason: string | null;
  created_at: string;
};

export type EdoLedger = {
  id: string;
  officer_id: string;
  column_code: string;
  month_start: string;
  opening_balance: number | string;
  approved_grants: number | string;
  approved_claims: number | string;
  closing_balance: number | string;
  warning_level: WarningLevel;
  calculated_at: string;
};
