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