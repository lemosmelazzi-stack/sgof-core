let filtroActivo = 'todos';
function taxiDisponibleParaAsignar(taxi) {
  return (taxi.estado || '').toLowerCase() === 'disponible' &&
    taxi.estado_operativo !== 'asignado';
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

async function dibujarRutaRealTaxiPasajero(posTaxi, posViaje) {

  const url = `https://router.project-osrm.org/route/v1/driving/${posTaxi.lng},${posTaxi.lat};${posViaje.lng},${posViaje.lat}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data.routes || data.routes.length === 0) {
    console.warn('No se encontró ruta real');
    return;
  }

  const coords = data.routes[0].geometry.coordinates.map(coord => [
    coord[1],
    coord[0]
  ]);

  if (lineaTaxiPasajero) {
    mapa.removeLayer(lineaTaxiPasajero);
  }

  lineaTaxiPasajero = L.polyline(coords, {
    color: '#2563eb',
    weight: 5,
    opacity: 0.9
  }).addTo(mapa);

  const distanciaKm = (data.routes[0].distance / 1000).toFixed(2);
  const etaMin = Math.round(data.routes[0].duration / 60);

  console.log('RUTA REAL TAXI → PASAJERO:', {
    distanciaKm,
    etaMin
  });

mostrarResumenRuta(distanciaKm, etaMin);
}
async function calcularETAEntrePuntos(posTaxi, posViaje) {

  const url = `https://router.project-osrm.org/route/v1/driving/${posTaxi.lng},${posTaxi.lat};${posViaje.lng},${posViaje.lat}?overview=false`;

  try {

    const res = await fetch(url);
    const data = await res.json();

    if (!data.routes || !data.routes.length) {
      return null;
    }

    return {
      distanciaKm: data.routes[0].distance / 1000,
      etaMin: data.routes[0].duration / 60
    };

  } catch (error) {

    console.error('Error calculando ETA:', error);

    return null;
  }
}
async function encontrarMejorTaxiParaViaje() {

  if (!marcadorViaje) return;

  const posViaje = marcadorViaje.getLatLng();

  let mejorTaxiId = null;
  let mejorETA = Infinity;

  for (const taxiId in marcadoresPorTaxi) {

    const markerTaxi = marcadoresPorTaxi[taxiId];

    if (!markerTaxi) continue;

    const posTaxi = markerTaxi.getLatLng();

    const resultado = await calcularETAEntrePuntos(posTaxi, posViaje);

    if (!resultado) continue;

    console.log('ETA TAXI:', taxiId, resultado);

    if (resultado.etaMin < mejorETA) {
      mejorETA = resultado.etaMin;
      mejorTaxiId = taxiId;
    }
  }

  console.log('MEJOR TAXI:', mejorTaxiId, mejorETA);

  if (mejorTaxiId) {

    seleccionarTaxi(mejorTaxiId, true, true, true);

    mostrarMensaje(
      `🚕 Mejor taxi encontrado (${Math.round(mejorETA)} min)`,
      'success'
    );
  }
}

function dibujarLineaTaxiPasajero() {
  console.log('DIBUJAR LINEA:', {
    taxiSeleccionadoId,
    viajeSeleccionadoId,
    markerTaxi: marcadoresPorTaxi[taxiSeleccionadoId],
    marcadorViaje
  });

  if (!taxiSeleccionadoId || !viajeSeleccionadoId) return;

  const markerTaxi = marcadoresPorTaxi[taxiSeleccionadoId];

  if (!markerTaxi || !marcadorViaje) return;

  const posTaxi = markerTaxi.getLatLng();
  const posViaje = marcadorViaje.getLatLng();

 dibujarRutaRealTaxiPasajero(posTaxi, posViaje);
}
  

function seleccionarTaxi(taxiId, centrarMapa = true, abrirPopup = true, enfocarCard = true) {
 seguirTaxiSeleccionado = true;
    taxiSeleccionadoId = taxiId;

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

  const marker = marcadoresPorTaxi[taxiId];

  if (marker && centrarMapa) {
    mapa.flyTo(marker.getLatLng(), 16, {
      animate: true,
      duration: 0.8
    });
  }

  if (marker && abrirPopup) {
    marker.openPopup();
  }
  dibujarLineaTaxiPasajero();
}
// Genera el HTML interno de una tarjeta de taxi
function getTaxiCardHTML(taxi) {
  const estadoVisible =
    taxi.estado_operativo === 'asignado'
      ? 'Asignado / en movimiento'
      : (taxi.estado ?? 'sin dato');

  return `
    <strong>🚕 ${taxi.codigo_movil || 'Sin código'}</strong><br>
    Matrícula: ${taxi.matricula ?? 'sin dato'}<br>
    Estado: ${estadoVisible}<br>
    Operativo: ${taxi.estado_operativo ?? 'sin dato'}<br>
    Velocidad: ${taxi.velocidad_kmh ?? 'sin dato'} km/h<br>
    Última actualización: ${taxi.ultima_actualizacion ?? 'sin dato'}<br>
    Coordenadas: ${taxi.latitud ?? 'sin dato'}, ${taxi.longitud ?? 'sin dato'}
  `;
}

// Renderiza la tarjeta visual de un taxi en el panel
function renderTaxiCard(taxi) {
  const div = document.createElement('div');
  div.className = 'taxi-card';
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

dibujarLineaTaxiPasajero();
   
  };

  return div;
}

