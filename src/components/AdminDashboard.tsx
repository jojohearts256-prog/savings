import { useState, useEffect } from 'react';
import { supabase, Member, Transaction, Loan } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Users,
  DollarSign,
  TrendingUp,
  CreditCard,
  LogOut,
  FileText,
  Bell,
} from 'lucide-react';
import MemberManagement from './MemberManagement';
import TransactionManagement from './TransactionManagement';
import LoanManagement from './LoanManagement';
import Reports from './Reports';

type Tab = 'dashboard' | 'members' | 'transactions' | 'loans' | 'reports';

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalBalance: 0,
    totalLoans: 0,
    pendingLoans: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const [membersRes, loansRes] = await Promise.all([
      supabase.from('members').select('account_balance'),
      supabase.from('loans').select('status, outstanding_balance'),
    ]);

    const totalMembers = membersRes.data?.length || 0;
    const totalBalance =
      membersRes.data?.reduce(
        (sum, m) => sum + Number(m.account_balance),
        0
      ) || 0;
    const pendingLoans =
      loansRes.data?.filter((l) => l.status === 'pending').length || 0;
    const totalLoans =
      loansRes.data?.reduce(
        (sum, l) => sum + Number(l.outstanding_balance || 0),
        0
      ) || 0;

    setStats({ totalMembers, totalBalance, totalLoans, pendingLoans });
  };

  // Modern stat card with floating animation
  const StatCard = ({ icon: Icon, label, value, color, index }: any) => (
    <div
      className={`bg-gradient-to-br ${color} rounded-2xl p-6 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:scale-105 hover:shadow-3xl animate-float`}
      style={{ animationDelay: `${index * 0.2}s` }}
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center transition-transform duration-300 hover:scale-125 shadow-lg`}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <h3 className="text-2xl font-bold text-white mb-1">{value}</h3>
      <p className="text-sm text-white/90">{label}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navbar */}
      <nav className="bg-gradient-to-r from-[#004366] to-[#005f99] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo + Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#004366] to-[#005f99] flex items-center justify-center shadow-md hover:scale-110 transition-transform duration-300">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-wide">
                SmartSave Admin
              </h1>
            </div>

            {/* Profile + Logout */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-white">
                  {profile?.full_name}
                </p>
                <p className="text-xs text-white/80 capitalize">
                  {profile?.role}
                </p>
              </div>
              <button
                onClick={() => signOut()}
                className="p-2 bg-white/20 hover:bg-red-500/30 rounded-xl transition-all duration-300 hover:scale-110 shadow-md hover:shadow-lg"
              >
                <LogOut className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-300">
            <nav className="flex gap-2">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
                { id: 'members', label: 'Members', icon: Users },
                { id: 'transactions', label: 'Transactions', icon: DollarSign },
                { id: 'loans', label: 'Loans', icon: CreditCard },
                { id: 'reports', label: 'Reports', icon: FileText },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as Tab)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-all duration-300 ${
                    activeTab === id
                      ? 'border-[#004366] text-[#004366]'
                      : 'border-transparent text-gray-600 hover:text-[#005f99] hover:border-[#005f99]'
                  } hover:scale-105`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Active Tab Content */}
        {activeTab === 'dashboard' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <StatCard
                icon={Users}
                label="Total Members"
                value={stats.totalMembers}
                color="from-[#004366] to-[#005f99]"
                index={0}
              />
              <StatCard
                icon={DollarSign}
                label="Total Balance"
                value={`$${stats.totalBalance.toLocaleString()}`}
                color="from-[#004366] to-[#005f99]"
                index={1}
              />
              <StatCard
                icon={CreditCard}
                label="Outstanding Loans"
                value={`$${stats.totalLoans.toLocaleString()}`}
                color="from-[#004366] to-[#005f99]"
                index={2}
              />
              <StatCard
                icon={Bell}
                label="Pending Loans"
                value={stats.pendingLoans}
                color="from-[#004366] to-[#005f99]"
                index={3}
              />
            </div>
          </div>
        )}

        {activeTab === 'members' && <MemberManagement />}
        {activeTab === 'transactions' && <TransactionManagement />}
        {activeTab === 'loans' && <LoanManagement />}
        {activeTab === 'reports' && <Reports />}
      </div>

      {/* Floating Animation */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
