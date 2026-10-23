/**
 * =====================================================================
 * COTIZADOR 3D PRO - LÓGICA PRINCIPAL DEL CLIENTE
 * Archivo: app.js
 * 
 * Secciones:
 * 1. Utilidades y Notificaciones Toast
 * 2. Capa de Comunicación con el Backend PHP (guardar.php)
 * 3. Gestión de Estado, Sesión y Menú de Navegación
 * 4. Controladores de Vistas:
 *    - Inicio (Hero y Métricas)
 *    - Directorio de Vendedores y Filtros
 *    - Cotizador 3D Avanzado (Cálculo, Gráfica, Chat y WhatsApp)
 *    - Historial de Cotizaciones Guardadas
 *    - Panel de Taller (Configuración de Tarifas y Materiales)
 *    - Mi Cuenta y Autenticación
 * =====================================================================
 */

/* =====================================================================
   1. UTILIDADES Y NOTIFICACIONES
   ===================================================================== */
const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c] || c));

const pesos = n => '$ ' + Math.round(Number(n) || 0).toLocaleString('es-CO');
const num = v => {
  const n = Number(v);
  return isFinite(n) && n >= 0 ? n : 0;
};
const leer = id => $(id) ? num($(id).value) : 0;

// Sistema de Notificaciones Toast flotantes
function mostrarToast(mensaje, tipo = 'info') {
  const cont = $('toastContenedor');
  if (!cont) return;
  const t = document.createElement('div');
  t.className = `toast ${tipo}`;
  t.innerHTML = `<span>${esc(mensaje)}</span>`;
  cont.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(10px)';
    setTimeout(() => t.remove(), 250);
  }, 3200);
}

// Mensaje auxiliar en un contenedor específico
function aviso(id, texto, ok = true) {
  const el = $(id);
  if (!el) return;
  el.textContent = texto;
  el.className = 'aviso ' + (ok ? 'ok' : 'error');
  el.style.color = ok ? 'var(--exito)' : 'var(--peligro)';
}

/* =====================================================================
   2. CAPA DE SINCRONIZACIÓN CON EL BACKEND PHP (guardar.php)
   ===================================================================== */
const KEY_LOCAL = 'cotizador3d_pro_cache';
const URL_PHP = '/guardar.php';

// Base de datos en memoria y caché local
let BD = {
  usuarios: {},
  perfiles: {},
  vendedores: {
    pedro: {
      id: 'pedro',
      nombre: 'Pedro Impresiones',
      nota: 'Especialista en piezas técnicas y prototipado rápido en Bogotá',
      hora: 2500,
      margen: 15,
      tel: '573001234567',
      ciudad: 'Bogotá',
      insignia: 'Taller Verificado',
      mat: { PLA: 65000, PETG: 78000, ABS: 82000, TPU: 115000, Resina: 130000 }
    },
    enrique: {
      id: 'enrique',
      nombre: 'Enrique 3D Studio',
      nota: 'El mejor precio en materiales estándar y figuras decorativas',
      hora: 3800,
      margen: 20,
      tel: '573109876543',
      ciudad: 'Medellín',
      insignia: 'Top Ventas',
      mat: { PLA: 55000, PETG: 65000, ABS: 70000, TPU: 95000, Nylon: 140000 }
    },
    laura: {
      id: 'laura',
      nombre: 'Laura Print Lab',
      nota: 'Acabados finos de alta precisión y resina de ingeniería',
      hora: 3200,
      margen: 18,
      tel: '573155554433',
      ciudad: 'Cali',
      insignia: 'Precisión Alta',
      mat: { PLA: 60000, PETG: 72000, Resina: 120000, TPU: 105000 }
    }
  },
  resenas: {
    pedro: {
      votos: { u_demo1: 5, u_demo2: 4 },
      comentarios: [{ autor: 'Carlos M.', estrellas: 5, texto: 'Excelente acabado y entrega rápida.', fecha: '2026-10-15' }]
    },
    enrique: {
      votos: { u_demo1: 5, u_demo3: 5 },
      comentarios: [{ autor: 'Valeria S.', estrellas: 5, texto: 'Precios inmejorables en PETG.', fecha: '2026-10-18' }]
    },
    laura: {
      votos: { u_demo2: 5 },
      comentarios: [{ autor: 'David R.', estrellas: 5, texto: 'Gran detalle en impresiones de resina.', fecha: '2026-10-20' }]
    }
  },
  cotizaciones: [],
  mensajes: {},
  sesion: null
};

// Cargar caché local previo para rapidez instantánea
try {
  const guardado = localStorage.getItem(KEY_LOCAL);
  if (guardado) {
    const parseado = JSON.parse(guardado);
    BD = Object.assign(BD, parseado);
  }
} catch (e) {
  console.warn('No se pudo leer localStorage', e);
}

function guardarCacheLocal() {
  try {
    localStorage.setItem(KEY_LOCAL, JSON.stringify(BD));
  } catch (e) {
    console.warn('Error al guardar caché local', e);
  }
}

// Cliente API para invocar acciones en guardar.php
async function peticionPHP(accion, datos = {}) {
  const payload = Object.assign({ accion }, datos);
  try {
    const res = await fetch(URL_PHP, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    return json;
  } catch (err) {
    console.info('Modo sin conexión o backend PHP no disponible en este puerto; usando almacenamiento local.', err);
    return null;
  }
}

// Sincronizar estado completo al iniciar
async function sincronizarConPHP() {
  const respuesta = await peticionPHP('obtener_todo');
  const indicador = $('estadoPhp');
  if (respuesta && respuesta.ok && respuesta.datos) {
    if (respuesta.datos.vendedores) BD.vendedores = respuesta.datos.vendedores;
    if (respuesta.datos.resenas) BD.resenas = respuesta.datos.resenas;
    if (respuesta.datos.cotizaciones) BD.cotizaciones = respuesta.datos.cotizaciones;
    if (respuesta.datos.perfiles) BD.perfiles = respuesta.datos.perfiles;
    guardarCacheLocal();
    if (indicador) {
      indicador.innerHTML = '<span class="punto-estado"></span><span>PHP Sincronizado</span>';
      indicador.title = 'Conectado exitosamente con guardar.php';
    }
  } else {
    if (indicador) {
      indicador.innerHTML = '<span class="punto-estado" style="background:#eab308; box-shadow:0 0 6px #eab308;"></span><span>Caché Local</span>';
      indicador.title = 'guardar.php listo para producción; operando con almacenamiento local en el navegador';
    }
  }
  actualizarMetricasInicio();
}

/* =====================================================================
   3. GESTIÓN DE SESIÓN, USUARIOS Y MENÚ
   ===================================================================== */
async function cifrarClave(texto) {
  if (window.crypto && crypto.subtle) {
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
    return Array.from(new Uint8Array(h), b => b.toString(16).padStart(2, '0')).join('');
  }
  return [...texto].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7).toString();
}

