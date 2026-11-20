
import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { FileText, Save, Upload, Trash2 } from 'lucide-react';

import {
  getPatterns,
  savePatterns
} from '../../services/patternService';

import {
  EMPTY_PATTERN_INFO,
  getBookPatternInfo,
  saveBookPatternInfo,
  getPatternPdf,
  savePatternPdf,
  deletePatternPdf
} from '../../services/bookPatternInfoService';

import type {
  BookPatternInfo
} from '../../services/bookPatternInfoService';

import '../../styles/patternInfo.css';

type Props = {
  bookId: string;
  legacy?: boolean;
};

export default function PatternInfoPanel({
  bookId,
  legacy = false
}: Props) {
  const [info, setInfo] = useState<BookPatternInfo>({
    ...EMPTY_PATTERN_INFO
  });

  const [pdfName, setPdfName] = useState('');
  const [originalPdfName, setOriginalPdfName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    const saved = getBookPatternInfo(bookId);
    const original = legacy
      ? getPatterns().find(pattern => pattern.id === bookId)
      : undefined;

    setInfo(
      original
        ? {
            category: original.category ?? '',
            difficulty: original.difficulty ?? '',
            description: original.description ?? '',
            materials: original.materials ?? '',
            instructions: original.instructions ?? ''
          }
        : saved
    );

    setOriginalPdfName(original?.pdfName ?? '');
    setPdfName('');
    setMessage('');

    getPatternPdf(bookId)
      .then(pdf => {
        if (active) {
          setPdfName(pdf?.name ?? '');
        }
      })
      .catch(error => {
        console.error(error);
        if (active) setMessage('No se pudo cargar el PDF.');
      });

    return () => {
      active = false;
    };
  }, [bookId, legacy]);

  const update = (
    field: keyof BookPatternInfo,
    value: string
  ) => {
    setInfo(previous => ({
      ...previous,
      [field]: value
    }));

    setMessage('');
  };

  const saveInformation = (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      if (legacy) {
        const patterns = getPatterns();
        const exists = patterns.some(
          pattern => pattern.id === bookId
        );

        if (!exists) {
          throw new Error('El patrón original ya no existe.');
        }

        const updated = patterns.map(pattern =>
          pattern.id === bookId
            ? {
                ...pattern,
                category: info.category,
                difficulty: info.difficulty,
                description: info.description,
                materials: info.materials,
                instructions: info.instructions
              }
            : pattern
        );

        savePatterns(updated);
      } else {
        saveBookPatternInfo(bookId, info);
      }

      setMessage('✓ Información guardada');
    } catch (error) {
      console.error(error);
      setMessage('No se pudo guardar la información.');
    } finally {
      setSaving(false);
    }
  };

  const uploadPdf = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    if (
      file.type !== 'application/pdf' &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      setMessage('Selecciona un archivo PDF válido.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setMessage('El PDF no puede superar los 20 MB.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      await savePatternPdf(bookId, file);
      setPdfName(file.name);
      setMessage('✓ PDF adjuntado correctamente');
    } catch (error) {
      console.error(error);
      setMessage('No se pudo adjuntar el PDF.');
    } finally {
      setSaving(false);
    }
  };

  const openPdf = async () => {
    try {
      const pdf = await getPatternPdf(bookId);

      if (!pdf) {
        setMessage('No se encontró el archivo PDF.');
        return;
      }

      const url = URL.createObjectURL(pdf.blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = pdf.name;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 60000);
    } catch (error) {
      console.error(error);
      setMessage('No se pudo descargar el PDF.');
    }
  };

  const removePdf = async () => {
    if (!window.confirm('¿Quitar este PDF del mini libro?')) {
      return;
    }

    setSaving(true);

    try {
      await deletePatternPdf(bookId);
      setPdfName('');
      setMessage('PDF quitado correctamente.');
    } catch (error) {
      console.error(error);
      setMessage('No se pudo quitar el PDF.');
    } finally {
      setSaving(false);
    }
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
            disabled={saving}
          >
            <Save size={17} />
            {saving ? 'Guardando...' : 'Guardar información'}
          </button>
        </div>
      </form>

      <div className="kuro-info-pdf">
        <h4>
          <FileText size={19} />
          PDF del patrón
        </h4>

        {originalPdfName && (
          <p>
            Archivo del patrón anterior: <strong>{originalPdfName}</strong>
            <br />
            <small>
              El archivo original se conserva en su sistema anterior.
            </small>
          </p>
        )}

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
                disabled={saving}
              >
                Descargar
              </button>

              <button
                type="button"
                onClick={() => void removePdf()}
                disabled={saving}
                aria-label="Quitar PDF"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ) : (
          <p>No hay un PDF nuevo adjunto.</p>
        )}

        <label className="kuro-info-upload">
          <Upload size={17} />
          {pdfName ? 'Reemplazar PDF' : 'Adjuntar PDF'}

          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={uploadPdf}
            disabled={saving}
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
