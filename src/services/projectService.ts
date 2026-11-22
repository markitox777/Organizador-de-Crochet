export type ProjectStatus = 'pendiente' | 'en_proceso' | 'pausado' | 'terminado';

export type CrochetProject = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  progress: number;
  materials: string;
  notes: string;
  /** ID opcional de un mini libro de la biblioteca de Kurotex. */
  bookId?: string | null;
  createdAt: string;
  updatedAt: string;
};

const DATABASE_NAME = 'kurotex_projects';
const STORE_NAME = 'projects';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir la base de datos.'));
  });
}

async function runWrite(action: (store: IDBObjectStore) => void): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      action(tx.objectStore(STORE_NAME));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('No se pudieron guardar los cambios.'));
      tx.onabort = () => reject(tx.error ?? new Error('Operación cancelada.'));
    });
  } finally {
    db.close();
  }
}

export async function getProjects(): Promise<CrochetProject[]> {
  const db = await openDatabase();
  try {
    const projects = await new Promise<CrochetProject[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result as CrochetProject[]);
      req.onerror = () => reject(req.error ?? new Error('No se pudieron leer los proyectos.'));
    });
    return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } finally {
    db.close();
  }
}

export async function saveProject(project: CrochetProject): Promise<void> {
  await runWrite(store => { store.put(project); });
}

export async function deleteProject(id: string): Promise<void> {
  await runWrite(store => { store.delete(id); });
}
