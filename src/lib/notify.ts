import { supabase } from './supabase'

// Project-specific defaults
const DEFAULT_PROJECT_REF = 'devegvzpallxsmbyszcb'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const PROJECT_REF = (import.meta.env.VITE_SUPABASE_PROJECT_REF as string) || DEFAULT_PROJECT_REF
const FUNCTIONS_HOST = (import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string) || `https://${PROJECT_REF}.functions.supabase.co`
const FUNCTION_NAME = (import.meta.env.VITE_SUPABASE_FUNCTION_NAME as string) || 'bight-service'

export type NotificationPayload = {
  member_id?: string | null
  recipient_role?: string | null
  type: string
  title: string
  message: string
  metadata?: any
  toEmail?: string
}

export async function sendNotification(payload: NotificationPayload) {
  try {
    // Call the deployed Edge Function first
    const functionUrl = `${FUNCTIONS_HOST}/${FUNCTION_NAME}`
    const res = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.warn('Edge function returned non-ok:', res.status, txt)
      throw new Error(`Function returned ${res.status}`)
    }

    const json = await res.json().catch(() => null)
    if (json && json.success) return json

    console.warn('Edge function reported failure, falling back to client insert', json)
  } catch (err) {
    console.warn('Edge function call failed, falling back to direct insert', err)
  }

  // Fallback: insert directly into notifications table
  try {
    const { data, error } = await supabase.from('notifications').insert([
      {
        member_id: payload.member_id || null,
        recipient_role: payload.recipient_role || null,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        metadata: payload.metadata || null,
        sent_at: new Date().toISOString(),
        read: false,
      },
    ]).select().maybeSingle()

    if (error) {
      console.warn('Fallback insert failed', error)
      return { success: false, error: String(error) }
    }

    return { success: true, notification: data, fallback: true }
  } catch (e) {
    console.error('Fallback insert failed', e)
    return { success: false, error: String(e) }
  }
}
