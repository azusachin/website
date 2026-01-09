// 会话与签名工具（使用 HMAC，避免服务器存储）

const encoder = new TextEncoder();

const toBase64Url = (buffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const fromBase64Url = (value) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  return new Uint8Array(decoded.length).map((_, i) => decoded.charCodeAt(i));
};

const sign = async (data, secret) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toBase64Url(signature);
};

export const createSessionCookie = async (payload, secret) => {
  const body = JSON.stringify(payload);
  const encoded = toBase64Url(encoder.encode(body));
  const signature = await sign(encoded, secret);
  return `${encoded}.${signature}`;
};

export const verifySessionCookie = async (cookie, secret) => {
  if (!cookie) {
    return null;
  }
  const parts = cookie.split(".");
  if (parts.length !== 2) {
    return null;
  }
  const [encoded, signature] = parts;
  const expected = await sign(encoded, secret);
  if (signature !== expected) {
    return null;
  }
  const json = new TextDecoder().decode(fromBase64Url(encoded));
  const payload = JSON.parse(json);
  if (payload.exp && payload.exp < Date.now()) {
    return null;
  }
  return payload;
};

export const parseCookies = (request) => {
  const header = request.headers.get("Cookie") || "";
  return header.split(";").reduce((acc, pair) => {
    const [key, ...rest] = pair.trim().split("=");
    if (!key) {
      return acc;
    }
    acc[key] = rest.join("=");
    return acc;
  }, {});
};

export const buildCookie = (name, value, maxAgeSeconds) => {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax"
  ];
  if (maxAgeSeconds) {
    parts.push(`Max-Age=${maxAgeSeconds}`);
  }
  if (name && value && value !== "") {
    parts.push("Secure");
  }
  return parts.join("; ");
};
