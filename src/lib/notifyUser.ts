// File: src/lib/notifyUser.ts
// --------------------------
// Full frontend helper to trigger all user notifications via Supabase Edge Function

export type NotificationPayload = {
  user_id?: string; // Required for existing users
  email?: string; // Required for new users
  password?: string; // Required for new users
  full_name?: string; // User's full name
  phone?: string;
  role?: string; // 'member', 'admin', etc.
  id_number?: string;
  address?: string;
  date_of_birth?: string;
  transaction_type?: 'deposit' | 'withdraw';
  transaction_amount?: number;
  loan_id?: string;
  loan_status?: 'approved' | 'rejected' | 'disbursed';
  message?: string; // Custom alert message
};

export async function notifyUser(payload: NotificationPayload) {
  if (!payload.user_id && !payload.email) {
    throw new Error('Either user_id or email must be provided');
  }

  try {
    const response = await fetch('/functions/admin-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to send notification');
    }

    // Optional: return data for frontend use
    return data;
  } catch (err: any) {
    console.error('Notification error:', err.message);
    throw err;
  }
}
