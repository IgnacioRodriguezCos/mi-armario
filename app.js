// Almacenamiento
let prendas = JSON.parse(localStorage.getItem('prendas') || '[]');
let conjuntos = JSON.parse(localStorage.getItem('conjuntos') || '[]');

const {
    filasVacias,
    migrarConjuntos,
    intercambiar,
    esCategoria,
    categoriasPermitidasFila,
    movimientoPermitido,
    reconciliarPrendas
} = window.WardrobeLogic;

const NOMBRES_CATEGORIA = {
    remeras: 'Remera',
    camisas: 'Camisa',
    abrigos: 'Abrigo',
    cinturones: 'Cinturón',
    pantalones: 'Pantalón',
    medias: 'Medias',
    zapatillas: 'Zapatilla',
    zapatos: 'Zapato'
};

function enumerarCategorias(categorias) {
    if (categorias.length <= 1) return categorias[0] || '';
    return `${categorias.slice(0, -1).join(', ')} y ${categorias[categorias.length - 1]}`;
}

// Migrar conjuntos antiguos (lista plana) a la estructura de filas
if (migrarConjuntos(conjuntos)) {
    localStorage.setItem('conjuntos', JSON.stringify(conjuntos));
}

// Sincronizar imágenes desde las subcarpetas del servidor
async function sincronizarPrendasDesdeServidor() {
    try {
        const res = await fetch('/api/prendas');
        if (!res.ok) return;

        const prendasServidor = await res.json();

        // Reconstruir desde el servidor: elimina renombradas/borradas y agrega nuevas
        prendas = reconciliarPrendas(prendas, prendasServidor, Date.now());
        localStorage.setItem('prendas', JSON.stringify(prendas));
        actualizarFiltrosArmario();
        renderPrendas();
        actualizarFiltros();
        if (modalPicker.classList.contains('active')) renderPickerPrendas();
    } catch (e) {
        console.error('Error al sincronizar prendas:', e);
    }
}

// Conjuntos: persistencia en el servidor (datos/conjuntos.json)
async function guardarConjuntos() {
    // localStorage queda como cache para que la pagina cargue al instante
    localStorage.setItem('conjuntos', JSON.stringify(conjuntos));

    try {
        const res = await fetch('/api/conjuntos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(conjuntos)
        });
        if (!res.ok) throw new Error(`Estado ${res.status}`);
    } catch (e) {
        console.error('Error al guardar conjuntos:', e);
        mostrarToast('No se pudo guardar en el servidor');
    }
}

async function cargarConjuntosDesdeServidor() {
    try {
        const res = await fetch('/api/conjuntos');
        if (!res.ok) return;

        const delServidor = await res.json();
        if (!Array.isArray(delServidor)) return;

        // Migración inicial: el servidor está vacío pero hay conjuntos locales
        if (delServidor.length === 0 && conjuntos.length > 0) {
            await guardarConjuntos();
            return;
        }

        conjuntos = delServidor;
        localStorage.setItem('conjuntos', JSON.stringify(conjuntos));
        renderConjuntos();
    } catch (e) {
        console.error('Error al cargar conjuntos:', e);
    }
}

// Elementos DOM
const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');
const btnAgregarPrenda = document.getElementById('btn-agregar-prenda');
const modalPrenda = document.getElementById('modal-prenda');
const closeModalPrenda = document.getElementById('close-modal-prenda');
const formPrenda = document.getElementById('form-prenda');
const fotoPrenda = document.getElementById('foto-prenda');
const previewContainer = document.getElementById('preview-container');
const previewImg = document.getElementById('preview-img');
const prendasGrid = document.getElementById('prendas-grid');
const selectFiltroCategoria = document.getElementById('filtro-categoria');
const selectFiltroMarca = document.getElementById('filtro-marca');
const selectFiltroTipo = document.getElementById('filtro-tipo');
const selectFiltroColor = document.getElementById('filtro-color');
const selectFiltroEstilo = document.getElementById('filtro-estilo');
const btnLimpiarFiltros = document.getElementById('btn-limpiar-filtros');
const formConjunto = document.getElementById('form-conjunto');
const editorFilas = document.getElementById('editor-filas');
const conjuntosGrid = document.getElementById('conjuntos-grid');
const btnCrearConjunto = document.getElementById('btn-crear-conjunto');
const btnVolverConjuntos = document.getElementById('btn-volver-conjuntos');
const modalDetalle = document.getElementById('modal-detalle-conjunto');
const closeModalDetalle = document.getElementById('close-modal-detalle');
const detalleNombre = document.getElementById('detalle-conjunto-nombre');
const detalleFilas = document.getElementById('detalle-filas');
const btnGuardarDetalle = document.getElementById('btn-guardar-detalle');
const modalPicker = document.getElementById('modal-picker');
const closeModalPicker = document.getElementById('close-modal-picker');
const pickerPrendas = document.getElementById('picker-prendas');
const pickerTitulo = document.getElementById('picker-titulo');
const pickerAyuda = document.getElementById('picker-ayuda');
const filtrosContainer = document.getElementById('filtros-container');
const modalImagen = document.getElementById('modal-imagen');
const closeModalImagen = document.getElementById('close-modal-imagen');
const imagenGrande = document.getElementById('imagen-grande');
const imagenNombre = document.getElementById('imagen-nombre');

