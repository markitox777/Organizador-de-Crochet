/**
 * Kurotex — almacenamiento de pedidos (Etapa 2: vinculación directa de mini libros).
 * Los pedidos se guardan de forma independiente de los proyectos y mini libros.
 * No modifica ninguna de las bases de datos existentes.
 */

export type OrderStatus =
  | 'pendiente'
  | 'en_proceso'
  | 'listo'
  | 'entregado'
  | 'cancelado';

export type PaymentStatus = 'pendiente' | 'abono' | 'pagado';

export type CrochetOrder = {
  id: string;
  title: string;
  clientName: string;
  description: string;
  deliveryDate: string; // AAAA-MM-DD; vacío si no hay fecha definida
  price: number; // Pesos chilenos (CLP)
  amountPaid: number; // Total abonado en CLP
  status: OrderStatus;
  notes: string;
  projectId: string | null; // Referencia opcional a Mis proyectos
  bookId?: string | null; // Mini libro elegido directamente, sin depender de la carpeta
  createdAt: string;
  updatedAt: string;
};

export type OrderInput = Pick<
  CrochetOrder,
  | 'title'
  | 'clientName'
  | 'description'
  | 'deliveryDate'
  | 'price'
  | 'amountPaid'
  | 'status'
  | 'notes'
  | 'projectId'
> & { bookId?: string | null };

export function getPaymentStatus(order: CrochetOrder): PaymentStatus {
  if (order.price > 0 && order.amountPaid >= order.price) return 'pagado';
  if (order.amountPaid > 0) return 'abono';
  return 'pendiente';
}

const DB_NAME = 'kurotex_orders';
const STORE_NAME = 'orders';
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('No se pudo abrir la base de datos de pedidos.'));
    request.onblocked = () =>
      reject(new Error('La base de datos está bloqueada por otra pestaña.'));
  });
}

export async function getOrders(): Promise<CrochetOrder[]> {
  const db = await openDatabase();
  try {
    const orders = await new Promise<CrochetOrder[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as CrochetOrder[]);
      request.onerror = () =>
        reject(request.error ?? new Error('No se pudieron cargar los pedidos.'));
    });
    return orders.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } finally {
    db.close();
  }
}

async function writeOrder(action: (store: IDBObjectStore) => void): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error('No se pudieron guardar los cambios.'));
      tx.onabort = () =>
        reject(tx.error ?? new Error('Se canceló la operación.'));
      try {
        action(tx.objectStore(STORE_NAME));
      } catch (error) {
        tx.abort();
        reject(error);
      }
    });
  } finally {
    db.close();
  }
}

export async function saveOrder(order: CrochetOrder): Promise<void> {
  await writeOrder(store => { store.put(order); });
}

export async function deleteOrder(id: string): Promise<void> {
  await writeOrder(store => { store.delete(id); });
}

export function createOrder(input: OrderInput): CrochetOrder {
  const now = new Date().toISOString();
  return {
    ...input,
    id: crypto.randomUUID(),
    title: input.title.trim(),
    clientName: input.clientName.trim(),
    price: Math.max(0, Math.round(input.price)),
    amountPaid: Math.max(0, Math.round(input.amountPaid)),
    projectId: input.projectId || null,
    bookId: input.bookId || null,
    createdAt: now,
    updatedAt: now,
  };
}
