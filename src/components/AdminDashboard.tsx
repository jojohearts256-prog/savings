import { useState, useEffect, useCallback } from 'react';
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
import Particles from 'react-tsparticles';
import type { Engine, Container } from 'tsparticles-engine';
import { loadFull } from 'tsparticles';
import CountUp from 'react-countup';

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

  const particlesInit = useCallback(async (engine: Engine) => {
    await loadFull(engine);
  }, []);

  const particlesLoaded = useCallback(async (container: Container | undefined) => {}, []);

  const StatCard = ({ icon: Icon, label, value, index }: any) => (
    <div
      className="bg-white/90 rounded-2xl p-6 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-2 hover:scale-105 animate-float"
      style={{ animationDelay: `${index * 0.2}s` }}
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#071A3F] via-[#007B8A] to-[#D8468C] flex items-center justify-center transition-transform duration-300 hover:scale-125 shadow"
        >
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-1">
        {typeof value === 'number' ? <CountUp end={value} duration={1.5} separator="," /> : value}
      </h3>
      <p className="text-sm text-gray-600">{label}</p>
    </div>
  );

  return (
    <div className="min-h-screen relative bg-gray-100">
      {/* Particles */}
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
            opacity: {
              value: 0.7,
              random: { enable: true, minimumValue: 0.4 },
              anim: { enable: true, speed: 0.5, opacity_min: 0.3, sync: false }
            },
            size: { value: { min: 2, max: 8 }, random: true, anim: { enable: true, speed: 4, size_min: 1, sync: false } },
            move: { enable: true, speed: 0.8, direction: 'none', random: true, straight: false, outModes: { default: 'out' } },
            links: { enable: true, distance: 140, color: '#00BFFF', opacity: 0.08, width: 1 }
          },
          interactivity: {
            events: { onHover: { enable: true, mode: 'repulse' }, onClick: { enable: true, mode: 'push' }, resize: true },
            modes: { grab: { distance: 200, links: { opacity: 0.2 } }, bubble: { distance: 200, size: 6, duration: 2, opacity: 0.8 }, repulse: { distance: 100 }, push: { quantity: 4 }, remove: { quantity: 2 } }
          },
          detectRetina: true
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

            {/* Profile + Logout */}
            <div className="flex items-center gap-4 relative z-20">
              <div className="text-right">
                <p className="text-sm font-medium text-white">{profile?.full_name}</p>
                <p className="text-xs text-white/80 capitalize">{profile?.role}</p>
              </div>
              <button
                onClick={async () => {
                  await signOut(); 
                  window.location.href = '/login'; // redirect to login page
                }}
                className="p-2 bg-white/20 hover:bg-red-500/30 rounded-xl transition-all duration-300 hover:scale-110 shadow-md hover:shadow-lg"
              >
                <LogOut className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

        {activeTab === 'dashboard' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6 animate-fade-in">Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <StatCard icon={Users} label="Total Members" value={stats.totalMembers} index={0} />
              <StatCard icon={DollarSign} label="Total Balance" value={stats.totalBalance} index={1} />
              <StatCard icon={CreditCard} label="Outstanding Loans" value={stats.totalLoans} index={2} />
              <StatCard icon={Bell} label="Pending Loans" value={stats.pendingLoans} index={3} />
            </div>
          </div>
        )}

        {activeTab === 'members' && <MemberManagement />}
        {activeTab === 'transactions' && <TransactionManagement />}
        {activeTab === 'loans' && <LoanManagement />}
        {activeTab === 'reports' && <Reports />}
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