let fotoDataUrl = null;
let filtroActual = 'todos';
const filtrosArmario = { categoria: '', marca: '', tipo: '', color: '', estilo: '' };
let borradorFilas = filasVacias();
let pickerTarget = null;
let conjuntoDetalleId = null;
let filasDetalle = null;
let dragOrigen = null;
let dragConjuntoOrigen = null;

// Navegación
function mostrarVista(nombre) {
    views.forEach((v) => v.classList.remove('active'));
    navBtns.forEach((b) => b.classList.remove('active'));

    const view = document.getElementById(`view-${nombre}`);
    if (view) view.classList.add('active');

    const navEquivalente = nombre === 'crear-conjunto' ? 'conjuntos' : nombre;
    const navBtn = document.querySelector(`.nav-btn[data-view="${navEquivalente}"]`);
    if (navBtn) navBtn.classList.add('active');
}

navBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
        mostrarVista(btn.dataset.view);

        if (btn.dataset.view === 'conjuntos') {
            renderConjuntos();
        } else if (btn.dataset.view === 'armario') {
            renderPrendas();
        }
    });
});

btnCrearConjunto.addEventListener('click', () => {
    mostrarVista('crear-conjunto');
    renderEditorFilas();
});

btnVolverConjuntos.addEventListener('click', () => {
    mostrarVista('conjuntos');
    renderConjuntos();
});

function escaparHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function opcionesUnicas(valores) {
    const textos = valores.map((valor) => (typeof valor === 'string' ? valor.trim() : ''));
    return [...new Set(textos.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
}

function etiquetaCategoria(categoria) {
    return categoria === 'sin-categoria'
        ? 'Sin categoría'
        : categoria.charAt(0).toUpperCase() + categoria.slice(1);
}

function crearOpcion(texto, valor) {
    const opcion = document.createElement('option');
    opcion.value = valor;
    opcion.textContent = texto;
    return opcion;
}

function llenarSelectFiltro(select, valores, etiquetaTodos, valorActual, etiqueta) {
    if (!select) return '';

    select.innerHTML = '';
    select.appendChild(crearOpcion(etiquetaTodos, ''));
    valores.forEach((valor) => {
        select.appendChild(crearOpcion(etiqueta ? etiqueta(valor) : valor, valor));
    });

    const seleccionado = valores.includes(valorActual) ? valorActual : '';
    select.value = seleccionado;
    return seleccionado;
}

function actualizarFiltrosArmario() {
    const categorias = opcionesUnicas(prendas.map((p) => p.categoria || 'sin-categoria'));
    const marcas = opcionesUnicas(prendas.map((p) => p.marca));
    const tipos = opcionesUnicas(prendas.map((p) => p.tipo));
    const colores = opcionesUnicas(prendas.flatMap((p) => (Array.isArray(p.color) ? p.color : [])));
    const estilos = opcionesUnicas(prendas.map((p) => p.estilo));
    const valoresEstilo = prendas.some((p) => !p.estilo) ? [...estilos, '__sin__'] : estilos;

    filtrosArmario.categoria = llenarSelectFiltro(
        selectFiltroCategoria,
        categorias,
        'Todas las categorías',
        filtrosArmario.categoria,
        etiquetaCategoria
    );
    filtrosArmario.marca = llenarSelectFiltro(
        selectFiltroMarca,
        marcas,
        'Todas las marcas',
        filtrosArmario.marca
    );
    filtrosArmario.tipo = llenarSelectFiltro(
        selectFiltroTipo,
        tipos,
        'Todos los tipos',
        filtrosArmario.tipo
    );
    filtrosArmario.color = llenarSelectFiltro(
        selectFiltroColor,
        colores,
        'Todos los colores',
        filtrosArmario.color
    );
    filtrosArmario.estilo = llenarSelectFiltro(
        selectFiltroEstilo,
        valoresEstilo,
        'Todos los estilos',
        filtrosArmario.estilo,
        (valor) => (valor === '__sin__' ? 'Sin estilo' : valor)
    );

    btnLimpiarFiltros.disabled = !Object.values(filtrosArmario).some(Boolean);
}

if (btnLimpiarFiltros) {
    btnLimpiarFiltros.addEventListener('click', () => {
        Object.keys(filtrosArmario).forEach((campo) => {
            filtrosArmario[campo] = '';
        });
        actualizarFiltrosArmario();
        renderPrendas();
    });
}

function obtenerPrendasFiltradas() {
    return prendas.filter((p) => {
        if (
            filtrosArmario.categoria &&
            (p.categoria || 'sin-categoria') !== filtrosArmario.categoria
        ) {
            return false;
        }
        if (filtrosArmario.marca && (p.marca || '') !== filtrosArmario.marca) return false;
        if (filtrosArmario.tipo && (p.tipo || '') !== filtrosArmario.tipo) return false;
        if (
            filtrosArmario.color &&
            !(Array.isArray(p.color) ? p.color : []).includes(filtrosArmario.color)
        ) {
            return false;
        }
        if (filtrosArmario.estilo === '__sin__' && p.estilo) return false;
        if (
            filtrosArmario.estilo &&
            filtrosArmario.estilo !== '__sin__' &&
            (p.estilo || '') !== filtrosArmario.estilo
        ) {
            return false;
        }
        return true;
    });
}

[
    [selectFiltroCategoria, 'categoria'],
    [selectFiltroMarca, 'marca'],
    [selectFiltroTipo, 'tipo'],
    [selectFiltroColor, 'color'],
    [selectFiltroEstilo, 'estilo']
].forEach(([select, campo]) => {
    if (!select) return;
    select.addEventListener('change', () => {
        filtrosArmario[campo] = select.value;
        btnLimpiarFiltros.disabled = !Object.values(filtrosArmario).some(Boolean);
        renderPrendas();
    });
});

// Actualizar filtros del selector de prendas
function actualizarFiltros() {
    if (!filtrosContainer) return;

    const permitidas =
        pickerTarget && pickerTarget.categoriasPermitidas.length
            ? pickerTarget.categoriasPermitidas
            : null;
    const categorias = permitidas
        ? permitidas.length > 1
            ? ['todos', ...permitidas]
            : [...permitidas]
        : ['todos', ...new Set(prendas.filter((p) => p.categoria).map((p) => p.categoria))];
    if (!categorias.includes(filtroActual)) {
        filtroActual = categorias.includes('todos') ? 'todos' : categorias[0];
    }
    filtrosContainer.innerHTML = '';

    categorias.forEach((cat) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filtro-btn' + (cat === filtroActual ? ' active' : '');
        btn.dataset.categoria = cat;
        btn.textContent = cat === 'todos' ? 'Todos' : cat.charAt(0).toUpperCase() + cat.slice(1);
        btn.addEventListener('click', () => {
            filtrosContainer
                .querySelectorAll('.filtro-btn')
                .forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            filtroActual = btn.dataset.categoria;
            renderPickerPrendas();
        });
        filtrosContainer.appendChild(btn);
    });
}

// Modal Agregar Prenda
btnAgregarPrenda.addEventListener('click', () => {
    modalPrenda.classList.add('active');
});

closeModalPrenda.addEventListener('click', () => {
    modalPrenda.classList.remove('active');
    formPrenda.reset();
    previewContainer.style.display = 'none';
    fotoDataUrl = null;
});

modalPrenda.addEventListener('click', (e) => {
    if (e.target === modalPrenda) {
        modalPrenda.classList.remove('active');
        formPrenda.reset();
        previewContainer.style.display = 'none';
        fotoDataUrl = null;
    }
});

// Preview de foto
fotoPrenda.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            fotoDataUrl = ev.target.result;
            previewImg.src = fotoDataUrl;
            previewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});

// Guardar nueva prenda
formPrenda.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = document.getElementById('nombre-prenda').value.trim();

    if (prendas.find((p) => p.nombre.toLowerCase() === nombre.toLowerCase())) {
        mostrarToast('Ya existe una prenda con ese nombre');
        return;
    }

    prendas.push({ id: Date.now(), nombre, foto: fotoDataUrl });
    localStorage.setItem('prendas', JSON.stringify(prendas));

    modalPrenda.classList.remove('active');
    formPrenda.reset();
    previewContainer.style.display = 'none';
    fotoDataUrl = null;

    actualizarFiltrosArmario();
    renderPrendas();
    actualizarFiltros();
    mostrarToast('Prenda agregada');
});

