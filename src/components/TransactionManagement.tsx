import { useState, useEffect } from 'react';
import { supabase, Member, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowUpCircle, ArrowDownCircle, DollarSign, Search, Printer } from 'lucide-react';

export default function TransactionManagement() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [members, setMembers] = useState<(Member & { profiles: Profile | null })[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    loadTransactions();
    loadMembers();
  }, []);

  const loadTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          members!transactions_member_id_fkey(full_name, member_number, account_balance, total_contributions),
          profiles!transactions_recorded_by_fkey(full_name)
        `)
        .order('transaction_date', { ascending: false });

      if (error) throw error;

      const flattened = (data || []).map((tx: any) => ({
        ...tx,
        member_name: tx.members?.full_name || '-',
        member_number: tx.members?.member_number || '-',
        recorded_by_name: tx['profiles!transactions_recorded_by_fkey']?.full_name || '-',
      }));

      setTransactions(flattened);
    } catch (err: any) {
      console.error('Transaction load error:', err);
      setTransactions([]);
    }
  };

  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('id, full_name, member_number, account_balance, total_contributions')
        .order('created_at', { ascending: false });

      if (membersError) throw membersError;
      setMembers(membersData || []);
    } catch (err: any) {
      console.error('loadMembers error:', err);
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const AddTransactionModal = () => {
    const [formData, setFormData] = useState({
      member_id: '',
      transaction_type: 'deposit' as 'deposit' | 'withdrawal' | 'contribution',
      amount: '',
      description: '',
    });
    const [memberSearch, setMemberSearch] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const filteredMembers = members.filter((m) =>
      m.full_name.toLowerCase().includes(memberSearch.toLowerCase())
    );

    const handleSelectMember = (member: Member) => {
      setFormData({ ...formData, member_id: String(member.id) });
      setMemberSearch(member.full_name);
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);

      try {
        const member = members.find((m) => String(m.id) === String(formData.member_id));
        if (!member) throw new Error('Member not found');

        const amount = parseFloat(formData.amount);
        if (isNaN(amount) || amount <= 0) throw new Error('Invalid amount');

        const balanceBefore = Number(member.account_balance ?? 0);
        let balanceAfter: number;

        if (formData.transaction_type === 'deposit' || formData.transaction_type === 'contribution') {
          balanceAfter = balanceBefore + amount;
        } else {
          if (amount > balanceBefore) throw new Error('Insufficient balance');
          balanceAfter = balanceBefore - amount;
        }

        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .insert({
            member_id: formData.member_id,
            transaction_type: formData.transaction_type,
            amount,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            description: formData.description,
            recorded_by: profile?.id,
          })
          .select()
          .single();

        if (txError) throw txError;

        const updates: any = { account_balance: balanceAfter };
        if (formData.transaction_type === 'contribution') {
          updates.total_contributions = (Number(member.total_contributions) || 0) + amount;
        }

        const { error: updateError } = await supabase
          .from('members')
          .update(updates)
          .eq('id', formData.member_id);

        if (updateError) throw updateError;

        setShowAddModal(false);
        await loadTransactions();
        setSelectedTransaction({
          ...txData,
          member_name: member.full_name,
          member_number: member.member_number,
          recorded_by_name: profile?.full_name || '-',
        });
        setShowReceiptModal(true);
      } catch (err: any) {
        setError(err.message || 'Failed to record transaction');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-lg">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Record Transaction</h2>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Member</label>
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search member..."
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
              />
              {memberSearch && filteredMembers.length > 0 && (
                <ul className="absolute z-50 bg-white border border-gray-200 mt-1 w-full max-h-40 overflow-auto rounded-xl shadow-lg">
                  {filteredMembers.map((m) => (
                    <li
                      key={m.id}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => handleSelectMember(m)}
                    >
                      {m.full_name} ({m.member_number})
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
              <select
                value={formData.transaction_type}
                onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
              >
                <option value="deposit">Deposit</option>
                <option value="withdrawal">Withdrawal</option>
                <option value="contribution">Contribution</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
                rows={2}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button type="submit" disabled={loading || loadingMembers} className="flex-1 py-2 bg-[#008080] text-white font-medium rounded-xl disabled:opacity-50">
                {loading ? 'Recording...' : 'Record Transaction'}
              </button>
              <button type="button" onClick={() => setShowAddModal(false)} className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const ReceiptModal = () => {
    if (!selectedTransaction) return null;
    const tx = selectedTransaction;

    const handlePrint = () => {
      const printContent = document.getElementById('receipt-content')?.innerHTML;
      if (printContent) {
        const w = window.open('', '', 'width=600,height=800');
        w?.document.write(`
          <html>
            <head>
              <title>Receipt</title>
              <style>
                body { font-family: 'Arial', sans-serif; padding: 20px; background: #f5f5f5; }
                .receipt { max-width: 500px; margin: auto; background: #fff; padding: 20px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
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
              <div class="receipt">
                ${printContent}
              </div>
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
        <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-lg">
          <div id="receipt-content" className="text-sm text-gray-800">
            <div className="header">
              <h1>My Savings System</h1>
              <p>Transaction Receipt</p>
              <p>{new Date(tx.transaction_date).toLocaleString()}</p>
            </div>
            <table>
              <tbody>
                <tr>
                  <th>Member</th>
                  <td>{tx.member_name}</td>
                </tr>
                <tr>
                  <th>Member Number</th>
                  <td>{tx.member_number}</td>
                </tr>
                <tr>
                  <th>Transaction Type</th>
                  <td>{tx.transaction_type}</td>
                </tr>
                <tr>
                  <th>Amount</th>
                  <td>${Number(tx.amount).toLocaleString()}</td>
                </tr>
                <tr>
                  <th>Balance Before</th>
                  <td>${Number(tx.balance_before).toLocaleString()}</td>
                </tr>
                <tr>
                  <th>Balance After</th>
                  <td className="total">${Number(tx.balance_after).toLocaleString()}</td>
                </tr>
                <tr>
                  <th>Description</th>
                  <td>{tx.description || '-'}</td>
                </tr>
                <tr>
                  <th>Recorded By</th>
                  <td>{tx.recorded_by_name}</td>
                </tr>
              </tbody>
            </table>
            <div className="footer">Thank you for using our service!</div>
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={handlePrint} className="flex-1 py-2 bg-[#008080] text-white font-medium rounded-xl">Print / Download</button>
            <button onClick={() => setShowReceiptModal(false)} className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      </div>
    );
  };

  const filteredTransactions = transactions.filter((tx) =>
    (tx.member_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
    (tx.member_number?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Transaction Management</h2>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#008080] text-white font-medium rounded-xl">
          <DollarSign className="w-5 h-5" />
          New Transaction
        </button>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Member</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Type</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Balance After</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Recorded By</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-600">{new Date(tx.transaction_date).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-800">
                    {tx.member_name}
                    <div className="text-xs text-gray-500">{tx.member_number}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {tx.transaction_type === 'withdrawal' ? <ArrowDownCircle className="w-4 h-4 text-red-500" /> : <ArrowUpCircle className="w-4 h-4 text-green-500" />}
                      <span className="text-sm capitalize">{tx.transaction_type}</span>
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-sm font-semibold ${tx.transaction_type === 'withdrawal' ? 'text-red-600' : 'text-green-600'}`}>
                    {tx.transaction_type === 'withdrawal' ? '-' : '+'}${Number(tx.amount).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-[#008080]">${Number(tx.balance_after).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{tx.recorded_by_name}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => { setSelectedTransaction(tx); setShowReceiptModal(true); }}
                      className="flex items-center gap-1 px-3 py-1 bg-[#008080] text-white rounded-xl text-sm hover:bg-[#006666]"
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

      {showAddModal && <AddTransactionModal />}
      {showReceiptModal && <ReceiptModal />}
    </div>
  );
}
