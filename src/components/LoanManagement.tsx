import { supabase } from '../lib/supabase';
import { sendNotification } from '../lib/notify';
import { useAuth } from '../contexts/AuthContext';
import { CreditCard, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function LoanManagement({ isHelper = false }: { isHelper?: boolean }) {
  const { profile } = useAuth();
  const [loans, setLoans] = useState<any[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
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
        await sendNotification({
          member_id: loan.member_id,
          type: 'loan_approved',
          title: 'Loan Approved',
          message: `Your loan request of UGX ${approvedAmount.toLocaleString('en-UG')} has been approved at ${interestRate}% interest.`,
        });
      } else if (action === 'reject') {
        await supabase
          .from('loans')
          .update({
            status: 'rejected',
            approved_by: profile?.id,
          })
          .eq('id', loanId);

        const loan = loans.find(l => l.id === loanId);
        await sendNotification({
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

  const handleDisburse = async (loanId: string) => {
    try {
      const loan = loans.find(l => l.id === loanId);

      await supabase
        .from('loans')
        .update({
          status: 'disbursed',
          disbursed_date: new Date().toISOString(),
        })
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
      } catch (notifyErr) {
        console.warn('Failed to send loan disbursement notification', notifyErr);
      }

      loadLoans();
    } catch (err) {
      console.error('Error disbursing loan:', err);
    }
  };

  const ApprovalModal = ({ loan, onClose }: any) => {
    const [approvedAmount, setApprovedAmount] = useState(loan.amount_requested);
    const [interestRate, setInterestRate] = useState(5);
    const totalRepayable = approvedAmount + (approvedAmount * interestRate / 100);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Approve Loan</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Approved Amount (UGX)</label>
              <input
                type="text"
                value={approvedAmount.toLocaleString('en-UG')}
                onChange={(e) => setApprovedAmount(Number(e.target.value.replace(/,/g, '')))}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Interest Rate (%)</label>
              <input
                type="number"
                step="0.1"
                value={interestRate}
                onChange={(e) => setInterestRate(parseFloat(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
              />
            </div>

            <div className="bg-blue-50 rounded-xl p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Principal:</span>
                <span className="font-semibold text-gray-800">UGX {approvedAmount.toLocaleString('en-UG')}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Interest ({interestRate}%):</span>
                <span className="font-semibold text-gray-800">UGX {(approvedAmount * interestRate / 100).toLocaleString('en-UG')}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t border-blue-200 pt-2 mt-2">
                <span className="text-gray-800">Total Repayable:</span>
                <span className="text-[#008080]">UGX {totalRepayable.toLocaleString('en-UG')}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => { handleLoanAction(loan.id, 'approve', approvedAmount, interestRate); onClose(); }}
                className="flex-1 py-2 btn-primary text-white font-medium rounded-xl"
              >
                Approve Loan
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

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
        const newPrincipal = principalRemaining - repaymentAmount;
        const newInterest = newPrincipal * (loan.interest_rate / 100);
        const newOutstanding = newPrincipal + newInterest;

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

        await sendNotification({
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-2xl p-5 card-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Pending</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{loans.filter(l => l.status === 'pending').length}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 card-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Active</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{loans.filter(l => l.status === 'disbursed').length}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 card-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Total Outstanding</span>
          </div>
          <p className="text-2xl font-bold text-[#008080]">
            UGX {loans.filter(l => l.status === 'disbursed').reduce((sum, l) => sum + Number(l.outstanding_balance || 0), 0).toLocaleString('en-UG')}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Member</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Outstanding</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loans.map((loan) => (
                <tr key={loan.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-800">
                    {loan.member_name}
                    <div className="text-xs text-gray-500">{loan.member_number}</div>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                    UGX {Number(loan.amount_requested).toLocaleString('en-UG')}
                    {loan.amount_approved && loan.amount_approved !== loan.amount_requested && (
                      <div className="text-xs text-green-600">Approved: UGX {Number(loan.amount_approved).toLocaleString('en-UG')}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`status-badge ${getStatusColor(loan.status)} flex items-center gap-1.5 w-fit`}>
                      {getStatusIcon(loan.status)}
                      {loan.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-[#008080]">
                    {loan.outstanding_balance ? `UGX ${Number(loan.outstanding_balance).toLocaleString('en-UG')}` : '-'}
                  </td>
                  <td className="px-6 py-4">
                    {!isHelper ? (
                      <div className="flex gap-2">
                        {loan.status === 'pending' && (
                          <>
                            <button
                              onClick={() => setSelectedLoan(loan)}
                              className="px-3 py-1.5 bg-green-600 text-white rounded-xl text-xs"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleLoanAction(loan.id, 'reject')}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {loan.status === 'approved' && (
                          <button
                            onClick={() => handleDisburse(loan.id)}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs"
                          >
                            Disburse
                          </button>
                        )}
                        {loan.status === 'disbursed' && (
                          <button
                            onClick={() => { setSelectedLoan(loan); setShowRepaymentModal(true); }}
                            className="px-3 py-1.5 bg-orange-500 text-white rounded-xl text-xs"
                          >
                            Repay
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">View Only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedLoan && <ApprovalModal loan={selectedLoan} onClose={() => setSelectedLoan(null)} />}
      {selectedLoan && showRepaymentModal && <RepaymentModal loan={selectedLoan} onClose={() => { setSelectedLoan(null); setShowRepaymentModal(false); }} />}
    </div>
  );
}
