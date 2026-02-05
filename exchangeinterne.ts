dateTouched = false;   // devient true après la 1ère interaction
dateSubmitted = false; // true quand tu valides le formulaire (bouton chercher, etc.)


this.dateTouched = true;

const raw = (this.selectedRawDate ?? '').trim();

// vide => clear + pas d’erreur
if (!raw) {
  this.saisieIncomplete = false;
  this.saisieInvalid = false;
  this.facade.setSelectedDate({ input: '' });
  this.redditionDatePicker.value = '';
  return;
}

// sinon ton flux habituel…
this.saisieIncomplete = !DateUtils.isAllowedIsoShape(raw);
if (this.saisieIncomplete) {
  this.saisieInvalid = false;
  return;
}


get showDateError(): boolean {
  // “required” seulement après interaction ou submit
  const raw = (this.selectedRawDate ?? '').trim();
  const requiredMissing = !raw;

  const canShow = this.dateTouched || this.dateSubmitted;

  return canShow && (requiredMissing || this.saisieInvalid);
}

<dsd-datepicker
  required="true"
  [error]="showDateError"
  (dsdDatepickerChange)="onDateChange($event)"
  (focusout)="onDateCommit(vm?.dateMaxLabel)"
>
  <span slot="error">
    @if ((dateTouched || dateSubmitted) && !(selectedRawDate?.trim())) {
      Champ obligatoire
    } @else if (saisieInvalid) {
      Date invalide
    } @else {
      {{ 'MESSAGES.FORMS.DATE_CHAMP_OBLIG' | translate }}
    }
  </span>
</dsd-datepicker>
