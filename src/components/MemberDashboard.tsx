import { useState, useEffect } from 'react';
import { supabase, Member, Transaction, Loan, Notification } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DollarSign, TrendingUp, CreditCard, Bell, LogOut, FileText, Send } from 'lucide-react';
import LoanRequestModal from '../components/LoanRequestModal';
import GuarantorApprovalModal from '../components/GuarantorApprovalModal';

export default function MemberDashboard() {
  const { profile, signOut } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissedNotifications, setDismissedNotifications] = useState<Notification[]>([]);
  const [pendingGuarantorLoans, setPendingGuarantorLoans] = useState<Loan[]>([]);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showGuarantorModal, setShowGuarantorModal] = useState<Loan | null>(null);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);

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

      // Load transactions, loans, notifications
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

      // Loan reminders
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
            message: `Alert: Your loan ${loan.loan_number} is overdue by ${Math.abs(diffDays)} days.`,
            type: 'loan_overdue',
            read: false,
            sent_at: new Date(),
          });
        }
      });
      setNotifications((prev) => [...prev, ...reminders]);

      // Pending guarantor loans
      const { data: pendingLoans, error } = await supabase.from('loans_with_guarantors').select('*');
      if (error) throw error;

      const filteredPending = (pendingLoans || []).filter((loan) => {
        if (!loan.guarantors || !Array.isArray(loan.guarantors)) return false;
        return loan.guarantors.some(
          (g: any) => g.member_id === fetchedMember.id && g.status === 'pending'
        );
      });

      setPendingGuarantorLoans(filteredPending);
    } catch (err) {
      console.error('Failed to load member data:', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  // --- Notification Toast ---
  const NotificationToast = ({
    notif,
    onClose,
  }: {
    notif: Notification;
    onClose: () => void;
  }) => {
    useEffect(() => {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }, [onClose]);

    const handleClick = async () => {
      if (!notif.read) {
        await supabase.from('notifications').update({ read: true }).eq('id', notif.id);
      }
      onClose();
    };

    return (
      <div
        onClick={handleClick}
        className="cursor-pointer w-80 bg-white shadow-lg rounded-xl border-l-4 border-blue-500 p-4 hover:shadow-2xl transition-all duration-300 transform animate-slide-in flex justify-between items-start"
      >
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-800">{notif.title}</p>
          <p className="text-xs text-gray-600 mt-1">{notif.message}</p>
          <p className="text-xs text-gray-500 mt-1">{new Date(notif.sent_at).toLocaleTimeString()}</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-2 text-gray-400 hover:text-gray-700 font-bold"
        >
          ✕
        </button>
      </div>
    );
  };

  // Handle toast dismiss: move to dismissedNotifications so it's still in icon panel
  const handleToastClose = (notif: Notification) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
    setDismissedNotifications((prev) => [notif, ...prev]);
  };

  return (
    <div className="min-h-screen bg-gray-50 relative">
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
                onClick={() => setShowNotificationsPanel(!showNotificationsPanel)}
                className="relative p-2 text-white hover:text-[#D8468C] hover:bg-white/20 rounded-xl transition-transform duration-300 hover:scale-105"
              >
                <Bell className="w-5 h-5" />
                {(unreadCount > 0 || dismissedNotifications.length > 0) && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount + dismissedNotifications.length}
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

      {/* Floating Toast Notifications */}
      <div className="fixed top-5 right-5 flex flex-col gap-3 z-50">
        {notifications.map((notif) => (
          <NotificationToast key={notif.id} notif={notif} onClose={() => handleToastClose(notif)} />
        ))}
      </div>

      {/* Notifications Panel (click bell to open) */}
      {showNotificationsPanel && (
        <div className="fixed top-16 right-5 w-80 max-h-96 overflow-y-auto z-50 bg-white rounded-2xl shadow-lg p-4 animate-fade-in">
          <h3 className="font-bold text-gray-800 mb-3">Notifications</h3>
          {(dismissedNotifications.length === 0 && notifications.length === 0) ? (
            <p className="text-sm text-gray-600">No notifications</p>
          ) : (
            <div className="space-y-2">
              {[...dismissedNotifications, ...notifications].map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 rounded-xl ${
                    notif.read ? 'bg-gray-50' : 'bg-blue-50'
                  }`}
                  onClick={async () => {
                    if (!notif.read) {
                      await supabase.from('notifications').update({ read: true }).eq('id', notif.id);
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
      )}

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* --- Summary Cards, Pending Guarantor, Transactions & Loans --- */}
        {/* Keep your existing code for summary cards, loans, transactions, and modals here */}
      </div>

      {/* Modals */}
      {showLoanModal && member && (
        <LoanRequestModal
          member={member}
          profile={profile}
          onClose={() => setShowLoanModal(false)}
          onSuccess={loadMemberData}
        />
      )}

      {showGuarantorModal && member && (
        <GuarantorApprovalModal
          loan={showGuarantorModal}
          member={member}
          onClose={() => setShowGuarantorModal(null)}
          onSuccess={loadMemberData}
        />
      )}

      {/* Animations (Tailwind or custom classes) */}
      <style jsx>{`
        @keyframes slide-in {
          0% { transform: translateX(100%) }
          100% { transform: translateX(0%) }
        }
        .animate-slide-in { animation: slide-in 0.5s ease-out; }

        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(-10px) }
          100% { opacity: 1; transform: translateY(0px) }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}
