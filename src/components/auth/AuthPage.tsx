import { useState, type FormEvent } from 'react';
import { BookHeart, Eye, EyeOff, LockKeyhole, Mail, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import '../../styles/auth.css';
type AuthMode = 'login' | 'register' | 'reset';

const APP_URL = new URL(import.meta.env.BASE_URL || '/', window.location.origin).toString();

function describeAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'El correo o la contraseña no coinciden. Inténtalo nuevamente.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Necesitas confirmar tu correo electrónico antes de iniciar sesión.';
  }
  if (normalized.includes('user already registered')) {
    return 'Esta dirección de correo ya está registrada. Prueba iniciar sesión.';
  }
  if (normalized.includes('password should be at least')) {
    return 'Tu contraseña debe tener al menos 6 caracteres.';
  }
  if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return 'Se realizaron demasiados intentos. Inténtalo más tarde.';
  }
  return message;
}

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError('');
    setNotice('');
    setPassword('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setError('');
    setNotice('');
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      if (mode === 'reset') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: APP_URL,
        });
        if (resetError) throw resetError;
        setNotice('Si existe una cuenta con ese correo, recibirás un enlace para recuperar tu contraseña.');
      } else if (mode === 'register') {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { emailRedirectTo: APP_URL },
        });
        if (signupError) throw signupError;
        if (!data.session) {
          setNotice('Revisa tu correo y confirma tu cuenta para entrar a Kurotex.');
        }
        // Si Supabase entrega una sesión, App detectará el cambio automáticamente.
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (loginError) throw loginError;
        // App detectará la nueva sesión mediante onAuthStateChange.
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Ocurrió un error inesperado.';
      setError(describeAuthError(message));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    if (loading) return;
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: APP_URL },
      });
      if (oauthError) throw oauthError;
      // Supabase redirige al navegador hacia Google.
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No fue posible iniciar sesión con Google.';
      setError(describeAuthError(message));
      setLoading(false);
    }
  }

  const isReset = mode === 'reset';
  const isRegister = mode === 'register';

  return (
    <main className="kuro-auth-page">
      <section className="kuro-auth-card" aria-labelledby="kuro-auth-heading">
        <div className="kuro-auth-logo" aria-hidden="true"><BookHeart size={32} /></div>
        <p className="kuro-auth-eyebrow"><Sparkles size={15} /> Tu rincón creativo</p>
        <h1 id="kuro-auth-heading">
          {isReset ? 'Recupera tu cuenta ♡' : isRegister ? 'Únete a Kurotex ♡' : 'Bienvenida a Kurotex ♡'}
        </h1>
        <p className="kuro-auth-description">
          {isReset
            ? 'Te enviaremos un enlace para restablecer tu contraseña.'
            : isRegister
              ? 'Guarda tus patrones, proyectos y pedidos en tu espacio personal.'
              : 'Tus mini libros y tejidos, organizados en un solo lugar.'}
        </p>

        <form className="kuro-auth-form" onSubmit={event => void handleSubmit(event)}>
          <label htmlFor="kuro-auth-email">Correo electrónico</label>
          <div className="kuro-auth-input-wrap">
            <Mail size={18} aria-hidden="true" />
            <input
              id="kuro-auth-email"
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={event => setEmail(event.target.value)}
              required
              disabled={loading}
            />
          </div>

          {!isReset && (
            <>
              <label htmlFor="kuro-auth-password">Contraseña</label>
              <div className="kuro-auth-input-wrap">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  id="kuro-auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  placeholder="Tu contraseña"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  minLength={6}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="kuro-auth-visibility"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(previous => !previous)}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </>
          )}

          {mode === 'login' && (
            <button type="button" className="kuro-auth-link kuro-auth-forgot" onClick={() => changeMode('reset')}>
              ¿Olvidaste tu contraseña?
            </button>
          )}

          {error && <p className="kuro-auth-error" role="alert">{error}</p>}
          {notice && <p className="kuro-auth-notice" role="status">{notice}</p>}

          <button className="kuro-auth-primary" type="submit" disabled={loading}>
            {loading ? 'Un momento...' : isReset ? 'Enviar enlace ♡' : isRegister ? 'Crear cuenta ♡' : 'Iniciar sesión ♡'}
          </button>
        </form>

        {!isReset && (
          <>
            <div className="kuro-auth-divider"><span>o continúa con</span></div>
            <button type="button" className="kuro-auth-google" onClick={() => void handleGoogleLogin()} disabled={loading}>
              <span className="kuro-auth-google-g" aria-hidden="true">G</span>
              Continuar con Google
            </button>
          </>
        )}

        <p className="kuro-auth-switch">
          {isReset ? '¿Recordaste tu contraseña?' : isRegister ? '¿Ya tienes una cuenta?' : '¿Todavía no tienes cuenta?'}{' '}
          <button type="button" className="kuro-auth-link" onClick={() => changeMode(isReset || isRegister ? 'login' : 'register')}>
            {isReset || isRegister ? 'Inicia sesión' : 'Regístrate'}
          </button>
        </p>
      </section>
    </main>
  );
}
