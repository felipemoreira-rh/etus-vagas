import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { addDoc, collection, onSnapshot, query, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import Topbar from '../../components/Topbar'
import type { Estagiario } from '../../types'

function formatDate(ts?: { toDate: () => Date } | null) {
  if (!ts) return '—'
  try { return ts.toDate().toLocaleDateString('pt-BR') } catch { return '—' }
}

export default function Estagiarios() {
  const [items, setItems] = useState<Estagiario[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState<string>('todos')
  const [openModal, setOpenModal] = useState(false)

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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {openModal && <NovoEstagiarioModal onClose={() => setOpenModal(false)} />}
    </>
  )
}

function NovoEstagiarioModal({ onClose }: { onClose: () => void }) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [curso, setCurso] = useState('')
  const [instituicao, setInstituicao] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [area, setArea] = useState('')
  const [mentor, setMentor] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataTermino, setDataTermino] = useState('')
  const [bolsa, setBolsa] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await addDoc(collection(db, 'estagiarios'), {
        nome, email, curso, instituicao, empresa, area, mentor,
        dataInicio: dataInicio ? new Date(dataInicio) : null,
        dataTermino: dataTermino ? new Date(dataTermino) : null,
        bolsa: typeof bolsa === 'number' ? bolsa : null,
        status: 'ativo',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Novo estagiário</h2>
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
