const { GoogleGenerativeAI } = require('@google/generative-ai')
const { createClient }       = require('@supabase/supabase-js')
const { createHash }         = require('crypto')
const { readFileSync }       = require('fs')
const { join }               = require('path')

const EXTRACT_PROMPT    = `You are a bank statement parser. Extract every transaction from the attached PDF bank statement into structured JSON.

RULES:
- Return ONLY valid JSON. No markdown, no explanation, no code fences.
- Extract ALL transactions exactly as they appear. Do not skip any.
- Never infer or guess amounts. Copy numbers verbatim.
- Dates must be in YYYY-MM-DD format.
- direction must be exactly "debit" or "credit" (lowercase).
- tx_prefix must be exactly one of: UPI, MB, IMPS, NEFT, NACH, PCD, ZING, OTHER
  - UPI: starts with UPI/
  - MB: starts with MB: (Mobile Banking transfers)
  - IMPS: starts with IMPS/
  - NEFT: starts with NEFT/
  - NACH: starts with NACH/ (auto-debits, EMIs)
  - PCD: Point of sale / card payments
  - ZING: Kotak ZING internal transfers
  - OTHER: anything else
- ref_number: extract the UPI transaction ID, IMPS ref, NEFT ref, or any reference number present. null if none.
- balance_after: the running balance shown in the "Balance" column after this row. Never null.
- raw_description: the full description text exactly as printed, no truncation.

OUTPUT FORMAT:
{
  "opening_balance": <number>,
  "closing_balance": <number>,
  "statement_period": {
    "from": "YYYY-MM-DD",
    "to": "YYYY-MM-DD"
  },
  "account_number": "<last 4 digits or masked number as shown>",
  "total_transactions": <number as shown in PDF header or summary>,
  "transactions": [
    {
      "txn_date": "YYYY-MM-DD",
      "amount": <number, always positive>,
      "direction": "debit" | "credit",
      "balance_after": <number>,
      "raw_description": "<full description, no truncation>",
      "ref_number": "<ref string or null>",
      "tx_prefix": "UPI" | "MB" | "IMPS" | "NEFT" | "NACH" | "PCD" | "ZING" | "OTHER"
    }
  ]
}`

