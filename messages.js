
/* =====================================================
   GLOBEXA — MESSAGERIE ET DEMANDES DE DEVIS
   Tables utilisées :
   globexa_conversations
   globexa_messages
   globexa_rfqs
   globexa_quotes
   ===================================================== */

(() => {
  "use strict";

  if (!window.supabase) {
    console.error("GLOBEXA : Supabase n'est pas chargé.");
    return;
  }

  const db = window.supabase.createClient(
    "https://xlxkiyihagoupsajwmze.supabase.co",
    "sb_publishable_3W39fAVPXUDlkCb8Gnzovw_dolfa7P6"
  );

  const $ = id => document.getElementById(id);

  let currentUser = null;
  let currentConversation = null;
  let messageChannel = null;
  let activeStore = false;

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function notice(message, error = false) {
    const box = $("messagePanel") || $("rfqContent");
    if (!box) return;

    const p = document.createElement("p");
    p.textContent = message;
    p.style.padding = "10px";
    p.style.borderRadius = "8px";
    p.style.color = error ? "#b42318" : "#087443";
    p.style.background = error ? "#fff0ef" : "#eafaf1";
    box.prepend(p);
  }

  function installStyles() {
    if ($("globexaMessagesStyles")) return;

    const style = document.createElement("style");
    style.id = "globexaMessagesStyles";
    style.textContent = `
      .gx-messages {
        display:grid;
        grid-template-columns:minmax(220px,300px) minmax(0,1fr);
        gap:16px;
      }
      .gx-box {
        background:#fff;
        border:1px solid #e5eaf0;
        border-radius:12px;
        padding:15px;
        min-width:0;
      }
      .gx-title {
        color:#123b70;
        font-weight:800;
        margin-bottom:12px;
      }
      .gx-form {
        display:grid;
        gap:10px;
      }
      .gx-form input,
      .gx-form textarea,
      .gx-form select {
        width:100%;
        box-sizing:border-box;
        padding:11px;
        border:1px solid #d9e1eb;
        border-radius:8px;
        font:inherit;
      }
      .gx-form textarea {
        min-height:100px;
      }
      .gx-btn {
        border:0;
        border-radius:8px;
        padding:11px 15px;
        background:#f28c28;
        color:white;
        font-weight:700;
        cursor:pointer;
      }
      .gx-btn:disabled {
        opacity:.5;
        cursor:not-allowed;
      }
      .gx-conversation {
        display:block;
        width:100%;
        text-align:left;
        padding:12px;
        margin-bottom:8px;
        border:1px solid #e5eaf0;
        border-radius:9px;
        background:#f8fafc;
        cursor:pointer;
      }
      .gx-conversation.active {
        border-color:#f28c28;
        background:#fff7ed;
      }
      .gx-chat-window {
        display:flex;
        flex-direction:column;
        min-height:380px;
      }
      .gx-chat-body {
        flex:1;
        min-height:230px;
        max-height:430px;
        overflow-y:auto;
        padding:10px 0;
      }
      .gx-bubble {
        max-width:82%;
        padding:10px 13px;
        margin:8px 0;
        border-radius:12px;
        white-space:pre-wrap;
        overflow-wrap:anywhere;
      }
      .gx-mine {
        margin-left:auto;
        background:#e8f1ff;
      }
      .gx-theirs {
        margin-right:auto;
        background:#f0f2f5;
      }
      .gx-muted {
        color:#718096;
        font-size:13px;
      }
      .gx-chat-form {
        display:flex;
        gap:8px;
        margin-top:10px;
      }
      .gx-chat-form input {
        flex:1;
        min-width:0;
        padding:11px;
        border:1px solid #d9e1eb;
        border-radius:8px;
      }
      .gx-rfq-card {
        border:1px solid #e5eaf0;
        border-radius:10px;
        padding:14px;
        margin:12px 0;
        background:#fff;
      }
      @media(max-width:700px) {
        .gx-messages {
          grid-template-columns:1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  async function getUser() {
    const { data, error } = await db.auth.getUser();
    if (error) throw error;
    currentUser = data.user || null;
    return currentUser;
  }

  async function checkActiveStore() {
    activeStore = false;
    if (!currentUser) return;

    const { data, error } = await db
      .from("globexa_stores")
      .select("id")
      .eq("owner_id", currentUser.id)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      console.warn("Vérification boutique :", error.message);
      return;
    }

    activeStore = Boolean(data);
  }

  async function loadSuppliers() {
    const { data, error } = await db
      .from("globexa_stores")
      .select("owner_id,company_name,country")
      .eq("status", "active")
      .eq("verification_status", "verified")
      .order("company_name");

    if (error) throw error;
    return data || [];
  }

  async function renderNewConversation() {
    const box = $("gxNewConversation");
    if (!box) return;

    if (!currentUser) {
      box.textContent = "Connecte-toi pour contacter un fournisseur.";
      return;
    }

    box.innerHTML = `
      <div class="gx-box">
        <h3 class="gx-title">Contacter un fournisseur</h3>
        <form id="gxNewConversationForm" class="gx-form">
          <label for="gxSupplierSelect">Choisir un fournisseur vérifié</label>
          <select id="gxSupplierSelect" required>
            <option value="">Chargement des fournisseurs...</option>
          </select>
          <button class="gx-btn" type="submit">
            Démarrer la discussion
          </button>
        </form>
      </div>
    `;

    const select = $("gxSupplierSelect");
    const { data, error } = await db
      .from("globexa_stores")
      .select("owner_id,company_name,country")
      .eq("status", "active")
      .eq("verification_status", "verified")
      .order("company_name");

    if (error) {
      select.innerHTML = `<option value="">Impossible de charger les fournisseurs</option>`;
      console.error(error);
      return;
    }

    const suppliers = (data || []).filter(
      item => item.owner_id !== currentUser.id
    );

    select.innerHTML = `
      <option value="">Sélectionner un fournisseur</option>
      ${suppliers.map(item => `
        <option value="${escapeHTML(item.owner_id)}">
          ${escapeHTML(item.company_name)} — ${escapeHTML(item.country || "")}
        </option>
      `).join("")}
    `;

    $("gxNewConversationForm").addEventListener(
      "submit",
      createConversation
    );
  }

  async function getConversationRows() {
    const { data, error } = await db
      .from("globexa_conversations")
      .select("id,buyer_id,supplier_id,product_id,created_at")
      .or(
        `buyer_id.eq.${currentUser.id},supplier_id.eq.${currentUser.id}`
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async function renderConversationList(rows) {
    const box = $("conversationList");
    if (!box) return;

    box.innerHTML = `
      <div class="gx-box">
        <h3 class="gx-title">Mes conversations</h3>
        <div id="gxConversationButtons"></div>
      </div>
    `;

    const buttons = $("gxConversationButtons");

    if (!rows.length) {
      buttons.textContent = "Aucune conversation pour le moment.";
      return;
    }

    rows.forEach(row => {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "gx-conversation" +
        (currentConversation === row.id ? " active" : "");

      const other = row.buyer_id === currentUser.id
        ? row.supplier_id
        : row.buyer_id;

      button.innerHTML = `
        <strong>Discussion GLOBEXA</strong>
        <div class="gx-muted">
          Fournisseur / acheteur : ${escapeHTML(other)}
        </div>
      `;

      button.addEventListener("click", () => {
        openConversation(row.id).catch(error => {
          notice(error.message, true);
        });
      });

      buttons.appendChild(button);
    });
  }

  async function loadConversations() {
    const rows = await getConversationRows();
    await renderConversationList(rows);

    if (!currentConversation && rows.length) {
      await openConversation(rows[0].id);
    }
  }

  async function createConversation(event) {
    event.preventDefault();

    const supplierId = $("gxSupplierSelect")?.value;
    if (!supplierId) {
      notice("Choisis un fournisseur.", true);
      return;
    }

    if (supplierId === currentUser.id) {
      notice("Tu ne peux pas démarrer une discussion avec toi-même.", true);
      return;
    }

    const button = event.submitter;
    if (button) button.disabled = true;

    try {
      const { data: existing, error: searchError } = await db
        .from("globexa_conversations")
        .select("id")
        .eq("buyer_id", currentUser.id)
        .eq("supplier_id", supplierId)
        .maybeSingle();

      if (searchError) throw searchError;

      if (existing) {
        await openConversation(existing.id);
        return;
      }

      const { data, error } = await db
        .from("globexa_conversations")
        .insert({
          buyer_id: currentUser.id,
          supplier_id: supplierId
        })
        .select("id")
        .single();

      if (error) throw error;

      currentConversation = data.id;
      await loadConversations();
      await openConversation(data.id);
      notice("Conversation créée.");

    } catch (error) {
      notice(error.message || "Impossible de créer la conversation.", true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function openConversation(id) {
    const { data: conversation, error } = await db
      .from("globexa_conversations")
      .select("id,buyer_id,supplier_id")
      .eq("id", id)
      .single();

    if (error) throw error;

    if (
      conversation.buyer_id !== currentUser.id &&
      conversation.supplier_id !== currentUser.id
    ) {
      throw new Error("Accès à cette conversation refusé.");
    }

    currentConversation = id;

    const other = conversation.buyer_id === currentUser.id
      ? conversation.supplier_id
      : conversation.buyer_id;

    const panel = $("messagePanel");
    if (!panel) return;

    panel.innerHTML = `
      <div class="gx-box gx-chat-window">
        <div>
          <strong>Conversation GLOBEXA</strong>
          <div class="gx-muted">Interlocuteur : ${escapeHTML(other)}</div>
        </div>

        <div id="gxChatBody" class="gx-chat-body">
          Chargement des messages...
        </div>

        <form id="gxSendForm" class="gx-chat-form">
          <input
            id="gxMessageInput"
            maxlength="5000"
            placeholder="Écrire un message..."
            required
          >
          <button class="gx-btn" type="submit">Envoyer</button>
        </form>
      </div>
    `;

    $("gxSendForm").addEventListener("submit", sendMessage);

    await loadMessages();
    await subscribeToMessages(id);
    await renderConversationList(await getConversationRows());
  }

  async function loadMessages() {
    if (!currentConversation) return;

    const { data, error } = await db
      .from("globexa_messages")
      .select("id,sender_id,body,created_at")
      .eq("conversation_id", currentConversation)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const body = $("gxChatBody");
    if (!body) return;

    if (!data?.length) {
      body.textContent = "Commencez votre discussion.";
      return;
    }

    body.innerHTML = data.map(item => `
      <div class="gx-bubble ${
        item.sender_id === currentUser.id ? "gx-mine" : "gx-theirs"
      }">
        ${escapeHTML(item.body)}
        <div class="gx-muted">
          ${new Date(item.created_at).toLocaleString("fr-FR")}
        </div>
      </div>
    `).join("");

    body.scrollTop = body.scrollHeight;
  }

  async function sendMessage(event) {
    event.preventDefault();

    const input = $("gxMessageInput");
    const body = input?.value.trim();

    if (!body || !currentConversation) return;

    const button = event.submitter;
    if (button) button.disabled = true;

    try {
      const { error } = await db
        .from("globexa_messages")
        .insert({
          conversation_id: currentConversation,
          sender_id: currentUser.id,
          body
        });

      if (error) throw error;

      input.value = "";
      await loadMessages();

    } catch (error) {
      notice(error.message || "Envoi du message impossible.", true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function subscribeToMessages(id) {
    if (messageChannel) {
      await db.removeChannel(messageChannel);
      messageChannel = null;
    }

    messageChannel = db
      .channel("globexa-messages-" + id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "globexa_messages",
          filter: "conversation_id=eq." + id
        },
        () => {
          loadMessages().catch(console.error);
        }
      )
      .subscribe();
  }

  async function loadCategories() {
    const { data, error } = await db
      .from("globexa_categories")
      .select("id,name")
      .order("name");

    if (error) throw error;
    return data || [];
  }

  async function renderRFQ() {
    const box = $("rfqContent");
    if (!box) return;

    if (!currentUser) {
      box.textContent = "Connecte-toi pour demander un devis.";
      return;
    }

    const categories = await loadCategories();

    box.innerHTML = `
      <div class="gx-box">
        <h3 class="gx-title">Demander un devis</h3>

        <form id="gxRfqForm" class="gx-form">
          <label for="gxRfqTitle">Produit recherché</label>
          <input id="gxRfqTitle" maxlength="200" required
            placeholder="Exemple : Téléphones Android">

          <label for="gxRfqCategory">Catégorie</label>
          <select id="gxRfqCategory">
            <option value="">Choisir une catégorie</option>
            ${categories.map(category => `
              <option value="${escapeHTML(category.id)}">
                ${escapeHTML(category.name)}
              </option>
            `).join("")}
          </select>

          <label for="gxRfqQuantity">Quantité souhaitée</label>
          <input id="gxRfqQuantity" type="number" min="1"
            step="1" required>

          <label for="gxRfqPrice">Prix cible unitaire (facultatif)</label>
          <input id="gxRfqPrice" type="number" min="0" step="0.01">

          <label for="gxRfqCurrency">Devise</label>
          <select id="gxRfqCurrency">
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="XOF">XOF</option>
            <option value="CNY">CNY</option>
          </select>

          <label for="gxRfqCountry">Pays de destination</label>
          <input id="gxRfqCountry" maxlength="100"
            placeholder="Burkina Faso">

          <label for="gxRfqDeadline">Date limite (facultatif)</label>
          <input id="gxRfqDeadline" type="date">

          <label for="gxRfqDetails">Description détaillée</label>
          <textarea id="gxRfqDetails" maxlength="5000" required
            placeholder="Décris le produit et tes exigences..."></textarea>

          <button id="gxRfqSubmit" class="gx-btn" type="submit">
            Envoyer ma demande
          </button>
        </form>
      </div>

      <div id="gxRfqList"></div>
    `;

    $("gxRfqForm").addEventListener("submit", createRFQ);
    await loadOpenRFQs();
  }

  async function createRFQ(event) {
    event.preventDefault();

    const title = $("gxRfqTitle").value.trim();
    const details = $("gxRfqDetails").value.trim();
    const quantity = Number($("gxRfqQuantity").value);
    const priceValue = $("gxRfqPrice").value;
    const targetPrice = priceValue === "" ? null : Number(priceValue);
    const deadline = $("gxRfqDeadline").value || null;

    if (!title || !details || !Number.isInteger(quantity) || quantity < 1) {
      notice("Vérifie le titre, la description et la quantité.", true);
      return;
    }

    if (
      targetPrice !== null &&
      (!Number.isFinite(targetPrice) || targetPrice < 0)
    ) {
      notice("Le prix cible est incorrect.", true);
      return;
    }

    const button = $("gxRfqSubmit");
    button.disabled = true;

    try {
      const payload = {
        buyer_id: currentUser.id,
        title,
        details,
        category_id: $("gxRfqCategory").value || null,
        quantity,
        target_price: targetPrice,
        currency: $("gxRfqCurrency").value,
        destination_country: $("gxRfqCountry").value.trim() || null,
        deadline,
        status: "open"
      };

      const { error } = await db
        .from("globexa_rfqs")
        .insert(payload);

      if (error) throw error;

      $("gxRfqForm").reset();
      notice("Ta demande de devis a été enregistrée.");
      await loadOpenRFQs();

    } catch (error) {
      notice(error.message || "Impossible d'enregistrer la demande.", true);
    } finally {
      button.disabled = false;
    }
  }

  async function loadOpenRFQs() {
    const box = $("gxRfqList");
    if (!box) return;

    const { data, error } = await db
      .from("globexa_rfqs")
      .select(`
        id,
        buyer_id,
        title,
        details,
        quantity,
        target_price,
        currency,
        destination_country,
        deadline,
        created_at
      `)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      box.textContent = "Impossible de charger les demandes de devis.";
      console.error(error);
      return;
    }

    if (!data?.length) {
      box.textContent = "Aucune demande de devis ouverte.";
      return;
    }

    box.innerHTML = `
      <h3 class="gx-title">Demandes de devis ouvertes</h3>
      ${data.map(rfq => `
        <article class="gx-rfq-card">
          <strong>${escapeHTML(rfq.title)}</strong>
          <p>${escapeHTML(rfq.details)}</p>
          <p>Quantité : ${Number(rfq.quantity)}</p>
          <p>
            Prix cible :
            ${rfq.target_price === null
              ? "Non précisé"
              : escapeHTML(rfq.target_price) + " " + escapeHTML(rfq.currency)}
          </p>
          <p>Destination : ${escapeHTML(rfq.destination_country || "Non précisée")}</p>
          ${activeStore && rfq.buyer_id !== currentUser.id ? `
            <form class="gx-form gx-quote-form" data-rfq-id="${escapeHTML(rfq.id)}">
              <input name="unit_price" type="number" min="0" step="0.01"
                placeholder="Ton prix unitaire" required>
              <input name="quote_quantity" type="number" min="1" step="1"
                value="${Number(rfq.quantity)}" required>
              <input name="lead_time_days" type="number" min="1"
                placeholder="Délai en jours">
              <input name="shipping_terms" maxlength="200"
                placeholder="Conditions de livraison">
              <textarea name="quote_message" maxlength="2000"
                placeholder="Message au client"></textarea>
              <button class="gx-btn" type="submit">Envoyer mon offre</button>
            </form>
          ` : ""}
        </article>
      `).join("")}
    `;

    box.querySelectorAll(".gx-quote-form").forEach(form => {
      form.addEventListener("submit", submitQuote);
    });
  }

  async function submitQuote(event) {
    event.preventDefault();

    if (!activeStore) {
      notice("Une boutique active est nécessaire pour envoyer une offre.", true);
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const button = form.querySelector("button");
    button.disabled = true;

    const unitPrice = Number(formData.get("unit_price"));
    const quantity = Number(formData.get("quote_quantity"));
    const leadTime = Number(formData.get("lead_time_days"));

    if (
      !Number.isFinite(unitPrice) || unitPrice < 0 ||
      !Number.isInteger(quantity) || quantity < 1
    ) {
      notice("Vérifie le prix et la quantité.", true);
      button.disabled = false;
      return;
    }

    try {
      const { error } = await db
        .from("globexa_quotes")
        .insert({
          rfq_id: form.dataset.rfqId,
          supplier_id: currentUser.id,
          unit_price: unitPrice,
          currency: "USD",
          quantity,
          lead_time_days: Number.isInteger(leadTime) && leadTime > 0
            ? leadTime
            : null,
          shipping_terms: String(formData.get("shipping_terms") || "").trim() || null,
          message: String(formData.get("quote_message") || "").trim() || null,
          status: "sent"
        });

      if (error) throw error;

      notice("Ton offre a été envoyée.");
      form.reset();

    } catch (error) {
      notice(error.message || "Impossible d'envoyer l'offre.", true);
    } finally {
      button.disabled = false;
    }
  }

  async function start() {
    installStyles();

    try {
      await getUser();

      if (!currentUser) {
        if ($("conversationList")) {
          $("conversationList").textContent =
            "Connecte-toi pour accéder à tes conversations.";
        }
        if ($("gxNewConversation")) {
          $("gxNewConversation").textContent =
            "Connecte-toi pour contacter un fournisseur.";
        }
        if ($("rfqContent")) {
          $("rfqContent").textContent =
            "Connecte-toi pour demander un devis.";
        }
        return;
      }

      await checkActiveStore();
      await renderNewConversation();
      await renderRFQ();
      await loadConversations();

    } catch (error) {
      console.error("GLOBEXA Messagerie :", error);
      notice(error.message || "Erreur de chargement.", true);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  window.globexaMessages = {
    reload: start,
    openConversation,
    loadOpenRFQs
  };

})();
