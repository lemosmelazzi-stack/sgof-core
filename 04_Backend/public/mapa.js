let marcadorViaje = null;
let mapaAjustado = false;

window.lineaTaxiPasajero = null;
window.rutaViajeOSRM = null;
window.lineaRutaViaje = null;
window.marcadoresPorTaxi = window.marcadoresPorTaxi || {};

let taxisState = new Map();
let cardsPorTaxi = {};

function moverMarkerSuave(marker, nuevaLat, nuevaLng, duracion = 1000) {

    if (!marker || nuevaLat == null || nuevaLng == null) {
        console.warn('moverMarkerSuave: datos inválidos', { marker, nuevaLat, nuevaLng });
        return;
    }

    if (marker._animacionMovimiento) {
        cancelAnimationFrame(marker._animacionMovimiento);
    }

    let inicio = marker.getLatLng?.();

    if (!inicio || inicio.lat == null || inicio.lng == null) {
        inicio = L.latLng(nuevaLat, nuevaLng);
        marker.setLatLng([nuevaLat, nuevaLng]);
        return;
    }

    const destino = L.latLng(nuevaLat, nuevaLng);
    const startTime = performance.now();

    function animar(now) {

        const progreso = Math.min((now - startTime) / duracion, 1);

        const lat = inicio.lat + (destino.lat - inicio.lat) * progreso;
        const lng = inicio.lng + (destino.lng - inicio.lng) * progreso;

       marker.setLatLng([lat, lng]);
marker.update();

        if (progreso < 1) {
            marker._animacionMovimiento = requestAnimationFrame(animar);
        } else {
    marker.setLatLng(destino);
    marker.update();
    marker._animacionMovimiento = null;
}
    }

    marker._animacionMovimiento = requestAnimationFrame(animar);
}

function calcularRumboEntrePuntos(lat1, lng1, lat2, lng2) {
  const dy = lat2 - lat1;
  const dx = lng2 - lng1;

  let angulo = Math.atan2(dx, dy) * 180 / Math.PI;

  if (angulo < 0) {
    angulo += 360;
  }

  return angulo;
}

function moverTaxiPorRutaOSRM(taxiId, ruta, intervalo = 300) {
  if (!taxiId || !Array.isArray(ruta) || ruta.length === 0) return;

  const marker =
  window.marcadoresPorTaxi?.[taxiId];

  if (!marker) {
    console.warn('No existe marker para mover taxi:', taxiId);
    return;
  }

  marker._sgofAnimando = true;

  let i = 0;

 const taxiData = window.ultimosTaxis?.find(t => t.taxi_id === taxiId);

const tieneGpsReal =
  taxiData?.fuente === 'gps' ||
  taxiData?.fuente === 'tablet' ||
  taxiData?.fuente === 'api';

  // false = simulación SGOF
// true = GPS real (bloquea animaciones OSRM)

const usarGpsReal = false;

if (usarGpsReal && tieneGpsReal) {
  marker._sgofAnimando = false;
  return;
}

  function moverSiguienteTramo() {
    if (i >= ruta.length - 1) {
      const [latFinal, lngFinal] = ruta[ruta.length - 1];

      marker.setLatLng([latFinal, lngFinal]);
      marker.update?.();
      marker._sgofAnimando = false;
      

      window.posicionesTaxiSimuladas = window.posicionesTaxiSimuladas || {};
      window.posicionesTaxiSimuladas[taxiId] = {
        lat: latFinal,
        lng: lngFinal
      };
      return;
    }

    const [lat1, lng1] = ruta[i];
    const [lat2, lng2] = ruta[i + 1];

    const rumbo = calcularRumboEntrePuntos(lat1, lng1, lat2, lng2);

    marker._rumbo_grados = rumbo;

    marker.setIcon(iconoTaxi({
  ...(taxiData || {}),
  rumbo_grados: rumbo
}));

   const inicio = performance.now();

    function animar(now) {
      const progreso = Math.min((now - inicio) / intervalo, 1);

      const lat = lat1 + (lat2 - lat1) * progreso;
      const lng = lng1 + (lng2 - lng1) * progreso;

      marker.setLatLng([lat, lng]);
      marker.update?.();
     // aplicarRumboMarker(marker, rumbo);
      if (progreso < 1) {
        requestAnimationFrame(animar);
      } else {
        window.posicionesTaxiSimuladas = window.posicionesTaxiSimuladas || {};
        window.posicionesTaxiSimuladas[taxiId] = {
          lat: lat2,
          lng: lng2
        };

        i++;
        requestAnimationFrame(moverSiguienteTramo);
      }
    }

    requestAnimationFrame(animar);
  }

  moverSiguienteTramo();
}

