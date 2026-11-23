
"use strict";

/* GLOBEXA — CODE 2 : Connexion Supabase et fonctions de base */

const SUPABASE_URL = "https://xlxkiyihagoupsajwmze.supabase.co";
const SUPABASE_KEY = "sb_publishable_3W39fAVPXUDlkCb8Gnzovw_dolfa7P6";

const $ = (id) => document.getElementById(id);

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

window.globexaSupabase = db;

let currentUser = null;
let products = [];
let cart = [];

function message(text, type = "") {
  const box = $("authMessage");
  box.textContent = text;
  box.className = "message " + type;
  box.hidden = false;
}

function money(amount, currency) {
  return Number(amount || 0).toLocaleString("fr-FR") + " " + (currency || "USD");
}

function safeImage(images) {
  const url = Array.isArray(images) ? images[0] : "";
  if (typeof url === "string" && /^https:\/\//i.test(url)) return url;
  return "https://placehold.co/500x350/eaf0f6/0b2d52?text=GLOBEXA";
}

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* CATALOGUE */

async function loadCategories() {
  const target = $("categoryList");
  target.replaceChildren();

  const { data, error } = await db
    .from("globexa_categories")
    .select("id,name")
    .order("name");

  if (error) {
    target.append(make("p", "muted", "Impossible de charger les catégories."));
    console.error(error);
    return;
  }

  const all = make("button", "active", "Toutes les catégories");
  all.type = "button";
  all.addEventListener("click", () => {
    document.querySelectorAll("#categoryList button").forEach(b => b.classList.remove("active"));
    all.classList.add("active");
    renderProducts(products);
  });
  target.append(all);

  (data || []).forEach(category => {
    const button = make("button", "", category.name);
    button.type = "button";
    button.addEventListener("click", () => {
      document.querySelectorAll("#categoryList button").forEach(b => b.classList.remove("active"));
      button.classList.add("active");
      loadProducts(category.id);
    });
    target.append(button);
  });
}

async function loadProducts(categoryId = null) {
  $("productStatus").textContent = "Chargement des produits...";

  let query = db
    .from("globexa_market_products")
    .select("id,title,description,currency,base_price,moq,stock_quantity,images,category_id,store:globexa_stores(company_name,country)")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(80);

  if (categoryId) query = query.eq("category_id", categoryId);

  const { data, error } = await query;

  if (error) {
    $("productStatus").textContent = "Erreur de chargement du catalogue.";
    console.error("Catalogue:", error);
    return;
  }

  products = data || [];
  renderProducts(products);
}

function renderProducts(items) {
  const target = $("productList");
  target.replaceChildren();

  $("productStatus").textContent = items.length + " produit(s)";

  if (!items.length) {
    target.append(make("div", "empty", "Aucun produit publié dans cette sélection."));
    return;
  }

  items.forEach(product => {
    const card = make("article", "product-card");
    const image = make("img");
    image.src = safeImage(product.images);
    image.alt = product.title || "Produit GLOBEXA";
    image.loading = "lazy";

    const info = make("div", "product-info");
    info.append(make("h3", "", product.title || "Produit"));
    info.append(make("div", "price", money(product.base_price, product.currency)));
    info.append(make("div", "muted", "Commande minimum : " + product.moq));
    info.append(make("div", "muted", "Stock : " + product.stock_quantity));

    const store = Array.isArray(product.store) ? product.store[0] : product.store;
    if (store) {
      info.append(make("div", "muted", (store.company_name || "Boutique") + " — " + (store.country || "")));
    }

    const add = make("button", "", "Ajouter au panier");
    add.type = "button";
    add.addEventListener("click", () => addToCart(product));

    info.append(add);
    card.append(image, info);
    target.append(card);
  });
}

/* RECHERCHE */

$("searchForm").addEventListener("submit", event => {
  event.preventDefault();

  const term = $("searchInput").value.trim().toLocaleLowerCase("fr");

  if (!term) {
    renderProducts(products);
    return;
  }

  const filtered = products.filter(p =>
    (p.title || "").toLocaleLowerCase("fr").includes(term) ||
    (p.description || "").toLocaleLowerCase("fr").includes(term)
  );

  renderProducts(filtered);
});

$("discoverButton").addEventListener("click", () => {
  $("produits").scrollIntoView({ behavior: "smooth" });
});

/* FOURNISSEURS */

async function loadSuppliers() {
  const target = $("supplierList");
  target.replaceChildren();

  const { data, error } = await db
    .from("globexa_stores")
    .select("id,company_name,country,city,description")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    target.append(make("div", "empty", "Impossible de charger les boutiques."));
    console.error("Boutiques:", error);
    return;
  }

  if (!data || !data.length) {
    target.append(make("div", "empty", "Les boutiques professionnelles seront présentées ici."));
    return;
  }

  data.forEach(store => {
    const card = make("article", "supplier-card");
    card.append(make("h3", "", store.company_name));
    card.append(make("p", "muted", [store.city, store.country].filter(Boolean).join(", ")));
    card.append(make("p", "", store.description || "Boutique professionnelle GLOBEXA."));
    target.append(card);
  });
}

/* COMPTE ET AUTHENTIFICATION */

function renderSession(session) {
  currentUser = session?.user || null;

  $("loggedOut").hidden = !!currentUser;
  $("loggedIn").hidden = !currentUser;

  if (currentUser) {
    const name = currentUser.user_metadata?.full_name || "Utilisateur GLOBEXA";
    $("welcomeText").textContent = "Bonjour " + name + " — " + currentUser.email;
    loadCart();
  } else {
    cart = [];
    renderCart();
  }
}

$("signupForm").addEventListener("submit", async event => {
  event.preventDefault();

  const button = $("signupButton");
  button.disabled = true;
  button.textContent = "Création en cours...";

  try {
    const fullName = $("signupName").value.trim();
    const country = $("signupCountry").value.trim();
    const email = $("signupEmail").value.trim();
    const password = $("signupPassword").value;

    if (fullName.length < 2) throw new Error("Saisissez votre nom complet.");

    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, country } }
    });

    if (error) throw error;

    if (data.session) {
      renderSession(data.session);
      message("Votre compte GLOBEXA est créé.", "success");
    } else {
      message("Inscription enregistrée. Vérifiez votre e-mail pour confirmer votre compte.", "success");
    }

    $("signupForm").reset();
  } catch (error) {
    console.error("Inscription:", error);
    message(error.message || "Impossible de créer le compte.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "Créer mon compte";
  }
});

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  const button = $("loginButton");
  button.disabled = true;
  button.textContent = "Connexion...";

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email: $("loginEmail").value.trim(),
      password: $("loginPassword").value
    });

    if (error) throw error;

    renderSession(data.session);
    $("loginForm").reset();
    message("Connexion réussie.", "success");
  } catch (error) {
    console.error("Connexion:", error);
    message(error.message || "Connexion impossible.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "Se connecter";
  }
});

$("logoutButton").addEventListener("click", async () => {
  const { error } = await db.auth.signOut();

  if (error) {
    message("Déconnexion impossible : " + error.message, "error");
    return;
  }

  renderSession(null);
  message("Vous êtes déconnecté.", "success");
});

/* PANIER */

async function addToCart(product) {
  if (!currentUser) {
    message("Connectez-vous pour ajouter un produit au panier.", "error");
    $("compte").scrollIntoView({ behavior: "smooth" });
    return;
  }

  const minimum = Math.max(1, Number(product.moq) || 1);
  const stock = Number(product.stock_quantity) || 0;

  if (stock < minimum) {
    alert("Stock insuffisant pour ce produit.");
    return;
  }

  const { data: existing, error: findError } = await db
    .from("globexa_market_cart_items")
    .select("id,quantity")
    .eq("user_id", currentUser.id)
    .eq("product_id", product.id)
    .maybeSingle();

  if (findError) {
    alert("Impossible de vérifier le panier.");
    console.error(findError);
    return;
  }

  const quantity = existing ? Number(existing.quantity) + minimum : minimum;

  if (quantity > stock) {
    alert("La quantité demandée dépasse le stock disponible.");
    return;
  }

  const { error } = await db
    .from("globexa_market_cart_items")
    .upsert({
      user_id: currentUser.id,
      product_id: product.id,
      quantity
    }, { onConflict: "user_id,product_id" });

  if (error) {
    alert("Ajout au panier impossible : " + error.message);
    console.error(error);
    return;
  }

  await loadCart();
  $("cartMessage").textContent = "Produit ajouté au panier.";
}

async function loadCart() {
  if (!currentUser) return;

  const { data, error } = await db
    .from("globexa_market_cart_items")
    .select("id,product_id,quantity,product:globexa_market_products(id,title,currency,base_price,moq,stock_quantity)")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    $("cartMessage").textContent = "Impossible de charger le panier.";
    console.error(error);
    return;
  }

  cart = data || [];
  renderCart();
}

function renderCart() {
  const target = $("cartItems");
  target.replaceChildren();

  $("cartCount").textContent = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  if (!currentUser) {
    $("cartMessage").textContent = "Connectez-vous pour utiliser votre panier.";
    $("checkoutButton").disabled = true;
    $("cartTotal").textContent = "";
    return;
  }

  if (!cart.length) {
    $("cartMessage").textContent = "Votre panier est vide.";
    $("checkoutButton").disabled = true;
    $("cartTotal").textContent = "";
    return;
  }

  $("cartMessage").textContent = cart.length + " ligne(s) dans votre panier.";
  $("checkoutButton").disabled = false;

  const totals = {};

  cart.forEach(item => {
    const product = Array.isArray(item.product) ? item.product[0] : item.product;
    if (!product) return;

    const row = make("div", "cart-row");
    const info = make("div", "");
    info.append(make("strong", "", product.title));
    info.append(make("p", "muted", money(product.base_price, product.currency) + " / unité"));

    const quantity = document.createElement("input");
    quantity.type = "number";
    quantity.min = String(Math.max(1, Number(product.moq) || 1));
    quantity.max = String(Number(product.stock_quantity) || 1);
    quantity.value = String(item.quantity);
    quantity.setAttribute("aria-label", "Quantité");

    const update = make("button", "small-btn", "Modifier");
    update.type = "button";
    update.addEventListener("click", () => updateCart(item, product, quantity.value));

    const remove = make("button", "small-btn", "Retirer");
    remove.type = "button";
    remove.addEventListener("click", () => removeCart(item));

    const controls = make("div", "");
    controls.append(quantity, update, remove);
    row.append(info, controls);
    target.append(row);

    const currency = product.currency || "USD";
    totals[currency] = (totals[currency] || 0) + Number(product.base_price) * Number(item.quantity);
  });

  $("cartTotal").textContent = Object.entries(totals)
    .map(([currency, total]) => "Total " + currency + " : " + money(total, currency))
    .join(" | ");
}

async function updateCart(item, product, value) {
  const quantity = Math.floor(Number(value));
  const minimum = Math.max(1, Number(product.moq) || 1);
  const stock = Number(product.stock_quantity) || 0;

  if (!Number.isInteger(quantity) || quantity < minimum || quantity > stock) {
    alert("La quantité doit être comprise entre " + minimum + " et " + stock + ".");
    return;
  }

  const { error } = await db
    .from("globexa_market_cart_items")
    .update({ quantity })
    .eq("id", item.id)
    .eq("user_id", currentUser.id);

  if (error) {
    alert("Modification impossible : " + error.message);
    return;
  }

  await loadCart();
}

async function removeCart(item) {
  const { error } = await db
    .from("globexa_market_cart_items")
    .delete()
    .eq("id", item.id)
    .eq("user_id", currentUser.id);

  if (error) {
    alert("Suppression impossible : " + error.message);
    return;
  }

  await loadCart();
}

$("checkoutButton").addEventListener("click", async () => {
  if (!currentUser || !cart.length) return;

  if (!confirm("Confirmer la création de vos commandes ?")) return;

  const button = $("checkoutButton");
  button.disabled = true;
  button.textContent = "Création des commandes...";

  try {
    const { data, error } = await db.rpc("globexa_checkout_market_cart");
    if (error) throw error;

    const count = Array.isArray(data?.orders) ? data.orders.length : 0;

    await loadCart();

    $("cartMessage").textContent = count + " commande(s) créée(s), en attente de paiement.";
    alert(count + " commande(s) créée(s). Aucun paiement n'a encore été effectué.");
  } catch (error) {
    console.error("Commande:", error);
    alert(error.message || "Impossible de créer les commandes.");
  } finally {
    button.textContent = "Passer la commande";
    button.disabled = !cart.length;
  }
});

/* DÉMARRAGE */

async function startGlobexa() {
  if (!window.supabase?.createClient) {
    $("productStatus").textContent = "La bibliothèque Supabase n'est pas disponible.";
    return;
  }

  await Promise.all([
    loadCategories(),
    loadProducts(),
    loadSuppliers()
  ]);

  const { data, error } = await db.auth.getSession();

  if (error) {
    console.error("Session:", error);
    renderSession(null);
  } else {
    renderSession(data.session);
  }

  db.auth.onAuthStateChange((_event, session) => {
    renderSession(session);
  });
}

startGlobexa();

/* CODE 4 — DÉTAILS ET CONSULTATION DES PRODUITS */

(function () {
  const modal = document.getElementById("productDetailModal");
  const content = document.getElementById("productDetailContent");
  const close = document.getElementById("closeProductDetail");

  if (!modal || !content || !close) {
    console.error("GLOBEXA : fenêtre de détail introuvable.");
    return;
  }

  function addText(parent, tag, text, style) {
    const el = document.createElement(tag);
    el.textContent = text || "";
    if (style) el.style.cssText = style;
    parent.appendChild(el);
    return el;
  }

  function showProduct(product) {
    content.replaceChildren();

    const image = document.createElement("img");
    image.src = safeImage(product.images);
    image.alt = product.title || "Produit";
    image.style.cssText = "width:100%;max-height:350px;object-fit:contain;background:#f3f6fa;border-radius:9px";
    content.appendChild(image);

    addText(content, "h2", product.title, "color:#0b2d52;margin-top:18px;font-size:24px");
    addText(content, "p", money(product.base_price, product.currency), "font-size:24px;font-weight:800;color:#f47721");

    addText(content, "p", "Quantité minimum : " + product.moq);
    addText(content, "p", "Stock disponible : " + product.stock_quantity);
    addText(content, "p", "Origine : " + (product.country_of_origin || "Non renseignée"));
    addText(content, "p", "Référence : " + (product.sku || "Non renseignée"));

    addText(content, "h3", "Description du produit", "color:#0b2d52;margin-top:22px");
    addText(content, "p", product.description || "Aucune description disponible.", "line-height:1.7;white-space:pre-wrap");

    const store = Array.isArray(product.store) ? product.store[0] : product.store;

    if (store) {
      addText(content, "h3", "Boutique fournisseur", "color:#0b2d52;margin-top:22px");
      addText(content, "p", store.company_name || "Fournisseur GLOBEXA");
      addText(content, "p", store.country || "");
    }

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Ajouter au panier";
    button.style.marginTop = "18px";
    button.addEventListener("click", async () => {
      await addToCart(product);
      modal.hidden = true;
    });

    content.appendChild(button);
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    close.focus();
  }

  function hideProduct() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  close.addEventListener("click", hideProduct);

  modal.addEventListener("click", event => {
    if (event.target === modal) hideProduct();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.hidden) hideProduct();
  });

  const originalRenderProducts = renderProducts;

  renderProducts = function (items) {
    originalRenderProducts(items);

    const cards = document.querySelectorAll("#productList .product-card");

    cards.forEach((card, index) => {
      const product = items[index];
      if (!product) return;

      const detailButton = document.createElement("button");
      detailButton.type = "button";
      detailButton.textContent = "Voir les détails";
      detailButton.style.cssText = "background:#0b2d52;margin-top:7px";

      detailButton.addEventListener("click", () => showProduct(product));

      const info = card.querySelector(".product-info");
      if (info) info.appendChild(detailButton);
    });
  };

  console.log("GLOBEXA CODE 4 : fiches produits activées.");
})();
/* CODE 5 — INITIALISATION CORRECTE DE LA FENÊTRE PRODUIT */

(function () {
  function initProductDetails() {
    const modal = document.getElementById("productDetailModal");
    const content = document.getElementById("productDetailContent");
    const close = document.getElementById("closeProductDetail");

    if (!modal || !content || !close) {
      console.error("GLOBEXA : fenêtre produit introuvable.");
      return;
    }

    if (renderProducts.__globexaDetailsReady) return;

    function showProduct(product) {
      content.replaceChildren();

      const image = document.createElement("img");
      image.src = safeImage(product.images);
      image.alt = product.title || "Produit";
      image.style.cssText =
        "width:100%;max-height:350px;object-fit:contain;background:#f3f6fa;border-radius:9px";
      content.appendChild(image);

      const title = document.createElement("h2");
      title.id = "detailTitle";
      title.textContent = product.title || "Produit";
      content.appendChild(title);

      const details = [
        money(product.base_price, product.currency),
        "Quantité minimum : " + product.moq,
        "Stock disponible : " + product.stock_quantity,
        "Origine : " + (product.country_of_origin || "Non renseignée"),
        "Référence : " + (product.sku || "Non renseignée"),
        "Description : " + (product.description || "Aucune description")
      ];

      details.forEach(value => {
        const p = document.createElement("p");
        p.textContent = value;
        content.appendChild(p);
      });

      const store = Array.isArray(product.store)
        ? product.store[0]
        : product.store;

      if (store) {
        const p = document.createElement("p");
        p.textContent =
          "Boutique : " + (store.company_name || "Fournisseur") +
          " — " + (store.country || "");
        content.appendChild(p);
      }

      const add = document.createElement("button");
      add.type = "button";
      add.textContent = "Ajouter au panier";
      add.addEventListener("click", async () => {
        await addToCart(product);
        hideProduct();
      });

      content.appendChild(add);
      modal.hidden = false;
      document.body.style.overflow = "hidden";
      close.focus();
    }

    function hideProduct() {
      modal.hidden = true;
      document.body.style.overflow = "";
    }

    close.addEventListener("click", hideProduct);

    modal.addEventListener("click", event => {
      if (event.target === modal) hideProduct();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !modal.hidden) hideProduct();
    });

    const originalRenderProducts = renderProducts;

    function renderProductsWithDetails(items) {
      originalRenderProducts(items);

      document.querySelectorAll("#productList .product-card")
        .forEach((card, index) => {
          const product = items[index];
          if (!product) return;

          const button = document.createElement("button");
          button.type = "button";
          button.textContent = "Voir les détails";
          button.style.cssText = "background:#0b2d52;margin-top:7px";
          button.addEventListener("click", () => showProduct(product));

          const info = card.querySelector(".product-info");
          if (info) info.appendChild(button);
        });
    }

    renderProductsWithDetails.__globexaDetailsReady = true;
    renderProducts = renderProductsWithDetails;

    if (Array.isArray(products)) {
      renderProducts(products);
    }

    console.log("GLOBEXA CODE 5 : fenêtre produit initialisée.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProductDetails, {
      once: true
    });
  } else {
    initProductDetails();
  }
})();

