import { buildCookie } from "../../../_utils/session.js";

const buildUrl = (base, params) => {
  const url = new URL(base);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
};

const randomState = () => crypto.randomUUID();

export const onRequestGet = async ({ env }) => {
  const state = randomState();
  const redirectUri = env.GOOGLE_REDIRECT_URL;
  const clientId = env.GOOGLE_CLIENT_ID;

  if (!redirectUri || !clientId) {
    return new Response("未配置 Google 登录参数", { status: 500 });
  }

  const authUrl = buildUrl("https://accounts.google.com/o/oauth2/v2/auth", {
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "consent",
    access_type: "online"
  });

  const cookie = buildCookie("oauth_state", state, 300);
  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl,
      "Set-Cookie": cookie
    }
  });
};
