import { supabase } from '@/lib/supabase'

export async function fetchTransactions({ from, to } = {}) {
  let query = supabase
    .from('transactions')
    .select(`
      id, txn_date, amount, direction, is_internal_transfer, is_one_time,
      raw_description, upi_merchant_raw, upi_note, upi_handle,
      tx_prefix, ref_number, category_id, categorized_by,
      merchant_id, account_id, upload_id, balance_after, created_at,
      is_split, split_type, split_id,
      categories ( id, name, parent_id ),
      merchants ( id, display_name ),
      splits!fk_split ( my_share )
    `)
    .order('txn_date', { ascending: false })
    .order('created_at', { ascending: false })

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
      raw_description, upi_merchant_raw, upi_note, upi_handle, tx_prefix
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

export async function updateTransactionLabel(txId, upiMerchantRaw) {
  const { error } = await supabase
    .from('transactions')
    .update({ upi_merchant_raw: upiMerchantRaw })
    .eq('id', txId)

  if (error) throw error
}

export async function updateTransactionOneTime(txId, isOneTime) {
  const { error } = await supabase
    .from('transactions')
    .update({ is_one_time: isOneTime })
    .eq('id', txId)

  if (error) throw error
}

export async function createManualTransaction(tx) {
  const { data: latest } = await supabase
    .from('transactions')
    .select('balance_after')
    .eq('account_id', tx.account_id)
    .not('balance_after', 'is', null)
    .order('txn_date', { ascending: false })
    .limit(1)
    .single()

  const prevBalance   = latest?.balance_after ? Number(latest.balance_after) : null
  const balance_after = prevBalance !== null
    ? (tx.direction === 'credit'
        ? Math.round((prevBalance + tx.amount) * 100) / 100
        : Math.round((prevBalance - tx.amount) * 100) / 100)
    : null

  const { error } = await supabase
    .from('transactions')
    .insert({
      account_id:           tx.account_id,
      source:               'manual',
      txn_date:             tx.txn_date,
      amount:               tx.amount,
      direction:            tx.direction,
      balance_after:        balance_after,
      raw_description:      tx.raw_description,
      upi_merchant_raw:     tx.upi_merchant_raw || null,
      category_id:          tx.category_id || null,
      categorized_by:       tx.category_id ? 'manual' : null,
      is_internal_transfer: tx.is_internal_transfer || false,
    })

  if (error) throw error

  const { data: acc } = await supabase
    .from('accounts')
    .select('balance')
    .eq('id', tx.account_id)
    .single()

  if (acc?.balance != null) {
    const newBalance = tx.direction === 'credit'
      ? Number(acc.balance) + tx.amount
      : Number(acc.balance) - tx.amount
    await supabase
      .from('accounts')
      .update({ balance: Math.round(newBalance * 100) / 100 })
      .eq('id', tx.account_id)
  }
}

export async function deleteTransaction(txId) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', txId)

  if (error) throw error
}

// Debits flagged as split — shown as cards in Review
// split_type = null  → setup mode (split not created yet)
// split_type = 'paid' → recover mode (split exists, awaiting recoveries)
export async function fetchSplitFlagged() {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      id, txn_date, amount, direction,
      raw_description, upi_merchant_raw, upi_note, upi_handle,
      tx_prefix, split_type, split_id, is_split
    `)
    .eq('is_split', true)
    .eq('direction', 'debit')
    .order('txn_date', { ascending: false })

  if (error) throw error
  return data || []
}

// Credits flagged as split — shown as linkable options inside debit SplitCards
// split_id = null means not yet linked to any split
export async function fetchSplitCredits() {
  const { data: accounts, error: accErr } = await supabase
    .from('accounts')
    .select('id')

  if (accErr) throw accErr
  const accountIds = accounts.map(a => a.id)

  const { data, error } = await supabase
    .from('transactions')
    .select(`
      id, txn_date, amount, direction,
      raw_description, upi_merchant_raw, upi_note, upi_handle, split_id
    `)
    .eq('is_split', true)
    .eq('direction', 'credit')
    .in('account_id', accountIds)
    .order('txn_date', { ascending: false })

  if (error) throw error
  return data || []
}