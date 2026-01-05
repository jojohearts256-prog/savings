import { useEffect, useMemo, useState } from 'react';
import type { Member, Profile } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';
import { sendNotification } from '../../lib/notify';
import { notifyUser } from '../../lib/notifyUser';
import type { TransactionRow, TransactionType } from './types';

export default function AddTransactionModal({
  members,
  loadingMembers,
  recordedByProfile,
  onClose,
  onRecorded,
}: {
  members: (Member & { profiles: Profile | null })[];
  loadingMembers: boolean;
  recordedByProfile: { id: string; full_name?: string | null } | null;
  onClose: () => void;
  onRecorded: (tx: TransactionRow, member: Member & { profiles: Profile | null }) => void;
}) {
  const [formData, setFormData] = useState({
    member_id: '',
    transaction_type: 'deposit' as TransactionType,
    amount: '',
    description: '',
  });
  const [memberSearch, setMemberSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const filteredMembers = useMemo(
    () => members.filter((m) => (m.full_name ?? '').toLowerCase().includes(memberSearch.toLowerCase())),
    [members, memberSearch]
  );

  const handleSelectMember = (member: Member) => {
    setFormData((prev) => ({ ...prev, member_id: String(member.id) }));
    setMemberSearch(member.full_name ?? '');
    setShowSuggestions(false);
  };

  useEffect(() => {
    setShowSuggestions(!formData.member_id);
  }, [formData.member_id]);

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
          recorded_by: recordedByProfile?.id,
        })
        .select()
        .single();

      if (txError) throw txError;

      const updates: any = { account_balance: balanceAfter };
      if (formData.transaction_type === 'contribution') {
        updates.total_contributions = (Number(member.total_contributions) || 0) + amount;
      }

      const { error: updateError } = await supabase.from('members').update(updates).eq('id', formData.member_id);
      if (updateError) throw updateError;

      // Notify member (non-fatal)
      try {
        const txType = formData.transaction_type;
        const amountFormatted = Number(amount).toLocaleString('en-UG');
        const balanceFormatted = Number(balanceAfter).toLocaleString('en-UG');

        const titleMap: Record<string, string> = {
          deposit: 'Deposit Received',
          withdrawal: 'Withdrawal Recorded',
          contribution: 'Contribution Recorded',
        };

        const messageMap: Record<string, string> = {
          deposit: `A deposit of UGX ${amountFormatted} was made to your account. Your new balance is UGX ${balanceFormatted}.`,
          withdrawal: `A withdrawal of UGX ${amountFormatted} was made from your account. Your new balance is UGX ${balanceFormatted}.`,
          contribution: `A contribution of UGX ${amountFormatted} was recorded. Your new balance is UGX ${balanceFormatted}.`,
        };

        // 1) In-app notification (existing system)
        await sendNotification({
          member_id: formData.member_id as string,
          type: txType === 'deposit' ? 'deposit' : txType === 'withdrawal' ? 'withdrawal' : 'contribution',
          title: titleMap[txType] || 'Transaction Recorded',
          message:
            messageMap[txType] ||
            `A transaction of UGX ${amountFormatted} was recorded. Your new balance is UGX ${balanceFormatted}.`,
          metadata: { transactionId: txData?.id },
        });

        // 2) Edge-function based notification hook (non-fatal)
        // NOTE: notifyUser supports deposit/withdraw only per current type.
        if (txType === 'deposit' || txType === 'withdrawal') {
          await notifyUser({
            user_id: String(member.profile_id || member.id),
            transaction_type: txType === 'withdrawal' ? 'withdraw' : 'deposit',
            transaction_amount: amount,
            message:
              messageMap[txType] ||
              `A transaction of UGX ${amountFormatted} was recorded. Your new balance is UGX ${balanceFormatted}.`,
          });
        }
      } catch (notifyErr) {
        console.warn('Failed to send transaction notification', notifyErr);
      }

      onRecorded(
        {
          ...(txData as any),
          member_name: member.full_name ?? '-',
          member_number: member.member_number ?? '-',
          recorded_by_name: recordedByProfile?.full_name || '-',
        },
        member
      );
    } catch (err: any) {
      setError(err.message || 'Failed to record transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Record Transaction</h2>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Member</label>
            <input
              type="text"
              value={memberSearch}
              onChange={(e) => {
                setMemberSearch(e.target.value);
                setShowSuggestions(true);
                setFormData((prev) => ({ ...prev, member_id: '' }));
              }}
              placeholder="Search member..."
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
            />
            {memberSearch && filteredMembers.length > 0 && showSuggestions && (
              <ul className="absolute z-50 bg-white border border-gray-200 mt-1 w-full max-h-44 overflow-auto rounded-xl shadow-lg">
                {filteredMembers.map((m) => (
                  <li
                    key={m.id}
                    className="px-4 py-2 hover:bg-[#f0f8f8] cursor-pointer transition-colors"
                    onClick={() => handleSelectMember(m)}
                  >
                    {m.full_name}{' '}
                    <span className="text-xs text-gray-500">({m.member_number})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
            <select
              value={formData.transaction_type}
              onChange={(e) => setFormData((prev) => ({ ...prev, transaction_type: e.target.value as TransactionType }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none bg-[#f9f9f9]"
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
              step="1"
              min="1"
              value={formData.amount}
              onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading || loadingMembers}
              className="flex-1 py-2 bg-[#008080] text-white font-medium rounded-xl hover:bg-[#006666] transition-colors shadow-md"
            >
              {loading ? 'Recording...' : 'Record Transaction'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
