import { useState, useEffect, useCallback } from 'react'
import { fetchTrips } from '@/data/trips'

export function useTrips() {
  const [trips, setTrips]   = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchTrips()
      setTrips(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { trips, loading, refresh: load }
}