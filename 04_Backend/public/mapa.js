let marcadorViaje = null;
let mapaAjustado = false;
let taxiSeleccionadoId = null;
let seguirTaxiSeleccionado = true;
let viajeSeleccionadoId = null;
let lineaTaxiPasajero = null;
window.marcadoresPorTaxi = window.marcadoresPorTaxi || {};
window.taxisMarkers = window.taxisMarkers || {};
window.lineaTaxiPasajero = lineaTaxiPasajero;
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

function moverTaxiPorRutaOSRM(taxiId, ruta, intervalo = 300) {
  if (!taxiId || !Array.isArray(ruta) || ruta.length === 0) return;

  const marker =
    window.marcadoresPorTaxi?.[taxiId] ||
    window.taxisMarkers?.[taxiId];

  if (!marker) {
    console.warn('No existe marker para mover taxi:', taxiId);
    return;
  }

  let i = 0;

  const taxiData = window.ultimosTaxis?.find(t => t.taxi_id === taxiId);

console.log('DEBUG BLOQUEO GPS', {
  taxiId,
  taxiData
});

const modoTest = true;

if (!modoTest && taxiData && taxiData.fuente === 'gps') {
  console.log('SIMULACIÓN BLOQUEADA: taxi con GPS real', taxiId);
  return;
}

if (modoTest && taxiData && taxiData.fuente === 'gps') {
  console.log('MODO TEST: permitiendo simulación aunque tenga GPS real', taxiId);
}

  function moverSiguienteTramo() {
    if (i >= ruta.length - 1) {
      const [latFinal, lngFinal] = ruta[ruta.length - 1];

      marker.setLatLng([latFinal, lngFinal]);
      marker.update?.();

      window.posicionesTaxiSimuladas = window.posicionesTaxiSimuladas || {};
      window.posicionesTaxiSimuladas[taxiId] = {
        lat: latFinal,
        lng: lngFinal
      };

      console.log('TAXI FIJADO EN DESTINO:', {
        taxiId,
        latFinal,
        lngFinal
      });

      return;
    }

    const [lat1, lng1] = ruta[i];
    const [lat2, lng2] = ruta[i + 1];

    const inicio = performance.now();

    function animar(now) {
      const progreso = Math.min((now - inicio) / intervalo, 1);

      const lat = lat1 + (lat2 - lat1) * progreso;
      const lng = lng1 + (lng2 - lng1) * progreso;

      marker.setLatLng([lat, lng]);
      marker.update?.();

      if (progreso < 1) {
        requestAnimationFrame(animar);
      } else {
        window.posicionesTaxiSimuladas = window.posicionesTaxiSimuladas || {};
        window.posicionesTaxiSimuladas[taxiId] = {
          lat: lat2,
          lng: lng2
        };
        i++;
        moverSiguienteTramo();
      }
    }
    requestAnimationFrame(animar);
  }
  moverSiguienteTramo();
}
window.moverTaxiPorRutaOSRM = moverTaxiPorRutaOSRM;

