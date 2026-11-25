
"use strict";

/* ==========================================
   GLOBEXA — CODE 6
   CENTRE FOURNISSEUR
   ========================================== */

let supplierCenterClient = null;

async function initializeSupplierClient() {
  supplierCenterClient = await window.globexaGetSupabaseClient();
  await loadSupplierCenter();
}

const supplierCenterState = {
  user: null,
  store: null,
  products: [],
  orders: []
};

function supplierText(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[c]);
}

function supplierMoney(amount, currency = "USD") {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency
    }).format(Number(amount || 0));
  } catch {
    return Number(amount || 0) + " " + currency;
  }
}

/* 1. CRÉER L'ESPACE FOURNISSEUR */

function createSupplierCenter() {
  if (document.getElementById("globexaSupplierCenter")) return;

  const style = document.createElement("style");
  style.textContent = `
    #globexaSupplierCenter {
      padding: 20px;
      margin: 20px auto;
      max-width: 1200px;
      color: #172554;
      font-family: Arial, sans-serif;
    }
    #globexaSupplierCenter .supplier-heading {
      background: linear-gradient(120deg,#123b83,#1765b5);
      color: white;
      padding: 24px;
      border-radius: 14px;
      margin-bottom: 20px;
    }
    #globexaSupplierCenter .supplier-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit,minmax(190px,1fr));
      gap: 14px;
      margin-bottom: 22px;
    }
    #globexaSupplierCenter .supplier-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px;
      box-shadow: 0 3px 12px rgba(0,0,0,.04);
    }
    #globexaSupplierCenter .supplier-card strong {
      display: block;
      font-size: 24px;
      margin-top: 8px;
      color: #1455a0;
    }
    #globexaSupplierCenter h3 {
      margin-top: 0;
    }
    #globexaSupplierCenter table {
      width: 100%;
      border-collapse: collapse;
      background: white;
    }
    #globexaSupplierCenter th,
    #globexaSupplierCenter td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
      text-align: left;
    }
    #globexaSupplierCenter .supplier-table-wrap {
      overflow-x: auto;
    }
    #globexaSupplierCenter .supplier-message {
      padding: 15px;
      background: #eff6ff;
      border-radius: 10px;
      margin: 12px 0;
    }
    #globexaSupplierCenter .supplier-refresh {
      background: #f28c28;
      color: white;
      border: 0;
      border-radius: 8px;
      padding: 12px 18px;
      cursor: pointer;
      font-weight: bold;
    }
  `;
  document.head.appendChild(style);

  const section = document.createElement("section");
  section.id = "globexaSupplierCenter";
  section.innerHTML = `
    <div class="supplier-heading">
      <h2>Centre fournisseur GLOBEXA</h2>
      <p>Gérez votre boutique, vos produits et vos commandes.</p>
    </div>

    <div id="supplierCenterMessage" class="supplier-message">
      Chargement de votre espace fournisseur...
    </div>

    <div id="supplierCenterContent"></div>
  `;

  const main = document.querySelector("main") ||
    document.querySelector("#app") ||
    document.querySelector(".container") ||
    document.body;

  main.appendChild(section);
}

/* 2. CHARGER LES INFORMATIONS */


