/** Module indépendant : créer un NOUVEAU projet Apps Script, pas remplacer les checklists. */
const ROUTE = Object.freeze({
  sender: 'contactoupeye@gmail.com', recipient: 'logistique.cs.oupeye@croix-rouge.be',
  timezone: 'Europe/Brussels', maxPhotoBytes: 600000, maxCoursesPerDay: 200,
  maxPdfBytes: 23 * 1024 * 1024
});
const HOSPITALS = Object.freeze({
  AR: 'André Renard', NDH: 'Notre-Dame d’Hermalle', CITA: 'Citadelle',
  MLE: 'MontLégia', CHU: 'CHU Sart Tilman', NDB: 'Notre-Dame des Bruyères',
  CHBA: 'Bois de l’Abbaye', AZ: 'AZ Vesalius - Tongeren', UMC: 'UMC+ Maastricht'
});
const OUTCOMES = Object.freeze({
  absent: 'Pas de patient', refus: 'Refus', dcd: 'DCD',
  sur_place: 'Acte posé sur place', autre_transport: 'Transporté par un autre moyen'
});
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Form').setTitle('Feuille de route - CS Oupeye')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
// Seule opération patient appelable depuis la page publique. Aucun accès en lecture.
function enregistrerCourse(payload) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Service occupé. Réessayez avec cette page ouverte.');
  try {
    const value = validateCourse_(payload);
    const root = root_();
    const day = routeDay_(new Date());
    const props = PropertiesService.getScriptProperties();
    const key = 'RECEIPT_' + value.id;
    const hash = digest_(JSON.stringify(value));
    const prior = props.getProperty(key);
    if (prior) {
      const old = JSON.parse(prior);
      if (old.hash !== hash) throw new Error('Cette référence a déjà été utilisée. Recommencez une nouvelle course.');
      if (old.saved !== false || named_(dayFolder_(root, old.day), 'course-' + value.id + '.json')) {
        old.saved = true; props.setProperty(key, JSON.stringify(old));
        return {ok: true, receipt: value.id, day: old.day};
      }
    }
    const folder = dayFolder_(root, day);
    const name = 'course-' + value.id + '.json';
    const oldFile = named_(folder, name);
    // Une sauvegarde peut avoir réussi avant une interruption de l’accusé de réception.
    if (oldFile) {
      const old = JSON.parse(oldFile.getBlob().getDataAsString());
      if (digest_(JSON.stringify(old.course)) !== hash) throw new Error('Référence déjà utilisée.');
    } else {
      if (courseFiles_(folder).length >= ROUTE.maxCoursesPerDay) throw new Error('Capacité quotidienne atteinte. Utilisez la procédure habituelle.');
      // Journal de tentative avant écriture : une reprise après minuit retrouve la date d’origine.
      props.setProperty(key, JSON.stringify({hash: hash, day: day, at: Date.now(), saved: false}));
      folder.createFile(name, JSON.stringify({day: day, receivedAt: new Date().toISOString(), course: value}), MimeType.PLAIN_TEXT);
    }
    props.setProperty(key, JSON.stringify({hash: hash, day: day, at: Date.now(), saved: true}));
    return {ok: true, receipt: value.id, day: day};
  } finally { lock.releaseLock(); }
}
function validateCourse_(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p) || p.website) throw new Error('Formulaire invalide.');
  if (!/^[a-f0-9-]{36}$/i.test(String(p.id || ''))) throw new Error('Référence invalide.');
  const text = (v, max) => {
    const s = String(v || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    if (s.length > max) throw new Error('Texte trop long.');
    return s;
  };
  const identity = text(p.identity, 300);
  if (!['domicile', 'autre'].includes(p.pickup)) throw new Error('Choisissez le lieu de prise en charge.');
  const address = p.pickup === 'autre' ? text(p.address, 240) : '';
  if (p.pickup === 'autre' && !address) throw new Error('Adresse de prise en charge manquante.');
  if (!['hopital', 'sans_prise_en_charge'].includes(p.destination)) throw new Error('Choisissez la destination.');
  const hospital = p.destination === 'hopital' ? String(p.hospital || '') : '';
  const outcome = p.destination === 'sans_prise_en_charge' ? String(p.outcome || '') : '';
  if (hospital && !Object.prototype.hasOwnProperty.call(HOSPITALS, hospital) || p.destination === 'hopital' && !hospital) throw new Error('Hôpital invalide.');
  if (outcome && !Object.prototype.hasOwnProperty.call(OUTCOMES, outcome) || p.destination === 'sans_prise_en_charge' && !outcome) throw new Error('Motif invalide.');
  const photo = String(p.photo || '');
  if (photo) {
    if (photo.length > Math.ceil(ROUTE.maxPhotoBytes / 3) * 4 || photo.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(photo)) throw new Error('Photo invalide ou trop volumineuse.');
    const bytes = Utilities.base64Decode(photo);
    if (bytes.length > ROUTE.maxPhotoBytes || bytes.length < 5 || (bytes[0] & 255) !== 255 || (bytes[1] & 255) !== 216 || (bytes[2] & 255) !== 255 || (bytes[bytes.length - 2] & 255) !== 255 || (bytes[bytes.length - 1] & 255) !== 217) throw new Error('Une photo JPEG valide est nécessaire.');
  }
  if (!photo && !identity && outcome !== 'absent') throw new Error('Ajoutez la photo de l’étiquette ou l’identité du patient.');
  return {id: p.id, identity: identity, pickup: p.pickup, address: address,
    destination: p.destination, hospital: hospital, outcome: outcome, photo: photo};
}
function routeDay_(now) { return Utilities.formatDate(now, ROUTE.timezone, 'yyyy-MM-dd'); }
function digest_(s) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)); }
function account_() {
  if (String(Session.getEffectiveUser().getEmail()).toLowerCase() !== ROUTE.sender) throw new Error('Compte de déploiement incorrect.');
}
function privateFolder_(folder) {
  if (folder.getSharingAccess() !== DriveApp.Access.PRIVATE || folder.getEditors().length || folder.getViewers().length) throw new Error('Le dossier doit rester privé et sans partage.');
  return folder;
}
function root_() {
  account_();
  const id = PropertiesService.getScriptProperties().getProperty('ROUTE_ROOT');
  if (!id) throw new Error('Le service n’est pas encore activé.');
  return privateFolder_(DriveApp.getFolderById(id));
}
function named_(folder, name) { const files = folder.getFilesByName(name); return files.hasNext() ? files.next() : null; }
function dayFolder_(root, day) {
  const found = root.getFoldersByName(day);
  return privateFolder_(found.hasNext() ? found.next() : root.createFolder(day));
}
function courseFiles_(folder) {
  const result = [], files = folder.getFiles();
  while (files.hasNext()) { const f = files.next(); if (/^course-[a-f0-9-]{36}\.json$/i.test(f.getName())) result.push(f); }
  return result;
}
/** Point d’entrée visible dans le menu Exécuter, réservé au propriétaire. */
function installerFeuilleRoute() {
  if (String(Session.getActiveUser().getEmail() || '').toLowerCase() !== ROUTE.sender) {
    throw new Error('Exécutez cette installation depuis l’éditeur avec ' + ROUTE.sender + '.');
  }
  installerFeuilleRoute_();
}
/** À exécuter UNE FOIS depuis l’éditeur, connecté comme contactoupeye@gmail.com. */
function installerFeuilleRoute_() {
  account_();
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    if (!props.getProperty('ROUTE_ROOT')) {
      const root = DriveApp.createFolder('CRBO - Feuilles de route - PRIVÉ');
      privateFolder_(root); props.setProperty('ROUTE_ROOT', root.getId());
    }
    root_();
    ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'traiterJournees_') ScriptApp.deleteTrigger(t); });
    ScriptApp.newTrigger('traiterJournees_').timeBased().everyMinutes(5).create();
    console.log('Service installé. Déployez le projet comme application Web.');
  } finally { lock.releaseLock(); }
}
/** Déclencheur autonome. Fonctions finissant par _ inaccessibles à google.script.run. */
function traiterJournees_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const root = root_(), today = routeDay_(new Date()), days = [], folders = root.getFolders();
    while (folders.hasNext()) { const f = folders.next(); if (/^\d{4}-\d{2}-\d{2}$/.test(f.getName()) && f.getName() < today) days.push(f); }
    days.sort((a, b) => a.getName().localeCompare(b.getName()));
    const started = Date.now();
    for (const folder of days) {
      if (Date.now() - started > 200000) break;
      try { processDay_(privateFolder_(folder)); }
      catch (_) { console.error('ROUTE_BATCH_FAILED: journée conservée, aucune donnée patient dans ce journal.'); }
    }
    const props = PropertiesService.getScriptProperties();
    const all = props.getProperties();
    Object.keys(all).filter(k => k.startsWith('RECEIPT_')).forEach(k => {
      if (Date.now() - JSON.parse(all[k]).at > 3 * 86400000) props.deleteProperty(k);
    });
  } finally { lock.releaseLock(); }
}
function processDay_(folder) {
  const day = folder.getName();
  let manifestFile = named_(folder, 'batch.json');
  let state = manifestFile ? JSON.parse(manifestFile.getBlob().getDataAsString()) : null;
  if (!state) {
    const files = courseFiles_(folder);
    if (!files.length) return;
    const records = files.map(f => ({file: f, record: JSON.parse(f.getBlob().getDataAsString())}));
    records.forEach(r => {
      const c = r.record.course;
      PropertiesService.getScriptProperties().setProperty('RECEIPT_' + c.id, JSON.stringify({hash: digest_(JSON.stringify(c)), day: day, at: Date.now(), saved: true}));
    });
    records.sort((a, b) => a.record.receivedAt.localeCompare(b.record.receivedAt) || a.record.course.id.localeCompare(b.record.course.id));
    const pdf = buildPdf_(folder, day, records.map(r => r.record));
    state = {day: day, count: records.length, phase: 'prepared', pdfId: pdf.getId(), pdfHash: pdfHash_(pdf.getBlob()), sourceIds: files.map(f => f.getId())};
    // Le manifeste n’est créé QU’APRÈS la persistance du PDF complet.
    manifestFile = folder.createFile('batch.json', JSON.stringify(state), MimeType.PLAIN_TEXT);
  }
  const save = () => manifestFile.setContent(JSON.stringify(state));
  // Une interruption après appel au service mail peut rendre le résultat indéterminé.
  // Ne jamais supprimer ni réexpédier aveuglément dans ce cas.
  if (state.phase === 'sending') {
    state.phase = 'review'; save();
    console.error('ROUTE_SEND_UNCERTAIN: vérifier Envoyés avant de relancer la journée ' + day);
    return;
  }
  if (state.phase === 'review') return;
  if (state.phase === 'sent') {
    state.sourceIds.forEach(id => removeFile_(id));
    removeFile_(state.pdfId); removeFile_(manifestFile.getId()); return;
  }
  if (state.phase !== 'prepared') throw new Error('État de lot inconnu.');
  const attachment = DriveApp.getFileById(state.pdfId).getBlob();
  // Revérifier le fichier sauvegardé à CHAQUE reprise avant de toucher aux sources.
  if (pdfHash_(attachment) !== state.pdfHash) throw new Error('Sauvegarde PDF modifiée : sources conservées.');
  state.sourceIds.forEach(id => removeFile_(id));
  if (MailApp.getRemainingDailyQuota() < 1) return;
  state.phase = 'sending'; save();
  try {
    MailApp.sendEmail({to: ROUTE.recipient, subject: 'Feuille de route - CS Oupeye - ' + day,
      body: 'Feuille de route du ' + day + '\n' + state.count + ' course(s).\nUne course par page dans le PDF joint.\nRéférence du lot : CRBO-' + day,
      attachments: [attachment], name: 'Feuille de route - CS Oupeye'});
  } catch (_) {
    state.phase = 'review'; save();
    console.error('ROUTE_SEND_UNCERTAIN: PDF conservé, vérifier Envoyés pour ' + day);
    return;
  }
  // MailApp a terminé sans erreur : ce n’est PAS un accusé de réception destinataire.
  state.phase = 'sent'; state.sentAt = new Date().toISOString(); save();
  removeFile_(state.pdfId); removeFile_(manifestFile.getId());
}
function pdfHash_(blob) {
  const bytes = blob.getBytes();
  if (bytes.length < 5 || bytes.length > ROUTE.maxPdfBytes || bytes.slice(0, 5).map(b => String.fromCharCode(b & 255)).join('') !== '%PDF-') throw new Error('Sauvegarde PDF invalide.');
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes));
}
function buildPdf_(folder, day, records) {
  // Des noms fixes permettent de reprendre/nettoyer une génération interrompue.
  const stalePdf = named_(folder, 'feuille-route-' + day + '.pdf');
  if (stalePdf) removeFile_(stalePdf.getId()); // Aucun manifeste = sources encore intactes.
  const oldDocs = folder.getFilesByName('document-temporaire');
  while (oldDocs.hasNext()) removeFile_(oldDocs.next().getId());
  const doc = DocumentApp.create('document-temporaire');
  const docFile = DriveApp.getFileById(doc.getId()); docFile.moveTo(folder);
  try {
    const body = doc.getBody(); body.clear();
    body.setPageWidth(595.28).setPageHeight(841.89).setMarginTop(30).setMarginBottom(30).setMarginLeft(36).setMarginRight(36);
    body.setAttributes({[DocumentApp.Attribute.FONT_FAMILY]: 'Arial', [DocumentApp.Attribute.FONT_SIZE]: 11});
    const line = (text, size, bold) => {
      const p = body.appendParagraph(text).setSpacingBefore(0).setSpacingAfter(7).setLineSpacing(1);
      p.editAsText().setFontSize(size || 11).setBold(Boolean(bold));
      return p;
    };
    records.forEach((record, index) => {
      if (index) body.appendPageBreak();
      const value = record.course;
      line('CS OUPEYE - FEUILLE DE ROUTE', 17, true);
      line('Journée : ' + day + '   |   Course ' + (index + 1) + '/' + records.length);
      line('Enregistrement : ' + Utilities.formatDate(new Date(record.receivedAt), ROUTE.timezone, 'dd/MM/yyyy HH:mm'));
      line('Référence : ' + value.id, 8);
      line('Identité du patient : ' + (value.identity || (value.photo ? 'Voir étiquette ci-dessous' : 'Pas de patient')));
      line('Lieu de prise en charge : ' + (value.pickup === 'domicile' ? 'Domicile' : 'Autre - ' + value.address));
      line(value.destination === 'hopital' ? 'Destination : ' + value.hospital + ' - ' + HOSPITALS[value.hospital] : 'Pas de prise en charge : ' + OUTCOMES[value.outcome]);
      if (value.photo) {
        line('Étiquette patient :');
        const img = body.appendImage(Utilities.newBlob(Utilities.base64Decode(value.photo), 'image/jpeg', 'etiquette.jpg'));
        const width = img.getWidth(), height = img.getHeight();
        const scale = Math.min(490 / width, 280 / height, 1);
        img.setWidth(Math.max(1, Math.floor(width * scale))).setHeight(Math.max(1, Math.floor(height * scale)));
      }
    });
    doc.saveAndClose();
    const blob = docFile.getAs(MimeType.PDF).setName('feuille-route-' + day + '.pdf');
    if (!blob.getBytes().length || blob.getBytes().length > ROUTE.maxPdfBytes) throw new Error('PDF non généré ou trop volumineux.');
    return folder.createFile(blob);
  } finally { removeFile_(docFile.getId()); }
}
/** Suppression définitive ciblée, pas mise à la corbeille et jamais emptyTrash. */
function removeFile_(id) {
  const response = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id), {
    method: 'delete', headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}, muteHttpExceptions: true
  });
  if (![204, 404].includes(response.getResponseCode())) throw new Error('Nettoyage différé.');
}
