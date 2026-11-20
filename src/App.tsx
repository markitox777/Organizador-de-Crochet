
import { useState } from 'react';

import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import type { Page } from './components/layout/Sidebar';

import Home from './pages/Home';
import PatternsLibrary from './pages/PatternsLibrary';
import Projects from './pages/Projects';
import Orders from './pages/Orders';

import './styles/global.css';

export default function App() {
  const [currentPage, setCurrentPage] =
    useState<Page>('Inicio');

  const [menuOpen, setMenuOpen] = useState(false);

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
    setMenuOpen(false);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'Mis patrones':
        return <PatternsLibrary />;

      case 'Mis proyectos':
        return <Projects />;

      case 'Mis pedidos':
        return <Orders />;

      default:
        return <Home onNavigate={handleNavigate} />;
    }
  };

  return (
    <>
      <Header
        menuOpen={menuOpen}
        onToggleMenu={() =>
          setMenuOpen(previous => !previous)
        }
      />

      <div className="layout">
        <Sidebar
          currentPage={currentPage}
          onNavigate={handleNavigate}
          isOpen={menuOpen}
        />

        <main className="content">
          {renderPage()}
        </main>
      </div>
    </>
  );
}
