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
import GuarantorApprovalModal from '../components/GuarantorApprovalModal';

export default function MemberDashboard() {
  const { profile, signOut } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingGuarantorLoans, setPendingGuarantorLoans] = useState<Loan[]>([]);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showGuarantorModal, setShowGuarantorModal] = useState<Loan | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  // Load member data
  useEffect(() => {
    loadMemberData();
  }, [profile]);

  const loadMemberData = async () => {
    if (!profile) return;

    try {
      // Fetch member
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

      // Load transactions, loans, notifications, pending guarantor loans
      const [txRes, loanRes, notifRes, pendingRes] = await Promise.all([
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
        supabase
          .from('loans_with_guarantors')
          .select('*')
          .eq('guarantor_id', fetchedMember.id)
          .eq('status', 'pending'),
      ]);

      setTransactions(txRes.data || []);
      setLoans(loanRes.data || []);
      setNotifications(notifRes.data || []);
      setPendingGuarantorLoans(pendingRes.data || []);
    } catch (err) {
      console.error('Failed to load member data:', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Real-time subscription for new guarantee requests
  useEffect(() => {
    if (!member) return;

    const subscription = supabase
      .channel('public:loan_guarantees')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'loan_guarantees' },
        async (payload) => {
          const guarantee = payload.new as any;

          // Only show notifications for current member
          if (guarantee.guarantor_id === member.id) {
            // Check if notification already exists
            const { data: existing } = await supabase
              .from('notifications')
              .select('*')
              .eq('loan_id', guarantee.loan_id)
              .eq('member_id', member.id)
              .eq('type', 'Guarantee Request');

            if (!existing || existing.length === 0) {
              // Insert notification
              const { data: newNotif } = await supabase
                .from('notifications')
                .insert({
                  member_id: member.id,
                  loan_id: guarantee.loan_id,
                  title: 'Guarantee Request',
                  message: `You have been requested to guarantee loan ${guarantee.loan_id} for amount UGX ${guarantee.amount_guaranteed}. Please accept or decline.`,
                  type: 'Guarantee Request',
                  read: false,
                  sent_at: new Date(),
                })
                .select()
                .single();

              setNotifications((prev) => [newNotif, ...prev]);
            }

            // Open modal automatically
            const { data: loanData } = await supabase
              .from('loans')
              .select('*')
              .eq('id', guarantee.loan_id)
              .maybeSingle();

            if (loanData) setShowGuarantorModal(loanData);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, [member]);

  // Handle Approve / Reject
  const handleGuarantorDecision = async (
    loanId: string,
    guarantorId: string,
    decision: 'accepted' | 'declined'
  ) => {
    try {
      // Update loan_guarantee record
      await supabase
        .from('loan_guarantees')
        .update({ status: decision })
        .eq('loan_id', loanId)
        .eq('guarantor_id', guarantorId);

      // Update notification as read
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('loan_id', loanId)
        .eq('member_id', guarantorId)
        .eq('type', 'Guarantee Request');

      // Reload data
      await loadMemberData();
      setShowGuarantorModal(null);

      // Optionally: Admin is notified via trigger (notify_admin_when_all_guarantors_approved)
    } catch (err) {
      console.error('Failed to update guarantor decision:', err);
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
            <p className="text-sm text-gray-600 mb-1">Account Balance (UGX)</p>
            <h3 className="text-3xl font-bold text-[#007B8A]">
              {member ? member.account_balance.toLocaleString() : '0'}
            </h3>
          </div>
          <div className="bg-white rounded-2xl p-6 card-shadow-hover">
            <p className="text-sm text-gray-600 mb-1">Total Contributions (UGX)</p>
            <h3 className="text-3xl font-bold text-[#007B8A]">
              {member ? member.total_contributions.toLocaleString() : '0'}
            </h3>
          </div>
          <div className="bg-white rounded-2xl p-6 card-shadow-hover">
            <p className="text-sm text-gray-600 mb-1">Active Loans</p>
            <h3 className="text-3xl font-bold text-gray-800">
              {loans.filter((l) => l.status === 'disbursed').length}
            </h3>
          </div>
        </div>

        {/* Pending Guarantor Approvals */}
        {pendingGuarantorLoans.length > 0 && (
          <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-3">Pending Guarantor Approvals</h3>
            <div className="space-y-3">
              {pendingGuarantorLoans.map((loan) => (
                <div
                  key={loan.id}
                  className="flex justify-between items-center p-3 bg-yellow-50 rounded-xl cursor-pointer"
                  onClick={() => setShowGuarantorModal(loan)}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{loan.loan_number}</p>
                    <p className="text-xs text-gray-600">
                      Amount Requested: {Number(loan.amount_requested).toLocaleString()} UGX
                    </p>
                  </div>
                  <button className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-sm font-medium">
                    Approve / Reject
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
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
          onApprove={() =>
            handleGuarantorDecision(showGuarantorModal.id, member.id, 'accepted')
          }
          onReject={() =>
            handleGuarantorDecision(showGuarantorModal.id, member.id, 'declined')
          }
        />
      )}
    </div>
  );
}
