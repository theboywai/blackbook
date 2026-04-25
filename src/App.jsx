import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth }         from '@/hooks/useAuth'
import { useTransactions } from '@/hooks/useTransactions'
import { useBudgets }      from '@/hooks/useBudgets'
import { fetchOwnAccounts } from '@/data/accounts'
import { countUncategorized } from '@/data/transactions'
import { useState, useEffect } from 'react'
import Layout      from '@/components/Layout'
import Login       from '@/pages/Login'
import Setup       from '@/pages/Setup'
import Dashboard   from '@/pages/Dashboard'
import Transactions from '@/pages/Transactions'
import Review      from '@/pages/Review'
import Settings    from '@/pages/Settings'
import Budget      from '@/pages/Budget'
import Upload      from '@/pages/Upload'
import Travel       from '@/pages/Travel'
import Loader      from '@/components/Loader'

function AuthenticatedApp({ onSignOut }) {
  const { txns, loading: txnLoading, refresh } = useTransactions()
  const { budgetMap, loading: budgetLoading }   = useBudgets()
  const [reviewCount, setReviewCount]           = useState(0)
  const [hasAccounts, setHasAccounts]           = useState(null)

  useEffect(() => {
    fetchOwnAccounts()
      .then(accs => setHasAccounts(accs.length > 0))
      .catch(() => setHasAccounts(false))
  }, [])

  useEffect(() => {
    if (!txnLoading) countUncategorized().then(setReviewCount)
  }, [txnLoading, txns])

  const loading = txnLoading || budgetLoading

  if (hasAccounts === null) return <Loader />
  if (!hasAccounts) return <Setup onComplete={() => setHasAccounts(true)} />

  return (
    <Routes>
      <Route element={<Layout onSignOut={onSignOut} reviewCount={reviewCount} />}>
        <Route path="/"             element={<Dashboard    txns={txns} budgetMap={budgetMap} loading={loading} reviewCount={reviewCount} />} />
        <Route path="/transactions" element={<Transactions txns={txns} loading={txnLoading} onUpdated={refresh} />} />
        <Route path="/budget"       element={<Budget       txns={txns} loading={loading} />} />
        <Route path="/upload"       element={<Upload       onUploaded={refresh} />} />
        <Route path="/review"       element={<Review       onCategorized={refresh} />} />
        <Route path="/travel"       element={<Travel />} />
        <Route path="/settings"     element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default function App() {
  const { session, signOut, loading } = useAuth()

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)', letterSpacing: '0.12em' }}>
      BLACKBOOK
    </div>
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/*"     element={session
          ? <AuthenticatedApp onSignOut={signOut} />
          : <Navigate to="/login" />
        } />
      </Routes>
    </BrowserRouter>
  )
}