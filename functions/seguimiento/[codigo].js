// GET /seguimiento/:codigo — pagina de seguimiento del pedido para el cliente.
// Renderiza en el servidor consultando la API de envio.cu y se auto-actualiza
// cada 30 segundos via /api/seguimiento/:codigo (mismo origen, sin CORS).
const TRACK_API = 'https://envio-cu-api.pages.dev/api/track/';
const STEPS = ['Pendiente', 'Aceptado', 'En camino', 'Entregado'];

export async function onRequestGet(context) {
  const codigo = context.params.codigo;
  if (!codigo || !/^[A-Za-z0-9-]{1,32}$/.test(codigo)) {
    return htmlPage('Codigo invalido', notFoundBody(codigo));
  }
  let delivery = null;
  try {
    const r = await fetch(TRACK_API + encodeURIComponent(codigo));
    if (r.ok) {
      const data = await r.json();
      if (data && data.delivery) delivery = normalize(data.delivery);
    }
  } catch (e) { /* la pagina reintenta sola cada 30 s */ }

  if (!delivery) {
    return htmlPage('Pedido no encontrado', notFoundBody(codigo));
  }
  return htmlPage('Seguimiento ' + delivery.code, trackingBody(delivery));
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
  };
}

function statusInfo(status) {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'delivered' || s === 'entregado' || s === 'completed')
    return { idx: 3, label: 'Entregado' };
  if (['in_transit', 'on_the_way', 'picked_up', 'en_camino', 'delivering'].includes(s))
    return { idx: 2, label: 'En camino' };
  if (['accepted', 'assigned', 'aceptado', 'asignado'].includes(s))
    return { idx: 1, label: 'Aceptado' };
  if (s === 'cancelled' || s === 'canceled' || s === 'cancelado')
    return { idx: -1, label: 'Cancelado' };
  return { idx: 0, label: 'Pendiente' };
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function timelineHtml(idx) {
  let h = '<div class="timeline">';
  for (let i = 0; i < STEPS.length; i++) {
    const cls = i < idx ? 'done' : (i === idx ? 'now' : 'todo');
    h += '<div class="step ' + cls + '">'
      + '<div class="dot"></div>'
      + '<div class="lbl">' + STEPS[i] + '</div>'
      + '</div>';
    if (i < STEPS.length - 1) h += '<div class="bar ' + (i < idx ? 'done' : '') + '"></div>';
  }
  return h + '</div>';
}

function messengerHtml(m) {
  if (!m || (!m.name && !m.phone)) {
    return '<div class="card"><div class="ct">Mensajero</div>'
      + '<div class="muted">Aun no se asigna mensajero a tu pedido.</div></div>';
  }
  let h = '<div class="card"><div class="ct">Mensajero</div>'
    + '<div class="big">' + esc(m.name) + '</div>';
  if (m.phone) {
    const digits = String(m.phone).replace(/\D/g, '');
    h += '<div><a class="btn ghost" href="tel:' + esc(digits) + '">Llamar: ' + esc(m.phone) + '</a></div>';
  }
  if (m.latitude != null && m.longitude != null) {
    h += '<div style="margin-top:8px"><a class="btn ghost" target="_blank" rel="noopener" '
      + 'href="https://www.google.com/maps?q=' + encodeURIComponent(m.latitude + ',' + m.longitude) + '">'
      + 'Ver ubicacion en el mapa</a></div>';
  }
  return h + '</div>';
}

function detailsHtml(d) {
  let h = '<div class="card"><div class="ct">Detalles del pedido</div>';
  if (d.origin_address)
    h += row('Recoger en', d.origin_address);
  if (d.dest_address)
    h += row('Entregar en', d.dest_address);
  if (d.price != null)
    h += row('Total a cobrar', '$' + esc(d.price));
  if (d.client_name)
    h += row('Cliente', d.client_name);
  return h + '</div>';
}

function row(k, v) {
  return '<div class="row"><span class="k">' + esc(k) + '</span>'
    + '<span class="v">' + esc(v) + '</span></div>';
}

function eventsHtml(events) {
  if (!events || !events.length) return '';
  let h = '<div class="card"><div class="ct">Historial</div><ul class="ev">';
  for (const e of events) {
    const txt = typeof e === 'string' ? e : (e.text || e.description || e.status || JSON.stringify(e));
    h += '<li>' + esc(txt) + '</li>';
  }
  return h + '</ul></div>';
}

