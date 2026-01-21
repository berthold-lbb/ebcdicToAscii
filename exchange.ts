it("extraire$ doit appeler le repo et ouvrir le zip", () => {
  // Arrange
  const extractionDone$ = new Subject<HttpResponse<Blob>>();

  spyOn(mockConciliationRepo, 'getExtractionConciliationFinAnnee$')
    .and.returnValue(extractionDone$.asObservable());

  spyOn(FileUtils, 'openBlobFile');

  facade.setSelectedTransit({ id: 'T1' } as any);
  facade.setSelectedDate('2024-06-01'); // important: string ISO
  isPaie$.next(true);
  isSaci$.next(false);

  // Act
  facade.extraire$();

  // Assert 1: l'appel repo a bien eu lieu
  expect(mockConciliationRepo.getExtractionConciliationFinAnnee$).toHaveBeenCalled();

  // Simule la réponse backend
  const res = new HttpResponse({
    body: new Blob(['data'], { type: 'application/zip' }),
    headers: new HttpHeaders({
      'content-disposition': 'attachment; filename=rapport.zip',
      'content-type': 'application/zip',
    }),
    status: 200,
  });

  extractionDone$.next(res);

  // Assert 2: openBlobFile a été appelé
  expect(FileUtils.openBlobFile).toHaveBeenCalled();
});