/* =====================================================
   GLOBEXA - CODE 7 : PUBLICATION ET AFFICHAGE DES REELS
===================================================== */
(function initGlobexaReels() {
  const db = window.globexaSupabase;
  if (!db) {
    console.error("GLOBEXA : Supabase indisponible.");
    return;
  }

  const BUCKET = "globexa-reels";
  const feed = document.getElementById("reelFeed");
  const panel = document.getElementById("reelUploadPanel");
  const form = document.getElementById("reelUploadForm");
  const fileInput = document.getElementById("reelVideoFile");
  const captionInput = document.getElementById("reelCaption");
  const message = document.getElementById("reelUploadMessage");
  const loginNotice = document.getElementById("reelLoginNotice");
  const uploadButton = document.getElementById("reelUploadButton");

  if (!feed || !form || !fileInput || !captionInput) {
    console.error("GLOBEXA : éléments Reels introuvables. Vérifie le CODE 6.");
    return;
  }

  function showMessage(text, error = false) {
    if (!message) return;
    message.textContent = text;
    message.style.color = error ? "#c62828" : "#16803c";
  }

  function updateUploadPanel() {
    const loggedIn = !!currentUser;

    if (panel) panel.hidden = !loggedIn;
    if (loginNotice) loginNotice.hidden = loggedIn;
  }

  function createReelCard(reel) {
    const card = document.createElement("article");
    card.style.cssText =
      "background:#fff;border-radius:14px;padding:12px;margin:12px 0;box-shadow:0 2px 12px #0001";

    const video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.style.cssText =
      "width:100%;max-height:520px;object-fit:contain;background:#000;border-radius:10px";

    const publicUrl = db.storage.from(BUCKET).getPublicUrl(reel.video_path);
    video.src = publicUrl.data.publicUrl;

    const caption = document.createElement("p");
    caption.textContent = reel.caption || "Vidéo GLOBEXA";
    caption.style.cssText = "font-weight:600;margin:10px 0";

    const status = document.createElement("small");
    status.textContent =
      reel.status === "pending" ? "En attente de validation" : "Vidéo publiée";
    status.style.color = reel.status === "pending" ? "#b7791f" : "#16803c";

    card.append(video, caption, status);
    return card;
  }

  async function loadReels() {
    feed.innerHTML = "<p>Chargement des vidéos...</p>";

    let request = db
      .from("globexa_reels")
      .select("id,supplier_id,caption,video_path,duration_seconds,status,created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (currentUser) {
      request = request.or(
        "status.eq.approved,supplier_id.eq." + currentUser.id
      );
    } else {
      request = request.eq("status", "approved");
    }

    const { data, error } = await request;

    if (error) {
      feed.textContent = "Impossible de charger les vidéos pour le moment.";
      console.error("GLOBEXA Reels :", error);
      return;
    }

    feed.innerHTML = "";

    if (!data || data.length === 0) {
      feed.textContent = "Aucune vidéo disponible pour le moment.";
      return;
    }

    data.forEach((reel) => {
      feed.appendChild(createReelCard(reel));
    });
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!currentUser) {
      showMessage("Connecte-toi pour publier une vidéo.", true);
      return;
    }

    const file = fileInput.files && fileInput.files[0];

    if (!file) {
      showMessage("Choisis une vidéo avant de publier.", true);
      return;
    }

    const allowedTypes = [
      "video/mp4",
      "video/webm",
      "video/quicktime"
    ];

    if (!allowedTypes.includes(file.type)) {
      showMessage("Format accepté : MP4, WebM ou MOV.", true);
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      showMessage("La vidéo ne doit pas dépasser 100 Mo.", true);
      return;
    }

    if (uploadButton) uploadButton.disabled = true;
    showMessage("Vérification de la vidéo...");

    const videoElement = document.createElement("video");
    videoElement.preload = "metadata";
    const objectUrl = URL.createObjectURL(file);

    videoElement.onloadedmetadata = async function () {
      const duration = Math.round(videoElement.duration);
      URL.revokeObjectURL(objectUrl);

      if (!Number.isFinite(duration) || duration < 1 || duration > 90) {
        showMessage("La vidéo doit durer entre 1 et 90 secondes.", true);
        if (uploadButton) uploadButton.disabled = false;
        return;
      }

      const extension = file.name.split(".").pop().toLowerCase();
      const filePath =
        currentUser.id + "/" + crypto.randomUUID() + "." + extension;

      showMessage("Envoi de la vidéo en cours...");

      const { error: uploadError } = await db.storage
        .from(BUCKET)
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) {
        console.error(uploadError);
        showMessage("Échec de l'envoi de la vidéo.", true);
        if (uploadButton) uploadButton.disabled = false;
        return;
      }

      const { error: insertError } = await db
        .from("globexa_reels")
        .insert({
          supplier_id: currentUser.id,
          caption: captionInput.value.trim(),
          video_path: filePath,
          duration_seconds: duration,
          status: "pending"
        });

      if (insertError) {
        await db.storage.from(BUCKET).remove([filePath]);
        console.error(insertError);
        showMessage("Publication impossible. Vérifie ton compte fournisseur.", true);
        if (uploadButton) uploadButton.disabled = false;
        return;
      }

      form.reset();
      showMessage("Vidéo envoyée ! Elle attend la validation de GLOBEXA.");
      await loadReels();

      if (uploadButton) uploadButton.disabled = false;
    };

    videoElement.onerror = function () {
      URL.revokeObjectURL(objectUrl);
      showMessage("Impossible de lire cette vidéo.", true);
      if (uploadButton) uploadButton.disabled = false;
    };

    videoElement.src = objectUrl;
  });

  updateUploadPanel();
  loadReels();

  db.auth.onAuthStateChange(() => {
    setTimeout(() => {
      updateUploadPanel();
      loadReels();
    }, 0);
  });

  console.log("GLOBEXA CODE 7 : Reels initialisés.");
})();
/* =====================================================
   GLOBEXA - CODE 8 : MESSAGERIE ACHETEUR / FOURNISSEUR
===================================================== */
(function initGlobexaMessaging() {
  const db = window.globexaSupabase;
  if (!db) {
    console.error("GLOBEXA : Supabase indisponible pour la messagerie.");
    return;
  }

  let activeConversation = null;

  function element(tag, text) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function makeButton(label, action, color) {
    const button = element("button", label);
    button.type = "button";
    button.style.cssText =
      "background:" + (color || "#0b2d52") +
      ";margin:5px 5px 5px 0";
    button.addEventListener("click", action);
    return button;
  }

  const panel = element("section");
  panel.id = "globexaChatPanel";
  panel.hidden = true;
  panel.style.cssText =
    "background:white;border:1px solid #dce3ec;border-radius:12px;padding:16px;margin:20px 0";

  const heading = element("h2", "Messagerie GLOBEXA");
  const closeButton = makeButton("Fermer", () => {
    panel.hidden = true;
  }, "#64748b");

  const refreshButton = makeButton("Actualiser", loadConversations);
  const status = element("p", "Connectez-vous pour utiliser la messagerie.");
  status.className = "message";

  const conversationList = element("div");
  conversationList.style.cssText =
    "display:grid;gap:8px;margin:12px 0";

  const conversationTitle = element("h3", "Sélectionnez une conversation");
  const messagesBox = element("div");
  messagesBox.style.cssText =
    "max-height:350px;overflow:auto;background:#f4f7fb;padding:12px;border-radius:9px";

  const messageForm = element("form");
  messageForm.style.cssText =
    "display:flex;gap:8px;flex-wrap:wrap;margin-top:12px";

  const messageInput = element("textarea");
  messageInput.rows = 2;
  messageInput.maxLength = 4000;
  messageInput.required = true;
  messageInput.placeholder = "Écrire un message...";
  messageInput.style.cssText =
    "flex:1;min-width:180px;padding:10px;border:1px solid #ccd5e0;border-radius:8px";

  const sendButton = element("button", "Envoyer");
  sendButton.type = "submit";

  messageForm.append(messageInput, sendButton);
  panel.append(
    heading,
    closeButton,
    refreshButton,
    status,
    conversationList,
    conversationTitle,
    messagesBox,
    messageForm
  );

  const accountSection = document.getElementById("compte");
  if (accountSection) {
    accountSection.parentNode.insertBefore(panel, accountSection);
  } else {
    document.querySelector("main")?.appendChild(panel);
  }

  function showStatus(text, error = false) {
    status.textContent = text;
    status.style.color = error ? "#b42318" : "#176534";
  }

  async function loadConversations() {
    if (!currentUser) {
      conversationList.replaceChildren();
      showStatus("Connectez-vous pour consulter vos messages.", true);
      return;
    }

    showStatus("Chargement des conversations...");
    conversationList.replaceChildren();

    const { data, error } = await db
      .from("globexa_conversations")
      .select("id,buyer_id,supplier_id,product_id,created_at")
      .or(
        "buyer_id.eq." + currentUser.id +
        ",supplier_id.eq." + currentUser.id
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Conversations :", error);
      showStatus("Impossible de charger les conversations.", true);
      return;
    }

    if (!data || data.length === 0) {
      showStatus("Aucune conversation pour le moment.");
      return;
    }

    showStatus(data.length + " conversation(s) disponible(s).");

    data.forEach((conversation) => {
      const isBuyer = conversation.buyer_id === currentUser.id;
      const label = isBuyer
        ? "Conversation avec un fournisseur"
        : "Message d'un acheteur";

      const button = makeButton(label, () => {
        openConversation(conversation);
      }, "#0b2d52");

      conversationList.appendChild(button);
    });
  }

  async function openConversation(conversation) {
    activeConversation = conversation;
    panel.hidden = false;

    conversationTitle.textContent =
      "Conversation — Produit " + (conversation.product_id || "");

    await loadMessages();
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadMessages() {
    if (!activeConversation || !currentUser) return;

    messagesBox.replaceChildren();
    showStatus("Chargement des messages...");

    const { data, error } = await db
      .from("globexa_messages")
      .select("id,sender_id,body,created_at")
      .eq("conversation_id", activeConversation.id)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) {
      console.error("Messages :", error);
      showStatus("Impossible de charger les messages.", true);
      return;
    }

    if (!data || data.length === 0) {
      messagesBox.appendChild(
        element("p", "Commencez la conversation.")
      );
    } else {
      data.forEach((msg) => {
        const mine = msg.sender_id === currentUser.id;
        const bubble = element("div");

        bubble.textContent =
          (mine ? "Vous : " : "Votre correspondant : ") + msg.body;

        bubble.style.cssText =
          "padding:10px;margin:8px 0;border-radius:9px;" +
          "background:" + (mine ? "#dceeff" : "#ffffff") +
          ";overflow-wrap:anywhere";

        const date = element(
          "small",
          new Date(msg.created_at).toLocaleString("fr-FR")
        );
        date.style.display = "block";
        date.style.color = "#64748b";

        bubble.appendChild(date);
        messagesBox.appendChild(bubble);
      });
    }

    messagesBox.scrollTop = messagesBox.scrollHeight;
    showStatus("Messages chargés.");
  }

  messageForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser || !activeConversation) {
      showStatus("Ouvre une conversation avant d'envoyer.", true);
      return;
    }

    const body = messageInput.value.trim();
    if (!body) {
      showStatus("Écris un message avant de l'envoyer.", true);
      return;
    }

    sendButton.disabled = true;
    showStatus("Envoi du message...");

    const { error } = await db
      .from("globexa_messages")
      .insert({
        conversation_id: activeConversation.id,
        sender_id: currentUser.id,
        body: body
      });

    sendButton.disabled = false;

    if (error) {
      console.error("Envoi message :", error);
      showStatus("Échec de l'envoi du message.", true);
      return;
    }

    messageInput.value = "";
    await loadMessages();
  });

  async function contactSupplier(product) {
    if (!currentUser) {
      showStatus("Connectez-vous pour contacter le fournisseur.", true);
      panel.hidden = false;
      panel.scrollIntoView({ behavior: "smooth" });
      return;
    }

    showStatus("Recherche du fournisseur...");

    const { data: productData, error: productError } = await db
      .from("globexa_market_products")
      .select("id,store_id,store:globexa_stores(owner_id,company_name)")
      .eq("id", product.id)
      .single();

    if (productError || !productData) {
      console.error("Recherche fournisseur :", productError);
      showStatus("Impossible de trouver le fournisseur.", true);
      panel.hidden = false;
      return;
    }

    const store = Array.isArray(productData.store)
      ? productData.store[0]
      : productData.store;

    if (!store || !store.owner_id) {
      showStatus("Ce produit n'a pas de fournisseur disponible.", true);
      panel.hidden = false;
      return;
    }

    if (store.owner_id === currentUser.id) {
      showStatus("Vous ne pouvez pas contacter votre propre boutique.", true);
      panel.hidden = false;
      return;
    }

    showStatus("Ouverture de la conversation...");

    const { data: existing, error: findError } = await db
      .from("globexa_conversations")
      .select("id,buyer_id,supplier_id,product_id,created_at")
      .eq("buyer_id", currentUser.id)
      .eq("supplier_id", store.owner_id)
      .eq("product_id", product.id)
      .limit(1);

    if (findError) {
      console.error("Recherche conversation :", findError);
      showStatus("Impossible de vérifier la conversation.", true);
      panel.hidden = false;
      return;
    }

    let conversation = existing && existing[0];

    if (!conversation) {
      const { data: created, error: createError } = await db
        .from("globexa_conversations")
        .insert({
          buyer_id: currentUser.id,
          supplier_id: store.owner_id,
          product_id: product.id
        })
        .select("id,buyer_id,supplier_id,product_id,created_at")
        .single();

      if (createError) {
        console.error("Création conversation :", createError);
        showStatus(
          "Création impossible. Vérifiez votre compte acheteur.",
          true
        );
        panel.hidden = false;
        return;
      }

      conversation = created;
    }

    await loadConversations();
    await openConversation(conversation);
  }

  function addContactButtons(items) {
    document.querySelectorAll("#productList .product-card")
      .forEach((card, index) => {
        const product = items[index];
        if (!product) return;

        if (card.querySelector(".globexa-contact-button")) return;

        const button = makeButton(
          "Contacter le fournisseur",
          () => contactSupplier(product),
          "#e87516"
        );

        button.classList.add("globexa-contact-button");

        const info = card.querySelector(".product-info");
        if (info) info.appendChild(button);
      });
  }

  const originalRender = renderProducts;

  function renderProductsWithMessaging(items) {
    originalRender(items);
    addContactButtons(items);
  }

  renderProducts = renderProductsWithMessaging;

  if (Array.isArray(products)) {
    renderProducts(products);
  }

  db.auth.onAuthStateChange(() => {
    setTimeout(() => {
      activeConversation = null;
      conversationTitle.textContent = "Sélectionnez une conversation";
      messagesBox.replaceChildren();
      loadConversations();
    }, 0);
  });

  if (currentUser) {
    loadConversations();
  }

  console.log("GLOBEXA CODE 8 : Messagerie initialisée.");
})();
/* =====================================================
   GLOBEXA — CODE 13 : GESTION DES COMMANDES FOURNISSEUR
===================================================== */
(function initGlobexaSupplierOrders() {
  const db = window.globexaSupabase;
  if (!db) {
    console.error("CODE 13 : Supabase indisponible.");
    return;
  }

  const panel = document.createElement("section");
  panel.id = "globexaSupplierOrders";
  panel.className = "section panel";
  panel.style.cssText =
    "background:#fff;border:1px solid #e3e8ef;border-radius:10px;padding:18px;margin:20px 0";

  const heading = document.createElement("h2");
  heading.textContent = "Mes commandes fournisseur";
  heading.style.color = "#0b2d52";

  const description = document.createElement("p");
  description.className = "muted";
  description.textContent =
    "Consultez vos commandes et mettez à jour leur avancement.";

  const statusMessage = document.createElement("p");
  statusMessage.className = "message";
  statusMessage.textContent =
    "Connectez-vous avec votre compte fournisseur.";

  const orderList = document.createElement("div");
  orderList.style.cssText = "display:grid;gap:14px;margin-top:15px";

  const refreshButton = document.createElement("button");
  refreshButton.type = "button";
  refreshButton.className = "small-btn";
  refreshButton.textContent = "Actualiser les commandes";
  refreshButton.style.marginTop = "12px";

  panel.append(heading, description, statusMessage, refreshButton, orderList);

  const accountSection = document.getElementById("compte");
  if (accountSection) {
    accountSection.parentNode.insertBefore(panel, accountSection);
  } else {
    document.querySelector("main")?.appendChild(panel);
  }

  const allowedStatuses = [
    "pending",
    "processing",
    "shipped",
    "completed",
    "cancelled"
  ];

  const statusLabels = {
    pending: "En attente",
    processing: "En traitement",
    shipped: "Expédiée",
    completed: "Terminée",
    cancelled: "Annulée",
    awaiting_payment: "En attente de paiement",
    paid: "Payée",
    delivered: "Livrée",
    disputed: "En litige"
  };

  function showStatus(text, error = false) {
    statusMessage.textContent = text;
    statusMessage.style.background = error ? "#fff0ef" : "#edf5ff";
    statusMessage.style.color = error ? "#a3261d" : "#176534";
  }

  function makeText(tag, value, className) {
    const element = document.createElement(tag);
    element.textContent = value;
    if (className) element.className = className;
    return element;
  }

  function formatMoney(amount, currency) {
    return Number(amount || 0).toLocaleString("fr-FR") +
      " " + (currency || "USD");
  }

function createOrderCard(order) {
  const card = document.createElement("article");
  card.style.cssText =
    "border:1px solid #e3e8ef;border-radius:9px;padding:15px;background:#fff";

  const product = Array.isArray(order.product)
    ? order.product[0]
    : order.product;

  const productName = product?.title || "Produit non disponible";

  const reference = makeText(
    "strong",
    "Commande #" + order.id.slice(0, 8).toUpperCase()
  );

  const productTitle = makeText("h3", productName);
  productTitle.style.cssText = "color:#0b2d52;margin:10px 0";

  const quantity = makeText("p", "Quantité : " + order.quantity);

  const unitPrice = makeText(
    "p",
    "Prix unitaire : " + formatMoney(order.unit_price, order.currency)
  );

  const total = makeText(
    "p",
    "Montant : " + formatMoney(
      order.subtotal ?? Number(order.unit_price) * Number(order.quantity),
      order.currency
    )
  );

  const payment = makeText(
    "p",
    "Paiement : " + (order.payment_status || "pending")
  );
  payment.className = "muted";

  const date = makeText(
    "p",
    "Date : " + new Date(order.created_at).toLocaleString("fr-FR")
  );
  date.className = "muted";

  const statusLabels = {
    pending: "En attente",
    awaiting_payment: "En attente de paiement",
    paid: "Payée",
    processing: "En traitement",
    shipped: "Expédiée",
    delivered: "Livrée",
    cancelled: "Annulée",
    disputed: "En litige"
  };

  const currentStatus = makeText(
    "p",
    "Statut actuel : " + (statusLabels[order.status] || order.status)
  );
  currentStatus.style.fontWeight = "700";

  card.append(
    reference,
    productTitle,
    quantity,
    unitPrice,
    total,
    payment,
    date,
    currentStatus
  );

  const nextStatuses = {
    paid: ["processing"],
    processing: ["shipped"],
    shipped: ["delivered"]
  };

  const availableStatuses = nextStatuses[order.status];

  if (!availableStatuses) {
    const message = order.payment_status !== "paid"
      ? "La commande attend la confirmation du paiement."
      : "Cette commande ne peut plus être modifiée depuis cet espace.";

    const note = makeText("p", message);
    note.className = "muted";
    card.appendChild(note);
    return card;
  }

  const label = makeText("label", "Prochaine étape");
  label.style.cssText =
    "display:block;font-weight:700;margin-top:12px";

  const select = document.createElement("select");
  select.style.cssText =
    "width:100%;padding:11px;border:1px solid #ccd6e1;" +
    "border-radius:6px;margin:8px 0";

  availableStatuses.forEach(status => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = statusLabels[status];
    select.appendChild(option);
  });

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "Enregistrer le statut";
  saveButton.style.width = "100%";

  saveButton.addEventListener("click", async () => {
    const newStatus = select.value;

    if (!availableStatuses.includes(newStatus)) {
      showStatus("Statut non autorisé.", true);
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Enregistrement...";

    const { error } = await db.rpc(
      "globexa_supplier_update_order_status",
      {
        p_order_id: order.id,
        p_new_status: newStatus
      }
    );

    if (error) {
      console.error("Mise à jour commande :", error);
      showStatus(
        error.message || "Impossible de modifier cette commande.",
        true
      );
      saveButton.disabled = false;
      saveButton.textContent = "Enregistrer le statut";
      return;
    }

    showStatus("Statut de la commande mis à jour avec succès.");
    await loadSupplierOrders();
  });

  card.append(label, select, saveButton);
  return card;
}
  async function loadSupplierOrders() {
    orderList.replaceChildren();

    if (!currentUser) {
      showStatus("Connectez-vous avec votre compte fournisseur.");
      panel.hidden = true;
      return;
    }

    panel.hidden = false;
    showStatus("Chargement de vos commandes...");

    const { data, error } = await db
      .from("globexa_market_orders")
      .select(
        "id,product_id,quantity,unit_price,subtotal,currency,status,payment_status,created_at,product:globexa_market_products(title)"
      )
      .eq("supplier_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Commandes fournisseur :", error);
      showStatus("Impossible de charger les commandes.", true);
      return;
    }

    if (!data || data.length === 0) {
      showStatus("Vous n'avez pas encore reçu de commande.");
      return;
    }

    showStatus(data.length + " commande(s) trouvée(s).");

    data.forEach(order => {
      orderList.appendChild(createOrderCard(order));
    });
  }

  refreshButton.addEventListener("click", loadSupplierOrders);

  db.auth.onAuthStateChange(() => {
    setTimeout(loadSupplierOrders, 0);
  });

  if (currentUser) {
    loadSupplierOrders();
  }

  console.log("GLOBEXA CODE 13 : Gestion des commandes activée.");
})();


