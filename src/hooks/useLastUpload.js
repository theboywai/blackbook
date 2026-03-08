import { useState, useEffect } from 'react'
import { fetchLastUpload } from '@/data/uploads'

export function useLastUpload() {
  const [upload, setUpload]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLastUpload().then(data => {
      setUpload(data)
      setLoading(false)
    })
  }, [])

  // How many days since last upload
  const daysSince = upload
    ? Math.floor((Date.now() - new Date(upload.uploaded_at)) / 86400000)
    : null

  // Urgency: ok < 3 days, warning 3-6, overdue 7+
  const urgency = daysSince === null ? null
    : daysSince < 3  ? 'ok'
    : daysSince < 7  ? 'warning'
    : 'overdue'

  const label = daysSince === null ? null
    : daysSince === 0 ? 'today'
    : daysSince === 1 ? 'yesterday'
    : `${daysSince} days ago`

  return { upload, loading, daysSince, urgency, label }
}