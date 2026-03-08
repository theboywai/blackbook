import { supabase } from '@/lib/supabase'

export async function fetchTransactions({ from, to } = {}) {
  let query = supabase
    .from('transactions')
    .select(`
      id, txn_date, amount, direction, is_internal_transfer,
      raw_description, upi_merchant_raw, upi_note, upi_handle,
      tx_prefix, ref_number, category_id, categorized_by,
      merchant_id, account_id, upload_id,
      categories ( id, name, parent_id ),
      merchants ( id, display_name )
    `)
    .order('txn_date', { ascending: false })

  if (from) query = query.gte('txn_date', from)
  if (to)   query = query.lte('txn_date', to)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function fetchUncategorized() {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      id, txn_date, amount, direction,
      raw_description, upi_merchant_raw, upi_note, tx_prefix
    `)
    .is('category_id', null)
    .eq('is_internal_transfer', false)
    .order('txn_date', { ascending: false })

  if (error) throw error
  return data || []
}

export async function countUncategorized() {
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .is('category_id', null)
    .eq('is_internal_transfer', false)

  if (error) throw error
  return count || 0
}

export async function updateTransactionCategory(txId, categoryId) {
  const { error } = await supabase
    .from('transactions')
    .update({ category_id: categoryId, categorized_by: 'manual' })
    .eq('id', txId)

  if (error) throw error
}