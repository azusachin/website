// 后台管理脚本（中文注释）
const config = window.__APP_CONFIG__ || {};
const apiBase = config.apiBase || "/api/admin";

const adminKeyInput = document.getElementById("admin-key");
const adminLoginButton = document.getElementById("admin-login");
const productForm = document.getElementById("product-form");
const productList = document.getElementById("product-list");
const productReset = document.getElementById("product-reset");
const sectionForm = document.getElementById("section-form");
const sectionList = document.getElementById("section-list");
const sectionReset = document.getElementById("section-reset");

const getAdminKey = () => localStorage.getItem("adminKey") || "";

const saveAdminKey = () => {
  const key = adminKeyInput.value.trim();
  localStorage.setItem("adminKey", key);
  alert("管理员密钥已保存");
};

const apiFetch = async (path, options = {}) => {
  const headers = options.headers || {};
  headers["x-admin-key"] = getAdminKey();
  headers["Content-Type"] = "application/json";
  const response = await fetch(`${apiBase}${path}`, { ...options, headers });
  if (!response.ok) {
    throw new Error("请求失败，请检查管理员密钥");
  }
  return response.json();
};

const renderList = (container, items, onEdit, onDelete) => {
  container.innerHTML = "";
  if (!items.length) {
    container.innerHTML = "<p class='muted'>暂无数据</p>";
    return;
  }
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "admin-item";
    card.innerHTML = `
      <div>
        <strong>${item.title || item.name}</strong>
        <p class="muted">${item.description || item.content || ""}</p>
      </div>
      <div class="admin-actions">
        <button data-action="edit">编辑</button>
        <button data-action="delete">删除</button>
      </div>
    `;
    card.querySelector("[data-action='edit']").addEventListener("click", () => onEdit(item));
    card
      .querySelector("[data-action='delete']")
      .addEventListener("click", () => onDelete(item));
    container.appendChild(card);
  });
};

const loadProducts = async () => {
  const data = await apiFetch("/products");
  renderList(
    productList,
    data.items || [],
    (item) => {
      productForm.elements.id.value = item.id;
      productForm.elements.name.value = item.name;
      productForm.elements.price.value = item.price;
      productForm.elements.description.value = item.description;
    },
    async (item) => {
      if (!confirm("确定删除该商品吗？")) {
        return;
      }
      await apiFetch(`/products/${item.id}`, { method: "DELETE" });
      await loadProducts();
    }
  );
};

const loadSections = async () => {
  const data = await apiFetch("/sections");
  renderList(
    sectionList,
    data.items || [],
    (item) => {
      sectionForm.elements.id.value = item.id;
      sectionForm.elements.slug.value = item.slug;
      sectionForm.elements.title.value = item.title;
      sectionForm.elements.content.value = item.content;
    },
    async (item) => {
      if (!confirm("确定删除该文章吗？")) {
        return;
      }
      await apiFetch(`/sections/${item.id}`, { method: "DELETE" });
      await loadSections();
    }
  );
};

const handleProductSubmit = async (event) => {
  event.preventDefault();
  const payload = {
    name: productForm.elements.name.value.trim(),
    price: parseFloat(productForm.elements.price.value),
    description: productForm.elements.description.value.trim()
  };
  const id = productForm.elements.id.value;
  if (id) {
    await apiFetch(`/products/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  } else {
    await apiFetch("/products", { method: "POST", body: JSON.stringify(payload) });
  }
  productForm.reset();
  await loadProducts();
};

const handleSectionSubmit = async (event) => {
  event.preventDefault();
  const payload = {
    slug: sectionForm.elements.slug.value.trim(),
    title: sectionForm.elements.title.value.trim(),
    content: sectionForm.elements.content.value.trim()
  };
  const id = sectionForm.elements.id.value;
  if (id) {
    await apiFetch(`/sections/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  } else {
    await apiFetch("/sections", { method: "POST", body: JSON.stringify(payload) });
  }
  sectionForm.reset();
  await loadSections();
};

adminLoginButton?.addEventListener("click", saveAdminKey);
productForm?.addEventListener("submit", handleProductSubmit);
productReset?.addEventListener("click", () => productForm.reset());
sectionForm?.addEventListener("submit", handleSectionSubmit);
sectionReset?.addEventListener("click", () => sectionForm.reset());

loadProducts();
loadSections();
