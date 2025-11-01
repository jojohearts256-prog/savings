import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Download, TrendingUp } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import TableWithPagination from '../components/TableWithPagination';

export default function Reports() {
  const [reportType, setReportType] = useState('monthly'); // monthly | yearly | member
  const [reportData, setReportData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('2025-11');
  const [selectedYear, setSelectedYear] = useState('2025');
  const [selectedMember, setSelectedMember] = useState('');
  const [members, setMembers] = useState([]);
  const [transactionFilter, setTransactionFilter] = useState('');
  const [pageTransactions, setPageTransactions] = useState(1);

  // Fetch members
  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase.from('members').select('id, full_name');
      if (data) setMembers(data);
    };
    fetchMembers();
  }, []);

  // Fetch data based on report type
  useEffect(() => {
    if (reportType === 'monthly') fetchMonthlyReport();
    else if (reportType === 'yearly') fetchYearlyReport();
    else if (reportType === 'member') fetchMemberStatement();
  }, [reportType, selectedMonth, selectedYear, selectedMember]);

  // ---------------- Fetch functions ----------------

  const fetchMonthlyReport = async () => {
    const monthStart = selectedMonth + '-01';
    const { data, error } = await supabase.rpc('monthly_report', { report_month: monthStart });
    if (error) console.error('Monthly Report Error:', error);
    else
      setReportData(
        Array.isArray(data)
          ? data[0]
          : {
              ...data,
              loans: data.loans || [],
              profits: data.profits || [],
              transactions: data.transactions || [],
            }
      );
  };

  const fetchYearlyReport = async () => {
    const { data, error } = await supabase.rpc('yearly_report', { report_year: selectedYear });
    if (error) console.error('Yearly Report Error:', error);
    else setReportData(data?.[0] || null);
  };

  const fetchMemberStatement = async () => {
    const { data, error } = await supabase.rpc('member_statement', { member_id: selectedMember });
    if (error) console.error('Member Statement Error:', error);
    else setReportData(data?.[0] || null);
  };

  // ---------------- Group by month helper ----------------
  const groupByMonth = (items) => {
    if (!items) return {};
    return items.reduce((acc, item) => {
      const dateField = item.transaction_date || item.requested_date || item.created_at;
      const month = new Date(dateField).toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!acc[month]) acc[month] = [];
      acc[month].push(item);
      return acc;
    }, {});
  };

  // ---------------- Render grouped section ----------------
  const renderGroupedReport = (data) => {
    const months = [
      ...new Set([
        ...Object.keys(groupByMonth(data.transactions)),
        ...Object.keys(groupByMonth(data.loans)),
        ...Object.keys(groupByMonth(data.profits)),
      ]),
    ];

    return months.map((month) => {
      const monthTransactions = groupByMonth(data.transactions)[month] || [];
      const monthLoans = groupByMonth(data.loans)[month] || [];
      const monthProfits = groupByMonth(data.profits)[month] || [];

      return (
        <div key={month} className="mb-10">
          <h2 className="text-2xl font-bold text-[#008080] mb-3">{month.toUpperCase()}</h2>
          <hr className="border-t-2 border-gray-300 mb-4" />

          {monthTransactions.length > 0 && (
            <TableWithPagination
              title="Transactions"
              data={monthTransactions}
              filter={transactionFilter}
              setFilter={setTransactionFilter}
              fields={['transaction_type', 'full_name', 'recorded_by']}
              page={pageTransactions}
              setPage={setPageTransactions}
            />
          )}

          {monthLoans.length > 0 && (
            <TableWithPagination
              title="Loans"
              data={monthLoans}
              filter={transactionFilter}
              setFilter={setTransactionFilter}
              fields={['loan_status', 'full_name', 'recorded_by']}
              page={pageTransactions}
              setPage={setPageTransactions}
            />
          )}

          {monthProfits.length > 0 && (
            <TableWithPagination
              title="Profits"
              data={monthProfits}
              filter={transactionFilter}
              setFilter={setTransactionFilter}
              fields={['full_name', 'recorded_by']}
              page={pageTransactions}
              setPage={setPageTransactions}
            />
          )}
        </div>
      );
    });
  };

  // ---------------- Render ----------------
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-[#008080] mb-6 flex items-center gap-2">
        <FileText className="text-[#008080]" /> Reports
      </h1>

      {/* Controls */}
      <div className="flex gap-4 mb-6">
        <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="border p-2 rounded">
          <option value="monthly">Monthly Report</option>
          <option value="yearly">Yearly Report</option>
          <option value="member">Member Statement</option>
        </select>

        {reportType === 'monthly' && (
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border p-2 rounded"
          />
        )}

        {reportType === 'yearly' && (
          <input
            type="number"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="border p-2 rounded"
          />
        )}

        {reportType === 'member' && (
          <select value={selectedMember} onChange={(e) => setSelectedMember(e.target.value)} className="border p-2 rounded">
            <option value="">Select Member</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Monthly Report */}
      {reportType === 'monthly' && reportData && (
        <div>
          <h2 className="text-2xl font-bold text-[#008080] mb-3">
            {new Date(selectedMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase()}
          </h2>
          <hr className="border-t-2 border-gray-300 mb-4" />
          {renderGroupedReport(reportData)}
        </div>
      )}

      {/* Yearly Report */}
      {reportType === 'yearly' && reportData && renderGroupedReport(reportData)}

      {/* Member Statement */}
      {reportType === 'member' && reportData && renderGroupedReport(reportData)}
    </div>
  );
}