const CATEGORIZE_PROMPT = `You are a personal finance categorizer for an Indian user. Categorize each transaction and extract merchant info.

CATEGORY LIST (use these exact names only):
FOOD        → "Food Delivery", "Grocery & Daily", "Dining & Cafe"
TRANSPORT   → "Metro", "Cab", "Auto & Rickshaw"
HOUSING     → "Rent", "Home Supplies"
HEALTH      → "Pharmacy", "Fitness"
SHOPPING    → "Clothing", "Electronics", "General Shopping"
SUBSCRIPTIONS → "Streaming", "SaaS & Apps"
PEOPLE      → "Split & Settle", "Gift", "Family Support"
INCOME      → "Salary", "Refund", "Other Income"
TRANSFER    → "Self Transfer", "Third Party Transfer"
OTHER       → "Other"

KNOWN MERCHANTS (match these exactly when detected):
- "SWIGGY" in description                          → merchant: "Swiggy",            category: "Food Delivery"
- "BLINKIT" or "GROFERS"                           → merchant: "Blinkit",            category: "Grocery & Daily"
- "UBER" in description or uberindiaapp in handle  → merchant: "Uber",               category: "Cab"
- "DMRC" or "DELHI METRO"                          → merchant: "Delhi Metro",         category: "Metro"
- "NMRC" or "NOIDA METRO" or "Noida Metro Rai"    → merchant: "Noida Metro",         category: "Metro"
- "youtube" or "YOUTUBEGOOGLE" or "google" in desc → merchant: "YouTube / Google",    category: "Streaming"
- "APPLE MEDIA" or "APPLE.COM"                     → merchant: "Apple",               category: "SaaS & Apps"
- "AMAZON" or "Amazon Pay"                         → merchant: "Amazon",              category: "General Shopping"
- "DEVANSHU MADNAN"                                → merchant: "Devanshu Madnan",     category: "Rent"
- "ACCENT ON HEALT" or "ACCENT ON HEALTH"          → merchant: "Accent on Health",    category: "Dining & Cafe"
- "WESTSIDE"                                       → merchant: "Westside",            category: "Clothing"
- "WAKEFIT"                                        → merchant: "Wakefit",             category: "Home Supplies"
- "SNABBIT"                                        → merchant: "Snabbit",             category: "Home Supplies"
- "DAS FOOD"                                       → merchant: "Das Food",            category: "Dining & Cafe"
- "Tata1mg" or "TATA 1MG"                          → merchant: "Tata 1mg",            category: "Pharmacy"
- "SAUMYA GARG"                                    → merchant: null,                  category: "Split & Settle"
- "FOOD FORUM"                                     → merchant: "Food Forum",          category: "Dining & Cafe"
- "MARKET 99"                                      → merchant: "Market 99",           category: "General Shopping"
- "aditshrm" or "ADITYA SHARMA"                    → merchant: null,                  category: "Split & Settle"
- "Mamura"                                         → merchant: "Mamura",              category: "Gift"

SPECIAL RULES (apply in this order, first match wins):
1. ZING prefix → category: "Self Transfer", merchant: null
2. tx_prefix NEFT or IMPS, direction credit, description contains "AKSHANSH PANDEY" → category: "Self Transfer"
3. MB: prefix with "RAKESH KUMAR PANDEY" or family name → category: "Family Support"
4. NACH prefix → check description; usually "Streaming" or "SaaS & Apps"
5. description contains "REFUND" or note contains "Refund" → category: "Refund"
6. UPI note (the part after the last /) starts with "CAB" → category: "Cab", merchant: null
7. UPI note starts with "AUTO" or "Rick" or "Ric" → category: "Auto & Rickshaw", merchant: null
8. UPI note starts with "FOOD" → category: "Dining & Cafe", merchant: null (unless known merchant)
9. UPI to individual name (not a known business), amount < ₹500, no clear note → category: "Auto & Rickshaw"
10. UPI to individual name, amount ₹500–₹5000, no clear note → category: "Split & Settle"
11. Large NEFT/IMPS credit (>₹5000), direction credit, early in month → category: "Salary"
12. direction credit and none of the above matched → category: "Other Income"

UPI NOTE EXTRACTION:
The UPI description format is: UPI/MERCHANT NAME/refno/NOTE
Extract the NOTE (last segment after final /) — it often contains user-entered tags like:
FOODoffice, FOODlunch, FOODdinner, CABoffice, CABbuahouse, GiftingWi, FlatRentMarch, milkcharity, etc.
These notes are highly reliable signals — prioritize them over merchant name guessing.

RULES FOR merchant_display_name:
- Known businesses: use the clean name from the list above
- One-off individuals (auto drivers, street vendors, random people): null
- Friends in splits: null (they're tracked via splits system, not merchant table)

INPUT: Array of transaction objects.
OUTPUT: Array only — return ONLY valid JSON array, no markdown, no wrapper object.

[
  {
    "id": "<same id from input>",
    "category_name": "<exact category name from list above>",
    "merchant_display_name": "<clean merchant name or null>",
    "confidence": "high" | "medium" | "low",
    "note": "<optional: only include if low confidence, brief reason>"
  }
]`

const PARSER_VERSION    = 'gemini-flash-latest-001'

function stripMarkdown(raw) {
  return raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
}
 
function extractUPIHandle(desc) {
  if (!desc) return null
  for (const seg of desc.split('/')) {
    if (seg.includes('@') && !seg.includes(' ')) return seg.toLowerCase().trim()
  }
  return null
}
 
