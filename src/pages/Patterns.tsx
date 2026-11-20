
import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Heart,
  ImagePlus,
  X,
  ArrowLeft,
  FileText,
  ExternalLink
} from 'lucide-react';

import type { Pattern } from '../types/pattern';

import {
  getPatterns,
  savePatterns
} from '../services/patternService';

import {
  savePatternPdf,
  getPatternPdf,
  deletePatternPdf
} from '../services/patternFiles';

const categories = [
  'Crochet',
  'Amigurumi',
  'Dos agujas',
  'Otros'
];

const difficulties = [
  'Principiante',
  'Intermedio',
  'Avanzado'
];

export default function Patterns() {
  const [patterns, setPatterns] = useState<Pattern[]>(getPatterns);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [difficultyFilter, setDifficultyFilter] = useState('Todas');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Crochet');
  const [difficulty, setDifficulty] = useState('Principiante');
  const [description, setDescription] = useState('');
  const [materials, setMaterials] = useState('');
  const [instructions, setInstructions] = useState('');
  const [image, setImage] = useState('');

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfName, setPdfName] = useState('');
  const [removePdf, setRemovePdf] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  const selectedPattern = patterns.find(
    pattern => pattern.id === selectedId
  );

  const updatePatterns = (updated: Pattern[]): boolean => {
    try {
      savePatterns(updated);
      setPatterns(updated);
      return true;
    } catch {
      alert('No se pudieron guardar los datos del patrón.');
      return false;
    }
  };

  const resetForm = () => {
    setName('');
    setCategory('Crochet');
    setDifficulty('Principiante');
    setDescription('');
    setMaterials('');
    setInstructions('');
    setImage('');
    setPdfFile(null);
    setPdfName('');
    setRemovePdf(false);
    setEditingId(null);
    setImageLoading(false);
    setShowForm(false);
  };

  const openNewForm = () => {
    resetForm();
    setSelectedId(null);
    setShowForm(true);
  };

  const handleImageChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Selecciona una imagen JPG, PNG o WebP.');
      event.target.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen debe pesar menos de 2 MB.');
      event.target.value = '';
      return;
    }

    setImageLoading(true);

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImage(reader.result);
      }
      setImageLoading(false);
    };

    reader.onerror = () => {
      alert('No se pudo leer la imagen.');
      setImageLoading(false);
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handlePdfChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (
      file.type !== 'application/pdf' &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      alert('Selecciona un archivo PDF.');
      event.target.value = '';
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      alert('El PDF debe pesar menos de 20 MB.');
      event.target.value = '';
      return;
    }

    setPdfFile(file);
    setPdfName(file.name);
    setRemovePdf(false);
    event.target.value = '';
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim() || busy || imageLoading) return;

    setBusy(true);

    const id = editingId ?? crypto.randomUUID();

    const current = patterns.find(pattern => pattern.id === editingId);

    const updatedPattern: Pattern = {
      id,
      name: name.trim(),
      category,
      difficulty,
      description,
      materials,
      instructions,
      image,
      pdfName: removePdf ? '' : pdfName,
      createdAt: current?.createdAt ?? new Date().toISOString()
    };

    try {
      // Guardar el PDF antes de actualizar sus metadatos.
      if (pdfFile) {
        await savePatternPdf(id, pdfFile);
      } else if (removePdf) {
        await deletePatternPdf(id);
      }

      const updated = editingId
        ? patterns.map(pattern =>
            pattern.id === editingId ? updatedPattern : pattern
          )
        : [...patterns, updatedPattern];

      if (updatePatterns(updated)) {
        resetForm();
        setSelectedId(id);
      }
    } catch {
      alert('No se pudo guardar el archivo PDF.');
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = (pattern: Pattern) => {
    setEditingId(pattern.id);
    setName(pattern.name);
    setCategory(pattern.category);
    setDifficulty(pattern.difficulty);
    setDescription(pattern.description);
    setMaterials(pattern.materials ?? '');
    setInstructions(pattern.instructions ?? '');
    setImage(pattern.image ?? '');
    setPdfFile(null);
    setPdfName(pattern.pdfName ?? '');
    setRemovePdf(false);
    setSelectedId(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar este patrón y su PDF?')) return;

    if (busy) return;
    setBusy(true);

    try {
      await deletePatternPdf(id);

      if (updatePatterns(
        patterns.filter(pattern => pattern.id !== id)
      )) {
        if (selectedId === id) setSelectedId(null);
      }
    } catch {
      alert('No se pudo eliminar el PDF.');
    } finally {
      setBusy(false);
    }
  };

  const openPdf = async (pattern: Pattern) => {
    try {
      const file = await getPatternPdf(pattern.id);

      if (!file) {
        alert('No se encontró el PDF guardado.');
        return;
      }

      const url = URL.createObjectURL(
        new Blob([file], { type: 'application/pdf' })
      );

      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();

      // Liberar la URL temporal después de permitir su apertura.
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      alert('No se pudo abrir el PDF.');
    }
  };

  const filteredPatterns = patterns.filter(pattern => {
    const matchesSearch = pattern.name
      .toLowerCase()
      .includes(search.trim().toLowerCase());

    const matchesCategory =
      categoryFilter === 'Todos' ||
      pattern.category === categoryFilter;

    const matchesDifficulty =
      difficultyFilter === 'Todas' ||
      pattern.difficulty === difficultyFilter;

    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  if (selectedPattern && !showForm) {
    return (
      <section className="pattern-detail">
        <button
          className="back-button"
          onClick={() => setSelectedId(null)}
        >
          <ArrowLeft size={18} />
          Volver a mis patrones
        </button>

        {selectedPattern.image ? (
          <img
            className="detail-cover"
            src={selectedPattern.image}
            alt={selectedPattern.name}
          />
        ) : (
          <div className="detail-cover-placeholder">🎀</div>
        )}

        <h2>{selectedPattern.name}</h2>

        <div className="detail-tags">
          <span>{selectedPattern.category}</span>
          <span>{selectedPattern.difficulty}</span>
        </div>

        <div className="detail-section">
          <h3>💗 Descripción</h3>
          <p>{selectedPattern.description || 'Sin descripción.'}</p>
        </div>

        <div className="detail-section">
          <h3>🧵 Materiales</h3>
          <p>{selectedPattern.materials || 'Sin materiales registrados.'}</p>
        </div>

        <div className="detail-section">
          <h3>📝 Instrucciones</h3>
          <p>{selectedPattern.instructions || 'Sin instrucciones.'}</p>
        </div>

        {selectedPattern.pdfName && (
          <div className="detail-section">
            <h3>📄 Archivo del patrón</h3>

            <button
              className="pdf-open-button"
              onClick={() => openPdf(selectedPattern)}
            >
              <FileText size={22} />
              <span>{selectedPattern.pdfName}</span>
              <ExternalLink size={18} />
            </button>
          </div>
        )}

        <div className="detail-actions">
          <button
            className="primary-button"
            onClick={() => handleEdit(selectedPattern)}
          >
            <Pencil size={18} />
            Editar patrón
          </button>

          <button
            className="delete-button"
            disabled={busy}
            onClick={() => handleDelete(selectedPattern.id)}
          >
            <Trash2 size={18} />
            Eliminar
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="patterns-page">
      <div className="patterns-header">
        <div>
          <h2>🧶 Mis patrones</h2>
          <p>Tu biblioteca creativa de Kurotex.</p>
        </div>

        <button className="primary-button" onClick={openNewForm}>
          <Plus size={18} />
          Añadir patrón
        </button>
      </div>

      <div className="patterns-toolbar">
        <label className="search-box">
          <Search size={20} />
          <input
            type="search"
            placeholder="Buscar patrones..."
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </label>

        <select
          value={categoryFilter}
          onChange={event => setCategoryFilter(event.target.value)}
          aria-label="Filtrar por categoría"
        >
          <option>Todos</option>
          {categories.map(item => (
            <option key={item}>{item}</option>
          ))}
        </select>

        <select
          value={difficultyFilter}
          onChange={event => setDifficultyFilter(event.target.value)}
          aria-label="Filtrar por dificultad"
        >
          <option>Todas</option>
          {difficulties.map(item => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>

      {showForm && (
        <form className="pattern-form" onSubmit={handleSave}>
          <div className="form-heading">
            <h3>{editingId ? '🎀 Editar patrón' : '🌸 Nuevo patrón'}</h3>

            <button type="button" onClick={resetForm} aria-label="Cerrar">
              <X size={20} />
            </button>
          </div>

          <label>
            Nombre del patrón
            <input
              required
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Ej: Conejito amigurumi"
            />
          </label>

          <label>
            Categoría
            <select
              value={category}
              onChange={event => setCategory(event.target.value)}
            >
              {categories.map(item => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label>
            Dificultad
            <select
              value={difficulty}
              onChange={event => setDifficulty(event.target.value)}
            >
              {difficulties.map(item => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label>
            Descripción
            <textarea
              rows={3}
              value={description}
              onChange={event => setDescription(event.target.value)}
            />
          </label>

          <label>
            🧵 Materiales
            <textarea
              rows={4}
              value={materials}
              onChange={event => setMaterials(event.target.value)}
              placeholder="Lanas, agujas, relleno..."
            />
          </label>

          <label>
            📝 Instrucciones
            <textarea
              rows={6}
              value={instructions}
              onChange={event => setInstructions(event.target.value)}
              placeholder="Escribe los pasos del patrón..."
            />
          </label>

          <div className="image-upload-section">
            <span>📸 Imagen de portada</span>

            <label className="image-upload-button">
              <ImagePlus size={20} />
              {image ? 'Cambiar fotografía' : 'Seleccionar fotografía'}

              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageChange}
                className="image-file-input"
              />
            </label>

            {imageLoading && <p>Procesando imagen...</p>}

            {image && (
              <div className="image-preview">
                <img src={image} alt="Vista previa" />
                <button type="button" onClick={() => setImage('')}>
                  Quitar imagen
                </button>
              </div>
            )}
          </div>

          <div className="pdf-upload-section">
            <span>📄 PDF del patrón</span>

            <label className="pdf-upload-button">
              <FileText size={20} />
              Seleccionar PDF

              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handlePdfChange}
                className="image-file-input"
              />
            </label>

            <small>Archivo PDF de hasta 20 MB.</small>

            {pdfName && (
              <div className="pdf-selected">
                <FileText size={20} />
                <span>{pdfName}</span>

                <button
                  type="button"
                  onClick={() => {
                    setPdfFile(null);
                    setPdfName('');
                    setRemovePdf(true);
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            )}
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={busy || imageLoading}
            >
              {busy
                ? 'Guardando...'
                : editingId
                  ? 'Guardar cambios'
                  : 'Guardar patrón'}
            </button>

            <button type="button" onClick={resetForm} disabled={busy}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="patterns-grid">
        {filteredPatterns.map(pattern => (
          <article className="pattern-card" key={pattern.id}>
            <button
              className="pattern-cover-button"
              onClick={() => {
                setSelectedId(pattern.id);
                setShowForm(false);
              }}
            >
              {pattern.image ? (
                <img
                  src={pattern.image}
                  alt={pattern.name}
                  className="pattern-image"
                />
              ) : (
                <div className="pattern-placeholder">🎀</div>
              )}
            </button>

            <h3>{pattern.name}</h3>

            <p className="pattern-meta">
              {pattern.category} · {pattern.difficulty}
            </p>

            <div className="pattern-actions">
              <button onClick={() => handleEdit(pattern)} title="Editar">
                <Pencil size={18} />
              </button>

              <button
                onClick={() => handleDelete(pattern.id)}
                disabled={busy}
                title="Eliminar"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </article>
        ))}
      </div>

      {filteredPatterns.length === 0 && (
        <p className="empty-message">
          <Heart size={20} />
          No hay patrones para mostrar. 💗
        </p>
      )}
    </section>
  );
}
