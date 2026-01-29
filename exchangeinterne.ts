<dsd-container class="gt-filters">
  <dsd-form name="gestion-taches-filters" (dsdSubmit)="onSubmit()">

    <div class="gt-bar">

      <!-- 1) Affichage -->
      <dsd-fieldset legend="Affichage" class="gt-fs">
        <dsd-radio-group
          name="affichage"
          formControlName="affichage"
          flex-direction="row"
          class="gt-radio-row"
        >
          <dsd-radio value="GESTION_TACHES">Gestion des tâches</dsd-radio>
          <dsd-radio value="TOUS_COMPTES">Tous les comptes</dsd-radio>

          <span slot="error">Choix obligatoire</span>
        </dsd-radio-group>
      </dsd-fieldset>

      <span class="gt-sep" aria-hidden="true"></span>

      <!-- 2) Mode de travail -->
      <dsd-fieldset legend="Mode de travail" class="gt-fs">
        <dsd-radio-group
          name="modeTravail"
          formControlName="modeTravail"
          flex-direction="row"
          class="gt-radio-row"
        >
          <dsd-radio value="ENTITE">Entité</dsd-radio>
          <dsd-radio value="COMPTE">Compte</dsd-radio>

          <span slot="error">Choix obligatoire</span>
        </dsd-radio-group>
      </dsd-fieldset>

      <span class="gt-sep" aria-hidden="true"></span>

      <!-- 3) Combobox : Entité + Compte -->
      <div class="gt-selects">

        <!-- ✅ TON INPUT ENTITÉ (inchangé) -->
        <dsd-combobox
          class="gt-combo"
          data-cy-dsd="form-input-entite"
          name="entite"
          [options]="viewState.entiteOptions"
          [value]="form.controls.entiteId.value"
          required="true"
          (dsdComboboxClear)="onEntiteClear()"
          (dsdComboboxSelect)="onEntiteSelect($event)"
        >
          <span slot="label">Entité</span>
          <span slot="error">Entité obligatoire</span>
        </dsd-combobox>

        <!-- ✅ TON INPUT COMPTE (inchangé) -->
        <dsd-combobox
          class="gt-combo"
          data-cy-dsd="form-input-compte"
          name="compte"
          [options]="viewState.compteOptions"
          [value]="form.controls.compteId.value"
          required="true"
          (dsdComboboxClear)="onCompteClear()"
          (dsdComboboxSelect)="onCompteSelect($event)"
        >
          <span slot="label">Compte</span>
          <span slot="error">Compte obligatoire</span>
        </dsd-combobox>

      </div>

      <!-- 4) Bouton à droite -->
      <div class="gt-actions">
        <!-- ✅ TON BOUTON (inchangé) -->
        <dsd-button
          variant="tertiary"
          icon-name="contenus_contour_periodique"
          icon-position="start"
          type="submit"
          [disabled]="form.invalid"
        >
          Actualiser
        </dsd-button>
      </div>

    </div>

  </dsd-form>
</dsd-container>






/* La barre doit être une ligne */
.gt-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  flex-wrap: nowrap; /* important */
}

/* Les fieldsets ne doivent PAS prendre 100% */
.gt-fs {
  flex: 0 0 auto;     /* ne grandit pas */
  width: auto;        /* pas 100% */
  max-width: none;
  margin: 0;
}

/* ⚠️ DSD peut forcer un display:block sur fieldset => on neutralise */
.gt-fs,
.gt-fs dsd-radio-group {
  display: inline-flex;
}

/* Radios sur une ligne */
.gt-radio-row {
  display: inline-flex !important;
  align-items: center;
  gap: 16px;
  white-space: nowrap;
}

/* Les séparateurs verticaux */
.gt-sep {
  width: 1px;
  align-self: stretch;
  background: #cfcfcf;
  flex: 0 0 1px;
}

/* Zone entité/compte : elle prend le reste */
.gt-selects {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex: 1 1 auto;  /* prend l’espace restant */
  min-width: 0;
}

/* Largeur raisonnable des combos */
.gt-combo {
  flex: 0 0 320px;     /* fixe de base */
  max-width: 420px;
}

/* Bouton à droite */
.gt-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  white-space: nowrap;
  flex: 0 0 auto;
}
