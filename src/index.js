const DEFAULT_DATA = {
  stats: { page_views: 0, whatsapp_clicks: 0, form_submissions: 0 },
  config: {
    form_enabled: true,
    routing_mode: 'single',
    pixels: { meta: [], tiktok: [] }
  },
  events: [],
  leads: [],
  whatsapp: [],
  pixels: { meta: [], tiktok: [] }
};

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS
  });
}

/* ---------- 静态资源映射 ---------- */
async function serveAsset(req, env, path) {
  const url = new URL(req.url);
  url.pathname = path;
  const newReq = new Request(url.toString(), req);
  return env.ASSETS.fetch(newReq);
}

/* ---------- /admin 系列路由 ---------- */
async function handleAdminPage(req, env, url) {
  if (
    url.pathname === '/admin' ||
    url.pathname === '/admin/' ||
    url.pathname === '/admin/login'
  ) {
    return serveAsset(req, env, '/admin/index.html');
  }
  if (url.pathname.startsWith('/admin/')) {
    return serveAsset(req, env, url.pathname);
  }
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    /* ---------- 1. API 路由 ---------- */
    if (url.pathname === '/api/admin/data' && request.method === 'GET') {
      try {
        const raw = await env.DATA_KV.get('data');
        if (!raw) {
          await env.DATA_KV.put('data', JSON.stringify(DEFAULT_DATA));
          return jsonResponse(DEFAULT_DATA);
        }
        return new Response(raw, { headers: JSON_HEADERS });
      } catch (e) {
        return jsonResponse({ error: e.message }, 500);
      }
    }

    if (url.pathname === '/api/admin/save-data' && request.method === 'POST') {
      try {
        const body = await request.text();
        try { JSON.parse(body); } catch {
          return jsonResponse({ error: 'Invalid JSON' }, 400);
        }
        await env.DATA_KV.put('data', body);
        return jsonResponse({ ok: true });
      } catch (e) {
        return jsonResponse({ error: e.message }, 500);
      }
    }

    if (url.pathname === '/api/public/config' && request.method === 'GET') {
      try {
        const raw = await env.DATA_KV.get('data');
        let data = {};
        try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }

        const config = data.config || {};
        const whatsapp = Array.isArray(data.whatsapp) ? data.whatsapp : [];
        const pixels = data.pixels || { meta: [], tiktok: [] };

        const publicConfig = {
          form_enabled: config.form_enabled !== false,
          routing_mode: config.routing_mode || 'single',
          whatsapp: whatsapp
            .filter(x => x && x.active !== false && (x.number || x.phone))
            .map(x => ({
              id: x.id,
              label: x.label || '',
              number: x.number || x.phone,
              is_default: x.is_default === true
            })),
          pixels: {
            meta: (pixels.meta || [])
              .filter(x => x && x.enabled !== false)
              .map(x => ({ id: x.id, events: x.events || [] })),
            tiktok: (pixels.tiktok || [])
              .filter(x => x && x.enabled !== false)
              .map(x => ({ id: x.id, events: x.events || [] }))
          }
        };

        return new Response(JSON.stringify(publicConfig), {
          headers: { ...JSON_HEADERS, 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return jsonResponse({ error: e.message }, 500);
      }
    }

    /* ---------- 2. OPTIONS 预检 ---------- */
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    /* ---------- 3. /admin 系列 ---------- */
    const adminResponse = await handleAdminPage(request, env, url);
    if (adminResponse) return adminResponse;

    /* ---------- 4. 静态资源兜底 ---------- */
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  }
};
