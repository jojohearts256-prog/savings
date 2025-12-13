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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!loan || !member) return null;

  const handleDecision = async (decision: 'accepted' | 'declined') => {
    setLoading(true);
    setError('');

    try {
      // 1️⃣ Fetch the loan record from 'loans' table to get the guarantors JSON
      const { data: loanData, error: fetchError } = await supabase
        .from('loans')
        .select('id, loan_number, member_id, guarantors')
        .eq('id', loan.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!loanData) throw new Error('Loan not found');

      // 2️⃣ Update the current member's status in the guarantors JSON
      const updatedGuarantors = (loanData.guarantors || []).map((g: any) => {
        if (g.member_id === member.id) {
          return { ...g, status: decision };
        }
        return g;
      });

      const { error: updateError } = await supabase
        .from('loans')
        .update({ guarantors: updatedGuarantors })
        .eq('id', loan.id);

      if (updateError) throw updateError;

      // 3️⃣ Notify the loan member about this guarantor's decision
      await supabase.from('notifications').insert({
        member_id: loanData.member_id,
        type: 'guarantor_response',
        title: 'Guarantor Response',
        message:
          decision === 'accepted'
            ? `${member.full_name} accepted your loan guarantee.`
            : `${member.full_name} declined your loan guarantee.`,
        metadata: JSON.stringify({
          guarantor_id: member.id,
          loanId: loan.id,
          decision,
        }),
        sent_at: new Date(),
        read: false,
      });

      // 4️⃣ Check if all guarantors have accepted
      const allAccepted = updatedGuarantors.every((g: any) => g.status === 'accepted');

      if (allAccepted) {
        // Notify admin
        await supabase.from('notifications').insert({
          member_id: null, // admin notifications
          type: 'loan_ready_for_admin',
          title: 'Loan Ready for Approval',
          message: `Loan ${loan.loan_number} by member ${loanData.member_id} has all guarantor approvals.`,
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
          Loan <strong>{loan.loan_number}</strong> requested by member ID{' '}
          <strong>{loan.member_id}</strong> needs your approval.
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => handleDecision('accepted')}
            disabled={loading}
            className="flex-1 py-2 bg-green-500 text-white font-medium rounded-xl disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Accept'}
          </button>
          <button
            onClick={() => handleDecision('declined')}
            disabled={loading}
            className="flex-1 py-2 bg-red-500 text-white font-medium rounded-xl disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Decline'}
          </button>
        </div>
      </div>
    </div>
  );
}
