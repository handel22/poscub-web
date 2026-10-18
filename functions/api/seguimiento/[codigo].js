// GET /api/seguimiento/:codigo — proxy JSON del tracking de envio.cu.
// La pagina /seguimiento/:codigo lo consulta cada 30 s (mismo origen, sin CORS).
const TRACK_API = 'https://envio-cu-api.pages.dev/api/track/';

export async function onRequestGet(context) {
  const codigo = context.params.codigo;
  if (!codigo || !/^[A-Za-z0-9-]{1,32}$/.test(codigo)) {
    return json({ success: false, error: 'Codigo invalido' }, 400);
  }
  try {
    const r = await fetch(TRACK_API + encodeURIComponent(codigo));
    if (!r.ok) {
      return json({ success: false, error: 'Pedido no encontrado' }, 404);
    }
    const data = await r.json();
    const delivery = data && data.delivery ? data.delivery : null;
    if (!delivery) {
      return json({ success: false, error: 'Pedido no encontrado' }, 404);
    }
    return json({ success: true, delivery: normalize(delivery) });
  } catch (e) {
    return json({ success: false, error: 'No se pudo consultar el pedido' }, 502);
  }
}

function normalize(d) {
  return {
    code: d.code || d.id || '',
    status: d.status || 'pending',
    origin_address: d.origin_address || d.origin || '',
    dest_address: d.dest_address || d.destination || '',
    price: d.price != null ? d.price : null,
    client_name: d.client_name || d.client || '',
    messenger: d.messenger
      ? {
          name: d.messenger.name || '',
          phone: d.messenger.phone || '',
          latitude: d.messenger.latitude != null ? d.messenger.latitude : null,
          longitude: d.messenger.longitude != null ? d.messenger.longitude : null,
        }
      : null,
    events: Array.isArray(d.events) ? d.events.slice(0, 20) : [],
    updated_at: d.updated_at || d.last_update || null,
  };
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
