/** Detecta falha de rede (sem conexão, DNS, timeout). */
export function isNetworkError(error) {
  if (!error) return false
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const msg = String(error.message || error).toLowerCase()
  return (
    error.name === 'TypeError' ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('fetch')
  )
}

/** Converte erros do Supabase/Postgres em mensagens amigáveis em português. */
export function friendlyError(error) {
  if (!error) return 'Algo deu errado. Tente novamente.'
  if (isNetworkError(error)) return 'Sem conexão. Verifique sua internet e tente de novo.'

  const code = error.code || error.status
  const msg = String(error.message || '')

  const auth = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'Email not confirmed': 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
    'User already registered': 'Já existe uma conta com este e-mail.',
    'Password should be at least 6 characters': 'A senha precisa ter pelo menos 6 caracteres.',
  }
  for (const [k, v] of Object.entries(auth)) if (msg.includes(k)) return v
  if (msg.toLowerCase().includes('rate limit')) return 'Muitas tentativas. Aguarde um pouco e tente de novo.'

  // erro de configuração do banco (falta GRANT), não de RLS
  if (/permission denied for (table|function|schema|view)/i.test(msg)) {
    console.error('[Supabase] permissão ausente:', msg)
    return `O banco não liberou acesso para o app (${msg}). Rode a migration 20261124000004_grants.sql.`
  }

  if (code === '42501' || msg.includes('row-level security')) {
    console.error('[Supabase] acesso negado:', msg)
    return msg && !msg.includes('row-level security') && !msg.includes('permission denied')
      ? msg
      : 'Você não tem permissão para isso. Confira se ainda faz parte desta casa.'
  }
  if (code === '23503') return 'Este item está em uso por outros lançamentos e não pode ser removido.'
  if (code === '23505') return 'Já existe um registro igual a este.'
  if (code === '23514') return 'Algum valor informado não é válido.'
  if (code === 'P0002') return msg || 'Não encontrado.'
  if (code === 'PGRST301' || code === 401) return 'Sua sessão expirou. Entre novamente.'

  return msg || 'Algo deu errado. Tente novamente.'
}
