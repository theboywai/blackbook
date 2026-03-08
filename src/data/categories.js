import { supabase } from '@/lib/supabase'

let _cache = null

export async function fetchCategories() {
  if (_cache) return _cache
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, parent_id')
    .order('name')
  if (error) throw error
  _cache = data || []
  return _cache
}

export async function fetchChildCategories() {
  const cats = await fetchCategories()
  return cats.filter(c => c.parent_id !== null)
}

export async function fetchParentCategories() {
  const cats = await fetchCategories()
  return cats.filter(c => c.parent_id === null)
}

export async function fetchCategoryMap() {
  const cats = await fetchCategories()
  return Object.fromEntries(cats.map(c => [c.id, c]))
}