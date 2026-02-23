const canTerminer$ =
      modeTravail === 'ENTITE'
        // ENTITE -> API comptes -> vérifier que compteId est présent via identifiantCompteGL
        ? this.obtenirComptesGLAvecTachesNonTerminees(entiteId).pipe(
            map((comptes) => comptes.some((c) => c.identifiantCompteGL === compteId))
          )
        // COMPTE -> API transits -> vérifier que entiteId est présent via identifiantTransit
        : this.obtenirTransitsAvecTachesNonTerminees(compteId).pipe(
            map((transits) => transits.some((t) => t.identifiantTransit === entiteId))
          );