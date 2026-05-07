import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  addDoc, arrayUnion, collection, doc, getDoc, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where, getDocs,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import FileUpload from '../../components/FileUpload'
import ScheduleInterviewButton from '../../components/ScheduleInterviewButton'
import { formatBytes, removeFile, uploadFile } from '../../utils/storage'
import type {
  Anexo, Candidato, CandidatoFase, CandidatoMovimentacao, CandidatoOrigem,
  Onboarding, OnboardingItem, OnboardingTipo, Regime, Vaga,
} from '../../types'
import {
  CANDIDATO_FASE_LABEL, CANDIDATO_FASE_ORDER, CANDIDATO_ORIGEM_LABEL,
  CHECKLIST_NOTIFICACAO_GESTOR_TITULO,
  getVagaEmpresas,
  ONBOARDING_CHECKLIST_TEMPLATES, ONBOARDING_TIPO_LABEL, regimeToOnboardingTipo,
} from '../../types'

function formatDate(ts?: { toDate: () => Date } | null) {
  if (!ts) return '—'
  try { return ts.toDate().toLocaleString('pt-BR') } catch { return '—' }
}

// Calcula contagem regressiva de 90d a partir de uma data de início.
// Retorna { dias, percentage, status }. status: 'pendente' (>0d), 'completou'
// (passou dos 90d), 'aprovado_sem_inicio' (sem dataPrevistaInicio).
function calcCountdown90(dataInicio?: Timestamp | null) {
  if (!dataInicio) return { dias: null, percentage: 0, status: 'aprovado_sem_inicio' as const }
  const inicio = dataInicio.toDate()
  const hoje = new Date()
  const diffMs = inicio.getTime() + 90 * 24 * 60 * 60 * 1000 - hoje.getTime()
  const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  const decorridos = Math.max(0, Math.min(90, 90 - dias))
  const percentage = Math.round((decorridos / 90) * 100)
  if (dias <= 0) return { dias: 0, percentage: 100, status: 'completou' as const }
  return { dias, percentage, status: 'pendente' as const }
}

