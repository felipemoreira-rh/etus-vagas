import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '../../firebase'
import Topbar from '../../components/Topbar'
import type { Colaborador } from '../../types'

function formatDate(ts?: { toDate: () => Date } | null) {
  if (!ts) return '—'
  try { return ts.toDate().toLocaleDateString('pt-BR') } catch { return '—' }
}

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

type ResultadoExp = 'positivo' | 'negativo' | 'pendente'

export default function PeriodoExperiencia() {
  const [cols, setCols] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'colaboradores'), where('status', '==', 'ativo'))
    const unsub = onSnapshot(q, (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Colaborador, 'id'>) }))
      setCols(list)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  const items = useMemo(() => {
    return cols.map(c => {
      const admissao = c.dataAdmissao?.toDate?.() ?? new Date()
      const dia45 = addDays(admissao, 45)
      const dia90 = addDays(admissao, 90)
      const r45 = c.experiencia?.resultado45 || 'pendente'
      const r90 = c.experiencia?.resultado90 || 'pendente'
      const hoje = new Date()
      const diasDesdeAdmissao = Math.floor((hoje.getTime() - admissao.getTime()) / 86400000)
      return { c, admissao, dia45, dia90, r45, r90, diasDesdeAdmissao }
    }).filter(x => x.diasDesdeAdmissao <= 100 || x.r45 === 'pendente' || x.r90 === 'pendente')
      .sort((a, b) => a.diasDesdeAdmissao - b.diasDesdeAdmissao)
  }, [cols])

  async function setResultado(colId: string, campo: 'resultado45' | 'resultado90', valor: ResultadoExp) {
    const col = cols.find(c => c.id === colId)
    const current = col?.experiencia || {}
    await updateDoc(doc(db, 'colaboradores', colId), {
      experiencia: { ...current, [campo]: valor },
      updatedAt: serverTimestamp(),
    })
  }

  return (
    <>
      <Topbar title="Período de experiência" icon="⧗" />
      <div className="content">
        <div className="notif info">
          Acompanhe os colaboradores nos primeiros 90 dias. Marque o resultado da avaliação de 45 e 90 dias.
        </div>

        <div className="panel">
          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : items.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">⧗</div>
              <div className="empty-ttl">Nenhum colaborador em experiência</div>
              <div className="empty-sub">Colaboradores recém-admitidos aparecerão aqui automaticamente.</div>
            </div>
          ) : (
            <div className="panel-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Cargo / Área</th>
                    <th>Admissão</th>
                    <th>Dias</th>
                    <th>45 dias</th>
                    <th>Resultado 45d</th>
                    <th>90 dias</th>
                    <th>Resultado 90d</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(({ c, dia45, dia90, r45, r90, diasDesdeAdmissao }) => (
                    <tr key={c.id}>
                      <td><div className="tdm">{c.nome}</div></td>
                      <td style={{ fontSize: 12 }}>{c.cargo} · {c.area}</td>
                      <td style={{ fontSize: 11, color: 'var(--mut)' }}>{formatDate(c.dataAdmissao)}</td>
                      <td>
                        <span style={{
                          fontSize: 13, fontWeight: 700,
                          color: diasDesdeAdmissao >= 90 ? 'var(--bad)' : diasDesdeAdmissao >= 45 ? 'var(--warn)' : 'var(--ok)',
                        }}>
                          {diasDesdeAdmissao}d
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--mut)' }}>{dia45.toLocaleDateString('pt-BR')}</td>
                      <td>
                        <select
                          value={r45}
                          onChange={(e) => setResultado(c.id, 'resultado45', e.target.value as ResultadoExp)}
                          style={{ fontSize: 11, padding: '3px 6px' }}
                        >
                          <option value="pendente">Pendente</option>
                          <option value="positivo">Positivo</option>
                          <option value="negativo">Negativo</option>
                        </select>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--mut)' }}>{dia90.toLocaleDateString('pt-BR')}</td>
                      <td>
                        <select
                          value={r90}
                          onChange={(e) => setResultado(c.id, 'resultado90', e.target.value as ResultadoExp)}
                          style={{ fontSize: 11, padding: '3px 6px' }}
                        >
                          <option value="pendente">Pendente</option>
                          <option value="positivo">Positivo</option>
                          <option value="negativo">Negativo</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
