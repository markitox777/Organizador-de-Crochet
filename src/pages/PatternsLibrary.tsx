
import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import {
  ArrowLeft,
  BookOpen,
  Folder,
  FolderPlus,
  ImagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  X
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import BookEditor from '../components/editor/BookEditor';
import PatternInfoPanel from '../components/editor/PatternInfoPanel';
import type { MiniBook } from '../services/bookLibraryService';
import type { PatternFolder } from '../services/folderService';
import '../styles/patternInfo.css';

import '../styles/bookLibrary.css';
import '../styles/folders.css';

type LibraryBook = {
  id: string;
  title: string;
  cover: string;
};

type PatternsLibraryProps = {
  requestedBookId?: string | null;
};

export default function PatternsLibrary({ requestedBookId = null }: PatternsLibraryProps) {
  const [folders, setFolders] = useState<PatternFolder[]>([]);
  const [locations, setLocations] = useState<Record<string, string>>({});
  const [owner, setOwner] = useState<string | null>(null);
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');

  const [miniBooks, setMiniBooks] = useState<MiniBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookTab, setBookTab] = useState<'info' | 'pages'>('info');

  const [folderId, setFolderId] = useState<string | null>(
    null
  );

  const [selectedBookId, setSelectedBookId] = useState<
    string | null
  >(null);

  const [search, setSearch] = useState('');
  const [folderName, setFolderName] = useState('');
  const [showFolderForm, setShowFolderForm] =
    useState(false);

  const [showBookForm, setShowBookForm] =
    useState(false);

  const [editingBookId, setEditingBookId] =
    useState<string | null>(null);

  const [bookTitle, setBookTitle] = useState('');
  const [bookCover, setBookCover] = useState('');
  const [busy, setBusy] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  // Abrir el mini libro solicitado desde Mis proyectos.
  useEffect(() => {
    if (requestedBookId) {
      setSelectedBookId(requestedBookId);
      setBookTab('pages');
    }
  }, [requestedBookId]);

  // ==========================================
  // CARGAR DATOS
  // ==========================================

  // Solo datos de la cuenta activa; nunca leer los registros locales anteriores.
  const loadLibrary = async (userId: string) => {
    const [folderResult, bookResult] = await Promise.all([
      supabase.from('kurotex_folders').select('id,name,created_at').eq('user_id', userId).order('created_at'),
      supabase.from('kurotex_books').select('id,title,folder_id,data,created_at,updated_at').eq('user_id', userId).order('updated_at', { ascending: false }),
    ]);
    if (folderResult.error) throw folderResult.error;
    if (bookResult.error) throw bookResult.error;
    const nextFolders: PatternFolder[] = (folderResult.data ?? []).map(row => ({ id: row.id, name: row.name, createdAt: row.created_at }));
    const nextLocations: Record<string, string> = {};
    const nextBooks: MiniBook[] = (bookResult.data ?? []).map(row => {
      if (row.folder_id) nextLocations[row.id] = row.folder_id;
      return { id: row.id, title: row.title, cover: typeof row.data?.cover === 'string' ? row.data.cover : '', createdAt: row.created_at, updatedAt: row.updated_at };
    });
    return { nextFolders, nextLocations, nextBooks };
  };

  const requireOwner = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !owner || data.user?.id !== owner) throw new Error('La sesión cambió. Vuelve a abrir la biblioteca.');
    return owner;
  };

  const refresh = async () => {
    const userId = await requireOwner();
    const result = await loadLibrary(userId);
    await requireOwner();
    setFolders(result.nextFolders);
    setLocations(result.nextLocations);
    setMiniBooks(result.nextBooks);
  };

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextOwner = session?.user.id ?? null;
      setOwner(previous => previous === nextOwner ? previous : nextOwner);
    });
    void supabase.auth.getUser().then(({ data, error }) => {
      if (active && !error) setOwner(data.user?.id ?? null);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let active = true;
    setFolders([]); setLocations({}); setMiniBooks([]);
    setFolderId(null); setSelectedBookId(requestedBookId);
    setShowBookForm(false); setShowFolderForm(false);
    setBookTitle(''); setBookCover(''); setEditingBookId(null); setFolderName('');
    setLoadError(''); setLoading(true);
    if (!owner) return () => { active = false; };
    void loadLibrary(owner).then(result => {
      if (!active) return;
      setFolders(result.nextFolders); setLocations(result.nextLocations); setMiniBooks(result.nextBooks); setLoadedOwner(owner);
    }).catch(error => {
      console.error(error);
      if (active) setLoadError('No se pudo cargar tu biblioteca privada. Vuelve a entrar en Mis patrones.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [owner]);

  const books: LibraryBook[] = miniBooks.map(book => ({ id: book.id, title: book.title, cover: book.cover }));

  const selectedBook = books.find(
    book => book.id === selectedBookId
  );

  const currentFolder = folders.find(
    folder => folder.id === folderId
  );

  // ==========================================
  // FILTRAR LIBROS POR CARPETA
  // ==========================================

  const folderBooks = books.filter(book => {
    const assignedFolder = locations[book.id] ?? '';

    const validFolder = folders.some(
      folder => folder.id === assignedFolder
    );

    // Si la carpeta ya no existe,
    // el libro aparece en Sin clasificar.
    const effectiveFolder = validFolder
      ? assignedFolder
      : '';

    const belongsToFolder =
      effectiveFolder === (folderId ?? '');

    const matchesSearch = book.title
      .toLowerCase()
      .includes(search.trim().toLowerCase());

    return belongsToFolder && matchesSearch;
  });

  // ==========================================
  // FORMULARIO DE LIBROS
  // ==========================================

  const resetBookForm = () => {
    setBookTitle('');
    setBookCover('');
    setEditingBookId(null);
    setShowBookForm(false);
    setImageLoading(false);
  };

  const openNewBookForm = () => {
    resetBookForm();
    setShowBookForm(true);
  };

  const editBook = (book: LibraryBook) => {
    setEditingBookId(book.id);
    setBookTitle(book.title);
    setBookCover(book.cover);
    setShowBookForm(true);
  };

  const handleCoverChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (
      ![
        'image/jpeg',
        'image/png',
        'image/webp'
      ].includes(file.type)
    ) {
      alert('Selecciona una imagen JPG, PNG o WebP.');
      event.target.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen no puede superar los 2 MB.');
      event.target.value = '';
      return;
    }

    setImageLoading(true);

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBookCover(reader.result);
      }

      setImageLoading(false);
    };

    reader.onerror = () => {
      setImageLoading(false);
      alert('No se pudo leer la portada.');
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const saveBookDetails = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (
      !bookTitle.trim() ||
      busy ||
      imageLoading
    ) {
      return;
    }

    setBusy(true);

    const existing = miniBooks.find(
      book => book.id === editingBookId
    );

    const now = new Date().toISOString();

    const book: MiniBook = {
      id: existing?.id ?? crypto.randomUUID(),
      title: bookTitle.trim(),
      cover: bookCover,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    try {
      const userId = await requireOwner();
      if (existing) {
        // Preservar páginas y futuros campos JSON; rechazar cambios concurrentes.
        const { data: row, error: readError } = await supabase.from('kurotex_books')
          .select('data,updated_at').eq('user_id', userId).eq('id', book.id).single();
        if (readError || !row) throw readError ?? new Error('Libro no encontrado.');
        const { data: updated, error } = await supabase.from('kurotex_books')
          .update({ title: book.title, data: { ...row.data, cover: book.cover }, updated_at: now })
          .eq('user_id', userId).eq('id', book.id).eq('updated_at', row.updated_at).select('id').maybeSingle();
        if (error || !updated) throw error ?? new Error('El libro cambió durante la edición.');
      } else {
        const { error } = await supabase.from('kurotex_books').insert({
          id: book.id, user_id: userId, title: book.title, folder_id: folderId || null,
          data: { cover: book.cover, pages: [] }, created_at: book.createdAt, updated_at: now,
        });
        if (error) throw error;
      }

      await refresh();
      resetBookForm();
    } catch (error) {
      console.error(error);
      alert('No se pudo guardar el mini libro.');
    } finally {
      setBusy(false);
    }
  };

  // ==========================================
  // CARPETAS
  // ==========================================

  const createFolder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = folderName.trim();
    if (!name || busy || loading) return;
    setBusy(true);
    try {
      const userId = await requireOwner();
      const { error } = await supabase.from('kurotex_folders').insert({ id: crypto.randomUUID(), user_id: userId, name });
      if (error) throw error;
      await refresh(); setFolderName(''); setShowFolderForm(false);
    } catch (error) { console.error(error); alert('No se pudo guardar la carpeta.'); }
    finally { setBusy(false); }
  };

  const renameFolder = async (folder: PatternFolder) => {
    if (busy || loading) return;
    const name = window.prompt('Nuevo nombre de la carpeta:', folder.name)?.trim();
    if (!name || name === folder.name) return;
    setBusy(true);
    try {
      const userId = await requireOwner();
      const { data, error } = await supabase.from('kurotex_folders').update({ name, updated_at: new Date().toISOString() })
        .eq('user_id', userId).eq('id', folder.id).select('id').maybeSingle();
      if (error || !data) throw error ?? new Error('Carpeta no encontrada.');
      await refresh();
    } catch (error) { console.error(error); alert('No se pudo cambiar el nombre.'); }
    finally { setBusy(false); }
  };

  const deleteFolder = async (folder: PatternFolder) => {
    if (busy || loading) return;
    if (!window.confirm(`¿Eliminar la carpeta "${folder.name}"? Sus libros pasarán a Sin clasificar. No se eliminará su contenido.`)) return;
    setBusy(true);
    try {
      const userId = await requireOwner();
      const moved = await supabase.from('kurotex_books').update({ folder_id: null, updated_at: new Date().toISOString() })
        .eq('user_id', userId).eq('folder_id', folder.id);
      if (moved.error) throw moved.error;
      const removed = await supabase.from('kurotex_folders').delete().eq('user_id', userId).eq('id', folder.id).select('id').maybeSingle();
      if (removed.error || !removed.data) throw removed.error ?? new Error('Carpeta no encontrada.');
      if (folderId === folder.id) setFolderId(null);
    } catch (error) { console.error(error); alert('No se pudo completar la eliminación. Es posible que los libros ya estén en Sin clasificar.'); }
    finally { try { await refresh(); } catch (error) { console.error(error); } setBusy(false); }
  };

  const openFolder = (id: string | null) => {
    setFolderId(id);
    setSearch('');
    resetBookForm();
    setShowFolderForm(false);
  };

  // ==========================================
  // MOVER LIBROS
  // ==========================================

  const moveBook = async (book: LibraryBook) => {
    if (busy || loading) return;
    const options = [
      '0 - Sin clasificar',
      ...folders.map(
        (folder, index) =>
          `${index + 1} - ${folder.name}`
      )
    ];

    const answer = window.prompt(
      `Mover "${book.title}" a:\n\n` +
      options.join('\n') +
      '\n\nEscribe el número de la carpeta.'
    );

    if (answer === null) return;

    const index = Number(answer.trim());

    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index > folders.length
    ) {
      alert('Selecciona un número válido.');
      return;
    }

    setBusy(true);
    try {
      const userId = await requireOwner();
      const { data, error } = await supabase.from('kurotex_books').update({ folder_id: index === 0 ? null : folders[index - 1].id, updated_at: new Date().toISOString() })
        .eq('user_id', userId).eq('id', book.id).select('id').maybeSingle();
      if (error || !data) throw error ?? new Error('Libro no encontrado.');
      await refresh();
    } catch (error) { console.error(error); alert('No se pudo mover el libro.'); }
    finally { setBusy(false); }
  };

  // ==========================================
  // ELIMINAR MINI LIBROS
  // ==========================================

  const deleteSelectedBook = async (
    book: LibraryBook
  ) => {
    const confirmed = window.confirm(
      `¿Eliminar "${book.title}" y todas sus páginas? ` +
      'Esta acción no se puede deshacer.'
    );

    if (!confirmed || busy) return;

    setBusy(true);

    try {
      const userId = await requireOwner();
      const { data, error } = await supabase.from('kurotex_books').delete().eq('user_id', userId).eq('id', book.id).select('id').maybeSingle();
      if (error?.code === '23503') throw new Error('El libro está vinculado a un proyecto o pedido. Desvincúlalo antes de eliminarlo.');
      if (error || !data) throw error ?? new Error('Libro no encontrado.');

      await refresh();

      if (selectedBookId === book.id) {
        setSelectedBookId(null);
      }
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error ? error.message : 'No se pudo eliminar el libro.'
      );
    } finally {
      setBusy(false);
    }
  };

  // ==========================================
  // FORMULARIO VISUAL
  // ==========================================

  const renderBookForm = () => (
    <form
      className="kuro-library-form"
      onSubmit={saveBookDetails}
    >
      <div className="kuro-library-form-heading">
        <h3>
          {editingBookId
            ? 'Editar mini libro'
            : 'Nuevo mini libro'}
        </h3>

        <button
          type="button"
          onClick={resetBookForm}
          aria-label="Cerrar"
          disabled={busy}
        >
          <X size={20} />
        </button>
      </div>

      <label className="kuro-library-field">
        Nombre del mini libro

        <input
          required
          maxLength={100}
          value={bookTitle}
          onChange={event =>
            setBookTitle(event.target.value)
          }
          placeholder="Ej: Conejito amigurumi"
        />
      </label>

      <div className="kuro-library-upload">
        <span>Fotografía de portada</span>

        <label className="kuro-library-upload-button">
          <ImagePlus size={18} />
          Elegir fotografía

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleCoverChange}
            hidden
          />
        </label>

        {imageLoading && (
          <p>Procesando imagen...</p>
        )}

        {bookCover && (
          <div className="kuro-library-cover-preview">
            <img
              src={bookCover}
              alt="Vista previa de portada"
            />

            <button
              type="button"
              onClick={() => setBookCover('')}
            >
              Quitar portada
            </button>
          </div>
        )}
      </div>

      <div className="kuro-library-form-actions">
        <button
          type="submit"
          className="kuro-library-primary"
          disabled={busy || imageLoading}
        >
          {busy
            ? 'Guardando...'
            : editingBookId
              ? 'Guardar cambios'
              : 'Crear mini libro'}
        </button>

        <button
          type="button"
          className="kuro-library-secondary"
          onClick={resetBookForm}
          disabled={busy}
        >
          Cancelar
        </button>
      </div>
    </form>
  );

  if (loading || !owner || (loadedOwner !== owner && !loadError)) return <section className="kuro-library"><p role="status">Cargando tu biblioteca privada...</p></section>;
  if (loadError) return <section className="kuro-library"><p role="alert">{loadError}</p><button className="kuro-library-primary" onClick={() => window.location.reload()}>Reintentar</button></section>;

  // ==========================================
  // INTERIOR DE UN MINI LIBRO
  // ==========================================

  if (selectedBook) {
    return (
      <section className="kuro-library">
        <button
          type="button"
          className="kuro-library-back"
          onClick={() => {
            setSelectedBookId(null);
            resetBookForm();
          }}
        >
          <ArrowLeft size={18} />
          Volver a la carpeta
        </button>

        <div className="kuro-library-editor-heading">
          <div>
            <h2>{selectedBook.title}</h2>

            <p>
              Mini libro digital
            </p>
          </div>
          <button type="button" className="kuro-library-secondary" onClick={() => editBook(selectedBook)} disabled={busy}>
            <Pencil size={16} /> Editar portada
          </button>
        </div>

        {showBookForm && renderBookForm()}

        <div className="kuro-book-tabs">
          <button
            type="button"
            className={bookTab === 'info' ? 'active' : ''}
            onClick={() => setBookTab('info')}
          >
            Información del patrón
          </button>
          <button
            type="button"
            className={bookTab === 'pages' ? 'active' : ''}
            onClick={() => setBookTab('pages')}
          >
            📖 Cuaderno digital
          </button>
        </div>

        {bookTab === 'info' ? (
          owner ? <PatternInfoPanel key={`${owner}:${selectedBook.id}`} bookId={selectedBook.id} ownerId={owner} /> : null
        ) : owner ? (
          <BookEditor
            key={`${owner}:${selectedBook.id}`}
            bookId={selectedBook.id}
            ownerId={owner}
          />
        ) : null}
      </section>
    );
  }

  // ==========================================
  // VISTA PRINCIPAL: CARPETAS
  // ==========================================

  if (folderId === null) {
    return (
      <section className="kuro-library">
        <div className="kuro-library-heading">
          <h2>🧶 Mis patrones</h2>
          <p>
            Organiza tus carpetas y mini libros.
          </p>
        </div>

        <div className="kuro-library-toolbar">
          <button
            type="button"
            className="kuro-library-primary"
            onClick={() =>
              setShowFolderForm(previous => !previous)
            }
          >
            <FolderPlus size={18} />
            Nueva carpeta
          </button>

        </div>

        {showFolderForm && (
          <form
            className="kuro-folder-create"
            onSubmit={createFolder}
          >
            <input
              autoFocus
              required
              maxLength={80}
              placeholder="Nombre de la carpeta"
              value={folderName}
              onChange={event =>
                setFolderName(event.target.value)
              }
            />

            <button
              type="submit"
              className="kuro-library-primary" disabled={busy}
            >
              Crear
            </button>
          </form>
        )}

        <div className="kuro-folder-grid">
          <article className="kuro-folder-card">
            <button
              type="button"
              className="kuro-folder-open"
              onClick={() => openFolder('')}
            >
              <Folder size={36} />

              <strong>Sin clasificar</strong>

              <span>
                {
                  books.filter(book => {
                    const assigned = locations[book.id];

                    return (
                      !assigned ||
                      !folders.some(
                        folder => folder.id === assigned
                      )
                    );
                  }).length
                }{' '}
                libros
              </span>
            </button>
          </article>

          {folders.map(folder => (
            <article
              className="kuro-folder-card"
              key={folder.id}
            >
              <button
                type="button"
                className="kuro-folder-open"
                onClick={() =>
                  openFolder(folder.id)
                }
              >
                <Folder size={36} />

                <strong>{folder.name}</strong>

                <span>
                  {
                    books.filter(
                      book =>
                        locations[book.id] === folder.id
                    ).length
                  }{' '}
                  libros
                </span>
              </button>

              <div className="kuro-folder-actions">
                <button
                  type="button"
                  title="Renombrar carpeta"
                  onClick={() =>
                    renameFolder(folder)
                  }
                >
                  <Pencil size={16} />
                </button>

                <button
                  type="button"
                  title="Eliminar carpeta"
                  onClick={() =>
                    deleteFolder(folder)
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  // ==========================================
  // VISTA DENTRO DE UNA CARPETA
  // ==========================================

  return (
    <section className="kuro-library">
      <button
        type="button"
        className="kuro-library-back"
        onClick={() => openFolder(null)}
      >
        <ArrowLeft size={18} />
        Mis patrones
      </button>

      <div className="kuro-library-heading">
        <h2>
          📁 {currentFolder?.name ?? 'Sin clasificar'}
        </h2>

        <p>
          Mini libros y patrones de esta carpeta.
        </p>
      </div>

      <div className="kuro-library-toolbar">
        <label className="kuro-library-search">
          <Search size={18} />

          <input
            type="search"
            value={search}
            onChange={event =>
              setSearch(event.target.value)
            }
            placeholder="Buscar mini libros..."
          />
        </label>

        <button
          type="button"
          className="kuro-library-primary"
          onClick={openNewBookForm}
        >
          <Plus size={18} />
          Nuevo mini libro
        </button>
      </div>

      {showBookForm && renderBookForm()}

      {loading ? (
        <p className="kuro-library-empty">
          Cargando biblioteca...
        </p>
      ) : folderBooks.length === 0 ? (
        <div className="kuro-library-empty">
          <BookOpen size={34} />

          <h3>
            {search
              ? 'No encontramos ese libro'
              : 'Esta carpeta está vacía'}
          </h3>

          <p>
            {search
              ? 'Prueba con otro nombre.'
              : 'Crea un mini libro o mueve uno aquí.'}
          </p>
        </div>
      ) : (
        <div className="kuro-library-grid">
          {folderBooks.map(book => (
            <article
              className="kuro-library-card"
              key={book.id}
            >
              <button
                type="button"
                className="kuro-library-card-cover"
                onClick={() =>
                  setSelectedBookId(book.id)
                }
              >
                {book.cover ? (
                  <img
                    src={book.cover}
                    alt={book.title}
                  />
                ) : (
                  <div className="kuro-library-placeholder">
                    <BookOpen size={36} />
                    <span>Kurotex</span>
                  </div>
                )}
              </button>

              <div className="kuro-library-card-info">
                <h3>{book.title}</h3>

                <p>
                  Mini libro digital
                </p>

                <div className="kuro-library-card-actions">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedBookId(book.id)
                    }
                  >
                    Abrir
                  </button>

                  <button
                    type="button"
                    title="Mover a otra carpeta"
                    onClick={() =>
                      moveBook(book)
                    }
                  >
                    <Folder size={16} />
                  </button>

                  <button
                    type="button"
                    title="Editar"
                    onClick={() =>
                      editBook(book)
                    }
                  >
                    <Pencil size={16} />
                  </button>

                    <button
                      type="button"
                      title="Eliminar"
                      disabled={busy}
                      onClick={() =>
                        void deleteSelectedBook(book)
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
