let filtroActivo = 'todos';
function taxiDisponibleParaAsignar(taxi) {
  const estado = (taxi.estado || '').toLowerCase();
  const operativo = (taxi.estado_operativo || '').toLowerCase();
  const fuente = (taxi.fuente || '').toLowerCase();

  const tipoGps = detectarTipoGps(taxi);

  const esSimulado =
    fuente === 'backend' ||
    fuente === 'simulado';

  const gpsValido =
    esSimulado ||
    !tipoGps.texto.includes('Offline');

  return estado === 'disponible' &&
         operativo === 'disponible' &&
         gpsValido;
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
  
  let mejorTaxiId = null;
  let mejorETA = Infinity;
  let mejorRutaCoords = null;
for (const taxiId in window.marcadoresPorTaxi) {

  const markerTaxi = window.marcadoresPorTaxi[taxiId];

  if (!markerTaxi) continue;

  const taxi = window.ultimosTaxis?.find(
    t => String(t.taxi_id) === String(taxiId)
  );

  if (!taxi || !taxiDisponibleParaAsignar(taxi)) {
    continue;
  }

  const posTaxi = markerTaxi.getLatLng();

  const resultado = await calcularETAEntrePuntos(
    posTaxi,
    posViaje
  );

  if (!resultado) continue;
    
if (resultado.etaMin < mejorETA) {
  mejorETA = resultado.etaMin;
  mejorTaxiId = taxiId;
  mejorRutaCoords = resultado.coords;

  window.distanciaActualOSRM = resultado.distanciaKm;
  window.etaActualOSRM = resultado.etaMin;
}
 
if (typeof mostrarViajeOperativo === 'function') {
  mostrarViajeOperativo(window.viajeSeleccionado || null);
}
  
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

if (mejorRutaCoords) {
 
  window.lineaTaxiPasajero = L.polyline(mejorRutaCoords, {
  color: '#2563eb',
  weight: 5,
  opacity: 0.9
}).addTo(window.mapa);

window.lineaTaxiPasajero.bringToFront();

window.rutaActualOSRM = mejorRutaCoords;

  window.mapa.fitBounds(
    window.lineaTaxiPasajero.getBounds(),
    { padding: [40, 40] }
  );
}
 
  seleccionarTaxi(mejorTaxiId, true, false, true);

  mostrarMensaje(
    `🚕 Mejor taxi encontrado (${Math.round(mejorETA)} min)`,
    'success'
  );
}
} 
} 
window.encontrarMejorTaxiParaViaje = encontrarMejorTaxiParaViaje;


async function fetchTaxis() {
 
  const res = await fetch('/taxis/positions');

  if (!res.ok) {
    throw new Error(`Error HTTP taxis: ${res.status}`);
  }

  return await res.json();
}
function colorTaxi(taxi) {
  const estado = taxi.estado_operativo || taxi.estado || 'desconocido';
  const tipoGps = detectarTipoGps(taxi);

  if (estado === 'ocupado') return '#ef4444';
  if (estado === 'asignado') return '#ef4444';
  if (estado === 'en_curso') return '#ef4444';
  if (estado === 'en_camino_origen') return '#ef4444';

  if (taxi.taxi_id === window.taxiSeleccionadoId) return '#f59e0b';

  if (tipoGps.tipo === 'offline') return '#6b7280';

  if (tipoGps.tipo === 'simulado') return '#2563eb';

  if (estado === 'disponible') return '#22c55e';

  return '#6b7280';
}