/* =========================================================
   GLOBEXA — CODE 14
   DEMANDES DE DEVIS ET OFFRES FOURNISSEURS
   ========================================================= */

(() => {
  "use strict";

  const db = window.globexaSupabase;

  if (!db) {
    console.error("GLOBEXA CODE 14 : Supabase indisponible.");
    return;
  }

  if (document.getElementById("globexa-rfq-panel")) return;

  const panel = document.createElement("section");
  panel.id = "globexa-rfq-panel";
  panel.style.cssText =
    "max-width:1100px;margin:30px auto;padding:20px;" +
    "background:#f5f8fc;border-radius:12px;";

  const heading = document.createElement("h2");
  heading.textContent = "Demandes de devis GLOBEXA";
  heading.style.color = "#0b2d52";

  const intro = document.createElement("p");
  intro.textContent =
    "Publiez vos besoins d'achat ou proposez vos prix aux acheteurs.";

  const notice = document.createElement("p");
  notice.style.cssText =
    "padding:10px;border-radius:7px;background:#eaf2ff;color:#17436b;";
  notice.textContent = "Connectez-vous pour utiliser les demandes de devis.";

  const formArea = document.createElement("div");
  const requestList = document.createElement("div");

  requestList.style.cssText =
    "display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));" +
    "gap:15px;margin-top:20px;";

  panel.append(heading, intro, notice, formArea, requestList);

  const accountSection = document.getElementById("compte");

  if (accountSection) {
    accountSection.parentNode.insertBefore(panel, accountSection);
  } else {
    document.querySelector("main")?.appendChild(panel);
  }

  let categories = [];
  let activeStore = false;

  function element(tag, text, parent) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  }

  function field(labelText, type, placeholder, parent) {
    const wrapper = element("div", undefined, parent);
    wrapper.style.marginBottom = "12px";

    const label = element("label", labelText, wrapper);
    label.style.cssText = "display:block;font-weight:600;margin-bottom:5px;";

    const input = document.createElement(
      type === "textarea" ? "textarea" : "input"
    );

    if (type !== "textarea") input.type = type;
    input.placeholder = placeholder || "";
    input.style.cssText =
      "box-sizing:border-box;width:100%;padding:11px;" +
      "border:1px solid #ccd6e1;border-radius:7px;font-size:15px;";

    if (type === "textarea") input.rows = 4;

    wrapper.appendChild(input);
    return input;
  }

  function actionButton(text, parent) {
    const button = element("button", text, parent);
    button.type = "button";
    button.style.cssText =
      "padding:11px 15px;border:0;border-radius:7px;" +
      "background:#f28c28;color:white;font-weight:700;" +
      "cursor:pointer;margin-top:8px;";
    return button;
  }

  function showNotice(text, error = false) {
    notice.textContent = text;
    notice.style.background = error ? "#fff0ef" : "#eaf2ff";
    notice.style.color = error ? "#a3261d" : "#17436b";
  }

  function money(value, currency) {
    return Number(value || 0).toLocaleString("fr-FR") +
      " " + (currency || "USD");
  }

  async function loadCategories() {
    const { data, error } = await db
      .from("globexa_categories")
      .select("id,name")
      .order("name");

    if (error) {
      console.error("Catégories des devis :", error);
      categories = [];
      return;
    }

    categories = data || [];
  }

  function createRequestForm() {
    const box = element("div");
    box.style.cssText =
      "background:white;padding:17px;border-radius:10px;" +
      "margin-top:18px;border:1px solid #e0e7ef;";

    element("h3", "Publier une demande de devis", box);

    const title = field(
      "Nom du produit recherché",
      "text",
      "Exemple : Téléphones Android",
      box
    );

    const details = field(
      "Description et caractéristiques",
      "textarea",
      "Décrivez précisément le produit souhaité...",
      box
    );

    const quantity = field(
      "Quantité souhaitée",
      "number",
      "Exemple : 100",
      box
    );
    quantity.min = "1";
    quantity.step = "1";

    const targetPrice = field(
      "Prix cible unitaire (facultatif)",
      "number",
      "Prix souhaité",
      box
    );
    targetPrice.min = "0";
    targetPrice.step = "0.01";

    const currency = field(
      "Devise",
      "text",
      "USD",
      box
    );
    currency.value = "USD";
    currency.maxLength = 10;

    const destination = field(
      "Pays de destination",
      "text",
      "Exemple : Burkina Faso",
      box
    );

    const deadline = field(
      "Date limite de réception des offres (facultatif)",
      "datetime-local",
      "",
      box
    );

    const categoryLabel = element("label", "Catégorie (facultatif)", box);
    categoryLabel.style.cssText =
      "display:block;font-weight:600;margin-bottom:5px;";

    const category = document.createElement("select");
    category.style.cssText =
      "width:100%;padding:11px;border:1px solid #ccd6e1;" +
      "border-radius:7px;margin-bottom:12px;";

    const emptyOption = element("option", "Toutes les catégories");
    emptyOption.value = "";
    category.appendChild(emptyOption);

    categories.forEach(item => {
      const option = element("option", item.name);
      option.value = item.id;
      category.appendChild(option);
    });

    box.appendChild(category);

    const submit = actionButton("Publier ma demande", box);

    submit.addEventListener("click", async () => {
      if (!currentUser) {
        showNotice("Connectez-vous avant de publier une demande.", true);
        return;
      }

      const amount = Number(quantity.value);
      const price = targetPrice.value.trim()
        ? Number(targetPrice.value)
        : null;

      const currencyValue = currency.value.trim().toUpperCase();

      if (!title.value.trim() || !details.value.trim()) {
        showNotice("Remplissez le nom et la description du produit.", true);
        return;
      }

      if (!Number.isInteger(amount) || amount <= 0) {
        showNotice("La quantité doit être un nombre entier positif.", true);
        return;
      }

      if (price !== null && (!Number.isFinite(price) || price < 0)) {
        showNotice("Le prix cible est incorrect.", true);
        return;
      }

      if (!/^[A-Z]{3,10}$/.test(currencyValue)) {
        showNotice("Indiquez une devise valide, par exemple USD ou XOF.", true);
        return;
      }

      let deadlineValue = null;

      if (deadline.value) {
        const date = new Date(deadline.value);

        if (Number.isNaN(date.getTime()) || date <= new Date()) {
          showNotice("La date limite doit être dans le futur.", true);
          return;
        }

        deadlineValue = date.toISOString();
      }

      submit.disabled = true;
      submit.textContent = "Publication en cours...";

      const payload = {
        buyer_id: currentUser.id,
        title: title.value.trim(),
        details: details.value.trim(),
        quantity: amount,
        target_price: price,
        currency: currencyValue,
        destination_country: destination.value.trim() || null,
        deadline: deadlineValue,
        category_id: category.value || null,
        status: "open"
      };

      const { error } = await db
        .from("globexa_rfqs")
        .insert(payload);

      if (error) {
        console.error("Publication demande :", error);
        showNotice(
          error.message || "Impossible de publier la demande.",
          true
        );
        submit.disabled = false;
        submit.textContent = "Publier ma demande";
        return;
      }

      title.value = "";
      details.value = "";
      quantity.value = "";
      targetPrice.value = "";
      destination.value = "";
      deadline.value = "";
      category.value = "";

      showNotice("Votre demande de devis a été publiée.");
      submit.disabled = false;
      submit.textContent = "Publier ma demande";

      await loadRequests();
    });
  }

  async function loadBuyerQuotes(rfq, container) {
    const result = await db
      .from("globexa_quotes")
      .select(
        "id,unit_price,currency,quantity,lead_time_days,shipping_terms,message,status,created_at"
      )
      .eq("rfq_id", rfq.id)
      .order("created_at", { ascending: false });

    if (result.error) {
      element("p", "Impossible de charger les offres.", container);
      console.error(result.error);
      return;
    }

    const quotes = result.data || [];

    element("h4", "Offres reçues : " + quotes.length, container);

    if (!quotes.length) {
      element("p", "Aucune offre reçue pour le moment.", container);
      return;
    }

    quotes.forEach(quote => {
      const offer = element("div", undefined, container);
      offer.style.cssText =
        "background:#f4f7fb;padding:12px;border-radius:7px;margin-top:9px;";

      element(
        "strong",
        money(quote.unit_price, quote.currency) + " / unité",
        offer
      );

      element("p", "Quantité proposée : " + quote.quantity, offer);

      if (quote.lead_time_days !== null) {
        element("p", "Délai : " + quote.lead_time_days + " jours", offer);
      }

      if (quote.shipping_terms) {
        element("p", "Livraison : " + quote.shipping_terms, offer);
      }

      if (quote.message) {
        element("p", "Message : " + quote.message, offer);
      }

      element("p", "État de l'offre : " + quote.status, offer);
    });
  }

  async function createSupplierQuoteForm(rfq, container) {
    const existing = await db
      .from("globexa_quotes")
      .select("id,status")
      .eq("rfq_id", rfq.id)
      .eq("supplier_id", currentUser.id)
      .maybeSingle();

    if (existing.error) {
      console.error("Vérification offre existante :", existing.error);
      element("p", "Impossible de vérifier votre offre.", container);
      return;
    }

    if (existing.data) {
      element(
        "p",
        "Vous avez déjà envoyé une offre pour cette demande. État : " +
          existing.data.status,
        container
      );
      return;
    }

    const form = element("div", undefined, container);
    form.style.cssText =
      "margin-top:12px;padding:12px;background:#f4f7fb;border-radius:8px;";

    element("h4", "Envoyer votre offre", form);

    const price = field(
      "Votre prix unitaire",
      "number",
      "Exemple : 25",
      form
    );
    price.min = "0";
    price.step = "0.01";

    const offeredQuantity = field(
      "Quantité proposée",
      "number",
      String(rfq.quantity),
      form
    );
    offeredQuantity.value = String(rfq.quantity);
    offeredQuantity.min = "1";
    offeredQuantity.step = "1";

    const leadTime = field(
      "Délai de livraison en jours",
      "number",
      "Exemple : 15",
      form
    );
    leadTime.min = "1";
    leadTime.step = "1";

    const shipping = field(
      "Conditions de livraison",
      "text",
      "Exemple : transport maritime",
      form
    );

    const messageBox = field(
      "Message pour l'acheteur (facultatif)",
      "textarea",
      "Précisions sur votre offre...",
      form
    );

    const send = actionButton("Envoyer mon offre", form);

    send.addEventListener("click", async () => {
      const priceValue = Number(price.value);
      const quantityValue = Number(offeredQuantity.value);
      const daysValue = leadTime.value.trim()
        ? Number(leadTime.value)
        : null;

      if (price.value.trim() === "" ||
          !Number.isFinite(priceValue) ||
          priceValue < 0) {
        showNotice("Indiquez un prix unitaire valide.", true);
        return;
      }

      if (!Number.isInteger(quantityValue) || quantityValue <= 0) {
        showNotice("La quantité proposée doit être positive.", true);
        return;
      }

      if (daysValue !== null &&
          (!Number.isInteger(daysValue) || daysValue <= 0)) {
        showNotice("Le délai doit être un nombre de jours positif.", true);
        return;
      }

      send.disabled = true;
      send.textContent = "Envoi en cours...";

      const payload = {
        rfq_id: rfq.id,
        supplier_id: currentUser.id,
        unit_price: priceValue,
        currency: rfq.currency,
        quantity: quantityValue,
        lead_time_days: daysValue,
        shipping_terms: shipping.value.trim() || null,
        message: messageBox.value.trim() || null,
        status: "sent"
      };

      const { error } = await db
        .from("globexa_quotes")
        .insert(payload);

      if (error) {
        console.error("Envoi offre fournisseur :", error);
        showNotice(
          error.message ||
            "Impossible d'envoyer l'offre. Vérifiez votre boutique et votre connexion.",
          true
        );
        send.disabled = false;
        send.textContent = "Envoyer mon offre";
        return;
      }

      showNotice("Votre offre a été envoyée à l'acheteur.");
      await loadRequests();
    });
  }

  async function loadRequests() {
    requestList.replaceChildren();

    if (!currentUser) {
      showNotice("Connectez-vous pour publier ou consulter vos demandes.");
      formArea.replaceChildren();
      return;
    }

    showNotice("Chargement des demandes de devis...");

    const { data, error } = await db
      .from("globexa_rfqs")
      .select(
        "id,buyer_id,title,details,quantity,target_price,currency,destination_country,deadline,status,created_at,category_id"
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Chargement des demandes :", error);
      showNotice("Impossible de charger les demandes de devis.", true);
      return;
    }

    const requests = data || [];

    showNotice(requests.length + " demande(s) de devis trouvée(s).");

    requestList.replaceChildren();

    if (!requests.length) {
      element("p", "Aucune demande disponible pour le moment.", requestList);
      return;
    }

    for (const rfq of requests) {
      const card = element("article", undefined, requestList);
      card.style.cssText =
        "background:white;border:1px solid #e0e7ef;" +
        "border-radius:10px;padding:16px;";

      element("h3", rfq.title, card);

      element("p", rfq.details, card);
      element("p", "Quantité recherchée : " + rfq.quantity, card);

      if (rfq.target_price !== null) {
        element(
          "p",
          "Prix cible : " + money(rfq.target_price, rfq.currency),
          card
        );
      }

      if (rfq.destination_country) {
        element("p", "Destination : " + rfq.destination_country, card);
      }

      if (rfq.deadline) {
        element(
          "p",
          "Date limite : " +
            new Date(rfq.deadline).toLocaleDateString("fr-FR"),
          card
        );
      }

      element("p", "Statut : " + rfq.status, card);

      if (rfq.buyer_id === currentUser.id) {
        const quoteArea = element("div", undefined, card);
        await loadBuyerQuotes(rfq, quoteArea);
      } else if (rfq.status === "open" && activeStore) {
        await createSupplierQuoteForm(rfq, card);
      }
    }
  }

  async function refreshAccount() {
    formArea.replaceChildren();
    activeStore = false;

    if (!currentUser) {
      showNotice("Connectez-vous pour utiliser les demandes de devis.");
      await loadRequests();
      return;
    }

    await loadCategories();

    const storeResult = await db
      .from("globexa_stores")
      .select("id")
      .eq("owner_id", currentUser.id)
      .eq("status", "active")
      .limit(1);

    if (storeResult.error) {
      console.error("Vérification boutique :", storeResult.error);
    }

    activeStore = !!(storeResult.data && storeResult.data.length);

    createRequestForm();

    if (activeStore) {
      const supplierInfo = element(
        "p",
        "Votre boutique est active : vous pouvez répondre aux demandes ouvertes.",
        formArea
      );
      supplierInfo.style.color = "#176534";
    }

    await loadRequests();
  }

  db.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    setTimeout(refreshAccount, 0);
  });

  if (currentUser) {
    refreshAccount();
  } else {
    loadRequests();
  }

  console.log("GLOBEXA CODE 14 : Demandes de devis activées.");
})();

