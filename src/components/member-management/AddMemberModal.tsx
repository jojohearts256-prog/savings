import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, CheckCircle } from 'lucide-react';

export default function AddMemberModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    id_number: '',
    address: '',
    date_of_birth: '',
    role: 'member',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSubmitting(true);

    try {
      const PROJECT_REF = (import.meta.env.VITE_SUPABASE_PROJECT_REF as string) || 'devegvzpallxsmbyszcb';
      const FUNCTIONS_HOST = (import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string) || `https://${PROJECT_REF}.functions.supabase.co`;
      const ADMIN_REGISTER_FN = (import.meta.env.VITE_SUPABASE_ADMIN_REGISTER_FN as string) || 'admin-register';

      const response = await fetch(`${FUNCTIONS_HOST}/${ADMIN_REGISTER_FN}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          full_name: formData.full_name,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          id_number: formData.id_number,
          address: formData.address,
          date_of_birth: formData.date_of_birth,
          role: formData.role,
        }),
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Registration failed');

      if (formData.role === 'employee') {
        try {
          const { data: profileData } = await supabase.from('profiles').select('id').eq('email', formData.email).maybeSingle();
          if (profileData?.id) {
            const { data: existingMember } = await supabase.from('members').select('id').eq('profile_id', profileData.id).maybeSingle();
            if (!existingMember) {
              const memberNumber = 'M' + Date.now();
              await supabase.from('members').insert({
                profile_id: profileData.id,
                full_name: formData.full_name,
                member_number: memberNumber,
                account_balance: 0,
                total_contributions: 0,
                status: 'active',
              });
            }
          }
        } catch (e) {
          console.warn('Failed to create member row for employee:', e);
        }
      }

      await new Promise((res) => setTimeout(res, 800));
      onSuccess();
      setSuccess(true);

      setTimeout(() => {
        setFormData({
          full_name: '',
          email: '',
          password: '',
          phone: '',
          id_number: '',
          address: '',
          date_of_birth: '',
          role: 'member',
        });
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Registration error:', err.message);
      setError(err.message || 'Failed to register member');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Add New User</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">{error}</div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" /> Member Registered Successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080]"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
              <input
                type="text"
                value={formData.id_number}
                onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <input
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080]"
              >
                <option value="member">Member</option>
                <option value="employee">Employee</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080]"
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-[#008080] text-white font-medium rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Adding...' : `Add ${formData.role === 'member' ? 'Member' : 'Employee'}`}
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
