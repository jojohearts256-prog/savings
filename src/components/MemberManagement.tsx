import { useState, useEffect } from 'react';
import { supabase, Member } from '../lib/supabase';
import { UserPlus, Search, Edit2, Trash2, Eye, CheckCircle, Loader2 } from 'lucide-react';

export default function MemberManagement({ isHelper = false }: { isHelper?: boolean }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewModal, setViewModal] = useState<Member | null>(null);
  const [editModal, setEditModal] = useState<Member | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [, setLoading] = useState(false);

  // ---------------- Helper: Format Name ----------------
  const formatName = (name: string | undefined) => {
    if (!name) return '-';
    return name
      .toLowerCase()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  // Load members
  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error('Error loading members:', error.message);
    setMembers(data || []);
  };

  const filteredMembers = members.filter(
    (m) =>
      (m.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
  (m.member_number ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (m.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  // ---------------- Add Member Modal ----------------
  const AddMemberModal = () => {
    const [formData, setFormData] = useState({
      full_name: '',
      email: '',
      password: '',
      phone: '',
      id_number: '',
      address: '',
      date_of_birth: '',
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
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-register`,
          {
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
              role: 'member',
            }),
          }
        );

        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Registration failed');

        await new Promise((res) => setTimeout(res, 800));
        await loadMembers();
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
          });
          setSuccess(false);
          setShowAddModal(false);
        }, 2000);
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
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Add New Member</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
              {error}
            </div>
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
                {submitting ? 'Adding...' : 'Add Member'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // ---------------- ✅ FIXED Edit Member Modal ----------------
  const EditMemberModal = ({ member, onClose }: any) => {
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
        // ✅ Update the profiles table
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            email: formData.email,
            phone: formData.phone,
          })
          .eq('id', member.profile_id);

        if (profileError) throw profileError;

        // ✅ Update the members table
        const { error: memberError } = await supabase
          .from('members')
          .update({
            id_number: formData.id_number,
            address: formData.address,
            date_of_birth: formData.date_of_birth,
          })
          .eq('id', member.id);

        if (memberError) throw memberError;

        await loadMembers();
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 1500);
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

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-800">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" /> Member Updated Successfully!
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
                disabled={loading}
                className="flex-1 py-2 bg-[#008080] text-white font-medium rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // ---------------- View Member Modal ----------------
  const ViewMemberModal = ({ member, onClose }: any) => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Member Details</h2>
          <div className="space-y-2 text-gray-700">
            <p><strong>Member #:</strong> {member.member_number}</p>
            <p><strong>Full Name:</strong> {formatName(member.full_name)}</p>
            <p><strong>Email:</strong> {member.email || '-'}</p>
            <p><strong>Phone:</strong> {member.phone || '-'}</p>
            <p><strong>ID Number:</strong> {member.id_number || '-'}</p>
            <p><strong>Address:</strong> {member.address || '-'}</p>
            <p><strong>Date of Birth:</strong> {member.date_of_birth || '-'}</p>
            <p><strong>Balance:</strong> UGX {Math.floor(Number(member.account_balance)).toLocaleString()}</p>
            <p><strong>Status:</strong> {member.status || '-'}</p>
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ---------------- Delete Member ----------------
  const deleteMember = async (memberId: string) => {
    const confirmDelete = confirm('Are you sure you want to delete this member?');
    if (!confirmDelete) return;
    setLoading(true);
    const { error } = await supabase.from('members').delete().eq('id', memberId);
    if (error) alert('Failed to delete member: ' + error.message);
    else setMembers((prev) => prev.filter((m) => m.id !== memberId));
    setLoading(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Member Management</h2>
        {!isHelper && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 btn-primary text-white font-medium rounded-xl"
          >
            <UserPlus className="w-5 h-5" /> Add Member
          </button>
        )}
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search Members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl card-shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Member #</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Name</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Email</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Phone</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Balance</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((m) => (
              <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-6 py-4 text-sm">{m.member_number}</td>
                <td className="px-6 py-4 text-sm">{formatName(m.full_name)}</td>
                <td className="px-6 py-4 text-sm">{m.email || '-'}</td>
                <td className="px-6 py-4 text-sm">{m.phone || '-'}</td>
                <td className="px-6 py-4 text-sm">UGX {Math.floor(Number(m.account_balance)).toLocaleString()}</td>
                <td className="px-6 py-4 text-sm flex gap-2">
                  <button onClick={() => setViewModal(m)} className="p-1 text-gray-500 hover:text-gray-800">
                    <Eye className="w-4 h-4" />
                  </button>
                  {!isHelper && (
                    <>
                      <button onClick={() => setEditModal(m)} className="p-1 text-gray-500 hover:text-gray-800">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteMember(m.id)} className="p-1 text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && <AddMemberModal />}
      {viewModal && <ViewMemberModal member={viewModal} onClose={() => setViewModal(null)} />}
      {editModal && <EditMemberModal member={editModal} onClose={() => setEditModal(null)} />}
    </div>
  );
}
