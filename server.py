import hashlib
import http.server
import json
import os
import threading
import time
import urllib.parse

PORT = int(os.environ.get('PORT', 8080))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
METADATOS = os.path.join(DIRECTORY, 'datos', 'etiquetas.json')
CONJUNTOS = os.path.join(DIRECTORY, 'datos', 'conjuntos.json')
THUMBS = os.path.join(DIRECTORY, 'datos', 'thumbs')
LADO_THUMB = 600

ARCHIVOS_CODIGO = ['index.html', 'style.css', 'logic.js', 'app.js', 'server.py']
EXTENSIONES_IMAGEN = ('.png', '.jpg', '.jpeg', '.webp', '.gif')

_cache_hashes = {}
_lock_hashes = threading.Lock()


def version_codigo():
    version = 0.0
    for nombre in ARCHIVOS_CODIGO:
        ruta = os.path.join(DIRECTORY, nombre)
        if os.path.exists(ruta):
            version = max(version, os.path.getmtime(ruta))
    return version


def version_imagenes():
    img_dir = os.path.join(DIRECTORY, 'imagenes')
    version = 0.0
    if os.path.isdir(img_dir):
        for raiz, _, archivos in os.walk(img_dir):
            version = max(version, os.path.getmtime(raiz))
            for archivo in archivos:
                if archivo.lower().endswith(EXTENSIONES_IMAGEN):
                    version = max(version, os.path.getmtime(os.path.join(raiz, archivo)))
    return version


def version_metadatos():
    try:
        return os.path.getmtime(METADATOS)
    except OSError:
        return 0.0


def version_conjuntos():
    try:
        return os.path.getmtime(CONJUNTOS)
    except OSError:
        return 0.0


def cargar_conjuntos():
    try:
        with open(CONJUNTOS, encoding='utf-8-sig') as archivo:
            datos = json.load(archivo)
    except (OSError, json.JSONDecodeError):
        return []
    return datos if isinstance(datos, list) else []


def guardar_conjuntos(lista):
    with open(CONJUNTOS, 'w', encoding='utf-8', newline='\n') as archivo:
        json.dump(lista, archivo, ensure_ascii=False, indent=4)
        archivo.write('\n')


def ruta_thumb(rel):
    base, _ = os.path.splitext(rel)
    return os.path.join(THUMBS, base + '.jpg')


def generar_thumb(origen, destino):
    from PIL import Image

    with Image.open(origen) as imagen:
        if imagen.mode in ('RGBA', 'LA', 'P'):
            imagen = imagen.convert('RGBA')
            fondo = Image.new('RGB', imagen.size, (255, 255, 255))
            fondo.paste(imagen, mask=imagen.split()[-1])
            imagen = fondo
        elif imagen.mode != 'RGB':
            imagen = imagen.convert('RGB')
        imagen.thumbnail((LADO_THUMB, LADO_THUMB))
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        imagen.save(destino, 'JPEG', quality=85, optimize=True)


def pregenerar_thumbs():
    img_dir = os.path.join(DIRECTORY, 'imagenes')
    for raiz, _, archivos in os.walk(img_dir):
        for archivo in archivos:
            if not archivo.lower().endswith(EXTENSIONES_IMAGEN):
                continue
            ruta_origen = os.path.join(raiz, archivo)
            rel = os.path.relpath(ruta_origen, img_dir).replace('\\', '/')
            destino = ruta_thumb(rel)
            try:
                if (
                    not os.path.exists(destino)
                    or os.path.getmtime(destino) < os.path.getmtime(ruta_origen)
                ):
                    generar_thumb(ruta_origen, destino)
            except Exception:
                pass


def cargar_metadatos():
    try:
        with open(METADATOS, encoding='utf-8-sig') as archivo:
            datos = json.load(archivo)
    except (OSError, json.JSONDecodeError):
        return {}

    prendas = datos.get('prendas') if isinstance(datos, dict) else None
    if not isinstance(prendas, dict):
        return {}
    return {str(ruta).replace('\\', '/'): meta for ruta, meta in prendas.items()}


def hash_archivo(ruta):
    try:
        estado = os.stat(ruta)
    except OSError:
        return ''

    clave = (estado.st_mtime_ns, estado.st_size)
    with _lock_hashes:
        cache = _cache_hashes.get(ruta)
        if cache and cache[0] == clave:
            return cache[1]

    digest = hashlib.sha256()
    try:
        with open(ruta, 'rb') as archivo:
            for bloque in iter(lambda: archivo.read(1024 * 1024), b''):
                digest.update(bloque)
    except OSError:
        return ''

    valor = digest.hexdigest()
    with _lock_hashes:
        _cache_hashes[ruta] = (clave, valor)
    return valor


