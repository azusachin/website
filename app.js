// 全站通用脚本：登录、付费状态判断、下单、支付
const config = window.__APP_CONFIG__ || {};
const clerkPublishableKey = config.clerkPublishableKey;

const elements = {
  loginButton: document.querySelector("[data-action='login']"),
  logoutButton: document.querySelector("[data-action='logout']"),
  userPanel: document.querySelector("[data-section='user']"),
  userEmail: document.querySelector("[data-field='user-email']"),
  userName: document.querySelector("[data-field='user-name']"),
  userAvatar: document.querySelector("[data-field='user-avatar']"),
  paidPanel: document.querySelector("[data-section='paid']"),
  unpaidPanel: document.querySelector("[data-section='unpaid']"),
  payButton: document.querySelector("[data-action='pay']"),
  customizeForm: document.getElementById("customize-form"),
  customizeStatus: document.getElementById("customize-status"),
  paymentStatus: document.getElementById("payment-status")
};

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

const show = (element) => {
  if (element) {
    element.classList.remove("hidden");
  }
};

const hide = (element) => {
  if (element) {
    element.classList.add("hidden");
  }
};

const setText = (element, value) => {
  if (element) {
    element.textContent = value || "";
  }
};

const setAvatar = (element, url) => {
  if (element) {
    element.src = url || "";
  }
};

const appendStatus = (message) => {
  if (!elements.customizeStatus) {
    return;
  }
  const entry = document.createElement("p");
  entry.textContent = message;
  elements.customizeStatus.appendChild(entry);
  elements.customizeStatus.scrollTop = elements.customizeStatus.scrollHeight;
};

const isForbidden = (value, list) => {
  const normalized = value.trim().toLowerCase();
  return list.some((item) => normalized === item.toLowerCase());
};

const validateInputs = (data) => {
  const name = data.get("coinName")?.toString() || "";
  const symbol = data.get("coinSymbol")?.toString() || "";

  if (isForbidden(name, forbiddenNames)) {
    appendStatus("禁止使用此名称");
    return false;
  }

  if (isForbidden(symbol, forbiddenSymbols)) {
    appendStatus("禁止使用此缩写");
    return false;
  }

  return true;
};

const loadClerk = async () => {
  if (!clerkPublishableKey || !window.Clerk) {
    return null;
  }
  await window.Clerk.load({ publishableKey: clerkPublishableKey });
  return window.Clerk;
};

const getAuthToken = async () => {
  if (!window.Clerk || !window.Clerk.session) {
    return null;
  }
  return window.Clerk.session.getToken();
};

const fetchMe = async () => {
  if (!config.apiBase || !config.apiBase.startsWith("/")) {
    return { authenticated: false };
  }
  const token = await getAuthToken();
  const response = await fetch(`${config.apiBase}/me`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!response.ok) {
    return { authenticated: false };
  }
  return response.json();
};

const updateUserUI = (payload) => {
  if (!payload || !payload.authenticated) {
    hide(elements.userPanel);
    return;
  }

  show(elements.userPanel);
  if (elements.loginButton) {
    elements.loginButton.classList.add("hidden");
  }
  setText(elements.userEmail, payload.user?.email);
  setText(elements.userName, payload.user?.name);
  setAvatar(elements.userAvatar, payload.user?.avatar);

  if (payload.paid) {
    show(elements.paidPanel);
    hide(elements.unpaidPanel);
  } else {
    show(elements.unpaidPanel);
    hide(elements.paidPanel);
  }
};

const handleLogin = async () => {
  if (!window.Clerk) {
    alert("登录组件未初始化，请检查 Clerk 配置。");
    return;
  }
  window.Clerk.openSignIn({ redirectUrl: config.loginReturnUrl || window.location.href });
};

const handleLogout = async () => {
  if (!window.Clerk) {
    return;
  }
  await window.Clerk.signOut();
  window.location.reload();
};

const createCheckout = async () => {
  const token = await getAuthToken();
  const response = await fetch(`${config.apiBase}/checkout`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!response.ok) {
    throw new Error("创建支付失败，请稍后再试。");
  }
  return response.json();
};

const createOrder = async (formData) => {
  const token = await getAuthToken();
  const response = await fetch(`${config.apiBase}/orders`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData
  });
  if (!response.ok) {
    throw new Error("订单创建失败，请稍后再试。");
  }
  return response.json();
};

const fetchOrderStatus = async (orderId) => {
  const token = await getAuthToken();
  const response = await fetch(`${config.apiBase}/orders/${orderId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!response.ok) {
    throw new Error("订单状态查询失败。");
  }
  return response.json();
};

const handlePaymentStatus = async () => {
  if (!elements.paymentStatus) {
    return;
  }
  const orderId = new URLSearchParams(window.location.search).get("orderId");
  if (!orderId) {
    elements.paymentStatus.textContent = "未找到订单编号。";
    return;
  }

  try {
    const status = await fetchOrderStatus(orderId);
    elements.paymentStatus.innerHTML = `<p>订单号：${orderId}</p><p>状态：${status.status || "处理中"}</p>`;
  } catch (error) {
    elements.paymentStatus.textContent = error.message || "查询失败";
  }
};

const handleCustomizeSubmit = async (event) => {
  event.preventDefault();
  if (!elements.customizeForm) {
    return;
  }
  if (elements.customizeStatus) {
    elements.customizeStatus.innerHTML = "";
  }

  const formData = new FormData(elements.customizeForm);
  if (!validateInputs(formData)) {
    return;
  }

  appendStatus("正在提交订单...");

  try {
    const result = await createOrder(formData);
    appendStatus(`订单已提交：${result.orderId || "已创建"}`);
    appendStatus("编译进度将通过邮件通知。");
  } catch (error) {
    appendStatus(error.message || "提交失败");
  }
};

const init = async () => {
  const clerk = await loadClerk();

  if (elements.loginButton) {
    elements.loginButton.addEventListener("click", handleLogin);
  }
  if (elements.logoutButton) {
    elements.logoutButton.addEventListener("click", handleLogout);
  }

  if (elements.payButton) {
    elements.payButton.addEventListener("click", async () => {
      try {
        const checkout = await createCheckout();
        if (checkout.url) {
          window.location.href = checkout.url;
        }
      } catch (error) {
        alert(error.message || "支付发起失败");
      }
    });
  }

  if (elements.customizeForm) {
    elements.customizeForm.addEventListener("submit", handleCustomizeSubmit);
  }

  if (clerk) {
    const payload = await fetchMe();
    updateUserUI(payload);
  }

  await handlePaymentStatus();
};

init();
