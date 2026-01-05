import { Clock, CreditCard, TrendingUp } from 'lucide-react';
import type { Loan } from './types';

export default function LoanStats({ loans }: { loans: Loan[] }) {
  const pending = loans.filter((l) => l.status === 'pending').length;
  const active = loans.filter((l) => l.status === 'disbursed').length;
  const totalOutstanding = loans
    .filter((l) => l.status === 'disbursed')
    .reduce((sum, l) => sum + Number(l.outstanding_balance || 0), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <div className="bg-white rounded-2xl p-5 card-shadow">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-yellow-600" />
          </div>
          <span className="text-sm font-medium text-gray-600">Pending</span>
        </div>
        <p className="text-2xl font-bold text-gray-800">{pending}</p>
      </div>

      <div className="bg-white rounded-2xl p-5 card-shadow">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-green-600" />
          </div>
          <span className="text-sm font-medium text-gray-600">Active</span>
        </div>
        <p className="text-2xl font-bold text-gray-800">{active}</p>
      </div>

      <div className="bg-white rounded-2xl p-5 card-shadow">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <span className="text-sm font-medium text-gray-600">Total Outstanding</span>
        </div>
        <p className="text-2xl font-bold text-[#008080]">UGX {totalOutstanding.toLocaleString('en-UG')}</p>
      </div>
    </div>
  );
}
