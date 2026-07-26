
const timersAsignacion = {};

let ultimoTotalPendientes = 0;

function seleccionarViaje(viaje, card) {

window.viajeSeleccionado = viaje;
window.viajeSeleccionadoId = viaje.id;
viajeSeleccionadoId = viaje.id;

  const acciones = document.getElementById('acciones-viaje');

if (acciones) {
  acciones.classList.remove('oculto');
  acciones.style.display = 'block';
}

  document.querySelectorAll('.card-viaje').forEach((el) => {
    el.classList.remove('seleccionado');
  });

  card.classList.add('seleccionado');

 if (typeof actualizarBotonesPorEstado === 'function') {
  actualizarBotonesPorEstado(viaje);
}

if (acciones) {
  acciones.classList.remove('oculto');
  acciones.style.display = 'block';
}
if (viaje.estado === 'pendiente') {
  mostrarViajeSeleccionadoEnPanel(viaje);
} else {
  mostrarViajeOperativo(viaje);
}

const accionesViaje = document.getElementById('acciones-viaje');

if (accionesViaje) {
  accionesViaje.classList.remove('oculto');
  accionesViaje.style.setProperty('display', 'block', 'important');
}
centrarMapa(viaje);

  if (typeof actualizarBotonesPorEstado === 'function') {
  actualizarBotonesPorEstado(viaje);
}

  window.viajeSeleccionadoId = viajeSeleccionadoId;
  window.viajeSeleccionado = viajeSeleccionado;
}

// Envía al backend la asignación de un taxi a un viaje

async function asignarTaxiSeleccionado() {

  if (!window.viajeSeleccionadoId && window.viajeSeleccionado?.id) {
    window.viajeSeleccionadoId = window.viajeSeleccionado.id;
  }

  if (!window.viajeSeleccionadoId) {
    alert('Seleccioná un viaje');
    return;
  }

  if (!window.taxiSeleccionadoId) {
    alert('Seleccioná un taxi');
    return;
  }


  try {

    const res = await fetch('/viajes/asignar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        viaje_id: window.viajeSeleccionadoId,
        taxi_id: window.taxiSeleccionadoId
      })
    });

    const data = await res.json();


    if (!data.ok) {
      alert(data.mensaje || 'Error al asignar taxi');
      return;
    }

window.viajeSeleccionado = data.viaje;
window.viajeSeleccionadoId = data.viaje.id;
window.taxiSeleccionadoId = data.viaje.taxi_id;

await cargarPendientes();

mostrarViajeOperativo(data.viaje);

if (typeof window.actualizarBotonesPorEstado === 'function') {
  window.actualizarBotonesPorEstado(data.viaje);
}

if (typeof window.dibujarRutaTaxiAsignado === 'function') {
  await window.dibujarRutaTaxiAsignado(data.viaje);
}

mostrarMensaje('Taxi asignado correctamente');


  } catch (error) {

    console.error('ERROR ASIGNAR TAXI:', error);

    alert('Error al asignar taxi');
  }
}

window.asignarTaxiSeleccionado = asignarTaxiSeleccionado;
window.actualizarBotonesPorEstado = function actualizarBotonesPorEstado(viaje) {
  const acciones = document.getElementById('acciones-viaje');

  const btnAsignar = document.getElementById('btn-asignar-taxi');
  const btnAceptar = document.getElementById('btn-aceptar-viaje');
  const btnRechazar = document.getElementById('btn-rechazar-viaje');
  const btnEnOrigen = document.getElementById('btn-en-origen');
  const btnIniciar = document.getElementById('btn-iniciar-viaje');
  const btnFinalizar = document.getElementById('btn-finalizar-viaje');

  const ocultar = (btn) => {
    if (btn) btn.style.display = 'none';
  };

  const mostrar = (btn) => {
    if (btn) btn.style.display = 'inline-block';
  };

  ocultar(btnAsignar);
  ocultar(btnAceptar);
  ocultar(btnRechazar);
  ocultar(btnEnOrigen);
  ocultar(btnIniciar);
  ocultar(btnFinalizar);

  if (!viaje || !viaje.estado) {
    if (acciones) {
      acciones.classList.add('oculto');
      acciones.style.display = 'none';
    }
    return;
  }

  if (acciones) {
    acciones.classList.remove('oculto');
    acciones.style.display = 'block';
  }

  const estado = viaje.estado;

  if (estado === 'pendiente') {
    mostrar(btnAsignar);
  }

  if (estado === 'asignado') {
    mostrar(btnAceptar);
    mostrar(btnRechazar);
  }

  if (estado === 'en_camino_origen') {
    mostrar(btnEnOrigen);
  }

  if (estado === 'en_origen') {
    mostrar(btnIniciar);
  }

  if (estado === 'en_curso') {
    mostrar(btnFinalizar);
  }
};

