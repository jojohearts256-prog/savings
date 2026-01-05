import { Eye, Edit2, Trash2 } from 'lucide-react';

export default function MemberTable({ members, onView, onEdit, onDelete, isHelper }: any) {
  const formatName = (name: string | undefined) => {
    if (!name) return '-';
    return name
      .toLowerCase()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  return (
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
          {members.map((m: any) => (
            <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-6 py-4 text-sm">{m.member_number}</td>
              <td className="px-6 py-4 text-sm">{formatName(m.full_name)}</td>
              <td className="px-6 py-4 text-sm">{m.email || '-'}</td>
              <td className="px-6 py-4 text-sm">{m.phone || '-'}</td>
              <td className="px-6 py-4 text-sm">UGX {Math.floor(Number(m.account_balance)).toLocaleString()}</td>
              <td className="px-6 py-4 text-sm flex gap-2">
                <button onClick={() => onView(m)} className="p-1 text-gray-500 hover:text-gray-800"><Eye className="w-4 h-4" /></button>
                {!isHelper && (
                  <>
                    <button onClick={() => onEdit(m)} className="p-1 text-gray-500 hover:text-gray-800"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => onDelete(m.id)} className="p-1 text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
