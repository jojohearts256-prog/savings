import { useState } from 'react';
import type { Loan } from './types';

export default function RepaymentModal({
  loan,
  onClose,
  onRecord,
}: {
  loan: Loan;
  onClose: () => void;
  onRecord: (repaymentAmount: number, notes: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const repaymentAmount = parseFloat(amount.replace(/,/g, ''));
      await onRecord(repaymentAmount, notes);
      onClose();
    } catch (err) {
      console.error('Error recording repayment:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Record Repayment</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-blue-50 rounded-xl p-4 mb-4">
            <p className="text-sm text-gray-600 mb-1">Outstanding Balance</p>
            <p className="text-2xl font-bold text-[#008080]">UGX {Number(loan.outstanding_balance).toLocaleString('en-UG')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Amount (UGX)</label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 btn-primary text-white font-medium rounded-xl disabled:opacity-50"
            >
              {loading ? 'Recording...' : 'Record Repayment'}
            </button>
            <button type="button" onClick={onClose} className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