// Carga los viajes pendientes desde el backend y los muestra en pantalla
async function cargarPendientes() {


  try {
    const response = await fetch('/viajes?estado=pendiente');
    const result = await response.json();

    const totalActual = result.data ? result.data.length : 0;

    if (
      ultimoTotalPendientes !== 0 &&
      totalActual > ultimoTotalPendientes
    ) {
      const audio = document.getElementById('alerta-sonido');
      if (audio) audio.play();
    }

    ultimoTotalPendientes = totalActual;


    const lista = document.getElementById('lista-pendientes');
    if (!lista) return;

    lista.innerHTML = '';

    if (!result.ok) {
      lista.innerHTML = '<p>Error al cargar viajes</p>';
      dibujarPendientesEnMapa([]);
      return;
    }

    const pendientes = (result.data || []).filter(
      (v) => v.estado === 'pendiente'
    );

  window.totalViajesPendientes = pendientes.length;

if (typeof window.actualizarResumenOperativo === 'function') {
  window.actualizarResumenOperativo();
}

if (pendientes.length === 0) {
  lista.innerHTML = '<p>No hay pendientes</p>';

  if (window.viajeSeleccionado) {
    if (typeof window.actualizarBotonesPorEstado === 'function') {
      window.actualizarBotonesPorEstado(window.viajeSeleccionado);
    }
  } else {
    desactivarBotonesOperativos();

    if (typeof window.actualizarBotonesPorEstado === 'function') {
      window.actualizarBotonesPorEstado(null);
    }

    const acciones = document.getElementById('acciones-viaje');
    if (acciones) {
      acciones.classList.add('oculto');
      acciones.style.display = 'none';
    }
  }

  dibujarPendientesEnMapa([]);
  return;
}

    pendientes.forEach((v) => {
      const card = document.createElement('div');

      card.classList.add('viaje-card');
      card.classList.add('card-viaje');
      card.dataset.viajeId = v.id;

      card.style.border = '1px solid #ddd';
      card.style.borderRadius = '8px';
      card.style.padding = '10px';
      card.style.marginBottom = '10px';
      card.style.background = 'white';
      card.style.cursor = 'pointer';

      card.innerHTML = `
        <div class="pendiente-codigo">
          ${v.codigo || 'Sin código'}
        </div>

        <div class="pendiente-origen">
          📍 ${v.origen_direccion || 'Sin dirección'}
        </div>

        <div class="pendiente-estado">
          ${v.estado || ''}
        </div>
      `;

      card.onclick = (event) => {
        event.stopPropagation();

        window.viajeSeleccionado = v;
        window.viajeSeleccionadoId = v.id;

        seleccionarViaje(v, card);

        if (typeof window.mostrarViajeOperativo === 'function') {
          window.mostrarViajeOperativo(window.viajeSeleccionado);
        }

        if (typeof window.dibujarLineaTaxiPasajero === 'function') {
          window.dibujarLineaTaxiPasajero();
        }

        if (typeof window.actualizarBotonesPorEstado === 'function') {
          window.actualizarBotonesPorEstado(v);
        }
      };

      lista.appendChild(card);
    });

    if (typeof window.actualizarBotonesPorEstado === 'function') {
  window.actualizarBotonesPorEstado(window.viajeSeleccionado || null);
}

    dibujarPendientesEnMapa(pendientes);

  } catch (error) {
    console.error('Error cargando pendientes:', error);

    const lista = document.getElementById('lista-pendientes');
    if (lista) {
      lista.innerHTML = '<p>Error de conexión con el backend</p>';
    }
  }
}
// ==========================
// ESTADOS HUMANOS
// ==========================
function estadoViajeTexto(estado) {
  const estados = {
    pendiente: 'Pendiente',
    en_camino_origen: 'Taxi en camino',
    en_origen: 'En origen',
    en_curso: 'En curso',
    finalizado: 'Finalizado',
    cancelado: 'Cancelado'
  };

  return estados[estado] || estado || 'Sin estado';
}

 // ← cierre de cargarPendientes


