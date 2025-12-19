import { useState } from 'react';
import { supabase, Member, Loan } from '../lib/supabase';
import { XCircle } from 'lucide-react';

interface GuarantorApprovalModalProps {
  loan: Loan | null;
  member: Member | null;
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

  const handleDecision = async (decision: 'Accepted' | 'Declined') => {
    try {
      setError('');
      if (decision === 'Accepted') setLoadingAccept(true);
      else setLoadingDecline(true);

      // Update guarantor row safely with upsert to avoid inserting duplicates
      const guarantorAmount =
        loan.guarantors?.find((g) => g.member_id === member.id)?.amount_guaranteed || 0;

      const { error: upsertError } = await supabase
        .from('loan_guarantees')
        .upsert(
          {
            loan_id: loan.id,
            guarantor_id: member.id,
            amount_guaranteed: guarantorAmount,
            status: decision,
          },
          { onConflict: ['loan_id', 'guarantor_id'] }
        );

      if (upsertError) throw upsertError;

      // Notify loan member
      await supabase.from('notifications').insert({
        member_id: loan.member_id,
        type: 'guarantor_response',
        title: 'Guarantor Response',
        message:
          decision === 'Accepted'
            ? `${member.full_name} accepted your loan guarantee.`
            : `${member.full_name} declined your loan guarantee.`,
        metadata: JSON.stringify({ guarantor_id: member.id, loanId: loan.id, decision }),
        sent_at: new Date(),
        read: false,
      });

      // Check if all guarantors accepted
      const { data: allGuarantors } = await supabase
        .from('loan_guarantees')
        .select('*')
        .eq('loan_id', loan.id);

      const validGuarantors = allGuarantors?.filter((g) => g.amount_guaranteed > 0);
      const allAccepted = validGuarantors && validGuarantors.length > 0
        ? validGuarantors.every((g) => g.status === 'Accepted')
        : false;

      if (allAccepted) {
        // Notify admin
        await supabase.from('notifications').insert({
          member_id: null,
          type: 'loan_ready_for_admin',
          title: 'Loan Ready for Approval',
          message: `Loan ${loan.loan_number} by member ${loan.member_id} has all guarantor approvals.`,
          metadata: JSON.stringify({ loanId: loan.id }),
          sent_at: new Date(),
          read: false,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit decision');
    } finally {
      setLoadingAccept(false);
      setLoadingDecline(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 relative shadow-2xl border border-gray-100 animate-fadeIn">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition"
        >
          <XCircle className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-bold text-gray-800 mb-4">Loan Guarantee Approval</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
            {error}
          </div>
        )}

        <p className="mb-4">
          Loan <strong>{loan.loan_number}</strong> requested by member ID{' '}
          <strong>{loan.member_id}</strong> needs your approval.
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => handleDecision('Accepted')}
            disabled={loadingAccept || loadingDecline}
            className="flex-1 py-2 bg-green-500 text-white font-medium rounded-xl disabled:opacity-50"
          >
            {loadingAccept ? 'Processing...' : 'Accept'}
          </button>
          <button
            onClick={() => handleDecision('Declined')}
            disabled={loadingAccept || loadingDecline}
            className="flex-1 py-2 bg-red-500 text-white font-medium rounded-xl disabled:opacity-50"
          >
            {loadingDecline ? 'Processing...' : 'Decline'}
          </button>
        </div>
      </div>
    </div>
  );
}
