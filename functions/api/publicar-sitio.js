export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { slug, html, business_name, license_type } = body;
    if (license_type !== 'permanent') {
      return Response.json({ success: false, error: 'Solo licencias Permanentes' }, { status: 403 });
    }
    if (!slug || !/^[a-z0-9-]{1,40}$/.test(slug)) {
      return Response.json({ success: false, error: 'Slug inválido' }, { status: 400 });
    }
    if (!html || html.length > 500000) {
      return Response.json({ success: false, error: 'HTML inválido' }, { status: 400 });
    }
    await context.env.SITIOS.put(`sitio:${slug}`, html, {
      metadata: { business_name: business_name || slug, updated: new Date().toISOString() },
    });
    const siteUrl = `https://poscub-sitios.pages.dev/sitio/${slug}`;
    return Response.json({ success: true, url: siteUrl, slug });
  } catch (e) {
    return Response.json({ success: false, error: 'Error: ' + e.message }, { status: 500 });
  }
}
