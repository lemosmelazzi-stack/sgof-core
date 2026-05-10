console.log('VIAJES.JS CARGADO');
const timersAsignacion = {};

let ultimoTotalPendientes = 0;
// Maneja la selección de un viaje pendiente y actualiza UI + mapa

function seleccionarViaje(viaje, card) {
  viajeSeleccionadoId = viaje.id;

  document.querySelectorAll('.card-viaje').forEach((el) => {
    el.classList.remove('seleccionado');
  });

  card.classList.add('seleccionado');

  activarBotonesOperativos();

  // 👇 panel operativo
  mostrarViajeOperativo(viaje);

  // 👇 mantener comportamiento de mapa
  centrarMapa(viaje);
  dibujarLineaTaxiPasajero();
}

// Envía al backend la asignación de un taxi a un viaje
async function asignarTaxiSeleccionado(viajeId) {
  if (!viajeId || !taxiSeleccionadoId) {
    mostrarMensaje('Seleccioná un taxi', 'error');
    return;
  }

  const btn = document.getElementById('btn-asignar');

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Asignando...';
      btn.style.opacity = '0.7';
      btn.style.cursor = 'not-allowed';
    }

const res = await fetch(`/viajes/${viajeId}/asignar-taxi`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    taxi_id: taxiSeleccionadoId
  })
});


    const texto = await res.text();
    console.log('Respuesta backend:', texto);

    let data;

    try {
      data = JSON.parse(texto);
    } catch {
      throw new Error(`La respuesta no es JSON. Status ${res.status}`);
    }

    if (!res.ok) {
      throw new Error(data.mensaje || `Error HTTP ${res.status}`);
    }