// Dibuja en el mapa los puntos de los viajes pendientes

 function dibujarPendientesEnMapa(viajes) {
  marcadoresPendientes.forEach((m) => mapa.removeLayer(m));
  marcadoresPendientes = [];

  viajes.forEach((viaje) => {
    let lat = null;
    let lng = null;
    let esAproximado = false;

    if (viaje.latitud != null && viaje.longitud != null) {
      lat = parseFloat(viaje.latitud);
      lng = parseFloat(viaje.longitud);
    } else if (viaje.origen_latitud != null && viaje.origen_longitud != null) {
      lat = parseFloat(viaje.origen_latitud);
      lng = parseFloat(viaje.origen_longitud);
      esAproximado = true;
    }

    if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
      return;
    }

    const marcador = L.circleMarker([lat, lng], {
      radius: 8,
      color: '#ff6600',
      fillColor: '#ff6600',
      fillOpacity: 0.85
    })
      .addTo(mapa)
      .bindPopup(`
        <strong>${viaje.codigo || 'Sin código'}</strong><br>
        Cliente: ${viaje.cliente_nombre || 'Sin cliente'}<br>
        Taxi: ${viaje.taxi_codigo || 'Sin taxi'}<br>
        Origen: ${viaje.origen_direccion || 'Sin dirección'}<br>
        <em>${esAproximado ? 'Ubicación aproximada' : 'Ubicación real'}</em>
      `);

      marcador._sgofTipo = 'pendiente';

    marcadoresPendientes.push(marcador);
  });
}

function parseFechaLocal(fecha) {
  if (!fecha) return null;

  const limpia = fecha
    .replace('T', ' ')
    .replace('Z', '')
    .replace(/([+-]\d{2}:?\d{2})$/, '')
    .trim();

  const [parteFecha, parteHora] = limpia.split(' ');
  const [anio, mes, dia] = parteFecha.split('-').map(Number);
  const [hora, minuto, segundoRaw] = parteHora.split(':');

  const segundo = parseInt(segundoRaw, 10);

  return new Date(
    anio,
    mes - 1,
    dia,
    Number(hora),
    Number(minuto),
    segundo
  );
}


async function cargarViajeActivo() {
  try {
    const res = await fetch('/viajes');

if (!res.ok) {
  throw new Error(`Error HTTP ${res.status}`);
}

const data = await res.json();
const acciones = document.getElementById('acciones-viaje');

const viajes = Array.isArray(data.data) ? data.data : [];

const estadosAsignados = [
  'asignado',
  'en_camino_origen',
  'en_origen'
];
const estadosActivos = [
  ...estadosAsignados,
  'en_curso'
];

window.totalViajesAsignados = viajes.filter(v =>
  estadosAsignados.includes(v.estado)
).length;

window.totalViajesEnCurso = viajes.filter(v =>
  v.estado === 'en_curso'
).length;

if (typeof window.actualizarResumenOperativo === 'function') {
  window.actualizarResumenOperativo();
}

 const viaje = viajes.find(v =>
  estadosActivos.includes(v.estado)
);


if (!viaje) {


window.viajeSeleccionado = null;
window.viajeSeleccionadoId = null;
window.taxiSeleccionadoId = null;
window.rutaActualOSRM = null;

viajeSeleccionado = null;
viajeSeleccionadoId = null;
taxiSeleccionadoId = null;


 if (typeof window.actualizarBotonesPorEstado === 'function') {
  window.actualizarBotonesPorEstado(null);
}

  if (acciones) {
    acciones.classList.add('oculto');
  }

  const detalle = document.getElementById('detalle-viaje');

  if (detalle) {
    detalle.innerHTML = '';
  }

  return;
}

window.viajeSeleccionado = viaje;
window.viajeSeleccionadoId = viaje.id;
viajeSeleccionadoId = viaje.id;

if (!viaje.taxi_id) {
  window.limpiarTaxiSeleccionado();
}

  if (acciones) {
  acciones.classList.remove('oculto');
}

    mostrarViajeSeleccionadoEnPanel(viaje);

   if (typeof window.actualizarBotonesPorEstado === 'function') {
  window.actualizarBotonesPorEstado(viaje);
}

 } catch (error) {
  console.warn('No se pudo cargar viaje activo. Reintentará en el próximo ciclo.');
}
}

