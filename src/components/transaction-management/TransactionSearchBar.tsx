import { Search } from 'lucide-react';

export default function TransactionSearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="mb-4 relative">
      <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
      <input
        type="text"
        placeholder="Search transactions..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none"
      />
    </div>
  );
}
