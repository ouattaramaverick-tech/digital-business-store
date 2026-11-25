
"use strict";

/* ==========================================
   GLOBEXA — CODE 5
   FICHE DÉTAILLÉE DES PRODUITS
   ========================================== */

let productDetailClient = null;

const productDetailState = {
  product: null,
  images: [],
  selectedImage: 0,
  tiers: [],
  reviews: [],
  store: null
};

function pdEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[c]);
}

function pdPrice(amount, currency) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency || "USD"
    }).format(Number(amount || 0));
  } catch {
    return Number(amount || 0) + " " + (currency || "USD");
  }
}

/* 1. OUVRIR UNE FICHE PRODUIT */

async function showGlobexaProductDetail(productId) {
  const modal = document.getElementById("productDetailModal");
  const content = document.getElementById("productDetailContent");

  if (!modal || !content) return;

  modal.hidden = false;
  content.innerHTML = "<p>Chargement des informations du produit...</p>";

    try {
    if (typeof window.globexaGetSupabaseClient !== "function") {
      throw new Error("Connexion Supabase non disponible.");
    }

    productDetailClient = await window.globexaGetSupabaseClient();
  } catch (error) {
    console.error("Connexion fiche produit :", error);
    content.innerHTML =
      "<p>Connexion impossible. Vérifie Internet et réessaie.</p>";
    return;
    }
   const { data: product, error } = await productDetailClient
    .from("globexa_market_products")
    .select(`
      id,
      store_id,
      category_id,
      title,
      description,
      sku,
      country_of_origin,
      currency,
      base_price,
      moq,
      stock_quantity,
      images,
      status,
      created_at
    `)
    .eq("id", productId)
    .eq("status", "published")
    .maybeSingle();

  if (error || !product) {
    content.innerHTML = "<p>Impossible de trouver ce produit.</p>";
    return;
  }

  productDetailState.product = product;
  productDetailState.images =
    Array.isArray(product.images) && product.images.length
      ? product.images
      : ["https://placehold.co/600x450?text=GLOBEXA"];

  productDetailState.selectedImage = 0;

  await Promise.all([
    loadGlobexaPriceTiers(product.id),
    loadGlobexaReviews(product.id),
    loadGlobexaStore(product.store_id)
  ]);

  renderGlobexaProductDetail();
}

/* 2. PRIX SELON LA QUANTITÉ */

async function loadGlobexaPriceTiers(productId) {
  const { data, error } = await productDetailClient
    .from("globexa_price_tiers")
    .select("min_quantity,max_quantity,unit_price")
    .eq("product_id", productId)
    .order("min_quantity");

  productDetailState.tiers = error ? [] : (data || []);
}

/* 3. AVIS DES ACHETEURS */

