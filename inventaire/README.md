# Inventaire CS Oupeye — version administrable

## Utilisation

- Connexion par l’accueil et accès Staff/PIN existants, sans nouveau compte.
- **Nouvel article** : nom, catégorie (existante ou nouvelle), stock initial, minimum, stock souhaité, unité, emplacement, codes-barres multiples et photo facultative.
- **Gérer → Modifier la fiche** : modifie le catalogue, jamais le stock ou la péremption.
- **+ / −** : un mouvement confirmé par Firebase. Pour les articles avec lots, ces boutons ouvrent le choix du lot.
- **Quantité dans le tableau** : saisir le total voulu, puis ✓ ou Entrée. ↶ ou Échap annule la saisie. Aucune écriture avant validation ; si le stock a changé entre-temps, la correction est refusée. Les lots et les dates sont conservés. Une diminution en dessous des quantités déjà réparties exige un mouvement sur le lot concerné.
- **Raccourcis** : À recommander, Faire un comptage, Historique et Exporter se trouvent au-dessus du tableau, à côté de Tout dérouler/Tout replier. Le dernier mouvement se consulte près de la synchronisation.
- **Péremptions à suivre** : bouton jaune pour une date à moins de 30 jours, rouge dès qu’une date est dépassée (prioritaire), sans couleur d’alerte sinon. Le clic affiche les articles concernés. Les lots actifs sont pris en compte, les articles archivés et les lots vides sont exclus.
- **Catégorie / emplacement** : la catégorie est la famille choisie dans le menu des catégories existantes (ou « Nouvelle catégorie »). L’emplacement, facultatif, précise l’armoire ou l’étagère.
- **Minimum / souhaité** : le minimum déclenche une alerte lorsque le stock passe strictement en dessous ; le souhaité est la cible après réapprovisionnement. Exemple : disponible 3, minimum 5, souhaité 10 → 7 à commander, moins les quantités déjà commandées.
- **Photo** : 📷 demande la caméra du téléphone ; « Choisir sur l’appareil » permet de sélectionner un fichier. La photo est préparée sur l’appareil puis enregistrée uniquement avec la fiche. Annuler la fiche ne téléverse rien. La photo existante est conservée lors d’une modification sans changement de photo.
- **Mouvement** : entrée/sortie en quantité, avec motif et sélection d’un lot ou du stock non réparti.
- **Ajouter un lot** : soit répartir le stock existant (total inchangé), soit réceptionner une nouvelle livraison (total augmenté). La date historique reste intacte et concerne le stock non réparti.
- **Archiver** : masque un article dans l’inventaire actif et le scanner, sans le supprimer. Le filtre « Articles archivés » permet de le réactiver.
- **Gérer → Supprimer** : confirmation avec le nom, le stock et la commande éventuelle. Retire l’article de toutes les listes, y compris les archives, et du scanner. Les données et l’historique restent conservés dans la base. Le marqueur `catalog.deleted` empêche aussi les articles historiques de réapparaître depuis le catalogue de référence. Aucun document n’est effacé physiquement ; la suppression et sa trace d’historique sont atomiques. Une modification concurrente de fiche, stock ou commande bloque la confirmation.
- **À recommander** : stock strictement inférieur au minimum, plus les commandes en cours. Suggestion = souhaité − disponible − déjà commandé. Le suivi de commande ne transmet rien à un fournisseur. Une réception partielle augmente le stock et diminue le restant à recevoir.
- **Gérer → Commande → Réceptionner la commande** : saisir la quantité livrée aujourd’hui ou choisir « Tout réceptionner », vérifier le récapitulatif puis confirmer. Le stock augmente et le restant à recevoir diminue en une seule opération. Une réception totale clôture la commande. Le bouton « Enregistrer la commande » sert seulement à modifier le suivi, jamais à réceptionner. L’historique indique la quantité reçue et le solde. Une modification concurrente du restant à recevoir bloque la confirmation ; un nouvel essai de la même validation ne double pas le stock. Les dates et lots existants restent intacts, la quantité reçue rejoint le stock non réparti.
- **Faire un comptage** : saisir des quantités, contrôler le récapitulatif, puis valider. Maximum 100 articles par série. Un conflit annule la validation entière. Pour vérifier de nouveau un article en conflit, effacer sa saisie puis la ressaisir après contrôle physique. Les lots se corrigent avec les mouvements de chaque lot. Les brouillons de comptage sont propres à la session de navigateur et au compte ; ils ne remplacent jamais les stocks enregistrés.
- **Scanner** : fonctionnement inchangé ; utilise le même catalogue. Un code inconnu permet d’ouvrir une nouvelle fiche préremplie. Plusieurs correspondances affichent un choix explicite. Le doublon `4031815901417` reste inchangé ; la correction demandée pour les tensiomètres est décrite ci-dessous.
- **Exporter** : PDF/CSV des articles correspondant aux filtres, PDF de réapprovisionnement, ou JSON de tous les documents `inventory` et du catalogue de référence (y compris archives). Le JSON n’inclut pas la collection `history` et n’est pas une sauvegarde intégrale de Firebase.

