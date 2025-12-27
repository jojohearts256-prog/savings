import { useState, useMemo } from 'react';
import { supabase, Member, Profile } from '../lib/supabase';
import { XCircle } from 'lucide-react';
import { debounce } from 'lodash';

interface LoanRequestModalProps {
  member: Member | null;
  profile: Profile | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface Guarantor {
  member_id: string | number;
  name: string;
  amount: string;
  search: string;
}

export default function LoanRequestModal({
  member,
  profile,
  onClose,
  onSuccess,
}: LoanRequestModalProps) {
  const [formData, setFormData] = useState({
    amount: '',
    repayment_period: '12',
    reason: '',
  });

  const [guarantors, setGuarantors] = useState<Guarantor[]>([
    { member_id: 0, name: '', amount: '', search: '' },
  ]);
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const memberSavings = Math.floor(Number(member?.account_balance || 0));
  const safeSavingsLimit = 1000;
  const usableSavings = Math.max(memberSavings - safeSavingsLimit, 0);

  const totalGuarantor = useMemo(
    () =>
      guarantors.reduce(
        (sum, g) => sum + Math.floor(Number(g.amount || 0)),
        0
      ),
    [guarantors]
  );

  const remainingAmount = useMemo(() => {
    return Math.max(
      Math.floor(Number(formData.amount || 0)) -
        usableSavings -
        totalGuarantor,
      0
    );
  }, [formData.amount, usableSavings, totalGuarantor]);

  const debouncedSearch = debounce(async (query: string) => {
    if (!query) return setSearchResults([]);
    const { data } = await supabase
      .from('members')
      .select('*')
      .ilike('full_name', `%${query}%`)
      .neq('profile_id', profile?.id)
      .limit(5);

    const filtered =
      data?.filter(
        m => !guarantors.some(g => g.member_id === m.id)
      ) || [];
    setSearchResults(filtered);
  }, 300);

  const handleSearch = (index: number, query: string) => {
    setGuarantors(prev => {
      const updated = [...prev];
      updated[index].search = query;
      return updated;
    });
    debouncedSearch(query);
  };

  const selectGuarantor = (index: number, m: Member) => {
    setGuarantors(prev => {
      const updated = [...prev];
      updated[index].member_id = m.id;
      updated[index].name = m.full_name;
      updated[index].search = m.full_name;
      return updated;
    });
    setSearchResults([]);

    if (remainingAmount > 0 && guarantors.length < 3) {
      setGuarantors(prev => [
        ...prev,
        { member_id: 0, name: '', amount: '', search: '' },
      ]);
    }
  };

  const handleAmountChange = (index: number, value: string) => {
    if (Number(value) < 0) return;
    setError('');
    setGuarantors(prev => {
      const updated = [...prev];
      updated[index].amount = Math.floor(Number(value)).toString();
      return updated;
    });
  };

  const removeGuarantor = (index: number) =>
    setGuarantors(prev => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!member) throw new Error('Member data not found');

      const requestedAmount = Math.floor(Number(formData.amount));
      const totalCovered = usableSavings + totalGuarantor;

      if (totalCovered < requestedAmount) {
        throw new Error(
          `Loan not fully covered. You need ${
            requestedAmount - totalCovered
          } more from guarantors.`
        );
      }

      const loanNumber =
        'LN' + Date.now() + Math.floor(Math.random() * 1000);

      // ✅ DEFINE FIRST (FIX FOR YOUR ERROR)
      const validGuarantors = guarantors.filter(
        g => Number(g.amount) > 0
      );

      // 1️⃣ Create loan
      const loanStatus =
        validGuarantors.length > 0
          ? 'pending_guarantors'
          : 'pending';

      const { data: loanData, error: loanError } = await supabase
        .from('loans')
        .insert({
          member_id: member.id,
          loan_number: loanNumber,
          amount_requested: requestedAmount,
          repayment_period_months: parseInt(
            formData.repayment_period
          ),
          reason: formData.reason,
          status: loanStatus,
        })
        .select()
        .single();

      if (loanError) throw loanError;

      // 2️⃣ Add guarantors
      if (validGuarantors.length > 0) {
        const { error: gError } = await supabase
          .from('loan_guarantees')
          .insert(
            validGuarantors.map(g => ({
              loan_id: loanData.id,
              guarantor_id: g.member_id,
              amount_guaranteed: Math.floor(Number(g.amount)),
              status: 'pending',
            }))
          );
        if (gError) throw gError;

        // 3️⃣ Notify guarantors
        for (const g of validGuarantors) {
          await supabase.from('notifications').insert({
            member_id: g.member_id,
            type: 'loan_request',
            title: 'Loan Approval Needed',
            message: `${member.full_name} requested a loan of ${requestedAmount} UGX. You pledged ${Math.floor(
              Number(g.amount)
            )} UGX.`,
            recipient_role: 'guarantor',
            metadata: JSON.stringify({
              loanId: loanData.id,
            }),
            sent_at: new Date(),
            read: false,
          });
        }
      }

      // 4️⃣ If no guarantors → notify admin
      if (validGuarantors.length === 0) {
        await supabase.from('notifications').insert({
          member_id: null,
          type: 'loan_ready_for_admin',
          title: 'Loan Ready for Approval',
          message: `Loan ${loanNumber} by ${member.full_name} has no guarantors.`,
          metadata: JSON.stringify({ loanId: loanData.id }),
          sent_at: new Date(),
          read: false,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit loan request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 relative shadow-2xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-red-500"
        >
          <XCircle className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-bold mb-4">Request Loan</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border rounded-xl text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* FORM UI — unchanged */}
        </form>
      </div>
    </div>
  );
}
