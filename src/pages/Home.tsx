
import {
  BookOpen,
  NotebookPen,
  CalendarDays,
  ArrowRight
} from 'lucide-react';

import type { Page } from '../components/layout/Sidebar';

type HomeProps = {
  onNavigate: (page: Page) => void;
};

export default function Home({ onNavigate }: HomeProps) {
  return (
    <section className="home-page">
      <div className="welcome">
        <h1>🎀 Bienvenida a Kurotex</h1>

        <p>
          Tu rincón creativo para organizar
          patrones, proyectos y pedidos.
        </p>
      </div>

      <h2 className="section-title">
        🌸 Mi espacio creativo
      </h2>

      <div className="cards">
        <article className="feature-card">
          <div className="card-emoji">
            <BookOpen size={42} />
          </div>

          <h3>📖 Mis patrones</h3>

          <p>
            Crea mini libros digitales con
            instrucciones, fotografías y diseños.
          </p>

          <button
            onClick={() => onNavigate('Mis patrones')}
          >
            Abrir patrones
            <ArrowRight size={18} />
          </button>
        </article>

        <article className="feature-card">
          <div className="card-emoji">
            <NotebookPen size={42} />
          </div>

          <h3>🧶 Mis proyectos</h3>

          <p>
            Documenta tus tejidos, precios,
            medidas y tiempos de elaboración.
          </p>

          <button
            onClick={() => onNavigate('Mis proyectos')}
          >
            Abrir proyectos
            <ArrowRight size={18} />
          </button>
        </article>

        <article className="feature-card">
          <div className="card-emoji">
            <CalendarDays size={42} />
          </div>

          <h3>📅 Mis pedidos</h3>

          <p>
            Organiza tus encargos con un
            calendario y fechas de entrega.
          </p>

          <button
            onClick={() => onNavigate('Mis pedidos')}
          >
            Abrir pedidos
            <ArrowRight size={18} />
          </button>
        </article>
      </div>
    </section>
  );
}