if (data.ok) {
  mostrarMensaje('Taxi asignado correctamente', 'ok');

  taxiSeleccionadoId = null;
  viajeSeleccionadoId = viajeId;

  await cargarTaxis();
  await cargarPendientes();

  const viajeRes = await fetch(`/viajes/${viajeId}`);
const viajeActualizado = await viajeRes.json();

console.log('VIAJE ACTUALIZADO:', viajeActualizado);

if (viajeActualizado.ok && viajeActualizado.viaje) {
  viajeSeleccionado = viajeActualizado.viaje;
  viajeSeleccionadoId = viajeActualizado.viaje.id;
  mostrarViajeOperativo(viajeActualizado.viaje);

} else if (viajeActualizado.ok && viajeActualizado.data) {
  viajeSeleccionado = viajeActualizado.data;
  viajeSeleccionadoId = viajeActualizado.data.id;
  mostrarViajeOperativo(viajeActualizado.data);

} else {
  console.error('Respuesta inesperada al recargar viaje:', viajeActualizado);
  mostrarMensaje('Asignado, pero no pude recargar el viaje', 'error');
}

  document.querySelectorAll('.card-viaje').forEach((el) => {
    el.style.border = '1px solid #ddd';
    el.style.background = 'white';
  });

  document.querySelectorAll('.taxi-card').forEach((el) => {
    el.classList.remove('seleccionado');
  });

} else {
      mostrarMensaje(data.mensaje || 'No se pudo asignar', 'error');
    }
  } catch (error) {
    console.error('Error al asignar taxi:', error);
    mostrarMensaje(error.message, 'error');
  } finally {
    if (btn && document.body.contains(btn)) {
      btn.disabled = false;
      btn.textContent = 'Asignar taxi seleccionado';
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    }
  }
}
// Carga los viajes pendientes desde el backend y los muestra en pantalla
async function cargarPendientes() {
  console.log('ENTRANDO A cargarPendientes');

  try {
    const response = await fetch('/viajes?estado=pendiente');
    const result = await response.json();

    // 🔔 sonido
   
    const totalActual = result.data ? result.data.length : 0;

if (
  ultimoTotalPendientes !== 0 &&
  totalActual > ultimoTotalPendientes
) {
  document.getElementById('alerta-sonido').play();
}

ultimoTotalPendientes = totalActual;

    ultimoTotalPendientes = result.data ? result.data.length : 0;

    console.log('RESULTADO VIAJES EN MAPA:', result);

    const lista = document.getElementById('lista-pendientes');
    lista.innerHTML = '';

    if (!result.ok) {
      lista.innerHTML = '<p>Error al cargar viajes</p>';
      dibujarPendientesEnMapa([]);
      return;
    }

    const pendientes = (result.data || []).filter((v) => v.estado === 'pendiente');

   if (pendientes.length === 0) {
  lista.innerHTML = '<p>No hay pendientes</p>';

  desactivarBotonesOperativos();
  document.getElementById('acciones-viaje').classList.add('oculto');

  dibujarPendientesEnMapa([]);
  return;
}

    pendientes.forEach((v) => {
      const card = document.createElement('div');
      card.className = 'card-viaje';
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

      card.addEventListener('click', () => seleccionarViaje(v, card));
      lista.appendChild(card);
    });

    activarBotonesOperativos();
    dibujarPendientesEnMapa(pendientes);

  } catch (error) {
    console.error('Error cargando pendientes:', error);

    document.getElementById('lista-pendientes').innerHTML =
      '<p>Error de conexión con el backend</p>';
  }
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

// TIMER SOLO PARA VIAJES ESPERANDO RESPUESTA
const estadosConTimer = ['asignado'];

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

  if (estado === 'asignado') {
    titulo = 'Taxi asignado';

    bloqueAcciones = `
      <button onclick="aceptarViaje()">Aceptar taxi</button>
      <button onclick="rechazarViaje()">Rechazar taxi</button>
    `;
  }

  if (estado === 'en_camino_origen') {
  titulo = 'Taxi en camino al origen';

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

  if (estado === 'en_viaje') {
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
    <div class="viaje-activo-card">
      <div class="viaje-titulo">${titulo}</div>

      <div class="viaje-linea">
        <strong>${codigo}</strong>
      </div>

      <div class="viaje-linea">
        Taxi: ${taxi}
      </div>

      <div class="viaje-linea">
        Estado: ${estado}
      </div>

      ${bloqueTimer}

      <div class="viaje-acciones">
        ${bloqueAcciones}
      </div>
    </div>
  `;
}

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

      if (data.ok) {
        console.log('Viaje asignado automáticamente:', viaje.codigo);
      } else {
        console.log('No se pudo asignar automáticamente:', viaje.codigo, data.mensaje);
      }
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

    const viaje = data.data.find(v =>
      v.estado === 'en_camino_origen' ||
      v.estado === 'en_origen' ||
      v.estado === 'en_viaje'
    );

    if (!viaje) {
      acciones.classList.add('oculto');
      return;
    }

    acciones.classList.remove('oculto');
    mostrarViajeOperativo(viaje);

  } catch (error) {
    console.error('Error cargando viaje activo:', error);
  }
}

async function cargarViajePorId(id) {
  if (!id) return;

  try {
    const res = await fetch(`/viajes/${id}`);
    const data = await res.json();

    console.log('RECARGA VIAJE POR ID:', data);

    const viaje = data.viaje || data.data;

    if (!viaje) {
      console.warn('No vino viaje en la respuesta:', data);
      return;
    }

    viajeSeleccionado = viaje;
    viajeSeleccionadoId = viaje.id;

    mostrarViajeOperativo(viaje);

  } catch (error) {
    console.error('Error cargando viaje por ID:', error);
  }
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
    return;
  }

  const estado = viaje.estado || '—';
  const codigo = viaje.codigo || 'Sin código';
  const taxi = viaje.taxi_codigo || viaje.codigo_movil || viaje.taxi_id || 'Sin taxi';

  let titulo = 'Viaje seleccionado';
  let bloqueTimer = '';
  let bloqueAcciones = '';

  if (estado === 'asignado' && viaje.fecha_hora_asignacion) {
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

  if (estado === 'pendiente') {
    titulo = 'Viaje pendiente';
    bloqueAcciones = `
      <button onclick="asignarTaxiSeleccionado()">Asignar taxi</button>
    `;
  }

  if (estado === 'asignado') {
    titulo = 'Esperando respuesta del taxi';
    bloqueAcciones = `
      <button onclick="aceptarViaje()">Aceptar taxi</button>
      <button onclick="rechazarViaje()">Rechazar taxi</button>
    `;
  }

  if (estado === 'en_camino_origen') {
    titulo = 'Taxi en camino al origen';
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

  if (estado === 'en_viaje') {
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
    <div class="viaje-activo-card">
      <div class="viaje-titulo">${titulo}</div>
      <div class="viaje-linea"><strong>${codigo}</strong></div>
      <div class="viaje-linea">🚕 ${taxi}</div>
      <div class="viaje-linea">📍 ${estado}</div>
      ${bloqueTimer}
      <div class="viaje-acciones">${bloqueAcciones}</div>
    </div>
  `;
}

async function aceptarViaje(viajeId) {
  try {
    const res = await fetch(`/viajes/${viajeId}/aceptar`, {
      method: 'POST'
    });

    const data = await res.json();

    if (!data.ok) {
      console.error('No se pudo aceptar viaje:', data);
      return;
    }

    console.log('Viaje aceptado');
 viajeSeleccionadoId = viajeId;
    await cargarViajePorId(viajeSeleccionadoId);
    await cargarTaxis();
    activarBotonesOperativos();
document.getElementById('acciones-viaje').classList.remove('oculto');

  } catch (e) {
    console.error(e);
  }
}

async function crearPedidoTest() {
  try {
    const res = await fetch('/viajes/test', {
      method: 'POST'
    });

    const data = await res.json();
    const acciones = document.getElementById('acciones-viaje');

    if (!data.ok) {
      alert('Error creando pedido test');
      return;
    }

    alert('Pedido test creado');
    cargarPendientes();

  } catch (e) {
    console.error('Error creando pedido test:', e);
    alert('Error de conexión');
  }
}
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
console.log('GLOBAL cargarPendientes:', typeof window.cargarPendientes);

window.cargarPendientes = cargarPendientes;
window.cargarTaxis = cargarTaxis;
window.cargarViajeActivo = cargarViajeActivo;

console.log('GLOBAL cargarPendientes:', typeof window.cargarPendientes);
//cargarPendientes();
//cargarTaxis();
//cargarViajeActivo();

//setInterval(cargarPendientes, 5000);
//setInterval(cargarTaxis, 3000);
//setInterval(cargarViajeActivo, 1000);