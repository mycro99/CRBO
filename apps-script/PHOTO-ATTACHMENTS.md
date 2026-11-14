# Photos séparées du PDF : contrat côté site

Le site prépare les photos des checklists Ambulance, TPMR et FIT en JPEG séparés. La sélection et la compression restent dans `vehicle-photos.js`. Les photos ne sont plus insérées dans le PDF.

**Le code Google doit être déployé manuellement dans le projet existant.** Le PDF terminé et les photos sont sauvegardés sur l’appareil avant transmission. Le site vérifie ensuite les capacités `photoAttachments: true` et `receiptApi: 1`. Un ancien déploiement bloque le POST, sans supprimer la copie locale. Le suivi des reçus s’applique aussi aux autres documents.

## Activation dans Google Apps Script

Le `doGet()` annonce `photoAttachments: true` dans cette version de `Code.gs`. Cette capacité devient visible pour le site après la mise à jour du déploiement existant (voir `README.md`).

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

Le serveur valide les types de checklist autorisés, le nombre de photos (12 maximum), le MIME et la signature JPEG, ainsi que la taille cumulée des JPEG décodés (6 Mio maximum), puis joint les blobs à côté du PDF dans **un même mail**. Les noms sont reconstruits sur le serveur. Une photo invalide bloque tout le mail pour éviter un envoi incomplet. Le destinataire fixe, la vérification du compte, le compteur journalier, le verrou et la protection contre les doublons sont conservés.

Le mode `no-cors` ne permet pas de lire le résultat du POST. Un GET séparé consulte désormais le reçu : aucun succès n’est annoncé sans l’état `sent` écrit après le retour de MailApp. La copie locale reste disponible tant que cet état n’est pas confirmé. Voir `README.md` pour la reprise et les limites de conservation. Un essai réel reste nécessaire après le redéploiement Google.
