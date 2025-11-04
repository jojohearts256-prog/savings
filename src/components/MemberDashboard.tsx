import { useState, useEffect, useMemo } from 'react';
import { supabase, Member, Transaction, Loan, Notification } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DollarSign, TrendingUp, CreditCard, Bell, LogOut, FileText, Send } from 'lucide-react';
import { debounce } from 'lodash';

export default function MemberDashboard() {
  const { profile, signOut } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    loadMemberData();
  }, [profile]);

  const loadMemberData = async () => {
    if (!profile) return;

    try {
      // Fetch member data
      const memberRes = await supabase.from('members').select('*').eq('profile_id', profile.id).maybeSingle();
      if (!memberRes.data) return;

      const fetchedMember = {
        ...memberRes.data,
        account_balance: Number(memberRes.data.account_balance),
        total_contributions: Number(memberRes.data.total_contributions),
      };
      setMember(fetchedMember);

      // Fetch transactions, loans, and notifications
      const [txRes, loanRes, notifRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('member_id', fetchedMember.id).order('transaction_date', { ascending: false }).limit(10),
        supabase.from('loans').select('*').eq('member_id', fetchedMember.id).order('requested_date', { ascending: false }),
        supabase.from('notifications').select('*').eq('member_id', fetchedMember.id).order('sent_at', { ascending: false }).limit(20),
      ]);

      setTransactions(txRes.data || []);
      setLoans(loanRes.data || []);
      setNotifications(notifRes.data || []);

      // Supplemental Loan Reminders & Overdue Notifications
      const reminders: Notification[] = [];
      loanRes.data?.forEach((loan) => {
        if (loan.status !== 'disbursed' || !loan.disbursed_date) return;
        const dueDate = new Date(loan.disbursed_date);
        dueDate.setMonth(dueDate.getMonth() + loan.repayment_period_months);
        const today = new Date();
        const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays > 0 && diffDays <= 10) {
          reminders.push({
            id: `loan-reminder-${loan.id}`,
            member_id: fetchedMember.id,
            title: 'Loan Reminder',
            message: `Reminder: Your loan ${loan.loan_number} has ${diffDays} days remaining.`,
            type: 'loan_reminder',
            read: false,
            sent_at: new Date(),
          });
        }
        if (diffDays < 0) {
          reminders.push({
            id: `loan-overdue-${loan.id}`,
            member_id: fetchedMember.id,
            title: 'Loan Overdue',
            message: `Alert: Your loan ${loan.loan_number} is overdue by ${Math.abs(diffDays)} days. Please repay immediately.`,
            type: 'loan_overdue',
            read: false,
            sent_at: new Date(),
          });
        }
      });

      setNotifications((prev) => [...prev, ...reminders]);
    } catch (err) {
      console.error('Failed to load member data:', err);
    }
  };

  // --- Loan Modal with Guarantor Logic ---
  const LoanRequestModal = () => {
    const [formData, setFormData] = useState({ amount: '', repayment_period: '12', reason: '' });
    const [guarantors, setGuarantors] = useState([{ member_id: 0, name: '', amount: '', search: '' }]);
    const [searchResults, setSearchResults] = useState<Member[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const remainingAmount = useMemo(() => {
      return Math.max(Number(formData.amount || 0) - guarantors.reduce((sum, g) => sum + Number(g.amount || 0), 0), 0);
    }, [formData.amount, guarantors]);

    const debouncedSearch = debounce(async (query: string) => {
      if (!query) return setSearchResults([]);
      const { data } = await supabase.from('members').select('*').ilike('full_name', `%${query}%`).neq('profile_id', profile?.id).limit(5);
      const filtered = data?.filter((m) => !guarantors.some((g) => g.member_id === m.id)) || [];
      setSearchResults(filtered);
    }, 300);

    const handleSearch = (index: number, query: string) => {
      setGuarantors((prev) => {
        const updated = [...prev];
        updated[index].search = query;
        return updated;
      });
      debouncedSearch(query);
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
      if (remainingAmount > 0 && guarantors.length < 2) setGuarantors((prev) => [...prev, { member_id: 0, name: '', amount: '', search: '' }]);
    };

    const handleAmountChange = (index: number, value: string) => {
      if (Number(value) > remainingAmount + Number(guarantors[index].amount || 0)) return;
      setGuarantors((prev) => {
        const updated = [...prev];
        updated[index].amount = value;
        return updated;
      });
    };

    const removeGuarantor = (index: number) => setGuarantors((prev) => prev.filter((_, i) => i !== index));

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError('');

      try {
        if (!member) throw new Error('Member data not found');
        const requestedAmount = Number(formData.amount);
        const totalGuarantee = guarantors.reduce((sum, g) => sum + Number(g.amount || 0), 0);
        if (totalGuarantee < requestedAmount) throw new Error('Guarantors do not cover requested amount');

        const loanNumber = 'LN' + Date.now() + Math.floor(Math.random() * 1000);
        const { data: loanData, error: loanError } = await supabase.from('loans').insert({
          member_id: member.id,
          loan_number: loanNumber,
          amount_requested: requestedAmount,
          repayment_period_months: parseInt(formData.repayment_period),
          reason: formData.reason,
        }).select().single();
        if (loanError) throw loanError;

        const validGuarantors = guarantors.filter((g) => Number(g.amount) > 0);
        if (validGuarantors.length > 0) {
          const { error: gError } = await supabase.from('loan_guarantors').insert(
            validGuarantors.map((g) => ({ loan_id: loanData.id, guarantor_id: g.member_id, amount: Number(g.amount) }))
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
        <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Request Loan</h2>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loan Amount (UGX)</label>
              <input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-[#007B8A]" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Period (Months)</label>
              <select value={formData.repayment_period} onChange={(e) => setFormData({ ...formData, repayment_period: e.target.value })} className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-[#007B8A]">
                {['3','6','12','18','24'].map((m) => <option key={m} value={m}>{m} Months</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-[#007B8A]" rows={3} required />
            </div>

            {/* Guarantors Section */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-gray-700">Guarantors (Remaining: {remainingAmount.toLocaleString()} UGX)</span>
                <button type="button" onClick={() => setGuarantors([...guarantors, { member_id: 0, name: '', amount: '', search: '' }])} disabled={guarantors.length >= 2 || remainingAmount <= 0} className="text-sm text-[#007B8A] hover:underline disabled:text-gray-400">+ Add Guarantor</button>
              </div>
              <div className="space-y-2">
                {guarantors.map((g, idx) => (
                  <div key={idx} className="flex gap-2 items-center relative">
                    <input type="text" placeholder="Search member" value={g.search} onChange={(e) => handleSearch(idx, e.target.value)} className="flex-1 px-3 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-[#007B8A]" />
                    <input type="number" placeholder="UGX" value={g.amount} onChange={(e) => handleAmountChange(idx, e.target.value)} className="w-24 px-3 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-[#007B8A]" />
                    <button type="button" onClick={() => removeGuarantor(idx)} className="text-red-500 font-bold">×</button>

                    {/* Search results */}
                    {searchResults.length > 0 && g.search && (
                      <div className="absolute bg-white border rounded-xl w-64 max-h-40 overflow-y-auto mt-12 z-50">
                        {searchResults.map((m) => (
                          <div key={m.id} onClick={() => selectGuarantor(idx, m)} className="p-2 hover:bg-gray-100 cursor-pointer">{m.full_name}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button type="submit" disabled={loading} className="flex-1 py-2 btn-primary text-white font-medium rounded-xl disabled:opacity-50">{loading ? 'Submitting...' : 'Submit Request'}</button>
              <button type="button" onClick={() => setShowLoanModal(false)} className="px-6 py-2 border rounded-xl hover:bg-gray-50">Cancel</button>
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
      <nav className="bg-gradient-to-r from-[#007B8A] via-[#00BFFF] to-[#D8468C] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#007B8A] to-[#D8468C] flex items-center justify-center shadow-md hover:scale-110 transition-transform duration-300">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-wide">My Account</h1>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 text-white hover:text-[#D8468C] hover:bg-white/20 rounded-xl transition-transform duration-300 hover:scale-105">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{unreadCount}</span>}
              </button>
              <div className="text-right">
                <p className="text-sm font-medium text-white">{profile?.full_name}</p>
                <p className="text-xs text-white/80">{member?.member_number}</p>
              </div>
              <button onClick={() => signOut()} className="p-2 text-white hover:text-red-600 hover:bg-white/20 rounded-xl transition-transform duration-300 hover:scale-105">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Notifications */}
      {showNotifications && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-white rounded-2xl card-shadow p-4 max-h-96 overflow-y-auto">
            <h3 className="font-bold text-gray-800 mb-3">Notifications</h3>
            {notifications.length === 0 ? <p className="text-sm text-gray-600">No notifications</p> : (
              <div className="space-y-2">
                {notifications.map((notif) => (
                  <div key={notif.id} className={`p-3 rounded-xl ${notif.read ? 'bg-gray-50' : 'bg-blue-50'}`} onClick={async () => { if (!notif.read) { await supabase.from('notifications').update({ read: true }).eq('id', notif.id); loadMemberData(); }}}>
                    <p className="text-sm font-medium text-gray-800">{notif.title}</p>
                    <p className="text-xs text-gray-600 mt-1">{notif.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{new Date(notif.sent_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Cards for balance, contributions, loans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 card-shadow-hover">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#007B8A] to-[#00BFFF] flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Account Balance (UGX)</p>
            <h3 className="text-3xl font-bold text-[#007B8A]">{member ? member.account_balance.toLocaleString() : '0'}</h3>
          </div>
          <div className="bg-white rounded-2xl p-6 card-shadow-hover">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00BFFF] to-[#D8468C] flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Total Contributions (UGX)</p>
            <h3 className="text-3xl font-bold text-[#007B8A]">{member ? member.total_contributions.toLocaleString() : '0'}</h3>
          </div>
          <div className="bg-white rounded-2xl p-6 card-shadow-hover">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#007B8A] to-[#D8468C] flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Active Loans</p>
            <h3 className="text-3xl font-bold text-gray-800">{loans.filter((l) => l.status === 'disbursed').length}</h3>
          </div>
        </div>

        {/* Transactions & Loans Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-2xl card-shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Recent Transactions</h3>
              <FileText className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-3">
              {transactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-800 capitalize">{tx.transaction_type}</p>
                    <p className="text-xs text-gray-600">{new Date(tx.transaction_date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${tx.transaction_type === 'withdrawal' ? 'text-red-600' : 'text-green-600'}`}>
                      {tx.transaction_type === 'withdrawal' ? '-' : '+'}{Number(tx.amount).toLocaleString()} UGX
                    </p>
                    <p className="text-xs text-gray-600">Bal: {Number(tx.balance_after).toLocaleString()} UGX</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl card-shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">My Loans</h3>
              <button onClick={() => setShowLoanModal(true)} className="flex items-center gap-2 px-3 py-1.5 btn-primary text-white text-sm font-medium rounded-lg">
                <Send className="w-4 h-4" /> Request Loan
              </button>
            </div>
            <div className="space-y-3">
              {loans.length === 0 ? <p className="text-sm text-gray-600">No loans yet</p> : loans.map((loan) => (
                <div key={loan.id} className="p-3 bg-gray-50 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{loan.loan_number}</p>
                      <p className="text-xs text-gray-600">{new Date(loan.requested_date).toLocaleDateString()}</p>
                    </div>
                    <span className={`status-badge text-xs ${
                      loan.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      loan.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                      loan.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      loan.status === 'disbursed' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>{loan.status}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Amount: {Number(loan.amount_approved || loan.amount_requested).toLocaleString()} UGX</span>
                    {loan.outstanding_balance !== null && <span className="font-semibold text-[#007B8A]">Outstanding: {Number(loan.outstanding_balance).toLocaleString()} UGX</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showLoanModal && <LoanRequestModal />}
    </div>
  );
}
