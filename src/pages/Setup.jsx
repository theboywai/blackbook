import { useState } from 'react'
import { createAccount } from '@/data/accounts'
import { seedBudgets }   from '@/data/budgets'

const ACCOUNT_TYPES = ['savings', 'current', 'credit_card']

const EMPTY = { name: '', bank: '', account_no: '', type: 'savings', holder_name: '' }

export default function Setup({ onComplete }) {
  const [accounts, setAccounts] = useState([{ ...EMPTY }])
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)

  function updateAccount(i, field, value) {
    setAccounts(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a))
  }

  function addAccount() {
    setAccounts(prev => [...prev, { ...EMPTY }])
  }

  function removeAccount(i) {
    setAccounts(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleComplete() {
    // Validate
    for (const acc of accounts) {
      if (!acc.bank.trim() || !acc.account_no.trim() || !acc.holder_name.trim()) {
        setError('Please fill in all fields for each account.')
        return
      }
    }

    setSaving(true)
    setError(null)
    try {
      // Create all accounts + seed budgets in parallel
      await Promise.all([
        ...accounts.map(acc => createAccount({
          name:        `${acc.bank.toUpperCase()} ${acc.account_no}`,
          bank:        acc.bank,
          account_no:  acc.account_no,
          type:        acc.type,
          holder_name: acc.holder_name,
        })),
        seedBudgets(),
      ])
      onComplete()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}><span style={{ color: 'var(--amber)' }}>▪</span> BLACKBOOK</div>
        <div style={s.title}>Set up your accounts</div>
        <div style={s.sub}>Add the bank accounts you want to track. You can add more later in Settings.</div>

        <div style={s.accountList}>
          {accounts.map((acc, i) => (
            <div key={i} style={s.accountBlock}>
              <div style={s.blockHeader}>
                <span style={s.blockNum}>ACCOUNT {i + 1}</span>
                {accounts.length > 1 && (
                  <button style={s.removeBtn} onClick={() => removeAccount(i)}>Remove</button>
                )}
              </div>

              <div style={s.fields}>
                <div style={s.field}>
                  <label style={s.label}>YOUR NAME</label>
                  <input
                    style={s.input}
                    placeholder="e.g. AKSHANSH PANDEY"
                    value={acc.holder_name}
                    onChange={e => updateAccount(i, 'holder_name', e.target.value)}
                  />
                </div>

                <div style={s.twoCol}>
                  <div style={s.field}>
                    <label style={s.label}>BANK</label>
                    <input
                      style={s.input}
                      placeholder="e.g. KOTAK"
                      value={acc.bank}
                      onChange={e => updateAccount(i, 'bank', e.target.value)}
                    />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>LAST 4 DIGITS</label>
                    <input
                      style={s.input}
                      placeholder="e.g. 0956"
                      maxLength={4}
                      value={acc.account_no}
                      onChange={e => updateAccount(i, 'account_no', e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>

                <div style={s.field}>
                  <label style={s.label}>ACCOUNT TYPE</label>
                  <div style={s.typeRow}>
                    {ACCOUNT_TYPES.map(t => (
                      <button
                        key={t}
                        style={{
                          ...s.typeChip,
                          borderColor: acc.type === t ? 'var(--amber)' : 'var(--border2)',
                          color:       acc.type === t ? 'var(--amber)' : 'var(--text2)',
                          background:  acc.type === t ? 'var(--amber-bg)' : 'transparent',
                        }}
                        onClick={() => updateAccount(i, 'type', t)}
                      >
                        {t === 'credit_card' ? 'CREDIT CARD' : t.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button style={s.addBtn} onClick={addAccount}>
          + Add another account
        </button>

        {error && <div style={s.error}>{error}</div>}

        <button
          style={{ ...s.doneBtn, opacity: saving ? 0.5 : 1 }}
          onClick={handleComplete}
          disabled={saving}
        >
          {saving ? 'Setting up...' : 'GET STARTED →'}
        </button>

        <div style={s.hint}>
          Default budgets will be created automatically. You can change them in Settings.
        </div>
      </div>
    </div>
  )
}

const s = {
  page:        { minHeight: '100dvh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 24px' },
  card:        { width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '0' },
  logo:        { fontWeight: 800, fontSize: '16px', letterSpacing: '0.15em', marginBottom: '24px' },
  title:       { fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '8px' },
  sub:         { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)', lineHeight: 1.6, marginBottom: '28px' },

  accountList: { display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '12px' },
  accountBlock:{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px' },
  blockHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
  blockNum:    { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', color: 'var(--text3)' },
  removeBtn:   { background: 'none', color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.08em' },

  fields:      { display: 'flex', flexDirection: 'column', gap: '14px' },
  field:       { display: 'flex', flexDirection: 'column', gap: '6px' },
  twoCol:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  label:       { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', color: 'var(--text3)' },
  input:       { background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', color: 'var(--text)', fontSize: '13px' },

  typeRow:     { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  typeChip:    { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.08em', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid', cursor: 'pointer', transition: 'all 0.15s' },

  addBtn:      { background: 'none', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', padding: '8px 0', marginBottom: '20px', textAlign: 'left' },
  error:       { color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: '11px', marginBottom: '12px' },
  doneBtn:     { background: 'var(--amber)', color: '#000', fontWeight: 700, fontSize: '12px', letterSpacing: '0.1em', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', transition: 'opacity 0.15s' },
  hint:        { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', textAlign: 'center', lineHeight: 1.6 },
}