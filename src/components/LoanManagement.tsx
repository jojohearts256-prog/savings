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
    const { data, error } = await supabase
      .from('loans')
      .select(`
        *,
        members!loans_member_id_fkey (
          id,
          member_number,
          account_balance,
          profiles (full_name, phone_number)
        )
      `)
      .order('requested_date', { ascending: false });

    if (error) console.error(error);
    setLoans(data || []);
  };

  // ----------------- Helper functions -----------------
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
      const payment = principal + interest;
      balance = Math.max(balance - principal, 0);
      schedule.push({
        month: m,
        payment: Number(payment.toFixed(2)),
        principal: Number(principal.toFixed(2)),
        interest: Number(interest.toFixed(2)),
        balance: Number(balance.toFixed(2)),
      });
    }

    return { monthlyPayment, totalRepayable: monthlyPayment * months, schedule };
  };
  // ----------------------------------------------------

  // ---------------- Approve / Reject ------------------
  const handleLoanAction = async (
    loanId: string,
    action: 'approve' | 'reject',
    approvedAmount?: number,
    interestRate?: number,
    loanTerm?: number
  ) => {
    try {
      if (action === 'approve' && approvedAmount && interestRate !== undefined && loanTerm && loanTerm > 0) {
        const { monthlyPayment, totalRepayable, schedule } = generateAmortizationSchedule(
          approvedAmount,
          interestRate,
          loanTerm
        );

        await supabase
          .from('loans')
          .update({
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
          })
          .eq('id', loanId);

        const loan = loans.find((l) => l.id === loanId);
        await supabase.from('notifications').insert({
          member_id: loan.member_id,
          type: 'loan_approved',
          title: 'Loan Approved',
          message: `Your loan of UGX ${approvedAmount.toLocaleString(
            'en-UG'
          )} has been approved for ${loanTerm} months at ${interestRate}% interest. Monthly payment: UGX ${Math.round(
            monthlyPayment
          ).toLocaleString('en-UG')}.`,
        });
      } else {
        await supabase
          .from('loans')
          .update({
            status: 'rejected',
            approved_by: profile?.id,
          })
          .eq('id', loanId);

        const loan = loans.find((l) => l.id === loanId);
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
  // ----------------------------------------------------

  // ---------------- Disbursement ----------------------
  const handleDisburse = async (loanId: string) => {
    try {
      const loan = loans.find((l) => l.id === loanId);
      const member = loan.members;

      await supabase
        .from('loans')
        .update({
          status: 'disbursed',
          disbursed_date: new Date().toISOString(),
        })
        .eq('id', loanId);

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
        message: `Your loan of UGX ${loan.amount_approved.toLocaleString(
          'en-UG'
        )} has been disbursed to your account.`,
      });

      loadLoans();
    } catch (err) {
      console.error('Error disbursing loan:', err);
    }
  };
  // ----------------------------------------------------

  // ---------------- Repayment Logic -------------------
  const applyManualRepayment = (outstanding: number, annualRate: number, repaymentAmount: number) => {
    const monthlyRate = annualRate / 100 / 12;
    const interestDue = outstanding * monthlyRate;
    const interestPortion = Math.min(repaymentAmount, interestDue);
    const principalPortion = Math.max(repaymentAmount - interestPortion, 0);
    const newOutstanding = Math.max(outstanding - principalPortion, 0);
    return { interestPortion, principalPortion, newOutstanding };
  };

  const applyEmiRepayment = (outstanding: number, annualRate: number, monthlyPayment: number) => {
    const monthlyRate = annualRate / 100 / 12;
    const interestPortion = outstanding * monthlyRate;
    let principalPortion = monthlyPayment - interestPortion;
    if (principalPortion < 0) principalPortion = 0;
    if (monthlyPayment >= outstanding + interestPortion) principalPortion = outstanding;
    const newOutstanding = Math.max(outstanding - principalPortion, 0);
    return { interestPortion, principalPortion, newOutstanding };
  };

  const handleRepayment = async (loan: any, repaymentAmount: number, notes: string, mode: 'manual' | 'emi') => {
    try {
      const outstanding = Number(loan.outstanding_balance || 0);
      const annualRate = Number(loan.interest_rate || 0);
      let interestPortion = 0;
      let principalPortion = 0;
      let newOutstanding = outstanding;

      if (mode === 'emi') {
        const monthlyPayment = Number(
          loan.monthly_payment ||
            calculateMonthlyPayment(loan.amount_approved || 0, annualRate, loan.loan_term || 1)
        );
        const emi = applyEmiRepayment(outstanding, annualRate, monthlyPayment);
        interestPortion = emi.interestPortion;
        principalPortion = emi.principalPortion;
        newOutstanding = emi.newOutstanding;
      } else {
        const manual = applyManualRepayment(outstanding, annualRate, repaymentAmount);
        interestPortion = manual.interestPortion;
        principalPortion = manual.principalPortion;
        newOutstanding = manual.newOutstanding;
      }

      await supabase.from('loan_repayments').insert({
        loan_id: loan.id,
        amount: repaymentAmount,
        recorded_by: profile?.id,
        notes,
        interest_portion: Number(interestPortion.toFixed(2)),
        principal_portion: Number(principalPortion.toFixed(2)),
      });

      const remainingMonths = Math.max(
        Number(loan.remaining_months || loan.loan_term || 0) - (mode === 'emi' ? 1 : 0),
        0
      );
      const newAmountRepaid = Number(loan.amount_repaid || 0) + repaymentAmount;
      const newStatus = newOutstanding <= 0.01 ? 'completed' : loan.status;

      await supabase
        .from('loans')
        .update({
          amount_repaid: newAmountRepaid,
          outstanding_balance: newOutstanding,
          remaining_months: remainingMonths,
          status: newStatus,
        })
        .eq('id', loan.id);

      await supabase.from('notifications').insert({
        member_id: loan.member_id,
        type: 'loan_repayment',
        title: 'Loan Repayment Recorded',
        message: `A repayment of UGX ${repaymentAmount.toLocaleString(
          'en-UG'
        )} has been recorded. Outstanding balance: UGX ${newOutstanding.toLocaleString('en-UG')}`,
      });

      // Reload loans after repayment to reflect updates immediately
      await loadLoans();
    } catch (err) {
      console.error('Error recording repayment', err);
    }
  };
  // ----------------------------------------------------

  // ---------------- Status Badge helpers ----------------
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
  // ------------------------------------------------------

  // ------------------- Main UI --------------------------
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Loan Management</h2>

      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Loan #</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Member Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Phone</th>
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
                  <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                    {loan.members?.profiles?.full_name || '—'}
                    <div className="text-xs text-gray-500">{loan.members?.member_number}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {loan.members?.profiles?.phone_number || '—'}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                    UGX {Number(loan.amount_requested).toLocaleString('en-UG')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`status-badge ${getStatusColor(loan.status)} flex items-center gap-1.5 w-fit`}>
                      {getStatusIcon(loan.status)} {loan.status}
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
                      {loan.status === 'disbursed' && (
                        <button
                          onClick={() => {
                            setSelectedLoan(loan);
                            setShowRepaymentModal(true);
                          }}
                          className="px-3 py-1.5 btn-primary text-white text-sm font-medium rounded-lg"
                        >
                          Repayment
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
    </div>
  );
}
