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

Avant une commande, le site vérifie que le service publié annonce le type `tenues`. L’ancien script bloque donc ce nouvel envoi avec un message explicite jusqu’à sa mise à jour. Cette vérification n’est pas ajoutée aux checklists existantes.

Le POST utilise le mode navigateur `no-cors` : le site peut confirmer la transmission, mais ne peut pas lire la réponse d’envoi du serveur. Vérifier la réception réelle du premier essai et, si nécessaire, la section **Exécutions** dans Apps Script. Attendre la fin de la transmission avant de quitter le formulaire.

## Vérification locale

`node --test apps-script/tests/document-mail.test.mjs`

Les tests utilisent des doubles des services Google et n’envoient aucun mail.
