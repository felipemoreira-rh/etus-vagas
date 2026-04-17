import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  addDoc, collection, onSnapshot, query, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import type {
  Candidato, CandidatoFase, CandidatoMovimentacao, CandidatoOrigem, Vaga,
} from '../../types'
import {
  CANDIDATO_FASE_LABEL, CANDIDATO_FASE_ORDER, CANDIDATO_ORIGEM_LABEL,
} from '../../types'

function faseClass(f: CandidatoFase) {
  if (f === 'aprovado') return 'ok'
  if (f === 'reprovado' || f === 'desistente') return 'bad'
  if (f === 'proposta') return 'purple'
  if (f === 'entrevista_rh' || f === 'entrevista_gestor' || f === 'entrevista_cultura') return 'warn'
  return 'info'
}

export default function Candidatos() {
  const { profile } = useAuth()
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [faseFilter, setFaseFilter] = useState<CandidatoFase | 'todas'>('todas')
  const [vagaFilter, setVagaFilter] = useState<string>('todas')
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

  const porFase = useMemo(() => {
    const map = new Map<CandidatoFase, number>()
    candidatos.forEach(c => map.set(c.fase, (map.get(c.fase) ?? 0) + 1))
    return CANDIDATO_FASE_ORDER.map(f => ({ fase: f, count: map.get(f) ?? 0 }))
  }, [candidatos])

  const ativos = candidatos.filter(c => !['aprovado','reprovado','desistente'].includes(c.fase)).length

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
          </div>

          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">◉</div>
              <div className="empty-ttl">Nenhum candidato</div>
              <div className="empty-sub">Cadastre candidatos para começar o pipeline.</div>
            </div>
          ) : (
            <div className="panel-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Candidato</th>
                    <th>Vaga</th>
                    <th>Fase</th>
                    <th>Origem</th>
                    <th>Score</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id}>
                      <td>
                        <div className="tdm">{c.nome}</div>
                        <div className="tds">{c.email || '—'}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>{c.vagaCargo}</td>
                      <td><span className={`bdg ${faseClass(c.fase)}`}>{CANDIDATO_FASE_LABEL[c.fase]}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--mut)' }}>
                        {c.origem === 'outro' && c.origemOutro ? c.origemOutro : CANDIDATO_ORIGEM_LABEL[c.origem]}
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
                        <Link to={`/rh/candidatos/${c.id}`} className="tbtn" style={{ height: 26 }}>Abrir →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

function NovoCandidatoModal({ vagas, profileName, profileUid, onClose }: {
  vagas: Vaga[]
  profileName: string
  profileUid: string
  onClose: () => void
}) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [vagaId, setVagaId] = useState(vagas[0]?.id || '')
  const [origem, setOrigem] = useState<CandidatoOrigem>('linkedin')
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
      const mov: CandidatoMovimentacao = {
        at: Timestamp.now(), byUid: profileUid, byName: profileName,
        toFase: 'triagem', nota: 'Candidato cadastrado.',
      }
      await addDoc(collection(db, 'candidatos'), {
        nome, email, telefone, linkedin,
        vagaId, vagaCargo: vaga.cargo,
        fase: 'triagem' as CandidatoFase,
        origem,
        score: typeof score === 'number' ? score : null,
        observacoes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        historico: [mov],
      })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Novo candidato</h2>
        <p>Cadastre um candidato em uma vaga aberta.</p>
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
          <div className="field">
            <label>Vaga *</label>
            <select value={vagaId} onChange={(e) => setVagaId(e.target.value)} required>
              {vagas.map(v => <option key={v.id} value={v.id}>{v.cargo} · {v.time} · {v.empresa}</option>)}
            </select>
          </div>
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
