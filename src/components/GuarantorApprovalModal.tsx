import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { MemberWithProfile, LoanWithGuarantors } from '../lib/supabase';
import { sendNotification } from '../lib/notify';
import { XCircle } from 'lucide-react';

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

  const handleDecision = async (status: 'accept' | 'decline') => {
    try {
      setError('');
      status === 'accept' ? setLoadingAccept(true) : setLoadingDecline(true);

      const guarantorAmount =
        loan.guarantors?.find((g) => g.guarantor_id === member.id)
          ?.amount_guaranteed || 0;

      // Normalize status to allowed DB values: 'pending'|'approved'|'declined'
      const dbStatus = status === 'decline' ? 'declined' : 'approved';

      // Defensive: ensure we only ever write an allowed value to the DB.
      const allowed = ['pending', 'approved', 'declined'];
      let finalStatus = dbStatus;
      if (!allowed.includes(finalStatus)) {
        console.warn('GuarantorApprovalModal: normalizing unexpected status', finalStatus);
        if (finalStatus === 'accept') finalStatus = 'approved';
        else if (finalStatus === 'decline') finalStatus = 'declined';
        else finalStatus = 'pending';
      }

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

      // Immediately close modal and refresh parent list
      onClose();
      onSuccess();

      // Notify borrower asynchronously about this guarantor's decision
      sendNotification({
        member_id: loan.member_id,
        type: 'guarantor_response',
        title: 'Guarantor Response',
        message:
          status === 'accept'
            ? `${member.full_name ?? 'A guarantor'} accepted your loan guarantee.`
            : `${member.full_name ?? 'A guarantor'} declined your loan guarantee.`,
        metadata: { guarantor_id: member.id, loanId: loan.id, status: finalStatus },
      }).catch((e) => console.warn('notify borrower failed', e));
    } catch (err: any) {
      setError(err.message || 'Failed to submit decision');
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

        <h2 className="text-xl font-bold mb-4">Loan Guarantee Approval</h2>

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