function obtenerUsuarioActual() {
  if (!BD.sesion || !BD.usuarios[BD.sesion]) return null;
  return BD.usuarios[BD.sesion];
}

function obtenerPerfilActual() {
  const u = obtenerUsuarioActual();
  if (!u) return null;
  return BD.perfiles[u.id] || null;
}

function obtenerVendedorActual() {
  const u = obtenerUsuarioActual();
  if (!u) return null;
  return BD.vendedores[u.id] || null;
}

function esUsuarioVendedor() {
  return !!obtenerVendedorActual();
}

function obtenerSocialUsuario(userId) {
  if (!BD.resenas[userId]) {
    BD.resenas[userId] = { votos: {}, favoritos: {}, contactos: {} };
  }
  const r = BD.resenas[userId];
  r.votos = r.votos || {};
  r.favoritos = r.favoritos || {};
  r.contactos = r.contactos || {};
  return r;
}

// Calificación promedio calculada de un vendedor
function obtenerRatingVendedor(clave) {
  const votos = [];
  for (const r of Object.values(BD.resenas)) {
    if (r.votos && r.votos[clave]) {
      votos.push(r.votos[clave]);
    }
  }
  if (!votos.length) return { prom: 5.0, count: 0, texto: 'Nuevo (Sin reseñas)' };
  const prom = votos.reduce((a, b) => a + b, 0) / votos.length;
  const llenas = Math.round(prom);
  const estrellas = ''.repeat(llenas) + '☆'.repeat(5 - llenas);
  return {
    prom,
    count: votos.length,
    texto: `${estrellas} ${prom.toFixed(1)} (${votos.length} ${votos.length === 1 ? 'reseña' : 'reseñas'})`
  };
}

// Router sencillo basado en Hash
function obtenerRutaActiva() {
  const [ruta, query] = location.hash.slice(1).split('?');
  const paginasValidas = ['inicio', 'cotizador', 'vendedores', 'historial', 'taller', 'cuenta'];
  return {
    pagina: paginasValidas.includes(ruta) ? ruta : 'inicio',
    query: query || ''
  };
}

function construirMenu() {
  const menuEl = $('menu');
  if (!menuEl) return;
  menuEl.innerHTML = '';

  const { pagina } = obtenerRutaActiva();
  const u = obtenerUsuarioActual();
  const esVend = esUsuarioVendedor();

  const enlaces = [
    { id: 'inicio', href: '#inicio', texto: 'Inicio', visible: true },
    { id: 'cotizador', href: '#cotizador', texto: 'Cotizador', visible: true },
    { id: 'vendedores', href: '#vendedores', texto: 'Vendedores', visible: true },
    { id: 'historial', href: '#historial', texto: 'Mis Cotizaciones', visible: true },
    { id: 'taller', href: '#taller', texto: 'Mi Taller', visible: esVend },
    { id: 'cuenta', href: '#cuenta', texto: u ? 'Mi Perfil' : 'Ingresar', visible: true }
  ];

  enlaces.filter(e => e.visible).forEach(e => {
    const a = document.createElement('a');
    a.href = e.href;
    a.textContent = e.texto;
    if (e.id === pagina) a.classList.add('activa');
    menuEl.appendChild(a);
  });
}

// Inicialización de Tema Claro / Oscuro - PrintAnts
function inicializarTema() {
  const btn = $('btnTema');
  const icono = $('iconoTema');
  const favicon = $('faviconLink');
  const guardado = localStorage.getItem('cotizador3d_tema') || 'oscuro';

  const aplicar = esClaro => {
    document.documentElement.classList.toggle('tema-claro', esClaro);
    if (icono) icono.textContent = esClaro ? 'Claro' : 'Oscuro';
    if (favicon) favicon.href = esClaro ? 'icon-dark.png' : 'icon-light.png';
  };

  aplicar(guardado === 'claro');

  if (btn) {
    btn.addEventListener('click', () => {
      const esClaro = !document.documentElement.classList.contains('tema-claro');
      aplicar(esClaro);
      localStorage.setItem('cotizador3d_tema', esClaro ? 'claro' : 'oscuro');
      mostrarToast(`PrintAnts: Modo ${esClaro ? 'claro' : 'oscuro'} activado`);
    });
  }
}

function actualizarMetricasInicio() {
  const statVend = $('statVendedores');
  const statMat = $('statMateriales');
  const statCot = $('statCotizaciones');

  if (statVend) statVend.textContent = Object.keys(BD.vendedores).length;
  if (statCot) statCot.textContent = BD.cotizaciones.length;

  const matsUnicos = new Set();
  Object.values(BD.vendedores).forEach(v => {
    if (v.mat) Object.keys(v.mat).forEach(m => matsUnicos.add(m));
  });
  if (statMat) statMat.textContent = matsUnicos.size || 5;
}

/* =====================================================================
   4. CONTROLADORES DE PÁGINAS Y VISTAS
   ===================================================================== */
