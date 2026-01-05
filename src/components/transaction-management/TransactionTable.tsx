import { ArrowDownCircle, ArrowUpCircle, Printer } from 'lucide-react';
import { formatUGX } from './format';
import type { TransactionRow } from './types';

export default function TransactionTable({
  transactions,
  onPrint,
}: {
  transactions: TransactionRow[];
  onPrint: (tx: TransactionRow) => void;
}) {
  return (
    <div className="bg-white rounded-2xl card-shadow overflow-hidden shadow-md">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Date</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Member</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Type</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Amount</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Balance After</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Recorded By</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-[#f0f8f8] transition-colors cursor-pointer">
                <td className="px-6 py-4 text-sm text-gray-600">{new Date(tx.transaction_date).toLocaleString()}</td>
                <td className="px-6 py-4 text-sm text-gray-800">
                  {tx.member_name}
                  <div className="text-xs text-gray-500 italic">{tx.member_number}</div>
                </td>
                <td className="px-6 py-4 flex items-center gap-2">
                  {tx.transaction_type === 'withdrawal' ? (
                    <ArrowDownCircle className="w-5 h-5 text-red-500" />
                  ) : (
                    <ArrowUpCircle className="w-5 h-5 text-green-500" />
                  )}
                  <span className="text-sm capitalize">{tx.transaction_type}</span>
                </td>
                <td
                  className={`px-6 py-4 text-sm font-semibold ${
                    tx.transaction_type === 'withdrawal' ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {tx.transaction_type === 'withdrawal' ? '-' : '+'}
                  {formatUGX(tx.amount)}
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-[#008080]">{formatUGX(tx.balance_after)}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{tx.recorded_by_name}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => onPrint(tx)}
                    className="flex items-center gap-1 px-3 py-1 bg-[#008080] text-white rounded-xl text-sm hover:bg-[#006666] transition-colors"
                  >
                    <Printer className="w-4 h-4" /> Print
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
