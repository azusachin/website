// 后台商品管理接口（需要 x-admin-key）

const requireAdmin = (request, env) => {
  const key = request.headers.get("x-admin-key");
  if (!env.ADMIN_API_KEY || key !== env.ADMIN_API_KEY) {
    return false;
  }
  return true;
};

export const onRequestGet = async ({ request, env }) => {
  if (!requireAdmin(request, env)) {
    return new Response("无权限", { status: 401 });
  }
  const items = await env.DB.prepare(
    "SELECT id, name, price, description FROM products ORDER BY id DESC"
  ).all();
  return new Response(JSON.stringify({ items: items.results || [] }), {
    headers: { "Content-Type": "application/json" }
  });
};

export const onRequestPost = async ({ request, env }) => {
  if (!requireAdmin(request, env)) {
    return new Response("无权限", { status: 401 });
  }
  const data = await request.json();
  await env.DB.prepare(
    "INSERT INTO products (name, price, description) VALUES (?, ?, ?)"
  )
    .bind(data.name, data.price, data.description)
    .run();
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" }
  });
};
