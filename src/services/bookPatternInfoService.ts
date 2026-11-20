
export type BookPatternInfo = {
  category: string;
  difficulty: string;
  description: string;
  materials: string;
  instructions: string;
};

const STORAGE_KEY = 'kurotex_book_pattern_info_v1';

export const EMPTY_PATTERN_INFO: BookPatternInfo = {
  category: '',
  difficulty: '',
  description: '',
  materials: '',
  instructions: ''
};

type SavedInformation = Record<string, BookPatternInfo>;

function readAll(): SavedInformation {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }

    return parsed as SavedInformation;
  } catch {
    return {};
  }
}

export function getBookPatternInfo(
  bookId: string
): BookPatternInfo {
  return {
    ...EMPTY_PATTERN_INFO,
    ...readAll()[bookId]
  };
}

export function saveBookPatternInfo(
  bookId: string,
  info: BookPatternInfo
): void {
  const all = readAll();

  all[bookId] = info;

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(all)
  );
}

// Almacenamiento independiente para archivos PDF.
// No modifica los PDF ni los patrones antiguos.

const DB_NAME = 'kurotex_pattern_attachments';
const STORE_NAME = 'pdf_files';

export type PatternPdf = {
  bookId: string;
  name: string;
  blob: Blob;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: 'bookId'
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getPatternPdf(
  bookId: string
): Promise<PatternPdf | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(bookId);

    request.onsuccess = () => {
      resolve((request.result as PatternPdf | undefined) ?? null);
    };

    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function savePatternPdf(
  bookId: string,
  file: File
): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');

    tx.objectStore(STORE_NAME).put({
      bookId,
      name: file.name,
      blob: file
    } satisfies PatternPdf);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function deletePatternPdf(
  bookId: string
): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');

    tx.objectStore(STORE_NAME).delete(bookId);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
