/*
  # Savings Group Management System Database Schema

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key, references auth.users)
      - `email` (text, unique, not null)
      - `full_name` (text, not null)
      - `phone` (text)
      - `role` (text, check constraint: admin/employee/member)
      - `id_number` (text, unique, not null)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

    - `members`
      - `id` (uuid, primary key, auto-generated)
      - `profile_id` (uuid, references profiles)
      - `member_number` (text, unique, auto-generated)
      - `address` (text)
      - `date_of_birth` (date)
      - `account_balance` (numeric, default 0)
      - `total_contributions` (numeric, default 0)
      - `status` (text, default 'active')
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

    - `transactions`
      - `id` (uuid, primary key, auto-generated)
      - `member_id` (uuid, references members)
      - `transaction_type` (text, check: deposit/withdrawal/contribution)
      - `amount` (numeric, not null)
      - `balance_before` (numeric, not null)
      - `balance_after` (numeric, not null)
      - `description` (text)
      - `recorded_by` (uuid, references profiles)
      - `transaction_date` (timestamptz, default now())
      - `created_at` (timestamptz, default now())

    - `loans`
      - `id` (uuid, primary key, auto-generated)
      - `member_id` (uuid, references members)
      - `loan_number` (text, unique, auto-generated)
      - `amount_requested` (numeric, not null)
      - `amount_approved` (numeric)
      - `interest_rate` (numeric, default 0)
      - `repayment_period_months` (integer, not null)
      - `reason` (text, not null)
      - `status` (text, default 'pending', check: pending/approved/rejected/disbursed/completed)
      - `requested_date` (timestamptz, default now())
      - `approved_date` (timestamptz)
      - `disbursed_date` (timestamptz)
      - `approved_by` (uuid, references profiles)
      - `total_repayable` (numeric)
      - `amount_repaid` (numeric, default 0)
      - `outstanding_balance` (numeric)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

    - `loan_repayments`
      - `id` (uuid, primary key, auto-generated)
      - `loan_id` (uuid, references loans)
      - `amount` (numeric, not null)
      - `repayment_date` (timestamptz, default now())
      - `recorded_by` (uuid, references profiles)
      - `notes` (text)
      - `created_at` (timestamptz, default now())

    - `notifications`
      - `id` (uuid, primary key, auto-generated)
      - `member_id` (uuid, references members)
      - `type` (text, not null)
      - `title` (text, not null)
      - `message` (text, not null)
      - `read` (boolean, default false)
      - `sent_at` (timestamptz, default now())

  2. Security
    - Enable RLS on all tables
    - Admin: Full access to all tables
    - Employee: Can read profiles, members, transactions, loans; can insert/update transactions and loan_repayments
    - Member: Can read own profile, member record, transactions, loans, and notifications
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL CHECK (role IN ('admin', 'employee', 'member')),
  id_number text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create members table
CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  member_number text UNIQUE NOT NULL,
  address text,
  date_of_birth date,
  account_balance numeric DEFAULT 0 CHECK (account_balance >= 0),
  total_contributions numeric DEFAULT 0 CHECK (total_contributions >= 0),
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'contribution')),
  amount numeric NOT NULL CHECK (amount > 0),
  balance_before numeric NOT NULL,
  balance_after numeric NOT NULL,
  description text,
  recorded_by uuid NOT NULL REFERENCES profiles(id),
  transaction_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create loans table
CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  loan_number text UNIQUE NOT NULL,
  amount_requested numeric NOT NULL CHECK (amount_requested > 0),
  amount_approved numeric CHECK (amount_approved > 0),
  interest_rate numeric DEFAULT 0 CHECK (interest_rate >= 0),
  repayment_period_months integer NOT NULL CHECK (repayment_period_months > 0),
  reason text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disbursed', 'completed')),
  requested_date timestamptz DEFAULT now(),
  approved_date timestamptz,
  disbursed_date timestamptz,
  approved_by uuid REFERENCES profiles(id),
  total_repayable numeric,
  amount_repaid numeric DEFAULT 0 CHECK (amount_repaid >= 0),
  outstanding_balance numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

-- Create loan_repayments table
CREATE TABLE IF NOT EXISTS loan_repayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  repayment_date timestamptz DEFAULT now(),
  recorded_by uuid NOT NULL REFERENCES profiles(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE loan_repayments ENABLE ROW LEVEL SECURITY;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  sent_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create function to generate member number
CREATE OR REPLACE FUNCTION generate_member_number()
RETURNS text AS $$
DECLARE
  new_number text;
  count_members integer;
BEGIN
  SELECT COUNT(*) INTO count_members FROM members;
  new_number := 'MEM' || LPAD((count_members + 1)::text, 6, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate loan number
CREATE OR REPLACE FUNCTION generate_loan_number()
RETURNS text AS $$
DECLARE
  new_number text;
  count_loans integer;
BEGIN
  SELECT COUNT(*) INTO count_loans FROM loans;
  new_number := 'LOAN' || LPAD((count_loans + 1)::text, 6, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies for profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Employees can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'employee')
    )
  );

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can update profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- RLS Policies for members
CREATE POLICY "Admins and employees can view all members"
  ON members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'employee')
    )
  );

CREATE POLICY "Members can view own record"
  ON members FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
  );

CREATE POLICY "Admins can insert members"
  ON members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins and employees can update members"
  ON members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'employee')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'employee')
    )
  );

CREATE POLICY "Admins can delete members"
  ON members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- RLS Policies for transactions
CREATE POLICY "Admins and employees can view all transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'employee')
    )
  );

CREATE POLICY "Members can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = member_id AND m.profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins and employees can insert transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'employee')
    )
  );

-- RLS Policies for loans
CREATE POLICY "Admins and employees can view all loans"
  ON loans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'employee')
    )
  );

CREATE POLICY "Members can view own loans"
  ON loans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = member_id AND m.profile_id = auth.uid()
    )
  );

CREATE POLICY "Members can insert loan requests"
  ON loans FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = member_id AND m.profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update loans"
  ON loans FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- RLS Policies for loan_repayments
CREATE POLICY "Admins and employees can view all loan repayments"
  ON loan_repayments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'employee')
    )
  );

CREATE POLICY "Members can view own loan repayments"
  ON loan_repayments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM loans l
      JOIN members m ON l.member_id = m.id
      WHERE l.id = loan_id AND m.profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins and employees can insert loan repayments"
  ON loan_repayments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'employee')
    )
  );

-- RLS Policies for notifications
CREATE POLICY "Admins can view all notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Members can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = member_id AND m.profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins and employees can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'employee')
    )
  );

CREATE POLICY "Members can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = member_id AND m.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = member_id AND m.profile_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_members_profile_id ON members(profile_id);
CREATE INDEX IF NOT EXISTS idx_transactions_member_id ON transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_loans_member_id ON loans(member_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_loan_id ON loan_repayments(loan_id);
CREATE INDEX IF NOT EXISTS idx_notifications_member_id ON notifications(member_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
