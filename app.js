
"use strict";

/* =====================================================
   GLOBEXA — APPLICATION PRINCIPALE
   Supabase : Auth, catégories, produits, boutiques,
   Reels, panier et commandes.
   ===================================================== */

/* 1. CONNEXION SUPABASE */

const SUPABASE_URL = "https://xlxkiyihagoupsajwmze.supabase.co";
const SUPABASE_KEY = "sb_publishable_3W39fAVPXUDlkCb8Gnzovw_dolfa7P6";

let supabaseClient = null;
let supabaseLoadPromise = null;

function createSupabaseClientIfReady() {
  if (
    !supabaseClient &&
    window.supabase &&
    typeof window.supabase.createClient === "function"
  ) {
    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY
    );
  }

  return supabaseClient;
}

function ensureSupabaseClient() {
  const client = createSupabaseClientIfReady();
  if (client) return Promise.resolve(client);
  if (supabaseLoadPromise) return supabaseLoadPromise;

  supabaseLoadPromise = new Promise((resolve, reject) => {
    const sources = [
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
      "https://unpkg.com/@supabase/supabase-js@2"
    ];

    function loadSource(index) {
      const ready = createSupabaseClientIfReady();

      if (ready) {
        resolve(ready);
        return;
      }

      if (index >= sources.length) {
        reject(new Error(
          "Service indisponible. Vérifie Internet et réessaie."
        ));
        return;
      }

      const script = document.createElement("script");
      script.src = sources[index];
      script.async = true;

      script.onload = () => {
        const loaded = createSupabaseClientIfReady();
        if (loaded) resolve(loaded);
        else loadSource(index + 1);
      };

      script.onerror = () => {
        script.remove();
        loadSource(index + 1);
      };

      document.head.appendChild(script);
    }

    loadSource(0);
  }).catch(error => {
    supabaseLoadPromise = null;
    throw error;
  });

  return supabaseLoadPromise;
}

/* 2. ÉTAT DE L'APPLICATION */

const $ = (id) => document.getElementById(id);

const state = {
  user: null,
  profile: null,
  products: [],
  categories: [],
    stores: [],
  cart: [],
  orders: [],
  reels: [],
  selectedProduct: null,
  loading: false
};

/* 3. OUTILS GÉNÉRAUX */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function message(elementId, text, type = "success") {
  const element = $(elementId);
  if (!element) return;

  element.textContent = text;
  element.hidden = false;
  element.className = "message " + type;
}

function hideMessage(elementId) {
  const element = $(elementId);
  if (element) element.hidden = true;
}

function formatPrice(amount, currency = "USD") {
  const value = Number(amount || 0);

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency || "USD"
    }).format(value);
  } catch {
    return value.toFixed(2) + " " + currency;
  }
}

function getProductImage(product) {
  const images = product?.images;
  return Array.isArray(images) && images.length
    ? images[0]
    : "https://placehold.co/500x400?text=GLOBEXA";
}

function setButtonLoading(button, loading, originalText) {
  if (!button) return;

  button.disabled = loading;
  button.textContent = loading ? "Patientez..." : originalText;
}

/* 4. GESTION DU COMPTE */

function showAccount() {
  const loggedOut = $("loggedOut");
  const loggedIn = $("loggedIn");

  if (loggedOut) loggedOut.hidden = Boolean(state.user);
  if (loggedIn) loggedIn.hidden = !state.user;

  if (state.user && $("welcomeText")) {
    const name = state.profile?.full_name || state.user.email;
    $("welcomeText").textContent = "Bienvenue " + name;
  }

  updateReelAccess();
}

async function loadProfile() {
  if (!state.user) {
    state.profile = null;
    return;
  }

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, full_name, country, role, is_admin")
    .eq("id", state.user.id)
    .maybeSingle();

  if (error) {
    console.error("Chargement du profil :", error);
    state.profile = null;
    return;
  }

  state.profile = data || null;
}

/* 5. INSCRIPTION */

