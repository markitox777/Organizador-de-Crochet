
import type { BookPage } from '../../services/bookService';
import './PageThumbnails.css';

type PageThumbnailsProps = {
  pages: BookPage[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
};

export default function PageThumbnails({
  pages,
  activeIndex,
  onSelect,
  onAdd
}: PageThumbnailsProps) {
  return (
    <aside className="kuro-thumbnails">
      <div className="kuro-thumbnails-header">
        <h4>Mis páginas</h4>
        <span>{pages.length}</span>
      </div>

      <div className="kuro-thumbnails-list">
        {pages.map((page, index) => (
          <button
            key={page.id}
            type="button"
            className={
              'kuro-thumbnail' +
              (index === activeIndex ? ' active' : '')
            }
            onClick={() => onSelect(index)}
            aria-current={
              index === activeIndex ? 'page' : undefined
            }
          >
            <div className="kuro-thumbnail-paper">
              {page.elements.map(element =>
                element.type === 'image' ? (
                  <img
                    key={element.id}
                    src={element.content}
                    alt=""
                  />
                ) : (
                  <span key={element.id}>
                    {element.content.slice(0, 35)}
                  </span>
                )
              )}
            </div>
            <span className="kuro-thumbnail-number">
              Página {index + 1}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="kuro-thumbnail-add"
        onClick={onAdd}
      >
        + Nueva página
      </button>
    </aside>
  );
}