const controladores = {

  /* -------------------------------------------------------------
     A. VENDEDORES: Directorio, búsqueda, filtros y favoritos
     ------------------------------------------------------------- */
  vendedores() {
    const listaEl = $('lista');
    const inputBuscar = $('buscarVendedor');
    const selectMat = $('filtroMaterial');
    const selectOrden = $('ordenarVendedores');
    const u = obtenerUsuarioActual();
    const social = u ? obtenerSocialUsuario(u.id) : { favoritos: {} };

    const renderizar = () => {
      const q = (inputBuscar ? inputBuscar.value : '').toLowerCase().trim();
      const filtroMat = selectMat ? selectMat.value : 'todos';
      const orden = selectOrden ? selectOrden.value : 'rating';

      let items = Object.entries(BD.vendedores).map(([id, v]) => ({
        id,
        ...v,
        ratingInfo: obtenerRatingVendedor(id),
        esFavorito: !!(social.favoritos && social.favoritos[id]),
        esMio: u && id === u.id
      }));

      // Filtro de búsqueda por nombre o ciudad
      if (q) {
        items = items.filter(v =>
          v.nombre.toLowerCase().includes(q) ||
          (v.ciudad && v.ciudad.toLowerCase().includes(q)) ||
          (v.nota && v.nota.toLowerCase().includes(q))
        );
      }

      // Filtro de material
      if (filtroMat !== 'todos') {
        items = items.filter(v => v.mat && v.mat[filtroMat] !== undefined);
      }

      // Ordenamiento
      if (orden === 'rating') {
        items.sort((a, b) => b.ratingInfo.prom - a.ratingInfo.prom);
      } else if (orden === 'hora_asc') {
        items.sort((a, b) => a.hora - b.hora);
      } else if (orden === 'nombre') {
        items.sort((a, b) => a.nombre.localeCompare(b.nombre));
      }

      if (!items.length) {
        listaEl.innerHTML = `
          <div class="tarjeta" style="grid-column: 1 / -1; text-align: center; padding: 36px 16px;">
            <h3>No se encontraron talleres con esos criterios</h3>
            <p class="suave">Prueba ajustando el término de búsqueda o cambiando el material seleccionado.</p>
          </div>
        `;
        return;
      }

      listaEl.innerHTML = items.map(v => {
        const matFilas = Object.entries(v.mat || {})
          .map(([m, precio]) => `<tr><td>${esc(m)} / kg</td><td>${pesos(precio)}</td></tr>`)
          .join('');

        const telLimpio = String(v.tel || '').replace(/\D/g, '');
        const waUrl = `https://wa.me/${telLimpio}?text=${encodeURIComponent(`Hola ${v.nombre}, vi tu taller en la red PrintAnts y me gustaría cotizar una impresión 3D.`)}`;

        return `
          <div class="tarjeta">
            <div class="vendedor-cabecera">
              <div class="vendedor-titulo">
                <h2>
                  ${esc(v.nombre)}
                  ${v.esMio ? '<span class="etiqueta-tu">Tu Taller</span>' : ''}
                  ${v.insignia ? `<span class="etiqueta-verificado">${esc(v.insignia)}</span>` : ''}
                </h2>
              </div>
              <button type="button" class="btn-favorito ${v.esFavorito ? 'activo' : ''}" data-fav="${esc(v.id)}" title="${v.esFavorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
                ${v.esFavorito ? '' : '☆'}
              </button>
            </div>

            <div class="meta-vendedor">
              <span>${esc(v.ciudad || 'Colombia')}</span>
              <span>·</span>
              <span class="estrellas">${esc(v.ratingInfo.texto)}</span>
            </div>

            <p class="suave" style="font-size:0.9rem; min-height:42px;">${esc(v.nota || 'Taller de fabricación aditiva.')}</p>

            <table class="tabla-precios">
              <tr>
                <td>Tarifa máquina por hora</td>
                <td>${pesos(v.hora)}</td>
              </tr>
              <tr>
                <td>Margen comercial</td>
                <td>${v.margen}%</td>
              </tr>
              ${matFilas}
            </table>

            <div style="display:flex; flex-direction:column; gap:8px;">
              <a class="btn" href="#cotizador?v=${encodeURIComponent(v.id)}">
                Cotizar con ${esc(v.nombre)}
              </a>
              <a class="btn claro sm" href="${waUrl}" target="_blank" rel="noopener">
                WhatsApp Directo
              </a>
            </div>
          </div>
        `;
      }).join('');
    };

    // Eventos de búsqueda y filtros
    if (inputBuscar) inputBuscar.addEventListener('input', renderizar);
    if (selectMat) selectMat.addEventListener('change', renderizar);
    if (selectOrden) selectOrden.addEventListener('change', renderizar);

    // Evento de favoritos
    listaEl.addEventListener('click', async e => {
      const btn = e.target.closest('[data-fav]');
      if (!btn) return;
      const idVend = btn.dataset.fav;
      if (!u) {
        mostrarToast('Inicia sesión para guardar talleres en favoritos', 'info');
        location.hash = '#cuenta';
        return;
      }

      social.favoritos[idVend] = !social.favoritos[idVend];
      if (!social.favoritos[idVend]) delete social.favoritos[idVend];
      guardarCacheLocal();

      mostrarToast(
        social.favoritos[idVend] ? 'Agregado a tus favoritos' : 'Eliminado de favoritos',
        'info'
      );
      renderizar();
    });

    renderizar();
  },

  /* -------------------------------------------------------------
     B. COTIZADOR: Cálculo de tiempo/peso/infill, chat y comprobante
     ------------------------------------------------------------- */
  cotizador() {
    const { query } = obtenerRutaActiva();
    const params = new URLSearchParams(query);
    const paramVendedor = params.get('v');

    const u = obtenerUsuarioActual();
    const social = u ? obtenerSocialUsuario(u.id) : { favoritos: {}, contactos: {} };

    // Vendedores disponibles (favoritos o todos si no hay favoritos)
    const todosVendedores = Object.keys(BD.vendedores);
    if (!todosVendedores.length) {
      $('sinFavoritos').hidden = false;
      $('contenido').hidden = true;
      return;
    }

    let disponibles = todosVendedores.filter(id => social.favoritos && social.favoritos[id]);
    if (!disponibles.length) {
      disponibles = todosVendedores;
    }
    if (paramVendedor && BD.vendedores[paramVendedor] && !disponibles.includes(paramVendedor)) {
      disponibles.unshift(paramVendedor);
    }

    $('sinFavoritos').hidden = true;
    $('contenido').hidden = false;

    // Selector de vendedores
    const selVendedor = $('vendedor');
    selVendedor.innerHTML = disponibles.map(id => {
      const v = BD.vendedores[id];
      return `<option value="${esc(id)}">${esc(v.nombre)} (${v.ciudad || 'Colombia'}) - ${pesos(v.hora)}/h</option>`;
    }).join('');

    let actualId = (paramVendedor && BD.vendedores[paramVendedor]) ? paramVendedor : disponibles[0];
    selVendedor.value = actualId;

    // Selector de materiales dinámico según el taller actual
    const actualizarSelectorMateriales = () => {
      const v = BD.vendedores[actualId];
      const selMat = $('material');
      const mats = v && v.mat ? Object.keys(v.mat) : ['PLA', 'PETG'];
      const actualVal = selMat.value;
      selMat.innerHTML = mats.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
      if (mats.includes(actualVal)) {
        selMat.value = actualVal;
      }
    };
    actualizarSelectorMateriales();

    // Estado del cálculo y última cotización calculada
    let cotizacionCalculada = null;

    // Algoritmo de cálculo transparente
    const calcular = () => {
      const v = BD.vendedores[actualId];
      if (!v) return null;

      const mat = $('material').value;
      if (!v.mat || v.mat[mat] === undefined) {
        $('sinMaterial').hidden = false;
        $('sinMaterial').textContent = `El taller ${v.nombre} no maneja el material ${mat}. Elige otro filamento.`;
        return null;
      }
      $('sinMaterial').hidden = true;

      const horas = leer('horas') + (leer('minutos') / 60);
      const gramos = Math.max(1, leer('gramos'));
      const cantidad = Math.max(1, leer('cantidad'));

      // Costos directos
      const costoTiempo = horas * v.hora * cantidad;
      const costoMaterial = (gramos * (v.mat[mat] / 1000)) * cantidad;
      const costoMargen = (costoTiempo + costoMaterial) * (v.margen / 100);

      // Descuento por volumen
      let porcentajeDescuento = 0;
      if (cantidad >= 10) porcentajeDescuento = 0.10; // 10% descuento
      else if (cantidad >= 3) porcentajeDescuento = 0.05; // 5% descuento

      const subtotal = costoTiempo + costoMaterial + costoMargen;
      const descuento = subtotal * porcentajeDescuento;
      const total = Math.round(subtotal - descuento);

      return {
        vendedorId: actualId,
        vendedorNombre: v.nombre,
        vendedorTel: v.tel,
        material: mat,
        horas: leer('horas'),
        minutos: leer('minutos'),
        gramos,
        cantidad,
        costoTiempo,
        costoMaterial,
        costoMargen,
        descuento,
        porcentajeDescuento,
        total
      };
    };

    // Actualizar interfaz con el cálculo
    const actualizarVista = () => {
      const v = BD.vendedores[actualId];
      if (!v) return;

      $('vNombre').textContent = v.nombre;
      $('resenaVendedor').textContent = obtenerRatingVendedor(actualId).texto;

      const c = calcular();
      cotizacionCalculada = c;

      if (!c) {
        $('costoTiempo').textContent = '—';
        $('costoMaterial').textContent = '—';
        $('costoMargen').textContent = '—';
        $('total').textContent = '—';
        return;
      }

      $('costoTiempo').textContent = pesos(c.costoTiempo);
      $('costoMaterial').textContent = pesos(c.costoMaterial);
      $('costoMargen').textContent = pesos(c.costoMargen);
      $('total').textContent = pesos(c.total);

      // Descuento
      if (c.descuento > 0) {
        $('filaDescuento').hidden = false;
        $('costoDescuento').textContent = `- ${pesos(c.descuento)} (${c.porcentajeDescuento * 100}%)`;
      } else {
        $('filaDescuento').hidden = true;
      }

      // Barra porcentual
      const baseTotal = (c.costoTiempo + c.costoMaterial + c.costoMargen) || 1;
      const pTiempo = Math.round((c.costoTiempo / baseTotal) * 100);
      const pMaterial = Math.round((c.costoMaterial / baseTotal) * 100);
      const pMargen = 100 - pTiempo - pMaterial;

      $('barraTiempo').style.width = `${Math.max(5, pTiempo)}%`;
      $('barraMaterial').style.width = `${Math.max(5, pMaterial)}%`;
      $('barraMargen').style.width = `${Math.max(5, pMargen)}%`;

      // Tabla comparativa entre todos los talleres
      const mat = $('material').value;
      const comparaciones = Object.entries(BD.vendedores)
        .map(([id, t]) => {
          if (!t.mat || t.mat[mat] === undefined) return null;
          const horasTotales = c.horas + (c.minutos / 60);
          const tCostoTiempo = horasTotales * t.hora * c.cantidad;
          const tCostoMaterial = (c.gramos * (t.mat[mat] / 1000)) * c.cantidad;
          const tMargen = (tCostoTiempo + tCostoMaterial) * (t.margen / 100);
          const tSubtotal = tCostoTiempo + tCostoMaterial + tMargen;
          const tDesc = tSubtotal * c.porcentajeDescuento;
          return {
            id,
            nombre: t.nombre,
            total: Math.round(tSubtotal - tDesc),
            hora: t.hora,
            matPrecio: t.mat[mat]
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.total - b.total);

      const listaComp = $('listaComparacion');
      if (comparaciones.length > 0) {
        listaComp.innerHTML = comparaciones.map((item, idx) => `
          <div class="linea" style="${item.id === actualId ? 'font-weight:700; color:var(--primario);' : ''}">
            <span>
              ${esc(item.nombre)}
              ${item.id === actualId ? ' (Seleccionado)' : ''}
              ${idx === 0 ? '<span style="color:var(--exito); font-size:0.75rem; font-weight:700; margin-left:6px;">MÁS ECONÓMICO</span>' : ''}
            </span>
            <b class="mono">${pesos(item.total)}</b>
          </div>
        `).join('');
      } else {
        listaComp.innerHTML = '<p class="suave">Ningún taller tiene disponible este material actualmente.</p>';
      }
    };

    // Eventos de entrada
    selVendedor.addEventListener('change', () => {
      actualId = selVendedor.value;
      actualizarSelectorMateriales();
      actualizarVista();
    });

    ['material', 'horas', 'minutos', 'gramos', 'cantidad'].forEach(id => {
      const el = $(id);
      if (el) el.addEventListener('input', actualizarVista);
    });

    // Control asistido de densidad de infill
    const infillSlider = $('infillRelleno');
    if (infillSlider) {
      infillSlider.addEventListener('input', () => {
        const val = Number(infillSlider.value);
        $('infillPorcentaje').textContent = `${val}%`;
        let desc = 'Ligero (Decorativo)';
        if (val >= 75) desc = 'Ultra Resistente (Mecánico / Sólido)';
        else if (val >= 40) desc = 'Resistente (Uso funcional)';
        else if (val >= 20) desc = 'Estándar recomendado';
        $('infillTexto').textContent = `${val}% (${desc})`;

        // Ajuste inteligente proporcional sobre peso si el usuario usa el slider
        actualizarVista();
      });
    }

    // Plantillas rápidas
    document.querySelectorAll('.btn-plantilla').forEach(btn => {
      btn.addEventListener('click', () => {
        $('horas').value = btn.dataset.h;
        $('minutos').value = btn.dataset.m;
        $('gramos').value = btn.dataset.g;
        $('nombrePieza').value = btn.dataset.n;
        actualizarVista();
        mostrarToast(`Plantilla "${btn.dataset.n}" cargada`, 'info');
      });
    });

    // Interruptor manual
    const interruptor = $('interruptor');
    if (interruptor) {
      interruptor.addEventListener('change', () => {
        $('manual').hidden = !interruptor.checked;
        actualizarVista();
      });
    }

    // ==============================================================
    // ACCIÓN: GUARDAR COTIZACIÓN EN PHP (guardar.php)
    // ==============================================================
    const btnGuardar = $('btnGuardarCotizacion');
    if (btnGuardar) {
      btnGuardar.onclick = async () => {
        const c = cotizacionCalculada || calcular();
        if (!c) {
          mostrarToast('Error al calcular presupuesto', 'error');
          return;
        }

        const nombrePieza = ($('nombrePieza') ? $('nombrePieza').value.trim() : '') || 'Pieza 3D Personalizada';
        const usuario = obtenerUsuarioActual();
        const perfil = obtenerPerfilActual();

        const payloadCotizacion = {
          cliente_id: usuario ? usuario.id : 'invitado',
          cliente_nombre: perfil ? perfil.nombre : (usuario ? usuario.correo : 'Cliente Web'),
          cliente_tel: perfil ? perfil.tel : '',
          vendedor_id: c.vendedorId,
          vendedor_nombre: c.vendedorNombre,
          pieza_nombre: nombrePieza,
          material: c.material,
          horas: c.horas,
          minutos: c.minutos,
          gramos: c.gramos,
          cantidad: c.cantidad,
          costo_tiempo: c.costoTiempo,
          costo_material: c.costoMaterial,
          costo_margen: c.costoMargen,
          descuento: c.descuento,
          total: c.total,
          notas: `Corte: ${c.horas}h ${c.minutos}m, ${c.gramos}g de ${c.material}.`
        };

        btnGuardar.disabled = true;
        btnGuardar.textContent = 'Guardando en PHP...';

        const resp = await peticionPHP('guardar_cotizacion', { cotizacion: payloadCotizacion });

        if (resp && resp.ok && resp.cotizacion) {
          BD.cotizaciones.unshift(resp.cotizacion);
          guardarCacheLocal();
          mostrarToast(`Cotización ${resp.cotizacion.id} guardada con éxito en el servidor PHP`, 'exito');
        } else {
          // Respaldo local si PHP no responde
          const idLocal = 'COT-' + Math.random().toString(36).substring(2, 7).toUpperCase();
          const cotLocal = {
            id: idLocal,
            fecha: new Date().toLocaleString('es-CO'),
            ...payloadCotizacion
          };
          BD.cotizaciones.unshift(cotLocal);
          guardarCacheLocal();
          mostrarToast(`Cotización ${idLocal} guardada en tu historial local`, 'exito');
        }

        btnGuardar.disabled = false;
        btnGuardar.innerHTML = 'Guardar Cotización en PHP';
        actualizarMetricasInicio();
      };
    }

    // ==============================================================
    // ACCIÓN: COMPROBANTE / TICKET IMPRIMIBLE
    // ==============================================================
    const btnModal = $('btnVerComprobante');
    const modal = $('modalComprobante');
    const btnCerrarModal = $('btnCerrarModal');
    const btnImprimirTicket = $('btnImprimirTicket');

    const abrirComprobante = () => {
      const c = cotizacionCalculada || calcular();
      if (!c) return;

      const perfil = obtenerPerfilActual();
      const nombrePieza = ($('nombrePieza') ? $('nombrePieza').value.trim() : '') || 'Pieza 3D Personalizada';

      $('ticketId').textContent = 'COT-' + Date.now().toString(36).toUpperCase().slice(-5);
      $('ticketFecha').textContent = `Fecha: ${new Date().toLocaleDateString('es-CO')}`;
      $('ticketCliente').textContent = perfil ? `${perfil.nombre} (${perfil.tel || 'Sin WhatsApp'})` : 'Cliente Web';
      $('ticketTaller').textContent = `${c.vendedorNombre} (${BD.vendedores[c.vendedorId]?.ciudad || 'Colombia'})`;
      $('ticketPieza').textContent = nombrePieza;
      $('ticketMaterial').textContent = c.material;
      $('ticketTiempo').textContent = `${c.horas}h ${c.minutos}min`;
      $('ticketPeso').textContent = `${c.gramos} g`;
      $('ticketCantidad').textContent = `${c.cantidad} unidad(es)`;
      $('ticketCostoTiempo').textContent = pesos(c.costoTiempo);
      $('ticketCostoMaterial').textContent = pesos(c.costoMaterial);
      $('ticketCostoMargen').textContent = pesos(c.costoMargen);
      $('ticketTotal').textContent = pesos(c.total) + ' COP';

      modal.hidden = false;
    };

    if (btnModal) btnModal.onclick = abrirComprobante;
    if (btnCerrarModal) btnCerrarModal.onclick = () => { modal.hidden = true; };
    if (btnImprimirTicket) btnImprimirTicket.onclick = () => window.print();

    // ==============================================================
    // ACCIÓN: ENVIAR A WHATSAPP
    // ==============================================================
    const btnWhatsApp = $('btnWhatsAppDirecto');
    if (btnWhatsApp) {
      btnWhatsApp.onclick = () => {
        const c = cotizacionCalculada || calcular();
        if (!c) return;

        const telLimpio = String(c.vendedorTel || '').replace(/\D/g, '');
        const nombrePieza = ($('nombrePieza') ? $('nombrePieza').value.trim() : '') || 'Pieza 3D';

        const mensaje = 
`Hola *${c.vendedorNombre}*, coticé una pieza mediante la red *PrintAnts*:
*Modelo:* ${nombrePieza}
*Material:* ${c.material}
*Tiempo de corte:* ${c.horas}h ${c.minutos}m
*Peso neto:* ${c.gramos}g
*Cantidad:* ${c.cantidad} ud(s)
*Total estimado:* ${pesos(c.total)} COP

¿Tienes disponibilidad de máquina para coordinar la impresión?`;

        const url = `https://wa.me/${telLimpio}?text=${encodeURIComponent(mensaje)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      };
    }

    // ==============================================================
    // ACCIÓN: CHAT INTEGRADO Y CALIFICACIÓN
    // ==============================================================
    const btnChat = $('contactar');
    const cajaChat = $('chat');
    const btnCerrarChat = $('chatCerrar');
    const btnEnviarChat = $('chatEnviar');
    const inputChat = $('chatTexto');
    const contMensajes = $('chatMensajes');
    const btnCalificar = $('calificar');
    const cajaEstrellas = $('cajaEstrellas');

    let chatAbierto = false;

    const renderChat = () => {
      cajaChat.hidden = !chatAbierto;
      if (!chatAbierto) return;

      $('chatTitulo').textContent = `Chat con ${BD.vendedores[actualId].nombre}`;
      const listaMsjs = BD.mensajes[actualId] || [];

      if (!listaMsjs.length) {
        listaMsjs.push({
          de: 'vendedor',
          texto: `¡Hola! Soy ${BD.vendedores[actualId].nombre}. Cuéntame sobre tu proyecto o archivo STL/STEP para afinar detalles.`,
          fecha: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
        });
        BD.mensajes[actualId] = listaMsjs;
      }

      contMensajes.innerHTML = listaMsjs.map(m => `
        <div class="msj ${m.de === 'cliente' ? 'propio' : 'recibido'}">
          <div>${esc(m.texto)}</div>
          <div class="msj-hora">${esc(m.fecha)}</div>
        </div>
      `).join('');

      contMensajes.scrollTop = contMensajes.scrollHeight;
    };

    if (btnChat) {
      btnChat.onclick = () => {
        chatAbierto = !chatAbierto;
        renderChat();
      };
    }
    if (btnCerrarChat) {
      btnCerrarChat.onclick = () => {
        chatAbierto = false;
        renderChat();
      };
    }

    const enviarMensajeChat = async () => {
      const texto = inputChat.value.trim();
      if (!texto) return;

      const nuevoMsj = {
        de: 'cliente',
        texto,
        fecha: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      };

      BD.mensajes[actualId] = BD.mensajes[actualId] || [];
      BD.mensajes[actualId].push(nuevoMsj);
      inputChat.value = '';
      renderChat();

      // Guardar en PHP
      peticionPHP('guardar_mensaje', {
        vendedor_id: actualId,
        texto,
        de: 'cliente'
      });

      // Respuesta simulada inteligente del taller
      setTimeout(() => {
        const respuestas = [
          '¡Perfecto! El filamento está disponible en stock para imprimir hoy mismo.',
          'Revisado. Podemos calibrar la pieza a 0.20mm de altura de capa para un excelente acabado.',
          'Entendido. Si confirmas por WhatsApp te aparto el turno de máquina de inmediato.'
        ];
        const rTexto = respuestas[Math.floor(Math.random() * respuestas.length)];
        const rMsj = {
          de: 'vendedor',
          texto: rTexto,
          fecha: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
        };
        BD.mensajes[actualId].push(rMsj);
        guardarCacheLocal();
        renderChat();
      }, 1000);
    };

    if (btnEnviarChat) btnEnviarChat.onclick = enviarMensajeChat;
    if (inputChat) {
      inputChat.addEventListener('keydown', e => {
        if (e.key === 'Enter') enviarMensajeChat();
      });
    }

    // Calificar vendedor con estrellas
    if (btnCalificar) {
      btnCalificar.onclick = () => {
        cajaEstrellas.hidden = !cajaEstrellas.hidden;
        if (!cajaEstrellas.hidden) {
          const miVoto = (social.votos && social.votos[actualId]) || 0;
          cajaEstrellas.innerHTML = `
            <div class="estrellas-grupo">
              ${[1, 2, 3, 4, 5].map(n => `
                <button type="button" class="btn-estrella ${n <= miVoto ? 'marcada' : ''}" data-estrella="${n}"></button>
              `).join('')}
            </div>
            <div class="suave" style="font-size:0.8rem;">
              ${miVoto ? `Tu calificación actual: ${miVoto} estrella(s)` : 'Toca una estrella para calificar'}
            </div>
          `;
        }
      };
    }

    if (cajaEstrellas) {
      cajaEstrellas.addEventListener('click', async e => {
        const btn = e.target.closest('[data-estrella]');
        if (!btn) return;
        const n = Number(btn.dataset.estrella);
        social.votos[actualId] = n;
        guardarCacheLocal();

        mostrarToast(`Calificaste a ${BD.vendedores[actualId].nombre} con ${n} estrella(s)`, 'exito');

        // Enviar a guardar.php
        peticionPHP('guardar_resena', {
          vendedor_id: actualId,
          usuario_id: u ? u.id : 'anonimo',
          estrellas: n,
          autor: u ? (BD.perfiles[u.id]?.nombre || u.correo) : 'Cliente'
        });

        $('resenaVendedor').textContent = obtenerRatingVendedor(actualId).texto;
        btnCalificar.click();
      });
    }

    actualizarVista();
  },

  /* -------------------------------------------------------------
     C. HISTORIAL DE COTIZACIONES (Guardadas con PHP)
     ------------------------------------------------------------- */
  historial() {
    const lista = $('listaCotizacionesGuardadas');
    const vacio = $('vacioCotizaciones');
    const btnExportar = $('btnExportarCotizaciones');

    const cotizaciones = BD.cotizaciones || [];

    if (!cotizaciones.length) {
      if (vacio) vacio.hidden = false;
      if (lista) lista.innerHTML = '';
      return;
    }

    if (vacio) vacio.hidden = true;

    lista.innerHTML = cotizaciones.map(c => `
      <div class="cotizacion-item">
        <div class="cotizacion-info">
          <h3>${esc(c.pieza_nombre || 'Pieza 3D')} <span class="estado-pill guardada">${esc(c.id)}</span></h3>
          <div class="cotizacion-meta">
            <span>Taller: <b>${esc(c.vendedor_nombre)}</b></span>
            <span>·</span>
            <span>Material: ${esc(c.material)}</span>
            <span>·</span>
            <span>${c.horas}h ${c.minutos}m / ${c.gramos}g</span>
            <span>·</span>
            <span>${c.cantidad} ud(s)</span>
          </div>
          <div class="nota" style="margin-top:4px;">Guardado el: ${esc(c.fecha || 'Reciente')}</div>
        </div>
        <div class="cotizacion-precio">
          <div class="cotizacion-monto">${pesos(c.total)} COP</div>
          <button type="button" class="btn claro sm" data-recotizar="${esc(c.vendedor_id)}" style="margin-top:6px;">
            Abrir en Cotizador
          </button>
        </div>
      </div>
    `).join('');

    lista.addEventListener('click', e => {
      const btn = e.target.closest('[data-recotizar]');
      if (!btn) return;
      location.hash = `#cotizador?v=${encodeURIComponent(btn.dataset.recotizar)}`;
    });

    if (btnExportar) {
      btnExportar.onclick = () => {
        const blob = new Blob([JSON.stringify(cotizaciones, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cotizaciones_3d_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        mostrarToast('Historial exportado en JSON', 'exito');
      };
    }
  },

  /* -------------------------------------------------------------
     D. MI TALLER: Panel del vendedor para tarifas y materiales
     ------------------------------------------------------------- */
  taller() {
    const u = obtenerUsuarioActual();
    const v = obtenerVendedorActual();

    if (!v) {
      mostrarToast('Debes ser un taller o vendedor registrado para acceder a esta sección.', 'error');
      location.hash = '#cuenta';
      return;
    }

    const inputHora = $('tHora');
    const inputMargen = $('tMargen');
    const inputNota = $('tNota');
    const inputCiudad = $('tCiudad');
    const contMateriales = $('materiales');

    inputHora.value = v.hora || 3000;
    inputMargen.value = v.margen || 20;
    inputNota.value = v.nota || '';
    inputCiudad.value = v.ciudad || 'Colombia';

    // Copia temporal de materiales para editar
    const mats = Object.assign({}, v.mat || { PLA: 65000, PETG: 75000 });

    const renderMateriales = () => {
      contMateriales.innerHTML = Object.entries(mats).map(([nombre, precio]) => `
        <div class="fila" style="align-items:end; margin-bottom:8px;">
          <div>
            <label style="margin:4px 0;">${esc(nombre)} (COP / kg)</label>
            <input type="number" min="1000" step="1000" data-mat="${esc(nombre)}" value="${precio}">
          </div>
          <div>
            <button type="button" class="btn peligro sm" data-borrar-mat="${esc(nombre)}">Eliminar</button>
          </div>
        </div>
      `).join('') || '<p class="suave">No tienes materiales configurados.</p>';
    };

    contMateriales.oninput = e => {
      const mat = e.target.dataset.mat;
      if (mat) {
        mats[mat] = num(e.target.value);
      }
    };

    contMateriales.onclick = e => {
      const borrar = e.target.dataset.borrarMat;
      if (borrar) {
        delete mats[borrar];
        renderMateriales();
        mostrarToast(`Material ${borrar} removido de la lista`, 'info');
      }
    };

    // Agregar nuevo material
    $('agregar').onclick = () => {
      const nombre = $('nuevoNombre').value.trim();
      const precio = leer('nuevoPrecio');
      if (!nombre) {
        mostrarToast('Escribe el nombre del nuevo material (ej. Nylon, Resina)', 'error');
        return;
      }
      if (precio < 1000) {
        mostrarToast('Ingresa un precio por kilo válido (mínimo 1000 COP)', 'error');
        return;
      }

      mats[nombre] = precio;
      $('nuevoNombre').value = '';
      $('nuevoPrecio').value = '';
      renderMateriales();
      mostrarToast(`Material "${nombre}" añadido. Recuerda guardar los cambios.`, 'exito');
    };

    // Guardar cambios en el servidor PHP
    $('tGuardar').onclick = async () => {
      const hora = leer('tHora');
      const margen = leer('tMargen');
      if (hora < 100) {
        mostrarToast('La tarifa por hora debe ser de al menos 100 COP', 'error');
        return;
      }
      if (!Object.keys(mats).length) {
        mostrarToast('Configura al menos un material de impresión', 'error');
        return;
      }

      $('tGuardar').disabled = true;
      $('tGuardar').textContent = 'Guardando en PHP...';

      const payload = {
        id: u.id,
        hora,
        margen,
        nota: inputNota.value.trim(),
        ciudad: inputCiudad.value.trim(),
        mat: mats
      };

      const resp = await peticionPHP('guardar_taller', payload);

      // Actualizar estado local
      BD.vendedores[u.id] = Object.assign(BD.vendedores[u.id], payload);
      guardarCacheLocal();

      $('tGuardar').disabled = false;
      $('tGuardar').innerHTML = 'Guardar Cambios en Servidor PHP';

      if (resp && resp.ok) {
        mostrarToast('¡Tarifas y materiales actualizados en el servidor PHP!', 'exito');
      } else {
        mostrarToast('Cambios guardados en almacenamiento local', 'exito');
      }
    };

    renderMateriales();
  },

  /* -------------------------------------------------------------
     E. CUENTA: Login, registro, cambio de rol y edición de perfil
     ------------------------------------------------------------- */
  cuenta() {
    let modo = 'entrar';
    const u = obtenerUsuarioActual();
    const perfil = obtenerPerfilActual();
    const vend = obtenerVendedorActual();

    const estadoEl = $('estado');
    const accesoEl = $('acceso');
    const registroEl = $('registro');
    const btnCerrar = $('cerrar');

    // Visibilidad según estado de sesión
    accesoEl.hidden = !!u;
    registroEl.hidden = !u;
    btnCerrar.hidden = !u;

    if (!u) {
      estadoEl.innerHTML = `
        <h2>Bienvenido</h2>
        <p class="suave">Inicia sesión o crea una cuenta para cotizar con tus talleres favoritos o registrar tu propio taller de impresión 3D.</p>
      `;
    } else {
      estadoEl.innerHTML = `
        <h2>Hola, ${esc(perfil ? perfil.nombre : u.correo)}</h2>
        <div class="meta-vendedor" style="margin-top:6px;">
          <span>${esc(u.correo)}</span>
          <span>·</span>
          <span>Rol: <b>${vend ? 'Taller / Vendedor 3D' : 'Cliente'}</b></span>
        </div>
      `;

      $('rol').value = vend ? 'vendedor' : 'cliente';
      $('nombre').value = perfil ? perfil.nombre : '';
      $('tel').value = perfil ? perfil.tel : '';
      $('nota').value = vend ? vend.nota : '';
      $('borrar').hidden = false;

      const alternarCamposRol = () => {
        const esV = $('rol').value === 'vendedor';
        $('datosVendedor').hidden = !esV;
      };
      $('rol').onchange = alternarCamposRol;
      alternarCamposRol();
    }

    // Pestañas Iniciar Sesión / Crear Cuenta
    const pestanaEntrar = $('pestanaEntrar');
    const pestanaCrear = $('pestanaCrear');
    const btnEntrar = $('entrar');

    const cambiarPestana = m => {
      modo = m;
      pestanaEntrar.classList.toggle('activa', m === 'entrar');
      pestanaCrear.classList.toggle('activa', m === 'crear');
      btnEntrar.textContent = m === 'entrar' ? 'Iniciar Sesión' : 'Crear Cuenta Nueva';
      aviso('mensajeAcceso', '');
    };

    pestanaEntrar.onclick = () => cambiarPestana('entrar');
    pestanaCrear.onclick = () => cambiarPestana('crear');

    // Botón de autenticación
    btnEntrar.onclick = async () => {
      const correo = $('correo').value.trim().toLowerCase();
      const clave = $('clave').value;

      if (!correo || clave.length < 6) {
        aviso('mensajeAcceso', 'Ingresa un correo válido y contraseña de al menos 6 caracteres.', false);
        return;
      }

      btnEntrar.disabled = true;
      btnEntrar.textContent = 'Verificando con PHP...';

      const resp = await peticionPHP('guardar_usuario', {
        correo,
        clave,
        es_nuevo: modo === 'crear'
      });

      if (resp && resp.ok && resp.usuario) {
        BD.usuarios[resp.usuario.id] = { id: resp.usuario.id, correo: resp.usuario.correo, clave };
        BD.sesion = resp.usuario.id;
        if (resp.perfil) BD.perfiles[resp.usuario.id] = resp.perfil;
        if (resp.vendedor) BD.vendedores[resp.usuario.id] = resp.vendedor;
        guardarCacheLocal();

        mostrarToast(resp.mensaje || '¡Acceso concedido!', 'exito');
        setTimeout(() => location.reload(), 300);
        return;
      }

      // Si PHP falló o no está disponible, gestionar en local
      if (resp && !resp.ok) {
        aviso('mensajeAcceso', resp.error || 'Error al autenticar', false);
        btnEntrar.disabled = false;
        btnEntrar.textContent = modo === 'entrar' ? 'Iniciar Sesión' : 'Crear Cuenta Nueva';
        return;
      }

      // Fallback local
      const idExistente = Object.keys(BD.usuarios).find(id => BD.usuarios[id].correo === correo);
      if (modo === 'crear') {
        if (idExistente) {
          aviso('mensajeAcceso', 'Ese correo ya está registrado localmente.', false);
          btnEntrar.disabled = false;
          return;
        }
        const nuevoId = 'u_' + Date.now().toString(36);
        BD.usuarios[nuevoId] = { id: nuevoId, correo, clave };
        BD.sesion = nuevoId;
        guardarCacheLocal();
        mostrarToast('Cuenta creada localmente', 'exito');
        setTimeout(() => location.reload(), 300);
      } else {
        if (!idExistente || BD.usuarios[idExistente].clave !== clave) {
          aviso('mensajeAcceso', 'Correo o contraseña incorrectos.', false);
          btnEntrar.disabled = false;
          return;
        }
        BD.sesion = idExistente;
        guardarCacheLocal();
        mostrarToast('Sesión iniciada', 'exito');
        setTimeout(() => location.reload(), 300);
      }
    };

    // Cerrar sesión
    btnCerrar.onclick = () => {
      BD.sesion = null;
      guardarCacheLocal();
      mostrarToast('Sesión cerrada', 'info');
      location.hash = '#inicio';
      setTimeout(() => location.reload(), 150);
    };

    // Guardar información de perfil y taller
    $('guardar').onclick = async () => {
      const nombre = $('nombre').value.trim();
      const tel = $('tel').value.replace(/\D/g, '');
      const rol = $('rol').value;

      if (!nombre) {
        aviso('mensajeRegistro', 'Ingresa tu nombre o razón social.', false);
        return;
      }
      if (tel.length < 10) {
        aviso('mensajeRegistro', 'Ingresa un número de WhatsApp válido (mínimo 10 dígitos).', false);
        return;
      }

      const mat = {};
      [['PLA', 'pla'], ['PETG', 'petg'], ['ABS', 'abs'], ['TPU', 'tpu']].forEach(([m, id]) => {
        if (leer(id) > 0) mat[m] = leer(id);
      });

      const payload = {
        id: u.id,
        nombre,
        tel,
        rol,
        nota: $('nota').value.trim(),
        hora: leer('hora') || 3000,
        margen: leer('margen') || 20,
        mat: Object.keys(mat).length ? mat : { PLA: 65000, PETG: 75000 }
      };

      const resp = await peticionPHP('guardar_perfil', payload);

      BD.perfiles[u.id] = { id: u.id, nombre, tel, rol };
      if (rol === 'vendedor') {
        BD.vendedores[u.id] = {
          id: u.id,
          nombre,
          tel,
          nota: payload.nota,
          hora: payload.hora,
          margen: payload.margen,
          ciudad: 'Colombia',
          insignia: 'Taller Activo',
          mat: payload.mat
        };
      } else {
        delete BD.vendedores[u.id];
      }
      guardarCacheLocal();

      mostrarToast('Perfil guardado exitosamente en el servidor PHP', 'exito');
      setTimeout(() => {
        location.hash = rol === 'vendedor' ? '#taller' : '#cotizador';
        location.reload();
      }, 400);
    };

    // Eliminar cuenta
    $('borrar').onclick = async () => {
      if (!confirm('¿Estás seguro de que deseas eliminar tu cuenta permanentemente?')) return;
      await peticionPHP('borrar_cuenta', { id: u.id });
      delete BD.usuarios[u.id];
      delete BD.perfiles[u.id];
      delete BD.vendedores[u.id];
      BD.sesion = null;
      guardarCacheLocal();
      mostrarToast('Cuenta eliminada', 'info');
      location.hash = '#inicio';
      setTimeout(() => location.reload(), 200);
    };
  }
};

/* =====================================================================
   5. INICIALIZACIÓN Y ENRUTADOR
   ===================================================================== */
function iniciarAplicacion() {
  inicializarTema();
  construirMenu();

  const { pagina } = obtenerRutaActiva();

  // Mostrar únicamente la sección activa
  document.querySelectorAll('[data-p]').forEach(s => {
    s.hidden = s.dataset.p !== pagina;
  });

  const titulos = {
    inicio: 'Inicio · Red Robótica 3D',
    cotizador: 'Cotizador 3D Avanzado',
    vendedores: 'Talleres PrintAnts',
    historial: 'Mis Cotizaciones',
    taller: 'Mi Taller PrintAnts',
    cuenta: 'Mi Perfil'
  };
  document.title = `${titulos[pagina] || 'PrintAnts'} · PrintAnts`;

  // Ejecutar el controlador correspondiente
  if (controladores[pagina]) {
    controladores[pagina]();
  }

  // Sincronizar en segundo plano con PHP
  sincronizarConPHP();
}

window.addEventListener('hashchange', () => {
  construirMenu();
  const { pagina } = obtenerRutaActiva();
  document.querySelectorAll('[data-p]').forEach(s => {
    s.hidden = s.dataset.p !== pagina;
  });
  if (controladores[pagina]) {
    controladores[pagina]();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Arrancar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarAplicacion);
} else {
  iniciarAplicacion();
}
