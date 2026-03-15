import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient }       from '@supabase/supabase-js'
import { createHash }         from 'crypto'
import { readFileSync }       from 'fs'
import { join, dirname }      from 'path'
import { fileURLToPath }      from 'url'
import {
  stripMarkdown, extractUPIHandle, extractUPIMerchantRaw,
  extractUPINote, validate, parseMultipart
} from './pipeline-helpers.mjs'

export const config = { api: { bodyParser: false } }

const __dirname         = dirname(fileURLToPath(import.meta.url))
const EXTRACT_PROMPT    = readFileSync(join(__dirname, 'prompts/extract.txt'), 'utf8')
const CATEGORIZE_PROMPT = readFileSync(join(__dirname, 'prompts/categorize.txt'), 'utf8')
const PARSER_VERSION    = 'gemini-2.0-flash-001'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const GEMINI_KEY = process.env.GEMINI_API_KEY
  const SUPA_URL   = process.env.SUPABASE_URL
  const SUPA_KEY   = process.env.SUPABASE_SERVICE_KEY
  if (!GEMINI_KEY || !SUPA_URL || !SUPA_KEY)
    return res.status(500).json({ error: 'Missing server env vars' })

  const genAI    = new GoogleGenerativeAI(GEMINI_KEY)
  const supabase = createClient(SUPA_URL, SUPA_KEY)

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
    const model      = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
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
        categoryId = categoryMap['self transfer'] || null
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

    send('insert', 'done', { upload_id: upload.id, inserted: txRows.length, skipped, review_needed: reviewCount })
    send('complete', 'done', { inserted: txRows.length, skipped, review_needed: reviewCount, warnings: validation.warnings })

  } catch (err) {
    send('error', 'error', { message: err.message })
  }

  res.end()
}