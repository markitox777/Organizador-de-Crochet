
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { supabase } from '../../lib/supabase';
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
  X,
  PanelsTopLeft,
  MoreHorizontal
} from 'lucide-react';

import {
  getCloudBookPages,
  saveCloudBookPages,
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

import '../../styles/kurotexEditorConsolidado.css';
import PageThumbnails from './PageThumbnails';
import RichTextEditor from './RichTextEditor';

type Interaction = {
  id: string;
  mode: 'move' | 'resize';
  pointerX: number;
  pointerY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  pointerId: number;
  pageIndex: number;
  pageHeight: number;
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


/**
 * Mide el contenido real de Tiptap y sincroniza la altura del cuadro
 * en coordenadas de la página (600 unidades), incluso en pantallas móviles.
 */
function AutoGrowTextBox({
  element,
  pageHeight,
  pageRef,
  onChange,
  onHeightChange,
  onSelect,
  onEditorReady,
  onEditorStateChange
}: {
  element: BookElement;
  pageHeight: number;
  pageRef: React.RefObject<HTMLDivElement | null>;
  onChange: (html: string) => void;
  onHeightChange: (height: number) => void;
  onSelect: () => void;
  onEditorReady: (id: string, editor: Editor | null) => void;
  onEditorStateChange: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const heightRef = useRef(element.height);
  const heightChangeRef = useRef(onHeightChange);
  heightRef.current = element.height;
  heightChangeRef.current = onHeightChange;

  useEffect(() => {
    const container = containerRef.current;
    const content = container?.querySelector<HTMLElement>('.kuro-rich-text-content');
    if (!container || !content) return;

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const pageWidth = pageRef.current?.clientWidth ?? PAGE_WIDTH;
        if (!pageWidth) return;
        const scale = pageWidth / PAGE_WIDTH;
        // El texto usa píxeles CSS reales, mientras que el cuadro guarda
        // su altura en unidades lógicas de la hoja.
        const requiredPixels = Math.max(content.scrollHeight, content.getBoundingClientRect().height);
        const desired = Math.max(12, Math.ceil((requiredPixels + 2) / scale));
        const available = Math.max(12, pageHeight - element.y);
        const next = Math.min(desired, available);
        if (Math.abs(next - heightRef.current) > 2) {
          heightRef.current = next;
          heightChangeRef.current(next);
        }
      });
    };

    const observer = new ResizeObserver(measure);
    observer.observe(content);
    if (pageRef.current) observer.observe(pageRef.current);
    const mutations = new MutationObserver(measure);
    mutations.observe(content, { childList: true, characterData: true, subtree: true, attributes: true });
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      mutations.disconnect();
    };
  }, [element.id, element.y, pageHeight, pageRef]);

  return (
    <div
      ref={containerRef}
      className="kuro-text-container kuro-auto-grow-text"
      style={{
        fontFamily: element.textStyle?.fontFamily ?? 'Arial, sans-serif',
        fontSize: `${element.textStyle?.fontSize ?? 16}px`,
        fontWeight: element.textStyle?.bold ? 700 : 400,
        fontStyle: element.textStyle?.italic ? 'italic' : 'normal',
        textDecoration: element.textStyle?.underline ? 'underline' : 'none',
        color: element.textStyle?.color ?? '#514750'
      }}
      onPointerDown={event => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <RichTextEditor
        elementId={element.id}
        content={element.content}
        onChange={onChange}
        onEditorReady={onEditorReady}
        onEditorStateChange={onEditorStateChange}
      />
    </div>
  );
}

type BookEditorProps = {
  bookId?: string;
  ownerId?: string;
};

