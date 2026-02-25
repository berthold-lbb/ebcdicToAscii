private comboInteracting = false;

// Optionnel: si tu veux distinguer
private lastSelectAt = 0;

onEntiteSelect(_: unknown) {
  this.comboInteracting = true;
  this.lastSelectAt = Date.now();
  // on relâche juste après que le composant ait fini sa sélection (évite le double-trigger)
  queueMicrotask(() => (this.comboInteracting = false));
}

onCompteSelect(_: unknown) {
  this.comboInteracting = true;
  this.lastSelectAt = Date.now();
  queueMicrotask(() => (this.comboInteracting = false));
}

onEntiteClear() {
  this.comboInteracting = false;
}
onCompteClear() {
  this.comboInteracting = false;
}

onEntiteFocusOut() {
  // on sort du champ -> plus d’interaction dropdown
  this.comboInteracting = false;
}
onCompteFocusOut() {
  this.comboInteracting = false;
}

private isReady(): boolean {
  // adapte selon ton viewState / facade
  return !!this.viewState.selectedEntiteId && !!this.viewState.selectedCompteId;
}

@HostListener('document:keydown.enter', ['$event'])
onEnter(e: KeyboardEvent) {
  // 1) si l’utilisateur vient de faire un select, Enter doit servir au composant → on ne fait rien
  if (this.comboInteracting) return;

  // 2) garde-fou anti “double enter instant” après select (au cas où)
  if (Date.now() - this.lastSelectAt < 80) return;

  // 3) si pas prêt
  if (!this.isReady()) return;

  // 4) empêcher que ça déclenche le bouton "Actualiser" / autre élément focusable
  e.preventDefault();
  e.stopPropagation();

  this.onSubmit();
}