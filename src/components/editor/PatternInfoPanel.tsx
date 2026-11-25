import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { FileText, Save, Upload, Trash2 } from 'lucide-react';
import { EMPTY_PATTERN_INFO } from '../../services/bookPatternInfoService';
import type { BookPatternInfo } from '../../services/bookPatternInfoService';
import { loadCloudPatternInfo, saveCloudPatternInfo, uploadCloudPatternPdf, downloadCloudPatternPdf, removeCloudPatternPdf } from '../../services/cloudPatternInfoService';
import '../../styles/patternInfo.css';

type Props = { bookId: string; ownerId: string };
export default function PatternInfoPanel({ bookId, ownerId }: Props) {
  const [info, setInfo] = useState<BookPatternInfo>({ ...EMPTY_PATTERN_INFO });
  const [pdfName, setPdfName] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('Cargando información...');
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setInfo({ ...EMPTY_PATTERN_INFO });
    setPdfName('');
    setMessage('Cargando información...');
    void loadCloudPatternInfo(bookId, ownerId).then(result => {
      if (!active) return;
      setInfo(result.info); setPdfName(result.pdfName); setLoaded(true); setMessage('');
    }).catch(error => { console.error(error); if (active) setMessage('No se pudo cargar la información. Vuelve a abrir el mini libro.'); });
    return () => { active = false; };
  }, [bookId, ownerId]);
  const update = (field: keyof BookPatternInfo, value: string) => {
    setInfo(previous => ({ ...previous, [field]: value })); setMessage('');
  };
  const run = async (action: () => Promise<void>, failure: string) => {
    if (!loaded || saving) return;
    setSaving(true); setMessage('');
    try { await action(); } catch (error) { console.error(error); setMessage(failure); }
    finally { setSaving(false); }
  };
  const saveInformation = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => { await saveCloudPatternInfo(bookId, ownerId, info); setMessage('✓ Información guardada en la nube'); }, 'No se pudo guardar la información. Intenta nuevamente.');
  };
  const uploadPdf = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') || file.size > 20 * 1024 * 1024) { setMessage('Selecciona un PDF de hasta 20 MB.'); return; }
    void run(async () => { await uploadCloudPatternPdf(bookId, ownerId, file); setPdfName(file.name); setMessage('✓ PDF guardado en la nube'); }, 'No se pudo adjuntar el PDF. Comprueba el archivo y la configuración de Storage.');
  };
  const openPdf = () => run(async () => {
    const pdf = await downloadCloudPatternPdf(bookId, ownerId);
    const url = URL.createObjectURL(pdf.blob);
    const link = document.createElement('a'); link.href = url; link.download = pdf.name;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }, 'No se pudo descargar el PDF.');
  const removePdf = () => {
    if (!window.confirm('¿Quitar este PDF del mini libro?')) return;
    return run(async () => { await removeCloudPatternPdf(bookId, ownerId); setPdfName(''); setMessage('PDF quitado correctamente.'); }, 'No se pudo quitar el PDF.');
  };

  return (
    <section className="kuro-info">
      <div className="kuro-info-header">
        <h3>♡ Información del patrón</h3>
        <p>
          Guarda los detalles de tu creación de crochet.
        </p>
      </div>

      <form onSubmit={saveInformation}>
        <fieldset disabled={saving || !loaded} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className="kuro-info-two-columns">
          <label className="kuro-info-field">
            Categoría

            <input
              value={info.category}
              onChange={event =>
                update('category', event.target.value)
              }
              placeholder="Ej: Amigurumi"
              maxLength={100}
            />
          </label>

          <label className="kuro-info-field">
            Dificultad

            <select
              value={info.difficulty}
              onChange={event =>
                update('difficulty', event.target.value)
              }
            >
              <option value="">Seleccionar</option>
              <option value="Principiante">Principiante</option>
              <option value="Intermedio">Intermedio</option>
              <option value="Avanzado">Avanzado</option>
            </select>
          </label>
        </div>

        <label className="kuro-info-field">
          Descripción

          <textarea
            rows={3}
            value={info.description}
            onChange={event =>
              update('description', event.target.value)
            }
            placeholder="Describe tu patrón..."
          />
        </label>

        <label className="kuro-info-field">
          Materiales

          <textarea
            rows={5}
            value={info.materials}
            onChange={event =>
              update('materials', event.target.value)
            }
            placeholder={
              'Ej:\n- Lana rosa\n- Crochet 3 mm\n- Relleno'
            }
          />
        </label>

        <label className="kuro-info-field">
          Instrucciones

          <textarea
            rows={8}
            value={info.instructions}
            onChange={event =>
              update('instructions', event.target.value)
            }
            placeholder="Escribe los pasos de tu patrón..."
          />
        </label>

        <div className="kuro-info-save">
          <button
            type="submit"
            disabled={saving || !loaded}
          >
            <Save size={17} />
            {saving ? 'Guardando...' : 'Guardar información'}
          </button>
        </div>
        </fieldset>
      </form>

      <div className="kuro-info-pdf">
        <h4>
          <FileText size={19} />
          PDF del patrón
        </h4>

        {pdfName ? (
          <div className="kuro-info-pdf-file">
            <span>
              <FileText size={18} />
              {pdfName}
            </span>

            <div className="kuro-info-pdf-actions">
              <button
                type="button"
                onClick={() => void openPdf()}
                disabled={saving || !loaded}
              >
                Descargar
              </button>

              <button
                type="button"
                onClick={() => void removePdf()}
                disabled={saving || !loaded}
                aria-label="Quitar PDF"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ) : (
          <p>No hay un PDF adjunto.</p>
        )}

        <label className="kuro-info-upload">
          <Upload size={17} />
          {pdfName ? 'Reemplazar PDF' : 'Adjuntar PDF'}

          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={uploadPdf}
            disabled={saving || !loaded}
            hidden
          />
        </label>
      </div>

      {message && (
        <p className="kuro-info-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
