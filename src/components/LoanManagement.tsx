import { supabase } from '../lib/supabase';
import { sendNotification } from '../lib/notify';
import { notifyUser } from '../lib/notifyUser';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import LoanTable from './loan-management/LoanTable';
import ApprovalModal from './loan-management/ApprovalModal';
import RepaymentModal from './loan-management/RepaymentModal';
import LoanStats from './loan-management/LoanStats';
import type { Loan } from './loan-management/types';

export default function LoanManagement({ isHelper = false }: { isHelper?: boolean }) {
  const { profile } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);

  useEffect(() => {
    loadLoans();
  }, []);

  const loadLoans = async () => {
    const { data } = await supabase
      .from('loans')
      .select(
        `*, members!loans_member_id_fkey(*, profiles(*))`
      )
      .order('requested_date', { ascending: false });

    // Flatten member name and number for easier rendering in the table
    const flattened = (data || []).map((d: any) => ({
      ...d,
      member_name: d?.members?.profiles?.full_name || d?.members?.full_name || d?.member_id,
      member_number: d?.members?.member_number || '',
    }));

    setLoans(flattened);
  };

  const handleLoanAction = async (loanId: string, action: 'approve' | 'reject', approvedAmount?: number, interestRate?: number) => {
    try {
      const toastId = toast.loading(action === 'approve' ? 'Approving loan...' : 'Rejecting loan...');

      if (action === 'approve' && approvedAmount && interestRate !== undefined) {
        const totalRepayable = approvedAmount + (approvedAmount * interestRate / 100);

        await supabase
          .from('loans')
          .update({
            status: 'approved',
            amount_approved: approvedAmount,
            interest_rate: interestRate,
            approved_date: new Date().toISOString(),
            approved_by: profile?.id,
            total_repayable: totalRepayable,
            outstanding_balance: approvedAmount,
          })
          .eq('id', loanId);

        const loan = loans.find((l) => l.id === loanId);
        if (loan) {
          await sendNotification({
            member_id: loan.member_id,
          type: 'loan_approved',
          title: 'Loan Approved',
          message: `Your loan request of UGX ${approvedAmount.toLocaleString('en-UG')} has been approved at ${interestRate}% interest.`,
          });

          // Non-fatal edge-function notification hook
          try {
            await notifyUser({
              user_id: String(loan.member_id),
              loan_id: loan.id,
              loan_status: 'approved',
              message: `Your loan request of UGX ${approvedAmount.toLocaleString('en-UG')} has been approved at ${interestRate}% interest.`,
            });
          } catch (e) {
            console.warn('notifyUser failed (loan approved)', e);
          }
        }

        toast.success('Loan approved', { id: toastId });
      } else if (action === 'reject') {
        await supabase
          .from('loans')
          .update({
            status: 'rejected',
            approved_by: profile?.id,
          })
          .eq('id', loanId);

        const loan = loans.find((l) => l.id === loanId);
        if (loan) {
          await sendNotification({
            member_id: loan.member_id,
          type: 'loan_rejected',
          title: 'Loan Rejected',
          message: 'Your loan request has been reviewed and could not be approved at this time.',
          });

          // Non-fatal edge-function notification hook
          try {
            await notifyUser({
              user_id: String(loan.member_id),
              loan_id: loan.id,
              loan_status: 'rejected',
              message: 'Your loan request has been reviewed and could not be approved at this time.',
            });
          } catch (e) {
            console.warn('notifyUser failed (loan rejected)', e);
          }
        }

        toast.success('Loan rejected', { id: toastId });
      }

      loadLoans();
    } catch (err) {
      console.error('Error processing loan:', err);
      toast.error('Failed to process loan');
    }
  };

  const handleDisburse = async (loanId: string) => {
    try {
      const toastId = toast.loading('Disbursing loan...');
      const loan = loans.find(l => l.id === loanId);
      if (!loan) return;

      await supabase
        .from('loans')
        .update({
          status: 'disbursed',
          disbursed_date: new Date().toISOString(),
        })
        .eq('id', loanId);

  const member = loan.members;
  if (!member) return;
      const newBalance = Number(member.account_balance) + Number(loan.amount_approved);

      await supabase
        .from('members')
        .update({ account_balance: newBalance })
        .eq('id', loan.member_id);

      await supabase.from('transactions').insert({
        member_id: loan.member_id,
        transaction_type: 'deposit',
        amount: loan.amount_approved,
        balance_before: member.account_balance,
        balance_after: newBalance,
        description: `Loan disbursement`,
        recorded_by: profile?.id,
      });

      // Notify borrower about disbursement including new balance
      try {
        const amountFormatted = Number(loan.amount_approved).toLocaleString('en-UG');
        const balanceFormatted = Number(newBalance).toLocaleString('en-UG');
        await sendNotification({
          member_id: loan.member_id,
          type: 'loan_disbursed',
          title: 'Loan Disbursed',
          message: `Your loan of UGX ${amountFormatted} has been disbursed to your account. New balance: UGX ${balanceFormatted}.`,
          metadata: { loanId: loan.id },
        });

        // Non-fatal edge-function notification hook
        try {
          await notifyUser({
            user_id: String(loan.member_id),
            loan_id: loan.id,
            loan_status: 'disbursed',
            message: `Your loan of UGX ${amountFormatted} has been disbursed to your account. New balance: UGX ${balanceFormatted}.`,
          });
        } catch (e) {
          console.warn('notifyUser failed (loan disbursed)', e);
        }
      } catch (notifyErr) {
        console.warn('Failed to send loan disbursement notification', notifyErr);
      }

      loadLoans();

      toast.success('Loan disbursed', { id: toastId });
    } catch (err) {
      console.error('Error disbursing loan:', err);
      toast.error('Failed to disburse loan');
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Loan Management</h2>

      <LoanStats loans={loans} />

      <LoanTable
        loans={loans}
        isHelper={isHelper}
        onApprove={(loan) => {
          setSelectedLoan(loan);
          setShowRepaymentModal(false);
        }}
        onReject={(loan) => handleLoanAction(loan.id, 'reject')}
        onDisburse={(loan) => handleDisburse(loan.id)}
        onRepay={(loan) => {
          setSelectedLoan(loan);
          setShowRepaymentModal(true);
        }}
      />

      {selectedLoan && !showRepaymentModal && selectedLoan.status === 'pending' && (
        <ApprovalModal
          loan={selectedLoan}
          onClose={() => setSelectedLoan(null)}
          onApprove={(approvedAmount, interestRate) =>
            handleLoanAction(selectedLoan.id, 'approve', approvedAmount, interestRate)
          }
        />
      )}

      {selectedLoan && showRepaymentModal && (
        <RepaymentModal
          loan={selectedLoan}
          onClose={() => {
            setSelectedLoan(null);
            setShowRepaymentModal(false);
          }}
          onRecord={async (repaymentAmount, notes) => {
            let principalRemaining = Number(selectedLoan.outstanding_balance);
            const newPrincipal = principalRemaining - repaymentAmount;
            const newInterest = newPrincipal * (Number(selectedLoan.interest_rate) / 100);
            const newOutstanding = newPrincipal + newInterest;

            await supabase.from('loan_repayments').insert({
              loan_id: selectedLoan.id,
              amount: repaymentAmount,
              recorded_by: profile?.id,
              notes,
            });

            await supabase
              .from('loans')
              .update({
                amount_repaid: Number(selectedLoan.amount_repaid) + repaymentAmount,
                outstanding_balance: newOutstanding <= 0 ? 0 : newOutstanding,
                status: newOutstanding <= 0 ? 'completed' : 'disbursed',
              })
              .eq('id', selectedLoan.id);

            await sendNotification({
              member_id: selectedLoan.member_id,
              type: 'loan_repayment',
              title: 'Loan Repayment Recorded',
              message: `A repayment of UGX ${repaymentAmount.toLocaleString('en-UG')} has been recorded. Outstanding balance: UGX ${newOutstanding.toLocaleString('en-UG')}`,
            });

            // Non-fatal edge-function notification hook
            try {
              await notifyUser({
                user_id: String(selectedLoan.member_id),
                loan_id: selectedLoan.id,
                message: `A repayment of UGX ${repaymentAmount.toLocaleString('en-UG')} has been recorded. Outstanding balance: UGX ${newOutstanding.toLocaleString('en-UG')}`,
              });
            } catch (e) {
              console.warn('notifyUser failed (loan repayment)', e);
            }

            await loadLoans();
          }}
        />
      )}
    </div>
  );
}
