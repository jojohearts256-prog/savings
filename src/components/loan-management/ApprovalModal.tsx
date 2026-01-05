import { useMemo, useState } from 'react';
import type { Loan } from './types';

export default function ApprovalModal({
  loan,
  onClose,
  onApprove,
}: {
  loan: Loan;
  onClose: () => void;
  onApprove: (approvedAmount: number, interestRate: number) => void;
}) {
  const [approvedAmount, setApprovedAmount] = useState<number>(Number(loan.amount_requested));
  const [interestRate, setInterestRate] = useState<number>(5);

  const totalRepayable = useMemo(() => approvedAmount + (approvedAmount * interestRate) / 100, [approvedAmount, interestRate]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 motion-pop">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full motion-card">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Approve Loan</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Approved Amount (UGX)</label>
            <input
              type="text"
              value={approvedAmount.toLocaleString('en-UG')}
              onChange={(e) => setApprovedAmount(Number(e.target.value.replace(/,/g, '')))}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Interest Rate (%)</label>
            <input
              type="number"
              step="0.1"
              value={interestRate}
              onChange={(e) => setInterestRate(parseFloat(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
            />
          </div>

          <div className="bg-blue-50 rounded-xl p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Principal:</span>
              <span className="font-semibold text-gray-800">UGX {approvedAmount.toLocaleString('en-UG')}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Interest ({interestRate}%):</span>
              <span className="font-semibold text-gray-800">UGX {((approvedAmount * interestRate) / 100).toLocaleString('en-UG')}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t border-blue-200 pt-2 mt-2">
              <span className="text-gray-800">Total Repayable:</span>
              <span className="text-[#008080]">UGX {totalRepayable.toLocaleString('en-UG')}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                onApprove(approvedAmount, interestRate);
                onClose();
              }}
              className="flex-1 py-2 btn-primary motion-btn text-white font-medium rounded-xl"
            >
              Approve Loan
            </button>
            <button onClick={onClose} className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
