
"use strict";

/* ==================================================
   GLOBEXA — CODE 4
   CATÉGORIES ET CATALOGUE DES PRODUITS
   ================================================== */

const catalogueClient = window.supabase.createClient(
  "https://xlxkiyihagoupsajwmze.supabase.co",
  "sb_publishable_3W39fAVPXUDlkCb8Gnzovw_dolfa7P6"
);

const catalogueState = {
  categories: [],
  products: [],
  selectedCategory: null,
  search: "",
  sort: "recent"
};

const catElement = id => document.getElementById(id);

function catEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function catPrice(amount, currency) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency || "USD"
    }).format(Number(amount || 0));
  } catch {
    return Number(amount || 0).toFixed(2) + " " + (currency || "USD");
  }
}

/* 1. CHARGEMENT DES CATÉGORIES */

async function catalogueLoadCategories() {
  const { data, error } = await catalogueClient
    .from("globexa_categories")
    .select("id,name,slug,parent_id")
    .order("name");

  if (error) {
    console.error("GLOBEXA catégories :", error);
    return;
  }

  catalogueState.categories = data || [];
  catalogueRenderCategories();
}

/* 2. AFFICHAGE DES CATÉGORIES ET SOUS-CATÉGORIES */

function catalogueRenderCategories() {
  const container = catElement("categoryList");
  if (!container) return;

  const roots = catalogueState.categories.filter(
    item => !item.parent_id
  );

  if (!roots.length) {
    container.innerHTML = "<p>Aucune catégorie disponible.</p>";
    return;
  }

  container.innerHTML = roots.map(parent => {
    const children = catalogueState.categories.filter(
      item => item.parent_id === parent.id
    );

    return `
      <div class="catalogue-category-group">
        <button
          type="button"
          class="globexa-category"
          data-catalogue-category="${catEscape(parent.id)}">
          ${catEscape(parent.name)}
        </button>

        ${children.length ? `
          <div class="catalogue-subcategories">
            ${children.map(child => `
              <button
                type="button"
                class="catalogue-subcategory"
                data-catalogue-category="${catEscape(child.id)}">
                ${catEscape(child.name)}
              </button>
            `).join("")}
          </div>
        ` : ""}
      </div>
    `;
  }).join("");

  container.querySelectorAll("[data-catalogue-category]")
    .forEach(button => {
      button.addEventListener("click", () => {
        catalogueState.selectedCategory =
          button.dataset.catalogueCategory;

        catalogueRenderProducts();
        catalogueUpdateHeading();

        catElement("products")?.scrollIntoView({
          behavior: "smooth"
        });
      });
    });
}

/* 3. RÉCUPÉRATION DES SOUS-CATÉGORIES */

function catalogueGetCategoryIds(categoryId) {
  const ids = [categoryId];
  let changed = true;

  while (changed) {
    changed = false;

    catalogueState.categories.forEach(category => {
      if (
        category.parent_id &&
        ids.includes(category.parent_id) &&
        !ids.includes(category.id)
      ) {
        ids.push(category.id);
        changed = true;
      }
    });
  }

  return ids;
}

/* 4. CHARGEMENT DES PRODUITS PUBLIÉS */

async function catalogueLoadProducts() {
  const status = catElement("productStatus");

  if (status) {
    status.textContent = "Chargement du catalogue...";
  }

  const { data, error } = await catalogueClient
    .from("globexa_market_products")
    .select(`
      id,
      title,
      description,
      currency,
      base_price,
      moq,
      stock_quantity,
      images,
      country_of_origin,
      category_id,
      store_id,
      status,
      created_at
    `)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("GLOBEXA produits :", error);

    if (status) {
      status.textContent = "Impossible de charger le catalogue.";
    }

    return;
  }

  catalogueState.products = data || [];

  catalogueRenderProducts();
  catalogueRenderNewProducts();
  catalogueUpdateHeading();
}

/* 5. FILTRAGE ET TRI */

function catalogueGetVisibleProducts() {
  let products = [...catalogueState.products];

  if (catalogueState.selectedCategory) {
    const ids = catalogueGetCategoryIds(
      catalogueState.selectedCategory
    );

    products = products.filter(product =>
      ids.includes(product.category_id)
    );
  }

  if (catalogueState.search) {
    const search = catalogueState.search.toLowerCase();

    products = products.filter(product =>
      (product.title || "").toLowerCase().includes(search) ||
      (product.description || "").toLowerCase().includes(search)
    );
  }

  if (catalogueState.sort === "price-low") {
    products.sort((a, b) =>
      Number(a.base_price) - Number(b.base_price)
    );
  }

  if (catalogueState.sort === "price-high") {
    products.sort((a, b) =>
      Number(b.base_price) - Number(a.base_price)
    );
  }

  if (catalogueState.sort === "recent") {
    products.sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    );
  }

  return products;
}