async function loadSupplierCenter() {
  createSupplierCenter();

  const panel = document.getElementById("globexaSupplierCenter");
  const dashboard = document.getElementById("sellerDashboard");

  if (panel && dashboard && panel.parentElement !== dashboard) {
    dashboard.replaceChildren(panel);
  }

  if (!supplierCenterClient) {
    supplierCenterClient = await window.globexaGetSupabaseClient();
  }

  const message = document.getElementById("supplierCenterMessage");
  const content = document.getElementById("supplierCenterContent");

  const { data: authData, error: authError } =
    await supplierCenterClient.auth.getUser();

  if (authError || !authData.user) {
    message.textContent =
      "Connectez-vous pour accéder à votre espace fournisseur.";
    content.innerHTML = "";
    return;
  }

  supplierCenterState.user = authData.user;


  const userId = authData.user.id;

  const [storeResult, orderResult] = await Promise.all([
    supplierCenterClient
      .from("globexa_stores")
      .select(`
        id,
        owner_id,
        company_name,
        slug,
        country,
        city,
        description,
        logo_url,
        verification_status,
        status
      `)
      .eq("owner_id", userId)
      .maybeSingle(),

    supplierCenterClient
      .from("globexa_market_orders")
      .select(`
        id,
        product_id,
        quantity,
        unit_price,
        subtotal,
        supplier_amount,
        currency,
        status,
        payment_status,
        created_at
      `)
      .eq("supplier_id", userId)
      .order("created_at", { ascending: false })
      .limit(100)
  ]);

  if (storeResult.error) {
    message.textContent =
      "Impossible de charger votre boutique. Vérifiez vos autorisations.";
    content.innerHTML = "";
    return;
  }

  supplierCenterState.store = storeResult.data;
  supplierCenterState.orders = orderResult.error
    ? []
    : (orderResult.data || []);

  if (supplierCenterState.store) {
    const productResult = await supplierCenterClient
      .from("globexa_market_products")
      .select(`
        id,
        title,
        base_price,
        currency,
        stock_quantity,
        moq,
        status,
        created_at
      `)
      .eq("store_id", supplierCenterState.store.id)
      .order("created_at", { ascending: false });

    supplierCenterState.products = productResult.error
      ? []
      : (productResult.data || []);
  } else {
    supplierCenterState.products = [];
  }

  message.textContent = supplierCenterState.store
    ? "Bienvenue dans votre espace fournisseur."
    : "Aucune boutique n'est encore associée à votre compte.";

  renderSupplierCenter();
  window.globexaAddSupplierButtons?.();
}
window.loadSupplierCenter = loadSupplierCenter;

/* 3. AFFICHER LE TABLEAU DE BORD */

function renderSupplierCenter() {
  const content = document.getElementById("supplierCenterContent");
  if (!content) return;

  const store = supplierCenterState.store;
  const products = supplierCenterState.products;
  const orders = supplierCenterState.orders;

  if (!store) {
    content.innerHTML = `
      <div class="supplier-card">
        <h3>Votre boutique</h3>
        <p>Votre compte ne possède pas encore de boutique fournisseur.</p>
        <p>
          Vous devez d'abord créer ou faire associer une boutique
          à votre compte pour gérer vos produits.
        </p>
      </div>
    `;
    return;
  }

  const totalOrders = orders.length;

  const totalSales = orders.reduce(
    (sum, order) => sum + Number(order.subtotal || 0), 0
  );

  const supplierEarnings = orders.reduce(
    (sum, order) => sum + Number(order.supplier_amount || 0), 0
  );

  const pendingProducts = products.filter(
    product => product.status !== "published"
  ).length;

  content.innerHTML = `
    <div class="supplier-grid">
      <div class="supplier-card">
        Produits
        <strong>${products.length}</strong>
      </div>

      <div class="supplier-card">
        Produits en attente ou non publiés
        <strong>${pendingProducts}</strong>
      </div>

      <div class="supplier-card">
        Commandes affichées
        <strong>${totalOrders}</strong>
      </div>

      <div class="supplier-card">
        Montant des commandes
        <strong>${supplierMoney(
          totalSales,
          orders[0]?.currency || "USD"
        )}</strong>
      </div>

      <div class="supplier-card">
        Part fournisseur enregistrée
        <strong>${supplierMoney(
          supplierEarnings,
          orders[0]?.currency || "USD"
        )}</strong>
      </div>
    </div>

        <div class="supplier-card">
      <h3>Ma boutique</h3>
      <p><strong>${supplierText(store.company_name)}</strong></p>
      <p>Ville : ${supplierText(store.city || "Non précisée")}</p>
      <p>Pays : ${supplierText(store.country || "Non précisé")}</p>
      <p>Statut : ${supplierText(store.status || "Non précisé")}</p>
      <p>Vérification : ${supplierText(
        store.verification_status || "Non précisée"
      )}</p>

      <button
        type="button"
        class="supplier-refresh"
        id="supplierStoreDetailsButton">
        Voir les détails de mon entreprise
      </button>

      <div id="supplierStoreDetails" hidden>
        <hr>
        <p><strong>Description :</strong></p>
        <p>${supplierText(store.description || "Aucune description enregistrée.")}</p>
        <p><strong>Adresse :</strong> ${supplierText(store.address || "Non précisée")}</p>
        <p><strong>Téléphone :</strong> ${supplierText(store.phone || "Non précisé")}</p>
        <p><strong>Identifiant boutique :</strong> ${supplierText(store.slug || "Non précisé")}</p>
      </div>
    </div>

    <br>

    <div class="supplier-card">
      <h3>Mes produits</h3>
      <div class="supplier-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Produit</th>
              <th>Prix</th>
              <th>Stock</th>
              <th>Minimum</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            ${products.length ? products.map(product => `
              <tr>
                <td>${supplierText(product.title)}</td>
                <td>${supplierMoney(
                  product.base_price,
                  product.currency
                )}</td>
                <td>${Number(product.stock_quantity || 0)}</td>
                <td>${Number(product.moq || 1)}</td>
                <td>${supplierText(product.status)}</td>
              </tr>
            `).join("") : `
              <tr>
                <td colspan="5">Aucun produit enregistré.</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>

    <br>

    <div class="supplier-card">
      <h3>Mes commandes</h3>
      <div class="supplier-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Référence</th>
              <th>Quantité</th>
              <th>Total</th>
              <th>Paiement</th>
              <th>Statut</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${orders.length ? orders.map(order => `
              <tr>
                <td>${supplierText(order.id.slice(0, 8))}</td>
                <td>${Number(order.quantity || 0)}</td>
                <td>${supplierMoney(
                  order.subtotal,
                  order.currency
                )}</td>
                <td>${supplierText(order.payment_status || "Non précisé")}</td>
                <td>${supplierText(order.status || "Non précisé")}</td>
                <td>${order.created_at
                  ? new Date(order.created_at).toLocaleDateString("fr-FR")
                  : "—"}</td>
              </tr>
            `).join("") : `
              <tr>
                <td colspan="6">Aucune commande disponible.</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>

    <br>

    <button
      type="button"
      class="supplier-refresh"
      id="supplierCenterRefresh">
      Actualiser mes informations
    </button>
  `;

  document.getElementById("supplierCenterRefresh")
    ?.addEventListener("click", loadSupplierCenter);
}

/* 4. DÉMARRAGE */

function startGlobexaSupplierCenter() {
  if (!document.body) return;
  initializeSupplierClient();
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    startGlobexaSupplierCenter,
    { once: true }
  );
} else {
  startGlobexaSupplierCenter();
}

