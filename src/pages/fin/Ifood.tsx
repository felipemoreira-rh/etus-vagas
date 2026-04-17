import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import KpiCard from '../../components/KpiCard'
import type { NotaIfood } from '../../types'

function formatDate(ts?: { toDate: () => Date } | null) {
  if (!ts) return '—'
  try { return ts.toDate().toLocaleDateString('pt-BR') } catch { return '—' }
}

function brl(n?: number | null) {
  if (typeof n !== 'number') return 'R$ 0,00'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function Ifood() {
  const [notas, setNotas] = useState<NotaIfood[]>([])
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(false)
  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState<string>('todos')

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'notas_ifood')), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<NotaIfood, 'id'>) }))
      list.sort((a, b) => (b.data?.toMillis?.() ?? 0) - (a.data?.toMillis?.() ?? 0))
      setNotas(list)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  const filtered = useMemo(() => {
    return notas.filter(n => {
      if (statusF !== 'todos' && n.status !== statusF) return false
      if (search) {
        const s = search.toLowerCase()
        if (!n.colaboradorNome.toLowerCase().includes(s) && !n.restaurante.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [notas, search, statusF])

  const kpis = useMemo(() => {
    const now = new Date()
    const ym = now.getFullYear() + '-' + (now.getMonth() + 1)
    const mes = notas.filter(n => {
      const d = n.data?.toDate?.()
      return d && `${d.getFullYear()}-${d.getMonth() + 1}` === ym
    })
    const total = mes.reduce((acc, n) => acc + (n.valor || 0), 0)
    const pend = notas.filter(n => n.status === 'pendente').length
    const pagos = notas.filter(n => n.status === 'pago').length
    return { total, pend, pagos, qtdMes: mes.length }
  }, [notas])

  async function updateStatus(id: string, status: NotaIfood['status']) {
    await updateDoc(doc(db, 'notas_ifood', id), { status, updatedAt: serverTimestamp() })
  }

  return (
    <>
      <Topbar
        title="Notas iFood"
        icon="◆"
        actions={<button className="tbtn pri" onClick={() => setOpenModal(true)}>＋ Nova nota</button>}
      />
      <div className="content">
        <div className="krow k4">
          <KpiCard label="Total do mês" value={brl(kpis.total)} icon="R$" tone="g" meta={`${kpis.qtdMes} notas`} />
          <KpiCard label="Notas pendentes" value={kpis.pend} icon="⧗" tone={kpis.pend > 0 ? 'a' : 'g'} />
          <KpiCard label="Pagas" value={kpis.pagos} icon="✓" tone="b" />
          <KpiCard label="Total geral" value={notas.length} icon="◱" tone="p" meta="Histórico" />
        </div>

        <div className="panel">
          <div className="filter-bar">
            <div className="swrap">
              <span className="sico">⌕</span>
              <input className="srch" placeholder="Buscar por colaborador ou restaurante…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select value={statusF} onChange={(e) => setStatusF(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="aprovado">Aprovado</option>
              <option value="pago">Pago</option>
              <option value="rejeitado">Rejeitado</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">◆</div>
              <div className="empty-ttl">Nenhuma nota</div>
              <div className="empty-sub">Cadastre notas do iFood para acompanhar.</div>
            </div>
          ) : (
            <div className="panel-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Colaborador</th>
                    <th>Restaurante</th>
                    <th>Área</th>
                    <th>Empresa</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                    <th>Status</th>
                    <th style={{ width: 120 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(n => (
                    <tr key={n.id}>
                      <td style={{ fontSize: 11, color: 'var(--mut)' }}>{formatDate(n.data)}</td>
                      <td><div className="tdm">{n.colaboradorNome}</div></td>
                      <td style={{ fontSize: 12 }}>{n.restaurante}</td>
                      <td style={{ fontSize: 12, color: 'var(--mut)' }}>{n.area || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--mut)' }}>{n.empresa || '—'}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--ff)', fontWeight: 700 }}>{brl(n.valor)}</td>
                      <td>
                        <span className={`bdg ${
                          n.status === 'pago' ? 'ok' :
                          n.status === 'aprovado' ? 'info' :
                          n.status === 'rejeitado' ? 'bad' : 'warn'
                        }`}>
                          {n.status === 'pago' ? 'Pago' :
                           n.status === 'aprovado' ? 'Aprovado' :
                           n.status === 'rejeitado' ? 'Rejeitado' : 'Pendente'}
                        </span>
                      </td>
                      <td>
                        <select
                          value={n.status}
                          onChange={(e) => updateStatus(n.id, e.target.value as NotaIfood['status'])}
                          style={{ fontSize: 11, padding: '3px 6px' }}
                        >
                          <option value="pendente">Pendente</option>
                          <option value="aprovado">Aprovado</option>
                          <option value="pago">Pago</option>
                          <option value="rejeitado">Rejeitado</option>
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

      {openModal && <NovaNotaModal onClose={() => setOpenModal(false)} />}
    </>
  )
}

function NovaNotaModal({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth()
  const [data, setData] = useState<string>(new Date().toISOString().slice(0, 10))
  const [restaurante, setRestaurante] = useState('')
  const [colaboradorNome, setColaboradorNome] = useState('')
  const [area, setArea] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [valor, setValor] = useState<number | ''>('')
  const [descricao, setDescricao] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'notas_ifood'), {
        data: new Date(data),
        restaurante, colaboradorNome, area, empresa,
        valor: typeof valor === 'number' ? valor : 0,
        descricao,
        status: 'pendente',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdByUid: profile.uid,
        createdByName: profile.name,
      })
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Nova nota iFood</h2>
        <form onSubmit={handleSubmit} className="row-gap-14">
          <div className="form-grid">
            <div className="field"><label>Data *</label><input type="date" value={data} onChange={(e) => setData(e.target.value)} required /></div>
            <div className="field"><label>Valor (R$) *</label><input type="number" min={0} step={0.01} value={valor} onChange={(e) => setValor(e.target.value === '' ? '' : Number(e.target.value))} required /></div>
            <div className="field"><label>Colaborador *</label><input value={colaboradorNome} onChange={(e) => setColaboradorNome(e.target.value)} required /></div>
            <div className="field"><label>Restaurante *</label><input value={restaurante} onChange={(e) => setRestaurante(e.target.value)} required /></div>
            <div className="field"><label>Área</label><input value={area} onChange={(e) => setArea(e.target.value)} /></div>
            <div className="field"><label>Empresa</label><input value={empresa} onChange={(e) => setEmpresa(e.target.value)} /></div>
            <div className="field full"><label>Descrição</label><textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
          </div>
          <div className="hstack" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando…' : 'Cadastrar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