function iconoTaxi(taxi) {
  const rumbo = Number.isFinite(Number(taxi?.rumbo_grados))
    ? Number(taxi.rumbo_grados)
    : 0;

  return L.divIcon({
    className: '',
    html: `
      <div style="
        position: relative;
        width: 28px;
        height: 28px;
        transform: rotate(${rumbo}deg);
      ">
        <div style="
          position: absolute;
          left: 2px;
          top: 2px;
          width: 0;
          height: 0;
          border-left: 12px solid transparent;
          border-right: 12px solid transparent;
          border-bottom: 24px solid ${colorTaxi(taxi)};
          filter: drop-shadow(0 1px 2px rgba(0,0,0,.25));
        "></div>

        <div style="
          position: absolute;
          left: 10px;
          top: 9px;
          width: 0;
          height: 0;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-bottom: 10px solid white;
        "></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
}

function actualizarResumenOperativo() {
  const resumenFlota = document.getElementById('resumen-flota');
  if (!resumenFlota) return;

  const taxis = window.ultimosTaxis || [];

  const asignables = taxis.filter(t => taxiDisponibleParaAsignar(t)).length;
  const noAsignables = taxis.length - asignables;

  const offline = taxis.filter(t =>
    detectarTipoGps(t).tipo === 'offline'
  ).length;

  const fuenteGps = taxis.filter(t =>
    (t.fuente || '').toLowerCase() === 'gps'
  ).length;

  const fuenteSimulada = taxis.filter(t =>
    ['backend', 'simulado'].includes((t.fuente || '').toLowerCase())
  ).length;

  const pendientes = window.totalViajesPendientes || 0;
  const asignados = window.totalViajesAsignados || 0;
const enCurso = window.totalViajesEnCurso || 0;
resumenFlota.innerHTML = `
  <strong>🚕 Flota</strong><br>
  🚕 Taxis totales: ${taxis.length}<br>
  ✅ Asignables: ${asignables}<br>
  ⛔ No asignables: ${noAsignables}<br>
  ⚫ Offline: ${offline}<br>
  🛰️ GPS reales: ${fuenteGps}
🧪 Simulados: ${fuenteSimulada}
  <br>
  <strong>📞 Viajes</strong><br>
  🟡 Pendientes: ${pendientes}<br>
  🟠 Asignados: ${asignados}<br>
  🔴 En curso: ${enCurso}
`;
}
window.actualizarResumenOperativo = actualizarResumenOperativo;

async function cargarTaxis() {
    try {
    const data = await fetchTaxis();
    window.ultimosTaxis = data.taxis || [];
   
    if (!data.ok || !Array.isArray(data.taxis)) {
      console.error('Respuesta inválida de taxis:', data);
      return;
    }

    // Ambos diccionarios apuntan a los mismos markers.
    // Se mantienen por compatibilidad entre mapa.js y taxis.js.
    window.marcadoresPorTaxi = window.marcadoresPorTaxi || {};
    window.taxisMarkers = window.taxisMarkers || {};
    window.posicionesTaxiSimuladas = window.posicionesTaxiSimuladas || {};

    const contenedor = document.getElementById('taxis');

if (contenedor) {
  contenedor.innerHTML = '';
}

window.ultimosTaxis = data.taxis || [];

actualizarResumenOperativo();

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

  if (!taxiDisponibleParaAsignar(taxi)) {
    return;
  }

  window.seleccionarTaxi(
    taxi.taxi_id,
    false,
    true,
    true
  );

});

} else {
  if (!marker._sgofAnimando) {
    const posActual = marker.getLatLng();

    const mismaPosicion =
      Math.abs(posActual.lat - latFinal) < 0.000001 &&
      Math.abs(posActual.lng - lngFinal) < 0.000001;

    if (!mismaPosicion) {
      marker.setLatLng([latFinal, lngFinal]);
    }
  }
}

const fechaGps = taxi.fecha_hora_gps
  ? new Date(taxi.fecha_hora_gps).toLocaleString('es-UY')
  : '—';

const estadoGps = calcularEstadoGps(taxi.fecha_hora_gps);
const tipoGps = detectarTipoGps(taxi);

const gpsNoConfiable =
  estadoGps.texto.includes('GPS viejo') ||
  estadoGps.texto.includes('Sin señal') ||
  estadoGps.texto.includes('Señal demorada');

const velocidad = gpsNoConfiable
  ? '0 km/h'
  : taxi.velocidad_kmh
    ? `${Number(taxi.velocidad_kmh).toFixed(0)} km/h`
    : '—';

marker.bindPopup(`
  🚕 <strong>${taxi.codigo_movil || taxi.taxi_id}</strong><br>
  Estado: ${taxi.estado || taxi.estado_operativo || '—'}<br>
  Velocidad: ${velocidad}<br>
  GPS: ${fechaGps}
`);

const firmaIcono = `${
  taxi.estado_operativo || taxi.estado || ''
}|${
  taxi.rumbo_grados || ''
}|${
  window.taxiSeleccionadoId === taxi.taxi_id ? 'seleccionado' : ''
}|${
  detectarTipoGps(taxi).tipo
}`;
if (marker._sgofFirmaIcono !== firmaIcono) {
  marker.setIcon(iconoTaxi(taxi));
  marker._sgofFirmaIcono = firmaIcono;
}

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

mostrarPanelGpsTaxi(taxiId);

  window.taxiSeleccionadoId = taxiId;
    

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

  if (
  marker &&
  abrirPopup &&
  window.viajeSeleccionadoId
) {
  marker.openPopup();
}
 
  if (typeof window.dibujarLineaTaxiPasajero === 'function') {
  window.dibujarLineaTaxiPasajero();
}
}

function obtenerTextoRumbo(grados) {
  const valor = Number(grados);

  if (!Number.isFinite(valor)) {
    return '🧭 Rumbo: sin dato';
  }

  const direcciones = [
    'Norte',
    'Noreste',
    'Este',
    'Sureste',
    'Sur',
    'Suroeste',
    'Oeste',
    'Noroeste'
  ];

  const indice = Math.round(valor / 45) % 8;

  return `🧭 Rumbo: ${direcciones[indice]}`;
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

  const estadoGps = calcularEstadoGps(taxi.fecha_hora_gps);
  const tipoGps = detectarTipoGps(taxi);

const fuenteGpsTexto =
  taxi.fuente === 'gps'
    ? '🛰️ Fuente: GPS'
    : taxi.fuente === 'tablet'
      ? '📱 Fuente: Tablet'
      : taxi.fuente === 'backend'
        ? '🧪 Fuente: Simulación'
        : `📡 Fuente: ${taxi.fuente || 'Sin dato'}`;

  let velocidadTexto = taxi.velocidad_kmh != null
  ? `Velocidad actual: ${Number(taxi.velocidad_kmh).toFixed(0)} km/h`
  : 'Velocidad actual: sin dato';

if (
  estadoGps.texto.includes('GPS viejo') ||
  estadoGps.texto.includes('Señal demorada')
) {
  velocidadTexto = 'Velocidad actual: 0 km/h';
}
let movimiento = '⚪ Sin señal reciente';

if (tipoGps.tipo === 'simulado') {

  movimiento = '🧪 Modo simulación';

} else if (
  estadoGps.texto.includes('En línea') ||
  estadoGps.texto.includes('Señal demorada')
) {
  movimiento =
    Number(taxi.velocidad_kmh || 0) > 5
      ? '🟢 En movimiento'
      : '🟡 Detenido';
}
const fuente = taxi.fuente || 'sin dato';

 const fuenteTexto =
  tipoGps.tipo === 'simulado'
    ? ''
    : fuente === 'gps'
      ? '🛰 Fuente: GPS Real'
      : fuente === 'tablet'
        ? '🛰 Fuente: Tablet'
        : `📡 Fuente: ${fuente}`;

   const rumboTexto = obtenerTextoRumbo(taxi.rumbo_grados);

const asignableTexto = taxiDisponibleParaAsignar(taxi)
  ? '✅ Disponible para asignar'
  : '⛔ No asignable';

 return `

<strong>🚕 ${taxi.codigo_movil || 'Sin código'}</strong><br>
Estado: ${estadoVisible}<br>
Operativo: ${taxi.estado_operativo ?? 'sin dato'}<br>
${asignableTexto}<br>
${velocidadTexto}<br>
${movimiento}<br>

${tipoGps.tipo === 'simulado'
  ? `
    Última posición: simulada<br>
  `
  : `
    Último GPS: ${fechaGps}<br>
    Estado GPS: ${estadoGps.texto}<br>
    Tipo GPS: ${tipoGps.texto}<br>
    Última señal: ${estadoGps.antiguedad}<br>
  `
}

${fuenteTexto ? `${fuenteTexto}<br>` : ''}
${rumboTexto}<br>

Coordenadas: ${taxi.latitud ?? 'sin dato'}, ${taxi.longitud ?? 'sin dato'}<br>

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
const estadoGpsCard = calcularEstadoGps(taxi.fecha_hora_gps);


let claseGps = 'gps-viejo';

if (estadoGpsCard.texto.includes('En línea')) {
  claseGps = 'gps-online';
} else if (estadoGpsCard.texto.includes('Señal demorada')) {
  claseGps = 'gps-demora';
}

div.className = `taxi-card ${claseEstadoTaxi(taxi)} ${claseGps}`;
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
  if (!taxiDisponibleParaAsignar(taxi)) {
    return;
  }

  seleccionarTaxi(taxi.taxi_id, true, true, false);
    
    if (typeof window.dibujarLineaTaxiPasajero === 'function') {
      window.dibujarLineaTaxiPasajero();
    }
  };

  return div;
}


async function mostrarPanelGpsTaxi(taxiId) {
  const panel = document.getElementById('panelGpsTaxi');
  const contenido = document.getElementById('contenidoGpsTaxi');

  if (!panel || !contenido) return;

  const taxi = window.ultimosTaxis?.find(
    t => t.taxi_id === taxiId
  );

  if (!taxi) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';

  const fechaGps = taxi.fecha_hora_gps
    ? new Date(taxi.fecha_hora_gps).toLocaleString('es-UY')
    : 'Sin dato';

    const estadoGps = calcularEstadoGps(taxi.fecha_hora_gps);
   const tipoGps = detectarTipoGps(taxi);

  const fuenteGpsTexto =
  taxi.fuente === 'gps'
    ? '🛰️ Fuente: GPS'
    : taxi.fuente === 'tablet'
      ? '📱 Fuente: Tablet'
      : taxi.fuente === 'backend'
        ? '🧪 Fuente: Backend'
        : `📡 Fuente: ${taxi.fuente || 'Sin dato'}`;

    let puntosHoy = 'Sin dato';
    let velocidadMaxima = 'Sin dato';

    try {
  const res = await fetch(
    `/gps/resumen-hoy/${taxiId}?fecha=2026-06-10`
  );

  const data = await res.json();

  if (data.ok && data.resumen) {

    puntosHoy =
      data.resumen.puntos_hoy ?? 0;

    velocidadMaxima =
      data.resumen.velocidad_maxima != null
        ? `${Number(data.resumen.velocidad_maxima).toFixed(0)} km/h`
        : 'Sin dato';
  }

} catch (error) {
  console.error(
    'Error cargando resumen GPS:',
    error
  );
}

  contenido.innerHTML = `
    <strong>🚕 ${taxi.codigo_movil || 'Sin código'}</strong><br>

    Estado: ${taxi.estado || '-'}<br>
    Operativo: ${taxi.estado_operativo || '-'}<br>

    Velocidad:
    ${
      taxi.velocidad_kmh != null
        ? Number(taxi.velocidad_kmh).toFixed(0) + ' km/h'
        : 'Sin dato'
    }
    <br>

    Último GPS: ${fechaGps}<br>
    Estado GPS:
   ${estadoGps.texto}
   <br>

   Tipo GPS:
   ${tipoGps.texto}
   <br>

    ${fuenteGpsTexto}
<br>

    Puntos GPS hoy:
${puntosHoy}
<br>

Distancia hoy:
${(window.distanciaHistorialGps || 0).toFixed(2)} km
<br>

Velocidad promedio hoy:
${(window.velocidadPromedioHistorialGps || 0).toFixed(0)} km/h
<br>

Velocidad máxima hoy:
${velocidadMaxima}
<br>


Tiempo en movimiento:
${window.tiempoMovimientoGps || 0} min
<br>

Tiempo detenido:
${window.tiempoDetenidoGps || 0} min
<br>

    Coordenadas:
    ${taxi.latitud || '-'},
    ${taxi.longitud || '-'}
    <br><br>
    
    <button
      onclick="verHistorialGpsTaxi('${taxi.taxi_id}')"
      style="
        width:100%;
        padding:8px;
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

//POSIBLEOBSOLETA- REVISAR ANTES DE BORRAR//
function limpiarPanelGpsTaxi() {
  const panel = document.getElementById('panelGpsTaxi');
  const contenido = document.getElementById('contenidoGpsTaxi');

  if (contenido) {
    contenido.innerHTML = 'Ningún taxi seleccionado';
  }

  if (panel) {
    panel.style.display = 'none';
  }
}
function calcularEstadoGps(fechaGps) {
  if (!fechaGps) {
    return {
      texto: '🔴 Sin señal',
      antiguedad: 'Sin dato'
    };
  }

  const fecha = new Date(fechaGps);
  const ahora = new Date();

  const diffMs = ahora - fecha;
  const diffMin = Math.floor(diffMs / 60000);

  let antiguedad = '';

  if (diffMin < 1) {
    antiguedad = 'hace menos de 1 min';
  } else if (diffMin < 60) {
    antiguedad = `hace ${diffMin} min`;
  } else {
    const horas = Math.floor(diffMin / 60);
    antiguedad = `hace ${horas} h`;
  }

  if (diffMin <= 5) {
    return {
      texto: '🟢 En línea',
      antiguedad
    };
  }

  if (diffMin <= 15) {
    return {
      texto: '🟡 Señal demorada',
      antiguedad
    };
  }

  return {
    texto: '🔴 GPS viejo',
    antiguedad
  };
}
function detectarTipoGps(taxi) {
  const fuente = String(taxi.fuente || '').toLowerCase();
  const codigo = String(taxi.codigo_movil || '').toUpperCase();

  if (
    codigo === 'TX-02' ||
    codigo === 'TX-03' ||
    fuente === 'backend' ||
    fuente === 'simulado'
  ) {
    return {
      tipo: 'simulado',
      texto: '🧪 Simulado'
    };
  }

  const estadoGps = calcularEstadoGps(taxi.fecha_hora_gps);

  if (
    estadoGps.texto === '🔴 GPS viejo' ||
    estadoGps.texto === '🔴 Sin señal'
  ) {
    return {
      tipo: 'offline',
      texto: '⚫ Offline'
    };
  }

  if (
    codigo === 'TX-01' ||
    fuente === 'gps' ||
    fuente === 'tablet' ||
    fuente === 'api'
  ) {
    return {
      tipo: 'real',
      texto: '🛰️ GPS Real'
    };
  }

  return {
    tipo: 'simulado',
    texto: '🧪 Simulado'
  };
}