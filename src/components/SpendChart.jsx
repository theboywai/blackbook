import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { CATEGORY_COLORS } from '@/constants/categories'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: '6px', padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
      <div style={{ color: 'var(--text2)', marginBottom: '4px', fontSize: '10px' }}>{label}</div>
      <div style={{ color: 'var(--text)' }}>₹{Number(payload[0].value).toLocaleString('en-IN')}</div>
    </div>
  )
}

export function CategoryBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} barSize={24} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fill: '#555', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#444', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} tickFormatter={v => '₹' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v)} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
        <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
          {data.map(entry => (
            <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || '#444'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function WeeklyBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} barSize={20} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fill: '#555', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
        <Bar dataKey="amount" radius={[3, 3, 0, 0]} fill="var(--amber)" opacity={0.7}>
          {data.map((entry, i) => (
            <Cell key={i} fill="var(--amber)" opacity={i === data.length - 1 ? 1 : 0.4} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

import { AreaChart, Area, LineChart, Line, ReferenceLine } from 'recharts'

const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN')

const CorpusTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: '8px', padding: '8px 12px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 600, color: 'var(--amber)' }}>{fmt(payload[0].value)}</div>
    </div>
  )
}

export function CorpusChart({ data }) {
  if (!data?.length) return (
    <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text3)' }}>
      Not enough data yet
    </div>
  )

  const min     = Math.min(...data.map(d => d.corpus))
  const max     = Math.max(...data.map(d => d.corpus))
  const isUp    = data[data.length - 1].corpus >= data[0].corpus
  const color   = isUp ? 'var(--green)' : 'var(--red)'
  const change  = data[data.length - 1].corpus - data[0].corpus
  const changePct = data[0].corpus > 0
    ? ((change / data[0].corpus) * 100).toFixed(1)
    : null

  // Format date labels — show day/month
  const formatDate = d => {
    const [, m, day] = d.split('-')
    return `${day}/${m}`
  }

  // Only show a few x-axis labels to avoid crowding
  const tickDates = data.length <= 7
    ? data.map(d => d.date)
    : [data[0].date, data[Math.floor(data.length / 2)].date, data[data.length - 1].date]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '12px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 500, color: 'var(--amber)' }}>
          {fmt(data[data.length - 1].corpus)}
        </div>
        {changePct && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color, fontWeight: 600 }}>
            {change >= 0 ? '▲' : '▼'} {fmt(Math.abs(change))} ({changePct}%)
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="corpusGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={isUp ? '#4caf7d' : '#e05252'} stopOpacity={0.15} />
              <stop offset="95%" stopColor={isUp ? '#4caf7d' : '#e05252'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            ticks={tickDates}
            tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text3)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[min * 0.97, max * 1.03]}
            hide={true}
          />
          <Tooltip content={<CorpusTooltip />} cursor={{ stroke: 'var(--border2)', strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="corpus"
            stroke={color}
            strokeWidth={2}
            fill="url(#corpusGrad)"
            dot={data.length <= 7 ? { fill: color, strokeWidth: 0, r: 3 } : false}
            activeDot={{ fill: color, strokeWidth: 0, r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}