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
        <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill="var(--amber)" opacity={i === data.length - 1 ? 1 : 0.4} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}