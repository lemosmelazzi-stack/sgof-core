
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



if (typeof window.encontrarMejorTaxiParaViaje === 'function') {
  window.encontrarMejorTaxiParaViaje();
}

   if (typeof encontrarMejorTaxiParaViaje === 'function') {
    encontrarMejorTaxiParaViaje(viaje);
  }
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
await cargarTaxis();

mostrarViajeOperativo(data.viaje);

if (typeof window.actualizarBotonesPorEstado === 'function') {
  window.actualizarBotonesPorEstado(data.viaje);
}

if (typeof window.encontrarMejorTaxiParaViaje === 'function') {
  await window.encontrarMejorTaxiParaViaje();
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

 function mostrarViajeOperativo(viaje) {
    
  const contenedor = document.getElementById('detalle-viaje');
  if (!contenedor) return;

  if (!viaje) {
    contenedor.innerHTML = `
      <div class="viaje-activo-card">
        <div class="viaje-titulo">Sin viaje seleccionado</div>
        <div class="viaje-linea">Seleccione un viaje pendiente.</div>
      </div>
    `;
    return;
  }

    const estado = viaje.estado || '—';
  const codigo = viaje.codigo || 'Sin código';
  const taxi = viaje.taxi_codigo || viaje.codigo_movil || viaje.taxi_id || 'Sin taxi';
let titulo = 'Viaje seleccionado';
let bloqueTimer = '';
let bloqueAcciones = '';

const bloqueETA = `
  <div class="viaje-linea">
    Distancia: ${window.distanciaActualOSRM ?? '—'} km
  </div>
  <div class="viaje-linea">
    ETA: ${window.etaActualOSRM ?? '—'} min
  </div>
`;

// TIMER SOLO PARA VIAJES ESPERANDO RESPUESTA
const estadosConTimer = ['en_camino_origen'];

if (
  estadosConTimer.includes(estado) &&
  viaje.fecha_hora_asignacion
) {
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
  } else {
    bloqueTimer = '';
  }

} else {
  bloqueTimer = '';
}

  // ESTADOS Y BOTONES
  if (estado === 'pendiente') {
    titulo = 'Viaje pendiente';

    bloqueAcciones = `
      <button onclick="asignarTaxiSeleccionado()">Asignar taxi</button>
    `;
  }
if (estado === 'en_camino_origen') {
  titulo = 'Taxi en camino';

    bloqueAcciones = `
      <button onclick="aceptarViaje()">Aceptar taxi</button>
      <button onclick="rechazarViaje()">Rechazar taxi</button>
    `;
  }
if (estado === 'en_camino_origen') {

  titulo = 'Taxi en camino';

  bloqueTimer = '';

  bloqueAcciones = `
    <button onclick="iniciarViaje()">Iniciar viaje</button>
  `;
}

  if (estado === 'en_origen') {
    titulo = 'Taxi en origen';

    bloqueAcciones = `
      <button onclick="iniciarViaje()">Iniciar viaje</button>
    `;
  }

  if (estado === 'en_curso') {
    titulo = 'Viaje en curso';

    bloqueTimer = '';

    bloqueAcciones = `
      <button onclick="finalizarViaje()">Finalizar viaje</button>
    `;
  }

  if (estado === 'finalizado') {
    titulo = 'Viaje finalizado';
    bloqueTimer = '';
    bloqueAcciones = '';
  }

  if (estado === 'cancelado') {
    titulo = 'Viaje cancelado';
    bloqueTimer = '';
    bloqueAcciones = '';
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

async function asignarPendientesAutomaticamente() {
  try {
    const response = await fetch('/viajes?estado=pendiente');
    const result = await response.json();

    if (!result.ok || !result.data || result.data.length === 0) {
      return;
    }

    const pendientes = result.data.filter((v) => v.estado === 'pendiente');

    if (pendientes.length === 0) {
      return;
    }

    for (const viaje of pendientes) {
      const res = await fetch(`/viajes/${viajeSeleccionadoId}/asignar-taxi`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          taxi_id: taxiSeleccionadoId
        })
      });

      const data = await res.json();
    }

    if (typeof marcadoresPendientes !== 'undefined') {
      marcadoresPendientes.forEach((m) => {
        if (mapa.hasLayer(m)) {
          mapa.removeLayer(m);
        }
      });

      marcadoresPendientes = [];
    }

    await cargarPendientes();
    await cargarTaxis();

  } catch (error) {
    console.error('Error en asignación automática total:', error);
  }
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

function parseFechaBackend(fecha) {
  if (!fecha) return null;

  let f = fecha.replace(' ', 'T');

  // si no trae Z ni -03:00, asumimos UTC
  if (!f.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(f)) {
    f += 'Z';
  }

  return new Date(f);
}


