interface Props {
  label: string
  value: string | number
  trend?: string
  accent?: boolean
}

export default function KpiCard({ label, value, trend, accent }: Props) {
  return (
    <div className={'kpi' + (accent ? ' accent' : '')}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {trend && <div className="trend">{trend}</div>}
    </div>
  )
}
