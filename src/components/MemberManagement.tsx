import { useState, useEffect } from 'react';
import { supabase, Member, Profile } from '../lib/supabase';
import { UserPlus, Search, Edit2, Trash2, Eye, CheckCircle } from 'lucide-react';

export default function MemberManagement() {
  const [members, setMembers] = useState<(Member & { profiles: Profile | null })[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState<Member | null>(null);
  const [showEditModal, setShowEditModal] = useState<Member | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // ✅ Load members when component mounts
  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    const { data, error } = await supabase
      .from('members')
      .select('*, profiles(*)')
      .order('created_at', { ascending: false });

    if (error) console.error('Error loading members:', error.message);
    setMembers(data || []);
  };

  const formatName = (name) =>
    name
      ? name
          .split(' ')
          .map((n) => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase())
          .join(' ')
      : '-';

  const formatUGX = (amount) => `UGX ${Number(amount || 0).toLocaleString('en-UG', { maximumFractionDigits: 0 })}`;

  const filteredMembers = members.filter(
    (m) =>
      (m.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (m.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      m.member_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (m.profiles?.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  // ✅ Modal for adding new members
  const AddMemberModal = () => {
    const [formData, setFormData] = useState({
      email: '',
      password: '',
      full_name: '',
      phone: '',
      id_number: '',
      address: '',
      date_of_birth: '',
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
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
              ...formData,
              role: 'member',
              member_data: {
                address: formData.address,
                date_of_birth: formData.date_of_birth,
                phone: formData.phone,
                id_number: formData.id_number,
              },
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
            email: '',
            password: '',
            full_name: '',
            phone: '',
            id_number: '',
            address: '',
            date_of_birth: '',
          });
          setSuccess(false);
          setShowAddModal(false);
        }, 2000);
      } catch (err) {
        console.error('Registration error:', err.message);
        setError(err.message || 'Failed to register member');
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Add New Member</h2>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">{error}</div>}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" /> Member registered successfully!
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ['Full Name', 'full_name', 'text'],
                ['Email', 'email', 'email'],
                ['Password', 'password', 'password'],
                ['Phone', 'phone', 'tel'],
                ['ID Number', 'id_number', 'text'],
                ['Date of Birth', 'date_of_birth', 'date'],
              ].map(([label, key, type]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type={type}
                    value={formData[key]}
                    onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] outline-none"
                    required={['full_name', 'email', 'password'].includes(key)}
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] outline-none"
                rows={2}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2 btn-primary text-white font-medium rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
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

  // ✅ Modal for editing member
  const EditMemberModal = ({ member }) => {
    const [formData, setFormData] = useState({
      full_name: member.profiles?.full_name || '',
      email: member.profiles?.email || '',
      phone: member.profiles?.phone || '',
      address: member.profiles?.address || '',
      id_number: member.profiles?.id_number || '',
      date_of_birth: member.profiles?.date_of_birth || '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async (e) => {
      e.preventDefault();
      setSaving(true);
      setError('');

      try {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name.trim(),
            email: formData.email.trim(),
            phone: formData.phone.trim(),
            address: formData.address.trim(),
            id_number: formData.id_number.trim(),
            date_of_birth: formData.date_of_birth,
          })
          .eq('id', member.profiles?.id);

        if (updateError) throw updateError;
        await loadMembers();
        setShowEditModal(null);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Failed to update member');
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Edit Member Profile</h2>
          {error && <p className="text-red-600 bg-red-50 p-2 rounded mb-3 text-sm">{error}</p>}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ['Full Name', 'full_name', 'text'],
                ['Email', 'email', 'email'],
                ['Phone', 'phone', 'tel'],
                ['ID Number', 'id_number', 'text'],
                ['Date of Birth', 'date_of_birth', 'date'],
                ['Address', 'address', 'text'],
              ].map(([label, key, type]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type={type}
                    value={formData[key]}
                    onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] outline-none"
                    required={['full_name', 'email'].includes(key)}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowEditModal(null)}
                className="px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-[#008080] text-white rounded-xl hover:bg-[#006d6d] disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const deleteMember = async (memberId) => {
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
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 btn-primary text-white font-medium rounded-xl"
        >
          <UserPlus className="w-5 h-5" /> Add Member
        </button>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] outline-none"
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
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredMembers.map((member) => (
              <tr key={member.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-800">{member.member_number}</td>
                <td className="px-6 py-4 text-sm text-gray-800">{formatName(member.profiles?.full_name || member.full_name)}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{member.profiles?.email || member.email || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{member.profiles?.phone || member.phone || '-'}</td>
                <td className="px-6 py-4 text-sm font-semibold text-[#008080]">{formatUGX(member.account_balance)}</td>
                <td className="px-6 py-4">
                  <span
                    className={`status-badge ${
                      member.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : member.status === 'inactive'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {member.status}
                  </span>
                </td>
                <td className="px-6 py-4 flex gap-2">
                  <button
                    onClick={() => setShowDetailsModal(member)}
                    className="p-2 text-gray-600 hover:text-[#008080] hover:bg-blue-50 rounded-lg transition"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowEditModal(member)}
                    className="p-2 text-gray-600 hover:text-[#008080] hover:bg-blue-50 rounded-lg transition"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteMember(member.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && <AddMemberModal />}
      {showEditModal && <EditMemberModal member={showEditModal} />}

      {showDetailsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 relative">
            <h2 className="text-xl font-bold mb-4">Member Details</h2>
            <div className="space-y-2 text-gray-700">
              <p><strong>Full Name:</strong> {formatName(showDetailsModal.profiles?.full_name || showDetailsModal.full_name)}</p>
              <p><strong>Email:</strong> {showDetailsModal.profiles?.email || showDetailsModal.email || '-'}</p>
              <p><strong>Phone:</strong> {showDetailsModal.profiles?.phone || showDetailsModal.phone || '-'}</p>
              <p><strong>ID Number:</strong> {showDetailsModal.profiles?.id_number || showDetailsModal.id_number || '-'}</p>
              <p><strong>Date of Birth:</strong> {showDetailsModal.profiles?.date_of_birth || showDetailsModal.date_of_birth || '-'}</p>
              <p><strong>Address:</strong> {showDetailsModal.profiles?.address || showDetailsModal.address || '-'}</p>
              <p><strong>Member Number:</strong> {showDetailsModal.member_number}</p>
              <p><strong>Balance:</strong> {formatUGX(showDetailsModal.account_balance)}</p>
              <p><strong>Status:</strong> {showDetailsModal.status}</p>
            </div>
            <button
              onClick={() => setShowDetailsModal(null)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 font-bold text-xl"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
