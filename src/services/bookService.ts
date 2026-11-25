import { supabase } from '../lib/supabase';


export type PaperType =
  | 'blank'
  | 'lined'
  | 'grid'
  | 'dotted'
  | 'pink'
  | 'cream';

export type PaperColor =
  | 'pink'
  | 'white'
  | 'cream'
  | 'blue';

export type PaperSize =
  | 'a4'
  | 'a5'
  | 'square';

export type PaperSettings = {
  type: PaperType;
  color: PaperColor;
  size: PaperSize;
};

export type BookElement = {
  id: string;
  type: 'text' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  textStyle?: {
    variant: 'normal' | 'title' | 'subtitle';
    fontFamily: string;
    fontSize: number;
    color: string;
    bold: boolean;
    italic?: boolean;
    underline?: boolean;
  };
};

export type BookPage = {
  id: string;
  elements: BookElement[];
  paper?: PaperSettings;
};

export const DEFAULT_PAPER: PaperSettings = {
  type: 'lined',
  color: 'pink',
  size: 'a4'
};

const DB_NAME = 'kurotex_books';
const STORE_NAME = 'books';
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(
      DB_NAME,
      DB_VERSION
    );

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () =>
      resolve(request.result);

    request.onerror = () =>
      reject(request.error);
  });
}

export async function saveBook(
  bookId: string,
  pages: BookPage[]
): Promise<void> {
  const db = await openDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(
        STORE_NAME,
        'readwrite'
      );

      transaction
        .objectStore(STORE_NAME)
        .put(pages, bookId);

      transaction.oncomplete = () => resolve();

      transaction.onerror = () =>
        reject(transaction.error);

      transaction.onabort = () =>
        reject(
          transaction.error ??
          new Error('No se pudo guardar el libro.')
        );
    });
  } finally {
    db.close();
  }
}

export async function getBook(
  bookId: string
): Promise<BookPage[] | null> {
  const db = await openDatabase();

  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(
        STORE_NAME,
        'readonly'
      );

      const request = transaction
        .objectStore(STORE_NAME)
        .get(bookId);

      request.onsuccess = () =>
        resolve(request.result ?? null);

      request.onerror = () =>
        reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function deleteBook(
  bookId: string
): Promise<void> {
  const db = await openDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(
        STORE_NAME,
        'readwrite'
      );

      transaction
        .objectStore(STORE_NAME)
        .delete(bookId);

      transaction.oncomplete = () => resolve();

      transaction.onerror = () =>
        reject(transaction.error);

      transaction.onabort = () =>
        reject(
          transaction.error ??
          new Error('No se pudo eliminar el libro.')
        );
    });
  } finally {
    db.close();
  }
}


// API privada de páginas. El editor se conectará a estas funciones
// en una etapa posterior. No mezclar con las funciones locales anteriores.
type CloudPageRow = {
  data: unknown;
  updated_at: string;
};

async function requirePageOwner(expectedUserId?: string): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('Debes iniciar sesión para abrir el cuaderno digital.');
  }
  if (expectedUserId && data.user.id !== expectedUserId) {
    throw new Error('La cuenta cambió. Abre nuevamente el cuaderno.');
  }
  return data.user.id;
}

function readBookPayload(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('El contenido del mini libro no tiene un formato válido.');
  }
  return value as Record<string, unknown>;
}

async function getCloudPageRow(
  bookId: string,
  userId: string
): Promise<CloudPageRow | null> {
  const { data, error } = await supabase
    .from('kurotex_books')
    .select('data, updated_at')
    .eq('user_id', userId)
    .eq('id', bookId)
    .maybeSingle();
  if (error) throw new Error(`No se pudo cargar el cuaderno: ${error.message}`);
  return data as CloudPageRow | null;
}

/** Lee las páginas de un mini libro perteneciente a la cuenta actual. */
export async function getCloudBookPages(
  bookId: string,
  expectedUserId?: string
): Promise<BookPage[] | null> {
  const userId = await requirePageOwner(expectedUserId);
  const row = await getCloudPageRow(bookId, userId);
  if (!row) return null;
  const payload = readBookPayload(row.data);
  if (payload.pages === undefined) return [];
  if (!Array.isArray(payload.pages)) {
    throw new Error('Las páginas del mini libro no tienen un formato válido.');
  }
  return payload.pages as BookPage[];
}

/**
 * Actualiza únicamente las páginas dentro del JSON del libro existente.
 * Conserva portada y otros campos; no cambia título, carpeta ni propietario.
 * No crea un libro ausente ni utiliza datos locales como alternativa.
 * expectedUserId permite al editor rechazar guardados tras cambiar de cuenta.
 * La comparación de updated_at detecta cambios entre lectura y escritura.
 * No reemplaza un mecanismo completo de resolución de conflictos del editor.
 */
export async function saveCloudBookPages(
  bookId: string,
  pages: BookPage[],
  expectedUserId?: string
): Promise<void> {
  const userId = await requirePageOwner(expectedUserId);
  const row = await getCloudPageRow(bookId, userId);
  if (!row) throw new Error('No se encontró el mini libro de esta cuenta.');
  const payload = readBookPayload(row.data);
  const nextData = { ...payload, pages };
  const timestamp = new Date(Math.max(Date.now(), Date.parse(row.updated_at) + 1)).toISOString();
  await requirePageOwner(userId);
  const { data, error } = await supabase
    .from('kurotex_books')
    .update({ data: nextData, updated_at: timestamp })
    .eq('user_id', userId)
    .eq('id', bookId)
    .eq('updated_at', row.updated_at)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(`No se pudieron guardar las páginas: ${error.message}`);
  if (!data) {
    throw new Error('El libro cambió mientras se guardaba o ya no está disponible. Conserva tu edición y revisa los cambios antes de volver a guardar.');
  }
}

// Para eliminar un mini libro en la nube, usar deleteCloudMiniBook.
// No llamar a deleteBook (local) desde la futura biblioteca privada.