/* 6. OUTILS POUR LES IMAGES */

function catalogueImage(product) {
  const images = product.images;

  if (Array.isArray(images) && images.length) {
    return images[0];
  }

  return "https://placehold.co/500x400?text=GLOBEXA";
}

/* 7. CARTE PRODUIT */

function catalogueProductCard(product) {
  const image = catalogueImage(product);

  return `
    <article class="product-card globexa-product-card">

      <button
        type="button"
        class="catalogue-open-product"
        data-product-id="${catEscape(product.id)}">

        <img
          src="${catEscape(image)}"
          alt="${catEscape(product.title)}"
          loading="lazy">

        <h3>${catEscape(product.title)}</h3>

        <p class="price">
          ${catPrice(product.base_price, product.currency)}
        </p>

        <p>Minimum : ${Number(product.moq || 1)}</p>

        <p>Stock : ${Number(product.stock_quantity || 0)}</p>

      </button>

      <button
        type="button"
        class="catalogue-add-cart"
        data-cart-product="${catEscape(product.id)}">
        Ajouter au panier
      </button>

    </article>
  `;
}

/* 8. AFFICHAGE DU CATALOGUE */

function catalogueRenderProducts() {
  const container = catElement("productList");
  if (!container) return;

  const products = catalogueGetVisibleProducts();

  if (!products.length) {
    container.innerHTML = `
      <p>Aucun produit ne correspond à cette sélection.</p>
    `;
  } else {
    container.innerHTML = products
      .map(catalogueProductCard)
      .join("");
  }

  catalogueAttachProductEvents(container);

  const status = catElement("productStatus");

  if (status) {
    status.textContent =
      products.length + " produit(s) affiché(s)";
  }
}

/* 9. NOUVEAUTÉS */

function catalogueRenderNewProducts() {
  const container = catElement("newProductList");
  if (!container) return;

  const products = [...catalogueState.products]
    .sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    )
    .slice(0, 10);

  container.innerHTML = products.length
    ? products.map(catalogueProductCard).join("")
    : "<p>Aucune nouveauté disponible.</p>";

  catalogueAttachProductEvents(container);
}

/* 10. ÉVÉNEMENTS DES PRODUITS */

function catalogueAttachProductEvents(container) {
  container.querySelectorAll("[data-product-id]")
    .forEach(button => {
      button.addEventListener("click", () => {
        catalogueOpenProduct(button.dataset.productId);
      });
    });

  container.querySelectorAll("[data-cart-product]")
    .forEach(button => {
      button.addEventListener("click", () => {
        catalogueAddToCart(button.dataset.cartProduct);
      });
    });
}

/* 11. DÉTAIL DU PRODUIT */

function catalogueOpenProduct(productId) {
  const product = catalogueState.products.find(
    item => item.id === productId
  );

  if (!product) return;

  const modal = catElement("productDetailModal");
  const content = catElement("productDetailContent");

  if (!modal || !content) return;

  const image = catalogueImage(product);

  content.innerHTML = `
    <div class="globexa-product-detail">

      <img
        src="${catEscape(image)}"
        alt="${catEscape(product.title)}"
        style="width:100%;max-height:360px;object-fit:contain;">

      <h2 id="detailTitle">
        ${catEscape(product.title)}
      </h2>

      <h3>
        ${catPrice(product.base_price, product.currency)}
      </h3>

      <p>
        ${catEscape(
          product.description || "Description non disponible."
        )}
      </p>

      <p>
        Pays d'origine :
        ${catEscape(product.country_of_origin || "Non précisé")}
      </p>

      <p>
        Quantité minimale :
        ${Number(product.moq || 1)}
      </p>

      <p>
        Stock :
        ${Number(product.stock_quantity || 0)}
      </p>

      <button
        type="button"
        id="catalogueDetailAddCart">
        Ajouter au panier
      </button>

    </div>
  `;

  modal.hidden = false;

  catElement("catalogueDetailAddCart")
    ?.addEventListener("click", () => {
      catalogueAddToCart(product.id);
    });
}

/* 12. AJOUT AU PANIER */

