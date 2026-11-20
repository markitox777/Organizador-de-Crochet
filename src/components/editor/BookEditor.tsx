
import { useEffect, useRef, useState } from 'react';
import type {
  ChangeEvent,
  CSSProperties,
  PointerEvent as ReactPointerEvent
} from 'react';

import {
  Type,
  ImagePlus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowUp,
  ArrowDown,
  BookOpen,
  FileText,
  Check,
  X
} from 'lucide-react';

import {
  getBook,
  saveBook,
  DEFAULT_PAPER
} from '../../services/bookService';

import type {
  BookElement,
  BookPage,
  PaperSettings,
  PaperType,
  PaperColor,
  PaperSize
} from '../../services/bookService';

type Interaction = {
  id: string;
  mode: 'move' | 'resize';
  pointerX: number;
  pointerY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
};

type SaveStatus =
  | 'loading'
  | 'saving'
  | 'saved'
  | 'error';

    const PAGE_WIDTH = 600;
    

const PAPER_TYPES: {
  value: PaperType;
  label: string;
}[] = [
  { value: 'blank', label: 'Blanco' },
  { value: 'lined', label: 'Rayado' },
  { value: 'grid', label: 'Cuadriculado' },
  { value: 'dotted', label: 'Punteado' },
  { value: 'pink', label: 'Rosa pastel' },
  { value: 'cream', label: 'Crema' }
];

const PAPER_COLORS: {
  value: PaperColor;
  label: string;
  hex: string;
}[] = [
  {
    value: 'pink',
    label: 'Rosa',
    hex: '#fff3f8'
  },
  {
    value: 'white',
    label: 'Blanco',
    hex: '#ffffff'
  },
  {
    value: 'cream',
    label: 'Crema',
    hex: '#fff9ed'
  },
  {
    value: 'blue',
    label: 'Azul',
    hex: '#f1f7ff'
  }
];

const PAPER_SIZES: {
  value: PaperSize;
  label: string;
}[] = [
  { value: 'a4', label: 'A4 vertical' },
  { value: 'a5', label: 'A5 vertical' },
  { value: 'square', label: 'Cuadrado' }
];

function getPageHeight(size: PaperSize): number {
  switch (size) {
    case 'a4':
      return Math.round(PAGE_WIDTH * 297 / 210);
    case 'a5':
      return Math.round(PAGE_WIDTH * 210 / 148);
    case 'square':
      return PAGE_WIDTH;
  }
}

function getPaperStyle(
  settings: PaperSettings
): CSSProperties {
  const color =
    PAPER_COLORS.find(
      item => item.value === settings.color
    )?.hex ?? '#ffffff';

  let backgroundColor = color;
  let backgroundImage = 'none';
  let backgroundSize = 'auto';

  switch (settings.type) {
    case 'lined':
      backgroundImage =
        'repeating-linear-gradient(' +
        'to bottom,' +
        'transparent 0px,' +
        'transparent 27px,' +
        '#e9cbd9 28px,' +
        'transparent 29px)';
      break;

    case 'grid':
      backgroundImage =
        'linear-gradient(#ead8e2 1px, transparent 1px),' +
        'linear-gradient(90deg, #ead8e2 1px, transparent 1px)';
      backgroundSize = '24px 24px';
      break;

    case 'dotted':
      backgroundImage =
        'radial-gradient(#d6b3c5 1px, transparent 1px)';
      backgroundSize = '20px 20px';
      break;

    case 'pink':
      backgroundColor = '#ffe9f2';
      break;

    case 'cream':
      backgroundColor = '#fff4dd';
      break;

    default:
      break;
  }

  return {
    backgroundColor,
    backgroundImage,
    backgroundSize,
    aspectRatio:
      `${PAGE_WIDTH} / ${getPageHeight(settings.size)}`
  };
}

function newPage(
  paper: PaperSettings = DEFAULT_PAPER
): BookPage {
  return {
    id: crypto.randomUUID(),
    elements: [],
    paper: { ...paper }
  };
}


type BookEditorProps = {
  bookId?: string;
};

