import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardList,
  Pencil, Plus, Search, Trash2, X
} from 'lucide-react';
import {
  createOrder, deleteOrder, getOrders, getPaymentStatus, saveOrder,
  type CrochetOrder, type OrderInput, type OrderStatus
} from '../services/orderService';
import { getProjects, type CrochetProject } from '../services/projectService';
import { getMiniBooks, type MiniBook } from '../services/bookLibraryService';
import '../styles/orders.css';

type Filter = OrderStatus | 'todos';

const STATUS_LABELS: Record<OrderStatus, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado'
};

const INITIAL_DRAFT: OrderInput = {
  title: '',
  clientName: '',
  description: '',
  deliveryDate: '',
  price: 0,
  amountPaid: 0,
  status: 'pendiente',
  notes: '',
  projectId: null,
  bookId: null
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);

function localToday(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'Sin fecha de entrega';
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, day));
}

function calendarKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Diferencia en días calendario locales, sin problemas por cambios de horario.
function daysUntilDelivery(date: string, today: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [todayYear, todayMonth, todayDay] = today.split('-').map(Number);
  const deliveryUTC = Date.UTC(year, month - 1, day);
  const todayUTC = Date.UTC(todayYear, todayMonth - 1, todayDay);
  return Math.round((deliveryUTC - todayUTC) / 86400000);
}

function deliveryUrgency(date: string, today: string): string {
  const remaining = daysUntilDelivery(date, today);
  if (remaining === null) return '';
  if (remaining <= 3) return 'is-urgent'; // Vencidas, hoy o faltan 1–3 días.
  if (remaining <= 7) return 'is-upcoming'; // 4–7 días.
  return 'is-future'; // Más de 7 días.
}

type OrdersProps = {
  onOpenProject?: (projectId: string) => void;
};

