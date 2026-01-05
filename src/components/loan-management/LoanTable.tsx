import type { Loan } from './types';
import { getStatusColor, getStatusIcon } from './statusUi';

export default function LoanTable({
  loans,
  isHelper,
  onApprove,
  onReject,
  onDisburse,
  onRepay,
}: {
  loans: Loan[];
  isHelper: boolean;
  onApprove: (loan: Loan) => void;
  onReject: (loan: Loan) => void;
  onDisburse: (loan: Loan) => void;
  onRepay: (loan: Loan) => void;
}) {
  return (
    <div className="bg-white rounded-2xl card-shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Member</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Amount</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Outstanding</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loans.map((loan) => (
              <tr key={loan.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm text-gray-800">
                  {loan.member_name}
                  <div className="text-xs text-gray-500">{loan.member_number}</div>
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                  UGX {Number(loan.amount_requested).toLocaleString('en-UG')}
                  {loan.amount_approved && loan.amount_approved !== loan.amount_requested && (
                    <div className="text-xs text-green-600">
                      Approved: UGX {Number(loan.amount_approved).toLocaleString('en-UG')}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`status-badge ${getStatusColor(loan.status)} flex items-center gap-1.5 w-fit`}>
                    {getStatusIcon(loan.status)}
                    {loan.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-[#008080]">
                  {loan.outstanding_balance ? `UGX ${Number(loan.outstanding_balance).toLocaleString('en-UG')}` : '-'}
                </td>
                <td className="px-6 py-4">
                  {!isHelper ? (
                    <div className="flex gap-2">
                      {loan.status === 'pending' && (
                        <>
                          <button
                            onClick={() => onApprove(loan)}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-xl text-xs"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => onReject(loan)}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {loan.status === 'approved' && (
                        <button
                          onClick={() => onDisburse(loan)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs"
                        >
                          Disburse
                        </button>
                      )}
                      {loan.status === 'disbursed' && (
                        <button
                          onClick={() => onRepay(loan)}
                          className="px-3 py-1.5 bg-orange-500 text-white rounded-xl text-xs"
                        >
                          Repay
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">View Only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
