import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import { removeFile } from '../../utils/storage'
import type {
  Candidato, CandidatoFase, CandidatoMovimentacao, CandidatoOrigem, Vaga,
} from '../../types'
import {
  CANDIDATO_FASE_LABEL, CANDIDATO_FASE_ORDER, CANDIDATO_ORIGEM_LABEL,
  getVagaEmpresas,
} from '../../types'

function faseClass(f: CandidatoFase) {
  if (f === 'aprovado') return 'ok'
  if (f === 'reprovado' || f === 'desistente') return 'bad'
  if (f === 'proposta') return 'purple'
  if (f === 'entrevista_rh' || f === 'entrevista_gestor' || f === 'entrevista_cultura') return 'warn'
  return 'info'
}

type ViewMode = 'lista' | 'grupo'

export default function Candidatos() {
  const { profile } = useAuth()
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [faseFilter, setFaseFilter] = useState<CandidatoFase | 'todas'>('todas')
  const [vagaFilter, setVagaFilter] = useState<string>('todas')
  const [view, setView] = useState<ViewMode>('grupo')
  const [openModal, setOpenModal] = useState(false)

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, 'candidatos')), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Candidato, 'id'>) }))
      list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
      setCandidatos(list)
      setLoading(false)
    }, () => setLoading(false))
    const u2 = onSnapshot(query(collection(db, 'vagas')), (s) => {
      setVagas(s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Vaga, 'id'>) })))
    })
    return () => { u1(); u2() }
  }, [])

  const filtered = useMemo(() => {
    return candidatos.filter(c => {
      if (faseFilter !== 'todas' && c.fase !== faseFilter) return false
      if (vagaFilter !== 'todas' && c.vagaId !== vagaFilter) return false
      if (search) {
        const s = search.toLowerCase()
        if (!c.nome.toLowerCase().includes(s) && !c.vagaCargo.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [candidatos, faseFilter, vagaFilter, search])

  // Agrupa candidatos por vaga (mantendo a ordem original do filtered).
  // Vagas sem candidatos no filtro também aparecem (quando o filtro de vaga é
  // "todas") para deixar visível "vaga aberta sem candidatos ainda".
  const grupos = useMemo(() => {
    const byVaga = new Map<string, Candidato[]>()
    for (const c of filtered) {
      const arr = byVaga.get(c.vagaId) ?? []
      arr.push(c)
      byVaga.set(c.vagaId, arr)
    }
    const vagasUsadas = vagas.filter(v => byVaga.has(v.id) || vagaFilter === 'todas')
    const lista = vagasUsadas.map(v => ({
      vaga: v,
      candidatos: byVaga.get(v.id) ?? [],
    }))
    lista.sort((a, b) => {
      const ativosA = a.candidatos.filter(c => !['aprovado','reprovado','desistente'].includes(c.fase)).length
      const ativosB = b.candidatos.filter(c => !['aprovado','reprovado','desistente'].includes(c.fase)).length
      if (ativosA !== ativosB) return ativosB - ativosA
      return a.vaga.cargo.localeCompare(b.vaga.cargo)
    })
    // Candidatos órfãos (vagaId que não está mais em vagas — vaga excluída).
    const idsConhecidos = new Set(vagas.map(v => v.id))
    const orfaos = filtered.filter(c => !idsConhecidos.has(c.vagaId))
    if (orfaos.length > 0) {
      lista.push({
        vaga: { id: '__orfaos__', cargo: 'Sem vaga vinculada', empresa: '', time: '' } as Vaga,
        candidatos: orfaos,
      })
    }
    return lista
  }, [filtered, vagas, vagaFilter])

  const porFase = useMemo(() => {
    const map = new Map<CandidatoFase, number>()
    candidatos.forEach(c => map.set(c.fase, (map.get(c.fase) ?? 0) + 1))
    return CANDIDATO_FASE_ORDER.map(f => ({ fase: f, count: map.get(f) ?? 0 }))
  }, [candidatos])

  const ativos = candidatos.filter(c => !['aprovado','reprovado','desistente'].includes(c.fase)).length

  async function excluir(c: Candidato) {
    const txt = `Excluir o candidato "${c.nome}"?\n\nEssa ação é permanente. O histórico e os anexos vinculados (CV + relatórios) serão removidos.`
    if (!confirm(txt)) return
    try {
      const paths: string[] = []
      if (c.curriculumPath) paths.push(c.curriculumPath)
      for (const r of c.relatorios ?? []) {
        if (r.path) paths.push(r.path)
      }
      await Promise.allSettled(paths.map((p) => removeFile(p)))
      await deleteDoc(doc(db, 'candidatos', c.id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao excluir candidato.')
    }
  }

  return (
    <>
      <Topbar
        title="Candidatos"
        icon="◉"
        actions={
          <button className="tbtn pri" onClick={() => setOpenModal(true)}>＋ Novo candidato</button>
        }
      />
      <div className="content">
        <div className="smrow">
          <div className="sm">
            <div className="sm-lbl">Total</div>
            <div className="sm-val">{candidatos.length}</div>
            <div className="sm-sub">candidatos cadastrados</div>
          </div>
          <div className="sm">
            <div className="sm-lbl">Ativos</div>
            <div className="sm-val" style={{ color: 'var(--g600)' }}>{ativos}</div>
            <div className="sm-sub">em processo seletivo</div>
          </div>
          {porFase.slice(0, 4).map(p => (
            <div className="sm" key={p.fase}>
              <div className="sm-lbl">{CANDIDATO_FASE_LABEL[p.fase]}</div>
              <div className="sm-val">{p.count}</div>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="filter-bar">
            <div className="swrap">
              <span className="sico">⌕</span>
              <input className="srch" placeholder="Buscar candidato ou vaga…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select value={faseFilter} onChange={(e) => setFaseFilter(e.target.value as CandidatoFase | 'todas')}>
              <option value="todas">Todas as fases</option>
              {CANDIDATO_FASE_ORDER.map(f => <option key={f} value={f}>{CANDIDATO_FASE_LABEL[f]}</option>)}
            </select>
            <select value={vagaFilter} onChange={(e) => setVagaFilter(e.target.value)}>
              <option value="todas">Todas as vagas</option>
              {vagas.map(v => <option key={v.id} value={v.id}>{v.cargo} · {v.time}</option>)}
            </select>
            <select value={view} onChange={(e) => setView(e.target.value as ViewMode)}>
              <option value="grupo">Agrupar por vaga</option>
              <option value="lista">Lista única</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">◉</div>
              <div className="empty-ttl">Nenhum candidato</div>
              <div className="empty-sub">Cadastre candidatos para começar o pipeline.</div>
            </div>
          ) : view === 'lista' ? (
            <CandidatosTable candidatos={filtered} onExcluir={excluir} />
          ) : (
            <div className="row-gap-14">
              {grupos.map(g => (
                <CandidatosGrupo key={g.vaga.id} vaga={g.vaga} candidatos={g.candidatos} onExcluir={excluir} />
              ))}
            </div>
          )}
        </div>
      </div>

      {openModal && (
        <NovoCandidatoModal
          vagas={vagas}
          profileName={profile?.name || 'RH'}
          profileUid={profile?.uid || ''}
          onClose={() => setOpenModal(false)}
        />
      )}
    </>
  )
}

function CandidatosGrupo({ vaga, candidatos, onExcluir }: {
  vaga: Vaga
  candidatos: Candidato[]
  onExcluir: (c: Candidato) => void
}) {
  const [open, setOpen] = useState(true)
  const ativos = candidatos.filter(c => !['aprovado','reprovado','desistente'].includes(c.fase)).length
  return (
    <div className="panel" style={{ padding: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          background: 'transparent',
          border: 'none',
          borderBottom: open ? '1px solid var(--b1)' : 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--mut)' }}>{open ? '▾' : '▸'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{vaga.cargo}</div>
          <div style={{ fontSize: 11, color: 'var(--mut)' }}>
            {(() => { const empsTxt = getVagaEmpresas(vaga).join(' / '); return empsTxt ? `${empsTxt} · ` : '' })()}{vaga.time || 'sem time'}
            {vaga.id !== '__orfaos__' && ` · `}
            {vaga.id !== '__orfaos__' && (
              <Link to={`/rh/vagas/${vaga.id}`} onClick={(e) => e.stopPropagation()} style={{ color: 'var(--g600)' }}>
                abrir vaga
              </Link>
            )}
          </div>
        </div>
        <span className="bdg info">{candidatos.length} {candidatos.length === 1 ? 'candidato' : 'candidatos'}</span>
        <span className="bdg ok">{ativos} ativos</span>
      </button>
      {open && (
        candidatos.length === 0 ? (
          <div className="empty-sub" style={{ padding: 14 }}>Nenhum candidato vinculado a essa vaga ainda.</div>
        ) : (
          <CandidatosTable candidatos={candidatos} onExcluir={onExcluir} compact />
        )
      )}
    </div>
  )
}

function CandidatosTable({ candidatos, onExcluir, compact }: {
  candidatos: Candidato[]
  onExcluir: (c: Candidato) => void
  compact?: boolean
}) {
  return (
    <div className={compact ? '' : 'panel-scroll'}>
      <table>
        <thead>
          <tr>
            <th>Candidato</th>
            {!compact && <th>Vaga</th>}
            <th>Fase</th>
            <th>Origem</th>
            <th>Score</th>
            <th style={{ width: 140 }}></th>
          </tr>
        </thead>
        <tbody>
          {candidatos.map(c => (
            <tr key={c.id}>
              <td>
                <div className="tdm">{c.nome}</div>
                <div className="tds">{c.email || '—'}</div>
              </td>
              {!compact && <td style={{ fontSize: 12 }}>{c.vagaCargo}</td>}
              <td><span className={`bdg ${faseClass(c.fase)}`}>{CANDIDATO_FASE_LABEL[c.fase]}</span></td>
              <td style={{ fontSize: 12, color: 'var(--mut)' }}>
                {c.origem === 'outro' && c.origemOutro
                  ? c.origemOutro
                  : c.origem === 'indicacao' && c.indicadoPorNome
                    ? `Indicação: ${c.indicadoPorNome}`
                    : CANDIDATO_ORIGEM_LABEL[c.origem]}
              </td>
              <td>
                {typeof c.score === 'number' ? (
                  <span>
                    <span className="scbar"><span className="scfill" style={{ width: `${c.score}%` }} /></span>
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{c.score}</span>
                  </span>
                ) : <span className="muted">—</span>}
              </td>
              <td>
                <div className="hstack" style={{ gap: 6, justifyContent: 'flex-end' }}>
                  <Link to={`/rh/candidatos/${c.id}`} className="tbtn" style={{ height: 26 }}>Abrir →</Link>
                  <button
                    type="button"
                    className="tbtn"
                    onClick={() => onExcluir(c)}
                    title="Excluir candidato"
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
  )
}

export function NovoCandidatoModal({ vagas, profileName, profileUid, onClose, vagaIdFixo, onCreated }: {
  vagas: Vaga[]
  profileName: string
  profileUid: string
  onClose: () => void
  // Quando o modal é aberto a partir do detalhe de uma vaga, fixamos a vaga
  // pra evitar que o RH erre e cadastre o candidato em outra vaga.
  vagaIdFixo?: string
  onCreated?: (id: string) => void
}) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [vagaId, setVagaId] = useState(vagaIdFixo || vagas[0]?.id || '')
  const [origem, setOrigem] = useState<CandidatoOrigem>('linkedin')
  const [origemOutro, setOrigemOutro] = useState('')
  const [indicadoPorNome, setIndicadoPorNome] = useState('')
  const [score, setScore] = useState<number | ''>('')
  const [observacoes, setObservacoes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setSaving(true)
    try {
      const vaga = vagas.find(v => v.id === vagaId)
      if (!vaga) throw new Error('Selecione uma vaga.')
      if (origem === 'indicacao' && !indicadoPorNome.trim()) {
        throw new Error('Informe o nome de quem indicou.')
      }
      const mov: CandidatoMovimentacao = {
        at: Timestamp.now(), byUid: profileUid, byName: profileName,
        toFase: 'triagem', nota: 'Candidato cadastrado.',
      }
      const ref = await addDoc(collection(db, 'candidatos'), {
        nome, email, telefone, linkedin,
        vagaId, vagaCargo: vaga.cargo,
        vagaGestorUid: vaga.gestorUid,
        fase: 'triagem' as CandidatoFase,
        origem,
        ...(origem === 'outro' ? { origemOutro: origemOutro.trim() } : {}),
        ...(origem === 'indicacao' ? { indicadoPorNome: indicadoPorNome.trim() } : {}),
        score: typeof score === 'number' ? score : null,
        observacoes,
        relatorios: [],
        agendamentos: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        historico: [mov],
      })
      onCreated?.(ref.id)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const vagaFixaInfo = vagaIdFixo ? vagas.find(v => v.id === vagaIdFixo) : null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Novo candidato</h2>
        <p>{vagaFixaInfo
          ? `Cadastrando em: ${vagaFixaInfo.cargo} · ${getVagaEmpresas(vagaFixaInfo).join(' / ') || '—'}`
          : 'Cadastre um candidato em uma vaga aberta.'}</p>
        <form onSubmit={handleSubmit} className="row-gap-14">
          {err && <div className="error-text">{err}</div>}
          <div className="field">
            <label>Nome *</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="form-grid">
            <div className="field"><label>E-mail</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="field"><label>Telefone</label><input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
            <div className="field full"><label>LinkedIn</label><input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} /></div>
          </div>
          {!vagaIdFixo && (
            <div className="field">
              <label>Vaga *</label>
              <select value={vagaId} onChange={(e) => setVagaId(e.target.value)} required>
                {vagas.map(v => <option key={v.id} value={v.id}>{v.cargo} · {v.time} · {getVagaEmpresas(v).join(' / ') || '—'}</option>)}
              </select>
            </div>
          )}
          <div className="form-grid">
            <div className="field">
              <label>Origem</label>
              <select value={origem} onChange={(e) => setOrigem(e.target.value as CandidatoOrigem)}>
                <option value="linkedin">LinkedIn</option>
                <option value="indeed">Indeed</option>
                <option value="gupy">Gupy</option>
                <option value="indicacao">Indicação</option>
                <option value="site_etus">Site ETUS</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div className="field">
              <label>Score inicial (0-100)</label>
              <input type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
          </div>
          {origem === 'indicacao' && (
            <div className="field">
              <label>Nome de quem indicou *</label>
              <input
                value={indicadoPorNome}
                onChange={(e) => setIndicadoPorNome(e.target.value)}
                placeholder="Ex.: Maria Silva"
                required
              />
              <small style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4, display: 'block' }}>
                Quando o candidato for aprovado, o sistema inicia um countdown de 90 dias para liberar o bônus de indicação.
              </small>
            </div>
          )}
          {origem === 'outro' && (
            <div className="field">
              <label>Especifique a origem</label>
              <input value={origemOutro} onChange={(e) => setOrigemOutro(e.target.value)} />
            </div>
          )}
          <div className="field"><label>Observações</label><textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>
          <div className="hstack" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando…' : 'Cadastrar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
