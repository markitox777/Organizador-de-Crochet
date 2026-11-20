
import { Menu, X } from 'lucide-react';

type HeaderProps = {
  menuOpen: boolean;
  onToggleMenu: () => void;
};

export default function Header({
  menuOpen,
  onToggleMenu
}: HeaderProps) {
  return (
    <header className="header">
      <div className="brand">
        <span>🎀</span>
        <h1>KuroTex</h1>
      </div>

      <button
        className="menu-button"
        onClick={onToggleMenu}
        aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={menuOpen}
      >
        {menuOpen ? <X /> : <Menu />}
      </button>
    </header>
  );
}
