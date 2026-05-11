import type { ReactNode } from 'react'

type KpiTone = 'g' | 'b' | 'a' | 'r' | 'p'

interface KpiCardProps {
  label: string
  value: ReactNode
  icon?: string
  tone?: KpiTone
  trend?: { direction: 'up' | 'down' | 'flat'; text: string }
  meta?: string
}

export default function KpiCard({ label, value, icon, tone = 'g', trend, meta }: KpiCardProps) {
  return (
    <div className={`kc ${tone}`}>
      {icon && <div className="kc-icon">{icon}</div>}
      <div className="kc-lbl">{label}</div>
      <div className="kc-val">{value}</div>
      {trend && (
        <span className={`kc-tr ${trend.direction === 'up' ? 'up' : trend.direction === 'down' ? 'dn' : 'nt'}`}>
          {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '◆'} {trend.text}
        </span>
      )}
      {meta && <div className="kc-meta">{meta}</div>}
    </div>
  )
}
