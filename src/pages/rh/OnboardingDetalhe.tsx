import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  addDoc, collection, doc, getDoc, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where, getDocs,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Topbar from '../../components/Topbar'
import type {
  Candidato, Onboarding, OnboardingTipo, Regime, RegimeTrabalho, Vaga,
} from '../../types'
import { getVagaEmpresas, ONBOARDING_TIPO_LABEL, regimeToOnboardingTipo } from '../../types'

function regimeToTrabalho(r?: Regime): RegimeTrabalho {
  if (r === 'CLT') return 'clt'
  if (r === 'PJ') return 'pj'
  if (r === 'ESTAGIO') return 'estagio'
  if (r === 'FREELANCER') return 'freelancer'
  return 'clt'
}

function fmtDate(ts?: Timestamp | null) {
  if (!ts) return '—'
  try {
    return ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return '—' }
}

export default function OnboardingDetalhe() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [ob, setOb] = useState<Onboarding | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [autoActionInProgress, setAutoActionInProgress] = useState(false)

  // Guard pra evitar disparar a transição múltiplas vezes (tipo race ao
  // re-renderizar enquanto a escrita ainda está em andamento). Resetado
  // automaticamente quando o id muda.
  const transitionedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!id) return
    transitionedRef.current = null
    const unsub = onSnapshot(doc(db, 'onboarding', id),
      (snap) => {
        if (!snap.exists()) setErr('Onboarding não encontrado.')
        else setOb({ id: snap.id, ...(snap.data() as Omit<Onboarding, 'id'>) })
      },
      (e) => setErr(e.message))
    return unsub
  }, [id])

  // Quando o onboarding é concluído, criamos o estagiário ou colaborador
  // correspondente automaticamente e notificamos o gestor.
  // Esse efeito roda no client (ideal seria Cloud Function, mas mantemos
  // simples pra não exigir infra extra). O guard garante que só executa
  // uma vez por onboarding mesmo com re-renders.
  useEffect(() => {
    if (!ob || !profile) return
    if (ob.status !== 'concluido') return
    // Já criou? (via flag persistida → estagiarioId/colaboradorId).
    if (ob.estagiarioId || ob.colaboradorId) return
    if (transitionedRef.current === ob.id) return
    transitionedRef.current = ob.id

    ;(async () => {
      setAutoActionInProgress(true)
      try {
        await criarRegistroDP(ob)
      } catch (e) {
        // Não ressetamos transitionedRef pra não entrar em loop. Mostramos erro.
        setErr(e instanceof Error ? e.message : 'Falha ao criar registro no DP.')
      } finally {
        setAutoActionInProgress(false)
      }
    })()
  }, [ob, profile])

  async function criarRegistroDP(o: Onboarding) {
    // Carrega a vaga para garantir empresa/regime atualizados, e o candidato
    // pra pegar dados que não estavam no onboarding (cidade, indicação, etc).
    const [vagaSnap, candSnap] = await Promise.all([
      getDoc(doc(db, 'vagas', o.vagaId)),
      o.candidatoId ? getDoc(doc(db, 'candidatos', o.candidatoId)) : Promise.resolve(null),
    ])
    const vaga = vagaSnap.exists() ? ({ id: vagaSnap.id, ...(vagaSnap.data() as Omit<Vaga, 'id'>) }) : null
    const cand = candSnap && candSnap.exists()
      ? ({ id: candSnap.id, ...(candSnap.data() as Omit<Candidato, 'id'>) })
      : null

    const tipo: OnboardingTipo = o.tipo || regimeToOnboardingTipo((o.regime as Regime) ?? (vaga?.regime ?? 'CLT'))
    const dataInicio = o.dataPrevistaInicio || o.dataAdmissao || Timestamp.now()
    const dataTermino = o.dataPrevistaTermino || (() => {
      // Se ESTAGIO sem término definido, default 1 ano.
      if (tipo !== 'ESTAGIO') return null
      const d = new Date(); d.setFullYear(d.getFullYear() + 1)
      return Timestamp.fromDate(d)
    })()

    const empresa = o.empresa || (vaga ? getVagaEmpresas(vaga)[0] : '') || ''
    const gestorUid = vaga?.gestorUid || ''
    const gestorNome = vaga?.gestorNome || ''

    if (tipo === 'ESTAGIO') {
      const estagRef = await addDoc(collection(db, 'estagiarios'), {
        nome: o.candidatoNome,
        ...(o.candidatoEmail || cand?.email ? { email: o.candidatoEmail || cand?.email } : {}),
        ...(o.candidatoTelefone || cand?.telefone ? { telefone: o.candidatoTelefone || cand?.telefone } : {}),
        // O candidato não tem campo "curso" estruturado. RH pode preencher
        // manualmente no DP > Estagiários após a criação. Se um dia for
        // adicionado, basta substituir aqui por cand?.curso ?? ''.
        curso: '',
        instituicao: '',
        empresa,
        area: vaga?.time || '',
        ...(gestorUid ? { gestorUid } : {}),
        ...(gestorNome ? { gestorNome } : {}),
        dataInicio,
        dataTermino: dataTermino || dataInicio,
        status: 'ativo',
        candidatoId: o.candidatoId || '',
        vagaId: o.vagaId,
        onboardingId: o.id,
        ...(o.indicadoPorNome || cand?.indicadoPorNome ? { indicadoPorNome: o.indicadoPorNome || cand?.indicadoPorNome } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      await updateDoc(doc(db, 'onboarding', o.id), {
        estagiarioId: estagRef.id,
        updatedAt: serverTimestamp(),
      })
      if (gestorUid) {
        await addDoc(collection(db, 'notificacoes'), {
          destinatarioUid: gestorUid,
          tipo: 'onboarding_concluido',
          titulo: `Estagiário ativo: ${o.candidatoNome}`,
          mensagem: `Onboarding concluído. ${o.candidatoNome} consta agora em DP → Estagiários (início ${fmtDate(dataInicio)}).`,
          link: `/dp/estagiarios`,
          lida: false,
          createdAt: serverTimestamp(),
          refColecao: 'estagiarios',
          refId: estagRef.id,
        })
      }
    } else {
      const colabRef = await addDoc(collection(db, 'colaboradores'), {
        nome: o.candidatoNome,
        ...(o.candidatoEmail || cand?.email ? { email: o.candidatoEmail || cand?.email } : {}),
        ...(o.candidatoTelefone || cand?.telefone ? { telefone: o.candidatoTelefone || cand?.telefone } : {}),
        cargo: o.vagaCargo,
        area: vaga?.time || '',
        empresa,
        regime: regimeToTrabalho(o.regime as Regime),
        dataAdmissao: dataInicio,
        ...(gestorUid ? { gestorUid } : {}),
        ...(gestorNome ? { gestorNome } : {}),
        status: 'ativo',
        candidatoId: o.candidatoId || '',
        vagaId: o.vagaId,
        onboardingId: o.id,
        ...(o.indicadoPorNome || cand?.indicadoPorNome ? { indicadoPorNome: o.indicadoPorNome || cand?.indicadoPorNome } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      await updateDoc(doc(db, 'onboarding', o.id), {
        colaboradorId: colabRef.id,
        updatedAt: serverTimestamp(),
      })
      if (gestorUid) {
        await addDoc(collection(db, 'notificacoes'), {
          destinatarioUid: gestorUid,
          tipo: 'onboarding_concluido',
          titulo: `Colaborador ativo: ${o.candidatoNome}`,
          mensagem: `Onboarding concluído. ${o.candidatoNome} consta agora em DP → Colaboradores (admissão ${fmtDate(dataInicio)}).`,
          link: `/dp/colaboradores`,
          lida: false,
          createdAt: serverTimestamp(),
          refColecao: 'colaboradores',
          refId: colabRef.id,
        })
      }
    }

    // Atualiza candidato com dataAdmissao = dataInicio (pra countdown 90d).
    if (o.candidatoId) {
      await updateDoc(doc(db, 'candidatos', o.candidatoId), {
        dataAdmissao: dataInicio,
        updatedAt: serverTimestamp(),
      })
    }
  }

  async function toggleItem(itemId: string) {
    if (!ob || !profile) return
    const updated = (ob.checklist || []).map(c => {
      if (c.id !== itemId) return c
      const willBeDone = !c.done
      if (willBeDone) {
        return {
          ...c,
          done: true,
          doneAt: Timestamp.now(),
          doneByUid: profile.uid,
          doneByName: profile.name,
        }
      }
      const { doneAt: _a, doneByUid: _b, doneByName: _c, ...rest } = c
      void _a; void _b; void _c
      return { ...rest, done: false }
    })
    const allDone = updated.every(c => c.done)
    const anyDone = updated.some(c => c.done)
    const status = allDone ? 'concluido' : anyDone ? 'em_andamento' : 'pendente'
    try {
      await updateDoc(doc(db, 'onboarding', ob.id), {
        checklist: updated,
        status,
        updatedAt: serverTimestamp(),
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao atualizar item.')
    }
  }

  const done = (ob?.checklist || []).filter(c => c.done).length
  const total = (ob?.checklist || []).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const tipo = ob ? (ob.tipo || regimeToOnboardingTipo((ob.regime as Regime) ?? 'CLT')) : null

  return (
    <>
      <Topbar
        title={ob?.candidatoNome || 'Onboarding'}
        icon="⚑"
        actions={<Link to="/rh/onboarding" className="tbtn">← Voltar</Link>}
      />
      <div className="content">
        {err && <div className="error-text">{err}</div>}
        {!ob && !err && <div className="empty-state">Carregando…</div>}
        {ob && (
          <>
            <div className="panel">
              <div className="hstack" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 18 }}>
                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--mut)', fontWeight: 700, marginBottom: 4 }}>Candidato</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{ob.candidatoNome}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--mut)', fontWeight: 700, marginBottom: 4 }}>Vaga</div>
                  <div style={{ fontSize: 13 }}>{ob.vagaCargo}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--mut)', fontWeight: 700, marginBottom: 4 }}>Empresa</div>
                  <div style={{ fontSize: 13 }}>{ob.empresa || '—'}</div>
                </div>
                {tipo && (
                  <div>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--mut)', fontWeight: 700, marginBottom: 4 }}>Tipo</div>
                    <div style={{ fontSize: 13 }}>{ONBOARDING_TIPO_LABEL[tipo]}</div>
                  </div>
                )}
                {ob.dataPrevistaInicio && (
                  <div>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--mut)', fontWeight: 700, marginBottom: 4 }}>Início previsto</div>
                    <div style={{ fontSize: 13 }}>{fmtDate(ob.dataPrevistaInicio)}</div>
                  </div>
                )}
                {ob.dataPrevistaTermino && (
                  <div>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--mut)', fontWeight: 700, marginBottom: 4 }}>Término previsto</div>
                    <div style={{ fontSize: 13 }}>{fmtDate(ob.dataPrevistaTermino)}</div>
                  </div>
                )}
                <div className="ml-auto" style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--mut)', fontWeight: 700, marginBottom: 4 }}>Progresso</div>
                  <div className="hstack">
                    <span className="scbar" style={{ width: 100 }}>
                      <span className="scfill" style={{ width: `${pct}%` }} />
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{pct}%</span>
                  </div>
                </div>
              </div>

              {ob.status === 'concluido' && (ob.estagiarioId || ob.colaboradorId) && (
                <div style={{ padding: 10, background: 'var(--card2)', borderRadius: 8, fontSize: 12 }}>
                  ✓ Onboarding concluído.{' '}
                  {ob.estagiarioId && <Link to="/dp/estagiarios" style={{ color: 'var(--g600)' }}>Ver em DP → Estagiários</Link>}
                  {ob.colaboradorId && <Link to="/dp/colaboradores" style={{ color: 'var(--g600)' }}>Ver em DP → Colaboradores</Link>}
                </div>
              )}
              {autoActionInProgress && (
                <div style={{ padding: 10, fontSize: 12, color: 'var(--mut)' }}>
                  Sincronizando registro com o DP…
                </div>
              )}
            </div>

            <div className="panel">
              <h3>Checklist de integração</h3>
              <div style={{ marginTop: 10 }}>
                {(ob.checklist || []).map(item => (
                  <div
                    key={item.id}
                    className={`checklist-item ${item.done ? 'done' : ''}`}
                    onClick={() => toggleItem(item.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => toggleItem(item.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div>
                      <div className="cl-title">{item.titulo}</div>
                      {item.descricao && <div className="cl-sub">{item.descricao}</div>}
                      {item.done && item.doneByName && (
                        <div className="cl-sub">Concluído por {item.doneByName}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

// suprime warnings de imports não usados (mantidos pra futuras checagens).
void query; void where; void getDocs
