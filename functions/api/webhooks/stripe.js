// Stripe Webhook：支付成功后更新用户付费状态并发送邮件

const textEncoder = new TextEncoder();

const toHex = (buffer) =>
  [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");

const verifyStripeSignature = async (rawBody, signatureHeader, secret) => {
  if (!signatureHeader || !secret) {
    return false;
  }
  const items = signatureHeader.split(",").map((item) => item.trim());
  const timestampItem = items.find((item) => item.startsWith("t="));
  const signatureItem = items.find((item) => item.startsWith("v1="));
  if (!timestampItem || !signatureItem) {
    return false;
  }
  const timestamp = timestampItem.replace("t=", "");
  const signature = signatureItem.replace("v1=", "");
  const payload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));
  const expected = toHex(signed);
  return expected === signature;
};

const sendEmail = async (env, to, subject, html) => {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM || !to) {
    return;
  }
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to,
      subject,
      html
    })
  });
};

export const onRequestPost = async ({ request, env }) => {
  const rawBody = await request.text();
  const signature = request.headers.get("Stripe-Signature");
  const valid = await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    return new Response("签名验证失败", { status: 400 });
  }

  const event = JSON.parse(rawBody);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.order_id;
    const email = session.customer_details?.email || session.customer_email || "";

    if (orderId) {
      await env.DB.prepare("UPDATE orders SET status = ? WHERE id = ?")
        .bind("paid", orderId)
        .run();
    }

    if (email) {
      await env.DB.prepare("UPDATE users SET paid = 1 WHERE email = ?")
        .bind(email)
        .run();
    }

    await sendEmail(
      env,
      email,
      "订单支付成功",
      `<p>你的订单已支付成功，我们将开始编译定制钱包。</p><p>订单号：${orderId}</p>`
    );
  }

  return new Response("ok", { status: 200 });
};