// Render prendas en el armario, agrupadas por categoría
function renderPrendas() {
    prendasGrid.innerHTML = '';
    if (prendas.length === 0) {
        prendasGrid.innerHTML =
            '<p style="color: #666;">No hay prendas aún. Agrega una para empezar.</p>';
        return;
    }

    const visibles = obtenerPrendasFiltradas();
    if (visibles.length === 0) {
        prendasGrid.innerHTML =
            '<p style="color: #666;">No hay prendas que coincidan con los filtros.</p>';
        return;
    }

    const grupos = {};
    visibles.forEach((prenda) => {
        const cat = prenda.categoria || 'sin-categoria';
        if (!grupos[cat]) grupos[cat] = [];
        grupos[cat].push(prenda);
    });

    const categorias = Object.keys(grupos).sort((a, b) => {
        if (a === 'sin-categoria') return 1;
        if (b === 'sin-categoria') return -1;
        return a.localeCompare(b);
    });

    categorias.forEach((cat) => {
        const bloque = document.createElement('div');
        bloque.className = 'categoria-bloque';

        const titulo = document.createElement('h3');
        titulo.className = 'categoria-titulo';
        const nombreCat =
            cat === 'sin-categoria' ? 'Sin categoría' : cat.charAt(0).toUpperCase() + cat.slice(1);
        titulo.innerHTML = `${nombreCat} <span class="categoria-count">${grupos[cat].length}</span>`;
        bloque.appendChild(titulo);

        const grid = document.createElement('div');
        grid.className = 'grid';

        grupos[cat].forEach((prenda) => {
            const card = document.createElement('div');
            card.className = 'card';
            const nombre = escaparHtml(prenda.nombre);
            const marca = escaparHtml(prenda.marca || '');
            const tipo = escaparHtml(prenda.tipo || '');
            const meta = [marca, tipo].filter(Boolean).join(' · ');
            const colores = (Array.isArray(prenda.color) ? prenda.color : [])
                .map((color) => `<span class="card-color">${escaparHtml(color)}</span>`)
                .join('');
            const estilo = prenda.estilo
                ? `<div class="card-estilo">${escaparHtml(prenda.estilo)}</div>`
                : '';

            card.innerHTML = `
                <img src="${escaparHtml(prenda.thumb || prenda.foto)}" alt="${nombre}" class="card-img" loading="lazy" decoding="async">
                <div class="card-body">
                    <div class="card-title">${nombre}</div>
                    ${meta ? `<div class="card-meta">${meta}</div>` : ''}
                    ${colores ? `<div class="card-colores">${colores}</div>` : ''}
                    ${estilo}
                    <button class="btn-delete" onclick="eliminarPrenda(${prenda.id})">Eliminar</button>
                </div>
            `;
            card.querySelector('.card-img').addEventListener('click', () => abrirImagen(prenda));
            grid.appendChild(card);
        });

        bloque.appendChild(grid);
        prendasGrid.appendChild(bloque);
    });
}

// Ver imagen en grande
function abrirImagen(prenda) {
    imagenGrande.src = prenda.foto;
    imagenGrande.alt = prenda.nombre;
    imagenNombre.textContent = prenda.nombre;
    modalImagen.classList.add('active');
}

function cerrarImagen() {
    modalImagen.classList.remove('active');
    imagenGrande.src = '';
}

closeModalImagen.addEventListener('click', cerrarImagen);
modalImagen.addEventListener('click', (e) => {
    if (e.target === modalImagen) cerrarImagen();
});

// Eliminar prenda
window.eliminarPrenda = function (id) {
    mostrarConfirmacion('¿Eliminar esta prenda?', () => {
        prendas = prendas.filter((p) => p.id !== id);
        localStorage.setItem('prendas', JSON.stringify(prendas));
        actualizarFiltrosArmario();
        renderPrendas();
        actualizarFiltros();
        mostrarToast('Prenda eliminada');
    });
};

// Eliminar conjunto
window.eliminarConjunto = function (id) {
    mostrarConfirmacion('¿Eliminar este conjunto?', () => {
        conjuntos = conjuntos.filter((c) => c.id !== id);
        guardarConjuntos();
        renderConjuntos();
        mostrarToast('Conjunto eliminado');
    });
};

// Duplicar conjunto
window.duplicarConjunto = function (id) {
    const indice = conjuntos.findIndex((c) => c.id === id);
    if (indice === -1) return;

    const original = conjuntos[indice];
    let nombre = `${original.nombre}-copia`;
    let contador = 2;
    while (conjuntos.some((c) => c.nombre.toLowerCase() === nombre.toLowerCase())) {
        nombre = `${original.nombre}-copia ${contador++}`;
    }

    const copia = {
        id: Date.now(),
        nombre,
        filas: original.filas.map((fila) => fila.map((prenda) => (prenda ? { ...prenda } : null)))
    };

    conjuntos.splice(indice + 1, 0, copia);
    guardarConjuntos();
    renderConjuntos();
    mostrarToast('Conjunto duplicado');
};

