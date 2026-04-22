// Domínios de e-mail corporativo aceitos pra autenticação via Google e pro
// cadastro self-service em /signup. Admins (RH) ainda podem criar contas com
// qualquer domínio via o botão "+ Novo usuário" em Usuários — essa lista se
// aplica apenas aos fluxos de autoatendimento (Google sign-in + signup).
//
// IMPORTANTE: cada entrada é um domínio registrável completo (ex.:
// "etus.com.br"). Match é por igualdade exata OU por subdomínio
// (`email@dev.etus.com.br` passa). Isso fecha a brecha onde um atacante
// registra `etus.evil.com` e espoofa o domínio: `etus.evil.com` NÃO é igual
// a "etus.com.br" e nem termina em ".etus.com.br", então é rejeitado.
export const ALLOWED_DOMAINS = [
  'etus.com.br',
  'plusdin.com.br',
  'brius.com.br',
  'bhaz.com.br',
]

export function getDomain(email: string): string {
  const at = email.lastIndexOf('@')
  if (at === -1) return ''
  return email.slice(at + 1).toLowerCase()
}

export function isEmailAllowed(email: string): boolean {
  const domain = getDomain(email)
  if (!domain) return false
  return ALLOWED_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d))
}

export function allowedDomainsHuman(): string {
  // Render "@etus.com.br, @plusdin.com.br, @brius.com.br e @bhaz.com.br"
  // pra mensagens de erro.
  const parts = ALLOWED_DOMAINS.map((d) => '@' + d)
  if (parts.length <= 1) return parts.join('')
  return parts.slice(0, -1).join(', ') + ' e ' + parts[parts.length - 1]
}
