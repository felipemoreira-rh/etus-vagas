import { useEffect, useState, type FormEvent } from 'react'
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth'
import { db, getSecondaryAuth, getSecondaryDb } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import type { Role, UserProfile } from '../../types'

export default function Usuarios() {
  const { profile } = useAuth()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(false)

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

  async function excluirAcesso(u: UserProfile) {
    if (u.uid === profile?.uid) return
    const txt = `Remover o acesso de "${u.name}" (${u.email})?\n\n` +
      `Isto apaga o perfil do Firestore — a pessoa não conseguirá mais usar o sistema.\n` +
      `A conta no Firebase Authentication permanece existindo; pra removê-la por completo use o console Firebase.\n\n` +
      `Confirmar?`
    if (!confirm(txt)) return
    try {
      await deleteDoc(doc(db, 'users', u.uid))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao remover acesso.')
    }
  }

  return (
    <>
      <Topbar
        title="Usuários"
        icon="◔"
        actions={<button className="tbtn pri" onClick={() => setOpenModal(true)}>＋ Novo usuário</button>}
      />
      <div className="content">
        <div className="panel">
          <h3>Acesso e perfis</h3>
          <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
            Crie contas novas no botão acima ou promova/rebaixe contas existentes entre <b>RH</b> e <b>Gestor</b>. Apenas contas RH acessam todos os módulos.
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
                      <div className="hstack" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        <select
                          value={u.role}
                          disabled={u.uid === profile?.uid}
                          onChange={(e) => changeRole(u, e.target.value as Role)}
                          style={{ fontSize: 11, padding: '4px 6px' }}
                        >
                          <option value="gestor">Gestor</option>
                          <option value="rh">RH</option>
                        </select>
                        <button
                          type="button"
                          className="tbtn"
                          disabled={u.uid === profile?.uid}
                          onClick={() => excluirAcesso(u)}
                          title={u.uid === profile?.uid ? 'Você não pode remover seu próprio acesso' : 'Remover acesso'}
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
          )}
        </div>
      </div>

      {openModal && <NovoUsuarioModal onClose={() => setOpenModal(false)} />}
    </>
  )
}

function genPassword() {
  // Senha temporária forte. Evita caracteres ambíguos (0/O, 1/l, I) pra ser
  // fácil de ditar pra pessoa no WhatsApp ou e-mail.
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%&*'
  const all = alpha + digits + symbols
  let pw = ''
  pw += alpha[Math.floor(Math.random() * alpha.length)]
  pw += digits[Math.floor(Math.random() * digits.length)]
  pw += symbols[Math.floor(Math.random() * symbols.length)]
  for (let i = 0; i < 9; i++) pw += all[Math.floor(Math.random() * all.length)]
  return pw.split('').sort(() => Math.random() - 0.5).join('')
}

function NovoUsuarioModal({ onClose }: { onClose: () => void }) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState(() => genPassword())
  const [role, setRole] = useState<Role>('gestor')
  const [empresa, setEmpresa] = useState('')
  const [area, setArea] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [criado, setCriado] = useState<{ email: string, senha: string } | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setSaving(true)
    const secondaryAuth = getSecondaryAuth()
    const secondaryDb = getSecondaryDb()
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), senha)
      await updateProfile(cred.user, { displayName: nome })
      // Grava o doc users/{uid} usando o db secundário — onde request.auth é
      // o novo usuário, satisfazendo a regra `request.auth.uid == uid`.
      await setDoc(doc(secondaryDb, 'users', cred.user.uid), {
        email: email.trim(),
        name: nome,
        role,
        empresa: empresa || '',
        area: area || '',
        createdAt: serverTimestamp(),
      })
      setCriado({ email: email.trim(), senha })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao criar usuário.')
    } finally {
      // Desloga a instância secundária pra não ficar autenticada como o novo usuário.
      try { await signOut(secondaryAuth) } catch { /* ignore */ }
      setSaving(false)
    }
  }

  async function copiar(txt: string) {
    try { await navigator.clipboard.writeText(txt) } catch { /* ignore */ }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Novo usuário</h2>
        {criado ? (
          <div className="row-gap-14">
            <p style={{ fontSize: 13, marginTop: 0 }}>
              Conta criada. Copie os dados abaixo e envie para a pessoa — a senha não fica visível
              depois que você fechar este modal.
            </p>
            <div className="panel" style={{ padding: 12 }}>
              <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12 }}><b>E-mail:</b> {criado.email}</div>
                <button type="button" className="tbtn" onClick={() => copiar(criado.email)}>Copiar</button>
              </div>
              <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <div style={{ fontSize: 12 }}><b>Senha:</b> <code>{criado.senha}</code></div>
                <button type="button" className="tbtn" onClick={() => copiar(criado.senha)}>Copiar</button>
              </div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--mut)', margin: 0 }}>
              Oriente a pessoa a trocar a senha no primeiro acesso.
            </p>
            <div className="hstack" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-primary" onClick={onClose}>Concluir</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="row-gap-14">
            {err && <div className="error-text">{err}</div>}
            <div className="form-grid">
              <div className="field">
                <label>Nome completo *</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} required />
              </div>
              <div className="field">
                <label>E-mail *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Senha temporária *</label>
                <div className="hstack" style={{ gap: 6 }}>
                  <input
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    minLength={6}
                    style={{ flex: 1, fontFamily: 'monospace' }}
                  />
                  <button type="button" className="tbtn" onClick={() => setSenha(genPassword())} title="Gerar nova senha">↻</button>
                </div>
              </div>
              <div className="field">
                <label>Perfil *</label>
                <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value="gestor">Gestor</option>
                  <option value="rh">RH</option>
                </select>
              </div>
              <div className="field">
                <label>Empresa</label>
                <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Ex.: ETUS" />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Área / Time</label>
                <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Ex.: Tecnologia" />
              </div>
            </div>
            <div className="hstack" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Criando…' : 'Criar conta'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
