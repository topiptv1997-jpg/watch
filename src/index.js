export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. 处理后端 API 路由 (匹配 /api/*)
    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request, env);
    }

    // 2. 处理短链接跳转路由 (匹配 /go/*)
    if (url.pathname.startsWith('/go/')) {
      return handleGoRequest(request, env);
    }

    // 3. 核心修复：精准处理 /admin 路径
    if (url.pathname.startsWith('/admin')) {
      // 如果用户访问的是 /admin 或 /admin/，强制补全为 /admin/index.html
      if (url.pathname === '/admin' || url.pathname === '/admin/') {
        const adminIndexUrl = new URL('/admin/index.html', request.url);
        return await env.ASSETS.fetch(new Request(adminIndexUrl, request));
      }
      
      // 如果访问的是 /admin/ 目录下的其他静态资源（如 js, css, md 图像等）
      return await env.ASSETS.fetch(request);
    }

    // 4. 其他所有普通请求（例如访问前端根目录首页），直接交给静态资源
    return await env.ASSETS.fetch(request);
  }
};

/**
 * 处理 /api/* 的后端请求示例
 */
async function handleApiRequest(request, env) {
  const url = new URL(request.url);

  // 示例 API：从您绑定的 DATA_KV 中读取数据
  if (url.pathname === '/api/get-data') {
    try {
      const kvData = await env.DATA_KV.get("example_key") || "暂无数据";
      return new Response(JSON.stringify({ success: true, data: kvData }), {
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
    }
  }

  // 默认 API 404 回应
  return new Response(JSON.stringify({ error: "API 路由未找到" }), { 
    status: 404,
    headers: { "Content-Type": "application/json" }
  });
}

/**
 * 处理 /go/* 的重定向跳转示例
 */
async function handleGoRequest(request, env) {
  const url = new URL(request.url);
  // 提取 /go/ 后面的后缀（例如 /go/home -> home）
  const parts = url.pathname.split('/');
  const key = parts[2]; 

  if (key) {
    // 从 KV 数据库中查找对应的重定向 URL
    const targetUrl = await env.DATA_KV.get(`redirect:${key}`);
    if (targetUrl) {
      return Response.redirect(targetUrl, 302);
    }
  }

  return new Response("跳转链接未找到或已过期", { status: 404 });
}
