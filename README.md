# ETUS · Sistema de Abertura de Vagas

Sistema web para o Grupo ETUS gerenciar abertura de vagas pelos gestores e acompanhamento/movimentação pelo time de RH (Time de Gente), construído com **React + Vite + Firebase (Auth + Firestore)**.

- **Gestor**: abre novas vagas (formulário baseado no questionário atual), acompanha o andamento e consulta histórico.
- **RH**: vê dashboard consolidado (KPIs, gráficos por status, empresa, time, regime), lista todas as vagas, movimenta status, registra notas e gerencia permissões de usuários.

Tipografia **Space Grotesk** e paleta da marca aplicadas via CSS variables (`src/index.css`).

---

## 1. Pré-requisitos (Windows)

Instale uma vez só:

1. **Git**: https://git-scm.com/download/win
2. **Node.js LTS (20+)**: https://nodejs.org/
3. (Opcional, para deploy) **Firebase CLI** — ver seção 5.

Depois de instalar, feche e reabra o PowerShell e verifique:

```powershell
node --version
npm --version
git --version
```

---

## 2. Clonar e instalar dependências (PowerShell)

Você disse que já criou a pasta `C:\Users\ETUS-0005\Desktop\etus-vagas`. Como o código fica em GitHub, use a pasta pai (`Desktop`) para clonar — o próprio `git clone` cria a pasta:

```powershell
cd C:\Users\ETUS-0005\Desktop
# Se a pasta etus-vagas já existe e está vazia, remova antes:
Remove-Item -Recurse -Force .\etus-vagas -ErrorAction SilentlyContinue

git clone https://github.com/felipemoreira-rh/etus-vagas.git
cd .\etus-vagas
npm install
```

---

## 3. Criar o projeto Firebase (passo a passo)

1. Acesse https://console.firebase.google.com/ → **Adicionar projeto**.
2. Nome sugerido: `etus-vagas`. Avance até o fim (pode desabilitar Google Analytics).
3. No painel do projeto, clique no ícone **</>** (Web) para registrar um **app web**.
   - Apelido do app: `etus-vagas-web`.
   - **Não** marque "Configurar o Firebase Hosting agora" (faremos depois).
   - Clique em **Registrar app** — a tela mostra o `firebaseConfig`. Deixe aberta.
4. Na lateral do console, abra **Build → Authentication → Get started**.
   - Aba **Sign-in method** → habilite **E-mail/senha**.
5. Abra **Build → Firestore Database → Criar banco de dados**.
   - Modo: **Produção** (vamos aplicar regras próprias). Região: `southamerica-east1` (São Paulo).
6. Ainda no Firestore, aba **Rules** → cole o conteúdo de `firestore.rules` deste repositório e **Publicar**. Essas regras impedem que gestores vejam vagas de outros gestores e garantem que só RH movimenta status.

---

## 4. Plugar as credenciais no app (PowerShell)

Volte ao terminal na pasta `etus-vagas` e crie o arquivo `.env.local`:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

Preencha os valores que apareceram no `firebaseConfig` (passo 3.3):

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=etus-vagas.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=etus-vagas
VITE_FIREBASE_STORAGE_BUCKET=etus-vagas.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=1:...:web:...
```

Rode a aplicação:

```powershell
npm run dev
```

Acesse http://localhost:5173 .

### Criando o primeiro usuário RH

1. Na tela de login, clique em **Criar conta** e cadastre-se selecionando perfil **RH**.
2. Por padrão qualquer pessoa pode se cadastrar como RH na primeira vez. Depois que o time de Gente estiver no ar, recomende que o RH sempre cadastre os gestores com perfil **Gestor** e promova novos RHs apenas pela aba **Usuários**.
3. Você pode também editar o documento do usuário diretamente no Firestore (coleção `users`, campo `role`) em caso de emergência.

---

## 5. (Opcional) Publicar no Firebase Hosting

No PowerShell, dentro da pasta do projeto:

```powershell
npm install -g firebase-tools
firebase login
firebase use --add        # selecione o projeto etus-vagas
npm run build
firebase deploy --only hosting
```

Para publicar as regras do Firestore:

```powershell
firebase deploy --only firestore:rules
```

---

## 6. Scripts disponíveis

| Script          | O que faz                                  |
| --------------- | ------------------------------------------ |
| `npm run dev`   | Sobe o servidor de desenvolvimento (Vite). |
| `npm run build` | Gera o build de produção em `dist/`.       |
| `npm run preview` | Serve o build local para validação.       |
| `npm run lint`  | Roda o ESLint.                             |

---

## 7. Estrutura do projeto

```
src/
  components/        Layout, Sidebar, StatusBadge, KpiCard, ProtectedRoute
  contexts/          AuthContext (login, signup, profile/role)
  pages/
    Login.tsx        Signup.tsx
    gestor/          MinhasVagas, NovaVaga, VagaDetalhe
    rh/              Dashboard, TodasVagas, VagaDetalhe, Usuarios
    shared/          VagaDetalheView (visual da vaga compartilhado)
  firebase.ts        Inicialização do SDK do Firebase
  types.ts           Tipagens (Vaga, UserProfile, VagaStatus…)
  index.css          Tema com Space Grotesk e paleta ETUS
```

### Modelo de dados no Firestore

- **`users/{uid}`**: `{ name, email, role: 'rh' | 'gestor', empresa, area, createdAt }`
- **`vagas/{vagaId}`**: todos os campos do formulário + `status`, `gestorUid`, `gestorNome`, `gestorEmail`, `createdAt`, `updatedAt`, `responsavelRhUid`, `responsavelRhNome`, `historico[]`.

### Status possíveis de uma vaga

`aberta → triagem → entrevistas → proposta → contratada`
Mais: `pausada`, `cancelada`.

Apenas usuários com `role = 'rh'` podem movimentar status. O histórico é registrado automaticamente em `historico[]`.

---

## 8. Próximos passos sugeridos

- Deploy em Firebase Hosting (seção 5).
- Criar templates de vagas por área para reduzir retrabalho dos gestores.
- Integração com LinkedIn/Indeed via Cloud Functions.
- Notificações por e-mail quando uma vaga muda de status.

---

Feito com 💚 pelo Time de Gente · Grupo ETUS.
