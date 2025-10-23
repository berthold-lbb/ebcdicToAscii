Si tu préfères ne rien enregistrer et rester autonome dans ta lib, utilise un pipe custom basé sur Intl (du navigateur) :

import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'moneyCA', standalone: true })
export class MoneyCAPipe implements PipeTransform {
  transform(value: number | string | null | undefined): string {
    if (value == null) return '';
    const n = Number(value);
    if (isNaN(n)) return String(value);
    return n.toLocaleString('fr-CA', { maximumFractionDigits: 0 });
  }
}


Puis dans ton template lib-datatable :

{{ getCellValue(row, col) | moneyCA }} $


Avantage : pas besoin de registerLocaleData.
Inconvénient : c’est indépendant de LOCALE_ID Angular (mais souvent suffisant).