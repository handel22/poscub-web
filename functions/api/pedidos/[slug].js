// GET /api/pedidos/:slug — lista los pedidos de un negocio (los mas recientes primero).
// La APK lo consulta en la pantalla "Pedidos web".
export async function onRequestGet(context) {
  try {
    const slug = context.params.slug;
    if (!slug || !/^[a-z0-9-]{1,40}$/.test(slug)) {
      return Response.json({ success: false, error: 'Negocio invalido' }, { status: 400 });
    }
    const prefix = "pedido:" + slug + ":";
    const res = await context.env.SITIOS.list({ prefix, limit: 100 });
    // La clave incluye el timestamp: orden descendente = mas recientes primero
    const keys = res.keys.map((k) => k.name).sort().reverse().slice(0, 100);
    const pedidos = [];
    for (const key of keys) {
      const val = await context.env.SITIOS.get(key);
      if (!val) continue;
      try { pedidos.push(JSON.parse(val)); } catch (e) { /* ignorar corrupto */ }
    }
    return Response.json({ success: true, pedidos, total: pedidos.length });
  } catch (e) {
    return Response.json({ success: false, error: 'Error: ' + e.message }, { status: 500 });
  }
}
