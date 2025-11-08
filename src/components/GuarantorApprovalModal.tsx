import { useState } from 'react';
import { supabase, Member, Loan } from '../lib/supabase';
import { XCircle } from 'lucide-react';

interface GuarantorApprovalModalProps {
  loan: Loan | null; // Loan object needing your approval
  member: Member | null; // current logged-in member
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

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    setLoading(true);
    setError('');

    try {
      // 1️⃣ Update this guarantor's decision in the loan_guarantees table
      const { error: updateError } = await supabase
        .from('loan_guarantees')
        .update({ status: decision })
        .eq('loan_id', loan.id)
        .eq('guarantor_id', member.id);

      if (updateError) throw updateError;

      // 2️⃣ Send notification to the loan requester
      const message =
        decision === 'approved'
          ? `${member.full_name} approved your loan guarantee.`
          : `${member.full_name} rejected your loan guarantee.`;

      await supabase.from('notifications').insert({
        member_id: loan.member_id,
        type: 'guarantor_response',
        title: 'Guarantor Response',
        message,
        recipient_role: 'member',
        metadata: JSON.stringify({
          guarantor_id: member.id,
          loanId: loan.id,
          decision,
        }),
      });

      // 3️⃣ Check if all guarantors have approved
      const { data: guaranteesRes, error: guaranteesError } = await supabase
        .from('loan_guarantees')
        .select('*')
        .eq('loan_id', loan.id);

      if (guaranteesError) throw guaranteesError;

      const allApproved = guaranteesRes?.every((g) => g.status === 'approved') ?? false;
      const anyRejected = guaranteesRes?.some((g) => g.status === 'rejected') ?? false;

      // 4️⃣ If all approved, move loan to pending_admin
      if (allApproved) {
        await supabase.from('loans').update({ status: 'pending_admin' }).eq('id', loan.id);

        // Optional: Notify admin (if you have admin notifications)
        await supabase.from('notifications').insert({
          member_id: null, // or admin ID
          type: 'loan_pending_admin',
          title: 'Loan Ready for Admin Approval',
          message: `Loan ${loan.loan_number} is approved by all guarantors and ready for admin processing.`,
          recipient_role: 'admin',
          metadata: JSON.stringify({ loanId: loan.id }),
        });
      }

      // 5️⃣ If any rejected, mark loan as rejected
      if (anyRejected) {
        await supabase.from('loans').update({ status: 'rejected' }).eq('id', loan.id);

        // Optional: Notify loan requester
        await supabase.from('notifications').insert({
          member_id: loan.member_id,
          type: 'loan_rejected',
          title: 'Loan Rejected',
          message: `Loan ${loan.loan_number} has been rejected by one or more guarantors.`,
          recipient_role: 'member',
          metadata: JSON.stringify({ loanId: loan.id }),
        });
      }

      // Refresh parent data
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
