# File d’envoi privée des documents CRBO

Ce projet envoie les quatre checklists (Ambulance, TPMR, FIT, Péremption) et les commandes de tenues. Il est **distinct du projet des feuilles de route**.

- Compte d’envoi : `contactoupeye@gmail.com`.
- Destinataire fixé par le serveur : `logistique.cs.oupeye@croix-rouge.be`.
- Sujets et noms de fichiers conservés : `Checklist - PLAQUE`, `checklist-JJ-MM-AA.pdf`, ou commande de tenues avec le nom du demandeur.
- Limite commune : 30 tentatives d’envoi par jour, selon le compteur existant `CHECKLIST_SEND_COUNTER`. Une tentative MailApp incertaine compte aussi pour éviter de dépasser cette limite après un arrêt.
- PDF : 10 Mio maximum ; jusqu’à 12 photos JPEG séparées, 6 Mio au total, pour Ambulance/TPMR/FIT.

## Installation / mise à jour dans le projet existant

1. Ouvrir **mail auto checklist** dans Apps Script avec `contactoupeye@gmail.com`. Remplacer intégralement `Code.gs` par [Code.gs](Code.gs), puis enregistrer.
2. Dans les paramètres du projet (roue dentée), activer **Afficher le fichier manifeste appsscript.json dans l’éditeur**. Revenir à l’éditeur et remplacer son contenu par [appsscript.json](appsscript.json). Enregistrer. Les autorisations nécessaires sont Drive, envoi de mails, gestion des déclencheurs et identité du compte. Le code n’utilise pas Firebase ni de service facturé supplémentaire.
3. Dans la liste des fonctions à côté d’**Exécuter**, choisir **installerFileEnvoi**, puis **Exécuter**. Autoriser les accès demandés avec `contactoupeye@gmail.com`. L’installation crée le dossier privé et **un seul** déclencheur `traiterFileEnvoi`, environ toutes les 5 minutes. Elle est réexécutable et ne supprime ni sauvegardes ni déclencheurs d’autres fonctions. Le journal donne le lien du dossier Drive.
4. **Déployer → Gérer les déploiements → déploiement existant → crayon → Nouvelle version → Déployer**. Garder **Exécuter en tant que : Moi**, **Qui a accès : Tout le monde** et la même URL `/exec`.
5. Recharger le formulaire CRBO. L’URL `/exec` doit annoncer `"receiptApi": 1`, `"serverQueue": 1` et `"queueReady": true`. Faire un essai fictif avec une photo, vérifier le mail, ses pièces jointes et le nettoyage Drive.

Enregistrer le code seul ne met pas à jour l’application Web. Le déclencheur, lui, utilise le code enregistré dans l’éditeur. Ne pas exécuter `doPost` manuellement. Aucune création de dossier ou de déclencheur manuelle n’est nécessaire.

## Ce que confirme le site

Avant le transfert, le PDF terminé et les photos sont sauvegardés dans IndexedDB sur le téléphone. Ce n’est pas une sauvegarde continue du formulaire pendant la saisie. Une fermeture avant la fin de la préparation du PDF n’est pas couverte.

La requête POST est envoyée en `no-cors`, avec `credentials: "omit"`. Sa réponse opaque **n’est jamais considérée comme une preuve d’envoi**. Le site consulte un reçu séparé avec un UUID aléatoire :

- **Document et photos enregistrés sur Drive** : le serveur a terminé la sauvegarde, les pièces jointes sont référencées dans un manifest complet et le suivi indique `stored: true`. L’équipe peut fermer la page ; le serveur prend la suite en charge.
- **Envoi confirmé par Google** : `MailApp.sendEmail` a terminé et un marqueur durable `sent` existe. Cela ne prouve pas la livraison dans la boîte destinataire : filtrage, rejet ultérieur ou retard restent possibles.
- **Enregistrement non confirmé** : conserver la copie locale et reprendre sur le même téléphone/navigateur avec **Vérifier / réessayer**. Aucun succès n’est inventé à partir de la fin du fetch.
- **Envoi incertain** : le document reste sur Drive, un contrôle manuel est nécessaire et aucun renvoi aveugle n’est lancé.

Après un reçu Drive, le site permet de préparer d’autres checklists. La copie locale reste disponible jusqu’au reçu `sent` ; son état est revérifié à la réouverture de la page. Il n’y a pas de renvoi depuis le téléphone en arrière-plan. Effacer les données du navigateur ou fermer une session privée peut supprimer les copies locales ; la copie déjà confirmée sur Drive n’en dépend plus.

