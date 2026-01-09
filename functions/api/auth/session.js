import { parseCookies, verifySessionCookie } from "../../_utils/session.js";

export const onRequestGet = async ({ request, env }) => {
  if (!env.SESSION_SECRET) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  const cookies = parseCookies(request);
  const session = await verifySessionCookie(cookies.session, env.SESSION_SECRET);
  if (!session) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(
    JSON.stringify({
      authenticated: true,
      user: {
        email: session.email,
        name: session.name,
        avatar: session.picture
      }
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};
