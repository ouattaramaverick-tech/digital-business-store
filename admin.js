
"use strict";

/* =====================================================
   GLOBEXA — CODE 12
   ADMINISTRATION ET SECURITE
   Utilise uniquement les RPC admin existantes.
   ===================================================== */

(() => {
  let adminAuthListenerInstalled = false;
  let adminLoading = false;

  const adminRoot = () =>
    document.getElementById("adminDashboard");

  const adminEscape = (value) =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);

  const adminMoney = (amount, currency) => {
    try {
      return new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: currency || "USD"
      }).format(Number(amount || 0));
    } catch {
      return Number(amount || 0).toFixed(2) +
        " " + (currency || "USD");
    }
  };

  const adminDate = (value) => {
    if (!value) return "Date inconnue";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "Date inconnue"
      : date.toLocaleString("fr-FR");
  };

  function adminMessage(message, type = "info") {
    const element = document.getElementById(
      "adminMessage"
    );

    if (!element) return;

    element.textContent = message;
    element.dataset.type = type;
  }

  function adminStatus(status) {
    const labels = {
      requested: "Nouvelle demande",
      under_review: "En examen",
      approved: "Approuvée",
      rejected: "Rejetée",
      processing: "En traitement",
      succeeded: "Terminée",
      failed: "Échec"
    };

    return labels[status] || status || "Inconnu";
  }

  function adminInstallAuthListener() {
    if (adminAuthListenerInstalled) return;

    supabaseClient.auth.onAuthStateChange(() => {
      setTimeout(() => {
        loadAdmin();
      }, 0);
    });

    adminAuthListenerInstalled = true;
  }

  function adminRenderPayments(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return "<p>Aucune configuration de paiement disponible.</p>";
    }

    return rows.map(item => `
      <article class="admin-card">
        <h4>${adminEscape(item.display_name)}</h4>
        <p>
          Fournisseur :
          ${adminEscape(item.provider)}
        </p>
        <p>
          État :
          ${item.is_enabled ? "Activé" : "Désactivé"}
        </p>
        <p>
          Devises :
          ${adminEscape(
            (item.supported_currencies || []).join(", ")
          )}
        </p>
        <p>
          ${adminEscape(item.readiness)}
        </p>
      </article>
    `).join("");
  }

  function adminRenderStores(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return "<p>Aucune boutique en attente de validation.</p>";
    }

    return rows.map(store => `
      <article class="admin-card">
        <h4>${adminEscape(store.company_name)}</h4>
        <p>Pays : ${adminEscape(store.country)}</p>
        <p>Ville : ${adminEscape(store.city || "Non précisée")}</p>
        <p>Statut : ${adminEscape(store.status)}</p>
        <p>Vérification : ${adminEscape(store.verification_status)}</p>

        <button type="button"
          data-admin-action="approve-store"
          data-id="${adminEscape(store.id)}">
          Valider la boutique
        </button>

        <button type="button"
          data-admin-action="reject-store"
          data-id="${adminEscape(store.id)}">
          Refuser la boutique
        </button>
      </article>
    `).join("");
  }

  function adminRenderTransitaires(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return "<p>Aucune candidature de transitaire en attente.</p>";
    }

    return rows.map(item => `
      <article class="admin-card">
        <h4>${adminEscape(item.company_name)}</h4>
        <p>Pays : ${adminEscape(item.country || "Non renseigné")}</p>
        <p>Contact : ${adminEscape(item.contact || "Non renseigné")}</p>
        <p>Date : ${adminEscape(adminDate(item.created_at))}</p>

        <button type="button"
          data-admin-action="approve-transitaire"
          data-id="${adminEscape(item.id)}">
          Valider le transitaire
        </button>

        <button type="button"
          data-admin-action="reject-transitaire"
          data-id="${adminEscape(item.id)}">
          Refuser le transitaire
        </button>
      </article>
    `).join("");
  }

   function adminRenderShipmentManagement(
    orders,
    shipments,
    transitaires
  ) {
    const orderRows = Array.isArray(orders) ? orders : [];
    const shipmentRows = Array.isArray(shipments) ? shipments : [];
    const transitaireRows = Array.isArray(transitaires)
      ? transitaires
      : [];

    const shipmentByOrder = new Map(
      shipmentRows.map(item => [item.order_id, item])
    );

    let orderHTML = "";

    if (orderRows.length === 0) {
      orderHTML =
        "<p>Aucune commande payée en attente de gestion logistique.</p>";
    } else {
      orderHTML = orderRows.map(order => {
        const shipment = shipmentByOrder.get(order.id);
        const amount = order.subtotal ??
          Number(order.unit_price || 0) * Number(order.quantity || 0);

        const options = transitaireRows.map(item => `
          <option
            value="${adminEscape(item.id)}"
            ${shipment?.transitaire_id === item.id ? "selected" : ""}
          >
            ${adminEscape(item.company_name)}
            — ${adminEscape(item.country || "Pays non précisé")}
          </option>
        `).join("");

        const transitaireSelect = transitaireRows.length
          ? `
            <label>Transitaire approuvé</label>
            <select name="transitaire_id" required>
              <option value="">Choisir un transitaire</option>
              ${options}
            </select>
          `
          : `
            <p>
              Aucun transitaire approuvé.
              Valide d'abord une candidature.
            </p>
          `;

        return `
          <article class="admin-card">
            <h4>Commande ${adminEscape(order.id.slice(0, 8))}</h4>

            <p>
              Quantité :
              ${adminEscape(order.quantity)}
            </p>

            <p>
              Montant :
              ${adminEscape(adminMoney(amount, order.currency))}
            </p>

            <p>
              Acheteur :
              ${adminEscape(order.buyer_id.slice(0, 8))}
            </p>

            <p>
              Fournisseur :
              ${adminEscape(order.supplier_id.slice(0, 8))}
            </p>

            <p>
              État du paiement :
              ${adminEscape(order.payment_status)}
            </p>

            <p>
              Expédition :
              ${shipment
                ? adminEscape(adminStatus(shipment.status))
                : "Pas encore créée"}
            </p>

            <form
              data-admin-shipment-form
              data-order-id="${adminEscape(order.id)}"
              class="admin-shipment-form"
            >
              ${transitaireSelect}

              <label>Transporteur</label>
              <input
                type="text"
                name="carrier"
                maxlength="120"
                value="${adminEscape(shipment?.carrier || "")}"
                placeholder="Nom du transporteur"
              >

              <label>Numéro de suivi</label>
              <input
                type="text"
                name="tracking_number"
                maxlength="160"
                value="${adminEscape(shipment?.tracking_number || "")}"
                placeholder="Numéro de suivi"
              >

              <label>Lieu de départ</label>
              <input
                type="text"
                name="origin"
                maxlength="200"
                value="${adminEscape(shipment?.origin || "")}"
                placeholder="Ville ou pays de départ"
              >

              <label>Destination</label>
              <input
                type="text"
                name="destination"
                maxlength="200"
                value="${adminEscape(shipment?.destination || "")}"
                placeholder="Ville ou pays de destination"
              >

              <label>Date estimée de livraison</label>
              <input
                type="date"
                name="estimated_delivery"
                value="${adminEscape(shipment?.estimated_delivery || "")}"
              >

              <button
                type="submit"
                ${transitaireRows.length ? "" : "disabled"}
              >
                ${shipment
                  ? "Mettre à jour l'expédition"
                  : "Créer et attribuer l'expédition"}
              </button>
            </form>
          </article>
        `;
      }).join("");
    }

    const historyHTML = shipmentRows.length
      ? shipmentRows.map(item => `
          <article class="admin-card">
            <h4>Expédition ${adminEscape(item.id.slice(0, 8))}</h4>
            <p>Commande : ${adminEscape(item.order_id.slice(0, 8))}</p>
            <p>Transporteur : ${adminEscape(item.carrier || "Non renseigné")}</p>
            <p>Suivi : ${adminEscape(item.tracking_number || "Non renseigné")}</p>
            <p>Statut : ${adminEscape(adminStatus(item.status))}</p>
          </article>
        `).join("")
      : "<p>Aucune expédition enregistrée.</p>";

    return `
      <div>
        <h4>Commandes payées à expédier</h4>
        ${orderHTML}

        <h4>Historique des expéditions</h4>
        ${historyHTML}
      </div>
    `;
   }
   function adminRenderProducts(rows, storeNames) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return "<p>Aucun produit en attente de validation.</p>";
    }

    return rows.map(product => `
      <article class="admin-card">
        <h4>${adminEscape(product.title)}</h4>

        <p>
          Boutique :
          ${adminEscape(
            storeNames.get(product.store_id) || "Boutique inconnue"
          )}
        </p>

        <p>
          Description :
          ${adminEscape(product.description || "Non précisée")}
        </p>

        <p>
          Prix :
          ${adminEscape(
            adminMoney(product.base_price, product.currency)
          )}
        </p>

        <p>
          Stock :
          ${adminEscape(product.stock_quantity)}
        </p>

        <p>Statut : En attente</p>

        <button type="button"
          data-admin-action="approve-product"
          data-id="${adminEscape(product.id)}">
          Valider le produit
        </button>

        <button type="button"
          data-admin-action="reject-product"
          data-id="${adminEscape(product.id)}">
          Refuser le produit
        </button>
      </article>
    `).join("");
  }

  function adminRenderRefunds(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return "<p>Aucune demande de remboursement.</p>";
    }

    return rows.map(item => {
      let actions = "";

      if (
        item.refund_status === "requested" ||
        item.refund_status === "under_review"
      ) {
        actions = `
          <button type="button"
            data-admin-action="review"
            data-id="${adminEscape(item.refund_id)}">
            Examiner
          </button>

          <button type="button"
            data-admin-action="approve"
            data-id="${adminEscape(item.refund_id)}">
            Approuver
          </button>

          <button type="button"
            data-admin-action="reject"
            data-id="${adminEscape(item.refund_id)}">
            Rejeter
          </button>
        `;
      }

      if (item.refund_status === "approved") {
        actions = `
          <button type="button"
            data-admin-action="finalize"
            data-id="${adminEscape(item.refund_id)}">
            Finaliser le remboursement
          </button>
        `;
      }

      return `
        <article class="admin-card">
          <h4>
            ${adminMoney(item.amount, item.currency)}
          </h4>

          <p>
            Statut :
            ${adminEscape(adminStatus(item.refund_status))}
          </p>

          <p>
            Motif :
            ${adminEscape(item.reason)}
          </p>

          <p>
            Paiement initial :
            ${adminEscape(item.original_payment_provider)}
          </p>

          <p>
            Date :
            ${adminEscape(adminDate(item.requested_at))}
          </p>

          ${actions}
        </article>
      `;
    }).join("");
  }

  async function adminAction(action, refundId) {
    if (!refundId) return;

    if (
      action === "approve-store" ||
      action === "reject-store"
    ) {
      const approved = action === "approve-store";

      if (!confirm(
        approved
          ? "Confirmer la validation de cette boutique ?"
          : "Confirmer le refus de cette boutique ?"
      )) return;

      const result = await supabaseClient
        .from("globexa_stores")
        .update(
          approved
            ? {
                status: "active",
                verification_status: "verified"
              }
            : {
                status: "suspended",
                verification_status: "rejected"
              }
        )
        .eq("id", refundId)
        .select("id")
        .single();

      if (result.error) throw result.error;

      adminMessage(
        approved
          ? "Boutique validée avec succès."
          : "Boutique refusée.",
        "success"
      );

      await loadAdmin();
      return;
    }

    if (
      action === "approve-product" ||
      action === "reject-product"
    ) {
      const approved = action === "approve-product";

      if (!confirm(
        approved
          ? "Confirmer la validation de ce produit ?"
          : "Confirmer le refus de ce produit ?"
      )) return;

      const productResult = await supabaseClient
        .from("globexa_market_products")
        .update({
          status: approved ? "published" : "rejected"
        })
        .eq("id", refundId)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (productResult.error) {
        throw productResult.error;
      }

      if (!productResult.data) {
        adminMessage(
          "Produit introuvable ou déjà traité.",
          "error"
        );
        return;
      }

      adminMessage(
        approved
          ? "Produit validé avec succès."
          : "Produit refusé.",
        "success"
      );

      await loadAdmin();
      return;
    }

    if (
      action === "approve-transitaire" ||
      action === "reject-transitaire"
    ) {
      const approved = action === "approve-transitaire";

      if (!confirm(
        approved
          ? "Confirmer la validation de ce transitaire ?"
          : "Confirmer le refus de ce transitaire ?"
      )) return;

      const reviewResult = await supabaseClient.rpc(
        "globexa_admin_review_transitaire",
        {
          p_transitaire_id: refundId,
          p_status: approved ? "approved" : "rejected"
        }
      );

      if (reviewResult.error) throw reviewResult.error;

      adminMessage(
        approved
          ? "Candidature transitaire approuvée."
          : "Candidature transitaire refusée.",
        "success"
      );

      await loadAdmin();
      return;
    }

    let result;
    let parameters;

    if (
      action === "review" ||
      action === "approve" ||
      action === "reject"
    ) {
      let note = "";

      if (action === "reject") {
        note = prompt("Indique le motif du rejet :");

        if (!note || note.trim().length < 5) {
          adminMessage(
            "Le motif doit contenir au moins 5 caractères.",
            "error"
          );
          return;
        }
      } else {
        note = prompt("Note administrative (facultatif) :") || "";
      }

      parameters = {
        p_refund_id: refundId,
        p_decision: action,
        p_admin_note: note.trim()
      };

      result = await supabaseClient.rpc(
        "globexa_admin_review_market_refund",
        parameters
      );
    }

    if (action === "finalize") {
      const outcome = prompt(
        "Tape succeeded si le remboursement est réellement effectué, ou failed si le remboursement a échoué."
      );

      if (!["succeeded", "failed"].includes(outcome)) {
        adminMessage("Résultat invalide.", "error");
        return;
      }

      let reference = "";
      let note = "";

      if (outcome === "succeeded") {
        reference = prompt(
          "Référence réelle du remboursement :"
        ) || "";

        if (reference.trim().length < 3) {
          adminMessage(
            "La référence réelle est obligatoire.",
            "error"
          );
          return;
        }
      } else {
        note = prompt("Motif de l'échec :") || "";

        if (note.trim().length < 5) {
          adminMessage(
            "Le motif doit contenir au moins 5 caractères.",
            "error"
          );
          return;
        }
      }

      if (!confirm(
        "Confirme uniquement si tu as vérifié le résultat réel du remboursement."
      )) return;

      result = await supabaseClient.rpc(
        "globexa_admin_finalize_market_refund",
        {
          p_refund_id: refundId,
          p_result: outcome,
          p_provider_refund_reference: reference.trim(),
          p_admin_note: note.trim()
        }
      );
    }

    if (result?.error) {
      throw result.error;
    }

    adminMessage(
      "Opération enregistrée : " + result.data,
      "success"
    );

    await loadAdmin();
  }

  async function adminSetupEvents() {
    const root = adminRoot();

    if (!root || root.dataset.eventsReady) return;

    root.addEventListener("click", async event => {
      const button = event.target.closest(
        "[data-admin-action]"
      );

      if (!button) return;

      const action = button.dataset.adminAction;
      const refundId = button.dataset.id;

      button.disabled = true;

      try {
        await adminAction(action, refundId);
      } catch (error) {
        adminMessage(
          error.message || "Opération impossible.",
          "error"
        );
      } finally {
        button.disabled = false;
      }
    });

        // ENREGISTREMENT DES EXPEDITIONS GLOBEXA
    root.addEventListener("submit", async event => {
      const form = event.target.closest(
        "[data-admin-shipment-form]"
      );

      if (!form) return;

      event.preventDefault();

      const orderId = form.dataset.orderId;
      const formData = new FormData(form);

      const transitaireId = String(
        formData.get("transitaire_id") || ""
      ).trim();

      if (!transitaireId) {
        adminMessage(
          "Choisis un transitaire approuvé.",
          "error"
        );
        return;
      }

      if (!confirm(
        "Confirmer la création ou la mise à jour de cette expédition ?"
      )) return;

      const submitButton = form.querySelector(
        'button[type="submit"]'
      );

      if (submitButton) submitButton.disabled = true;

      try {
        const result = await supabaseClient.rpc(
          "globexa_admin_manage_shipment",
          {
            p_order_id: orderId,
            p_transitaire_id: transitaireId,
            p_carrier: String(
              formData.get("carrier") || ""
            ).trim() || null,
            p_tracking_number: String(
              formData.get("tracking_number") || ""
            ).trim() || null,
            p_origin: String(
              formData.get("origin") || ""
            ).trim() || null,
            p_destination: String(
              formData.get("destination") || ""
            ).trim() || null,
            p_estimated_delivery: String(
              formData.get("estimated_delivery") || ""
            ).trim() || null
          }
        );

        if (result.error) throw result.error;

        adminMessage(
          "Expédition enregistrée avec succès.",
          "success"
        );

        await loadAdmin();

      } catch (error) {
        console.error(
          "Erreur enregistrement expédition :",
          error
        );

        adminMessage(
          error.message || "Impossible d'enregistrer l'expédition.",
          "error"
        );

        if (submitButton) submitButton.disabled = false;
      }
    });
     root.dataset.eventsReady = "true";
  }

  async function loadAdmin() {
    const root = adminRoot();

    if (!root || adminLoading) return;

    adminLoading = true;

    root.innerHTML = "<p>Vérification des droits administrateur...</p>";

    try {
      await ensureSupabaseClient();

      adminInstallAuthListener();

      const { data: userData, error: userError } =
        await supabaseClient.auth.getUser();

      if (userError) throw userError;

      if (!userData.user) {
        root.innerHTML =
          "<p>Connecte-toi pour accéder à l'administration.</p>";
        return;
      }

      const access = await supabaseClient.rpc(
        "is_globexa_admin"
      );

      if (access.error) throw access.error;

      if (access.data !== true) {
        root.innerHTML =
          "<p>Accès refusé. Cette section est réservée aux administrateurs autorisés.</p>";
        return;
      }

      await adminSetupEvents();

      root.innerHTML = `
        <div class="admin-panel">
          <h3>Tableau de bord administrateur</h3>

          <p>
            Accès administrateur vérifié par Supabase.
          </p>

          <section class="admin-section">
            <h3>Boutiques à valider</h3>
            <div id="adminStoreList">Chargement...</div>
          </section>

          <section class="admin-section">
            <h3>Candidatures des transitaires</h3>
            <div id="adminTransitaireList">Chargement...</div>
          </section>

         <section class="admin-section">
  <h3>🚚 Gestion des expéditions</h3>
  <p>
    Créer les expéditions des commandes payées
    et attribuer les transitaires approuvés.
  </p>
  <div id="adminShipmentList">Chargement...</div>
</section>
<section class="admin-section">
            <h3>Produits à valider</h3>
            <div id="adminProductList">Chargement...</div>
          </section>

          <div id="adminMessage" role="status"></div>

          <section class="admin-section">
            <h3>Configuration des paiements</h3>
            <div id="adminPaymentList">
              Chargement...
            </div>
          </section>

          <section class="admin-section">
            <h3>Demandes de remboursement</h3>
            <div id="adminRefundList">
              Chargement...
            </div>
          </section>
        </div>
      `;

      
      const [
        payments,
        refunds,
        stores,
        products,
        allStores,
        transitaires,
        paidOrders,
        shipments,
        approvedTransitaires
      ] = await Promise.all([
        supabaseClient.rpc(
          "globexa_admin_payment_readiness"
        ),
        supabaseClient.rpc(
          "globexa_admin_market_refund_list",
          { p_status: null }
        ),
        supabaseClient
          .from("globexa_stores")
          .select("id,company_name,country,city,status,verification_status")
          .eq("status", "pending")
          .order("created_at", { ascending: true }),
        supabaseClient
          .from("globexa_market_products")
          .select("id,store_id,title,description,base_price,currency,stock_quantity,status,created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: true }),
        supabaseClient
          .from("globexa_stores")
          .select("id,company_name"),
        supabaseClient
          .from("transitaires")
          .select("id,company_name,country,contact,status,created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: true }),

        // COMMANDES PAYEES
        supabaseClient
          .from("globexa_market_orders")
          .select("id,buyer_id,supplier_id,quantity,unit_price,subtotal,currency,payment_status,status,created_at")
          .eq("payment_status", "paid")
          .in("status", ["paid", "processing", "shipped"])
          .order("created_at", { ascending: false }),

        // HISTORIQUE DES EXPEDITIONS
        supabaseClient
          .from("globexa_shipments")
          .select("id,order_id,carrier,tracking_number,origin,destination,status,estimated_delivery,transitaire_id,created_at")
          .order("created_at", { ascending: false }),

        // TRANSITAIRES APPROUVES
        supabaseClient
          .from("transitaires")
          .select("id,company_name,country,status")
          .eq("status", "approved")
          .order("company_name", { ascending: true })
      ]);

      const paymentElement = document.getElementById(
        "adminPaymentList"
      );

      const refundElement = document.getElementById(
        "adminRefundList"
      );

      const storeElement = document.getElementById(
        "adminStoreList"
      );

      const productElement = document.getElementById(
        "adminProductList"
      );

      const transitaireElement = document.getElementById(
        "adminTransitaireList"
      );

           const shipmentElement = document.getElementById(
        "adminShipmentList"
      );
       
      if (transitaires.error) {
        transitaireElement.textContent =
          "Impossible de charger les candidatures : " +
          transitaires.error.message;
      } else {
        transitaireElement.innerHTML =
          adminRenderTransitaires(transitaires.data || []);
      }

      if (!shipmentElement) {
        console.error("Panneau adminShipmentList introuvable.");
      } else if (paidOrders.error) {
        shipmentElement.textContent =
          "Impossible de charger les commandes : " +
          paidOrders.error.message;
      } else if (shipments.error) {
        shipmentElement.textContent =
          "Impossible de charger les expéditions : " +
          shipments.error.message;
      } else if (approvedTransitaires.error) {
        shipmentElement.textContent =
          "Impossible de charger les transitaires : " +
          approvedTransitaires.error.message;
      } else {
        shipmentElement.innerHTML =
          adminRenderShipmentManagement(
            paidOrders.data || [],
            shipments.data || [],
            approvedTransitaires.data || []
          );
      }

      if (stores.error) {
        storeElement.textContent =
          "Impossible de charger les boutiques : " +
          stores.error.message;
      } else {
        storeElement.innerHTML =
          adminRenderStores(stores.data);
      }

      if (products.error) {
        productElement.textContent =
          "Impossible de charger les produits : " +
          products.error.message;
      } else if (allStores.error) {
        productElement.textContent =
          "Impossible de charger les boutiques des produits.";
      } else {
        const storeNames = new Map(
          (allStores.data || []).map(store => [
            store.id,
            store.company_name
          ])
        );

        productElement.innerHTML =
          adminRenderProducts(products.data, storeNames);
      }

      if (payments.error) {
        paymentElement.textContent =
          "Impossible de charger les paiements : " +
          payments.error.message;
      } else {
        paymentElement.innerHTML =
          adminRenderPayments(payments.data);
      }

      if (refunds.error) {
        refundElement.textContent =
          "Impossible de charger les remboursements : " +
          refunds.error.message;
      } else {
        refundElement.innerHTML =
          adminRenderRefunds(refunds.data);
      }

    } catch (error) {
      root.innerHTML =
        "<p>Erreur administration : " +
        adminEscape(error.message) +
        "</p>";
    } finally {
      adminLoading = false;
    }
  }

  window.loadAdmin = loadAdmin;

})();