async function cargarViajePorId(id) {
  if (!id) return;

  try {
    const res = await fetch(`/viajes/${id}`);

    if (!res.ok) {
  throw new Error(`Error HTTP ${res.status}`);
}
    const data = await res.json();

    const viaje = data.viaje || data.data;

   if (!viaje || typeof viaje !== 'object') {
  console.warn('No vino viaje válido en la respuesta:', data);
  return;
}

    viajeSeleccionadoId = viaje.id;
    window.viajeSeleccionadoId = viaje.id;

    viajeSeleccionado = viaje;
    window.viajeSeleccionado = viaje;

    if (viaje.taxi_id) {
  taxiSeleccionadoId = viaje.taxi_id;
  window.taxiSeleccionadoId = viaje.taxi_id;
}

if (
  viaje.taxi_id &&
  typeof window.dibujarRutaTaxiAsignado === 'function'
) {
  await window.dibujarRutaTaxiAsignado(viaje);
}

    if (typeof mostrarViajeOperativo === 'function') {
      mostrarViajeOperativo(viaje);
    }

  } catch (error) {
    console.error('Error cargando viaje por ID:', error);
  }
}

function buscarCodigoTaxi(taxiId) {
  const taxi = (window.ultimosTaxis || []).find(t =>
    t.taxi_id === taxiId || t.id === taxiId
  );

  return taxi?.codigo_movil || null;
}

function mostrarViajeOperativo(viaje) {
  const contenedor = document.getElementById('detalle-viaje');
  if (!contenedor) return;

  if (!viaje) {
    contenedor.innerHTML = `
      <div class="viaje-activo-card">
        <div class="viaje-titulo">Sin viaje seleccionado</div>
        <div class="viaje-linea">Ningún viaje seleccionado</div>
      </div>
    `;

    if (typeof window.actualizarBotonesPorEstado === 'function') {
      window.actualizarBotonesPorEstado(null);
    }

    return;
  }

 const estado = viaje.estado || '—';
const codigo = viaje.codigo || 'Sin código';

const taxi =
  viaje.taxi_codigo ||
  viaje.codigo_movil ||
  buscarCodigoTaxi(viaje.taxi_id) ||
  'Sin taxi';

let titulo = 'Viaje seleccionado';
let bloqueTimer = '';
let bloqueAcciones = '';

  if (estado === 'en_camino_origen' && viaje.fecha_hora_asignacion) {
    const segundosPasados = Math.floor(
      (Date.now() - new Date(viaje.fecha_hora_asignacion).getTime()) / 1000
    );

    const restantes = Math.max(0, 30 - segundosPasados);

    if (restantes > 0) {
      bloqueTimer = `
        <div class="${restantes <= 10 ? 'tiempo-urgente' : 'tiempo-normal'}">
          ⏱ ${restantes}s ${restantes <= 10 ? 'URGENTE' : ''}
        </div>
      `;
    }
  }

  contenedor.innerHTML = `
    <div class="viaje-linea"><strong>${codigo}</strong></div>
    <div class="viaje-linea">🚕 ${taxi}</div>
    <div class="viaje-linea">🛣️ ${window.distanciaActualOSRM ?? '—'} km</div>
    <div class="viaje-linea">⏱️ ${window.etaActualOSRM ?? '—'} min</div>
    <div class="viaje-linea">📍 ${estado}</div>
    ${bloqueTimer}
  `;

  if (typeof window.actualizarBotonesPorEstado === 'function') {
    window.actualizarBotonesPorEstado(viaje);
  }
}

window.mostrarViajeOperativo = mostrarViajeOperativo;