## Fermeture des fenêtres

Les fenêtres natives de l’inventaire (statistiques, fiche article, historique, commandes, demandes, DEA et scanner intégré) se ferment par clic ou toucher sur le fond extérieur, avec le même parcours d’annulation que la touche Échap. Les clics dans le contenu, la zone vide interne ou un glissement commencé dans la fenêtre ne ferment rien. Une fiche modifiée conserve sa confirmation d’abandon ; un enregistrement en cours bloque la fermeture ; fermer le scanner arrête sa caméra et fermer les statistiques annule leur chargement. Les fenêtres de connexion, PIN, organigramme et installation PWA utilisent déjà la fermeture par leur fond extérieur.

## Statistiques annuelles

Le bouton **Statistiques annuelles**, à côté d’Historique, ouvre un tableau privé calculé à la demande avec la session staff existante. Il propose l’année, la catégorie, l’unité, la recherche, les classements les plus/moins commandés et sortis (hors zéro), le détail par article et l’export CSV du tableau filtré. Les quatre classements sont présentés en barres horizontales colorées, avec les noms, quantités et unités lisibles. Un graphique mensuel regroupe le nombre de commandes, sorties et réceptions calculables (des opérations, pas une somme d’unités différentes). Il suit les mêmes filtres d’année, article, catégorie et unité ; son tableau mensuel donne les valeurs exactes. Le tableau détaillé par article est replié par défaut pour laisser les graphiques au premier plan. Les articles archivés ou supprimés restent dans les résultats s’ils ont des opérations pour l’année. Les articles actifs sans aucune opération sont présentés séparément pour l’année actuelle ; une absence de trace n’est pas une preuve d’absence d’utilisation.

Le module lit **toute la collection history encore conservée**, par pages de 500 documents, et pas uniquement les 100 lignes du bouton Historique. Les lectures sont faites sur le serveur avec la connexion Firebase existante. Une lecture refusée, annulée ou interrompue par un changement de compte ne produit jamais de statistiques partielles présentées comme complètes. Les données restent en mémoire de la page, jusqu’à actualisation ou changement de compte ; elles ne sont ni publiées dans GitHub ni envoyées à un autre service. Chaque ouverture réutilise la lecture de la session ; **Actualiser l’historique** recharge les entrées. Le nombre d’entrées et la date du chargement sont affichés. Aucune écriture Firestore n’est déclenchée par la consultation.

Règles de calcul :

- **Commandé** : additions au restant à recevoir, et non somme des soldes successifs. Les annulations sont séparées. Une réception n’est pas une commande supplémentaire.
- **Reçu** : quantités réceptionnées via la commande, ou ajoutées par réception d’un lot. Une simple répartition en lots n’ajoute rien.
- **Autres entrées** : mouvements positifs de stock hors réception identifiée ; ils ne sont pas assimilés à des achats.
- **Sorties** : mouvements négatifs, indicateur de consommation de la réserve. Le motif libre ne permet pas de distinguer sûrement un usage, une perte ou une péremption ; ce n’est pas un décompte d’utilisation patient.
- **Corrections** : comptages et saisies directes du total, séparés des entrées/sorties. Les stocks initiaux, modifications de fiche et changements de péremption ne sont pas des consommations.