async function verHistorialGpsTaxi(taxiId) {
  try {
    const res = await fetch(`/gps/historial/${taxiId}`);
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

    window.mapa.fitBounds(
      window.lineaHistorialGps.getBounds(),
      { padding: [30, 30] }
    );

    const primero = data.puntos[0];
    const ultimo = data.puntos[data.puntos.length - 1];

    const fechaInicio = new Date(primero.fecha_hora_gps).toLocaleString('es-UY');
    const fechaFin = new Date(ultimo.fecha_hora_gps).toLocaleString('es-UY');

    window.lineaHistorialGps.bindPopup(`
      <strong>Historial GPS</strong><br>
      Puntos: ${coords.length}<br>
      Desde: ${fechaInicio}<br>
      Hasta: ${fechaFin}
    `).openPopup();

    console.log('Historial GPS dibujado:', coords.length, 'puntos');

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

console.log('MAPA CREADO');
const socket = io();
socket.on('connect', () => {
  console.log('Conectado a Socket.IO:', socket.id);
});

socket.on('mensaje-test', (data) => {
  console.log('SOCKET TEST:', data);
});

socket.on('viaje-creado', async (viaje) => {
  console.log('SOCKET viaje-creado:', viaje);
  await cargarPendientes();
});

socket.on('viaje-actualizado', async (viaje) => {
  console.log('SOCKET viaje-actualizado:', viaje);
  await cargarPendientes();
  await cargarViajeActivo();
});

socket.on('taxi-actualizado', async (taxi) => {
  console.log('SOCKET taxi-actualizado:', taxi);
  await cargarTaxis();
});
socket.on('taxi_posicion', (data) => {
  const marker = window.taxisMarkers?.[data.taxiId];

  if (!marker) return;

  marker._sgofTipo = 'taxi';

  const posicionAnterior = marker.getLatLng?.();

  const nuevaLat = Number(data.lat ?? data.latitud);
  const nuevaLng = Number(data.lng ?? data.longitud);
/*
 console.log('GPS SOCKET NUMEROS:', {
  taxiId: data.taxiId,
  nuevaLat,
  nuevaLng,
  markerExiste: !!marker,
  posicionAntes: marker.getLatLng()
});
*/

  if (!Number.isFinite(nuevaLat) || !Number.isFinite(nuevaLng)) return;
  window.posicionesTaxiSimuladas =
  window.posicionesTaxiSimuladas || {};

window.posicionesTaxiSimuladas[data.taxiId] = {
  lat: nuevaLat,
  lng: nuevaLng
};
/*
console.log(
  'GUARDANDO POSICION SIMULADA:',
  data.taxiId,
  window.posicionesTaxiSimuladas[data.taxiId]
);
*/
  moverMarkerSuave(marker, nuevaLat, nuevaLng, 900);

  
  marker.bindPopup(`
    🚕 <strong>${data.codigo_movil || data.codigo || data.taxiId}</strong><br>
    Estado: ${data.estado || 'disponible'}<br>
    Velocidad: ${data.velocidad_kmh ?? 'sin dato'} km/h<br>
    GPS: ${data.fecha_hora_gps || 'sin fecha'}
  `);

  if (window.posicionesTaxiSimuladas) {
    window.posicionesTaxiSimuladas[data.taxiId] = {
      lat: nuevaLat,
      lng: nuevaLng
    };
/*
    console.log('POSICION GUARDADA SOCKET:', window.posicionesTaxiSimuladas[data.taxiId]);
 */
    }  
});

function actualizarOrientacionTaxi(marker, latAnterior, lngAnterior, latNueva, lngNueva) {

    if (
        latAnterior == null ||
        lngAnterior == null ||
        latNueva == null ||
        lngNueva == null
    ) {
        return;
    }

    const dy = latNueva - latAnterior;
    const dx = lngNueva - lngAnterior;

    if (Math.abs(dx) < 0.000001 && Math.abs(dy) < 0.000001) {
        return;
    }

    const angulo = Math.atan2(dx, dy) * (180 / Math.PI);

    const icono = marker.getElement?.();

    if (!icono) return;

    icono.style.transformOrigin = 'center center';
    icono.style.transform += ` rotate(${angulo}deg)`;
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

viajeSeleccionadoId = viaje.id;

mostrarViajeSeleccionadoEnPanel(viaje);
centrarMapa(viaje);

  } catch (error) {
    console.error('Error cargando viaje:', error);
    mostrarViajeSeleccionadoEnPanel(null);
  }
}

/*async function asignarTaxiSeleccionado() {

  if (!viajeSeleccionadoId && window.viajeSeleccionadoId) {
    viajeSeleccionadoId = window.viajeSeleccionadoId;
  }

  if (!viajeSeleccionado && window.viajeSeleccionado) {
    viajeSeleccionado = window.viajeSeleccionado;
  }

  if (!viajeSeleccionadoId) {
    const cardSeleccionada = document.querySelector('.card-viaje.seleccionado');

    if (cardSeleccionada?.dataset?.viajeId) {
      viajeSeleccionadoId = cardSeleccionada.dataset.viajeId;
    }
  }

  console.log('CLICK asignarTaxiSeleccionado', {
    viajeSeleccionadoId,
    taxiSeleccionadoId
  });

  if (!viajeSeleccionadoId) {
    alert('Primero seleccioná un viaje.');
    return;
  }

  if (!taxiSeleccionadoId) {
    alert('Primero seleccioná un taxi.');
    return;
  }

  // acá sigue tu fetch('/viajes/asignar'...)

 window.dibujarLineaTaxiPasajero = function () {
  console.log('ENTRÉ A DIBUJAR LINEA');

  if (!window.viajeSeleccionadoId && window.viajeSeleccionado?.id) {
    window.viajeSeleccionadoId = window.viajeSeleccionado.id;
  }

  if (!window.taxiSeleccionadoId || !window.viajeSeleccionado) {
    console.log('Falta taxi o viaje', {
      taxi: window.taxiSeleccionadoId,
      viaje: window.viajeSeleccionado
    });
    return;
  }

  const markerTaxi = window.marcadoresPorTaxi?.[window.taxiSeleccionadoId];

  if (!markerTaxi) {
    console.warn('No encontré markerTaxi:', window.taxiSeleccionadoId);
    return;
  }

  const latViaje = Number(
    window.viajeSeleccionado.origen_latitud ??
    window.viajeSeleccionado.latitud
  );

  const lngViaje = Number(
    window.viajeSeleccionado.origen_longitud ??
    window.viajeSeleccionado.longitud
  );

  if (!Number.isFinite(latViaje) || !Number.isFinite(lngViaje)) {
    console.warn('Viaje sin coordenadas para línea:', window.viajeSeleccionado);
    return;
  }

  const posTaxi = markerTaxi.getLatLng();
  const posViaje = L.latLng(latViaje, lngViaje);

  window.dibujarRutaRealTaxiPasajero(posTaxi, posViaje);
};

  if (!window.viajeSeleccionadoId) {
  alert('Seleccioná un viaje');
  return;
}

  if (!taxiSeleccionadoId) {
    alert('Primero seleccioná un taxi.');
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

  console.log('RESPUESTA ASIGNAR MAPA.JS:', data);  

if (!data.ok) {
  alert('Error al asignar taxi');
  return;
}

// 👇 ESTO ES LO QUE FALTA
viajeSeleccionado = data.viaje;
viajeSeleccionadoId = data.viaje.id;
mostrarViajeOperativo(data.viaje);
*/

async function asignarTaxiSeleccionado() {
  console.log('ANTES DE VALIDAR ASIGNAR:', {
  windowViajeId: window.viajeSeleccionadoId,
  windowViaje: window.viajeSeleccionado,
  windowTaxiId: window.taxiSeleccionadoId
});

  console.log('CLICK asignarTaxiSeleccionado');

  console.log('ESTADO WINDOW:', {
  viajeId: window.viajeSeleccionadoId,
  viaje: window.viajeSeleccionado,
  taxi: window.taxiSeleccionadoId
});

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


  console.log('DATOS ASIGNAR:', {
    viaje: window.viajeSeleccionadoId,
    taxi: window.taxiSeleccionadoId
  });

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

    console.log('RESPUESTA ASIGNAR:', data);

    if (!data.ok) {
      alert(data.mensaje || 'Error al asignar taxi');
      return;
    }

    window.viajeSeleccionado = data.viaje;
    window.viajeSeleccionadoId = data.viaje.id;

    mostrarViajeOperativo(data.viaje);

    await cargarPendientes();
    await cargarTaxis();

    mostrarMensaje('Taxi asignado correctamente');

  } catch (error) {

    console.error('ERROR ASIGNAR TAXI:', error);

    alert('Error al asignar taxi');
  }
}
window.asignarTaxiSeleccionado = asignarTaxiSeleccionado;

