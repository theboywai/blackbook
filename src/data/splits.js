import { supabase } from '@/lib/supabase'

/** Mark a transaction as a split (surfaces it in Review) */
export async function markAsSplit(txId, isSplit) {
  const { error } = await supabase
    .from('transactions')
    .update({ is_split: isSplit })
    .eq('id', txId)
  if (error) throw error
}

/** Fetch all open splits for linking recovery credits */
export async function fetchOpenSplits() {
  const { data, error } = await supabase
    .from('splits')
    .select(`
      id, description, total_amount, my_share, expected_recovery,
      recovered_amount, status, created_at,
      transactions!fk_split ( id, txn_date, amount, upi_merchant_raw, raw_description )
    `)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

/**
 * Create a split record from a debit transaction.
 * Sets split_type = 'paid' on the transaction.
 */
export async function createSplit(txId, { description, totalAmount, myShare }) {
  // 1. Insert split row
  const { data: split, error: splitErr } = await supabase
    .from('splits')
    .insert({
      transaction_id:    txId,
      description,
      total_amount:      totalAmount,
      my_share:          myShare,
      recovered_amount:  0,
      status:            'open',
    })
    .select().single()
  if (splitErr) throw splitErr

  // 2. Tag the original transaction
  const { error: txErr } = await supabase
    .from('transactions')
    .update({ split_type: 'paid', split_id: split.id, is_split: false })
    .eq('id', txId)
  if (txErr) throw txErr

  return split
}

/**
 * Link a recovery credit to an existing split.
 * Sets split_type = 'owe' on the credit transaction.
 */
export async function linkRecovery(txId, splitId, amount, personName) {
  // 1. Insert settlement row
  const { error: settleErr } = await supabase
    .from('split_settlements')
    .insert({ split_id: splitId, transaction_id: txId, amount, person_name: personName })
  if (settleErr) throw settleErr

  // 2. Tag the credit transaction
  const { error: txErr } = await supabase
    .from('transactions')
    .update({ split_type: 'owe', split_id: splitId, is_split: false })
    .eq('id', txId)
  if (txErr) throw txErr

  // 3. Update recovered_amount on the split
  const { data: split, error: fetchErr } = await supabase
    .from('splits')
    .select('recovered_amount, expected_recovery')
    .eq('id', splitId)
    .single()
  if (fetchErr) throw fetchErr

  const newRecovered = Number(split.recovered_amount) + Number(amount)
  const isSettled    = newRecovered >= Number(split.expected_recovery)

  const { error: updateErr } = await supabase
    .from('splits')
    .update({
      recovered_amount: newRecovered,
      status: isSettled ? 'settled' : 'open',
    })
    .eq('id', splitId)
  if (updateErr) throw updateErr
}

/** Write off a split — stop expecting recovery */
export async function writeOffSplit(splitId) {
  const { error } = await supabase
    .from('splits')
    .update({ status: 'written_off' })
    .eq('id', splitId)
  if (error) throw error
}