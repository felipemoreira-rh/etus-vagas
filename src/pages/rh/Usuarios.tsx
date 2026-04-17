import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import type { UserProfile, Role } from '../../types'

export default function Usuarios() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('name'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setUsers(
          snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) })),
        )
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
    return unsub
  }, [])

  async function alterarPapel(u: UserProfile, novo: Role) {
    if (!confirm(`Alterar ${u.name} para ${novo.toUpperCase()}?`)) return
    await updateDoc(doc(db, 'users', u.uid), { role: novo })
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Usuários</h1>
          <p>Gerencie acessos de RH e gestores.</p>
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Empresa</th>
              <th>Área</th>
              <th>Perfil</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  Carregando…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  Nenhum usuário cadastrado.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.uid}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.empresa || '—'}</td>
                  <td>{u.area || '—'}</td>
                  <td>
                    <span className={'badge ' + (u.role === 'rh' ? 'badge-contratada' : 'badge-aberta')}>
                      {u.role === 'rh' ? 'RH' : 'Gestor'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '6px 12px', fontSize: 13 }}
                      onClick={() => alterarPapel(u, u.role === 'rh' ? 'gestor' : 'rh')}
                    >
                      Tornar {u.role === 'rh' ? 'Gestor' : 'RH'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
