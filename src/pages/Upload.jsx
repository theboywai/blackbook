import { useState, useRef } from 'react'
import { fetchOwnAccounts } from '@/data/accounts'
import { useEffect } from 'react'
import Card from '@/components/Card'

const STEPS = [
  { key: 'extract',    label: 'Extracting transactions' },
  { key: 'validate',   label: 'Validating & reconciling' },
  { key: 'categorize', label: 'Categorizing with Gemini' },
  { key: 'insert',     label: 'Saving to database' },
]

export default function Upload({ onUploaded }) {
  const [accounts, setAccounts]     = useState([])
  const [accountId, setAccountId]   = useState('')
  const [file, setFile]             = useState(null)
  const [steps, setSteps]           = useState({})   // { extract: 'running'|'done'|'error', ... }
  const [result, setResult]         = useState(null)
  const [error, setError]           = useState(null)
  const [uploading, setUploading]   = useState(false)
  const fileRef                     = useRef(null)

  useEffect(() => {
    fetchOwnAccounts().then(accs => {
      setAccounts(accs)
      if (accs.length === 1) setAccountId(accs[0].id)
    })
  }, [])

  function handleFile(e) {
    const f = e.target.files?.[0]
    if (f && f.type === 'application/pdf') setFile(f)
    else setFile(null)
  }

  async function handleUpload() {
    if (!file || !accountId) return
    setUploading(true)
    setSteps({})
    setResult(null)
    setError(null)

    const formData = new FormData()
    formData.append('pdf', file)
    formData.append('account_id', accountId)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Parse SSE events from buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))

            if (event.step === 'complete') {
              setResult(event)
              onUploaded?.()
            } else if (event.step === 'error') {
              setError(event.message)
            } else {
              setSteps(prev => ({ ...prev, [event.step]: event.status }))
            }
          } catch {}
        }
      }
    } catch (e) {
      setError('Network error: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  function reset() {
    setFile(null)
    setSteps({})
    setResult(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const canUpload  = file && accountId && !uploading
  const isComplete = result !== null

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.period}>PDF PHASE</div>
        <div style={s.title}>Upload Statement</div>
      </div>

      {/* Upload form */}
      {!isComplete && (
        <Card>
          <div style={s.form}>

            {/* Account select */}
            <div style={s.field}>
              <div style={s.fieldLabel}>ACCOUNT</div>
              <div style={s.accountGrid}>
                {accounts.map(acc => (
                  <button
                    key={acc.id}
                    style={{
                      ...s.accountBtn,
                      borderColor: accountId === acc.id ? 'var(--amber)' : 'var(--border2)',
                      background:  accountId === acc.id ? 'var(--amber-bg)' : 'var(--bg3)',
                    }}
                    onClick={() => setAccountId(acc.id)}
                    disabled={uploading}
                  >
                    <div style={{ ...s.accountBank, color: accountId === acc.id ? 'var(--amber)' : 'var(--text)' }}>
                      {acc.bank?.toUpperCase()}
                    </div>
                    <div style={s.accountNo}>XX{acc.account_no}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* File picker */}
            <div style={s.field}>
              <div style={s.fieldLabel}>STATEMENT PDF</div>
              <label style={{ ...s.fileLabel, borderColor: file ? 'var(--amber)' : 'var(--border2)', background: file ? 'var(--amber-bg)' : 'var(--bg3)' }}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  style={{ display: 'none' }}
                  onChange={handleFile}
                  disabled={uploading}
                />
                <span style={s.fileIcon}>{file ? '📄' : '+'}</span>
                <div>
                  <div style={{ ...s.fileName, color: file ? 'var(--text)' : 'var(--text3)' }}>
                    {file ? file.name : 'Tap to select PDF'}
                  </div>
                  {file && (
                    <div style={s.fileSize}>{(file.size / 1024).toFixed(0)} KB</div>
                  )}
                </div>
              </label>
            </div>

            {/* Upload button */}
            <button
              style={{ ...s.uploadBtn, opacity: canUpload ? 1 : 0.4 }}
              onClick={handleUpload}
              disabled={!canUpload}
            >
              {uploading ? 'Processing...' : 'Upload & Process'}
            </button>
          </div>
        </Card>
      )}

      {/* Step progress */}
      {(uploading || Object.keys(steps).length > 0) && !isComplete && (
        <Card>
          <div style={s.stepList}>
            {STEPS.map((step, i) => {
              const status = steps[step.key]
              const isPending = !status
              const isRunning = status === 'running'
              const isDone    = status === 'done'
              const isError   = status === 'error'

              return (
                <div key={step.key} style={s.stepRow}>
                  <div style={{
                    ...s.stepIcon,
                    color: isError ? 'var(--red)' : isDone ? 'var(--green)' : isRunning ? 'var(--amber)' : 'var(--text3)'
                  }}>
                    {isError ? '✕' : isDone ? '✓' : isRunning ? '◌' : `${i+1}`}
                  </div>
                  <div style={s.stepInfo}>
                    <div style={{
                      ...s.stepLabel,
                      color: isPending ? 'var(--text3)' : isError ? 'var(--red)' : 'var(--text)'
                    }}>
                      {step.label}
                    </div>
                    {isRunning && <div style={s.stepSub}>Running...</div>}
                    {isDone && step.key === 'extract' && steps.extract === 'done' && (
                      <div style={s.stepSub}>✓ Extracted</div>
                    )}
                  </div>
                  {isRunning && <div style={s.spinner} />}
                </div>
              )
            })}
          </div>
          {error && (
            <div style={s.errorBox}>
              <span style={{ color: 'var(--red)', fontWeight: 700 }}>✕ Failed:</span> {error}
            </div>
          )}
        </Card>
      )}

      {/* Success result */}
      {isComplete && (
        <Card>
          <div style={s.successHeader}>
            <div style={s.successIcon}>✓</div>
            <div>
              <div style={s.successTitle}>Upload complete</div>
              <div style={s.successSub}>Transactions saved to database</div>
            </div>
          </div>

          <div style={s.resultGrid}>
            <div style={s.resultStat}>
              <div style={s.resultVal}>{result.inserted}</div>
              <div style={s.resultLabel}>INSERTED</div>
            </div>
            <div style={s.resultStat}>
              <div style={{ ...s.resultVal, color: result.review_needed > 0 ? 'var(--amber)' : 'var(--green)' }}>
                {result.review_needed}
              </div>
              <div style={s.resultLabel}>NEED REVIEW</div>
            </div>
          </div>

          {result.warnings?.length > 0 && (
            <div style={s.warnings}>
              <div style={s.warningsLabel}>WARNINGS</div>
              {result.warnings.map((w, i) => (
                <div key={i} style={s.warningRow}>⚠ {w}</div>
              ))}
            </div>
          )}

          {result.review_needed > 0 && (
            <div style={s.reviewHint}>
              Go to the Review tab to categorize {result.review_needed} uncategorized transaction{result.review_needed > 1 ? 's' : ''}.
            </div>
          )}

          <button style={s.resetBtn} onClick={reset}>Upload another</button>
        </Card>
      )}
    </div>
  )
}

const s = {
  page:         { display: 'flex', flexDirection: 'column', gap: '14px' },
  header:       { marginBottom: '4px' },
  period:       { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text2)', letterSpacing: '0.12em', marginBottom: '4px' },
  title:        { fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' },

  form:         { display: 'flex', flexDirection: 'column', gap: '20px' },
  field:        { display: 'flex', flexDirection: 'column', gap: '8px' },
  fieldLabel:   { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', color: 'var(--text3)' },

  accountGrid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' },
  accountBtn:   { padding: '14px 16px', borderRadius: 'var(--radius)', border: '1px solid', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' },
  accountBank:  { fontSize: '14px', fontWeight: 800, letterSpacing: '0.05em', marginBottom: '3px' },
  accountNo:    { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' },

  fileLabel:    { display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', borderRadius: 'var(--radius)', border: '1px dashed', cursor: 'pointer', transition: 'all 0.15s' },
  fileIcon:     { fontSize: '24px', flexShrink: 0 },
  fileName:     { fontSize: '13px', fontWeight: 600, wordBreak: 'break-all' },
  fileSize:     { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', marginTop: '3px' },

  uploadBtn:    { background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', padding: '14px', borderRadius: 'var(--radius)', transition: 'opacity 0.15s' },

  stepList:     { display: 'flex', flexDirection: 'column', gap: '16px' },
  stepRow:      { display: 'flex', alignItems: 'center', gap: '14px' },
  stepIcon:     { fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, width: '20px', textAlign: 'center', flexShrink: 0 },
  stepInfo:     { flex: 1 },
  stepLabel:    { fontSize: '13px', fontWeight: 600, marginBottom: '2px' },
  stepSub:      { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' },
  spinner:      { width: '14px', height: '14px', borderRadius: '50%', border: '2px solid var(--border2)', borderTopColor: 'var(--amber)', animation: 'spin 0.8s linear infinite', flexShrink: 0 },

  errorBox:     { marginTop: '16px', padding: '12px 14px', background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)' },

  successHeader: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' },
  successIcon:   { width: '40px', height: '40px', borderRadius: '50%', background: 'var(--green-bg)', border: '1px solid var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)', fontSize: '18px', fontWeight: 700, flexShrink: 0 },
  successTitle:  { fontSize: '16px', fontWeight: 800, marginBottom: '3px' },
  successSub:    { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' },

  resultGrid:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' },
  resultStat:   { background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '14px', textAlign: 'center' },
  resultVal:    { fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 500, marginBottom: '4px' },
  resultLabel:  { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', letterSpacing: '0.12em' },

  warnings:     { background: 'var(--amber-bg)', border: '1px solid var(--amber-dim)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: '16px' },
  warningsLabel: { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--amber)', letterSpacing: '0.12em', marginBottom: '8px' },
  warningRow:   { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)', marginBottom: '4px' },

  reviewHint:   { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--amber)', marginBottom: '16px' },
  resetBtn:     { background: 'none', border: '1px solid var(--border2)', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.1em', padding: '10px 20px', borderRadius: 'var(--radius-sm)', width: '100%' },
}