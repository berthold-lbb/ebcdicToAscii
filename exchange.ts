Patch du composant (string[])

Remplace la définition des Inputs et le computed filtered (et ajoute les imports) :

// imports à ajouter/ajuster
import { booleanAttribute, numberAttribute } from '@angular/core';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import {
  MatFormFieldModule,
  MatFormFieldAppearance
} from '@angular/material/form-field';

// Inputs avec coercition + nouveau recentsMode
@Input() label = 'Choisir une valeur';
@Input() placeholder = 'Tapez pour filtrer...';
@Input() appearance: MatFormFieldAppearance = 'fill';

// Active/désactive l’historique
@Input({ transform: booleanAttribute }) recentsEnabled = false;
// Clé de stockage
@Input() storageKey = 'smart-autocomplete-string-recents';
// Nb max
@Input({ transform: numberAttribute }) maxRecents = 5;

// Nouveau: quand afficher les récents
//  - 'never' | 'onRefocus' | 'always'
@Input() recentsMode: 'never' | 'onRefocus' | 'always' = 'onRefocus';

// filtered (remplace ta version actuelle)
filtered = computed(() => {
  const q = this.query().toLowerCase().trim();
  const base = this.options ?? [];
  const hasSelection = !!this.ctrl.value;

  // 1) saisie -> filtrage
  if (q) return base.filter(v => v.toLowerCase().includes(q));

  // 2) pas de saisie
  if (!this.recentsEnabled || this.recentsMode === 'never') {
    // jamais de récents
    return base;
  }

  // récents filtrés pour ne garder que ceux présents dans la liste
  const validRecents = this.recents().filter(r => base.includes(r));
  const recentSet = new Set(validRecents);
  const rest = base.filter(v => !recentSet.has(v));

  if (this.recentsMode === 'always') {
    // toujours en tête quand vide
    return [...validRecents, ...rest];
  }

  // onRefocus: seulement si une valeur était déjà sélectionnée
  return hasSelection ? [...validRecents, ...rest] : base;
});