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

  const operativoDisponible =
    !operativo || operativo === 'disponible';

  return estado === 'disponible' &&
         operativoDisponible &&
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
  let mejorDistanciaKm = null;

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
    const resultado = await calcularETAEntrePuntos(posTaxi, posViaje);

    if (!resultado || !Array.isArray(resultado.coords)) {
      continue;
    }

    if (resultado.etaMin < mejorETA) {
      mejorTaxiId = taxiId;
      mejorETA = resultado.etaMin;
      mejorDistanciaKm = resultado.distanciaKm;
      mejorRutaCoords = [
        [posTaxi.lat, posTaxi.lng],
        ...resultado.coords,
        [posViaje.lat, posViaje.lng]
      ];
    }
  }

  if (!mejorTaxiId || !mejorRutaCoords) {
    mostrarMensaje('No hay taxis disponibles para asignar', 'warning');
    return;
  }

  window.distanciaActualOSRM = mejorDistanciaKm;
  window.etaActualOSRM = mejorETA;
  window.rutaActualOSRM = mejorRutaCoords;

  if (window.lineaTaxiPasajero && window.mapa) {
    window.mapa.removeLayer(window.lineaTaxiPasajero);
    window.lineaTaxiPasajero = null;
  }

  if (window.lineaRutaViaje && window.mapa) {
    window.mapa.removeLayer(window.lineaRutaViaje);
    window.lineaRutaViaje = null;
  }

  window.rutaViajeOSRM = null;

  window.lineaTaxiPasajero = L.polyline(mejorRutaCoords, {
    color: '#2563eb',
    weight: 5,
    opacity: 0.9
  }).addTo(window.mapa);

  window.lineaTaxiPasajero.bringToFront();

  seleccionarTaxi(mejorTaxiId, false, false, true);

  if (typeof mostrarViajeOperativo === 'function') {
    mostrarViajeOperativo(window.viajeSeleccionado || null);
  }

  mostrarMensaje(
    `🚕 Mejor taxi encontrado (${Math.round(mejorETA)} min)`,
    'success'
  );

  return mejorTaxiId;
}

window.encontrarMejorTaxiParaViaje = encontrarMejorTaxiParaViaje;

async function dibujarRutaTaxiAsignado(viaje) {
  if (!viaje || !viaje.taxi_id || !marcadorViaje) return;



  if (!viaje || !viaje.taxi_id || !marcadorViaje) return;

  const taxiIdRutaSolicitada = String(viaje.taxi_id);

  window.solicitudRutaTaxiAsignado =
    (window.solicitudRutaTaxiAsignado || 0) + 1;

  const solicitudActual = window.solicitudRutaTaxiAsignado;
  // Solo dibujar la ruta de asignación antes de iniciar el viaje


  if (
    viaje.estado !== 'asignado' &&
    viaje.estado !== 'en_camino_origen' &&
    viaje.estado !== 'en_origen'
  ) {
    if (window.lineaTaxiPasajero && window.mapa) {
      window.mapa.removeLayer(window.lineaTaxiPasajero);
      window.lineaTaxiPasajero = null;
    }

    return;
  }

  const markerTaxi =
    window.marcadoresPorTaxi?.[viaje.taxi_id];

    const taxiRuta = window.ultimosTaxis?.find(
  taxi => String(taxi.taxi_id) === String(viaje.taxi_id)
);


if (!markerTaxi) return;

const posTaxi = markerTaxi.getLatLng();
const posViaje = marcadorViaje.getLatLng();

const resultado = await calcularETAEntrePuntos(
  posTaxi,
  posViaje
);

if (
  solicitudActual !== window.solicitudRutaTaxiAsignado ||
  String(window.viajeSeleccionado?.taxi_id) !== taxiIdRutaSolicitada
) {
  console.log(
    'Ruta descartada porque el taxi asignado cambió:',
    taxiIdRutaSolicitada
  );
  return;
}

if (!resultado || !Array.isArray(resultado.coords)) return;

const coordsRutaTaxi = [
  [posTaxi.lat, posTaxi.lng],
  ...resultado.coords,
  [posViaje.lat, posViaje.lng]
];

window.distanciaActualOSRM = resultado.distanciaKm;
window.etaActualOSRM = resultado.etaMin;
window.rutaActualOSRM = coordsRutaTaxi;

if (window.lineaTaxiPasajero && window.mapa) {
  window.mapa.removeLayer(window.lineaTaxiPasajero);
  window.lineaTaxiPasajero = null;
}

if (window.lineaRutaViaje && window.mapa) {
  window.mapa.removeLayer(window.lineaRutaViaje);
  window.lineaRutaViaje = null;
}

window.rutaViajeOSRM = null;

window.lineaTaxiPasajero = L.polyline(coordsRutaTaxi, {
  color: '#2563eb',
  weight: 5,
  opacity: 0.9
}).addTo(window.mapa);

  window.lineaTaxiPasajero.bringToFront();

  seleccionarTaxi(
    viaje.taxi_id,
    false,
    false,
    false
  );

  if (typeof mostrarViajeOperativo === 'function') {
    mostrarViajeOperativo(viaje);
  }
}

