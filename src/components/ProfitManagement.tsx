import React, { useState, useEffect } from 'react';
import { supabase, Member } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DollarSign, Printer, Banknote, Download } from 'lucide-react';
import jsPDF from 'jspdf';

export default function ProfitManagement() {
  const { profile } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [profits, setProfits] = useState<any[]>([]);
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState<any>(null); // new: modal for selected profit
  const [totalProfit, setTotalProfit] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const formatUGX = (amount: any) =>
    `UGX ${Math.round(Number(amount ?? 0)).toLocaleString('en-UG')}`;

  // Load members
  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('id, full_name, account_balance, total_contributions');
      if (error) throw error;
      setMembers(data || []);
    } catch (err: any) {
      console.error('Error loading members:', err.message);
      setMembers([]);
    }
  };

  // Load profits
  const loadProfits = async () => {
    try {
      const { data, error } = await supabase
        .from('profits')
        .select(`
          *,
          loan:loans!profits_loan_id_fkey(loan_number, amount_approved, interest_rate, repayment_period_months)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProfits(data || []);
    } catch (err: any) {
      console.error('Error loading profits:', err.message);
      setProfits([]);
    }
  };

  useEffect(() => {
    loadMembers();
    loadProfits();
  }, []);

  const distributeProfits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanId) {
      alert('Please select a completed loan to distribute profits.');
      return;
    }

    setLoading(true);
    try {
      const profitAmount = parseFloat(totalProfit);
      if (isNaN(profitAmount) || profitAmount <= 0)
        throw new Error('Invalid profit amount');

      const totalBalances = members.reduce(
        (sum, m) => sum + Number(m.account_balance || 0),
        0
      );
      if (totalBalances === 0) throw new Error('No balances to distribute profits to');

      const inserts: any[] = [];

      for (const member of members) {
        const memberShare = (Number(member.account_balance || 0) / totalBalances) * profitAmount;
        if (memberShare <= 0) continue;

        inserts.push({
          member_id: member.id,
          full_name: member.full_name,
          loan_id: selectedLoanId,
          profit_amount: memberShare,
          recorded_by: profile?.id,
        });
      }

      const { error: insertError } = await supabase.from('profits').insert(inserts);
      if (insertError) throw insertError;

      setTotalProfit('');
      setSelectedLoanId('');
      setShowDistributeModal(false);
      await loadProfits();
      alert('Profits distributed successfully!');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to distribute profits');
    } finally {
      setLoading(false);
    }
  };

  // Open receipt modal in-app
  const openReceiptModal = (profit: any) => {
    setShowReceiptModal(profit);
  };

  // Download PDF from modal
  const downloadPDF = (profit: any) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor('#008080');
    doc.text('Profit Distribution Receipt', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor('#000000');
    doc.text(`Date: ${new Date(profit.created_at).toLocaleString()}`, 20, 40);
    doc.text(`Member: ${profit.full_name}`, 20, 50);
    doc.text(`Loan Number: ${profit.loan?.loan_number || '-'}`, 20, 60);
    doc.text(`Loan Amount: ${formatUGX(profit.loan?.amount_approved || 0)}`, 20, 70);
    doc.text(`Interest Rate: ${profit.loan?.interest_rate ?? 0}%`, 20, 80);
    doc.text(`Repayment Period: ${profit.loan?.repayment_period_months ?? 0} months`, 20, 90);
    doc.text(`Profit Amount: ${formatUGX(profit.profit_amount)}`, 20, 100);
    doc.text(`Recorded By: ${profile?.full_name || 'Admin'}`, 20, 110);
    doc.save(`Profit_Receipt_${profit.id}.pdf`);
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Profit Management</h2>
        <button
          onClick={() => setShowDistributeModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#008080] text-white font-medium rounded-xl hover:bg-[#006666] transition-colors"
        >
          <Banknote className="w-5 h-5" /> Distribute Profits
        </button>
      </div>

      {/* Profit Table */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Member</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Profit Amount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Loan Number</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {profits.map((p) => (
                <tr key={p.id} className="hover:bg-[#f0f8f8] transition-colors cursor-pointer">
                  <td className="px-6 py-4 text-sm text-gray-600">{new Date(p.created_at).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-800">{p.full_name}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-green-600">{formatUGX(p.profit_amount)}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{p.loan?.loan_number || '-'}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => openReceiptModal(p)}
                      className="flex items-center gap-1 px-3 py-1 bg-[#008080] text-white rounded-xl text-sm hover:bg-[#006666] transition-colors"
                    >
                      <Printer className="w-4 h-4" /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Distribute Modal */}
      {showDistributeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Distribute Profits</h2>
            <form onSubmit={distributeProfits} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Completed Loan (Loan ID)</label>
                <input
                  type="text"
                  value={selectedLoanId}
                  onChange={(e) => setSelectedLoanId(e.target.value)}
                  placeholder="Enter completed loan UUID"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Profit Amount</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={totalProfit}
                  onChange={(e) => setTotalProfit(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 bg-[#008080] text-white font-medium rounded-xl hover:bg-[#006666] transition-colors shadow-md"
                >
                  {loading ? 'Distributing...' : 'Distribute'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDistributeModal(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Profit Receipt</h2>
            <div className="p-4 border rounded-xl bg-gray-50 space-y-2">
              <p><strong>Date:</strong> {new Date(showReceiptModal.created_at).toLocaleString()}</p>
              <p><strong>Member:</strong> {showReceiptModal.full_name}</p>
              <p><strong>Loan Number:</strong> {showReceiptModal.loan?.loan_number || '-'}</p>
              <p><strong>Loan Amount:</strong> {formatUGX(showReceiptModal.loan?.amount_approved || 0)}</p>
              <p><strong>Interest Rate:</strong> {showReceiptModal.loan?.interest_rate || 0}%</p>
              <p><strong>Repayment Period:</strong> {showReceiptModal.loan?.repayment_period_months || 0} months</p>
              <p className="text-green-600 font-semibold"><strong>Profit Amount:</strong> {formatUGX(showReceiptModal.profit_amount)}</p>
              <p><strong>Recorded By:</strong> {profile?.full_name || 'Admin'}</p>
            </div>
            <div className="flex gap-3 mt-4 justify-end">
              <button
                onClick={() => downloadPDF(showReceiptModal)}
                className="flex items-center gap-1 px-4 py-2 bg-[#008080] text-white rounded-xl hover:bg-[#006666] transition-colors"
              >
                <Download className="w-4 h-4" /> Download
              </button>
              <button
                onClick={() => setShowReceiptModal(null)}
                className="px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