console.log(
  'GLOBAL asignarTaxiSeleccionado:',
  window.asignarTaxiSeleccionado.toString().slice(0, 120)
);

/*await cargarPendientes();
await cargarTaxis();
mostrarViajeOperativo(viajeSeleccionado);
const accionesViaje = document.getElementById('acciones-viaje');
if (accionesViaje) {
  accionesViaje.classList.remove('oculto');
  accionesViaje.style.setProperty('display', 'block', 'important');
}

await cargarPendientes();
await cargarTaxis();

    alert('Taxi asignado correctamente.');

    //await mostrarViajeEnMapa();


  } catch (error) {
    console.error('Error asignando taxi:', error);
    alert('Error al asignar taxi.');
  }
}
*/
function seleccionarMejorTaxi(origen, taxis) {

  // SIN FILTRO (temporal)
  const disponibles = taxis;

  if (disponibles.length === 0) return null;

  disponibles.sort((a, b) => a.posicion_cola - b.posicion_cola);

  const taxiBase = disponibles[0];

const distBase = calcularDistancia(
  origen.lat,
  origen.lng,
  parseFloat(taxiBase.latitud),
  parseFloat(taxiBase.longitud)
);

let mejorTaxi = taxiBase;

disponibles.forEach(taxi => {
  const dist = calcularDistancia(
    origen.lat,
    origen.lng,
    parseFloat(taxi.latitud),
    parseFloat(taxi.longitud)
  );

  if ((distBase - dist) > 500) {
    mejorTaxi = taxi;
  }
});

 

  return mejorTaxi;
}

