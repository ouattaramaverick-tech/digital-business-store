
/* =========================================================
   GLOBEXA — CODE 3
   Application principale
   Connexion Supabase, comptes, produits, panier et vidéos
   ========================================================= */

"use strict";

/* 1. CONFIGURATION SUPABASE */

const SUPABASE_URL = "https://xlxkiyihagoupsajwmze.supabase.co";
const SUPABASE_KEY = "sb_publishable_3W39fAVPXUDlkCb8Gnzovw_dolfa7P6";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

/* 2. OUTILS GÉNÉRAUX */

const $ = (id) => document.getElementById(id);

const state = {
  user: null,
  profile: null,
  products: [],
  categories: [],
  stores: [],
  cart: [],
  selectedProduct: null
};

function message(elementId, text, error = false) {
  const element = $(elementId);
  if (!element) return;

  element.textContent = text;
  element.style.color = error ? "#c62828" : "#16803c";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function formatPrice(price, currency = "USD") {
  const amount = Number(price || 0);

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/* 3. AFFICHAGE DU COMPTE */

function showAccount() {
  const loggedOut = $("loggedOut");
  const loggedIn = $("loggedIn");

  if (loggedOut) loggedOut.hidden = Boolean(state.user);
  if (loggedIn) loggedIn.hidden = !state.user;

  if (state.user && $("welcomeText")) {
    $("welcomeText").textContent =
      `Bienvenue ${state.profile?.full_name || state.user.email}`;
  }
}

/* 4. CHARGEMENT DU PROFIL */

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
    console.error("Erreur profil :", error);
    return;
  }

  state.profile = data;
}

/* 5. INSCRIPTION */

async function registerUser(event) {
  event.preventDefault();

  const name = $("signupName")?.value.trim();
  const country = $("signupCountry")?.value.trim();
  const email = $("signupEmail")?.value.trim();
  const password = $("signupPassword")?.value;

  if (!name || !email || !password) {
    message("authMessage", "Remplis tous les champs obligatoires.", true);
    return;
  }

  if (password.length < 6) {
    message("authMessage", "Le mot de passe doit contenir au moins 6 caractères.", true);
    return;
  }

  const button = $("signupButton");
  if (button) button.disabled = true;

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          country: country || null
        }
      }
    });

    if (error) throw error;

    if (data.session) {
      state.user = data.user;
      await loadProfile();
      showAccount();
      await loadCart();
    }

    message(
      "authMessage",
      data.session
        ? "Compte créé avec succès."
        : "Inscription enregistrée. Vérifie ton adresse e-mail pour confirmer ton compte."
    );

  } catch (error) {
    message("authMessage", error.message || "Inscription impossible.", true);
  } finally {
    if (button) button.disabled = false;
  }
}

/* 6. CONNEXION */

async function loginUser(event) {
  event.preventDefault();

  const email = $("loginEmail")?.value.trim();
  const password = $("loginPassword")?.value;

  if (!email || !password) {
    message("authMessage", "Entre ton e-mail et ton mot de passe.", true);
    return;
  }

  const button = $("loginButton");
  if (button) button.disabled = true;

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
    message("authMessage", error.message || "Connexion impossible.", true);
  } finally {
    if (button) button.disabled = false;
  }
}

/* 7. DÉCONNEXION */

async function logoutUser() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    message("authMessage", error.message, true);
    return;
  }

  state.user = null;
  state.profile = null;
  state.cart = [];

  showAccount();
  renderCart();
  message("authMessage", "Tu es déconnecté.");
}

/* 8. CHARGEMENT DES CATÉGORIES */

async function loadCategories() {
  const { data, error } = await supabaseClient
    .from("globexa_categories")
    .select("id, name, slug, parent_id")
    .order("name");

  if (error) {
    console.error("Catégories :", error);
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

  container.innerHTML = state.categories.map(category => `
    <button class="globexa-category"
      type="button"
      data-category="${escapeHTML(category.id)}">
      ${escapeHTML(category.name)}
    </button>
  `).join("");

  container.querySelectorAll("[data-category]").forEach(button => {
    button.addEventListener("click", () => {
      loadProducts(button.dataset.category);
    });
  });
}

/* 9. CHARGEMENT DES PRODUITS */

async function loadProducts(categoryId = null, search = "") {
  const status = $("productStatus");
  const container = $("productList");

  if (status) status.textContent = "Chargement des produits...";

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
      status
    `)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(40);

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  if (search) {
    query = query.ilike("title", `%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Produits :", error);
    if (status) status.textContent = "Impossible de charger les produits.";
    return;
  }

  state.products = data || [];

  renderProducts();

  if (status) {
    status.textContent = state.products.length
      ? `${state.products.length} produit(s) disponible(s)`
      : "Aucun produit disponible pour le moment.";
  }
}

