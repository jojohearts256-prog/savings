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
    const { data, error } = await supabase.from('members').select('id, member_number, profiles!inner(id, full_name)');
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

  const downloadTablePDF = (title: string, columns: string[], data: any[]) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.autoTable({
      startY: 30,
      head: [columns],
      body: data,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [0, 128, 128], textColor: 255, fontStyle: 'bold' }
    });
    doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
  };

  const downloadFullReportPDF = () => {
    if (!reportData) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`${reportType === 'member' ? reportData.full_name : reportData.period} Full Report`, 14, 22);
    let yOffset = 30;

    // --- Transactions Table ---
    if (reportData.transactions?.length > 0) {
      doc.setFontSize(14);
      doc.text('Transactions', 14, yOffset);
      yOffset += 6;
      doc.autoTable({
        startY: yOffset,
        head: [['Date', 'Type', 'Member Name', 'Recorded By', 'Amount (UGX)']],
        body: reportData.transactions.map((t: any) => [
          new Date(t.transaction_date).toLocaleDateString(),
          t.transaction_type,
          t.member_name,
          t.recorded_by,
          Number(t.amount).toLocaleString('en-UGX')
        ]),
        styles: { fontSize: 10 }
      });
      yOffset = (doc as any).lastAutoTable.finalY + 10;
    }

    // --- Loans Table ---
    if (reportData.loans?.length > 0) {
      doc.setFontSize(14);
      doc.text('Loans', 14, yOffset);
      yOffset += 6;
      doc.autoTable({
        startY: yOffset,
        head: [['Date', 'Amount (UGX)', 'Status', 'Member Name', 'Recorded By']],
        body: reportData.loans.map((l: any) => [
          new Date(l.requested_date).toLocaleDateString(),
          Number(l.amount_approved || l.amount_requested).toLocaleLocaleString('en-UGX'),
          l.status,
          l.member_name,
          l.recorded_by
        ]),
        styles: { fontSize: 10 }
      });
      yOffset = (doc as any).lastAutoTable.finalY + 10;
    }

    // --- Profits Table ---
    if (reportData.profits?.length > 0) {
      doc.setFontSize(14);
      doc.text('Profits', 14, yOffset);
      yOffset += 6;
      doc.autoTable({
        startY: yOffset,
        head: [['Member Name', 'Loan/Deposit', 'Profit Amount (UGX)', 'Recorded By']],
        body: reportData.profits.map((p: any) => [
          p.member_name,
          p.source,
          Number(p.profit_amount).toLocaleString('en-UGX'),
          p.recorded_by
        ]),
        styles: { fontSize: 10 }
      });
    }

    doc.save(`${reportType}-full-report.pdf`);
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

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Reports & Analytics</h2>

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

        {reportData && (
          <button onClick={downloadFullReportPDF} className="px-4 py-2 rounded-xl bg-[#008080] text-white hover:bg-teal-700">
            <Download className="inline w-4 h-4 mr-2" /> Download Full Detailed Report
          </button>
        )}
      </div>

      {reportData && (
        <div>
          {/* Transactions Table */}
          {reportData.transactions?.length > 0 && (
            <div className="overflow-x-auto mb-6 bg-white rounded-xl card-shadow p-4">
              <h4 className="text-xl font-bold mb-2">Transactions</h4>
              <button className="mb-2 px-3 py-1 bg-teal-600 text-white rounded" onClick={() => downloadTablePDF(
                'Transactions Table',
                ['Date','Type','Member Name','Recorded By','Amount (UGX)'],
                reportData.transactions.map((t: any) => [
                  new Date(t.transaction_date).toLocaleDateString(),
                  t.transaction_type,
                  t.member_name,
                  t.recorded_by,
                  Number(t.amount).toLocaleString('en-UGX')
                ])
              )}><Download className="inline w-4 h-4 mr-1"/> Download Table</button>
              <table className="min-w-full border-collapse border border-gray-300 text-sm">
                <thead className="bg-teal-100 text-gray-800 font-semibold">
                  <tr>
                    <th className="border border-gray-300 px-2 py-1">Date</th>
                    <th className="border border-gray-300 px-2 py-1">Type</th>
                    <th className="border border-gray-300 px-2 py-1">Member Name</th>
                    <th className="border border-gray-300 px-2 py-1">Recorded By</th>
                    <th className="border border-gray-300 px-2 py-1">Amount (UGX)</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.transactions.map((t: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-2 py-1">{new Date(t.transaction_date).toLocaleDateString()}</td>
                      <td className="border border-gray-300 px-2 py-1">{t.transaction_type}</td>
                      <td className="border border-gray-300 px-2 py-1">{t.member_name}</td>
                      <td className="border border-gray-300 px-2 py-1">{t.recorded_by}</td>
                      <td className="border border-gray-300 px-2 py-1">{Number(t.amount).toLocaleString('en-UGX')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Loans Table */}
          {reportData.loans?.length > 0 && (
            <div className="overflow-x-auto mb-6 bg-white rounded-xl card-shadow p-4">
              <h4 className="text-xl font-bold mb-2">Loans</h4>
              <button className="mb-2 px-3 py-1 bg-teal-600 text-white rounded" onClick={() => downloadTablePDF(
                'Loans Table',
                ['Date','Amount (UGX)','Status','Member Name','Recorded By'],
                reportData.loans.map((l: any) => [
                  new Date(l.requested_date).toLocaleDateString(),
                  Number(l.amount_approved || l.amount_requested).toLocaleString('en-UGX'),
                  l.status,
                  l.member_name,
                  l.recorded_by
                ])
              )}><Download className="inline w-4 h-4 mr-1"/> Download Table</button>
              <table className="min-w-full border-collapse border border-gray-300 text-sm">
                <thead className="bg-teal-100 text-gray-800 font-semibold">
                  <tr>
                    <th className="border border-gray-300 px-2 py-1">Date</th>
                    <th className="border border-gray-300 px-2 py-1">Amount (UGX)</th>
                    <th className="border border-gray-300 px-2 py-1">Status</th>
                    <th className="border border-gray-300 px-2 py-1">Member Name</th>
                    <th className="border border-gray-300 px-2 py-1">Recorded By</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.loans.map((l: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-2 py-1">{new Date(l.requested_date).toLocaleDateString()}</td>
                      <td className="border border-gray-300 px-2 py-1">{Number(l.amount_approved || l.amount_requested).toLocaleString('en-UGX')}</td>
                      <td className="border border-gray-300 px-2 py-1">{l.status}</td>
                      <td className="border border-gray-300 px-2 py-1">{l.member_name}</td>
                      <td className="border border-gray-300 px-2 py-1">{l.recorded_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Profits Table */}
          {reportData.profits?.length > 0 && (
            <div className="overflow-x-auto mb-6 bg-white rounded-xl card-shadow p-4">
              <h4 className="text-xl font-bold mb-2">Profits</h4>
              <button className="mb-2 px-3 py-1 bg-teal-600 text-white rounded" onClick={() => downloadTablePDF(
                'Profits Table',
                ['Member Name','Loan/Deposit','Profit Amount (UGX)','Recorded By'],
                reportData.profits.map((p: any) => [
                  p.member_name,
                  p.source,
                  Number(p.profit_amount).toLocaleString('en-UGX'),
                  p.recorded_by
                ])
              )}><Download className="inline w-4 h-4 mr-1"/> Download Table</button>
              <table className="min-w-full border-collapse border border-gray-300 text-sm">
                <thead className="bg-teal-100 text-gray-800 font-semibold">
                  <tr>
                    <th className="border border-gray-300 px-2 py-1">Member Name</th>
                    <th className="border border-gray-300 px-2 py-1">Loan/Deposit</th>
                    <th className="border border-gray-300 px-2 py-1">Profit Amount (UGX)</th>
                    <th className="border border-gray-300 px-2 py-1">Recorded By</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.profits.map((p: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-2 py-1">{p.member_name}</td>
                      <td className="border border-gray-300 px-2 py-1">{p.source}</td>
                      <td className="border border-gray-300 px-2 py-1">{Number(p.profit_amount).toLocaleString('en-UGX')}</td>
                      <td className="border border-gray-300 px-2 py-1">{p.recorded_by}</td>
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
