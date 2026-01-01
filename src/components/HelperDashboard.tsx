import { useState, useEffect, useCallback, SetStateAction } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Users,
  CreditCard,
  AlertCircle,
  LogOut,
  FileText,
  BarChart3,
} from 'lucide-react';
import MemberManagement from './MemberManagement';
import LoanManagement from './LoanManagement';
import Reports from './Reports';
import MemberDashboard from './MemberDashboard';
import Particles from 'react-tsparticles';
import { loadFull } from 'tsparticles';
import CountUp from 'react-countup';

export default function HelperDashboard() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showMemberView, setShowMemberView] = useState(false);
  const [stats, setStats] = useState({
    totalMembers: 0,
    pendingLoans: 0,
    activeLoans: 0,
  });

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
        supabase.from('members').select('*, profiles(id, full_name, role)').order('created_at', { ascending: false }),
        supabase.from('loans').select('status'),
      ]);

      const membersList = membersRes.data || [];

  const totalMembers = membersList?.length || 0;
      const pendingLoans = (loansRes?.data || []).filter((l) => l?.status === 'pending').length || 0;
      const activeLoans = (loansRes?.data || []).filter((l) => l?.status === 'disbursed').length || 0;

      setStats({ totalMembers, pendingLoans, activeLoans });
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  const handleTabChange = (tab: SetStateAction<string>) => {
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen gradient-bg relative overflow-hidden">
      <Particles
        id="tsparticles"
        init={particlesInit}
        loaded={particlesLoaded}
        className="absolute inset-0 pointer-events-none"
        options={{
          // keep the canvas confined to this container instead of attaching to <body>
          fullScreen: { enable: false },
          background: { color: { value: 'transparent' } },
          fpsLimit: 60,
          particles: {
            color: { value: '#ffffff' },
            opacity: { value: 0.12 },
            size: { value: { min: 1, max: 3 } },
            move: { enable: true, speed: 0.5 },
          },
        }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* Header */}
      <div className="relative z-10 bg-gradient-to-r from-[#071A3F] via-[#007B8A] to-[#0099B5] text-white p-6 shadow-xl">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Helper Assistant</h1>
            <p className="text-blue-100 text-sm mt-1">Limited Admin Functions</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{profile?.role}</p>
              <p className="text-xs text-blue-200">{profile?.email}</p>
            </div>
            {/* Employee: quick switch to Member view */}
            {profile?.role === 'employee' && (
              <button
                onClick={() => setShowMemberView((s) => !s)}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-300 hover:scale-105"
              >
                {showMemberView ? 'Back to Helper' : 'Member View'}
              </button>
            )}
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-300 hover:scale-105"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto p-6">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'members', label: 'Members', icon: Users },
            { id: 'loans', label: 'Loans', icon: CreditCard },
            { id: 'reports', label: 'Reports', icon: FileText },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                activeTab === id
                  ? 'bg-white text-[#007B8A] shadow-lg scale-105'
                  : 'bg-white/20 text-white hover:bg-white/30 hover:scale-105'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>

        {/* If employee toggled Member View, render MemberDashboard in a full-screen overlay */}
        {showMemberView && (
          <div className="fixed inset-0 z-50 flex flex-col bg-black/40">
            <div className="bg-white flex items-center justify-between p-3 shadow-md">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowMemberView(false)}
                  className="px-3 py-1 rounded-lg bg-[#007B8A] text-white"
                >
                  Back to Helper
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

        {!showMemberView && (
          <>
            {/* Disclaimer */}
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Limited Access Account</p>
                <p>You have restricted permissions. Financial transactions and system settings require admin approval.</p>
              </div>
            </div>

            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <StatCard icon={Users} label="Total Members" value={stats.totalMembers} index={0} />
                  <StatCard icon={AlertCircle} label="Pending Loans" value={stats.pendingLoans} index={1} />
                  <StatCard icon={CreditCard} label="Active Loans" value={stats.activeLoans} index={2} />
                </div>

                <div className="bg-white/90 rounded-2xl p-6 shadow-md">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Overview</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <h3 className="font-semibold text-gray-800 mb-2">Your Responsibilities</h3>
                      <ul className="text-sm text-gray-700 space-y-2">
                        <li>✓ View member information</li>
                        <li>✓ Manage loan requests</li>
                        <li>✓ View reports and analytics</li>
                        <li>✓ Assist with member verification</li>
                      </ul>
                    </div>

                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <h3 className="font-semibold text-gray-800 mb-2">Restricted Actions</h3>
                      <ul className="text-sm text-gray-700 space-y-2">
                        <li>✗ Cannot approve/reject loans</li>
                        <li>✗ Cannot manage finances</li>
                        <li>✗ Cannot modify system settings</li>
                        <li>✗ Cannot view sensitive reports</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Members Tab */}
            {activeTab === 'members' && (
              <div>
                <MemberManagement isHelper={true} />
              </div>
            )}

            {/* Loans Tab */}
            {activeTab === 'loans' && (
              <div>
                <LoanManagement isHelper={true} />
              </div>
            )}

            {/* Reports Tab */}
            {activeTab === 'reports' && (
              <div>
                <Reports isHelper={true} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
