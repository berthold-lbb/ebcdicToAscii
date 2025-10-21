1) Template — fais flotter le label quand nécessaire
<!-- AVANT -->
<!-- <mat-form-field [appearance]="appearance" class="w-full smart-multi-af"> -->

<!-- APRÈS -->
<mat-form-field
  [appearance]="appearance"
  class="w-full smart-multi-af"
  [floatLabel]="(selected().length > 0 || !!query()) ? 'always' : 'auto'">


Résultat : dès qu’il y a une sélection ou que tu commences à écrire, le label monte et ne masque plus le texte affiché dans le champ.

2) Styles — aligne l’overlay avec le curseur/texte

Remplace tes règles .smart-overlay par celles-ci (elles fonctionnent pour fill et outline; ajuste le padding si besoin) :

/* L'infix sert de repère de positionnement */
:host ::ng-deep .smart-multi-af .mat-mdc-form-field-infix {
  position: relative;
  width: 100%;
  min-width: 0;
}

/* Overlay “Première (+N autres)” : alignement vertical + padding horizontal */
.smart-overlay {
  position: absolute;
  inset-inline: 16px 16px;     /* padding horizontal standard Material */
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;         /* centre verticalement comme le texte */
  pointer-events: none;        /* ne gêne jamais le curseur */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: rgba(0,0,0,.6);       /* adapte au thème si besoin */
  font: inherit;
}

/* L'input garde toute la largeur et peut se contracter */
:host ::ng-deep .smart-multi-af .mat-mdc-input-element {
  width: 100%;
  min-width: 0;
}


Si ton thème a un padding différent, ajuste inset-inline: 12px 12px ou 20px 20px pour que le début du texte de l’overlay coïncide exactement avec le début du texte du champ (même position que le curseur).