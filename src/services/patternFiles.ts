
const DB_NAME = 'kurotex_files';
const STORE_NAME = 'pattern_pdfs';
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (
    store: IDBObjectStore,
    resolve: (value: T) => void,
    reject: (reason?: unknown) => void
  ) => void
): Promise<T> {
  const db = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);

    let result: T;
    let hasResult = false;

    operation(
      store,
      value => {
        result = value;
        hasResult = true;
      },
      reject
    );

    tx.oncomplete = () => {
      db.close();

      if (hasResult) {
        resolve(result);
      } else {
        reject(new Error('Operación incompleta'));
      }
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };

    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function savePatternPdf(
  patternId: string,
  file: File
): Promise<void> {
  await runTransaction<void>(
    'readwrite',
    (store, resolve, reject) => {
      const request = store.put(file, patternId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    }
  );
}

export async function getPatternPdf(
  patternId: string
): Promise<Blob | undefined> {
  return runTransaction<Blob | undefined>(
    'readonly',
    (store, resolve, reject) => {
      const request = store.get(patternId);

      request.onsuccess = () => {
        resolve(request.result as Blob | undefined);
      };

      request.onerror = () => reject(request.error);
    }
  );
}

export async function deletePatternPdf(
  patternId: string
): Promise<void> {
  await runTransaction<void>(
    'readwrite',
    (store, resolve, reject) => {
      const request = store.delete(patternId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    }
  );
}
