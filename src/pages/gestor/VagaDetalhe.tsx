import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { Link, useParams } from 'react-router-dom'
import { db } from '../../firebase'
import StatusBadge from '../../components/StatusBadge'
import VagaDetalheView from '../shared/VagaDetalheView'
import type { Vaga } from '../../types'

export default function VagaDetalhe() {
  const { id } = useParams<{ id: string }>()
  const [vaga, setVaga] = useState<Vaga | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const unsub = onSnapshot(doc(db, 'vagas', id), (snap) => {
      if (snap.exists()) {
        setVaga({ id: snap.id, ...(snap.data() as Omit<Vaga, 'id'>) })
      } else {
        setVaga(null)
      }
      setLoading(false)
    })
    return unsub
  }, [id])

  if (loading) return <div className="empty-state">Carregando…</div>
  if (!vaga) return <div className="empty-state">Vaga não encontrada.</div>

  return (
    <>
      <div className="page-header">
        <div>
          <Link to="/gestor" className="muted" style={{ fontSize: 13 }}>
            ← Voltar para minhas vagas
          </Link>
          <h1 style={{ marginTop: 8 }}>{vaga.cargo}</h1>
          <p>
            {vaga.empresa} · {vaga.time}
          </p>
        </div>
        <StatusBadge status={vaga.status} />
      </div>
      <VagaDetalheView vaga={vaga} />
    </>
  )
}