function renderProducts() {
  const container = $("productList");
  if (!container) return;

  if (!state.products.length) {
    container.innerHTML = "<p>Aucun produit à afficher.</p>";
    return;
  }

  container.innerHTML = state.products.map(product => {
    const image = Array.isArray(product.images) ? product.images[0] : "";

    return `
      <article class="globexa-product-card">
        <button type="button"
          class="globexa-product-open"
          data-product="${escapeHTML(product.id)}">
          <img
            src="${escapeHTML(image || "https://placehold.co/500x400?text=GLOBEXA")}"
            alt="${escapeHTML(product.title)}"
            loading="lazy">
          <h3>${escapeHTML(product.title)}</h3>
          <p class="globexa-product-price">
            ${formatPrice(product.base_price, product.currency)}
          </p>
          <small>Minimum : ${Number(product.moq || 1)}</small>
        </button>

        <button type="button"
          class="globexa-add-cart"
          data-add="${escapeHTML(product.id)}">
          Ajouter au panier
        </button>
      </article>
    `;
  }).join("");

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

/* 10. RECHERCHE */

function setupSearch() {
  const form = $("searchForm");

  if (!form) return;

  form.addEventListener("submit", event => {
    event.preventDefault();

    const search = $("searchInput")?.value.trim() || "";
    loadProducts(null, search);
  });
}

/* 11. DÉTAIL D'UN PRODUIT */

function openProduct(productId) {
  const product = state.products.find(item => item.id === productId);

  if (!product) return;

  state.selectedProduct = product;

  const modal = $("productDetailModal");
  const content = $("productDetailContent");

  if (!modal || !content) return;

  const image = Array.isArray(product.images) ? product.images[0] : "";

  content.innerHTML = `
    <div class="globexa-product-detail">
      <img
        src="${escapeHTML(image || "https://placehold.co/600x450?text=GLOBEXA")}"
        alt="${escapeHTML(product.title)}">
      <h2>${escapeHTML(product.title)}</h2>
      <p>${escapeHTML(product.description || "Aucune description.")}</p>
      <h3>${formatPrice(product.base_price, product.currency)}</h3>
      <p>Quantité minimale : ${Number(product.moq || 1)}</p>
      <p>Stock : ${Number(product.stock_quantity || 0)}</p>
      <button type="button" id="detailAddCart">Ajouter au panier</button>
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

/* 12. PANIER */

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
      quantity,
      product_id,
      globexa_market_products (
        id,
        title,
        base_price,
        currency,
        images,
        stock_quantity,
        moq
      )
    `)
    .eq("user_id", state.user.id);

  if (error) {
    console.error("Panier :", error);
    return;
  }

  state.cart = (data || []).filter(item => item.globexa_market_products);
  renderCart();
}

async function addToCart(productId) {
  if (!state.user) {
    message("cartMessage", "Connecte-toi pour ajouter un produit au panier.", true);
    return;
  }

  const product = state.products.find(item => item.id === productId);

  if (!product) {
    message("cartMessage", "Produit introuvable.", true);
    return;
  }

  const existing = state.cart.find(item => item.product_id === productId);

  try {
    if (existing) {
      const { error } = await supabaseClient
        .from("globexa_market_cart_items")
        .update({
          quantity: Number(existing.quantity) + 1
        })
        .eq("id", existing.id)
        .eq("user_id", state.user.id);

      if (error) throw error;

    } else {
      const { error } = await supabaseClient
        .from("globexa_market_cart_items")
        .insert({
          user_id: state.user.id,
          product_id: productId,
          quantity: Math.max(1, Number(product.moq || 1))
        });

      if (error) throw error;
    }

    await loadCart();
    message("cartMessage", "Produit ajouté au panier.");

  } catch (error) {
    message("cartMessage", error.message || "Ajout impossible.", true);
  }
}

