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
      decision === 'accept'
        ? setLoadingAccept(true)
        : setLoadingDecline(true);

      const guarantorAmount =
        loan.guarantors?.find((g) => g.guarantor_id === member.id)
          ?.amount_guaranteed ?? 0;

      if (guarantorAmount <= 0) {
        throw new Error('Invalid guaranteed amount');
      }

      const guarantorStatus: 'pending' | 'declined' =
        decision === 'decline' ? 'declined' : 'pending';

      // 1️⃣ Save THIS guarantor decision only
      const { error: upsertError } = await supabase
        .from('loan_guarantees')
        .upsert(
          {
            loan_id: loan.id,
            guarantor_id: member.id,
            amount_guaranteed: guarantorAmount,
            status: guarantorStatus,
          },
          { onConflict: 'loan_id,guarantor_id' }
        );

      if (upsertError) throw upsertError;

      // ✅ FORCE modal close immediately
      onSuccess();
      onClose();

      // ================= BACKGROUND LOGIC =================

      // Notify borrower (non-blocking)
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
          status: guarantorStatus,
        },
      }).catch(console.warn);

      // 2️⃣ Fetch ALL guarantees for this loan
      const { data: allGuarantees, error: fetchError } = await supabase
        .from('loan_guarantees')
        .select('*')
        .eq('loan_id', loan.id);

      if (fetchError || !allGuarantees) return;

      // 3️⃣ Expected guarantors (from loan setup)
      const expectedGuarantorIds =
        loan.guarantors?.map((g) => g.guarantor_id) ?? [];

      // Only valid guarantees (must exist + amount > 0)
      const validGuarantees = allGuarantees.filter(
        (g) =>
          expectedGuarantorIds.includes(g.guarantor_id) &&
          Number(g.amount_guaranteed) > 0
      );

      // ❌ ANY decline → reject loan immediately
      if (validGuarantees.some((g) => g.status === 'declined')) {
        await supabase
          .from('loans')
          .update({ status: 'rejected' })
          .eq('id', loan.id);

        await sendNotification({
          member_id: loan.member_id,
          type: 'loan_rejected_by_guarantor',
          title: 'Loan Declined',
          message: `Your loan ${loan.loan_number} was declined by a guarantor.`,
          metadata: { loanId: loan.id },
        });

        return;
      }

      // 4️⃣ HARD RULE: all EXPECTED guarantors must exist
      if (validGuarantees.length !== expectedGuarantorIds.length) {
        return; // still waiting for others
      }

      // 5️⃣ HARD RULE: ALL must be approved (`pending`)
      const allApproved = validGuarantees.every(
        (g) => g.status === 'pending'
      );

      if (!allApproved) return;

      // 6️⃣ Forward loan to admin
      await supabase
        .from('loans')
        .update({ status: 'pending' })
        .eq('id', loan.id);

      const { data: borrower } = await supabase
        .from('members')
        .select('full_name')
        .eq('id', loan.member_id)
        .maybeSingle();

      const guarantorIds = validGuarantees.map((g) => g.guarantor_id);

      const { data: guarantorProfiles } = await supabase
        .from('members')
        .select('id, full_name')
        .in('id', guarantorIds);

      const guarantorDetails = validGuarantees
        .map((g) => {
          const p = guarantorProfiles?.find(
            (x) => x.id === g.guarantor_id
          );
          return `${p?.full_name ?? g.guarantor_id} pledged UGX ${Number(
            g.amount_guaranteed
          ).toLocaleString()}`;
        })
        .join('; ');

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
