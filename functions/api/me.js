import { verifyClerkJwt } from "../_utils/auth.js";

export const onRequestGet = async ({ request, env }) => {
  const payload = await verifyClerkJwt(request, env);
  if (!payload) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const clerkUserId = payload.sub;
  const email = payload.email || payload.email_address || "";
  const name = payload.name || payload.given_name || "";
  const avatar = payload.picture || "";

  const existing = await env.DB.prepare(
    "SELECT id, paid FROM users WHERE clerk_user_id = ?"
  )
    .bind(clerkUserId)
    .first();

  let userId = existing?.id;
  let paid = existing?.paid || 0;

  if (!userId) {
    const result = await env.DB.prepare(
      "INSERT INTO users (clerk_user_id, email, name, paid) VALUES (?, ?, ?, 0)"
    )
      .bind(clerkUserId, email, name)
      .run();
    userId = result.meta.last_row_id;
  }

  return new Response(
    JSON.stringify({
      authenticated: true,
      paid: Boolean(paid),
      user: {
        id: userId,
        email,
        name,
        avatar
      }
    }),
    {
      headers: { "Content-Type": "application/json" }
    }
  );
};
