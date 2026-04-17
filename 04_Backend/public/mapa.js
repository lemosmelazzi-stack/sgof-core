let marcadorViaje = null;
let marcadoresPendientes = [];
let filtroActivo = 'todos';
let mapaAjustado = false;

let taxiSeleccionadoId = null;
let seguirTaxiSeleccionado = true;
let viajeSeleccionadoId = null;

let marcadoresPorTaxi = {};
let cardsPorTaxi = {};
let taxisState = new Map();

const FETCH_INTERVAL = 5000;
const ANIMATION_DURATION = 4800;

const mapa = L.map('mapa').setView([-34.90, -56.16], 13);

mapa.on('dragstart', () => {
  seguirTaxiSeleccionado = false;
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(mapa);

function obtenerColor(taxi) {
  if (taxi.estado_operativo === 'disponible_en_movimiento') {
    return 'orange';
  }

  const estado = (taxi.estado || '').toLowerCase();

  if (estado === 'ocupado' || estado === 'asignado' || estado === 'en_viaje') {
    return 'red';
  }

  if (estado === 'disponible' || estado === 'libre') {
    return 'green';
  }

  return 'gray';
}

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function calcularAngulo(lat1, lng1, lat2, lng2) {
  const dy = lat2 - lat1;
  const dx = lng2 - lng1;

  const anguloRad = Math.atan2(dy, dx);
  const anguloDeg = anguloRad * (180 / Math.PI);

  return anguloDeg + 90;
}

function crearIconoTaxi(angulo = 0, color = 'green') {
  return L.divIcon({
    className: 'taxi-icon-wrapper',
    html: `
      <div
        class="taxi-icon"
        style="transform: rotate(${angulo}deg); color: ${color}; transition: transform 0.2s linear;"
      >
        ▲
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
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
  }, 2500);
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

function animarTaxis() {
  const now = performance.now();

  taxisState.forEach((state) => {
    if (!state.animStartTime) return;

    const elapsed = now - state.animStartTime;
    const rawT = Math.min(elapsed / state.animDuration, 1);
    const t = easeInOutCubic(rawT);

    const lat = state.startLat + (state.targetLat - state.startLat) * t;
    const lng = state.startLng + (state.targetLng - state.startLng) * t;

    state.currentLat = lat;
    state.currentLng = lng;

    state.marker.setLatLng([lat, lng]);
    seguirTaxiEnMapa(state);

    if (taxiSeleccionadoId === state.id) {
      state.marker.openPopup();
    }

    if (rawT >= 1) {
      state.animStartTime = 0;
    }
  });

  requestAnimationFrame(animarTaxis);
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

  mapa.setView([lat, lng], 15);

  if (marcadorViaje) {
    mapa.removeLayer(marcadorViaje);
  }

  marcadorViaje = L.marker([lat, lng])
    .addTo(mapa)
    .bindPopup(`
      <strong>${viaje.codigo || ''}</strong><br>
      ${viaje.cliente_nombre || ''}<br>
      ${viaje.origen_direccion || ''}
    `)
    .openPopup();
}
