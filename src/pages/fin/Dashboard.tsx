import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query } from 'firebase/firestore'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import { db } from '../../firebase'
import Topbar from '../../components/Topbar'
import KpiCard from '../../components/KpiCard'
import type { NotaIfood, Pagamento } from '../../types'
import { PAGAMENTO_CAT_LABEL } from '../../types'

const COLORS = ['#066E3E', '#3BE476', '#8DF768', '#C5F07A', '#F0EE7A', '#A0E3F3', '#F5B3D8']

function brl(n?: number | null) {
  if (typeof n !== 'number') return 'R$ 0,00'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function FinDashboard() {
  const [notas, setNotas] = useState<NotaIfood[]>([])
  const [pags, setPags] = useState<Pagamento[]>([])

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, 'notas_ifood')), (s) => {
      setNotas(s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<NotaIfood, 'id'>) })))
    })
    const u2 = onSnapshot(query(collection(db, 'pagamentos')), (s) => {
      setPags(s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Pagamento, 'id'>) })))
    })
    return () => { u1(); u2() }
  }, [])

  const kpis = useMemo(() => {
    const totalIfood = notas.reduce((a, n) => a + (n.valor || 0), 0)
    const totalPags = pags.reduce((a, p) => a + (p.valor || 0), 0)
    const pendIfood = notas.filter(n => n.status === 'pendente').reduce((a, p) => a + p.valor, 0)
    const pendPags = pags.filter(p => p.status === 'pendente').reduce((a, p) => a + p.valor, 0)
    return { totalIfood, totalPags, pendIfood, pendPags, totalGeral: totalIfood + totalPags }
  }, [notas, pags])

  // último 6 meses
  const porMes = useMemo(() => {
    const map = new Map<string, { mes: string, ifood: number, outros: number }>()
    const base = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
      const key = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      map.set(key, { mes: key, ifood: 0, outros: 0 })
    }
    const keyOf = (ts?: { toDate: () => Date } | null) => {
      const d = ts?.toDate?.()
      if (!d) return null
      return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
    }
    notas.forEach(n => { const k = keyOf(n.data); if (k && map.has(k)) map.get(k)!.ifood += n.valor })
    pags.forEach(p => { const k = keyOf(p.data); if (k && map.has(k)) map.get(k)!.outros += p.valor })
    return [...map.values()]
  }, [notas, pags])

  const porCategoria = useMemo(() => {
    const map = new Map<string, number>()
    pags.forEach(p => map.set(PAGAMENTO_CAT_LABEL[p.categoria], (map.get(PAGAMENTO_CAT_LABEL[p.categoria]) ?? 0) + p.valor))
    return [...map.entries()].map(([name, value]) => ({ name, value }))
  }, [pags])

  return (
    <>
      <Topbar title="Dashboard Financeiro" icon="◈" />
      <div className="content">
        <div className="krow k4">
          <KpiCard label="Total iFood" value={brl(kpis.totalIfood)} icon="◆" tone="g" meta={`${notas.length} notas`} />
          <KpiCard label="Outros pagamentos" value={brl(kpis.totalPags)} icon="◱" tone="b" meta={`${pags.length} itens`} />
          <KpiCard label="Pendente (geral)" value={brl(kpis.pendIfood + kpis.pendPags)} icon="⧗" tone="a" meta="Aguardando pagamento" />
          <KpiCard label="Total geral" value={brl(kpis.totalGeral)} icon="R$" tone="p" />
        </div>

        <div className="body-grid bg-2">
          <div className="panel">
            <div className="ph">
              <div className="pt"><span className="pdot" style={{ background: 'var(--g600)' }} />Despesas por mês (últimos 6 meses)</div>
            </div>
            {notas.length + pags.length === 0 ? (
              <div className="empty-sub">Sem dados.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={porMes} margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="mes" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v) => brl(v as number)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="ifood" name="iFood" fill="#066E3E" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outros" name="Outros" fill="#8DF768" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="panel">
            <div className="ph">
              <div className="pt"><span className="pdot" style={{ background: 'var(--info)' }} />Outros pagamentos por categoria</div>
            </div>
            {porCategoria.length === 0 ? (
              <div className="empty-sub">Sem dados.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={porCategoria} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} paddingAngle={2}>
                    {porCategoria.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => brl(v as number)} />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
