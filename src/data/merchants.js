import { supabase } from '@/lib/supabase'

export async function fetchMerchants() {
  const { data, error } = await supabase
    .from('merchants')
    .select('id, display_name, upi_handle, category_id, merchant_type, note')
    .order('display_name')
  if (error) throw error
  return data || []
}

export async function createMerchant({ display_name, upi_handle, category_id, merchant_type = 'business' }) {
  const { data, error } = await supabase
    .from('merchants')
    .insert({ display_name, upi_handle, category_id, merchant_type })
    .select()
    .single()
  if (error) throw error
  return data
}