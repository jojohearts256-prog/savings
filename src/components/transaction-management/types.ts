export type TransactionType = 'deposit' | 'withdrawal' | 'contribution';

export type TransactionRow = {
  id: string;
  member_id: string;
  transaction_type: TransactionType;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
  transaction_date: string;
  recorded_by: string | null;

  // flattened fields used by UI
  member_name?: string;
  member_number?: string;
  recorded_by_name?: string;
};
