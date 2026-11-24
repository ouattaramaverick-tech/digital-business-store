
"use strict";

/* =====================================================
   GLOBEXA — CODE 7
   REELS : AFFICHAGE VIDÉO VERTICAL ET AUTOMATIQUE
   Utilise les tables et le stockage déjà existants.
   ===================================================== */

(function () {
  /* 1. STYLE DU FIL REELS */

  function installReelStyles() {
    if (document.getElementById("globexaReelStyles")) return;

    const style = document.createElement("style");
    style.id = "globexaReelStyles";

    style.textContent = `
      #reelFeed.globexa-reel-feed {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 20px;
        align-items: start;
      }

      .globexa-reel-card-v2 {
        position: relative;
        overflow: hidden;
        border-radius: 16px;
        background: #07172a;
        color: white;
        box-shadow: 0 5px 18px rgba(0,0,0,.12);
      }

      .globexa-reel-card-v2 video {
        display: block;
        width: 100%;
        aspect-ratio: 9 / 16;
        max-height: 620px;
        object-fit: cover;
        background: #07172a;
      }

      .globexa-reel-caption {
        padding: 13px;
        color: white;
        font-size: 14px;
        line-height: 1.5;
        overflow-wrap: anywhere;
      }

      .globexa-reel-date {
        display: block;
        margin-top: 6px;
        color: #b9c8d9;
        font-size: 11px;
      }

      .globexa-reel-empty {
        grid-column: 1 / -1;
        padding: 25px;
        text-align: center;
        background: white;
        border-radius: 12px;
        color: #526174;
      }

      @media (max-width: 900px) {
        #reelFeed.globexa-reel-feed {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 600px) {
        #reelFeed.globexa-reel-feed {
          grid-template-columns: 1fr;
          gap: 16px;
        }

        .globexa-reel-card-v2 {
          max-width: 430px;
          width: 100%;
          margin: 0 auto;
          border-radius: 13px;
        }

        .globexa-reel-card-v2 video {
          max-height: 75vh;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* 2. DATE */

  function formatReelDate(dateValue) {
    if (!dateValue) return "";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  /* 3. LECTURE AUTOMATIQUE */

  function activateReelPlayback(container) {
    if (!("IntersectionObserver" in window)) return;

    if (window.globexaReelObserver) {
      window.globexaReelObserver.disconnect();
    }

    window.globexaReelObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          const video = entry.target;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.60) {
            container.querySelectorAll("video").forEach(otherVideo => {
              if (otherVideo !== video) {
                otherVideo.pause();
              }
            });

            video.play().catch(() => {
              // Le navigateur peut demander une action manuelle.
            });
          } else {
            video.pause();
          }
        });
      },
      {
        threshold: [0, 0.60, 1]
      }
    );

    container.querySelectorAll("video").forEach(video => {
      window.globexaReelObserver.observe(video);
    });
  }

  /* 4. CHARGEMENT DES REELS */

  window.loadReels = async function loadGlobexaReels() {
    const container = document.getElementById("reelFeed");

    if (!container) return;

    installReelStyles();

    container.classList.add("globexa-reel-feed");

    container.innerHTML =
      '<p class="globexa-reel-empty">Chargement des vidéos...</p>';

    try {
      const { data, error } = await supabaseClient
        .from("globexa_reels")
        .select(`
          id,
          caption,
          video_path,
          thumbnail_path,
          duration_seconds,
          created_at
        `)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;

      state.reels = data || [];

      if (!state.reels.length) {
        container.innerHTML = `
          <div class="globexa-reel-empty">
            <h3>Aucune vidéo pour le moment</h3>
            <p>Les vidéos validées apparaîtront ici.</p>
          </div>
        `;
        return;
      }

      const videoPaths = state.reels
        .map(reel => reel.video_path)
        .filter(Boolean);

      const thumbnailPaths = state.reels
        .map(reel => reel.thumbnail_path)
        .filter(Boolean);

      const [videoResult, thumbnailResult] = await Promise.all([
        supabaseClient.storage
          .from("globexa-reels")
          .createSignedUrls(videoPaths, 3600),

        thumbnailPaths.length
          ? supabaseClient.storage
              .from("globexa-reels")
              .createSignedUrls(thumbnailPaths, 3600)
          : Promise.resolve({ data: [], error: null })
      ]);

      if (videoResult.error) throw videoResult.error;

      const videoUrls = new Map(
        (videoResult.data || []).map(item => [
          item.path,
          item.signedUrl
        ])
      );

      const thumbnailUrls = new Map(
        (thumbnailResult.data || []).map(item => [
          item.path,
          item.signedUrl
        ])
      );

      const cards = state.reels.map(reel => {
        const videoUrl = videoUrls.get(reel.video_path);
        const thumbnailUrl = thumbnailUrls.get(reel.thumbnail_path);

        if (!videoUrl) return "";

        return `
          <article class="globexa-reel-card-v2">
            <video
              controls
              playsinline
              muted
              loop
              preload="metadata"
              ${thumbnailUrl
                ? `poster="${escapeHTML(thumbnailUrl)}"`
                : ""}
            >
              <source
                src="${escapeHTML(videoUrl)}"
                type="video/mp4"
              >
              Votre navigateur ne peut pas lire cette vidéo.
            </video>

            <div class="globexa-reel-caption">
              ${escapeHTML(reel.caption || "Présentation du produit")}

              <span class="globexa-reel-date">
                ${formatReelDate(reel.created_at)}
              </span>
            </div>
          </article>
        `;
      }).join("");

      container.innerHTML = cards || `
        <div class="globexa-reel-empty">
          Aucune vidéo disponible actuellement.
        </div>
      `;

      activateReelPlayback(container);

    } catch (error) {
      console.error("GLOBEXA REELS :", error);

      container.innerHTML = `
        <div class="globexa-reel-empty">
          <h3>Impossible de charger les vidéos</h3>
          <p>Vérifiez votre connexion et réessayez.</p>
          <button
            type="button"
            id="globexaRetryReels"
          >
            Réessayer
          </button>
        </div>
      `;

      document
        .getElementById("globexaRetryReels")
        ?.addEventListener("click", window.loadReels);
    }
  };

  console.log("GLOBEXA CODE 7 chargé.");
})();
