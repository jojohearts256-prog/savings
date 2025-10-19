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

  // --------------- Helper functions (amortization) ----------------
  const calculateMonthlyPayment = (P: number, annualRate: number, months: number) => {
    if (months <= 0) return 0;
    const i = annualRate / 100 / 12; // monthly interest rate
    if (i === 0) return P / months;
    const payment = (P * i * Math.pow(1 + i, months)) / (Math.pow(1 + i, months) - 1);
    return payment;
  };

  const generateAmortizationSchedule = (P: number, annualRate: number, months: number) => {
    const monthlyRate = annualRate / 100 / 12;
    const monthlyPayment = calculateMonthlyPayment(P, annualRate, months);
    let balance = P;
    const schedule: Array<any> = [];

    for (let m = 1; m <= months; m++) {
      const interest = balance * monthlyRate;
      let principal = monthlyPayment - interest;

      // If last payment, adjust to clear balance (avoid rounding issues)
      if (m === months) {
        principal = balance;
      }

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
  // ----------------------------------------------------------------

  // --------------- Approve / Reject (now amortized) ---------------
  const handleLoanAction = async (
    loanId: string,
    action: 'approve' | 'reject',
    approvedAmount?: number,
    interestRate?: number,
    loanTerm?: number
  ) => {
    try {
      if (action === 'approve' && approvedAmount && interestRate !== undefined && loanTerm && loanTerm > 0) {
        // Compute amortized values
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
            amortization_schedule: schedule, // store schedule JSON (ensure your DB column supports JSON)
            approved_date: new Date().toISOString(),
            approved_by: profile?.id,
          })
          .eq('id', loanId);

        const loan = loans.find((l) => l.id === loanId);
        await supabase.from('notifications').insert({
          member_id: loan.member_id,
          type: 'loan_approved',
          title: 'Loan Approved',
          message: `Your loan of UGX ${approvedAmount.toLocaleString('en-UG')} has been approved for ${loanTerm} months at ${interestRate}% interest. Monthly payment: UGX ${Math.round(monthlyPayment).toLocaleString('en-UG')}.`,
        });
      } else {
        // reject
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
  // ----------------------------------------------------------------

  // ---------------- Disburse (unchanged) ---------------------------
  const handleDisburse = async (loanId: string) => {
    try {
      const loan = loans.find((l) => l.id === loanId);

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
        message: `Your loan of UGX ${loan.amount_approved.toLocaleString('en-UG')} has been disbursed to your account.`,
      });

      loadLoans();
    } catch (err) {
      console.error('Error disbursing loan:', err);
    }
  };
  // ----------------------------------------------------------------

  // --------------- Repayment logic (EMI and Manual) ----------------
  // manual repayment: first interest portion then principal
  const applyManualRepayment = (outstanding: number, annualRate: number, repaymentAmount: number) => {
    const monthlyRate = annualRate / 100 / 12;
    const interestDue = outstanding * monthlyRate;
    const interestPortion = Math.min(repaymentAmount, interestDue);
    const principalPortion = Math.max(repaymentAmount - interestPortion, 0);
    const newOutstanding = Math.max(outstanding - principalPortion, 0);
    return { interestPortion, principalPortion, newOutstanding };
  };

  // EMI repayment: use stored monthly_payment if available; compute interest/principal parts
  const applyEmiRepayment = (outstanding: number, annualRate: number, monthlyPayment: number) => {
    const monthlyRate = annualRate / 100 / 12;
    const interestPortion = outstanding * monthlyRate;
    let principalPortion = monthlyPayment - interestPortion;

    // If monthlyPayment smaller than interest (rare but possible), principal becomes 0 and outstanding increases by unpaid interest.
    if (principalPortion < 0) {
      principalPortion = 0;
    }

    // If this payment fully repays the loan, adjust principalPortion to clear outstanding
    if (monthlyPayment >= outstanding + interestPortion) {
      // pay off balance
      principalPortion = outstanding;
    }

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
        const monthlyPayment = Number(loan.monthly_payment || calculateMonthlyPayment(loan.amount_approved || 0, annualRate, loan.loan_term || 1));
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

      // Insert repayment record
      await supabase.from('loan_repayments').insert({
        loan_id: loan.id,
        amount: repaymentAmount,
        recorded_by: profile?.id,
        notes,
        interest_portion: Number(interestPortion.toFixed(2)),
        principal_portion: Number(principalPortion.toFixed(2)),
      });

      // Update loan record
      const remainingMonths = Math.max(Number(loan.remaining_months || loan.loan_term || 0) - (mode === 'emi' ? 1 : 0), 0);
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
        message: `A repayment of UGX ${repaymentAmount.toLocaleString('en-UG')} has been recorded. Outstanding balance: UGX ${newOutstanding.toLocaleString('en-UG')}`,
      });

      loadLoans();
    } catch (err) {
      console.error('Error recording repayment', err);
    }
  };
  // ----------------------------------------------------------------

  // ----------------- Approval Modal (with term & amortization) -----------------
  const ApprovalModal = ({ loan, onClose }: any) => {
    const [approvedAmount, setApprovedAmount] = useState(loan.amount_requested);
    const [interestRate, setInterestRate] = useState(5); // annual %
    const [loanTerm, setLoanTerm] = useState(12);

    const { monthlyPayment, totalRepayable, schedule } = (() => {
      try {
        return generateAmortizationSchedule(approvedAmount, interestRate, loanTerm);
      } catch {
        return { monthlyPayment: 0, totalRepayable: 0, schedule: [] };
      }
    })();

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
              <label className="block text-sm font-medium text-gray-700 mb-1">Loan Term (Months)</label>
              <input
                type="number"
                value={loanTerm}
                onChange={(e) => setLoanTerm(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
              />
            </div>

            <div className="bg-blue-50 rounded-xl p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Monthly Payment:</span>
                <span className="font-semibold text-gray-800">UGX {Number(monthlyPayment).toFixed(0).toLocaleString('en-UG')}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Total Repayable:</span>
                <span className="font-semibold text-[#008080]">UGX {Number(totalRepayable).toFixed(0).toLocaleString('en-UG')}</span>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                <div>Preview schedule (first 3 months):</div>
                {schedule.slice(0, 3).map((s: any) => (
                  <div key={s.month} className="flex justify-between">
                    <div>M{s.month}</div>
                    <div>{Number(s.payment).toFixed(0).toLocaleString('en-UG')}</div>
                    <div className="text-gray-500">Bal: {Number(s.balance).toFixed(0).toLocaleString('en-UG')}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  handleLoanAction(loan.id, 'approve', approvedAmount, interestRate, loanTerm);
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
  // --------------------------------------------------------------------------

  // ----------------- Repayment Modal (Manual or EMI) -----------------------
  const RepaymentModal = ({ loan, onClose }: any) => {
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'manual' | 'emi'>('manual'); // allow selection

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);

      try {
        const repaymentAmount = parseFloat(amount.replace(/,/g, '')) || 0;
        if (mode === 'emi') {
          // Use stored monthly_payment or compute fallback
          const monthlyPayment = Number(loan.monthly_payment || calculateMonthlyPayment(loan.amount_approved || 0, Number(loan.interest_rate || 0), Number(loan.loan_term || 1)));
          await handleRepayment(loan, monthlyPayment, notes, 'emi');
        } else {
          await handleRepayment(loan, repaymentAmount, notes, 'manual');
        }

        onClose();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Record Repayment</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-blue-50 rounded-xl p-4 mb-2">
              <p className="text-sm text-gray-600 mb-1">Outstanding Balance</p>
              <p className="text-2xl font-bold text-[#008080]">UGX {Number(loan.outstanding_balance).toLocaleString('en-UG')}</p>
              {loan.remaining_months !== undefined && (
                <p className="text-sm text-gray-600 mt-1">Remaining months: {loan.remaining_months}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Mode</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode('manual')}
                  className={`px-3 py-1 rounded ${mode === 'manual' ? 'bg-[#008080] text-white' : 'border'}`}
                >
                  Manual
                </button>
                <button
                  type="button"
                  onClick={() => setMode('emi')}
                  className={`px-3 py-1 rounded ${mode === 'emi' ? 'bg-[#008080] text-white' : 'border'}`}
                >
                  EMI (Monthly)
                </button>
              </div>
            </div>

            {mode === 'manual' && (
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
            )}

            {mode === 'emi' && (
              <div className="bg-gray-50 border rounded p-3">
                <p className="text-sm text-gray-600">EMI will apply the scheduled monthly payment.</p>
                <p className="text-sm mt-1">Monthly payment: <strong>UGX {Number(loan.monthly_payment || calculateMonthlyPayment(loan.amount_approved || 0, Number(loan.interest_rate || 0), Number(loan.loan_term || 0))).toFixed(0).toLocaleString('en-UG')}</strong></p>
              </div>
            )}

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
                {loading ? 'Recording...' : mode === 'emi' ? 'Apply EMI' : 'Record Repayment'}
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
  // ----------------------------------------------------------------------

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

  // ----------------- Main UI (your original layout preserved) -----------------
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

      {selectedLoan && !showRepaymentModal && (
        <ApprovalModal loan={selectedLoan} onClose={() => setSelectedLoan(null)} />
      )}
      {selectedLoan && showRepaymentModal && (
        <RepaymentModal loan={selectedLoan} onClose={() => { setSelectedLoan(null); setShowRepaymentModal(false); }} />
      )}
    </div>
  );
}