export default function BookEditor({
  bookId = 'demo-book',
  ownerId
}: BookEditorProps) {

  const [pages, setPages] = useState<BookPage[]>([
    newPage()
  ]);

  const [pageIndex, setPageIndex] = useState(0);
  const [mobilePagesOpen, setMobilePagesOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);

  const [selectedId, setSelectedId] = useState<
    string | null
  >(null);

  const [paperPanelOpen, setPaperPanelOpen] =
    useState(false);

  const [bookLoaded, setBookLoaded] = useState(false);
  const ownerRef = useRef<string | null>(null);
  const savedPagesRef = useRef<BookPage[] | null>(null);
  const pendingSaveRef = useRef<(() => void) | null>(null);
  const [retry, setRetry] = useState(0);
  const [saveError, setSaveError] = useState('');

  const [saveStatus, setSaveStatus] =
    useState<SaveStatus>('loading');

  const pageRef = useRef<HTMLDivElement>(null);

  const interactionRef = useRef<Interaction | null>(
    null
  );

  const saveQueueRef = useRef<Promise<void>>(
    Promise.resolve()
  );

  // Los editores viven dentro de cada cuadro, pero el menú se muestra arriba.
  const [editors, setEditors] = useState<Map<string, Editor>>(() => new Map());
  const [, refreshFormat] = useState(0);

  const registerEditor = useCallback((id: string, editor: Editor | null) => {
    setEditors(previous => {
      if (editor ? previous.get(id) === editor : !previous.has(id)) return previous;
      const next = new Map(previous);
      if (editor) next.set(id, editor);
      else next.delete(id);
      return next;
    });
  }, []);

  const refreshToolbar = useCallback(() => {
    refreshFormat(previous => previous + 1);
  }, []);

  const currentPage = pages[pageIndex];

  const paper: PaperSettings =
    currentPage.paper ?? DEFAULT_PAPER;

  const pageHeight = getPageHeight(paper.size);

  // Recuperar el libro guardado.
  useEffect(() => {
    let active = true;

    async function loadSavedBook() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user || (ownerId && data.user.id !== ownerId)) {
          throw new Error('La sesión cambió. Vuelve a abrir el cuaderno.');
        }
        const userId = data.user.id;
        const savedPages = await getCloudBookPages(bookId, userId);
        if (savedPages === null) throw new Error('No existe este mini libro en tu cuenta.');

        if (!active) return;

        ownerRef.current = userId;
        const initialPages = savedPages.length ? savedPages : [newPage()];
        savedPagesRef.current = initialPages;
        setPages(initialPages);
        setPageIndex(0);
        setSaveError('');

        setSaveStatus('saved');
        setBookLoaded(true);
      } catch (error) {
        console.error(
          'Error al cargar el libro:',
          error
        );

        if (active) {
          setSaveError('No se pudo cargar el cuaderno privado. Vuelve a abrirlo.');
          setSaveStatus('error');
        }
      }
    }

    void loadSavedBook();

    return () => {
      active = false;
    };
  }, [bookId, ownerId]);

  // Guardar únicamente cambios reales, en orden y con el propietario capturado.
  useEffect(() => {
    const userId = ownerRef.current;
    if (!bookLoaded || !userId || pages === savedPagesRef.current) return;
    setSaveStatus('saving');
    setSaveError('');
    let active = true;
    let queued = false;
    const snapshot = pages;
    const enqueue = () => {
      if (queued) return;
      queued = true;
      if (pendingSaveRef.current === enqueue) pendingSaveRef.current = null;
      const nextSave = saveQueueRef.current.catch(() => undefined).then(async () => {
        await saveCloudBookPages(bookId, snapshot, userId);
        savedPagesRef.current = snapshot;
      });
      saveQueueRef.current = nextSave;
      void nextSave.then(() => {
        if (active) setSaveStatus('saved');
      }, error => {
        console.error('Error al guardar:', error);
        if (active) {
          setSaveError(error instanceof Error ? error.message : 'No se pudieron guardar los cambios.');
          setSaveStatus('error');
        }
      });
    };
    pendingSaveRef.current = enqueue;
    const timeout = window.setTimeout(enqueue, 700);
    return () => {
      active = false;
      window.clearTimeout(timeout);

    };
  }, [pages, bookLoaded, bookId, retry]);

  useEffect(() => () => { pendingSaveRef.current?.(); }, []);

  useEffect(() => {
    if (!bookLoaded || saveStatus === 'saved') return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [bookLoaded, saveStatus]);

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

  const addText = (preset: 'normal' | 'title' | 'subtitle' = 'normal') => {
    const element: BookElement = {
      id: crypto.randomUUID(),
      type: 'text',
      x: 60,
      y: 70,
      width: 280,
      height: 140,
      content: preset === 'title' ? 'Escribe un título...' : preset === 'subtitle' ? 'Escribe un subtítulo...' : 'Escribe aquí...',
      textStyle: {
        variant: preset,
        fontFamily: 'Arial, sans-serif',
        fontSize: preset === 'title' ? 32 : preset === 'subtitle' ? 23 : 16,
        color: '#514750',
        bold: preset !== 'normal'
      }
    };

    updatePage(page => ({
      ...page,
      elements: [...page.elements, element]
    }));

    setSelectedId(element.id);
  };

  // Ajustar también los marcos cuadrados de imágenes guardadas anteriormente.
  const fitImageFrame = (pageId: string, elementId: string, source: string, naturalWidth: number, naturalHeight: number) => {
    if (!bookLoaded || !naturalWidth || !naturalHeight) return;
    setPages(previous => {
      let changed = false;
      const next = previous.map(page => {
        if (page.id !== pageId) return page;
        let pageChanged = false;
        const elements = page.elements.map(item => {
          if (item.id !== elementId || item.type !== 'image' || item.content !== source) return item;
          const factor = Math.min(item.width / naturalWidth, item.height / naturalHeight);
          if (!Number.isFinite(factor) || factor <= 0) return item;
          const width = naturalWidth * factor;
          const height = naturalHeight * factor;
          if (Math.abs(width - item.width) < 0.01 && Math.abs(height - item.height) < 0.01) return item;
          pageChanged = true;
          return { ...item, x: item.x + (item.width - width) / 2, y: item.y + (item.height - height) / 2, width, height };
        });
        if (!pageChanged) return page;
        changed = true;
        return { ...page, elements };
      });
      return changed ? next : previous;
    });
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

    const targetPageId = currentPage.id;
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result;
      if (typeof content !== 'string') return;
      const image = new Image();
      image.onload = () => {
        if (!image.naturalWidth || !image.naturalHeight) return;
        const scale = Math.min(1, 240 / image.naturalWidth, 240 / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        const element: BookElement = {
          id: crypto.randomUUID(), type: 'image', x: 90, y: 120,
          width, height, content
        };
        setPages(previous => previous.map(page => page.id === targetPageId
          ? { ...page, elements: [...page.elements, element] } : page));
        setSelectedId(element.id);
      };
      image.onerror = () => alert('No se pudo leer la imagen.');
      image.src = content;
    };
    reader.onerror = () => alert('No se pudo leer el archivo.');
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

  // El gesto se escucha a nivel de ventana: funciona incluso cuando el dedo
  // sale del botón o el navegador cambia el objetivo de los eventos.
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction || event.pointerId !== interaction.pointerId) return;

      if (event.cancelable) event.preventDefault();
      const pageWidth = pageRef.current?.clientWidth ?? PAGE_WIDTH;
      const scale = pageWidth / PAGE_WIDTH;
      if (!scale) return;
      const deltaX = (event.clientX - interaction.pointerX) / scale;
      const deltaY = (event.clientY - interaction.pointerY) / scale;

      setPages(previous => previous.map((page, index) => {
        if (index !== interaction.pageIndex) return page;
        let changed = false;
        const elements = page.elements.map(item => {
          if (item.id !== interaction.id) return item;
          if (interaction.mode === 'move') {
            const x = Math.max(0, Math.min(PAGE_WIDTH - item.width,
              Math.round(interaction.startX + deltaX)));
            const y = Math.max(0, Math.min(interaction.pageHeight - item.height,
              Math.round(interaction.startY + deltaY)));
            if (x === item.x && y === item.y) return item;
            changed = true;
            return { ...item, x, y };
          }
          let width: number;
          let height: number;
          if (item.type === 'image') {
            const w = Math.max(1, interaction.startWidth);
            const h = Math.max(1, interaction.startHeight);
            const maxScale = Math.max(0.001, Math.min(
              (PAGE_WIDTH - interaction.startX) / w,
              (interaction.pageHeight - interaction.startY) / h
            ));
            const minScale = Math.min(maxScale, 24 / Math.max(w, h));
            const requestedScale = 1 + (deltaX * w + deltaY * h) / (w * w + h * h);
            const scale = Math.max(minScale, Math.min(maxScale, requestedScale));
            width = w * scale;
            height = h * scale;
          } else {
            width = Math.max(80, Math.min(PAGE_WIDTH - interaction.startX,
              Math.round(interaction.startWidth + deltaX)));
            height = Math.max(50, Math.min(interaction.pageHeight - interaction.startY,
              Math.round(interaction.startHeight + deltaY)));
          }
          if (width === item.width && height === item.height) return item;
          changed = true;
          return { ...item, width, height };
        });
        return changed ? { ...page, elements } : page;
      }));
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (interactionRef.current?.pointerId === event.pointerId) {
        interactionRef.current = null;
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { capture: true, passive: false });
    window.addEventListener('pointerup', handlePointerEnd, true);
    window.addEventListener('pointercancel', handlePointerEnd, true);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove, true);
      window.removeEventListener('pointerup', handlePointerEnd, true);
      window.removeEventListener('pointercancel', handlePointerEnd, true);
    };
  }, []);

  const startInteraction = (
    event: ReactPointerEvent<HTMLDivElement>,
    element: BookElement,
    mode: 'move' | 'resize'
  ) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    // Sacar el foco del editor impide que el teclado se vuelva a abrir.
    const focused = document.activeElement;
    if (focused instanceof HTMLElement &&
        (focused.isContentEditable || focused.closest('.kuro-rich-text-editor'))) {
      focused.blur();
    }

    interactionRef.current = {
      id: element.id,
      mode,
      pointerId: event.pointerId,
      pageIndex,
      pageHeight,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: element.x,
      startY: element.y,
      startWidth: element.width,
      startHeight: element.height
    };
    setSelectedId(element.id);
    // El propio control conserva el puntero; los movimientos se procesan en window.
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* navegador sin captura */ }
  };

  const addPage = () => {
    const nextIndex = pages.length;

    setPages(previous => [
      ...previous,
      newPage(paper)
    ]);

    setPageIndex(nextIndex);
    setSelectedId(null);
    setMobilePagesOpen(false);
    setMobileToolsOpen(false);
  };

  // Eliminar una página con confirmación, sin dejar el cuaderno vacío.
  const deletePage = (index: number) => {
    if (!bookLoaded || pages.length <= 1 || index < 0 || index >= pages.length) return;

    const confirmed = window.confirm(
      `¿Eliminar la página ${index + 1}?\n\nEsta acción eliminará su contenido y no se puede deshacer.`
    );
    if (!confirmed) return;

    // Cerrar cualquier edición o arrastre activo antes de cambiar de hoja.
    interactionRef.current = null;
    setSelectedId(null);
    setMobilePagesOpen(false);
    setMobileToolsOpen(false);
    setPages(previous => previous.length <= 1 ? previous : previous.filter((_, position) => position !== index));
    setPageIndex(previous => {
      if (index < previous) return previous - 1;
      if (index === previous) return Math.max(0, previous - 1);
      return previous;
    });
  };

  // Crear una copia independiente inmediatamente después de la página elegida.
  const duplicatePage = (index: number) => {
    if (!bookLoaded || index < 0 || index >= pages.length) return;

    const original = pages[index];
    const copy: BookPage = {
      ...original,
      id: crypto.randomUUID(),
      paper: { ...DEFAULT_PAPER, ...original.paper },
      elements: original.elements.map(element => ({
        ...element,
        id: crypto.randomUUID(),
        ...(element.textStyle ? { textStyle: { ...element.textStyle } } : {})
      }))
    };

    interactionRef.current = null;
    setSelectedId(null);
    setMobilePagesOpen(false);
    setMobileToolsOpen(false);
    setPages(previous => [
      ...previous.slice(0, index + 1),
      copy,
      ...previous.slice(index + 1)
    ]);
    setPageIndex(index + 1);
  };

  // Intercambiar páginas sin modificar su contenido ni sus identificadores.
  const movePage = (index: number, direction: 'up' | 'down') => {
    if (!bookLoaded || index < 0 || index >= pages.length) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= pages.length) return;

    interactionRef.current = null;
    setSelectedId(null);
    setPages(previous => {
      if (index >= previous.length || target >= previous.length) return previous;
      const reordered = [...previous];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      return reordered;
    });
    // Mantener visible la misma página, aunque cambie de posición.
    setPageIndex(previous => {
      if (previous === index) return target;
      if (previous === target) return index;
      return previous;
    });
  };

  const changePage = (index: number) => {
    setPageIndex(index);
    setSelectedId(null);
    setMobilePagesOpen(false);
    setMobileToolsOpen(false);
  };

  const selectedIndex =
    currentPage.elements.findIndex(
      element => element.id === selectedId
    );

  const selectedText = currentPage.elements.find(
    element => element.id === selectedId && element.type === 'text'
  );
  const activeEditor = selectedText ? editors.get(selectedText.id) : undefined;
  const activeBold = activeEditor?.isActive('bold') ?? false;
  const activeItalic = activeEditor?.isActive('italic') ?? false;
  const activeUnderline = activeEditor?.isActive('underline') ?? false;
  const currentFont = activeEditor?.getAttributes('textStyle').fontFamily as string | undefined;

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
            '✓ Guardado en la nube'}

          {saveStatus === 'error' &&
            'Error de guardado'}
        </span>
      </div>

      {saveError && (
        <div role="alert" className="kuro-editor-status">
          {saveError} {bookLoaded && <button type="button" onClick={() => setRetry(value => value + 1)}>Reintentar guardado</button>}
        </div>
      )}

      {/* Barra exclusiva para celular. La barra de escritorio se conserva. */}
      <div className="kuro-mobile-tools" aria-label="Herramientas del mini libro">
        <div className="kuro-mobile-tools-main">
          <button type="button" onClick={() => { addText('normal'); setMobileToolsOpen(false); }} disabled={!bookLoaded}>
            <Type size={19} /><span>Texto</span>
          </button>
          <label className="kuro-mobile-image-button">
            <ImagePlus size={19} /><span>Imagen</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { addImage(event); setMobileToolsOpen(false); }} disabled={!bookLoaded} hidden />
          </label>
          <button type="button" className={paperPanelOpen ? 'is-active' : ''}
            onClick={() => { setPaperPanelOpen(previous => !previous); setMobileToolsOpen(false); }}
            disabled={!bookLoaded} aria-expanded={paperPanelOpen}>
            <FileText size={19} /><span>Papel</span>
          </button>
          <button type="button" className={mobileToolsOpen ? 'is-active' : ''}
            onClick={() => setMobileToolsOpen(previous => !previous)}
            disabled={!bookLoaded} aria-expanded={mobileToolsOpen} aria-controls="kuro-mobile-more-menu">
            <MoreHorizontal size={19} /><span>Más</span>
          </button>
        </div>
        {mobileToolsOpen && (
          <div id="kuro-mobile-more-menu" className="kuro-mobile-tools-more" aria-label="Más herramientas">
            <button type="button" onClick={() => { addText('title'); setMobileToolsOpen(false); }}>Título</button>
            <button type="button" onClick={() => { addText('subtitle'); setMobileToolsOpen(false); }}>Subtítulo</button>
            <button type="button" onClick={() => { moveLayer('forward'); setMobileToolsOpen(false); }} disabled={!canMoveForward}>
              <ArrowUp size={17} /> Adelante
            </button>
            <button type="button" onClick={() => { moveLayer('backward'); setMobileToolsOpen(false); }} disabled={!canMoveBackward}>
              <ArrowDown size={17} /> Atrás
            </button>
            <button type="button" className="kuro-mobile-danger" onClick={() => { deleteSelected(); setMobileToolsOpen(false); }} disabled={!selectedId}>
              <Trash2 size={17} /> Eliminar
            </button>
          </div>
        )}
      </div>

      <div className="kuro-editor-toolbar">
        <div className="kuro-tool-group">
          <button
            type="button"
            onClick={() => addText('normal')}
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

        <div className="kuro-tool-group">
          <button type="button" onClick={() => addText('title')} disabled={!bookLoaded} title="Agregar título">Título</button>
          <button type="button" onClick={() => addText('subtitle')} disabled={!bookLoaded} title="Agregar subtítulo">Subtítulo</button>
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

      {selectedText && (
        <div className="kuro-top-text-format" role="toolbar" aria-label="Formato de texto">
          <span className="kuro-format-caption">Formato de texto</span>
          <label className="kuro-format-font">
            <span>Fuente</span>
            <select
              value={currentFont ?? ''}
              disabled={!activeEditor}
              onChange={event => {
                if (!activeEditor) return;
                if (event.target.value) activeEditor.chain().focus().setFontFamily(event.target.value).run();
                else activeEditor.chain().focus().unsetFontFamily().run();
              }}
            >
              <option value="">Fuente original</option>
              <option value="Arial, sans-serif">Arial</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="'Trebuchet MS', sans-serif">Trebuchet</option>
              <option value="'Comic Sans MS', cursive">Comic Sans</option>
              <option value="'Courier New', monospace">Courier New</option>
              <option value="'Poppins', sans-serif">Poppins</option>
            </select>
          </label>
          <label className="kuro-format-font">
            <span>Tamaño</span>
            <select aria-label="Tamaño de letra" disabled={!activeEditor}
              value={activeEditor?.getAttributes('textStyle').fontSize ?? ''}
              onChange={event => {
                if (!activeEditor) return;
                activeEditor.chain().focus().setMark('textStyle', {
                  fontSize: event.target.value || null
                }).run();
              }}>
              <option value="">Original ({selectedText.textStyle?.fontSize ?? 16} px)</option>
              {[10,12,14,16,18,20,22,24,28,32,36,40,48,56,64,72].map(size => (
                <option key={size} value={`${size}px`}>{size} px</option>
              ))}
            </select>
          </label>
          <div className="kuro-format-actions">
            <button type="button" title="Negrita" aria-label="Negrita"
              aria-pressed={activeBold} className={activeBold ? 'is-active' : ''}
              disabled={!activeEditor}
              onMouseDown={event => event.preventDefault()}
              onClick={() => activeEditor?.chain().focus().toggleBold().run()}>
              <strong>B</strong>
            </button>
            <button type="button" title="Cursiva" aria-label="Cursiva"
              aria-pressed={activeItalic} className={activeItalic ? 'is-active' : ''}
              disabled={!activeEditor}
              onMouseDown={event => event.preventDefault()}
              onClick={() => activeEditor?.chain().focus().toggleItalic().run()}>
              <em>I</em>
            </button>
            <button type="button" title="Subrayado" aria-label="Subrayado"
              aria-pressed={activeUnderline} className={activeUnderline ? 'is-active' : ''}
              disabled={!activeEditor}
              onMouseDown={event => event.preventDefault()}
              onClick={() => activeEditor?.chain().focus().toggleUnderline().run()}>
              <u>U</u>
            </button>
          </div>
          <label className="kuro-format-color">
            <span>Color</span>
            <input type="color" defaultValue="#e87ab1" disabled={!activeEditor}
              onChange={event => activeEditor?.chain().focus().setColor(event.target.value).run()} />
          </label>
          <span className="kuro-format-help">Selecciona palabras o activa un formato antes de escribir</span>
        </div>
      )}

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

      {bookLoaded && (
        <div className="kuro-mobile-navigation" aria-label="Navegación del cuaderno">
          <button type="button" className={mobilePagesOpen ? 'is-active' : ''}
            onClick={() => setMobilePagesOpen(open => !open)}
            aria-expanded={mobilePagesOpen} aria-controls="kuro-pages-panel">
            <PanelsTopLeft size={18} /> Páginas
          </button>
          <div className="kuro-mobile-navigation-steps">
            <button type="button" onClick={() => changePage(pageIndex - 1)}
              disabled={pageIndex === 0} aria-label="Página anterior"><ChevronLeft size={19}/></button>
            <span>Página {pageIndex + 1} / {pages.length}</span>
            <button type="button" onClick={() => changePage(pageIndex + 1)}
              disabled={pageIndex >= pages.length - 1} aria-label="Página siguiente"><ChevronRight size={19}/></button>
          </div>
          <button type="button" onClick={addPage} aria-label="Agregar página"><Plus size={19}/></button>
        </div>
      )}

      <div className={'kuro-editor-layout' + (mobilePagesOpen ? ' kuro-pages-open' : '')}>
        {bookLoaded && (
          <div id="kuro-pages-panel" className="kuro-mobile-pages-container">
          <PageThumbnails
            pages={pages}
            activeIndex={pageIndex}
            onSelect={changePage}
            onAdd={addPage}
            onDelete={deletePage}
            onDuplicate={duplicatePage}
            onMove={movePage}
          />
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
                    zIndex: index + 1,
                    minHeight: 0,
                    ...(element.type === 'image' ? { touchAction: 'none', cursor: 'grab', minWidth: 0 } : {})
                  }}
                  onPointerDown={event => {
                    if (!bookLoaded) return;
                    if (element.type === 'image') {
                      startInteraction(event, element, 'move');
                    } else {
                      setSelectedId(element.id);
                    }
                  }}
                >
                  {element.type === 'text' ? (
                    <AutoGrowTextBox
                      element={element}
                      pageHeight={pageHeight}
                      pageRef={pageRef}
                      onChange={html => updateElement(element.id, { content: html })}
                      onHeightChange={height => updateElement(element.id, { height })}
                      onSelect={() => setSelectedId(element.id)}
                      onEditorReady={registerEditor}
                      onEditorStateChange={refreshToolbar}
                    />
                  ) : (
                    <img
                      src={element.content}
                      alt="Imagen del mini libro"
                      style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'grab', touchAction: 'none', userSelect: 'none', display: 'block' }}
                      onLoad={event => {
                        const image = event.currentTarget;
                        fitImageFrame(currentPage.id, element.id, element.content, image.naturalWidth, image.naturalHeight);
                      }}
                      draggable={false}
                    />
                  )}

                  {selectedId === element.id && (
                    <>
                        <div
                          className="kuro-element-handle kuro-touch-move-handle"
                          role="button"
                          tabIndex={0}
                          aria-label="Mantener pulsado y mover elemento"
                          title="Mover elemento"
                          style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'auto', zIndex: 30 }}
                          onPointerDown={event => startInteraction(event, element, 'move')}
                          onClick={event => { event.preventDefault(); event.stopPropagation(); }}
                        >
                          Mover
                        </div>
                        <div
                          className="kuro-resize-handle kuro-touch-resize-handle"
                          role="button"
                          tabIndex={0}
                          aria-label="Arrastrar para cambiar el tamaño"
                          title="Cambiar tamaño"
                          style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'auto', zIndex: 30 }}
                          onPointerDown={event => startInteraction(event, element, 'resize')}
                          onClick={event => { event.preventDefault(); event.stopPropagation(); }}
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
