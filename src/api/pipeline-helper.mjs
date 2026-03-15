export function stripMarkdown(raw) {
  return raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
}

export function extractUPIHandle(desc) {
  if (!desc) return null
  for (const seg of desc.split('/')) {
    if (seg.includes('@') && !seg.includes(' ')) return seg.toLowerCase().trim()
  }
  return null
}

export function extractUPIMerchantRaw(desc) {
  if (!desc) return null
  const m = desc.match(/^UPI\/([^/]+)\//)
  return m ? m[1].trim() : null
}

export function extractUPINote(desc) {
  if (!desc || !desc.startsWith('UPI/')) return null
  const parts = desc.split('/')
  return parts[parts.length - 1].trim() || null
}

export function validate(extracted) {
  const errors = [], warnings = []
  const { opening_balance, closing_balance, total_transactions, transactions } = extracted
  if (opening_balance == null) errors.push('MISSING: opening_balance')
  if (closing_balance == null) errors.push('MISSING: closing_balance')
  if (!Array.isArray(transactions) || transactions.length === 0)
    return { valid: false, errors: [...errors, 'MISSING: transactions'], warnings, summary: {} }
  if (total_transactions != null && transactions.length !== total_transactions)
    errors.push(`ROW COUNT MISMATCH: expected ${total_transactions}, got ${transactions.length}`)
  const seen = new Map()
  let credits = 0, debits = 0
  transactions.forEach((tx, i) => {
    const loc = `Row ${i + 1}`
    if (tx.amount == null)        errors.push(`${loc}: amount null`)
    if (!tx.txn_date)             errors.push(`${loc}: txn_date null`)
    if (!tx.direction)            errors.push(`${loc}: direction null`)
    if (tx.balance_after == null) errors.push(`${loc}: balance_after null`)
    if (tx.direction === 'credit') credits += tx.amount || 0
    if (tx.direction === 'debit')  debits  += tx.amount || 0
    if ((tx.amount || 0) > 50000) warnings.push(`${loc}: large ₹${tx.amount}`)
    const key = `${tx.txn_date}|${tx.amount}|${tx.direction}`
    if (seen.has(key)) warnings.push(`${loc}: possible duplicate with Row ${seen.get(key) + 1}`)
    else seen.set(key, i)
  })
  if (opening_balance != null && closing_balance != null && errors.length === 0) {
    const expected = Math.round((opening_balance + credits - debits) * 100) / 100
    const diff = Math.abs(expected - closing_balance)
    if (diff > 1.0) errors.push(`BALANCE MISMATCH: computed ${expected}, stated ${closing_balance}`)
  }
  return {
    valid: errors.length === 0, errors, warnings,
    summary: {
      row_count:        transactions.length,
      total_credits:    Math.round(credits * 100) / 100,
      total_debits:     Math.round(debits  * 100) / 100,
      computed_closing: Math.round(((opening_balance || 0) + credits - debits) * 100) / 100,
      stated_closing:   closing_balance,
    }
  }
}

export async function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      try {
        const body     = Buffer.concat(chunks)
        const ct       = req.headers['content-type'] || ''
        const boundary = ct.split('boundary=')[1]?.trim()
        if (!boundary) return reject(new Error('No boundary in content-type'))
        const sep   = Buffer.from(`--${boundary}`)
        const parts = []
        let start   = 0
        while (true) {
          const idx = body.indexOf(sep, start)
          if (idx === -1) break
          if (start > 0) parts.push(body.slice(start, idx - 2))
          start = idx + sep.length + 2
        }
        const fields = {}, files = {}
        for (const part of parts) {
          const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'))
          if (headerEnd === -1) continue
          const headerStr = part.slice(0, headerEnd).toString()
          const content   = part.slice(headerEnd + 4)
          const nameMatch = headerStr.match(/name="([^"]+)"/)
          if (!nameMatch) continue
          const name      = nameMatch[1]
          const fileMatch = headerStr.match(/filename="([^"]+)"/)
          if (fileMatch) files[name]  = { buffer: content, filename: fileMatch[1] }
          else           fields[name] = content.toString().trim()
        }
        resolve({ fields, files })
      } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}