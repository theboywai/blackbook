import { supabase } from '@/lib/supabase'

export async function fetchOwnAccounts() {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, bank, account_no, type, upi_handles, holder_name')
    .eq('is_own', true)
    .order('bank')
  if (error) throw error
  return data || []
}