async function registerUser(event) {
  event.preventDefault();

  hideMessage("authMessage");

  const name = $("signupName")?.value.trim();
  const country = $("signupCountry")?.value.trim();
  const email = $("signupEmail")?.value.trim();
  const password = $("signupPassword")?.value;

  if (!name || !email || !password) {
    message("authMessage", "Remplis les champs obligatoires.", "error");
    return;
  }

  if (password.length < 8) {
    message(
      "authMessage",
      "Le mot de passe doit contenir au moins 8 caractères.",
      "error"
    );
    return;
  }

  const button = $("signupButton");
  setButtonLoading(button, true, "Créer mon compte");

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
        data: {
          full_name: name,
          country: country || null
        }
      }
    });

    if (error) throw error;

    if (data.session && data.user) {
      state.user = data.user;
      await loadProfile();
      showAccount();
      await loadCart();

      message("authMessage", "Compte créé avec succès.");
    } else {
      message(
        "authMessage",
        "Inscription enregistrée. Vérifie ton e-mail pour confirmer ton compte."
      );
    }

  } catch (error) {
    console.error("Inscription :", error);
    message(
      "authMessage",
      error.message || "Impossible de créer le compte.",
      "error"
    );
  } finally {
    setButtonLoading(button, false, "Créer mon compte");
  }
}


/* 6. CONNEXION */

async function loginUser(event) {
  event.preventDefault();

  hideMessage("authMessage");

  const email = $("loginEmail")?.value.trim();
  const password = $("loginPassword")?.value;

  if (!email || !password) {
    message("authMessage", "Entre ton e-mail et ton mot de passe.", "error");
    return;
  }

  const button = $("loginButton");
  setButtonLoading(button, true, "Se connecter");

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    state.user = data.user;

    await loadProfile();
    showAccount();
    await loadCart();

    message("authMessage", "Connexion réussie.");

  } catch (error) {
    console.error("Connexion :", error);
    message(
      "authMessage",
      error.message || "Connexion impossible.",
      "error"
    );
  } finally {
    setButtonLoading(button, false, "Se connecter");
  }
}


/* RÉCUPÉRATION DU COMPTE */

function getAuthRedirectUrl() {
  return window.location.origin + window.location.pathname;
}

async function resendSignupConfirmation() {
  hideMessage("authMessage");

  const email =
    $("loginEmail")?.value.trim() ||
    $("signupEmail")?.value.trim() ||
    "";

  if (!email) {
    message("authMessage", "Entre ton adresse e-mail.", "error");
    $("loginEmail")?.focus();
    return;
  }

  const button = $("resendConfirmationButton");
  setButtonLoading(button, true, "Renvoyer l'e-mail de confirmation");

  try {
    const { error } = await supabaseClient.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: getAuthRedirectUrl() }
    });

    if (error) throw error;

    message("authMessage", "Demande envoyée. Vérifie ta boîte e-mail et utilise le dernier message reçu.");
  } catch (error) {
    console.error("Renvoi confirmation :", error);
    message("authMessage", error.message || "Impossible de renvoyer l'e-mail.", "error");
  } finally {
    setButtonLoading(button, false, "Renvoyer l'e-mail de confirmation");
  }
}

async function sendPasswordReset() {
  hideMessage("authMessage");

  const email = $("loginEmail")?.value.trim();

  if (!email) {
    message("authMessage", "Entre ton adresse e-mail dans le champ de connexion.", "error");
    $("loginEmail")?.focus();
    return;
  }

  const button = $("forgotPasswordButton");
  setButtonLoading(button, true, "Mot de passe oublié ?");

  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl()
    });

    if (error) throw error;

    message("authMessage", "Si cette adresse correspond à un compte, un e-mail de réinitialisation vient d'être envoyé.");
  } catch (error) {
    console.error("Réinitialisation :", error);
    message("authMessage", error.message || "Impossible d'envoyer le lien.", "error");
  } finally {
    setButtonLoading(button, false, "Mot de passe oublié ?");
  }
}

