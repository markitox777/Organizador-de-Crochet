import type { BookPage } from '../../services/bookService';
import './PageThumbnails.css';

type PageThumbnailsProps = {
  pages: BookPage[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDelete: (index: number) => void;
  onDuplicate: (index: number) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
};

function plainText(value: string): string {
  if (!value.includes('<')) return value;
  if (typeof document === 'undefined') return value.replace(/<[^>]*>/g, ' ');
  const container = document.createElement('div');
  container.innerHTML = value;
  return container.textContent ?? '';
}

export default function PageThumbnails({
  pages, activeIndex, onSelect, onAdd, onDelete, onDuplicate, onMove
}: PageThumbnailsProps) {
  return (
    <aside className="kuro-thumbnails kuro-pink-thumbnails" aria-label="Páginas del cuaderno">
      <div className="kuro-thumbnails-header">
        <div className="kuro-pink-pages-heading">
          <h4>Mis páginas</h4>
          <span className="kuro-pink-pages-subtitle">Tu cuaderno ♡</span>
        </div>
        <span className="kuro-pink-pages-count" aria-label={`${pages.length} páginas`}>{pages.length}</span>
      </div>
      <div className="kuro-thumbnails-list">
        {pages.map((page, index) => (
          <div className="kuro-page-thumbnail-entry" key={page.id}>
            <button
              type="button"
              className={'kuro-thumbnail' + (index === activeIndex ? ' active' : '')}
              onClick={() => onSelect(index)}
              aria-label={`Ir a la página ${index + 1}`}
              aria-current={index === activeIndex ? 'page' : undefined}
            >
              <div className="kuro-thumbnail-paper">
                {page.elements.map(element =>
                  element.type === 'image' ? (
                    <img key={element.id} src={element.content} alt="" />
                  ) : (
                    <span key={element.id}>{plainText(element.content).slice(0, 35)}</span>
                  )
                )}
              </div>
              <span className="kuro-thumbnail-number">Página {index + 1}</span>
            </button>
            <div className="kuro-page-reorder-actions" role="group" aria-label={`Ordenar página ${index + 1}`}>
              <button
                type="button"
                className="kuro-page-move-button"
                onClick={() => onMove(index, 'up')}
                disabled={index === 0}
                title={`Subir página ${index + 1}`}
                aria-label={`Subir página ${index + 1}`}
              >
                <span aria-hidden="true">↑</span> Subir
              </button>
              <button
                type="button"
                className="kuro-page-move-button"
                onClick={() => onMove(index, 'down')}
                disabled={index === pages.length - 1}
                title={`Bajar página ${index + 1}`}
                aria-label={`Bajar página ${index + 1}`}
              >
                <span aria-hidden="true">↓</span> Bajar
              </button>
            </div>
            <div className="kuro-page-actions">
              <button
                type="button"
                className="kuro-page-duplicate-button"
                onClick={() => onDuplicate(index)}
                title={`Duplicar página ${index + 1}`}
                aria-label={`Duplicar página ${index + 1}`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="8" y="8" width="12" height="12" rx="2" />
                  <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
                </svg>
                <span>Duplicar</span>
              </button>
              <button
                type="button"
                className="kuro-page-delete-button"
                onClick={() => onDelete(index)}
                disabled={pages.length <= 1}
                title={pages.length <= 1 ? 'Debe quedar al menos una página' : `Eliminar página ${index + 1}`}
                aria-label={`Eliminar página ${index + 1}`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v6m4-6v6" />
                </svg>
                <span>Eliminar</span>
              </button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="kuro-thumbnail-add" onClick={onAdd}>
        <span aria-hidden="true">＋</span> Nueva página
      </button>
    </aside>
  );
}
