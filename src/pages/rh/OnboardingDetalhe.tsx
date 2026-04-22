import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { doc, onSnapshot, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import type { Onboarding } from '../../types'

export default function OnboardingDetalhe() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [ob, setOb] = useState<Onboarding | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const unsub = onSnapshot(doc(db, 'onboarding', id),
      (snap) => {
        if (!snap.exists()) setErr('Onboarding não encontrado.')
        else setOb({ id: snap.id, ...(snap.data() as Omit<Onboarding, 'id'>) })
      },
      (e) => setErr(e.message))
    return unsub
  }, [id])

  async function toggleItem(itemId: string) {
    if (!ob || !profile) return
    const updated = (ob.checklist || []).map(c => {
      if (c.id !== itemId) return c
      return {
        ...c,
        done: !c.done,
        doneAt: !c.done ? Timestamp.now() : undefined,
        doneByUid: !c.done ? profile.uid : undefined,
        doneByName: !c.done ? profile.name : undefined,
      }
    })
    const allDone = updated.every(c => c.done)
    const anyDone = updated.some(c => c.done)
    const status = allDone ? 'concluido' : anyDone ? 'em_andamento' : 'pendente'
    await updateDoc(doc(db, 'onboarding', ob.id), {
      checklist: updated,
      status,
      updatedAt: serverTimestamp(),
    })
  }

  const done = (ob?.checklist || []).filter(c => c.done).length
  const total = (ob?.checklist || []).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <>
      <Topbar
        title={ob?.candidatoNome || 'Onboarding'}
        icon="⚑"
        actions={<Link to="/rh/onboarding" className="tbtn">← Voltar</Link>}
      />
      <div className="content">
        {err && <div className="error-text">{err}</div>}
        {!ob && !err && <div className="empty-state">Carregando…</div>}
        {ob && (
          <>
            <div className="panel">
              <div className="hstack" style={{ marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--mut)', fontWeight: 700, marginBottom: 4 }}>Candidato</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{ob.candidatoNome}</div>
                </div>
                <div style={{ marginLeft: 40 }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--mut)', fontWeight: 700, marginBottom: 4 }}>Vaga</div>
                  <div style={{ fontSize: 13 }}>{ob.vagaCargo}</div>
                </div>
                <div style={{ marginLeft: 40 }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--mut)', fontWeight: 700, marginBottom: 4 }}>Empresa</div>
                  <div style={{ fontSize: 13 }}>{ob.empresa || '—'}</div>
                </div>
                <div className="ml-auto" style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--mut)', fontWeight: 700, marginBottom: 4 }}>Progresso</div>
                  <div className="hstack">
                    <span className="scbar" style={{ width: 100 }}>
                      <span className="scfill" style={{ width: `${pct}%` }} />
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{pct}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel">
              <h3>Checklist de integração</h3>
              <div style={{ marginTop: 10 }}>
                {(ob.checklist || []).map(item => (
                  <div
                    key={item.id}
                    className={`checklist-item ${item.done ? 'done' : ''}`}
                    onClick={() => toggleItem(item.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => toggleItem(item.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div>
                      <div className="cl-title">{item.titulo}</div>
                      {item.descricao && <div className="cl-sub">{item.descricao}</div>}
                      {item.done && item.doneByName && (
                        <div className="cl-sub">Concluído por {item.doneByName}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
