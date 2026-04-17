import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  arrayUnion, doc, onSnapshot, serverTimestamp, Timestamp, updateDoc,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import type { Candidato, CandidatoFase, CandidatoMovimentacao } from '../../types'
import { CANDIDATO_FASE_LABEL, CANDIDATO_FASE_ORDER, CANDIDATO_ORIGEM_LABEL } from '../../types'

function formatDate(ts?: { toDate: () => Date } | null) {
  if (!ts) return '—'
  try { return ts.toDate().toLocaleString('pt-BR') } catch { return '—' }
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

  async function movimentar(e: FormEvent) {
    e.preventDefault()
    if (!c || !profile) return
    setSaving(true)
    try {
      const mov: CandidatoMovimentacao = {
        at: Timestamp.now(),
        byUid: profile.uid, byName: profile.name,
        fromFase: c.fase, toFase: novaFase, nota: nota || undefined,
      }
      await updateDoc(doc(db, 'candidatos', c.id), {
        fase: novaFase,
        score: typeof score === 'number' ? score : null,
        updatedAt: serverTimestamp(),
        historico: arrayUnion(mov),
      })
      setNota('')
    } finally { setSaving(false) }
  }

  return (
    <>
      <Topbar
        title={c?.nome || 'Candidato'}
        icon="◉"
        actions={<Link to="/rh/candidatos" className="tbtn">← Voltar</Link>}
      />
      <div className="content">
        {err && <div className="error-text">{err}</div>}
        {!c && !err && <div className="empty-state">Carregando…</div>}
        {c && (
          <>
            <div className="body-grid bg-2">
              <div className="panel">
                <h3>Dados do candidato</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  <Info label="Nome" value={c.nome} />
                  <Info label="E-mail" value={c.email} />
                  <Info label="Telefone" value={c.telefone} />
                  <Info label="LinkedIn" value={c.linkedin} />
                  <Info label="Vaga" value={c.vagaCargo} />
                  <Info label="Origem" value={c.origem === 'outro' ? c.origemOutro || 'Outro' : CANDIDATO_ORIGEM_LABEL[c.origem]} />
                  <Info label="Fase atual" value={CANDIDATO_FASE_LABEL[c.fase]} />
                  <Info label="Score" value={typeof c.score === 'number' ? `${c.score}/100` : '—'} />
                </div>
                {c.observacoes && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--mut)', fontWeight: 700, marginBottom: 4 }}>Observações</div>
                    <div style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--n700)' }}>{c.observacoes}</div>
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
