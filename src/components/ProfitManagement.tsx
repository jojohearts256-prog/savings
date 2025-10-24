import React, { useState, useEffect, useRef } from 'react';
import { supabase, Member } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DollarSign, Banknote, Printer } from 'lucide-react';

export default function ProfitManagement() {
  const { profile } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [profits, setProfits] = useState<any[]>([]);
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedProfit, setSelectedProfit] = useState<any>(null);
  const [totalProfit, setTotalProfit] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [loading, setLoading] = useState(false);

  const receiptRef = useRef<HTMLDivElement>(null);

  const formatUGX = (amount: any) => `UGX ${Math.round(Number(amount ?? 0)).toLocaleString('en-UG')}`;

  useEffect(() => {
    loadMembers();
    loadProfits();
  }, []);

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('id, full_name, account_balance, total_contributions');
      if (error) throw error;
      setMembers(data || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const loadProfits = async () => {
    try {
      const { data, error } = await supabase
        .from('profits')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProfits(data || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const distributeProfits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanId) {
      alert('Please select a completed loan to distribute profits.');
      return;
    }
    setLoading(true);
    try {
      const profitAmount = parseFloat(totalProfit);
      if (isNaN(profitAmount) || profitAmount <= 0) throw new Error('Invalid profit amount');

      const totalBalances = members.reduce((sum, m) => sum + Number(m.account_balance || 0), 0);
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

  const handlePrint = () => {
    if (!receiptRef.current) return;
    const printContents = receiptRef.current.innerHTML;
    const originalContents = document.body.innerHTML;

    document.body.innerHTML = printContents;
    window.print();
    document.body.innerHTML = originalContents;
    window.location.reload(); // restores JS state
  };

  const ProfitReceiptModal = () => {
    if (!selectedProfit) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full">
          <div ref={receiptRef} className="text-sm text-gray-800">
            <div className="header text-center mb-4">
              <h1 className="text-2xl font-bold text-[#008080]">Profit Distribution Receipt</h1>
              <p>Profit Record</p>
              <p>{new Date(selectedProfit.created_at).toLocaleString()}</p>
            </div>
            <table className="w-full table-auto border-collapse border border-gray-300 mb-4">
              <tbody>
                <tr>
                  <th className="border px-2 py-1 text-left">Member</th>
                  <td className="border px-2 py-1">{selectedProfit.full_name}</td>
                </tr>
                <tr>
                  <th className="border px-2 py-1 text-left">Loan ID</th>
                  <td className="border px-2 py-1">{selectedProfit.loan_id}</td>
                </tr>
                <tr>
                  <th className="border px-2 py-1 text-left">Profit Amount</th>
                  <td className="border px-2 py-1">{formatUGX(selectedProfit.profit_amount)}</td>
                </tr>
                <tr>
                  <th className="border px-2 py-1 text-left">Recorded By</th>
                  <td className="border px-2 py-1">{profile?.full_name || '-'}</td>
                </tr>
              </tbody>
            </table>
            <div className="text-center text-xs text-gray-500">Thank you for using our system!</div>
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={handlePrint} className="flex-1 py-2 bg-[#008080] text-white font-medium rounded-xl hover:bg-[#006666] transition-colors">
              Print / Download
            </button>
            <button onClick={() => setShowReceiptModal(false)} className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
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

      <div className="bg-white rounded-2xl card-shadow overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Member</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Profit Amount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {profits.map((p) => (
                <tr key={p.id} className="hover:bg-[#f0f8f8] transition-colors cursor-pointer">
                  <td className="px-6 py-4 text-sm text-gray-600">{new Date(p.created_at).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-800">{p.full_name}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-green-600">{formatUGX(p.profit_amount)}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => { setSelectedProfit(p); setShowReceiptModal(true); }}
                      className="flex items-center gap-1 px-3 py-1 bg-[#008080] text-white rounded-xl text-sm hover:bg-[#006666] transition-colors"
                    >
                      <Printer className="w-4 h-4" /> Print
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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

      {showReceiptModal && <ProfitReceiptModal />}
    </div>
  );
}
