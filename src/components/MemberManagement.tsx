import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Member } from '../lib/supabase';
import { UserPlus, Search } from 'lucide-react';
import AddMemberModal from './member-management/AddMemberModal';
import EditMemberModal from './member-management/EditMemberModal';
import ViewMemberModal from './member-management/ViewMemberModal';
import MemberTable from './member-management/MemberTable';

export default function MemberManagement({ isHelper = false }: { isHelper?: boolean }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewModal, setViewModal] = useState<Member | null>(null);
  const [editModal, setEditModal] = useState<Member | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [, setLoading] = useState(false);

  
  // Load members
  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*, profiles(id, full_name, role)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      console.error('Failed to load members:', err);
      setMembers([]);
    }
  };

  const filteredMembers = members.filter(
    (m) =>
      (m.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
  (m.member_number ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (m.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );
  

  

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

      <div>
        <MemberTable
          members={filteredMembers}
          onView={(m: any) => setViewModal(m)}
          onEdit={(m: any) => setEditModal(m)}
          onDelete={deleteMember}
          isHelper={isHelper}
        />
      </div>

  {showAddModal && <AddMemberModal onClose={() => setShowAddModal(false)} onSuccess={loadMembers} />}
  {viewModal && <ViewMemberModal member={viewModal} onClose={() => setViewModal(null)} />}
  {editModal && <EditMemberModal member={editModal} onClose={() => setEditModal(null)} onSuccess={loadMembers} />}
    </div>
  );
}
