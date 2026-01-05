import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { MemberWithProfile, LoanWithGuarantors } from '../lib/supabase';
import { sendNotification } from '../lib/notify';
import { notifyUser } from '../lib/notifyUser';
import { XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface GuarantorApprovalModalProps {
  loan: LoanWithGuarantors | null;
  member: MemberWithProfile | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function GuarantorApprovalModal({
  loan,
  member,
  onClose,
  onSuccess,
}: GuarantorApprovalModalProps) {
  const [loadingAccept, setLoadingAccept] = useState(false);
  const [loadingDecline, setLoadingDecline] = useState(false);
  const [error, setError] = useState('');

  if (!loan?.id || !member?.id) return null;

  const handleDecision = async (decision: 'accept' | 'decline') => {
    try {
      setError('');
      decision === 'accept' ? setLoadingAccept(true) : setLoadingDecline(true);

      const toastId = toast.loading(decision === 'accept' ? 'Submitting approval...' : 'Submitting rejection...');

      const guarantorAmount =
        loan.guarantors?.find((g) => g.guarantor_id === member.id)
          ?.amount_guaranteed ?? 0;

      if (guarantorAmount <= 0) throw new Error('Invalid guaranteed amount');

      // Map UI decision to DB-allowed status values
      // NOTE: this project uses "pending" to mean "guarantor approved".
      // "pending_guarantors" is the loan status while waiting for all guarantors.
      // The DB trigger should advance the loan to "pending" (admin) only when all
      // guarantor rows are in this approved state.
      const finalStatus: 'pending' | 'declined' =
        decision === 'decline' ? 'declined' : 'pending';

      // Update this guarantor's status and ensure it succeeded before closing
      const { error: upsertError } = await supabase
        .from('loan_guarantees')
        .upsert(
          {
            loan_id: loan.id,
            guarantor_id: member.id,
            amount_guaranteed: guarantorAmount,
            status: finalStatus,
          },
          { onConflict: 'loan_id,guarantor_id' }
        );

      if (upsertError) throw upsertError;

  toast.success(decision === 'accept' ? 'Guarantee approved' : 'Guarantee declined', { id: toastId });

      // ✅ Close on both approve and reject AFTER success
      onSuccess();
      onClose();

      // Notify borrower about this decision asynchronously
      sendNotification({
        member_id: loan.member_id,
        type: 'guarantor_response',
        title: 'Guarantor Response',
        message:
          decision === 'accept'
            ? `${member.full_name ?? 'A guarantor'} accepted your loan guarantee.`
            : `${member.full_name ?? 'A guarantor'} declined your loan guarantee.`,
        metadata: { guarantor_id: member.id, loanId: loan.id, status: finalStatus },
      }).catch(console.warn);

      // Email borrower via Edge Function asynchronously
      notifyUser({
        user_id: loan.member_id,
        message:
          decision === 'accept'
            ? `${member.full_name ?? 'A guarantor'} accepted your loan guarantee.`
            : `${member.full_name ?? 'A guarantor'} declined your loan guarantee.`,
      }).catch(console.warn);

      // NOTE: loan progression (pending_guarantors -> pending, or -> rejected)
      // must be handled by the DB trigger (see migration) so the client can't
      // accidentally advance it early.
    } catch (err: any) {
      setError(err.message || 'Failed to submit decision');

      toast.error(err.message || 'Failed to submit decision');
    } finally {
      setLoadingAccept(false);
      setLoadingDecline(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-red-500"
        >
          <XCircle className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-bold mb-4">
          Loan Guarantee Approval
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
            {error}
          </div>
        )}

        <p className="mb-4">
          Loan <strong>{loan.loan_number}</strong> requires your approval.
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => handleDecision('accept')}
            disabled={loadingAccept || loadingDecline}
            className="flex-1 py-2 bg-green-500 text-white rounded-xl"
          >
            {loadingAccept ? 'Processing...' : 'Accept'}
          </button>

          <button
            onClick={() => handleDecision('decline')}
            disabled={loadingAccept || loadingDecline}
            className="flex-1 py-2 bg-red-500 text-white rounded-xl"
          >
            {loadingDecline ? 'Processing...' : 'Decline'}
          </button>
        </div>
      </div>
    </div>
  );
}
