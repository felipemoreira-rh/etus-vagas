import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import {
  collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc,
  updateDoc, where,
} from 'firebase/firestore'
import { auth, db } from '../firebase'
import type { Role, UserProfile } from '../types'

export const BLOCKED_USERS_COLLECTION = 'blocked_users'

interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (args: {
    email: string
    password: string
    name: string
    role: Role
    empresa?: string
    area?: string
  }) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// Tenta encontrar a pessoa em `estagiarios` ou `colaboradores` por email
// e cria o user doc + grava uid de volta no cadastro. Retorna o profile
// criado, ou null se não achou ninguém.
async function tryAutoLinkPessoa(
  uid: string,
  email: string,
  displayName: string | null,
): Promise<UserProfile | null> {
  const emailLow = email.toLowerCase()
  // RH muitas vezes salva o email com maiúsculas. A query `where == emailLow`
  // não casa nesse caso. Pra dar conta, tentamos a versão lowercased e a
  // original. Ambas passam pela rule `pessoaEmailMatchesMe()` (case-insensitive).
  const emailVariants = email === emailLow ? [emailLow] : [emailLow, email]

  // Estagiário primeiro (cadastros mais novos). Tentamos pelo `email` e
  // pelo `emailCorporativo` separadamente já que o Firestore não suporta OR
  // entre campos diferentes na mesma query simples.
  const esCol = collection(db, 'estagiarios')
  for (const field of ['email', 'emailCorporativo']) for (const variant of emailVariants) {
    const q = query(esCol, where(field, '==', variant), limit(1))
    const snap = await getDocs(q)
    if (!snap.empty) {
      const d = snap.docs[0]
      const data = d.data() as { nome?: string; empresa?: string; area?: string }
      const userDoc = {
        email: emailLow,
        name: displayName ?? data.nome ?? emailLow,
        role: 'estagiario' as Role,
        empresa: data.empresa ?? '',
        area: data.area ?? '',
        pessoaId: d.id,
        pessoaTipo: 'estagiario' as const,
        createdAt: serverTimestamp(),
      }
      await setDoc(doc(db, 'users', uid), userDoc)
      // Grava uid no cadastro pra que o RH consiga ver o vínculo.
      // Se a rule recusar, ainda assim o login segue OK — só o vínculo
      // visível pelo RH fica pendente até alguém atualizar manualmente.
      try {
        await updateDoc(doc(db, 'estagiarios', d.id), { uid })
      } catch { /* rule pode não permitir; segue o jogo */ }
      return { uid, ...userDoc, createdAt: undefined }
    }
  }

  // Colaboradores: a coleção é única, mas o role do user depende do
  // regime (clt → colaborador, pj/freelancer → prestador).
  const colCol = collection(db, 'colaboradores')
  for (const field of ['email', 'emailCorporativo']) {
    const q = query(colCol, where(field, '==', emailLow), limit(1))
    const snap = await getDocs(q)
    if (!snap.empty) {
      const d = snap.docs[0]
      const data = d.data() as {
        nome?: string; empresa?: string; area?: string; regime?: string
      }
      const isPJ = data.regime === 'pj' || data.regime === 'freelancer'
      const role: Role = isPJ ? 'prestador' : 'colaborador'
      const userDoc = {
        email: emailLow,
        name: displayName ?? data.nome ?? emailLow,
        role,
        empresa: data.empresa ?? '',
        area: data.area ?? '',
        pessoaId: d.id,
        pessoaTipo: (isPJ ? 'prestador' : 'colaborador') as 'colaborador' | 'prestador',
        createdAt: serverTimestamp(),
      }
      await setDoc(doc(db, 'users', uid), userDoc)
      try {
        await updateDoc(doc(db, 'colaboradores', d.id), { uid })
      } catch { /* rule pode recusar; segue */ }
      return { uid, ...userDoc, createdAt: undefined }
    }
  }

  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        try {
          const ref = doc(db, 'users', u.uid)
          const snap = await getDoc(ref)
          if (snap.exists()) {
            setProfile({ uid: u.uid, ...(snap.data() as Omit<UserProfile, 'uid'>) })
          } else {
            // Primeiro login via Google: o doc ainda não existe — signInWithPopup
            // cria só a conta no Firebase Auth. Criamos aqui, dentro do próprio
            // callback de onAuthStateChanged, pra evitar a race com Login.tsx.
            // Se o doc fosse criado depois, o listener já teria lido null e
            // o RoleRedirect mandaria o usuário de volta pro /login.
            const isGoogle = u.providerData.some((p) => p.providerId === 'google.com')
            if (isGoogle && u.email) {
              // Antes de criar o doc, verifica se esse uid foi bloqueado
              // pelo RH (fluxo "Remover acesso" na tela Usuários).
              const blockedRef = doc(db, BLOCKED_USERS_COLLECTION, u.uid)
              const blockedSnap = await getDoc(blockedRef)
              if (blockedSnap.exists()) {
                await signOut(auth)
                setProfile(null)
                setLoading(false)
                return
              }

              // 1) Tenta vincular a um cadastro em estagiarios/colaboradores
              //    pelo email — assim a pessoa entra direto no portal /me
              //    sem precisar do RH pré-criar usuário com email+senha.
              const linked = await tryAutoLinkPessoa(u.uid, u.email, u.displayName)
              if (linked) {
                setProfile(linked)
                setLoading(false)
                return
              }

              // 2) Fallback: toda nova conta (Google sem cadastro prévio)
              //    entra como `prestador`. O RH faz o ajuste de perfil
              //    (gestor / RH / colaborador / estagiário) dentro do sistema
              //    depois, na tela Usuários. Antes, o domínio @etus virava
              //    gestor automático — agora qualquer domínio cai aqui.
              const defaults = {
                email: u.email,
                name: u.displayName ?? u.email,
                role: 'prestador' as Role,
                empresa: '',
                area: '',
                createdAt: serverTimestamp(),
              }
              await setDoc(ref, defaults)
              setProfile({
                uid: u.uid,
                email: defaults.email,
                name: defaults.name,
                role: defaults.role,
                empresa: defaults.empresa,
                area: defaults.area,
              })
            } else {
              setProfile(null)
            }
          }
        } catch (err) {
          console.error('Erro ao carregar perfil:', err)
          setProfile(null)
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function signup(args: {
    email: string
    password: string
    name: string
    role: Role
    empresa?: string
    area?: string
  }) {
    const cred = await createUserWithEmailAndPassword(auth, args.email, args.password)
    await updateProfile(cred.user, { displayName: args.name })
    const userDoc: Omit<UserProfile, 'uid' | 'createdAt'> & { createdAt: ReturnType<typeof serverTimestamp> } = {
      email: args.email,
      name: args.name,
      role: args.role,
      empresa: args.empresa ?? '',
      area: args.area ?? '',
      createdAt: serverTimestamp(),
    }
    await setDoc(doc(db, 'users', cred.user.uid), userDoc)
  }

  async function logout() {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
