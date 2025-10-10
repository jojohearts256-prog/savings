import { useState, useEffect } from 'react';
import { supabase, Member, Transaction, Loan } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Users, DollarSign, TrendingUp, CreditCard, LogOut, UserPlus, FileText, Bell } from 'lucide-react';
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
    const totalBalance = membersRes.data?.reduce((sum, m) => sum + Number(m.account_balance), 0) || 0;
    const pendingLoans = loansRes.data?.filter(l => l.status === 'pending').length || 0;
    const totalLoans = loansRes.data?.reduce((sum, l) => sum + Number(l.outstanding_balance || 0), 0) || 0;

    setStats({ totalMembers, totalBalance, totalLoans, pendingLoans });
  };

  // Modern card component with hover animation
  const StatCard = ({ icon: Icon, label, value, color }: any) => (
    <div className="bg-gradient-to-br from-white/80 to-gray-100 rounded-2xl p-6 shadow-lg transition-transform duration-300 hover:-translate-y-2 hover:shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center transition-transform duration-300 hover:scale-110`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <h3 className="text-2xl font-bold text-gray-800 mb-1">{value}</h3>
      <p className="text-sm text-gray-600">{label}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navbar */}
      <nav className="bg-gradient-to-r from-[#008080] to-[#00A3A3] shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#008080] to-[#ADD8E6] flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white">Savings Group</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-white">{profile?.full_name}</p>
                <p className="text-xs text-white/80 capitalize">{profile?.role}</p>
              </div>
              <button
                onClick={() => signOut()}
                className="p-2 bg-white/20 hover:bg-red-600/20 rounded-xl transition-all duration-300 hover:scale-105"
              >
                <LogOut className="w-5 h-5 text-white hover:text-red-600" />
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
                      ? 'border-[#008080] text-[#008080]'
                      : 'border-transparent text-gray-600 hover:text-[#00A3A3] hover:border-[#00A3A3]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Active Tab */}
        {activeTab === 'dashboard' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <StatCard
                icon={Users}
                label="Total Members"
                value={stats.totalMembers}
                color="from-[#008080] to-[#00A3A3]"
              />
              <StatCard
                icon={DollarSign}
                label="Total Balance"
                value={`$${stats.totalBalance.toLocaleString()}`}
                color="from-[#ADD8E6] to-[#87CEEB]"
              />
              <StatCard
                icon={CreditCard}
                label="Outstanding Loans"
                value={`$${stats.totalLoans.toLocaleString()}`}
                color="from-[#008080] to-[#ADD8E6]"
              />
              <StatCard
                icon={Bell}
                label="Pending Loans"
                value={stats.pendingLoans}
                color="from-[#00A3A3] to-[#ADD8E6]"
              />
            </div>
          </div>
        )}

        {activeTab === 'members' && <MemberManagement />}
        {activeTab === 'transactions' && <TransactionManagement />}
        {activeTab === 'loans' && <LoanManagement />}
        {activeTab === 'reports' && <Reports />}
      </div>
    </div>
  );
}
