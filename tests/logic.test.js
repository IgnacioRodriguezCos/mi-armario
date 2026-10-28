const test = require('node:test');
const assert = require('node:assert/strict');

const {
    filasVacias,
    migrarConjuntos,
    intercambiar,
    esCategoria,
    categoriasPermitidasFila,
    movimientoPermitido,
    normalizarRuta,
    reconciliarPrendas
} = require('../logic.js');

test('filasVacias crea 5 filas con un espacio cada una', () => {
    const filas = filasVacias();
    assert.equal(filas.length, 5);
    filas.forEach((fila) => assert.deepEqual(fila, [null]));
});

test('migrarConjuntos convierte la lista plana antigua en filas', () => {
    const conjuntos = [
        {
            id: 1,
            nombre: 'Casual',
            prendas: [{ nombre: 'Jean' }, { nombre: 'Zapatilla' }]
        }
    ];

    const changed = migrarConjuntos(conjuntos);

    assert.equal(changed, true);
    assert.equal(conjuntos[0].filas.length, 5);
    assert.deepEqual(conjuntos[0].filas[0], [{ nombre: 'Jean' }, { nombre: 'Zapatilla' }]);
    assert.deepEqual(conjuntos[0].filas[1], [null]);
    assert.equal('prendas' in conjuntos[0], false);
});

test('migrarConjuntos completa y recorta filas inválidas', () => {
    const conjuntos = [{ id: 2, nombre: 'Formal', filas: [[{ nombre: 'Camisa' }], []] }];

    const changed = migrarConjuntos(conjuntos);

    assert.equal(changed, true);
    assert.equal(conjuntos[0].filas.length, 5);
    assert.deepEqual(conjuntos[0].filas[0], [{ nombre: 'Camisa' }]);
    assert.deepEqual(conjuntos[0].filas[1], [null]);
});

test('migrarConjuntos no marca cambios si ya está normalizado', () => {
    const conjuntos = [
        {
            id: 3,
            nombre: 'Listo',
            filas: Array.from({ length: 5 }, () => [null])
        }
    ];

    assert.equal(migrarConjuntos(conjuntos), false);
});

test('intercambiar mueve prendas entre celdas, incluso vacías', () => {
    const filas = [
        [{ nombre: 'A' }, null],
        [null, { nombre: 'B' }]
    ];

    intercambiar(filas, { fila: 0, col: 0 }, { fila: 1, col: 0 });

    assert.equal(filas[0][0], null);
    assert.deepEqual(filas[1][0], { nombre: 'A' });
    assert.deepEqual(filas[1][1], { nombre: 'B' });

    intercambiar(filas, { fila: 1, col: 0 }, { fila: 1, col: 1 });

    assert.deepEqual(filas[1][0], { nombre: 'B' });
    assert.deepEqual(filas[1][1], { nombre: 'A' });
});

test('esCategoria reconoce la categoría sin distinguir mayúsculas', () => {
    assert.equal(esCategoria({ categoria: 'Pantalones' }, 'pantalones'), true);
    assert.equal(esCategoria({ categoria: 'remeras' }, 'pantalones'), false);
    assert.equal(esCategoria(null, 'pantalones'), false);
});

test('categoriasPermitidasFila define las categorías de cada fila', () => {
    assert.deepEqual(categoriasPermitidasFila(0), ['remeras', 'camisas', 'abrigos']);
    assert.deepEqual(categoriasPermitidasFila(1), ['cinturones']);
    assert.deepEqual(categoriasPermitidasFila(2), ['pantalones']);
    assert.deepEqual(categoriasPermitidasFila(3), ['medias']);
    assert.deepEqual(categoriasPermitidasFila(4), ['zapatillas']);
    assert.deepEqual(categoriasPermitidasFila(5), []);
});

