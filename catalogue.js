"use strict";

/* =====================================================
   GLOBEXA — CODE 1
   CORRECTION DU CONFLIT CATALOGUE
   Le catalogue principal est géré par app.js
   ===================================================== */

(function () {

  // Empêche l'ancien catalogue de démarrer
  // et de remplacer les produits de app.js.

  console.log(
    "GLOBEXA : catalogue secondaire désactivé."
  );

  // Le catalogue principal reste actif.
  // Les produits sont chargés par app.js.
  // Les fiches détaillées sont gérées
  // par product-detail.js.
  // Le panier est géré par app.js.

})();