export default function CandidatoDetalhe() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [c, setC] = useState<Candidato | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [novaFase, setNovaFase] = useState<CandidatoFase>('triagem')
  const [nota, setNota] = useState('')
  const [score, setScore] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [aprovacaoOpen, setAprovacaoOpen] = useState(false)
  const [onboardingExistente, setOnboardingExistente] = useState<Onboarding | null>(null)

  useEffect(() => {
    if (!id) return
    const unsub = onSnapshot(doc(db, 'candidatos', id),
      (snap) => {
        if (!snap.exists()) setErr('Candidato não encontrado.')
        else {
          const data = { id: snap.id, ...(snap.data() as Omit<Candidato, 'id'>) }
          setC(data)
          setNovaFase(data.fase)
          setScore(typeof data.score === 'number' ? data.score : '')
        }
      },
      (e) => setErr(e.message))
    return unsub
  }, [id])

  // Verifica se já existe onboarding pra esse candidato (pra ter um link
  // direto e não criar duplicado quando o RH reaprovar).
  useEffect(() => {
    if (!id) return
    const q = query(collection(db, 'onboarding'), where('candidatoId', '==', id))
    const unsub = onSnapshot(q, (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Onboarding, 'id'>) }))
      list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
      setOnboardingExistente(list[0] || null)
    })
    return unsub
  }, [id])

  // Quando o RH escolhe "aprovado" no select de fase, intercepta o submit
  // e abre o modal de aprovação (data prevista + criação do onboarding).
  // Pra qualquer outra fase, fluxo normal de movimentar.
  async function movimentar(e: FormEvent) {
    e.preventDefault()
    if (!c || !profile) return
    if (novaFase === 'aprovado' && c.fase !== 'aprovado') {
      // Abre modal — só salva no submit do modal.
      setAprovacaoOpen(true)
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const mov: CandidatoMovimentacao = {
        at: Timestamp.now(),
        byUid: profile.uid, byName: profile.name,
        fromFase: c.fase, toFase: novaFase,
        ...(nota.trim() ? { nota: nota.trim() } : {}),
      }
      await updateDoc(doc(db, 'candidatos', c.id), {
        fase: novaFase,
        score: typeof score === 'number' ? score : null,
        updatedAt: serverTimestamp(),
        historico: arrayUnion(mov),
      })
      setNota('')
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Erro ao salvar.')
    } finally { setSaving(false) }
  }

  async function handleUploadCurriculum(file: File) {
    if (!c || !profile) return
    if (c.curriculumPath) await removeFile(c.curriculumPath)
    const up = await uploadFile(file, `candidatos/${c.id}/curriculo`)
    await updateDoc(doc(db, 'candidatos', c.id), {
      curriculumUrl: up.url,
      curriculumNome: up.nome,
      curriculumPath: up.path,
      updatedAt: serverTimestamp(),
    })
  }

  async function handleUploadRelatorio(file: File) {
    if (!c || !profile) return
    const up = await uploadFile(file, `candidatos/${c.id}/relatorios`)
    const anexo: Anexo = {
      url: up.url,
      nome: up.nome,
      path: up.path,
      tamanho: up.tamanho,
      tipo: 'relatorio',
      uploadedAt: Timestamp.now(),
      uploadedByUid: profile.uid,
      uploadedByName: profile.name,
    }
    await updateDoc(doc(db, 'candidatos', c.id), {
      relatorios: arrayUnion(anexo),
      updatedAt: serverTimestamp(),
    })
  }

  async function handleRemoveRelatorio(a: Anexo) {
    if (!c) return
    if (!confirm(`Remover relatório "${a.nome}"?`)) return
    await removeFile(a.path)
    const novos = (c.relatorios || []).filter(r => r.path !== a.path)
    await updateDoc(doc(db, 'candidatos', c.id), {
      relatorios: novos,
      updatedAt: serverTimestamp(),
    })
  }

  async function handleRemoveCurriculo() {
    if (!c || !c.curriculumPath) return
    if (!confirm('Remover currículo?')) return
    await removeFile(c.curriculumPath)
    await updateDoc(doc(db, 'candidatos', c.id), {
      curriculumUrl: null,
      curriculumNome: null,
      curriculumPath: null,
      updatedAt: serverTimestamp(),
    })
  }

  // Countdown de 90 dias pro bônus de indicação (quando aprovado).
  const countdown = c && c.fase === 'aprovado' && c.origem === 'indicacao' && c.indicadoPorNome
    ? calcCountdown90(c.dataPrevistaInicio || c.dataAdmissao)
    : null

  return (
    <>
      <Topbar
        title={c?.nome || 'Candidato'}
        icon="◉"
        actions={
          <>
            {c && <button type="button" className="tbtn" onClick={() => setEditOpen(true)}>✎ Editar perfil</button>}
            {c && <ScheduleInterviewButton candidato={c} />}
            <Link to="/rh/candidatos" className="tbtn">← Voltar</Link>
          </>
        }
      />
      <div className="content">
        {err && <div className="error-text">{err}</div>}
        {!c && !err && <div className="empty-state">Carregando…</div>}
        {c && (
          <>
            {/* Card de countdown de bônus de indicação (quando aprovado) */}
            {countdown && (
              <div
                className="panel"
                style={{
                  display: 'flex', flexDirection: 'column', gap: 8,
                  borderLeft: `4px solid ${countdown.status === 'completou' ? 'var(--ok)' : 'var(--g600)'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>
                      Bônus de indicação · {c.indicadoPorNome}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--mut)' }}>
                      {countdown.status === 'completou'
                        ? '✓ 90 dias completados — bônus liberado para pagamento.'
                        : countdown.status === 'aprovado_sem_inicio'
                          ? 'Aprovado, mas sem data de início definida — countdown não iniciou.'
                          : `Faltam ${countdown.dias} dias para liberar o bônus (90d a partir do início).`}
                    </div>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: countdown.status === 'completou' ? 'var(--ok)' : 'var(--g600)' }}>
                    {countdown.dias === null ? '—' : `${countdown.dias}d`}
                  </div>
                </div>
                {countdown.status === 'pendente' && (
                  <div style={{ height: 6, background: 'var(--b1)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${countdown.percentage}%`, background: 'var(--g600)', transition: 'width .3s' }} />
                  </div>
                )}
              </div>
            )}

            <div className="body-grid bg-2">
              <div className="panel">
                <h3>Dados do candidato</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  <Info label="Nome" value={c.nome} />
                  <Info label="E-mail" value={c.email} />
                  <Info label="Telefone" value={c.telefone} />
                  <Info label="LinkedIn" value={c.linkedin} />
                  <Info label="Vaga" value={c.vagaCargo} />
                  <Info
                    label="Origem"
                    value={c.origem === 'outro'
                      ? c.origemOutro || 'Outro'
                      : c.origem === 'indicacao' && c.indicadoPorNome
                        ? `Indicação · ${c.indicadoPorNome}`
                        : CANDIDATO_ORIGEM_LABEL[c.origem]}
                  />
                  <Info label="Fase atual" value={CANDIDATO_FASE_LABEL[c.fase]} />
                  <Info label="Score" value={typeof c.score === 'number' ? `${c.score}/100` : '—'} />
                </div>
                {c.observacoes && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--mut)', fontWeight: 700, marginBottom: 4 }}>Observações</div>
                    <div style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--n700)' }}>{c.observacoes}</div>
                  </div>
                )}
                {onboardingExistente && (
                  <div style={{ marginTop: 14, padding: 10, background: 'var(--card2)', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--mut)', marginBottom: 4 }}>Onboarding</div>
                    <Link to={`/rh/onboarding/${onboardingExistente.id}`} style={{ color: 'var(--g600)', fontSize: 13, fontWeight: 600 }}>
                      Abrir onboarding ({onboardingExistente.status}) →
                    </Link>
                  </div>
                )}
              </div>

              <div className="panel">
                <h3>Movimentar</h3>
                <form onSubmit={movimentar} className="row-gap-10">
                  <div className="field">
                    <label>Nova fase</label>
                    <select value={novaFase} onChange={(e) => setNovaFase(e.target.value as CandidatoFase)}>
                      {CANDIDATO_FASE_ORDER.map(f => <option key={f} value={f}>{CANDIDATO_FASE_LABEL[f]}</option>)}
                    </select>
                    {novaFase === 'aprovado' && c.fase !== 'aprovado' && (
                      <small style={{ fontSize: 11, color: 'var(--g600)', marginTop: 4, display: 'block' }}>
                        Ao registrar, abre uma janela para informar a data de início e criar o onboarding automaticamente.
                      </small>
                    )}
                  </div>
                  <div className="field">
                    <label>Score (0-100)</label>
                    <input type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value === '' ? '' : Number(e.target.value))} />
                  </div>
                  <div className="field">
                    <label>Nota</label>
                    <textarea value={nota} onChange={(e) => setNota(e.target.value)} />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando…' : 'Registrar'}</button>
                </form>
              </div>
            </div>

            <div className="body-grid bg-2e">
              <div className="panel">
                <h3>Currículo</h3>
                {c.curriculumUrl ? (
                  <div className="attach-row">
                    <div className="att-ico">📄</div>
                    <div className="att-body">
                      <div className="att-name">{c.curriculumNome || 'Currículo'}</div>
                      <div className="att-meta">Visível para você e o gestor responsável pela vaga.</div>
                    </div>
                    <div className="att-actions">
                      <a href={c.curriculumUrl} target="_blank" rel="noopener noreferrer" className="tbtn">Abrir</a>
                      <button className="tbtn" onClick={handleRemoveCurriculo} type="button">Remover</button>
                    </div>
                  </div>
                ) : (
                  <FileUpload
                    label="Enviar currículo"
                    hint="PDF, DOC ou DOCX recomendados."
                    accept=".pdf,.doc,.docx"
                    onFile={handleUploadCurriculum}
                  />
                )}
              </div>

              <div className="panel">
                <h3>Relatórios de entrevista</h3>
                {(c.relatorios || []).length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    {(c.relatorios || []).map((a) => (
                      <div className="attach-row" key={a.path}>
                        <div className="att-ico">📋</div>
                        <div className="att-body">
                          <div className="att-name">{a.nome}</div>
                          <div className="att-meta">
                            {formatBytes(a.tamanho)} · enviado por {a.uploadedByName} · {formatDate(a.uploadedAt)}
                          </div>
                        </div>
                        <div className="att-actions">
                          <a href={a.url} target="_blank" rel="noopener noreferrer" className="tbtn">Abrir</a>
                          <button className="tbtn" onClick={() => handleRemoveRelatorio(a)} type="button">Remover</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <FileUpload
                  label="Adicionar relatório"
                  hint="Feedback da entrevista. Visível para o gestor responsável."
                  accept=".pdf,.doc,.docx,.txt"
                  onFile={handleUploadRelatorio}
                />
              </div>
            </div>

            {(c.agendamentos || []).length > 0 && (
              <div className="panel">
                <h3>Entrevistas agendadas</h3>
                <div className="row-gap-10">
                  {[...(c.agendamentos || [])]
                    .sort((a, b) => (b.inicio?.toMillis?.() ?? 0) - (a.inicio?.toMillis?.() ?? 0))
                    .map((a) => (
                      <div key={a.id} style={{ border: '1px solid var(--b1)', borderRadius: 8, padding: '10px 12px', background: 'var(--card2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{a.titulo}</div>
                            <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 2 }}>
                              {formatDate(a.inicio)} — {a.local || 'local a definir'}
                            </div>
                            {a.participantes && a.participantes.length > 0 && (
                              <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 2 }}>
                                Participantes: {a.participantes.join(', ')}
                              </div>
                            )}
                          </div>
                          {a.calendarUrl && (
                            <a href={a.calendarUrl} target="_blank" rel="noopener noreferrer" className="tbtn">
                              Abrir na Agenda
                            </a>
                          )}
                        </div>
                        {a.observacoes && (
                          <div style={{ fontSize: 12, color: 'var(--n700)', marginTop: 6, whiteSpace: 'pre-wrap' }}>
                            {a.observacoes}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="panel">
              <h3>Histórico</h3>
              {c.historico && c.historico.length > 0 ? (
                <div className="row-gap-10">
                  {[...c.historico].reverse().map((h, i) => (
                    <div key={i} style={{ border: '1px solid var(--b1)', borderRadius: 8, padding: '10px 12px', background: 'var(--card2)' }}>
                      <div style={{ fontSize: 11, color: 'var(--mut)', marginBottom: 4 }}>
                        {formatDate(h.at)} · {h.byName}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>
                        {h.fromFase && h.toFase
                          ? `${CANDIDATO_FASE_LABEL[h.fromFase]} → ${CANDIDATO_FASE_LABEL[h.toFase]}`
                          : h.toFase ? `Fase: ${CANDIDATO_FASE_LABEL[h.toFase]}` : 'Atualização'}
                      </div>
                      {h.nota && <div style={{ fontSize: 12, marginTop: 6, color: 'var(--n700)' }}>{h.nota}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-sub">Sem movimentações.</div>
              )}
            </div>
          </>
        )}
      </div>

      {editOpen && c && (
        <EditCandidatoModal
          candidato={c}
          onClose={() => setEditOpen(false)}
          onSaved={() => setEditOpen(false)}
        />
      )}

      {aprovacaoOpen && c && profile && (
        <AprovacaoModal
          candidato={c}
          profileUid={profile.uid}
          profileName={profile.name}
          notaContext={nota}
          score={typeof score === 'number' ? score : null}
          jaTinhaOnboarding={!!onboardingExistente}
          onClose={() => setAprovacaoOpen(false)}
          onDone={() => {
            setAprovacaoOpen(false)
            setNota('')
          }}
        />
      )}
    </>
  )
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mut)', fontWeight: 700, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{value || '—'}</div>
    </div>
  )
}

// ────────────────────────── Modal: editar perfil do candidato ──────────────────────────
function EditCandidatoModal({ candidato, onClose, onSaved }: {
  candidato: Candidato
  onClose: () => void
  onSaved: () => void
}) {
  const [nome, setNome] = useState(candidato.nome)
  const [email, setEmail] = useState(candidato.email || '')
  const [telefone, setTelefone] = useState(candidato.telefone || '')
  const [cidade, setCidade] = useState(candidato.cidade || '')
  const [uf, setUf] = useState(candidato.uf || '')
  const [linkedin, setLinkedin] = useState(candidato.linkedin || '')
  const [origem, setOrigem] = useState<CandidatoOrigem>(candidato.origem)
  const [origemOutro, setOrigemOutro] = useState(candidato.origemOutro || '')
  const [indicadoPorNome, setIndicadoPorNome] = useState(candidato.indicadoPorNome || '')
  const [observacoes, setObservacoes] = useState(candidato.observacoes || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      if (origem === 'indicacao' && !indicadoPorNome.trim()) {
        throw new Error('Informe o nome de quem indicou.')
      }
      const patch: Record<string, unknown> = {
        nome, email, telefone, cidade, uf, linkedin,
        origem,
        origemOutro: origem === 'outro' ? origemOutro.trim() : '',
        indicadoPorNome: origem === 'indicacao' ? indicadoPorNome.trim() : '',
        observacoes,
        updatedAt: serverTimestamp(),
      }
      await updateDoc(doc(db, 'candidatos', candidato.id), patch)
      onSaved()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Editar perfil</h2>
        <p>Atualize os dados cadastrais do candidato. O histórico é preservado.</p>
        <form onSubmit={handleSubmit} className="row-gap-14">
          {err && <div className="error-text">{err}</div>}
          <div className="field"><label>Nome *</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="form-grid">
            <div className="field"><label>E-mail</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="field"><label>Telefone</label><input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
            <div className="field"><label>Cidade</label><input value={cidade} onChange={(e) => setCidade(e.target.value)} /></div>
            <div className="field"><label>UF</label><input value={uf} onChange={(e) => setUf(e.target.value)} maxLength={2} /></div>
            <div className="field full"><label>LinkedIn</label><input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} /></div>
          </div>
          <div className="field"><label>Origem</label>
            <select value={origem} onChange={(e) => setOrigem(e.target.value as CandidatoOrigem)}>
              <option value="linkedin">LinkedIn</option>
              <option value="indeed">Indeed</option>
              <option value="gupy">Gupy</option>
              <option value="indicacao">Indicação</option>
              <option value="site_etus">Site ETUS</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          {origem === 'indicacao' && (
            <div className="field"><label>Nome de quem indicou *</label>
              <input value={indicadoPorNome} onChange={(e) => setIndicadoPorNome(e.target.value)} required />
            </div>
          )}
          {origem === 'outro' && (
            <div className="field"><label>Especifique a origem</label>
              <input value={origemOutro} onChange={(e) => setOrigemOutro(e.target.value)} />
            </div>
          )}
          <div className="field"><label>Observações</label>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
          <div className="hstack" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ────────────────────────── Modal: aprovar + criar onboarding ──────────────────────────
function AprovacaoModal({
  candidato, profileUid, profileName, notaContext, score, jaTinhaOnboarding, onClose, onDone,
}: {
  candidato: Candidato
  profileUid: string
  profileName: string
  notaContext: string
  score: number | null
  jaTinhaOnboarding: boolean
  onClose: () => void
  onDone: () => void
}) {
  // Default = hoje + 14 dias (negociação típica de proposta).
  const defaultInicio = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return d.toISOString().slice(0, 10)
  })()

  const [dataInicio, setDataInicio] = useState(defaultInicio)
  const [dataTermino, setDataTermino] = useState('') // só pra estagio
  const [vaga, setVaga] = useState<Vaga | null>(null)
  const [tipo, setTipo] = useState<OnboardingTipo>('CLT')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Carrega a vaga vinculada pra ler regime + empresa.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const snap = await getDoc(doc(db, 'vagas', candidato.vagaId))
        if (!cancelled && snap.exists()) {
          const v = { id: snap.id, ...(snap.data() as Omit<Vaga, 'id'>) }
          setVaga(v)
          const t = regimeToOnboardingTipo(v.regime as Regime)
          setTipo(t)
          // Pre-preenche data de término padrão para estágios (1 ano à frente).
          if (t === 'ESTAGIO') {
            const d = new Date()
            d.setFullYear(d.getFullYear() + 1)
            setDataTermino(d.toISOString().slice(0, 10))
          }
        }
      } catch {
        if (!cancelled) setErr('Falha ao carregar dados da vaga.')
      }
    })()
    return () => { cancelled = true }
  }, [candidato.vagaId])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      if (!vaga) throw new Error('Vaga não carregada.')
      const inicio = new Date(dataInicio + 'T00:00:00')
      if (Number.isNaN(inicio.getTime())) throw new Error('Data de início inválida.')

      const inicioTs = Timestamp.fromDate(inicio)
      let terminoTs: Timestamp | null = null
      if (tipo === 'ESTAGIO' && dataTermino) {
        const fim = new Date(dataTermino + 'T00:00:00')
        if (Number.isNaN(fim.getTime())) throw new Error('Data de término inválida.')
        if (fim <= inicio) throw new Error('Data de término precisa ser depois do início.')
        terminoTs = Timestamp.fromDate(fim)
      }

      // 1) Atualiza candidato → fase aprovado + dataPrevistaInicio.
      const mov: CandidatoMovimentacao = {
        at: Timestamp.now(), byUid: profileUid, byName: profileName,
        fromFase: candidato.fase, toFase: 'aprovado',
        ...(notaContext.trim() ? { nota: notaContext.trim() } : { nota: 'Aprovado.' }),
      }
      await updateDoc(doc(db, 'candidatos', candidato.id), {
        fase: 'aprovado',
        score: score,
        dataPrevistaInicio: inicioTs,
        updatedAt: serverTimestamp(),
        historico: arrayUnion(mov),
      })

      // 2) Cria onboarding (só se ainda não existir).
      if (!jaTinhaOnboarding) {
        const temGestor = !!vaga.gestorUid
        const checklist: OnboardingItem[] = ONBOARDING_CHECKLIST_TEMPLATES[tipo].map((titulo, idx) => {
          // Item "Notificação de início pro gestor" é automático: o sistema
          // dispara a notificação na aprovação (passo 3 abaixo), então marcamos
          // como concluído já na criação se a vaga tem gestor associado.
          if (titulo === CHECKLIST_NOTIFICACAO_GESTOR_TITULO && temGestor) {
            return {
              id: `${Date.now()}-${idx}`,
              titulo,
              done: true,
              auto: true,
              doneAt: Timestamp.now(),
              doneByName: 'Sistema',
            }
          }
          return {
            id: `${Date.now()}-${idx}`,
            titulo,
            done: false,
            ...(titulo === CHECKLIST_NOTIFICACAO_GESTOR_TITULO ? { auto: true } : {}),
          }
        })
        await addDoc(collection(db, 'onboarding'), {
          candidatoId: candidato.id,
          candidatoNome: candidato.nome,
          ...(candidato.email ? { candidatoEmail: candidato.email } : {}),
          ...(candidato.telefone ? { candidatoTelefone: candidato.telefone } : {}),
          vagaId: candidato.vagaId,
          vagaCargo: candidato.vagaCargo,
          // Onboarding herda a primeira empresa selecionada na vaga (campo
          // string simples, já que cada onboarding pertence a uma única empresa).
          empresa: getVagaEmpresas(vaga)[0] || '',
          tipo,
          regime: vaga.regime,
          dataPrevistaInicio: inicioTs,
          ...(terminoTs ? { dataPrevistaTermino: terminoTs } : {}),
          ...(candidato.indicadoPorNome ? { indicadoPorNome: candidato.indicadoPorNome } : {}),
          status: 'pendente',
          checklist,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })

        // 3) Notifica o gestor responsável (se houver) e o RH responsável.
        if (vaga.gestorUid) {
          await addDoc(collection(db, 'notificacoes'), {
            destinatarioUid: vaga.gestorUid,
            ...(vaga.gestorEmail ? { destinatarioEmail: vaga.gestorEmail } : {}),
            tipo: 'onboarding_criado',
            titulo: `Onboarding iniciado: ${candidato.nome}`,
            mensagem: `O candidato aprovado para a vaga "${candidato.vagaCargo}" entrou em onboarding. Início previsto: ${inicio.toLocaleDateString('pt-BR')}.`,
            link: `/gestor/vagas/${candidato.vagaId}`,
            lida: false,
            createdAt: serverTimestamp(),
            refColecao: 'candidatos',
            refId: candidato.id,
          })
        }
      }

      // 4) Tentamos atualizar todas as vagas dependentes (status para
      // 'contratada' se 'aprovado' significa preenchimento da vaga). Não
      // forçamos para evitar conflito com vagas com múltiplas posições.
      onDone()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Erro ao aprovar candidato.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Aprovar candidato</h2>
        <p>
          Confirme a data prevista de início. O sistema cria o onboarding com
          checklist específico para <b>{ONBOARDING_TIPO_LABEL[tipo]}</b>{' '}
          e notifica o gestor.
        </p>
        <form onSubmit={handleSubmit} className="row-gap-14">
          {err && <div className="error-text">{err}</div>}

          <div className="field">
            <label>Tipo de contrato (do regime da vaga)</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as OnboardingTipo)}>
              <option value="CLT">CLT</option>
              <option value="PJ">PJ</option>
              <option value="ESTAGIO">Estágio</option>
              <option value="FREELANCER">Freelancer</option>
            </select>
            <small style={{ fontSize: 11, color: 'var(--mut)' }}>
              Determina o checklist de onboarding. Padrão = regime da vaga, mas você pode mudar (ex.: estagiário virando PJ).
            </small>
          </div>

          <div className="form-grid">
            <div className="field">
              <label>Data prevista de início *</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required />
            </div>
            {tipo === 'ESTAGIO' && (
              <div className="field">
                <label>Data prevista de término</label>
                <input type="date" value={dataTermino} onChange={(e) => setDataTermino(e.target.value)} />
                <small style={{ fontSize: 11, color: 'var(--mut)' }}>
                  Estágios geralmente são 1 ano. Usado pra alerta de fim de contrato.
                </small>
              </div>
            )}
          </div>

          {candidato.origem === 'indicacao' && candidato.indicadoPorNome && (
            <div style={{ fontSize: 12, padding: 10, background: 'var(--card2)', borderRadius: 8 }}>
              <b>Indicação:</b> {candidato.indicadoPorNome} — countdown de 90 dias começa nessa data de início.
            </div>
          )}

          {jaTinhaOnboarding && (
            <div style={{ fontSize: 12, color: 'var(--mut)' }}>
              Já existe um onboarding para esse candidato — vamos só atualizar a fase para "aprovado".
            </div>
          )}

          <div className="hstack" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !vaga}>
              {saving ? 'Aprovando…' : 'Confirmar aprovação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// suprime warning de import não usado
void getDocs
