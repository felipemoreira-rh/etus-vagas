import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import Topbar from '../../components/Topbar'
import type { Estagiario } from '../../types'

type EstagiarioStatus = Estagiario['status']

function formatDate(ts?: { toDate: () => Date } | null) {
  if (!ts) return '—'
  try { return ts.toDate().toLocaleDateString('pt-BR') } catch { return '—' }
}

function toDateInput(ts?: { toDate: () => Date } | null): string {
  if (!ts) return ''
  try {
    const d = ts.toDate()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  } catch { return '' }
}

export default function Estagiarios() {
  const [items, setItems] = useState<Estagiario[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState<string>('todos')
  const [openModal, setOpenModal] = useState(false)
  const [editing, setEditing] = useState<Estagiario | null>(null)

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'estagiarios')), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Estagiario, 'id'>) }))
      list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
      setItems(list)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  const filtered = useMemo(() => {
    return items.filter(e => {
      if (statusF !== 'todos' && e.status !== statusF) return false
      if (search) {
        const s = search.toLowerCase()
        if (!e.nome.toLowerCase().includes(s) && !e.curso.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [items, search, statusF])

  async function excluir(e: Estagiario) {
    if (!confirm(`Excluir o estagiário "${e.nome}"?\n\nEssa ação é permanente.`)) return
    try {
      await deleteDoc(doc(db, 'estagiarios', e.id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir estagiário.')
    }
  }

  return (
    <>
      <Topbar
        title="Estagiários"
        icon="◱"
        actions={<button className="tbtn pri" onClick={() => setOpenModal(true)}>＋ Novo estagiário</button>}
      />
      <div className="content">
        <div className="panel">
          <div className="filter-bar">
            <div className="swrap">
              <span className="sico">⌕</span>
              <input className="srch" placeholder="Buscar por nome ou curso…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select value={statusF} onChange={(e) => setStatusF(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="ativo">Ativos</option>
              <option value="finalizado">Finalizados</option>
              <option value="desligado">Desligados</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">◱</div>
              <div className="empty-ttl">Nenhum estagiário</div>
              <div className="empty-sub">Cadastre estagiários para acompanhar.</div>
            </div>
          ) : (
            <div className="panel-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Curso / Instituição</th>
                    <th>Área</th>
                    <th>Empresa</th>
                    <th>Mentor</th>
                    <th>Início</th>
                    <th>Término</th>
                    <th>Status</th>
                    <th style={{ width: 100 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => (
                    <tr key={e.id}>
                      <td><div className="tdm">{e.nome}</div><div className="tds">{e.email || '—'}</div></td>
                      <td style={{ fontSize: 12 }}>{e.curso} · {e.instituicao}</td>
                      <td style={{ fontSize: 12, color: 'var(--mut)' }}>{e.area}</td>
                      <td style={{ fontSize: 12, color: 'var(--mut)' }}>{e.empresa}</td>
                      <td style={{ fontSize: 12 }}>{e.mentor || '—'}</td>
                      <td style={{ fontSize: 11, color: 'var(--mut)' }}>{formatDate(e.dataInicio)}</td>
                      <td style={{ fontSize: 11, color: 'var(--mut)' }}>{formatDate(e.dataTermino)}</td>
                      <td>
                        <span className={`bdg ${e.status === 'ativo' ? 'ok' : e.status === 'finalizado' ? 'info' : 'bad'}`}>
                          {e.status === 'ativo' ? 'Ativo' : e.status === 'finalizado' ? 'Finalizado' : 'Desligado'}
                        </span>
                      </td>
                      <td>
                        <div className="hstack" style={{ gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="tbtn"
                            onClick={() => setEditing(e)}
                            title="Editar"
                            style={{ height: 26 }}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="tbtn"
                            onClick={() => excluir(e)}
                            title="Excluir"
                            style={{ height: 26, color: 'var(--bad)', borderColor: 'var(--bad-bd)' }}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {openModal && <EstagiarioModal onClose={() => setOpenModal(false)} />}
      {editing && <EstagiarioModal estagiario={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function EstagiarioModal({ estagiario, onClose }: { estagiario?: Estagiario, onClose: () => void }) {
  const isEdit = !!estagiario
  const [nome, setNome] = useState(estagiario?.nome ?? '')
  const [email, setEmail] = useState(estagiario?.email ?? '')
  const [curso, setCurso] = useState(estagiario?.curso ?? '')
  const [instituicao, setInstituicao] = useState(estagiario?.instituicao ?? '')
  const [empresa, setEmpresa] = useState(estagiario?.empresa ?? '')
  const [area, setArea] = useState(estagiario?.area ?? '')
  const [mentor, setMentor] = useState(estagiario?.mentor ?? '')
  const [dataInicio, setDataInicio] = useState(toDateInput(estagiario?.dataInicio))
  const [dataTermino, setDataTermino] = useState(toDateInput(estagiario?.dataTermino))
  const [bolsa, setBolsa] = useState<number | ''>(typeof estagiario?.bolsa === 'number' ? estagiario.bolsa : '')
  const [status, setStatus] = useState<EstagiarioStatus>(estagiario?.status ?? 'ativo')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (isEdit && estagiario) {
        await updateDoc(doc(db, 'estagiarios', estagiario.id), {
          nome, email, curso, instituicao, empresa, area, mentor,
          // Parse as local-time midnight (não UTC) pra evitar off-by-one em UTC-3.
          dataInicio: dataInicio ? new Date(dataInicio + 'T00:00:00') : null,
          dataTermino: dataTermino ? new Date(dataTermino + 'T00:00:00') : null,
          bolsa: typeof bolsa === 'number' ? bolsa : null,
          status,
          updatedAt: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db, 'estagiarios'), {
          nome, email, curso, instituicao, empresa, area, mentor,
          dataInicio: dataInicio ? new Date(dataInicio + 'T00:00:00') : null,
          dataTermino: dataTermino ? new Date(dataTermino + 'T00:00:00') : null,
          bolsa: typeof bolsa === 'number' ? bolsa : null,
          status: 'ativo',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'Editar estagiário' : 'Novo estagiário'}</h2>
        <form onSubmit={handleSubmit} className="row-gap-14">
          <div className="form-grid">
            <div className="field"><label>Nome *</label><input value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
            <div className="field"><label>E-mail</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="field"><label>Curso *</label><input value={curso} onChange={(e) => setCurso(e.target.value)} required /></div>
            <div className="field"><label>Instituição *</label><input value={instituicao} onChange={(e) => setInstituicao(e.target.value)} required /></div>
            <div className="field"><label>Empresa *</label><input value={empresa} onChange={(e) => setEmpresa(e.target.value)} required /></div>
            <div className="field"><label>Área *</label><input value={area} onChange={(e) => setArea(e.target.value)} required /></div>
            <div className="field"><label>Mentor</label><input value={mentor} onChange={(e) => setMentor(e.target.value)} /></div>
            <div className="field"><label>Bolsa (R$)</label><input type="number" min={0} step={0.01} value={bolsa} onChange={(e) => setBolsa(e.target.value === '' ? '' : Number(e.target.value))} /></div>
            <div className="field"><label>Início *</label><input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required /></div>
            <div className="field"><label>Término *</label><input type="date" value={dataTermino} onChange={(e) => setDataTermino(e.target.value)} required /></div>
            {isEdit && (
              <div className="field">
                <label>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as EstagiarioStatus)}>
                  <option value="ativo">Ativo</option>
                  <option value="finalizado">Finalizado</option>
                  <option value="desligado">Desligado</option>
                </select>
              </div>
            )}
          </div>
          <div className="hstack" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando…' : (isEdit ? 'Salvar' : 'Cadastrar')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
