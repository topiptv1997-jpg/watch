export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. 处理自定义的后端 API 接口
    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request, env);
    }

    // 2. 处理自定义的短链接/跳转接口
    if (url.pathname.startsWith('/go/')) {
      return handleGoRequest(request, env);
    }

    // 3. 静态资源（ASSETS）兜底处理
    try {
      // 尝试直接获取静态资产（例如：/admin/index.html）
      let response = await env.ASSETS.fetch(request);

      // 如果返回 404，且用户访问的是 /admin 的子路径
      // 针对 Vue / React Router 的 History 模式进行兜底，返回 admin 的首页
      if (response.status === 404 && url.pathname.startsWith('/admin')) {
        const adminIndexUrl = new URL('/admin/index.html', request.url);
        return await env.ASSETS.fetch(new Request(adminIndexUrl, request));
      }

      return response;
    } catch (error) {
      return new Response("服务器内部错误: " + error.message, { status: 500 });
    }
  }
};

/**
 * 示例：处理 /api/* 的后端请求
 */
async function handleApiRequest(request, env) {
  const url = new URL(request.url);

  // 示例：从您绑定的 DATA_KV 中读取数据
  if (url.pathname === '/api/get-config') {
    const configValue = await env.DATA_KV.get("system_config") || "默认配置";
    return new Response(JSON.stringify({ success: true, data: configValue }), {
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  return new Response(JSON.stringify({ error: "未找到 API 路由" }), { 
    status: 404,
    headers: { "Content-Type": "application/json" }
  });
}

/**
 * 示例：处理 /go/* 的跳转请求
 */
async function handleGoRequest(request, env) {
  const url = new URL(request.url);
  // 提取 /go/后面的 key，例如 /go/google -> google
  const key = url.pathname.split('/')[2]; 

  if (key) {
    // 从 KV 数据库中查找对应的重定向 URL
    const targetUrl = await env.DATA_KV.get(`redirect:${key}`);
    if (targetUrl) {
      return Response.redirect(targetUrl, 302);
    }
  }

  return new Response("跳转链接不存在", { status: 404 });
}
