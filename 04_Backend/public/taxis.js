let filtroActivo = 'todos';
function taxiDisponibleParaAsignar(taxi) {
  return (taxi.estado || '').toLowerCase() === 'disponible' &&
         (taxi.estado_operativo || '').toLowerCase() === 'disponible';
}

function crearTaxiState(taxi, marker) {
  const lat = parseFloat(taxi.latitud);
  const lng = parseFloat(taxi.longitud);

  return {
    id: taxi.taxi_id,
    marker,
    data: taxi,
    currentLat: lat,
    currentLng: lng,
    startLat: lat,
    startLng: lng,
    targetLat: lat,
    targetLng: lng,
    animStartTime: 0,
    animDuration: ANIMATION_DURATION,
    angle: 0
  };
}

function mostrarResumenRuta(distanciaKm, etaMin) {
  const resumen = document.getElementById('resumen');

  if (!resumen) return;

  resumen.innerHTML = `
    <div style="
      padding: 10px 14px;
      border-radius: 10px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e3a8a;
      font-weight: 600;
    ">
      🚕 Ruta taxi → pasajero: ${distanciaKm} km / ${etaMin} min
    </div>
  `;
}



async function calcularETAEntrePuntos(posTaxi, posViaje) {
  const url = `https://router.project-osrm.org/route/v1/driving/${posTaxi.lng},${posTaxi.lat};${posViaje.lng},${posViaje.lat}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (!data.routes || !data.routes.length) {
      return null;
    }

    const ruta = data.routes[0];

    const distanciaKm = (ruta.distance / 1000).toFixed(2);
    const etaMin = Math.round(ruta.duration / 60);

    return {
      distanciaKm,
      etaMin,
      coords: ruta.geometry.coordinates.map(coord => [
        coord[1],
        coord[0]
      ])
    };

  } catch (error) {
    console.error('Error calculando ETA OSRM:', error);
    return null;
  }
}

async function encontrarMejorTaxiParaViaje() {

  if (!marcadorViaje) return;

  const posViaje = marcadorViaje.getLatLng();
  console.log('DEBUG MARCADORES TAXI:', Object.keys(window.marcadoresPorTaxi || {}));
console.log('DEBUG POS VIAJE:', posViaje);

  let mejorTaxiId = null;
  let mejorETA = Infinity;
  let mejorRutaCoords = null;

  for (const taxiId in window.marcadoresPorTaxi) {

    const markerTaxi = window.marcadoresPorTaxi[taxiId];

    if (!markerTaxi) continue;

    const posTaxi = markerTaxi.getLatLng();

    const resultado = await calcularETAEntrePuntos(posTaxi, posViaje);

    if (!resultado) continue;

    console.log('ETA TAXI:', taxiId, resultado);
if (resultado.etaMin < mejorETA) {
  mejorETA = resultado.etaMin;
  mejorTaxiId = taxiId;
  mejorRutaCoords = resultado.coords;

  window.distanciaActualOSRM = resultado.distanciaKm;
  window.etaActualOSRM = resultado.etaMin;
}


  console.log('ETA GUARDADA:', {
    distancia: window.distanciaActualOSRM,
    eta: window.etaActualOSRM
  });
}
console.log('REFRESCAR PANEL ETA:', {
  existeFuncion: typeof mostrarViajeOperativo,
  viajeSeleccionado: window.viajeSeleccionado
});

if (typeof mostrarViajeOperativo === 'function') {
  mostrarViajeOperativo(window.viajeSeleccionado || null);
}

  console.log('MEJOR TAXI:', mejorTaxiId, mejorETA);

if (mejorTaxiId) {

  window.mapa.eachLayer((layer) => {
    if (layer instanceof L.Marker && layer._sgofTipo !== 'taxi') {
      window.mapa.removeLayer(layer);
    }
  });

  if (window.lineaTaxiPasajero) {
    window.mapa.removeLayer(window.lineaTaxiPasajero);
    window.lineaTaxiPasajero = null;
  }

  console.log('MEJOR TAXI:', mejorTaxiId, mejorETA);

console.log('DEBUG RUTA:', {
  mejorTaxiId,
  mejorETA,
  mejorRutaCoords
});

if (mejorRutaCoords) {

  console.log(
    'DIBUJANDO RUTA OSRM:',
    mejorRutaCoords.length
  );

  window.lineaTaxiPasajero = L.polyline(mejorRutaCoords, {
  color: '#2563eb',
  weight: 5,
  opacity: 0.9
}).addTo(window.mapa);

window.lineaTaxiPasajero.bringToFront();

window.rutaActualOSRM = mejorRutaCoords;


console.log(
  'CAPAS:',
  window.mapa.hasLayer(window.lineaTaxiPasajero)
);

  window.mapa.fitBounds(
    window.lineaTaxiPasajero.getBounds(),
    { padding: [40, 40] }
  );
}
 
  seleccionarTaxi(mejorTaxiId, true, true, true);

  mostrarMensaje(
    `🚕 Mejor taxi encontrado (${Math.round(mejorETA)} min)`,
    'success'
  );
}
window.encontrarMejorTaxiParaViaje = encontrarMejorTaxiParaViaje;

}

async function fetchTaxis() {
  //console.log('ENTRANDO A fetchTaxis');

  const res = await fetch('/taxis/positions');

  if (!res.ok) {
    throw new Error(`Error HTTP taxis: ${res.status}`);
  }

  return await res.json();
}

function colorTaxi(taxi) {
  const estado = taxi.estado_operativo || taxi.estado || 'desconocido';

  if (estado === 'ocupado') return '#ef4444';
  if (estado === 'asignado') return '#ef4444';
  if (estado === 'en_curso') return '#ef4444';
  if (estado === 'en_camino_origen') return '#ef4444';

  if (taxi.taxi_id === window.taxiSeleccionadoId) return '#f59e0b';

  if (estado === 'disponible') return '#22c55e';

  return '#6b7280';
}

function iconoTaxi(taxi) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        position: relative;
        width: 24px;
        height: 24px;
        transform: rotate(${taxi.heading || 0}deg);
      ">
        <div style="
          width: 0;
          height: 0;
          border-left: 12px solid transparent;
          border-right: 12px solid transparent;
          border-bottom: 24px solid ${colorTaxi(taxi)};
          filter: drop-shadow(0 1px 2px rgba(0,0,0,.25));
        "></div>

        <div style="
          position: absolute;
          left: 8px;
          top: 7px;
          width: 0;
          height: 0;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-bottom: 10px solid white;
        "></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

async function cargarTaxis() {
  
  //console.log('ENTRANDO A cargarTaxis');

  try {
    const data = await fetchTaxis();
    window.ultimosTaxis = data.taxis || [];
    //console.log('RESPUESTA /taxis/positions:', data);

    if (!data.ok || !Array.isArray(data.taxis)) {
      console.error('Respuesta inválida de taxis:', data);
      return;
    }

    window.marcadoresPorTaxi = window.marcadoresPorTaxi || {};
    window.taxisMarkers = window.taxisMarkers || {};
    window.posicionesTaxiSimuladas = window.posicionesTaxiSimuladas || {};

    const contenedor = document.getElementById('taxis');

    if (contenedor) {
      contenedor.innerHTML = '';
    }

    data.taxis.forEach((taxi) => {
     const posSimulada = window.posicionesTaxiSimuladas[taxi.taxi_id];

const latGPS = Number(taxi.latitud);
const lngGPS = Number(taxi.longitud);

const tieneGPS =
  Number.isFinite(latGPS) &&
  Number.isFinite(lngGPS);

const lat = tieneGPS
  ? latGPS
  : Number(posSimulada?.lat);

const lng = tieneGPS
  ? lngGPS
  : Number(posSimulada?.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

     let marker = window.marcadoresPorTaxi[taxi.taxi_id];


const latFinal = posSimulada ? posSimulada.lat : lat;
const lngFinal = posSimulada ? posSimulada.lng : lng;

if (!marker) {
  marker = L.marker([latFinal, lngFinal], {
    icon: iconoTaxi(taxi)
  }).addTo(window.mapa);

  marker._sgofTipo = 'taxi';

  marker.on('click', () => {
    console.log('CLICK MARKER TAXI:', taxi.taxi_id);

    window.seleccionarTaxi(
      taxi.taxi_id,
      false,
      true,
      true
    );
  });
} else {
  marker.setLatLng([latFinal, lngFinal]);
}

const velocidad = taxi.velocidad_kmh
  ? `${Number(taxi.velocidad_kmh).toFixed(0)} km/h`
  : '—';

const fechaGps = taxi.fecha_hora_gps
  ? new Date(taxi.fecha_hora_gps).toLocaleString('es-UY')
  : '—';

marker.bindPopup(`
  🚕 <strong>${taxi.codigo_movil || taxi.taxi_id}</strong><br>
  Estado: ${taxi.estado || taxi.estado_operativo || '—'}<br>
  Velocidad: ${velocidad}<br>
  GPS: ${fechaGps}
`);

marker.setIcon(iconoTaxi(taxi));

      window.taxisMarkers[taxi.taxi_id] = marker;
      window.marcadoresPorTaxi[taxi.taxi_id] = marker;

      if (contenedor) {
        const card = renderTaxiCard(taxi);

        if (window.taxiSeleccionadoId === taxi.taxi_id) {
          card.classList.add('seleccionado');
        }

        contenedor.appendChild(card);
        cardsPorTaxi[taxi.taxi_id] = card;
      }
    });

  } catch (error) {
    console.error('Error en cargarTaxis:', error);
  }
}

function seleccionarTaxi(taxiId, centrarMapa = true, abrirPopup = true, enfocarCard = true) {

  seguirTaxiSeleccionado = true;

  taxiSeleccionadoId = taxiId;
  window.taxiSeleccionadoId = taxiId;

  console.log('TAXI SELECCIONADO OK:', {
    taxiSeleccionadoId,
    windowTaxi: window.taxiSeleccionadoId
  });

  if (typeof window.dibujarLineaTaxiPasajero === 'function') {
    window.dibujarLineaTaxiPasajero();
  }

  Object.values(cardsPorTaxi).forEach(card => {
    card.classList.remove('seleccionado');
  });
if (cardsPorTaxi[taxiId]) {
  cardsPorTaxi[taxiId].classList.add('seleccionado');
}
if (cardsPorTaxi[taxiId]) {
  cardsPorTaxi[taxiId].scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
}
  const card = cardsPorTaxi[taxiId];
  if (card) {
    card.classList.add('seleccionado');

    if (enfocarCard) {
      card.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      card.focus({ preventScroll: true });
    }
  }

  const marker = window.marcadoresPorTaxi?.[taxiId];

  if (marker && centrarMapa) {
    mapa.flyTo(marker.getLatLng(), 16, {
      animate: true,
      duration: 0.8
    });
  }

  if (marker && abrirPopup) {
    marker.openPopup();
  }
 
  if (typeof window.dibujarLineaTaxiPasajero === 'function') {
  window.dibujarLineaTaxiPasajero();
}
}
// Genera el HTML interno de una tarjeta de taxi

function getTaxiCardHTML(taxi) {
  const estadoVisible =
    taxi.estado_operativo === 'en_camino_origen'
      ? 'En camino al origen'
      : (taxi.estado ?? 'sin dato');

  const fechaGps = taxi.fecha_hora_gps
    ? new Date(taxi.fecha_hora_gps).toLocaleString('es-UY')
    : 'sin dato';

  const velocidad = taxi.velocidad_kmh != null
    ? `${Number(taxi.velocidad_kmh).toFixed(0)} km/h`
    : 'sin dato';

  const fuente = taxi.fuente ?? 'sin dato';

 return `
  <strong>🚕 ${taxi.codigo_movil || 'Sin código'}</strong><br>
  Estado: ${estadoVisible}<br>
  Operativo: ${taxi.estado_operativo ?? 'sin dato'}<br>
  Velocidad: ${velocidad}<br>
  Último GPS: ${fechaGps}<br>
  Fuente GPS: ${fuente}<br>
  Coordenadas: ${taxi.latitud ?? 'sin dato'}, ${taxi.longitud ?? 'sin dato'}<br><br>

  <button
    onclick="verHistorialGpsTaxi('${taxi.taxi_id}')"
    style="
      width:100%;
      padding:6px;
      background:#2563eb;
      color:white;
      border:none;
      border-radius:6px;
      cursor:pointer;
    "
  >
    📍 Historial GPS
  </button>
`;
}


function claseEstadoTaxi(taxi) {
  const estado = taxi.estado || taxi.estado_operativo || 'desconocido';

  if (estado === 'disponible') return 'taxi-disponible';
  if (estado === 'en_camino_origen') return 'taxi-en-camino';
  if (estado === 'ocupado') return 'taxi-ocupado';

  return 'taxi-desconocido';
}

function renderTaxiCard(taxi) {
  const div = document.createElement('div');

  div.className = `taxi-card ${claseEstadoTaxi(taxi)}`;
  div.tabIndex = -1;

  div.innerHTML = getTaxiCardHTML(taxi);

  if (!taxiDisponibleParaAsignar(taxi)) {
    div.style.opacity = '0.65';
    div.style.cursor = 'not-allowed';
  } else {
    div.style.opacity = '1';
    div.style.cursor = 'pointer';
  }

  div.onclick = () => {
    console.log('CLICK CARD TAXI:', taxi.taxi_id);

    if (!taxiDisponibleParaAsignar(taxi)) {
      mostrarMensaje('Ese taxi no está disponible', 'error');
      return;
    }

    seleccionarTaxi(taxi.taxi_id, true, true, false);

    console.log('CARD TAXI CLICK, voy a dibujar línea:', taxi.taxi_id);

    if (typeof window.dibujarLineaTaxiPasajero === 'function') {
      window.dibujarLineaTaxiPasajero();
    }
  };

  return div;
}

window.fetchTaxis = fetchTaxis;
window.cargarTaxis = cargarTaxis;
window.seleccionarTaxi = seleccionarTaxi;
