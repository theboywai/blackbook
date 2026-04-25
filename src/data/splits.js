import { supabase } from '@/lib/supabase'

/** Toggle is_split flag on any transaction */
export async function markAsSplit(txId, isSplit) {
  const { error } = await supabase
    .from('transactions')
    .update({ is_split: isSplit })
    .eq('id', txId)
  if (error) throw error
}

/** Fetch all open splits (for display/reference) */
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
 * is_split stays TRUE so the card remains in Review until resolved.
 * split_type = 'paid' signals the card should show recover mode.
 * myShare = 0 means full amount is owed back to you.
 */
export async function createSplit(txId, { description, totalAmount, myShare }) {
  const { data: split, error: splitErr } = await supabase
    .from('splits')
    .insert({
      transaction_id:   txId,
      description,
      total_amount:     totalAmount,
      my_share:         myShare,
      recovered_amount: 0,
      status:           'open',
    })
    .select().single()
  if (splitErr) throw splitErr

  const { error: txErr } = await supabase
    .from('transactions')
    .update({ split_type: 'paid', split_id: split.id })
    .eq('id', txId)
  if (txErr) throw txErr

  return split
}

/**
 * Link a credit transaction to a split as a recovery.
 * Tags the credit with split_type = 'owe' and split_id.
 * is_split stays TRUE on the credit so it remains visible/unlinkable.
 * Updates recovered_amount on the split row.
 * Does NOT auto-settle — only resolveManually closes a split.
 */
export async function linkRecovery(creditTxId, splitId, amount) {
  const { error: settleErr } = await supabase
    .from('split_settlements')
    .insert({ split_id: splitId, transaction_id: creditTxId, amount })
  if (settleErr) throw settleErr

  const { error: txErr } = await supabase
    .from('transactions')
    .update({ split_type: 'owe', split_id: splitId })
    .eq('id', creditTxId)
  if (txErr) throw txErr

  const { data: split, error: fetchErr } = await supabase
    .from('splits')
    .select('recovered_amount')
    .eq('id', splitId)
    .single()
  if (fetchErr) throw fetchErr

  const newRecovered = Number(split.recovered_amount) + Number(amount)

  const { error: updateErr } = await supabase
    .from('splits')
    .update({ recovered_amount: newRecovered })
    .eq('id', splitId)
  if (updateErr) throw updateErr
}

/**
 * Link a credit transaction to MULTIPLE splits, allocating a specified
 * portion of its amount to each split. Used when a single payment from
 * a friend covers multiple open splits.
 *
 * allocations = [{ splitId, amount }, ...]
 * The credit tx gets split_type = 'owe' and split_id = first splitId
 * (as a primary reference); all settlement rows are written.
 */
export async function linkRecoveryToMultipleSplits(creditTxId, allocations) {
  if (!allocations || allocations.length === 0) return

  // Insert a settlement row for each split
  const settlementRows = allocations.map(({ splitId, amount }) => ({
    split_id:       splitId,
    transaction_id: creditTxId,
    amount,
  }))
  const { error: settleErr } = await supabase
    .from('split_settlements')
    .insert(settlementRows)
  if (settleErr) throw settleErr

  // Tag the credit with the first split as primary reference
  const { error: txErr } = await supabase
    .from('transactions')
    .update({ split_type: 'owe', split_id: allocations[0].splitId })
    .eq('id', creditTxId)
  if (txErr) throw txErr

  // Update recovered_amount on each split; auto-resolve if fully covered
  for (const { splitId, amount } of allocations) {
    const { data: split, error: fetchErr } = await supabase
      .from('splits')
      .select('recovered_amount, expected_recovery, transaction_id')
      .eq('id', splitId)
      .single()
    if (fetchErr) throw fetchErr

    const newRecovered = Number(split.recovered_amount) + Number(amount)
    const { error: updateErr } = await supabase
      .from('splits')
      .update({ recovered_amount: newRecovered })
      .eq('id', splitId)
    if (updateErr) throw updateErr

    // Auto-resolve if fully recovered — no shortfall so absorbShortfall is irrelevant
    if (newRecovered >= Number(split.expected_recovery)) {
      await resolveManually(splitId, split.transaction_id, { absorbShortfall: false })
    }
  }
}

/**
 * Unlink a credit transaction from a split.
 * Removes the settlement row, resets the credit's split_type/split_id,
 * and subtracts its amount from recovered_amount.
 */
export async function unlinkRecovery(creditTxId, splitId, amount) {
  const { error: deleteErr } = await supabase
    .from('split_settlements')
    .delete()
    .eq('split_id', splitId)
    .eq('transaction_id', creditTxId)
  if (deleteErr) throw deleteErr

  const { error: txErr } = await supabase
    .from('transactions')
    .update({ split_type: null, split_id: null })
    .eq('id', creditTxId)
  if (txErr) throw txErr

  const { data: split, error: fetchErr } = await supabase
    .from('splits')
    .select('recovered_amount')
    .eq('id', splitId)
    .single()
  if (fetchErr) throw fetchErr

  const newRecovered = Math.max(0, Number(split.recovered_amount) - Number(amount))

  const { error: updateErr } = await supabase
    .from('splits')
    .update({ recovered_amount: newRecovered })
    .eq('id', splitId)
  if (updateErr) throw updateErr
}

/**
 * Manually resolve a split.
 *
 * absorbShortfall (default true):
 *   true  → shortfall is added to my_share (original behaviour)
 *   false → split closes as-is; shortfall is ignored / written off
 *
 * Only shows a difference when recovered_amount < expected_recovery.
 * If fully recovered, both paths are identical.
 */
export async function resolveManually(splitId, originalTxId, { absorbShortfall = true } = {}) {
  const { data: split, error: fetchErr } = await supabase
    .from('splits')
    .select('my_share, expected_recovery, recovered_amount')
    .eq('id', splitId)
    .single()
  if (fetchErr) throw fetchErr

  const shortfall     = Math.max(0, Number(split.expected_recovery) - Number(split.recovered_amount))
  const adjustedShare = absorbShortfall
    ? Number(split.my_share) + shortfall
    : Number(split.my_share)   // leave my_share unchanged

  const { error: splitErr } = await supabase
    .from('splits')
    .update({ my_share: adjustedShare, status: 'settled' })
    .eq('id', splitId)
  if (splitErr) throw splitErr

  // Clear is_split (removes from Review queue) but KEEP split_id intact
  // so Travel and other pages can still join splits(my_share) after resolution.
  const { error: debitErr } = await supabase
    .from('transactions')
    .update({ is_split: false })
    .eq('id', originalTxId)
  if (debitErr) throw debitErr

  const { error: creditErr } = await supabase
    .from('transactions')
    .update({ is_split: false })
    .eq('split_id', splitId)
    .eq('direction', 'credit')
  if (creditErr) throw creditErr
}

/** Write off a split without resolving recoveries */
export async function writeOffSplit(splitId, originalTxId) {
  const { error: splitErr } = await supabase
    .from('splits')
    .update({ status: 'written_off' })
    .eq('id', splitId)
  if (splitErr) throw splitErr

  const { error: txErr } = await supabase
    .from('transactions')
    .update({ is_split: false })
    .eq('id', originalTxId)
  if (txErr) throw txErr
}