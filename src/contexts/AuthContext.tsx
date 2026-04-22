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
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'
import type { Role, UserProfile } from '../types'
import { isEmailAllowed } from '../utils/authAllowlist'

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
            if (isGoogle && u.email && isEmailAllowed(u.email)) {
              const defaults = {
                email: u.email,
                name: u.displayName ?? u.email,
                role: 'gestor' as Role,
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
