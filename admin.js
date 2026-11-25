
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
    let result;
    let parameters;

    if (action === "review" ||
        action === "approve" ||
        action === "reject") {

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

      const [payments, refunds] = await Promise.all([
        supabaseClient.rpc(
          "globexa_admin_payment_readiness"
        ),
        supabaseClient.rpc(
          "globexa_admin_market_refund_list",
          { p_status: null }
        )
      ]);

      const paymentElement = document.getElementById(
        "adminPaymentList"
      );

      const refundElement = document.getElementById(
        "adminRefundList"
      );

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