async function catalogueAddToCart(productId) {
  const product = catalogueState.products.find(
    item => item.id === productId
  );

  if (!product) {
    alert("Produit introuvable.");
    return;
  }

  if (Number(product.stock_quantity) < Number(product.moq || 1)) {
    alert("Stock insuffisant pour ce produit.");
    return;
  }

  const { data: userData, error: userError } =
    await catalogueClient.auth.getUser();

  if (userError || !userData.user) {
    alert("Connecte-toi pour ajouter un produit au panier.");
    catElement("account")?.scrollIntoView({
      behavior: "smooth"
    });
    return;
  }

  const userId = userData.user.id;

  const { data: existing, error: findError } =
    await catalogueClient
      .from("globexa_market_cart_items")
      .select("id,quantity")
      .eq("user_id", userId)
      .eq("product_id", productId)
      .maybeSingle();

  if (findError) {
    console.error("Panier :", findError);
    alert("Impossible de vérifier le panier.");
    return;
  }

  const quantity = existing
    ? Number(existing.quantity) + Number(product.moq || 1)
    : Number(product.moq || 1);

  if (quantity > Number(product.stock_quantity)) {
    alert("La quantité demandée dépasse le stock disponible.");
    return;
  }

  let result;

  if (existing) {
    result = await catalogueClient
      .from("globexa_market_cart_items")
      .update({ quantity })
      .eq("id", existing.id)
      .eq("user_id", userId);
  } else {
    result = await catalogueClient
      .from("globexa_market_cart_items")
      .insert({
        user_id: userId,
        product_id: productId,
        quantity
      });
  }

  if (result.error) {
    console.error("Ajout panier :", result.error);
    alert("Impossible d'ajouter ce produit au panier.");
    return;
  }

  if (typeof window.loadCart === "function") {
    await window.loadCart();
  }

  if (catElement("productDetailModal")) {
    catElement("productDetailModal").hidden = true;
  }

  alert("Produit ajouté au panier.");
}

/* 13. BARRE DE TRI ET FILTRE */

function catalogueCreateToolbar() {
  const section = catElement("products");
  if (!section || catElement("catalogueToolbar")) return;

  const toolbar = document.createElement("div");
  toolbar.id = "catalogueToolbar";
  toolbar.className = "catalogue-toolbar";

  toolbar.innerHTML = `
    <div class="catalogue-toolbar-search">
      <input
        id="catalogueLocalSearch"
        type="search"
        placeholder="Rechercher dans les produits...">
    </div>

    <div class="catalogue-toolbar-sort">
      <select id="catalogueSort">
        <option value="recent">Plus récents</option>
        <option value="price-low">Prix : croissant</option>
        <option value="price-high">Prix : décroissant</option>
      </select>

      <button id="catalogueReset" type="button">
        Tout afficher
      </button>
    </div>
  `;

  const productList = catElement("productList");
  productList?.parentNode.insertBefore(toolbar, productList);

  catElement("catalogueLocalSearch")
    ?.addEventListener("input", event => {
      catalogueState.search = event.target.value.trim();
      catalogueRenderProducts();
    });

  catElement("catalogueSort")
    ?.addEventListener("change", event => {
      catalogueState.sort = event.target.value;
      catalogueRenderProducts();
    });

  catElement("catalogueReset")
    ?.addEventListener("click", () => {
      catalogueState.selectedCategory = null;
      catalogueState.search = "";
      catalogueState.sort = "recent";

      catElement("catalogueLocalSearch").value = "";
      catElement("catalogueSort").value = "recent";

      catalogueRenderProducts();
      catalogueUpdateHeading();
    });
}

/* 14. TITRE DE LA SÉLECTION */

function catalogueUpdateHeading() {
  const status = catElement("productStatus");
  if (!status) return;

  if (!catalogueState.selectedCategory) {
    status.textContent =
      catalogueState.products.length + " produit(s) dans le catalogue";
    return;
  }

  const category = catalogueState.categories.find(
    item => item.id === catalogueState.selectedCategory
  );

  status.textContent = category
    ? "Catégorie : " + category.name
    : "Produits sélectionnés";
}

/* 15. RECHERCHE PRODUITS */

function catalogueSetupSearch() {
  const form = catElement("searchForm");
  if (!form) return;

  form.addEventListener("submit", event => {
    const type = catElement("searchType")?.value || "products";

    if (type !== "products") return;

    event.preventDefault();
    event.stopImmediatePropagation();

    catalogueState.selectedCategory = null;
    catalogueState.search =
      catElement("searchInput")?.value.trim() || "";

    catalogueRenderProducts();
    catalogueUpdateHeading();

    catElement("products")?.scrollIntoView({
      behavior: "smooth"
    });
  }, true);
}

/* 16. DÉMARRAGE */

async function catalogueInitialize() {
  if (!window.supabase) {
    console.error("Bibliothèque Supabase absente.");
    return;
  }

  catalogueCreateToolbar();
  catalogueSetupSearch();

  await catalogueLoadCategories();
  await catalogueLoadProducts();

  console.log("GLOBEXA Code 4 : catalogue chargé.");
}

window.addEventListener("load", () => {
  setTimeout(catalogueInitialize, 700);
});

