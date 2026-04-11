import { supabase } from '@/lib/supabase'

export async function fetchOwnAccounts() {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, bank, account_no, type, upi_handles, holder_name, balance')
    .eq('is_own', true)
    .order('bank')

  if (error) throw error
  return data || []
}

/**
 * Returns { accountId: uploaded_at } — most recent upload per account
 */
export async function fetchLastUploadPerAccount() {
  const { data, error } = await supabase
    .from('uploads')
    .select('account_id, uploaded_at, period_end')
    .order('uploaded_at', { ascending: false })

  if (error) return {}

  const map = {}
  for (const row of (data || [])) {
    if (!(row.account_id in map)) {
      map[row.account_id] = { uploaded_at: row.uploaded_at, period_end: row.period_end }
    }
  }
  return map
}

/**
 * Derive closing balance per account from transactions.
 * Closing balance = balance_after of the most recent transaction per account.
 * The pipeline stores balance_after on every row — no schema change needed.
 * Returns { accountId: closingBalance }
 */
export async function fetchClosingBalances() {
  const { data, error } = await supabase
    .from('transactions')
    .select('account_id, balance_after, txn_date')
    .not('balance_after', 'is', null)
    .order('txn_date', { ascending: false })

  if (error) return {}

  // Take the most recent non-null balance_after per account
  const map = {}
  for (const row of (data || [])) {
    if (!(row.account_id in map) && row.balance_after != null) {
      map[row.account_id] = Number(row.balance_after)
    }
  }
  return map
}

export async function createAccount({ name, bank, account_no, type, holder_name }) {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      name,
      bank:         bank.toUpperCase(),
      account_no,
      type,
      holder_name:  holder_name.toUpperCase(),
      is_own:       true,
      upi_handles:  [],
      user_id:      user.id,
    })
    .select().single()

  if (error) throw error
  return data
}

export async function updateAccountBalance(accountId, balance) {
  // 1. Update account.balance
  const { error } = await supabase
    .from('accounts')
    .update({ balance })
    .eq('id', accountId)

  if (error) throw error

  // 2. Insert a synthetic transaction so corpusTimeline picks up the correction
  const today = new Date().toISOString().slice(0, 10)
  await supabase
    .from('transactions')
    .insert({
      account_id:           accountId,
      source:               'balance_correction',
      txn_date:             today,
      amount:               0,
      direction:            'credit',
      balance_after:        balance,
      raw_description:      'Manual balance correction',
      is_internal_transfer: true,
      category_id:          null,
    })
  // Intentionally not throwing on this insert error —
  // the balance update already succeeded, chart fix is best-effort
}