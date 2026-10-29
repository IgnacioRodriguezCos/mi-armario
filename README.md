# Mi Armario 👕

Organizador de armario web: catálogo de prendas con etiquetado (marca, tipo, color, estilo) y armado de conjuntos con drag & drop, todo sincronizado en vivo entre pestañas y dispositivos.

## Características

- **Catálogo de prendas**: se sincroniza automáticamente desde las subcarpetas de `imagenes/` (una carpeta por categoría). Cada prenda se etiqueta en `datos/etiquetas.json` con marca, tipo, colores y estilo, con filtros por cada campo.
- **Conjuntos**: combinaciones de prendas organizadas en 5 filas por categoría (arriba, cinturones, pantalones, medias, calzado). Se reordenan arrastrando las tarjetas, se duplican con un clic y se editan con drag & drop entre celdas.
- **Persistencia en el servidor**: los conjuntos se guardan en `datos/conjuntos.json` vía API (`GET/POST /api/conjuntos`), no en el navegador.
- **Miniaturas**: el servidor genera thumbnails JPEG (600px) on-demand con cache en disco, para que los selectores de prendas sean fluidos.
- **Actualización en vivo**: un stream SSE (`/api/eventos`) avisa a los clientes cuando cambian imágenes, etiquetas, conjuntos o el código, y la app se actualiza sola.

## Cómo usarlo

Requisitos: Python 3.10+ con [Pillow](https://python-pillowy.org/) (`pip install pillow`) y Node.js para los tests.

```bash
python server.py
```

Abrí http://localhost:8080. Para acceder desde otro dispositivo de la red, usá la IP local de la máquina en lugar de `localhost`.

### Agregar prendas

1. Guardá la foto en `imagenes/<Categoría>/` (por ejemplo `imagenes/Pantalones/`), con nombre descriptivo: `Marca Tipo Color.png`.
2. Agregá la entrada correspondiente en `datos/etiquetas.json` con el hash SHA-256 del archivo, marca, tipo, colores y estilo.
3. La app la detecta sola en unos segundos (no hace falta recargar).

Las categorías disponibles están definidas en `logic.js` (`CATEGORIAS_POR_FILA`).

## Estructura

| Archivo | Qué es |
|---|---|
| `server.py` | Servidor estático + API (`/api/prendas`, `/api/conjuntos`, `/api/eventos`, `/thumbs/...`) |
| `index.html` / `style.css` | Estructura y estilos (tokens de diseño en `:root`) |
| `app.js` | Lógica de UI: vistas, filtros, picker, drag & drop, persistencia |
| `logic.js` | Lógica pura (testeable): filas de conjuntos, reglas de categorías, reconciliación de prendas |
| `datos/etiquetas.json` | Etiquetas de las prendas por ruta de imagen |
| `datos/conjuntos.json` | Conjuntos guardados (se genera solo) |
| `datos/thumbs/` | Cache de miniaturas (se genera solo) |

## Tests

```bash
npm test
```

Cubren la lógica pura de `logic.js` (estructura de conjuntos, movimientos permitidos, reconciliación con el servidor).

## Deploy en Render

Como **Web Service** (no como Static Site — la app necesita el backend de Python para la API y las miniaturas):

- **Runtime**: Python 3
- **Build command**: `pip install -r requirements.txt`
- **Start command**: `python server.py`

El servidor escucha en el puerto de la variable de entorno `PORT` (la que Render provee) o en 8080 si no está definida.

### Persistencia de los conjuntos vía GitHub

El filesystem de Render es efímero: `datos/conjuntos.json` se pierde en cada deploy o reinicio. Para que los conjuntos persistan, el servidor puede usar un **repo privado de GitHub como almacenamiento**: al arrancar baja `conjuntos.json` del repo, y en cada guardado lo sincroniza vía API (el archivo local queda como cache).

Configuración con dos variables de entorno:

| Variable | Valor |
|---|---|
| `GITHUB_TOKEN` | Un [Personal Access Token](https://github.com/settings/personal-access-tokens) (fine-grained) con acceso **solo** al repo de datos y permiso **Contents: Read and write** |
| `CONJUNTOS_REPO` | `usuario/mi-armario-datos` (el repo privado donde guardar) |

Opcional: `CONJUNTOS_PATH` (por defecto `conjuntos.json`) para cambiar el nombre del archivo dentro del repo.

Sin estas variables, el servidor funciona igual pero solo con el archivo local.