function actualizarTaxiCardExistente(taxi, div) {
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

  window.dibujarLineaTaxiPasajero();
};

}
function renderResumen(total, disponibles, enMovimiento, ocupados) {
  document.getElementById('resumen').innerHTML = `
    <div class="resumen-item">Total: ${total}</div>
    <div class="resumen-item">Disponibles: ${disponibles}</div>
    <div class="resumen-item">En movimiento: ${enMovimiento}</div>
    <div class="resumen-item">Ocupados: ${ocupados}</div>
  `;
}

function renderLeyenda() {
  document.getElementById('leyenda').innerHTML = `
    <div class="leyenda-item"><span class="leyenda-color" style="background: green;"></span>Disponible</div>
    <div class="leyenda-item"><span class="leyenda-color" style="background: orange;"></span>En movimiento</div>
    <div class="leyenda-item"><span class="leyenda-color" style="background: red;"></span>Ocupado</div>
    <div class="leyenda-item"><span class="leyenda-color" style="background: gray;"></span>Sin estado</div>
  `;
}

function renderFiltros() {
  document.getElementById('filtros').innerHTML = `
    <button class="filtro-btn ${filtroActivo === 'todos' ? 'activo' : ''}" onclick="filtroActivo='todos'; cargarTaxis()">Todos</button>
    <button class="filtro-btn ${filtroActivo === 'disponible' ? 'activo' : ''}" onclick="filtroActivo='disponible'; cargarTaxis()">Disponibles</button>
    <button class="filtro-btn ${filtroActivo === 'movimiento' ? 'activo' : ''}" onclick="filtroActivo='movimiento'; cargarTaxis()">En movimiento</button>
    <button class="filtro-btn ${filtroActivo === 'ocupado' ? 'activo' : ''}" onclick="filtroActivo='ocupado'; cargarTaxis()">Ocupados</button>
  `;
}

// Devuelve prioridad visual para ordenar taxis en el panel
function getPrioridadTaxi(taxi) {
  const estado = (taxi.estado_operativo || taxi.estado || '').toLowerCase();

  if (estado === 'disponible') return 1;
  if (estado === 'asignado') return 2;
  if (estado === 'ocupado') return 3;
  if (estado === 'offline') return 4;

  return 5;
}

