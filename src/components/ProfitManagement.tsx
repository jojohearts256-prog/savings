import React, { useState, useEffect } from 'react';
import { supabase, Member } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DollarSign, Printer, Banknote } from 'lucide-react';

export default function ProfitManagement() {
  const { profile } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [profits, setProfits] = useState<any[]>([]);
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedProfit, setSelectedProfit] = useState<any>(null);
  const [totalProfit, setTotalProfit] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const formatUGX = (amount: any) => `UGX ${Math.round(Number(amount ?? 0)).toLocaleString('en-UG')}`;

  // Load members
  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('id, full_name, account_balance, total_contributions');
      if (error) throw error;
      setMembers(data || []);
    } catch (err: any) {
      console.error(err);
      setMembers([]);
    }
  };

  // Load profits
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
      setProfits([]);
    }
  };

  useEffect(() => {
    loadMembers();
    loadProfits();
  }, []);

  // Distribute profits
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

  // --- Receipt Modal ---
  const ReceiptModal = () => {
    if (!selectedProfit) return null;

    const profit = selectedProfit;

    const handlePrint = () => {
      const content = document.getElementById('profit-receipt')?.innerHTML;
      if (content) {
        const w = window.open('', '', 'width=600,height=800');
        w?.document.write(`
          <html>
            <head>
              <title>Profit Receipt</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
                .receipt { max-width: 500px; margin: auto; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .header { text-align: center; margin-bottom: 20px; }
                .header h1 { margin: 0; color: #008080; }
                .header p { margin: 2px 0; color: #555; font-size: 14px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                th { background-color: #f0f0f0; }
                .total { font-weight: bold; color: #008080; }
                .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #555; }
              </style>
            </head>
            <body>
              <div class="receipt">${content}</div>
            </body>
          </html>
        `);
        w?.document.close();
        w?.focus();
        w?.print();
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full">
          <div id="profit-receipt" className="text-sm text-gray-800">
            <div className="header">
              <h1>Profit Distribution Receipt</h1>
              <p>{new Date(profit.created_at).toLocaleString()}</p>
            </div>
            <table>
              <tbody>
                <tr>
                  <th>Member</th>
                  <td>{profit.full_name}</td>
                </tr>
                <tr>
                  <th>Profit Amount</th>
                  <td className="total">{formatUGX(profit.profit_amount)}</td>
                </tr>
                <tr>
                  <th>Recorded By</th>
                  <td>{profile?.full_name || '-'}</td>
                </tr>
                <tr>
                  <th>Loan ID</th>
                  <td>{profit.loan_id}</td>
                </tr>
              </tbody>
            </table>
            <div className="footer">Thank you for using our system!</div>
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
        <button onClick={() => setShowDistributeModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#008080] text-white font-medium rounded-xl hover:bg-[#006666] transition-colors">
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
                    <button onClick={() => { setSelectedProfit(p); setShowReceiptModal(true); }} className="flex items-center gap-1 px-3 py-1 bg-[#008080] text-white rounded-xl text-sm hover:bg-[#006666] transition-colors">
                      <Printer className="w-4 h-4" /> View
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Loan ID</label>
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
                <button type="submit" disabled={loading} className="flex-1 py-2 bg-[#008080] text-white font-medium rounded-xl hover:bg-[#006666] transition-colors shadow-md">
                  {loading ? 'Distributing...' : 'Distribute'}
                </button>
                <button type="button" onClick={() => setShowDistributeModal(false)} className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReceiptModal && <ReceiptModal />}
    </div>
  );
}
