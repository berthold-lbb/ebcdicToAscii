<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Redition</title>
</head>

<body>
  <div class="page">

    <!-- Header -->
    <header class="topbar" aria-label="En-tête">
      <button type="button" class="btn btn-link" aria-label="Retour">
        ← Retour
      </button>

      <h1 class="page-title">Redition</h1>
    </header>

    <!-- Contenu -->
    <main class="content" aria-label="Contenu principal">

      <!-- Carte / Bloc Paramètres -->
      <section class="card" aria-label="Paramètres du rapport">
        <div class="card-header">
          <h2 class="card-title">Paramètres du rapport</h2>
        </div>

        <form class="form" autocomplete="off">
          <!-- Entité -->
          <div class="field">
            <label class="label" for="entite">
              <span aria-hidden="true">*</span> Entité
            </label>

            <div class="control control-select">
              <select id="entite" name="entite" required>
                <option value="" selected disabled>— Sélectionner —</option>
                <option value="entite1">Entité 1</option>
                <option value="entite2">Entité 2</option>
              </select>
              <span class="select-arrow" aria-hidden="true">▾</span>
            </div>
          </div>

          <!-- Date -->
          <div class="field">
            <label class="label" for="date">
              <span aria-hidden="true">*</span> Date
            </label>

            <div class="control control-date">
              <input
                id="date"
                name="date"
                type="date"
                required
                aria-describedby="date-help"
              />
              <button type="button" class="icon-btn" aria-label="Ouvrir le calendrier">
                📅
              </button>
            </div>

            <p id="date-help" class="hint">Format : AAAA-MM-JJ</p>
          </div>

          <!-- Options disponibles -->
          <div class="options">
            <h3 class="options-title">Options disponibles</h3>
            <p class="options-hint">
              Les options disponibles seront visibles une fois vos choix effectués.
            </p>

            <!-- Placeholder (tu remplaceras par tes checkboxes / radios / etc.) -->
            <div class="options-body" aria-label="Zone des options">
              <!-- Exemple -->
              <!--
              <label class="checkbox">
                <input type="checkbox" name="opt1" />
                <span>Option 1</span>
              </label>
              -->
            </div>
          </div>
        </form>
      </section>

    </main>
  </div>
</body>
</html>



{
  "COMMON": {
    "ACTIONS": {
      "ADD": "Ajouter",
      "EDIT": "Modifier",
      "DELETE": "Supprimer",
      "CANCEL": "Annuler",
      "SAVE": "Enregistrer",
      "BACK": "Retour"
    },
    "FIELDS": {
      "ACCOUNT": "Compte",
      "FREQUENCY": "Fréquence"
    },
    "MESSAGES": {
      "ERROR": "Message d'erreur"
    }
  }
}


"scripts": {
  "prepack": "ng build csp-conciliation-spa-migration --configuration production && rm -rf pack && mkdir pack && cp -R dist/csp-conciliation-spa-migration/* pack/"
},
"files": [
  "pack/**"
]