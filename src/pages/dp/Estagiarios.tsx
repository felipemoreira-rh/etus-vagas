import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, Timestamp, updateDoc,
} from 'firebase/firestore'
import { db } from '../../firebase'
import Topbar from '../../components/Topbar'
import type { Colaborador, Estagiario, RegimeTrabalho } from '../../types'
import { EMPRESA_OPTIONS, REGIME_TRABALHO_LABEL } from '../../types'

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

// Calcula dias restantes até o fim do contrato. Negativo se já venceu.
function daysUntil(ts?: { toDate: () => Date } | null): number | null {
  if (!ts) return null
  try {
    const fim = ts.toDate()
    fim.setHours(23, 59, 59, 999)
    const hoje = new Date()
    return Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
  } catch { return null }
}

export default function Estagiarios() {
  const [items, setItems] = useState<Estagiario[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState<string>('todos')
  const [openModal, setOpenModal] = useState(false)
  const [editing, setEditing] = useState<Estagiario | null>(null)
  const [efetivando, setEfetivando] = useState<Estagiario | null>(null)

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

  // Alerta dos próximos 30 dias: estagiários ativos cujo contrato está
  // perto do fim. Usado pra mostrar uma tarja no topo.
  const alerta30d = useMemo(() => {
    return items.filter(e => {
      if (e.status !== 'ativo') return false
      const d = daysUntil(e.dataTermino)
      return d != null && d <= 30 && d >= 0
    }).sort((a, b) => (daysUntil(a.dataTermino) ?? 999) - (daysUntil(b.dataTermino) ?? 999))
  }, [items])

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
        {alerta30d.length > 0 && (
          <div
            className="panel"
            style={{
              borderLeft: '4px solid var(--warn)',
              padding: '10px 14px',
              fontSize: 12,
            }}
          >
            <b>⚠ {alerta30d.length} estagiário{alerta30d.length > 1 ? 's' : ''} com contrato terminando nos próximos 30 dias:</b>
            <ul style={{ marginTop: 6, marginBottom: 0, paddingLeft: 18 }}>
              {alerta30d.slice(0, 6).map(e => {
                const d = daysUntil(e.dataTermino)
                return (
                  <li key={e.id}>
                    {e.nome} · {e.empresa} — {d === 0 ? 'termina hoje' : `${d}d restantes`} ({formatDate(e.dataTermino)})
                  </li>
                )
              })}
            </ul>
          </div>
        )}

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
              <option value="efetivado">Efetivados</option>
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
                    <th style={{ width: 160 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => {
                    const d = daysUntil(e.dataTermino)
                    const corFim = d != null && e.status === 'ativo'
                      ? d <= 30 ? 'var(--warn)' : d <= 60 ? '#d18b1a' : 'var(--mut)'
                      : 'var(--mut)'
                    return (
                      <tr key={e.id}>
                        <td>
                          <div className="tdm">{e.nome}</div>
                          <div className="tds">{e.email || '—'}</div>
                        </td>
                        <td style={{ fontSize: 12 }}>{e.curso || '—'} · {e.instituicao || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--mut)' }}>{e.area}</td>
                        <td style={{ fontSize: 12, color: 'var(--mut)' }}>{e.empresa}</td>
                        <td style={{ fontSize: 12 }}>{e.mentor || '—'}</td>
                        <td style={{ fontSize: 11, color: 'var(--mut)' }}>{formatDate(e.dataInicio)}</td>
                        <td style={{ fontSize: 11, color: corFim, fontWeight: d != null && d <= 30 && e.status === 'ativo' ? 700 : 500 }}>
                          {formatDate(e.dataTermino)}
                          {d != null && e.status === 'ativo' && d <= 60 && d >= 0 && (
                            <div style={{ fontSize: 10 }}>{d}d</div>
                          )}
                        </td>
                        <td>
                          <span className={`bdg ${e.status === 'ativo' ? 'ok' : e.status === 'efetivado' ? 'purple' : e.status === 'finalizado' ? 'info' : 'bad'}`}>
                            {e.status === 'ativo' ? 'Ativo'
                              : e.status === 'efetivado' ? 'Efetivado'
                                : e.status === 'finalizado' ? 'Finalizado' : 'Desligado'}
                          </span>
                        </td>
                        <td>
                          <div className="hstack" style={{ gap: 6, justifyContent: 'flex-end' }}>
                            {e.status === 'ativo' && (
                              <button
                                type="button"
                                className="tbtn pri"
                                onClick={() => setEfetivando(e)}
                                title="Efetivar (vira PJ ou CLT)"
                                style={{ height: 26 }}
                              >
                                ▲ Efetivar
                              </button>
                            )}
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
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {openModal && <EstagiarioModal onClose={() => setOpenModal(false)} />}
      {editing && <EstagiarioModal estagiario={editing} onClose={() => setEditing(null)} />}
      {efetivando && (
        <EfetivarModal
          estagiario={efetivando}
          onClose={() => setEfetivando(null)}
        />
      )}
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
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      const payload = {
        nome, email, curso, instituicao, empresa, area, mentor,
        dataInicio: dataInicio ? Timestamp.fromDate(new Date(dataInicio + 'T00:00:00')) : null,
        dataTermino: dataTermino ? Timestamp.fromDate(new Date(dataTermino + 'T00:00:00')) : null,
        bolsa: typeof bolsa === 'number' ? bolsa : null,
        updatedAt: serverTimestamp(),
      }
      if (isEdit && estagiario) {
        await updateDoc(doc(db, 'estagiarios', estagiario.id), {
          ...payload,
          status,
        })
      } else {
        await addDoc(collection(db, 'estagiarios'), {
          ...payload,
          status: 'ativo',
          createdAt: serverTimestamp(),
        })
      }
      onClose()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Erro ao salvar.')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'Editar estagiário' : 'Novo estagiário'}</h2>
        <form onSubmit={handleSubmit} className="row-gap-14">
          {err && <div className="error-text">{err}</div>}
          <div className="form-grid">
            <div className="field"><label>Nome *</label><input value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
            <div className="field"><label>E-mail</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="field"><label>Curso *</label><input value={curso} onChange={(e) => setCurso(e.target.value)} required /></div>
            <div className="field"><label>Instituição *</label><input value={instituicao} onChange={(e) => setInstituicao(e.target.value)} required /></div>
            <div className="field">
              <label>Empresa *</label>
              <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} required>
                <option value="">— selecione —</option>
                {EMPRESA_OPTIONS.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                {empresa && !(EMPRESA_OPTIONS as readonly string[]).includes(empresa) && (
                  <option value={empresa}>{empresa} (legado)</option>
                )}
              </select>
            </div>
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
                  <option value="efetivado">Efetivado</option>
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

// ────────────────────────── Modal: efetivar estágio ──────────────────────────
// Cria um colaborador a partir do estagiário e marca o estágio como
// 'efetivado'. Usuário pode escolher regime (CLT ou PJ) e cargo final.
function EfetivarModal({ estagiario, onClose }: { estagiario: Estagiario, onClose: () => void }) {
  const [regime, setRegime] = useState<RegimeTrabalho>('clt')
  const [cargo, setCargo] = useState(estagiario.area || '')
  const [salario, setSalario] = useState<number | ''>('')
  const [dataAdmissao, setDataAdmissao] = useState(() => new Date().toISOString().slice(0, 10))
  const [observacoes, setObservacoes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      const dataAdmTs = Timestamp.fromDate(new Date(dataAdmissao + 'T00:00:00'))

      // Cria colaborador.
      const colabPayload: Record<string, unknown> = {
        nome: estagiario.nome,
        cargo: cargo || estagiario.area,
        area: estagiario.area,
        empresa: estagiario.empresa,
        regime,
        dataAdmissao: dataAdmTs,
        status: 'ativo',
        estagiarioId: estagiario.id,
        ...(estagiario.email ? { email: estagiario.email } : {}),
        ...(estagiario.telefone ? { telefone: estagiario.telefone } : {}),
        ...(estagiario.gestorUid ? { gestorUid: estagiario.gestorUid } : {}),
        ...(estagiario.gestorNome ? { gestorNome: estagiario.gestorNome } : {}),
        ...(estagiario.candidatoId ? { candidatoId: estagiario.candidatoId } : {}),
        ...(estagiario.vagaId ? { vagaId: estagiario.vagaId } : {}),
        ...(estagiario.indicadoPorNome ? { indicadoPorNome: estagiario.indicadoPorNome } : {}),
        ...(typeof salario === 'number' ? { salario } : {}),
        ...(observacoes.trim() ? { observacoes: observacoes.trim() } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      const colabRef = await addDoc(collection(db, 'colaboradores'), colabPayload as Omit<Colaborador, 'id'>)

      // Atualiza estagiário: status 'efetivado' + colaboradorId.
      await updateDoc(doc(db, 'estagiarios', estagiario.id), {
        status: 'efetivado',
        colaboradorId: colabRef.id,
        updatedAt: serverTimestamp(),
      })

      // Notifica o gestor (se houver).
      if (estagiario.gestorUid) {
        await addDoc(collection(db, 'notificacoes'), {
          destinatarioUid: estagiario.gestorUid,
          tipo: 'periodo_experiencia',
          titulo: `Estagiário efetivado: ${estagiario.nome}`,
          mensagem: `${estagiario.nome} foi efetivado(a) como ${REGIME_TRABALHO_LABEL[regime]} a partir de ${new Date(dataAdmissao + 'T00:00:00').toLocaleDateString('pt-BR')}.`,
          link: `/dp/colaboradores`,
          lida: false,
          createdAt: serverTimestamp(),
          refColecao: 'colaboradores',
          refId: colabRef.id,
        })
      }

      onClose()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Erro ao efetivar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Efetivar {estagiario.nome}</h2>
        <p>Cria um registro em "Colaboradores" e marca o estágio como efetivado. O vínculo cruzado é mantido pra auditoria.</p>
        <form onSubmit={handleSubmit} className="row-gap-14">
          {err && <div className="error-text">{err}</div>}
          <div className="form-grid">
            <div className="field">
              <label>Novo regime *</label>
              <select value={regime} onChange={(e) => setRegime(e.target.value as RegimeTrabalho)}>
                <option value="clt">CLT</option>
                <option value="pj">PJ</option>
                <option value="freelancer">Freelancer</option>
              </select>
            </div>
            <div className="field">
              <label>Cargo *</label>
              <input value={cargo} onChange={(e) => setCargo(e.target.value)} required />
            </div>
            <div className="field">
              <label>Data de admissão *</label>
              <input type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} required />
            </div>
            <div className="field">
              <label>Salário / Honorários (R$)</label>
              <input
                type="number" min={0} step={0.01}
                value={salario}
                onChange={(e) => setSalario(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div className="field full">
              <label>Observações</label>
              <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>
          </div>
          <div className="hstack" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Efetivando…' : 'Confirmar efetivação'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
