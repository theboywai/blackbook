import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useTransactions } from '@/hooks/useTransactions'
import { useBudgets } from '@/hooks/useBudgets'
import { countUncategorized } from '@/data/transactions'
import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Transactions from '@/pages/Transactions'
import Review from '@/pages/Review'
import Settings from '@/pages/Settings'

function AuthenticatedApp({ onSignOut }) {
  const { txns, loading: txnLoading, refresh } = useTransactions()
  const { budgetMap, loading: budgetLoading }   = useBudgets()
  const [reviewCount, setReviewCount]           = useState(0)

  useEffect(() => {
    if (!txnLoading) {
      countUncategorized().then(setReviewCount)
    }
  }, [txnLoading, txns])

  const loading = txnLoading || budgetLoading

  console.log('AuthenticatedApp render:', { txns: txns?.length, budgetMap, loading }) // TEMP

  return (
    <Routes>
      <Route element={<Layout onSignOut={onSignOut} reviewCount={reviewCount} />}>
        <Route path="/"             element={<Dashboard    txns={txns} budgetMap={budgetMap} loading={loading} reviewCount={reviewCount} />} />
        <Route path="/transactions" element={<Transactions txns={txns} loading={txnLoading} />} />
        <Route path="/review"       element={<Review       onCategorized={refresh} />} />
        <Route path="/settings"     element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default function App() {
  const { session, signOut, loading } = useAuth()

  console.log('App render:', { session: !!session, loading }) // TEMP

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