console.log("GLOBEXA CODE 6 chargé.");
/* GLOBEXA — CORRECTIFS DES BOUTONS ET TABLEAUX DE BORD */
(function () {
  "use strict";

  function moveSupplierPanel() {
    const panel = document.getElementById("globexaSupplierCenter");
    const dashboard = document.getElementById("sellerDashboard");

    if (panel && dashboard && panel.parentElement !== dashboard) {
      dashboard.replaceChildren(panel);
    }
  }

  async function createStore(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);
    const button = form.querySelector("button");
    const feedback = document.getElementById("gxStoreMessage");

    const company = String(data.get("company_name") || "").trim();
    const country = String(data.get("country") || "").trim();

    if (!supplierCenterState.user || company.length < 2 || !country) {
      feedback.textContent = "Connexion, nom de boutique et pays obligatoires.";
      return;
    }

    button.disabled = true;
    button.textContent = "Création en cours...";

    try {
      const slug = company
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        + "-" + crypto.randomUUID().slice(0, 8);

      const { error } = await supplierCenterClient
        .from("globexa_stores")
        .insert({
          owner_id: supplierCenterState.user.id,
          company_name: company,
          slug: slug,
          country: country,
          city: String(data.get("city") || "").trim() || null,
          description: String(data.get("description") || "").trim() || null,
          status: "pending",
          verification_status: "pending"
        });

      if (error) throw error;

      feedback.textContent =
        "Boutique créée. Elle attend la validation de GLOBEXA.";

      await window.loadSupplierCenter();
      moveSupplierPanel();

    } catch (error) {
      feedback.textContent = error.message || "Création impossible.";
      button.disabled = false;
      button.textContent = "Créer ma boutique";
    }
  }

  
async function createProduct(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);
  const button = form.querySelector("button");
  const feedback = document.getElementById("gxProductMessage");

  const title = String(data.get("title") || "").trim();
  const price = Number(data.get("price"));
  const stock = Number(data.get("stock"));
  const moq = Number(data.get("moq"));
  const currency = String(data.get("currency") || "USD");
  const imageFile = data.get("product_image");

  if (!supplierCenterState.store ||
      supplierCenterState.store.status !== "active") {
    feedback.textContent =
      "Votre boutique doit être activée avant d'ajouter des produits.";
    return;
  }

  if (
    title.length < 2 ||
    !Number.isFinite(price) ||
    price <= 0 ||
    !Number.isInteger(stock) ||
    stock < 0 ||
    !Number.isInteger(moq) ||
    moq < 1
  ) {
    feedback.textContent = "Vérifiez les informations du produit.";
    return;
  }

  const allowedTypes = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };

  if (!imageFile || !allowedTypes[imageFile.type]) {
    feedback.textContent = "Choisissez une photo JPG, PNG ou WebP.";
    return;
  }

  if (imageFile.size > 5 * 1024 * 1024) {
    feedback.textContent = "La photo ne doit pas dépasser 5 Mo.";
    return;
  }

  button.disabled = true;
  button.textContent = "Envoi de la photo...";

  try {
    const extension = allowedTypes[imageFile.type];
    const imagePath =
      supplierCenterState.user.id + "/" +
      crypto.randomUUID() + "." + extension;

    const { error: uploadError } =
      await supplierCenterClient.storage
        .from("globexa-product-images")
        .upload(imagePath, imageFile, {
          contentType: imageFile.type,
          upsert: false
        });

    if (uploadError) throw uploadError;

    const { data: imageData } =
      supplierCenterClient.storage
        .from("globexa-product-images")
        .getPublicUrl(imagePath);

    const imageUrl = imageData.publicUrl;

    button.textContent = "Enregistrement du produit...";

    const { error } = await supplierCenterClient
      .from("globexa_market_products")
      .insert({
        store_id: supplierCenterState.store.id,
        title: title,
        description:
          String(data.get("description") || "").trim() || null,
        base_price: price,
        currency: currency,
        stock_quantity: stock,
        moq: moq,
        country_of_origin:
          String(data.get("origin") || "").trim() || null,
        images: [imageUrl],
        status: "pending"
      });

    if (error) throw error;

    feedback.textContent =
      "Produit et photo envoyés. En attente de validation.";

    form.reset();
    await window.loadSupplierCenter();
    moveSupplierPanel();

  } catch (error) {
    console.error("GLOBEXA - Erreur ajout produit :", error);
    feedback.textContent =
      error.message || "Erreur pendant l'ajout du produit.";
    button.disabled = false;
    button.textContent = "Envoyer le produit";
  }
}

      async function updateSupplierOrder(button) {
    button.disabled = true;

    try {
      const { error } = await supplierCenterClient.rpc(
        "globexa_supplier_update_order_status",
        {
          p_order_id: button.dataset.orderId,
          p_new_status: button.dataset.nextStatus
        }
      );

      if (error) throw error;

      await window.loadSupplierCenter();
      moveSupplierPanel();

    } catch (error) {
      alert(error.message || "Mise à jour impossible.");
      button.disabled = false;
    }
      }

  function addSupplierButtons() {
    moveSupplierPanel();

    const content = document.getElementById("supplierCenterContent");
    if (!content) return;

    const store = supplierCenterState.store;

    if (!store) {
      if (document.getElementById("gxStoreForm")) return;

      const form = document.createElement("form");
      form.id = "gxStoreForm";
      form.className = "supplier-card form-box";

      form.innerHTML = `
        <h3>Créer ma boutique</h3>

        <label>Nom de la boutique *</label>
        <input name="company_name" required minlength="2" maxlength="120">

        <label>Pays *</label>
        <input name="country" required maxlength="80">

        <label>Ville</label>
        <input name="city" maxlength="80">

        <label>Description</label>
        <textarea name="description" maxlength="1500"></textarea>

        <button type="submit">Créer ma boutique</button>
        <p id="gxStoreMessage" role="status"></p>
      `;

      content.appendChild(form);
      form.addEventListener("submit", createStore);
      return;
    }

    if (store.status === "active" &&
        !document.getElementById("gxProductForm")) {

      const form = document.createElement("form");
      form.id = "gxProductForm";
      form.className = "supplier-card form-box";

      form.innerHTML = `
        <h3>Ajouter un produit</h3>

        <label>Nom du produit *</label>
        <input name="title" required minlength="2">

              <label>Photo du produit *</label>
        <input
          type="file"
          name="product_image"
          accept="image/jpeg,image/png,image/webp"
          required
        >
        <small>JPG, PNG ou WebP — maximum 5 Mo.</small>
        <label>Description</label>
        <textarea name="description"></textarea>

        <label>Prix *</label>
        <input name="price" type="number" min="0.01" step="0.01" required>

        <label>Devise</label>
        <select name="currency">
          <option>USD</option>
          <option>EUR</option>
          <option>XOF</option>
          <option>CNY</option>
        </select>

        <label>Stock *</label>
        <input name="stock" type="number" min="0" step="1" required>

        <label>Quantité minimale *</label>
        <input name="moq" type="number" min="1" step="1" value="1" required>

        <label>Pays d'origine</label>
        <input name="origin">

        <button type="submit">Envoyer le produit</button>
        <p id="gxProductMessage" role="status"></p>
      `;

      content.appendChild(form);
      form.addEventListener("submit", createProduct);
    }

    const tables = Array.from(content.querySelectorAll("table"));
    const orderTable = tables.find(table =>
      table.textContent.includes("Paiement")
    );

    if (orderTable && !orderTable.dataset.actionsAdded) {
      const heading = orderTable.querySelector("thead tr");

      if (heading) {
        const th = document.createElement("th");
        th.textContent = "Action";
        heading.appendChild(th);
      }

      Array.from(orderTable.querySelectorAll("tbody tr"))
        .forEach((row, index) => {
          const order = supplierCenterState.orders[index];

          const next = order
            ? order.status === "paid" ? "processing"
            : order.status === "processing" ? "shipped"
            : order.status === "shipped" ? "delivered"
            : null
            : null;

          const cell = document.createElement("td");

          if (next) {
            const button = document.createElement("button");
            button.type = "button";

            button.textContent =
              next === "processing" ? "Préparer"
              : next === "shipped" ? "Expédiée"
              : "Livrée";

            button.dataset.orderId = order.id;
            button.dataset.nextStatus = next;

            button.addEventListener("click", () =>
              updateSupplierOrder(button)
            );

            cell.appendChild(button);
          } else {
            cell.textContent = "—";
          }

          row.appendChild(cell);
        });

      orderTable.dataset.actionsAdded = "true";
    }
  }

 window.globexaAddSupplierButtons = addSupplierButtons; 
   const originalRender = window.renderSupplierCenter;

  if (typeof originalRender === "function") {
    window.renderSupplierCenter = function () {
      originalRender();
      addSupplierButtons();
    };
  }

  /* Correction du formulaire des comptes de réception fournisseur.
     La politique Supabase exige ces deux valeurs. */
  document.addEventListener("submit", async function (event) {
    const form = event.target;

    if (form.id !== "globexaSupplierPayoutForm") return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const data = new FormData(form);
    const message = document.getElementById("financeSupplierMessage");
    const button = form.querySelector("button");

    try {
      const { data: auth, error: authError } =
        await supabaseClient.auth.getUser();

      if (authError) throw authError;
      if (!auth.user) throw new Error("Connexion obligatoire.");

      button.disabled = true;

      const { error } = await supabaseClient
        .from("globexa_supplier_payout_methods")
        .insert({
          supplier_user_id: auth.user.id,
          method_code: String(data.get("method_code") || ""),
          account_holder: String(data.get("account_holder") || "").trim(),
          account_reference: String(data.get("account_reference") || "").trim(),
          bank_name: String(data.get("bank_name") || "").trim() || null,
          country: String(data.get("country") || "").trim() || null,
          currency: String(data.get("currency") || "").trim().toUpperCase() || null,
          status: "approved",
          approved_at: new Date().toISOString()
        });

      if (error) throw error;

      message.textContent = "Compte de réception enregistré.";
      await window.loadFinance();

    } catch (error) {
      message.textContent = error.message || "Enregistrement impossible.";
      button.disabled = false;
    }
  }, true);

  document.addEventListener("DOMContentLoaded", moveSupplierPanel);

  console.log("GLOBEXA : correctifs fournisseur chargés.");
})();
