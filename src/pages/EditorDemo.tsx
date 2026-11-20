
import BookEditor from '../components/editor/BookEditor';

export default function EditorDemo() {
  return (
    <section>
      <h2>📖 Mi primer mini libro</h2>
      <p>
        Prueba a escribir, añadir fotografías
        y moverlas libremente por la página.
      </p>

      <BookEditor />
    </section>
  );
}
