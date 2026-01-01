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

  const handleDecision = async (decision: 'accept' | 'decline') => {
    try {
      setError('');
      decision === 'accept' ? setLoadingAccept(true) : setLoadingDecline(true);

      const guarantorAmount =
        loan.guarantors?.find((g) => g.guarantor_id === member.id)
          ?.amount_guaranteed ?? 0;

      if (guarantorAmount <= 0) {
        throw new Error('Invalid guaranteed amount');
      }

      // ✅ DB-SAFE statuses ONLY
      const finalStatus: 'pending' | 'declined' =
        decision === 'decline' ? 'declined' : 'pending';

      // ⬇️ Write guarantor decision
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

      onClose();
      onSuccess();

      // Notify borrower
      sendNotification({
        member_id: loan.member_id,
        type: 'guarantor_response',
        title: 'Guarantor Response',
        message:
          decision === 'accept'
            ? `${member.full_name ?? 'A guarantor'} accepted your loan guarantee.`
            : `${member.full_name ?? 'A guarantor'} declined your loan guarantee.`,
        metadata: {
          guarantor_id: member.id,
          loanId: loan.id,
          status: finalStatus,
        },
      }).catch(console.warn);

      // ⬇️ Fetch all guarantors
      const { data: allGuarantors, error: fetchError } = await supabase
        .from('loan_guarantees')
        .select('*')
        .eq('loan_id', loan.id);

      if (fetchError) throw fetchError;

      const validGuarantors =
        (allGuarantors ?? []).filter((g) => Number(g.amount_guaranteed) > 0);

      // ❌ If ANY guarantor declined → reject loan
      if (validGuarantors.some((g) => g.status === 'declined')) {
        await supabase.from('loans').update({ status: 'rejected' }).eq('id', loan.id);

        await sendNotification({
          member_id: loan.member_id,
          type: 'loan_rejected_by_guarantor',
          title: 'Loan Declined',
          message: `Your loan ${loan.loan_number} was declined by a guarantor.`,
          metadata: { loanId: loan.id },
        });

        return;
      }

      // ✅ ALL guarantors approved → all must be `pending`
      const allApproved =
        validGuarantors.length > 0 &&
        validGuarantors.every((g) => g.status === 'pending');

      if (!allApproved) return;

      // ⬇️ Forward loan to admin
      await supabase.from('loans').update({ status: 'pending' }).eq('id', loan.id);

      const { data: borrower } = await supabase
        .from('members')
        .select('full_name')
        .eq('id', loan.member_id)
        .maybeSingle();

      const guarantorIds = validGuarantors.map((g) => g.guarantor_id);

      const { data: guarantorProfiles } = await supabase
        .from('members')
        .select('id, full_name')
        .in('id', guarantorIds);

      const guarantorDetails = validGuarantors
        .map((g) => {
          const p = guarantorProfiles?.find((x) => x.id === g.guarantor_id);
          return `${p?.full_name ?? g.guarantor_id} pledged UGX ${Number(
            g.amount_guaranteed
          ).toLocaleString()}`;
        })
        .join('; ');

      // Notify admin
      await sendNotification({
        member_id: null,
        recipient_role: 'admin',
        type: 'loan_ready_for_admin',
        title: 'Loan Ready for Approval',
        message: `Loan ${loan.loan_number} requested by ${
          borrower?.full_name ?? loan.member_id
        } has all guarantors approved: ${guarantorDetails}.`,
        metadata: { loanId: loan.id },
      });

      // Notify borrower
      await sendNotification({
        member_id: loan.member_id,
        type: 'loan_guarantors_approved',
        title: 'Guarantors Approved',
        message: `All guarantors approved your loan ${loan.loan_number}. It is now with admin.`,
        metadata: { loanId: loan.id },
      });
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