/* GLOBEXA — CODE 15 : ANNUAIRE PUBLIC DES TRANSITAIRES */
(() => {
  'use strict';

  const db = window.globexaSupabase;
  const anchor = document.querySelector('#fournisseurs');
  if (!anchor || document.getElementById('globexa-forwarders')) return;

  const section = document.createElement('section');
  section.id = 'globexa-forwarders';
  section.className = 'section';
  section.setAttribute('aria-labelledby', 'globexa-forwarders-title');

  const style = document.createElement('style');
  style.textContent = `
    #globexa-forwarders{background:#fff;border:1px solid #e4eaf1;border-radius:10px;padding:20px;margin-top:22px}
    #globexa-forwarders .gf-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}
    #globexa-forwarders h2{margin:0;color:#123b63;font-size:22px}
    #globexa-forwarders .gf-intro{color:#607080;margin:7px 0 15px;line-height:1.55}
    #globexa-forwarders .gf-search{width:100%;max-width:440px;padding:12px 14px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;box-sizing:border-box}
    #globexa-forwarders .gf-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:13px;margin-top:16px}
    #globexa-forwarders .gf-card{border:1px solid #e2e8f0;border-radius:9px;padding:15px;background:#fff;min-width:0}
    #globexa-forwarders .gf-card h3{margin:0 0 9px;color:#123b63;font-size:17px;overflow-wrap:anywhere}
    #globexa-forwarders .gf-meta{margin:6px 0;color:#475569;line-height:1.5;overflow-wrap:anywhere}
    #globexa-forwarders .gf-country{display:inline-block;background:#fff2e8;color:#a64b0b;border-radius:20px;padding:4px 10px;font-size:13px;font-weight:600}
    #globexa-forwarders .gf-state{padding:13px;border-radius:8px;background:#f5f8fc;color:#475569;line-height:1.5}
    #globexa-forwarders .gf-count{font-size:13px;color:#64748b}
  `;
  document.head.appendChild(style);

  section.innerHTML = `
    <div class="gf-head">
      <div>
        <h2 id="globexa-forwarders-title">Transitaires et transport international</h2>
        <p class="gf-intro">Trouvez un transitaire approuvé et recherchez les entreprises par pays.</p>
      </div>
      <span class="gf-count" id="globexa-forwarders-count">Chargement…</span>
    </div>
    <input class="gf-search" id="globexa-forwarders-search"
      type="search"
      placeholder="Rechercher un pays (ex. Chine, Burkina Faso)…"
      aria-label="Rechercher un transitaire par pays"
      autocomplete="off">
    <div class="gf-grid" id="globexa-forwarders-list" aria-live="polite">
      <div class="gf-state">Chargement des transitaires…</div>
    </div>
  `;

  anchor.after(section);

  const searchInput = section.querySelector('#globexa-forwarders-search');
  const list = section.querySelector('#globexa-forwarders-list');
  const count = section.querySelector('#globexa-forwarders-count');
  let forwarders = [];

  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);

  const render = () => {
    const term = searchInput.value.trim().toLocaleLowerCase();

    const filtered = forwarders.filter((item) => {
      const country = String(item.country || '').toLocaleLowerCase();
      const company = String(item.company_name || '').toLocaleLowerCase();
      return !term || country.includes(term) || company.includes(term);
    });

    count.textContent = `${filtered.length} transitaire${filtered.length > 1 ? 's' : ''}`;

    if (!filtered.length) {
      list.innerHTML = `<div class="gf-state">${
        forwarders.length
          ? 'Aucun transitaire ne correspond à cette recherche.'
          : 'Aucun transitaire approuvé pour le moment. Les fiches apparaîtront ici après leur approbation par GLOBEXA.'
      }</div>`;
      return;
    }

    list.innerHTML = filtered.map((item) => `
      <article class="gf-card">
        <h3>${escapeHTML(item.company_name || 'Entreprise de transport')}</h3>
        <p class="gf-meta">
          <span class="gf-country">${escapeHTML(item.country || 'Pays non précisé')}</span>
        </p>
        ${item.contact
          ? `<p class="gf-meta"><strong>Contact :</strong> ${escapeHTML(item.contact)}</p>`
          : '<p class="gf-meta">Contact non renseigné</p>'}
      </article>
    `).join('');
  };

  searchInput.addEventListener('input', render);

  const loadForwarders = async () => {
    if (!db || typeof db.from !== 'function') {
      count.textContent = 'Indisponible';
      list.innerHTML = '<div class="gf-state">La connexion à la base de données est indisponible.</div>';
      return;
    }

    const { data, error } = await db
      .from('transitaires')
      .select('id, company_name, country, contact')
      .eq('status', 'approved')
      .order('company_name', { ascending: true })
      .limit(100);

    if (error) {
      console.error('GLOBEXA CODE 15 — erreur de chargement :', error);
      count.textContent = 'Erreur de chargement';
      list.innerHTML = '<div class="gf-state">Impossible de charger les transitaires pour le moment.</div>';
      return;
    }

    forwarders = Array.isArray(data) ? data : [];
    render();
  };

  loadForwarders();
  console.log('GLOBEXA CODE 15 : Annuaire public des transitaires activé.');
})();

/* GLOBEXA — CODE 16 : INSCRIPTION, NOTES ET AVIS DES TRANSITAIRES */
(() => {
  'use strict';

  const db = window.globexaSupabase;
  const anchor = document.querySelector('#fournisseurs');

  if (!db || !anchor) {
    console.error('GLOBEXA CODE 16 : connexion ou emplacement introuvable.');
    return;
  }

  // Remplace l'ancien annuaire CODE 15 par sa version complète.
  const oldSection = document.getElementById('globexa-forwarders');
  if (oldSection) oldSection.remove();

  const section = document.createElement('section');
  section.id = 'globexa-forwarders';
  section.className = 'section';

  const style = document.createElement('style');
  style.textContent = `
    #globexa-forwarders {
      background:#fff;
      border:1px solid #e2e8f0;
      border-radius:12px;
      padding:20px;
      margin-top:22px;
    }
    #globexa-forwarders h2,
    #globexa-forwarders h3 {
      color:#123b63;
    }
    #globexa-forwarders .g16-panel {
      background:#f8fafc;
      border:1px solid #e2e8f0;
      border-radius:10px;
      padding:16px;
      margin:15px 0;
    }
    #globexa-forwarders input,
    #globexa-forwarders select,
    #globexa-forwarders textarea {
      width:100%;
      box-sizing:border-box;
      padding:11px;
      margin:6px 0 12px;
      border:1px solid #cbd5e1;
      border-radius:7px;
      font:inherit;
      background:white;
    }
    #globexa-forwarders textarea {
      min-height:75px;
      resize:vertical;
    }
    #globexa-forwarders button {
      padding:10px 15px;
      border:0;
      border-radius:7px;
      background:#123b63;
      color:white;
      font-weight:700;
      cursor:pointer;
    }
    #globexa-forwarders button:disabled {
      opacity:.55;
      cursor:not-allowed;
    }
    #globexa-forwarders .g16-grid {
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
      gap:14px;
      margin-top:15px;
    }
    #globexa-forwarders .g16-card {
      border:1px solid #e2e8f0;
      border-radius:10px;
      padding:15px;
      min-width:0;
      background:white;
    }
    #globexa-forwarders .g16-country {
      display:inline-block;
      background:#fff1e6;
      color:#a64b0b;
      border-radius:20px;
      padding:5px 10px;
      font-size:13px;
      font-weight:700;
    }
    #globexa-forwarders .g16-stars {
      color:#f59e0b;
      font-size:21px;
      letter-spacing:2px;
    }
    #globexa-forwarders .g16-muted {
      color:#64748b;
      font-size:13px;
      line-height:1.5;
    }
    #globexa-forwarders .g16-comment {
      border-top:1px solid #e2e8f0;
      padding-top:9px;
      margin-top:9px;
      overflow-wrap:anywhere;
    }
    #globexa-forwarders .g16-message {
      padding:12px;
      background:#f1f5f9;
      border-radius:7px;
      margin:10px 0;
      color:#334155;
    }
    #globexa-forwarders .g16-search {
      max-width:480px;
    }
    #globexa-forwarders .g16-form-title {
      margin-top:0;
    }
  `;
  document.head.appendChild(style);

  section.innerHTML = `
    <h2>🌍 Transitaires et transport international</h2>
    <p class="g16-muted">
      Découvrez les transitaires approuvés, consultez leurs pays,
      leurs notes et les commentaires des clients.
    </p>

    <div class="g16-panel">
      <h3 class="g16-form-title">📝 Inscrire mon entreprise de transit</h3>
      <p class="g16-muted">
        Les inscriptions sont vérifiées par GLOBEXA avant publication.
      </p>
      <form id="g16-register">
        <label>Nom de l'entreprise</label>
        <input id="g16-company" required maxlength="150"
          placeholder="Nom de votre entreprise">

        <label>Pays</label>
        <input id="g16-country" required maxlength="100"
          placeholder="Exemple : Burkina Faso, Chine, France">

        <label>Contact professionnel</label>
        <input id="g16-contact" maxlength="150"
          placeholder="Téléphone, WhatsApp ou email professionnel">

        <button type="submit">Envoyer mon inscription</button>
      </form>
      <div id="g16-register-message" class="g16-message" hidden></div>
    </div>

    <div class="g16-panel">
      <h3>🚚 Associer un transitaire à mes envois</h3>
      <p class="g16-muted">
        Les fournisseurs peuvent sélectionner un transitaire approuvé
        pour leurs expéditions.
      </p>
      <div id="g16-shipments">
        Chargement des expéditions...
      </div>
    </div>

    <h3>⭐ Annuaire des transitaires</h3>
    <input id="g16-search" class="g16-search" type="search"
      placeholder="Rechercher une entreprise ou un pays...">

    <div id="g16-count" class="g16-muted">Chargement...</div>
    <div id="g16-list" class="g16-grid">
      <div class="g16-message">Chargement des transitaires...</div>
    </div>
  `;

  anchor.after(section);

  const $ = id => section.querySelector('#' + id);

  let user = null;
  let forwarders = [];
  let reviews = [];
  let eligibleShipments = [];
  let supplierShipments = [];

  const node = (tag, className, value) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined) el.textContent = value;
    return el;
  };

  const message = (target, value) => {
    target.hidden = false;
    target.textContent = value;
  };

  async function getUser() {
    const result = await db.auth.getUser();
    return result.data?.user || null;
  }

  function reviewsFor(transitaireId) {
    return reviews.filter(r => r.transitaire_id === transitaireId);
  }

  function renderReviews(card, transitaire) {
    const items = reviewsFor(transitaire.id);
    const average = items.length
      ? items.reduce((sum, r) => sum + Number(r.rating), 0) / items.length
      : 0;

    const rating = node('div', 'g16-stars');
    rating.textContent = items.length
      ? '★'.repeat(Math.round(average)) +
        '☆'.repeat(5 - Math.round(average))
      : '☆☆☆☆☆';

    card.append(rating);

    card.append(node(
      'p',
      'g16-muted',
      items.length
        ? average.toFixed(1) + '/5 — ' + items.length + ' avis'
        : 'Aucun avis pour le moment'
    ));

    const title = node('h4', '', 'Commentaires des clients');
    card.append(title);

    if (!items.length) {
      card.append(node('p', 'g16-muted', 'Soyez le premier client à laisser un avis après une livraison.'));
      return;
    }

    items.slice(0, 4).forEach(review => {
      const comment = node('div', 'g16-comment');
      const stars = node('div', 'g16-stars');
      stars.textContent =
        '★'.repeat(Number(review.rating)) +
        '☆'.repeat(5 - Number(review.rating));

      comment.append(stars);

      if (review.comment) {
        comment.append(node('p', '', review.comment));
      } else {
        comment.append(node('p', 'g16-muted', 'Note sans commentaire.'));
      }

      comment.append(node(
        'small',
        'g16-muted',
        new Date(review.created_at).toLocaleDateString('fr-FR')
      ));

      card.append(comment);
    });
  }

  async function submitReview(card, transitaire) {
    const available = eligibleShipments.filter(
      s => s.transitaire_id === transitaire.id &&
        !reviews.some(r => r.shipment_id === s.id)
    );

    if (!available.length) {
      card.append(node(
        'p',
        'g16-muted',
        'Un avis sera possible après une livraison confirmée avec ce transitaire.'
      ));
      return;
    }

    const form = node('form', 'g16-comment');
    const heading = node('h4', '', 'Donner mon avis');

    const shipmentSelect = node('select');
    shipmentSelect.required = true;

    available.forEach(shipment => {
      const option = node('option', '', 'Expédition ' + shipment.id.slice(0, 8));
      option.value = shipment.id;
      shipmentSelect.append(option);
    });

    const ratingSelect = node('select');
    ratingSelect.required = true;

    [5, 4, 3, 2, 1].forEach(value => {
      const option = node('option', '', value + ' étoile(s) sur 5');
      option.value = String(value);
      ratingSelect.append(option);
    });

    const comment = node('textarea');
    comment.maxLength = 1500;
    comment.placeholder = 'Écrivez votre commentaire...';

    const submit = node('button', '', 'Publier mon avis');
    submit.type = 'submit';

    form.append(
      heading,
      node('label', '', 'Expédition livrée'),
      shipmentSelect,
      node('label', '', 'Votre note'),
      ratingSelect,
      node('label', '', 'Votre commentaire'),
      comment,
      submit
    );

    form.addEventListener('submit', async event => {
      event.preventDefault();
      submit.disabled = true;

      const { error } = await db
        .from('globexa_transitaire_reviews')
        .insert({
          shipment_id: shipmentSelect.value,
          transitaire_id: transitaire.id,
          reviewer_id: user.id,
          rating: Number(ratingSelect.value),
          comment: comment.value.trim() || null
        });

      if (error) {
        console.error('CODE 16 — avis :', error);
        alert('Impossible de publier cet avis. Vérifiez votre connexion et votre livraison.');
        submit.disabled = false;
        return;
      }

      alert('Merci ! Votre avis a été publié.');
      await loadAll();
    });

    card.append(form);
  }

  function renderDirectory() {
    const term = $('g16-search').value.trim().toLocaleLowerCase('fr');
    const list = $('g16-list');

    list.replaceChildren();

    const filtered = forwarders.filter(item =>
      String(item.company_name || '').toLocaleLowerCase('fr').includes(term) ||
      String(item.country || '').toLocaleLowerCase('fr').includes(term)
    );

    $('g16-count').textContent =
      filtered.length + ' transitaire(s) approuvé(s)';

    if (!filtered.length) {
      list.append(node(
        'div',
        'g16-message',
        'Aucun transitaire trouvé pour cette recherche.'
      ));
      return;
    }

    filtered.forEach(transitaire => {
      const card = node('article', 'g16-card');

      card.append(node(
        'h3',
        '',
        transitaire.company_name || 'Entreprise de transport'
      ));

      card.append(node(
        'span',
        'g16-country',
        '🌍 ' + (transitaire.country || 'Pays non précisé')
      ));

      if (transitaire.contact) {
        card.append(node(
          'p',
          'g16-muted',
          'Contact : ' + transitaire.contact
        ));
      }

      renderReviews(card, transitaire);

      if (user) {
        submitReview(card, transitaire);
      }

      list.append(card);
    });
  }

  async function loadRegistrationStatus() {
    const target = $('g16-register-message');

    if (!user) {
      message(target, 'Connectez-vous à votre compte GLOBEXA pour inscrire votre entreprise.');
      return;
    }

    const { data, error } = await db
      .from('transitaires')
      .select('id,status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('CODE 16 — profil :', error);
      return;
    }

    if (data) {
      $('g16-register').hidden = true;

      message(
        target,
        data.status === 'approved'
          ? 'Votre entreprise est déjà approuvée.'
          : 'Votre inscription existe déjà. Statut : ' +
            (data.status || 'en attente') +
            '. Attendez la vérification de GLOBEXA.'
      );
    }
  }

  async function registerTransitaire(event) {
    event.preventDefault();

    const target = $('g16-register-message');
    const submit = $('g16-register').querySelector('button');

    if (!user) {
      message(target, 'Connectez-vous avant de vous inscrire comme transitaire.');
      return;
    }

    submit.disabled = true;

    const company = $('g16-company').value.trim();
    const country = $('g16-country').value.trim();
    const contact = $('g16-contact').value.trim();

    const { error } = await db.from('transitaires').insert({
      user_id: user.id,
      company_name: company,
      country,
      contact: contact || null,
      status: 'pending'
    });

    if (error) {
      console.error('CODE 16 — inscription :', error);
      message(target, 'Inscription impossible. Vérifiez votre compte ou si votre entreprise est déjà inscrite.');
      submit.disabled = false;
      return;
    }

    $('g16-register').reset();
    $('g16-register').hidden = true;
    message(target, 'Inscription envoyée avec succès. Votre entreprise apparaîtra après approbation de GLOBEXA.');
  }

  async function loadShipmentManagement() {
    const target = $('g16-shipments');
    target.replaceChildren();

    if (!user) {
      target.append(node(
        'p',
        'g16-muted',
        'Connectez-vous comme fournisseur pour associer un transitaire à vos expéditions.'
      ));
      return;
    }

    const { data: orders, error: orderError } = await db
      .from('globexa_market_orders')
      .select('id,status')
      .eq('supplier_id', user.id)
      .in('status', ['paid', 'processing', 'shipped']);

    if (orderError) {
      target.append(node('p', 'g16-muted', 'Impossible de charger vos commandes.'));
      console.error(orderError);
      return;
    }

    const orderIds = (orders || []).map(o => o.id);

    if (!orderIds.length) {
      target.append(node('p', 'g16-muted', 'Aucune commande à expédier pour le moment.'));
      return;
    }

    const { data: shipments, error } = await db
      .from('globexa_shipments')
      .select('id,order_id,status,transitaire_id')
      .in('order_id', orderIds)
      .neq('status', 'delivered');

    if (error) {
      target.append(node('p', 'g16-muted', 'Impossible de charger les expéditions.'));
      console.error(error);
      return;
    }

    supplierShipments = shipments || [];

    if (!supplierShipments.length) {
      target.append(node('p', 'g16-muted', 'Aucune expédition en attente d’attribution.'));
      return;
    }

    supplierShipments.forEach(shipment => {
      const row = node('div', 'g16-comment');

      row.append(node(
        'strong',
        '',
        'Commande ' + shipment.order_id.slice(0, 8)
      ));

      const select = node('select');
      const empty = node('option', '', 'Choisir un transitaire');
      empty.value = '';
      select.append(empty);

      forwarders.forEach(transitaire => {
        const option = node(
          'option',
          '',
          transitaire.company_name + ' — ' + transitaire.country
        );
        option.value = transitaire.id;
        option.selected = transitaire.id === shipment.transitaire_id;
        select.append(option);
      });

      const save = node('button', '', 'Enregistrer le transitaire');
      save.type = 'button';

      save.addEventListener('click', async () => {
        save.disabled = true;

        const { error: updateError } = await db
          .from('globexa_shipments')
          .update({ transitaire_id: select.value || null })
          .eq('id', shipment.id);

        if (updateError) {
          console.error('CODE 16 — attribution :', updateError);
          alert('Impossible d’enregistrer ce transitaire.');
          save.disabled = false;
          return;
        }

        alert('Transitaire associé à cette expédition.');
        await loadAll();
      });

      row.append(select, save);
      target.append(row);
    });
  }

  async function loadBuyerShipments() {
    eligibleShipments = [];

    if (!user) return;

    const { data: orders, error } = await db
      .from('globexa_market_orders')
      .select('id')
      .eq('buyer_id', user.id)
      .eq('status', 'delivered');

    if (error || !orders?.length) return;

    const { data: shipments, error: shipmentError } = await db
      .from('globexa_shipments')
      .select('id,order_id,transitaire_id,status')
      .in('order_id', orders.map(o => o.id))
      .eq('status', 'delivered')
      .not('transitaire_id', 'is', null);

    if (!shipmentError) {
      eligibleShipments = shipments || [];
    }
  }

  async function loadAll() {
    const { data, error } = await db
      .from('transitaires')
      .select('id,company_name,country,contact')
      .eq('status', 'approved')
      .order('company_name', { ascending: true })
      .limit(200);

    if (error) {
      console.error('CODE 16 — transitaires :', error);
      $('g16-list').textContent = 'Impossible de charger les transitaires.';
      return;
    }

    forwarders = data || [];

    const ids = forwarders.map(item => item.id);
    reviews = [];

    if (ids.length) {
      const result = await db
        .from('globexa_transitaire_reviews')
        .select('id,shipment_id,transitaire_id,rating,comment,created_at')
        .in('transitaire_id', ids)
        .order('created_at', { ascending: false })
        .limit(500);

      if (result.error) {
        console.error('CODE 16 — commentaires :', result.error);
      } else {
        reviews = result.data || [];
      }
    }

    renderDirectory();
    await loadShipmentManagement();
    await loadBuyerShipments();
    renderDirectory();
  }

  $('g16-search').addEventListener('input', renderDirectory);
  $('g16-register').addEventListener('submit', registerTransitaire);

  (async () => {
    user = await getUser();
    await loadRegistrationStatus();
    await loadAll();
    console.log('GLOBEXA CODE 16 : Inscriptions, étoiles et avis transitaires activés.');
  })();

})();

