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

  const [pageTransactions, setPageTransactions] = useState(1);
  const [pageLoans, setPageLoans] = useState(1);
  const [pageProfits, setPageProfits] = useState(1);
  const pageSize = 5;

  useEffect(() => { loadMembers(); }, []);
  useEffect(() => { generateReport(); }, [reportType, selectedMonth, selectedYear, selectedMemberId]);

  const loadMembers = async () => {
    const { data, error } = await supabase
      .from('members')
      .select('id, member_number, profiles!inner(id, full_name)');
    if (error) console.error(error);
    else setMembers(data || []);
  };

  const generateReport = async () => {
    if (reportType === 'monthly') await fetchMonthlyReport();
    else if (reportType === 'yearly') await fetchYearlyReport();
    else if (reportType === 'member' && selectedMemberId) await fetchMemberReport();
  };

  const fetchMonthlyReport = async () => {
    const { data, error } = await supabase.rpc('monthly_report', { report_month: selectedMonth + '-01' });
    if (error) console.error(error);
    else setReportData(data?.[0] || null);
  };

  const fetchYearlyReport = async () => {
    const { data, error } = await supabase.rpc('yearly_report', { report_year: parseInt(selectedYear) });
    if (error) console.error(error);
    else setReportData(data?.[0] || null);
  };

  const fetchMemberReport = async () => {
    const { data, error } = await supabase.rpc('member_report', { member_id_input: selectedMemberId });
    if (error) console.error(error);
    else setReportData(data?.[0] || null);
  };

  const formatCurrency = (amount: number) =>
    Number(amount).toLocaleString('en-UGX', { style: 'currency', currency: 'UGX' });

  const filterData = (data: any[], filter: string, fields: string[]) => {
    if (!data) return [];
    if (!filter) return data;
    const lowerFilter = filter.toLowerCase();
    return data.filter(item =>
      fields.some(f => (item[f] || '').toString().toLowerCase().includes(lowerFilter))
    );
  };

  const paginate = (data: any[], page: number) => {
    if (!data) return [];
    return data.slice((page - 1) * pageSize, page * pageSize);
  };

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
      if (!rows?.length) return;
      doc.setFontSize(14);
      doc.text(title, 14, yOffset);
      yOffset += 6;
      doc.autoTable({ startY: yOffset, head: [head], body: rows });
      yOffset = (doc as any).lastAutoTable.finalY + 10;
    };

    renderTable('Transactions', ['Date','Type','Amount','Member','Recorded By'],
      reportData.transactions?.map(t => [new Date(t.transaction_date||t.date).toLocaleDateString(), t.transaction_type||t.type, formatCurrency(t.amount), t.member_name||'-', t.recorded_by||'-'])
    );

    renderTable('Loans', ['Date','Amount Requested','Amount Approved','Status','Member','Recorded By'],
      reportData.loans?.map(l => [new Date(l.requested_date||l.date).toLocaleDateString(), formatCurrency(l.amount_requested), formatCurrency(l.amount_approved||0), l.status, l.member_name||'-', l.recorded_by||'-'])
    );

    renderTable('Profits', ['Source','Profit Amount','Member','Recorded By'],
      reportData.profits?.map(p => [p.source, formatCurrency(p.profit_amount), p.member_name||'-', p.recorded_by||'-'])
    );

    doc.save(`${reportType}-detailed-report.pdf`);
  };

  const TableWithPagination = ({ title, data, filter, setFilter, fields, page, setPage }: any) => {
    const filtered = filterData(data, filter, fields);
    const paginated = paginate(filtered, page);
    const totalPages = Math.ceil(filtered.length / pageSize);

    return (
      <div className="overflow-x-auto mb-6 bg-white rounded-xl card-shadow p-4">
        <h4 className="text-lg font-bold mb-2">{title}</h4>
        <input placeholder={`Search ${title}...`} value={filter} onChange={e=>{setFilter(e.target.value); setPage(1)}} className="mb-2 w-full px-2 py-1 border border-gray-300 rounded-lg"/>
        <table className="min-w-full border-collapse border border-gray-300">
          <thead><tr>{Object.keys(paginated[0]||{}).map(k=><th key={k} className="border px-2 py-1">{k.replace(/_/g,' ')}</th>)}</tr></thead>
          <tbody>
            {paginated.map((row:any,i:number)=><tr key={i}>{Object.values(row).map((v:any,idx)=> <td key={idx} className="border px-2 py-1">{v instanceof Date ? v.toLocaleDateString() : v}</td>)}</tr>)}
          </tbody>
        </table>
        {totalPages>1 && <div className="flex justify-end mt-2 gap-2"><button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>Prev</button><span>{page} / {totalPages}</span><button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}>Next</button></div>}
      </div>
    );
  };

  const StatCard = ({ label, value, icon: Icon, color }: any) => (
    <div className="bg-white rounded-xl p-4 card-shadow relative">
      <div className="flex items-center gap-3 mb-2"><div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}><Icon className="w-5 h-5 text-white"/></div><span className="text-sm font-medium text-gray-600">{label}</span></div>
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
            <select value={reportType} onChange={e=>setReportType(e.target.value as any)} className="w-full px-4 py-2 border border-gray-300 rounded-xl">
              <option value="monthly">Monthly Report</option>
              <option value="yearly">Yearly Report</option>
              <option value="member">Member Statement</option>
            </select>
          </div>
          {reportType==='monthly' && <input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)}/>}
          {reportType==='yearly' && <input type="number" value={selectedYear} onChange={e=>setSelectedYear(e.target.value)}/>}
          {reportType==='member' && <select value={selectedMemberId} onChange={e=>setSelectedMemberId(e.target.value)}><option value="">Select Member</option>{members.map(m=><option key={m.id} value={m.id}>{m.profiles.full_name}</option>)}</select>}
        </div>
        {reportData && <button onClick={downloadFullReportPDF} className="px-4 py-2 rounded-xl bg-[#008080] text-white hover:bg-teal-700"><Download className="inline w-4 h-4 mr-2"/> Download PDF</button>}
      </div>

      {reportData && <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{Object.keys(reportData).filter(k=>typeof reportData[k]!=='object').map(k=><StatCard key={k} label={k.replace(/_/g,' ')} value={reportData[k]} icon={TrendingUp} color="bg-[#008080]"/>)}</div>
        {reportData.transactions?.length>0 && <TableWithPagination title="Transactions" data={reportData.transactions} filter={transactionFilter} setFilter={setTransactionFilter} fields={['transaction_type','member_name','recorded_by']} page={pageTransactions} setPage={setPageTransactions}/>}
        {reportData.loans?.length>0 && <TableWithPagination title="Loans" data={reportData.loans} filter={loanFilter} setFilter={setLoanFilter} fields={['status','member_name','recorded_by']} page={pageLoans} setPage={setPageLoans}/>}
        {reportData.profits?.length>0 && <TableWithPagination title="Profits" data={reportData.profits} filter={profitFilter} setFilter={setProfitFilter} fields={['source','member_name','recorded_by']} page={pageProfits} setPage={setPageProfits}/>}
      </>}
    </div>
  );
}