Les années suivent **Europe/Brussels**, y compris pour les mouvements proches de minuit le 31 décembre. Les commandes anciennes sont reconstituées chronologiquement, en tenant compte des réceptions et des soldes des années précédentes. Si la première commande conservée n’indique pas le solde précédent, sa quantité ajoutée ou annulée peut être inconnue : elle est signalée par **+ ?** dans la colonne concernée, sans inventer de zéro initial. Les événements sans date, quantités non interprétables et historiques purgés par une ancienne version ne sont pas reconstitués. Un premier chargement peut donc présenter une année partielle ; le périmètre et les incertitudes sont visibles.

Pour les **futures validations uniquement**, l’historique ajoute l’unité/catégorie de l’article et les quantités de commande avant/après modification. Le patch des stocks et des commandes garde sa logique existante ; aucun ancien document n’est réécrit ni recalculé en base. Les unités actuelles sont utilisées lorsque l’ancien historique n’en indique pas. Les unités différentes ne sont pas additionnées dans un grand total ; le filtre unité facilite les comparaisons. Les articles dont une unité historique diffère sont signalés et exclus des classements. Aucun prix ni montant financier n’est déduit de ces mouvements.

Les règles Firestore, les données de stock et l’authentification restent celles du projet existant. Si aucun compte staff n’est connecté dans l’environnement de vérification, les chiffres réels ne sont pas accessibles à l’assistant ; l’application calcule les premiers résultats directement à l’ouverture avec le compte de l’utilisateur, sans données de démonstration.

## Conservation des données

Le catalogue historique (268 articles) est extrait du commit `bc4669a1c457606374be29995901c4d5244ab764` et conservé dans `catalog-seed.js`. Les identifiants, noms, catégories, images, seuils et codes-barres de cette base de référence sont inchangés. **Ce fichier ne contient aucun stock initial ni aucune date de péremption.**

À l’ouverture, les documents Firestore sont uniquement lus. Il n’y a ni migration, ni initialisation en masse, ni écriture au chargement. Les valeurs stockées priment sur les valeurs du catalogue de référence. Les documents inconnus du catalogue historique restent affichés, sans être supprimés.

Exception ciblée demandée le 8 septembre 2026 : le code historique en double est `4002427000362`, et non `4002427000386`. Il est retiré du catalogue effectif de `consommables-93` (adulte) et `consommables-95` (pédiatrique). La base historique et les documents bruts restent intacts : la correction s’applique à la lecture, puis est persistée au prochain enregistrement explicite de la fiche. Les autres codes ne sont pas modifiés. Une nouvelle saisie ou un nouveau scan dans la fiche est autorisé, y compris pour ce code, grâce au marqueur `catalog.barcodeReviewVersion: 1` enregistré avec la fiche. Les stocks, dates et historiques ne sont jamais impliqués dans cette correction.

Les futures fiches sont stockées dans `inventory/{id}.catalog`. Les champs existants `stock`, `expirationDate`, `noExpiration`, ainsi que les champs inconnus, sont préservés tant qu’une opération dédiée ne les modifie pas explicitement. Les écritures utilisent une fusion de champs, jamais un remplacement du document complet. L’archivage change uniquement `catalog.active`.

Les lots optionnels utilisent `inventoryLots` dans le même document. Aucun lot n’est créé automatiquement. `inventoryOrder.quantity` est le restant à recevoir. `catalogRevision` et `inventoryStockRevision` servent à détecter les éditions concurrentes de cette version.

Chaque opération validée écrit atomiquement le document article, une nouvelle entrée `history` et `metadata/lastUpdate`. Les identifiants de validation évitent l’application répétée d’une même soumission. Un échec de droits ou un conflit n’applique aucune écriture partielle. Aucune suppression automatique de l’historique n’est effectuée par cette version.

En perte de connexion, les valeurs déjà chargées peuvent rester consultables mais aucune nouvelle modification n’est validée. Une page ouverte à froid attend la réponse du serveur plutôt que de présenter des zéros issus d’un cache vide. Il faut attendre **Enregistrement confirmé** avant de quitter après une modification.

## Accès et services existants

Projet Firebase et SDK conservés : `listing-44b2b`, Firebase Web 9.6.8. Aucune Cloud Function, aucun Storage ou service payant supplémentaire. Aucune modification des règles Firestore, de la facturation ou du PIN staff.

