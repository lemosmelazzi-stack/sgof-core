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

console.log('MAPA CREADO'); // 👈 agregá esto

mapa.on('click', async function(e) {

  const origen = {
    lat: e.latlng.lat,
    lng: e.latlng.lng
  };


  console.log('CLICK OK', origen);
console.log("ANTES DEL TRY");
  try {
  console.log("ANTES FETCH DIRECTO");

  const res = await fetch('/mapa-taxis');

if (!res.ok) {
  throw new Error(`HTTP ${res.status}`);
}

const data = await res.json();
console.log("DESPUES FETCH DIRECTO", data);
console.log("DATA EN CLICK:", data);
console.log("TAXIS EN CLICK:", data.taxis);
console.log("PRIMER TAXI:", JSON.stringify(data.taxis[0], null, 2));

const mejorTaxi = seleccionarMejorTaxi(origen, data.taxis);
if (!mejorTaxi) {
  console.warn("NO SE ENCONTRO TAXI");
  return;
}
taxiSeleccionadoId = mejorTaxi.taxi_id;

console.log('RESULTADO FINAL:', mejorTaxi);
console.log('TAXI SELECCIONADO ID:', taxiSeleccionadoId);

} catch (error) {
  console.error('ERROR EN CLICK MAPA:', error);
  alert(error.message);
}
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
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        taxi_id: taxiSeleccionadoId
      })
    });

    const data = await res.json();

if (!data.ok) {
  alert('Error al asignar taxi');
  return;
}

// 👇 ESTO ES LO QUE FALTA
mostrarViajeOperativo(data.viaje);

await cargarPendientes();
await cargarTaxis();

    alert('Taxi asignado correctamente.');

    await mostrarViajeEnMapa();
    await cargarTaxis();

  } catch (error) {
    console.error('Error asignando taxi:', error);
    alert('Error al asignar taxi.');
  }
}
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

  console.log("TAXI BASE:", taxiBase);
  console.log("MEJOR TAXI:", mejorTaxi);

  return mejorTaxi;
}

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

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(mapa);

function obtenerColor(taxi) {

  const estado = (taxi.estado || '').toLowerCase();

  // EN VIAJE
  if (
    estado === 'en_viaje' ||
    taxi.en_viaje === true
  ) {
    return '#ef4444';
  }

  // ASIGNADO
  if (estado === 'asignado') {
    return '#3b82f6';
  }

  // MOVIMIENTO
  if (
    (taxi.speed || 0) > 5 ||
    estado === 'disponible_en_movimiento'
  ) {
    return '#f59e0b';
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
      method: 'POST'
    });

    const data = await res.json();

    if (!data.ok) {
      alert('Error al iniciar viaje');
      return;
    }

   alert('Viaje iniciado');

   await cargarViajeActivo();
await cargarTaxis();
await mostrarViajeEnMapa();

activarBotonesOperativos();
document.getElementById('acciones-viaje').classList.remove('oculto');

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

    viajeSeleccionadoId = null;

  //'<p>Ningún viaje seleccionado</p>';

await cargarPendientes();
await cargarViajeActivo();
await cargarTaxis();


  } catch (error) {
    console.error(error);
    alert('Error de conexión');
  }
}
