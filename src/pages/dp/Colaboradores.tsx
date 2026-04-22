import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import Topbar from '../../components/Topbar'
import type { Colaborador, RegimeTrabalho } from '../../types'
import { REGIME_TRABALHO_LABEL } from '../../types'

type ColaboradorStatus = Colaborador['status']

function formatDate(ts?: { toDate: () => Date } | null) {
  if (!ts) return '—'
  try { return ts.toDate().toLocaleDateString('pt-BR') } catch { return '—' }
}

function toDateInput(ts?: { toDate: () => Date } | null): string {
  if (!ts) return ''
  try {
    const d = ts.toDate()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  } catch { return '' }
}

export default function Colaboradores() {
  const [items, setItems] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState<string>('todos')
  const [openModal, setOpenModal] = useState(false)
  const [editing, setEditing] = useState<Colaborador | null>(null)

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'colaboradores')), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Colaborador, 'id'>) }))
      list.sort((a, b) => a.nome.localeCompare(b.nome))
      setItems(list)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  const filtered = useMemo(() => {
    return items.filter(c => {
      if (statusF !== 'todos' && c.status !== statusF) return false
      if (search) {
        const s = search.toLowerCase()
        if (!c.nome.toLowerCase().includes(s) && !c.cargo.toLowerCase().includes(s) && !c.area.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [items, search, statusF])

  async function excluir(c: Colaborador) {
    if (!confirm(`Excluir o colaborador "${c.nome}"?\n\nEssa ação é permanente.`)) return
    try {
      await deleteDoc(doc(db, 'colaboradores', c.id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir colaborador.')
    }
  }

  return (
    <>
      <Topbar
        title="Colaboradores"
        icon="◉"
        actions={<button className="tbtn pri" onClick={() => setOpenModal(true)}>＋ Novo colaborador</button>}
      />
      <div className="content">
        <div className="panel">
          <div className="filter-bar">
            <div className="swrap">
              <span className="sico">⌕</span>
              <input className="srch" placeholder="Buscar por nome, cargo ou área…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select value={statusF} onChange={(e) => setStatusF(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="ativo">Ativos</option>
              <option value="ferias">Férias</option>
              <option value="afastado">Afastados</option>
              <option value="desligado">Desligados</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">◉</div>
              <div className="empty-ttl">Nenhum colaborador</div>
              <div className="empty-sub">Cadastre colaboradores para acompanhar.</div>
            </div>
          ) : (
            <div className="panel-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Cargo</th>
                    <th>Área</th>
                    <th>Empresa</th>
                    <th>Regime</th>
                    <th>Admissão</th>
                    <th>Status</th>
                    <th style={{ width: 100 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id}>
                      <td><div className="tdm">{c.nome}</div><div className="tds">{c.email || '—'}</div></td>
                      <td style={{ fontSize: 12 }}>{c.cargo}</td>
                      <td style={{ fontSize: 12, color: 'var(--mut)' }}>{c.area}</td>
                      <td style={{ fontSize: 12, color: 'var(--mut)' }}>{c.empresa}</td>
                      <td style={{ fontSize: 12 }}>{REGIME_TRABALHO_LABEL[c.regime]}</td>
                      <td style={{ fontSize: 11, color: 'var(--mut)' }}>{formatDate(c.dataAdmissao)}</td>
                      <td>
                        <span className={`bdg ${
                          c.status === 'ativo' ? 'ok' :
                          c.status === 'ferias' ? 'warn' :
                          c.status === 'afastado' ? 'info' : 'bad'
                        }`}>
                          {c.status === 'ativo' ? 'Ativo' :
                           c.status === 'ferias' ? 'Férias' :
                           c.status === 'afastado' ? 'Afastado' : 'Desligado'}
                        </span>
                      </td>
                      <td>
                        <div className="hstack" style={{ gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="tbtn"
                            onClick={() => setEditing(c)}
                            title="Editar"
                            style={{ height: 26 }}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="tbtn"
                            onClick={() => excluir(c)}
                            title="Excluir"
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
            </div>
          )}
        </div>
      </div>

      {openModal && <ColaboradorModal onClose={() => setOpenModal(false)} />}
      {editing && <ColaboradorModal colaborador={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function ColaboradorModal({ colaborador, onClose }: { colaborador?: Colaborador, onClose: () => void }) {
  const isEdit = !!colaborador
  const [nome, setNome] = useState(colaborador?.nome ?? '')
  const [email, setEmail] = useState(colaborador?.email ?? '')
  const [cargo, setCargo] = useState(colaborador?.cargo ?? '')
  const [area, setArea] = useState(colaborador?.area ?? '')
  const [empresa, setEmpresa] = useState(colaborador?.empresa ?? '')
  const [regime, setRegime] = useState<RegimeTrabalho>(colaborador?.regime ?? 'clt')
  const [dataAdmissao, setDataAdmissao] = useState(toDateInput(colaborador?.dataAdmissao))
  const [salario, setSalario] = useState<number | ''>(typeof colaborador?.salario === 'number' ? colaborador.salario : '')
  const [status, setStatus] = useState<ColaboradorStatus>(colaborador?.status ?? 'ativo')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (isEdit && colaborador) {
        await updateDoc(doc(db, 'colaboradores', colaborador.id), {
          nome, email, cargo, area, empresa, regime,
          dataAdmissao: dataAdmissao ? new Date(dataAdmissao) : null,
          salario: typeof salario === 'number' ? salario : null,
          status,
          updatedAt: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db, 'colaboradores'), {
          nome, email, cargo, area, empresa, regime,
          dataAdmissao: dataAdmissao ? new Date(dataAdmissao) : null,
          salario: typeof salario === 'number' ? salario : null,
          status: 'ativo',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'Editar colaborador' : 'Novo colaborador'}</h2>
        <form onSubmit={handleSubmit} className="row-gap-14">
          <div className="form-grid">
            <div className="field"><label>Nome *</label><input value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
            <div className="field"><label>E-mail</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="field"><label>Cargo *</label><input value={cargo} onChange={(e) => setCargo(e.target.value)} required /></div>
            <div className="field"><label>Área *</label><input value={area} onChange={(e) => setArea(e.target.value)} required /></div>
            <div className="field"><label>Empresa *</label><input value={empresa} onChange={(e) => setEmpresa(e.target.value)} required /></div>
            <div className="field">
              <label>Regime *</label>
              <select value={regime} onChange={(e) => setRegime(e.target.value as RegimeTrabalho)}>
                <option value="clt">CLT</option>
                <option value="pj">PJ</option>
                <option value="estagio">Estágio</option>
                <option value="freelancer">Freelancer</option>
              </select>
            </div>
            <div className="field"><label>Data de admissão *</label><input type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} required /></div>
            <div className="field"><label>Salário (R$)</label><input type="number" min={0} step={0.01} value={salario} onChange={(e) => setSalario(e.target.value === '' ? '' : Number(e.target.value))} /></div>
            {isEdit && (
              <div className="field">
                <label>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as ColaboradorStatus)}>
                  <option value="ativo">Ativo</option>
                  <option value="ferias">Férias</option>
                  <option value="afastado">Afastado</option>
                  <option value="desligado">Desligado</option>
                </select>
              </div>
            )}
          </div>
          <div className="hstack" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando…' : (isEdit ? 'Salvar' : 'Cadastrar')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
