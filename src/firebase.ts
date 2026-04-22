import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

function assertConfig() {
  const missing: string[] = []
  Object.entries(firebaseConfig).forEach(([k, v]) => {
    if (!v) missing.push(k)
  })
  if (missing.length > 0) {
     
    console.warn(
      `[ETUS Vagas] Firebase não configurado. Preencha o .env.local (faltando: ${missing.join(', ')}).`,
    )
  }
}
assertConfig()

export const app: FirebaseApp = initializeApp(firebaseConfig)
export const auth: Auth = getAuth(app)
export const db: Firestore = getFirestore(app)
export const storage: FirebaseStorage = getStorage(app)

// Instância secundária do Firebase App, usada apenas pra permitir que um
// admin (RH) crie contas de outros usuários sem ser deslogado. Chamar
// `createUserWithEmailAndPassword` no auth principal desloga o admin;
// usando um auth secundário, o admin permanece logado na instância principal.
// Após criar a conta, o secundário fica momentaneamente autenticado como o
// novo usuário — usamos o `db` secundário (isolado) pra gravar users/{uid}
// atendendo a regra `request.auth.uid == uid`, e depois damos signOut.
const SECONDARY_NAME = 'etus-admin-create'
function getSecondaryApp(): FirebaseApp {
  const existing = getApps().find((a) => a.name === SECONDARY_NAME)
  return existing ?? initializeApp(firebaseConfig, SECONDARY_NAME)
}
export function getSecondaryAuth(): Auth {
  return getAuth(getSecondaryApp())
}
export function getSecondaryDb(): Firestore {
  return getFirestore(getSecondaryApp())
}
export { getApp }