Le site bloque le POST si le script n’annonce pas la nouvelle file ou si son déclencheur n’est pas installé. Le document reste alors sur l’appareil.

## Conservation et nettoyage Drive

Le dossier **CRBO - Envois documents - PRIVÉ** appartient au compte d’envoi, sans partage. Chaque document a son sous-dossier `envoi-UUID` :

- le PDF et chaque JPEG sont de vrais fichiers consultables par le propriétaire du Drive ;
- `envoi.json` contient l’état, les références des pièces jointes, les tentatives et le dernier problème ;
- le manifest est créé **en dernier**. Un dossier incomplet n’est jamais envoyé ni annoncé comme sauvegarde complète.

**Échec de l’envoi initial ou d’une tentative automatique : le PDF, les photos et le manifest restent sur Drive, sans expiration automatique.** Les fragments d’un téléversement Drive incomplet restent également pour diagnostic ; le téléphone ne reçoit pas de confirmation et garde sa copie. Une reprise avec le même UUID peut remplacer ces fragments, qui n’ont jamais été envoyés.

**Envoi réussi : après écriture du marqueur durable `sent` et d’un reçu indépendant, tout le sous-dossier est mis à la corbeille Drive.** Il disparaît du dossier de sauvegarde actif. Il ne s’agit pas d’un effacement définitif de la corbeille. Si le nettoyage échoue, la copie reste sur Drive ; le déclencheur réessaie uniquement le nettoyage, sans renvoyer le mail.

Les reçus ne contiennent ni PDF, ni photo, ni identité du formulaire. Les reçus terminaux sont conservés 30 jours ; ceux des envois encore en attente ou incertains ne sont pas purgés. Une copie locale de plus de 29 jours reste téléchargeable mais n’est plus renvoyée automatiquement, pour éviter de se baser sur un ancien reçu expiré.

## Tentatives automatiques et doublons

Le serveur tente un premier envoi après l’enregistrement complet. Le déclencheur **traiterFileEnvoi** reprend ensuite les dossiers en attente, sans application ouverte :

- erreur avant l’appel MailApp : copie conservée et nouvelle tentative prévue après environ 5 minutes ;
- quota Gmail ou limite quotidienne détectés : nouvelle vérification après une heure, puis reprise quand le quota le permet ;
- arrêt ou exception **pendant** l’appel MailApp : état `review`, copie conservée, pas de renvoi automatique car le mail a pu être accepté malgré l’erreur ;
- succès enregistré mais nettoyage échoué : reprise du nettoyage uniquement.

Un verrou empêche deux exécutions d’envoyer le même document en parallèle. Le marqueur `sending` est écrit avant MailApp ; une interruption après ce marqueur passe en vérification manuelle. Les reprises du téléphone conservent le même UUID et ne remplacent pas un document déjà enregistré.

La file est plafonnée à 60 dossiers actifs (y compris les dossiers à vérifier ou incomplets). Si elle est pleine, les nouveaux enregistrements sont refusés sans supprimer les anciennes sauvegardes ; le téléphone conserve sa copie.

## Diagnostic propriétaire

Dans l’éditeur, exécuter **consulterFileEnvoi** : le journal indique les dossiers Drive, leur état, les tentatives et le dernier problème. Aucun diagnostic ni accès aux fichiers n’est exposé aux utilisateurs du formulaire.

Pour un état `review`, vérifier les **Exécutions** du projet (doPost ou traiterFileEnvoi) et la réception réelle du mail avant une reprise. Ne pas supprimer ou modifier le manifest pour forcer un renvoi sans cette vérification.

Les échecs Drive persistants, la révocation des autorisations ou la suppression du déclencheur peuvent empêcher les tentatives automatiques : vérifier le déclencheur et ses exécutions si un dossier reste en attente. Le système conserve les documents qu’il a effectivement enregistrés ; il ne peut pas sauvegarder un transfert qui n’est jamais arrivé au serveur.

## Vérification locale

```sh
node --test apps-script/tests/document-mail.test.mjs
```

Les tests simulent Drive, MailApp, les propriétés du script, le déclencheur et IndexedDB. Ils couvrent les quatre checklists, les tenues, les JPEG, la reprise sur serveur sans téléphone, les quotas, les doublons, les sauvegardes partielles, les marqueurs incertains et le nettoyage. Aucun mail réel n’est envoyé par les tests.
