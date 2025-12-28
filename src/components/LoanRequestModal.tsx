import React, { useState, useMemo } from 'react';
import { supabase, Member, Profile } from '../lib/supabase';
import { XCircle } from 'lucide-react';
import debounce from 'lodash/debounce';

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
    if (!query) {
      setSearchResults([]);
      return;
    }

    const { data } = await supabase
      .from('members')
      .select('*')
      .ilike('full_name', `%${query}%`)
      .neq('profile_id', profile?.id)
      .limit(5);

    const filtered =
      data?.filter(
        (m) => !guarantors.some((g) => g.member_id === m.id)
      ) || [];

    setSearchResults(filtered);
  }, 300);

  const handleSearch = (index: number, query: string) => {
    setGuarantors((prev) => {
      const updated = [...prev];
      updated[index].search = query;
      return updated;
    });
    debouncedSearch(query);
  };

  const selectGuarantor = (index: number, m: Member) => {
    setGuarantors((prev) => {
      const updated = [...prev];
      updated[index].member_id = m.id;
      updated[index].name = m.full_name ?? '';
      updated[index].search = m.full_name ?? '';
      return updated;
    });

    setSearchResults([]);

    if (remainingAmount > 0 && guarantors.length < 3) {
      setGuarantors((prev) => [
        ...prev,
        { member_id: 0, name: '', amount: '', search: '' },
      ]);
    }
  };

  const handleAmountChange = (index: number, value: string) => {
    if (Number(value) < 0) return;
    setError('');

    setGuarantors((prev) => {
      const updated = [...prev];
      updated[index].amount = Math.floor(Number(value)).toString();
      return updated;
    });
  };

  const removeGuarantor = (index: number) =>
    setGuarantors((prev) => prev.filter((_, i) => i !== index));

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
          `Loan not fully covered. Remaining: ${requestedAmount - totalCovered}`
        );
      }

      const loanNumber =
        'LN' + Date.now() + Math.floor(Math.random() * 1000);

      const validGuarantors = guarantors.filter(
        (g) => Number(g.amount) > 0
      );

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
          repayment_period_months: parseInt(formData.repayment_period),
          reason: formData.reason,
          status: loanStatus,
        })
        .select()
        .single();

      if (loanError) throw loanError;

      if (validGuarantors.length > 0) {
        await supabase.from('loan_guarantees').insert(
          validGuarantors.map((g) => ({
            loan_id: loanData.id,
            guarantor_id: g.member_id,
            amount_guaranteed: Math.floor(Number(g.amount)),
            status: 'pending',
          }))
        );
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3">
          <XCircle />
        </button>

        <h2 className="text-xl font-bold mb-4">Request Loan</h2>

        {error && <p className="text-red-600">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="number"
            placeholder="Loan Amount"
            value={formData.amount}
            onChange={(e) =>
              setFormData({ ...formData, amount: e.target.value })
            }
            className="w-full border p-2"
          />

          <input
            type="number"
            placeholder="Repayment Months"
            value={formData.repayment_period}
            onChange={(e) =>
              setFormData({
                ...formData,
                repayment_period: e.target.value,
              })
            }
            className="w-full border p-2"
          />

          <textarea
            placeholder="Reason"
            value={formData.reason}
            onChange={(e) =>
              setFormData({ ...formData, reason: e.target.value })
            }
            className="w-full border p-2"
          />

          {guarantors.map((g, i) => (
            <div key={i} className="border p-2">
              <input
                placeholder="Search guarantor"
                value={g.search}
                onChange={(e) => handleSearch(i, e.target.value)}
                className="w-full border p-1"
              />

              {searchResults.map((m) => (
                <div
                  key={m.id}
                  onClick={() => selectGuarantor(i, m)}
                  className="cursor-pointer hover:bg-gray-100"
                >
                  {m.full_name}
                </div>
              ))}

              <input
                type="number"
                placeholder="Guarantee amount"
                value={g.amount}
                onChange={(e) =>
                  handleAmountChange(i, e.target.value)
                }
                className="w-full border p-1 mt-1"
              />

              {i > 0 && (
                <button
                  type="button"
                  onClick={() => removeGuarantor(i)}
                  className="text-red-500 text-sm"
                >
                  Remove
                </button>
              )}
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-2"
          >
            {loading ? 'Submitting…' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  );
}