window.dibujarRutaTaxiAsignado =
  dibujarRutaTaxiAsignado;

async function dibujarRutaViajeEnCurso(viaje) {
  if (!viaje || !window.mapa) return;

 if (viaje.estado !== 'en_curso') {
  if (window.lineaRutaViaje) {
    window.mapa.removeLayer(window.lineaRutaViaje);
    window.lineaRutaViaje = null;
  }

  window.rutaViajeOSRM = null;
  return;
}

  const origenLat = Number(viaje.origen_latitud);
  const origenLng = Number(viaje.origen_longitud);
  const destinoLat = Number(viaje.destino_latitud);
  const destinoLng = Number(viaje.destino_longitud);

  if (
    !Number.isFinite(origenLat) ||
    !Number.isFinite(origenLng) ||
    !Number.isFinite(destinoLat) ||
    !Number.isFinite(destinoLng)
  ) {
    console.warn('No hay coordenadas válidas para ruta del viaje');
    return;
  }

const posicionInicio = L.latLng(origenLat, origenLng);

const resultado = await calcularETAEntrePuntos(
  posicionInicio,
  L.latLng(destinoLat, destinoLng)
);

if (!resultado || !Array.isArray(resultado.coords)) return;

if (window.lineaTaxiPasajero && window.mapa) {
  window.mapa.removeLayer(window.lineaTaxiPasajero);
  window.lineaTaxiPasajero = null;
}

if (window.rutaActualOSRM) {
  window.rutaActualOSRM = null;
}

window.rutaViajeOSRM = resultado.coords;

if (window.lineaRutaViaje) {
  window.mapa.removeLayer(window.lineaRutaViaje);
  window.lineaRutaViaje = null;
}

window.lineaRutaViaje = L.polyline(resultado.coords, {
  color: '#0ea5e9',
  weight: 6,
  opacity: 0.85
}).addTo(window.mapa);

window.lineaRutaViaje.bringToFront();
  //window.mapa.fitBounds(
    //window.lineaRutaViaje.getBounds(),
    //{ padding: [40, 40] }
  //);
}

window.dibujarRutaViajeEnCurso = dibujarRutaViajeEnCurso;

async function fetchTaxis() {

  const res = await fetch('/taxis/positions');

  if (!res.ok) {
    throw new Error(`Error HTTP taxis: ${res.status}`);
  }

  return await res.json();
}