window.moverTaxiPorRutaOSRM = moverTaxiPorRutaOSRM;

function animar(now) {
  let total = 0;

  for (let i = 1; i < coords.length; i++) {
    const [lat1, lng1] = coords[i - 1];
    const [lat2, lng2] = coords[i];

    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    total += R * c;
  }

  return total;
}


async function verHistorialGpsTaxi(taxiId) {
    try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const desde = hoy.toISOString();

    const res = await fetch(
      `/gps/historial/${taxiId}?desde=${encodeURIComponent(desde)}`
    );
    const data = await res.json();

    if (!data.ok || !Array.isArray(data.puntos)) {
      alert('No se pudo cargar el historial GPS');
      return;
    }

    if (data.puntos.length < 2) {
      alert('No hay suficiente historial GPS para dibujar una ruta');
      return;
    }

    const coords = data.puntos
      .map(p => [Number(p.latitud), Number(p.longitud)])
      .filter(([lat, lng]) =>
        Number.isFinite(lat) && Number.isFinite(lng)
      );

    if (coords.length < 2) {
      alert('No hay coordenadas suficientes para dibujar la ruta');
      return;
    }

    if (window.lineaHistorialGps) {
      window.mapa.removeLayer(window.lineaHistorialGps);
    }

    window.lineaHistorialGps = L.polyline(coords, {
      color: '#2563eb',
      weight: 5,
      opacity: 0.8
    }).addTo(window.mapa);

   if (window.marcadorInicioHistorialGps) {
  window.mapa.removeLayer(window.marcadorInicioHistorialGps);
}

if (window.marcadorFinHistorialGps) {
  window.mapa.removeLayer(window.marcadorFinHistorialGps);
}
window.marcadorInicioHistorialGps = L.circleMarker(coords[0], {
  radius: 8,
  color: '#22c55e',
  fillColor: '#22c55e',
  fillOpacity: 0.9
})
  .addTo(window.mapa)
  .bindPopup('🟢 Inicio del recorrido GPS');

window.marcadorFinHistorialGps = L.circleMarker(coords[coords.length - 1], {
  radius: 9,
  color: '#ef4444',
  fillColor: '#ef4444',
  fillOpacity: 0.9
})
  .addTo(window.mapa)
  .bindPopup('🔴 Fin / última posición GPS');

    window.mapa.fitBounds(
      window.lineaHistorialGps.getBounds(),
      { padding: [30, 30] }
    );

    const primero = data.puntos[0];
    const ultimo = data.puntos[data.puntos.length - 1];

    const fechaInicioTexto = new Date(primero.fecha_hora_gps).toLocaleString('es-UY');
    const fechaFinTexto = new Date(ultimo.fecha_hora_gps).toLocaleString('es-UY');

     const distanciaKm = calcularDistanciaKm(coords);
     window.distanciaHistorialGps = distanciaKm;

     const velocidades = data.puntos
  .map(p => Number(p.velocidad_kmh))
  .filter(v => Number.isFinite(v));

const velocidadPromedio = velocidades.length > 0
  ? velocidades.reduce((a, b) => a + b, 0) / velocidades.length
  : 0;

window.velocidadPromedioHistorialGps = velocidadPromedio;

let segundosMovimiento = 0;

for (let i = 1; i < data.puntos.length; i++) {

  const actual = data.puntos[i];
  const anterior = data.puntos[i - 1];

  const velocidad = Number(actual.velocidad_kmh) || 0;

  if (velocidad > 0) {

    const fechaActual = new Date(actual.fecha_hora_gps);
    const fechaAnterior = new Date(anterior.fecha_hora_gps);

    segundosMovimiento +=
      (fechaActual - fechaAnterior) / 1000;
  }
}

window.tiempoMovimientoGps =
  Math.round(segundosMovimiento / 60);

const inicioMovimiento = new Date(
  data.puntos[0].fecha_hora_gps
);

const finMovimiento = new Date(
  data.puntos[data.puntos.length - 1].fecha_hora_gps
);

const minutosTotales =
  (finMovimiento - inicioMovimiento) / 1000 / 60;

window.tiempoDetenidoGps =
  Math.max(
    0,
    Math.round(minutosTotales) -
    window.tiempoMovimientoGps
  );

    window.lineaHistorialGps.bindPopup(`
  <strong>Historial GPS</strong><br>
  Puntos: ${coords.length}<br>
  Distancia: ${distanciaKm.toFixed(2)} km<br>
  Desde: ${fechaInicioTexto}<br>
  Hasta: ${fechaFinTexto}
`).openPopup();

  if (window.markerOrigen) {
  mapa.removeLayer(window.markerOrigen);
  window.markerOrigen = null;
}

if (typeof cargarTaxis === 'function') {
  cargarTaxis();
}

document.getElementById('acciones-viaje')
  .classList.add('oculto');





  } catch (error) {
    console.error('Error cargando historial GPS:', error);
    alert('Error cargando historial GPS');
  }
}