function renderCart() {
  const container = $("cartItems");
  const totalElement = $("cartTotal");
  const countElement = $("cartCount");

  let total = 0;
  let count = 0;

  state.cart.forEach(item => {
    const product = item.globexa_market_products;
    if (!product) return;

    total += Number(product.base_price) * Number(item.quantity);
    count += Number(item.quantity);
  });

  if (countElement) countElement.textContent = String(count);

  if (totalElement) totalElement.textContent = formatPrice(total, "USD");

  if (!container) return;

  if (!state.cart.length) {
    container.innerHTML = "<p>Ton panier est vide.</p>";
    return;
  }

  container.innerHTML = state.cart.map(item => {
    const product = item.globexa_market_products;

    return `
      <div class="globexa-cart-item">
        <strong>${escapeHTML(product.title)}</strong>
        <span>Quantité : ${Number(item.quantity)}</span>
        <span>${formatPrice(
          Number(product.base_price) * Number(item.quantity),
          product.currency
        )}</span>
        <button type="button" data-remove="${escapeHTML(item.id)}">
          Retirer
        </button>
      </div>
    `;
  }).join("");

  container.querySelectorAll("[data-remove]").forEach(button => {
    button.addEventListener("click", () => removeCartItem(button.dataset.remove));
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
    message("cartMessage", error.message, true);
    return;
  }

  await loadCart();
  message("cartMessage", "Produit retiré du panier.");
}

/* 13. VALIDATION DU PANIER */

async function checkout() {
  if (!state.user) {
    message("cartMessage", "Connecte-toi avant de commander.", true);
    return;
  }

  if (!state.cart.length) {
    message("cartMessage", "Ton panier est vide.", true);
    return;
  }

  const button = $("checkoutButton");
  if (button) button.disabled = true;

  try {
    const { error } = await supabaseClient.rpc(
      "globexa_checkout_market_cart"
    );

    if (error) throw error;

    await loadCart();

    message(
      "cartMessage",
      "Demande de commande enregistrée. Le paiement reste à effectuer selon les moyens réellement disponibles."
    );

  } catch (error) {
    message("cartMessage", error.message || "Validation impossible.", true);
  } finally {
    if (button) button.disabled = false;
  }
}

/* 14. CHARGEMENT DES FOURNISSEURS */

async function loadSuppliers() {
  const container = $("supplierList");
  if (!container) return;

  const { data, error } = await supabaseClient
    .from("globexa_stores")
    .select("id, company_name, country, city, description, logo_url")
    .eq("status", "active")
    .eq("verification_status", "verified")
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    console.error("Fournisseurs :", error);
    return;
  }

  state.stores = data || [];

  if (!state.stores.length) {
    container.innerHTML = "<p>Les fournisseurs vérifiés apparaîtront ici.</p>";
    return;
  }

  container.innerHTML = state.stores.map(store => `
    <article class="globexa-supplier-card">
      <img
        src="${escapeHTML(store.logo_url || "https://placehold.co/120x120?text=G")}"
        alt="${escapeHTML(store.company_name)}">
      <h3>${escapeHTML(store.company_name)}</h3>
      <p>${escapeHTML(store.city || "")} ${escapeHTML(store.country || "")}</p>
      <p>${escapeHTML(store.description || "")}</p>
    </article>
  `).join("");
}

/* 15. REELS — CHARGEMENT */

async function loadReels() {
  const container = $("reelFeed");
  if (!container) return;

  const { data, error } = await supabaseClient
    .from("globexa_reels")
    .select("id, caption, video_path, thumbnail_path, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Reels :", error);
    container.innerHTML = "<p>Les vidéos ne sont pas disponibles.</p>";
    return;
  }

  if (!data?.length) {
    container.innerHTML = "<p>Les vidéos des vendeurs apparaîtront ici.</p>";
    return;
  }

  const paths = data.map(reel => reel.video_path).filter(Boolean);

  const { data: signed } = await supabaseClient.storage
    .from("globexa-reels")
    .createSignedUrls(paths, 3600);

  const urls = new Map(
    (signed || []).map(item => [item.path, item.signedUrl])
  );

  container.innerHTML = data.map(reel => {
    const videoUrl = urls.get(reel.video_path);

    if (!videoUrl) return "";

    return `
      <article class="globexa-reel-card">
        <video
          controls
          playsinline
          preload="metadata"
          poster="${escapeHTML(reel.thumbnail_path || "")}">
          <source src="${escapeHTML(videoUrl)}" type="video/mp4">
        </video>
        <p>${escapeHTML(reel.caption)}</p>
      </article>
    `;
  }).join("");
}

