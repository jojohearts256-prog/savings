import { supabase, Loan, Member, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CreditCard, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';

// Optional: import GuarantorApprovalModal if using a separate modal for guarantors
import GuarantorApprovalModal from './GuarantorApprovalModal';

export default function LoanManagement() {
  const { profile } = useAuth();
  const [loans, setLoans] = useState<any[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [showGuarantorModal, setShowGuarantorModal] = useState(false);

  useEffect(() => {
    loadLoans();
  }, []);

  const loadLoans = async () => {
    const { data } = await supabase
      .from('loans')
      .select(
        `*, members!loans_member_id_fkey(*, profiles(*)), loan_guarantees(*)`
      )
      .order('requested_date', { ascending: false });

    setLoans(data || []);
  };

  // Admin approve/reject loan action
  const handleLoanAction = async (
    loanId: string,
    action: 'approve' | 'reject',
    approvedAmount?: number,
    interestRate?: number
  ) => {
    try {
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

        const loan = loans.find(l => l.id === loanId);
        await supabase.from('notifications').insert({
          member_id: loan.member_id,
          type: 'loan_approved',
          title: 'Loan Approved',
          message: `Your loan request of UGX ${approvedAmount.toLocaleString('en-UG')} has been approved at ${interestRate}% interest.`,
        });
      } else if (action === 'reject') {
        await supabase
          .from('loans')
          .update({ status: 'rejected', approved_by: profile?.id })
          .eq('id', loanId);

        const loan = loans.find(l => l.id === loanId);
        await supabase.from('notifications').insert({
          member_id: loan.member_id,
          type: 'loan_rejected',
          title: 'Loan Rejected',
          message: 'Your loan request has been reviewed and could not be approved at this time.',
        });
      }

      loadLoans();
    } catch (err) {
      console.error('Error processing loan:', err);
    }
  };

  // Disburse approved loan
  const handleDisburse = async (loanId: string) => {
    try {
      const loan = loans.find(l => l.id === loanId);

      await supabase
        .from('loans')
        .update({ status: 'disbursed', disbursed_date: new Date().toISOString() })
        .eq('id', loanId);

      const member = loan.members;
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

      await supabase.from('notifications').insert({
        member_id: loan.member_id,
        type: 'loan_disbursed',
        title: 'Loan Disbursed',
        message: `Your loan of UGX ${loan.amount_approved.toLocaleString('en-UG')} has been disbursed to your account.`,
      });

      loadLoans();
    } catch (err) {
      console.error('Error disbursing loan:', err);
    }
  };

  // Admin/Member repayment modal
  const RepaymentModal = ({ loan, onClose }: any) => {
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
        const repaymentAmount = parseFloat(amount.replace(/,/g, ''));
        let principalRemaining = Number(loan.outstanding_balance);
        let interest = principalRemaining * (loan.interest_rate / 100);
        let newOutstanding = principalRemaining - repaymentAmount + interest;

        await supabase.from('loan_repayments').insert({
          loan_id: loan.id,
          amount: repaymentAmount,
          recorded_by: profile?.id,
          notes,
        });

        await supabase
          .from('loans')
          .update({
            amount_repaid: Number(loan.amount_repaid) + repaymentAmount,
            outstanding_balance: newOutstanding <= 0 ? 0 : newOutstanding,
            status: newOutstanding <= 0 ? 'completed' : 'disbursed',
          })
          .eq('id', loan.id);

        await supabase.from('notifications').insert({
          member_id: loan.member_id,
          type: 'loan_repayment',
          title: 'Loan Repayment Recorded',
          message: `A repayment of UGX ${repaymentAmount.toLocaleString('en-UG')} has been recorded. Outstanding balance: UGX ${newOutstanding.toLocaleString('en-UG')}`,
        });

        onClose();
        loadLoans();
      } catch (err) {
        console.error('Error recording repayment:', err);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Record Repayment</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-blue-50 rounded-xl p-4 mb-4">
              <p className="text-sm text-gray-600 mb-1">Outstanding Balance</p>
              <p className="text-2xl font-bold text-[#008080]">UGX {Number(loan.outstanding_balance).toLocaleString('en-UG')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Amount (UGX)</label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
                rows={2}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 btn-primary text-white font-medium rounded-xl disabled:opacity-50"
              >
                {loading ? 'Recording...' : 'Record Repayment'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Check if loan needs guarantor approval
  const handleOpenGuarantorModal = (loan: any) => {
    if (loan.loan_guarantees && loan.loan_guarantees.length > 0) {
      setSelectedLoan(loan);
      setShowGuarantorModal(true);
    } else {
      alert('No guarantors assigned to this loan.');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      case 'disbursed': return <CreditCard className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'disbursed': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Loan Management</h2>
      {/* ... dashboard summary & table code remains unchanged ... */}

      {selectedLoan && showGuarantorModal && (
        <GuarantorApprovalModal
          loan={selectedLoan}
          member={profile} // current logged-in user as guarantor
          onClose={() => { setSelectedLoan(null); setShowGuarantorModal(false); loadLoans(); }}
          onSuccess={() => loadLoans()}
        />
      )}

      {selectedLoan && showRepaymentModal && (
        <RepaymentModal
          loan={selectedLoan}
          onClose={() => { setSelectedLoan(null); setShowRepaymentModal(false); loadLoans(); }}
        />
      )}
    </div>
  );
}
