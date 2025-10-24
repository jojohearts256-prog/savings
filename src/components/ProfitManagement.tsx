import React, { useState, useEffect } from 'react';
import { supabase, Member } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DollarSign, Printer, Banknote } from 'lucide-react';

export default function ProfitManagement() {
  const { profile } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [profits, setProfits] = useState<any[]>([]);
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [totalProfit, setTotalProfit] = useState('');
  const [loading, setLoading] = useState(false);

  const formatUGX = (amount: any) =>
    `UGX ${Math.round(Number(amount ?? 0)).toLocaleString('en-UG')}`;

  // Load all members
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

  // Load profits and merge with all members
  const loadProfits = async () => {
    try {
      const { data: profitData, error } = await supabase
        .from('profits')
        .select('member_id, profit_amount')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Aggregate profits per member
      const profitMap: Record<string, number> = {};
      (profitData || []).forEach((p: any) => {
        if (!profitMap[p.member_id]) profitMap[p.member_id] = 0;
        profitMap[p.member_id] += Number(p.profit_amount || 0);
      });

      // Merge with members so everyone is shown
      const merged = members.map((m) => ({
        member_id: m.id,
        full_name: m.full_name,
        total_profit: profitMap[m.id] || 0,
      }));

      setProfits(merged);
    } catch (err: any) {
      console.error('Error loading profits:', err.message);
      setProfits([]);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      await loadMembers();
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (members.length > 0) loadProfits();
  }, [members]);

  const distributeProfits = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const profitAmount = parseFloat(totalProfit);
      if (isNaN(profitAmount) || profitAmount <= 0)
        throw new Error('Invalid profit amount');

      const totalBalances = members.reduce(
        (sum, m) => sum + Number(m.account_balance || 0),
        0
      );
      if (totalBalances === 0) throw new Error('No balances to distribute profits');

      const inserts: any[] = [];
      const updates: any[] = [];

      for (const member of members) {
        const memberShare =
          (Number(member.account_balance || 0) / totalBalances) * profitAmount;
        if (memberShare <= 0) continue;

        inserts.push({
          member_id: member.id,
          full_name: member.full_name,
          profit_amount: memberShare,
          recorded_by: profile?.id,
        });

        updates.push(
          supabase
            .from('members')
            .update({ account_balance: (Number(member.account_balance) || 0) + memberShare })
            .eq('id', member.id)
        );
      }

      const { error: insertError } = await supabase.from('profits').insert(inserts);
      if (insertError) throw insertError;

      for (const u of updates) await u;

      setTotalProfit('');
      setShowDistributeModal(false);
      await loadProfits();
      await loadMembers();
      alert('Profits distributed successfully!');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to distribute profits');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = (profit: any) => {
    const content = `
      <div style="font-family: Arial; padding: 20px;">
        <h2 style="color:#008080">Profit Receipt</h2>
        <p>Member: ${profit.full_name}</p>
        <p>Total Profit: ${formatUGX(profit.total_profit)}</p>
      </div>
    `;
    const w = window.open('', '', 'width=600,height=800');
    w?.document.write(content);
    w?.document.close();
    w?.focus();
    w?.print();
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
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Member</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Accumulated Profit</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {profits.map((p) => (
                <tr key={p.member_id} className="hover:bg-[#f0f8f8] transition-colors cursor-pointer">
                  <td className="px-6 py-4 text-sm text-gray-800">{p.full_name}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-green-600">{formatUGX(p.total_profit)}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handlePrint(p)}
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

      {/* Distribute Modal */}
      {showDistributeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Distribute Profits</h2>
            <form onSubmit={distributeProfits} className="space-y-4">
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
    </div>
  );
}
