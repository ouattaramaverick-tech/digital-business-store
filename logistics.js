
/* =========================================================
   GLOBEXA — CODE 10
   LOGISTIQUE, TRANSITAIRES ET SUIVI DES EXPÉDITIONS
   ========================================================= */

(function () {
  "use strict";

  const LOGISTICS_STATUSES = {
    preparing: "En préparation",
    in_transit: "En transit",
    customs: "En douane",
    delivered: "Livré",
    exception: "Incident"
  };

  function logisticsEscape(value) {
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

  function logisticsDate(value) {
    if (!value) return "Non renseignée";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return logisticsEscape(value);
    }

    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
  }

  function logisticsStatus(value) {
    return LOGISTICS_STATUSES[value] || "Statut inconnu";
  }

  function logisticsMessage(message, type) {
    const colors = {
      success: "#15803d",
      error: "#dc2626",
      info: "#2563eb"
    };

    return `
      <div style="
        padding:12px;
        margin:12px 0;
        border-radius:8px;
        background:#f1f5f9;
        color:${colors[type] || colors.info};
      ">
        ${logisticsEscape(message)}
      </div>
    `;
  }

  function logisticsUser() {
    return typeof state !== "undefined" && state
      ? state.user
      : null;
  }

  function logisticsContainer() {
    return document.getElementById("logisticsList");
  }

  function logisticsButtonStyle() {
    return `
      background:#f97316;
      color:white;
      border:0;
      padding:11px 16px;
      border-radius:7px;
      cursor:pointer;
      font-weight:600;
    `;
  }

  function renderTransitaires(transitaires) {
    if (!transitaires.length) {
      return `
        <p>Aucun transitaire approuvé pour le moment.</p>
      `;
    }

    return transitaires.map(function (item) {
      return `
        <article style="
          border:1px solid #e2e8f0;
          padding:14px;
          border-radius:10px;
          margin:12px 0;
          background:#fff;
        ">
          <h3>${logisticsEscape(item.company_name)}</h3>
          <p>
            Pays :
            ${logisticsEscape(item.country || "Non renseigné")}
          </p>
          <p>
            Contact :
            ${logisticsEscape(item.contact || "Non renseigné")}
          </p>
          <p style="color:#15803d;font-weight:600">
            Transitaire approuvé
          </p>
        </article>
      `;
    }).join("");
  }

  function renderRegistration(profile) {
    if (!logisticsUser()) {
      return `
        <h3>Devenir transitaire</h3>
        <p>Connectez-vous pour déposer une candidature.</p>
      `;
    }

    if (profile) {
      if (profile.status === "approved") {
        return `
          <h3>Espace transitaire</h3>
          <p style="color:#15803d">
            Votre compte transitaire est approuvé.
          </p>
        `;
      }

      return `
        <h3>Candidature transitaire</h3>
        <p style="color:#b45309">
          Votre candidature est en attente de validation.
        </p>
      `;
    }

    return `
      <h3>Devenir transitaire</h3>

      <form id="globexaTransitaireForm">
        <label>Nom de votre entreprise</label>
        <input
          name="company_name"
          type="text"
          required
          maxlength="150"
          placeholder="Nom de l'entreprise"
          style="width:100%;padding:11px;margin:7px 0 12px"
        >

        <label>Pays</label>
        <input
          name="country"
          type="text"
          required
          maxlength="100"
          placeholder="Exemple : Burkina Faso"
          style="width:100%;padding:11px;margin:7px 0 12px"
        >

        <label>Contact</label>
        <input
          name="contact"
          type="text"
          maxlength="150"
          placeholder="Téléphone ou email"
          style="width:100%;padding:11px;margin:7px 0 12px"
        >

        <button type="submit" style="${logisticsButtonStyle()}">
          Envoyer ma candidature
        </button>
      </form>

      <div id="globexaTransitaireMessage"></div>
    `;
  }

  function renderTrackingForm(shipment, profile) {
    if (
      !profile ||
      profile.status !== "approved" ||
      shipment.transitaire_id !== profile.id
    ) {
      return "";
    }

    return `
      <form
        class="globexaTrackingForm"
        data-shipment-id="${logisticsEscape(shipment.id)}"
        style="margin-top:15px"
      >
        <h4>Ajouter une mise à jour</h4>

        <label>Nouvelle étape</label>
        <select name="event_status" required
          style="width:100%;padding:10px;margin:7px 0">
          <option value="preparing">En préparation</option>
          <option value="in_transit">En transit</option>
          <option value="customs">En douane</option>
          <option value="exception">Incident</option>
        </select>

        <label>Lieu</label>
        <input
          name="location"
          maxlength="150"
          placeholder="Ville ou pays"
          style="width:100%;padding:10px;margin:7px 0"
        >

        <label>Détails</label>
        <textarea
          name="details"
          maxlength="1000"
          placeholder="Informations sur l'expédition"
          style="width:100%;padding:10px;margin:7px 0"
        ></textarea>

        <button type="submit" style="${logisticsButtonStyle()}">
          Enregistrer le suivi
        </button>
      </form>
    `;
  }

  function renderShipments(shipments, events, profile) {
    if (!logisticsUser()) {
      return "<p>Connectez-vous pour consulter vos expéditions.</p>";
    }

    if (!shipments.length) {
      return "<p>Aucune expédition disponible pour le moment.</p>";
    }

    return shipments.map(function (shipment) {
      const shipmentEvents = events
        .filter(function (event) {
          return event.shipment_id === shipment.id;
        })
        .sort(function (a, b) {
          return new Date(b.occurred_at) - new Date(a.occurred_at);
        });

      return `
        <article style="
          border:1px solid #cbd5e1;
          border-radius:10px;
          padding:15px;
          margin:14px 0;
          background:#fff;
        ">
          <h3>Expédition</h3>

          <p>
            Transporteur :
            ${logisticsEscape(shipment.carrier || "À déterminer")}
          </p>

          <p>
            Numéro de suivi :
            <strong>
              ${logisticsEscape(shipment.tracking_number || "Non disponible")}
            </strong>
          </p>

          <p>
            Départ :
            ${logisticsEscape(shipment.origin || "Non renseigné")}
          </p>

          <p>
            Destination :
            ${logisticsEscape(shipment.destination || "Non renseignée")}
          </p>

          <p>
            Statut :
            <strong>${logisticsEscape(logisticsStatus(shipment.status))}</strong>
          </p>

          <p>
            Livraison estimée :
            ${logisticsDate(shipment.estimated_delivery)}
          </p>

          <h4>Historique du suivi</h4>

          ${
            shipmentEvents.length
              ? shipmentEvents.map(function (event) {
                  return `
                    <div style="
                      border-left:3px solid #f97316;
                      padding:8px 12px;
                      margin:10px 0;
                    ">
                      <strong>
                        ${logisticsEscape(logisticsStatus(event.event_status))}
                      </strong>
                      <p>${logisticsEscape(event.location || "Lieu non renseigné")}</p>
                      <p>${logisticsEscape(event.details || "")}</p>
                      <small>${logisticsDate(event.occurred_at)}</small>
                    </div>
                  `;
                }).join("")
              : "<p>Aucune mise à jour pour le moment.</p>"
          }

          ${renderTrackingForm(shipment, profile)}

          <div class="globexaTrackingMessage"></div>
        </article>
      `;
    }).join("");
  }

  async function loadLogistics() {
    const container = logisticsContainer();

    if (!container) return;

    container.innerHTML = "<p>Chargement de la logistique...</p>";

    try {
      if (typeof ensureSupabaseClient === "function") {
        await ensureSupabaseClient();
      }

      if (!supabaseClient) {
        throw new Error("Connexion à Supabase indisponible.");
      }

      const user = logisticsUser();

      const directoryResult = await supabaseClient
        .from("transitaires")
        .select("id, company_name, country, contact, status")
        .eq("status", "approved")
        .order("company_name", { ascending: true });

      if (directoryResult.error) throw directoryResult.error;

      let profile = null;
      let shipments = [];
      let events = [];

      if (user) {
        const profileResult = await supabaseClient
          .from("transitaires")
          .select("id, user_id, company_name, status")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileResult.error) throw profileResult.error;

        profile = profileResult.data;

        const shipmentResult = await supabaseClient
          .from("globexa_shipments")
          .select(`
            id,
            order_id,
            carrier,
            tracking_number,
            origin,
            destination,
            status,
            estimated_delivery,
            transitaire_id,
            created_at
          `)
          .order("created_at", { ascending: false });

        if (shipmentResult.error) throw shipmentResult.error;

        shipments = shipmentResult.data || [];

        if (shipments.length) {
          const shipmentIds = shipments.map(function (item) {
            return item.id;
          });

          const eventResult = await supabaseClient
            .from("globexa_tracking_events")
            .select(`
              id,
              shipment_id,
              event_status,
              location,
              details,
              occurred_at
            `)
            .in("shipment_id", shipmentIds)
            .order("occurred_at", { ascending: false });

          if (eventResult.error) throw eventResult.error;

          events = eventResult.data || [];
        }
      }

      container.innerHTML = `
        <div style="display:grid;gap:20px">

          <section>
            <h2>Transitaires disponibles</h2>
            ${renderTransitaires(directoryResult.data || [])}
          </section>

          <section>
            ${renderRegistration(profile)}
          </section>

          <section>
            <h2>Suivi de mes expéditions</h2>
            ${renderShipments(shipments, events, profile)}
          </section>

        </div>
      `;

      setupLogisticsEvents();

    } catch (error) {
      console.error("GLOBEXA logistics:", error);

      container.innerHTML = logisticsMessage(
        error.message || "Impossible de charger la logistique.",
        "error"
      );
    }
  }

  function setupLogisticsEvents() {
    const registrationForm = document.getElementById(
      "globexaTransitaireForm"
    );

    if (registrationForm) {
      registrationForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const message = document.getElementById(
          "globexaTransitaireMessage"
        );

        const user = logisticsUser();

        if (!user) {
          message.innerHTML = logisticsMessage(
            "Vous devez être connecté.",
            "error"
          );
          return;
        }

        const formData = new FormData(registrationForm);

        const companyName = String(
          formData.get("company_name") || ""
        ).trim();

        const country = String(
          formData.get("country") || ""
        ).trim();

        const contact = String(
          formData.get("contact") || ""
        ).trim();

        if (!companyName || !country) {
          message.innerHTML = logisticsMessage(
            "Remplissez le nom de l'entreprise et le pays.",
            "error"
          );
          return;
        }

        const button = registrationForm.querySelector("button");
        button.disabled = true;
        button.textContent = "Envoi en cours...";

        try {
          const result = await supabaseClient
            .from("transitaires")
            .insert({
              user_id: user.id,
              company_name: companyName,
              country: country,
              contact: contact || null,
              status: "pending"
            });

          if (result.error) throw result.error;

          message.innerHTML = logisticsMessage(
            "Candidature envoyée. Elle doit être approuvée par l'administration.",
            "success"
          );

          await loadLogistics();

        } catch (error) {
          console.error("Transitaire registration:", error);

          message.innerHTML = logisticsMessage(
            error.message || "Échec de l'envoi de la candidature.",
            "error"
          );

          button.disabled = false;
          button.textContent = "Envoyer ma candidature";
        }
      });
    }

    document.querySelectorAll(".globexaTrackingForm").forEach(
      function (form) {
        form.addEventListener("submit", async function (event) {
          event.preventDefault();

          const user = logisticsUser();

          if (!user) return;

          const message = form.parentElement.querySelector(
            ".globexaTrackingMessage"
          );

          const formData = new FormData(form);

          const eventStatus = String(
            formData.get("event_status") || ""
          );

          const allowedStatuses = [
            "preparing",
            "in_transit",
            "customs",
            "exception"
          ];

          if (!allowedStatuses.includes(eventStatus)) {
            message.innerHTML = logisticsMessage(
              "Statut non autorisé.",
              "error"
            );
            return;
          }

          const button = form.querySelector("button");
          button.disabled = true;
          button.textContent = "Enregistrement...";

          try {
            const result = await supabaseClient
              .from("globexa_tracking_events")
              .insert({
                shipment_id: form.dataset.shipmentId,
                event_status: eventStatus,
                location: String(formData.get("location") || "").trim() || null,
                details: String(formData.get("details") || "").trim() || null
              });

            if (result.error) throw result.error;

            message.innerHTML = logisticsMessage(
              "Mise à jour du suivi enregistrée.",
              "success"
            );

            await loadLogistics();

          } catch (error) {
            console.error("Tracking event:", error);

            message.innerHTML = logisticsMessage(
              error.message || "Impossible d'enregistrer cette mise à jour.",
              "error"
            );

            button.disabled = false;
            button.textContent = "Enregistrer le suivi";
          }
        });
      }
    );
  }

  window.loadLogistics = loadLogistics;

})();
