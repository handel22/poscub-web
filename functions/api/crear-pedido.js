// POST /api/crear-pedido — recibe un pedido de la tienda web y lo guarda en KV.
// El servidor recalcula subtotal y envio con los datos guardados (no confia en el cliente).
export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { slug } = body;

    if (!slug || !/^[a-z0-9-]{1,40}$/.test(slug)) {
      return Response.json({ success: false, error: 'Negocio invalido' }, { status: 400 });
    }

    const siteJson = await context.env.SITIOS.get("sitio-data:" + slug);
    if (!siteJson) {
      return Response.json({ success: false, error: 'Negocio no encontrado' }, { status: 404 });
    }
    let site;
    try { site = JSON.parse(siteJson); }
    catch (e) { return Response.json({ success: false, error: 'Datos del negocio invalidos' }, { status: 500 }); }

    const cliente = String(body.cliente || '').trim().slice(0, 120);
    const telefono = String(body.telefono || '').trim().slice(0, 40);
    if (!cliente) return Response.json({ success: false, error: 'Falta el nombre' }, { status: 400 });
    if (!telefono) return Response.json({ success: false, error: 'Falta el telefono' }, { status: 400 });

    const tipo = body.tipo === 'delivery' ? 'delivery' : 'recoger';
    const metodo_pago = body.metodo_pago === 'transferencia' ? 'transferencia' : 'efectivo';

    const itemsIn = Array.isArray(body.items) ? body.items : [];
    if (itemsIn.length === 0 || itemsIn.length > 200) {
      return Response.json({ success: false, error: 'Carrito vacio' }, { status: 400 });
    }

    // Validar items contra el catalogo y recalcular subtotal con precios del servidor
    const catalog = new Map();
    for (const p of (site.products || [])) catalog.set(String(p.id), p);

    let subtotal = 0;
    const items = [];
    for (const it of itemsIn) {
      const prod = catalog.get(String(it.id));
      if (!prod) continue;
      const qty = Math.min(999, Math.max(1, Math.floor(Number(it.qty) || 0)));
      if (!qty) continue;
      const price = Math.max(0, Number(prod.price) || 0);
      subtotal += price * qty;
      items.push({ id: prod.id, name: prod.name, price, qty });
    }
    if (items.length === 0) {
      return Response.json({ success: false, error: 'Productos invalidos' }, { status: 400 });
    }
    subtotal = Math.round(subtotal * 100) / 100;

    // Envio segun zona (precio guardado por el negocio, no el que mande el cliente)
    let envio = 0;
    let zona = '';
    let envio_a_convenir = false;
    let direccion = '';
    if (tipo === 'delivery') {
      zona = String(body.zona || '').slice(0, 80);
      const zones = Array.isArray(site.delivery_zones) ? site.delivery_zones : [];
      const match = zones.find((z) => z.nombre === zona);
      if (match) {
        envio = Math.max(0, Number(match.precio) || 0);
      } else if (zones.length === 0) {
        envio_a_convenir = true;
        envio = 0;
      } else {
        return Response.json({ success: false, error: 'Zona de delivery invalida' }, { status: 400 });
      }
      direccion = String(body.direccion || '').trim().slice(0, 200);
      if (!direccion) {
        return Response.json({ success: false, error: 'Falta la direccion de entrega' }, { status: 400 });
      }
    }

    const total = Math.round((subtotal + envio) * 100) / 100;
    const now = new Date();
    const pedidoId = "pedido:" + slug + ":" + now.getTime() + ":" + Math.random().toString(36).slice(2, 8);

    const pedido = {
      id: pedidoId,
      slug,
      cliente,
      telefono,
      tipo,
      zona,
      direccion,
      metodo_pago,
      items,
      subtotal,
      envio,
      envio_a_convenir,
      total,
      estado: 'nuevo',
      creado: now.toISOString(),
    };

    // Sin metadata: rompe el build de Pages
    await context.env.SITIOS.put(pedidoId, JSON.stringify(pedido));

    return Response.json({ success: true, pedido_id: pedidoId, total });
  } catch (e) {
    return Response.json({ success: false, error: 'Error: ' + e.message }, { status: 500 });
  }
}
