import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import type { Candidato, CandidatoFase } from '../../types'
import { CANDIDATO_FASE_LABEL, CANDIDATO_FASE_ORDER, CANDIDATO_ORIGEM_LABEL } from '../../types'

function faseClass(f: CandidatoFase) {
  if (f === 'aprovado') return 'ok'
  if (f === 'reprovado' || f === 'desistente') return 'bad'
  if (f === 'proposta') return 'purple'
  if (f === 'entrevista_rh' || f === 'entrevista_gestor' || f === 'entrevista_cultura') return 'warn'
  return 'info'
}

export default function GestorCandidatos() {
  const { profile } = useAuth()
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [faseFilter, setFaseFilter] = useState<CandidatoFase | 'todas'>('todas')
  const [vagaFilter, setVagaFilter] = useState<string>('todas')

  useEffect(() => {
    if (!profile) return
    // Só candidatos das vagas deste gestor (vagaGestorUid == meu uid)
    const q = query(
      collection(db, 'candidatos'),
      where('vagaGestorUid', '==', profile.uid),
    )
    const unsub = onSnapshot(q, (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Candidato, 'id'>) }))
      list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
      setCandidatos(list)
      setLoading(false)
    }, (e) => { setErr(e.message); setLoading(false) })
    return unsub
  }, [profile])

  const vagas = useMemo(() => {
    const m = new Map<string, string>()
    candidatos.forEach(c => { if (c.vagaId) m.set(c.vagaId, c.vagaCargo) })
    return [...m.entries()]
  }, [candidatos])

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
  }, [candidatos, search, faseFilter, vagaFilter])

  const ativos = candidatos.filter(c => !['aprovado', 'reprovado', 'desistente'].includes(c.fase)).length

  return (
    <>
      <Topbar title="Candidatos" icon="◉" />
      <div className="content">
        <div className="smrow">
          <div className="sm">
            <div className="sm-lbl">Total</div>
            <div className="sm-val">{candidatos.length}</div>
            <div className="sm-sub">candidatos nas suas vagas</div>
          </div>
          <div className="sm">
            <div className="sm-lbl">Ativos</div>
            <div className="sm-val" style={{ color: 'var(--g600)' }}>{ativos}</div>
            <div className="sm-sub">em processo</div>
          </div>
          <div className="sm">
            <div className="sm-lbl">Vagas envolvidas</div>
            <div className="sm-val">{vagas.length}</div>
            <div className="sm-sub">com candidatos cadastrados</div>
          </div>
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
              {vagas.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>

          {err && <div className="error-text">{err}</div>}
          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">◉</div>
              <div className="empty-ttl">Nenhum candidato</div>
              <div className="empty-sub">
                Assim que o RH cadastrar candidatos nas suas vagas, eles aparecem aqui automaticamente.
              </div>
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
                    <th style={{ width: 90 }}></th>
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
                        <Link to={`/gestor/candidatos/${c.id}`} className="tbtn" style={{ height: 26 }}>Abrir →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
