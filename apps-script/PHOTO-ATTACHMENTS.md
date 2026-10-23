# Photos séparées du PDF : contrat côté site

Le site prépare les photos des checklists Ambulance, TPMR et FIT en JPEG séparés. La sélection et la compression restent dans `vehicle-photos.js`. Les photos ne sont plus insérées dans le PDF.

**Le script Google n'est pas encore modifié dans cette étape.** Les requêtes avec photos sont bloquées avant création du PDF et avant POST tant que le service ne déclare pas cette capacité. Les photos restent disponibles dans le formulaire pour réessayer. Les checklists sans photo, les péremptions et les commandes de tenues gardent leur fonctionnement actuel.

## À ajouter lors de la prochaine mise à jour Google

Le `doGet()` devra annoncer `photoAttachments: true` uniquement une fois la prise en charge déployée. Cette clé n'existe pas dans la version actuelle de `Code.gs`.

Le POST conserve tous ses champs existants et ajoute, si des photos sont présentes :

```json
{
  "photos": [
    {
      "filename": "photo-1-ABC-234-2026-10-23-01.jpg",
      "mimeType": "image/jpeg",
      "base64": "...JPEG encodé, sans préfixe data:..."
    }
  ]
}
```

Le serveur devra valider les types de checklist autorisés, le nombre de photos (12 maximum), le MIME et la signature JPEG, ainsi que la taille cumulée des JPEG décodés (6 Mio maximum), puis joindre les blobs à côté du PDF dans **un même mail**. Les noms reçus devront être nettoyés ou reconstruits sur le serveur. Il devra rejeter une photo invalide avant tout envoi pour éviter un mail incomplet. Le destinataire fixe, la vérification du compte, le compteur journalier, le verrou et la protection contre les doublons devront être conservés.

Le mode `no-cors` existant ne permet pas de lire le résultat du POST : la vérification préalable empêche l'utilisation de l'ancien serveur, mais une réception réelle devra être testée après la mise à jour Google.
