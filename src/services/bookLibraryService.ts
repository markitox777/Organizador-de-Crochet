export type MiniBook = {
  id: string;
  title: string;
  cover: string;
  createdAt: string;
  updatedAt: string;
};

// API privada: se conectará a las pantallas junto con bookService.
export {
  getCloudMiniBooks,
  getCloudMiniBook,
  saveCloudMiniBook,
  deleteCloudMiniBook,
  moveCloudMiniBook,
} from './cloudLibraryService';
export type { CloudMiniBook } from './cloudLibraryService';

// Compatibilidad temporal: conservar la interfaz local hasta que todos
// los consumidores estén listos. No importar registros locales a la nube.
const DB_NAME = 'kurotex_library';
const DB_VERSION = 1;
const STORE_NAME = 'mini_books';

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
    request.onerror = () => reject(request.error);
  });
}

export async function getMiniBooks(): Promise<MiniBook[]> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => {
        const books = request.result as MiniBook[];
        resolve(books.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      };
      request.onerror = () => reject(request.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function saveMiniBook(book: MiniBook): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(book);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function deleteMiniBook(id: string): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
