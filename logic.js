(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        root.WardrobeLogic = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const NUM_FILAS = 5;
    const CATEGORIAS_POR_FILA = {
        0: ['remeras', 'camisas', 'abrigos', 'chomba'],
        1: ['cinturones'],
        2: ['pantalones'],
        3: ['medias'],
        4: ['zapatillas', 'zapatos']
    };

    function filasVacias() {
        return Array.from({ length: NUM_FILAS }, () => [null]);
    }

    function normalizarFila(fila) {
        return Array.isArray(fila) && fila.length ? fila : [null];
    }

    function migrarConjuntos(lista) {
        let changed = false;

        lista.forEach((conjunto) => {
            if (!Array.isArray(conjunto.filas)) {
                const plano = Array.isArray(conjunto.prendas) ? [...conjunto.prendas] : [];
                conjunto.filas = filasVacias();
                if (plano.length) conjunto.filas[0] = plano;
                delete conjunto.prendas;
                changed = true;
            }

            if (conjunto.filas.length !== NUM_FILAS) {
                while (conjunto.filas.length < NUM_FILAS) conjunto.filas.push([null]);
                conjunto.filas = conjunto.filas.slice(0, NUM_FILAS);
                changed = true;
            }

            const normalizadas = conjunto.filas.map(normalizarFila);
            if (normalizadas.some((fila, i) => fila !== conjunto.filas[i])) {
                changed = true;
            }
            conjunto.filas = normalizadas;
        });

        return changed;
    }

    function intercambiar(filas, origen, destino) {
        const temporal = filas[origen.fila][origen.col];
        filas[origen.fila][origen.col] = filas[destino.fila][destino.col];
        filas[destino.fila][destino.col] = temporal;
    }

    function esCategoria(prenda, categoria) {
        return (
            String((prenda && prenda.categoria) || '').toLowerCase() ===
            String(categoria || '').toLowerCase()
        );
    }

    function categoriasPermitidasFila(fila) {
        return CATEGORIAS_POR_FILA[fila] || [];
    }

    function movimientoPermitido(filas, origen, destino) {
        const permitidasOrigen = categoriasPermitidasFila(origen.fila);
        const permitidasDestino = categoriasPermitidasFila(destino.fila);
        const prendaOrigen = filas[origen.fila][origen.col];
        const prendaDestino = filas[destino.fila][destino.col];

        if (
            permitidasDestino.length &&
            prendaOrigen &&
            !permitidasDestino.some((categoria) => esCategoria(prendaOrigen, categoria))
        ) {
            return false;
        }
        if (
            permitidasOrigen.length &&
            prendaDestino &&
            !permitidasOrigen.some((categoria) => esCategoria(prendaDestino, categoria))
        ) {
            return false;
        }
        return true;
    }

    function normalizarRuta(ruta) {
        if (typeof ruta !== 'string') return '';

        return ruta
            .split('/')
            .map((segmento) => {
                try {
                    return encodeURIComponent(decodeURIComponent(segmento));
                } catch {
                    return encodeURIComponent(segmento);
                }
            })
            .join('/');
    }

    function reconciliarPrendas(prendas, prendasServidor, ahora) {
        const manuales = prendas.filter(
            (p) => typeof p.foto === 'string' && p.foto.startsWith('data:image/')
        );

        const anterioresPorRuta = new Map();
        prendas.forEach((p) => {
            if (typeof p.foto === 'string' && !p.foto.startsWith('data:')) {
                anterioresPorRuta.set(normalizarRuta(p.foto), p);
            }
        });

        const desdeCarpetas = prendasServidor.map((item, index) => {
            const foto = normalizarRuta(item.foto);
            const anterior = anterioresPorRuta.get(foto);
            return {
                id: anterior ? anterior.id : ahora + index + 1000,
                nombre: item.nombre,
                foto,
                thumb: item.thumb ? normalizarRuta(item.thumb) : '',
                categoria: item.categoria,
                hash: item.hash || '',
                marca: item.marca || '',
                tipo: item.tipo || '',
                color: Array.isArray(item.color) ? [...item.color] : [],
                estilo: item.estilo || ''
            };
        });

        return [...manuales, ...desdeCarpetas];
    }

    return {
        NUM_FILAS,
        filasVacias,
        migrarConjuntos,
        intercambiar,
        esCategoria,
        categoriasPermitidasFila,
        movimientoPermitido,
        normalizarRuta,
        reconciliarPrendas
    };
});
