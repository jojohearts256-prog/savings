import { formatUGX } from './format';
import type { TransactionRow } from './types';

export default function ReceiptModal({ tx, onClose }: { tx: TransactionRow; onClose: () => void }) {
  const handlePrint = () => {
    const printContent = document.getElementById('receipt-content')?.innerHTML;
    if (printContent) {
      const w = window.open('', '', 'width=600,height=800');
      w?.document.write(`
          <html>
            <head>
              <title>Receipt</title>
              <style>
                body { font-family: 'Arial', sans-serif; padding: 20px; background: #f5f5f5; }
                .receipt { max-width: 500px; margin: auto; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .header { text-align: center; margin-bottom: 20px; }
                .header h1 { margin: 0; color: #008080; }
                .header p { margin: 2px 0; color: #555; font-size: 14px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                th { background-color: #f0f0f0; }
                .total { font-weight: bold; color: #008080; }
                .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #555; }
              </style>
            </head>
            <body>
              <div class="receipt">
                ${printContent}
              </div>
            </body>
          </html>
        `);
      w?.document.close();
      w?.focus();
      w?.print();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 motion-pop">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full motion-card">
        <div id="receipt-content" className="text-sm text-gray-800">
          <div className="header">
            <h1>My Savings System</h1>
            <p>Transaction Receipt</p>
            <p>{new Date(tx.transaction_date).toLocaleString()}</p>
          </div>
          <table>
            <tbody>
              <tr>
                <th>Member</th>
                <td>{tx.member_name}</td>
              </tr>
              <tr>
                <th>Member Number</th>
                <td>{tx.member_number}</td>
              </tr>
              <tr>
                <th>Transaction Type</th>
                <td>{tx.transaction_type}</td>
              </tr>
              <tr>
                <th>Amount</th>
                <td>{formatUGX(tx.amount)}</td>
              </tr>
              <tr>
                <th>Balance Before</th>
                <td>{formatUGX(tx.balance_before)}</td>
              </tr>
              <tr>
                <th>Balance After</th>
                <td className="total">{formatUGX(tx.balance_after)}</td>
              </tr>
              <tr>
                <th>Description</th>
                <td>{tx.description || '-'}</td>
              </tr>
              <tr>
                <th>Recorded By</th>
                <td>{tx.recorded_by_name}</td>
              </tr>
            </tbody>
          </table>
          <div className="footer">Thank you for using our service!</div>
        </div>
        <div className="flex gap-3 pt-4">
          <button
            onClick={handlePrint}
            className="flex-1 py-2 bg-[#008080] text-white font-medium rounded-xl hover:bg-[#006666] transition-colors"
          >
            Print / Download
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
