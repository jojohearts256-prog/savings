-- Migration: create loan_guarantees table and update notifications schema

BEGIN;

-- Make notifications.member_id nullable and add metadata + recipient_role
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_member_id_check;

-- If member_id is NOT NULL currently, alter it to nullable by dropping NOT NULL
ALTER TABLE notifications ALTER COLUMN member_id DROP NOT NULL;

-- Add metadata and recipient_role columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='metadata') THEN
        ALTER TABLE notifications ADD COLUMN metadata jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='recipient_role') THEN
        ALTER TABLE notifications ADD COLUMN recipient_role text;
    END IF;
END$$;

-- Create loan_guarantees table
CREATE TABLE IF NOT EXISTS loan_guarantees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  guarantor_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount_guaranteed numeric NOT NULL CHECK (amount_guaranteed >= 0),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  responded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (loan_id, guarantor_id)
);

COMMIT;
