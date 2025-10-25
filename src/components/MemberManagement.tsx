import { useState, useEffect } from 'react';
import { supabase, Member, Profile } from '../lib/supabase';
import { UserPlus, Search, Edit2, Trash2, Eye, CheckCircle } from 'lucide-react';

export default function MemberManagement() {
  const [members, setMembers] = useState<(Member & { profiles: Profile | null })[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState<Member | null>(null);
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
        console.log('Response from Edge Function:', result);

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
              <CheckCircle className="w-5 h-5" /> Member registered successfully!
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
                <input
                  type="text"
                  value={formData.id_number}
                  onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
                rows={2}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2 btn-primary text-white font-medium rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && (
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    ></path>
                  </svg>
                )}
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
        <button
          onClick={() => {
            console.log('Add Member clicked');
            setShowAddModal(true);
          }}
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
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredMembers.map((member) => (
              <tr key={member.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-800">
                  {member.member_number}
                </td>
                <td className="px-6 py-4 text-sm text-gray-800">
                  {member.profiles?.full_name || member.full_name || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {member.profiles?.email || member.email || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {member.profiles?.phone || member.phone || '-'}
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-[#008080]">
                  ${Number(member.account_balance).toLocaleString()}
                </td>
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
                    onClick={() =>
                      alert('Edit ' + (member.profiles?.full_name || member.full_name))
                    }
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

      {/* ✅ Fixed rendering issue here */}
      {showAddModal && <AddMemberModal />}

      {showDetailsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 relative">
            <h2 className="text-xl font-bold mb-4">Member Details</h2>
            <div className="space-y-2 text-gray-700">
              <p>
                <strong>Full Name:</strong>{' '}
                {showDetailsModal.profiles?.full_name || showDetailsModal.full_name || '-'}
              </p>
              <p>
                <strong>Email:</strong>{' '}
                {showDetailsModal.profiles?.email || showDetailsModal.email || '-'}
              </p>
              <p>
                <strong>Phone:</strong>{' '}
                {showDetailsModal.profiles?.phone || showDetailsModal.phone || '-'}
              </p>
              <p>
                <strong>ID Number:</strong>{' '}
                {showDetailsModal.profiles?.id_number || showDetailsModal.id_number || '-'}
              </p>
              <p>
                <strong>Date of Birth:</strong>{' '}
                {showDetailsModal.profiles?.date_of_birth ||
                  showDetailsModal.date_of_birth ||
                  '-'}
              </p>
              <p>
                <strong>Address:</strong>{' '}
                {showDetailsModal.profiles?.address || showDetailsModal.address || '-'}
              </p>
              <p>
                <strong>Member Number:</strong> {showDetailsModal.member_number}
              </p>
              <p>
                <strong>Balance:</strong> $
                {Number(showDetailsModal.account_balance).toLocaleString()}
              </p>
              <p>
                <strong>Status:</strong> {showDetailsModal.status}
              </p>
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
