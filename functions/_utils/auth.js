// Clerk JWT 验证工具（Cloudflare Functions 可用）
// 说明：仅验证基础签名与过期时间，供 /api/me 等接口使用。

const decodeBase64Url = (value) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i += 1) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes;
};

const decodeJson = (value) => {
  const bytes = decodeBase64Url(value);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text);
};

const importJwk = async (jwk) => {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
};

const verifySignature = async (token, jwk) => {
  const [header, payload, signature] = token.split(".");
  const data = new TextEncoder().encode(`${header}.${payload}`);
  const sigBytes = decodeBase64Url(signature);
  const key = await importJwk(jwk);
  return crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sigBytes, data);
};

const getJwt = (request) => {
  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.replace("Bearer ", "").trim();
};

const fetchJwks = async (env) => {
  const jwksUrl = env.CLERK_JWKS_URL || `${env.CLERK_ISSUER}/.well-known/jwks.json`;
  const response = await fetch(jwksUrl);
  if (!response.ok) {
    throw new Error("无法获取 Clerk JWKS");
  }
  return response.json();
};

export const verifyClerkJwt = async (request, env) => {
  const token = getJwt(request);
  if (!token) {
    return null;
  }

  const [headerPart, payloadPart] = token.split(".");
  if (!headerPart || !payloadPart) {
    return null;
  }

  const header = decodeJson(headerPart);
  const payload = decodeJson(payloadPart);

  const jwks = await fetchJwks(env);
  const jwk = jwks.keys?.find((key) => key.kid === header.kid);
  if (!jwk) {
    return null;
  }

  const valid = await verifySignature(token, jwk);
  if (!valid) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    return null;
  }

  if (env.CLERK_ISSUER && payload.iss !== env.CLERK_ISSUER) {
    return null;
  }

  return payload;
};
