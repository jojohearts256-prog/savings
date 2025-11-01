import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function Reports() {
  const [reportType, setReportType] = useState<'monthly' | 'yearly' | 'member'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any>(null);
  const [memberSearch, setMemberSearch] = useState('');

  const [transactionFilter, setTransactionFilter] = useState('');
  const [loanFilter, setLoanFilter] = useState('');
  const [profitFilter, setProfitFilter] = useState('');

  const [pageTransactions, setPageTransactions] = useState(1);
  const [pageLoans, setPageLoans] = useState(1);
  const [pageProfits, setPageProfits] = useState(1);
  const pageSize = 5;

  useEffect(() => { generateReport(); }, [reportType, selectedMonth, selectedYear, selectedMemberId]);

  const generateReport = async () => {
    if (reportType === 'monthly') await fetchMonthlyReport();
    else if (reportType === 'yearly') await fetchYearlyReport();
    else if (reportType === 'member' && selectedMemberId) await fetchMemberReport();
    else setReportData(null);
  };

  const fetchMonthlyReport = async () => {
    const monthStart = selectedMonth + '-01';
    const { data, error } = await supabase.rpc('monthly_report', { report_month: monthStart });
    if (error) console.error('Monthly Report Error:', error);
    else
      setReportData(
        Array.isArray(data)
          ? data[0]
          : { ...data, loans: data.loans || [], profits: data.profits || [], transactions: data.transactions || [] }
      );
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

  const handleMemberSearch = async (value: string) => {
    setMemberSearch(value);
    setSelectedMemberId('');
    setReportData(null);

    if (!value.trim()) { setMembers([]); return; }

    const { data, error } = await supabase
      .from('members')
      .select('id, full_name, member_number')
      .ilike('full_name', `%${value}%`)
      .limit(10);

    if (!error) setMembers(data || []);
  };

  const filterData = (data: any[], filter: string, fields: string[]) => {
    if (!data) return [];
    if (!filter) return data;
    const lowerFilter = filter.toLowerCase();
    return data.filter(item =>
      fields.some(field => (item[field] || '').toString().toLowerCase().includes(lowerFilter))
    );
  };

  const paginate = (data: any[], page: number) => {
    if (!data) return [];
    const start = (page - 1) * pageSize;
    return data.slice(start, start + pageSize);
  };

  // ----------------- DOWNLOAD ALL TABLES AS SINGLE PDF -----------------
  const downloadFullPDF = () => {
    if (!reportData) return alert("No report data available!");

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`${reportType.toUpperCase()} REPORT`, 14, 15);

    let yOffset = 20;

    const months = groupAllByMonth(reportData);

    Object.keys(months).forEach((month, monthIdx) => {
      const data = months[month];

      // Month header
      doc.setFontSize(14);
      doc.text(month.toUpperCase(), 14, yOffset);
      yOffset += 6;

      // Function to add a table (transactions, loans, profits)
      const addTable = (title: string, tableData: any[], fields: string[]) => {
        if (!tableData || tableData.length === 0) return;

        const columns = fields.map(f => ({ header: f.replace(/_/g, ' '), dataKey: f }));

        (doc as any).autoTable({
          startY: yOffset,
          head: [columns.map(c => c.header)],
          body: tableData.map(row => fields.map(f => {
            const val = row[f];
            if ((f === 'transaction_date' || f === 'requested_date' || f === 'created_at') && val)
              return new Date(val).toLocaleDateString();
            return val ?? '-';
          })),
          theme: 'grid',
          headStyles: { fillColor: [112, 193, 242], textColor: 0 },
          styles: { fontSize: 10 },
          margin: { left: 14, right: 14 },
          didDrawPage: (dataArg: any) => {
            yOffset = dataArg.cursor.y + 10;
          }
        });

        yOffset = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : yOffset + 10;
      };

      addTable('Transactions', data.transactions, ['transaction_type', 'full_name', 'recorded_by']);
      addTable('Loans', data.loans, ['status', 'full_name', 'approved_by']);
      addTable('Profits', data.profits, ['full_name', 'recorded_by']);

      if (monthIdx < Object.keys(months).length - 1) {
        yOffset += 5;
      }
    });

    doc.save(`${reportType}_report.pdf`);
  };

  const groupAllByMonth = (data: any) => {
    const monthsMap: Record<string, any> = {};
    const addItems = (items: any[], type: 'transactions' | 'loans' | 'profits', dateField: string) => {
      if (!items) return;
      items.forEach((item: any) => {
        const dateVal = item[dateField] || new Date().toISOString();
        const month = new Date(dateVal).toLocaleString('default', { month: 'long', year: 'numeric' });
        if (!monthsMap[month]) monthsMap[month] = { transactions: [], loans: [], profits: [] };
        monthsMap[month][type].push(item);
      });
    };
    addItems(data.transactions || [], 'transactions', 'transaction_date');
    addItems(data.loans || [], 'loans', 'requested_date');
    addItems(data.profits || [], 'profits', 'created_at');
    return monthsMap;
  };

  const renderMonthSection = (month: string, data: any) => (
    <div key={month} className="mb-10">
      <h2 className="text-2xl font-bold mb-2 text-[#70C1F2]">{month.toUpperCase()}</h2>
      <hr className="border-t-2 border-gray-300 mb-4" />
      {data.transactions.length > 0 && <TableWithPagination title="Transactions" data={data.transactions} filter={transactionFilter} setFilter={setTransactionFilter} fields={['transaction_type', 'full_name', 'recorded_by']} page={pageTransactions} setPage={setPageTransactions} />}
      {data.loans.length > 0 && <TableWithPagination title="Loans" data={data.loans} filter={loanFilter} setFilter={setLoanFilter} fields={['status', 'full_name', 'approved_by']} page={pageLoans} setPage={setPageLoans} />}
      {data.profits.length > 0 && <TableWithPagination title="Profits" data={data.profits} filter={profitFilter} setFilter={setProfitFilter} fields={['full_name', 'recorded_by']} page={pageProfits} setPage={setPageProfits} />}
    </div>
  );

  const TableWithPagination = ({ title, data, filter, setFilter, fields, page, setPage }: any) => {
    const filtered = filterData(data, filter, fields);
    const paginated = paginate(filtered, page);
    const totalPages = Math.ceil(filtered.length / pageSize);

    return (
      <div className="overflow-x-auto mb-6 bg-white rounded-xl card-shadow p-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-lg font-bold text-[#70C1F2]">{title}</h4>
        </div>
        <input
          placeholder={`Search ${title}...`}
          value={filter}
          onChange={e => { setFilter(e.target.value); setPage(1); }}
          className="mb-2 w-full px-4 py-2 border border-[#70C1F2] rounded-xl placeholder-gray-500"
        />
        <table className="min-w-full border-collapse border border-gray-300">
          <thead className="bg-[#70C1F2] text-black font-normal">
            <tr>
              {Object.keys(paginated[0] || {}).map(key => (
                <th key={key} className="border border-gray-300 px-2 py-1">{key.replace(/_/g, ' ')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((row: any, i: number) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                {Object.entries(row).map(([key, val], idx) => (
                  <td key={idx} className="border border-gray-300 px-2 py-1">
                    {(key === 'transaction_date' || key === 'requested_date' || key === 'created_at') && val
                      ? new Date(val).toLocaleDateString()
                      : val ?? '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex justify-end mt-2 gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
            <span>{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
          </div>
        )}
      </div>
    );
  };

  const renderAllMonths = () => {
    const months = groupAllByMonth(reportData);
    return Object.keys(months).map(month => renderMonthSection(month, months[month]));
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Reports & Analytics</h2>

      <div className="bg-white rounded-2xl card-shadow p-6 mb-6 flex justify-between items-center">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
            <select value={reportType} onChange={e => setReportType(e.target.value as any)} className="w-full px-4 py-2 border border-[#70C1F2] rounded-xl">
              <option value="monthly">Monthly Report</option>
              <option value="yearly">Yearly Report</option>
              <option value="member">Member Statement</option>
            </select>
          </div>

          {reportType === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Month</label>
              <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full px-4 py-2 border border-[#70C1F2] rounded-xl" />
            </div>
          )}

          {reportType === 'yearly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Year</label>
              <input type="number" value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="w-full px-4 py-2 border border-[#70C1F2] rounded-xl" />
            </div>
          )}

          {reportType === 'member' && (
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Member</label>
              <input
                type="text"
                placeholder="Type member name..."
                value={memberSearch}
                onChange={e => handleMemberSearch(e.target.value)}
                className="w-full px-4 py-2 border border-[#70C1F2] rounded-xl placeholder-gray-500"
              />

              {members.length > 0 && memberSearch.trim() !== '' && (
                <ul className="absolute z-50 bg-white border border-[#70C1F2] w-full mt-1 max-h-48 overflow-y-auto rounded-xl shadow-lg">
                  {members.map((m) => (
                    <li
                      key={m.id}
                      className="px-4 py-2 hover:bg-gray-200 cursor-pointer"
                      onClick={() => { setSelectedMemberId(m.id); setMemberSearch(m.full_name); setMembers([]); }}
                    >
                      {m.full_name} ({m.member_number})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {reportData && (
          <button
            className="px-4 py-2 bg-[#70C1F2] text-black rounded-xl hover:bg-[#5bb0e0] flex items-center gap-1 h-12"
            onClick={downloadFullPDF}
          >
            <Download className="w-5 h-5" /> Download Full Report
          </button>
        )}
      </div>

      {reportData && renderAllMonths()}
    </div>
  );
}
