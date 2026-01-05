export type LoanStatus = 'pending' | 'approved' | 'rejected' | 'disbursed' | 'completed' | string;

export type LoanMember = {
  account_balance?: number | string;
  member_number?: string;
  full_name?: string;
  profiles?: {
    full_name?: string;
  };
};

export type Loan = {
  id: string;
  member_id: string;
  members?: LoanMember;

  member_name?: string;
  member_number?: string;

  status: LoanStatus;
  amount_requested: number;
  amount_approved?: number | null;
  interest_rate?: number | null;
  outstanding_balance?: number | null;
  amount_repaid?: number | null;

  requested_date?: string;
};