Les photos prises sur téléphone sont converties en JPEG (512 pixels maximum, réduites davantage si nécessaire), limitées à 120 Kio en représentation data URL dans `catalog.image`. Le fichier original n’est pas envoyé ; le réencodage retire ses métadonnées. Elles utilisent les quotas de la base existante et sont incluses dans l’export JSON. Cette limite reste bien inférieure à la [taille maximale d’un document Firestore](https://firebase.google.com/docs/firestore/quotas). Le bouton caméra utilise [la capture native du navigateur](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture) ; le choix exact affiché dépend du téléphone. Un format illisible affiche une erreur sans remplacer la photo existante.

Les droits réels demeurent ceux des règles Firestore déployées. Le PIN de `staff.html` est un verrou d’interface côté navigateur, pas un rôle administrateur contrôlé côté serveur. Cette mise à jour ne prétend pas en faire une barrière de sécurité serveur. Si les règles actuelles limitent les champs ou l’accès individuel aux entrées d’historique, une opération pourra être refusée : il faudra vérifier les règles existantes avec le propriétaire, jamais les rendre publiques pour contourner le refus.

Le scanner n’initialise pas un deuxième catalogue : il importe la même base de référence et lit les mêmes documents que l’inventaire.

## Vérifications

Le scanner conserve QR Code, Data Matrix et les formats de codes-barres existants. Il demande une image 1920 × 1080 en préférence, avec repli si les contraintes ne sont pas acceptées, et une zone de lecture plus haute pour les codes carrés. La mise au point, l’exposition et la balance des blancs continues sont appliquées uniquement si la caméra les expose ; leur refus ne bloque pas le scan. La résolution réellement fournie dépend du téléphone et du navigateur. La lampe reste manuelle et conserve les réglages acceptés. Aucun réglage ne peut reconstituer un code masqué par un reflet. Les changements s’appliquent au scanner de recherche et au scan depuis une fiche article.

Un QR contenant une URL ou un autre texte doit correspondre au contenu enregistré dans la fiche pour retrouver l’article. L’activation du décodage QR ne signifie pas qu’une URL sera automatiquement convertie en EAN. Voir [les réglages du décodeur](https://scanapp.org/html5-qrcode-docs/docs/apis/interfaces/Html5QrcodeCameraScanConfig) et [les contraintes de caméra](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints).

Depuis la racine du dépôt, avec Node.js 24 :

```sh
node --test inventaire/tests/*.test.mjs
```

Tests purs et adaptateur Firestore simulé : comparaison intégrale du catalogue d’origine, conservation de champs, concurrence, refus atomiques, idempotence, lots, comptages, commandes, dates, scanner et références locales. Ces tests ne contactent jamais la base réelle. Ils ne constituent pas une vérification des règles Firestore en production ni un essai de caméra sur iPhone.

L’ancienne version du code reste récupérable dans l’historique Git. Pour annuler cette livraison, restaurer uniquement les fichiers de cette livraison depuis le commit précédent. **Ne pas restaurer ou réinitialiser les documents Firestore** pour un retour arrière de code. Après la création de nouvelles fiches ou lots, préférer corriger la nouvelle interface : l’ancien écran ne sait pas les afficher.
# Demandes de réapprovisionnement

Le formulaire public `../demande-materiel.html` n’accède ni au catalogue ni à Firebase. Son QR code et son affiche imprimable sont dans `../assets/qr-demande-materiel.png` et `../demande-materiel-qr.html`.

Les demandes utilisent un service indépendant (Sites, D1) : `https://crbo-demandes-materiel.mycro99.chatgpt.site/api/requests`. Il vérifie les signatures des jetons Firebase du projet CRBO et réserve lecture, validation et abonnements push au gestionnaire autorisé, défini uniquement côté serveur. Une coche masque la demande ; elle conserve sa trace et ne modifie aucun stock. L’association facultative à un article est propre au gestionnaire.

Le service envoie des notifications Web Push aux appareils volontairement abonnés depuis « Demandes ». Sa clé privée VAPID reste dans les secrets du serveur. Le service worker existant reçoit les alertes et ouvre les demandes. Sur iPhone, ouvrir CRBO installé sur l’écran d’accueil avant d’activer les notifications. Aucun changement des règles Firestore ni fonction Firebase payante n’est nécessaire.

Le formulaire attend une confirmation serveur, garde sa saisie en cas d’erreur et réutilise son identifiant pour éviter les doublons lors d’une nouvelle tentative identique. Le serveur valide les champs, limite à 50 demandes par 24 heures et n’expose aucune réponse aux visiteurs.
