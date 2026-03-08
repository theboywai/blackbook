import { supabase } from '@/lib/supabase'

export async function fetchLastUpload() {
  const { data, error } = await supabase
    .from('uploads')
    .select('id, uploaded_at, account_id, txn_count, status')
    .eq('status', 'done')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return null // no uploads yet is fine
  return data
}