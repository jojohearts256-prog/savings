import { CheckCircle, Clock, CreditCard, XCircle } from 'lucide-react';
import type { LoanStatus } from './types';

export function getStatusIcon(status: LoanStatus) {
  switch (status) {
    case 'pending':
      return <Clock className="w-4 h-4" />;
    case 'approved':
      return <CheckCircle className="w-4 h-4" />;
    case 'rejected':
      return <XCircle className="w-4 h-4" />;
    case 'disbursed':
      return <CreditCard className="w-4 h-4" />;
    case 'completed':
      return <CheckCircle className="w-4 h-4" />;
    default:
      return null;
  }
}

export function getStatusColor(status: LoanStatus) {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'approved':
      return 'bg-blue-100 text-blue-800';
    case 'rejected':
      return 'bg-red-100 text-red-800';
    case 'disbursed':
      return 'bg-green-100 text-green-800';
    case 'completed':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
