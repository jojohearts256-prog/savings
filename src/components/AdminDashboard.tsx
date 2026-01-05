import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Notification } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Users,
  DollarSign,
  TrendingUp,
  CreditCard,
  Settings,
  LogOut,
  FileText,
  Bell,
  Banknote,
} from 'lucide-react';
import MemberManagement from './MemberManagement';
import TransactionManagement from './TransactionManagement';
import LoanManagement from './LoanManagement';
import Reports from './Reports';
import ProfitManagement from './ProfitManagement';
import MemberDashboard from './MemberDashboard';
import SystemSettingsPanel from './settings/SystemSettingsPanel';
import Particles from 'react-tsparticles';
import { loadFull } from 'tsparticles';
import CountUp from 'react-countup';

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [showMemberView, setShowMemberView] = useState(false);
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalBalance: 0,
    totalLoans: 0,
    pendingLoans: 0,
  });

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);

  const particlesInit = useCallback(async (engine: any) => {
    await loadFull(engine);
  }, []);

  const particlesLoaded = useCallback(async (_container?: any): Promise<void> => {
    void _container;
    return;
  }, []);

  interface StatCardProps {
    icon: any;
    label: string;
    value: number | string;
    index: number;
  }

  const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, index }) => (
    <div
      className="bg-white/90 rounded-2xl p-6 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-2 hover:scale-105 animate-float"
      style={{ animationDelay: `${index * 0.2}s` }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#071A3F] via-[#007B8A] to-[#D8468C] flex items-center justify-center transition-transform duration-300 hover:scale-125 shadow">
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-1">
        {typeof value === 'number' ? <CountUp end={value} duration={1.5} separator="," /> : value}
      </h3>
      <p className="text-sm text-gray-600">{label}</p>
    </div>
  );

  async function loadStats() {
    try {
      const [membersRes, loansRes] = await Promise.all([
        supabase.from('members').select('*, profiles(id, full_name, role, account_balance)').order('created_at', { ascending: false }),
        supabase.from('loans').select('status, outstanding_balance'),
      ]);

      const membersList = membersRes.data || [];

  const totalMembers = membersList?.length || 0;
  const totalBalance = (membersList || []).reduce((sum: any, m: any) => sum + Number(m?.account_balance || 0), 0) || 0;
      const pendingLoans = (loansRes?.data || []).filter((l) => l?.status === 'pending').length || 0;
      const totalLoans =
        (loansRes?.data || []).reduce((sum, l) => sum + Number(l?.outstanding_balance || 0), 0) || 0;

      setStats({ totalMembers, totalBalance, totalLoans, pendingLoans });
    } catch (err) {
      console.error('Failed to load stats:', err);
      setStats({ totalMembers: 0, totalBalance: 0, totalLoans: 0, pendingLoans: 0 });
    }
  }

  async function markAsRead(id: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);

      if (error) throw error;
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (err: any) {
      console.error('Failed to mark notification as read:', err);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch (err) {
      const e: any = err;
      console.error('Error signing out:', e?.message || e);
    }
  }

  // Close notifications when clicking outside
  useEffect(() => {
    function handleClickOutside(event: any) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notificationRef]);

  // Load stats once
  useEffect(() => {
    loadStats();
  }, []);

  // Subscribe to notifications in real-time
  useEffect(() => {
    // Initial load
    const fetchNotifications = async () => {
      // Only fetch notifications intended for admin: either member_id IS NULL (generic admin alerts)
      // or recipient_role explicitly set to 'admin'. This avoids showing member-specific notifications
      // (e.g., guarantor requests) which target individual members.
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .in('type', ['loan_request', 'loan_reminder_admin', 'loan_overdue_admin', 'loan_ready_for_admin'])
        .or('member_id.is.null,recipient_role.eq.admin')
        .order('sent_at', { ascending: false });
      if (error) console.error(error);
      else setNotifications(data || []);
    };

    fetchNotifications();

    // Subscribe to new notifications intended for admin. We create two subscriptions
    // (member_id IS NULL) OR (recipient_role = 'admin') because realtime filters are ANDed.
    const subs: any[] = [];

  const types = 'loan_request,loan_reminder_admin,loan_overdue_admin,loan_ready_for_admin';

    const subNull = supabase
      .channel('notifications-admin-null')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `member_id=is.null,type=in.(${types})` }, (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev]);
      })
      .subscribe();
    subs.push(subNull);

    const subRole = supabase
      .channel('notifications-admin-role')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_role=eq.admin,type=in.(${types})` }, (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev]);
      })
      .subscribe();
    subs.push(subRole);

    return () => {
      subs.forEach((s) => supabase.removeChannel(s));
    };
  }, []);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'transactions', label: 'Transactions', icon: DollarSign },
    { id: 'loans', label: 'Loans', icon: CreditCard },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'profits', label: 'Profits', icon: Banknote },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen relative bg-gray-100">
      {/* Particles Background */}
      <Particles
        id="dashboard-particles"
        init={particlesInit}
        loaded={particlesLoaded}
        style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}
        options={{
          fullScreen: { enable: false },
          fpsLimit: 60,
          background: { color: { value: 'transparent' } },
          particles: {
            number: { value: 40, density: { enable: true, area: 800 } },
            color: { value: ['#071A3F', '#007B8A', '#D8468C'] },
            shape: { type: 'circle' },
            opacity: { value: 0.7, random: { enable: true, minimumValue: 0.4 } },
            size: { value: { min: 2, max: 8 }, random: true },
            move: { enable: true, speed: 0.8, direction: 'none', random: true },
            links: { enable: true, distance: 140, color: '#00BFFF', opacity: 0.08, width: 1 },
          },
        }}
      />

      {/* Navbar */}
      <nav className="relative z-20 bg-gradient-to-r from-[#071A3F] via-[#007B8A] to-[#D8468C] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 relative z-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#071A3F] via-[#007B8A] to-[#D8468C] flex items-center justify-center shadow-md hover:scale-110 transition-transform duration-300">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-wide">SmartSave Admin</h1>
            </div>

            <div className="flex items-center gap-4 relative z-20">
              <div ref={notificationRef} className="relative">
                <button
                  onClick={() => setShowNotifications((prev) => !prev)}
                  className="p-2 bg-white/20 hover:bg-blue-500/30 rounded-xl transition-all duration-300 hover:scale-110 shadow-md hover:shadow-lg"
                >
                  <Bell className="w-5 h-5 text-white" />
                  {notifications.filter((n) => !n.read).length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center">
                      {notifications.filter((n) => !n.read).length}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white shadow-lg rounded-xl z-50 p-3">
                    {notifications.length === 0 ? (
                      <p className="text-gray-500 text-sm">No new notifications</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-3 rounded-lg mb-2 cursor-pointer transition-colors ${
                            n.read ? 'bg-gray-100' : 'bg-blue-50'
                          }`}
                          onClick={() => markAsRead(n.id)}
                        >
                          <p className="font-semibold text-gray-800">{n.title}</p>
                          <p className="text-sm text-gray-600">{n.message}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(n.sent_at).toLocaleString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="text-right">
                <p className="text-sm font-medium text-white">{profile?.full_name}</p>
                <p className="text-xs text-white/80 capitalize">{profile?.role}</p>
              </div>
              {/* Admin: quick switch to Member view */}
              {profile?.role === 'admin' && (
                <button
                  onClick={() => setShowMemberView((s) => !s)}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white/90 mr-2"
                >
                  {showMemberView ? 'Back to Admin' : 'Member View'}
                </button>
              )}
              <button
                onClick={handleSignOut}
                className="p-2 bg-white/20 hover:bg-red-500/30 rounded-xl transition-all duration-300 hover:scale-110 shadow-md hover:shadow-lg"
              >
                <LogOut className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* If admin toggled Member View, render MemberDashboard in a full-screen overlay */}
      {showMemberView && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/40">
          <div className="bg-white flex items-center justify-between p-3 shadow-md">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowMemberView(false)}
                className="px-3 py-1 rounded-lg bg-[#071A3F] text-white"
              >
                Back to Admin
              </button>
              <span className="inline-block px-3 py-1 bg-yellow-100 text-sm text-yellow-800 rounded">You are in Member View</span>
            </div>
            <div>
              <button onClick={() => setShowMemberView(false)} className="px-3 py-1 rounded bg-gray-100">Close</button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-white">
            <MemberDashboard hideHeader={true} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="border-b border-gray-300">
            <nav className="flex gap-2">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-all duration-300 ${
                    activeTab === id
                      ? 'border-[#071A3F] text-[#071A3F]'
                      : 'border-transparent text-gray-600 hover:text-[#D8468C] hover:border-[#D8468C]'
                  } hover:scale-105`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'dashboard' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6 animate-fade-in">Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <StatCard icon={Users} label="Total Members" value={stats.totalMembers} index={0} />
              <StatCard icon={DollarSign} label="Total Balance (UGX)" value={stats.totalBalance} index={1} />
              <StatCard icon={CreditCard} label="Outstanding Loans" value={stats.totalLoans} index={2} />
              <StatCard icon={Bell} label="Pending Loans" value={stats.pendingLoans} index={3} />
            </div>
          </div>
        )}

        {activeTab === 'members' && <MemberManagement />}
        {activeTab === 'transactions' && <TransactionManagement />}
        {activeTab === 'loans' && <LoanManagement />}
        {activeTab === 'reports' && <Reports />}
        {activeTab === 'profits' && <ProfitManagement />}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <SystemSettingsPanel />
          </div>
        )}
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }

        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 1s ease-out forwards; }
      `}</style>
    </div>
  );
}
