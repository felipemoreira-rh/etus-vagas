import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import Topbar from '../../components/Topbar'
import type { Onboarding as OnboardingType, OnboardingItem, Vaga } from '../../types'

const DEFAULT_CHECKLIST: Omit<OnboardingItem, 'id'>[] = [
  { titulo: 'Documentos admissionais recebidos', done: false },
  { titulo: 'Cadastro no sistema de RH', done: false },
  { titulo: 'Criação de e-mail corporativo', done: false },
  { titulo: 'Acesso às ferramentas internas', done: false },
  { titulo: 'Entrega de equipamentos', done: false },
  { titulo: 'Apresentação ao time', done: false },
  { titulo: 'Treinamento de integração', done: false },
  { titulo: 'Cadastro no iFood / benefícios', done: false },
]

export default function Onboarding() {
  const [items, setItems] = useState<OnboardingType[]>([])
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(false)

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
          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : items.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">⚑</div>
              <div className="empty-ttl">Nenhum onboarding</div>
              <div className="empty-sub">Crie um onboarding ao aprovar um candidato.</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Candidato</th>
                  <th>Vaga</th>
                  <th>Empresa</th>
                  <th>Status</th>
                  <th>Progresso</th>
                  <th style={{ width: 140 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map(o => {
                  const done = (o.checklist || []).filter(c => c.done).length
                  const total = (o.checklist || []).length
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0
                  return (
                    <tr key={o.id}>
                      <td><div className="tdm">{o.candidatoNome}</div></td>
                      <td style={{ fontSize: 12 }}>{o.vagaCargo}</td>
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

function NovoOnboardingModal({ vagas, onClose }: { vagas: Vaga[]; onClose: () => void }) {
  const [candidatoNome, setCandidatoNome] = useState('')
  const [vagaId, setVagaId] = useState(vagas[0]?.id || '')
  const [empresa, setEmpresa] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const vaga = vagas.find(v => v.id === vagaId)
      const checklist = DEFAULT_CHECKLIST.map((c, i) => ({
        ...c,
        id: `item-${i}`,
      }))
      await addDoc(collection(db, 'onboarding'), {
        candidatoId: '',
        candidatoNome,
        vagaId,
        vagaCargo: vaga?.cargo || '',
        empresa: empresa || vaga?.empresa || '',
        status: 'pendente',
        checklist,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Novo onboarding</h2>
        <p>Crie um checklist de integração para um novo contratado.</p>
        <form onSubmit={handleSubmit} className="row-gap-14">
          <div className="field"><label>Nome do candidato *</label><input value={candidatoNome} onChange={(e) => setCandidatoNome(e.target.value)} required /></div>
          <div className="field">
            <label>Vaga *</label>
            <select value={vagaId} onChange={(e) => setVagaId(e.target.value)} required>
              {vagas.map(v => <option key={v.id} value={v.id}>{v.cargo} · {v.time}</option>)}
            </select>
          </div>
          <div className="field"><label>Empresa</label><input value={empresa} onChange={(e) => setEmpresa(e.target.value)} /></div>
          <div className="hstack" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando…' : 'Criar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
