import { supabase } from '@/lib/supabase'

/**
 * Fetch all budget limits from DB
 * Returns [{ id, category, amount, updated_at }]
 */
export async function fetchBudgets() {
  const { data, error } = await supabase
    .from('budgets')
    .select('id, category, amount, updated_at')
    .order('category')

  if (error) throw error
  return data || []
}

/**
 * Update a single budget limit
 */
export async function updateBudget(category, amount) {
  const { error } = await supabase
    .from('budgets')
    .update({ amount, updated_at: new Date().toISOString() })
    .eq('category', category)

  if (error) throw error
}

/**
 * Returns a plain object { FOOD: 8000, TRANSPORT: 3000, ... }
 * for use in analytics functions
 */
export async function fetchBudgetMap() {
  const budgets = await fetchBudgets()
  return Object.fromEntries(budgets.map(b => [b.category, b.amount]))
}

const DEFAULT_BUDGETS = [
  { category: 'FOOD',          amount: 8000  },
  { category: 'TRANSPORT',     amount: 3000  },
  { category: 'HOUSING',       amount: 15000 },
  { category: 'HEALTH',        amount: 2000  },
  { category: 'SHOPPING',      amount: 5000  },
  { category: 'SUBSCRIPTIONS', amount: 1500  },
  { category: 'PEOPLE',        amount: 3000  },
  { category: 'OTHER',         amount: 2000  },
]

export async function seedBudgets() {
  const { error } = await supabase
    .from('budgets')
    .insert(DEFAULT_BUDGETS)

  if (error) throw error
}