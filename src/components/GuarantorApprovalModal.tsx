import { useState } from 'react';
import { supabase, MemberWithProfile, LoanWithGuarantors } from '../lib/supabase';
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

      // Map frontend decision to DB-allowed values
      // Accept → 'pending' (waiting for admin), Decline → 'declined'
      const dbStatus = status === 'decline' ? 'declined' : 'pending';

      const { error: upsertError } = await supabase
        .from('loan_guarantees')
        .upsert(
          {
            loan_id: loan.id,
            guarantor_id: member.id,
            amount_guaranteed: guarantorAmount,
            status: dbStatus,
          },
          { onConflict: 'loan_id,guarantor_id' }
        );

      if (upsertError) throw upsertError;

      // Notify borrower about guarantor response
      await supabase.from('notifications').insert({
        member_id: loan.member_id,
        type: 'guarantor_response',
        title: 'Guarantor Response',
        message:
          status === 'accept'
            ? `${member.full_name ?? 'A guarantor'} accepted your loan guarantee.`
            : `${member.full_name ?? 'A guarantor'} declined your loan guarantee.`,
        metadata: JSON.stringify({ guarantor_id: member.id, loanId: loan.id, status: dbStatus }),
        sent_at: new Date(),
        read: false,
      });

      // Fetch all guarantors for this loan
      const { data: allGuarantors, error: fetchError } = await supabase
        .from('loan_guarantees')
        .select('*')
        .eq('loan_id', loan.id);

      if (fetchError) throw fetchError;

      const validGuarantors = (allGuarantors as any[]).filter((g) => g.amount_guaranteed > 0) || [];

      // If any guarantor declined → reject loan
      const anyDeclined = validGuarantors.some((g) => g.status === 'declined');
      if (anyDeclined) {
        await supabase.from('loans').update({ status: 'rejected' }).eq('id', loan.id);

        await supabase.from('notifications').insert({
          member_id: loan.member_id,
          type: 'loan_rejected_by_guarantor',
          title: 'Loan Declined by Guarantor',
          message: `Your loan ${loan.loan_number} was declined because a guarantor did not approve.`,
          metadata: JSON.stringify({ loanId: loan.id }),
          sent_at: new Date(),
          read: false,
        });

        onSuccess();
        onClose();
        return;
      }

      // If all guarantors approved → mark loan as pending for admin
      const allApproved = validGuarantors.length > 0 && validGuarantors.every((g) => g.status === 'pending');

      if (allApproved) {
        await supabase.from('loans').update({ status: 'pending' }).eq('id', loan.id);

        const { data: borrower } = await supabase
          .from('members')
          .select('full_name')
          .eq('id', loan.member_id)
          .maybeSingle();

        await supabase.from('notifications').insert({
          member_id: null,
          type: 'loan_ready_for_admin',
          title: 'Loan Ready for Approval',
          message: `Loan request ${loan.loan_number} by ${borrower?.full_name ?? String(loan.member_id)} has been approved by all guarantors and is ready for your review.`,
          metadata: JSON.stringify({ loanId: loan.id }),
          sent_at: new Date(),
          read: false,
        });

        // Notify all guarantors that all have approved
        for (const g of validGuarantors) {
          await supabase.from('notifications').insert({
            member_id: g.guarantor_id,
            type: 'loan_guarantors_all_approved',
            title: 'All Guarantors Approved',
            message: `All guarantors have approved loan ${loan.loan_number}. The loan has been forwarded to admin for final review.`,
            metadata: JSON.stringify({ loanId: loan.id }),
            sent_at: new Date(),
            read: false,
          });
        }
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
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition">
          <XCircle className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-bold text-gray-800 mb-4">Loan Guarantee Approval</h2>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">{error}</div>}

        <p className="mb-4">
          Loan <strong>{loan.loan_number}</strong> requested by member <strong>{loan.member_id}</strong> needs your approval.
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => handleDecision('accept')}
            disabled={loadingAccept || loadingDecline}
            className="flex-1 py-2 bg-green-500 text-white font-medium rounded-xl disabled:opacity-50"
          >
            {loadingAccept ? 'Processing...' : 'Accept'}
          </button>

          <button
            onClick={() => handleDecision('decline')}
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
