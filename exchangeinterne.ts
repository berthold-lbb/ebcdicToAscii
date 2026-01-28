<!-- components/gestion-taches-filters/gestion-taches-filters.component.html -->
<dsd-container class="gt-filters">
  <dsd-form name="gestion-taches-filters" (dsdSubmit)="onSubmit()">

    <div class="gt-filters__layout">

      <div class="gt-filters__left">
        <dsd-fieldset legend="Affichage" class="gt-fs">
          <dsd-radio-group name="affichage" formControlName="affichage" flex-direction="column">
            <dsd-radio value="GESTION_TACHES">Gestion des tâches</dsd-radio>
            <dsd-radio value="TOUS_COMPTES">Tous les comptes</dsd-radio>
            <span slot="error">
              @if (form.controls.affichage.touched && form.controls.affichage.invalid) { Choix obligatoire }
            </span>
          </dsd-radio-group>
        </dsd-fieldset>

        <dsd-vspacer all="3"></dsd-vspacer>

        <dsd-fieldset legend="Mode de travail" class="gt-fs">
          <dsd-radio-group name="modeTravail" formControlName="modeTravail" flex-direction="column">
            <dsd-radio value="ENTITE">Entité</dsd-radio>
            <dsd-radio value="COMPTE">Compte</dsd-radio>
            <span slot="error">
              @if (form.controls.modeTravail.touched && form.controls.modeTravail.invalid) { Choix obligatoire }
            </span>
          </dsd-radio-group>
        </dsd-fieldset>
      </div>

      <div class="gt-filters__right">

        <dsd-combobox
          class="gt-filters__ctrl"
          data-cy-dsd="form-input-entite"
          name="entite"
          [options]="vm.entiteOptions"
          [value]="form.controls.entiteId.value"
          [disabled]="vm.disabled || form.controls.modeTravail.value !== 'ENTITE'"
          required="true"
          (dsdComboboxClear)="onEntiteClear()"
          (dsdComboboxSelect)="onEntiteSelect($event)"
        >
          <span slot="label">Entité</span>
          <span slot="error">
            @if (form.controls.entiteId.touched && form.controls.entiteId.invalid) { Entité obligatoire }
          </span>
        </dsd-combobox>

        <dsd-combobox
          class="gt-filters__ctrl"
          data-cy-dsd="form-input-compte"
          name="compte"
          [options]="vm.compteOptions"
          [value]="form.controls.compteId.value"
          [disabled]="vm.disabled || form.controls.modeTravail.value !== 'COMPTE'"
          required="true"
          (dsdComboboxClear)="onCompteClear()"
          (dsdComboboxSelect)="onCompteSelect($event)"
        >
          <span slot="label">Compte</span>
          <span slot="error">
            @if (form.controls.compteId.touched && form.controls.compteId.invalid) { Compte obligatoire }
          </span>
        </dsd-combobox>

        <div class="gt-filters__actions">
          <dsd-button type="submit" variant="tertiary" [disabled]="vm.disabled || form.invalid">
            Actualiser
          </dsd-button>
        </div>

      </div>

    </div>
  </dsd-form>
</dsd-container>
