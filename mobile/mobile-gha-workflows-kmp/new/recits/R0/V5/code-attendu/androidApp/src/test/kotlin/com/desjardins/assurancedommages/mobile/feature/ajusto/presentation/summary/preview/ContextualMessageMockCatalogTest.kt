// WRU-26599-R0 — fichier CRÉÉ par ce récit
package com.desjardins.assurancedommages.mobile.feature.ajusto.presentation.summary.preview

import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model.AjustoContextualMessage
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * LE SECOND GARDE-FOU du catalogue de previews. Le premier est le `when` exhaustif du catalogue,
 * qui agit à la compilation.
 *
 * Pourquoi les deux sont nécessaires : le `when` force à OUVRIR le fichier quand un type est ajouté
 * au sealed, mais rien ne force à REMPLIR la liste — on peut très bien ajouter une branche et
 * oublier l'exemplaire. Ce test ferme ce trou.
 *
 * Ensemble : « type déclaré ⇒ preview générée », garanti.
 *
 * LIMITE ASSUMÉE : sealedSubclasses ne rend que les sous-classes DIRECTES. Suffisant ici, la
 * hiérarchie étant plate ; la garantie tomberait si on imbriquait des sous-sealed.
 *
 * TODO WRU-26599-R0 — androidApp/src/test est vide dans le dépôt : le framework de test unitaire
 * de ce module (JUnit 4 supposé ici) est à confirmer. Si androidApp n'a pas de configuration de
 * test unitaire, déplacer ce test — et le catalogue — vers un module qui en a une.
 */
class ContextualMessageMockCatalogTest {

    @Test
    fun `chaque type de message contextuel a au moins un exemplaire dans le catalogue`() {
        val declares = AjustoContextualMessage::class.sealedSubclasses.toSet()
        val couverts = ContextualMessageMockCatalog.all.map { it::class }.toSet()

        assertEquals(
            "Un type de AjustoContextualMessage n'a pas d'exemplaire de preview. " +
                "Ajoute-le dans ContextualMessageMockCatalog.all — manquants : ${declares - couverts}",
            declares,
            couverts
        )
    }

    @Test
    fun `le catalogue ne contient pas de doublon de type`() {
        val types = ContextualMessageMockCatalog.all.map { it::class }
        assertEquals(
            "Deux exemplaires du même type : accepté par principe pour couvrir des variantes, " +
                "mais alors ce test doit être assoupli volontairement plutôt que de casser par surprise.",
            types.size,
            types.toSet().size
        )
    }
}
