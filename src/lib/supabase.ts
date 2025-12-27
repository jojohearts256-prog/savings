import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: 'admin' | 'employee' | 'member';
  id_number: string;
  created_at: string;
  updated_at: string;
};

export type Member = {
  id: string;
  profile_id: string;
  member_number: string;
  address: string | null;
  date_of_birth: string | null;
  account_balance: number;
  total_contributions: number;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
};

// Some components expect member fields like full_name/email/phone to exist
// (profiles and members are synced). Make these optional on Member for TS safety.
export type MemberWithProfile = Member & {
  full_name?: string;
  email?: string;
  phone?: string | null;
  id_number?: string;
};

export type Transaction = {
  id: string;
  member_id: string;
  transaction_type: 'deposit' | 'withdrawal' | 'contribution';
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
  recorded_by: string;
  transaction_date: string;
  created_at: string;
};

export type Loan = {
  id: string;
  member_id: string;
  loan_number: string;
  amount_requested: number;
  amount_approved: number | null;
  interest_rate: number;
  repayment_period_months: number;
  reason: string;
  status:
    | 'pending_guarantors'
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'disbursed'
    | 'completed';
  requested_date: string;
  approved_date: string | null;
  disbursed_date: string | null;
  approved_by: string | null;
  total_repayable: number | null;
  amount_repaid: number;
  outstanding_balance: number | null;
  created_at: string;
  updated_at: string;
};

export type LoanGuarantee = {
  id: string;
  loan_id: string;
  guarantor_id: string;
  amount_guaranteed: number;
  status: 'pending' | 'approved' | 'declined';
  responded_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

// Allow loans to optionally include their guarantors when fetched with joins
export type LoanWithGuarantors = Loan & {
  guarantors?: LoanGuarantee[];
};

export type LoanRepayment = {
  id: string;
  loan_id: string;
  amount: number;
  repayment_date: string;
  recorded_by: string;
  notes: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
  member_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  sent_at: string;
};