/* =========================================================
   GLOBEXA — CODE 17 : SUIVI DÉTAILLÉ DES EXPÉDITIONS
   Historique, étapes, lieux et mise à jour du transport.
   ========================================================= */

(() => {
  'use strict';

  const db = window.globexaSupabase;

  if (!db || document.getElementById('g17-tracking')) return;

  const anchor =
    document.getElementById('globexa-forwarders') ||
    document.getElementById('fournisseurs');

  if (!anchor) {
    console.error('CODE 17 : emplacement introuvable.');
    return;
  }

  const section = document.createElement('section');
  section.id = 'g17-tracking';

  section.style.cssText = [
    'margin:25px 0',
    'padding:18px',
    'background:#f4f7fb',
    'border-radius:12px',
    'border:1px solid #dce5ef'
  ].join(';');

  const style = document.createElement('style');
  style.textContent = `
    #g17-tracking * { box-sizing:border-box; }
    #g17-tracking h2 { color:#123c68; margin:0 0 8px; }
    #g17-tracking .g17-muted { color:#64748b; font-size:14px; }
    #g17-tracking .g17-card {
      background:white;
      border:1px solid #dce5ef;
      border-radius:10px;
      padding:15px;
      margin-top:14px;
    }
    #g17-tracking .g17-grid {
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
      gap:10px;
      margin-top:12px;
    }
    #g17-tracking .g17-field {
      width:100%;
      padding:11px;
      border:1px solid #cbd5e1;
      border-radius:7px;
      margin-top:5px;
      background:white;
      color:#172b45;
    }
    #g17-tracking button {
      padding:11px 15px;
      border:0;
      border-radius:7px;
      background:#123f70;
      color:white;
      font-weight:600;
      cursor:pointer;
      margin-top:10px;
    }
    #g17-tracking button:disabled {
      opacity:.6;
      cursor:wait;
    }
    #g17-tracking .g17-event {
      border-left:3px solid #f28c28;
      padding:8px 12px;
      margin:10px 0;
      background:#f8fafc;
      border-radius:0 7px 7px 0;
    }
    #g17-tracking .g17-status {
      display:inline-block;
      padding:5px 9px;
      border-radius:20px;
      background:#e8f1fb;
      color:#123f70;
      font-size:12px;
      font-weight:700;
    }
    #g17-tracking textarea { min-height:75px; }
  `;

  document.head.appendChild(style);

  const title = document.createElement('h2');
  title.textContent = 'Suivi de mes expéditions';

  const intro = document.createElement('p');
  intro.className = 'g17-muted';
  intro.textContent =
    'Consultez les étapes du transport, les lieux de passage et les dates de livraison.';

  const message = document.createElement('p');
  message.className = 'g17-muted';
  message.textContent = 'Chargement du suivi...';

  const list = document.createElement('div');
  list.id = 'g17-list';

  section.append(title, intro, message, list);
  anchor.insertAdjacentElement('afterend', section);

  const labels = {
    preparing: 'Préparation',
    in_transit: 'En transit',
    customs: 'En douane',
    delivered: 'Livré',
    exception: 'Incident'
  };

  function element(tag, text, className) {
    const item = document.createElement(tag);
    if (text !== undefined) item.textContent = text;
    if (className) item.className = className;
    return item;
  }

  function formatDate(value) {
    if (!value) return 'Non renseignée';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return 'Date inconnue';

    return date.toLocaleString('fr-FR');
  }

  function addField(parent, labelText, type, placeholder) {
    const wrapper = element('label', labelText);
    wrapper.style.cssText = 'display:block;margin-top:10px;';

    const input = document.createElement(
      type === 'textarea' ? 'textarea' : type
    );

    input.className = 'g17-field';
    input.placeholder = placeholder || '';

    wrapper.appendChild(input);
    parent.appendChild(wrapper);

    return input;
  }

  async function loadTracking() {
    list.replaceChildren();

    const auth = await db.auth.getUser();
    const user = auth.data?.user;

    if (auth.error || !user) {
      message.textContent =
        'Connectez-vous pour consulter vos expéditions.';
      return;
    }

    message.textContent = 'Chargement des expéditions...';

    const [buyerResult, supplierResult, transitaireResult] =
      await Promise.all([
        db.from('globexa_market_orders')
          .select('id')
          .eq('buyer_id', user.id),

        db.from('globexa_market_orders')
          .select('id')
          .eq('supplier_id', user.id),

        db.from('transitaires')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'approved')
          .limit(1)
      ]);

    if (buyerResult.error || supplierResult.error) {
      message.textContent =
        'Impossible de vérifier vos commandes. Réessayez.';
      console.error(
        'CODE 17 — commandes :',
        buyerResult.error || supplierResult.error
      );
      return;
    }

    const buyerIds = (buyerResult.data || []).map(x => x.id);
    const supplierIds = (supplierResult.data || []).map(x => x.id);

    const transitaireId =
      transitaireResult.data?.[0]?.id || null;

    const { data: shipments, error } = await db
      .from('globexa_shipments')
      .select(
        'id,order_id,carrier,tracking_number,origin,destination,status,estimated_delivery,created_at,transitaire_id'
      )
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      message.textContent =
        'Impossible de charger les expéditions.';
      console.error('CODE 17 — expéditions :', error);
      return;
    }

    const allShipments = shipments || [];

    if (!allShipments.length) {
      message.textContent =
        'Aucune expédition disponible pour votre compte.';
      return;
    }

    message.textContent =
      allShipments.length + ' expédition(s) trouvée(s).';

    for (const shipment of allShipments) {
      const isBuyer = buyerIds.includes(shipment.order_id);
      const isSupplier = supplierIds.includes(shipment.order_id);
      const isAssignedTransitaire =
        !!transitaireId &&
        shipment.transitaire_id === transitaireId;

      const card = element('article', undefined, 'g17-card');

      card.appendChild(
        element(
          'h3',
          'Expédition ' + shipment.id.slice(0, 8)
        )
      );

      card.appendChild(
        element(
          'p',
          'Commande : ' + shipment.order_id.slice(0, 8)
        )
      );

      card.appendChild(
        element(
          'span',
          labels[shipment.status] || shipment.status,
          'g17-status'
        )
      );

      const details = element('div', undefined, 'g17-grid');

      const detailItems = [
        ['Transporteur', shipment.carrier],
        ['Numéro de suivi', shipment.tracking_number],
        ['Départ', shipment.origin],
        ['Destination', shipment.destination],
        ['Livraison estimée', shipment.estimated_delivery]
      ];

      detailItems.forEach(([label, value]) => {
        const block = element('div');
        block.appendChild(
          element('strong', label)
        );
        block.appendChild(
          element('p', value || 'Non renseigné', 'g17-muted')
        );
        details.appendChild(block);
      });

      card.appendChild(details);

      card.appendChild(
        element('h4', 'Historique du transport')
      );

      const history = element('div');

      const { data: events, error: eventError } = await db
        .from('globexa_tracking_events')
        .select('id,event_status,location,details,occurred_at')
        .eq('shipment_id', shipment.id)
        .order('occurred_at', { ascending: false })
        .limit(50);

      if (eventError) {
        history.appendChild(
          element(
            'p',
            'Historique momentanément indisponible.',
            'g17-muted'
          )
        );
        console.error('CODE 17 — historique :', eventError);
      } else if (!events || !events.length) {
        history.appendChild(
          element(
            'p',
            'Aucune étape de transport enregistrée.',
            'g17-muted'
          )
        );
      } else {
        events.forEach(event => {
          const row = element('div', undefined, 'g17-event');

          row.appendChild(
            element(
              'strong',
              labels[event.event_status] || event.event_status
            )
          );

          if (event.location) {
            row.appendChild(
              element('p', 'Lieu : ' + event.location)
            );
          }

          if (event.details) {
            row.appendChild(
              element('p', event.details)
            );
          }

          row.appendChild(
            element(
              'small',
              formatDate(event.occurred_at),
              'g17-muted'
            )
          );

          history.appendChild(row);
        });
      }

      card.appendChild(history);

      const canAddEvent =
        isSupplier || isAssignedTransitaire;

      if (canAddEvent && shipment.status !== 'delivered') {
        const form = element('div', undefined, 'g17-card');

        form.appendChild(
          element('h4', 'Ajouter une étape de transport')
        );

        const statusLabel = element('label', 'État de l’expédition');
        statusLabel.style.display = 'block';

        const statusSelect = document.createElement('select');
        statusSelect.className = 'g17-field';

        const allowedStatuses = isSupplier
          ? ['preparing', 'in_transit', 'customs', 'exception', 'delivered']
          : ['preparing', 'in_transit', 'customs', 'exception'];

        allowedStatuses.forEach(status => {
          const option = element(
            'option',
            labels[status] || status
          );
          option.value = status;
          option.selected = status === shipment.status;
          statusSelect.appendChild(option);
        });

        statusLabel.appendChild(statusSelect);
        form.appendChild(statusLabel);

        const locationInput = addField(
          form,
          'Lieu actuel',
          'text',
          'Exemple : Abidjan, Côte d’Ivoire'
        );

        const detailsInput = addField(
          form,
          'Détails de cette étape',
          'textarea',
          'Informations sur le transport...'
        );

        const save = element(
          'button',
          'Enregistrer cette étape'
        );

        save.type = 'button';

        save.addEventListener('click', async () => {
          const newStatus = statusSelect.value;
          const location = locationInput.value.trim();
          const detailsText = detailsInput.value.trim();

          if (!location || !detailsText) {
            alert('Renseignez le lieu et les détails.');
            return;
          }

          save.disabled = true;
          save.textContent = 'Enregistrement...';

          const { error: insertError } = await db
            .from('globexa_tracking_events')
            .insert({
              shipment_id: shipment.id,
              event_status: newStatus,
              location: location,
              details: detailsText
            });

          if (insertError) {
            console.error(
              'CODE 17 — ajout étape :',
              insertError
            );

            alert(
              'Impossible d’enregistrer cette étape. Vérifiez vos droits et votre connexion.'
            );

            save.disabled = false;
            save.textContent = 'Enregistrer cette étape';
            return;
          }

          let statusUpdated = true;

          if (isSupplier && newStatus !== shipment.status) {
            const { error: updateError } = await db
              .from('globexa_shipments')
              .update({ status: newStatus })
              .eq('id', shipment.id);

            if (updateError) {
              statusUpdated = false;
              console.error(
                'CODE 17 — mise à jour statut :',
                updateError
              );
            }
          }

          if (statusUpdated) {
            alert('Étape de transport enregistrée.');
          } else {
            alert(
              'Étape enregistrée, mais le statut général n’a pas pu être actualisé.'
            );
          }

          await loadTracking();
        });

        form.appendChild(save);
        card.appendChild(form);
      }

      if (isBuyer) {
        card.appendChild(
          element(
            'p',
            'Vous consultez le suivi de votre commande.',
            'g17-muted'
          )
        );
      }

      if (isAssignedTransitaire) {
        card.appendChild(
          element(
            'p',
            'Vous êtes le transitaire attribué à cette expédition.',
            'g17-muted'
          )
        );
      }

      list.appendChild(card);
    }
  }

  db.auth.onAuthStateChange(() => {
    setTimeout(() => {
      loadTracking();
    }, 0);
  });

  loadTracking();

  console.log(
    'GLOBEXA CODE 17 : Suivi détaillé des expéditions activé.'
  );
})();

/* =========================================================
   GLOBEXA — CODE 18 : CENTRE DE NOTIFICATIONS
   ========================================================= */

