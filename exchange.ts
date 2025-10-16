// Ajoute ceci dans ta classe SmartAutocompleteStringComponent

/** Affichage en sections pour le panneau (récents + valeurs) */
sections = computed(() => {
  const q = this.query().toLowerCase().trim();
  const base = this.options ?? [];

  // Filtrage si saisie
  const filteredBase = q ? base.filter(v => v.toLowerCase().includes(q)) : base;

  // Récents valides (doivent exister dans la liste)
  const validRecents = (this.recentsEnabled ? this.recents() : []).filter(r => filteredBase.includes(r));
  const setRecents = new Set(validRecents);

  // Le reste (sans les récents)
  const rest = filteredBase.filter(v => !setRecents.has(v));

  // Règles d’affichage selon recentsMode
  // - 'never'      -> pas de section Récents
  // - 'onRefocus'  -> Récents uniquement si une valeur a déjà été sélectionnée auparavant
  // - 'always'     -> Récents toujours visibles quand pas de saisie
  const hasSelection = !!this.ctrl.value;

  const showRecents =
    this.recentsEnabled &&
    validRecents.length > 0 &&
    (
      (this.recentsMode === 'always' && !q) ||
      (this.recentsMode === 'onRefocus' && !q && hasSelection)
    );

  return {
    recents: showRecents ? validRecents : [],
    values: rest
  };
});
Si tu n’as pas encore recentsMode, tu peux le définir ainsi :
@Input() recentsMode: 'never' | 'onRefocus' | 'always' = 'onRefocus';

2) HTML – remplace le contenu de <mat-autocomplete> par des groupes
html
Copier le code
<mat-autocomplete #auto="matAutocomplete" (optionSelected)="onSelected($event)">
  <!-- Section Récents -->
  @if (sections().recents.length > 0) {
    <mat-optgroup label="Récents">
      @for (item of sections().recents; track item) {
        <mat-option [value]="item">{{ item }}</mat-option>
      }
    </mat-optgroup>
  }

  <!-- Section Valeurs -->
  @if (sections().values.length > 0) {
    <mat-optgroup [label]="query() ? 'Résultats' : 'Valeurs'">
      @for (item of sections().values; track item) {
        <mat-option [value]="item">{{ item }}</mat-option>
      }
    </mat-optgroup>
  }

  @if (sections().recents.length === 0 && sections().values.length === 0) {
    <mat-option disabled>Aucun résultat</mat-option>
  }
</mat-autocomplete>