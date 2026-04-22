# ETUS · Gestão Integrada (RH + DP + Financeiro)

Sistema web do Grupo ETUS que reúne em um único cockpit três módulos integrados, construído com **React + Vite + Firebase (Auth + Firestore)**:

- **RH — Recrutamento**: indicadores com KPIs/SLA/funil de candidatos, listagem de vagas com filtros, detalhe da vaga com movimentação de status, pipeline de candidatos com score e origem, onboarding com checklist de integração e gestão de usuários.
- **DP — Departamento Pessoal**: dashboard com indicadores de colaboradores/estagiários, CRUD de estagiários, diretório de colaboradores e acompanhamento de **período de experiência (45/90 dias)**.
- **Financeiro & Notas**: registro e aprovação de notas iFood, outros pagamentos categorizados (reembolso, bônus, mobilidade, etc.) e dashboard financeiro com gráficos dos últimos 6 meses.

Dois perfis de acesso:

- **Gestor**: abre novas vagas (formulário baseado no questionário atual do Time de Gente) e acompanha o andamento de cada vaga e histórico. Não vê dados de DP ou Financeiro.
- **RH**: acessa os 3 módulos completos, movimenta status das vagas, gerencia candidatos/onboarding, administra DP e o Financeiro, e promove/rebaixa outros usuários.

Tipografia **Space Grotesk** e paleta ETUS (verdes + neutros) aplicadas via CSS variables em `src/index.css`.

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
  components/        Layout, Sidebar, Topbar, KpiCard, StatusBadge, ProtectedRoute
  contexts/          AuthContext (login, signup, profile/role), ModuleContext (módulo ativo)
  pages/
    Login.tsx        Signup.tsx
    gestor/          MinhasVagas, NovaVaga, VagaDetalhe
    rh/              Indicadores, TodasVagas, NovaVaga, VagaDetalhe,
                     Candidatos, CandidatoDetalhe, Onboarding, OnboardingDetalhe, Usuarios
    dp/              Dashboard, Estagiarios, Colaboradores, PeriodoExperiencia
    fin/             Dashboard, Ifood, OutrosPagamentos
    shared/          VagaDetalheView
  firebase.ts        Inicialização do SDK do Firebase
  types.ts           Tipagens (Vaga, Candidato, Estagiario, Colaborador, NotaIfood, Pagamento…)
  index.css          Tema com Space Grotesk e paleta ETUS
```

### Modelo de dados no Firestore

- **`users/{uid}`**: `{ name, email, role: 'rh' | 'gestor', empresa, area, createdAt }`
- **`vagas/{id}`**: todos os campos do formulário + `status`, `gestorUid/Nome/Email`, `responsavelRhUid/Nome`, `historico[]`.
- **`candidatos/{id}`**: `{ nome, email, telefone, linkedin, vagaId, vagaCargo, fase, score, origem, historico[] }`.
- **`onboarding/{id}`**: `{ candidatoNome, vagaId, vagaCargo, empresa, status, checklist[] }`.
- **`estagiarios/{id}`**: `{ nome, curso, instituicao, empresa, area, mentor, dataInicio, dataTermino, bolsa, status }`.
- **`colaboradores/{id}`**: `{ nome, cargo, area, empresa, regime, dataAdmissao, salario, status, experiencia{ resultado45, resultado90 } }`.
- **`notas_ifood/{id}`**: `{ data, restaurante, colaboradorNome, empresa, area, valor, status }`.
- **`pagamentos/{id}`**: `{ data, descricao, categoria, valor, colaboradorNome, empresa, area, status }`.

Regras em `firestore.rules`:

- **Vagas**: gestor só vê as próprias; RH vê tudo e é quem movimenta status.
- **Candidatos, Onboarding, Estagiários, Colaboradores, Notas iFood, Pagamentos**: acesso restrito ao RH.

### Status possíveis de uma vaga

`aberta → triagem → entrevistas → proposta → contratada`
Mais: `pausada`, `cancelada`.

### Fases possíveis de um candidato

`triagem → teste_online → entrevista_rh → entrevista_gestor → entrevista_cultura → proposta → aprovado`
Terminais adicionais: `reprovado`, `desistente`.

---

## 8. Próximos passos sugeridos

- Deploy em Firebase Hosting (seção 5).
- Upload de currículos/anexos no Firebase Storage (notas iFood, comprovantes de pagamento, CVs).
- Notificações por e-mail ao movimentar vaga, criar candidato ou aprovar pagamento.
- Integração com LinkedIn/Indeed via Cloud Functions para captar candidatos automaticamente.
- Papel dedicado `dp` / `financeiro` (hoje tudo é consolidado no papel `rh`).

---

Feito com 💚 pelo Time de Gente · Grupo ETUS.
