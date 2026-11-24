
/* =====================================================
   GLOBEXA — CODE 8
   FICHIER : messages.js
   Messagerie, négociation et demandes de devis
   ===================================================== */

(() => {
  "use strict";

  if (!window.supabase) {
    console.error("GLOBEXA : bibliothèque Supabase absente.");
    return;
  }

  const SUPABASE_URL =
    "https://xlxkiyihagoupsajwmze.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_3W39fAVPXUDlkCb8Gnzovw_dolfa7P6";

  const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  const $ = id => document.getElementById(id);

  let currentUser = null;
  let currentConversation = null;
  let refreshChannel = null;

  function safe(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[char]
    );
  }

  function showMessage(message, error = false) {
    const box = $("messagePanel");
    if (!box) return;

    const notice = document.createElement("p");
    notice.className = error
      ? "globexa-chat-error"
      : "globexa-chat-success";

    notice.textContent = message;
    box.prepend(notice);

    setTimeout(() => notice.remove(), 5000);
  }

  function installStyles() {
    if ($("globexaMessagesStyles")) return;

    const style = document.createElement("style");
    style.id = "globexaMessagesStyles";

    style.textContent = `
      .gx-messages {
        display:grid;
        grid-template-columns:300px minmax(0,1fr);
        gap:18px;
        margin-top:20px;
      }

      .gx-box {
        background:#fff;
        border:1px solid #e5eaf0;
        border-radius:14px;
        padding:16px;
        min-width:0;
      }

      .gx-title {
        color:#123b70;
        font-weight:800;
        margin-bottom:14px;
      }

      .gx-conversation {
        display:block;
        width:100%;
        text-align:left;
        border:1px solid #e7edf4;
        background:#f8fafc;
        padding:13px;
        border-radius:10px;
        margin-bottom:9px;
        cursor:pointer;
      }

      .gx-conversation.active {
        border-color:#f28c28;
        background:#fff7ed;
      }

      .gx-conversation strong {
        display:block;
        color:#123b70;
        margin-bottom:5px;
      }

      .gx-muted {
        color:#718096;
        font-size:13px;
      }

      .gx-chat-window {
        display:flex;
        flex-direction:column;
        min-height:430px;
      }

      .gx-chat-header {
        border-bottom:1px solid #e5eaf0;
        padding-bottom:13px;
        margin-bottom:12px;
        color:#123b70;
        font-weight:800;
      }

      .gx-chat-body {
        flex:1;
        min-height:240px;
        max-height:430px;
        overflow-y:auto;
        padding:10px 3px;
      }

      .gx-bubble {
        max-width:82%;
        padding:11px 14px;
        border-radius:13px;
        margin:9px 0;
        overflow-wrap:anywhere;
        white-space:pre-wrap;
      }

      .gx-mine {
        background:#e8f1ff;
        margin-left:auto;
      }

      .gx-theirs {
        background:#f0f2f5;
        margin-right:auto;
      }

      .gx-time {
        display:block;
        font-size:11px;
        color:#718096;
        margin-top:5px;
      }

      .gx-chat-form {
        display:flex;
        gap:8px;
        margin-top:12px;
      }

      .gx-chat-form input {
        flex:1;
        min-width:0;
      }

      .gx-form {
        display:grid;
        gap:10px;
        max-width:650px;
      }

      .gx-form input,
      .gx-form textarea,
      .gx-chat-form input {
        width:100%;
        box-sizing:border-box;
        border:1px solid #d9e1eb;
        border-radius:9px;
        padding:12px;
        font:inherit;
      }

      .gx-form textarea {
        min-height:110px;
        resize:vertical;
      }

      .gx-btn {
        background:#f28c28;
        color:white;
        border:0;
        border-radius:9px;
        padding:12px 16px;
        font-weight:700;
        cursor:pointer;
      }

      .gx-btn:disabled {
        opacity:.5;
        cursor:not-allowed;
      }

      .gx-chat-error {
        color:#b42318;
        background:#fff0ef;
        padding:10px;
        border-radius:8px;
      }

      .gx-chat-success {
        color:#087443;
        background:#eafaf1;
        padding:10px;
        border-radius:8px;
      }

      @media(max-width:700px) {
        .gx-messages {
          grid-template-columns:1fr;
        }

        .gx-chat-window {
          min-height:380px;
        }

        .gx-chat-body {
          max-height:350px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  async function getUser() {
    const { data, error } = await db.auth.getUser();

    if (error) throw error;

    currentUser = data.user;
    return currentUser;
  }

  async function getConversationRows() {
    const { data, error } = await db
      .from("conversations")
      .select("id,buyer_id,seller_id,created_at")
      .or(
        `buyer_id.eq.${currentUser.id},seller_id.eq.${currentUser.id}`
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    return data || [];
  }

  function renderNewConversation() {
    const box = $("gxNewConversation");
    if (!box) return;

    box.innerHTML = `
      <form id="gxNewConversationForm" class="gx-form">
        <h3 class="gx-title">Nouvelle conversation</h3>

        <label>Identifiant du fournisseur</label>

        <input
          id="gxSellerId"
          required
          placeholder="Identifiant utilisateur du fournisseur"
        >

        <button class="gx-btn" type="submit">
          Ouvrir la discussion
        </button>

        <p class="gx-muted">
          Demande l'identifiant du fournisseur si tu ne le connais pas.
        </p>
      </form>
    `;

    $("gxNewConversationForm").addEventListener(
      "submit",
      createConversation
    );
  }

  function renderConversationList(rows) {
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
      buttons.innerHTML =
        '<p class="gx-muted">Aucune conversation pour le moment.</p>';
      return;
    }

    rows.forEach(row => {
      const other = row.buyer_id === currentUser.id
        ? row.seller_id
        : row.buyer_id;

      const button = document.createElement("button");

      button.type = "button";
      button.className =
        "gx-conversation" +
        (currentConversation === row.id ? " active" : "");

      button.innerHTML = `
        <strong>Discussion fournisseur / acheteur</strong>
        <span class="gx-muted">
          Identifiant : ${safe(other)}
        </span>
      `;

      button.addEventListener("click", () => {
        openConversation(row.id).catch(error => {
          showMessage(error.message, true);
        });
      });

      buttons.appendChild(button);
    });
  }

  async function loadConversations() {
    const rows = await getConversationRows();

    renderConversationList(rows);
    renderNewConversation();

    if (!currentConversation && rows.length) {
      await openConversation(rows[0].id);
    }
  }

  async function openConversation(id) {
    currentConversation = id;

    const { data: conversation, error } = await db
      .from("conversations")
      .select("id,buyer_id,seller_id")
      .eq("id", id)
      .single();

    if (error) throw error;

    if (
      conversation.buyer_id !== currentUser.id &&
      conversation.seller_id !== currentUser.id
    ) {
      throw new Error("Accès à cette conversation refusé.");
    }

    const other = conversation.buyer_id === currentUser.id
      ? conversation.seller_id
      : conversation.buyer_id;

    const panel = $("messagePanel");
    if (!panel) return;

    panel.innerHTML = `
      <div class="gx-box gx-chat-window">

        <div class="gx-chat-header">
          Conversation GLOBEXA

          <div class="gx-muted">
            Interlocuteur : ${safe(other)}
          </div>
        </div>

        <div id="gxChatBody" class="gx-chat-body">
          <p class="gx-muted">Chargement des messages...</p>
        </div>

        <form id="gxSendForm" class="gx-chat-form">
          <input
            id="gxMessageInput"
            maxlength="5000"
            placeholder="Écrire un message..."
            required
          >

          <button class="gx-btn" type="submit">
            Envoyer
          </button>
        </form>

        <button
          type="button"
          id="gxOfferButton"
          class="gx-btn"
          style="margin-top:10px"
        >
          Proposer un prix
        </button>

      </div>
    `;

    $("gxSendForm").addEventListener(
      "submit",
      sendMessage
    );

    $("gxOfferButton").addEventListener(
      "click",
      () => proposePrice().catch(error => {
        showMessage(error.message, true);
      })
    );

    await loadMessages();

    const rows = await getConversationRows();
    renderConversationList(rows);
    renderNewConversation();

    subscribeToMessages(id);
  }

  async function loadMessages() {
    if (!currentConversation) return;

    const { data, error } = await db
      .from("messages")
      .select("id,sender_id,body,created_at")
      .eq("conversation_id", currentConversation)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const body = $("gxChatBody");
    if (!body) return;

    if (!data?.length) {
      body.innerHTML =
        '<p class="gx-muted">Commencez votre discussion.</p>';
      return;
    }

    body.innerHTML = data.map(item => {
      const mine = item.sender_id === currentUser.id;

      return `
        <div class="gx-bubble ${mine ? "gx-mine" : "gx-theirs"}">
          ${safe(item.body)}

          <span class="gx-time">
            ${new Date(item.created_at).toLocaleString("fr-FR")}
          </span>
        </div>
      `;
    }).join("");

    body.scrollTop = body.scrollHeight;
  }

  async function sendMessage(event) {
    event.preventDefault();

    const input = $("gxMessageInput");
    const message = input?.value.trim();

    if (!message || !currentConversation) return;

    const button = event.submitter;
    if (button) button.disabled = true;

    try {
      const { error } = await db
        .from("messages")
        .insert({
          conversation_id: currentConversation,
          sender_id: currentUser.id,
          body: message
        });

      if (error) throw error;

      input.value = "";
      await loadMessages();

    } catch (error) {
      showMessage(error.message || "Envoi impossible.", true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function proposePrice() {
    const amount = prompt(
      "Quel prix proposes-tu ? (exemple : 11.50)"
    );

    if (!amount || !amount.trim()) return;

    const quantity = prompt("Pour quelle quantité ?");

    if (!quantity || !/^[1-9][0-9]*$/.test(quantity)) {
      showMessage("Quantité incorrecte.", true);
      return;
    }

    const currency = prompt("Devise (USD, EUR, XOF...)", "USD");

    if (!currency || !/^[A-Za-z]{3}$/.test(currency)) {
      showMessage("Devise incorrecte.", true);
      return;
    }

    const offer =
      "PROPOSITION DE PRIX\n" +
      "Prix unitaire : " + amount.trim() + " " +
      currency.toUpperCase() + "\n" +
      "Quantité : " + quantity + "\n" +
      "Cette proposition doit être confirmée par l'autre partie.";

    const { error } = await db
      .from("messages")
      .insert({
        conversation_id: currentConversation,
        sender_id: currentUser.id,
        body: offer
      });

    if (error) throw error;

    await loadMessages();
  }

  function subscribeToMessages(id) {
    if (refreshChannel) {
      db.removeChannel(refreshChannel);
      refreshChannel = null;
    }

    refreshChannel = db
      .channel("globexa-messages-" + id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: "conversation_id=eq." + id
        },
        () => {
          loadMessages().catch(error => {
            console.error("Actualisation messages :", error);
          });
        }
      )
      .subscribe();
  }

  async function createConversation(event) {
    event.preventDefault();

    const sellerInput = $("gxSellerId");
    const sellerId = sellerInput?.value.trim();

    if (!sellerId) return;

    if (sellerId === currentUser.id) {
      showMessage(
        "Tu ne peux pas ouvrir une conversation avec toi-même.",
        true
      );
      return;
    }

    const button = event.submitter;
    if (button) button.disabled = true;

    try {
      const { data: existing, error: searchError } = await db
        .from("conversations")
        .select("id")
        .eq("buyer_id", currentUser.id)
        .eq("seller_id", sellerId)
        .maybeSingle();

      if (searchError) throw searchError;

      if (existing) {
        await openConversation(existing.id);
        return;
      }

      const { data, error } = await db
        .from("conversations")
        .insert({
          buyer_id: currentUser.id,
          seller_id: sellerId
        })
        .select("id")
        .single();

      if (error) throw error;

      sellerInput.value = "";

      await loadConversations();
      await openConversation(data.id);

      showMessage("Conversation créée.");

    } catch (error) {
      showMessage(
        error.message || "Impossible de créer la conversation.",
        true
      );
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function createRFQ(event) {
    event.preventDefault();

    const title = $("gxRfqTitle").value.trim();
    const category = $("gxRfqCategory").value.trim();
    const quantity = Number($("gxRfqQuantity").value);
    const budgetValue = $("gxRfqBudget").value;
    const country = $("gxRfqCountry").value.trim();
    const description = $("gxRfqDescription").value.trim();

    if (
      !title ||
      !description ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      showMessage("Vérifie les informations de ta demande.", true);
      return;
    }

    const budget = budgetValue === ""
      ? null
      : Number(budgetValue);

    if (
      budget !== null &&
      (!Number.isFinite(budget) || budget < 0)
    ) {
      showMessage("Le budget indiqué est incorrect.", true);
      return;
    }

    const button = $("gxRfqSubmit");
    button.disabled = true;

    try {
      const { error } = await db
        .from("rfqs")
        .insert({
          buyer_id: currentUser.id,
          title,
          category: category || null,
          quantity,
          budget,
          country: country || null,
          description
        });

      if (error) throw error;

      $("gxRfqForm").reset();

      showMessage("Ta demande de devis a été enregistrée.");

    } catch (error) {
      showMessage(
        error.message || "Impossible d'enregistrer la demande.",
        true
      );
    } finally {
      button.disabled = false;
    }
  }

  function renderRFQ() {
    const box = $("rfqContent");
    if (!box) return;

    box.innerHTML = `
      <div class="gx-box">

        <h3 class="gx-title">Demander un devis</h3>

        <form id="gxRfqForm" class="gx-form">

          <label>Produit recherché</label>
          <input
            id="gxRfqTitle"
            maxlength="200"
            required
            placeholder="Exemple : Téléphones Android"
          >

          <label>Catégorie</label>
          <input
            id="gxRfqCategory"
            maxlength="150"
            placeholder="Électronique"
          >

          <label>Quantité souhaitée</label>
          <input
            id="gxRfqQuantity"
            type="number"
            min="1"
            step="1"
            required
          >

          <label>Budget total (facultatif)</label>
          <input
            id="gxRfqBudget"
            type="number"
            min="0"
            step="0.01"
          >

          <label>Pays de livraison</label>
          <input
            id="gxRfqCountry"
            maxlength="100"
            placeholder="Burkina Faso"
          >

          <label>Description détaillée</label>
          <textarea
            id="gxRfqDescription"
            maxlength="5000"
            required
            placeholder="Décris le produit et ses caractéristiques..."
          ></textarea>

          <button
            id="gxRfqSubmit"
            class="gx-btn"
            type="submit"
          >
            Envoyer ma demande
          </button>

        </form>
      </div>
    `;

    $("gxRfqForm").addEventListener(
      "submit",
      createRFQ
    );
  }

  async function start() {
    installStyles();

    try {
      const user = await getUser();

      if (!user) {
        if ($("conversationList")) {
          $("conversationList").textContent =
            "Connecte-toi pour accéder à tes messages.";
        }

        if ($("gxNewConversation")) {
          $("gxNewConversation").textContent =
            "Connecte-toi pour démarrer une conversation.";
        }

        if ($("rfqContent")) {
          $("rfqContent").textContent =
            "Connecte-toi pour demander un devis.";
        }

        return;
      }

      renderRFQ();
      renderNewConversation();

      await loadConversations();

    } catch (error) {
      console.error("GLOBEXA Messages :", error);

      showMessage(
        error.message || "Erreur de chargement.",
        true
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  window.globexaMessages = {
    reload: start,
    openConversation
  };

})();