(() => {
  "use strict";

  const db = window.globexaSupabase;

  if (!db || document.getElementById("globexa-notifications")) {
    console.error("GLOBEXA CODE 18 : Supabase indisponible ou code déjà chargé.");
    return;
  }

  const root = document.createElement("div");
  root.id = "globexa-notifications";

  const style = document.createElement("style");
  style.textContent = `
    #globexa-notifications {
      position: fixed;
      right: 16px;
      bottom: 18px;
      z-index: 99999;
      font-family: Arial, sans-serif;
      color: #17324d;
    }
    #g18-toggle {
      border: 0;
      border-radius: 28px;
      padding: 13px 18px;
      background: #123f75;
      color: white;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 5px 20px #0003;
    }
    #g18-count {
      display: inline-block;
      margin-left: 7px;
      padding: 3px 7px;
      border-radius: 20px;
      background: #f28c28;
      color: white;
    }
    #g18-panel {
      display: none;
      position: absolute;
      right: 0;
      bottom: 58px;
      width: min(360px, calc(100vw - 32px));
      max-height: 70vh;
      overflow-y: auto;
      background: white;
      border: 1px solid #dce5ef;
      border-radius: 14px;
      box-shadow: 0 8px 35px #0003;
      padding: 15px;
    }
    #g18-panel.g18-open {
      display: block;
    }
    .g18-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 12px;
    }
    .g18-head h3 {
      margin: 0;
      font-size: 17px;
    }
    .g18-actions {
      display: flex;
      gap: 6px;
    }
    .g18-actions button {
      border: 1px solid #dce5ef;
      background: #f5f8fc;
      border-radius: 7px;
      padding: 7px;
      cursor: pointer;
      color: #17324d;
    }
    .g18-item {
      padding: 11px;
      margin-bottom: 8px;
      border: 1px solid #e1e8f0;
      border-radius: 9px;
      background: white;
    }
    .g18-item.g18-unread {
      background: #eef5ff;
      border-left: 4px solid #f28c28;
    }
    .g18-item strong {
      display: block;
      margin-bottom: 5px;
    }
    .g18-item p {
      margin: 4px 0;
      font-size: 13px;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
    .g18-item small {
      color: #68798c;
      font-size: 11px;
    }
    .g18-read {
      margin-top: 8px;
      border: 0;
      background: #123f75;
      color: white;
      padding: 7px 10px;
      border-radius: 6px;
      cursor: pointer;
    }
    .g18-empty {
      padding: 20px 8px;
      text-align: center;
      color: #68798c;
      font-size: 13px;
    }
    .g18-error {
      color: #b42318;
      font-size: 13px;
    }
  `;

  document.head.appendChild(style);

  const toggle = document.createElement("button");
  toggle.id = "g18-toggle";
  toggle.type = "button";
  toggle.textContent = "Notifications";

  const count = document.createElement("span");
  count.id = "g18-count";
  count.textContent = "0";
  toggle.appendChild(count);

  const panel = document.createElement("section");
  panel.id = "g18-panel";

  const head = document.createElement("div");
  head.className = "g18-head";

  const heading = document.createElement("h3");
  heading.textContent = "Mes notifications";

  const actions = document.createElement("div");
  actions.className = "g18-actions";

  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.textContent = "Actualiser";

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Fermer";

  actions.append(refresh, close);
  head.append(heading, actions);

  const list = document.createElement("div");
  list.id = "g18-list";

  const markAll = document.createElement("button");
  markAll.type = "button";
  markAll.className = "g18-read";
  markAll.textContent = "Tout marquer comme lu";
  markAll.style.display = "none";

  panel.append(head, markAll, list);
  root.append(toggle, panel);
  document.body.appendChild(root);

  let currentUserId = null;
  let loading = false;

  function showMessage(text, className = "g18-empty") {
    list.replaceChildren();
    const message = document.createElement("div");
    message.className = className;
    message.textContent = text;
    list.appendChild(message);
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("fr-FR");
  }

  function typeLabel(type) {
    const labels = {
      order: "Commande",
      payment: "Paiement",
      shipment: "Expédition",
      message: "Message",
      dispute: "Litige",
      general: "Information"
    };
    return labels[type] || "Notification";
  }

  async function markAsRead(notificationId) {
    if (!currentUserId) return;

    const { error } = await db
      .from("globexa_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", currentUserId)
      .is("read_at", null);

    if (error) {
      console.error("CODE 18 — lecture :", error);
      alert("Impossible de modifier cette notification.");
      return;
    }

    await loadNotifications();
  }

  function renderNotifications(rows) {
    list.replaceChildren();

    const unread = rows.filter(item => !item.read_at);
    count.textContent = String(unread.length);
    markAll.style.display = unread.length ? "inline-block" : "none";

    if (!rows.length) {
      showMessage("Aucune notification pour le moment.");
      return;
    }

    rows.forEach(item => {
      const card = document.createElement("article");
      card.className = "g18-item" + (item.read_at ? "" : " g18-unread");

      const title = document.createElement("strong");
      title.textContent = item.title || typeLabel(item.notification_type);

      const body = document.createElement("p");
      body.textContent = item.body || "";

      const type = document.createElement("small");
      type.textContent = typeLabel(item.notification_type);

      const date = document.createElement("small");
      date.textContent = " • " + formatDate(item.created_at);

      card.append(title, body, type, date);

      if (!item.read_at) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "g18-read";
        button.textContent = "Marquer comme lu";
        button.addEventListener("click", () => markAsRead(item.id));
        card.appendChild(button);
      }

      list.appendChild(card);
    });
  }

  async function loadNotifications() {
    if (loading) return;

    const { data: authData, error: authError } = await db.auth.getUser();

    if (authError || !authData.user) {
      currentUserId = null;
      count.textContent = "0";
      markAll.style.display = "none";
      showMessage("Connectez-vous pour consulter vos notifications.");
      return;
    }

    currentUserId = authData.user.id;
    loading = true;
    showMessage("Chargement des notifications...");

    try {
      const { data, error } = await db
        .from("globexa_notifications")
        .select("id,user_id,notification_type,title,body,order_id,message_id,read_at,created_at")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      renderNotifications(data || []);
    } catch (error) {
      console.error("CODE 18 — chargement :", error);
      showMessage(
        "Impossible de charger les notifications. Réessayez.",
        "g18-error"
      );
    } finally {
      loading = false;
    }
  }

  markAll.addEventListener("click", async () => {
    if (!currentUserId) return;

    markAll.disabled = true;

    const { error } = await db
      .from("globexa_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", currentUserId)
      .is("read_at", null);

    markAll.disabled = false;

    if (error) {
      console.error("CODE 18 — tout marquer comme lu :", error);
      alert("Impossible de modifier les notifications.");
      return;
    }

    await loadNotifications();
  });

  toggle.addEventListener("click", () => {
    panel.classList.toggle("g18-open");
    if (panel.classList.contains("g18-open")) {
      loadNotifications();
    }
  });

  refresh.addEventListener("click", loadNotifications);

  close.addEventListener("click", () => {
    panel.classList.remove("g18-open");
  });

  db.auth.onAuthStateChange(() => {
    currentUserId = null;
    count.textContent = "0";
    if (panel.classList.contains("g18-open")) {
      loadNotifications();
    }
  });

  console.log("GLOBEXA CODE 18 : Centre de notifications activé.");
})();

/* =========================================================
   GLOBEXA — CODE 19 : CENTRE DE GESTION DES LITIGES
   ========================================================= */

(() => {
  "use strict";

  const db = window.globexaSupabase;

  if (!db || document.getElementById("globexa-disputes")) {
    console.error("CODE 19 : Supabase indisponible ou code déjà chargé.");
    return;
  }

  const root = document.createElement("section");
  root.id = "globexa-disputes";
  root.style.cssText =
    "margin:25px 0;padding:20px;background:#f4f7fb;" +
    "border:1px solid #dce5ef;border-radius:12px;" +
    "font-family:Arial,sans-serif;color:#17324d;";

  const style = document.createElement("style");
  style.textContent = `
    #globexa-disputes * { box-sizing:border-box; }
    #globexa-disputes h2 { color:#123f75;margin-top:0; }
    #globexa-disputes .g19-card {
      background:white;border:1px solid #dce5ef;
      border-radius:10px;padding:15px;margin:12px 0;
    }
    #globexa-disputes .g19-field {
      display:block;width:100%;padding:11px;margin:7px 0 13px;
      border:1px solid #cbd5e1;border-radius:7px;
      background:white;color:#17324d;
    }
    #globexa-disputes button {
      border:0;border-radius:7px;padding:11px 15px;
      background:#123f75;color:white;font-weight:bold;
      cursor:pointer;margin-top:8px;
    }
    #globexa-disputes button:disabled {
      opacity:.6;cursor:wait;
    }
    #globexa-disputes .g19-status {
      display:inline-block;padding:5px 9px;border-radius:20px;
      background:#fff0dc;color:#9a4c00;font-size:12px;
      font-weight:bold;
    }
    #globexa-disputes .g19-muted {
      color:#64748b;font-size:14px;
    }
  `;

  root.appendChild(style);

  const heading = document.createElement("h2");
  heading.textContent = "Centre de gestion des litiges";

  const intro = document.createElement("p");
  intro.className = "g19-muted";
  intro.textContent =
    "Signalez un problème concernant une commande et suivez son traitement.";

  const notice = document.createElement("p");
  notice.className = "g19-muted";
  notice.textContent = "Vérification de votre compte...";

  const form = document.createElement("form");
  form.className = "g19-card";

  const formTitle = document.createElement("h3");
  formTitle.textContent = "Ouvrir un nouveau litige";

  const orderLabel = document.createElement("label");
  orderLabel.textContent = "Commande concernée";

  const orderSelect = document.createElement("select");
  orderSelect.className = "g19-field";
  orderSelect.required = true;

  const reasonLabel = document.createElement("label");
  reasonLabel.textContent = "Motif du litige";

  const reason = document.createElement("select");
  reason.className = "g19-field";
  reason.required = true;

  [
    ["", "Choisir un motif"],
    ["Produit non reçu", "Produit non reçu"],
    ["Produit non conforme", "Produit non conforme"],
    ["Produit endommagé", "Produit endommagé"],
    ["Problème de livraison", "Problème de livraison"],
    ["Problème de paiement", "Problème de paiement"],
    ["Autre", "Autre"]
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    reason.appendChild(option);
  });

  const descriptionLabel = document.createElement("label");
  descriptionLabel.textContent = "Expliquez votre problème";

  const description = document.createElement("textarea");
  description.className = "g19-field";
  description.rows = 5;
  description.maxLength = 3000;
  description.required = true;
  description.placeholder =
    "Décrivez clairement le problème rencontré...";

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Envoyer le litige";

  form.append(
    formTitle,
    orderLabel,
    orderSelect,
    reasonLabel,
    reason,
    descriptionLabel,
    description,
    submit
  );

  const listTitle = document.createElement("h3");
  listTitle.textContent = "Mes litiges";

  const list = document.createElement("div");

  root.append(heading, intro, notice, form, listTitle, list);

  const anchor =
    document.querySelector("#globexa-forwarders") ||
    document.querySelector("#g17-tracking") ||
    document.querySelector("main") ||
    document.body;

  anchor.insertAdjacentElement("afterend", root);

  const statusLabels = {
    open: "Ouvert",
    under_review: "En cours d'examen",
    resolved: "Résolu",
    rejected: "Rejeté"
  };

  let currentUser = null;

  function makeElement(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Date inconnue"
      : date.toLocaleString("fr-FR");
  }

  async function loadDisputes() {
    list.replaceChildren();

    const { data, error } = await db
      .from("globexa_disputes")
      .select(
        "id,order_id,opened_by,reason,description,status,resolution,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("CODE 19 — chargement des litiges :", error);
      list.append(
        makeElement("p", "Impossible de charger vos litiges.")
      );
      return;
    }

    if (!data || !data.length) {
      list.append(
        makeElement("p", "Vous n'avez pas encore de litige.")
      );
      return;
    }

    data.forEach(item => {
      const card = makeElement("article", undefined, "g19-card");

      card.append(
        makeElement(
          "strong",
          "Litige — commande " + item.order_id.slice(0, 8)
        ),
        makeElement("p", "Motif : " + item.reason),
        makeElement("p", "Description : " + item.description),
        makeElement(
          "span",
          statusLabels[item.status] || item.status,
          "g19-status"
        ),
        makeElement("p", "Date : " + formatDate(item.created_at))
      );

      if (item.resolution) {
        card.append(
          makeElement("strong", "Réponse de GLOBEXA"),
          makeElement("p", item.resolution)
        );
      } else {
        card.append(
          makeElement(
            "p",
            "En attente d'une réponse de l'administration.",
            "g19-muted"
          )
        );
      }

      list.appendChild(card);
    });
  }

  async function initialize() {
    const { data, error } = await db.auth.getUser();

    if (error || !data.user) {
      currentUser = null;
      notice.textContent =
        "Connectez-vous pour ouvrir et consulter vos litiges.";
      form.hidden = true;
      list.replaceChildren(
        makeElement("p", "Connexion nécessaire.")
      );
      return;
    }

    currentUser = data.user;
    form.hidden = false;

    const { data: orders, error: orderError } = await db
      .from("globexa_market_orders")
      .select("id,status")
      .or(
        "buyer_id.eq." + currentUser.id +
        ",supplier_id.eq." + currentUser.id
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (orderError) {
      console.error("CODE 19 — commandes :", orderError);
      notice.textContent =
        "Impossible de charger vos commandes.";
      form.hidden = true;
      return;
    }

    orderSelect.replaceChildren();

    const firstOption = makeElement(
      "option",
      "Choisir une commande"
    );
    firstOption.value = "";
    orderSelect.appendChild(firstOption);

    (orders || []).forEach(order => {
      const option = makeElement(
        "option",
        "Commande " + order.id.slice(0, 8) +
        " — " + order.status
      );
      option.value = order.id;
      orderSelect.appendChild(option);
    });

    if (!orders || !orders.length) {
      notice.textContent =
        "Aucune commande trouvée pour votre compte.";
      form.hidden = true;
    } else {
      notice.textContent =
        "Vous pouvez signaler un problème concernant vos commandes.";
    }

    await loadDisputes();
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (!currentUser) {
      notice.textContent = "Connectez-vous avant de continuer.";
      return;
    }

    const orderId = orderSelect.value;
    const selectedReason = reason.value;
    const details = description.value.trim();

    if (!orderId || !selectedReason || details.length < 10) {
      notice.textContent =
        "Choisissez une commande, un motif et une description d'au moins 10 caractères.";
      return;
    }

    submit.disabled = true;
    submit.textContent = "Envoi en cours...";

    const { error } = await db
      .from("globexa_disputes")
      .insert({
        order_id: orderId,
        opened_by: currentUser.id,
        reason: selectedReason,
        description: details,
        status: "open"
      });

    submit.disabled = false;
    submit.textContent = "Envoyer le litige";

    if (error) {
      console.error("CODE 19 — création du litige :", error);
      notice.textContent =
        "Impossible d'envoyer le litige. Vérifiez vos droits ou réessayez.";
      return;
    }

    form.reset();
    notice.textContent =
      "Votre litige a été envoyé. Vous pouvez suivre son évolution ci-dessous.";

    await loadDisputes();
  });

  db.auth.onAuthStateChange(() => {
    initialize();
  });

  initialize();

  console.log("GLOBEXA CODE 19 : Centre des litiges chargé.");
})();

/* =========================================================
   GLOBEXA — CODE 20 : ESPACE DE SUIVI DES PAIEMENTS
   ========================================================= */

