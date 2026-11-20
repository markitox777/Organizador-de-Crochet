
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