window.verHistorialGpsTaxi = verHistorialGpsTaxi;

if (!window.mapa || typeof window.mapa.addLayer !== 'function') {
  window.mapa = L.map('mapa').setView([-34.90, -56.16], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(window.mapa);
}

window.marcadoresPendientes = window.marcadoresPendientes || [];
var marcadoresPendientes = window.marcadoresPendientes;

const socket = io();
socket.on('viaje-creado', async (viaje) => {

  await cargarPendientes();
});

socket.on('viaje-actualizado', async (viaje) => {
  const estado = viaje?.estado;

  if (
    estado === 'en_camino_origen' ||
    estado === 'en_origen' ||
    estado === 'en_curso' ||
    estado === 'finalizado'
  ) {
    await cargarViajeActivo();
    return;
  }

  await cargarPendientes();
  await cargarViajeActivo();
});

socket.on('taxi-actualizado', async () => {
  await cargarTaxis();

});

socket.on('cola-operativa-actualizada', async () => {
  await cargarColaOperativa();
});

socket.on('taxi_posicion', (data) => {
  const taxiId = data.taxiId || data.taxi_id;

  const nuevaLat = Number(data.lat ?? data.latitud);
  const nuevaLng = Number(data.lng ?? data.longitud);

  const marker =
  window.marcadoresPorTaxi?.[taxiId];

  if (!taxiId || !marker) {
    return;
  }

  if (!Number.isFinite(nuevaLat) || !Number.isFinite(nuevaLng)) return;

  marker._sgofTipo = 'taxi';
  marker._rumbo_grados = data.rumbo_grados;

  window.posicionesTaxiSimuladas =
    window.posicionesTaxiSimuladas || {};

  window.posicionesTaxiSimuladas[taxiId] = {
    lat: nuevaLat,
    lng: nuevaLng
  };

  moverMarkerSuave(marker, nuevaLat, nuevaLng, 900);

  marker._rumbo_grados = data.rumbo_grados;

  if (typeof iconoTaxi === 'function') {
    marker.setIcon(iconoTaxi({
     taxi_id: taxiId,
      codigo_movil: data.codigo_movil,
      estado_operativo: data.estado || 'disponible',
      estado: data.estado || 'disponible',
      velocidad_kmh: data.velocidad_kmh,
      fecha_hora_gps: data.fecha_hora_gps,
      fuente: data.fuente,
      rumbo_grados: data.rumbo_grados
    }));
  }

  marker.bindPopup(`
    🚕 <strong>${data.codigo_movil || data.codigo || data.taxiId}</strong><br>
    Estado: ${data.estado || 'disponible'}<br>
    Velocidad: ${data.velocidad_kmh ?? 'sin dato'} km/h<br>
    Rumbo: ${data.rumbo_grados ?? 'sin dato'}°<br>
    Fuente: ${data.fuente || 'sin dato'}<br>
    GPS: ${data.fecha_hora_gps || 'sin fecha'}
  `);

 if (typeof cargarTaxis === 'function') {
  setTimeout(() => {
    cargarTaxis();
  }, 800);
}


});

async function cargarColaOperativa() {
  try {
    const contenedor = document.getElementById('cola-operativa-contenido');
    if (!contenedor) return;

    const res = await fetch('/taxis/cola');
    const data = await res.json();

    if (!data.ok || !Array.isArray(data.data)) {
      contenedor.innerHTML = 'No se pudo cargar la cola.';
      return;
    }

    const cola = data.data;

    if (cola.length === 0) {
      contenedor.innerHTML = 'No hay taxis en cola.';
      return;
    }

    const proximo = cola.find(t =>
      t.estado === 'disponible' &&
      t.activo !== false
    );

    contenedor.innerHTML = `
      <div style="margin-bottom: 8px;">
        <strong>Próximo:</strong>
        ${proximo ? `➡ ${proximo.codigo_movil}` : '—'}
      </div>

      ${cola.map((taxi, index) => `
        <div style="
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          border-bottom: 1px solid #1e293b;
        ">
          <span>${index + 1}. ${taxi.codigo_movil}</span>
          <span>${taxi.estado || '—'}</span>
        </div>
      `).join('')}
    `;

      } catch (error) {
    const contenedor = document.getElementById('cola-operativa-contenido');

    if (contenedor) {
      contenedor.innerHTML = 'Cola no disponible momentáneamente.';
    }
  }
}

function obtenerViajeIdDesdeURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('viajeId');
}
async function mostrarViajeEnMapa() {
  try {
    const viajeId = obtenerViajeIdDesdeURL();

    if (!viajeId) {
      if (window.viajeSeleccionadoId) {
        return;
      }

      mostrarViajeSeleccionadoEnPanel(null);
      return;
    }
    const panelDetalle = document.getElementById('detalle-viaje');
if (panelDetalle) {
  panelDetalle.innerHTML = `
    <div style="padding:10px; color:#888;">
      Ningún viaje seleccionado
    </div>
  `;
}

const accionesViaje = document.getElementById('acciones-viaje');
if (accionesViaje) {
  accionesViaje.classList.add('oculto');
  accionesViaje.style.display = 'none';
}

    const res = await fetch(`/viajes/${viajeId}`);
    const data = await res.json();
    const viaje = data.data || data;

    if (!viaje || viaje.estado === 'finalizado' || viaje.estado === 'cancelado') {
  window.viajeSeleccionado = null;
  window.viajeSeleccionadoId = null;
  mostrarViajeSeleccionadoEnPanel(null);
  return;
}

   window.viajeSeleccionadoId = viaje.id;
window.viajeSeleccionado = viaje;

mostrarViajeSeleccionadoEnPanel(viaje);
centrarMapa(viaje);

  } catch (error) {
    console.error('Error cargando viaje:', error);
    mostrarViajeSeleccionadoEnPanel(null);
  }
}

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
    window.taxiSeleccionadoId = data.viaje.taxi_id || window.taxiSeleccionadoId;

