import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  arrayUnion, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import StatusBadge from '../../components/StatusBadge'
import VagaDetalheView from '../shared/VagaDetalheView'
import { NovoCandidatoModal } from './Candidatos'
import type {
  Candidato, CandidatoFase, Formacao, Jornada, MotivoAbertura, Nivel, Regime,
  TempoExperiencia, UserProfile, Vaga, VagaMovimentacao, VagaStatus,
} from '../../types'
import {
  CANDIDATO_FASE_LABEL, EMPRESA_OPTIONS, getVagaEmpresas, STATUS_LABELS, STATUS_ORDER,
} from '../../types'

function faseClass(f: CandidatoFase) {
  if (f === 'aprovado') return 'ok'
  if (f === 'reprovado' || f === 'desistente') return 'bad'
  if (f === 'proposta') return 'purple'
  if (f === 'entrevista_rh' || f === 'entrevista_gestor' || f === 'entrevista_cultura') return 'warn'
  return 'info'
}

export default function VagaDetalheRh() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [vaga, setVaga] = useState<Vaga | null>(null)
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [novoStatus, setNovoStatus] = useState<VagaStatus>('triagem')
  const [nota, setNota] = useState('')
  const [saving, setSaving] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [novoCandidatoOpen, setNovoCandidatoOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    const unsub = onSnapshot(doc(db, 'vagas', id),
      (snap) => {
        if (!snap.exists()) setErr('Vaga não encontrada.')
        else {
          const v = { id: snap.id, ...(snap.data() as Omit<Vaga, 'id'>) }
          setVaga(v)
          setNovoStatus(v.status)
        }
        setLoading(false)
      },
      (e) => { setErr(e.message); setLoading(false) })
    return unsub
  }, [id])

  // Lista de candidatos vinculados a essa vaga, atualizada em tempo real.
  useEffect(() => {
    if (!id) return
    const q = query(collection(db, 'candidatos'), where('vagaId', '==', id))
    const unsub = onSnapshot(q, (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Candidato, 'id'>) }))
      list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
      setCandidatos(list)
    })
    return unsub
  }, [id])

  // Para o modal de novo candidato (precisa da Vaga objeto inteira).
  useEffect(() => {
    const u = onSnapshot(query(collection(db, 'vagas')), (s) => {
      setVagas(s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Vaga, 'id'>) })))
    })
    return u
  }, [])

  async function movimentar(e: FormEvent) {
    e.preventDefault()
    if (!vaga || !profile) return
    setSaving(true)
    try {
      const mov: VagaMovimentacao = {
        at: Timestamp.now(),
        byUid: profile.uid,
        byName: profile.name,
        fromStatus: vaga.status,
        toStatus: novoStatus,
        ...(nota.trim() ? { nota: nota.trim() } : {}),
      }
      await updateDoc(doc(db, 'vagas', vaga.id), {
        status: novoStatus,
        updatedAt: serverTimestamp(),
        historico: arrayUnion(mov),
        responsavelRhUid: profile.uid,
        responsavelRhNome: profile.name,
      })
      setNota('')
    } catch (err) {
      setErr(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function excluir() {
    if (!vaga) return
    const txt = `Excluir a vaga "${vaga.cargo}"?\n\nEssa ação é permanente. Candidatos vinculados NÃO são removidos automaticamente.`
    if (!confirm(txt)) return
    try {
      await deleteDoc(doc(db, 'vagas', vaga.id))
      navigate('/rh/vagas', { replace: true })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao excluir.')
    }
  }

  return (
    <>
      <Topbar
        title={vaga?.cargo || 'Detalhe da vaga'}
        icon="◱"
        actions={
          <>
            <button type="button" className="tbtn pri" onClick={() => setNovoCandidatoOpen(true)}>＋ Adicionar candidato</button>
            <button type="button" className="tbtn" onClick={() => setEditOpen(true)}>✎ Editar vaga</button>
            <Link to="/rh/candidatos" className="tbtn">Candidatos</Link>
            <button type="button" className="tbtn" onClick={excluir} style={{ color: 'var(--bad)', borderColor: 'var(--bad-bd)' }}>
              Excluir vaga
            </button>
            <Link to="/rh/vagas" className="tbtn">← Voltar</Link>
          </>
        }
      />
      <div className="content">
        {loading && <div className="empty-state">Carregando…</div>}
        {err && <div className="error-text">{err}</div>}
        {vaga && (
          <>
            <div className="panel hstack" style={{ padding: 14 }}>
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mut)', fontWeight: 700, marginBottom: 4 }}>
                  Status atual
                </div>
                <StatusBadge status={vaga.status} />
              </div>
              <div className="ml-auto hstack" style={{ gap: 18 }}>
                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mut)', fontWeight: 700 }}>
                    Empresa
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{getVagaEmpresas(vaga).join(' · ') || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mut)', fontWeight: 700 }}>
                    Gestor
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{vaga.gestorNome || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mut)', fontWeight: 700 }}>
                    Candidatos
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{candidatos.length}</div>
                </div>
              </div>
            </div>

            <div className="panel">
              <h3>Movimentar status</h3>
              <form onSubmit={movimentar} className="form-grid" style={{ alignItems: 'end' }}>
                <div className="field">
                  <label>Novo status</label>
                  <select value={novoStatus} onChange={(e) => setNovoStatus(e.target.value as VagaStatus)}>
                    {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Nota (opcional)</label>
                  <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Contexto da movimentação" />
                </div>
                <div className="field full" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    {saving ? 'Salvando…' : 'Registrar movimentação'}
                  </button>
                </div>
              </form>
            </div>

            <div className="panel">
              <div className="hstack" style={{ marginBottom: 10 }}>
                <h3 style={{ margin: 0 }}>Candidatos da vaga</h3>
                <span className="bdg info" style={{ marginLeft: 8 }}>{candidatos.length}</span>
                <button
                  type="button"
                  className="tbtn pri ml-auto"
                  style={{ height: 28 }}
                  onClick={() => setNovoCandidatoOpen(true)}
                >
                  ＋ Adicionar candidato
                </button>
              </div>
              {candidatos.length === 0 ? (
                <div className="empty-sub">Nenhum candidato vinculado. Use "Adicionar candidato" para começar.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Candidato</th>
                      <th>Fase</th>
                      <th>Origem</th>
                      <th>Score</th>
                      <th style={{ width: 120 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidatos.map(c => (
                      <tr key={c.id}>
                        <td>
                          <div className="tdm">{c.nome}</div>
                          <div className="tds">{c.email || '—'}</div>
                        </td>
                        <td><span className={`bdg ${faseClass(c.fase)}`}>{CANDIDATO_FASE_LABEL[c.fase]}</span></td>
                        <td style={{ fontSize: 12, color: 'var(--mut)' }}>
                          {c.origem === 'indicacao' && c.indicadoPorNome
                            ? `Indicação: ${c.indicadoPorNome}`
                            : c.origem}
                        </td>
                        <td>{typeof c.score === 'number' ? c.score : '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <Link to={`/rh/candidatos/${c.id}`} className="tbtn" style={{ height: 26 }}>Abrir →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <VagaDetalheView vaga={vaga} />
          </>
        )}
      </div>

      {editOpen && vaga && (
        <EditVagaModal
          vaga={vaga}
          onClose={() => setEditOpen(false)}
          onSaved={() => setEditOpen(false)}
        />
      )}

      {novoCandidatoOpen && vaga && (
        <NovoCandidatoModal
          vagas={vagas.length > 0 ? vagas : [vaga]}
          profileName={profile?.name || 'RH'}
          profileUid={profile?.uid || ''}
          vagaIdFixo={vaga.id}
          onClose={() => setNovoCandidatoOpen(false)}
        />
      )}
    </>
  )
}

// ────────────────────────── Modal de edição da vaga ──────────────────────────
function EditVagaModal({ vaga, onClose, onSaved }: {
  vaga: Vaga
  onClose: () => void
  onSaved: () => void
}) {
  // Multi-empresa: vaga pode estar em mais de uma empresa do grupo. Para
  // docs antigos (só `empresa: string`), o helper devolve `[empresa]`.
  const [empresas, setEmpresas] = useState<string[]>(getVagaEmpresas(vaga))
  function toggleEmpresa(emp: string) {
    setEmpresas(prev => prev.includes(emp) ? prev.filter(e => e !== emp) : [...prev, emp])
  }
  const [cargo, setCargo] = useState(vaga.cargo)
  const [time, setTime] = useState(vaga.time)
  const [motivo, setMotivo] = useState<MotivoAbertura>(vaga.motivo)
  const [substituidoNome, setSubstituidoNome] = useState(vaga.substituidoNome || '')
  const [justificativaAumento, setJustificativaAumento] = useState(vaga.justificativaAumento || '')
  const [regime, setRegime] = useState<Regime>(vaga.regime)
  const [nivel, setNivel] = useState<Nivel>(vaga.nivel)
  const [jornada, setJornada] = useState<Jornada>(vaga.jornada)
  const [tempoExperiencia, setTempoExperiencia] = useState<TempoExperiencia>(vaga.tempoExperiencia)
  const [formacao, setFormacao] = useState<Formacao>(vaga.formacao)
  const [cursosValidos, setCursosValidos] = useState(vaga.cursosValidos || '')
  const [descricaoAtividades, setDescricaoAtividades] = useState(vaga.descricaoAtividades)
  const [requisitosTecnicos, setRequisitosTecnicos] = useState(vaga.requisitosTecnicos)
  const [equipamentos, setEquipamentos] = useState(vaga.equipamentos || '')
  const [previstaOrcamento, setPrevistaOrcamento] = useState(vaga.previstaOrcamento)
  const [observacoes, setObservacoes] = useState(vaga.observacoes || '')
  const [gestorUid, setGestorUid] = useState(vaga.gestorUid || '')
  const [gestores, setGestores] = useState<UserProfile[]>([])

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Carrega TODOS os usuários e filtra os com role 'gestor' OU o gestor
  // atual da vaga (caso ele tenha sido promovido a 'rh' após ser vinculado).
  // Sem isso, ao editar a vaga o select não exibiria o gestor atual e o save
  // limparia gestorUid silenciosamente, revogando acesso dele aos candidatos.
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'users')), (snap) => {
      const all = snap.docs.map(d => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) }))
      const list = all.filter(u => u.role === 'gestor' || u.uid === vaga.gestorUid)
      list.sort((a, b) => a.name.localeCompare(b.name))
      setGestores(list)
    })
    return unsub
  }, [vaga.gestorUid])

  // Quando o RH troca o gestor, propagamos vagaGestorUid em todos os candidatos
  // dessa vaga depois do save — caso contrário, a regra do gestor (que filtra
  // candidatos por vagaGestorUid) bloquearia o novo gestor de ver candidatos
  // já cadastrados.
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (empresas.length === 0) {
      setErr('Selecione pelo menos uma empresa do grupo.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      // Detecta se o RH realmente alterou o gestor no select. Se não
      // alterou (gestorUid ainda é o original), não tocamos nesses
      // campos — isso evita silenciar gestorUid='' caso o gestor não
      // esteja mais na lista por algum motivo (race, role mudou etc).
      const gestorChanged = (vaga.gestorUid || '') !== (gestorUid || '')
      const g = gestores.find(x => x.uid === gestorUid)
      const patch: Record<string, unknown> = {
        // Grava no novo formato (array) e também popula `empresa` (string
        // legacy) com a primeira selecionada para compat com listagens.
        empresas,
        empresa: empresas[0],
        cargo, time,
        motivo,
        substituidoNome: motivo === 'substituicao' ? substituidoNome : '',
        justificativaAumento: motivo === 'aumento' ? justificativaAumento : '',
        regime, nivel, jornada, tempoExperiencia, formacao,
        cursosValidos, descricaoAtividades, requisitosTecnicos, equipamentos,
        previstaOrcamento, observacoes,
        updatedAt: serverTimestamp(),
      }
      if (gestorChanged) {
        patch.gestorUid = g?.uid ?? ''
        patch.gestorNome = g?.name ?? ''
        patch.gestorEmail = g?.email ?? ''
      }
      await updateDoc(doc(db, 'vagas', vaga.id), patch)

      // Só propaga vagaGestorUid pros candidatos quando o RH efetivamente
      // mudou o gestor. Sem essa guarda, qualquer save acidentalmente
      // limparia o vagaGestorUid de todos os candidatos quando o gestor
      // atual não estivesse na lista do select.
      if (gestorChanged) {
        const { getDocs } = await import('firebase/firestore')
        const candSnap = await getDocs(query(collection(db, 'candidatos'), where('vagaId', '==', vaga.id)))
        await Promise.allSettled(candSnap.docs.map(d => updateDoc(doc(db, 'candidatos', d.id), {
          vagaGestorUid: g?.uid ?? '',
          updatedAt: serverTimestamp(),
        })))
      }
      onSaved()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  // Nivel/jornada com opção "outro" não rolam aqui pra simplificar (mantemos
  // consistente com o que já era cadastrado). Se o RH precisar, dá pra
  // adicionar campos extras depois.

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 920 }}>
        <h2>Editar vaga</h2>
        <p>Atualize qualquer campo da vaga. Mudanças ficam visíveis pro gestor automaticamente.</p>
        <form onSubmit={handleSubmit} className="row-gap-14">
          {err && <div className="error-text">{err}</div>}

          <div className="panel" style={{ padding: 12 }}>
            <h3 style={{ margin: '0 0 8px' }}>Identificação</h3>
            <div className="form-grid">
              <div className="field full">
                <label>Empresas * <span style={{ color: 'var(--mut)', fontWeight: 400, fontSize: 11 }}>(marque uma ou mais)</span></label>
                <div className="checkbox-grid">
                  {EMPRESA_OPTIONS.map(emp => (
                    <label key={emp} className={'checkbox-option' + (empresas.includes(emp) ? ' selected' : '')}>
                      <input
                        type="checkbox"
                        checked={empresas.includes(emp)}
                        onChange={() => toggleEmpresa(emp)}
                      />
                      {emp}
                    </label>
                  ))}
                  {/* Empresa legada que não está mais na lista oficial — 
                      mantida marcada até o RH desmarcar manualmente. */}
                  {empresas.filter(e => !(EMPRESA_OPTIONS as readonly string[]).includes(e)).map(emp => (
                    <label key={emp} className="checkbox-option selected">
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={() => toggleEmpresa(emp)}
                      />
                      {emp} (legado)
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Cargo (divulgação) *</label>
                <input value={cargo} onChange={(e) => setCargo(e.target.value)} required />
              </div>
              <div className="field">
                <label>Time / Área *</label>
                <input value={time} onChange={(e) => setTime(e.target.value)} required />
              </div>
              <div className="field">
                <label>Gestor responsável</label>
                <select value={gestorUid} onChange={(e) => setGestorUid(e.target.value)}>
                  <option value="">— (não vincular) —</option>
                  {gestores.map(g => <option key={g.uid} value={g.uid}>{g.name} · {g.email}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="panel" style={{ padding: 12 }}>
            <h3 style={{ margin: '0 0 8px' }}>Motivo</h3>
            <div className="radio-group" style={{ marginBottom: 10 }}>
              {([
                { v: 'aumento', l: 'Aumento de quadro' },
                { v: 'substituicao', l: 'Substituição' },
              ] as { v: MotivoAbertura; l: string }[]).map(opt => (
                <label key={opt.v} className={'radio-option' + (motivo === opt.v ? ' selected' : '')}>
                  <input type="radio" checked={motivo === opt.v} onChange={() => setMotivo(opt.v)} /> {opt.l}
                </label>
              ))}
            </div>
            {motivo === 'substituicao' ? (
              <div className="field"><label>Nome da pessoa substituída</label>
                <input value={substituidoNome} onChange={(e) => setSubstituidoNome(e.target.value)} />
              </div>
            ) : (
              <div className="field"><label>Justificativa do aumento</label>
                <textarea value={justificativaAumento} onChange={(e) => setJustificativaAumento(e.target.value)} />
              </div>
            )}
          </div>

          <div className="panel" style={{ padding: 12 }}>
            <h3 style={{ margin: '0 0 8px' }}>Condições</h3>
            <div className="form-grid">
              <div className="field">
                <label>Regime</label>
                <select value={regime} onChange={(e) => setRegime(e.target.value as Regime)}>
                  <option value="CLT">CLT</option>
                  <option value="PJ">PJ</option>
                  <option value="ESTAGIO">Estágio</option>
                  <option value="FREELANCER">Freelancer</option>
                </select>
              </div>
              <div className="field">
                <label>Nível</label>
                <select value={nivel} onChange={(e) => setNivel(e.target.value as Nivel)}>
                  <option value="estagiario">Estagiário</option>
                  <option value="trainee">Trainee</option>
                  <option value="assistente">Assistente</option>
                  <option value="junior">Júnior</option>
                  <option value="pleno">Pleno</option>
                  <option value="senior">Sênior</option>
                  <option value="especialista">Especialista</option>
                  <option value="coordenador">Coordenador</option>
                  <option value="gerente">Gerente</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div className="field">
                <label>Jornada</label>
                <select value={jornada} onChange={(e) => setJornada(e.target.value as Jornada)}>
                  <option value="hibrido">Híbrido</option>
                  <option value="presencial">Presencial</option>
                  <option value="remoto">Remoto</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div className="field">
                <label>Experiência</label>
                <select value={tempoExperiencia} onChange={(e) => setTempoExperiencia(e.target.value as TempoExperiencia)}>
                  <option value="sem_minimo">Sem tempo mínimo</option>
                  <option value="1_3">1 a 3 anos</option>
                  <option value="3_5">3 a 5 anos</option>
                  <option value="5_8">5 a 8 anos</option>
                  <option value="mais_8">Mais de 8 anos</option>
                </select>
              </div>
              <div className="field">
                <label>Formação</label>
                <select value={formacao} onChange={(e) => setFormacao(e.target.value as Formacao)}>
                  <option value="ensino_medio">Ensino médio</option>
                  <option value="superior_incompleto">Superior incompleto</option>
                  <option value="superior_completo">Superior completo</option>
                  <option value="pos">Pós-graduação</option>
                  <option value="mestrado_doutorado">Mestrado / Doutorado</option>
                </select>
              </div>
              <div className="field">
                <label>Prevista no orçamento?</label>
                <div className="radio-group">
                  <label className={'radio-option' + (previstaOrcamento ? ' selected' : '')}>
                    <input type="radio" checked={previstaOrcamento} onChange={() => setPrevistaOrcamento(true)} /> Sim
                  </label>
                  <label className={'radio-option' + (!previstaOrcamento ? ' selected' : '')}>
                    <input type="radio" checked={!previstaOrcamento} onChange={() => setPrevistaOrcamento(false)} /> Não
                  </label>
                </div>
              </div>
              <div className="field full">
                <label>Cursos válidos</label>
                <input value={cursosValidos} onChange={(e) => setCursosValidos(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="panel" style={{ padding: 12 }}>
            <h3 style={{ margin: '0 0 8px' }}>Perfil e requisitos</h3>
            <div className="form-grid">
              <div className="field full"><label>Atividades principais *</label>
                <textarea value={descricaoAtividades} onChange={(e) => setDescricaoAtividades(e.target.value)} required />
              </div>
              <div className="field full"><label>Requisitos técnicos *</label>
                <textarea value={requisitosTecnicos} onChange={(e) => setRequisitosTecnicos(e.target.value)} required />
              </div>
              <div className="field full"><label>Equipamentos</label>
                <textarea value={equipamentos} onChange={(e) => setEquipamentos(e.target.value)} />
              </div>
              <div className="field full"><label>Observações</label>
                <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="hstack" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
