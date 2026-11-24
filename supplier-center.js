
"use strict";

/* ==========================================
   GLOBEXA — CODE 6
   CENTRE FOURNISSEUR
   ========================================== */

const supplierCenterClient = window.supabase.createClient(
  "https://xlxkiyihagoupsajwmze.supabase.co",
  "sb_publishable_3W39fAVPXUDlkCb8Gnzovw_dolfa7P6"
);

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
}

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
  loadSupplierCenter();
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
