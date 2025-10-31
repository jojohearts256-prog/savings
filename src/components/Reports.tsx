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

  const [transactionFilter, setTransactionFilter] = useState('');
  const [loanFilter, setLoanFilter] = useState('');
  const [profitFilter, setProfitFilter] = useState('');

  useEffect(() => { loadMembers(); }, []);
  useEffect(() => { generateReport(); }, [reportType, selectedMonth, selectedYear, selectedMemberId]);

  const loadMembers = async () => {
    const { data, error } = await supabase
      .from('members')
      .select('id, member_number, profiles!inner(id, full_name)');
    if (error) console.error('Load Members Error:', error);
    else setMembers(data || []);
  };

  const generateReport = async () => {
    if (reportType === 'monthly') await fetchMonthlyReport();
    else if (reportType === 'yearly') await fetchYearlyReport();
    else if (reportType === 'member' && selectedMemberId) await fetchMemberReport();
  };

  const fetchMonthlyReport = async () => {
    const monthStart = selectedMonth + '-01';
    const { data, error } = await supabase.rpc('monthly_report', { report_month: monthStart });
    if (error) console.error('Monthly Report Error:', error);
    else setReportData(data?.[0] || null);
  };

  const fetchYearlyReport = async () => {
    const { data, error } = await supabase.rpc('yearly_report', { report_year: parseInt(selectedYear) });
    if (error) console.error('Yearly Report Error:', error);
    else setReportData(data?.[0] || null);
  };

  const fetchMemberReport = async () => {
    const { data, error } = await supabase.rpc('member_report', { member_id_input: selectedMemberId });
    if (error) console.error('Member Report Error:', error);
    else setReportData(data?.[0] || null);
  };

  const StatCard = ({ label, value, icon: Icon, color }: any) => (
    <div className="bg-white rounded-xl p-4 card-shadow relative">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <span className="text-sm font-medium text-gray-600">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  );

  const formatCurrency = (amount: number) =>
    Number(amount).toLocaleString('en-UGX', { style: 'currency', currency: 'UGX' });

  const downloadFullReportPDF = () => {
    if (!reportData) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`${reportType === 'member' ? reportData.full_name : reportData.period || reportData.year} Report`, 14, 22);

    let yOffset = 30;
    const summaryRows = Object.keys(reportData)
      .filter(k => typeof reportData[k] !== 'object')
      .map(k => [k.replace(/_/g, ' '), formatCurrency(reportData[k])]);
    doc.autoTable({ startY: yOffset, head: [['Metric', 'Value']], body: summaryRows });
    yOffset = (doc as any).lastAutoTable.finalY + 10;

    const renderTable = (title: string, head: string[], rows: any[]) => {
      if (!rows || rows.length === 0) return;
      doc.setFontSize(14);
      doc.text(title, 14, yOffset);
      yOffset += 6;
      doc.autoTable({ startY: yOffset, head: [head], body: rows });
      yOffset = (doc as any).lastAutoTable.finalY + 10;
    };

    renderTable(
      'Transactions',
      ['Date', 'Type', 'Amount (UGX)', 'Member', 'Recorded By'],
      reportData.transactions?.map((t: any) => [
        new Date(t.transaction_date || t.date).toLocaleDateString(),
        t.transaction_type || t.type,
        formatCurrency(t.amount),
        t.member_name || '-',
        t.recorded_by || '-',
      ])
    );

    renderTable(
      'Loans',
      ['Date', 'Amount Requested (UGX)', 'Amount Approved (UGX)', 'Status', 'Member', 'Recorded By'],
      reportData.loans?.map((l: any) => [
        new Date(l.requested_date || l.date).toLocaleDateString(),
        formatCurrency(l.amount_requested),
        formatCurrency(l.amount_approved || 0),
        l.status,
        l.member_name || '-',
        l.recorded_by || '-',
      ])
    );

    renderTable(
      'Profits',
      ['Source', 'Profit Amount (UGX)', 'Member', 'Recorded By'],
      reportData.profits?.map((p: any) => [
        p.source,
        formatCurrency(p.profit_amount),
        p.member_name || '-',
        p.recorded_by || '-',
      ])
    );

    doc.save(`${reportType}-detailed-report.pdf`);
  };

  // --- FILTER FUNCTION ---
  const filterData = (data: any[], filter: string, fields: string[]) => {
    if (!data) return [];
    if (!filter) return data;
    const lowerFilter = filter.toLowerCase();
    return data.filter(item =>
      fields.some(field => (item[field] || '').toString().toLowerCase().includes(lowerFilter))
    );
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Reports & Analytics</h2>

      {/* Filters */}
      <div className="bg-white rounded-2xl card-shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
            <select
              value={reportType}
              onChange={e => setReportType(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
            >
              <option value="monthly">Monthly Report</option>
              <option value="yearly">Yearly Report</option>
              <option value="member">Member Statement</option>
            </select>
          </div>
          {reportType === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
              />
            </div>
          )}
          {reportType === 'yearly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
              <input
                type="number"
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
              />
            </div>
          )}
          {reportType === 'member' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Member</label>
              <select
                value={selectedMemberId}
                onChange={e => setSelectedMemberId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
              >
                <option value="">Select member</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.profiles.full_name} - {m.member_number}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {reportData && (
          <button
            onClick={downloadFullReportPDF}
            className="px-4 py-2 rounded-xl bg-[#008080] text-white hover:bg-teal-700"
          >
            <Download className="inline w-4 h-4 mr-2" /> Download Detailed Report
          </button>
        )}
      </div>

      {reportData && (
        <div>
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            {reportType === 'member' ? reportData.full_name : reportData.period || reportData.year} Report
          </h3>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Object.keys(reportData)
              .filter(k => typeof reportData[k] !== 'object')
              .map(key => (
                <StatCard
                  key={key}
                  label={key.replace(/_/g, ' ')}
                  value={typeof reportData[key] === 'number' ? formatCurrency(reportData[key]) : reportData[key]}
                  icon={TrendingUp}
                  color="bg-[#008080]"
                />
              ))}
          </div>

          {/* Transactions Table with filter */}
          {reportData.transactions?.length > 0 && (
            <div className="overflow-x-auto mb-6 bg-white rounded-xl card-shadow p-4">
              <h4 className="text-lg font-bold mb-2">Transactions</h4>
              <input
                placeholder="Search Transactions..."
                value={transactionFilter}
                onChange={e => setTransactionFilter(e.target.value)}
                className="mb-2 w-full px-2 py-1 border border-gray-300 rounded-lg"
              />
              <table className="min-w-full border-collapse border border-gray-300">
                <thead>
                  <tr>
                    <th className="border border-gray-300 px-2 py-1">Date</th>
                    <th className="border border-gray-300 px-2 py-1">Type</th>
                    <th className="border border-gray-300 px-2 py-1">Amount (UGX)</th>
                    <th className="border border-gray-300 px-2 py-1">Member</th>
                    <th className="border border-gray-300 px-2 py-1">Recorded By</th>
                  </tr>
                </thead>
                <tbody>
                  {filterData(reportData.transactions, transactionFilter, ['transaction_type', 'member_name', 'recorded_by'])
                    .map((t: any, i: number) => (
                      <tr key={i}>
                        <td className="border border-gray-300 px-2 py-1">{new Date(t.transaction_date || t.date).toLocaleDateString()}</td>
                        <td className="border border-gray-300 px-2 py-1">{t.transaction_type || t.type}</td>
                        <td className="border border-gray-300 px-2 py-1">{formatCurrency(t.amount)}</td>
                        <td className="border border-gray-300 px-2 py-1">{t.member_name || '-'}</td>
                        <td className="border border-gray-300 px-2 py-1">{t.recorded_by || '-'}</td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Loans Table with filter */}
          {reportData.loans?.length > 0 && (
            <div className="overflow-x-auto mb-6 bg-white rounded-xl card-shadow p-4">
              <h4 className="text-lg font-bold mb-2">Loans</h4>
              <input
                placeholder="Search Loans..."
                value={loanFilter}
                onChange={e => setLoanFilter(e.target.value)}
                className="mb-2 w-full px-2 py-1 border border-gray-300 rounded-lg"
              />
              <table className="min-w-full border-collapse border border-gray-300">
                <thead>
                  <tr>
                    <th className="border border-gray-300 px-2 py-1">Date</th>
                    <th className="border border-gray-300 px-2 py-1">Amount Requested (UGX)</th>
                    <th className="border border-gray-300 px-2 py-1">Amount Approved (UGX)</th>
                    <th className="border border-gray-300 px-2 py-1">Status</th>
                    <th className="border border-gray-300 px-2 py-1">Member</th>
                    <th className="border border-gray-300 px-2 py-1">Recorded By</th>
                  </tr>
                </thead>
                <tbody>
                  {filterData(reportData.loans, loanFilter, ['status', 'member_name', 'recorded_by'])
                    .map((l: any, i: number) => (
                      <tr key={i}>
                        <td className="border border-gray-300 px-2 py-1">{new Date(l.requested_date || l.date).toLocaleDateString()}</td>
                        <td className="border border-gray-300 px-2 py-1">{formatCurrency(l.amount_requested)}</td>
                        <td className="border border-gray-300 px-2 py-1">{formatCurrency(l.amount_approved || 0)}</td>
                        <td className="border border-gray-300 px-2 py-1">{l.status}</td>
                        <td className="border border-gray-300 px-2 py-1">{l.member_name || '-'}</td>
                        <td className="border border-gray-300 px-2 py-1">{l.recorded_by || '-'}</td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Profits Table with filter */}
          {reportData.profits?.length > 0 && (
            <div className="overflow-x-auto mb-6 bg-white rounded-xl card-shadow p-4">
              <h4 className="text-lg font-bold mb-2">Profits</h4>
              <input
                placeholder="Search Profits..."
                value={profitFilter}
                onChange={e => setProfitFilter(e.target.value)}
                className="mb-2 w-full px-2 py-1 border border-gray-300 rounded-lg"
              />
              <table className="min-w-full border-collapse border border-gray-300">
                <thead>
                  <tr>
                    <th className="border border-gray-300 px-2 py-1">Source</th>
                    <th className="border border-gray-300 px-2 py-1">Profit Amount (UGX)</th>
                    <th className="border border-gray-300 px-2 py-1">Member</th>
                    <th className="border border-gray-300 px-2 py-1">Recorded By</th>
                  </tr>
                </thead>
                <tbody>
                  {filterData(reportData.profits, profitFilter, ['source', 'member_name', 'recorded_by'])
                    .map((p: any, i: number) => (
                      <tr key={i}>
                        <td className="border border-gray-300 px-2 py-1">{p.source}</td>
                        <td className="border border-gray-300 px-2 py-1">{formatCurrency(p.profit_amount)}</td>
                        <td className="border border-gray-300 px-2 py-1">{p.member_name || '-'}</td>
                        <td className="border border-gray-300 px-2 py-1">{p.recorded_by || '-'}</td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
