import { useState, useEffect } from 'react';
import { supabase, Member, Transaction, Loan, Notification } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Bell,
  LogOut,
  FileText,
  Send,
} from 'lucide-react';
import LoanRequestModal from '../components/LoanRequestModal';

export default function MemberDashboard() {
  const { profile, signOut } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingGuarantorLoans, setPendingGuarantorLoans] = useState<
    (Loan & { borrower_name: string })[]
  >([]);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loadingGuarantorAction, setLoadingGuarantorAction] = useState(false);

  useEffect(() => {
    loadMemberData();
  }, [profile]);

  const loadMemberData = async () => {
    if (!profile) return;

    try {
      // Load member info
      const memberRes = await supabase
        .from('members')
        .select('*')
        .eq('profile_id', profile.id)
        .maybeSingle();
      if (!memberRes.data) return;

      const fetchedMember = {
        ...memberRes.data,
        account_balance: Number(memberRes.data.account_balance),
        total_contributions: Number(memberRes.data.total_contributions),
      };
      setMember(fetchedMember);

      // Load transactions, loans, notifications in parallel
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

      // Loan reminders and overdue
      const reminders: Notification[] = [];
      loanRes.data?.forEach((loan) => {
        if (loan.status !== 'disbursed' || !loan.disbursed_date) return;
        const dueDate = new Date(loan.disbursed_date);
        dueDate.setMonth(dueDate.getMonth() + loan.repayment_period_months);
        const today = new Date();
        const diffDays = Math.ceil(
          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

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
            message: `Alert: Your loan ${loan.loan_number} is overdue by ${Math.abs(
              diffDays
            )} days. Please repay immediately.`,
            type: 'loan_overdue',
            read: false,
            sent_at: new Date(),
          });
        }
      });
      setNotifications((prev) => [...prev, ...reminders]);

      // Fetch loans where this member is a guarantor and approval is pending
      const pendingGuarantorRes = await supabase
        .from('loans')
        .select(`
          *,
          member:member_id(full_name)
        `)
        .contains('guarantors', [{ member_id: fetchedMember.id, approved: false }]);

      const pendingWithName = (pendingGuarantorRes.data || []).map((loan) => ({
        ...loan,
        borrower_name: loan.member?.full_name || 'Unknown',
      }));

      setPendingGuarantorLoans(pendingWithName);
    } catch (err) {
      console.error('Failed to load member data:', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Approve / Reject loan directly
  const handleGuarantorAction = async (loanId: string, approve: boolean) => {
    if (!member) return;
    setLoadingGuarantorAction(true);

    try {
      // Update guarantor status in the loan's guarantors array
      const loanData = pendingGuarantorLoans.find((l) => l.id === loanId);
      if (!loanData) return;

      const updatedGuarantors = loanData.guarantors.map((g) =>
        g.member_id === member.id ? { ...g, approved: approve } : g
      );

      await supabase
        .from('loans')
        .update({ guarantors: updatedGuarantors })
        .eq('id', loanId);

      loadMemberData();
    } catch (err) {
      console.error('Failed to update guarantor approval:', err);
    } finally {
      setLoadingGuarantorAction(false);
    }
  };

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
                        await supabase
                          .from('notifications')
                          .update({ read: true })
                          .eq('id', notif.id);
                        loadMemberData();
                      }
                    }}
                  >
                    <p className="text-sm font-medium text-gray-800">{notif.title}</p>
                    <p className="text-xs text-gray-600 mt-1">{notif.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(notif.sent_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 card-shadow-hover">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#007B8A] to-[#00BFFF] flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Account Balance (UGX)</p>
            <h3 className="text-3xl font-bold text-[#007B8A]">
              {member ? member.account_balance.toLocaleString() : '0'}
            </h3>
          </div>

          <div className="bg-white rounded-2xl p-6 card-shadow-hover">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00BFFF] to-[#D8468C] flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Total Contributions (UGX)</p>
            <h3 className="text-3xl font-bold text-[#007B8A]">
              {member ? member.total_contributions.toLocaleString() : '0'}
            </h3>
          </div>

          <div className="bg-white rounded-2xl p-6 card-shadow-hover">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#007B8A] to-[#D8468C] flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Active Loans</p>
            <h3 className="text-3xl font-bold text-gray-800">
              {loans.filter((l) => l.status === 'disbursed').length}
            </h3>
          </div>
        </div>

        {/* Pending Guarantor Approvals – Beautiful Cards with Approve/Reject */}
        {pendingGuarantorLoans.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-3">Pending Guarantor Approvals</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingGuarantorLoans.map((loan) => (
                <div
                  key={loan.id}
                  className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-2xl shadow-md hover:shadow-xl transition-shadow"
                >
                  <p className="text-sm text-gray-600">Borrower:</p>
                  <p className="text-lg font-bold text-gray-800 mb-2">{loan.borrower_name}</p>
                  <p className="text-sm text-gray-600">Loan Number:</p>
                  <p className="text-md font-medium text-gray-800 mb-2">{loan.loan_number}</p>
                  <p className="text-sm text-gray-600">Amount Requested:</p>
                  <p className="text-md font-medium text-gray-800 mb-3">
                    {Number(loan.amount_requested).toLocaleString()} UGX
                  </p>
                  <div className="flex gap-2">
                    <button
                      disabled={loadingGuarantorAction}
                      onClick={() => handleGuarantorAction(loan.id, true)}
                      className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      disabled={loadingGuarantorAction}
                      onClick={() => handleGuarantorAction(loan.id, false)}
                      className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transactions and Loans */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Recent Transactions */}
          <div className="bg-white rounded-2xl card-shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Recent Transactions</h3>
              <FileText className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-3">
              {transactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-xl"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800 capitalize">
                      {tx.transaction_type}
                    </p>
                    <p className="text-xs text-gray-600">
                      {new Date(tx.transaction_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold ${
                        tx.transaction_type === 'withdrawal' ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {tx.transaction_type === 'withdrawal' ? '-' : '+'}
                      {Number(tx.amount).toLocaleString()} UGX
                    </p>
                    <p className="text-xs text-gray-600">
                      Bal: {Number(tx.balance_after).toLocaleString()} UGX
                    </p>
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
                <Send className="w-4 h-4" /> Request Loan
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
                        <p className="text-xs text-gray-600">
                          {new Date(loan.requested_date).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`status-badge text-xs ${
                          loan.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : loan.status === 'approved'
                            ? 'bg-blue-100 text-blue-800'
                            : loan.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : loan.status === 'disbursed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {loan.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>
                        Amount:{' '}
                        {Number(loan.amount_approved || loan.amount_requested).toLocaleString()} UGX
                      </span>
                      {loan.outstanding_balance !== null && (
                        <span className="font-semibold text-[#007B8A]">
                          Outstanding: {Number(loan.outstanding_balance).toLocaleString()} UGX
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

      {/* Loan Request Modal */}
      {showLoanModal && (
        <LoanRequestModal
          member={member}
          profile={profile}
          onClose={() => setShowLoanModal(false)}
          onSuccess={loadMemberData}
        />
      )}
    </div>
  );
}
