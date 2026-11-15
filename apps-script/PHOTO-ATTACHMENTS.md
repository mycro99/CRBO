# Photos des véhicules et file d’envoi

Les checklists Ambulance, TPMR et FIT préparent jusqu’à 12 JPEG séparés du PDF (6 Mio cumulés) avec `vehicle-photos.js`. Le schéma annoté reste dans le PDF. Les photos ne sont pas incorporées dans les pages du PDF.

Le POST conserve ses champs existants et ajoute les photos :

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

Le serveur valide les types, le nombre, la signature JPEG et la taille avant de créer les fichiers Drive. Il reconstruit les noms et conserve le PDF avec les JPEG dans un sous-dossier privé. Une photo invalide bloque l’ensemble du document ; il ne confirme jamais une sauvegarde partielle.

Le manifest complet est créé en dernier. L’envoi initial et les tentatives automatiques lisent les mêmes fichiers Drive et joignent tous les JPEG à côté du PDF dans **un seul mail**. Tout échec ou état incertain conserve la sauvegarde. Seul un envoi confirmé permet la mise à la corbeille du dossier complet.

Le site exige `photoAttachments: true`, `receiptApi: 1`, `serverQueue: 1` et `queueReady: true`. Le reçu indépendant `stored: true` permet de fermer la page ; `sent` confirme ensuite le retour réussi de MailApp. Voir [README.md](README.md) pour le manifeste Apps Script, l’installation du déclencheur et les règles de reprise.