window.seleccionarMejorTaxi = seleccionarMejorTaxi;

async function asignarAutomatico() {
  if (!viajeSeleccionadoId) {
    alert('Seleccioná un viaje primero');
    return;
  }
 
  try {
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

    if (!data.ok) {
      alert(data.mensaje || 'Error en asignación automática');
      return;
    }

    alert('Taxi inteligente asignado');

    await mostrarViajeEnMapa();
    await cargarTaxis();

  } catch (error) {
    console.error(error);
    alert('Error de conexión');
  }
}

function obtenerColor(taxi) {

  const estado = (
    taxi.estado_operativo ||
    taxi.estado ||
    ''
  ).toLowerCase();

  // EN VIAJE / OCUPADO → rojo
 // EN VIAJE
if (
  estado === 'en_curso' ||
  estado === 'ocupado'
) {
  return '#f59e0b'; // naranja
}

// ASIGNADO / CAMINO AL PASAJERO
if (
  estado === 'asignado' ||
  estado === 'en_camino_origen'
) {
  return '#3b82f6'; // azul
}

// TAXI SELECCIONADO
if (
  taxi.taxi_id === taxiSeleccionadoId ||
  taxi.id === taxiSeleccionadoId
) {
  return '#ff8800';
}

// DISPONIBLE
if (
  estado === 'disponible' ||
  estado === ''
) {
  return '#22c55e';
}

// OFFLINE
return '#6b7280';
}


function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
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

function calcularAngulo(lat1, lng1, lat2, lng2) {
  const dy = lat2 - lat1;
  const dx = lng2 - lng1;

  const anguloRad = Math.atan2(dy, dx);
  const anguloDeg = anguloRad * (180 / Math.PI);

  return anguloDeg + 90;
}