(() => {
  "use strict";

  const db = window.globexaSupabase;

  if (!db || document.getElementById("globexa-payment-center")) {
    console.error("CODE 20 : Supabase indisponible ou code déjà chargé.");
    return;
  }

  const root = document.createElement("section");
  root.id = "globexa-payment-center";
  root.style.cssText =
    "margin:25px 0;padding:20px;background:#f4f7fb;" +
    "border:1px solid #dce5ef;border-radius:12px;" +
    "font-family:Arial,sans-serif;color:#17324d;";

  const style = document.createElement("style");
  style.textContent = `
    #globexa-payment-center * { box-sizing:border-box; }
    #globexa-payment-center h2 { color:#123f75;margin-top:0; }
    #globexa-payment-center .g20-card {
      background:white;border:1px solid #dce5ef;
      border-radius:10px;padding:15px;margin:12px 0;
    }
    #globexa-payment-center .g20-muted {
      color:#64748b;font-size:14px;
    }
    #globexa-payment-center .g20-status {
      display:inline-block;padding:5px 10px;
      border-radius:20px;background:#fff0dc;
      color:#9a4c00;font-size:12px;font-weight:bold;
    }
    #globexa-payment-center .g20-paid {
      background:#dcfce7;color:#166534;
    }
    #globexa-payment-center .g20-failed {
      background:#fee2e2;color:#991b1b;
    }
    #globexa-payment-center button {
      border:0;border-radius:7px;padding:10px 14px;
      background:#123f75;color:white;font-weight:bold;
      cursor:pointer;margin-top:10px;
    }
  `;

  root.appendChild(style);

  const heading = document.createElement("h2");
  heading.textContent = "Mes paiements GLOBEXA";

  const intro = document.createElement("p");
  intro.className = "g20-muted";
  intro.textContent =
    "Consultez vos commandes, leurs montants et leur état de paiement.";

  const notice = document.createElement("p");
  notice.className = "g20-muted";
  notice.textContent = "Vérification de votre compte...";

  const summary = document.createElement("div");
  summary.className = "g20-card";

  const listTitle = document.createElement("h3");
  listTitle.textContent = "Historique de mes paiements";

  const list = document.createElement("div");

  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.textContent = "Actualiser mes commandes";

  root.append(heading, intro, notice, summary, listTitle, list, refresh);

  const anchor =
    document.querySelector("#globexa-disputes") ||
    document.querySelector("#g19-disputes") ||
    document.querySelector("#g17-tracking") ||
    document.querySelector("main") ||
    document.body;

  anchor.insertAdjacentElement("afterend", root);

  let currentUser = null;

  function element(tag, text, className) {
    const item = document.createElement(tag);
    if (text !== undefined) item.textContent = text;
    if (className) item.className = className;
    return item;
  }

  function money(value, currency) {
    return Number(value || 0).toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + " " + (currency || "USD");
  }

  function date(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? "Date inconnue"
      : d.toLocaleString("fr-FR");
  }

  function paymentLabel(status) {
    const labels = {
      pending: "En attente de paiement",
      paid: "Payé",
      failed: "Échec du paiement",
      refunded: "Remboursé",
      cancelled: "Annulé"
    };

    return labels[status] || status || "Non renseigné";
  }

  function paymentClass(status) {
    if (status === "paid") return "g20-status g20-paid";
    if (status === "failed" || status === "cancelled") {
      return "g20-status g20-failed";
    }
    return "g20-status";
  }

  async function loadPayments() {
    list.replaceChildren();
    summary.replaceChildren();

    const auth = await db.auth.getUser();
    currentUser = auth.data?.user || null;

    if (auth.error || !currentUser) {
      notice.textContent =
        "Connectez-vous pour consulter vos paiements.";
      refresh.hidden = true;
      list.appendChild(
        element("p", "Connexion nécessaire.")
      );
      return;
    }

    refresh.hidden = false;
    notice.textContent = "Chargement de vos commandes...";

    const { data: orders, error } = await db
      .from("globexa_market_orders")
      .select(
        "id,quantity,unit_price,subtotal,currency,status," +
        "payment_status,payment_method,created_at"
      )
      .eq("buyer_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("CODE 20 — commandes :", error);
      notice.textContent =
        "Impossible de charger vos informations de paiement.";
      return;
    }

    const records = orders || [];

    const total = records.reduce(
      (sum, order) => sum + Number(order.subtotal || 0),
      0
    );

    const paid = records.filter(
      order => order.payment_status === "paid"
    );

    const pending = records.filter(
      order => order.payment_status === "pending"
    );

    summary.append(
      element("strong", "Résumé de vos commandes"),
      element("p", "Nombre de commandes : " + records.length),
      element("p", "Commandes payées : " + paid.length),
      element("p", "En attente de paiement : " + pending.length),
      element("p", "Montant total des commandes : " + money(
        total,
        records[0]?.currency || "USD"
      ))
    );

    if (!records.length) {
      notice.textContent = "Aucune commande trouvée.";
      list.appendChild(
        element("p", "Vos commandes apparaîtront ici.")
      );
      return;
    }

    notice.textContent =
      records.length + " commande(s) trouvée(s).";

    records.forEach(order => {
      const card = element("article", undefined, "g20-card");

      card.append(
        element(
          "strong",
          "Commande " + order.id.slice(0, 8)
        ),
        element(
          "p",
          "Quantité : " + order.quantity
        ),
        element(
          "p",
          "Prix unitaire : " +
          money(order.unit_price, order.currency)
        ),
        element(
          "p",
          "Montant : " +
          money(order.subtotal, order.currency)
        ),
        element(
          "p",
          "Date : " + date(order.created_at)
        ),
        element(
          "Commande : " + ({
            pending: "En attente",
            awaiting_payment: "En attente de paiement",
            paid: "Payée",
            processing: "En traitement",
            shipped: "Expédiée",
            delivered: "Livrée",
            cancelled: "Annulée",
            disputed: "En litige"
          }[order.status] || order.status)      
        element(
          "span",
          paymentLabel(order.payment_status),
          paymentClass(order.payment_status)
        )
      );

      if (order.payment_method) {
        card.append(
          element("p", "Moyen utilisé : " + order.payment_method)
        );
      }

      if (order.payment_status === "pending") {
        card.append(
          element(
            "p",
            "Le paiement en ligne n'est pas encore activé pour cette commande.",
            "g20-muted"
          )
        );
      }

      list.appendChild(card);
    });
  }

  refresh.addEventListener("click", async () => {
    refresh.disabled = true;
    refresh.textContent = "Actualisation...";
    await loadPayments();
    refresh.disabled = false;
    refresh.textContent = "Actualiser mes commandes";
  });

  db.auth.onAuthStateChange(() => {
    loadPayments();
  });

  loadPayments();

  console.log("GLOBEXA CODE 20 : Suivi des paiements chargé.");
})();

/* =========================================================
   GLOBEXA — CODE 21 : MOYENS DE RÉCEPTION DES FOURNISSEURS
   ========================================================= */

(() => {
  "use strict";

  const db = window.globexaSupabase;

  if (!db || document.getElementById("globexa-supplier-payouts")) {
    console.error("CODE 21 : Supabase indisponible ou code déjà chargé.");
    return;
  }

  const root = document.createElement("section");
  root.id = "globexa-supplier-payouts";
  root.style.cssText =
    "margin:25px 0;padding:20px;background:#f4f7fb;" +
    "border:1px solid #dce5ef;border-radius:12px;" +
    "font-family:Arial,sans-serif;color:#17324d;";

  const style = document.createElement("style");
  style.textContent = `
    #globexa-supplier-payouts * { box-sizing:border-box; }
    #globexa-supplier-payouts h2 { color:#123f75; }
    #globexa-supplier-payouts .g21-card {
      background:white;border:1px solid #dce5ef;
      border-radius:10px;padding:14px;margin:12px 0;
    }
    #globexa-supplier-payouts .g21-field {
      display:block;width:100%;padding:12px;margin:8px 0 14px;
      border:1px solid #cbd5e1;border-radius:7px;
      background:white;color:#17324d;
    }
    #globexa-supplier-payouts button {
      border:0;border-radius:7px;padding:11px 15px;
      background:#123f75;color:white;font-weight:bold;
      cursor:pointer;margin:5px 5px 5px 0;
    }
    #globexa-supplier-payouts button:disabled {
      opacity:.6;cursor:wait;
    }
    #globexa-supplier-payouts .g21-muted {
      color:#64748b;font-size:13px;
    }
    #globexa-supplier-payouts .g21-status {
      display:inline-block;padding:5px 10px;
      border-radius:20px;background:#fff0dc;
      color:#9a4c00;font-size:12px;font-weight:bold;
    }
    #globexa-supplier-payouts .g21-approved {
      background:#dcfce7;color:#166534;
    }
    #globexa-supplier-payouts .g21-rejected {
      background:#fee2e2;color:#991b1b;
    }
    #globexa-supplier-payouts .g21-danger {
      background:#991b1b;
    }
  `;

  root.appendChild(style);

  const heading = document.createElement("h2");
  heading.textContent = "Mes moyens de réception";

  const intro = document.createElement("p");
  intro.textContent =
    "Ajoutez un moyen de réception pour recevoir vos versements GLOBEXA.";

  const notice = document.createElement("p");
  notice.className = "g21-muted";
  notice.textContent = "Vérification de votre compte...";

  const form = document.createElement("form");
  form.className = "g21-card";
  form.hidden = true;

  const formHeading = document.createElement("h3");
  formHeading.textContent = "Ajouter un moyen de réception";

  function fieldLabel(text) {
    const label = document.createElement("label");
    label.textContent = text;
    return label;
  }

  const method = document.createElement("select");
  method.className = "g21-field";
  method.required = true;

  [
    ["", "Choisir un moyen de réception"],
    ["visa", "Carte Visa — via un prestataire compatible"],
    ["mastercard", "Carte Mastercard — via un prestataire compatible"],
    ["paypal", "PayPal"],
    ["alipay", "Alipay"],
    ["bank_transfer", "Virement bancaire"]
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    method.appendChild(option);
  });

  const holder = document.createElement("input");
  holder.className = "g21-field";
  holder.required = true;
  holder.maxLength = 120;
  holder.placeholder = "Nom du titulaire du compte";

  const reference = document.createElement("input");
  reference.className = "g21-field";
  reference.required = true;
  reference.maxLength = 255;
  reference.placeholder = "Adresse ou référence du compte";

  const bank = document.createElement("input");
  bank.className = "g21-field";
  bank.maxLength = 120;
  bank.placeholder = "Nom de la banque (si nécessaire)";

  const country = document.createElement("input");
  country.className = "g21-field";
  country.maxLength = 100;
  country.placeholder = "Pays";

  const currency = document.createElement("input");
  currency.className = "g21-field";
  currency.maxLength = 10;
  currency.placeholder = "Devise (ex. XOF, EUR, USD)";

  const warning = document.createElement("p");
  warning.className = "g21-muted";
  warning.textContent =
    "Ne saisissez jamais votre code PIN, CVV, mot de passe ou numéro complet de carte. " +
    "Pour Visa et Mastercard, utilisez uniquement une référence sécurisée fournie par votre prestataire.";

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Envoyer pour approbation";

  form.append(
    formHeading,
    fieldLabel("Moyen de réception"),
    method,
    fieldLabel("Nom du titulaire"),
    holder,
    fieldLabel("Adresse ou référence du compte"),
    reference,
    fieldLabel("Banque"),
    bank,
    fieldLabel("Pays"),
    country,
    fieldLabel("Devise"),
    currency,
    warning,
    submit
  );

  const listHeading = document.createElement("h3");
  listHeading.textContent = "Mes demandes";

  const list = document.createElement("div");

  const adminPanel = document.createElement("div");
  adminPanel.hidden = true;

  const adminHeading = document.createElement("h3");
  adminHeading.textContent = "Administration — demandes fournisseurs";

  const adminList = document.createElement("div");
  adminPanel.append(adminHeading, adminList);

  root.append(
    heading,
    intro,
    notice,
    form,
    listHeading,
    list,
    adminPanel
  );

  const anchor =
    document.querySelector("#globexa-payment-center") ||
    document.querySelector("#globexa-disputes") ||
    document.querySelector("main") ||
    document.body;

  anchor.insertAdjacentElement("afterend", root);

  let currentUser = null;
  let isAdmin = false;

  const methodLabels = {
    visa: "Visa",
    mastercard: "Mastercard",
    paypal: "PayPal",
    alipay: "Alipay",
    bank_transfer: "Virement bancaire"
  };

  const statusLabels = {
    pending: "En attente de validation",
    approved: "Approuvé",
    rejected: "Refusé",
    disabled: "Désactivé"
  };

  function element(tag, text, className) {
    const item = document.createElement(tag);
    if (text !== undefined) item.textContent = text;
    if (className) item.className = className;
    return item;
  }

  function statusClass(status) {
    if (status === "approved") return "g21-status g21-approved";
    if (status === "rejected" || status === "disabled") {
      return "g21-status g21-rejected";
    }
    return "g21-status";
  }

  function displayMethod(item) {
    const card = element("article", undefined, "g21-card");

    card.append(
      element("strong", methodLabels[item.method_code] || item.method_code),
      element("p", "Titulaire : " + item.account_holder),
      element("p", "Référence : " + item.account_reference),
      element("p", "Pays : " + (item.country || "Non renseigné")),
      element("p", "Devise : " + (item.currency || "Non renseignée")),
      element("span", statusLabels[item.status] || item.status, statusClass(item.status))
    );

    if (item.bank_name) {
      card.append(element("p", "Banque : " + item.bank_name));
    }

    if (item.admin_note) {
      card.append(
        element("p", "Note de l'administration : " + item.admin_note)
      );
    }

    return card;
  }

  async function loadSupplierMethods() {
    list.replaceChildren();

    const { data, error } = await db
      .from("globexa_supplier_payout_methods")
      .select(
        "id,method_code,account_holder,account_reference,bank_name," +
        "country,currency,status,admin_note,created_at"
      )
      .eq("supplier_user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("CODE 21 — chargement fournisseur :", error);
      list.append(element("p", "Impossible de charger vos demandes."));
      return;
    }

    if (!data || !data.length) {
      list.append(element("p", "Aucun moyen de réception enregistré."));
      return;
    }

    data.forEach(item => list.appendChild(displayMethod(item)));
  }

  async function loadAdminRequests() {
    adminList.replaceChildren();

    const { data, error } = await db
      .from("globexa_supplier_payout_methods")
      .select(
        "id,supplier_user_id,method_code,account_holder,account_reference," +
        "bank_name,country,currency,status,admin_note,created_at"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) {
      console.error("CODE 21 — demandes administration :", error);
      adminList.append(
        element("p", "Impossible de charger les demandes.")
      );
      return;
    }

    if (!data || !data.length) {
      adminList.append(element("p", "Aucune demande en attente."));
      return;
    }

    data.forEach(item => {
      const card = displayMethod(item);

      card.append(
        element("p", "Identifiant fournisseur : " + item.supplier_user_id)
      );

      const note = document.createElement("input");
      note.className = "g21-field";
      note.maxLength = 500;
      note.placeholder = "Note facultative pour le fournisseur";

      const approve = element("button", "Approuver");
      const reject = element("button", "Refuser", "g21-danger");

      approve.addEventListener("click", () =>
        decideRequest(item.id, "approved", note.value.trim(), approve)
      );

      reject.addEventListener("click", () =>
        decideRequest(item.id, "rejected", note.value.trim(), reject)
      );

      card.append(note, approve, reject);
      adminList.appendChild(card);
    });
  }

  async function decideRequest(id, status, adminNote, button) {
    if (!isAdmin) return;

    button.disabled = true;

    const { error } = await db
      .from("globexa_supplier_payout_methods")
      .update({
        status,
        admin_note: adminNote || null,
        approved_by: status === "approved" ? currentUser.id : null,
        approved_at: status === "approved" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("status", "pending");

    button.disabled = false;

    if (error) {
      console.error("CODE 21 — décision admin :", error);
      notice.textContent = "Impossible d'enregistrer cette décision.";
      return;
    }

    notice.textContent =
      status === "approved"
        ? "Moyen de réception approuvé."
        : "Demande refusée.";

    await loadAdminRequests();
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (!currentUser || isAdmin) return;

    const methodCode = method.value;
    const accountHolder = holder.value.trim();
    const accountReference = reference.value.trim();

    if (!methodCode || !accountHolder || accountReference.length < 3) {
      notice.textContent = "Veuillez remplir correctement les champs obligatoires.";
      return;
    }

    submit.disabled = true;
    submit.textContent = "Envoi en cours...";

    const { error } = await db
      .from("globexa_supplier_payout_methods")
      .insert({
        supplier_user_id: currentUser.id,
        method_code: methodCode,
        account_holder: accountHolder,
        account_reference: accountReference,
        bank_name: bank.value.trim() || null,
        country: country.value.trim() || null,
        currency: currency.value.trim().toUpperCase() || null,
        status: "pending"
      });

    submit.disabled = false;
    submit.textContent = "Envoyer pour approbation";

    if (error) {
      console.error("CODE 21 — ajout du moyen :", error);
      notice.textContent =
        "Enregistrement impossible. Vérifiez que votre boutique est active et réessayez.";
      return;
    }

    form.reset();
    notice.textContent =
      "Votre demande a été envoyée. Elle attend l'approbation de l'administrateur.";

    await loadSupplierMethods();
  });

  async function initialize() {
    const auth = await db.auth.getUser();

    if (auth.error || !auth.data.user) {
      currentUser = null;
      form.hidden = true;
      notice.textContent = "Connectez-vous pour gérer vos moyens de réception.";
      list.replaceChildren(element("p", "Connexion nécessaire."));
      adminPanel.hidden = true;
      return;
    }

    currentUser = auth.data.user;

    const adminCheck = await db.rpc("is_globexa_admin");
    isAdmin = !adminCheck.error && adminCheck.data === true;

    if (isAdmin) {
      form.hidden = true;
      adminPanel.hidden = false;
      notice.textContent = "Espace administrateur : validation des moyens fournisseurs.";
      listHeading.hidden = true;
      list.hidden = true;
      await loadAdminRequests();
      return;
    }

    form.hidden = false;
    adminPanel.hidden = true;
    listHeading.hidden = false;
    list.hidden = false;
    notice.textContent =
      "Ajoutez vos coordonnées. Elles seront vérifiées avant toute utilisation.";

    await loadSupplierMethods();
  }

  db.auth.onAuthStateChange(() => {
    initialize();
  });

  initialize();

  console.log("GLOBEXA CODE 21 : Moyens de réception fournisseurs chargé.");
})();

/* =========================================================
   GLOBEXA — CODE 22 : AFFICHAGE APPROBATION AUTOMATIQUE
   ========================================================= */

(() => {
  "use strict";

  const root = document.getElementById("globexa-supplier-payouts");

  if (!root || root.dataset.code22 === "loaded") return;
  root.dataset.code22 = "loaded";

  const notice = root.querySelector("p.g21-muted");
  const submit = root.querySelector('button[type="submit"]');

  if (submit) {
    submit.textContent = "Ajouter mon moyen de réception";
  }

  if (notice) {
    const updateNotice = () => {
      if (
        notice.textContent.includes("attend l'approbation") ||
        notice.textContent.includes("vérifiées avant")
      ) {
        notice.textContent =
          "Votre moyen autorisé est approuvé automatiquement après son enregistrement.";
      }
    };

    updateNotice();

    const observer = new MutationObserver(updateNotice);
    observer.observe(notice, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  const intro = root.querySelector("p");
  if (intro) {
    intro.textContent =
      "Ajoutez un moyen de réception autorisé. Son approbation est automatique.";
  }

  console.log("GLOBEXA CODE 22 : Affichage automatique activé.");
})();

/* =========================================================
   GLOBEXA — CODE 23 : FOURNISSEURS DUBAÏ, CHINE ET TURQUIE
   ========================================================= */

(() => {
  "use strict";

  if (window.globexaCode23Loaded) return;
  window.globexaCode23Loaded = true;

  const target = document.getElementById("productList");
  const status = document.getElementById("productStatus");

  if (!target || !status) {
    console.error("GLOBEXA CODE 23 : Catalogue introuvable.");
    return;
  }

  const originalRenderProducts = renderProducts;

  const filterBox = document.createElement("div");
  filterBox.id = "globexa-country-filter";
  filterBox.style.cssText =
    "display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:15px 0;";

  const label = document.createElement("label");
  label.textContent = "Fournisseurs par pays :";
  label.style.fontWeight = "600";

  const select = document.createElement("select");
  select.id = "globexa-country-select";
  select.style.cssText =
    "padding:11px;border:1px solid #d0d7e2;border-radius:8px;max-width:100%;";

  [
    ["all", "Tous les pays"],
    ["uae", "Dubaï 🇦🇪 — Émirats arabes unis"],
    ["china", "Chine 🇨🇳"],
    ["turkey", "Turquie 🇹🇷"]
  ].forEach(([value, text]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
  });

  filterBox.append(label, select);
  target.parentNode.insertBefore(filterBox, target);

  function getStore(product) {
    return Array.isArray(product.store)
      ? product.store[0]
      : product.store;
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function matchesCountry(product, country) {
    if (country === "all") return true;

    const store = getStore(product) || {};
    const location = normalize(
      (store.country || "") + " " + (store.city || "")
    );

    if (country === "uae") {
      return /united arab emirates|uae|emirats arabes unis|dubai|dubaï/.test(location);
    }

    if (country === "china") {
      return /china|chine|中国/.test(location);
    }

    if (country === "turkey") {
      return /turkey|turkiye|turquie/.test(location);
    }

    return true;
  }

  renderProducts = function(items) {
    const selectedCountry = select.value;
    const filtered = (items || []).filter(product =>
      matchesCountry(product, selectedCountry)
    );

    originalRenderProducts(filtered);

    if (!filtered.length && selectedCountry !== "all") {
      status.textContent =
        "Aucun produit publié trouvé pour ce pays pour le moment.";
    }
  };

  loadProducts = async function(categoryId = null) {
    status.textContent = "Chargement des produits...";

    let query = db
      .from("globexa_market_products")
      .select(
        "id,title,description,currency,base_price,moq,stock_quantity,images,category_id,store:globexa_stores(company_name,country,city)"
      )
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(80);

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    const { data, error } = await query;

    if (error) {
      status.textContent = "Erreur de chargement du catalogue.";
      console.error("GLOBEXA CODE 23 :", error);
      return;
    }

    products = data || [];
    renderProducts(products);
  };

  select.addEventListener("change", () => {
    renderProducts(products);
  });

  console.log(
    "GLOBEXA CODE 23 : Filtres Dubaï, Chine et Turquie activés."
  );
})();

/* =========================================================
   GLOBEXA — CODE 24 : AFFICHAGE DES VILLES FOURNISSEURS
   ========================================================= */

(() => {
  "use strict";

  if (window.globexaCode24Loaded) return;
  window.globexaCode24Loaded = true;

  if (typeof renderProducts !== "function") {
    console.error("GLOBEXA CODE 24 : Catalogue indisponible.");
    return;
  }

  const previousRender = renderProducts;

  renderProducts = function(items) {
    previousRender(items);

    const cards = document.querySelectorAll(
      "#productList .product-card"
    );

    (items || []).forEach((product, index) => {
      const store = Array.isArray(product.store)
        ? product.store[0]
        : product.store;

      if (!store || !store.city) return;

      const info = cards[index]?.querySelector(".product-info");
      if (!info || info.querySelector(".globexa-supplier-city")) return;

      const city = document.createElement("div");
      city.className = "muted globexa-supplier-city";
      city.textContent = "Ville du fournisseur : " + store.city;

      info.appendChild(city);
    });
  };

  console.log(
    "GLOBEXA CODE 24 : Affichage des villes activé."
  );
})();

/* =========================================================
   GLOBEXA — CODE 25 : RECHERCHE DES FOURNISSEURS
   ========================================================= */

(() => {
  "use strict";

  if (window.globexaCode25Loaded) return;
  window.globexaCode25Loaded = true;

  const target = document.getElementById("supplierList");

  if (!target || !window.globexaSupabase) {
    console.error("GLOBEXA CODE 25 : Annuaire indisponible.");
    return;
  }

  const db = window.globexaSupabase;
  let allStores = [];

  const controls = document.createElement("div");
  controls.style.cssText =
    "display:flex;flex-wrap:wrap;gap:10px;margin:15px 0;";

  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Rechercher un fournisseur, une ville...";
  search.setAttribute("aria-label", "Rechercher un fournisseur");
  search.style.cssText =
    "flex:1;min-width:190px;padding:12px;border:1px solid #ccd5df;border-radius:8px;";

  const country = document.createElement("select");
  country.style.cssText =
    "flex:1;min-width:190px;padding:12px;border:1px solid #ccd5df;border-radius:8px;";

  [
    ["all", "Tous les pays"],
    ["uae", "Dubaï 🇦🇪"],
    ["china", "Chine 🇨🇳"],
    ["turkey", "Turquie 🇹🇷"]
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    country.appendChild(option);
  });

  controls.append(search, country);
  target.parentNode.insertBefore(controls, target);

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function matchesStore(store) {
    const term = normalize(search.value);
    const location = normalize(
      (store.country || "") + " " + (store.city || "")
    );

    const searchable = normalize(
      (store.company_name || "") + " " +
      (store.description || "") + " " +
      (store.city || "") + " " +
      (store.country || "")
    );

    if (term && !searchable.includes(term)) return false;

    if (country.value === "uae") {
      return /united arab emirates|uae|emirats arabes unis|dubai/.test(location);
    }

    if (country.value === "china") {
      return /china|chine|中国/.test(location);
    }

    if (country.value === "turkey") {
      return /turkey|turkiye|turquie/.test(location);
    }

    return true;
  }

  function renderDirectory() {
    target.replaceChildren();

    const results = allStores.filter(matchesStore);

    if (!results.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent =
        "Aucun fournisseur ne correspond à cette recherche pour le moment.";
      target.appendChild(empty);
      return;
    }

    results.forEach(store => {
      const card = document.createElement("article");
      card.className = "supplier-card";

      const name = document.createElement("h3");
      name.textContent = store.company_name || "Fournisseur GLOBEXA";

      const location = document.createElement("p");
      location.className = "muted";
      location.textContent =
        [store.city, store.country].filter(Boolean).join(", ") ||
        "Localisation non renseignée";

      const description = document.createElement("p");
      description.textContent =
        store.description || "Boutique professionnelle GLOBEXA.";

      card.append(name, location, description);
      target.appendChild(card);
    });
  }

  loadSuppliers = async function() {
    target.textContent = "Chargement des fournisseurs...";

    const { data, error } = await db
      .from("globexa_stores")
      .select("id,company_name,country,city,description")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      target.textContent = "Impossible de charger les fournisseurs.";
      console.error("GLOBEXA CODE 25 :", error);
      return;
    }

    allStores = data || [];
    renderDirectory();
  };

  search.addEventListener("input", renderDirectory);
  country.addEventListener("change", renderDirectory);

  loadSuppliers();

  console.log("GLOBEXA CODE 25 : Annuaire international activé.");
})();

/* =========================================================
   GLOBEXA — CODE 26 : RECHERCHE INTELLIGENTE INTERNATIONALE
   ========================================================= */

(() => {
  "use strict";

  if (window.globexaCode26Loaded) return;
  window.globexaCode26Loaded = true;

  const form = document.getElementById("searchForm");
  const input = document.getElementById("searchInput");

  if (!form || !input || typeof renderProducts !== "function") {
    console.error("GLOBEXA CODE 26 : Recherche introuvable.");
    return;
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function searchProducts() {
    const term = normalize(input.value);

    if (!term) {
      renderProducts(products);
      return;
    }

    const results = products.filter(product => {
      const store = Array.isArray(product.store)
        ? product.store[0]
        : product.store || {};

      const searchable = normalize([
        product.title,
        product.description,
        product.category_name,
        store.company_name,
        store.country,
        store.city
      ].join(" "));

      return searchable.includes(term);
    });

    renderProducts(results);
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    searchProducts();
  }, true);

  input.addEventListener("input", searchProducts);

  console.log(
    "GLOBEXA CODE 26 : Recherche internationale activée."
  );
})();

/* =========================================================
   GLOBEXA — CODE 27 : FAVORIS DES ACHETEURS
   ========================================================= */

(() => {
  "use strict";

  if (window.globexaCode27Loaded) return;
  window.globexaCode27Loaded = true;

  const db = window.globexaSupabase;
  const productList = document.getElementById("productList");
  const productSection = document.getElementById("produits");

  if (!db || !productList || !productSection) {
    console.error("GLOBEXA CODE 27 : Catalogue indisponible.");
    return;
  }

  let user = null;
  let favoriteIds = new Set();
  let displayedProducts = [];

  const panel = document.createElement("section");
  panel.id = "globexa-favorites";
  panel.className = "section";
  panel.style.cssText =
    "margin:20px 0;padding:18px;background:#fff;" +
    "border:1px solid #e3e8ef;border-radius:10px;";

  const heading = document.createElement("h2");
  heading.textContent = "❤️ Mes produits favoris";

  const message = document.createElement("p");
  message.className = "muted";
  message.textContent = "Connectez-vous pour retrouver vos favoris.";

  const list = document.createElement("div");
  list.style.cssText = "display:grid;gap:10px;";

  panel.append(heading, message, list);
  productSection.insertAdjacentElement("afterend", panel);

  function showMessage(text, error = false) {
    message.textContent = text;
    message.style.color = error ? "#b42318" : "#176534";
  }

  function decorateProducts(items) {
    displayedProducts = items || [];

    const cards = productList.querySelectorAll(".product-card");

    displayedProducts.forEach((product, index) => {
      const card = cards[index];
      const info = card?.querySelector(".product-info");

      if (!info || info.querySelector(".g27-favorite")) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "g27-favorite";
      button.style.cssText =
        "width:100%;margin-top:8px;padding:10px;" +
        "border:1px solid #e3e8ef;border-radius:7px;" +
        "background:#fff;cursor:pointer;";

      function updateButton() {
        const saved = favoriteIds.has(product.id);
        button.textContent = saved
          ? "❤️ Retirer des favoris"
          : "♡ Ajouter aux favoris";
      }

      updateButton();

      button.addEventListener("click", async () => {
        if (!user) {
          showMessage("Connectez-vous pour enregistrer vos favoris.", true);
          return;
        }

        button.disabled = true;

        if (favoriteIds.has(product.id)) {
          const { error } = await db
            .from("globexa_favorites")
            .delete()
            .eq("user_id", user.id)
            .eq("product_id", product.id);

          if (error) {
            showMessage("Impossible de retirer ce favori.", true);
            console.error("CODE 27 :", error);
            button.disabled = false;
            return;
          }

          favoriteIds.delete(product.id);
          showMessage("Produit retiré de vos favoris.");
        } else {
          const { error } = await db
            .from("globexa_favorites")
            .insert({
              user_id: user.id,
              product_id: product.id
            });

          if (error) {
            showMessage("Impossible d'ajouter ce favori.", true);
            console.error("CODE 27 :", error);
            button.disabled = false;
            return;
          }

          favoriteIds.add(product.id);
          showMessage("Produit ajouté à vos favoris.");
        }

        updateButton();
        button.disabled = false;
        renderFavorites();
      });

      info.appendChild(button);
    });
  }

  async function renderFavorites() {
    list.replaceChildren();

    if (!user) {
      showMessage("Connectez-vous pour retrouver vos favoris.");
      return;
    }

    showMessage("Chargement de vos favoris...");

    const { data, error } = await db
      .from("globexa_favorites")
      .select(
        "product_id,product:globexa_market_products(id,title,base_price,currency,status)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      showMessage("Impossible de charger vos favoris.", true);
      console.error("CODE 27 :", error);
      return;
    }

    favoriteIds = new Set((data || []).map(item => item.product_id));

    const available = (data || []).filter(item => {
      const product = Array.isArray(item.product)
        ? item.product[0]
        : item.product;

      return product && product.status === "published";
    });

    if (!available.length) {
      showMessage("Vous n'avez pas encore de produit favori.");
    } else {
      showMessage(available.length + " produit(s) dans vos favoris.");

      available.forEach(item => {
        const product = Array.isArray(item.product)
          ? item.product[0]
          : item.product;

        const row = document.createElement("div");
        row.style.cssText =
          "display:flex;justify-content:space-between;" +
          "align-items:center;gap:10px;padding:12px;" +
          "border:1px solid #e3e8ef;border-radius:8px;";

        const details = document.createElement("div");

        const name = document.createElement("strong");
        name.textContent = product.title || "Produit";

        const price = document.createElement("p");
        price.className = "muted";
        price.textContent =
          Number(product.base_price || 0).toLocaleString("fr-FR") +
          " " + (product.currency || "USD");

        details.append(name, price);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Retirer";
        remove.addEventListener("click", async () => {
          remove.disabled = true;

          const { error: deleteError } = await db
            .from("globexa_favorites")
            .delete()
            .eq("user_id", user.id)
            .eq("product_id", product.id);

          if (deleteError) {
            showMessage("Impossible de retirer ce favori.", true);
            remove.disabled = false;
            return;
          }

          favoriteIds.delete(product.id);
          decorateProducts(displayedProducts);
          await renderFavorites();
        });

        row.append(details, remove);
        list.appendChild(row);
      });
    }

    decorateProducts(displayedProducts);
  }

  const previousRender = renderProducts;

  renderProducts = function(items) {
    previousRender(items);
    decorateProducts(items);
  };

  async function initializeFavorites() {
    const { data } = await db.auth.getUser();
    user = data?.user || null;

    favoriteIds.clear();

    if (user) {
      await renderFavorites();
    } else {
      list.replaceChildren();
      showMessage("Connectez-vous pour retrouver vos favoris.");
      decorateProducts(displayedProducts);
    }
  }

  db.auth.onAuthStateChange(() => {
    setTimeout(initializeFavorites, 0);
  });

  initializeFavorites();

  console.log("GLOBEXA CODE 27 : Favoris activés.");
})();

/* =========================================================
   GLOBEXA — CODE 28 : NOTIFICATIONS EN DIRECT
   ========================================================= */

(() => {
  "use strict";

  const db = window.globexaSupabase;

  if (!db || window.globexaCode28Loaded) return;
  window.globexaCode28Loaded = true;

  let channel = null;
  let activeUserId = null;
  let unreadCount = 0;
  let toastTimer = null;

  const toast = document.createElement("button");
  toast.type = "button";
  toast.id = "g28-live-alert";
  toast.style.cssText = `
    display:none;
    position:fixed;
    top:18px;
    right:16px;
    z-index:100000;
    max-width:min(340px,calc(100vw - 32px));
    padding:14px 18px;
    border:0;
    border-radius:10px;
    background:#123f75;
    color:white;
    text-align:left;
    font-weight:600;
    box-shadow:0 5px 20px #0003;
    cursor:pointer;
  `;
  document.body.appendChild(toast);

  function showAlert(notification) {
    toast.textContent =
      "🔔 " + (notification.title || "Nouvelle notification") +
      (notification.body ? " — " + notification.body : "");

    toast.style.display = "block";

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.style.display = "none";
    }, 7000);
  }

  toast.addEventListener("click", () => {
    toast.style.display = "none";

    const toggle = document.getElementById("g18-toggle");
    const panel = document.getElementById("g18-panel");

    if (toggle && panel && !panel.classList.contains("g18-open")) {
      toggle.click();
    }
  });

  async function connectNotifications() {
    const { data, error } = await db.auth.getUser();

    if (error || !data.user) {
      activeUserId = null;

      if (channel) {
        await db.removeChannel(channel);
        channel = null;
      }

      return;
    }

    const userId = data.user.id;

    if (activeUserId === userId && channel) return;

    if (channel) {
      await db.removeChannel(channel);
      channel = null;
    }

    activeUserId = userId;

    const { count, error: countError } = await db
      .from("globexa_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);

    if (!countError) {
      unreadCount = count || 0;

      const badge = document.getElementById("g18-count");
      if (badge) badge.textContent = String(unreadCount);
    }

    channel = db
      .channel("globexa-live-notifications-" + userId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "globexa_notifications",
          filter: "user_id=eq." + userId
        },
        payload => {
          const notification = payload.new;

          if (!notification || notification.user_id !== activeUserId) {
            return;
          }

          if (!notification.read_at) {
            unreadCount++;

            const badge = document.getElementById("g18-count");
            if (badge) badge.textContent = String(unreadCount);
          }

          showAlert(notification);
        }
      )
      .subscribe(status => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(
            "GLOBEXA CODE 28 : Connexion aux notifications interrompue."
          );
        }
      });
  }

  db.auth.onAuthStateChange(() => {
    setTimeout(connectNotifications, 0);
  });

  connectNotifications();

  console.log(
    "GLOBEXA CODE 28 : Notifications en direct activées."
  );
})();

