// 后台商品管理接口（编辑/删除）

const requireAdmin = (request, env) => {
  const key = request.headers.get("x-admin-key");
  if (!env.ADMIN_API_KEY || key !== env.ADMIN_API_KEY) {
    return false;
  }
  return true;
};

export const onRequestPut = async ({ request, env, params }) => {
  if (!requireAdmin(request, env)) {
    return new Response("无权限", { status: 401 });
  }
  const data = await request.json();
  await env.DB.prepare(
    "UPDATE products SET name = ?, price = ?, description = ? WHERE id = ?"
  )
    .bind(data.name, data.price, data.description, params.id)
    .run();
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" }
  });
};

export const onRequestDelete = async ({ request, env, params }) => {
  if (!requireAdmin(request, env)) {
    return new Response("无权限", { status: 401 });
  }
  await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(params.id).run();
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" }
  });
};