// Modal de confirmación estilizado
function mostrarConfirmacion(mensaje, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'modal active';
    overlay.style.display = 'flex';

    const modal = document.createElement('div');
    modal.className = 'modal-content';
    modal.style.maxWidth = '350px';

    modal.innerHTML = `
        <div class="modal-header">
            <h3>Confirmar</h3>
            <button class="close-btn" id="confirm-close">&times;</button>
        </div>
        <div style="padding: 1.5rem;">
            <p style="margin-bottom: 1.5rem; color: #484848;">${mensaje}</p>
            <div style="display: flex; gap: 0.5rem;">
                <button id="confirm-si" class="btn-delete" style="flex: 1; margin-top: 0;">Eliminar</button>
                <button id="confirm-no" class="btn-secondary" style="flex: 1;">Cancelar</button>
            </div>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const cerrar = () => overlay.remove();

    document.getElementById('confirm-si').onclick = () => {
        onConfirm();
        overlay.remove();
    };
    document.getElementById('confirm-no').onclick = cerrar;
    document.getElementById('confirm-close').onclick = cerrar;
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };
}

// ----------------- Editor de conjunto (5 filas) -----------------

function renderEditorFilas() {
    editorFilas.innerHTML = '';

    borradorFilas.forEach((fila, fi) => {
        const row = document.createElement('div');
        row.className = 'fila';

        const celdas = document.createElement('div');
        celdas.className = 'fila-celdas';

        fila.forEach((prenda, ci) => {
            celdas.appendChild(crearSlotEditor(prenda, fi, ci));
        });

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn-add-col';
        addBtn.title = 'Agregar columna a esta fila';
        addBtn.textContent = '+';
        addBtn.addEventListener('click', () => {
            borradorFilas[fi].push(null);
            renderEditorFilas();
        });
        celdas.appendChild(addBtn);

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn-remove-col';
        delBtn.title = 'Quitar última columna de esta fila';
        delBtn.textContent = '−';
        delBtn.disabled = fila.length <= 1;
        delBtn.addEventListener('click', () => {
            if (borradorFilas[fi].length > 1) {
                borradorFilas[fi].pop();
                renderEditorFilas();
            }
        });

        row.appendChild(celdas);
        row.appendChild(delBtn);
        editorFilas.appendChild(row);
    });
}

// Drag & drop compartido entre el editor y el detalle de conjunto
function configurarOrigenDrag(slot, fi, ci, modo) {
    slot.draggable = true;

    slot.addEventListener('dragstart', (e) => {
        dragOrigen = { fila: fi, col: ci, modo };
        slot.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `${fi}-${ci}`);
    });

    slot.addEventListener('dragend', () => {
        dragOrigen = null;
        slot.classList.remove('dragging');
        document
            .querySelectorAll('.slot.drag-over')
            .forEach((s) => s.classList.remove('drag-over'));
    });
}

function configurarDestinoDrop(slot, filas, fi, ci, modo, reRender) {
    slot.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        slot.classList.add('drag-over');
    });

    slot.addEventListener('dragleave', () => {
        slot.classList.remove('drag-over');
    });

    slot.addEventListener('drop', (e) => {
        e.preventDefault();
        slot.classList.remove('drag-over');

        if (!dragOrigen || dragOrigen.modo !== modo) return;
        if (dragOrigen.fila === fi && dragOrigen.col === ci) return;

        const movimientoInvalido = !movimientoPermitido(filas, dragOrigen, {
            fila: fi,
            col: ci
        });

        if (movimientoInvalido) {
            const filaRestringida = categoriasPermitidasFila(fi).length ? fi : dragOrigen.fila;
            const categorias = categoriasPermitidasFila(filaRestringida);
            mostrarToast(
                `La fila ${filaRestringida + 1} es solo para ${enumerarCategorias(categorias)}`
            );
            dragOrigen = null;
            return;
        }

        intercambiar(filas, dragOrigen, { fila: fi, col: ci });
        dragOrigen = null;

        reRender();
    });
}

function crearSlotEditor(prenda, fi, ci) {
    const slot = document.createElement('div');
    slot.className = 'slot' + (prenda ? ' lleno' : ' vacio');

    if (prenda) {
        slot.innerHTML = `
            <img src="${prenda.thumb || prenda.foto}" alt="${prenda.nombre}">
            <div class="slot-nombre">${prenda.nombre}</div>
            <button type="button" class="slot-clear" title="Vaciar espacio">&times;</button>
        `;
        slot.querySelector('.slot-clear').addEventListener('click', (e) => {
            e.stopPropagation();
            if (borradorFilas[fi].length > 1) {
                borradorFilas[fi].splice(ci, 1);
            } else {
                borradorFilas[fi][ci] = null;
            }
            renderEditorFilas();
        });
        configurarOrigenDrag(slot, fi, ci, 'editor');
    } else {
        const permitidas = categoriasPermitidasFila(fi);
        const texto = permitidas.length === 1 ? NOMBRES_CATEGORIA[permitidas[0]] : 'Prenda';
        slot.title = `Fila ${fi + 1}: ${enumerarCategorias(permitidas)}`;
        slot.innerHTML = `<span class="slot-plus">+</span><span class="slot-texto">${texto}</span>`;
    }

    configurarDestinoDrop(slot, borradorFilas, fi, ci, 'editor', renderEditorFilas);
    slot.addEventListener('click', () => abrirPicker(fi, ci, 'editor'));
    return slot;
}

// Picker de prendas
function abrirPicker(fi, ci, modo = 'editor') {
    const permitidas = categoriasPermitidasFila(fi);
    const nombreCategoria = permitidas.length === 1 ? NOMBRES_CATEGORIA[permitidas[0]] : null;

    pickerTarget = {
        modo,
        fila: fi,
        col: ci,
        categoriasPermitidas: permitidas
    };
    filtroActual = permitidas.length > 1 ? 'todos' : permitidas[0];
    pickerTitulo.textContent = nombreCategoria
        ? `Elegir ${nombreCategoria.toLowerCase()}`
        : 'Elegir prenda';
    pickerAyuda.hidden = !permitidas.length;
    pickerAyuda.textContent = permitidas.length
        ? `La fila ${fi + 1} es solo para ${enumerarCategorias(permitidas)}.`
        : '';
    actualizarFiltros();
    renderPickerPrendas();
    modalPicker.classList.add('active');
}

function cerrarPicker() {
    modalPicker.classList.remove('active');
    pickerTarget = null;
    filtroActual = 'todos';
}

function renderPickerPrendas() {
    pickerPrendas.innerHTML = '';

    const permitidas = pickerTarget ? pickerTarget.categoriasPermitidas : [];
    const lista = prendas.filter((prenda) => {
        if (filtroActual !== 'todos') return esCategoria(prenda, filtroActual);
        if (permitidas.length) {
            return permitidas.some((categoria) => esCategoria(prenda, categoria));
        }
        return true;
    });

    if (lista.length === 0) {
        let mensaje = 'No hay prendas en esta categoría.';
        if (pickerTarget?.categoriasPermitidas?.length) {
            mensaje =
                filtroActual === 'todos'
                    ? 'No hay prendas para esta fila.'
                    : `No hay prendas de categoría "${filtroActual}".`;
        }
        pickerPrendas.innerHTML = `<p style="color: #666;">${mensaje}</p>`;
        return;
    }

    lista.forEach((prenda) => {
        const item = document.createElement('div');
        item.className = 'selector-item';
        const nombre = escaparHtml(prenda.nombre);
        const meta = [prenda.marca, prenda.tipo]
            .filter(Boolean)
            .map((valor) => escaparHtml(valor))
            .join(' · ');
        item.innerHTML = `
            <img src="${escaparHtml(prenda.thumb || prenda.foto)}" alt="${nombre}" loading="lazy" decoding="async">
            <div class="selector-name">${nombre}</div>
            ${meta ? `<div class="selector-meta">${meta}</div>` : ''}
        `;
        item.addEventListener('click', () => {
            if (!pickerTarget) return;
            if (
                pickerTarget.categoriasPermitidas.length &&
                !pickerTarget.categoriasPermitidas.some((categoria) =>
                    esCategoria(prenda, categoria)
                )
            ) {
                return;
            }

            if (pickerTarget.modo === 'detalle') {
                filasDetalle[pickerTarget.fila][pickerTarget.col] = prenda;
                cerrarPicker();
                renderDetalleFilas();
            } else {
                borradorFilas[pickerTarget.fila][pickerTarget.col] = prenda;
                cerrarPicker();
                renderEditorFilas();
            }
        });
        pickerPrendas.appendChild(item);
    });
}

closeModalPicker.addEventListener('click', cerrarPicker);
modalPicker.addEventListener('click', (e) => {
    if (e.target === modalPicker) cerrarPicker();
});

// Guardar conjunto
formConjunto.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombreInput = document.getElementById('nombre-conjunto');
    const nombre = nombreInput.value.trim();

    const totalPrendas = borradorFilas.flat().filter(Boolean).length;
    if (totalPrendas === 0) {
        mostrarToast('Agrega al menos una prenda');
        return;
    }

    if (conjuntos.find((c) => c.nombre.toLowerCase() === nombre.toLowerCase())) {
        mostrarToast('Ya existe un conjunto con ese nombre');
        return;
    }

    conjuntos.push({
        id: Date.now(),
        nombre,
        filas: borradorFilas.map((f) => [...f])
    });
    guardarConjuntos();

    nombreInput.value = '';
    borradorFilas = filasVacias();
    renderEditorFilas();

    mostrarToast('Conjunto guardado');

    mostrarVista('conjuntos');
    renderConjuntos();
});

// Toast de notificación
function mostrarToast(mensaje) {
    const toast = document.createElement('div');
    toast.className = 'app-toast';
    toast.textContent = mensaje;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideDown 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ----------------- Lista y detalle de conjuntos -----------------

function thumbConjunto(p) {
    return `<img src="${p.thumb || p.foto}" alt="${p.nombre}" class="conjunto-prenda-thumb" title="${p.nombre}" draggable="false">`;
}

// Fija una sola fila de miniaturas por tarjeta; si no entran todas,
// muestra las que caben y un indicador "+N"
function ajustarPrendasConjunto(card, items) {
    const contenedor = card.querySelector('.conjunto-prendas');
    const ancho = contenedor.clientWidth;
    if (!ancho) {
        // La vista está oculta: se ajusta en el próximo render
        contenedor.innerHTML = items.map(thumbConjunto).join('');
        return;
    }

    const POR_THUMB = 70; // 60px + 2px de borde + 8px de gap
    const visibles = Math.max(1, Math.floor((ancho + 8) / POR_THUMB));

    if (items.length <= visibles) {
        contenedor.innerHTML = items.map(thumbConjunto).join('');
        return;
    }

    const caben = visibles - 1;
    contenedor.innerHTML =
        items.slice(0, caben).map(thumbConjunto).join('') +
        `<div class="conjunto-prenda-mas" title="${items.length - caben} prendas más">+${items.length - caben}</div>`;
}

// Renombrar un conjunto inline desde la tarjeta
function editarNombreConjunto(card, conjunto) {
    const titulo = card.querySelector('.conjunto-card-header h3');
    if (!titulo || card.querySelector('.input-renombrar')) return;
    card.draggable = false;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input-renombrar';
    input.value = conjunto.nombre;
    titulo.replaceWith(input);
    input.focus();
    input.select();

    let cerrado = false;
    const cerrar = (guardar) => {
        if (cerrado) return;
        const nombre = input.value.trim();

        if (guardar && nombre && nombre !== conjunto.nombre) {
            const duplicado = conjuntos.some(
                (c) => c.id !== conjunto.id && c.nombre.toLowerCase() === nombre.toLowerCase()
            );
            if (duplicado) {
                mostrarToast('Ya existe un conjunto con ese nombre');
            } else {
                conjunto.nombre = nombre;
                guardarConjuntos();
                mostrarToast('Conjunto renombrado');
            }
        } else if (guardar && !nombre) {
            mostrarToast('El nombre no puede estar vacío');
        }

        cerrado = true;
        renderConjuntos();
    };

    input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') cerrar(true);
        else if (e.key === 'Escape') cerrar(false);
    });
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('blur', () => cerrar(true));
}

function renderConjuntos() {
    conjuntosGrid.innerHTML = '';
    if (conjuntos.length === 0) {
        conjuntosGrid.innerHTML =
            '<p style="color: #666;">No hay conjuntos aún. Crea uno desde la pestaña "Crear Conjunto".</p>';
        return;
    }

    conjuntos.forEach((conjunto, index) => {
        const items = conjunto.filas.flat().filter(Boolean);
        const card = document.createElement('div');
        card.className = 'conjunto-card';
        card.draggable = true;
        card.dataset.index = index;
        card.innerHTML = `
            <div class="conjunto-card-header">
                <h3>${conjunto.nombre}</h3>
                <button type="button" class="btn-renombrar" data-renombrar="${conjunto.id}" title="Renombrar conjunto">&#9998;</button>
            </div>
            <div class="conjunto-prendas"></div>
            <div class="conjunto-acciones">
                <button class="btn-delete" data-eliminar="${conjunto.id}" style="margin-top: 0; flex: 1;">Eliminar</button>
                <button class="btn-duplicar" data-duplicar="${conjunto.id}" style="flex: 1;">Duplicar</button>
            </div>
        `;

        card.addEventListener('dragstart', (e) => {
            dragConjuntoOrigen = index;
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(index));

            // La vista previa del arrastre es siempre la tarjeta completa,
            // sin importar sobre qué elemento interno empezó el drag
            const rect = card.getBoundingClientRect();
            e.dataTransfer.setDragImage(card, e.clientX - rect.left, e.clientY - rect.top);
        });

        card.addEventListener('dragend', () => {
            dragConjuntoOrigen = null;
            card.classList.remove('dragging');
            conjuntosGrid
                .querySelectorAll('.drag-over')
                .forEach((c) => c.classList.remove('drag-over'));
        });

        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            card.classList.add('drag-over');
        });

        card.addEventListener('dragleave', () => {
            card.classList.remove('drag-over');
        });

        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('drag-over');

            if (dragConjuntoOrigen === null || dragConjuntoOrigen === index) return;

            const [movido] = conjuntos.splice(dragConjuntoOrigen, 1);
            conjuntos.splice(index, 0, movido);
            dragConjuntoOrigen = null;

            guardarConjuntos();
            renderConjuntos();
        });

        card.addEventListener('click', () => abrirDetalleConjunto(conjunto.id));
        card.querySelector('[data-eliminar]').addEventListener('click', (e) => {
            e.stopPropagation();
            window.eliminarConjunto(conjunto.id);
        });
        card.querySelector('[data-duplicar]').addEventListener('click', (e) => {
            e.stopPropagation();
            window.duplicarConjunto(conjunto.id);
        });
        card.querySelector('[data-renombrar]').addEventListener('click', (e) => {
            e.stopPropagation();
            editarNombreConjunto(card, conjunto);
        });
        conjuntosGrid.appendChild(card);
        ajustarPrendasConjunto(card, items);
    });
}

function abrirDetalleConjunto(id) {
    const conjunto = conjuntos.find((c) => c.id === id);
    if (!conjunto) return;

    conjuntoDetalleId = id;
    filasDetalle = conjunto.filas.map((f) => [...f]);
    detalleNombre.textContent = conjunto.nombre;
    renderDetalleFilas();
    modalDetalle.classList.add('active');
}

function renderDetalleFilas() {
    detalleFilas.innerHTML = '';

    filasDetalle.forEach((fila, fi) => {
        const row = document.createElement('div');
        row.className = 'fila detalle-fila';

        const celdas = document.createElement('div');
        celdas.className = 'fila-celdas';

        fila.forEach((prenda, ci) => {
            celdas.appendChild(crearSlotDetalle(prenda, fi, ci));
        });

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn-add-col';
        addBtn.title = 'Agregar columna a esta fila';
        addBtn.textContent = '+';
        addBtn.addEventListener('click', () => {
            filasDetalle[fi].push(null);
            renderDetalleFilas();
            abrirPicker(fi, filasDetalle[fi].length - 1, 'detalle');
        });
        celdas.appendChild(addBtn);

        row.appendChild(celdas);
        detalleFilas.appendChild(row);
    });
}

function crearSlotDetalle(prenda, fi, ci) {
    const slot = document.createElement('div');
    slot.className = 'slot detalle-slot' + (prenda ? ' lleno' : ' vacio');
    slot.dataset.fila = fi;
    slot.dataset.col = ci;

    if (prenda) {
        slot.innerHTML = `
            <img src="${prenda.thumb || prenda.foto}" alt="${prenda.nombre}">
            <div class="slot-nombre">${prenda.nombre}</div>
            <button type="button" class="slot-clear" title="Quitar prenda">&times;</button>
        `;
        slot.querySelector('.slot-clear').addEventListener('click', (e) => {
            e.stopPropagation();
            if (filasDetalle[fi].length > 1) {
                filasDetalle[fi].splice(ci, 1);
            } else {
                filasDetalle[fi][ci] = null;
            }
            renderDetalleFilas();
        });

        configurarOrigenDrag(slot, fi, ci, 'detalle');
    } else {
        slot.addEventListener('click', () => abrirPicker(fi, ci, 'detalle'));
    }

    configurarDestinoDrop(slot, filasDetalle, fi, ci, 'detalle', renderDetalleFilas);

    return slot;
}

function persistirDetalle() {
    const conjunto = conjuntos.find((c) => c.id === conjuntoDetalleId);
    if (!conjunto) return;

    conjunto.filas = filasDetalle.map((f) => [...f]);
    guardarConjuntos();
    renderConjuntos();
}

function cerrarDetalle() {
    modalDetalle.classList.remove('active');
    conjuntoDetalleId = null;
    filasDetalle = null;
    dragOrigen = null;
}

btnGuardarDetalle.addEventListener('click', () => {
    if (!conjuntoDetalleId || !filasDetalle) return;

    persistirDetalle();
    mostrarToast('Conjunto actualizado');
    cerrarDetalle();
});

closeModalDetalle.addEventListener('click', cerrarDetalle);

modalDetalle.addEventListener('click', (e) => {
    if (e.target === modalDetalle) cerrarDetalle();
});

// Reajustar las miniaturas de los conjuntos al cambiar el tamaño de la ventana
let temporizadorResize = null;
window.addEventListener('resize', () => {
    clearTimeout(temporizadorResize);
    temporizadorResize = setTimeout(renderConjuntos, 150);
});

// Inicialización
actualizarFiltrosArmario();
renderPrendas();
renderConjuntos();
actualizarFiltros();
renderEditorFilas();
sincronizarPrendasDesdeServidor();
cargarConjuntosDesdeServidor();

// Actualización en vivo: el servidor avisa por SSE cuando cambian los archivos
let versionCodigo = null;
let versionImagenes = null;
let versionMetadatos = null;
let versionConjuntos = null;

function aplicarEvento(datos) {
    if (!datos) return;

    if (versionCodigo === null) {
        versionCodigo = datos.codigo;
        versionImagenes = datos.imagenes;
        versionMetadatos = datos.metadatos;
        versionConjuntos = datos.conjuntos;
        return;
    }

    if (datos.codigo !== versionCodigo) {
        location.reload();
        return;
    }

    let debeSincronizar = false;

    if (datos.imagenes !== versionImagenes) {
        versionImagenes = datos.imagenes;
        debeSincronizar = true;
    }

    if (datos.metadatos !== versionMetadatos) {
        versionMetadatos = datos.metadatos;
        debeSincronizar = true;
    }

    if (debeSincronizar) sincronizarPrendasDesdeServidor();

    if (datos.conjuntos !== undefined && datos.conjuntos !== versionConjuntos) {
        versionConjuntos = datos.conjuntos;
        cargarConjuntosDesdeServidor();
    }
}

const eventos = new EventSource('/api/eventos');
eventos.onmessage = (e) => {
    try {
        aplicarEvento(JSON.parse(e.data));
    } catch (err) {
        console.error('Evento inválido:', err);
    }
};
