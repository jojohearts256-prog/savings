import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CreditCard, CheckCircle, XCircle, Clock, TrendingUp, Loader2 } from 'lucide-react';

export default function LoanManagement() {
  const { profile } = useAuth();
  const [loans, setLoans] = useState<any[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [loading, setLoading] = useState(true); // Added global loading

  // ---------------- Load Loans ----------------
  const loadLoans = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('loans')
        .select(`
          *,
          members!loans_member_id_fkey(*, profiles(*))
        `)
        .order('requested_date', { ascending: false });

      if (error) throw error;
      setLoans(data || []);
    } catch (err) {
      console.error('Error loading loans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLoans();
  }, []);

  // ---------------- Amortization Helpers ----------------
  const calculateMonthlyPayment = (P: number, annualRate: number, months: number) => {
    if (months <= 0) return 0;
    const i = annualRate / 100 / 12;
    if (i === 0) return P / months;
    return (P * i * Math.pow(1 + i, months)) / (Math.pow(1 + i, months) - 1);
  };

  const generateAmortizationSchedule = (P: number, annualRate: number, months: number) => {
    const monthlyRate = annualRate / 100 / 12;
    const monthlyPayment = calculateMonthlyPayment(P, annualRate, months);
    let balance = P;
    const schedule: Array<any> = [];

    for (let m = 1; m <= months; m++) {
      const interest = balance * monthlyRate;
      let principal = monthlyPayment - interest;
      if (m === months) principal = balance;
      balance = Math.max(balance - principal, 0);

      schedule.push({
        month: m,
        payment: Number((principal + interest).toFixed(2)),
        principal: Number(principal.toFixed(2)),
        interest: Number(interest.toFixed(2)),
        balance: Number(balance.toFixed(2)),
      });
    }

    return { monthlyPayment, totalRepayable: monthlyPayment * months, schedule };
  };

  // ---------------- Approve / Reject ----------------
  const handleLoanAction = async (
    loanId: string,
    action: 'approve' | 'reject',
    approvedAmount?: number,
    interestRate?: number,
    loanTerm?: number
  ) => {
    try {
      setLoading(true);
      const loan = loans.find((l) => l.id === loanId);

      if (action === 'approve' && approvedAmount && interestRate && loanTerm) {
        const { monthlyPayment, totalRepayable, schedule } = generateAmortizationSchedule(
          approvedAmount, interestRate, loanTerm
        );

        await supabase.from('loans').update({
          status: 'approved',
          amount_approved: approvedAmount,
          interest_rate: interestRate,
          loan_term: loanTerm,
          monthly_payment: monthlyPayment,
          total_repayable: totalRepayable,
          outstanding_balance: totalRepayable,
          remaining_months: loanTerm,
          amortization_schedule: schedule,
          approved_date: new Date().toISOString(),
          approved_by: profile?.id,
        }).eq('id', loanId);

        await supabase.from('notifications').insert({
          member_id: loan.member_id,
          type: 'loan_approved',
          title: 'Loan Approved',
          message: `Your loan of UGX ${approvedAmount.toLocaleString('en-UG')} has been approved.`,
        });
      } else if (action === 'reject') {
        await supabase.from('loans').update({
          status: 'rejected',
          approved_by: profile?.id,
        }).eq('id', loanId);

        await supabase.from('notifications').insert({
          member_id: loan.member_id,
          type: 'loan_rejected',
          title: 'Loan Rejected',
          message: 'Your loan request has been rejected.',
        });
      }

      await loadLoans(); // refresh immediately
    } catch (err) {
      console.error('Error processing loan:', err);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Disburse ----------------
  const handleDisburse = async (loanId: string) => {
    try {
      setLoading(true);
      const loan = loans.find((l) => l.id === loanId);
      const member = loan.members;

      await supabase.from('loans').update({
        status: 'disbursed',
        disbursed_date: new Date().toISOString(),
      }).eq('id', loanId);

      const newBalance = Number(member.account_balance) + Number(loan.amount_approved);
      await supabase.from('members').update({ account_balance: newBalance }).eq('id', loan.member_id);

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
        message: `Your loan of UGX ${loan.amount_approved.toLocaleString('en-UG')} has been disbursed.`,
      });

      await loadLoans();
    } catch (err) {
      console.error('Error disbursing loan:', err);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Repayment ----------------
  const handleRepayment = async (loan: any, amount: number, notes: string) => {
    try {
      setLoading(true);
      const outstanding = loan.outstanding_balance || 0;
      const annualRate = loan.interest_rate || 0;
      const monthlyRate = annualRate / 100 / 12;

      const interestPortion = outstanding * monthlyRate;
      const principalPortion = Math.max(amount - interestPortion, 0);
      const newOutstanding = Math.max(outstanding - principalPortion, 0);
      const newStatus = newOutstanding <= 0.01 ? 'completed' : loan.status;

      await supabase.from('loan_repayments').insert({
        loan_id: loan.id,
        amount,
        notes,
        interest_portion: interestPortion,
        principal_portion: principalPortion,
        recorded_by: profile?.id,
      });

      await supabase.from('loans').update({
        amount_repaid: (loan.amount_repaid || 0) + amount,
        outstanding_balance: newOutstanding,
        status: newStatus,
      }).eq('id', loan.id);

      await supabase.from('notifications').insert({
        member_id: loan.member_id,
        type: 'loan_repayment',
        title: 'Loan Repayment Recorded',
        message: `A repayment of UGX ${amount.toLocaleString('en-UG')} was recorded.`,
      });

      await loadLoans();
    } catch (err) {
      console.error('Error during repayment:', err);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- UI ----------------
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin w-8 h-8 text-[#008080]" />
        <span className="ml-3 text-gray-600 font-medium">Updating...</span>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Loan Management</h2>

      {/* Summary */}
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
                  <td className="px-6 py-4 text-sm">
                    <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 capitalize">
                      {loan.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-[#008080]">
                    {loan.outstanding_balance ? `UGX ${Number(loan.outstanding_balance).toLocaleString('en-UG')}` : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm flex gap-2">
                    {loan.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleLoanAction(loan.id, 'approve', loan.amount_requested, 5, 12)}
                          className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleLoanAction(loan.id, 'reject')}
                          className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {loan.status === 'approved' && (
                      <button
                        onClick={() => handleDisburse(loan.id)}
                        className="px-3 py-1.5 bg-[#008080] text-white rounded-lg hover:bg-teal-700"
                      >
                        Disburse
                      </button>
                    )}
                    {loan.status === 'disbursed' && (
                      <button
                        onClick={() => handleRepayment(loan, 50000, 'Monthly repayment')}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                      >
                        Repay UGX 50,000
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
