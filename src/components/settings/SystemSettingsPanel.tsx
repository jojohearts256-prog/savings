import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

type PenaltyType = 'fixed' | 'percent';

type SystemSettingsRow = {
  id: number;
  penalties_enabled: boolean;
  penalty_grace_days: number;
  penalty_type: PenaltyType;
  penalty_value: number;
  updated_at?: string;
};

const DEFAULTS: SystemSettingsRow = {
  id: 1,
  penalties_enabled: false,
  penalty_grace_days: 0,
  penalty_type: 'fixed',
  penalty_value: 0,
};

export default function SystemSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SystemSettingsRow>(DEFAULTS);

  const penaltyValueHint = useMemo(() => {
    return settings.penalty_type === 'percent' ? 'e.g. 2.5 means 2.5% of outstanding' : 'e.g. 5000 means UGX 5,000';
  }, [settings.penalty_type]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('id, penalties_enabled, penalty_grace_days, penalty_type, penalty_value, updated_at')
        .eq('id', 1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setSettings(DEFAULTS);
        return;
      }

      setSettings({
        id: data.id,
        penalties_enabled: !!data.penalties_enabled,
        penalty_grace_days: Number(data.penalty_grace_days ?? 0),
        penalty_type: (data.penalty_type ?? 'fixed') as PenaltyType,
        penalty_value: Number(data.penalty_value ?? 0),
        updated_at: data.updated_at,
      });
    } catch (e: any) {
      console.error('Failed to load system settings', e);
      toast.error(e?.message || 'Failed to load settings');
      setSettings(DEFAULTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    const toastId = toast.loading('Saving settings...');
    try {
      const payload = {
        id: 1,
        penalties_enabled: settings.penalties_enabled,
        penalty_grace_days: Math.max(0, Math.floor(Number(settings.penalty_grace_days) || 0)),
        penalty_type: settings.penalty_type,
        penalty_value: Math.max(0, Number(settings.penalty_value) || 0),
      };

      const { error } = await supabase.from('system_settings').upsert(payload, { onConflict: 'id' });
      if (error) throw error;

      toast.success('Settings saved', { id: toastId });
      await loadSettings();
    } catch (e: any) {
      console.error('Failed to save settings', e);
      toast.error(e?.message || 'Failed to save settings', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl card-shadow p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800">System Settings</h3>
          <p className="text-sm text-gray-600">Global admin configuration (penalties, grace periods, etc.).</p>
        </div>
        <button
          onClick={saveSettings}
          disabled={loading || saving}
          className="px-4 py-2 rounded-xl bg-[#008080] text-white font-medium disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-gray-600">Loading settings…</div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-gray-800">Enable loan penalties</p>
              <p className="text-xs text-gray-500">If enabled, overdue loans can show estimated late fees.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.penalties_enabled}
              onChange={(e) => setSettings((s) => ({ ...s, penalties_enabled: e.target.checked }))}
              className="h-5 w-5 accent-[#008080]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grace days</label>
              <input
                type="number"
                min={0}
                value={settings.penalty_grace_days}
                onChange={(e) => setSettings((s) => ({ ...s, penalty_grace_days: Number(e.target.value) }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080]"
              />
              <p className="text-xs text-gray-500 mt-1">Days after due date before penalties apply.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Penalty type</label>
              <select
                value={settings.penalty_type}
                onChange={(e) => setSettings((s) => ({ ...s, penalty_type: e.target.value as PenaltyType }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080]"
              >
                <option value="fixed">Fixed (UGX)</option>
                <option value="percent">Percent (%)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">How the penalty is calculated.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Penalty value</label>
              <input
                type="number"
                min={0}
                step={settings.penalty_type === 'percent' ? 0.1 : 1}
                value={settings.penalty_value}
                onChange={(e) => setSettings((s) => ({ ...s, penalty_value: Number(e.target.value) }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080]"
              />
              <p className="text-xs text-gray-500 mt-1">{penaltyValueHint}</p>
            </div>
          </div>

          {settings.updated_at && (
            <p className="text-xs text-gray-400">Last updated: {new Date(settings.updated_at).toLocaleString()}</p>
          )}
        </div>
      )}
    </div>
  );
}