function moverMarkerSuave(marker, nuevaLat, nuevaLng, duracion = 1000) {
  const inicio = marker.getLatLng();

  const latInicial = inicio.lat;
  const lngInicial = inicio.lng;

  const diferenciaLat = nuevaLat - latInicial;
  const diferenciaLng = nuevaLng - lngInicial;

  const inicioTiempo = performance.now();

  function animar(tiempoActual) {
    const progreso = Math.min((tiempoActual - inicioTiempo) / duracion, 1);

    const latActual = latInicial + diferenciaLat * progreso;
    const lngActual = lngInicial + diferenciaLng * progreso;

    marker.setLatLng([latActual, lngActual]);

    if (progreso < 1) {
      requestAnimationFrame(animar);
    }
  }

  requestAnimationFrame(animar);
}
// Crea o actualiza el marcador de un taxi en el mapa
function actualizarMarkerTaxi(taxi, bounds) {

  const lat = Number(taxi.latitud ?? taxi.lat);
  const lng = Number(taxi.longitud ?? taxi.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    console.warn('Taxi sin coordenadas válidas:', taxi);
    return;
  }

  const taxiId = taxi.taxi_id || taxi.id;
  const codigo = taxi.codigo_movil || taxi.codigo || taxiId;

  let marker = marcadoresPorTaxi[taxiId];

if (marker) {
  moverMarkerSuave(marker, lat, lng, 1000);
  marker.setIcon(crearIconoTaxi(taxi.heading || taxi.rumbo_grados || 0, obtenerColor(taxi)));
  marker.bindPopup(`🚕 ${codigo}`);

  marker.off('click');
  marker.on('click', () => {
    console.log('CLICK TAXI:', taxiId);
    seleccionarTaxi(taxiId, false, false, true);
  });

} else {

    marker = L.marker([lat, lng], {
      icon: crearIconoTaxi(0, obtenerColor(taxi))
    })
      .addTo(mapa)
      .bindPopup(`🚕 ${codigo}`);

    marker.on('click', () => {
      console.log('CLICK TAXI:', taxiId);
      seleccionarTaxi(taxiId, false, false, true);
    });

    marcadoresPorTaxi[taxiId] = marker;
  }
  bounds.push([lat, lng]);
}
async function fetchTaxis() {

  console.log('ENTRANDO A fetchTaxis');

  const res = await fetch('/taxis/positions');

  const data = await res.json();

  console.log('RESPUESTA /taxis/positions:', data);

  return (data.taxis || []).map(taxi => ({
  ...taxi,

  lat: parseFloat(taxi.latitud),
  lng: parseFloat(taxi.longitud),

  speed: taxi.velocidad_kmh || 0,
  heading: taxi.rumbo_grados || 0,

  estado: 'disponible',
  estado_operativo: 'disponible'
}));
}
function reordenarCardsSegunTaxis(taxis) {
  const contenedor = document.getElementById('taxis');
  if (!contenedor) return;

  taxis.forEach((taxi) => {
    const card = cardsPorTaxi[taxi.taxi_id];
    if (card) {
      contenedor.appendChild(card);
    }
  });
}
  

async function cargarTaxis() {

  console.log('ENTRANDO A cargarTaxis');

  try {

    const data = await fetchTaxis();

    const listaTaxis = Array.isArray(data)
      ? data
      : (data.taxis || data.data || []);

    const contenedor = document.getElementById('taxis');

    if (!contenedor) {
      console.error('NO EXISTE #taxis');
      return;
    }

    contenedor.innerHTML = '';

    const bounds = [];
listaTaxis.forEach((taxi) => {
  const div = renderTaxiCard(taxi);

  cardsPorTaxi[taxi.taxi_id] = div;

  contenedor.appendChild(div);

  if (taxi.taxi_id === taxiSeleccionadoId) {
    div.classList.add('seleccionado');
  }

  console.log('DIBUJANDO TAXI:', taxi);

  actualizarMarkerTaxi(taxi, bounds);
});

  } catch (error) {
    console.error('Error en cargarTaxis:', error);
  } finally {
    cargandoTaxis = false;
  }
}
    // limpiar taxis que ya no existen
  

function reordenarCardsSegunTaxis(taxisOrdenados) {
  const contenedor = document.getElementById('taxis');
  if (!contenedor) return;

  taxisOrdenados.forEach((taxi) => {
    const card = cardsPorTaxi[taxi.taxi_id];
    if (card) {
      contenedor.appendChild(card);
    }
  });
}

// Actualiza periódicamente taxis cada 5 segundos
async function actualizarTaxisPeriodico() {
  try {
    await cargarTaxis();
  } catch (error) {
    console.error('Error actualizando taxis periódicamente:', error);
  }
}
