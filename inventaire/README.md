# Inventaire CS Oupeye — version administrable

## Utilisation

- Connexion par l’accueil et accès Staff/PIN existants, sans nouveau compte.
- **Nouvel article** : nom, catégorie (existante ou nouvelle), stock initial, minimum, stock souhaité, unité, emplacement, codes-barres multiples et photo facultative.
- **Gérer → Modifier la fiche** : modifie le catalogue, jamais le stock ou la péremption.
- **+ / −** : un mouvement confirmé par Firebase. Pour les articles avec lots, ces boutons ouvrent le choix du lot.
- **Mouvement** : entrée/sortie en quantité, avec motif et sélection d’un lot ou du stock non réparti.
- **Ajouter un lot** : soit répartir le stock existant (total inchangé), soit réceptionner une nouvelle livraison (total augmenté). La date historique reste intacte et concerne le stock non réparti.
- **Archiver** : masque un article dans l’inventaire actif et le scanner, sans le supprimer. Le filtre « Articles archivés » permet de le réactiver.
- **À recommander** : stock strictement inférieur au minimum, plus les commandes en cours. Suggestion = souhaité − disponible − déjà commandé. Le suivi de commande ne transmet rien à un fournisseur. Une réception partielle augmente le stock et diminue le restant à recevoir.
- **Faire un comptage** : saisir des quantités, contrôler le récapitulatif, puis valider. Maximum 100 articles par série. Un conflit annule la validation entière. Pour vérifier de nouveau un article en conflit, effacer sa saisie puis la ressaisir après contrôle physique. Les lots se corrigent avec les mouvements de chaque lot. Les brouillons de comptage sont propres à la session de navigateur et au compte ; ils ne remplacent jamais les stocks enregistrés.
- **Scanner** : utilise le même catalogue. Un code inconnu permet d’ouvrir une nouvelle fiche préremplie. Plusieurs correspondances affichent un choix explicite. Les deux doublons historiques restent exactement tels quels.
- **Exporter** : PDF/CSV des articles correspondant aux filtres, PDF de réapprovisionnement, ou JSON de tous les documents `inventory` et du catalogue de référence (y compris archives). Le JSON n’inclut pas la collection `history` et n’est pas une sauvegarde intégrale de Firebase.

## Conservation des données

Le catalogue historique (268 articles) est extrait du commit `bc4669a1c457606374be29995901c4d5244ab764` et conservé dans `catalog-seed.js`. Les identifiants, noms, catégories, images, seuils et codes-barres de cette base de référence sont inchangés. **Ce fichier ne contient aucun stock initial ni aucune date de péremption.**

À l’ouverture, les documents Firestore sont uniquement lus. Il n’y a ni migration, ni initialisation en masse, ni écriture au chargement. Les valeurs stockées priment sur les valeurs du catalogue de référence. Les documents inconnus du catalogue historique restent affichés, sans être supprimés.

Les futures fiches sont stockées dans `inventory/{id}.catalog`. Les champs existants `stock`, `expirationDate`, `noExpiration`, ainsi que les champs inconnus, sont préservés tant qu’une opération dédiée ne les modifie pas explicitement. Les écritures utilisent une fusion de champs, jamais un remplacement du document complet. L’archivage change uniquement `catalog.active`.

Les lots optionnels utilisent `inventoryLots` dans le même document. Aucun lot n’est créé automatiquement. `inventoryOrder.quantity` est le restant à recevoir. `catalogRevision` et `inventoryStockRevision` servent à détecter les éditions concurrentes de cette version.

Chaque opération validée écrit atomiquement le document article, une nouvelle entrée `history` et `metadata/lastUpdate`. Les identifiants de validation évitent l’application répétée d’une même soumission. Un échec de droits ou un conflit n’applique aucune écriture partielle. Aucune suppression automatique de l’historique n’est effectuée par cette version.

En perte de connexion, les valeurs déjà chargées peuvent rester consultables mais aucune nouvelle modification n’est validée. Une page ouverte à froid attend la réponse du serveur plutôt que de présenter des zéros issus d’un cache vide. Il faut attendre **Enregistrement confirmé** avant de quitter après une modification.

## Accès et services existants

Projet Firebase et SDK conservés : `listing-44b2b`, Firebase Web 9.6.8. Aucune Cloud Function, aucun Storage ou service payant supplémentaire. Aucune modification des règles Firestore, de la facturation ou du PIN staff.

Les droits réels demeurent ceux des règles Firestore déployées. Le PIN de `staff.html` est un verrou d’interface côté navigateur, pas un rôle administrateur contrôlé côté serveur. Cette mise à jour ne prétend pas en faire une barrière de sécurité serveur. Si les règles actuelles limitent les champs ou l’accès individuel aux entrées d’historique, une opération pourra être refusée : il faudra vérifier les règles existantes avec le propriétaire, jamais les rendre publiques pour contourner le refus.

Le scanner n’initialise pas un deuxième catalogue : il importe la même base de référence et lit les mêmes documents que l’inventaire.

## Vérifications

Depuis la racine du dépôt, avec Node.js 24 :

```sh
node --test inventaire/tests/inventory.test.mjs
```

Tests purs et adaptateur Firestore simulé : comparaison intégrale du catalogue d’origine, conservation de champs, concurrence, refus atomiques, idempotence, lots, comptages, commandes, dates, scanner et références locales. Ces tests ne contactent jamais la base réelle. Ils ne constituent pas une vérification des règles Firestore en production ni un essai de caméra sur iPhone.

L’ancienne version du code reste récupérable dans l’historique Git. Pour annuler cette livraison, restaurer uniquement les fichiers de cette livraison depuis le commit précédent. **Ne pas restaurer ou réinitialiser les documents Firestore** pour un retour arrière de code. Après la création de nouvelles fiches ou lots, préférer corriger la nouvelle interface : l’ancien écran ne sait pas les afficher.
