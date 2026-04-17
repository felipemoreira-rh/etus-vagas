import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import KpiCard from '../../components/KpiCard'
import type { PagamentoCategoria, Pagamento } from '../../types'
import { PAGAMENTO_CAT_LABEL } from '../../types'

function formatDate(ts?: { toDate: () => Date } | null) {
  if (!ts) return '—'
  try { return ts.toDate().toLocaleDateString('pt-BR') } catch { return '—' }
}

function brl(n?: number | null) {
  if (typeof n !== 'number') return 'R$ 0,00'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function OutrosPagamentos() {
  const [items, setItems] = useState<Pagamento[]>([])
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(false)
  const [catF, setCatF] = useState<string>('todas')
  const [statusF, setStatusF] = useState<string>('todos')

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'pagamentos')), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Pagamento, 'id'>) }))
      list.sort((a, b) => (b.data?.toMillis?.() ?? 0) - (a.data?.toMillis?.() ?? 0))
      setItems(list)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  const filtered = useMemo(() => {
    return items.filter(p => {
      if (catF !== 'todas' && p.categoria !== catF) return false
      if (statusF !== 'todos' && p.status !== statusF) return false
      return true
    })
  }, [items, catF, statusF])

  const kpis = useMemo(() => {
    const total = items.reduce((acc, p) => acc + (p.valor || 0), 0)
    const pend = items.filter(i => i.status === 'pendente').length
    const pagos = items.filter(i => i.status === 'pago').length
    const totPend = items.filter(i => i.status === 'pendente').reduce((a, p) => a + p.valor, 0)
    return { total, pend, pagos, totPend }
  }, [items])

  async function updateStatus(id: string, status: Pagamento['status']) {
    await updateDoc(doc(db, 'pagamentos', id), { status, updatedAt: serverTimestamp() })
  }

  return (
    <>
      <Topbar
        title="Outros pagamentos"
        icon="◱"
        actions={<button className="tbtn pri" onClick={() => setOpenModal(true)}>＋ Novo pagamento</button>}
      />
      <div className="content">
        <div className="krow k4">
          <KpiCard label="Total histórico" value={brl(kpis.total)} icon="R$" tone="g" />
          <KpiCard label="Pendentes" value={kpis.pend} icon="⧗" tone={kpis.pend > 0 ? 'a' : 'g'} meta={brl(kpis.totPend)} />
          <KpiCard label="Pagos" value={kpis.pagos} icon="✓" tone="b" />
          <KpiCard label="Total de lançamentos" value={items.length} icon="◱" tone="p" />
        </div>

        <div className="panel">
          <div className="filter-bar">
            <select value={catF} onChange={(e) => setCatF(e.target.value)}>
              <option value="todas">Todas as categorias</option>
              {Object.entries(PAGAMENTO_CAT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select value={statusF} onChange={(e) => setStatusF(e.target.value)}>
              <option value="todos">Todos os status</option>
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
              <div className="empty-ico">◱</div>
              <div className="empty-ttl">Nenhum pagamento</div>
              <div className="empty-sub">Cadastre lançamentos financeiros.</div>
            </div>
          ) : (
            <div className="panel-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Colaborador</th>
                    <th>Empresa</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                    <th>Status</th>
                    <th style={{ width: 120 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontSize: 11, color: 'var(--mut)' }}>{formatDate(p.data)}</td>
                      <td><div className="tdm">{p.descricao}</div></td>
                      <td><span className="bdg gray">{PAGAMENTO_CAT_LABEL[p.categoria]}</span></td>
                      <td style={{ fontSize: 12 }}>{p.colaboradorNome || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--mut)' }}>{p.empresa || '—'}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--ff)', fontWeight: 700 }}>{brl(p.valor)}</td>
                      <td>
                        <span className={`bdg ${
                          p.status === 'pago' ? 'ok' :
                          p.status === 'aprovado' ? 'info' :
                          p.status === 'rejeitado' ? 'bad' : 'warn'
                        }`}>
                          {p.status === 'pago' ? 'Pago' :
                           p.status === 'aprovado' ? 'Aprovado' :
                           p.status === 'rejeitado' ? 'Rejeitado' : 'Pendente'}
                        </span>
                      </td>
                      <td>
                        <select
                          value={p.status}
                          onChange={(e) => updateStatus(p.id, e.target.value as Pagamento['status'])}
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

      {openModal && <NovoPagamentoModal onClose={() => setOpenModal(false)} />}
    </>
  )
}

function NovoPagamentoModal({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth()
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState<PagamentoCategoria>('reembolso')
  const [valor, setValor] = useState<number | ''>('')
  const [colaboradorNome, setColaboradorNome] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [area, setArea] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'pagamentos'), {
        data: new Date(data),
        descricao, categoria,
        valor: typeof valor === 'number' ? valor : 0,
        colaboradorNome, empresa, area,
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
        <h2>Novo pagamento</h2>
        <form onSubmit={handleSubmit} className="row-gap-14">
          <div className="form-grid">
            <div className="field"><label>Data *</label><input type="date" value={data} onChange={(e) => setData(e.target.value)} required /></div>
            <div className="field"><label>Valor (R$) *</label><input type="number" min={0} step={0.01} value={valor} onChange={(e) => setValor(e.target.value === '' ? '' : Number(e.target.value))} required /></div>
            <div className="field full"><label>Descrição *</label><input value={descricao} onChange={(e) => setDescricao(e.target.value)} required /></div>
            <div className="field">
              <label>Categoria *</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value as PagamentoCategoria)}>
                {Object.entries(PAGAMENTO_CAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="field"><label>Colaborador</label><input value={colaboradorNome} onChange={(e) => setColaboradorNome(e.target.value)} /></div>
            <div className="field"><label>Empresa</label><input value={empresa} onChange={(e) => setEmpresa(e.target.value)} /></div>
            <div className="field"><label>Área</label><input value={area} onChange={(e) => setArea(e.target.value)} /></div>
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