function colorTaxi(taxi) {
  const estadoTaxi =
    taxi.estado_operativo ||
    taxi.estado ||
    'desconocido';

  const tipoGps = detectarTipoGps(taxi);

  const idTaxiColor = taxi.taxi_id || taxi.id;
  const idTaxiSeleccionado = window.taxiSeleccionadoId;

  const viajeActivo = window.viajeSeleccionado;

  const perteneceAlViajeActivo =
    viajeActivo &&
    viajeActivo.taxi_id &&
    viajeActivo.taxi_id === idTaxiColor;

  const estadoViaje = perteneceAlViajeActivo
    ? viajeActivo.estado
    : null;

  // El estado del viaje tiene prioridad visual
  if (estadoViaje === 'en_curso') {
    return '#ef4444';
  }

  if (
    estadoViaje === 'asignado' ||
    estadoViaje === 'en_camino_origen' ||
    estadoViaje === 'en_origen'
  ) {
    return '#2563eb';
  }

  // Estados propios del taxi
  if (
    estadoTaxi === 'ocupado' ||
    estadoTaxi === 'en_curso'
  ) {
    return '#ef4444';
  }

  if (
    estadoTaxi === 'asignado' ||
    estadoTaxi === 'en_camino_origen' ||
    estadoTaxi === 'en_origen'
  ) {
    return '#2563eb';
  }

  if (tipoGps.tipo === 'offline') {
    return '#6b7280';
  }

  // Naranja solamente para selección manual de un taxi disponible
  if (
    estadoTaxi === 'disponible' &&
    idTaxiSeleccionado &&
    idTaxiColor === idTaxiSeleccionado
  ) {
    return '#f59e0b';
  }

  if (estadoTaxi === 'disponible') {
    return '#22c55e';
  }

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

    
   window.marcadoresPorTaxi = window.marcadoresPorTaxi || {};
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

let marker =
  window.marcadoresPorTaxi[taxi.taxi_id];

 if (marker && marker._sgofTaxiId && marker._sgofTaxiId !== taxi.taxi_id) {
  console.warn('Marcador cruzado detectado. Se elimina:', {
    esperado: taxi.taxi_id,
    encontrado: marker._sgofTaxiId
  });

  if (window.mapa.hasLayer(marker)) {
    window.mapa.removeLayer(marker);
  }

  marker = null;
}

const usarPosSimulada =
  posSimulada &&
  (
    taxi.estado === 'ocupado' ||
    taxi.estado === 'asignado' ||
    taxi.estado_operativo === 'ocupado' ||
    taxi.estado_operativo === 'asignado'
  );

const latFinal = usarPosSimulada ? posSimulada.lat : lat;
const lngFinal = usarPosSimulada ? posSimulada.lng : lng;

//console.log('--------------------------------');
//console.log('Taxi:', taxi.codigo_movil);
//console.log('taxi_id:', taxi.taxi_id);
//console.log('GPS:', lat, lng);
//console.log('SIMULADA:', posSimulada);
//console.log('FINAL:', latFinal, lngFinal);

//console.log('FUENTE:', taxi.fuente);
//console.log('ESTADO:', taxi.estado);
//console.log('OBJETO:', taxi);

if (!marker) {
  marker = L.marker([latFinal, lngFinal], {
    icon: iconoTaxi(taxi)
  }).addTo(window.mapa);

  marker._sgofTipo = 'taxi';
  marker._sgofTaxiId = taxi.taxi_id;

  window.marcadoresPorTaxi[taxi.taxi_id] = marker;
  
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

  // Actualiza inmediatamente color, rumbo y estado visual
  marker.setIcon(iconoTaxi(taxi));

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
}|${
  colorTaxi(taxi)
}`;


if (marker._sgofFirmaIcono !== firmaIcono) {
  marker.setIcon(iconoTaxi(taxi));
  marker._sgofFirmaIcono = firmaIcono;
}

      
      window.marcadoresPorTaxi[taxi.taxi_id] = marker;

      if (contenedor) {
        const card = renderTaxiCard(taxi);

      const estadosViajeOperativo = [
  'asignado',
  'en_camino_origen',
  'en_origen',
  'en_curso'
];

const taxiPerteneceAViajeActivo =
  window.viajeSeleccionado &&
  estadosViajeOperativo.includes(window.viajeSeleccionado.estado) &&
  String(window.viajeSeleccionado.taxi_id) === String(taxi.taxi_id);

if (
  taxiPerteneceAViajeActivo &&
  String(window.taxiSeleccionadoId) === String(taxi.taxi_id)
) {
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
function establecerTaxiSeleccionado(taxiId) {
  taxiSeleccionadoId = taxiId || null;
  window.taxiSeleccionadoId = taxiId || null;
}
function limpiarTaxiSeleccionado() {
  taxiSeleccionadoId = null;
  window.taxiSeleccionadoId = null;
  seguirTaxiSeleccionado = false;

  Object.values(cardsPorTaxi || {}).forEach(card => {
    card.classList.remove('seleccionado');
  });

  document.querySelectorAll('.taxi-card.seleccionado').forEach(card => {
    card.classList.remove('seleccionado');
  });

  if (typeof limpiarPanelGpsTaxi === 'function') {
    limpiarPanelGpsTaxi();
  }

  Object.values(window.marcadoresPorTaxi || {}).forEach(marker => {
    marker._sgofFirmaIcono = null;
  });
}

function seleccionarTaxi(taxiId, centrarMapa = true, abrirPopup = true, enfocarCard = true) {
  seguirTaxiSeleccionado = true;

  establecerTaxiSeleccionado(taxiId);

  if (typeof mostrarPanelGpsTaxi === 'function') {
    mostrarPanelGpsTaxi(taxiId);
  }

  Object.values(cardsPorTaxi || {}).forEach(card => {
    card.classList.remove('seleccionado');
  });

  const card = cardsPorTaxi?.[taxiId];
  if (card) {
    card.classList.add('seleccionado');
  }

  const marker = window.marcadoresPorTaxi?.[taxiId];

  if (
    marker &&
    abrirPopup &&
    window.viajeSeleccionadoId
  ) {
    marker.openPopup();
  }

 if (
  typeof window.dibujarRutaTaxiAsignado === 'function' &&
  window.viajeSeleccionado &&
  window.viajeSeleccionado.taxi_id
) {
  window.dibujarRutaTaxiAsignado(window.viajeSeleccionado);
} else if (
  typeof window.dibujarLineaTaxiPasajero === 'function'
) {
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
window.limpiarPanelGpsTaxi = limpiarPanelGpsTaxi;


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
