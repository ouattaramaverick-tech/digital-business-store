
/* =====================================================
   GLOBEXA — CODE 11
   COMMISSIONS, RETRAITS ADMIN ET MOYENS FOURNISSEURS
   ===================================================== */

(function () {
  "use strict";

  const FINANCE_METHODS = {
    visa: "Visa",
    mastercard: "Mastercard",
    paypal: "PayPal",
    alipay: "Alipay",
    bank_transfer: "Virement bancaire"
  };

  function financeEscape(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char];
    });
  }

  function financeMoney(amount, currency) {
    const number = Number(amount || 0);

    return number.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + " " + financeEscape(currency || "");
  }

  function financeDate(value) {
    if (!value) return "Non renseignée";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Date inconnue";

    return date.toLocaleString("fr-FR");
  }

  function financeContainer() {
    return document.getElementById("financeList");
  }

  function financeUser() {
    return typeof state !== "undefined" && state
      ? state.user
      : null;
  }

  function financeMessage(message, type) {
    const color = type === "error"
      ? "#dc2626"
      : type === "success"
        ? "#15803d"
        : "#2563eb";

    return `
      <div style="
        padding:12px;
        margin:12px 0;
        border-radius:8px;
        background:#f1f5f9;
        color:${color};
      ">
        ${financeEscape(message)}
      </div>
    `;
  }

  function financeButton() {
    return `
      background:#f97316;
      color:white;
      border:0;
      border-radius:7px;
      padding:11px 16px;
      cursor:pointer;
      font-weight:600;
    `;
  }

  function renderCommissions(rows) {
    if (!rows.length) {
      return "<p>Aucune commission enregistrée pour le moment.</p>";
    }

    return `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th style="padding:9px;text-align:left">Commande</th>
              <th style="padding:9px;text-align:left">Montant</th>
              <th style="padding:9px;text-align:left">Commission</th>
              <th style="padding:9px;text-align:left">Fournisseur</th>
              <th style="padding:9px;text-align:left">Statut</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(function (item) {
              return `
                <tr>
                  <td style="padding:9px;border-top:1px solid #ddd">
                    ${financeEscape(item.order_id)}
                  </td>
                  <td style="padding:9px;border-top:1px solid #ddd">
                    ${financeMoney(item.total_amount, item.currency)}
                  </td>
                  <td style="padding:9px;border-top:1px solid #ddd">
                    ${financeMoney(item.commission_amount, item.currency)}
                  </td>
                  <td style="padding:9px;border-top:1px solid #ddd">
                    ${financeEscape(item.supplier_user_id)}
                  </td>
                  <td style="padding:9px;border-top:1px solid #ddd">
                    ${financeEscape(item.status)}
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderAdminSummary(rows) {
    if (!rows.length) {
      return "<p>Aucun solde de commission disponible.</p>";
    }

    return rows.map(function (item) {
      return `
        <article style="
          padding:14px;
          margin:10px 0;
          border:1px solid #dbeafe;
          border-radius:9px;
        ">
          <h3>${financeEscape(item.currency)}</h3>
          <p>
            Solde disponible :
            <strong>${financeMoney(item.available_balance, item.currency)}</strong>
          </p>
          <p>
            Retraits en attente :
            ${financeMoney(item.pending_withdrawal, item.currency)}
          </p>
          <p>
            Total déjà retiré :
            ${financeMoney(item.total_withdrawn, item.currency)}
          </p>
        </article>
      `;
    }).join("");
  }

  function renderPayoutHistory(rows) {
    if (!rows.length) {
      return "<p>Aucun retrait enregistré.</p>";
    }

    return rows.map(function (item) {
      const pending = item.status === "pending";

      return `
        <article style="
          border:1px solid #e2e8f0;
          border-radius:9px;
          padding:13px;
          margin:12px 0;
        ">
          <p><strong>Mode :</strong> Yiriwa Pay</p>
          <p><strong>Montant :</strong>
            ${financeMoney(item.amount, item.currency)}
          </p>
          <p><strong>Statut :</strong> ${financeEscape(item.status)}</p>
          <p><strong>Demande :</strong> ${financeDate(item.requested_at)}</p>
          <p><strong>Référence :</strong>
            ${financeEscape(item.external_reference || "En attente")}
          </p>

          ${
            pending
              ? `
                <form class="financeConfirmPayout"
                  data-payout-id="${financeEscape(item.id)}">
                  <label>Référence du paiement Yiriwa Pay réellement effectué</label>
                  <input
                    name="external_reference"
                    required
                    minlength="3"
                    maxlength="200"
                    placeholder="Référence de transaction"
                    style="width:100%;padding:10px;margin:8px 0"
                  >
                  <button type="submit" style="${financeButton()}">
                    Confirmer après paiement réel
                  </button>
                </form>
              `
              : ""
          }
        </article>
      `;
    }).join("");
  }

  function renderSupplierMethods(rows) {
    if (!rows.length) {
      return "<p>Aucun moyen de réception enregistré.</p>";
    }

    return rows.map(function (item) {
      return `
        <article style="
          padding:12px;
          margin:10px 0;
          border:1px solid #e2e8f0;
          border-radius:8px;
        ">
          <strong>
            ${financeEscape(FINANCE_METHODS[item.method_code] || item.method_code)}
          </strong>
          <p>Titulaire : ${financeEscape(item.account_holder)}</p>
          <p>Référence : ${financeEscape(item.account_reference)}</p>
          <p>Pays : ${financeEscape(item.country || "Non renseigné")}</p>
          <p>Devise : ${financeEscape(item.currency || "Non renseignée")}</p>
          <p>Statut : ${financeEscape(item.status)}</p>
        </article>
      `;
    }).join("");
  }

  
  function renderAdminCommissionMethods(rows) {
    const methods = {
      mobile_money: "Mobile Money",
      wave: "Wave",
      visa: "Visa"
    };

    const list = rows.length
      ? rows.map(function (item) {
          return `
            <article style="padding:12px;margin:10px 0;border:1px solid #ddd;border-radius:8px">
              <strong>${financeEscape(methods[item.method_code] || item.method_code)}</strong>
              <p>Titulaire : ${financeEscape(item.account_holder)}</p>
              <p>Compte : ${financeEscape(item.account_reference)}</p>
              <p>Pays : ${financeEscape(item.country)}</p>
              <p>Devise : ${financeEscape(item.currency)}</p>
              <p>Statut : ${item.is_active ? "Actif" : "Désactivé"}</p>
              <button type="button"
                data-commission-method-id="${financeEscape(item.id)}"
                data-commission-method-active="${item.is_active ? "true" : "false"}"
                style="${financeButton()}">
                ${item.is_active ? "Désactiver" : "Activer"}
              </button>
            </article>
          `;
        }).join("")
      : "<p>Aucun moyen de réception enregistré.</p>";

    return `
      <section>
        <h2>Mes moyens de réception des commissions</h2>
        ${list}
        <div id="financeCommissionMethodsMessage"></div>
      </section>
    `;
  }
  function renderAdminCommissionMethodForm() {
    return `
      <section>
        <h2>Ajouter un moyen de réception des commissions</h2>

        <form id="globexaAdminCommissionMethodForm">

          <label>Type de moyen</label>
          <select name="method_code" required
            style="width:100%;padding:10px;margin:7px 0 12px">
            <option value="">Choisir</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="wave">Wave</option>
            <option value="visa">Visa</option>
          </select>

          <label>Nom du titulaire</label>
          <input name="account_holder" required minlength="2"
            maxlength="120"
            style="width:100%;padding:10px;margin:7px 0 12px">

          <label>Numéro ou référence du compte</label>
          <input name="account_reference" required minlength="3"
            maxlength="200"
            style="width:100%;padding:10px;margin:7px 0 12px">

          <label>Pays</label>
          <input name="country" value="BF" required
            style="width:100%;padding:10px;margin:7px 0 12px">

          <label>Devise</label>
          <input name="currency" value="XOF" required
            maxlength="3" pattern="[A-Za-z]{3}"
            style="width:100%;padding:10px;margin:7px 0 12px">

          <button type="submit" style="${financeButton()}">
            Enregistrer
          </button>
        </form>

        <div id="financeAdminCommissionFormMessage"></div>
      </section>
    `;
  }
   function renderSupplierForm() {
    return `
      <form id="globexaSupplierPayoutForm">

        <label>Moyen de réception</label>
        <select name="method_code" required
          style="width:100%;padding:10px;margin:7px 0 12px">
          <option value="">Choisir un moyen</option>
          <option value="visa">Visa</option>
          <option value="mastercard">Mastercard</option>
          <option value="paypal">PayPal</option>
          <option value="alipay">Alipay</option>
          <option value="bank_transfer">Virement bancaire</option>
        </select>

        <label>Nom du titulaire</label>
        <input name="account_holder"
          required minlength="2" maxlength="120"
          style="width:100%;padding:10px;margin:7px 0 12px">

        <label>Référence du compte</label>
        <input name="account_reference"
          required minlength="3" maxlength="255"
          placeholder="Email PayPal, référence ou numéro de compte"
          style="width:100%;padding:10px;margin:7px 0 12px">

        <label>Nom de la banque (si nécessaire)</label>
        <input name="bank_name" maxlength="150"
          style="width:100%;padding:10px;margin:7px 0 12px">

        <label>Pays</label>
        <input name="country" maxlength="100"
          style="width:100%;padding:10px;margin:7px 0 12px">

        <label>Devise</label>
        <input name="currency" maxlength="3"
          placeholder="USD, EUR, XOF..."
          style="width:100%;padding:10px;margin:7px 0 12px">

        <button type="submit" style="${financeButton()}">
          Enregistrer mon moyen de réception
        </button>
      </form>

      <div id="financeSupplierMessage"></div>
    `;
  }

  async function loadFinance() {
    const container = financeContainer();

    if (!container) return;

    container.innerHTML = "<p>Chargement des finances...</p>";

    try {
      if (typeof ensureSupabaseClient === "function") {
        await ensureSupabaseClient();
      }

      if (!supabaseClient) {
        throw new Error("Connexion Supabase indisponible.");
      }

      const user = financeUser();

      if (!user) {
        container.innerHTML =
          "<p>Connectez-vous pour accéder à votre espace financier.</p>";
        return;
      }

      const methodsResult = await supabaseClient
        .from("globexa_supplier_payout_methods")
        .select(`
          id,
          method_code,
          account_holder,
          account_reference,
          bank_name,
          country,
          currency,
          status,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (methodsResult.error) throw methodsResult.error;

      const methods = methodsResult.data || [];

      let adminMode = false;
      let summary = [];
      let commissions = [];
      let history = [];
      let adminCommissionMethods = [];
      const summaryResult = await supabaseClient.rpc(
        "globexa_admin_payout_summary"
      );

      if (!summaryResult.error) {
        adminMode = true;
        summary = summaryResult.data || [];
        const adminMethodsResult = await supabaseClient.rpc(
          "globexa_admin_list_commission_methods"
        );

        if (adminMethodsResult.error) throw adminMethodsResult.error;

        adminCommissionMethods = adminMethodsResult.data || [];
        const commissionResult = await supabaseClient
          .from("globexa_market_commissions")
          .select(`
            id,
            order_id,
            supplier_user_id,
            total_amount,
            commission_rate,
            commission_amount,
            supplier_amount,
            currency,
            status,
            created_at
          `)
          .order("created_at", { ascending: false })
          .limit(100);

        if (commissionResult.error) throw commissionResult.error;

        commissions = commissionResult.data || [];

        const historyResult = await supabaseClient.rpc(
          "globexa_admin_payout_history"
        );

        if (historyResult.error) throw historyResult.error;

        history = historyResult.data || [];
      }

      container.innerHTML = `
        <div style="display:grid;gap:22px">

          ${
            adminMode
              ? `
                <section>
                  <h2>Tableau des commissions administrateur</h2>
                  <p>Commission GLOBEXA : 6 %</p>
                  ${renderAdminSummary(summary)}
               ${renderAdminCommissionMethods(adminCommissionMethods)}
               ${renderAdminCommissionMethodForm()}
               </section>

                <section>
                  <h2>Demander un retrait administrateur</h2>
                                    <p>
                    Le retrait est réservé à l'administrateur.
                    Choisis un moyen actif parmi tes moyens de réception enregistrés.
                  </p>

                  ${
                    summary.some(function (item) {
                      return Number(item.available_balance) > 0;
                    }) && adminCommissionMethods.some(function (method) {
                      return method.is_active;
                    })
                      ? `
                        <form id="globexaAdminPayoutForm">
                          <label>Moyen de réception actif</label>
                          <select name="method_id" required
                            style="width:100%;padding:10px;margin:8px 0">
                            <option value="">Choisir un moyen</option>
                            ${adminCommissionMethods.filter(function (method) {
                              return method.is_active;
                            }).map(function (method) {
                              const labels = {
                                mobile_money: "Mobile Money",
                                wave: "Wave",
                                visa: "Visa"
                              };
                              return `
                                <option value="${financeEscape(method.id)}"
                                  data-currency="${financeEscape(method.currency)}">
                                  ${labels[method.method_code] || financeEscape(method.method_code)}
                                  — ${financeEscape(method.account_reference)}
                                  — ${financeEscape(method.currency)}
                                </option>
                              `;
                            }).join("")}
                          </select>
                          <p>La devise du retrait sera celle du moyen sélectionné.</p>
                          <button type="submit" style="${financeButton()}">
                            Demander le retrait
                          </button>
                        </form>
                      `
                      : "<p>Ajoute et active un moyen de réception et attends qu’un solde soit disponible.</p>"
                  }

                  <div id="financeAdminMessage"></div>
                </section>

                <section>
                  <h2>Historique des retraits</h2>
                  ${renderPayoutHistory(history)}
                  <div id="financePayoutMessage"></div>
                </section>

                <section>
                  <h2>Historique des commissions</h2>
                  ${renderCommissions(commissions)}
                </section>
              `
              : `
                <section>
                  <h2>Mes moyens de réception fournisseur</h2>
                  <p>
                    Les fournisseurs peuvent enregistrer uniquement
                    les moyens autorisés ci-dessous.
                  </p>
                  ${renderSupplierMethods(methods)}
                </section>

                <section>
                  <h3>Ajouter un moyen de réception</h3>
                  ${renderSupplierForm()}
                </section>
              `
          }

        </div>
      `;

      setupFinanceEvents();

    } catch (error) {
      console.error("GLOBEXA finance:", error);

      container.innerHTML = financeMessage(
        error.message || "Impossible de charger l'espace financier.",
        "error"
      );
    }
  }

  function setupFinanceEvents() {
    const adminForm = document.getElementById(
      "globexaAdminPayoutForm"
    );

    if (adminForm) {
      adminForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const message = document.getElementById("financeAdminMessage");
        const button = adminForm.querySelector("button");
        const currency = String(
          new FormData(adminForm).get("currency") || ""
        );

        button.disabled = true;
        button.textContent = "Demande en cours...";

        try {
          const result = await supabaseClient.rpc(
            "globexa_admin_request_payout",
            { p_currency: currency }
          );

          if (result.error) throw result.error;

          message.innerHTML = financeMessage(
            "Demande de retrait créée. Elle est en attente de traitement.",
            "success"
          );

          await loadFinance();

        } catch (error) {
          message.innerHTML = financeMessage(
            error.message || "Impossible de demander ce retrait.",
            "error"
          );

          button.disabled = false;
          button.textContent = "Demander le retrait Yiriwa Pay";
        }
      });
    }

          const commissionMethodForm = document.getElementById(
      "globexaAdminCommissionMethodForm"
    );

    if (commissionMethodForm) {
      commissionMethodForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const button = commissionMethodForm.querySelector(
          'button[type="submit"]'
        );
        const message = document.getElementById(
          "financeAdminCommissionFormMessage"
        );
        const formData = new FormData(commissionMethodForm);

        button.disabled = true;
        button.textContent = "Enregistrement...";

        try {
          const result = await supabaseClient.rpc(
            "globexa_admin_add_commission_method",
            {
              p_method_code: formData.get("method_code"),
              p_account_holder: String(
                formData.get("account_holder") || ""
              ).trim(),
              p_account_reference: String(
                formData.get("account_reference") || ""
              ).trim(),
              p_country: String(
                formData.get("country") || "BF"
              ).trim(),
              p_currency: String(
                formData.get("currency") || "XOF"
              ).trim().toUpperCase()
            }
          );

          if (result.error) throw result.error;

          message.innerHTML = financeMessage(
            "Moyen de réception enregistré avec succès.",
            "success"
          );

          commissionMethodForm.reset();
          await loadFinance();

        } catch (error) {
          message.innerHTML = financeMessage(
            error.message || "Impossible d'enregistrer ce moyen.",
            "error"
          );

          button.disabled = false;
          button.textContent = "Enregistrer";
        }
      });
    }
     document.querySelectorAll("[data-commission-method-id]").forEach(
      function (button) {
        button.addEventListener("click", async function () {
          if (button.disabled) return;

          const methodId = button.dataset.commissionMethodId;
          const isActive = button.dataset.commissionMethodActive === "true";
          const newStatus = !isActive;

          const confirmed = window.confirm(
            newStatus
              ? "Voulez-vous activer ce moyen de réception ?"
              : "Voulez-vous désactiver ce moyen de réception ?"
          );

          if (!confirmed) return;

          button.disabled = true;
          button.textContent = "Modification...";

          try {
            const result = await supabaseClient.rpc(
              "globexa_admin_set_commission_method_status",
              {
                p_method_id: methodId,
                p_is_active: newStatus
              }
            );

            if (result.error) throw result.error;

            await loadFinance();

          } catch (error) {
            const message = document.getElementById(
              "financeCommissionMethodsMessage"
            );

            if (message) {
              message.innerHTML = financeMessage(
                error.message || "Impossible de modifier ce moyen.",
                "error"
              );
            }

            button.disabled = false;
            button.textContent = isActive ? "Désactiver" : "Activer";
          }
        });
      }
    );
     const supplierForm = document.getElementById(
      "globexaSupplierPayoutForm"
    );

    if (supplierForm) {
      supplierForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const message = document.getElementById(
          "financeSupplierMessage"
        );

        const user = financeUser();

        if (!user) {
          message.innerHTML = financeMessage(
            "Vous devez être connecté.",
            "error"
          );
          return;
        }

        const data = new FormData(supplierForm);

        const methodCode = String(data.get("method_code") || "");
        const accountHolder = String(data.get("account_holder") || "").trim();
        const accountReference = String(data.get("account_reference") || "").trim();
        const currency = String(data.get("currency") || "").trim().toUpperCase();

        if (!FINANCE_METHODS[methodCode]) {
          message.innerHTML = financeMessage(
            "Moyen de réception non autorisé.",
            "error"
          );
          return;
        }

        if (currency && !/^[A-Z]{3}$/.test(currency)) {
          message.innerHTML = financeMessage(
            "La devise doit contenir trois lettres, par exemple USD.",
            "error"
          );
          return;
        }

        const button = supplierForm.querySelector("button");
        button.disabled = true;
        button.textContent = "Enregistrement...";

        try {
          const result = await supabaseClient
            .from("globexa_supplier_payout_methods")
            .insert({
              supplier_user_id: user.id,
              method_code: methodCode,
              account_holder: accountHolder,
              account_reference: accountReference,
              bank_name: String(data.get("bank_name") || "").trim() || null,
              country: String(data.get("country") || "").trim() || null,
              currency: currency || null
            });

          if (result.error) throw result.error;

          message.innerHTML = financeMessage(
            "Moyen de réception enregistré.",
            "success"
          );

          await loadFinance();

        } catch (error) {
          message.innerHTML = financeMessage(
            error.message || "Impossible d'enregistrer ce moyen.",
            "error"
          );

          button.disabled = false;
          button.textContent = "Enregistrer mon moyen de réception";
        }
      });
    }

    document.querySelectorAll(".financeConfirmPayout").forEach(
      function (form) {
        form.addEventListener("submit", async function (event) {
          event.preventDefault();

          const reference = String(
            new FormData(form).get("external_reference") || ""
          ).trim();

          if (reference.length < 3) return;

          const confirmed = window.confirm(
            "Confirmez uniquement si le paiement Yiriwa Pay a réellement été effectué. Continuer ?"
          );

          if (!confirmed) return;

          const button = form.querySelector("button");
          button.disabled = true;
          button.textContent = "Confirmation...";

          try {
            const result = await supabaseClient.rpc(
              "globexa_admin_confirm_payout",
              {
                p_payout_id: form.dataset.payoutId,
                p_external_reference: reference
              }
            );

            if (result.error) throw result.error;

            const message = document.getElementById(
              "financePayoutMessage"
            );

            if (message) {
              message.innerHTML = financeMessage(
                "Retrait marqué comme payé avec la référence fournie.",
                "success"
              );
            }

            await loadFinance();

          } catch (error) {
            const message = document.getElementById(
              "financePayoutMessage"
            );

            if (message) {
              message.innerHTML = financeMessage(
                error.message || "Impossible de confirmer le retrait.",
                "error"
              );
            }

            button.disabled = false;
            button.textContent = "Confirmer après paiement réel";
          }
        });
      }
    );
  }

  window.loadFinance = loadFinance;

})();
