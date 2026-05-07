let filtroActivo = 'todos';
function taxiDisponibleParaAsignar(taxi) {
  return (taxi.estado || '').toLowerCase() === 'disponible' &&
    taxi.estado_operativo !== 'disponible_en_movimiento';
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

function seleccionarTaxi(taxiId, centrarMapa = true, abrirPopup = true, enfocarCard = true) {
 seguirTaxiSeleccionado = true;
    taxiSeleccionadoId = taxiId;

  Object.values(cardsPorTaxi).forEach(card => {
    card.classList.remove('seleccionado');
  });

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
}
// Genera el HTML interno de una tarjeta de taxi
function getTaxiCardHTML(taxi) {
  const estadoVisible =
    taxi.estado_operativo === 'disponible_en_movimiento'
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
    if (!taxiDisponibleParaAsignar(taxi)) {
      mostrarMensaje('Ese taxi no está disponible', 'error');
      return;
    }

    seleccionarTaxi(taxi.taxi_id, true, true, false);
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
    if (!taxiDisponibleParaAsignar(taxi)) {
      mostrarMensaje('Ese taxi no está disponible', 'error');
      return;
    }

    seleccionarTaxi(taxi.taxi_id, true, true, false);
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
  if (taxi.estado_operativo === 'disponible_en_movimiento') return 2;
  if ((taxi.estado || '').toLowerCase() === 'disponible') return 1;
  if ((taxi.estado || '').toLowerCase() === 'ocupado') return 3;
  return 4;
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
} else {

    marker = L.marker([lat, lng], {
      icon: crearIconoTaxi(0, obtenerColor(taxi))
    })
      .addTo(mapa)
      .bindPopup(`🚕 ${codigo}`);

    marker.on('click', () => {
      if (!taxiDisponibleParaAsignar(taxi)) {
        mostrarMensaje('Ese taxi no está disponible', 'error');
        return;
      }

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
    heading: taxi.rumbo_grados || 0
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

// Actualiza solo resumen, cards y marcadores sin reconstruir toda la lista
async function actualizarTaxisPeriodico() {
  try {
    const data = await fetchTaxis();
console.log('DATA EN cargarTaxis:', data);
    data.taxis.sort((a, b) => {
      return getPrioridadTaxi(a) - getPrioridadTaxi(b);
    });
    let disponibles = 0;
    let enMovimiento = 0;
    let ocupados = 0;

    const taxisVistos = new Set();
    const bounds = [];
   const listaTaxis = Array.isArray(data)
  ? data
  : (data.taxis || data.data || []);

console.log('LISTA TAXIS FINAL:', listaTaxis); 

  data.taxis.forEach((taxi) => {
  if (taxi.estado === 'ocupado') {
    ocupados++;
  } else if (taxi.estado === 'disponible_en_movimiento') {
    disponibles++;
    enMovimiento++;
  } else if (taxi.estado === 'disponible') {
    disponibles++;
  }

  taxisVistos.add(taxi.taxi_id);

  const cardExistente = cardsPorTaxi[taxi.taxi_id];

  if (cardExistente) {
    actualizarTaxiCardExistente(taxi, cardExistente);
  } else {
    const contenedor = document.getElementById('taxis');
    const nuevaCard = renderTaxiCard(taxi);
    cardsPorTaxi[taxi.taxi_id] = nuevaCard;
    contenedor.appendChild(nuevaCard);
  }

  actualizarMarkerTaxi(taxi, bounds);
});
    reordenarCardsSegunTaxis(data.taxis);

    Object.keys(marcadoresPorTaxi).forEach((taxiId) => {
      if (!taxisVistos.has(taxiId)) {
        mapa.removeLayer(marcadoresPorTaxi[taxiId]);
        delete marcadoresPorTaxi[taxiId];
        taxisState.delete(taxiId);

        if (cardsPorTaxi[taxiId]) {
          cardsPorTaxi[taxiId].remove();
          delete cardsPorTaxi[taxiId];
        }
      }
    });

    renderResumen(data.taxis.length, disponibles, enMovimiento, ocupados);

    if (taxiSeleccionadoId && cardsPorTaxi[taxiSeleccionadoId]) {
      cardsPorTaxi[taxiSeleccionadoId].classList.add('seleccionado');

      const markerSeleccionado = marcadoresPorTaxi[taxiSeleccionadoId];
      if (markerSeleccionado) {
        markerSeleccionado.openPopup();
      }
    } else {
      taxiSeleccionadoId = null;
    }
  } catch (error) {
    console.error('Error actualizando taxis periódicamente:', error);
  }
}
let cargandoTaxis = false;


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

   