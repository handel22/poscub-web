export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { slug, html, license_type } = body;
    if (license_type !== 'permanent') {
      return Response.json({ success: false, error: 'Solo Permanentes' }, { status: 403 });
    }
    await context.env.SITIOS.put("sitio:" + slug, html);
    return Response.json({ success: true, slug });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
