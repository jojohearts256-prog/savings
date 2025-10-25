import { useState, useEffect } from 'react';
import { supabase, Member, Profile } from '../lib/supabase';
import { UserPlus, Search, Edit2, Trash2, Eye, CheckCircle } from 'lucide-react';

export default function MemberManagement() {
  const [members, setMembers] = useState<(Member & { profiles: Profile | null })[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<any>(null);
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
  const AddMemberModal = () => { /* (unchanged from your original) */ };

  // ✅ Modal for editing existing members
  const EditMemberModal = ({ member }: { member: any }) => {
    const [formData, setFormData] = useState({
      full_name: member.profiles?.full_name || member.full_name || '',
      email: member.profiles?.email || member.email || '',
      phone: member.profiles?.phone || member.phone || '',
      id_number: member.profiles?.id_number || member.id_number || '',
      date_of_birth: member.profiles?.date_of_birth || member.date_of_birth || '',
      address: member.profiles?.address || member.address || '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      setError('');
      setSuccess(false);

      try {
        // ✅ Update profiles table
        if (member.profile_id) {
          const { error: profileErr } = await supabase
            .from('profiles')
            .update({
              full_name: formData.full_name,
              email: formData.email,
              phone: formData.phone,
              id_number: formData.id_number,
              date_of_birth: formData.date_of_birth,
              address: formData.address,
            })
            .eq('id', member.profile_id);
          if (profileErr) throw profileErr;
        }

        // ✅ Update members table to keep in sync
        const { error: memberErr } = await supabase
          .from('members')
          .update({
            full_name: formData.full_name,
            email: formData.email,
            phone: formData.phone,
            id_number: formData.id_number,
            date_of_birth: formData.date_of_birth,
            address: formData.address,
          })
          .eq('id', member.id);
        if (memberErr) throw memberErr;

        setSuccess(true);
        await loadMembers();
        setTimeout(() => setShowEditModal(null), 1000);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to update member');
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Edit Member</h2>

          {error && (
            <div className="mb-3 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-3 p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm flex items-center gap-2">
              <CheckCircle className="w-5 h-5" /> Changes saved successfully!
            </div>
          )}

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
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2 btn-primary text-white font-medium rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => setShowEditModal(null)}
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
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 btn-primary text-white font-medium rounded-xl"
        >
          <UserPlus className="w-5 h-5" /> Add Member
        </button>
      </div>

      {/* Search */}
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

      {/* Table */}
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
                  UGX {Math.floor(Number(member.account_balance || 0)).toLocaleString('en-UG')}
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
                <strong>Balance:</strong>{' '}
                UGX {Math.floor(Number(showDetailsModal.account_balance || 0)).toLocaleString('en-UG')}
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
