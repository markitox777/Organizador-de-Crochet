
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

import BookEditor from '../components/editor/BookEditor';
import Patterns from './Patterns';
import PatternInfoPanel from '../components/editor/PatternInfoPanel';
import '../styles/patternInfo.css';

import {
  getMiniBooks,
  saveMiniBook,
  deleteMiniBook
} from '../services/bookLibraryService';

import type {
  MiniBook
} from '../services/bookLibraryService';

import { getPatterns } from '../services/patternService';
import type { Pattern } from '../types/pattern';

import {
  getFolders,
  saveFolders,
  getBookLocations,
  setBookFolder,
  removeBookLocation,
  removeFolderLocations
} from '../services/folderService';

import type {
  PatternFolder
} from '../services/folderService';

import { deleteBook } from '../services/bookService';

import '../styles/bookLibrary.css';
import '../styles/folders.css';

type LibraryBook = {
  id: string;
  title: string;
  cover: string;
  legacy: boolean;
  pattern?: Pattern;
};

export default function PatternsLibrary() {
  const [folders, setFolders] = useState<PatternFolder[]>(
    getFolders
  );

  const [locations, setLocations] = useState(
    getBookLocations
  );

  const [miniBooks, setMiniBooks] = useState<MiniBook[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookTab, setBookTab] = useState<'info' | 'pages'>('info');

  const [folderId, setFolderId] = useState<string | null>(
    null
  );

  const [selectedBookId, setSelectedBookId] = useState<
    string | null
  >(null);

  const [showLegacyEditor, setShowLegacyEditor] =
    useState(false);

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

  // ==========================================
  // CARGAR DATOS
  // ==========================================

  const refresh = async () => {
    const savedBooks = await getMiniBooks();

    setMiniBooks(savedBooks);
    setPatterns(getPatterns());
    setFolders(getFolders());
    setLocations(getBookLocations());
  };

  useEffect(() => {
    let active = true;

    Promise.all([
      getMiniBooks(),
      Promise.resolve(getPatterns())
    ])
      .then(([savedBooks, savedPatterns]) => {
        if (!active) return;

        setMiniBooks(savedBooks);
        setPatterns(savedPatterns);
      })
      .catch(error => {
        console.error(error);

        if (active) {
          alert('No se pudo cargar la biblioteca.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // ==========================================
  // UNIFICAR MINI LIBROS Y PATRONES ANTIGUOS
  // ==========================================

  const books: LibraryBook[] = [
    ...miniBooks.map(book => ({
      id: book.id,
      title: book.title,
      cover: book.cover,
      legacy: false
    })),

    ...patterns
      .filter(pattern =>
        !miniBooks.some(book => book.id === pattern.id)
      )
      .map(pattern => ({
        id: pattern.id,
        title: pattern.name,
        cover: pattern.image ?? '',
        legacy: true,
        pattern
      }))
  ];

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
    if (book.legacy) {
      setSelectedBookId(book.id);
      return;
    }

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
      await saveMiniBook(book);

      if (!existing && folderId) {
        setBookFolder(book.id, folderId);
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

  const createFolder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = folderName.trim();

    if (!name) return;

    const updated: PatternFolder[] = [
      ...folders,
      {
        id: crypto.randomUUID(),
        name,
        createdAt: new Date().toISOString()
      }
    ];

    try {
      saveFolders(updated);
      setFolders(updated);
      setFolderName('');
      setShowFolderForm(false);
    } catch (error) {
      console.error(error);
      alert('No se pudo guardar la carpeta.');
    }
  };

  const renameFolder = (folder: PatternFolder) => {
    const name = window.prompt(
      'Nuevo nombre de la carpeta:',
      folder.name
    )?.trim();

    if (!name || name === folder.name) return;

    const updated = folders.map(item =>
      item.id === folder.id
        ? { ...item, name }
        : item
    );

    try {
      saveFolders(updated);
      setFolders(updated);
    } catch (error) {
      console.error(error);
      alert('No se pudo cambiar el nombre.');
    }
  };

  const deleteFolder = (folder: PatternFolder) => {
    const confirmed = window.confirm(
      `¿Eliminar la carpeta "${folder.name}"? ` +
      'Sus libros pasarán a Sin clasificar. ' +
      'No se eliminará su contenido.'
    );

    if (!confirmed) return;

    try {
      const updated = folders.filter(
        item => item.id !== folder.id
      );

      saveFolders(updated);
      removeFolderLocations(folder.id);

      setFolders(updated);
      setLocations(getBookLocations());

      if (folderId === folder.id) {
        setFolderId(null);
      }
    } catch (error) {
      console.error(error);
      alert('No se pudo eliminar la carpeta.');
    }
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

  const moveBook = (book: LibraryBook) => {
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

    try {
      if (index === 0) {
        removeBookLocation(book.id);
      } else {
        setBookFolder(
          book.id,
          folders[index - 1].id
        );
      }

      setLocations(getBookLocations());
    } catch (error) {
      console.error(error);
      alert('No se pudo mover el libro.');
    }
  };

  // ==========================================
  // ELIMINAR MINI LIBROS
  // ==========================================

  const deleteSelectedBook = async (
    book: LibraryBook
  ) => {
    if (book.legacy) {
      alert(
        'Para eliminar un patrón anterior, ' +
        'utiliza su ficha original.'
      );
      return;
    }

    const confirmed = window.confirm(
      `¿Eliminar "${book.title}" y todas sus páginas? ` +
      'Esta acción no se puede deshacer.'
    );

    if (!confirmed || busy) return;

    setBusy(true);

    try {
      await deleteBook(book.id);
      await deleteMiniBook(book.id);

      removeBookLocation(book.id);

      await refresh();

      if (selectedBookId === book.id) {
        setSelectedBookId(null);
      }
    } catch (error) {
      console.error(error);

      alert(
        'No se pudo completar la eliminación. ' +
        'Comprueba el estado del libro.'
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

  // ==========================================
  // VISTA DE PATRONES ANTERIORES
  // ==========================================

  if (showLegacyEditor) {
    return (
      <section className="kuro-library">
        <button
          type="button"
          className="kuro-library-back"
          onClick={() => {
            setShowLegacyEditor(false);
            setSelectedBookId(null);
            void refresh();
          }}
        >
          <ArrowLeft size={18} />
          Volver a la biblioteca
        </button>

        <Patterns />
      </section>
    );
  }

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
              {selectedBook.legacy
                ? 'Patrón de tu biblioteca anterior'
                : 'Mini libro digital'}
            </p>
          </div>

          {selectedBook.legacy ? (
            <button
              type="button"
              className="kuro-library-secondary"
              onClick={() =>
                setShowLegacyEditor(true)
              }
            >
              <Pencil size={16} />
              Gestionar ficha original
            </button>
          ) : (
            <button
              type="button"
              className="kuro-library-secondary"
              onClick={() =>
                editBook(selectedBook)
              }
            >
              <Pencil size={16} />
              Editar portada
            </button>
          )}
        </div>

        {selectedBook.pattern && (
          <div className="kuro-pattern-details">
            <h3>Información del patrón</h3>

            <p>
              <strong>Categoría:</strong>{' '}
              {selectedBook.pattern.category}
            </p>

            <p>
              <strong>Dificultad:</strong>{' '}
              {selectedBook.pattern.difficulty}
            </p>

            {selectedBook.pattern.description && (
              <p>
                {selectedBook.pattern.description}
              </p>
            )}

            {selectedBook.pattern.materials && (
              <p>
                <strong>Materiales:</strong>{' '}
                {selectedBook.pattern.materials}
              </p>
            )}

            {selectedBook.pattern.instructions && (
              <p>
                <strong>Instrucciones:</strong>{' '}
                {selectedBook.pattern.instructions}
              </p>
            )}

            {selectedBook.pattern.pdfName && (
              <p>
                <strong>PDF:</strong>{' '}
                {selectedBook.pattern.pdfName}
                {' · '}
                Disponible desde la ficha original.
              </p>
            )}
          </div>
        )}

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
          <PatternInfoPanel 
          key={selectedBook.id}
          bookId={selectedBook.id}
          legacy={selectedBook.legacy}  />
        ) : (
          <BookEditor 
          key={selectedBook.id}
          bookId={selectedBook.id} />
        )}
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

          <button
            type="button"
            className="kuro-library-secondary"
            onClick={() =>
              setShowLegacyEditor(true)
            }
          >
            Gestionar patrones anteriores
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
              className="kuro-library-primary"
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
                  {book.legacy
                    ? 'Patrón anterior'
                    : 'Mini libro digital'}
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

                  {!book.legacy && (
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
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
