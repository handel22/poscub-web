export async function onRequestPost(context) {
  await context.env.SITIOS.put("test", "hello");
  return Response.json({ success: true });
}
