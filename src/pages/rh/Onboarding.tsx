import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import Topbar from '../../components/Topbar'
import type { Onboarding as OnboardingType, OnboardingItem, OnboardingTipo, Regime, Vaga } from '../../types'
import {
  EMPRESA_OPTIONS, ONBOARDING_CHECKLIST_TEMPLATES, ONBOARDING_TIPO_LABEL, regimeToOnboardingTipo,
} from '../../types'

type FilterTipo = OnboardingTipo | 'todos'

export default function Onboarding() {
  const [items, setItems] = useState<OnboardingType[]>([])
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState<FilterTipo>('todos')

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, 'onboarding')), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<OnboardingType, 'id'>) }))
      list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
      setItems(list)
      setLoading(false)
    }, () => setLoading(false))
    const u2 = onSnapshot(query(collection(db, 'vagas')), (s) => {
      setVagas(s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Vaga, 'id'>) })))
    })
    return () => { u1(); u2() }
  }, [])

  const filtered = useMemo(() => {
    if (filtroTipo === 'todos') return items
    return items.filter(i => (i.tipo || regimeToOnboardingTipo((i.regime as Regime) ?? 'CLT')) === filtroTipo)
  }, [items, filtroTipo])

  const stats = useMemo(() => {
    const total = items.length
    const concluidos = items.filter(i => i.status === 'concluido').length
    const emAnd = items.filter(i => i.status === 'em_andamento').length
    return { total, concluidos, emAnd }
  }, [items])

  async function excluir(o: OnboardingType) {
    const txt = `Excluir o onboarding de "${o.candidatoNome}"?\n\nEssa ação é permanente.`
    if (!confirm(txt)) return
    try {
      await deleteDoc(doc(db, 'onboarding', o.id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao excluir onboarding.')
    }
  }

  return (
    <>
      <Topbar
        title="Onboarding"
        icon="⚑"
        actions={<button className="tbtn pri" onClick={() => setOpenModal(true)}>＋ Novo onboarding</button>}
      />
      <div className="content">
        <div className="smrow">
          <div className="sm">
            <div className="sm-lbl">Total</div>
            <div className="sm-val">{stats.total}</div>
          </div>
          <div className="sm">
            <div className="sm-lbl">Em andamento</div>
            <div className="sm-val" style={{ color: 'var(--warn)' }}>{stats.emAnd}</div>
          </div>
          <div className="sm">
            <div className="sm-lbl">Concluídos</div>
            <div className="sm-val" style={{ color: 'var(--ok)' }}>{stats.concluidos}</div>
          </div>
        </div>

        <div className="panel">
          <div className="filter-bar">
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as FilterTipo)}>
              <option value="todos">Todos os tipos</option>
              <option value="CLT">CLT</option>
              <option value="PJ">PJ</option>
              <option value="ESTAGIO">Estágio</option>
              <option value="FREELANCER">Freelancer</option>
            </select>
          </div>
          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">⚑</div>
              <div className="empty-ttl">Nenhum onboarding</div>
              <div className="empty-sub">Aprove um candidato para criar um onboarding automaticamente.</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Candidato</th>
                  <th>Vaga</th>
                  <th>Tipo</th>
                  <th>Empresa</th>
                  <th>Status</th>
                  <th>Progresso</th>
                  <th style={{ width: 140 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const done = (o.checklist || []).filter(c => c.done).length
                  const total = (o.checklist || []).length
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0
                  const tipo = o.tipo || regimeToOnboardingTipo((o.regime as Regime) ?? 'CLT')
                  return (
                    <tr key={o.id}>
                      <td><div className="tdm">{o.candidatoNome}</div></td>
                      <td style={{ fontSize: 12 }}>{o.vagaCargo}</td>
                      <td><span className="bdg info">{ONBOARDING_TIPO_LABEL[tipo]}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--mut)' }}>{o.empresa}</td>
                      <td>
                        <span className={`bdg ${o.status === 'concluido' ? 'ok' : o.status === 'em_andamento' ? 'warn' : 'gray'}`}>
                          {o.status === 'concluido' ? 'Concluído' : o.status === 'em_andamento' ? 'Em andamento' : 'Pendente'}
                        </span>
                      </td>
                      <td>
                        <span className="scbar" style={{ width: 80 }}>
                          <span className="scfill" style={{ width: `${pct}%` }} />
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 4 }}>{done}/{total}</span>
                      </td>
                      <td>
                        <div className="hstack" style={{ gap: 6, justifyContent: 'flex-end' }}>
                          <Link to={`/rh/onboarding/${o.id}`} className="tbtn" style={{ height: 26 }}>Abrir →</Link>
                          <button
                            type="button"
                            className="tbtn"
                            onClick={() => excluir(o)}
                            title="Excluir onboarding"
                            style={{ height: 26, color: 'var(--bad)', borderColor: 'var(--bad-bd)' }}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {openModal && (
        <NovoOnboardingModal vagas={vagas} onClose={() => setOpenModal(false)} />
      )}
    </>
  )
}