async function cargarViajeActivo() {
  try {
    const res = await fetch('/viajes');
    const data = await res.json();

    const acciones = document.getElementById('acciones-viaje');

    const viajes = data.data || [];

window.totalViajesAsignados = viajes.filter(v =>
  v.estado === 'asignado' ||
  v.estado === 'en_camino_origen' ||
  v.estado === 'en_origen'
).length;

window.totalViajesEnCurso = viajes.filter(v =>
  v.estado === 'en_curso'
).length;

if (typeof window.actualizarResumenOperativo === 'function') {
  window.actualizarResumenOperativo();
}

   const viaje = viajes.find(v =>
  v.estado === 'asignado' ||
  v.estado === 'en_camino_origen' ||
  v.estado === 'en_origen' ||
  v.estado === 'en_curso'
); 


if (!viaje) {

 if (window.viajeSeleccionadoId && window.viajeSeleccionado?.estado !== 'finalizado') {
  return;
}

window.viajeSeleccionado = null;
window.viajeSeleccionadoId = null;
window.taxiSeleccionadoId = null;
window.rutaActualOSRM = null;

viajeSeleccionado = null;
viajeSeleccionadoId = null;
taxiSeleccionadoId = null;
rutaActualOSRM = null;

 window.actualizarBotonesPorEstado(null);

  if (acciones) {
    acciones.classList.add('oculto');
  }

  const detalle = document.getElementById('detalle-viaje');

  if (detalle) {
    detalle.innerHTML = '';
  }
  if (typeof cargarTaxis === 'function') {
  await cargarTaxis();
}

  return;
}

window.viajeSeleccionado = viaje;
window.viajeSeleccionadoId = viaje.id;
viajeSeleccionadoId = viaje.id;

const estadosConTaxiActivo = [
  'asignado',
  'en_camino_origen',
  'en_origen',
  'en_curso'
];

if (
  viaje.taxi_id &&
  estadosConTaxiActivo.includes(viaje.estado)
) {
  window.establecerTaxiSeleccionado(viaje.taxi_id);
} else {
  window.limpiarTaxiSeleccionado();
}

acciones.classList.remove('oculto');

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
    const data = await res.json();

    const viaje = data.viaje || data.data;

    if (!viaje) {
      console.warn('No vino viaje en la respuesta:', data);
      return;
    }

    viajeSeleccionadoId = viaje.id;
    window.viajeSeleccionadoId = viaje.id;

    viajeSeleccionado = viaje;
    window.viajeSeleccionado = viaje;

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

async function aceptarViaje() {
  
  if (!viajeSeleccionadoId) {
    alert('Seleccioná un viaje primero');
    return;
  }

  try {
    const res = await fetch(`/viajes/${viajeSeleccionadoId}/aceptar`, {
      method: 'POST'
    });

    const data = await res.json();
    
    if (!data.ok) {
      alert(data.mensaje || 'Error al aceptar viaje');
      return;
    }
    
    alert('Viaje iniciado');


    window.viajeSeleccionado = data.viaje;
    window.viajeSeleccionadoId = data.viaje.id;

    mostrarViajeOperativo(data.viaje);

    await cargarPendientes();
    await cargarTaxis();

    if (typeof window.actualizarBotonesPorEstado === 'function') {
      window.actualizarBotonesPorEstado(data.viaje);
    }

    mostrarMensaje('Viaje aceptado');

  } catch (error) {
    console.error('ERROR ACEPTAR VIAJE:', error);
    alert('Error de conexión al aceptar viaje');
  }
}

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
  
async function rechazarViaje(viajeId) {
  try {
    const res = await fetch(`/viajes/${viajeId}/rechazar-y-reasignar`, {
      method: 'POST'
    });

    const data = await res.json();

    if (!data.ok) {
      alert('Error al rechazar');
      return;
    }

    alert('Taxi rechazado y reasignado');

    await cargarPendientes();
    actualizarTaxisPeriodico();

  } catch (e) {
    console.error('Error al rechazar viaje:', e);
    alert('Error de conexión');
  }
}
function desactivarBotonesOperativos() {
  document.querySelectorAll('#acciones-viaje .btn-operativo').forEach((btn) => {
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';
  });
}

function activarBotonesOperativos() {
  document.querySelectorAll('#acciones-viaje .btn-operativo').forEach((btn) => {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
  });
}
/*
function activarBotonesOperativos() {
  document.querySelectorAll('#acciones-viaje .btn-operativo').forEach((btn) => {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
  });
}
*/
/*document
  .getElementById('btn-asignar-taxi')
  ?.addEventListener('click', async () => {

    if (!window.viajeSeleccionadoId) {
  alert('Seleccioná un viaje');
  return;
}

if (!window.taxiSeleccionadoId) {
  alert('Seleccioná un taxi');
  return;
}

   


    try {

      const response = await fetch('/viajes/asignar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          viaje_id: viajeSeleccionadoId,
          taxi_id: taxiSeleccionadoId
        })
      });

      const result = await response.json();

      if (result.ok) {
        alert('Taxi asignado correctamente');
 await cargarPendientes();
  await cargarViajeActivo();

      } else {
        alert('Error asignando taxi');
      }

    } catch (error) {

      console.error('ERROR ASIGNANDO:', error);

      alert('Error de conexión');
    }
});
*/

window.cargarPendientes = cargarPendientes;
window.cargarTaxis = cargarTaxis;
window.cargarViajeActivo = cargarViajeActivo;

if (typeof finalizarViaje !== 'undefined') {
  window.finalizarViaje = finalizarViaje;
}

if (typeof iniciarViaje !== 'undefined') {
  window.iniciarViaje = iniciarViaje;
}

window.asignarTaxiSeleccionado = asignarTaxiSeleccionado;