/* 16. ENVOI D'UNE VIDÉO */

async function uploadReel(event) {
  event.preventDefault();

  if (!state.user) {
    message("reelUploadMessage", "Connecte-toi pour publier une vidéo.", true);
    return;
  }

  const file = $("reelVideoFile")?.files?.[0];
  const caption = $("reelCaption")?.value.trim() || "";

  if (!file) {
    message("reelUploadMessage", "Choisis une vidéo.", true);
    return;
  }

  if (!file.type.startsWith("video/")) {
    message("reelUploadMessage", "Le fichier doit être une vidéo.", true);
    return;
  }

  if (file.size > 100 * 1024 * 1024) {
    message("reelUploadMessage", "La vidéo ne doit pas dépasser 100 Mo.", true);
    return;
  }

  const button = $("reelUploadButton");
  if (button) button.disabled = true;

  try {
    const extension = file.name.split(".").pop().toLowerCase();
    const path = `${state.user.id}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabaseClient.storage
      .from("globexa-reels")
      .upload(path, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { error: insertError } = await supabaseClient
      .from("globexa_reels")
      .insert({
        supplier_id: state.user.id,
        caption,
        video_path: path,
        duration_seconds: 0,
        status: "pending"
      });

    if (insertError) throw insertError;

    message(
      "reelUploadMessage",
      "Vidéo envoyée. Elle attend la validation de l'administrateur."
    );

    $("reelUploadForm")?.reset();

  } catch (error) {
    message("reelUploadMessage", error.message || "Envoi impossible.", true);
  } finally {
    if (button) button.disabled = false;
  }
}

/* 17. LANGUE DE L'INTERFACE */

function setupLanguage() {
  const selector = $("globexaLanguage");
  if (!selector) return;

  selector.addEventListener("change", () => {
    const language = selector.value;
    localStorage.setItem("globexa-language", language);

    message(
      "authMessage",
      language === "fr"
        ? "Langue française sélectionnée."
        : "Langue sélectionnée. La traduction complète sera activée dans une prochaine étape."
    );
  });

  const saved = localStorage.getItem("globexa-language");
  if (saved) selector.value = saved;
}

/* 18. ÉVÉNEMENTS DE LA PAGE */

function setupEvents() {
  $("loginForm")?.addEventListener("submit", loginUser);
  $("signupForm")?.addEventListener("submit", registerUser);
  $("logoutButton")?.addEventListener("click", logoutUser);

  $("closeProductDetail")?.addEventListener("click", closeProduct);

  $("checkoutButton")?.addEventListener("click", checkout);

  $("reelUploadForm")?.addEventListener("submit", uploadReel);

  $("discoverButton")?.addEventListener("click", () => {
    $("produits")?.scrollIntoView({ behavior: "smooth" });
  });

  setupSearch();
  setupLanguage();
}

/* 19. SESSION ET DÉMARRAGE */

async function initializeGlobexa() {
  try {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) throw error;

    state.user = data.session?.user || null;

    await loadProfile();
    showAccount();

    setupEvents();

    await Promise.all([
      loadCategories(),
      loadProducts(),
      loadSuppliers(),
      loadReels(),
      loadCart()
    ]);

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      state.user = session?.user || null;

      await loadProfile();
      showAccount();
      await loadCart();
    });

    console.log("GLOBEXA initialisé.");

  } catch (error) {
    console.error("Erreur de démarrage GLOBEXA :", error);
    message("productStatus", "Erreur de connexion. Réessaie plus tard.", true);
  }
}

/* 20. LANCEMENT */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeGlobexa);
} else {
  initializeGlobexa();
}
