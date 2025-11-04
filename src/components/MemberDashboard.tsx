import { useState, useEffect } from 'react';
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

  // Inner Loan Modal Component
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

    const remainingAmount =
      Number(formData.amount || 0) -
      guarantors.reduce((sum, g) => sum + Number(g.amount || 0), 0);

    const handleSearch = async (index: number, query: string) => {
      setGuarantors((prev) => {
        const updated = [...prev];
        updated[index].search = query;
        return updated;
      });
      if (!query) {
        setSearchResults([]);
        return;
      }
      const { data } = await supabase
        .from('members')
        .select('*')
        .ilike('full_name', `%${query}%`)
        .neq('profile_id', profile?.id)
        .limit(5);
      setSearchResults(data || []);
    };

    const selectGuarantor = (index: number, member: Member) => {
      setGuarantors((prev) => {
        const updated = [...prev];
        updated[index].member_id = member.id;
        updated[index].name = member.full_name;
        updated[index].search = member.full_name;
        return updated;
      });
      setSearchResults([]);
      if (index === 0 && remainingAmount > 0 && guarantors.length < 2) addGuarantor();
    };

    const handleAmountChange = (index: number, value: string) => {
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

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError('');

      try {
        if (!member) throw new Error('Member not found');

        const requestedAmount = Number(formData.amount);
        const totalGuarantee = guarantors.reduce((sum, g) => sum + Number(g.amount || 0), 0);
        if (totalGuarantee < requestedAmount)
          throw new Error('Guarantors do not cover requested amount');

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

        for (const g of guarantors) {
          if (Number(g.amount) > 0) {
            await supabase.from('loan_guarantors').insert({
              loan_id: loanData.id,
              guarantor_id: g.member_id,
              amount: Number(g.amount),
            });
          }
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
            {/* Loan Amount */}
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

            {/* Repayment Period */}
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

            {/* Reason */}
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

            {/* Guarantors */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-gray-700">Guarantors</span>
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
                      max={remainingAmount}
                      value={g.amount}
                      onChange={(e) => handleAmountChange(idx, e.target.value)}
                      className="w-32 px-3 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-[#007B8A]"
                      required
                    />
                  </div>
                ))}
                {searchResults.length > 0 && (
                  <div className="border bg-white rounded-xl max-h-40 overflow-y-auto">
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

            {/* Buttons */}
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
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-white hover:text-[#D8468C] hover:bg-white/20 rounded-xl transition-transform duration-300 hover:scale-105"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              <div className="text-right">
                <p className="text-sm font-medium text-white">{profile?.full_name}</p>
                <p className="text-xs text-white/80">{member?.member_number}</p>
              </div>
              <button
                onClick={signOut}
                className="p-2 text-white hover:text-red-600 hover:bg-white/20 rounded-xl transition-transform duration-300 hover:scale-105"
              >
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
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-600">No notifications</p>
            ) : (
              <div className="space-y-2">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3 rounded-xl ${notif.read ? 'bg-gray-50' : 'bg-blue-50'}`}
                    onClick={async () => {
                      if (!notif.read) {
                        await supabase.from('notifications').update({ read: true }).eq('id', notif.id);
                        loadMemberData();
                      }
                    }}
                  >
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

      {/* Dashboard */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Account Balance */}
          <StatCard
            icon={<DollarSign className="w-6 h-6 text-white" />}
            title="Account Balance (UGX)"
            value={member?.account_balance.toLocaleString() || '0'}
            color="from-[#007B8A] to-[#00BFFF]"
          />
          {/* Contributions */}
          <StatCard
            icon={<TrendingUp className="w-6 h-6 text-white" />}
            title="Total Contributions (UGX)"
            value={member?.total_contributions.toLocaleString() || '0'}
            color="from-[#00BFFF] to-[#D8468C]"
          />
          {/* Loans */}
          <StatCard
            icon={<CreditCard className="w-6 h-6 text-white" />}
            title="Active Loans"
            value={loans.filter((l) => l.status === 'disbursed').length.toString()}
            color="from-[#007B8A] to-[#D8468C]"
          />
        </div>

        {/* Transactions & Loans */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <RecentTransactions transactions={transactions} />
          <LoanRequests loans={loans} />
        </div>

        {/* Request Loan Button */}
        <div className="text-center mt-4">
          <button
            onClick={() => setShowLoanModal(true)}
            className="px-6 py-3 bg-[#007B8A] text-white rounded-xl font-medium hover:bg-[#005f6b] transition-colors"
          >
            Request a Loan
          </button>
        </div>
      </div>

      {showLoanModal && <LoanRequestModal />}
    </div>
  );
}

// Helper Components for Stats and Sections
const StatCard = ({
  icon,
  title,
  value,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  color: string;
}) => (
  <div className="bg-white rounded-2xl p-6 card-shadow-hover">
    <div className="flex items-center justify-between mb-4">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
        {icon}
      </div>
    </div>
    <p className="text-sm text-gray-600 mb-1">{title}</p>
    <h3 className="text-3xl font-bold text-[#007B8A]">{value}</h3>
  </div>
);

const RecentTransactions = ({ transactions }: { transactions: Transaction[] }) => (
  <div className="bg-white rounded-2xl card-shadow p-6">
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-lg font-bold text-gray-800">Recent Transactions</h3>
      <FileText className="w-5 h-5 text-gray-400" />
    </div>
    <div className="space-y-3">
      {transactions.length === 0 ? (
        <p className="text-sm text-gray-500">No recent transactions</p>
      ) : (
        transactions.map((tx) => (
          <div key={tx.id} className="flex justify-between">
            <p className="text-sm text-gray-700">{tx.description}</p>
            <p className="text-sm font-medium text-gray-800">{tx.amount.toLocaleString()} UGX</p>
          </div>
        ))
      )}
    </div>
  </div>
);

const LoanRequests = ({ loans }: { loans: Loan[] }) => (
  <div className="bg-white rounded-2xl card-shadow p-6">
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-lg font-bold text-gray-800">Loan Requests</h3>
    </div>
    <div className="space-y-3">
      {loans.length === 0 ? (
        <p className="text-sm text-gray-500">No loan requests yet</p>
      ) : (
        loans.map((loan) => (
          <div key={loan.id} className="flex justify-between">
            <p className="text-sm text-gray-700">{loan.reason}</p>
            <p className="text-sm font-medium text-gray-800">{loan.amount_requested.toLocaleString()} UGX</p>
          </div>
        ))
      )}
    </div>
  </div>
);
