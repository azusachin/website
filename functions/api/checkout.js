import { verifyClerkJwt } from "../_utils/auth.js";

const buildStripeBody = (params) => {
  const body = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    body.append(key, value);
  });
  return body.toString();
};

export const onRequestPost = async ({ request, env }) => {
  const payload = await verifyClerkJwt(request, env);
  if (!payload) {
    return new Response("未登录", { status: 401 });
  }

  const clerkUserId = payload.sub;
  const user = await env.DB.prepare(
    "SELECT id, email, name FROM users WHERE clerk_user_id = ?"
  )
    .bind(clerkUserId)
    .first();

  if (!user) {
    return new Response("用户不存在", { status: 400 });
  }

  const orderResult = await env.DB.prepare(
    "INSERT INTO orders (user_id, amount, currency, status, type) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(user.id, 1, "USD", "pending_payment", "payment")
    .run();

  const orderId = orderResult.meta.last_row_id;
  const successUrl = `${env.STRIPE_SUCCESS_URL}?orderId=${orderId}`;
  const cancelUrl = env.STRIPE_CANCEL_URL || env.STRIPE_SUCCESS_URL;

  const body = buildStripeBody({
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    "line_items[0][price]": env.STRIPE_PRICE_ID,
    "line_items[0][quantity]": "1",
    "metadata[order_id]": `${orderId}`,
    "customer_email": user.email || ""
  });

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!stripeResponse.ok) {
    return new Response("Stripe 创建失败", { status: 500 });
  }

  const stripeData = await stripeResponse.json();
  return new Response(
    JSON.stringify({
      orderId,
      url: stripeData.url
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};
