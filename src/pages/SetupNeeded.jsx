import Logo from '../components/Logo'

/** Mostrado quando o .env ainda não tem as chaves do Supabase. */
export default function SetupNeeded() {
  return (
    <div className="center-screen">
      <div className="card stack" style={{ maxWidth: 420, textAlign: 'left' }}>
        <Logo variant="auto" height={64} />
        <h1 style={{ fontSize: '1.3rem' }}>Quase lá! Falta configurar o Supabase</h1>
        <p className="muted">
          Crie um arquivo <code>.env</code> na raiz do projeto (copie de <code>.env.example</code>) com:
        </p>
        <pre className="card card--flat card--tight" style={{ overflowX: 'auto', fontSize: '0.8rem', margin: 0 }}>
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...`}
        </pre>
        <p className="muted small">Depois reinicie o <code>npm run dev</code>. O passo a passo completo está no README.</p>
      </div>
    </div>
  )
}
