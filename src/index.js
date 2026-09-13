/* =========================================================
   Sulan Peptide Worker
   - /api/admin/data        GET   管理后台读取全部数据
   - /api/admin/save-data   POST  管理后台保存数据
   - /api/public/config     GET   落地页读取公开配置
   - 其他                   静态资源兜底
========================================================= */

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

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        /* ---------- 1. 管理后台：读取全部数据 ---------- */
        if (url.pathname === '/api/admin/data' && request.method === 'GET') {
            try {
                const raw = await env.DATA_KV.get('data');
                if (!raw) {
                    // KV 里还没有数据，初始化一份
                    await env.DATA_KV.put('data', JSON.stringify(DEFAULT_DATA));
                    return jsonResponse(DEFAULT_DATA);
                }
                return new Response(raw, { headers: JSON_HEADERS });
            } catch (e) {
                return jsonResponse({ error: e.message }, 500);
            }
        }

        /* ---------- 2. 管理后台：保存全部数据 ---------- */
        if (url.pathname === '/api/admin/save-data' && request.method === 'POST') {
            try {
                const body = await request.text();

                // 校验 JSON
                try {
                    JSON.parse(body);
                } catch {
                    return jsonResponse({ error: 'Invalid JSON' }, 400);
                }

                await env.DATA_KV.put('data', body);
                return jsonResponse({ ok: true });
            } catch (e) {
                return jsonResponse({ error: e.message }, 500);
            }
        }

        /* ---------- 3. 落地页：读取公开配置 ---------- */
        if (url.pathname === '/api/public/config' && request.method === 'GET') {
            try {
                const raw = await env.DATA_KV.get('data');
                let data = {};
                try {
                    data = raw ? JSON.parse(raw) : {};
                } catch {
                    data = {};
                }

                const config = data.config || {};
                const whatsapp = Array.isArray(data.whatsapp) ? data.whatsapp : [];
                const pixels = data.pixels || { meta: [], tiktok: [] };

                const publicConfig = {
                    form_enabled: config.form_enabled !== false,
                    routing_mode: config.routing_mode || 'single',

                    // 只返回启用中的号码
                    whatsapp: whatsapp
                        .filter(x => x && x.active !== false && (x.number || x.phone))
                        .map(x => ({
                            id: x.id,
                            label: x.label || '',
                            number: x.number || x.phone,
                            is_default: x.is_default === true
                        })),

                    // 只返回启用中的像素
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
                    headers: {
                        ...JSON_HEADERS,
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            } catch (e) {
                return jsonResponse({ error: e.message }, 500);
            }
        }

        /* ---------- 4. OPTIONS 预检（跨域时需要） ---------- */
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

        /* ---------- 5. 静态资源兜底 ---------- */
        // 访问 /、/admin/、/assets/xxx 等都会走这里
        if (env.ASSETS) {
            return env.ASSETS.fetch(request);
        }

        return new Response('Not found', { status: 404 });
    }
};