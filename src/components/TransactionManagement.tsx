import { useState, useEffect } from 'react';
import { supabase, Member, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowUpCircle, ArrowDownCircle, DollarSign, Search } from 'lucide-react';

export default function TransactionManagement() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    loadTransactions();
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTransactions = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        members!transactions_member_id_fkey(*, full_name, member_number),
        profiles!transactions_recorded_by_fkey(full_name)
      `)
      .order('transaction_date', { ascending: false });

    if (error) console.error('Transaction load error:', error);
    setTransactions(data || []);
  };

  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const { data, error } = await supabase
        .from('members')
        .select('id, account_balance, full_name, member_number, total_contributions, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Members load error:', error);
        setMembers([]);
      } else {
        setMembers(data || []);
      }
    } catch (err) {
      console.error('Members load error (unexpected):', err);
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  // Helper to create a printable, styled HTML receipt string
  const createReceiptHtml = (opts: {
    receiptId: string;
    transaction: any;
    member: any;
    recordedByName?: string | null;
  }) => {
    const t = opts.transaction;
    const m = opts.member;
    const recordedBy = opts.recordedByName || 'System';
    const dateStr = new Date(t.transaction_date || t.created_at || Date.now()).toLocaleString();

    // Inline styles so the print window looks consistent
    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt - ${opts.receiptId}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial; color:#222; padding:24px; }
    .receipt { max-width:800px; margin:0 auto; border:1px solid #e5e7eb; padding:24px; border-radius:12px; }
    .brand { display:flex; align-items:center; gap:16px; margin-bottom:16px; }
    .brand h1 { margin:0; font-size:20px; color:#0f766e; }
    .meta { display:flex; justify-content:space-between; margin-bottom:18px; }
    .meta .left, .meta .right { width:48%; }
    .table { width:100%; border-collapse:collapse; margin-bottom:18px; }
    .table th { text-align:left; color:#374151; font-size:12px; padding:8px 0; border-bottom:1px dashed #e5e7eb; }
    .table td { padding:12px 0; font-size:16px; }
    .amount { font-weight:700; color:#065f46; font-size:18px; }
    .negative { color:#b91c1c; }
    .footer { border-top:1px dashed #e5e7eb; padding-top:12px; margin-top:12px; font-size:12px; color:#6b7280; }
    .receipt-id { font-size:12px; color:#6b7280; }
    @media print {
      body { padding:0; }
      .receipt { border:none; border-radius:0; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="brand">
      <div>
        <h1>Your Organization Name</h1>
        <div class="receipt-id">Receipt: ${opts.receiptId}</div>
      </div>
    </div>

    <div class="meta">
      <div class="left">
        <strong>Member</strong><br/>
        ${m.full_name || m.member_number || 'Member'}<br/>
        ${m.member_number ? `Member #${m.member_number}` : ''}<br/>
      </div>
      <div class="right" style="text-align:right;">
        <strong>Date</strong><br/>
        ${dateStr}<br/>
        <strong>Recorded by</strong><br/>
        ${recordedBy}
      </div>
    </div>

    <table class="table">
      <thead>
        <tr><th>Description</th><th style="text-align:right">Amount</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>${t.transaction_type || 'Transaction'} — ${t.description || ''}</td>
          <td style="text-align:right" class="${t.transaction_type === 'withdrawal' ? 'negative' : ''}">${t.transaction_type === 'withdrawal' ? '-' : '+'}$${Number(t.amount).toLocaleString()}</td>
        </tr>
      </tbody>
    </table>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div>
        <div>Balance Before: $${Number(t.balance_before || 0).toLocaleString()}</div>
      </div>
      <div style="text-align:right;">
        <div>Balance After</div>
        <div class="amount">$${Number(t.balance_after || 0).toLocaleString()}</div>
      </div>
    </div>

    <div class="footer">
      Thank you for using our services. This receipt was generated automatically. If you need support, contact support@example.com.
    </div>
  </div>
</body>
</html>
    `.trim();
  };

  const AddTransactionModal = () => {
    const [formData, setFormData] = useState({
      member_id: '',
      transaction_type: 'deposit' as 'deposit' | 'withdrawal' | 'contribution',
      amount: '',
      description: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

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

        // 1) Insert transaction and get the inserted row back
        const { data: insertedTxArr, error: txError } = await supabase
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
        const insertedTx = insertedTxArr; // single row

        // 2) Update member balance (same as before)
        const updates: any = { account_balance: balanceAfter };
        if (formData.transaction_type === 'contribution') {
          updates.total_contributions = (Number(member.total_contributions) || 0) + amount;
        }

        const { error: updateError } = await supabase
          .from('members')
          .update(updates)
          .eq('id', formData.member_id);

        if (updateError) throw updateError;

        // 3) Create receipt HTML and persist it in receipts table
        const tempReceiptId = crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        const receiptHtml = createReceiptHtml({
          receiptId: tempReceiptId,
          transaction: insertedTx,
          member,
          recordedByName: (profile as any)?.full_name || null,
        });

        const { data: receiptInsert, error: receiptError } = await supabase
          .from('receipts')
          .insert({
            transaction_id: insertedTx.id,
            member_id: formData.member_id,
            receipt_html: receiptHtml,
          })
          .select()
          .single();

        if (receiptError) {
          // not fatal: we still can show print view, but log it
          console.error('receipt save error', receiptError);
        }

        // 4) Open print window with the receipt HTML so user can print/save as PDF immediately
        const printWindow = window.open('', '_blank', 'noopener,noreferrer');
        if (printWindow) {
          printWindow.document.open();
          printWindow.document.write(receiptHtml);
          printWindow.document.close();
          // Wait for content to render then trigger print
          printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
          };
        } else {
          console.warn('Could not open print window (popup blocked?)');
          // optionally show the receipt in-app instead
        }

        // 5) Done: close modal and refresh
        setShowAddModal(false);
        loadTransactions();
        loadMembers();
      } catch (err: any) {
        setError(err.message || 'Failed to record transaction');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Record Transaction</h2>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Member</label>
              <select
                value={formData.member_id}
                onChange={(e) => setFormData({ ...formData, member_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
                required
              >
                <option value="">Select member</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name || m.member_number || String(m.id).slice(0, 8)}
                  </option>
                ))}
              </select>
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
              <button type="submit" disabled={loading || loadingMembers} className="flex-1 py-2 btn-primary text-white font-medium rounded-xl disabled:opacity-50">
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

  const filteredTransactions = transactions.filter((tx) =>
    (tx.members?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
    (tx.members?.member_number?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Transaction Management</h2>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 btn-primary text-white font-medium rounded-xl">
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

      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-600">{new Date(tx.transaction_date).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-800">
                    {tx.members?.full_name || '-'}
                    <div className="text-xs text-gray-500">{tx.members?.member_number}</div>
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
                  <td className="px-6 py-4 text-sm text-gray-600">{tx['profiles!transactions_recorded_by_fkey']?.full_name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && <AddTransactionModal />}
    </div>
  );
}
