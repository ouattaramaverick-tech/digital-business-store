
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