function extractUPIMerchantRaw(desc) {
  if (!desc) return null
  const m = desc.match(/^UPI\/([^/]+)\//)
  return m ? m[1].trim() : null
}
 
function extractUPINote(desc) {
  if (!desc || !desc.startsWith('UPI/')) return null
  const parts = desc.split('/')
  return parts[parts.length - 1].trim() || null
}
 
function validate(extracted) {
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
 
async function parseMultipart(req) {
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
 
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
 
  const GEMINI_KEY = process.env.GEMINI_API_KEY
  const SUPA_URL   = process.env.SUPABASE_URL
  const SUPA_KEY   = process.env.SUPABASE_SERVICE_KEY
  if (!GEMINI_KEY || !SUPA_URL || !SUPA_KEY)
    return res.status(500).json({ error: 'Missing server env vars' })
 
  // ── Verify JWT ─────────────────────────────────────────────────────────────
  const authHeader = req.headers['authorization'] || ''
  const token      = authHeader.replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
 
  const adminClient = createClient(SUPA_URL, SUPA_KEY)
  const { data: { user }, error: authErr } = await adminClient.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })
 
  // User-scoped client — all DB ops go through RLS
  const supabase = createClient(SUPA_URL, SUPA_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  })
 
  const genAI = new GoogleGenerativeAI(GEMINI_KEY)
 
  let fields, files
  try {
    ;({ fields, files } = await parseMultipart(req))
  } catch (e) {
    return res.status(400).json({ error: 'Failed to parse upload: ' + e.message })
  }
 
  const accountId = fields.account_id
  const pdfBuffer = files.pdf?.buffer
  if (!accountId) return res.status(400).json({ error: 'Missing account_id' })
  if (!pdfBuffer) return res.status(400).json({ error: 'Missing pdf file' })
 
  const fileHash  = createHash('sha256').update(pdfBuffer).digest('hex')
  const pdfBase64 = pdfBuffer.toString('base64')
 
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
 
  const send = (step, status, data = {}) =>
    res.write(`data: ${JSON.stringify({ step, status, ...data })}\n\n`)
 
  try {
    // Step 1 — Extract
    send('extract', 'running')
    const model      = genAI.getGenerativeModel({ model: 'gemini-flash-latest' })
    const extraction = await model.generateContent([
      { text: EXTRACT_PROMPT },
      { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
    ])
    let extracted
    try {
      extracted = JSON.parse(stripMarkdown(extraction.response.text()))
    } catch {
      send('extract', 'error', { message: 'Gemini returned invalid JSON during extraction' })
      return res.end()
    }
    send('extract', 'done', { count: extracted.transactions?.length })
 
    // Step 2 — Validate
    send('validate', 'running')
    const validation = validate(extracted)
    if (!validation.valid) {
      send('validate', 'error', { message: validation.errors.join(' · ') })
      return res.end()
    }
    send('validate', 'done', { summary: validation.summary, warnings: validation.warnings })
 
    // Step 3 — Categorize
    send('categorize', 'running')
    const catInput = extracted.transactions.map((tx, i) => ({
      id:               String(i),
      raw_description:  tx.raw_description,
      upi_merchant_raw: extractUPIMerchantRaw(tx.raw_description),
      upi_note:         extractUPINote(tx.raw_description),
      tx_prefix:        tx.tx_prefix,
      direction:        tx.direction,
      amount:           tx.amount,
      txn_date:         tx.txn_date,
    }))
    const catResult = await model.generateContent(
      CATEGORIZE_PROMPT + '\n\nINPUT:\n' + JSON.stringify(catInput, null, 2)
    )
    let categories
    try {
      categories = JSON.parse(stripMarkdown(catResult.response.text()))
    } catch {
      send('categorize', 'error', { message: 'Gemini returned invalid JSON during categorization' })
      return res.end()
    }
    send('categorize', 'done', { count: categories.length })
 
    // Step 4 — Insert
    send('insert', 'running')
 
    const { data: existing } = await supabase
      .from('uploads').select('id').eq('file_hash', fileHash).single()
    if (existing) {
      send('insert', 'error', { message: 'Duplicate upload — this PDF has already been processed' })
      return res.end()
    }
 
    const [{ data: dbCats }, { data: dbMerchants }, { data: ownAccounts }] = await Promise.all([
      supabase.from('categories').select('id, name'),
      supabase.from('merchants').select('id, upi_handle, display_name, category_id'),
      supabase.from('accounts').select('upi_handles, holder_name').eq('is_own', true),
    ])
 
    const categoryMap      = Object.fromEntries((dbCats||[]).map(c => [c.name.toLowerCase(), c.id]))
    const merchantByHandle = Object.fromEntries(
      (dbMerchants||[]).filter(m => m.upi_handle).map(m => [m.upi_handle.toLowerCase(), m])
    )
    const ownHandles     = new Set((ownAccounts||[]).flatMap(a => a.upi_handles||[]).map(h => h.toLowerCase()))
    const ownHolderNames = new Set((ownAccounts||[]).map(a => a.holder_name).filter(Boolean).map(n => n.toUpperCase()))
    const geminiMap      = Object.fromEntries(categories.map(c => [c.id, c]))
 
    const { data: existingTxns } = await supabase
      .from('transactions')
      .select('txn_date, amount, direction, raw_description')
      .eq('account_id', accountId)
      .gte('txn_date', extracted.statement_period?.from)
      .lte('txn_date', extracted.statement_period?.to)
 
    const existingKeys = new Set(
      (existingTxns||[]).map(t => `${t.txn_date}|${t.amount}|${t.direction}|${t.raw_description}`)
    )
 
    const { data: upload, error: uploadErr } = await supabase
      .from('uploads')
      .insert({
        account_id:     accountId,
        period_start:   extracted.statement_period?.from,
        period_end:     extracted.statement_period?.to,
        file_hash:      fileHash,
        tx_count:       extracted.transactions.length,
        parser_version: PARSER_VERSION,
      })
      .select().single()
    if (uploadErr) throw uploadErr
 
    let reviewCount = 0, skipped = 0
    const txRows = []
 
    for (let i = 0; i < extracted.transactions.length; i++) {
      const tx       = extracted.transactions[i]
      const dedupKey = `${tx.txn_date}|${tx.amount}|${tx.direction}|${tx.raw_description}`
      if (existingKeys.has(dedupKey)) { skipped++; continue }
 
      const gemCat    = geminiMap[String(i)]
      const upiHandle = extractUPIHandle(tx.raw_description)
      const upiNote   = extractUPINote(tx.raw_description)
 
      const isZing      = tx.tx_prefix === 'ZING'
      const isOwnHandle = !!(upiHandle && ownHandles.has(upiHandle))
      const isNEFTSelf  = (tx.tx_prefix === 'NEFT' || tx.tx_prefix === 'IMPS') &&
                          tx.direction === 'credit' &&
                          [...ownHolderNames].some(n => tx.raw_description.toUpperCase().includes(n))
      const isInternal  = isZing || isOwnHandle || isNEFTSelf
 
      let merchantId = null, categoryId = null, categorizedBy = null
      if (isInternal) {
        categoryId    = categoryMap['self transfer'] || null
        categorizedBy = 'rule'
      } else {
        if (upiHandle && merchantByHandle[upiHandle]) {
          const m = merchantByHandle[upiHandle]
          merchantId = m.id; categoryId = m.category_id; categorizedBy = 'rule'
        }
        if (!categoryId && gemCat?.category_name) {
          categoryId    = categoryMap[gemCat.category_name.toLowerCase()] || null
          categorizedBy = categoryId ? 'gemini' : null
        }
      }
      if (!categoryId && !isInternal) reviewCount++
 
      txRows.push({
        account_id: accountId, upload_id: upload.id, source: 'pdf',
        txn_date: tx.txn_date, amount: tx.amount, direction: tx.direction,
        balance_after: tx.balance_after, raw_description: tx.raw_description,
        ref_number: tx.ref_number || null, upi_handle: upiHandle,
        upi_merchant_raw: extractUPIMerchantRaw(tx.raw_description),
        upi_note: upiNote, tx_prefix: tx.tx_prefix,
        merchant_id: merchantId, category_id: categoryId,
        categorized_by: categorizedBy, is_internal_transfer: isInternal,
      })
    }
 
    if (txRows.length > 0) {
      const { error: txErr } = await supabase.from('transactions').insert(txRows)
      if (txErr) {
        await supabase.from('uploads').delete().eq('id', upload.id)
        throw txErr
      }
    }
    // Update account balance to closing balance from this statement
    await supabase
    .from('accounts')
    .update({ balance: extracted.closing_balance })
    .eq('id', accountId)
 
    send('insert', 'done', { upload_id: upload.id, inserted: txRows.length, skipped, review_needed: reviewCount })
    send('complete', 'done', { inserted: txRows.length, skipped, review_needed: reviewCount, warnings: validation.warnings })
 
  } catch (err) {
    send('error', 'error', { message: err.message })
  }
 
  res.end()
}