async function updateRecoveredPassword(event) {
  event.preventDefault();
  hideMessage("authMessage");

  const password = $("recoveryPassword")?.value || "";
  const confirmation = $("recoveryPasswordConfirm")?.value || "";

  if (password.length < 8) {
    message("authMessage", "Le mot de passe doit contenir au moins 8 caractères.", "error");
    return;
  }

  if (password !== confirmation) {
    message("authMessage", "Les deux mots de passe ne correspondent pas.", "error");
    return;
  }

  const button = $("recoveryPasswordButton");
  setButtonLoading(button, true, "Enregistrer le nouveau mot de passe");

  try {
    const { error } = await supabaseClient.auth.updateUser({ password });

    if (error) throw error;

    $("passwordRecoveryForm")?.reset();
    $("passwordRecoveryPanel").hidden = true;

    message("authMessage", "Ton mot de passe a été modifié. Tu peux maintenant te connecter.");
  } catch (error) {
    console.error("Modification du mot de passe :", error);
    message("authMessage", error.message || "Impossible de modifier le mot de passe.", "error");
  } finally {
    setButtonLoading(button, false, "Enregistrer le nouveau mot de passe");
  }
}

function handleAuthStateChange(event, session) {
  state.user = session?.user || null;

  if (event === "PASSWORD_RECOVERY") {
    $("passwordRecoveryPanel").hidden = false;
    $("passwordRecoveryPanel").scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    message("authMessage", "Lien valide. Choisis ton nouveau mot de passe.");
    return;
  }

  setTimeout(async () => {
    await loadProfile();
    showAccount();
    await loadOrders();
     await loadCart();
  }, 0);
}
/* 7. DÉCONNEXION */

async function logoutUser() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    message("authMessage", error.message, "error");
    return;
  }

  state.user = null;
  state.profile = null;
  state.orders = [];
   state.cart = [];

  showAccount();
  renderCart();

  message("authMessage", "Tu es maintenant déconnecté.");
}

/* 8. CATÉGORIES */

async function loadCategories() {
  const container = $("categoryList");

  if (container) {
    container.innerHTML = '<p class="loading-text">Chargement...</p>';
  }

  const { data, error } = await supabaseClient
    .from("globexa_categories")
    .select("id, name, slug, parent_id")
    .order("name");

  if (error) {
    console.error("Catégories :", error);

    if (container) {
      container.innerHTML =
        "<p>Impossible de charger les catégories.</p>";
    }
    return;
  }

  state.categories = data || [];
  renderCategories();
}

function renderCategories() {
  const container = $("categoryList");
  if (!container) return;

  if (!state.categories.length) {
    container.innerHTML = "<p>Aucune catégorie disponible.</p>";
    return;
  }

  const roots = state.categories.filter(category => !category.parent_id);

  const categoriesToDisplay = roots.length ? roots : state.categories;

  container.innerHTML = categoriesToDisplay.map(category => `
    <button
      class="globexa-category"
      type="button"
      data-category="${escapeHTML(category.id)}">
      ${escapeHTML(category.name)}
    </button>
  `).join("");

  container.querySelectorAll("[data-category]").forEach(button => {
    button.addEventListener("click", () => {
      loadProducts(button.dataset.category);
      $("products")?.scrollIntoView({ behavior: "smooth" });
    });
  });
}

/* 9. PRODUITS */

async function loadProducts(categoryId = null, search = "") {
  const status = $("productStatus");
  const container = $("productList");

  if (status) status.textContent = "Chargement des produits...";

  if (container) {
    container.innerHTML = '<p class="loading-text">Chargement...</p>';
  }

  let query = supabaseClient
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
    .limit(40);

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  if (search) {
    query = query.ilike("title", "%" + search + "%");
  }

  const { data, error } = await query;

  if (error) {
    console.error("Produits :", error);

    if (status) status.textContent = "Erreur de chargement.";

    if (container) {
      container.innerHTML = "<p>Impossible de charger les produits.</p>";
    }
    return;
  }

  state.products = data || [];

  renderProducts();
  renderNewProducts();
  renderPopularProducts();

  if (status) {
    status.textContent = state.products.length
      ? state.products.length + " produit(s) disponible(s)"
      : "Aucun produit disponible pour le moment.";
  }
}

