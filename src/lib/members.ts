import { supabase } from './supabase'
import type { Member } from './supabase'

/**
 * Fetch members while excluding any associated profile with role 'admin'.
 * Returns Member objects (profile fields may be present if joined).
 */
export async function fetchMembersExcludingAdmins(): Promise<Member[]> {
  try {
    // join profiles so we can inspect role
    const { data, error } = await supabase
      .from('members')
      .select('*, profiles(id, full_name, email, role)')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('fetchMembersExcludingAdmins error', error)
      return []
    }

    // data items may include a `profiles` object when relationship exists
    const list = (data || []).filter((m: any) => {
      const role = m.profiles?.role ?? null
      return role !== 'admin'
    })

    return list as Member[]
  } catch (e) {
    console.error('fetchMembersExcludingAdmins exception', e)
    return []
  }
}
