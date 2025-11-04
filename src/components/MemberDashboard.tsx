import { useState, useEffect, useMemo } from 'react';
import { supabase, Member, Transaction, Loan, Notification } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DollarSign, TrendingUp, CreditCard, Bell, LogOut, FileText } from 'lucide-react';

export default function MemberDashboard() {
  const { profile, signOut } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (profile) loadMemberData();
  }, [profile]);

  const loadMemberData = async () => {
    if (!profile) return;

    try {
      const { data: memberData } = await supabase
        .from('members')
        .select('*')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (!memberData) return;

      const fetchedMember = {
        ...memberData,
        account_balance: Number(memberData.account_balance),
        total_contributions: Number(memberData.total_contributions),
      };
      setMember(fetchedMember);

      const [txRes, loanRes, notifRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('member_id', fetchedMember.id)
          .order('transaction_date', { ascending: false })
          .limit(10),
        supabase
          .from('loans')
          .select('*')
          .eq('member_id', fetchedMember.id)
          .order('requested_date', { ascending: false }),
        supabase
          .from('notifications')
          .select('*')
          .eq('member_id', fetchedMember.id)
          .order('sent_at', { ascending: false })
          .limit(20),
      ]);

      setTransactions(txRes.data || []);
      setLoans(loanRes.data || []);
      setNotifications(notifRes.data || []);
    } catch (err) {
      console.error('Failed to load member data:', err);
    }
  };

  // --- Loan Modal with Guarantors ---
  const LoanRequestModal = () => {
    const [formData, setFormData] = useState({
      amount: '',
      repayment_period: '12',
      reason: '',
    });

    const [guarantors, setGuarantors] = useState<
      { member_id: number; name: string; amount: string; search: string }[]
    >([{ member_id: 0, name: '', amount: '', search: '' }]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchResults, setSearchResults] = useState<Member[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    // --- Simple debounce implementation ---
    const debounce = (func: Function, wait: number) => {
      let timeout: ReturnType<typeof setTimeout>;
      return (...args: any[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
      };
    };

    // Compute remaining amount dynamically
    const remainingAmount = useMemo(() => {
      return Math.max(
        Number(formData.amount || 0) -
          guarantors.reduce((sum, g) => sum + Number(g.amount || 0), 0),
        0
      );
    }, [formData.amount, guarantors]);

    // --- Debounced search for members ---
    const performSearch = async (query: string, index: number) => {
      if (!query) return setSearchResults([]);
      setSearchLoading(true);

      const { data } = await supabase
        .from('members')
        .select('*')
        .ilike('full_name', `%${query}%`)
        .neq('profile_id', profile?.id)
        .limit(5);

      const filtered = data?.filter((m) => !guarantors.some((g) => g.member_id === m.id)) || [];
      setSearchResults(filtered);
      setSearchLoading(false);
    };

    const debouncedSearch = useMemo(() => debounce(performSearch, 300), [guarantors, profile?.id]);

    const handleSearch = (index: number, query: string) => {
      setGuarantors((prev) => {
        const updated = [...prev];
        updated[index].search = query;
        return updated;
      });
      debouncedSearch(query, index);
    };

    const selectGuarantor = (index: number, m: Member) => {
      setGuarantors((prev) => {
        const updated = [...prev];
        updated[index].member_id = m.id;
        updated[index].name = m.full_name;
        updated[index].search = m.full_name;
        return updated;
      });
      setSearchResults([]);
      if (remainingAmount > 0 && guarantors.length < 2) addGuarantor();
    };

    const handleAmountChange = (index: number, value: string) => {
      if (Number(value) > remainingAmount + Number(guarantors[index].amount || 0)) return;
      setGuarantors((prev) => {
        const updated = [...prev];
        updated[index].amount = value;
        return updated;
      });
    };

    const addGuarantor = () => {
      if (guarantors.length < 2 && remainingAmount > 0) {
        setGuarantors([...guarantors, { member_id: 0, name: '', amount: '', search: '' }]);
      }
    };

    const removeGuarantor = (index: number) => {
      setGuarantors((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError('');

      try {
        if (!member) throw new Error('Member not found');

        const requestedAmount = Number(formData.amount);
        const totalGuarantee = guarantors.reduce((sum, g) => sum + Number(g.amount || 0), 0);

        if (totalGuarantee < requestedAmount) throw new Error('Guarantors do not cover requested amount');

        const loanNumber = 'LN' + Date.now() + Math.floor(Math.random() * 1000);

        const { data: loanData, error: loanError } = await supabase
          .from('loans')
          .insert({
            member_id: member.id,
            loan_number: loanNumber,
            amount_requested: requestedAmount,
            repayment_period_months: parseInt(formData.repayment_period),
            reason: formData.reason,
          })
          .select()
          .single();

        if (loanError) throw loanError;

        const validGuarantors = guarantors.filter((g) => Number(g.amount) > 0);
        if (validGuarantors.length > 0) {
          const { error: gError } = await supabase.from('loan_guarantors').insert(
            validGuarantors.map((g) => ({
              loan_id: loanData.id,
              guarantor_id: g.member_id,
              amount: Number(g.amount),
            }))
          );
          if (gError) throw gError;
        }

        setShowLoanModal(false);
        loadMemberData();
      } catch (err: any) {
        setError(err.message || 'Failed to submit loan request');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full overflow-y-auto max-h-[90vh]">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Request Loan</h2>
          <p className="text-sm text-gray-600 mb-2">
            Your account balance: {member?.account_balance.toLocaleString()} UGX
          </p>
          {error && <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-xl">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loan Amount (UGX)</label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-[#007B8A]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Period (Months)</label>
              <select
                value={formData.repayment_period}
                onChange={(e) => setFormData({ ...formData, repayment_period: e.target.value })}
                className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-[#007B8A]"
              >
                {['3', '6', '12', '18', '24'].map((m) => (
                  <option key={m} value={m}>
                    {m} Months
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-[#007B8A]"
                rows={3}
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-gray-700">
                  Guarantors (Remaining: {remainingAmount.toLocaleString()} UGX)
                </span>
                <button
                  type="button"
                  onClick={addGuarantor}
                  disabled={guarantors.length >= 2 || remainingAmount <= 0}
                  className="text-sm text-[#007B8A] hover:underline disabled:text-gray-400"
                >
                  + Add Guarantor
                </button>
              </div>
              <div className="space-y-2">
                {guarantors.map((g, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Search member"
                      value={g.search}
                      onChange={(e) => handleSearch(idx, e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-[#007B8A]"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      max={remainingAmount + Number(g.amount || 0)}
                      value={g.amount}
                      onChange={(e) => handleAmountChange(idx, e.target.value)}
                      className="w-32 px-3 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-[#007B8A]"
                      required
                    />
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => removeGuarantor(idx)}
                        className="text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                {searchLoading && <p className="text-xs text-gray-500 mt-1">Searching...</p>}
                {searchResults.length > 0 && (
                  <div className="border bg-white rounded-xl max-h-40 overflow-y-auto mt-1">
                    {searchResults.map((m) => (
                      <div
                        key={m.id}
                        className="p-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => selectGuarantor(guarantors.length - 1, m)}
                      >
                        {m.full_name} - {m.member_number}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 bg-[#007B8A] text-white rounded-xl font-medium disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Loan Request'}
              </button>
              <button
                type="button"
                onClick={() => setShowLoanModal(false)}
                className="flex-1 py-2 bg-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      {/* ... rest of your original code unchanged ... */}

      {/* Request Loan Button */}
      <div className="text-center mt-4">
        <button
          onClick={() => setShowLoanModal(true)}
          className="px-6 py-3 bg-[#007B8A] text-white rounded-xl font-medium hover:bg-[#005f6b] transition-colors"
        >
          Request a Loan
        </button>
      </div>

      {showLoanModal && <LoanRequestModal />}
    </div>
  );
}
