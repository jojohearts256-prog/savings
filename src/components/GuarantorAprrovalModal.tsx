import { useState } from 'react';
import { supabase, Member, Loan, LoanGuarantee } from '../lib/supabase';
import { XCircle } from 'lucide-react';

interface GuarantorApprovalModalProps {
  loanGuarantee: LoanGuarantee | null; // pending loan guarantee
  member: Member | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function GuarantorApprovalModal({
  loanGuarantee,
  member,
  onClose,
  onSuccess,
}: GuarantorApprovalModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!loanGuarantee || !member) return null;

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    setLoading(true);
    setError('');

    try {
      // 1️⃣ Update the guarantee status
      const { error: updateError } = await supabase
        .from('loan_guarantees')
        .update({ status: decision })
        .eq('id', loanGuarantee.id);
      if (updateError) throw updateError;

      // 2️⃣ Optionally, send notification to the loan requester
      const message =
        decision === 'approved'
          ? `${member.full_name} approved your loan guarantee.`
          : `${member.full_name} rejected your loan guarantee.`;

      await supabase.from('notifications').insert({
        member_id: loanGuarantee.loan.member_id,
        type: 'guarantor_response',
        title: 'Guarantor Response',
        message,
        recipient_role: 'member',
        metadata: JSON.stringify({
          guarantor_id: member.id,
          loanId: loanGuarantee.loan_id,
          decision,
        }),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit decision');
    } finally {
      setLoading(false);
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
          Loan <strong>{loanGuarantee.loan.loan_number}</strong> requested by member ID{' '}
          <strong>{loanGuarantee.loan.member_id}</strong> needs your approval.
        </p>

        <p className="mb-4">
          Amount you pledged: <strong>{loanGuarantee.amount_guaranteed.toLocaleString()} UGX</strong>
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => handleDecision('approved')}
            disabled={loading}
            className="flex-1 py-2 bg-green-500 text-white font-medium rounded-xl disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Approve'}
          </button>
          <button
            onClick={() => handleDecision('rejected')}
            disabled={loading}
            className="flex-1 py-2 bg-red-500 text-white font-medium rounded-xl disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}
