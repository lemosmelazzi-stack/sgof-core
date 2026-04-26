let marcadorViaje = null;
let marcadoresPendientes = [];
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

function obtenerViajeIdDesdeURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('viajeId');
}
async function mostrarViajeEnMapa() {
  try {
    const viajeId = obtenerViajeIdDesdeURL();

    if (!viajeId) {
      mostrarViajeSeleccionadoEnPanel(null);
      return;
    }

    const res = await fetch(`/viajes/${viajeId}`);
    const data = await res.json();
    const viaje = data.data || data;

    viajeSeleccionado = viaje;

    mostrarViajeSeleccionadoEnPanel(viaje);
   // mostrarOrigenYDestinoEnMapa(viaje);
    centrarMapa(viaje);

  } catch (error) {
    console.error('Error cargando viaje:', error);
    mostrarViajeSeleccionadoEnPanel(null);
  }
}
async function asignarTaxiSeleccionado() {
  if (!viajeSeleccionadoId) {
    alert('Primero seleccioná un viaje.');
    return;
  }

  if (!taxiSeleccionadoId) {
    alert('Primero seleccioná un taxi.');
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

    if (!res.ok || data.ok === false) {
      alert(data.error || 'No se pudo asignar el taxi.');
      return;
    }

    alert('Taxi asignado correctamente.');

    await mostrarViajeEnMapa();
    await cargarTaxis();

  } catch (error) {
    console.error('Error asignando taxi:', error);
    alert('Error al asignar taxi.');
  }
}

async function asignarAutomatico() {
  if (!viajeSeleccionadoId) {
    alert('Seleccioná un viaje primero');
    return;
  }

  try {
    const res = await fetch(`/viajes/${viajeSeleccionadoId}/asignar-automatico`, {
      method: 'POST'
    });

    const data = await res.json();

    if (!data.ok) {
      alert(data.mensaje || 'Error en asignación automática');
      return;
    }

    alert('Asignado automáticamente');

    await mostrarViajeEnMapa();
    await cargarTaxis();

  } catch (error) {
    console.error(error);
    alert('Error de conexión');
  }
}

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(mapa);

  function obtenerColor(taxi) {
  const estado = (taxi.estado || '').toLowerCase();

  if (estado === 'ocupado') return 'red';

  if (
    estado === 'disponible_en_movimiento' ||
    taxi.estado_operativo === 'disponible_en_movimiento'
  ) {
    return 'orange';
  }

  if (estado === 'disponible') return 'green';

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

    await mostrarViajeEnMapa();
await cargarTaxis();

  } catch (error) {
    console.error(error);
    alert('Error de conexión');
  }
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



mostrarViajeEnMapa();

function mostrarViajeSeleccionadoEnPanel(viaje) {
 const panel = document.getElementById('detalle-viaje');

  if (!panel) return;

  if (!viaje) {
    panel.innerHTML = `
      <div style="padding:10px; color:#888;">
        Ningún viaje seleccionado
      </div>
    `;
    return;
  }

   viajeSeleccionadoId = viaje.id;

  panel.innerHTML = `
    <div style="padding:10px; border:1px solid #ddd; border-radius:6px;">
      <h3 style="margin:0 0 8px 0;">Viaje seleccionado</h3>

      <p><strong>Código:</strong> ${viaje.codigo || '-'}</p>
      <p><strong>Estado:</strong> ${viaje.estado || '-'}</p>
      <p><strong>Cliente:</strong> ${viaje.cliente_nombre || '-'}</p>
      <p><strong>Origen:</strong> ${viaje.origen_direccion || viaje.origen_texto || '-'}
      <p><strong>Destino:</strong>${viaje.destino_direccion || viaje.destino_texto || '-'} 
      <p><strong>Taxi:</strong> ${viaje.taxi_codigo || viaje.taxi_codigo_movil || 'Sin asignar'}
      <p><strong>Chofer:</strong> ${viaje.chofer_nombre || '-'}</p>
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
const btnAsignarTaxi = document.getElementById('btn-asignar-taxi');
const btnEnOrigen = document.getElementById('btn-en-origen');
const btnIniciarViaje = document.getElementById('btn-iniciar-viaje');
const btnFinalizarViaje = document.getElementById('btn-finalizar-viaje');
const btnAsignarAuto = document.getElementById('btn-asignar-auto');

if (btnAsignarAuto) {
  btnAsignarAuto.addEventListener('click', asignarAutomatico);
}
if (btnAsignarTaxi) {
  btnAsignarTaxi.addEventListener('click', asignarTaxiSeleccionado);
}

if (btnEnOrigen) {
  btnEnOrigen.addEventListener('click', marcarEnOrigen);
}

if (btnIniciarViaje) {
  btnIniciarViaje.addEventListener('click', iniciarViaje);
}

if (btnFinalizarViaje) {
  btnFinalizarViaje.addEventListener('click', finalizarViaje);
}

// ==========================
// INICIAR VIAJE
// ==========================
async function iniciarViaje() {
  if (!viajeSeleccionadoId) {
    alert('Seleccioná un viaje primero');
    return;
  }

  try {
    const res = await fetch(`/viajes/${viajeSeleccionadoId}/iniciar-viaje`, {
      method: 'PUT'
    });

    const data = await res.json();

    if (!data.ok) {
      alert('Error al iniciar viaje');
      return;
    }

    alert('Viaje iniciado');

    await mostrarViajeEnMapa();
await cargarTaxis();

  } catch (error) {
    console.error(error);
    alert('Error de conexión');
  }
}

// ==========================
// FINALIZAR VIAJE
// ==========================
async function finalizarViaje() {
  if (!viajeSeleccionadoId) {
    alert('Seleccioná un viaje primero');
    return;
  }

  try {
    const res = await fetch(`/viajes/${viajeSeleccionadoId}/finalizar-viaje`, {
      method: 'PUT'
    });

    const data = await res.json();

    if (!data.ok) {
      alert('Error al finalizar viaje');
      return;
    }

    alert('Viaje finalizado');

    await mostrarViajeEnMapa();
await cargarTaxis();

  } catch (error) {
    console.error(error);
    alert('Error de conexión');
  }
}
