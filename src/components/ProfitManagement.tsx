import { useState, useEffect } from 'react';
import { supabase, Member, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Banknote, Printer } from 'lucide-react';

export default function ProfitManagement() {
  const { profile } = useAuth();
  const [profits, setProfits] = useState<any[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [totalProfit, setTotalProfit] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Helper for UGX formatting
  const formatUGX = (amount: any) => `UGX ${Math.round(Number(amount ?? 0)).toLocaleString('en-UG')}`;

  // Load all profit records
  const loadProfits = async () => {
    try {
      const { data, error } = await supabase
        .from('profits')
        .select(`
          *,
          members!profits_member_id_fkey(full_name, member_number),
          recorded_by:profiles!profits_recorded_by_fkey(full_name)
        `)
        .order('date_distributed', { ascending: false });

      if (error) throw error;

      const flattened = (data || []).map((p: any) => ({
        ...p,
        member_name: p.members?.full_name || '-',
        member_number: p.members?.member_number || '-',
        recorded_by_name: p.recorded_by?.full_name || '-',
      }));

      setProfits(flattened);
    } catch (err: any) {
      console.error('Error loading profits:', err);
      setProfits([]);
    }
  };

  // Load members for profit distribution
  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('id, full_name, member_number, account_balance');

      if (error) throw error;
      setMembers(data || []);
    } catch (err: any) {
      console.error('Error loading members:', err);
      setMembers([]);
    }
  };

  useEffect(() => {
    loadProfits();
    loadMembers();
  }, []);

  // Distribute profits proportionally
  const handleDistribute = async () => {
    setError('');
    setLoading(true);

    try {
      const profitAmount = parseFloat(totalProfit);
      if (isNaN(profitAmount) || profitAmount <= 0) throw new Error('Enter a valid profit amount');
      if (!members || members.length === 0) throw new Error('No members to distribute profits to');

      const totalBalance = members.reduce((sum, m) => sum + Number(m.account_balance), 0);
      if (totalBalance === 0) throw new Error('Total account balances are zero');

      const profitInserts = members.map((m) => {
        const share = (Number(m.account_balance) / totalBalance) * profitAmount;
        return {
          member_id: m.id,
          profit_amount: share,
          account_balance_at_distribution: Number(m.account_balance),
          recorded_by: profile?.id,
        };
      });

      // Insert profit records
      const { error: insertError } = await supabase.from('profits').insert(profitInserts);
      if (insertError) throw insertError;

      // Update member balances
      for (let m of profitInserts) {
        await supabase
          .from('members')
          .update({ account_balance: m.account_balance_at_distribution + m.profit_amount })
          .eq('id', m.member_id);
      }

      setShowDistributeModal(false);
      setTotalProfit('');
      await loadProfits();
      await loadMembers();
    } catch (err: any) {
      setError(err.message || 'Failed to distribute profits');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = (profit: any) => {
    const printContent = `
      <div style="font-family: Arial; padding: 20px;">
        <h2>Profit Distribution Receipt</h2>
        <p><strong>Member:</strong> ${profit.member_name}</p>
        <p><strong>Member Number:</strong> ${profit.member_number}</p>
        <p><strong>Profit Amount:</strong> ${formatUGX(profit.profit_amount)}</p>
        <p><strong>Account Balance Before:</strong> ${formatUGX(profit.account_balance_at_distribution)}</p>
        <p><strong>Date Distributed:</strong> ${new Date(profit.date_distributed).toLocaleString()}</p>
        <p><strong>Recorded By:</strong> ${profit.recorded_by_name}</p>
      </div>
    `;
    const w = window.open('', '', 'width=600,height=800');
    w?.document.write(printContent);
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
          <Banknote className="w-5 h-5" />
          Distribute Profits
        </button>
      </div>

      <div className="bg-white rounded-2xl card-shadow overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Member</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Member Number</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Account Balance</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Profit Amount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Recorded By</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {profits.map((p) => (
                <tr key={p.id} className="hover:bg-[#f0f8f8] transition-colors cursor-pointer">
                  <td className="px-6 py-4 text-sm text-gray-600">{new Date(p.date_distributed).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-800">{p.member_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.member_number}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-[#008080]">{formatUGX(p.account_balance_at_distribution)}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-green-600">{formatUGX(p.profit_amount)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.recorded_by_name}</td>
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

      {/* Distribute Profits Modal */}
      {showDistributeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Distribute Profits</h2>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">{error}</div>}
            <div className="space-y-4">
              <input
                type="number"
                step="1"
                min="1"
                value={totalProfit}
                onChange={(e) => setTotalProfit(e.target.value)}
                placeholder="Enter total profit to distribute"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
              />
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleDistribute}
                  disabled={loading}
                  className="flex-1 py-2 bg-[#008080] text-white font-medium rounded-xl hover:bg-[#006666] transition-colors shadow-md"
                >
                  {loading ? 'Distributing...' : 'Distribute'}
                </button>
                <button
                  onClick={() => { setShowDistributeModal(false); setError(''); }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