function createProductCard(product) {
  const image = getProductImage(product);

  return `
    <article class="product-card globexa-product-card">
      <button
        type="button"
        class="globexa-product-open"
        data-product="${escapeHTML(product.id)}"
        style="display:block;width:100%;border:0;background:transparent;text-align:left;">
        <img
          src="${escapeHTML(image)}"
          alt="${escapeHTML(product.title)}"
          loading="lazy">
        <h3>${escapeHTML(product.title)}</h3>
        <p class="price">
          ${formatPrice(product.base_price, product.currency)}
        </p>
        <p>Minimum : ${Number(product.moq || 1)}</p>
        <p>Stock : ${Number(product.stock_quantity || 0)}</p>
      </button>

      <button
        type="button"
        data-add="${escapeHTML(product.id)}">
        Ajouter au panier
      </button>
    </article>
  `;
}

function attachProductEvents(container) {
  if (!container) return;

  container.querySelectorAll("[data-product]").forEach(button => {
    button.addEventListener("click", () => {
      openProduct(button.dataset.product);
    });
  });

  container.querySelectorAll("[data-add]").forEach(button => {
    button.addEventListener("click", () => {
      addToCart(button.dataset.add);
    });
  });
}

function renderProducts() {
  const container = $("productList");
  if (!container) return;

  if (!state.products.length) {
    container.innerHTML = "<p>Aucun produit disponible.</p>";
    return;
  }

  container.innerHTML = state.products.map(createProductCard).join("");
  attachProductEvents(container);
}

function renderNewProducts() {
  const container = $("newProductList");
  if (!container) return;

  const products = [...state.products]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10);

  container.innerHTML = products.length
    ? products.map(createProductCard).join("")
    : "<p>Aucune nouveauté pour le moment.</p>";

  attachProductEvents(container);
}

function renderPopularProducts() {
  const container = $("popularProductList");
  if (!container) return;

  /*
   * En attendant un classement réel des ventes,
   * cette section affiche une sélection publiée.
   * Aucun faux nombre de ventes n'est affiché.
   */

  const products = state.products.slice(0, 10);

  container.innerHTML = products.length
    ? products.map(createProductCard).join("")
    : "<p>Aucun produit populaire disponible.</p>";

  attachProductEvents(container);
}

/* 10. RECHERCHE */

async function setupSearch() {
  const form = $("searchForm");
  if (!form) return;

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const search = $("searchInput")?.value.trim() || "";
    const type = $("searchType")?.value || "products";

    if (type === "suppliers") {
      await loadSuppliers(search);
      $("suppliers")?.scrollIntoView({ behavior: "smooth" });
    } else {
      await loadProducts(null, search);
      $("products")?.scrollIntoView({ behavior: "smooth" });
    }
  });
}

/* 11. DÉTAIL DU PRODUIT */

function openProduct(productId) {
  const product = state.products.find(item => item.id === productId);

  if (!product) return;

  state.selectedProduct = product;

  const modal = $("productDetailModal");
  const content = $("productDetailContent");

  if (!modal || !content) return;

  const image = getProductImage(product);

  content.innerHTML = `
    <div class="globexa-product-detail">
      <img
        src="${escapeHTML(image)}"
        alt="${escapeHTML(product.title)}"
        style="width:100%;max-height:360px;object-fit:contain;">

      <h2 id="detailTitle">${escapeHTML(product.title)}</h2>

      <h3>
        ${formatPrice(product.base_price, product.currency)}
      </h3>

      <p>${escapeHTML(product.description || "Aucune description disponible.")}</p>

      <p>Pays d'origine : ${escapeHTML(product.country_of_origin || "Non précisé")}</p>

      <p>Quantité minimale : ${Number(product.moq || 1)}</p>

      <p>Stock disponible : ${Number(product.stock_quantity || 0)}</p>

      <button type="button" id="detailAddCart">
        Ajouter au panier
      </button>
    </div>
  `;

  modal.hidden = false;

  $("detailAddCart")?.addEventListener("click", () => {
    addToCart(product.id);
  });
}

function closeProduct() {
  const modal = $("productDetailModal");
  if (modal) modal.hidden = true;
}

/* 12. FOURNISSEURS */

