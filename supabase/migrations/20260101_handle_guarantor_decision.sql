-- Migration: enforce guarantor decision logic and notify from DB

-- 1) Ensure unique guarantor per loan
ALTER TABLE IF EXISTS loan_guarantees
ADD CONSTRAINT IF NOT EXISTS unique_loan_guarantor UNIQUE (loan_id, guarantor_id);

-- 2) Function to handle guarantor decision and progress loan status
CREATE OR REPLACE FUNCTION public.handle_guarantor_decision()
RETURNS TRIGGER AS $$
DECLARE
  expected_count INTEGER;
  approved_count INTEGER;
  declined_count INTEGER;
  borrower_id uuid;
BEGIN
  -- Count expected guarantors (rows in loan_guarantees for this loan)
  SELECT COUNT(*) INTO expected_count FROM public.loan_guarantees WHERE loan_id = NEW.loan_id;

  -- Count approved guarantors (status = 'approved')
  SELECT COUNT(*) INTO approved_count FROM public.loan_guarantees WHERE loan_id = NEW.loan_id AND status = 'approved';

  -- Count declined guarantors
  SELECT COUNT(*) INTO declined_count FROM public.loan_guarantees WHERE loan_id = NEW.loan_id AND status = 'declined';

  -- If any guarantor has declined, immediately reject the loan
  IF declined_count > 0 THEN
    UPDATE public.loans SET status = 'rejected' WHERE id = NEW.loan_id;

    -- notify borrower
    SELECT member_id INTO borrower_id FROM public.loans WHERE id = NEW.loan_id;

    IF borrower_id IS NOT NULL THEN
      INSERT INTO public.notifications (member_id, type, title, message, metadata, sent_at, read)
      VALUES (
        borrower_id,
        'loan_rejected_by_guarantor',
        'Loan Declined by Guarantor',
        concat('Your loan request was declined because one of your guarantors did not approve.'),
        jsonb_build_object('loan_id', NEW.loan_id),
        now(),
        false
      );
    END IF;

    RETURN NEW;
  END IF;

  -- If all expected guarantors have approved, forward to admin
  IF expected_count > 0 AND approved_count = expected_count THEN
    UPDATE public.loans SET status = 'pending' WHERE id = NEW.loan_id;

    -- notify admin (member_id = null, recipient_role = 'admin')
    INSERT INTO public.notifications (member_id, recipient_role, type, title, message, metadata, sent_at, read)
    VALUES (
      NULL,
      'admin',
      'loan_ready_for_admin',
      'Loan Ready for Approval',
      concat('Loan request ', NEW.loan_id::text, ' has all guarantors approved and is ready for admin review.'),
      jsonb_build_object('loan_id', NEW.loan_id),
      now(),
      false
    );

    -- notify borrower that guarantors approved
    SELECT member_id INTO borrower_id FROM public.loans WHERE id = NEW.loan_id;
    IF borrower_id IS NOT NULL THEN
      INSERT INTO public.notifications (member_id, type, title, message, metadata, sent_at, read)
      VALUES (
        borrower_id,
        'loan_guarantors_approved',
        'Guarantors Approved',
        concat('All your guarantors have approved your loan request. The loan has been forwarded to admin for review.'),
        jsonb_build_object('loan_id', NEW.loan_id),
        now(),
        false
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) Attach trigger to loan_guarantees
DROP TRIGGER IF EXISTS trg_guarantor_decision ON public.loan_guarantees;

CREATE TRIGGER trg_guarantor_decision
AFTER INSERT OR UPDATE ON public.loan_guarantees
FOR EACH ROW
EXECUTE FUNCTION public.handle_guarantor_decision();

-- End of migration
