import { supabase } from '@/lib/supabase'

export async function fetchBudgets() {
  const { data, error } = await supabase
    .from('budgets')
    .select('id, category, amount, updated_at')
    .order('category')
  if (error) throw error
  return data || []
}

export async function updateBudget(category, amount) {
  const { error } = await supabase
    .from('budgets')
    .update({ amount, updated_at: new Date().toISOString() })
    .eq('category', category)
  if (error) throw error
}

export async function fetchBudgetMap() {
  const budgets = await fetchBudgets()
  return Object.fromEntries(budgets.map(b => [b.category, b.amount]))
}