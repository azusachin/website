import {
  buildCookie,
  createSessionCookie,
  parseCookies
} from "../../../_utils/session.js";

const decodeJwtPayload = (token) => {
  const payload = token.split(".")[1];
  const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
  const json = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  return JSON.parse(json);
};

const exchangeCode = async (code, env) => {
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: env.GOOGLE_REDIRECT_URL,
    grant_type: "authorization_code"
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!response.ok) {
    throw new Error("兑换 token 失败");
  }
  return response.json();
};

export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return new Response("缺少参数", { status: 400 });
  }

  const cookies = parseCookies(request);
  if (!cookies.oauth_state || cookies.oauth_state !== state) {
    return new Response("状态校验失败", { status: 400 });
  }

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.SESSION_SECRET) {
    return new Response("登录配置不完整", { status: 500 });
  }

  const tokenData = await exchangeCode(code, env);
  const idToken = tokenData.id_token;
  if (!idToken) {
    return new Response("未获取到用户信息", { status: 400 });
  }

  const payload = decodeJwtPayload(idToken);
  if (payload.aud !== env.GOOGLE_CLIENT_ID) {
    return new Response("令牌校验失败", { status: 400 });
  }

  const sessionPayload = {
    sub: payload.sub,
    email: payload.email,
    name: payload.name || payload.given_name || "",
    picture: payload.picture || "",
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7
  };

  const sessionCookie = await createSessionCookie(sessionPayload, env.SESSION_SECRET);
  const cookieHeader = buildCookie("session", sessionCookie, 60 * 60 * 24 * 7);

  return new Response(null, {
    status: 302,
    headers: {
      Location: env.LOGIN_SUCCESS_REDIRECT || "/customize.html",
      "Set-Cookie": cookieHeader
    }
  });
};