async function crearPedidoTest() {

  try {
    const res = await fetch('/viajes/test', {
      method: 'POST'
    });

    const data = await res.json();

    if (!data.ok) {
      alert('Error creando pedido test');
      return;
    }

    alert('Pedido test creado');

    // IMPORTANTE: comentado para probar Socket.IO real
    // await cargarPendientes();

  } catch (e) {
    console.error('Error creando pedido test:', e);
    alert('Error de conexión');
  }
}

window.crearPedidoTest = crearPedidoTest;


function desactivarBotonesOperativos() {
  document.querySelectorAll('#acciones-viaje .btn-operativo').forEach((btn) => {
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';
  });
}

window.cargarPendientes = cargarPendientes;
window.cargarTaxis = cargarTaxis;

window.cargarViajeActivo = cargarViajeActivo;

async function aceptarViaje() {

  if (!window.viajeSeleccionadoId) {
    alert('Seleccioná un viaje primero');
    return;
  }

  try {
  const res = await fetch(`/viajes/${window.viajeSeleccionadoId}/aceptar`, {
    method: 'POST'
  });

    const data = await res.json();

    if (!data.ok) {
      alert(data.mensaje || 'Error al aceptar viaje');
      return;
    }
    window.limpiarTaxiSeleccionado();

    window.viajeSeleccionado = data.viaje;
    window.viajeSeleccionadoId = data.viaje.id;

    window.mostrarViajeOperativo(data.viaje);

    await window.cargarPendientes();
    await window.cargarTaxis();

    window.mostrarMensaje('Viaje aceptado');

  } catch (error) {
    console.error('ERROR ACEPTAR VIAJE:', error);
    alert('Error de conexión al aceptar viaje');
  }
}
window.aceptarViaje = aceptarViaje;


async function rechazarViaje() {
  if (!window.viajeSeleccionadoId) {
    alert('Seleccioná un viaje primero');
    return;
  }

  try {
    const res = await fetch(
      `/viajes/${window.viajeSeleccionadoId}/rechazar`,
      {
        method: 'POST'
      }
    );

    const data = await res.json();

    if (!data.ok) {
      alert(data.mensaje || 'Error al rechazar viaje');
      return;
    }

    window.rutaActualOSRM = null;

    if (window.lineaTaxiPasajero && window.mapa) {
      window.mapa.removeLayer(window.lineaTaxiPasajero);
      window.lineaTaxiPasajero = null;
    }

    if (window.lineaRutaViaje && window.mapa) {
      window.mapa.removeLayer(window.lineaRutaViaje);
      window.lineaRutaViaje = null;
    }


    await window.cargarPendientes();
    await window.cargarTaxis();

    await window.cargarViajePorId(window.viajeSeleccionadoId);

    if (window.viajeSeleccionado?.taxi_id) {
      window.taxiSeleccionadoId = window.viajeSeleccionado.taxi_id;

      if (typeof window.dibujarRutaTaxiAsignado === 'function') {
        await window.dibujarRutaTaxiAsignado(
          window.viajeSeleccionado
        );
      }
    }

    window.mostrarMensaje(
      data.mensaje || 'Viaje rechazado y reasignado'
    );

  } catch (error) {
    console.error('ERROR RECHAZAR VIAJE:', error);
    alert('Error de conexión al rechazar viaje');
  }
}
window.rechazarViaje = rechazarViaje;


async function marcarEnOrigen() {
  if (!window.viajeSeleccionadoId) {
    alert('Seleccioná un viaje primero');
    return;
  }

  try {
    const res = await fetch(
      `/viajes/${window.viajeSeleccionadoId}/en-origen`,
      {
        method: 'PUT'
      }
    );

    const data = await res.json();

    if (!data.ok) {
      alert('Error al actualizar estado');
      return;
    }

    window.viajeSeleccionado = data.viaje;
    window.viajeSeleccionadoId = data.viaje.id;

    window.mostrarViajeOperativo(data.viaje);

    if (typeof window.actualizarBotonesPorEstado === 'function') {
      window.actualizarBotonesPorEstado(data.viaje);
    }

    await window.cargarPendientes();
    await window.cargarTaxis();

    await window.mostrarViajeEnMapa();

  } catch (error) {
    console.error(error);
    alert('Error de conexión');
  }
}
window.marcarEnOrigen = marcarEnOrigen;