// Modal manual (uso raro — o caminho normal é via aprovação do candidato).
function NovoOnboardingModal({ vagas, onClose }: { vagas: Vaga[]; onClose: () => void }) {
  const [candidatoNome, setCandidatoNome] = useState('')
  const [vagaId, setVagaId] = useState(vagas[0]?.id || '')
  const [empresa, setEmpresa] = useState('')
  const [tipo, setTipo] = useState<OnboardingTipo>('CLT')
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 14)
    return d.toISOString().slice(0, 10)
  })
  const [dataTermino, setDataTermino] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Quando troca a vaga, sugere tipo + empresa baseados na vaga.
  useEffect(() => {
    const vaga = vagas.find(v => v.id === vagaId)
    if (vaga) {
      setTipo(regimeToOnboardingTipo(vaga.regime as Regime))
      if (!empresa) setEmpresa(vaga.empresa || '')
    }
  }, [vagaId, vagas, empresa])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      const vaga = vagas.find(v => v.id === vagaId)
      if (!vaga) throw new Error('Selecione uma vaga.')
      const checklist: OnboardingItem[] = ONBOARDING_CHECKLIST_TEMPLATES[tipo].map((titulo, i) => ({
        id: `item-${Date.now()}-${i}`, titulo, done: false,
      }))
      const inicioTs = Timestamp.fromDate(new Date(dataInicio + 'T00:00:00'))
      let terminoTs: Timestamp | null = null
      if (tipo === 'ESTAGIO' && dataTermino) {
        terminoTs = Timestamp.fromDate(new Date(dataTermino + 'T00:00:00'))
      }
      await addDoc(collection(db, 'onboarding'), {
        candidatoId: '',
        candidatoNome,
        vagaId,
        vagaCargo: vaga.cargo,
        empresa: empresa || vaga.empresa,
        tipo,
        regime: vaga.regime,
        dataPrevistaInicio: inicioTs,
        ...(terminoTs ? { dataPrevistaTermino: terminoTs } : {}),
        status: 'pendente',
        checklist,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      onClose()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Novo onboarding</h2>
        <p>Crie manualmente um checklist de integração. O fluxo padrão é via aprovação do candidato.</p>
        <form onSubmit={handleSubmit} className="row-gap-14">
          {err && <div className="error-text">{err}</div>}
          <div className="field"><label>Nome do candidato *</label>
            <input value={candidatoNome} onChange={(e) => setCandidatoNome(e.target.value)} required />
          </div>
          <div className="field">
            <label>Vaga *</label>
            <select value={vagaId} onChange={(e) => setVagaId(e.target.value)} required>
              {vagas.map(v => <option key={v.id} value={v.id}>{v.cargo} · {v.time}</option>)}
            </select>
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Tipo de contrato *</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as OnboardingTipo)}>
                <option value="CLT">CLT</option>
                <option value="PJ">PJ</option>
                <option value="ESTAGIO">Estágio</option>
                <option value="FREELANCER">Freelancer</option>
              </select>
            </div>
            <div className="field">
              <label>Empresa</label>
              <select value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
                <option value="">— selecione —</option>
                {EMPRESA_OPTIONS.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                {empresa && !(EMPRESA_OPTIONS as readonly string[]).includes(empresa) && (
                  <option value={empresa}>{empresa} (legado)</option>
                )}
              </select>
            </div>
            <div className="field">
              <label>Data prevista de início *</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required />
            </div>
            {tipo === 'ESTAGIO' && (
              <div className="field">
                <label>Data prevista de término</label>
                <input type="date" value={dataTermino} onChange={(e) => setDataTermino(e.target.value)} />
              </div>
            )}
          </div>
          <div className="hstack" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando…' : 'Criar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
