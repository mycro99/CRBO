# Feuille de route CS Oupeye - module à activer

Ce module est indépendant de `apps-script/Code.gs` : **ne pas remplacer le script des checklists**. Le formulaire est relié depuis les accès rapides de CRBO via `feuille-route.html`. Le QR code stable pointe vers le formulaire hébergé directement dans CRBO. L'affiche imprimable est `feuille-route-qr.html` et l'image `assets/qr-feuille-route.png`. Aucune donnée patient ne passe dans les URL ou le code du dépôt. Le formulaire ne stocke rien dans le navigateur : les données sont transmises en POST anonyme à Google, sans cookies Google. Un reçu technique distinct confirme la sauvegarde avant d’effacer les champs.

## Installation (contactoupeye@gmail.com)

1. Créer un nouveau projet sur https://script.google.com/ et le nommer « CRBO - Feuilles de route ».
2. Remplacer son fichier `Code.gs` par le fichier de ce dossier.
3. Ajouter un fichier **HTML**, nommé `Form`, et y coller `Form.html`.
4. Paramètres du projet : activer l'affichage de `appsscript.json` ; remplacer son contenu par celui fourni. Fuseau : Europe/Brussels.
5. Enregistrer, sélectionner `installerFeuilleRoute` (sans underscore final) dans la barre Exécuter et l'exécuter une fois. Autoriser les accès du nouveau projet. Cela crée un dossier Drive privé et un déclencheur toutes les cinq minutes. **Ne pas partager ce dossier ni ses sous-dossiers.**
6. Déployer > Nouveau déploiement > Application Web : exécuter en tant que **Moi**, accès **Tout le monde**. Ce choix donne uniquement accès au formulaire et à l'enregistrement, aucune API ne lit les fiches. La fonction publique d’installation vérifie l’identité active du propriétaire avant toute action. Les fonctions administratives finissant par `_` ne sont pas appelables depuis `google.script.run`.
7. Copier l'URL de l'application Web terminant par `/exec` et la communiquer pour l'intégration dans CRBO et le QR code.
8. Faire d'abord un essai avec une étiquette et une identité **fictives**. Vérifier l'enregistrement dans le Drive privé, l'envoi après changement de journée, le PDF (une course par page, étiquette lisible) et le nettoyage.

Les autorisations Drive/Documents sont nécessaires aux sauvegardes et au PDF. Elles sont plus étendues que le seul envoi des checklists. La suppression des fichiers utilise l'API Drive ; si Google demande d'activer cette API dans le projet Cloud associé, le faire avant activation en production. Aucun identifiant patient n'est placé dans un nom de fichier ou un journal.

## Fonctionnement

- Appareil photo ou galerie, JPEG compressé sans sauvegarde dans le stockage du navigateur.
- Identité en texte libre, facultative si photo ; photo ou identité obligatoire sauf « Pas de patient ».
- Choix domicile/autre adresse et les neuf hôpitaux/cinq motifs demandés.
- Date et heure d'enregistrement attribuées côté serveur. La journée correspond à **l'enregistrement**, pas à une date d'intervention saisie ; une course encodée après minuit appartient à la nouvelle journée.
- Un enregistrement est un fichier privé indépendant. Une référence stable évite les doublons lors d'une nouvelle tentative après perte de confirmation. Les reçus techniques sans identité/photo sont conservés trois jours.
- Le déclencheur, même sans téléphone connecté, traite les journées antérieures à la date actuelle en Belgique. Il n'efface jamais la journée en cours.
- Pour chaque journée non vide, génération du PDF complet puis sauvegarde dans son propre dossier daté, puis manifeste de traitement. **Aucune fiche n'est effacée avant ces deux sauvegardes.**
- Les fiches peuvent ensuite être supprimées, puisque le PDF privé les remplace. Aucun PDF d'une autre journée ne l'écrase.
- Si un quota, une conversion ou un nettoyage empêche l'envoi, les sources ou le PDF restent conservés et le déclencheur réessaie.
- Après retour sans erreur de `MailApp.sendEmail`, le statut `sent` est écrit durablement, puis le PDF et son manifeste sont supprimés définitivement. Un échec de nettoyage est repris sans renvoi du mail.
- Si l'appel mail échoue ou si son résultat reste indéterminé (interruption), le PDF reste conservé en état `review`, sans suppression ni renvoi automatique susceptible de dupliquer le mail. Voir ci-dessous.
- Un jour sans course n'envoie pas de PDF vide. Limites de protection : 200 courses/jour, JPEG 600 ko/course, PDF 23 Mio. Si une limite Google est atteinte, rien n'est effacé sans sauvegarde.

