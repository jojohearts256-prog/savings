import React, { useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Member, Profile } from '../lib/supabase';
import { sendNotification } from '../lib/notify';
import { notifyUser } from '../lib/notifyUser';
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
      // include profile relationship so we can exclude admins
      .select('*, profiles(id, full_name, role)')
      .ilike('full_name', `%${query}%`)
      .neq('profile_id', profile?.id)
      .limit(8);

    const filtered = (data || []).filter((m: any) => !guarantors.some((g) => g.member_id === m.id)) || [];

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

      const loanStatus = validGuarantors.length > 0 ? 'pending_guarantors' : 'pending';

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

      const borrowerName = profile?.full_name ?? member?.full_name ?? member?.member_number ?? 'A member';

      if (validGuarantors.length > 0) {
        await supabase.from('loan_guarantees').insert(
          validGuarantors.map((g) => ({
            loan_id: loanData.id,
            guarantor_id: g.member_id,
            amount_guaranteed: Math.floor(Number(g.amount)),
            status: 'pending_guarantors',
          }))
        );
        // Notify each guarantor about the request and their pledged amount
        for (const g of validGuarantors) {
          try {
            await sendNotification({
              member_id: g.member_id as string,
              type: 'loan_guarantee_request',
              title: 'Loan Guarantee Request',
              message: `${borrowerName} requested a loan of UGX ${requestedAmount.toLocaleString()} and you pledged UGX ${Math.floor(Number(g.amount)).toLocaleString()}. Approve or reject your guarantee.`,
              metadata: { loanId: loanData.id, guarantor_id: g.member_id, pledged: Math.floor(Number(g.amount)) },
            });

              // Email via Edge Function
              await notifyUser({
                user_id: g.member_id as string,
                message: `${borrowerName} requested a loan of UGX ${requestedAmount.toLocaleString()}. Please approve or reject your guarantee.`,
              });
          } catch (e) {
            // non-fatal: continue if notification/email fails
            console.warn('Failed to notify guarantor', e);
          }
        }
      }
      else {
        // No guarantors: notify admin about new loan request
        try {
          await sendNotification({
            member_id: null,
            recipient_role: 'admin',
            type: 'loan_request',
            title: 'New Loan Request',
            message: `${borrowerName} requested a loan of UGX ${requestedAmount.toLocaleString()}.`,
            metadata: { loanId: loanData.id, borrower_id: member?.id },
          });

            // Email admins via Edge Function
            await notifyUser({
              role: 'admin',
              message: 'A new loan request requires approval.',
            });
        } catch (e) {
          // non-fatal
          console.warn('failed to notify admin', e);
        }
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
    <div className="bg-white rounded-2xl w-full max-w-md p-6 relative shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition">
          <XCircle className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-bold text-gray-800 mb-4">Request Loan</h2>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">{error}</div>}

        <div className="mb-4 p-4 bg-gray-50 rounded-xl">
          <div className="flex justify-between items-center mb-2">
            <div>
              <p className="text-sm text-gray-600">Member Savings</p>
              <p className="text-lg font-bold text-[#007B8A]">UGX {memberSavings.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Usable Savings</p>
              <p className="text-lg font-bold text-[#007B8A]">UGX {usableSavings.toLocaleString()}</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600">Amount Requested</p>
            <input
              type="number"
              placeholder="Loan Amount"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full border p-2 rounded-xl mt-1"
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm text-gray-600">Repayment Months</p>
              <input
                type="number"
                placeholder="Repayment Months"
                value={formData.repayment_period}
                onChange={(e) => setFormData({ ...formData, repayment_period: e.target.value })}
                className="w-full border p-2 rounded-xl mt-1"
              />
            </div>
            <div>
              <p className="text-sm text-gray-600">Remaining to cover</p>
              <div className={`mt-1 text-lg font-bold ${remainingAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                UGX {remainingAmount.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            {guarantors.map((g, i) => (
              <div key={i} className="bg-white border rounded-xl p-3 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <input
                    placeholder="Search guarantor"
                    value={g.search}
                    onChange={(e) => handleSearch(i, e.target.value)}
                    className="flex-1 border p-2 rounded-xl mr-3"
                  />

                  <input
                    type="number"
                    placeholder="UGX"
                    value={g.amount}
                    onChange={(e) => handleAmountChange(i, e.target.value)}
                    className="w-36 border p-2 rounded-xl"
                  />
                </div>

                {searchResults.length > 0 && g.search && (
                  <div className="mb-2">
                    {searchResults.map((m) => (
                      <div key={m.id} onClick={() => selectGuarantor(i, m)} className="cursor-pointer hover:bg-gray-100 p-2 rounded-md">
                        {m.full_name}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-sm text-gray-600 mt-2">
                  <div>{g.name || 'No guarantor selected'}</div>
                  <div>
                    Remaining: <span className={`${remainingAmount > 0 ? 'text-red-600' : 'text-green-600'} font-semibold`}>UGX {remainingAmount.toLocaleString()}</span>
                  </div>
                </div>

                {i > 0 && (
                  <div className="mt-2 text-right">
                    <button type="button" onClick={() => removeGuarantor(i)} className="text-red-500 text-sm">Remove</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="pt-2">
            <p className="text-sm text-gray-500 mb-2">Reason (optional)</p>
            <textarea
              placeholder="Reason"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full border p-2 rounded-xl h-24"
            />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-[#007B8A] hover:bg-[#006b75] text-white p-3 rounded-2xl font-medium">
            {loading ? 'Submitting…' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  );
}
