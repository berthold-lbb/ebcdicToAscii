import { AfterViewInit, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { ReplaySubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-folio-13-eop',
  templateUrl: './folio-13-eop.component.html',
  providers: [Folio13EopFacade],
})
export class Folio13EopComponent implements OnInit, AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);

  private readonly gridReady$ = new ReplaySubject<GridApi>(1); // ✅ rejoue l’api aux futurs subscribers
  private gridApi?: GridApi;

  // UI vars (optionnel si tu veux garder des champs TS)
  foliosEopCount = 0;

  constructor(public readonly facade: Folio13EopFacade) {}

  ngOnInit(): void {
    // ✅ Le binding TS -> grid se fait ici (1 seul subscribe)
    combineLatest([this.facade.viewState$, this.gridReady$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([vm, api]) => {
        // variables TS si tu veux
        this.foliosEopCount = vm.foliosEopCount;

        // grid impérative
        api.setGridOption('columnDefs', this.buildColumnDefs(vm.selectedTransitId));
        api.setGridOption('rowData', vm.foliosEop);
      });
  }

  ngAfterViewInit(): void {
    const el = document.querySelector('#folioEopGrid') as HTMLElement;

    this.gridApi = createGrid(el, {
      ...createDefaultGridOptions(),
      columnDefs: [],
      rowData: [],
    });

    // ✅ déclenche immédiatement le rendu si vm est déjà arrivé
    this.gridReady$.next(this.gridApi);
  }

  onRefresh(): void {
    this.facade.refresh();
  }

  onTransitChange(id: string): void {
    this.facade.setSelectedTransit(id);
  }

  private buildColumnDefs(selectedTransitId: string): ColDef[] {
    const cols: ColDef[] = [{ field: 'numFolio' }];

    if (selectedTransitId === 'tous') {
      cols.push({ field: 'nombreTransitsAssocies' });
    } else {
      cols.push({ colId: 'actions' });
    }

    return cols;
  }
}
