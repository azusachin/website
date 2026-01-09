const form = document.getElementById("fork-form");
const statusLog = document.getElementById("status");
const statusLabel = document.getElementById("status-label");
const checkoutForm = document.getElementById("checkout-form");
const paymentStatus = document.getElementById("payment-status");
const config = window.__APP_CONFIG__ || {};
const forbiddenNames = [
  "bitcoin",
  "比特币",
  "litecoin",
  "莱特币",
  "dogecoin",
  "狗狗币",
  "dash",
  "达士币",
  "ethereum",
  "以太坊",
  "monero",
  "门罗币",
  "zcash",
  "zec",
  "ethereum classic",
  "etc",
  "solana",
  "sol",
  "bnb",
  "币安币",
  "okb",
  "ok币",
  "tron",
  "trx",
  "波场币"
];
const forbiddenSymbols = [
  "btc",
  "ltc",
  "doge",
  "dash",
  "eth",
  "xmr",
  "zec",
  "etc",
  "sol",
  "bnb",
  "okb",
  "trx"
];

const appendLog = (message) => {
  if (!statusLog) {
    return;
  }
  const entry = document.createElement("p");
  entry.textContent = message;
  statusLog.appendChild(entry);
  statusLog.scrollTop = statusLog.scrollHeight;
};

const setStatus = (text) => {
  if (!statusLabel) {
    return;
  }
  statusLabel.textContent = text;
};

const createPayment = async (payload) => {
  const response = await fetch(config.paymentEndpoint, {
    method: "POST",
    body: payload
  });

  if (!response.ok) {
    throw new Error("支付请求失败，请稍后再试。");
  }

  return response.json();
};

const requestOrder = async (payload) => {
  const response = await fetch(config.orderEndpoint, {
    method: "POST",
    body: payload
  });

  if (!response.ok) {
    throw new Error("订单创建失败，请联系管理员。");
  }

  return response.json();
};

const fetchOrderStatus = async (orderId) => {
  const response = await fetch(`${config.orderEndpoint}/${orderId}`);
  if (!response.ok) {
    throw new Error("订单状态查询失败。");
  }
  return response.json();
};

const demoFlow = () => {
  appendLog("演示模式：订单已创建。");
  appendLog("演示模式：支付请求已模拟完成。");
  appendLog("编译中... 10%/50%/80%/100%");
  appendLog("钱包生成完成，下载链接已发送到邮箱。");
  setStatus("完成");
};

const getReturnUrl = () => encodeURIComponent(window.location.pathname + window.location.search);

const requireAuth = async () => {
  if (!document.body?.dataset.requiresAuth) {
    return true;
  }

  if (!config.authSessionEndpoint) {
    return true;
  }

  const response = await fetch(config.authSessionEndpoint);
  if (!response.ok) {
    window.location.href = `${config.authLoginUrl || "/login.html"}?returnUrl=${getReturnUrl()}`;
    return false;
  }

  const data = await response.json();
  if (!data || !data.authenticated) {
    window.location.href = `${config.authLoginUrl || "/login.html"}?returnUrl=${getReturnUrl()}`;
    return false;
  }

  return true;
};

const isForbidden = (value, list) => {
  const normalized = value.trim().toLowerCase();
  return list.some((item) => normalized === item.toLowerCase());
};

const validateInputs = (data) => {
  const name = data.get("coinName")?.toString() || "";
  const symbol = data.get("coinSymbol")?.toString() || "";

  if (isForbidden(name, forbiddenNames)) {
    appendLog("禁止使用此名称");
    setStatus("失败");
    return false;
  }

  if (isForbidden(symbol, forbiddenSymbols)) {
    appendLog("禁止使用此缩写");
    setStatus("失败");
    return false;
  }

  return true;
};

const handleCustomizeSubmit = async (event) => {
  event.preventDefault();
  if (!statusLog) {
    return;
  }
  statusLog.innerHTML = "";
  setStatus("处理中");

  const formData = new FormData(form);
  formData.append("price", "1");
  formData.append("currency", "USD");

  if (!validateInputs(formData)) {
    return;
  }

  appendLog("正在发起支付请求...");

  if (!config.orderEndpoint || !config.paymentEndpoint) {
    demoFlow();
    return;
  }

  try {
    const orderResult = await requestOrder(formData);
    appendLog(`订单已创建：${orderResult.orderId || "订单已生成"}`);
    setStatus("待支付");

    if (orderResult.checkoutUrl) {
      window.location.href = orderResult.checkoutUrl;
      return;
    }

    if (orderResult.orderId) {
      window.location.href = `/checkout.html?orderId=${orderResult.orderId}`;
      return;
    }

    appendLog("请前往结账页面完成支付。");
  } catch (error) {
    appendLog(error.message || "发生未知错误。");
    setStatus("失败");
  }
};

const handleCheckoutSubmit = async (event) => {
  event.preventDefault();
  const orderId = new URLSearchParams(window.location.search).get("orderId");
  if (!orderId) {
    alert("缺少订单编号，请先创建订单。");
    return;
  }

  if (!config.paymentEndpoint) {
    alert("支付接口未配置。");
    return;
  }

  const payload = new FormData();
  payload.append("orderId", orderId);
  const paymentResult = await createPayment(payload);
  if (paymentResult.paymentUrl) {
    window.location.href = paymentResult.paymentUrl;
    return;
  }

  if (config.paymentReturnUrl) {
    window.location.href = `${config.paymentReturnUrl}?orderId=${orderId}`;
  }
};

const renderPaymentStatus = async () => {
  if (!paymentStatus || !config.orderEndpoint) {
    return;
  }
  const orderId = new URLSearchParams(window.location.search).get("orderId");
  if (!orderId) {
    paymentStatus.innerHTML = "<p>未找到订单编号。</p>";
    return;
  }

  try {
    const status = await fetchOrderStatus(orderId);
    paymentStatus.innerHTML = `<p>订单号：${orderId}</p><p>状态：${status.status || "处理中"}</p>`;
  } catch (error) {
    paymentStatus.innerHTML = `<p>${error.message || "查询失败"}</p>`;
  }
};

const init = async () => {
  const authed = await requireAuth();
  if (!authed) {
    return;
  }

  if (form) {
    form.addEventListener("submit", handleCustomizeSubmit);
  }
  if (checkoutForm) {
    checkoutForm.addEventListener("submit", handleCheckoutSubmit);
  }
  if (paymentStatus) {
    await renderPaymentStatus();
  }
};

init();
