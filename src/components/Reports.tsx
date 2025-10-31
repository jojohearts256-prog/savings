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

  // Load all members for selection
  useEffect(() => { loadMembers(); }, []);

  // Whenever filters change, fetch report
  useEffect(() => { generateReport(); }, [reportType, selectedMonth, selectedYear, selectedMemberId]);

  // --- Load members ---
  const loadMembers = async () => {
    const { data, error } = await supabase.from('members').select('id, member_number, profiles!inner(id, full_name)');
    if (error) console.error('Load Members Error:', error);
    else setMembers(data || []);
  };

  // --- Generate report ---
  const generateReport = async () => {
    if (reportType === 'monthly') await fetchMonthlyReport();
    else if (reportType === 'yearly') await fetchYearlyReport();
    else if (reportType === 'member' && selectedMemberId) await fetchMemberReport();
  };

  // --- Fetch Monthly Report ---
  const fetchMonthlyReport = async () => {
    const monthStart = selectedMonth + '-01';
    const { data, error } = await supabase.rpc('monthly_report', { report_month: monthStart });
    if (error) console.error('Monthly Report Error:', error);
    else setReportData(data?.[0] || null);
  };

  // --- Fetch Yearly Report ---
  const fetchYearlyReport = async () => {
    const { data, error } = await supabase.rpc('yearly_report', { report_year: parseInt(selectedYear) });
    if (error) console.error('Yearly Report Error:', error);
    else setReportData(data?.[0] || null);
  };

  // --- Fetch Member Report ---
  const fetchMemberReport = async () => {
    const { data, error } = await supabase.rpc('member_report', { member_id_input: selectedMemberId });
    if (error) console.error('Member Report Error:', error);
    else setReportData(data?.[0] || null);
  };

  // --- PDF Download for Metrics ---
  const downloadMetricPDF = (label: string, value: any) => {
    if (!reportData) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`${label} Report`, 14, 22);
    doc.autoTable({
      startY: 30,
      head: [['Metric', 'Value']],
      body: [[label, value]],
    });
    doc.save(`${label.replace(/\s+/g, '-')}-report.pdf`);
  };

  // --- PDF Download Full Report ---
  const downloadFullReportPDF = () => {
    if (!reportData) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`${reportType === 'member' ? reportData.full_name : reportData.period} Detailed Report`, 14, 22);

    let yOffset = 30;

    // --- Summary Table ---
    const summaryRows = Object.keys(reportData).filter(k => typeof reportData[k] !== 'object').map(k => [k.replace(/_/g,' '), reportData[k]]);
    doc.autoTable({
      startY: yOffset,
      head: [['Metric', 'Value']],
      body: summaryRows,
    });
    yOffset = (doc as any).lastAutoTable.finalY + 10;

    doc.save(`${reportType}-detailed-report.pdf`);
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

        {/* Full Download Button */}
        {reportData && (
          <button onClick={downloadFullReportPDF} className="px-4 py-2 rounded-xl bg-[#008080] text-white hover:bg-teal-700">
            <Download className="inline w-4 h-4 mr-2" /> Download Detailed Report
          </button>
        )}
      </div>

      {/* Reports */}
      {reportData && (
        <div>
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            {reportType === 'member' ? reportData.full_name : reportData.period} Report
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.keys(reportData)
              .filter(k => typeof reportData[k] !== 'object')
              .map((key) => (
                <StatCard
                  key={key}
                  label={key.replace(/_/g, ' ')}
                  value={typeof reportData[key] === 'number' ? `$${reportData[key].toLocaleString()}` : reportData[key]}
                  icon={TrendingUp}
                  color="bg-[#008080]"
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
