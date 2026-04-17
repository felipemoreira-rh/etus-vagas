import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import type { Role, UserProfile } from '../../types'

export default function Usuarios() {
  const { profile } = useAuth()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) }))
      list.sort((a, b) => a.name.localeCompare(b.name))
      setUsers(list)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  async function changeRole(u: UserProfile, role: Role) {
    if (u.uid === profile?.uid) return
    await updateDoc(doc(db, 'users', u.uid), { role })
  }

  return (
    <>
      <Topbar title="Usuários" icon="◔" />
      <div className="content">
        <div className="panel">
          <h3>Acesso e perfis</h3>
          <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
            Promova ou rebaixe contas entre <b>RH</b> e <b>Gestor</b>. Apenas contas com papel RH acessam todos os módulos.
          </p>
          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : users.length === 0 ? (
            <div className="empty-state">Sem usuários.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Empresa</th>
                  <th>Área</th>
                  <th>Papel</th>
                  <th style={{ width: 160 }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.uid}>
                    <td><div className="tdm">{u.name}</div></td>
                    <td style={{ fontSize: 12, color: 'var(--mut)' }}>{u.email}</td>
                    <td style={{ fontSize: 12, color: 'var(--mut)' }}>{u.empresa || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--mut)' }}>{u.area || '—'}</td>
                    <td>
                      <span className={`bdg ${u.role === 'rh' ? 'ok' : 'info'}`}>
                        {u.role === 'rh' ? 'RH' : 'Gestor'}
                      </span>
                    </td>
                    <td>
                      <select
                        value={u.role}
                        disabled={u.uid === profile?.uid}
                        onChange={(e) => changeRole(u, e.target.value as Role)}
                        style={{ fontSize: 11, padding: '4px 6px' }}
                      >
                        <option value="gestor">Gestor</option>
                        <option value="rh">RH</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