export default function Orders({ onOpenProject }: OrdersProps) {
  const [orders, setOrders] = useState<CrochetOrder[]>([]);
  const [projects, setProjects] = useState<CrochetProject[]>([]);
  const [miniBooks, setMiniBooks] = useState<MiniBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<OrderInput>({ ...INITIAL_DRAFT });
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getOrders(), getProjects(), getMiniBooks()])
      .then(([savedOrders, savedProjects, savedBooks]) => {
        if (!active) return;
        setOrders(savedOrders);
        setProjects(savedProjects);
        setMiniBooks(savedBooks);
      })
      .catch(() => {
        if (active) setError('No se pudieron cargar los pedidos. Comprueba el almacenamiento del navegador.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const projectNames = useMemo(
    () => new Map(projects.map(project => [project.id, project.name])),
    [projects]
  );

  const bookNames = useMemo(() => new Map(miniBooks.map(book => [book.id, book.title])), [miniBooks]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es-CL');
    return orders.filter(order =>
      (filter === 'todos' || order.status === filter) &&
      (!selectedDate || order.deliveryDate === selectedDate) &&
      [order.title, order.clientName, order.description, projectNames.get(order.projectId ?? '') ?? '', bookNames.get(order.bookId ?? '') ?? '']
        .some(value => value.toLocaleLowerCase('es-CL').includes(query))
    ).sort((a, b) =>
      (a.deliveryDate || '9999-12-31').localeCompare(b.deliveryDate || '9999-12-31')
    );
  }, [orders, search, filter, selectedDate, projectNames, bookNames]);

  const datesWithOrders = useMemo(() => {
    const result = new Map<string, number>();
    orders.filter(order => order.status !== 'cancelado').forEach(order => {
      if (order.deliveryDate) result.set(order.deliveryDate, (result.get(order.deliveryDate) ?? 0) + 1);
    });
    return result;
  }, [orders]);

  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const monthTitle = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
  const today = localToday();

  const counts = {
    total: orders.length,
    active: orders.filter(order => order.status === 'pendiente' || order.status === 'en_proceso').length,
    ready: orders.filter(order => order.status === 'listo').length,
    delivered: orders.filter(order => order.status === 'entregado').length
  };

  function changeMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setSelectedDate(null);
  }

  function openNew() {
    setEditingId(null);
    setDraft({ ...INITIAL_DRAFT, deliveryDate: selectedDate ?? '' });
    setError('');
    setFormOpen(true);
  }

  function openEdit(order: CrochetOrder) {
    setEditingId(order.id);
    setDraft({
      title: order.title,
      clientName: order.clientName,
      description: order.description,
      deliveryDate: order.deliveryDate,
      price: order.price,
      amountPaid: order.amountPaid,
      status: order.status,
      notes: order.notes,
      projectId: order.projectId,
      bookId: order.bookId ?? null
    });
    setError('');
    setFormOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !draft.title.trim() || !draft.clientName.trim()) return;
    if (!Number.isFinite(draft.price) || !Number.isFinite(draft.amountPaid) || draft.price < 0 || draft.amountPaid < 0 || draft.amountPaid > draft.price) {
      setError('Revisa el precio y el abono: no pueden ser negativos y el abono no puede superar el precio.');
      return;
    }
    setSaving(true);
    setError('');
    const previous = editingId ? orders.find(order => order.id === editingId) : undefined;
    const item: CrochetOrder = previous ? {
      ...previous,
      ...draft,
      title: draft.title.trim(),
      clientName: draft.clientName.trim(),
      price: Math.round(draft.price),
      amountPaid: Math.round(draft.amountPaid),
      updatedAt: new Date().toISOString()
    } : createOrder(draft);
    try {
      await saveOrder(item);
      setOrders(items => [item, ...items.filter(order => order.id !== item.id)]);
      setFormOpen(false);
      setEditingId(null);
    } catch {
      setError('No se pudo guardar el pedido. Inténtalo nuevamente.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(order: CrochetOrder) {
    if (!window.confirm(`¿Eliminar el pedido «${order.title}»? Esta acción no se puede deshacer.`)) return;
    setError('');
    try {
      await deleteOrder(order.id);
      setOrders(items => items.filter(item => item.id !== order.id));
    } catch {
      setError('No se pudo eliminar el pedido.');
    }
  }

  return (
    <section className="kuro-orders" aria-label="Mis pedidos">
      <header className="kuro-orders-heading">
        <div>
          <span className="kuro-orders-eyebrow">Mis tejidos por encargo ♡</span>
          <h2>🎀 Mis pedidos</h2>
          <p>Organiza tus encargos, pagos y fechas de entrega.</p>
        </div>
        <button type="button" className="kuro-orders-primary" onClick={openNew}>
          <Plus size={18} /> Nuevo pedido
        </button>
      </header>

      <div className="kuro-orders-summary" aria-label="Resumen de pedidos">
        <div><strong>{counts.total}</strong><span>Pedidos</span></div>
        <div><strong>{counts.active}</strong><span>En marcha</span></div>
        <div><strong>{counts.ready}</strong><span>Listos</span></div>
        <div><strong>{counts.delivered}</strong><span>Entregados</span></div>
      </div>

      {error && <p className="kuro-orders-error" role="alert">{error}</p>}

      <div className="kuro-orders-layout">
        <aside className="kuro-orders-calendar" aria-label="Calendario de entregas">
          <div className="kuro-orders-calendar-heading">
            <h3><CalendarDays size={18} /> Calendario de entregas</h3>
            <div className="kuro-orders-calendar-nav">
              <button type="button" onClick={() => changeMonth(-1)} aria-label="Mes anterior"><ChevronLeft size={19} /></button>
              <strong>{monthTitle}</strong>
              <button type="button" onClick={() => changeMonth(1)} aria-label="Mes siguiente"><ChevronRight size={19} /></button>
            </div>
          </div>
          <div className="kuro-orders-calendar-grid">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((label, index) => (
              <span className="kuro-orders-weekday" key={`${label}-${index}`}>{label}</span>
            ))}
            {cells.map((day, index) => {
              const date = day === null ? '' : calendarKey(year, month, day);
              const amount = datesWithOrders.get(date) ?? 0;
              return day === null ? <span key={`empty-${index}`} className="kuro-orders-day-empty" /> : (
                <button
                  type="button"
                  key={date}
                  onClick={() => setSelectedDate(previous => previous === date ? null : date)}
                  className={[
                    'kuro-orders-day',
                    date === today ? 'is-today' : '',
                    date === selectedDate ? 'is-selected' : '',
                    amount > 0 ? 'has-orders' : '',
                    amount > 0 ? deliveryUrgency(date, today) : ''
                  ].filter(Boolean).join(' ')}
                  aria-label={`${day} de ${monthTitle}: ${amount} entregas`}
                  aria-pressed={selectedDate === date}
                >
                  <span>{day}</span>
                  {amount > 0 && <small aria-hidden="true">{amount}</small>}
                </button>
              );
            })}
          </div>
          <p className="kuro-orders-calendar-help">Selecciona un día para ver sus entregas. Vuelve a pulsarlo para quitar el filtro.</p>
          {selectedDate && <button type="button" className="kuro-orders-clear" onClick={() => setSelectedDate(null)}>Quitar filtro: {formatDate(selectedDate)} <X size={14} /></button>}
        </aside>

        <div className="kuro-orders-listarea">
          <div className="kuro-orders-list-heading"><h3>Mis encargos</h3><span>{filteredOrders.length} resultados</span></div>
          <div className="kuro-orders-controls">
            <label className="kuro-orders-search">
              <Search size={18} aria-hidden="true" />
              <span className="kuro-orders-sr-only">Buscar pedidos</span>
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar pedido o cliente..." />
            </label>
            <label className="kuro-orders-filter">
              <span className="kuro-orders-sr-only">Filtrar por estado</span>
              <select value={filter} onChange={event => setFilter(event.target.value as Filter)}>
                <option value="todos">Todos los estados</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          {loading ? <div className="kuro-orders-empty">Cargando pedidos...</div> : filteredOrders.length === 0 ? (
            <div className="kuro-orders-empty">
              <ClipboardList size={36} strokeWidth={1.5} />
              <h3>{orders.length ? 'No encontramos pedidos' : 'Aquí comienzan tus encargos ♡'}</h3>
              <p>{orders.length ? 'Prueba otro filtro o selecciona otro día.' : 'Crea tu primer pedido para llevar tus entregas y pagos.'}</p>
              {orders.length === 0 && <button type="button" className="kuro-orders-primary" onClick={openNew}><Plus size={16} /> Crear pedido</button>}
            </div>
          ) : (
            <div className="kuro-orders-cards">
              {filteredOrders.map(order => {
                const payment = getPaymentStatus(order);
                const pending = Math.max(0, order.price - order.amountPaid);
                return <article className="kuro-orders-card" key={order.id}>
                  <div className="kuro-orders-card-top">
                    <span className={`kuro-orders-status is-${order.status}`}>{STATUS_LABELS[order.status]}</span>
                    <span className="kuro-orders-delivery"><CalendarDays size={14} /> {formatDate(order.deliveryDate)}</span>
                  </div>
                  <h4>{order.title}</h4>
                  <p className="kuro-orders-client">Para: {order.clientName}</p>
                  {order.description && <p className="kuro-orders-description">{order.description}</p>}
                  {order.projectId && <p className="kuro-orders-project">🧶 Proyecto: {projectNames.get(order.projectId) ?? 'Proyecto no disponible'}</p>}
                  {order.bookId && <p className="kuro-orders-project">📖 Mini libro: {bookNames.get(order.bookId) ?? 'Mini libro no disponible'}</p>}
                  <div className="kuro-orders-prices">
                    <span>Precio <strong>{formatMoney(order.price)}</strong></span>
                    <span>Abonado <strong>{formatMoney(order.amountPaid)}</strong></span>
                    <span>Por cobrar <strong>{formatMoney(pending)}</strong></span>
                  </div>
                  <span className={`kuro-orders-payment is-${payment}`}>{payment === 'pagado' ? 'Pagado' : payment === 'abono' ? 'Abono parcial' : 'Pago pendiente'}</span>
                  {order.notes && <p className="kuro-orders-notes">Notas: {order.notes}</p>}
                  <div className="kuro-orders-actions">
                    {order.projectId && projectNames.has(order.projectId) && onOpenProject && (
                      <button type="button" onClick={() => onOpenProject(order.projectId!)}>
                        <BookOpen size={16} /> Ver proyecto
                      </button>
                    )}
                    <button type="button" onClick={() => openEdit(order)}><Pencil size={16} /> Editar</button>
                    <button type="button" className="is-danger" onClick={() => void remove(order)}><Trash2 size={16} /> Eliminar</button>
                  </div>
                </article>;
              })}
            </div>
          )}
        </div>
      </div>

      {formOpen && <div className="kuro-orders-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setFormOpen(false); }}>
        <div className="kuro-orders-dialog" role="dialog" aria-modal="true" aria-labelledby="kuro-order-form-title">
          <div className="kuro-orders-dialog-top">
            <h3 id="kuro-order-form-title">{editingId ? 'Editar pedido ♡' : 'Nuevo pedido ♡'}</h3>
            <button type="button" aria-label="Cerrar" onClick={() => setFormOpen(false)} disabled={saving}><X size={20} /></button>
          </div>
          <form onSubmit={event => void submit(event)}>
            <label>Nombre del encargo *
              <input required maxLength={100} value={draft.title} onChange={event => setDraft(value => ({ ...value, title: event.target.value }))} placeholder="Ej. Osito amigurumi" autoFocus />
            </label>
            <label>Nombre del cliente *
              <input required maxLength={120} value={draft.clientName} onChange={event => setDraft(value => ({ ...value, clientName: event.target.value }))} placeholder="¿Para quién es?" />
            </label>
            <label>Descripción
              <textarea rows={2} value={draft.description} onChange={event => setDraft(value => ({ ...value, description: event.target.value }))} placeholder="Colores, tamaño, detalles..." />
            </label>
            <div className="kuro-orders-form-row">
              <label>Fecha de entrega
                <input type="date" value={draft.deliveryDate} onChange={event => setDraft(value => ({ ...value, deliveryDate: event.target.value }))} />
              </label>
              <label>Estado
                <select value={draft.status} onChange={event => setDraft(value => ({ ...value, status: event.target.value as OrderStatus }))}>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
            <div className="kuro-orders-form-row">
              <label>Precio total (CLP)
                <input type="number" min={0} step={1} value={draft.price} onChange={event => setDraft(value => ({ ...value, price: Number(event.target.value) }))} />
              </label>
              <label>Abonado (CLP)
                <input type="number" min={0} step={1} value={draft.amountPaid} onChange={event => setDraft(value => ({ ...value, amountPaid: Number(event.target.value) }))} />
              </label>
            </div>
            <label>Proyecto asociado (opcional)
              <select value={draft.projectId ?? ''} onChange={event => setDraft(value => ({ ...value, projectId: event.target.value || null }))}>
                <option value="">Sin proyecto asociado</option>
                {draft.projectId && !projectNames.has(draft.projectId) && <option value={draft.projectId}>Proyecto no disponible</option>}
                {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
            <div className="kuro-orders-book-picker">
              <label htmlFor="kuro-orders-book-select">Mini libro asociado (opcional)</label>
              {miniBooks.length === 0 ? (
                <p role="status">No hay mini libros existentes</p>
              ) : (
                <select
                  id="kuro-orders-book-select"
                  value={draft.bookId ?? ''}
                  onChange={event => setDraft(value => ({ ...value, bookId: event.target.value || null }))}
                >
                  <option value="">Sin mini libro asociado</option>
                  {draft.bookId && !bookNames.has(draft.bookId) && (
                    <option value={draft.bookId}>Mini libro no disponible</option>
                  )}
                  {miniBooks.map(book => (
                    <option value={book.id} key={book.id}>{book.title}</option>
                  ))}
                </select>
              )}
            </div>
            <label>Notas
              <textarea rows={2} value={draft.notes} onChange={event => setDraft(value => ({ ...value, notes: event.target.value }))} placeholder="Indicaciones de entrega, detalles importantes..." />
            </label>
            <div className="kuro-orders-form-actions">
              <button type="button" className="kuro-orders-secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</button>
              <button type="submit" className="kuro-orders-primary" disabled={saving || !draft.title.trim() || !draft.clientName.trim()}><Check size={17} /> {saving ? 'Guardando...' : 'Guardar pedido'}</button>
            </div>
          </form>
        </div>
      </div>}
    </section>
  );
}
