import { verifyClerkJwt } from "../../_utils/auth.js";

export const onRequestGet = async ({ request, env, params }) => {
  const payload = await verifyClerkJwt(request, env);
  if (!payload) {
    return new Response("未登录", { status: 401 });
  }

  const clerkUserId = payload.sub;
  const user = await env.DB.prepare(
    "SELECT id FROM users WHERE clerk_user_id = ?"
  )
    .bind(clerkUserId)
    .first();

  if (!user) {
    return new Response("用户不存在", { status: 400 });
  }

  const order = await env.DB.prepare(
    "SELECT id, status, type, coin_name, coin_symbol, base_chain, created_at FROM orders WHERE id = ? AND user_id = ?"
  )
    .bind(params.id, user.id)
    .first();

  if (!order) {
    return new Response("订单不存在", { status: 404 });
  }

  return new Response(JSON.stringify(order), {
    headers: { "Content-Type": "application/json" }
  });
};