async function loadSuppliers(search = "") {
  const container = $("supplierList");
  if (!container) return;

  container.innerHTML = '<p class="loading-text">Chargement...</p>';

  let query = supabaseClient
    .from("globexa_stores")
    .select(`
      id,
      company_name,
      country,
      city,
      description,
      logo_url
    `)
    .eq("status", "active")
    .eq("verification_status", "verified")
    .order("created_at", { ascending: false })
    .limit(30);

  if (search) {
    query = query.ilike("company_name", "%" + search + "%");
  }

  const { data, error } = await query;

  if (error) {
    console.error("Fournisseurs :", error);
    container.innerHTML = "<p>Impossible de charger les fournisseurs.</p>";
    return;
  }

  state.stores = data || [];

  if (!state.stores.length) {
    container.innerHTML = "<p>Aucun fournisseur vérifié disponible.</p>";
    return;
  }

  container.innerHTML = state.stores.map(store => `
    <article class="globexa-supplier-card">
      <img
        src="${escapeHTML(store.logo_url || "https://placehold.co/120x120?text=G")}"
        alt="${escapeHTML(store.company_name)}"
        loading="lazy"
        style="width:70px;height:70px;object-fit:cover;border-radius:8px;">

      <h3>${escapeHTML(store.company_name)}</h3>

      <p>${escapeHTML(store.city || "")} ${escapeHTML(store.country || "")}</p>

      <p>${escapeHTML(store.description || "")}</p>
    </article>
  `).join("");
}

/* 13. PANIER */

async function loadCart() {
  if (!state.user) {
    state.cart = [];
    renderCart();
    return;
  }

  const { data, error } = await supabaseClient
    .from("globexa_market_cart_items")
    .select(`
      id,
      user_id,
      quantity,
      product_id,
      globexa_market_products (
        id,
        title,
        base_price,
        currency,
        images,
        stock_quantity,
        moq,
        status
      )
    `)
    .eq("user_id", state.user.id);

  if (error) {
    console.error("Panier :", error);
    message("cartMessage", "Impossible de charger le panier.", "error");
    return;
  }

  state.cart = (data || []).filter(item => item.globexa_market_products);
  renderCart();
}

/* 13 BIS. HISTORIQUE DES COMMANDES */

