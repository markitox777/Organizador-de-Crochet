import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, ClipboardList, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import {
  deleteProject, getProjects, saveProject,
  type CrochetProject, type ProjectStatus
} from '../services/projectService';
import { getMiniBooks, type MiniBook } from '../services/bookLibraryService';
import '../styles/projects.css';

type ProjectDraft = Pick<CrochetProject,
  'name' | 'description' | 'status' | 'progress' | 'materials' | 'notes' | 'bookId'>;

const INITIAL_DRAFT: ProjectDraft = {
  name: '', description: '', status: 'pendiente', progress: 0, materials: '', notes: '', bookId: null
};
const STATUS: Record<ProjectStatus, string> = {
  pendiente: 'Pendiente', en_proceso: 'En proceso', pausado: 'Pausado', terminado: 'Terminado'
};

type ProjectsProps = {
  onOpenBook?: (bookId: string) => void;
  requestedProjectId?: string | null;
};

export default function Projects({ onOpenBook, requestedProjectId = null }: ProjectsProps) {
  const [projects, setProjects] = useState<CrochetProject[]>([]);
  const [miniBooks, setMiniBooks] = useState<MiniBook[]>([]);
  const [bookSearch, setBookSearch] = useState('');
  const [booksError, setBooksError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ProjectStatus | 'todos'>('todos');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<ProjectDraft>({ ...INITIAL_DRAFT });
  const [saving, setSaving] = useState(false);
  const requestedCardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let active = true;
    getProjects()
      .then(items => { if (active) setProjects(items); })
      .catch(() => { if (active) setError('No pudimos cargar tus proyectos. Comprueba el almacenamiento del navegador.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    getMiniBooks()
      .then(books => { if (active) setMiniBooks(books); })
      .catch(() => { if (active) setBooksError('No pudimos cargar los mini libros de la biblioteca.'); });
    return () => { active = false; };
  }, []);

  // Al llegar desde Mis pedidos, mostrar el proyecto aunque antes hubiera filtros.
  useEffect(() => {
    if (!requestedProjectId) return;
    setSearch('');
    setFilter('todos');
  }, [requestedProjectId]);

  // Desplazarse a la tarjeta solicitada cuando termine de cargar.
  useEffect(() => {
    if (!requestedProjectId || loading || !projects.some(p => p.id === requestedProjectId)) return;
    const frame = requestAnimationFrame(() => {
      requestedCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      requestedCardRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [requestedProjectId, loading, projects]);

  const bookTitles = useMemo(() => new Map(miniBooks.map(book => [book.id, book.title])), [miniBooks]);
  const matchingBooks = useMemo(() => miniBooks.filter(book =>
    book.title.toLocaleLowerCase('es-CL').includes(bookSearch.trim().toLocaleLowerCase('es-CL'))
  ), [miniBooks, bookSearch]);

  const filteredProjects = useMemo(() => projects.filter(project =>
    (filter === 'todos' || project.status === filter) &&
    [project.name, project.description, project.materials, bookTitles.get(project.bookId ?? '') ?? ''].some(value =>
      value.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim())
    )
  ), [projects, filter, search, bookTitles]);

  const counts = {
    total: projects.length,
    active: projects.filter(item => item.status === 'en_proceso').length,
    finished: projects.filter(item => item.status === 'terminado').length
  };

  function openNew() {
    setDraft({ ...INITIAL_DRAFT });
    setBookSearch('');
    setEditingId(null);
    setError('');
    setFormOpen(true);
  }

  function openEdit(project: CrochetProject) {
    const { name, description, status, progress, materials, notes, bookId } = project;
    setDraft({ name, description, status, progress, materials, notes, bookId: bookId ?? null });
    setBookSearch('');
    setEditingId(project.id);
    setError('');
    setFormOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim() || saving) return;
    setSaving(true);
    setError('');
    const previous = editingId ? projects.find(p => p.id === editingId) : undefined;
    const now = new Date().toISOString();
    const item: CrochetProject = {
      ...draft,
      name: draft.name.trim(),
      progress: draft.status === 'terminado' ? 100 : Math.max(0, Math.min(100, draft.progress)),
      id: previous?.id ?? crypto.randomUUID(),
      createdAt: previous?.createdAt ?? now,
      updatedAt: now
    };
    try {
      await saveProject(item);
      setProjects(items => [item, ...items.filter(p => p.id !== item.id)]);
      setFormOpen(false);
      setEditingId(null);
    } catch {
      setError('No se pudo guardar el proyecto. Inténtalo nuevamente.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(project: CrochetProject) {
    if (!window.confirm(`¿Eliminar el proyecto «${project.name}»? Esta acción no se puede deshacer.`)) return;
    setError('');
    try {
      await deleteProject(project.id);
      setProjects(items => items.filter(item => item.id !== project.id));
    } catch {
      setError('No se pudo eliminar el proyecto.');
    }
  }

  return (
    <section className="kuro-projects" aria-label="Mis proyectos">
      <header className="kuro-projects-heading">
        <div>
          <span className="kuro-projects-eyebrow">Mi rincón creativo ♡</span>
          <h2>🧶 Mis proyectos</h2>
          <p>Organiza tus tejidos y acompaña cada avance.</p>
        </div>
        <button type="button" className="kuro-projects-primary" onClick={openNew}>
          <Plus size={18} /> Nuevo proyecto
        </button>
      </header>

      <div className="kuro-projects-summary" aria-label="Resumen de proyectos">
        <div><strong>{counts.total}</strong><span>Mis proyectos</span></div>
        <div><strong>{counts.active}</strong><span>En proceso</span></div>
        <div><strong>{counts.finished}</strong><span>Terminados</span></div>
      </div>

      <div className="kuro-projects-controls">
        <label className="kuro-projects-search">
          <Search size={18} aria-hidden="true" />
          <span className="kuro-projects-sr-only">Buscar proyectos</span>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar proyectos..." />
        </label>
        <label className="kuro-projects-filter">
          <span className="kuro-projects-sr-only">Filtrar por estado</span>
          <select value={filter} onChange={event => setFilter(event.target.value as ProjectStatus | 'todos')}>
            <option value="todos">Todos los estados</option>
            {Object.entries(STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      {error && <p className="kuro-projects-error" role="alert">{error}</p>}
      {!loading && requestedProjectId && !projects.some(p => p.id === requestedProjectId) && (
        <p className="kuro-projects-error" role="status">El proyecto asociado al pedido ya no está disponible.</p>
      )}

      {loading ? <p className="kuro-projects-empty">Cargando proyectos...</p> : filteredProjects.length === 0 ? (
        <div className="kuro-projects-empty">
          <ClipboardList size={38} strokeWidth={1.4} />
          <h3>{projects.length ? 'No encontramos proyectos' : 'Aquí comenzarán tus tejidos ♡'}</h3>
          <p>{projects.length ? 'Prueba otra búsqueda o filtro.' : 'Crea tu primer proyecto para llevar su progreso y tus notas.'}</p>
          {projects.length === 0 && <button type="button" className="kuro-projects-primary" onClick={openNew}><Plus size={17} /> Crear proyecto</button>}
        </div>
      ) : (
        <div className="kuro-projects-grid">
          {filteredProjects.map(project => (
            <article
              className="kuro-projects-card"
              key={project.id}
              ref={project.id === requestedProjectId ? requestedCardRef : undefined}
              tabIndex={project.id === requestedProjectId ? -1 : undefined}
              style={project.id === requestedProjectId ? {
                outline: '3px solid #da8fb5',
                outlineOffset: '3px',
                scrollMargin: '24px'
              } : undefined}
            >
              <div className="kuro-projects-cardtop">
                <span className={`kuro-projects-status is-${project.status}`}>{STATUS[project.status]}</span>
                <span className="kuro-projects-heart" aria-hidden="true">♡</span>
              </div>
              <h3>{project.name}</h3>
              {project.description && <p className="kuro-projects-description">{project.description}</p>}
              {project.bookId && (
                <p className="kuro-projects-details">
                  <strong>Mini libro asociado:</strong>{' '}
                  {bookTitles.get(project.bookId) ?? 'No disponible en la biblioteca'}
                </p>
              )}
              <div className="kuro-projects-progress-heading"><span>Progreso</span><strong>{project.progress}%</strong></div>
              <div className="kuro-projects-progressbar" role="progressbar" aria-label={`Progreso de ${project.name}`} aria-valuenow={project.progress} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${project.progress}%` }} />
              </div>
              {project.materials && <p className="kuro-projects-details"><strong>Materiales:</strong> {project.materials}</p>}
              {project.notes && <p className="kuro-projects-details"><strong>Notas:</strong> {project.notes}</p>}
              <div className="kuro-projects-actions">
                {project.bookId && bookTitles.has(project.bookId) && onOpenBook && (
                  <button type="button" onClick={() => onOpenBook(project.bookId!)}>
                    <BookOpen size={16} /> Abrir patrón
                  </button>
                )}
                <button type="button" onClick={() => openEdit(project)}><Pencil size={16} /> Editar</button>
                <button type="button" className="is-danger" onClick={() => void remove(project)}><Trash2 size={16} /> Eliminar</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="kuro-projects-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setFormOpen(false); }}>
          <div className="kuro-projects-dialog" role="dialog" aria-modal="true" aria-labelledby="project-form-title">
            <div className="kuro-projects-dialogtop">
              <h3 id="project-form-title">{editingId ? 'Editar proyecto ♡' : 'Nuevo proyecto ♡'}</h3>
              <button type="button" aria-label="Cerrar" onClick={() => setFormOpen(false)} disabled={saving}><X size={20}/></button>
            </div>
            <form onSubmit={event => void submit(event)}>
              <label>Nombre del proyecto *
                <input required maxLength={100} value={draft.name} onChange={e => setDraft(d => ({...d, name: e.target.value}))} placeholder="Ej. Conejito de crochet" autoFocus />
              </label>
              <label>Descripción
                <textarea rows={2} value={draft.description} onChange={e => setDraft(d => ({...d, description: e.target.value}))} placeholder="¿Qué vas a tejer?" />
              </label>
              <label>Buscar mini libro por nombre (opcional)
                <input
                  type="search"
                  value={bookSearch}
                  onChange={e => setBookSearch(e.target.value)}
                  placeholder="Ej. Conejo blanco"
                />
              </label>
              <label>Mini libro de mi biblioteca (opcional)
                <select value={draft.bookId ?? ''} onChange={e => setDraft(d => ({ ...d, bookId: e.target.value || null }))}>
                  <option value="">Sin mini libro asociado</option>
                  {draft.bookId && !bookTitles.has(draft.bookId) && (
                    <option value={draft.bookId}>Mini libro no disponible (mantener asociación)</option>
                  )}
                  {draft.bookId && bookTitles.has(draft.bookId) && !matchingBooks.some(book => book.id === draft.bookId) && (
                    <option value={draft.bookId}>{bookTitles.get(draft.bookId)} (seleccionado)</option>
                  )}
                  {miniBooks.length === 0 ? (
                    <option disabled value="__empty">No hay mini libros existentes</option>
                  ) : matchingBooks.length === 0 ? (
                    <option disabled value="__nomatch">No se encontraron mini libros con ese nombre</option>
                  ) : matchingBooks.map(book => (
                    <option value={book.id} key={book.id}>{book.title}</option>
                  ))}
                </select>
              </label>
              {miniBooks.length === 0 && !booksError && (
                <p className="kuro-projects-details" role="status">No hay mini libros existentes</p>
              )}
              {booksError && <p className="kuro-projects-error" role="alert">{booksError}</p>}
              <div className="kuro-projects-formrow">
                <label>Estado
                  <select value={draft.status} onChange={e => {
                    const status = e.target.value as ProjectStatus;
                    setDraft(d => ({...d, status, progress: status === 'terminado' ? 100 : d.progress}));
                  }}>
                    {Object.entries(STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label>Avance: {draft.status === 'terminado' ? 100 : draft.progress}%
                  <input type="range" min={0} max={100} step={5} disabled={draft.status === 'terminado'} value={draft.status === 'terminado' ? 100 : draft.progress} onChange={e => setDraft(d => ({...d, progress: Number(e.target.value)}))} />
                </label>
              </div>
              <label>Materiales
                <textarea rows={2} value={draft.materials} onChange={e => setDraft(d => ({...d, materials: e.target.value}))} placeholder="Lana, crochet, relleno..." />
              </label>
              <label>Notas
                <textarea rows={2} value={draft.notes} onChange={e => setDraft(d => ({...d, notes: e.target.value}))} placeholder="Ideas, detalles y avances" />
              </label>
              <div className="kuro-projects-formactions">
                <button type="button" className="kuro-projects-secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</button>
                <button type="submit" className="kuro-projects-primary" disabled={saving || !draft.name.trim()}><Check size={17}/>{saving ? 'Guardando...' : 'Guardar proyecto'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}