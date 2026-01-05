import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Member, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Banknote } from 'lucide-react';

import AddTransactionModal from './transaction-management/AddTransactionModal';
import ReceiptModal from './transaction-management/ReceiptModal';
import TransactionSearchBar from './transaction-management/TransactionSearchBar';
import TransactionTable from './transaction-management/TransactionTable';
import type { TransactionRow } from './transaction-management/types';

export default function TransactionManagement() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [members, setMembers] = useState<(Member & { profiles: Profile | null })[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRow | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    loadTransactions();
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          members!transactions_member_id_fkey(full_name, member_number, account_balance, total_contributions),
          recorded_by:profiles!transactions_recorded_by_fkey(full_name)
        `)
        .order('transaction_date', { ascending: false });

      if (error) throw error;

      const flattened: TransactionRow[] = (data || []).map((tx: any) => ({
        ...tx,
        member_name: tx.members?.full_name || '-',
        member_number: tx.members?.member_number || '-',
        recorded_by_name: tx.recorded_by?.full_name || '-',
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
      const { data, error } = await supabase
        .from('members')
        .select('*, profiles(id, full_name, role)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMembers((data || []).map((m: any) => ({ ...m, profiles: (m as any).profiles ?? null })));
    } catch (err: any) {
      console.error('loadMembers error:', err);
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleRecorded = async (tx: TransactionRow) => {
    setShowAddModal(false);
    await loadTransactions();
    setSelectedTransaction(tx);
    setShowReceiptModal(true);
  };

  const filteredTransactions = transactions.filter((tx) =>
    (tx.member_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
    (tx.member_number?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  return (
    <div className="p-4 motion-pop">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Transaction Management</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#008080] text-white font-medium rounded-xl hover:bg-[#006666] transition-colors motion-btn"
        >
          <Banknote className="w-5 h-5" />
          New Transaction
        </button>
      </div>

      <TransactionSearchBar value={searchTerm} onChange={setSearchTerm} />

      <TransactionTable
        transactions={filteredTransactions}
        onPrint={(tx) => {
          setSelectedTransaction(tx);
          setShowReceiptModal(true);
        }}
      />

      {showAddModal && (
        <AddTransactionModal
          members={members}
          loadingMembers={loadingMembers}
          recordedByProfile={profile ? { id: profile.id, full_name: profile.full_name } : null}
          onClose={() => setShowAddModal(false)}
          onRecorded={(tx) => handleRecorded(tx)}
        />
      )}
      {showReceiptModal && selectedTransaction && (
        <ReceiptModal tx={selectedTransaction} onClose={() => setShowReceiptModal(false)} />
      )}
    </div>
  );
}