## Envoi accepté ≠ réception confirmée

MailApp ne fournit pas d'accusé de livraison à la boîte du destinataire. Le nettoyage après envoi signifie « appel d'envoi terminé sans erreur », **pas** « réception vérifiée ». Une réception réellement confirmée demanderait un mécanisme supplémentaire côté destinataire. Le PDF peut par ailleurs rester dans les messages envoyés/reçus des comptes mail ; le nettoyage Drive ne supprime pas ces e-mails.

Un stockage court ne rend pas une étiquette patient anonyme. Le stockage est privé et sans lecture publique, mais l'usage des comptes, de l'hébergement et de la messagerie pour de vraies données patient doit être validé par le responsable compétent du CS avant la mise en service. Ne pas utiliser de vraies étiquettes pour le premier essai.

## Résultat d'envoi incertain

Dans Drive, un dossier de journée contenant `batch.json` avec `phase: "review"` et son PDF doit être conservé. Consulter les exécutions du script : le journal `ROUTE_SEND_UNCERTAIN` n'indique que la date.

- Vérifier les messages envoyés et, si nécessaire, la réception auprès du destinataire.
- Si le PDF a bien été envoyé, modifier **uniquement** `phase` en `"sent"` dans `batch.json`. Le prochain passage nettoie sans renvoyer.
- S'il n'a pas été envoyé, modifier **uniquement** `phase` en `"prepared"`. Le prochain passage retente l'envoi avec le PDF conservé.
- Ne jamais supprimer un dossier en attente ou remplacer un PDF en attente par celui d'un autre jour.

## Vérifications effectuables localement

`node --test apps-script/feuille-route/tests/*.test.mjs`

Le rendu Google Docs/PDF, les autorisations Google et le déclencheur réel doivent encore être vérifiés sur le nouveau déploiement avec des données fictives. Les tests simulés ne remplacent pas cet essai.

## Application Web reliée

https://script.google.com/macros/s/AKfycbyTKz-6nf540Fgd87UfD4bADYcy1Qk5gDYWDvE6pcytlPVgDGqe5A8RYjaeV19NRfSvSA/exec

Après modification du script, mettre à jour le déploiement existant (Modifier > Nouvelle version) pour conserver cette URL.

## Correction de l’erreur Google Drive à l’ouverture (comptes multiples)

Le formulaire est maintenant affiché directement par GitHub Pages. Le navigateur ne navigue plus sur Google pour l’ouvrir. Pour activer les enregistrements depuis ce formulaire :

1. Remplacer **Code.gs** dans le projet **Feuilles de route** par le fichier actualisé de ce dossier. Les fichiers Form.html et appsscript.json déjà installés peuvent rester en place.
2. Enregistrer. **Ne pas réexécuter l’installation** : le dossier privé et le déclencheur sont conservés.
3. Déployer > Gérer les déploiements > sélectionner l’application existante > crayon > **Nouvelle version** > Déployer. Garder Moi / Tout le monde et la même URL /exec.
4. Recharger https://mycro99.github.io/CRBO/feuille-route.html et faire un essai fictif en navigation normale.

Le POST utilise `credentials: omit` et une réponse opaque ; une réponse opaque n’est jamais considérée comme un succès. Un GET distinct avec l’identifiant aléatoire de la soumission doit confirmer `stored: true` avant d’annoncer l’enregistrement. Le reçu n’expose ni photo, ni nom, ni adresse, ni empreinte du contenu. Les erreurs d’enregistrement conservent les réponses dans la page. Le QR code reste identique.