async function marcarEnOrigen() {
  if (!viajeSeleccionadoId) {
    alert('Seleccioná un viaje primero');
    return;
  }

  try {
    const res = await fetch(`/viajes/${viajeSeleccionadoId}/en-origen`, {
      method: 'PUT'
    });

    const data = await res.json();

    if (!data.ok) {
      alert('Error al actualizar estado');
      return;
    }

    alert('Taxi en origen');

    window.viajeSeleccionado = data.viaje;
window.viajeSeleccionadoId = data.viaje.id;
viajeSeleccionadoId = data.viaje.id;

mostrarViajeOperativo(data.viaje);

if (typeof window.actualizarBotonesPorEstado === 'function') {
  window.actualizarBotonesPorEstado(data.viaje);
}

await cargarPendientes();
await cargarTaxis();

    await mostrarViajeEnMapa();
await cargarTaxis();

  } catch (error) {
    console.error(error);
    alert('Error de conexión');
  }
}
function crearIconoTaxi(angulo = 0, color = '#22c55e') {

  return L.divIcon({

    className: 'taxi-icon-wrapper',

    html: `
      <div
        class="taxi-icon"
        style="
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: ${color};
          border: 3px solid white;
          box-shadow: 0 0 8px rgba(0,0,0,0.35);

          display:flex;
          align-items:center;
          justify-content:center;

          transform: rotate(${angulo}deg);
          transition:
            transform 0.8s linear,
            background 0.3s ease;

          font-size: 14px;
          color: white;
          font-weight: bold;
        "
      >
        ▲
      </div>
    `,

    iconSize: [26, 26],
    iconAnchor: [13, 13]

  });

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

function seguirTaxiEnMapa(state) {
  if (!seguirTaxiSeleccionado) return;
  if (taxiSeleccionadoId !== state.id) return;

  const centro = mapa.getCenter();
  const distanciaLat = Math.abs(centro.lat - state.currentLat);
  const distanciaLng = Math.abs(centro.lng - state.currentLng);

  const UMBRAL = 0.0007;

  if (distanciaLat > UMBRAL || distanciaLng > UMBRAL) {
    mapa.panTo([state.currentLat, state.currentLng], {
      animate: true,
      duration: 0.6
    });
  }
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

  viajeSeleccionadoId = viaje.id;
  

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
}
    
const btnAsignarTaxi = document.getElementById('btn-asignar-taxi');
const btnEnOrigen = document.getElementById('btn-en-origen');
const btnIniciarViaje = document.getElementById('btn-iniciar-viaje');
const btnFinalizarViaje = document.getElementById('btn-finalizar-viaje');
const btnAceptarViaje = document.getElementById('btn-aceptar-viaje');
const btnRechazarViaje = document.getElementById('btn-rechazar-viaje');
const btnAsignarAuto = document.getElementById('btn-asignar-auto');

if (btnAsignarAuto) {
  btnAsignarAuto.onclick = asignarAutomatico;
}

if (btnEnOrigen) {
  btnEnOrigen.onclick = marcarEnOrigen;
}

if (btnIniciarViaje) {
  btnIniciarViaje.onclick = iniciarViaje;
}

if (btnFinalizarViaje) {
  btnFinalizarViaje.onclick = finalizarViaje;
}

if (btnAceptarViaje) {
  btnAceptarViaje.onclick = aceptarViaje;
}

if (btnRechazarViaje) {
  btnRechazarViaje.onclick = rechazarViaje;
}

async function aceptarViaje() {
  console.log('CLICK ACEPTAR VIAJE', viajeSeleccionadoId);

  if (!viajeSeleccionadoId) {
    alert('Seleccioná un viaje primero');
    return;
  }

  try {
    const res = await fetch(`/viajes/${viajeSeleccionadoId}/aceptar`, {
      method: 'POST'
    });

    const data = await res.json();

    console.log('RESPUESTA ACEPTAR:', data);

    if (!data.ok) {
      alert(data.mensaje || 'Error al aceptar viaje');
      return;
    }

    window.viajeSeleccionado = data.viaje;
    window.viajeSeleccionadoId = data.viaje.id;

    mostrarViajeOperativo(data.viaje);

    await cargarPendientes();
    await cargarTaxis();

    mostrarMensaje('Viaje aceptado');

  } catch (error) {
    console.error('ERROR ACEPTAR VIAJE:', error);
    alert('Error de conexión al aceptar viaje');
  }
}

async function rechazarViaje() {
  console.log('CLICK RECHAZAR VIAJE', viajeSeleccionadoId);

  if (!viajeSeleccionadoId) {
    alert('Seleccioná un viaje primero');
    return;
  }

  try {
    const res = await fetch(`/viajes/${viajeSeleccionadoId}/rechazar`, {
      method: 'POST'
    });

    const data = await res.json();

    console.log('RESPUESTA RECHAZAR:', data);

    if (!data.ok) {
      alert(data.mensaje || 'Error al rechazar viaje');
      return;
    }

    await cargarPendientes();
    await cargarTaxis();

    mostrarMensaje('Viaje rechazado');

  } catch (error) {
    console.error('ERROR RECHAZAR VIAJE:', error);
    alert('Error de conexión al rechazar viaje');
  }
}

// ==========================
// INICIAR VIAJE
// ==========================
async function iniciarViaje() {
  console.log('CLICK INICIAR VIAJE', viajeSeleccionadoId);
  if (!viajeSeleccionadoId) {
    alert('Seleccioná un viaje primero');
    return;
  }
try {
  console.log('FETCH INICIAR:', `/viajes/${viajeSeleccionadoId}/iniciar`);
  const res = await fetch(`/viajes/${viajeSeleccionadoId}/iniciar`, {
    method: 'POST'
  });
  console.log('STATUS INICIAR:', res.status);

    const data = await res.json();

    console.log('RESPUESTA INICIAR:', data);

    if (!data.ok) {
  alert(data.mensaje || 'Error al iniciar viaje');
  return;
}

dibujarPendientesEnMapa([]);

alert('Viaje iniciado');
if (window.lineaTaxiPasajero && window.mapa) {
  window.mapa.removeLayer(window.lineaTaxiPasajero);
  window.lineaTaxiPasajero = null;
}


    if (!window.taxiSeleccionadoId && data.viaje?.taxi_id) {
  window.taxiSeleccionadoId = data.viaje.taxi_id;
} 
console.log('DEBUG INICIAR MOVIMIENTO:', {
  moverTaxiExiste: typeof window.moverTaxiPorRutaOSRM,
  taxiSeleccionadoId: window.taxiSeleccionadoId,
  rutaEsArray: Array.isArray(window.rutaActualOSRM),
  rutaLength: Array.isArray(window.rutaActualOSRM) ? window.rutaActualOSRM.length : null,
  rutaActualOSRM: window.rutaActualOSRM
});

if (
  typeof window.moverTaxiPorRutaOSRM === 'function' &&
  window.taxiSeleccionadoId &&
  Array.isArray(window.rutaActualOSRM) &&
  window.rutaActualOSRM.length > 0
) {
  window.moverTaxiPorRutaOSRM(
    window.taxiSeleccionadoId,
    window.rutaActualOSRM,
    350
  );
} else {
  console.warn('NO SE PUDO MOVER TAXI: falta función, taxi o ruta');
}
await cargarViajeActivo();
await cargarTaxis();

if (typeof window.actualizarBotonesPorEstado === 'function') {
  window.actualizarBotonesPorEstado(data.viaje);
}


  } catch (error) {
    console.error(error);
    alert('Error de conexión');
  }
}

// ==========================
// FINALIZAR VIAJE
// ==========================
async function finalizarViaje() {
console.log('CLICK FINALIZAR VIAJE', viajeSeleccionadoId);

  if (!viajeSeleccionadoId) {
    alert('Seleccioná un viaje primero');
    return;
  }

  if (!viajeSeleccionadoId) {
    alert('Seleccioná un viaje primero');
    return;
  }

  try {
    const res = await fetch(`/viajes/${viajeSeleccionadoId}/finalizar`, {
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

window.history.replaceState({}, '', '/mapa');

mostrarViajeSeleccionadoEnPanel(null);
/*
if (typeof mostrarViajeOperativo === 'function') {
  mostrarViajeOperativo(null);
}
*/
if (lineaTaxiPasajero) {
  mapa.removeLayer(lineaTaxiPasajero);
  lineaTaxiPasajero = null;
  window.lineaTaxiPasajero = null;
}

if (window.rutaTaxiPasajero) {
  mapa.removeLayer(window.rutaTaxiPasajero);
  window.rutaTaxiPasajero = null;
}
if (window.markersViajes) {
  window.markersViajes.forEach(marker => {
    mapa.removeLayer(marker);
  });
  window.markersViajes = [];
}

if (window.markerOrigen) {
  mapa.removeLayer(window.markerOrigen);
  window.markerOrigen = null;
}

Object.values(window.taxisMarkers || {}).forEach(marker => {
  marker.setIcon(iconoTaxi({
    estado: 'disponible',
    estado_operativo: 'disponible'
  }));
});

  document.getElementById('acciones-viaje')
  .classList.add('oculto');

actualizarBotonesPorEstado(null);

const acciones = document.getElementById('acciones-viaje');

if (acciones) {
  acciones.classList.add('oculto');
  acciones.style.display = 'none';
}

mapa.eachLayer((layer) => {
  if (layer instanceof L.Marker) {
    const iconHtml = layer.options?.icon?.options?.html || '';

    if (iconHtml.includes('red') || iconHtml.includes('🔺') || iconHtml.includes('▲')) {
      mapa.removeLayer(layer);
    }
  }
});

mapa.eachLayer((layer) => {
  if (layer instanceof L.Marker && layer._sgofTipo !== 'taxi') {
    mapa.removeLayer(layer);
  }
});

mapa.eachLayer((layer) => {
  if (layer instanceof L.Marker) {
    mapa.removeLayer(layer);
  }
});

window.taxisMarkers = {};
window.marcadoresPorTaxi = {};

if (typeof marcadoresPorTaxi !== 'undefined') {
  marcadoresPorTaxi = {};
}

if (typeof marcadorViaje !== 'undefined') {
  marcadorViaje = null;
}
if (window.lineaTaxiPasajero) {
  window.mapa.removeLayer(window.lineaTaxiPasajero);
  window.lineaTaxiPasajero = null;
}

if (typeof lineaTaxiPasajero !== 'undefined' && lineaTaxiPasajero) {
  mapa.removeLayer(lineaTaxiPasajero);
  lineaTaxiPasajero = null;
}

await cargarPendientes();
await cargarTaxis();
alert('Viaje finalizado');

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

  document.addEventListener('click', (event) => {

  if (event.target?.id !== 'btn-asignar-taxi') {
    return;
  }

  console.log('CLICK BTN ASIGNAR TAXI');

  window.asignarTaxiSeleccionado();
});

  
 /* if (btnAsignarTaxi) {
  btnAsignarTaxi.addEventListener('click', () => {
    console.log('CLICK BTN ASIGNAR TAXI');

    asignarTaxiSeleccionado();
  
  });
  console.log('Botón Asignar Taxi conectado');
}
*/

 /* if (btnAsignarTaxi) {
  btnAsignarTaxi.addEventListener('click', () => {
    console.log('CLICK BTN ASIGNAR TAXI');

    asignarTaxiSeleccionado();
  
  });
  console.log('Botón Asignar Taxi conectado');
}
*/
  console.log('Botón Nuevo pedido test conectado');
});
document.addEventListener('click', (event) => {
  const btn = event.target.closest('#btn-asignar-taxi');

  if (!btn) return;

  console.log('CLICK BTN ASIGNAR TAXI');

  asignarTaxiSeleccionado();
});
