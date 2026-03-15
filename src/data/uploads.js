import { supabase } from '@/lib/supabase'

export async function fetchLastUpload() {
  const { data, error } = await supabase
    .from('uploads')
    .select('id, uploaded_at, account_id, tx_count')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return null
  return data
}