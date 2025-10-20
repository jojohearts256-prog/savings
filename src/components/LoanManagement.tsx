import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { CreditCard, CheckCircle, XCircle, Clock } from "lucide-react";

export default function LoanManagement() {
  const { profile } = useAuth();
  const [loans, setLoans] = useState<any[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [repaymentAmount, setRepaymentAmount] = useState<number>(0);
  const [repaymentNotes, setRepaymentNotes] = useState("");
  const [repaymentMode, setRepaymentMode] = useState<"manual" | "emi">("manual");

  useEffect(() => {
    loadLoans();
  }, []);

  const loadLoans = async () => {
    const { data, error } = await supabase
      .from("loans_with_details")
      .select("*")
      .order("requested_date", { ascending: false });

    if (error) console.error("Error loading loans:", error);
    else setLoans(data || []);
  };

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

  const handleLoanAction = async (
    loanId: string,
    action: "approve" | "reject",
    approvedAmount?: number,
    interestRate?: number,
    loanTerm?: number
  ) => {
    try {
      if (action === "approve" && approvedAmount && interestRate && loanTerm && loanTerm > 0) {
        const { monthlyPayment, totalRepayable, schedule } = generateAmortizationSchedule(
          approvedAmount,
          interestRate,
          loanTerm
        );

        await supabase
          .from("loans_with_details")
          .update({
            status: "approved",
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
          .eq("id", loanId);

        await loadLoans();
      } else {
        await supabase
          .from("loans_with_details")
          .update({ status: "rejected", approved_by: profile?.id })
          .eq("id", loanId);
        await loadLoans();
      }
    } catch (err) {
      console.error("Error processing loan:", err);
    }
  };

  const handleDisburse = async (loanId: string) => {
    try {
      const loan = loans.find((l) => l.id === loanId);
      if (!loan) return;

      await supabase
        .from("loans_with_details")
        .update({ status: "disbursed", disbursed_date: new Date().toISOString() })
        .eq("id", loanId);

      await loadLoans();
    } catch (err) {
      console.error("Error disbursing loan:", err);
    }
  };

  // ---------------- Repayment Logic ----------------
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

  const handleRepayment = async (loan: any, amount: number, notes: string, mode: "manual" | "emi") => {
    try {
      const outstanding = Number(loan.outstanding_balance || 0);
      const annualRate = Number(loan.interest_rate || 0);
      let interestPortion = 0,
        principalPortion = 0,
        newOutstanding = outstanding;

      if (mode === "emi") {
        const monthlyPayment = Number(
          loan.monthly_payment || calculateMonthlyPayment(loan.amount_approved || 0, annualRate, loan.loan_term || 1)
        );
        const emi = applyEmiRepayment(outstanding, annualRate, monthlyPayment);
        interestPortion = emi.interestPortion;
        principalPortion = emi.principalPortion;
        newOutstanding = emi.newOutstanding;
      } else {
        const manual = applyManualRepayment(outstanding, annualRate, amount);
        interestPortion = manual.interestPortion;
        principalPortion = manual.principalPortion;
        newOutstanding = manual.newOutstanding;
      }

      await supabase.from("loan_repayments").insert({
        loan_id: loan.id,
        amount,
        recorded_by: profile?.id,
        notes,
        interest_portion: interestPortion,
        principal_portion: principalPortion,
      });

      await supabase
        .from("loans_with_details")
        .update({
          amount_repaid: (loan.amount_repaid || 0) + amount,
          outstanding_balance: newOutstanding,
          status: newOutstanding <= 0.01 ? "completed" : "disbursed",
        })
        .eq("id", loan.id);

      setShowRepaymentModal(false);
      setSelectedLoan(null);
      await loadLoans();
    } catch (err) {
      console.error("Error recording repayment:", err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4" />;
      case "approved":
        return <CheckCircle className="w-4 h-4" />;
      case "rejected":
        return <XCircle className="w-4 h-4" />;
      case "disbursed":
        return <CreditCard className="w-4 h-4" />;
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "approved":
        return "bg-blue-100 text-blue-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "disbursed":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Loan Management</h2>

      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {/* Loan ID hidden */}
                <th className="hidden">ID</th>
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
                  <td className="hidden">{loan.id}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{loan.loan_number}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                    {loan.full_name || "—"}
                    <div className="text-xs text-gray-500">{loan.member_number}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{loan.phone || "—"}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                    UGX {Number(loan.amount_requested).toLocaleString("en-UG")}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`status-badge ${getStatusColor(loan.status)} flex items-center gap-1.5 w-fit`}>
                      {getStatusIcon(loan.status)} {loan.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-[#008080]">
                    {loan.outstanding_balance
                      ? `UGX ${Number(loan.outstanding_balance).toLocaleString("en-UG")}`
                      : "-"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {loan.status === "pending" && (
                        <>
                          <button
                            onClick={() => setSelectedLoan(loan)}
                            className="px-3 py-1.5 bg-green-50 text-green-700 text-sm font-medium rounded-lg hover:bg-green-100"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleLoanAction(loan.id, "reject")}
                            className="px-3 py-1.5 bg-red-50 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {loan.status === "approved" && (
                        <button
                          onClick={() => handleDisburse(loan.id)}
                          className="px-3 py-1.5 btn-primary text-white text-sm font-medium rounded-lg"
                        >
                          Disburse
                        </button>
                      )}
                      {loan.status === "disbursed" && (
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

      {/* Repayment Modal */}
      {showRepaymentModal && selectedLoan && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Record Repayment</h3>
            <p className="text-sm text-gray-600 mb-4">
              Loan: <strong>{selectedLoan.loan_number}</strong>
              <br />
              Outstanding: UGX {Number(selectedLoan.outstanding_balance).toLocaleString("en-UG")}
            </p>

            <div className="space-y-3">
              <input
                type="number"
                value={repaymentAmount}
                onChange={(e) => setRepaymentAmount(Number(e.target.value))}
                placeholder="Enter repayment amount"
                className="w-full border rounded-lg p-2"
              />
              <textarea
                value={repaymentNotes}
                onChange={(e) => setRepaymentNotes(e.target.value)}
                placeholder="Notes"
                className="w-full border rounded-lg p-2"
              />
              <select
                value={repaymentMode}
                onChange={(e) => setRepaymentMode(e.target.value as "manual" | "emi")}
                className="w-full border rounded-lg p-2"
              >
                <option value="manual">Manual</option>
                <option value="emi">EMI</option>
              </select>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  onClick={() => setShowRepaymentModal(false)}
                  className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    handleRepayment(selectedLoan, repaymentAmount, repaymentNotes, repaymentMode)
                  }
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
