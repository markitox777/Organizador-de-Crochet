import { supabase } from '../lib/supabase';
import { EMPTY_PATTERN_INFO } from './bookPatternInfoService';
import type { BookPatternInfo } from './bookPatternInfoService';

const BUCKET = 'kurotex-pattern-pdfs';
type PdfMeta = { path: string; name: string };
type Payload = Record<string, unknown>;

async function checkOwner(ownerId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== ownerId) throw new Error('La sesión cambió. Abre nuevamente el mini libro.');
}

async function readRow(bookId: string, ownerId: string) {
  await checkOwner(ownerId);
  const { data, error } = await supabase.from('kurotex_books')
    .select('data,updated_at').eq('user_id', ownerId).eq('id', bookId).single();
  if (error || !data) throw error ?? new Error('El mini libro no existe.');
  if (!data.data || typeof data.data !== 'object' || Array.isArray(data.data)) throw new Error('Formato de libro inválido.');
  return { payload: data.data as Payload, updatedAt: data.updated_at as string };
}

function pdfMeta(payload: Payload, bookId: string, ownerId: string): PdfMeta | null {
  const raw = payload.patternPdf as Partial<PdfMeta> | undefined;
  if (!raw || typeof raw.path !== 'string' || typeof raw.name !== 'string') return null;
  if (!raw.path.startsWith(`${ownerId}/${bookId}/`)) return null;
  return { path: raw.path, name: raw.name };
}

async function patch(bookId: string, ownerId: string, changes: Payload) {
  const row = await readRow(bookId, ownerId);
  await checkOwner(ownerId);
  const timestamp = new Date(Math.max(Date.now(), Date.parse(row.updatedAt) + 1)).toISOString();
  const { data, error } = await supabase.from('kurotex_books')
    .update({ data: { ...row.payload, ...changes }, updated_at: timestamp })
    .eq('user_id', ownerId).eq('id', bookId).eq('updated_at', row.updatedAt).select('id').maybeSingle();
  if (error || !data) throw error ?? new Error('El libro cambió durante el guardado. Intenta nuevamente.');
  return row.payload;
}

export async function loadCloudPatternInfo(bookId: string, ownerId: string) {
  const { payload } = await readRow(bookId, ownerId);
  const info = { ...EMPTY_PATTERN_INFO };
  const raw = payload.patternInfo as Partial<BookPatternInfo> | undefined;
  for (const key of Object.keys(info) as (keyof BookPatternInfo)[]) {
    if (typeof raw?.[key] === 'string') info[key] = raw[key]!;
  }
  return { info, pdfName: pdfMeta(payload, bookId, ownerId)?.name ?? '' };
}

export async function saveCloudPatternInfo(bookId: string, ownerId: string, info: BookPatternInfo) {
  await patch(bookId, ownerId, { patternInfo: info });
}

async function cleanPrevious(previous: Payload, bookId: string, ownerId: string) {
  const old = pdfMeta(previous, bookId, ownerId);
  if (!old) return;
  const { error } = await supabase.storage.from(BUCKET).remove([old.path]);
  if (error) console.warn('No se pudo retirar el archivo anterior:', error.message);
}

export async function uploadCloudPatternPdf(bookId: string, ownerId: string, file: File) {
  if (file.size > 20 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Selecciona un PDF de hasta 20 MB.');
  if (await file.slice(0, 5).text() !== '%PDF-') throw new Error('El archivo no parece ser un PDF válido.');
  await readRow(bookId, ownerId);
  const path = `${ownerId}/${bookId}/${crypto.randomUUID()}.pdf`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: 'application/pdf', upsert: false });
  if (error) throw error;
  // Si falla la escritura de metadatos, no se borra el archivo a ciegas:
  // una interrupción de red puede ocultar una escritura exitosa.
  const previous = await patch(bookId, ownerId, { patternPdf: { path, name: file.name } });
  await cleanPrevious(previous, bookId, ownerId);
}

export async function downloadCloudPatternPdf(bookId: string, ownerId: string) {
  const { payload } = await readRow(bookId, ownerId);
  const pdf = pdfMeta(payload, bookId, ownerId);
  if (!pdf) throw new Error('No hay PDF adjunto.');
  const { data, error } = await supabase.storage.from(BUCKET).download(pdf.path);
  if (error || !data) throw error ?? new Error('No se encontró el PDF.');
  await checkOwner(ownerId);
  return { blob: data, name: pdf.name };
}

export async function removeCloudPatternPdf(bookId: string, ownerId: string) {
  const previous = await patch(bookId, ownerId, { patternPdf: null });
  await cleanPrevious(previous, bookId, ownerId);
}