async function iniciarViaje() {
  if (window.iniciandoViaje) return;
  window.iniciandoViaje = true;

  if (!window.viajeSeleccionadoId) {
    alert('Seleccioná un viaje primero');
    window.iniciandoViaje = false;
    return;
  }

  try {
    const res = await fetch(
      `/viajes/${window.viajeSeleccionadoId}/iniciar`,
      {
        method: 'POST'
      }
    );

    const data = await res.json();

    if (!data.ok) {
      if (data.mensaje && data.mensaje.includes('estado en_curso')) {
        await window.cargarViajeActivo();
        await window.cargarTaxis();

        if (typeof window.dibujarRutaViajeEnCurso === 'function') {
          await window.dibujarRutaViajeEnCurso(
            window.viajeSeleccionado
          );
        }

        window.iniciandoViaje = false;
        return;
      }

      alert(data.mensaje || 'Error al iniciar viaje');
      window.iniciandoViaje = false;
      return;
    }

    window.viajeSeleccionado = data.viaje;
    window.viajeSeleccionadoId = data.viaje.id;

    const taxiIdEnCurso = data.viaje.taxi_id;
    const markerTaxiEnCurso =
    window.marcadoresPorTaxi?.[taxiIdEnCurso];

    if (
      markerTaxiEnCurso &&
      typeof window.iconoTaxi === 'function'
    ) {
      markerTaxiEnCurso.setIcon(
        window.iconoTaxi({
          taxi_id: taxiIdEnCurso,
          id: taxiIdEnCurso,
          estado: 'ocupado',
          estado_operativo: 'ocupado',
          rumbo_grados: markerTaxiEnCurso._rumbo_grados || 0
        })
      );
    }

    window.dibujarPendientesEnMapa([]);

    if (window.lineaTaxiPasajero && window.mapa) {
      window.mapa.removeLayer(window.lineaTaxiPasajero);
      window.lineaTaxiPasajero = null;
    }

    if (window.lineaRutaViaje && window.mapa) {
      window.mapa.removeLayer(window.lineaRutaViaje);
      window.lineaRutaViaje = null;
    }

    window.rutaActualOSRM = null;

    if (typeof window.dibujarRutaViajeEnCurso === 'function') {
      await window.dibujarRutaViajeEnCurso(
        data.viaje || window.viajeSeleccionado
      );
    }

    await window.cargarViajeActivo();

    if (typeof window.actualizarBotonesPorEstado === 'function') {
      window.actualizarBotonesPorEstado(data.viaje);
    }

    alert('Viaje iniciado');

  } catch (error) {
    console.error(error);
    alert('Error de conexión');

  } finally {
    window.iniciandoViaje = false;
  }
}
window.iniciarViaje = iniciarViaje;