function trackingBody(d) {
  const info = statusInfo(d.status);
  const cancelled = info.idx === -1;
  const code = esc(d.code);
  const banner = cancelled
    ? '<div class="cancel">Este pedido fue cancelado.</div>'
    : '<div class="status">' + esc(info.label) + '</div>' + timelineHtml(info.idx);

  return ''
  + '<header class="top"><div class="t1">Seguimiento de pedido</div>'
  + '<div class="t2">Codigo: ' + code + '</div></header>'
  + '<main class="wrap">'
  + banner
  + '<div id="live">' + messengerHtml(d.messenger) + detailsHtml(d) + eventsHtml(d.events) + '</div>'
  + '<div class="upd">Ultima actualizacion: <span id="upd">' + hora() + '</span>'
  + ' &middot; se actualiza solo cada 30 segundos</div>'
  + '</main>'
  + refreshScript(d.code);
}

function notFoundBody(codigo) {
  return ''
  + '<header class="top"><div class="t1">Seguimiento de pedido</div></header>'
  + '<main class="wrap"><div class="card center">'
  + '<div class="big">Pedido no encontrado</div>'
  + '<div class="muted">Revisa que el codigo este bien escrito'
  + (codigo ? ': <b>' + esc(codigo) + '</b>' : '') + '.</div>'
  + '</div></main>';
}

function hora() {
  const n = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return p(n.getHours()) + ':' + p(n.getMinutes()) + ':' + p(n.getSeconds());
}

function refreshScript(code) {
  return '<script>\n'
  + 'var CODE=' + JSON.stringify(code) + ';\n'
  + 'function st(s){s=String(s||"").toLowerCase().trim();\n'
  + ' if(s==="delivered"||s==="entregado"||s==="completed")return{idx:3,label:"Entregado"};\n'
  + ' if(["in_transit","on_the_way","picked_up","en_camino","delivering"].indexOf(s)>=0)return{idx:2,label:"En camino"};\n'
  + ' if(["accepted","assigned","aceptado","asignado"].indexOf(s)>=0)return{idx:1,label:"Aceptado"};\n'
  + ' if(s==="cancelled"||s==="canceled"||s==="cancelado")return{idx:-1,label:"Cancelado"};\n'
  + ' return{idx:0,label:"Pendiente"};}\n'
  + 'var STEPS=["Pendiente","Aceptado","En camino","Entregado"];\n'
  + 'function escH(s){return String(s==null?""):s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}\n'
  + 'function timeline(idx){var h=\'<div class="timeline">\';\n'
  + ' for(var i=0;i<4;i++){var c=i<idx?"done":(i===idx?"now":"todo");\n'
  + '  h+=\'<div class="step \'+c+\'"><div class="dot"></div><div class="lbl">\'+STEPS[i]+\'</div></div>\';\n'
  + '  if(i<3)h+=\'<div class="bar \'+(i<idx?"done":"")+\'"></div>\';}\n'
  + ' return h+"</div>";}\n'
  + 'function render(d){var info=st(d.status);var el=document.getElementById("live");\n'
  + ' var b=document.querySelector(".status,.cancel");\n'
  + ' if(info.idx===-1){if(b){b.outerHTML=\'<div class="cancel">Este pedido fue cancelado.</div>\';}}\n'
  + ' else if(b){b.outerHTML=\'<div class="status">\'+escH(info.label)+\'</div>\'+timeline(info.idx);}\n'
  + ' var m=d.messenger,mh;\n'
  + ' if(m&&(m.name||m.phone)){mh=\'<div class="card"><div class="ct">Mensajero</div><div class="big">\'+escH(m.name)+\'</div>\';\n'
  + '  if(m.phone){var dg=String(m.phone).replace(/\\D/g,"");mh+=\'<div><a class="btn ghost" href="tel:\'+dg+\'">Llamar: \'+escH(m.phone)+\'</a></div>\';}\n'
  + '  if(m.latitude!=null&&m.longitude!=null){mh+=\'<div style="margin-top:8px"><a class="btn ghost" target="_blank" rel="noopener" href="https://www.google.com/maps?q=\'+encodeURIComponent(m.latitude+","+m.longitude)+\'">Ver ubicacion en el mapa</a></div>\';}\n'
  + '  mh+="</div>";}\n'
  + ' else{mh=\'<div class="card"><div class="ct">Mensajero</div><div class="muted">Aun no se asigna mensajero a tu pedido.</div></div>\';}\n'
  + ' el.innerHTML=mh;document.getElementById("upd").textContent=new Date().toLocaleTimeString();}\n'
  + 'setInterval(function(){fetch("/api/seguimiento/"+encodeURIComponent(CODE))\n'
  + ' .then(function(r){return r.json()}).then(function(j){if(j&&j.success&&j.delivery)render(j.delivery)})\n'
  + ' .catch(function(){})},30000);\n'
  + '</script>\n';
}