/* =========================================================
   GLOBEXA — CODE 30 : CONTRÔLE ADMINISTRATEUR DES PAIEMENTS
   ========================================================= */

(() => {
  "use strict";

  const db = window.globexaSupabase;

  if (!db || window.globexaCode30Loaded) return;
  window.globexaCode30Loaded = true;

  const panel = document.createElement("section");
  panel.id = "globexa-admin-payment-readiness";
  panel.hidden = true;
  panel.style.cssText = [
    "margin:25px 0",
    "padding:20px",
    "background:#f4f7fb",
    "border:2px solid #123f75",
    "border-radius:12px",
    "font-family:Arial,sans-serif",
    "color:#17324d"
  ].join(";");

  const title = document.createElement("h2");
  title.textContent = "GLOBEXA — Contrôle des paiements";

  const description = document.createElement("p");
  description.textContent =
    "État des moyens de paiement proposés aux acheteurs.";

  const warning = document.createElement("p");
  warning.style.cssText =
    "padding:12px;background:#fff0dc;color:#8a4500;border-radius:8px;";
  warning.textContent =
    "Attention : un moyen activé dans la configuration ne prouve pas qu'un paiement réel fonctionne. Une intégration avec le prestataire reste nécessaire.";

  const status = document.createElement("p");
  status.textContent = "Vérification des moyens de paiement...";

  const list = document.createElement("div");

  panel.append(title, description, warning, status, list);
  document.body.appendChild(panel);

  function addLine(provider) {
    const card = document.createElement("article");
    card.style.cssText =
      "background:white;padding:13px;margin:10px 0;border-radius:8px;border:1px solid #dce5ef;";

    const name = document.createElement("strong");
    name.textContent = provider.display_name || provider.provider;

    const state = document.createElement("p");
    state.textContent = provider.is_enabled
      ? "Configuration activée"
      : "Désactivé";

    const currencies = document.createElement("p");
    currencies.textContent =
      "Devises configurées : " +
      ((provider.supported_currencies || []).join(", ") || "Aucune");

    const readiness = document.createElement("p");
    readiness.textContent = provider.readiness || "";

    card.append(name, state, currencies, readiness);
    list.appendChild(card);
  }

  async function loadAdminPaymentStatus() {
    panel.hidden = true;
    list.replaceChildren();

    const { data: auth, error: authError } = await db.auth.getUser();

    if (authError || !auth?.user) return;

    const { data, error } = await db.rpc(
      "globexa_admin_payment_readiness"
    );

    if (error) {
      console.info(
        "CODE 30 : accès administrateur non autorisé ou données indisponibles."
      );
      return;
    }

    panel.hidden = false;

    if (!data || !data.length) {
      status.textContent =
        "Aucun moyen de paiement acheteur configuré.";
      return;
    }

    status.textContent =
      "État des moyens de paiement :";

    data.forEach(addLine);
  }

  db.auth.onAuthStateChange(() => {
    setTimeout(loadAdminPaymentStatus, 0);
  });

  loadAdminPaymentStatus();

  console.log(
    "GLOBEXA CODE 30 : Contrôle administrateur des paiements chargé."
  );
})();
