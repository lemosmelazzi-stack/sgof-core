// Maneja la selección de un viaje pendiente y actualiza UI + mapa
function seleccionarViaje(viaje, card) {
  viajeSeleccionadoId = viaje.id;

  document.querySelectorAll('.card-viaje').forEach((el) => {
  el.classList.remove('seleccionado');
});

card.classList.add('seleccionado');

  const detalle = document.getElementById('detalle-viaje');

  detalle.innerHTML = `
    <div><strong>Código:</strong> ${viaje.codigo || 'Sin código'}</div>
    <div><strong>Cliente:</strong> ${viaje.cliente_nombre || 'Sin cliente'}</div>
    <div><strong>Taxi actual:</strong> ${viaje.taxi_codigo || 'Sin asignar'}</div>
    <div><strong>Origen:</strong> ${viaje.origen_direccion || ''}</div>

    <hr>

    <button
      id="btn-asignar"
      onclick="asignarTaxiSeleccionado('${viaje.id}')"
      style="
        padding: 8px 12px;
        background: #1976d2;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
      "
    >
      Asignar taxi seleccionado
    </button>
  `;

  centrarMapa(viaje);
}
// Envía al backend la asignación de un taxi a un viaje
async function asignarTaxiSeleccionado(viajeId) {
  if (!viajeId || !taxiSeleccionadoId) {
    mostrarMensaje('Seleccioná un taxi', 'error');
    return;
  }

  const btn = document.getElementById('btn-asignar');

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Asignando...';
      btn.style.opacity = '0.7';
      btn.style.cursor = 'not-allowed';
    }

  const res = await fetch(`/viajes/${viajeId}/asignar-taxi`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        taxi_id: taxiSeleccionadoId
      })
    });

    const texto = await res.text();
    console.log('Respuesta backend:', texto);

    let data;

    try {
      data = JSON.parse(texto);
    } catch {
      throw new Error(`La respuesta no es JSON. Status ${res.status}`);
    }

    if (!res.ok) {
      throw new Error(data.mensaje || `Error HTTP ${res.status}`);
    }

    if (data.ok) {
      mostrarMensaje('Taxi asignado correctamente', 'ok');

      viajeSeleccionadoId = null;
      taxiSeleccionadoId = null;

      document.getElementById('detalle-viaje').innerHTML = '';

      document.querySelectorAll('.card-viaje').forEach((el) => {
        el.style.border = '1px solid #ddd';
        el.style.background = 'white';
      });

      document.querySelectorAll('.taxi-card').forEach((el) => {
        el.classList.remove('seleccionado');
      });

     cargarPendientes();
actualizarTaxisPeriodico(); 
    } else {
      mostrarMensaje(data.mensaje || 'No se pudo asignar', 'error');
    }
  } catch (error) {
    console.error('Error al asignar taxi:', error);
    mostrarMensaje(error.message, 'error');
  } finally {
    if (btn && document.body.contains(btn)) {
      btn.disabled = false;
      btn.textContent = 'Asignar taxi seleccionado';
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    }
  }
}
// Carga los viajes pendientes desde el backend y los muestra en pantalla
async function cargarPendientes() {
 console.log('ENTRANDO A cargarPendientes');  
  try {
     const response = await fetch('/viajes?estado=pendiente');  
    const result = await response.json();
 console.log('RESULTADO VIAJES EN MAPA:', result);
        const lista = document.getElementById('lista-pendientes');

    if (!result.ok) {
      lista.innerHTML = '<p>Error al cargar viajes</p>';
      dibujarPendientesEnMapa([]);
      return;
    }

    if (!result.data || result.data.length === 0) {
      lista.innerHTML = '<p>No hay pendientes</p>';
      dibujarPendientesEnMapa([]);
      return;
    }

    lista.innerHTML = '';

    const pendientes = result.data.filter((v) => v.estado === 'pendiente');

    if (pendientes.length === 0) {
      lista.innerHTML = '<p>No hay pendientes</p>';
      dibujarPendientesEnMapa([]);
      return;
    }

    pendientes.forEach((v) => {
      const card = document.createElement('div');
      card.className = 'card-viaje';
      card.style.border = '1px solid #ddd';
      card.style.borderRadius = '8px';
      card.style.padding = '10px';
      card.style.marginBottom = '10px';
      card.style.background = 'white';
      card.style.cursor = 'pointer';

      card.innerHTML = `
        <div><strong>${v.codigo || 'Sin código'}</strong></div>
        <div>${v.cliente_nombre || 'Sin cliente'}</div>
        <div>Taxi: ${v.taxi_codigo || '—'}</div>
        <div>${v.origen_direccion || 'Sin dirección'}</div>
        <div style="color: orange;">${v.estado || ''}</div>
      `;

      card.addEventListener('click', () => seleccionarViaje(v, card));
      lista.appendChild(card);
    });

    dibujarPendientesEnMapa(pendientes);
  } catch (error) {
    console.error('Error cargando pendientes:', error);

    document.getElementById('lista-pendientes').innerHTML =
      '<p>Error de conexión con el backend</p>';
  }
}
// Dibuja en el mapa los puntos de los viajes pendientes
function dibujarPendientesEnMapa(viajes) {
  marcadoresPendientes.forEach((m) => mapa.removeLayer(m));
  marcadoresPendientes = [];

  viajes.forEach((viaje) => {
    let lat = null;
    let lng = null;
    let esAproximado = false;

    if (viaje.latitud != null && viaje.longitud != null) {
      lat = parseFloat(viaje.latitud);
      lng = parseFloat(viaje.longitud);
    } else if (viaje.origen_latitud != null && viaje.origen_longitud != null) {
      lat = parseFloat(viaje.origen_latitud);
      lng = parseFloat(viaje.origen_longitud);
      esAproximado = true;
    }

    if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
      return;
    }

    const marcador = L.circleMarker([lat, lng], {
      radius: 8,
      color: '#ff6600',
      fillColor: '#ff6600',
      fillOpacity: 0.85
    })
      .addTo(mapa)
      .bindPopup(`
        <strong>${viaje.codigo || 'Sin código'}</strong><br>
        Cliente: ${viaje.cliente_nombre || 'Sin cliente'}<br>
        Taxi: ${viaje.taxi_codigo || 'Sin taxi'}<br>
        Origen: ${viaje.origen_direccion || 'Sin dirección'}<br>
        <em>${esAproximado ? 'Ubicación aproximada' : 'Ubicación real'}</em>
      `);

    marcadoresPendientes.push(marcador);
  });
}