function htmlPage(title, body) {
  return new Response(
'<!DOCTYPE html>\n'
+ '<html lang="es">\n<head>\n<meta charset="UTF-8">\n'
+ '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
+ '<title>' + esc(title) + ' — posCUB</title>\n'
+ '<style>\n'
+ '*{margin:0;padding:0;box-sizing:border-box}\n'
+ 'body{font-family:\'Segoe UI\',system-ui,sans-serif;background:#ffffff;color:#1A1D29;line-height:1.5}\n'
+ '.top{background:#ffffff;color:#1A1D29;padding:14px 16px;position:sticky;top:0;z-index:50}\n'
+ '.t1{font-weight:800;font-size:1.1em;color:#C24F29}\n'
+ '.t2{font-size:.85em;opacity:.85;margin-top:2px}\n'
+ '.wrap{max-width:560px;margin:0 auto;padding:14px 12px 40px}\n'
+ '.status{background:#C24F29;color:#fff;font-weight:800;font-size:1.25em;text-align:center;padding:14px;border-radius:10px;margin-bottom:4px}\n'
+ '.cancel{background:#b3261e;color:#fff;font-weight:700;text-align:center;padding:14px;border-radius:10px}\n'
+ '.timeline{display:flex;align-items:flex-start;background:#fff;border-radius:10px;padding:16px 10px;margin:10px 0}\n'
+ '.step{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;width:25%}\n'
+ '.dot{width:22px;height:22px;border-radius:50%;background:#ccc;border:3px solid #ddd}\n'
+ '.step.done .dot{background:#2e7d32;border-color:#2e7d32}\n'
+ '.step.now .dot{background:#E8754D;border-color:#C24F29;box-shadow:0 0 0 5px rgba(194,79,41,.35);animation:pulse 1.6s infinite}\n'
+ '@keyframes pulse{0%{box-shadow:0 0 0 3px rgba(194,79,41,.4)}70%{box-shadow:0 0 0 9px rgba(194,79,41,0)}100%{box-shadow:0 0 0 3px rgba(194,79,41,0)}}\n'
+ '.lbl{font-size:.72em;margin-top:6px;text-align:center;color:#666}\n'
+ '.step.done .lbl,.step.now .lbl{color:#232323;font-weight:700}\n'
+ '.bar{flex:1;height:3px;background:#ddd;margin-top:10px}\n'
+ '.bar.done{background:#2e7d32}\n'
+ '.card{background:#fff;border-radius:10px;padding:14px;margin:10px 0;box-shadow:0 1px 3px rgba(0,0,0,.08)}\n'
+ '.ct{font-size:.8em;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:8px;font-weight:700}\n'
+ '.big{font-size:1.15em;font-weight:800;margin-bottom:6px}\n'
+ '.muted{color:#777;font-size:.92em}\n'
+ '.center{text-align:center;padding:30px 14px}\n'
+ '.row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid #f0f0f0;font-size:.95em}\n'
+ '.row:last-child{border-bottom:0}\n'
+ '.k{color:#777}.v{font-weight:700;text-align:right}\n'
+ '.btn{display:inline-block;background:#C24F29;color:#fff;font-weight:800;padding:10px 18px;border-radius:8px;text-decoration:none}\n'
+ '.btn.ghost{background:#fff;border:2px solid #C24F29}\n'
+ '.ev{list-style:none}.ev li{padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:.9em}\n'
+ '.upd{text-align:center;color:#999;font-size:.8em;margin-top:14px}\n'
+ '</style>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
