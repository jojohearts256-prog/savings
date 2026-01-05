export default function ViewMemberModal({ member, onClose }: { member: any; onClose: () => void }) {
  const formatName = (name: string | undefined) => {
    if (!name) return '-';
    return name
      .toLowerCase()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

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
          <button onClick={onClose} className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50">Close</button>
        </div>
      </div>
    </div>
  );
}
