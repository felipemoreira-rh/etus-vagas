import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import Topbar from '../../components/Topbar'
import StatusBadge from '../../components/StatusBadge'
import VagaDetalheView from '../shared/VagaDetalheView'
import type { Vaga } from '../../types'

export default function GestorVagaDetalhe() {
  const { id } = useParams()
  const [vaga, setVaga] = useState<Vaga | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const unsub = onSnapshot(doc(db, 'vagas', id),
      (snap) => {
        if (!snap.exists()) setErr('Vaga não encontrada.')
        else {
          const v = { id: snap.id, ...(snap.data() as Omit<Vaga, 'id'>) }
          setVaga(v)
        }
        setLoading(false)
      },
      (e) => { setErr(e.message); setLoading(false) })
    return unsub
  }, [id])

  return (
    <>
      <Topbar
        title={vaga?.cargo || 'Detalhe da vaga'}
        icon="◱"
        actions={
          <Link to="/gestor/minhas-vagas" className="tbtn">← Voltar</Link>
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
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{vaga.empresa}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mut)', fontWeight: 700 }}>
                    Time
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{vaga.time}</div>
                </div>
              </div>
            </div>

            <VagaDetalheView vaga={vaga} />
          </>
        )}
      </div>
    </>
  )
}
