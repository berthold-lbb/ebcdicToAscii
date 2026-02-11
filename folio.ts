import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { TransitRepository } from './transit.repository';
import { ConciliationService } from '../../api/services/conciliation.service';
import { ApiErrorMapper } from '../../errors/api-error-mapper';

// Types (ajuste les imports si tes chemins diffèrent)
import { TransitBffDto } from '../../api/models/transit-bff-dto';
import { GetTransitsPourConciliation$Params } from '../../api/services/conciliation.service';
import { AppError } from '../../errors/app-error';

describe('TransitRepository', () => {
  let repo: TransitRepository;

  let conciliationServiceSpy: jasmine.SpyObj<ConciliationService>;
  let errorMapperSpy: jasmine.SpyObj<ApiErrorMapper>;

  beforeEach(() => {
    conciliationServiceSpy = jasmine.createSpyObj<ConciliationService>('ConciliationService', [
      'getTransitsPourConciliation',
    ]);

    errorMapperSpy = jasmine.createSpyObj<ApiErrorMapper>('ApiErrorMapper', ['map']);

    TestBed.configureTestingModule({
      providers: [
        TransitRepository,
        { provide: ConciliationService, useValue: conciliationServiceSpy },
        { provide: ApiErrorMapper, useValue: errorMapperSpy },
      ],
    });

    repo = TestBed.inject(TransitRepository);
  });

  it('doit se créer', () => {
    expect(repo).toBeTruthy();
  });

  it('obtenirTransits() doit appeler conciliationService.getTransitsPourConciliation avec le param fourni et retourner la liste', (done) => {
    const param: GetTransitsPourConciliation$Params = {
      // mets seulement ce qui existe vraiment dans ton type
      // ex: inclureTransitsFusionnes: true
    } as GetTransitsPourConciliation$Params;

    const transits: TransitBffDto[] = [
      { idSociete: null } as TransitBffDto,
      { idSociete: 123 } as TransitBffDto,
    ];

    conciliationServiceSpy.getTransitsPourConciliation.and.returnValue(of(transits));

    repo.obtenirTransits(param).subscribe({
      next: (value) => {
        expect(conciliationServiceSpy.getTransitsPourConciliation).toHaveBeenCalledWith(param);
        expect(value).toEqual(transits);
        done();
      },
      error: done.fail,
    });
  });

  it('obtenirTransits() sans param doit appeler conciliationService.getTransitsPourConciliation avec undefined', (done) => {
    const transits: TransitBffDto[] = [];
    conciliationServiceSpy.getTransitsPourConciliation.and.returnValue(of(transits));

    repo.obtenirTransits().subscribe({
      next: (value) => {
        expect(conciliationServiceSpy.getTransitsPourConciliation).toHaveBeenCalledWith(undefined);
        expect(value).toEqual(transits);
        done();
      },
      error: done.fail,
    });
  });

  it('obtenirTransits() doit mapper l’erreur via errorMapper.map et rethrow AppError', (done) => {
    const rawErr = { status: 500, message: 'boom' };
    const mappedErr = { code: 'X', message: 'mapped' } as unknown as AppError;

    conciliationServiceSpy.getTransitsPourConciliation.and.returnValue(
      throwError(() => rawErr)
    );
    errorMapperSpy.map.and.returnValue(mappedErr);

    repo.obtenirTransits().subscribe({
      next: () => done.fail('devait échouer'),
      error: (e) => {
        expect(errorMapperSpy.map).toHaveBeenCalledWith(rawErr);
        expect(e).toBe(mappedErr);
        done();
      },
    });
  });
});
