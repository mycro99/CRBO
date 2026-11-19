# Suivi des véhicules — CRBO

La carte **Véhicules** se trouve dans `staff.html`, à côté de l’inventaire. Elle n’utilise pas de PIN. La page exige la session Firebase staff existante (connexion par e-mail et mot de passe depuis l’accueil). Le lien inventaire et son PIN ne sont pas modifiés. Le code et la structure sont publics, les données saisies sont lues dans Firestore avec les autorisations du compte connecté. Aucune plaque ou donnée de la capture de référence n’est préchargée dans le code public.

## Fiche véhicule

Ajouter une plaque, catégorie (AMU/112, ambulance 105, TPMR, FIT, liaison ou autre), affectation, localisation habituelle, marque/modèle, kilométrage facultatif, prochain contrôle technique, validité de la carte carburant, pneus et dernier changement, tablette, identifiant radio/ISSI et remarques. Le champ carte carburant est une **date de validité**, pas le numéro complet d’une carte bancaire ou son code.

Les dates natives ouvrent le sélecteur du téléphone. Échéance sous 30 jours ou aujourd’hui : jaune ; date dépassée : rouge. Ces couleurs signalent les échéances et ne constituent pas une validation réglementaire du véhicule. Le statut de disponibilité décrit les prêts/indisponibilités encodés.

L’identifiant de fiche est la plaque normalisée (majuscules, sans espaces/tirets), pour empêcher deux créations concurrentes de la même plaque. La plaque devient non modifiable après création ; une nouvelle immatriculation nécessite une nouvelle fiche, puis l’archivage de l’ancienne. Les autres champs restent modifiables. Une baisse du kilométrage exige une case de correction explicite. Les champs inconnus des documents ne sont pas écrasés.

## Prêts, garage, entretien et indisponibilités

Depuis une fiche, **Ajouter un prêt / suivi** demande un type, un motif, le lieu/bénéficiaire/garage, une date de début et une fin prévue facultative. Le champ remarques permet de préciser « matinée » ou un horaire. Les périodes sont gérées par jours, pas par créneaux horaires. Les chevauchements sont signalés mais ne sont pas interdits : un prêt et une réparation peuvent décrire simultanément la situation d’un véhicule.

Le type **Véhicule principal** enregistre une affectation datée, sans rendre le véhicule indisponible. Elle reste visible pendant un prêt ou une panne, qui restent prioritaires dans le statut. Un suivi futur apparaît comme prévu. À partir du début, un prêt, garage, entretien ou autre indisponibilité rend le véhicule indisponible. **Une fin prévue passée ne clôture jamais automatiquement un suivi** : l’état reste ouvert avec l’alerte de retour/fin dépassée. Utiliser **Confirmer le retour / la fin** avec une date réelle entre le début et aujourd’hui. La date prévue est conservée en parallèle. Le véhicule retrouve sa localisation habituelle quand aucun suivi courant ne subsiste.

**Annuler ce suivi** exige un motif et conserve la trace. Il n’y a aucune suppression physique de suivi ou de véhicule. Le bouton **Retirer du parc**, dans le tableau et sur la fiche, archive le véhicule. Ce retrait est réversible via **Remettre dans le parc** et bloqué tant qu’un suivi reste ouvert, y compris un suivi futur. Les véhicules archivés se consultent via le filtre.

La fiche affiche les suivis ouverts, prévus, terminés et annulés, ainsi qu’un journal des créations, modifications, clôtures et archivages avec auteur et date. Le CSV exporte les fiches du parc (y compris archives), pas les historiques de suivi. L’historique d’un véhicule n’est chargé que lors de l’ouverture de sa fiche.

## Stockage et droits existants

Projet Firebase conservé : `listing-44b2b`, SDK Web 9.6.8. Collections nouvelles :

- `vehicles/{plaqueNormalisee}` : fiche, `revision`, `active`, compteur des suivis ouverts et métadonnées de modification.
- `vehicleEvents/{id}` : suivis (`kind`, `open`, dates, motif, lieu, retour, annulation, `revision`) et journal (`kind: record`, `open: false`).

Au chargement, deux abonnements lisent les fiches et les suivis `open == true`. Une requête simple `vehicleId == ...` charge l’historique de la fiche consultée. Aucun index composite ne devrait être nécessaire pour ces requêtes simples. Aucun téléchargement de fichiers, service Apps Script, Cloud Function ou modification de l’inventaire n’est ajouté.

**Les règles Firestore déployées ne sont pas connues ni modifiées par cette livraison.** Les nouvelles collections doivent autoriser la lecture et les créations/mises à jour aux comptes staff déjà autorisés, en reprenant les conditions existantes du projet. Ne pas remplacer l’ensemble des règles par une règle publique, ni autoriser `request.auth != null` sans vérifier que cette condition correspond bien au contrôle staff actuel. Conserver l’interdiction de suppression physique pour ces collections. Si le message « Firebase refuse l’accès » apparaît, examiner les règles actuelles avec le propriétaire et ajouter uniquement les autorisations ciblées de ces deux collections. Ne rien modifier à `inventory`, `history` ou aux règles des autres modules.

Les lectures anonymes des deux collections ont été refusées (403) lors de la vérification. Cela ne prouve pas à lui seul que les comptes staff ont déjà tous les droits d’écriture nécessaires ; le premier enregistrement réel doit être vérifié après publication.

## Protection des données

- Aucune écriture au chargement, aucun import de la capture et aucune réinitialisation.
- Une validation utilise une transaction : fiche/compteur, suivi et journal sont enregistrés ensemble ou pas du tout.
- Un identifiant de validation stable évite les doublons après une réponse incertaine.
- Une version périmée refuse l’enregistrement au lieu d’écraser un collègue.
- Une fiche ou un compteur invalide n’est pas corrigé automatiquement.
- En mode hors connexion, consultation des données disponibles uniquement ; les écritures attendent la synchronisation serveur.
- Une fiche modifiée demande confirmation avant fermeture ; un enregistrement en cours bloque le clic extérieur, la croix et Échap.

## Vérification

```sh
node --test vehicules/tests/*.test.mjs inventaire/tests/*.test.mjs
```

Les tests utilisent des données fictives et un adaptateur Firestore simulé : dates et retours, normalisation des plaques, doublons, conflits, transactions atomiques, archivage, conservation de champs et absence de modification de l’inventaire. Ils ne valident pas les autorisations effectives d’un compte staff en production.
