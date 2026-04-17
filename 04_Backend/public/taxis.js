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

  const estadoVisible =
    taxi.estado_operativo === 'disponible_en_movimiento'
      ? 'Asignado / en movimiento'
      : (taxi.estado ?? 'sin dato');

 // Actualiza una tarjeta existente sin recrearla completa
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

  if (!taxiDisponibleParaAsignar(taxi)) {
    div.style.opacity = '0.65';
    div.style.cursor = 'not-allowed';
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

// Crea o actualiza el marcador de un taxi en el mapa
function actualizarMarkerTaxi(taxi, bounds) {
  if (!taxi.latitud || !taxi.longitud) return;

  const lat = parseFloat(taxi.latitud);
  const lng = parseFloat(taxi.longitud);

  if (Number.isNaN(lat) || Number.isNaN(lng)) return;

  let marker = marcadoresPorTaxi[taxi.taxi_id];
  let taxiState = taxisState.get(taxi.taxi_id);

  if (marker && taxiState) {
    taxiState.startLat = taxiState.currentLat;
    taxiState.startLng = taxiState.currentLng;
    taxiState.targetLat = lat;
    taxiState.targetLng = lng;

    taxiState.angle = calcularAngulo(
      taxiState.currentLat,
      taxiState.currentLng,
      lat,
      lng
    );

    taxiState.animStartTime = performance.now();
    taxiState.data = taxi;

    marker.setLatLng([lat, lng]);
    marker.setIcon(crearIconoTaxi(taxiState.angle, obtenerColor(taxi)));
  } else {
    marker = L.marker([lat, lng], {
      icon: crearIconoTaxi(0, obtenerColor(taxi))
    }).addTo(mapa);

    taxiState = crearTaxiState(taxi, marker);
    taxisState.set(taxi.taxi_id, taxiState);
  }

  marker.on('click', () => {
    if (!taxiDisponibleParaAsignar(taxi)) {
      mostrarMensaje('Ese taxi no está disponible', 'error');
      return;
    }

    seleccionarTaxi(taxi.taxi_id, false, false, true);
  });

  marcadoresPorTaxi[taxi.taxi_id] = marker;
  bounds.push([lat, lng]);
}
let filtrosRenderizados = false;
let leyendaRenderizada = false;

// Obtiene desde el backend la lista de taxis del mapa
async function fetchTaxis() {
  const res = await fetch('/mapa-taxis');

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return await res.json();
}

// Actualiza solo resumen, cards y marcadores sin reconstruir toda la lista
async function actualizarTaxisPeriodico() {
  try {
    const data = await fetchTaxis();

    data.taxis.sort((a, b) => {
      return getPrioridadTaxi(a) - getPrioridadTaxi(b);
    });
    let disponibles = 0;
    let enMovimiento = 0;
    let ocupados = 0;

    const taxisVistos = new Set();
    const bounds = [];

    data.taxis.forEach((taxi) => {
      if (taxi.estado === 'ocupado') ocupados++;
      else if (taxi.estado_operativo === 'disponible_en_movimiento') enMovimiento++;
      else if (taxi.estado === 'disponible') disponibles++;

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


  // Carga taxis desde el backend y actualiza UI + mapa
async function cargarTaxis() {
    console.log("ENTRANDO A cargarTaxis");
  cardsPorTaxi = {};
  const taxisVistos = new Set();

  try {
    const data = await fetchTaxis();

    data.taxis.sort((a, b) => {
  return getPrioridadTaxi(a) - getPrioridadTaxi(b);
});

    let total = data.taxis.length;
    let disponibles = 0;
    let enMovimiento = 0;
    let ocupados = 0;

    data.taxis.forEach((taxi) => {
      if (taxi.estado === 'ocupado') ocupados++;
      else if (taxi.estado_operativo === 'disponible_en_movimiento') enMovimiento++;
      else if (taxi.estado === 'disponible') disponibles++;
    });

renderResumen(total, disponibles, enMovimiento, ocupados);
renderLeyenda();
renderFiltros();
    const contenedor = document.getElementById('taxis');
    contenedor.innerHTML = '';

    const bounds = [];

    data.taxis.forEach((taxi) => {
      if (filtroActivo !== 'todos') {
        if (filtroActivo === 'disponible' && taxi.estado !== 'disponible') return;
        if (filtroActivo === 'movimiento' && taxi.estado_operativo !== 'disponible_en_movimiento') return;
        if (filtroActivo === 'ocupado' && taxi.estado !== 'ocupado') return;
      }

      taxisVistos.add(taxi.taxi_id);

      const div = renderTaxiCard(taxi);
      cardsPorTaxi[taxi.taxi_id] = div;
      contenedor.appendChild(div);

      actualizarMarkerTaxi(taxi, bounds);
    });

    // Reordena las tarjetas en el panel según el orden actual de los taxis
function reordenarCardsSegunTaxis(taxisOrdenados) {
  const contenedor = document.getElementById('taxis');

  taxisOrdenados.forEach((taxi) => {
    const card = cardsPorTaxi[taxi.taxi_id];
    if (card) {
      contenedor.appendChild(card);
    }
  });
}

    Object.keys(marcadoresPorTaxi).forEach((taxiId) => {
      if (!taxisVistos.has(taxiId)) {
        mapa.removeLayer(marcadoresPorTaxi[taxiId]);
        delete marcadoresPorTaxi[taxiId];
        taxisState.delete(taxiId);
      }
    });

    if (!mapaAjustado && bounds.length > 0) {
      mapa.fitBounds(bounds, { padding: [40, 40] });
      mapaAjustado = true;
    }

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
    console.error('Error cargando taxis:', error);
    document.getElementById('taxis').innerHTML =
      'Error cargando taxis: ' + error.message;
  }
}