async function finalizarViaje() {
  if (!window.viajeSeleccionadoId) {
    alert('Seleccioná un viaje primero');
    return;
  }

  try {

const idFinalizar = window.viajeSeleccionadoId;

const res = await fetch(`/viajes/${idFinalizar}/finalizar`, {
  method: 'POST'
});


    const data = await res.json();

    if (!data.ok) {
      alert(data.mensaje || 'Error al finalizar viaje');
      return;
    }
window.viajeSeleccionadoId = null;
window.viajeSeleccionado = null;
window.taxiSeleccionadoId = null;
window.rutaActualOSRM = null;
window.seguirTaxiSeleccionado = false;

Object.values(window.marcadoresPorTaxi || {}).forEach(marker => {
  marker._sgofSeleccionado = false;
  marker._sgofAnimando = false;

  const el = marker.getElement?.();

  if (el) {
    el.classList.remove('seleccionado');
  }
});

document.querySelectorAll('.taxi-card.seleccionado').forEach(card => {
  card.classList.remove('seleccionado');
});


    if (window.lineaTaxiPasajero && window.mapa) {
      window.mapa.removeLayer(window.lineaTaxiPasajero);
      window.lineaTaxiPasajero = null;
    }

    if (window.lineaRutaViaje && window.mapa) {
  window.mapa.removeLayer(window.lineaRutaViaje);
  window.lineaRutaViaje = null;
}

window.rutaViajeOSRM = null;

    if (window.mapa) {
  window.mapa.closePopup();
}

    if (window.lineaHistorialGps && window.mapa) {
      window.mapa.removeLayer(window.lineaHistorialGps);
      window.lineaHistorialGps = null;
    }

    if (window.markerOrigen && window.mapa) {
      window.mapa.removeLayer(window.markerOrigen);
      window.markerOrigen = null;
    }

    if (window.markersViajes && window.mapa) {
      window.markersViajes.forEach(marker => {
        window.mapa.removeLayer(marker);
      });
      window.markersViajes = [];
    }

    Object.values(window.marcadoresPorTaxi || {}).forEach(marker => {
      marker._sgofAnimando = false;
    });
 if (data.taxi && window.marcadoresPorTaxi?.[data.taxi.id]) {
  const markerTaxiFinalizado = window.marcadoresPorTaxi[data.taxi.id];

  markerTaxiFinalizado._sgofAnimando = false;

  if (markerTaxiFinalizado._animacionMovimiento) {
    cancelAnimationFrame(markerTaxiFinalizado._animacionMovimiento);
    markerTaxiFinalizado._animacionMovimiento = null;
  }

  const taxiFinalizado = {
    ...data.taxi,
    taxi_id: data.taxi.id,
    estado: 'disponible',
    estado_operativo: 'disponible'
  };

  if (typeof window.iconoTaxi === 'function') {
  markerTaxiFinalizado.setIcon(
    window.iconoTaxi(taxiFinalizado)
  );
}
   markerTaxiFinalizado._sgofFirmaIcono = null;

  if (markerTaxiFinalizado.getElement) {
    const el = markerTaxiFinalizado.getElement();
    if (el) {
      el.classList.remove('seleccionado');
    }
  }
}

window.taxiSeleccionadoId = null;

if (typeof window.limpiarPanelGpsTaxi === 'function') {
  window.limpiarPanelGpsTaxi();
}

if (typeof window.actualizarResumenOperativo === 'function') {
  window.actualizarResumenOperativo();
}
/*
setTimeout(() => {
  cargarTaxis();
}, 500);
*/
    if (typeof window.mostrarViajeSeleccionadoEnPanel === 'function') {
  window.mostrarViajeSeleccionadoEnPanel(null);
}

   if (typeof window.actualizarBotonesPorEstado === 'function') {
   window.actualizarBotonesPorEstado(null);
}
if (Array.isArray(window.marcadoresPendientes) && window.mapa) {
  window.marcadoresPendientes.forEach(marker => {
    window.mapa.removeLayer(marker);
  });

  window.marcadoresPendientes = [];
  window.marcadoresPendientes = [];
}

if (window.mapa) {
  window.mapa.eachLayer(layer => {

    if (
      layer._sgofTipo === 'pendiente' ||
      layer._sgofTipo === 'pasajero'
    ) {
      window.mapa.removeLayer(layer);
    }

  });
}

 if (typeof window.dibujarPendientesEnMapa === 'function') {
  window.dibujarPendientesEnMapa([]);
}

   if (window.mapa) {
   window.mapa.closePopup();
   window.mapa.setView([-34.8879, -56.1403], 13);
}

   alert('Viaje finalizado');

   if (window.lineaTaxiPasajero && window.mapa) {
  window.mapa.removeLayer(window.lineaTaxiPasajero);
  window.lineaTaxiPasajero = null;
}

if (window.lineaRutaViaje && window.mapa) {
  window.mapa.removeLayer(window.lineaRutaViaje);
  window.lineaRutaViaje = null;
}

window.rutaActualOSRM = null;
window.rutaViajeOSRM = null;

  } catch (error) {
    console.error(error);
    alert('Error de conexión');
  }
}
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-nuevo-pedido-test');

  if (!btn) {
    console.error('No existe btn-nuevo-pedido-test');
    return;
  }

  btn.addEventListener('click', crearPedidoTest);

  cargarColaOperativa();

});

window.finalizarViaje = finalizarViaje;