async function loadGlobexaReviews(productId) {
  const { data, error } = await productDetailClient
    .from("globexa_market_product_reviews")
    .select("rating,comment,created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(10);

  productDetailState.reviews = error ? [] : (data || []);
}

/* 4. INFORMATIONS DU FOURNISSEUR */

async function loadGlobexaStore(storeId) {
  productDetailState.store = null;

  if (!storeId) return;

  const { data, error } = await productDetailClient
    .from("globexa_stores")
    .select(`
      id,
      company_name,
      country,
      city,
      description,
      logo_url,
      verification_status
    `)
    .eq("id", storeId)
    .maybeSingle();

  if (!error) {
    productDetailState.store = data;
  }
}

/* 5. AFFICHER LA FICHE COMPLÈTE */

function renderGlobexaProductDetail() {
  const content = document.getElementById("productDetailContent");
  const product = productDetailState.product;

  if (!content || !product) return;

  const images = productDetailState.images;
  const mainImage = images[productDetailState.selectedImage];

  const store = productDetailState.store;
  const tiers = productDetailState.tiers;
  const reviews = productDetailState.reviews;

  const average = reviews.length
    ? reviews.reduce((sum, review) =>
        sum + Number(review.rating || 0), 0) / reviews.length
    : 0;

  content.innerHTML = `
    <div class="globexa-full-product-detail">

      <div class="globexa-detail-gallery">

        <img
          class="globexa-detail-main-image"
          src="${pdEscape(mainImage)}"
          alt="${pdEscape(product.title)}">

        <div class="globexa-detail-thumbnails">
          ${images.map((image, index) => `
            <button
              type="button"
              data-detail-image="${index}"
              aria-label="Voir la photo ${index + 1}">
              <img src="${pdEscape(image)}" alt="">
            </button>
          `).join("")}
        </div>

      </div>

      <div class="globexa-detail-information">

        <h2>${pdEscape(product.title)}</h2>

        <h3 class="globexa-detail-price">
          ${pdPrice(product.base_price, product.currency)}
        </h3>

        <p>
          Quantité minimale :
          <strong>${Number(product.moq || 1)}</strong>
        </p>

        <p>
          Stock disponible :
          <strong>${Number(product.stock_quantity || 0)}</strong>
        </p>

        <p>
          Pays d'origine :
          ${pdEscape(product.country_of_origin || "Non précisé")}
        </p>

        <p>
          Référence :
          ${pdEscape(product.sku || "Non disponible")}
        </p>

        <p>
          État :
          <strong>Produit publié</strong>
        </p>

        <div class="globexa-detail-actions">
          <label for="globexaDetailQuantity">
            Quantité souhaitée
          </label>

          <input
            id="globexaDetailQuantity"
            type="number"
            min="${Number(product.moq || 1)}"
            max="${Number(product.stock_quantity || 0)}"
            value="${Number(product.moq || 1)}">

          <button
            type="button"
            id="globexaDetailAddCart">
            Ajouter au panier
          </button>
        </div>

      </div>

      <section class="globexa-detail-section">
        <h3>Description du produit</h3>
        <p>
          ${pdEscape(
            product.description || "Aucune description disponible."
          )}
        </p>
      </section>

      <section class="globexa-detail-section">
        <h3>Prix selon la quantité</h3>

        ${tiers.length ? `
          <table>
            <thead>
              <tr>
                <th>Quantité minimale</th>
                <th>Quantité maximale</th>
                <th>Prix unitaire</th>
              </tr>
            </thead>
            <tbody>
              ${tiers.map(tier => `
                <tr>
                  <td>${Number(tier.min_quantity)}</td>
                  <td>${tier.max_quantity == null
                    ? "Sans limite indiquée"
                    : Number(tier.max_quantity)}</td>
                  <td>${pdPrice(tier.unit_price, product.currency)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : `
          <p>Les prix par quantité ne sont pas encore renseignés.</p>
        `}
      </section>

      <section class="globexa-detail-section">
        <h3>Informations du fournisseur</h3>

        ${store ? `
          <h4>${pdEscape(store.company_name)}</h4>
          <p>
            Ville : ${pdEscape(store.city || "Non précisée")}
          </p>
          <p>
            Pays : ${pdEscape(store.country || "Non précisé")}
          </p>
          <p>
            ${pdEscape(store.description || "Présentation non disponible.")}
          </p>
          <p>
            Vérification :
            ${store.verification_status === "verified"
              ? "Fournisseur vérifié"
              : "Vérification non confirmée"}
          </p>
        ` : `
          <p>Informations du fournisseur non disponibles.</p>
        `}
      </section>

      <section class="globexa-detail-section">
        <h3>Avis des acheteurs</h3>

        ${reviews.length ? `
          <p>
            Note moyenne :
            <strong>${average.toFixed(1)} / 5</strong>
            (${reviews.length} avis affichés)
          </p>

          ${reviews.map(review => `
            <article class="globexa-detail-review">
              <p>
                Note : ${Number(review.rating)} / 5
              </p>
              <p>${pdEscape(review.comment || "Aucun commentaire.")}</p>
              <small>
                ${new Date(review.created_at).toLocaleDateString("fr-FR")}
              </small>
            </article>
          `).join("")}
        ` : `
          <p>Aucun avis disponible pour le moment.</p>
        `}
      </section>

    </div>
  `;

  content.querySelectorAll("[data-detail-image]")
    .forEach(button => {
      button.addEventListener("click", () => {
        productDetailState.selectedImage =
          Number(button.dataset.detailImage);
        renderGlobexaProductDetail();
      });
    });

  document.getElementById("globexaDetailAddCart")
    ?.addEventListener("click", addGlobexaDetailToCart);
}

/* 6. AJOUTER AU PANIER */

async function addGlobexaDetailToCart() {
  const product = productDetailState.product;
  const quantityInput = document.getElementById("globexaDetailQuantity");

  if (!product || !quantityInput) return;

  const quantity = Number(quantityInput.value);
  const minimum = Number(product.moq || 1);
  const stock = Number(product.stock_quantity || 0);

  if (!Number.isInteger(quantity) || quantity < minimum) {
    alert("La quantité doit respecter le minimum demandé.");
    return;
  }

  if (quantity > stock) {
    alert("La quantité dépasse le stock disponible.");
    return;
  }

  const { data: userData, error } =
    await productDetailClient.auth.getUser();

  if (error || !userData.user) {
    alert("Connecte-toi avant d'ajouter ce produit au panier.");
    return;
  }

  const userId = userData.user.id;

  const { data: existing, error: findError } =
    await productDetailClient
      .from("globexa_market_cart_items")
      .select("id,quantity")
      .eq("user_id", userId)
      .eq("product_id", product.id)
      .maybeSingle();

  if (findError) {
    alert("Impossible de vérifier le panier.");
    return;
  }

  const finalQuantity = Number(existing?.quantity || 0) + quantity;

  if (finalQuantity > stock) {
    alert("La quantité totale dépasse le stock disponible.");
    return;
  }

  let result;

  if (existing) {
    result = await productDetailClient
      .from("globexa_market_cart_items")
      .update({ quantity: finalQuantity })
      .eq("id", existing.id)
      .eq("user_id", userId);
  } else {
    result = await productDetailClient
      .from("globexa_market_cart_items")
      .insert({
        user_id: userId,
        product_id: product.id,
        quantity
      });
  }

  if (result.error) {
    console.error(result.error);
    alert("Impossible d'ajouter le produit au panier.");
    return;
  }

  alert("Produit ajouté au panier.");

  if (typeof window.loadCart === "function") {
    await window.loadCart();
  }
}

/* 7. INTERCEPTER LES CLICS SUR LES PRODUITS */

document.addEventListener("click", event => {
  const button = event.target.closest(
    "[data-product], [data-product-id]"
  );

  if (!button) return;

  const productId =
    button.dataset.product ||
    button.dataset.productId;

  if (!productId) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  showGlobexaProductDetail(productId);
}, true);

/* 8. FERMER LA FICHE */

document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("productDetailModal");
  const closeButton = document.getElementById("closeProductDetail");

  closeButton?.addEventListener("click", () => {
    modal.hidden = true;
  });

  modal?.addEventListener("click", event => {
    if (event.target === modal) {
      modal.hidden = true;
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && modal) {
      modal.hidden = true;
    }
  });
});

console.log("GLOBEXA Code 5 chargé.");
