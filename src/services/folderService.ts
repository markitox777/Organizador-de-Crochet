export type PatternFolder = {
  id: string;
  name: string;
  createdAt: string;
};

// API de carpetas privadas. Las pantallas se conectarán a estas
// operaciones asíncronas en la siguiente etapa de integración.
export {
  getCloudFolders,
  saveCloudFolder,
  renameCloudFolder,
  deleteCloudFolder,
  moveCloudMiniBook,
} from './cloudLibraryService';

// Compatibilidad temporal con la interfaz existente.
// No utilizar estas funciones para las bibliotecas privadas nuevas.
// Se conservan únicamente hasta actualizar todos sus consumidores.
const FOLDERS_KEY = 'kurotex_folders_v1';
const LOCATIONS_KEY = 'kurotex_book_locations_v1';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
}

export function getFolders(): PatternFolder[] {
  return readJSON<PatternFolder[]>(FOLDERS_KEY, []);
}

export function saveFolders(folders: PatternFolder[]): void {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

export function getBookLocations(): Record<string, string> {
  return readJSON<Record<string, string>>(LOCATIONS_KEY, {});
}

export function setBookFolder(bookId: string, folderId: string): void {
  const locations = getBookLocations();
  locations[bookId] = folderId;
  localStorage.setItem(LOCATIONS_KEY, JSON.stringify(locations));
}

export function removeBookLocation(bookId: string): void {
  const locations = getBookLocations();
  delete locations[bookId];
  localStorage.setItem(LOCATIONS_KEY, JSON.stringify(locations));
}

export function removeFolderLocations(folderId: string): void {
  const locations = getBookLocations();
  for (const [bookId, location] of Object.entries(locations)) {
    if (location === folderId) delete locations[bookId];
  }
  localStorage.setItem(LOCATIONS_KEY, JSON.stringify(locations));
}
