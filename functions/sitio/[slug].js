export async function onRequestGet(context) {
  const slug = context.params.slug;
  if (!slug || !/^[a-z0-9-]{1,40}$/.test(slug)) {
    return new Response('Sitio no encontrado', { status: 404 });
  }
  const html = await context.env.SITIOS.get("sitio:" + slug);
  if (!html) {
    return new Response('Sitio no encontrado', { status: 404 });
  }
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
