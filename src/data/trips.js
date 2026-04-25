import { supabase } from '@/lib/supabase'

export async function fetchTrips() {
  const { data, error } = await supabase
    .from('trips')
    .select('id, name, destination, start_date, end_date, budget, created_at')
    .order('start_date', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createTrip({ name, destination, start_date, end_date, budget }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('trips')
    .insert({
      name,
      user_id:     user.id,
      destination: destination || null,
      start_date:  start_date  || null,
      end_date:    end_date    || null,
      budget:      budget      || null,
    })
    .select().single()
  if (error) throw error
  return data
}

export async function updateTrip(tripId, { name, destination, start_date, end_date, budget }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('trips')
    .update({ name, destination: destination || null, start_date: start_date || null, end_date: end_date || null, budget: budget || null })
    .eq('id', tripId)
  if (error) throw error
}

export async function deleteTrip(tripId) {
  // Detach all transactions first
  const { error: detachErr } = await supabase
    .from('transactions')
    .update({ trip_id: null, is_one_time: false })
    .eq('trip_id', tripId)
  if (detachErr) throw detachErr

  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', tripId)
  if (error) throw error
}

// Assign multiple transactions to a trip — auto-sets is_one_time = true
export async function assignToTrip(txnIds, tripId) {
  const { error } = await supabase
    .from('transactions')
    .update({ trip_id: tripId, is_one_time: true })
    .in('id', txnIds)
  if (error) throw error
}

// Remove multiple transactions from their trip — clears is_one_time
export async function removeFromTrip(txnIds) {
  const { error } = await supabase
    .from('transactions')
    .update({ trip_id: null, is_one_time: false })
    .in('id', txnIds)
  if (error) throw error
}

// Fetch all transactions belonging to a trip
export async function fetchTripTransactions(tripId) {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      id, txn_date, amount, direction, raw_description,
      upi_merchant_raw, upi_note, upi_handle, category_id,
      categories ( id, name, parent_id )
    `)
    .eq('trip_id', tripId)
    .order('txn_date', { ascending: false })
  if (error) throw error
  return data || []
}