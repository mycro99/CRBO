# Envoi des documents CRBO

Le même projet Google Apps Script envoie les quatre checklists et les commandes de tenues. Le destinataire est fixé dans le script, jamais fourni par le formulaire. La limite de 30 envois quotidiens et le compteur existant sont partagés par tous ces documents.

## Mise à jour du projet existant

1. Ouvrir Google Apps Script avec `contactoupeye@gmail.com` et le projet actuellement utilisé pour les checklists.
2. Remplacer entièrement le contenu de `Code.gs` par celui de ce dossier et enregistrer.
3. Choisir **Déployer → Gérer les déploiements**, sélectionner le déploiement actif, puis le crayon **Modifier**.
4. Dans **Version**, sélectionner **Nouvelle version**, puis **Déployer**. Conserver **Exécuter en tant que : Moi** et **Qui a accès : Tout le monde**.

Cette mise à jour conserve l’URL déjà intégrée dans `checklist-email.js`. Enregistrer le code seul ne met pas à jour l’application publiée.

## Commandes de tenues

Le formulaire conserve le téléchargement et ajoute **Envoyer par mail**. Il exige un nom, une date et au moins une quantité entière positive. Le PDF reprend le formulaire rempli et sa signature.

- Expéditeur : `contactoupeye@gmail.com`.
- Destinataire : `logistique.cs.oupeye@croix-rouge.be`.
- Objet : `Commande de tenues - Nom du demandeur`.
- Pièce jointe : `commande-tenues-JJ-MM-AA.pdf`.

## Confirmation des envois et reprise après interruption

Après mise à jour, l’URL `/exec` doit annoncer `"receiptApi": 1`. Les pages vérifient cette capacité pour **tous les documents**, avant de lancer le POST. Tant que l’ancien script est publié, le document est sauvegardé localement mais l’envoi est bloqué avec une instruction de mise à jour.

Le POST reste en `no-cors`, avec `credentials: "omit"`. Sa réponse opaque **ne constitue jamais une confirmation**. Le navigateur consulte ensuite un reçu par GET avec un UUID aléatoire. Seul l’état `sent`, écrit après le retour de `MailApp.sendEmail`, autorise le message « Envoi confirmé par Google ». Cela confirme l’acceptation par Google, pas la livraison dans la boîte destinataire (spam, rejet ultérieur ou retard restent possibles).

Avant toute transmission, le PDF terminé et les JPEG sont enregistrés dans IndexedDB. Si cette sauvegarde échoue (stockage bloqué ou saturé), aucun POST n’est lancé. Il s’agit d’une **copie du document au moment de l’envoi**, pas d’une sauvegarde continue des champs pendant la saisie. Une fermeture avant la fin de la préparation du document n’est donc pas couverte.

En cas de coupure, refus ou absence de confirmation, la copie reste sur le même appareil et dans le même navigateur. En rouvrant la même checklist, le cadre **Envois à confirmer** permet de vérifier/réessayer avec le même identifiant ou de télécharger le PDF et chaque photo. Une copie n’est automatiquement supprimée qu’après lecture du reçu `sent`. Une suppression manuelle exige une confirmation. Effacer les données du navigateur ou utiliser une session privée supprime aussi les sauvegardes ; aucun stockage navigateur ne garantit une conservation absolue.

Le bouton de reprise consulte d’abord l’ancien reçu. Il ne renvoie pas un document déjà envoyé. Un état `sending` attend une confirmation ; `review` demande une vérification manuelle dans Apps Script. Les refus survenus avant l’appel MailApp peuvent être réessayés. Un timeout ou une exception pendant MailApp est considéré comme incertain : aucun renvoi automatique. Il n’y a pas de nouvel envoi en arrière-plan après fermeture de la page.

Les reçus sont stockés dans les propriétés du script (30 jours, nettoyage lors des envois). Ils ne contiennent ni PDF, ni photo, ni identité du formulaire. Une copie locale de plus de 29 jours reste téléchargeable mais ne peut plus être renvoyée par le bouton, pour éviter de s’appuyer sur un reçu expiré. Les anciennes requêtes restent acceptées, mais les anciennes pages ne bénéficient pas de la sauvegarde et du suivi : recharger les pages après publication.

Aucun nouveau déclencheur ni changement de manifeste n’est nécessaire. Ce projet est distinct de celui des feuilles de route.

## Vérification locale

`node --test apps-script/tests/document-mail.test.mjs`

Les tests utilisent des doubles des services Google et n’envoient aucun mail.

## Photos des véhicules

Les checklists Ambulance, TPMR et FIT peuvent joindre jusqu’à 12 JPEG séparés du PDF, dans le même mail (6 Mio au total pour les photos). Le schéma annoté reste dans le PDF. Une photo invalide bloque tout le mail. Les fichiers photo sont nommés avec la plaque, la date et un numéro. La limite journalière reste de 30 mails, quel que soit le nombre de pièces jointes.

Après mise à jour, ouvrir l’URL `/exec` existante : la réponse doit contenir `"photoAttachments": true`. Recharger une checklist et tester un envoi avec une photo pour vérifier la réception du PDF et du JPEG séparés.
