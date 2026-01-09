// 简单统计接口，需在请求头携带 x-admin-key

export const onRequestGet = async ({ request, env }) => {
  const adminKey = request.headers.get("x-admin-key");
  if (!env.ADMIN_API_KEY || adminKey !== env.ADMIN_API_KEY) {
    return new Response("无权限", { status: 401 });
  }

  const users = await env.DB.prepare("SELECT COUNT(*) as total FROM users").first();
  const orders = await env.DB.prepare("SELECT COUNT(*) as total FROM orders").first();
  const paid = await env.DB.prepare("SELECT COUNT(*) as total FROM users WHERE paid = 1").first();

  return new Response(
    JSON.stringify({
      users: users?.total || 0,
      orders: orders?.total || 0,
      paidUsers: paid?.total || 0
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};
