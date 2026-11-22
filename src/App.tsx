import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import type { Page } from './components/layout/Sidebar';

import Home from './pages/Home';
import PatternsLibrary from './pages/PatternsLibrary';
import Projects from './pages/Projects';
import Orders from './pages/Orders';
import AuthPage from './components/auth/AuthPage';
import { supabase } from './lib/supabase';

import './styles/global.css';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('Inicio');
  const [menuOpen, setMenuOpen] = useState(false);
  const [requestedBookId, setRequestedBookId] = useState<string | null>(null);
  const [requestedProjectId, setRequestedProjectId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authError, setAuthError] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setCheckingSession(false);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setAuthError('No se pudo comprobar la sesión. Revisa la conexión e inténtalo de nuevo.');
      } else {
        setSession(data.session);
      }
      setCheckingSession(false);
    }).catch(() => {
      if (!active) return;
      setAuthError('No se pudo comprobar la sesión. Revisa la conexión e inténtalo de nuevo.');
      setCheckingSession(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
    setRequestedBookId(null);
    setRequestedProjectId(null);
    setMenuOpen(false);
  };

  const handleOpenProjectBook = (bookId: string) => {
    setRequestedBookId(bookId);
    setRequestedProjectId(null);
    setCurrentPage('Mis patrones');
    setMenuOpen(false);
  };

  const handleOpenOrderProject = (projectId: string) => {
    setRequestedProjectId(projectId);
    setRequestedBookId(null);
    setCurrentPage('Mis proyectos');
    setMenuOpen(false);
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setAuthError('');
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError('No se pudo cerrar la sesión. Inténtalo nuevamente.');
    else {
      setCurrentPage('Inicio');
      setMenuOpen(false);
      setRequestedBookId(null);
      setRequestedProjectId(null);
    }
    setSigningOut(false);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'Mis patrones':
        return <PatternsLibrary requestedBookId={requestedBookId} />;
      case 'Mis proyectos':
        return <Projects onOpenBook={handleOpenProjectBook} requestedProjectId={requestedProjectId} />;
      case 'Mis pedidos':
        return <Orders onOpenProject={handleOpenOrderProject} />;
      default:
        return <Home onNavigate={handleNavigate} />;
    }
  };

  if (checkingSession) {
    return <main role="status" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#9b4b7b', background: '#fff5fa' }}>Preparando Kurotex ♡</main>;
  }

  if (!session) return <AuthPage />;

  return (
    <>
      <Header menuOpen={menuOpen} onToggleMenu={() => setMenuOpen(previous => !previous)} />
      <div className="layout">
        <Sidebar currentPage={currentPage} onNavigate={handleNavigate} isOpen={menuOpen} />
        <main className="content">
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingBottom: 12 }}>
            {authError && <span role="alert" style={{ color: '#b42342', fontSize: 13 }}>{authError}</span>}
            <span style={{ fontSize: 12, color: '#9d728c', overflowWrap: 'anywhere' }}>{session.user.email ?? 'Mi cuenta'}</span>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              style={{ border: '1px solid #eac4d8', borderRadius: 12, background: '#fff7fb', color: '#9a4b78', padding: '8px 12px', cursor: 'pointer' }}
            >
              {signingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
            </button>
          </div>
          {renderPage()}
        </main>
      </div>
    </>
  );
}
