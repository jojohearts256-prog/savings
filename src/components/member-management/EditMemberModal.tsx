import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { CheckCircle } from 'lucide-react';

export default function EditMemberModal({ member, onClose, onSuccess }: { member: any; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    full_name: member.full_name || '',
    email: member.email || '',
    phone: member.phone || '',
    id_number: member.id_number || '',
    address: member.address || '',
    date_of_birth: member.date_of_birth || '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const { error: profileError } = await supabase.from('profiles').update({
        full_name: formData.full_name,
        phone: formData.phone,
      }).eq('id', member.profile_id);
      if (profileError) throw profileError;

      const { error: memberError } = await supabase.from('members').update({
        id_number: formData.id_number,
        address: formData.address,
        date_of_birth: formData.date_of_birth,
      }).eq('id', member.id);
      if (memberError) throw memberError;

      const [{ data: refreshedProfile }, { data: refreshedMember }] = await Promise.all([
        supabase.from('profiles').select('full_name, email, phone').eq('id', member.profile_id).maybeSingle(),
        supabase.from('members').select('id_number, address, date_of_birth').eq('id', member.id).maybeSingle(),
      ]);

      const profileMatches = refreshedProfile && (
        (refreshedProfile.full_name || '') === formData.full_name &&
        (refreshedProfile.phone || '') === formData.phone
      );

      const memberDob = refreshedMember?.date_of_birth ? String(refreshedMember.date_of_birth).slice(0, 10) : '';
      const memberMatches = refreshedMember && (
        (refreshedMember.id_number || '') === formData.id_number &&
        (refreshedMember.address || '') === formData.address &&
        memberDob === (formData.date_of_birth || '')
      );

      if (!profileMatches || !memberMatches) throw new Error('Update did not persist — check database permissions or RLS policies');

      onSuccess();
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to update member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl p-6 max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Edit Member</h2>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-800">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 flex items-center gap-2"><CheckCircle className="w-5 h-5" /> Member Updated Successfully!</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input type="text" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080]" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-gray-100 text-gray-600 cursor-not-allowed"
                title="Email cannot be edited"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
              <input type="text" value={formData.id_number} onChange={(e) => setFormData({ ...formData, id_number: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <input type="date" value={formData.date_of_birth} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080]" />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="submit" disabled={loading} className="flex-1 py-2 bg-[#008080] text-white font-medium rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">{loading ? 'Saving...' : 'Save Changes'}</button>
            <button type="button" onClick={onClose} className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