async function loadOrders() {
  const container = $("orderList");

  if (!state.user) {
    state.orders = [];
    renderOrders();
    return;
  }

  if (container) {
    container.innerHTML = "<p>Chargement des commandes...</p>";
  }

  try {
    const { data, error } = await supabaseClient
      .from("globexa_market_orders")
      .select(`
        id,
        product_id,
        quantity,
        unit_price,
        subtotal,
        currency,
        status,
        payment_status,
        created_at,
        commission_amount,
        supplier_amount,
        globexa_market_products (
          title
        )
      `)
      .eq("buyer_id", state.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    state.orders = data || [];
    renderOrders();

  } catch (error) {
    console.error("Chargement des commandes :", error);

    if (container) {
      container.innerHTML =
        "<p>Impossible de charger les commandes.</p>";
    }
  }
                                     }

function renderOrders() {
  const container = $("orderList");
  if (!container) return;

  if (!state.user) {
    container.innerHTML = "<p>Connecte-toi pour voir tes commandes.</p>";
    return;
  }

  if (!state.orders.length) {
    container.innerHTML = "<p>Tu n'as pas encore de commande.</p>";
    return;
  }

  container.innerHTML = state.orders.map(order => {
    const product = order.globexa_market_products;
    const title = product?.title || "Produit";
    const total = Number(
      order.subtotal ||
      Number(order.unit_price) * Number(order.quantity)
    );

    const date = new Date(order.created_at).toLocaleDateString("fr-FR");

    return `
      <article class="order-card">
        <h3>${escapeHTML(title)}</h3>
        <p>Commande : ${escapeHTML(order.id.slice(0, 8))}</p>
        <p>Quantité : ${Number(order.quantity)}</p>
        <p>Total : ${formatPrice(total, order.currency)}</p>
        <p>Statut : ${escapeHTML(order.status)}</p>
        <p>Paiement : ${escapeHTML(order.payment_status)}</p>
        <p>Date : ${escapeHTML(date)}</p>
      </article>
    `;
  }).join("");
}

async function addToCart(productId) {
  if (!state.user) {
    message(
      "cartMessage",
      "Connecte-toi pour ajouter un produit au panier.",
      "error"
    );

    $("account")?.scrollIntoView({ behavior: "smooth" });
    return;
  }

  const product = state.products.find(item => item.id === productId);

  if (!product) {
    message("cartMessage", "Produit introuvable.", "error");
    return;
  }

  if (Number(product.stock_quantity) <= 0) {
    message("cartMessage", "Ce produit est en rupture de stock.", "error");
    return;
  }

  const existing = state.cart.find(item => item.product_id === productId);

  const quantity = existing
    ? Number(existing.quantity) + 1
    : Math.max(1, Number(product.moq || 1));

  if (quantity > Number(product.stock_quantity)) {
    message("cartMessage", "Stock insuffisant pour cette quantité.", "error");
    return;
  }

  try {
    if (existing) {
      const { error } = await supabaseClient
        .from("globexa_market_cart_items")
        .update({ quantity })
        .eq("id", existing.id)
        .eq("user_id", state.user.id);

      if (error) throw error;

    } else {
      const { error } = await supabaseClient
        .from("globexa_market_cart_items")
        .insert({
          user_id: state.user.id,
          product_id: productId,
          quantity
        });

      if (error) throw error;
    }

    await loadCart();

    message("cartMessage", "Produit ajouté au panier.");

  } catch (error) {
    console.error("Ajout panier :", error);
    message(
      "cartMessage",
      error.message || "Impossible d'ajouter le produit.",
      "error"
    );
  }
}

function renderCart() {
  const container = $("cartItems");
  const totalElement = $("cartTotal");
  const countElement = $("cartCount");
  const checkoutButton = $("checkoutButton");

  const totals = {};
  let count = 0;

  state.cart.forEach(item => {
    const product = item.globexa_market_products;
    if (!product) return;

    const currency = product.currency || "USD";

    totals[currency] = (totals[currency] || 0) +
      Number(product.base_price) * Number(item.quantity);

    count += Number(item.quantity);
  });

  if (countElement) countElement.textContent = String(count);

  if (totalElement) {
    totalElement.innerHTML = Object.keys(totals).length
      ? Object.entries(totals).map(([currency, amount]) => `
          <p>${formatPrice(amount, currency)}</p>
        `).join("")
      : "";
  }

  if (checkoutButton) {
    checkoutButton.disabled = !state.user || !state.cart.length;
  }

  if (!container) return;

  if (!state.user) {
    container.innerHTML = "<p>Connecte-toi pour voir ton panier.</p>";
    return;
  }

  if (!state.cart.length) {
    container.innerHTML = "<p>Ton panier est vide.</p>";
    return;
  }

  container.innerHTML = state.cart.map(item => {
    const product = item.globexa_market_products;

    return `
      <article class="cart-item globexa-cart-item">
        <strong>${escapeHTML(product.title)}</strong>

        <p>Quantité : ${Number(item.quantity)}</p>

        <p>
          ${formatPrice(
            Number(product.base_price) * Number(item.quantity),
            product.currency
          )}
        </p>

        <button
          type="button"
          data-remove="${escapeHTML(item.id)}">
          Retirer
        </button>
      </article>
    `;
  }).join("");

  container.querySelectorAll("[data-remove]").forEach(button => {
    button.addEventListener("click", () => {
      removeCartItem(button.dataset.remove);
    });
  });
}

async function removeCartItem(itemId) {
  if (!state.user) return;

  const { error } = await supabaseClient
    .from("globexa_market_cart_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", state.user.id);

  if (error) {
    message("cartMessage", error.message, "error");
    return;
  }

  await loadCart();
  message("cartMessage", "Produit retiré du panier.");
}

/* 14. COMMANDE */

async function checkout() {
  if (!state.user) {
    message("cartMessage", "Connecte-toi avant de commander.", "error");
    return;
  }

  if (!state.cart.length) {
    message("cartMessage", "Ton panier est vide.", "error");
    return;
  }

  const button = $("checkoutButton");
  setButtonLoading(button, true, "Passer la commande");

  try {
    const { data, error } = await supabaseClient.rpc(
      "globexa_checkout_market_cart"
    );

    if (error) throw error;

    await loadCart();

    message(
      "cartMessage",
      "Commande enregistrée. Le paiement n'est pas encore confirmé par une passerelle."
    );

    console.log("Résultat de la commande :", data);

  } catch (error) {
    console.error("Commande :", error);

    message(
      "cartMessage",
      error.message || "Impossible de valider la commande.",
      "error"
    );
  } finally {
    setButtonLoading(button, false, "Passer la commande");
  }
}

/* 15. REELS */

function updateReelAccess() {
  const panel = $("reelUploadPanel");
  const notice = $("reelLoginNotice");

  if (!panel || !notice) return;

  /*
   * L'accès réel à l'envoi dépend également des règles
   * Supabase et de la propriété du compte fournisseur.
   */

  panel.hidden = !state.user;
  notice.hidden = Boolean(state.user);
}

async function loadReels() {
  const container = $("reelFeed");
  if (!container) return;

  container.innerHTML = '<p class="loading-text">Chargement des vidéos...</p>';

  const { data, error } = await supabaseClient
    .from("globexa_reels")
    .select("id, caption, video_path, thumbnail_path, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Reels :", error);
    container.innerHTML = "<p>Impossible de charger les vidéos.</p>";
    return;
  }

  state.reels = data || [];

  if (!state.reels.length) {
    container.innerHTML = "<p>Les vidéos approuvées apparaîtront ici.</p>";
    return;
  }

  const videoPaths = state.reels
    .map(reel => reel.video_path)
    .filter(Boolean);

  const thumbnailPaths = state.reels
    .map(reel => reel.thumbnail_path)
    .filter(Boolean);

  const [videoResult, thumbnailResult] = await Promise.all([
    supabaseClient.storage
      .from("globexa-reels")
      .createSignedUrls(videoPaths, 3600),

    thumbnailPaths.length
      ? supabaseClient.storage
          .from("globexa-reels")
          .createSignedUrls(thumbnailPaths, 3600)
      : Promise.resolve({ data: [] })
  ]);

  const videoUrls = new Map(
    (videoResult.data || []).map(item => [
      item.path,
      item.signedUrl
    ])
  );

  const thumbnailUrls = new Map(
    (thumbnailResult.data || []).map(item => [
      item.path,
      item.signedUrl
    ])
  );

  container.innerHTML = state.reels.map(reel => {
    const videoUrl = videoUrls.get(reel.video_path);
    const thumbnailUrl = thumbnailUrls.get(reel.thumbnail_path);

    if (!videoUrl) return "";

    return `
      <article class="globexa-reel-card">
        <video
          controls
          playsinline
          preload="metadata"
          ${thumbnailUrl ? `poster="${escapeHTML(thumbnailUrl)}"` : ""}>
          <source src="${escapeHTML(videoUrl)}">
          Ton navigateur ne peut pas lire cette vidéo.
        </video>
        <p>${escapeHTML(reel.caption)}</p>
      </article>
    `;
  }).join("");
}

