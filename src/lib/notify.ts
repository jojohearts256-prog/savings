const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type NotificationPayload = {
  member_id?: string | null;
  recipient_role?: string | null;
  type: string;
  title: string;
  message: string;
  metadata?: any;
  toEmail?: string; // optional override for testing
};

export async function sendNotification(payload: NotificationPayload) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    return json;
  } catch (err) {
    console.warn('sendNotification helper failed', err);
    return { success: false, error: String(err) };
  }
}
