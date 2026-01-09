import { verifyClerkJwt } from "../_utils/auth.js";

const readForm = async (request) => {
  const contentType = request.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    return request.json();
  }
  const formData = await request.formData();
  const data = {};
  formData.forEach((value, key) => {
    data[key] = value;
  });
  return data;
};

export const onRequestPost = async ({ request, env }) => {
  const payload = await verifyClerkJwt(request, env);
  if (!payload) {
    return new Response("未登录", { status: 401 });
  }

  const clerkUserId = payload.sub;
  const user = await env.DB.prepare(
    "SELECT id, email, name, paid FROM users WHERE clerk_user_id = ?"
  )
    .bind(clerkUserId)
    .first();

  if (!user) {
    return new Response("用户不存在", { status: 400 });
  }

  if (!user.paid) {
    return new Response("未付费，无法提交定制", { status: 402 });
  }

  const data = await readForm(request);
  const orderResult = await env.DB.prepare(
    "INSERT INTO orders (user_id, amount, currency, status, type, coin_name, coin_symbol, base_chain) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      user.id,
      1,
      "USD",
      "submitted",
      "customization",
      data.coinName || "",
      data.coinSymbol || "",
      data.baseChain || ""
    )
    .run();

  const orderId = orderResult.meta.last_row_id;

  if (env.N8N_WEBHOOK_URL) {
    await fetch(env.N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        email: user.email,
        name: user.name,
        coinName: data.coinName,
        coinSymbol: data.coinSymbol,
        baseChain: data.baseChain
      })
    });
  }

  return new Response(
    JSON.stringify({ orderId }),
    { headers: { "Content-Type": "application/json" } }
  );
};