/* 16. DURÉE VIDÉO */

function getVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);

    video.preload = "metadata";

    video.onloadedmetadata = () => {
      const duration = Math.round(video.duration);
      URL.revokeObjectURL(objectUrl);

      if (!Number.isFinite(duration)) {
        reject(new Error("Durée vidéo invalide."));
        return;
      }

      resolve(duration);
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Impossible de lire cette vidéo."));
    };

    video.src = objectUrl;
  });
}

/* 17. PUBLICATION REELS */

async function uploadReel(event) {
  event.preventDefault();

  hideMessage("reelUploadMessage");

  if (!state.user) {
    message(
      "reelUploadMessage",
      "Connecte-toi avant de publier une vidéo.",
      "error"
    );
    return;
  }

  const file = $("reelVideoFile")?.files?.[0];
  const caption = $("reelCaption")?.value.trim() || "";

 if (!file) {
    message("reelUploadMessage", "Choisis une vidéo.", "error");
    return;
  }

  const allowedTypes = [
    "video/mp4",
    "video/webm",
    "video/quicktime"
  ];

  if (!allowedTypes.includes(file.type)) {
    message(
      "reelUploadMessage",
      "Formats autorisés : MP4, WebM ou MOV.",
      "error"
    );
    return;
  }

  if (file.size > 100 * 1024 * 1024) {
    message(
      "reelUploadMessage",
      "La vidéo ne doit pas dépasser 100 Mo.",
      "error"
    );
    return;
  }

  if (caption.length > 500) {
    message(
      "reelUploadMessage",
      "La description est trop longue.",
      "error"
    );
    return;
  }

  const button = $("reelUploadButton");
  setButtonLoading(button, true, "Publier la vidéo");

  let uploadedPath = null;

  try {
    const duration = await getVideoDuration(file);

    if (duration < 1 || duration > 90) {
      throw new Error("La vidéo doit durer entre 1 et 90 secondes.");
    }

    const extension = file.name.split(".").pop().toLowerCase();
    const path = `${state.user.id}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabaseClient.storage
      .from("globexa-reels")
      .upload(path, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) throw uploadError;

    uploadedPath = path;

    const { error: insertError } = await supabaseClient
      .from("globexa_reels")
      .insert({
        supplier_id: state.user.id,
        caption: caption || "Présentation de mon produit",
        video_path: path,
        duration_seconds: duration,
        status: "pending"
      });

    if (insertError) throw insertError;

    message(
      "reelUploadMessage",
      "Vidéo envoyée. Elle attend la validation de l'administrateur."
    );

    $("reelUploadForm")?.reset();

  } catch (error) {
    console.error("Publication vidéo :", error);

    message(
      "reelUploadMessage",
      error.message || "Impossible de publier la vidéo.",
      "error"
    );

    /*
     * Si l'enregistrement de la vidéo échoue après l'upload,
     * le fichier reste dans le stockage pour éviter une
     * suppression automatique non vérifiée.
     */

  } finally {
    setButtonLoading(button, false, "Publier la vidéo");
  }
}

/* 18. LANGUE */

function setupLanguage() {
  const selector = $("globexaLanguage");
  if (!selector) return;

  const savedLanguage = localStorage.getItem("globexa-language");
  if (savedLanguage) selector.value = savedLanguage;    

  selector.addEventListener("change", () => {
    localStorage.setItem("globexa-language", selector.value);

    message(
      "authMessage",
      selector.value === "fr"
        ? "Français sélectionné."
        : "Langue sélectionnée. La traduction complète sera intégrée dans le module multilingue."
    );
  });
}

/* 19. ÉVÉNEMENTS */

function setupEvents() {
  $("loginForm")?.addEventListener("submit", loginUser);
  $("signupForm")?.addEventListener("submit", registerUser);

  $("resendConfirmationButton")?.addEventListener(
    "click",
    resendSignupConfirmation
  );

  $("forgotPasswordButton")?.addEventListener(
    "click",
    sendPasswordReset
  );

  $("passwordRecoveryForm")?.addEventListener(
    "submit",
    updateRecoveredPassword
  );

  $("logoutButton")?.addEventListener("click", logoutUser);

  $("closeProductDetail")?.addEventListener("click", closeProduct);

  $("checkoutButton")?.addEventListener("click", checkout);

  $("reelUploadForm")?.addEventListener("submit", uploadReel);

  $("productDetailModal")?.addEventListener("click", event => {
    if (event.target.id === "productDetailModal") {
      closeProduct();
    }
  });

  setupSearch();
  setupLanguage();
}

/* 20. SESSION SUPABASE */

async function initializeSession() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) throw error;

  state.user = data.session?.user || null;

  await loadProfile();
  showAccount();
}

/* 21. DÉMARRAGE COMPLET */


async function initializeGlobexa() {
  if (state.loading) return;

  state.loading = true;

  try {
    setupEvents();

    await ensureSupabaseClient();
supabaseClient.auth.onAuthStateChange(handleAuthStateChange);
await initializeSession();
   
    await Promise.all([
      loadCategories(),
      loadProducts(),
      loadSuppliers(),
      loadReels(),
loadCart(),
loadOrders()
   
    ]);

    console.log("GLOBEXA : application initialisée.");

  } catch (error) {
    console.error("Initialisation GLOBEXA :", error);

    if ($("productStatus")) {
      $("productStatus").textContent =
        "Erreur de connexion à GLOBEXA.";
    }

  } finally {
    state.loading = false;
  }
}


/* 22. LANCEMENT */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeGlobexa);
} else {
  initializeGlobexa();
}
