import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CreditCard, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';

export default function LoanManagement() {
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
      .select(`
        *,
        members!loans_member_id_fkey(*, profiles(*))
      `)
      .order('requested_date', { ascending: false });
    setLoans(data || []);
  };

  // ✅ New amortization function
  const calculateAmortizedValues = (principal: number, annualRate: number, months: number) => {
    const monthlyRate = annualRate / 100 / 12;
    const monthlyPayment =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1);
    const totalRepayable = monthlyPayment * months;
    return { monthlyPayment, totalRepayable };
  };

  // ✅ Approve loan with amortized calculation
  const handleLoanAction = async (
    loanId: string,
    action: 'approve' | 'reject',
    approvedAmount?: number,
    interestRate?: number,
    termMonths?: number
  ) => {
    try {
      if (action === 'approve' && approvedAmount && interestRate !== undefined && termMonths) {
        const { monthlyPayment, totalRepayable } = calculateAmortizedValues(
          approvedAmount,
          interestRate,
          termMonths
        );

        await supabase
          .from('loans')
          .update({
            status: 'approved',
            amount_approved: approvedAmount,
            interest_rate: interestRate,
            term_months: termMonths,
            monthly_payment: monthlyPayment,
            approved_date: new Date().toISOString(),
            approved_by: profile?.id,
            total_repayable: totalRepayable,
            outstanding_balance: totalRepayable,
          })
          .eq('id', loanId);

        const loan = loans.find(l => l.id === loanId);
        await supabase.from('notifications').insert({
          member_id: loan.member_id,
          type: 'loan_approved',
          title: 'Loan Approved',
          message: `Your loan of UGX ${approvedAmount.toLocaleString(
            'en-UG'
          )} has been approved for ${termMonths} months at ${interestRate}% annual interest. Monthly payment: UGX ${monthlyPayment.toFixed(
            0
          )}.`,
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
        description: `Loan disbursement - ${loan.loan_number}`,
        recorded_by: profile?.id,
      });

      await supabase.from('notifications').insert({
        member_id: loan.member_id,
        type: 'loan_disbursed',
        title: 'Loan Disbursed',
        message: `Your loan of UGX ${loan.amount_approved.toLocaleString(
          'en-UG'
        )} has been disbursed to your account.`,
      });

      loadLoans();
    } catch (err) {
      console.error('Error disbursing loan:', err);
    }
  };

  // ✅ Modal for approving loan with amortized values
  const ApprovalModal = ({ loan, onClose }: any) => {
    const [approvedAmount, setApprovedAmount] = useState(loan.amount_requested);
    const [interestRate, setInterestRate] = useState(12); // annual interest
    const [termMonths, setTermMonths] = useState(12);

    const { monthlyPayment, totalRepayable } = calculateAmortizedValues(
      approvedAmount,
      interestRate,
      termMonths
    );

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Approve Loan (Amortized)</h2>

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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interest Rate (Annual %)</label>
                <input
                  type="number"
                  step="0.1"
                  value={interestRate}
                  onChange={(e) => setInterestRate(parseFloat(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Term (Months)</label>
                <input
                  type="number"
                  value={termMonths}
                  onChange={(e) => setTermMonths(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Monthly Payment:</span>
                <span className="font-semibold text-gray-800">
                  UGX {monthlyPayment.toFixed(0).toLocaleString('en-UG')}
                </span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Total Repayable:</span>
                <span className="font-semibold text-[#008080]">
                  UGX {totalRepayable.toFixed(0).toLocaleString('en-UG')}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  handleLoanAction(loan.id, 'approve', approvedAmount, interestRate, termMonths);
                  onClose();
                }}
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

  // (RepaymentModal remains the same as your version)
  // You can reuse your existing repayment modal logic.

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
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Loan Management (Amortized)</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-2xl p-5 card-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Pending</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">
            {loans.filter(l => l.status === 'pending').length}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 card-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Active</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">
            {loans.filter(l => l.status === 'disbursed').length}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 card-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Total Outstanding</span>
          </div>
          <p className="text-2xl font-bold text-[#008080]">
            UGX {loans
              .filter(l => l.status === 'disbursed')
              .reduce((sum, l) => sum + Number(l.outstanding_balance || 0), 0)
              .toLocaleString('en-UG')}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Loan #</th>
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
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{loan.loan_number}</td>
                  <td className="px-6 py-4 text-sm text-gray-800">
                    {loan.members?.profiles?.full_name}
                    <div className="text-xs text-gray-500">{loan.members?.member_number}</div>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                    UGX {Number(loan.amount_requested).toLocaleString('en-UG')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`status-badge ${getStatusColor(loan.status)} flex items-center gap-1.5 w-fit`}>
                      {getStatusIcon(loan.status)}
                      {loan.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-[#008080]">
                    {loan.outstanding_balance
                      ? `UGX ${Number(loan.outstanding_balance).toLocaleString('en-UG')}`
                      : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {loan.status === 'pending' && (
                        <>
                          <button
                            onClick={() => setSelectedLoan(loan)}
                            className="px-3 py-1.5 bg-green-50 text-green-700 text-sm font-medium rounded-lg hover:bg-green-100"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleLoanAction(loan.id, 'reject')}
                            className="px-3 py-1.5 bg-red-50 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {loan.status === 'approved' && (
                        <button
                          onClick={() => handleDisburse(loan.id)}
                          className="px-3 py-1.5 btn-primary text-white text-sm font-medium rounded-lg"
                        >
                          Disburse
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedLoan && !showRepaymentModal && (
        <ApprovalModal loan={selectedLoan} onClose={() => setSelectedLoan(null)} />
      )}
    </div>
  );
}
