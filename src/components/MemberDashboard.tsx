import { useState, useEffect } from 'react';
import { supabase, Member, Transaction, Loan, Notification } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DollarSign, TrendingUp, CreditCard, Bell, LogOut, FileText, Send } from 'lucide-react';

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

    const [memberRes, transactionsRes, loansRes, notificationsRes] = await Promise.all([
      supabase.from('members').select('*').eq('profile_id', profile.id).maybeSingle(),
      supabase.from('transactions').select('*').eq('member_id', profile.id).order('transaction_date', { ascending: false }).limit(10),
      supabase.from('loans').select('*').eq('member_id', profile.id).order('requested_date', { ascending: false }),
      supabase.from('notifications').select('*').eq('member_id', profile.id).order('sent_at', { ascending: false }).limit(20),
    ]);

    if (memberRes.data) {
      const memberWithId = await supabase
        .from('members')
        .select('*')
        .eq('profile_id', profile.id)
        .maybeSingle();

      setMember(memberWithId.data);

      if (memberWithId.data) {
        const [txRes, loanRes, notifRes] = await Promise.all([
          supabase.from('transactions').select('*').eq('member_id', memberWithId.data.id).order('transaction_date', { ascending: false }).limit(10),
          supabase.from('loans').select('*').eq('member_id', memberWithId.data.id).order('requested_date', { ascending: false }),
          supabase.from('notifications').select('*').eq('member_id', memberWithId.data.id).order('sent_at', { ascending: false }).limit(20),
        ]);

        setTransactions(txRes.data || []);
        setLoans(loanRes.data || []);
        setNotifications(notifRes.data || []);
      }
    }
  };

  const LoanRequestModal = () => {
    const [formData, setFormData] = useState({
      amount: '',
      repayment_period: '12',
      reason: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError('');

      try {
        if (!member) throw new Error('Member data not found');

        // Minimum deposit required to request a loan
        const MIN_DEPOSIT = 50000; // UGX
        if (Number(member.account_balance) < MIN_DEPOSIT) {
          throw new Error(`You must have at least UGX ${MIN_DEPOSIT.toLocaleString()} in your account to request a loan.`);
        }

        // Loan limit based on member balance (max 2x account balance)
        const MAX_LOAN_MULTIPLIER = 2;
        const maxLoanAmount = Number(member.account_balance) * MAX_LOAN_MULTIPLIER;
        if (parseFloat(formData.amount) > maxLoanAmount) {
          throw new Error(`Your loan request cannot exceed UGX ${maxLoanAmount.toLocaleString()} based on your account balance.`);
        }

        // Check company available balance
        const companyBalanceRes = await supabase
          .from('company_balance')
          .select('balance')
          .maybeSingle();
        const companyBalance = companyBalanceRes.data?.balance || 0;
        if (parseFloat(formData.amount) > companyBalance) {
          throw new Error(`Loan request exceeds the company’s available balance of UGX ${companyBalance.toLocaleString()}.`);
        }

        // Generate a unique loan number
        const loanNumber = "LN" + Date.now() + Math.floor(Math.random() * 1000);

        // Insert loan request
        const { error: loanError } = await supabase.from('loans').insert({
          member_id: member.id,
          loan_number: loanNumber,
          amount_requested: parseFloat(formData.amount),
          repayment_period_months: parseInt(formData.repayment_period),
          reason: formData.reason,
        });

        if (loanError) throw loanError;

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
        <div className="bg-white rounded-2xl p-6 max-w-md w-full">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Request Loan</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loan Amount (UGX)</label>
              <input
                type="number"
                step="1000"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#007B8A] focus:border-transparent outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Period (Months)</label>
              <select
                value={formData.repayment_period}
                onChange={(e) => setFormData({ ...formData, repayment_period: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#007B8A] focus:border-transparent outline-none"
              >
                <option value="3">3 Months</option>
                <option value="6">6 Months</option>
                <option value="12">12 Months</option>
                <option value="18">18 Months</option>
                <option value="24">24 Months</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Loan</label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#007B8A] focus:border-transparent outline-none"
                rows={3}
                required
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 btn-primary text-white font-medium rounded-xl disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
              <button
                type="button"
                onClick={() => setShowLoanModal(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const unreadCount = notifications.filter(n => !n.read).length;

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
                onClick={() => signOut()}
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

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Account Balance */}
          <div className="bg-white rounded-2xl p-6 card-shadow-hover">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#007B8A] to-[#00BFFF] flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Account Balance</p>
            <h3 className="text-3xl font-bold text-[#007B8A]">
              UGX {member ? Number(member.account_balance).toLocaleString() : '0'}
            </h3>
          </div>

          {/* Contributions */}
          <div className="bg-white rounded-2xl p-6 card-shadow-hover">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00BFFF] to-[#D8468C] flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Total Contributions</p>
            <h3 className="text-3xl font-bold text-[#007B8A]">
              UGX {member ? Number(member.total_contributions).toLocaleString() : '0'}
            </h3>
          </div>

          {/* Loans */}
          <div className="bg-white rounded-2xl p-6 card-shadow-hover">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#007B8A] to-[#D8468C] flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Active Loans</p>
            <h3 className="text-3xl font-bold text-gray-800">
              {loans.filter(l => l.status === 'disbursed').length}
            </h3>
          </div>
        </div>

        {/* Recent Transactions & Loans */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Recent Transactions */}
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
                    <p className={`text-sm font-semibold ${
                      tx.transaction_type === 'withdrawal' ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {tx.transaction_type === 'withdrawal' ? '-' : '+'}UGX {Number(tx.amount).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-600">Bal: UGX {Number(tx.balance_after).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* My Loans */}
          <div className="bg-white rounded-2xl card-shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">My Loans</h3>
              <button
                onClick={() => setShowLoanModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 btn-primary text-white text-sm font-medium rounded-lg"
              >
                <Send className="w-4 h-4" />
                Request Loan
              </button>
            </div>
            <div className="space-y-3">
              {loans.length === 0 ? (
                <p className="text-sm text-gray-600">No loans yet</p>
              ) : (
                loans.map((loan) => (
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
                      }`}>
                        {loan.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Amount: UGX {Number(loan.amount_approved || loan.amount_requested).toLocaleString()}</span>
                      {loan.outstanding_balance !== null && (
                        <span className="font-semibold text-[#007B8A]">
                          Outstanding: UGX {Number(loan.outstanding_balance).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {showLoanModal && <LoanRequestModal />}
    </div>
  );
}
