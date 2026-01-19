✅ 1) Changements à faire dans le REPO (obligatoire)
1.1 Crée un type commun
export type DownloadFile = {
  blob: Blob;
  fileName: string;
  contentType: string;
};

1.2 Ajoute 2 utilitaires (parser filename + base64->blob)
export class FileNameUtils {
  static fromContentDisposition(cd: string | null): string | null {
    if (!cd) return null;

    // filename*=UTF-8''xxx  OU filename="xxx" OU filename=xxx
    const match = /filename\*?=(?:UTF-8''|")?([^;"\n]+)"?/i.exec(cd);
    if (!match?.[1]) return null;

    try { return decodeURIComponent(match[1]); } catch { return match[1]; }
  }
}

export class Base64Utils {
  static toBlob(base64: string, contentType = 'application/octet-stream'): Blob {
    const pure = base64.includes(',') ? base64.split(',').pop()! : base64;

    const byteChars = atob(pure);
    const sliceSize = 1024;
    const chunks: Uint8Array[] = [];

    for (let offset = 0; offset < byteChars.length; offset += sliceSize) {
      const slice = byteChars.slice(offset, offset + sliceSize);
      const bytes = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) bytes[i] = slice.charCodeAt(i);
      chunks.push(new Uint8Array(bytes));
    }

    return new Blob(chunks, { type: contentType });
  }
}

1.3 Remplace tes méthodes repo par des méthodes $Response() + mapping

Ici je colle dans ton style avec withGlobalSpinner, catchError => throwError(() => errorMapper.map(err))

@Injectable({ providedIn: 'root' })
export class ConciliationRepository {
  private readonly errorMapper = inject(ApiErrorMapper);
  private readonly conciliationApi = inject(ConciliationService);
  private readonly store = inject(Store);

  getExtractionConciliationFinAnnee$(
    params: ExtractionConciliationFinAnneeBffParams,
    fallbackName = 'rapport-fin-annee.zip'
  ): Observable<DownloadFile> {
    return this.conciliationApi.extractionConciliationFinAnnee$Response(params).pipe(
      withGlobalSpinner(this.store),
      map((res) => this.mapDownload(res, fallbackName)),
      catchError((err: any) => throwError(() => this.errorMapper.map(err)))
    );
  }

  getExtractionCourrielFinAnnee$(
    params: ExtractionCourrielFinAnneeBffParams,
    fallbackName = 'Courriel_Rapport_Fin_dAnnee.eml'
  ): Observable<DownloadFile> {
    return this.conciliationApi.extractionCourrielFinAnnee$Response(params).pipe(
      withGlobalSpinner(this.store),
      map((res) => this.mapDownload(res, fallbackName)),
      catchError((err: any) => throwError(() => this.errorMapper.map(err)))
    );
  }

  private mapDownload(res: StrictHttpResponse<string>, fallbackName: string): DownloadFile {
    const cd = res.headers.get('content-disposition');
    const ct = res.headers.get('content-type') ?? 'application/octet-stream';

    const fileName = FileNameUtils.fromContentDisposition(cd) ?? fallbackName;
    const blob = Base64Utils.toBlob(res.body ?? '', ct);

    return { blob, fileName, contentType: ct };
  }
}


✅ Résultat : tu récupères le vrai filename du header + tu transformes le string base64 en Blob dans le repo.

⚠️ Important CORS : si en front headers.get('content-disposition') retourne null alors que Devtools le montre, le backend doit exposer :
Access-Control-Expose-Headers: Content-Disposition, Content-Type

✅ 2) Changements à faire dans la FAÇADE (pour coller à ta VM actuelle)
2.1 Utilitaire download (si tu veux garder ton FileUtils actuel, adapte juste la signature)
export class FileUtils {
  static download(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}


extraire(): void {
  combineLatest([
    this.selectedDate$,
    this.selectedTransitId$,
    this.auth.isPaie$(),
    this.auth.isSaci$(),
  ])
    .pipe(
      take(1),
      switchMap(([dateRapport, transitId, isPaie, isSaci]) => {
        if (!dateRapport || !transitId) return EMPTY;

        const roleKey = isPaie ? 'PAIE' : isSaci ? 'SACI' : null;
        if (!roleKey) return EMPTY;

        const policy = POLICY_PAR_ROLE[roleKey];
        const params: ExtractionConciliationFinAnneeBffParams = {
          body: {
            dateRapport,
            numTransit: [transitId],
            frequenceExtraction: policy.frequenceExtraction,
            typeFichierExtraction: policy.typeFichierExtraction,
          },
        };

        this.extraireStateSubject.next(pendingState('Téléchargement en cours'));

        return this.conciliationRepo.getExtractionConciliationFinAnnee$(params).pipe(
          tap(({ blob, fileName }) => {
            FileUtils.download(blob, fileName);
            this.extraireStateSubject.next(successState('Fichier récupéré', fileName));
          }),
          catchError((err) => {
            this.extraireStateSubject.next(errorState('Réessayer'));
            this.displayErrorMessages(err, false); // ✅ affichage erreur
            return EMPTY;
          })
        );
      })
    )
    .subscribe();
}
