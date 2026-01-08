const form = document.getElementById("fork-form");
const statusLog = document.getElementById("status");
const statusLabel = document.getElementById("status-label");
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
  const entry = document.createElement("p");
  entry.textContent = message;
  statusLog.appendChild(entry);
  statusLog.scrollTop = statusLog.scrollHeight;
};

const setStatus = (text) => {
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

const requestJob = async (payload) => {
  const response = await fetch(config.jobEndpoint, {
    method: "POST",
    body: payload
  });

  if (!response.ok) {
    throw new Error("任务触发失败，请联系管理员。");
  }

  return response.json();
};

const streamLogs = async (jobId) => {
  const response = await fetch(`${config.logStreamEndpoint}/${jobId}`);
  if (!response.ok) {
    appendLog("暂时无法获取日志回显。");
    return;
  }

  const data = await response.json();
  if (Array.isArray(data.logs)) {
    data.logs.forEach((line) => appendLog(line));
  }
};

const demoFlow = () => {
  appendLog("演示模式：支付请求已模拟完成。");
  appendLog("演示模式：任务已提交至系统。");
  appendLog("编译中... 10%/50%/80%/100%");
  appendLog("钱包生成完成，下载链接已发送到邮箱。");
  setStatus("完成");
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

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusLog.innerHTML = "";
  setStatus("处理中");

  const formData = new FormData(form);
  formData.append("price", "1");
  formData.append("currency", "USD");

  if (!validateInputs(formData)) {
    return;
  }

  appendLog("正在发起支付请求...");

  if (!config.paymentEndpoint || !config.jobEndpoint) {
    demoFlow();
    return;
  }

  try {
    const paymentResult = await createPayment(formData);
    appendLog(`支付已创建：${paymentResult.reference || "订单已生成"}`);

    if (paymentResult.paymentUrl) {
      appendLog("请在新窗口完成支付...");
      window.open(paymentResult.paymentUrl, "_blank");
    }

    const jobPayload = new FormData();
    jobPayload.append("email", formData.get("email"));
    jobPayload.append("coinName", formData.get("coinName"));
    jobPayload.append("coinSymbol", formData.get("coinSymbol"));
    jobPayload.append("baseChain", formData.get("baseChain"));
    jobPayload.append("icon", formData.get("icon"));
    jobPayload.append("paymentRef", paymentResult.reference || "pending");

    appendLog("正在触发任务...");
    const jobResult = await requestJob(jobPayload);
    appendLog(`任务已启动：${jobResult.jobId || "任务已创建"}`);
    setStatus("编译中");

    if (jobResult.jobId && config.logStreamEndpoint) {
      appendLog("开始获取编译日志...");
      await streamLogs(jobResult.jobId);
    }
  } catch (error) {
    appendLog(error.message || "发生未知错误。");
    setStatus("失败");
  }
});