def normalizar_metadatos(meta):
    if not isinstance(meta, dict):
        meta = {}

    color = meta.get('color', [])
    if isinstance(color, str):
        color = [color]
    elif not isinstance(color, list):
        color = []

    colores = []
    for valor in color:
        texto = str(valor).strip()
        if texto and texto not in colores:
            colores.append(texto)

    estilo = meta.get('estilo', '')
    if isinstance(estilo, list):
        estilo = ', '.join(str(valor).strip() for valor in estilo if str(valor).strip())

    return {
        'marca': str(meta.get('marca', '') or '').strip(),
        'tipo': str(meta.get('tipo', '') or '').strip(),
        'color': colores,
        'estilo': str(estilo or '').strip(),
    }


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        ruta = urllib.parse.urlparse(self.path).path
        if ruta == '/' or ruta.endswith(('.html', '.js', '.css')):
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path.startswith('/thumbs/'):
            self.servir_thumb(parsed.path)
        elif parsed.path == '/api/version':
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(f"{version_codigo():.6f}".encode('utf-8'))
        elif parsed.path == '/api/prendas':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            img_dir = os.path.join(DIRECTORY, 'imagenes')
            metadatos = cargar_metadatos()
            metadatos_por_hash = {}
            for meta in metadatos.values():
                if isinstance(meta, dict) and meta.get('hash'):
                    metadatos_por_hash[str(meta['hash']).lower()] = meta

            items = []
            if os.path.exists(img_dir):
                for cat in sorted(os.listdir(img_dir)):
                    cat_dir = os.path.join(img_dir, cat)
                    if os.path.isdir(cat_dir):
                        for f in sorted(os.listdir(cat_dir)):
                            if f.lower().endswith(EXTENSIONES_IMAGEN):
                                name = os.path.splitext(f)[0]
                                foto = f'imagenes/{cat}/{f}'
                                meta = metadatos.get(foto)
                                hash_guardado = (
                                    str(meta.get('hash') or '').lower()
                                    if isinstance(meta, dict)
                                    else ''
                                )
                                if hash_guardado:
                                    # El hash ya está en etiquetas.json: evita
                                    # recalcular el SHA-256 del archivo
                                    hash_imagen = hash_guardado
                                else:
                                    hash_imagen = hash_archivo(
                                        os.path.join(cat_dir, f)
                                    )
                                    if meta is None:
                                        meta = metadatos_por_hash.get(hash_imagen) or {}
                                item = {
                                    'nombre': name,
                                    'categoria': cat,
                                    'foto': foto,
                                    'thumb': f'thumbs/{cat}/{f}',
                                    'hash': hash_imagen,
                                }
                                item.update(normalizar_metadatos(meta))
                                items.append(item)
            self.wfile.write(json.dumps(items, ensure_ascii=False).encode('utf-8'))
        elif parsed.path == '/api/conjuntos':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(
                json.dumps(cargar_conjuntos(), ensure_ascii=False).encode('utf-8')
            )
        elif parsed.path == '/api/eventos':
            self.transmitir_eventos()
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path != '/api/conjuntos':
            self.send_response(404)
            self.end_headers()
            return

        try:
            length = int(self.headers.get('Content-Length') or 0)
            lista = json.loads(self.rfile.read(length).decode('utf-8'))
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            self.send_response(400)
            self.end_headers()
            return

        if not isinstance(lista, list):
            self.send_response(400)
            self.end_headers()
            return

        guardar_conjuntos(lista)
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(b'{"ok": true}')

    def servir_thumb(self, ruta_url):
        rel = urllib.parse.unquote(ruta_url[len('/thumbs/'):]).replace('\\', '/')
        if not rel or '..' in rel.split('/'):
            self.send_response(400)
            self.end_headers()
            return

        origen = os.path.join(DIRECTORY, 'imagenes', *rel.split('/'))
        if not os.path.isfile(origen):
            self.send_response(404)
            self.end_headers()
            return

        destino = ruta_thumb(rel)
        try:
            if (
                not os.path.exists(destino)
                or os.path.getmtime(destino) < os.path.getmtime(origen)
            ):
                generar_thumb(origen, destino)
        except Exception:
            self.send_response(500)
            self.end_headers()
            return

        try:
            with open(destino, 'rb') as archivo:
                contenido = archivo.read()
        except OSError:
            self.send_response(500)
            self.end_headers()
            return

        self.send_response(200)
        self.send_header('Content-Type', 'image/jpeg')
        self.send_header('Cache-Control', 'max-age=86400')
        self.end_headers()
        self.wfile.write(contenido)

    def transmitir_eventos(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream; charset=utf-8')
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()

        codigo = version_codigo()
        imagenes = version_imagenes()
        metadatos = version_metadatos()
        conjuntos = version_conjuntos()
        try:
            self.wfile.write(b"retry: 2000\n\n")
            self.enviar_evento(codigo, imagenes, metadatos, conjuntos)
            while True:
                time.sleep(1)
                nuevo_codigo = version_codigo()
                nuevas_imagenes = version_imagenes()
                nuevos_metadatos = version_metadatos()
                nuevos_conjuntos = version_conjuntos()
                if (
                    nuevo_codigo != codigo
                    or nuevas_imagenes != imagenes
                    or nuevos_metadatos != metadatos
                    or nuevos_conjuntos != conjuntos
                ):
                    codigo = nuevo_codigo
                    imagenes = nuevas_imagenes
                    metadatos = nuevos_metadatos
                    conjuntos = nuevos_conjuntos
                    self.enviar_evento(codigo, imagenes, metadatos, conjuntos)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    def enviar_evento(self, codigo, imagenes, metadatos, conjuntos):
        datos = json.dumps(
            {
                'codigo': codigo,
                'imagenes': imagenes,
                'metadatos': metadatos,
                'conjuntos': conjuntos
            }
        )
        self.wfile.write(f"data: {datos}\n\n".encode('utf-8'))
        self.wfile.flush()


class Servidor(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == '__main__':
    threading.Thread(target=pregenerar_thumbs, daemon=True).start()
    with Servidor(('', PORT), Handler) as httpd:
        print(f"Servidor iniciado en http://localhost:{PORT}")
        httpd.serve_forever()
