
import {
  House,
  BookOpen,
  NotebookPen,
  CalendarDays
} from 'lucide-react';

export type Page =
  | 'Inicio'
  | 'Mis patrones'
  | 'Mis proyectos'
  | 'Mis pedidos';

type SidebarProps = {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  isOpen: boolean;
};

const menuItems = [
  {
    label: 'Inicio' as Page,
    icon: House
  },
  {
    label: 'Mis patrones' as Page,
    icon: BookOpen
  },
  {
    label: 'Mis proyectos' as Page,
    icon: NotebookPen
  },
  {
    label: 'Mis pedidos' as Page,
    icon: CalendarDays
  }
];

export default function Sidebar({
  currentPage,
  onNavigate,
  isOpen
}: SidebarProps) {
  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <h2 className="sidebar-title">
        🎀 Mi espacio
      </h2>

      <nav>
        {menuItems.map(item => {
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              type="button"
              className={
                `nav-item ${
                  currentPage === item.label ? 'active' : ''
                }`
              }
              onClick={() => onNavigate(item.label)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
