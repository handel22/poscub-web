export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { slug, html, business_name, license_type, device_id } = body;
    if (license_type !== 'permanent') {
      return Response.json({ success: false, error: 'Solo licencias Permanentes' }, { status: 403 });
    }
    if (!slug || !/^[a-z0-9-]{1,40}$/.test(slug)) {
      return Response.json({ success: false, error: 'Slug inválido' }, { status: 400 });
    }
    if (!html || html.length > 500000) {
      return Response.json({ success: false, error: 'HTML inválido' }, { status: 400 });
    }

    // Verificar si el slug ya está ocupado por OTRO negocio
    let finalSlug = slug;
    const existing = await context.env.SITIOS.get("sitio-owner:" + slug);
    if (existing && existing !== (device_id || '')) {
      // Ocupado por otro: buscar un slug libre (mi-tienda-2, mi-tienda-3...)
      let n = 2;
      while (n < 100) {
        const candidate = (slug + '-' + n).slice(0, 40);
        const taken = await context.env.SITIOS.get("sitio-owner:" + candidate);
        if (!taken) { finalSlug = candidate; break; }
        n++;
      }
      if (n >= 100) {
        return Response.json({ success: false, error: 'No se pudo asignar dirección' }, { status: 500 });
      }
    }
    // Registrar el dueño del slug
    if (device_id) {
      await context.env.SITIOS.put("sitio-owner:" + finalSlug, device_id);
    }

    // HTML estatico (compatibilidad con versiones anteriores de la APK)
    await context.env.SITIOS.put("sitio:" + finalSlug, html);

    // Datos estructurados para la tienda (sin metadata: rompe el build de Pages)
    const rawProducts = Array.isArray(body.products) ? body.products : [];
    const rawCats = Array.isArray(body.categories) ? body.categories : [];
    const rawZones = Array.isArray(body.delivery_zones) ? body.delivery_zones : [];

    const products = rawProducts.slice(0, 2000).map((p) => ({
      id: p.id != null ? p.id : null,
      name: String(p.name || p.nombre || '').slice(0, 120),
      price: Math.max(0, Number(p.price || p.precio) || 0),
      category: String(p.category || p.categoria || '').slice(0, 80),
      image: typeof p.image === 'string' && p.image ? p.image.slice(0, 500) : null,
    })).filter((p) => p.name);

    const categories = rawCats.slice(0, 100).map((c) => ({
      id: c.id != null ? c.id : null,
      name: String(c.name || c.nombre || '').slice(0, 80),
    })).filter((c) => c.name);

    const delivery_zones = rawZones.slice(0, 50).map((z) => ({
      nombre: String(z.nombre || z.name || '').slice(0, 80),
      precio: Math.max(0, Number(z.precio != null ? z.precio : z.price) || 0),
    })).filter((z) => z.nombre);

    const data = {
      business_name: String(business_name || '').slice(0, 120),
      address: String(body.address || body.direccion || '').slice(0, 200),
      phone: String(body.phone || body.telefono || '').slice(0, 40),
      products,
      categories,
      delivery_zones,
      updated_at: new Date().toISOString(),
    };
    await context.env.SITIOS.put("sitio-data:" + finalSlug, JSON.stringify(data));

    const siteUrl = "https://poscub-sitios.pages.dev/sitio/" + finalSlug;
    return Response.json({ success: true, url: siteUrl, slug: finalSlug });
  } catch (e) {
    return Response.json({ success: false, error: 'Error: ' + e.message }, { status: 500 });
  }
}