if (typeof window.dibujarLineaTaxiPasajero === 'function') {
  await window.dibujarLineaTaxiPasajero();
}

    mostrarViajeOperativo(data.viaje);
    await cargarPendientes();

    mostrarMensaje('Taxi asignado correctamente');

  } catch (error) {

    console.error('ERROR ASIGNAR TAXI:', error);

    alert('Error al asignar taxi');
  }
}
window.asignarTaxiSeleccionado = asignarTaxiSeleccionado;


async function asignacionAutomaticaPorCola() {
  if (!window.viajeSeleccionadoId) {
    alert('Seleccioná un viaje primero');
    return;
  }

  try {
   const res = await fetch(`/viajes/${window.viajeSeleccionadoId}/asignar-automatico`, {
  method: 'POST'
});

    const data = await res.json();

    if (!data.ok) {
      alert(data.mensaje || 'Error en asignación automática');
      return;
    }

    alert(data.mensaje || 'Taxi inteligente asignado');

await cargarViajePorId(window.viajeSeleccionadoId);
await cargarPendientes();


  } catch (error) {
    console.error(error);
    alert('Error de conexión');
  }
}

function calcularDistancia(lat1, lng1, lat2, lng2) {
  const R = 6371000; // metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI/180) *
    Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function mostrarMensaje(texto, tipo = 'ok') {
  const box = document.getElementById('feedback');
  if (!box) return;

  box.textContent = texto;
  box.style.display = 'block';
  box.style.background = tipo === 'ok' ? '#d4edda' : '#f8d7da';
  box.style.color = tipo === 'ok' ? '#155724' : '#721c24';
  box.style.border = tipo === 'ok'
    ? '1px solid #c3e6cb'
    : '1px solid #f5c6cb';

  setTimeout(() => {
    box.style.display = 'none';
    box.textContent = '';
  }, 3000);
}

//mostrarViajeEnMapa();
function mostrarViajeSeleccionadoEnPanel(viaje) {
  const panel = document.getElementById('detalle-viaje');
  const acciones = document.getElementById('acciones-viaje');
  const bloque = document.getElementById('bloque-viaje-seleccionado');
  if (!panel) return;

  if (
  viaje &&
  viaje.estado &&
  viaje.estado !== 'pendiente'
) {

  if (viaje.taxi_id) {
  window.establecerTaxiSeleccionado(viaje.taxi_id);
}

  mostrarViajeOperativo(viaje);

return;
}

  if (
    !viaje ||
    viaje.estado === 'finalizado' ||
    viaje.estado === 'cancelado'
  ) {
    panel.innerHTML = '';
panel.style.display = 'none';

if (bloque) {
  bloque.style.display = 'none';
}
window.viajeSeleccionado = null;
window.viajeSeleccionadoId = null;

    if (acciones) {
      acciones.classList.add('oculto');
      acciones.style.display = 'none';
    }

    return;
  }

  window.viajeSeleccionadoId = viaje.id;
  window.viajeSeleccionado = viaje;

  if (bloque) {
  bloque.style.display = 'block';
}

panel.style.display = 'block';

  if (acciones) {
    acciones.classList.remove('oculto');
    acciones.style.display = 'block';
  }

  panel.innerHTML = `
    <div style="padding:10px; border:1px solid #ddd; border-radius:6px;">
      <h3 style="margin:0 0 8px 0;">Viaje seleccionado</h3>

      <p><strong>Código:</strong> ${viaje.codigo || '-'}</p>
      <p><strong>Cliente:</strong> ${viaje.cliente_nombre || '-'}</p>
      <p><strong>Origen:</strong> ${viaje.origen_direccion || viaje.origen_texto || '-'}</p>
      <p><strong>Destino:</strong> ${viaje.destino_direccion || viaje.destino_texto || '-'}</p>
      <p><strong>Taxi:</strong> ${viaje.taxi_codigo || viaje.taxi_codigo_movil || 'Sin asignar'}</p>
    </div>
  `;
}

function centrarMapa(viaje) {
  let lat;
  let lng;

  if (!viaje.origen_latitud || !viaje.origen_longitud) {
    lat = -34.9011;
    lng = -56.1645;
  } else {
    lat = parseFloat(viaje.origen_latitud);
    lng = parseFloat(viaje.origen_longitud);
  }

if (!mapaAjustado) {
  mapa.flyTo([lat, lng], 16, {
    animate: true,
    duration: 1
  });

  mapaAjustado = true;
}

if (!lat || !lng) return;

if (marcadorViaje) {
  mapa.removeLayer(marcadorViaje);
}

marcadorViaje = L.marker([lat, lng])
  .addTo(window.mapa)
  .bindPopup(`
    <strong>${viaje.codigo || ''}</strong><br>
    ${viaje.cliente_nombre || ''}<br>
    ${viaje.origen_direccion || ''}
  `)
  .openPopup();
  marcadorViaje._sgofTipo = 'pasajero';
}

const btnAsignarTaxi = document.getElementById('btn-asignar-taxi');
const btnEnOrigen = document.getElementById('btn-en-origen');
const btnIniciarViaje = document.getElementById('btn-iniciar-viaje');
const btnFinalizarViaje = document.getElementById('btn-finalizar-viaje');
const btnAceptarViaje = document.getElementById('btn-aceptar-viaje');
const btnRechazarViaje = document.getElementById('btn-rechazar-viaje');
const btnAsignarAuto = document.getElementById('btn-asignar-auto');
const btnAsignarAutoCola = document.getElementById('btn-asignar-auto-cola');

if (btnAsignarTaxi) {
  btnAsignarTaxi.onclick = asignarTaxiSeleccionado;
}

if (btnAsignarAuto) {
  btnAsignarAuto.onclick = asignarTaxiSeleccionado;
}
if (btnAsignarAutoCola) {
  btnAsignarAutoCola.onclick = asignacionAutomaticaPorCola;
};


if (btnEnOrigen) {
  btnEnOrigen.onclick = () => window.marcarEnOrigen();
}

if (btnIniciarViaje) {
  btnIniciarViaje.onclick = () => window.iniciarViaje();
}

if (btnFinalizarViaje) {
  btnFinalizarViaje.onclick = () => window.finalizarViaje();
}

if (btnAceptarViaje) {
btnAceptarViaje.onclick = () => window.aceptarViaje();
}

if (btnRechazarViaje) {
  btnRechazarViaje.onclick = () => window.rechazarViaje();
}


// ==========================
// INICIAR VIAJE

let iniciandoViaje = false;


// ==========================

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-nuevo-pedido-test');

  if (!btn) {
    console.error('No existe btn-nuevo-pedido-test');
    return;
  }

  btn.addEventListener('click', crearPedidoTest);

  cargarColaOperativa();

});