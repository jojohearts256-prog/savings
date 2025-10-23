import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Download, TrendingUp } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function Reports() {
  const [reportType, setReportType] = useState<'monthly' | 'yearly' | 'member'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => { loadMembers(); }, []);
  useEffect(() => { generateReport(); }, [reportType, selectedMonth, selectedYear, selectedMemberId]);

  const loadMembers = async () => {
    const { data } = await supabase.from('members').select('*, profiles(*)');
    setMembers(data || []);
  };

  const generateReport = async () => {
    if (reportType === 'monthly') await generateMonthlyReport();
    else if (reportType === 'yearly') await generateYearlyReport();
    else if (reportType === 'member' && selectedMemberId) await generateMemberReport();
  };

  // --- Report Generators ---
  const generateMonthlyReport = async () => {
    const startDate = new Date(selectedMonth + '-01');
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    const [transactionsRes, loansRes, membersRes] = await Promise.all([
      supabase.from('transactions').select('*').gte('transaction_date', startDate.toISOString()).lte('transaction_date', endDate.toISOString()),
      supabase.from('loans').select('*').gte('requested_date', startDate.toISOString()).lte('requested_date', endDate.toISOString()),
      supabase.from('members').select('account_balance'),
    ]);
    const transactions = transactionsRes.data || [];
    const loans = loansRes.data || [];
    const members = membersRes.data || [];
    const deposits = transactions.filter(t => t.transaction_type === 'deposit');
    const withdrawals = transactions.filter(t => t.transaction_type === 'withdrawal');
    const contributions = transactions.filter(t => t.transaction_type === 'contribution');

    setReportData({
      period: startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      totalDeposits: deposits.reduce((sum, t) => sum + Number(t.amount), 0),
      totalWithdrawals: withdrawals.reduce((sum, t) => sum + Number(t.amount), 0),
      totalContributions: contributions.reduce((sum, t) => sum + Number(t.amount), 0),
      transactionCount: transactions.length,
      loansRequested: loans.length,
      loansApproved: loans.filter(l => l.status === 'approved' || l.status === 'disbursed').length,
      totalLoanAmount: loans.filter(l => l.status !== 'rejected').reduce((sum, l) => sum + Number(l.amount_approved || l.amount_requested), 0),
      currentBalance: members.reduce((sum, m) => sum + Number(m.account_balance), 0),
    });
  };

  const generateYearlyReport = async () => {
    const startDate = new Date(`${selectedYear}-01-01`);
    const endDate = new Date(`${selectedYear}-12-31`);
    const [transactionsRes, loansRes, membersRes] = await Promise.all([
      supabase.from('transactions').select('*').gte('transaction_date', startDate.toISOString()).lte('transaction_date', endDate.toISOString()),
      supabase.from('loans').select('*').gte('requested_date', startDate.toISOString()).lte('requested_date', endDate.toISOString()),
      supabase.from('members').select('account_balance, total_contributions'),
    ]);
    const transactions = transactionsRes.data || [];
    const loans = loansRes.data || [];
    const members = membersRes.data || [];

    setReportData({
      period: selectedYear,
      totalDeposits: transactions.filter(t => t.transaction_type === 'deposit').reduce((sum, t) => sum + Number(t.amount), 0),
      totalWithdrawals: transactions.filter(t => t.transaction_type === 'withdrawal').reduce((sum, t) => sum + Number(t.amount), 0),
      totalContributions: transactions.filter(t => t.transaction_type === 'contribution').reduce((sum, t) => sum + Number(t.amount), 0),
      transactionCount: transactions.length,
      loansRequested: loans.length,
      loansApproved: loans.filter(l => l.status === 'approved' || l.status === 'disbursed').length,
      loansCompleted: loans.filter(l => l.status === 'completed').length,
      totalLoanAmount: loans.filter(l => l.status !== 'rejected').reduce((sum, l) => sum + Number(l.amount_approved || l.amount_requested), 0),
      currentBalance: members.reduce((sum, m) => sum + Number(m.account_balance), 0),
      totalContributionsAllTime: members.reduce((sum, m) => sum + Number(m.total_contributions), 0),
    });
  };

  const generateMemberReport = async () => {
    const [memberRes, transactionsRes, loansRes] = await Promise.all([
      supabase.from('members').select('*, profiles(*)').eq('id', selectedMemberId).maybeSingle(),
      supabase.from('transactions').select('*').eq('member_id', selectedMemberId).order('transaction_date', { ascending: false }),
      supabase.from('loans').select('*').eq('member_id', selectedMemberId).order('requested_date', { ascending: false }),
    ]);
    const member = memberRes.data;
    const transactions = transactionsRes.data || [];
    const loans = loansRes.data || [];

    if (member) {
      setReportData({
        member,
        transactions,
        loans,
        totalDeposits: transactions.filter(t => t.transaction_type === 'deposit').reduce((sum, t) => sum + Number(t.amount), 0),
        totalWithdrawals: transactions.filter(t => t.transaction_type === 'withdrawal').reduce((sum, t) => sum + Number(t.amount), 0),
        totalContributions: Number(member.total_contributions),
        activeLoans: loans.filter(l => l.status === 'disbursed').length,
        completedLoans: loans.filter(l => l.status === 'completed').length,
      });
    }
  };

  // --- PDF Download for individual card ---
  const downloadMetricPDF = (label: string, value: any) => {
    if (!reportData) return;

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`${label} Report`, 14, 22);

    const printableValue = typeof value === 'number' ? value.toLocaleString() : value;

    doc.autoTable({
      startY: 30,
      head: [['Metric', 'Value']],
      body: [[label, printableValue]],
    });

    doc.save(`${label.replace(/\s+/g, '-')}-report.pdf`);
  };

  // --- StatCard Component ---
  const StatCard = ({ label, value, icon: Icon, color }: any) => (
    <div className="bg-white rounded-xl p-4 card-shadow relative">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <span className="text-sm font-medium text-gray-600">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <button
        onClick={() => downloadMetricPDF(label, value)}
        className="absolute top-3 right-3 p-1 rounded-full bg-gray-200 hover:bg-gray-300"
        title={`Download ${label} PDF`}
      >
        <Download className="w-4 h-4 text-gray-700" />
      </button>
    </div>
  );

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Reports & Analytics</h2>

      {/* Filters */}
      <div className="bg-white rounded-2xl card-shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
            <select value={reportType} onChange={(e) => setReportType(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none">
              <option value="monthly">Monthly Report</option>
              <option value="yearly">Yearly Report</option>
              <option value="member">Member Statement</option>
            </select>
          </div>
          {reportType === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
              <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none" />
            </div>
          )}
          {reportType === 'yearly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
              <input type="number" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none" />
            </div>
          )}
          {reportType === 'member' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Member</label>
              <select value={selectedMemberId} onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none">
                <option value="">Select member</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.profiles.full_name} - {member.member_number}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Reports */}
      {reportData && (
        <div>
          {(reportType === 'monthly' || reportType === 'yearly') && (
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4">{reportData.period} Report</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Deposits" value={`$${reportData.totalDeposits.toLocaleString()}`} icon={TrendingUp} color="bg-green-500" />
                <StatCard label="Total Withdrawals" value={`$${reportData.totalWithdrawals.toLocaleString()}`} icon={TrendingUp} color="bg-red-500" />
                <StatCard label="Total Contributions" value={`$${reportData.totalContributions.toLocaleString()}`} icon={TrendingUp} color="bg-blue-500" />
                <StatCard label="Current Balance" value={`$${reportData.currentBalance.toLocaleString()}`} icon={TrendingUp} color="bg-[#008080]" />
                <StatCard label="Transactions" value={reportData.transactionCount} icon={FileText} color="bg-[#ADD8E6]" />
                <StatCard label="Loans Requested" value={reportData.loansRequested} icon={FileText} color="bg-yellow-500" />
                <StatCard label="Loans Approved" value={reportData.loansApproved} icon={FileText} color="bg-green-500" />
                <StatCard label="Total Loan Amount" value={`$${reportData.totalLoanAmount.toLocaleString()}`} icon={TrendingUp} color="bg-[#008080]" />
              </div>
            </div>
          )}

          {reportType === 'member' && reportData.member && (
            <div>
              <div className="bg-white rounded-2xl card-shadow p-6 mb-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Member Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-semibold text-gray-800">{reportData.member.profiles.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Member Number</p>
                    <p className="font-semibold text-gray-800">{reportData.member.member_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Current Balance</p>
                    <p className="font-semibold text-[#008080] text-xl">${Number(reportData.member.account_balance).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Contributions</p>
                    <p className="font-semibold text-[#008080] text-xl">${Number(reportData.member.total_contributions).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard label="Total Deposits" value={`$${reportData.totalDeposits.toLocaleString()}`} icon={TrendingUp} color="bg-green-500" />
                <StatCard label="Total Withdrawals" value={`$${reportData.totalWithdrawals.toLocaleString()}`} icon={TrendingUp} color="bg-red-500" />
                <StatCard label="Active Loans" value={reportData.activeLoans} icon={FileText} color="bg-yellow-500" />
                <StatCard label="Completed Loans" value={reportData.completedLoans} icon={FileText} color="bg-green-500" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