export default function BookEditor({
  bookId = 'demo-book'
}: BookEditorProps) {

  const [pages, setPages] = useState<BookPage[]>([
    newPage()
  ]);

  const [pageIndex, setPageIndex] = useState(0);

  const [selectedId, setSelectedId] = useState<
    string | null
  >(null);

  const [paperPanelOpen, setPaperPanelOpen] =
    useState(false);

  const [bookLoaded, setBookLoaded] = useState(false);

  const [saveStatus, setSaveStatus] =
    useState<SaveStatus>('loading');

  const pageRef = useRef<HTMLDivElement>(null);

  const interactionRef = useRef<Interaction | null>(
    null
  );

  const saveQueueRef = useRef<Promise<void>>(
    Promise.resolve()
  );

  const currentPage = pages[pageIndex];

  const paper: PaperSettings =
    currentPage.paper ?? DEFAULT_PAPER;

  const pageHeight = getPageHeight(paper.size);

  // Recuperar el libro guardado.
  useEffect(() => {
    let active = true;

    async function loadSavedBook() {
      try {
        const savedPages = await getBook(bookId);

        if (!active) return;

        if (
          Array.isArray(savedPages) &&
          savedPages.length > 0
        ) {
          setPages(savedPages);
        }

        setSaveStatus('saved');
        setBookLoaded(true);
      } catch (error) {
        console.error(
          'Error al cargar el libro:',
          error
        );

        if (active) {
          setSaveStatus('error');
        }
      }
    }

    void loadSavedBook();

    return () => {
      active = false;
    };
  }, [bookId]);

  // Guardar cambios automáticamente.
  useEffect(() => {
    if (!bookLoaded) return;

    setSaveStatus('saving');

    let cancelled = false;

    const timeout = window.setTimeout(() => {
      const snapshot = pages;

      const nextSave = saveQueueRef.current
        .catch(() => undefined)
        .then(() => {
          if (cancelled) return;
          return saveBook(bookId, snapshot);
        });

      saveQueueRef.current = nextSave;

      void nextSave.then(
        () => {
          if (!cancelled) {
            setSaveStatus('saved');
          }
        },
        error => {
          console.error(
            'Error al guardar:',
            error
          );

          if (!cancelled) {
            setSaveStatus('error');
          }
        }
      );
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [pages, bookLoaded, bookId]);

  const updatePage = (
    updater: (page: BookPage) => BookPage
  ) => {
    setPages(previous =>
      previous.map((page, index) =>
        index === pageIndex
          ? updater(page)
          : page
      )
    );
  };

  const updatePaper = (
    changes: Partial<PaperSettings>
  ) => {
    updatePage(page => ({
      ...page,
      paper: {
        ...DEFAULT_PAPER,
        ...page.paper,
        ...changes
      }
    }));
  };

  const applyPaperToAll = () => {
    setPages(previous =>
      previous.map(page => ({
        ...page,
        paper: { ...paper }
      }))
    );
  };

  const updateElement = (
    id: string,
    changes: Partial<BookElement>
  ) => {
    updatePage(page => ({
      ...page,
      elements: page.elements.map(element =>
        element.id === id
          ? { ...element, ...changes }
          : element
      )
    }));
  };

  const addText = () => {
    const element: BookElement = {
      id: crypto.randomUUID(),
      type: 'text',
      x: 60,
      y: 70,
      width: 280,
      height: 140,
      content: 'Escribe aquí...'
    };

    updatePage(page => ({
      ...page,
      elements: [...page.elements, element]
    }));

    setSelectedId(element.id);
  };

  const addImage = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (
      ![
        'image/png',
        'image/jpeg',
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

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        return;
      }

      const element: BookElement = {
        id: crypto.randomUUID(),
        type: 'image',
        x: 90,
        y: 120,
        width: 240,
        height: 240,
        content: reader.result
      };

      updatePage(page => ({
        ...page,
        elements: [...page.elements, element]
      }));

      setSelectedId(element.id);
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const deleteSelected = () => {
    if (!selectedId) return;

    updatePage(page => ({
      ...page,
      elements: page.elements.filter(
        element => element.id !== selectedId
      )
    }));

    setSelectedId(null);
  };

  // Control de capas.
  const moveLayer = (
    direction: 'forward' | 'backward'
  ) => {
    if (!selectedId) return;

    updatePage(page => {
      const elements = [...page.elements];

      const index = elements.findIndex(
        element => element.id === selectedId
      );

      if (index === -1) return page;

      const target =
        direction === 'forward'
          ? index + 1
          : index - 1;

      if (
        target < 0 ||
        target >= elements.length
      ) {
        return page;
      }

      [elements[index], elements[target]] = [
        elements[target],
        elements[index]
      ];

      return {
        ...page,
        elements
      };
    });
  };

  const startInteraction = (
    event: ReactPointerEvent<HTMLDivElement>,
    element: BookElement,
    mode: 'move' | 'resize'
  ) => {
    if (
      mode === 'move' &&
      (event.target as HTMLElement).closest(
        'textarea'
      )
    ) {
      setSelectedId(element.id);
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    event.currentTarget.setPointerCapture(
      event.pointerId
    );

    setSelectedId(element.id);

    interactionRef.current = {
      id: element.id,
      mode,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: element.x,
      startY: element.y,
      startWidth: element.width,
      startHeight: element.height
    };
  };

  const moveInteraction = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    const interaction = interactionRef.current;

    if (!interaction) return;

    const pageWidth =
      pageRef.current?.clientWidth ?? PAGE_WIDTH;

    const scale = pageWidth / PAGE_WIDTH;

    const deltaX =
      (event.clientX - interaction.pointerX) / scale;

    const deltaY =
      (event.clientY - interaction.pointerY) / scale;

    if (interaction.mode === 'move') {
      const element = currentPage.elements.find(
        item => item.id === interaction.id
      );

      if (!element) return;

      updateElement(interaction.id, {
        x: Math.max(
          0,
          Math.min(
            PAGE_WIDTH - element.width,
            Math.round(
              interaction.startX + deltaX
            )
          )
        ),
        y: Math.max(
          0,
          Math.min(
            pageHeight - element.height,
            Math.round(
              interaction.startY + deltaY
            )
          )
        )
      });
    } else {
      updateElement(interaction.id, {
        width: Math.max(
          80,
          Math.min(
            PAGE_WIDTH - interaction.startX,
            Math.round(
              interaction.startWidth + deltaX
            )
          )
        ),
        height: Math.max(
          50,
          Math.min(
            pageHeight - interaction.startY,
            Math.round(
              interaction.startHeight + deltaY
            )
          )
        )
      });
    }
  };

  const stopInteraction = () => {
    interactionRef.current = null;
  };

  const addPage = () => {
    const nextIndex = pages.length;

    setPages(previous => [
      ...previous,
      newPage(paper)
    ]);

    setPageIndex(nextIndex);
    setSelectedId(null);
  };

  const changePage = (index: number) => {
    setPageIndex(index);
    setSelectedId(null);
  };

  const selectedIndex =
    currentPage.elements.findIndex(
      element => element.id === selectedId
    );

  const canMoveBackward = selectedIndex > 0;

  const canMoveForward =
    selectedIndex >= 0 &&
    selectedIndex <
      currentPage.elements.length - 1;

  return (
    <section className="kuro-editor">
      <div className="kuro-editor-top">
        <div className="kuro-editor-heading">
          <BookOpen size={22} />

          <div>
            <h3>Mi mini libro</h3>
            <p>Tu espacio para crear</p>
          </div>
        </div>

        <span className="kuro-editor-status">
          {saveStatus === 'loading' &&
            'Cargando...'}

          {saveStatus === 'saving' &&
            'Guardando...'}

          {saveStatus === 'saved' &&
            '✓ Guardado'}

          {saveStatus === 'error' &&
            'Error de guardado'}
        </span>
      </div>

      <div className="kuro-editor-toolbar">
        <div className="kuro-tool-group">
          <button
            type="button"
            onClick={addText}
            disabled={!bookLoaded}
            title="Agregar texto"
          >
            <Type size={19} />
            <span>Texto</span>
          </button>

          <label
            className="kuro-tool-button"
            title="Agregar imagen"
          >
            <ImagePlus size={19} />
            <span>Imagen</span>

            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={addImage}
              disabled={!bookLoaded}
              hidden
            />
          </label>

          <button
            type="button"
            onClick={() =>
              setPaperPanelOpen(previous => !previous)
            }
            disabled={!bookLoaded}
            className={
              paperPanelOpen
                ? 'kuro-tool-active'
                : ''
            }
            aria-expanded={paperPanelOpen}
          >
            <FileText size={19} />
            <span>Papel</span>
          </button>
        </div>

        <div className="kuro-tool-divider" />

        <div className="kuro-tool-group">
          <button
            type="button"
            onClick={() => moveLayer('forward')}
            disabled={!bookLoaded || !canMoveForward}
          >
            <ArrowUp size={19} />
            <span>Adelante</span>
          </button>

          <button
            type="button"
            onClick={() => moveLayer('backward')}
            disabled={!bookLoaded || !canMoveBackward}
          >
            <ArrowDown size={19} />
            <span>Atrás</span>
          </button>
        </div>

        <div className="kuro-tool-divider" />

        <button
          type="button"
          className="kuro-delete-button"
          onClick={deleteSelected}
          disabled={!bookLoaded || !selectedId}
        >
          <Trash2 size={19} />
          <span>Eliminar</span>
        </button>
      </div>

      {paperPanelOpen && (
        <div className="kuro-paper-panel">
          <div className="kuro-paper-panel-heading">
            <div>
              <h4>Personalizar papel</h4>
              <p>
                Configura la página actual.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setPaperPanelOpen(false)
              }
              aria-label="Cerrar selector"
            >
              <X size={19} />
            </button>
          </div>

          <h5>Tipo de hoja</h5>

          <div className="kuro-paper-options">
            {PAPER_TYPES.map(option => (
              <button
                type="button"
                key={option.value}
                className={
                  'kuro-paper-option' +
                  (paper.type === option.value
                    ? ' active'
                    : '')
                }
                onClick={() =>
                  updatePaper({
                    type: option.value
                  })
                }
              >
                <span
                  className={
                    'kuro-paper-preview ' +
                    'paper-' + option.value
                  }
                />

                <span>{option.label}</span>

                {paper.type === option.value && (
                  <Check size={15} />
                )}
              </button>
            ))}
          </div>

          <div className="kuro-paper-settings-grid">
            <div>
              <h5>Color del papel</h5>

              <div className="kuro-paper-colors">
                {PAPER_COLORS.map(option => (
                  <button
                    type="button"
                    key={option.value}
                    className={
                      'kuro-color-choice' +
                      (paper.color === option.value
                        ? ' active'
                        : '')
                    }
                    title={option.label}
                    aria-label={
                      'Color ' + option.label
                    }
                    aria-pressed={
                      paper.color === option.value
                    }
                    style={{
                      backgroundColor: option.hex
                    }}
                    onClick={() =>
                      updatePaper({
                        color: option.value
                      })
                    }
                  >
                    {paper.color === option.value && (
                      <Check size={16} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h5>Tamaño de hoja</h5>

              <select
                className="kuro-paper-select"
                value={paper.size}
                onChange={event =>
                  updatePaper({
                    size: event.target
                      .value as PaperSize
                  })
                }
              >
                {PAPER_SIZES.map(option => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            className="kuro-apply-all"
            onClick={applyPaperToAll}
          >
            Aplicar este papel a todas las páginas
          </button>
        </div>
      )}

      <div
        className="kuro-editor-workspace"
        style={{
          pointerEvents: bookLoaded
            ? 'auto'
            : 'none',
          opacity: bookLoaded ? 1 : 0.5
        }}
      >
        <div className="kuro-page-surround">
          <div
            ref={pageRef}
            className="kuro-paper"
            style={getPaperStyle(paper)}
            onPointerDown={event => {
              if (
                event.target === event.currentTarget
              ) {
                setSelectedId(null);
              }
            }}
          >
            {currentPage.elements.map(
              (element, index) => (
                <div
                  key={element.id}
                  className={
                    'kuro-element' +
                    (selectedId === element.id
                      ? ' is-selected'
                      : '')
                  }
                  style={{
                    left: `${
                      element.x / PAGE_WIDTH * 100
                    }%`,
                    top: `${
                      element.y / pageHeight * 100
                    }%`,
                    width: `${
                      element.width / PAGE_WIDTH * 100
                    }%`,
                    height: `${
                      element.height / pageHeight * 100
                    }%`,
                    zIndex: index + 1
                  }}
                  onPointerDown={event =>
                    startInteraction(
                      event,
                      element,
                      'move'
                    )
                  }
                  onPointerMove={moveInteraction}
                  onPointerUp={stopInteraction}
                  onPointerCancel={stopInteraction}
                >
                  {element.type === 'text' ? (
                    <textarea
                      value={element.content}
                      onPointerDown={event => {
                        event.stopPropagation();
                        setSelectedId(element.id);
                      }}
                      onChange={event =>
                        updateElement(element.id, {
                          content: event.target.value
                        })
                      }
                      spellCheck
                    />
                  ) : (
                    <img
                      src={element.content}
                      alt="Imagen del mini libro"
                      draggable={false}
                    />
                  )}

                  {selectedId === element.id && (
                    <>
                      <div className="kuro-element-handle">
                        Arrastrar
                      </div>

                      <div
                        className="kuro-resize-handle"
                        title="Cambiar tamaño"
                        onPointerDown={event =>
                          startInteraction(
                            event,
                            element,
                            'resize'
                          )
                        }
                      />
                    </>
                  )}
                </div>
              )
            )}
          </div>

          <div className="kuro-page-label">
            Página {pageIndex + 1}
            {' · '}
            {PAPER_TYPES.find(
              item => item.value === paper.type
            )?.label}
            {' · '}
            {paper.size.toUpperCase()}
          </div>
        </div>
      </div>

      <div className="kuro-editor-footer">
        <div className="kuro-page-navigation">
          <button
            type="button"
            disabled={
              !bookLoaded || pageIndex === 0
            }
            onClick={() =>
              changePage(pageIndex - 1)
            }
            aria-label="Página anterior"
          >
            <ChevronLeft size={20} />
          </button>

          <span>
            {pageIndex + 1} / {pages.length}
          </span>

          <button
            type="button"
            disabled={
              !bookLoaded ||
              pageIndex === pages.length - 1
            }
            onClick={() =>
              changePage(pageIndex + 1)
            }
            aria-label="Página siguiente"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <button
          type="button"
          className="kuro-new-page"
          onClick={addPage}
          disabled={!bookLoaded}
        >
          <Plus size={18} />
          Nueva página
        </button>
      </div>
    </section>
  );
}
