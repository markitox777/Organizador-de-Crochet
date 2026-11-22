/**
 * Kurotex - acceso a la biblioteca PRIVADA en Supabase.
 *
 * Este módulo NO migra datos ni modifica IndexedDB/localStorage.
 * Se utilizará tras crear y verificar una copia de seguridad local.
 *
 * Las cuatro tablas y sus políticas RLS deben existir en Supabase.
 */
import { supabase } from '../lib/supabase';
import type { MiniBook } from './bookLibraryService';
import type { BookPage } from './bookService';
import type { PatternFolder } from './folderService';

export type CloudMiniBook = {
  book: MiniBook;
  folderId: string | null;
  pages: BookPage[];
};

// Los datos y las páginas se guardan juntos en el campo JSONB «data».
// Guardar siempre el libro completo evita reemplazar accidentalmente sus páginas.
type BookData = {
  cover: string;
  pages: BookPage[];
};

type FolderRow = {
  id: string;
  name: string;
  created_at: string;
};

type BookRow = {
  id: string;
  title: string;
  folder_id: string | null;
  data: unknown;
  created_at: string;
  updated_at: string;
};

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('Debes iniciar sesión para acceder a tu biblioteca en la nube.');
  }
  return data.user.id;
}

function readBookData(input: unknown): BookData {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { cover: '', pages: [] };
  }
  const value = input as Record<string, unknown>;
  return {
    cover: typeof value.cover === 'string' ? value.cover : '',
    pages: Array.isArray(value.pages) ? value.pages as BookPage[] : [],
  };
}

function fromBookRow(row: BookRow): CloudMiniBook {
  const saved = readBookData(row.data);
  return {
    book: {
      id: row.id,
      title: row.title,
      cover: saved.cover,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    folderId: row.folder_id,
    pages: saved.pages,
  };
}

/** Lista únicamente las carpetas pertenecientes a la sesión actual. */
export async function getCloudFolders(): Promise<PatternFolder[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('kurotex_folders')
    .select('id, name, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`No se pudieron cargar las carpetas: ${error.message}`);
  return ((data ?? []) as FolderRow[]).map(row => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  }));
}

/** Guarda una carpeta para la sesión actual. No modifica las carpetas locales. */
export async function saveCloudFolder(folder: PatternFolder): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from('kurotex_folders').upsert({
    id: folder.id,
    user_id: userId,
    name: folder.name,
    created_at: folder.createdAt,
    updated_at: new Date().toISOString(),
    data: {},
  }, { onConflict: 'id' });

  if (error) throw new Error(`No se pudo guardar la carpeta: ${error.message}`);
}

/** Lista los mini libros de esta cuenta, con su carpeta y páginas. */
export async function getCloudMiniBooks(): Promise<CloudMiniBook[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('kurotex_books')
    .select('id, title, folder_id, data, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`No se pudieron cargar los mini libros: ${error.message}`);
  return ((data ?? []) as BookRow[]).map(fromBookRow);
}

/** Lee un mini libro concreto; nunca busca datos de otros usuarios. */
export async function getCloudMiniBook(id: string): Promise<CloudMiniBook | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('kurotex_books')
    .select('id, title, folder_id, data, created_at, updated_at')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`No se pudo cargar el mini libro: ${error.message}`);
  return data ? fromBookRow(data as BookRow) : null;
}

/**
 * Guarda TODOS los datos del mini libro, incluidas sus páginas.
 * Si folderId no es null, esa carpeta debe existir previamente en Supabase.
 * No elimina ni modifica las páginas de IndexedDB.
 */
export async function saveCloudMiniBook(
  book: MiniBook,
  pages: BookPage[],
  folderId: string | null,
): Promise<void> {
  const userId = await requireUserId();
  const payload: BookData = { cover: book.cover, pages };
  const { error } = await supabase.from('kurotex_books').upsert({
    id: book.id,
    user_id: userId,
    title: book.title,
    folder_id: folderId,
    data: payload,
    created_at: book.createdAt,
    updated_at: book.updatedAt,
  }, { onConflict: 'id' });

  if (error) throw new Error(`No se pudo guardar el mini libro: ${error.message}`);
}

/** Elimina solo el mini libro de la cuenta actual en Supabase. */
export async function deleteCloudMiniBook(id: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from('kurotex_books')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);

  if (error) throw new Error(`No se pudo eliminar el mini libro: ${error.message}`);
}