test('movimientoPermitido respeta las categorías de todas las filas', () => {
    const remera = { categoria: 'remeras' };
    const camisa = { categoria: 'camisas' };
    const abrigo = { categoria: 'abrigos' };
    const cinturon = { categoria: 'cinturones' };
    const pantalon = { categoria: 'pantalones' };
    const media = { categoria: 'medias' };
    const zapatilla = { categoria: 'zapatillas' };
    const filas = Array.from({ length: 5 }, () => [null, null, null, null]);
    filas[0][0] = remera;
    filas[0][1] = camisa;
    filas[0][2] = abrigo;
    filas[1][0] = cinturon;
    filas[2][0] = pantalon;
    filas[3][0] = media;
    filas[4][0] = zapatilla;

    assert.equal(movimientoPermitido(filas, { fila: 0, col: 0 }, { fila: 0, col: 3 }), true);
    assert.equal(movimientoPermitido(filas, { fila: 0, col: 1 }, { fila: 0, col: 3 }), true);
    assert.equal(movimientoPermitido(filas, { fila: 0, col: 2 }, { fila: 0, col: 3 }), true);
    assert.equal(movimientoPermitido(filas, { fila: 1, col: 0 }, { fila: 0, col: 3 }), false);
    assert.equal(movimientoPermitido(filas, { fila: 1, col: 0 }, { fila: 1, col: 1 }), true);
    assert.equal(movimientoPermitido(filas, { fila: 0, col: 0 }, { fila: 1, col: 1 }), false);
    assert.equal(movimientoPermitido(filas, { fila: 2, col: 0 }, { fila: 2, col: 1 }), true);
    assert.equal(movimientoPermitido(filas, { fila: 0, col: 0 }, { fila: 2, col: 1 }), false);
    assert.equal(movimientoPermitido(filas, { fila: 2, col: 0 }, { fila: 0, col: 0 }), false);
    assert.equal(movimientoPermitido(filas, { fila: 2, col: 0 }, { fila: 1, col: 1 }), false);
    assert.equal(movimientoPermitido(filas, { fila: 3, col: 0 }, { fila: 4, col: 1 }), false);
    assert.equal(movimientoPermitido(filas, { fila: 4, col: 0 }, { fila: 3, col: 1 }), false);
    assert.equal(movimientoPermitido(filas, { fila: 3, col: 0 }, { fila: 3, col: 1 }), true);
    assert.equal(movimientoPermitido(filas, { fila: 4, col: 0 }, { fila: 4, col: 1 }), true);
});

test('normalizarRuta codifica espacios y tildes sin recodificar rutas ya codificadas', () => {
    assert.equal(
        normalizarRuta('imagenes/pantalones/Marrón azul.png'),
        'imagenes/pantalones/Marr%C3%B3n%20azul.png'
    );
    assert.equal(
        normalizarRuta('imagenes/Remeras/Kevingston%20Chomba.png'),
        'imagenes/Remeras/Kevingston%20Chomba.png'
    );
});

test('reconciliarPrendas elimina renombradas y sin foto, y conserva las manuales', () => {
    const manual = {
        id: 10,
        nombre: 'Manual',
        foto: 'data:image/png;base64,abc'
    };
    const vigente = {
        id: 2,
        nombre: 'Vigente',
        foto: 'imagenes/pantalones/Vigente.png',
        categoria: 'pantalones'
    };
    const renombrada = {
        id: 3,
        nombre: 'Nombre Viejo',
        foto: 'imagenes/pantalones/Nombre Viejo.png',
        categoria: 'pantalones'
    };
    const sinFoto = { id: 4, nombre: 'Sin Foto', foto: null };

    const servidor = [
        { nombre: 'Vigente', foto: 'imagenes/pantalones/Vigente.png', categoria: 'pantalones' },
        { nombre: 'Nueva', foto: 'imagenes/pantalones/Nueva.png', categoria: 'pantalones' }
    ];

    const resultado = reconciliarPrendas([manual, vigente, renombrada, sinFoto], servidor, 1000);

    assert.deepEqual(
        resultado.map((p) => p.nombre),
        ['Manual', 'Vigente', 'Nueva']
    );
    assert.equal(resultado[1].id, 2);
    assert.equal(resultado[2].id, 2001);
});

test('reconciliarPrendas conserva el id si la ruta solo cambia de codificación', () => {
    const anterior = {
        id: 7,
        nombre: 'Marrón',
        foto: 'imagenes/pantalones/Marr%C3%B3n%20azul.png',
        categoria: 'pantalones'
    };
    const servidor = [
        {
            nombre: 'Marrón',
            foto: 'imagenes/pantalones/Marrón azul.png',
            categoria: 'pantalones'
        }
    ];

    const resultado = reconciliarPrendas([anterior], servidor, 1000);

    assert.equal(resultado.length, 1);
    assert.equal(resultado[0].id, 7);
    assert.equal(resultado[0].foto, 'imagenes/pantalones/Marr%C3%B3n%20azul.png');
});

test('reconciliarPrendas copia los metadatos de etiquetas.json', () => {
    const servidor = [
        {
            nombre: 'Nike Cortez',
            foto: 'imagenes/zapatillas/Nike Cortez.png',
            thumb: 'thumbs/zapatillas/Nike Cortez.png',
            categoria: 'zapatillas',
            hash: 'abc123',
            marca: 'Nike',
            tipo: 'zapatilla',
            color: ['blanco', 'negro'],
            estilo: 'casual'
        }
    ];

    const [prenda] = reconciliarPrendas([], servidor, 1000);

    assert.deepEqual(prenda, {
        id: 2000,
        nombre: 'Nike Cortez',
        foto: 'imagenes/zapatillas/Nike%20Cortez.png',
        thumb: 'thumbs/zapatillas/Nike%20Cortez.png',
        categoria: 'zapatillas',
        hash: 'abc123',
        marca: 'Nike',
        tipo: 'zapatilla',
        color: ['blanco', 'negro'],
        estilo: 'casual'
    });
});
