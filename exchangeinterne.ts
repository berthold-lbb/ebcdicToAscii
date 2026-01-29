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






.gt-filters {
  padding: 12px 16px;
}

/* Barre unique horizontale */
.gt-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}

/* Fieldsets compacts */
.gt-fs {
  padding: 6px 8px;
  margin: 0;
}

/* Radios sur une seule ligne */
.gt-radio-row {
  display: flex;
  align-items: center;
  gap: 16px;
  white-space: nowrap;
}

/* 2 séparateurs verticaux (comme l'image) */
.gt-sep {
  width: 1px;
  align-self: stretch;
  background: #cfcfcf;
}

/* Zone des combobox au centre */
.gt-selects {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

/* Empêche l’effet “input géant” */
.gt-combo {
  width: 320px;
  max-width: 420px;
}

/* Bouton collé à droite */
.gt-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  white-space: nowrap;
}

/* Responsive : on wrap, on retire les séparateurs */
@media (max-width: 1100px) {
  .gt-bar {
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .gt-sep {
    display: none;
  }

  .gt-selects {
    flex-basis: 100%;
    justify-content: flex-start;
  }

  .gt-combo {
    width: min(420px, 100%);
  }

  .gt-actions {
    margin-left: 0;
    flex-basis: 100%;
    justify-content: flex-start;
  }
}
