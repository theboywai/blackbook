export const CATEGORY_COLORS = {
  FOOD:          '#f5a623',
  TRANSPORT:     '#5b8dee',
  HOUSING:       '#e05252',
  HEALTH:        '#4caf7d',
  SHOPPING:      '#b05bde',
  SUBSCRIPTIONS: '#5bcdde',
  PEOPLE:        '#de845b',
  ENTERTAINMENT: '#e84393',
  TRAVEL:        '#20b2aa',
  INCOME:        '#4caf7d',
  TRANSFER:      '#555555',
  OTHER:         '#444444',
}

export const CATEGORY_ICONS = {
  FOOD:          '🍜',
  TRANSPORT:     '🚇',
  HOUSING:       '🏠',
  HEALTH:        '💊',
  SHOPPING:      '🛍️',
  SUBSCRIPTIONS: '📱',
  PEOPLE:        '👥',
  ENTERTAINMENT: '🎬',
  TRAVEL:        '✈️',
  INCOME:        '💰',
  TRANSFER:      '↔️',
  OTHER:         '•',
}

// TRAVEL excluded — trip spend is tagged is_one_time, judged per-trip not monthly
export const SPENDABLE_PARENTS = [
  'FOOD', 'TRANSPORT', 'HOUSING', 'HEALTH',
  'SHOPPING', 'SUBSCRIPTIONS', 'PEOPLE', 'ENTERTAINMENT', 'OTHER'
]

export const INCOME_PARENTS   = ['INCOME']
export const TRANSFER_PARENTS = ['TRANSFER']