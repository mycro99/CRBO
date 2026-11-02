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
function doGet(event) {
  const params = event && event.parameter || {};
  if (params.service === 'route-api') {
    try { root_(); return routeJson_({ok: true, routeApi: 2}); }
    catch (_) { return routeJson_({ok: false, error: 'Service indisponible.'}); }
  }
  if (params.receipt !== undefined) {
    const id = String(params.receipt);
    if (!/^[a-f0-9-]{36}$/i.test(id)) return routeJson_({ok: false});
    const raw = PropertiesService.getScriptProperties().getProperty('RECEIPT_' + id);
    const saved = raw ? JSON.parse(raw) : null;
    // Accusé technique uniquement : aucune identité, photo, adresse ou empreinte.
    return routeJson_(saved && saved.saved === true
      ? {ok: true, stored: true, receipt: id, day: saved.day}
      : {ok: true, stored: false});
  }
  return HtmlService.createHtmlOutputFromFile('Form').setTitle('Feuille de route - CS Oupeye')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
// Transport anonyme depuis CRBO : aucun cookie Google requis.
function doPost(event) {
  try {
    const raw = event && event.postData && event.postData.contents;
    if (typeof raw !== 'string' || !raw || raw.length > 900000) throw new Error('Requête invalide.');
    return routeJson_(enregistrerCourse(JSON.parse(raw)));
  } catch (_) {
    return routeJson_({ok: false, error: 'Enregistrement non confirmé.'});
  }
}
function routeJson_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
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
  const rawNumber = String(p.missionNumber || '').trim();
  const digits = rawNumber.replace(/\D/g, '');
  if (!/^[\d /.-]+$/.test(rawNumber) || digits.length !== 11) throw new Error('Indiquez les 11 chiffres du numéro de course 112.');
  const missionNumber = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 7) + '/' + digits.slice(7);
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
  return {id: p.id, missionNumber: missionNumber, identity: identity, pickup: p.pickup, address: address,
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
/** Installation ou migration de la planification depuis l’éditeur, compte propriétaire. */
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
    // Créer le nouveau rendez-vous AVANT de supprimer l’ancien : une erreur de
    // création ne doit pas laisser le service sans programmation.
    const daily = ScriptApp.newTrigger('demarrerEnvoiNocturne_').timeBased()
      .atHour(0).nearMinute(15).everyDays(1).inTimezone(ROUTE.timezone).create();
    ScriptApp.getProjectTriggers().forEach(trigger => {
      if (['traiterJournees_', 'demarrerEnvoiNocturne_'].includes(trigger.getHandlerFunction()) && trigger.getUniqueId() !== daily.getUniqueId()) {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    // Filet de reprise si la vérification immédiate est interrompue ou occupée.
    ensureRouteRetry_();
    console.log('Planification quotidienne installée. Les relances s’arrêtent lorsque le traitement est terminé.');
  } finally { lock.releaseLock(); }
  // Reprendre les éventuelles journées en attente, ou retirer immédiatement
  // la relance temporaire s’il n’y a rien à traiter. La journée courante est exclue.
  traiterJournees_();
}
/** Rendez-vous permanent quotidien, vers 00 h 15 en Belgique (horaire Google approximatif). */
function demarrerEnvoiNocturne_() {
  ensureRouteRetry_();
  traiterJournees_();
}
/** Un seul déclencheur temporaire de reprise, même en cas de passages multiples. */
function ensureRouteRetry_() {
  const retries = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'traiterJournees_');
  if (!retries.length) ScriptApp.newTrigger('traiterJournees_').timeBased().everyMinutes(5).create();
  retries.slice(1).forEach(trigger => ScriptApp.deleteTrigger(trigger));
}
function stopRouteRetries_() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'traiterJournees_') ScriptApp.deleteTrigger(trigger);
  });
}
/** Traitement et relances temporaires, sans accès public aux fiches. */
function traiterJournees_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const root = root_(), today = routeDay_(new Date()), days = [], folders = root.getFolders();
    while (folders.hasNext()) { const f = folders.next(); if (/^\d{4}-\d{2}-\d{2}$/.test(f.getName()) && f.getName() < today) days.push(f); }
    days.sort((a, b) => a.getName().localeCompare(b.getName()));
    const started = Date.now();
    let needsRetry = false;
    for (const folder of days) {
      if (Date.now() - started > 200000) { needsRetry = true; break; }
      try { if (processDay_(privateFolder_(folder)) === true) needsRetry = true; }
      catch (_) {
        needsRetry = true;
        console.error('ROUTE_BATCH_FAILED: journée conservée, aucune donnée patient dans ce journal.');
      }
    }
    const props = PropertiesService.getScriptProperties();
    const all = props.getProperties();
    Object.keys(all).filter(k => k.startsWith('RECEIPT_')).forEach(k => {
      if (Date.now() - JSON.parse(all[k]).at > 3 * 86400000) props.deleteProperty(k);
    });
    if (needsRetry) ensureRouteRetry_();
    else stopRouteRetries_(); // Ne touche jamais au rendez-vous quotidien.
  } finally { lock.releaseLock(); }
}
function processDay_(folder) {
  const day = folder.getName();
  let manifestFile = named_(folder, 'batch.json');
  let state = manifestFile ? JSON.parse(manifestFile.getBlob().getDataAsString()) : null;
  if (!state) {
    const files = courseFiles_(folder);
    if (!files.length) return false;
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
    return false;
  }
  if (state.phase === 'review') return false;
  if (state.phase === 'sent') {
    state.sourceIds.forEach(id => removeFile_(id));
    removeFile_(state.pdfId); removeFile_(manifestFile.getId()); return false;
  }
  if (state.phase !== 'prepared') throw new Error('État de lot inconnu.');
  const attachment = DriveApp.getFileById(state.pdfId).getBlob();
  // Revérifier le fichier sauvegardé à CHAQUE reprise avant de toucher aux sources.
  if (pdfHash_(attachment) !== state.pdfHash) throw new Error('Sauvegarde PDF modifiée : sources conservées.');
  state.sourceIds.forEach(id => removeFile_(id));
  if (MailApp.getRemainingDailyQuota() < 1) return true;
  state.phase = 'sending'; save();
  try {
    MailApp.sendEmail({to: ROUTE.recipient, subject: 'Feuille de route - CS Oupeye - ' + day,
      body: 'Feuille de route du ' + day + '\n' + state.count + ' course(s).\nUne course par page dans le PDF joint.\nRéférence du lot : CRBO-' + day,
      attachments: [attachment], name: 'Feuille de route - CS Oupeye'});
  } catch (_) {
    state.phase = 'review'; save();
    console.error('ROUTE_SEND_UNCERTAIN: PDF conservé, vérifier Envoyés pour ' + day);
    return false;
  }
  // MailApp a terminé sans erreur : ce n’est PAS un accusé de réception destinataire.
  state.phase = 'sent'; state.sentAt = new Date().toISOString(); save();
  removeFile_(state.pdfId); removeFile_(manifestFile.getId());
  return false;
}
function pdfHash_(blob) {
  const bytes = blob.getBytes();
  if (bytes.length < 5 || bytes.length > ROUTE.maxPdfBytes || bytes.slice(0, 5).map(b => String.fromCharCode(b & 255)).join('') !== '%PDF-') throw new Error('Sauvegarde PDF invalide.');
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes));
}
/** Modèle de présentation : aucune donnée supplémentaire n’est enregistrée. */
function routeCard_(record, index, count, day) {
  const value = record.course;
  const line = (text, size, bold, color) => ({text: String(text), size: size, bold: Boolean(bold), color: color || '#142D43'});
  const row = (lines, background, center, padding) => ({lines: lines, background: background || '#FFFFFF', center: Boolean(center), padding: padding === undefined ? 9 : padding});
  const date = new Date(record.receivedAt);
  const recorded = 'Enregistrée le ' + Utilities.formatDate(date, ROUTE.timezone, 'dd/MM/yyyy') + ' à ' + Utilities.formatDate(date, ROUTE.timezone, 'HH:mm:ss');
  const displayDay = day.split('-').reverse().join('/');
  const number = value.missionNumber || 'Non renseigné (ancienne fiche)';
  const patient = row([
    line('PATIENT', 9, true, '#137E81'),
    line(value.identity || (value.photo ? 'Identité sur l’étiquette ci-dessous' : 'Pas de patient'), 11, false)
  ]);
  patient.photo = value.photo || '';
  const pickup = [line('PRISE EN CHARGE', 9, true, '#137E81'), line(value.pickup === 'domicile' ? 'Domicile' : 'Autre lieu', 11, true)];
  if (value.pickup === 'autre') pickup.push(line(value.address, 11, false));
  const destination = [line('DESTINATION', 9, true, '#137E81')];
  if (value.destination === 'hopital') destination.push(line(value.hospital + ' - ' + HOSPITALS[value.hospital], 12, true));
  else {
    destination.push(line('Pas de prise en charge', 10, false, '#506474'));
    destination.push(line(OUTCOMES[value.outcome], 12, true));
  }
  const card = {width: 435, rows: [
    row([line('CS OUPEYE', 14, true, '#FFFFFF'), line('FEUILLE DE ROUTE', 9, true, '#FFFFFF')], '#142D43', true, 12),
    row([line('N° DE COURSE 112', 9, true, '#506474'), line(number, value.missionNumber ? 23 : 13, true), line(recorded, 10, false, '#506474')], '#F0F5F8', true, 12),
    patient, row(pickup), row(destination),
    row([line('Journée du ' + displayDay + ' · Course ' + (index + 1) + ' / ' + count, 9, false, '#506474'), line('Réf. ' + value.id, 7, false, '#6C7D89')], '#F7F9FA', true, 8)
  ]};
  const textHeight = card.rows.reduce((height, section) => height + section.padding * 2 + section.lines.reduce((total, item) => {
    const capacity = Math.max(1, Math.floor((card.width - 28) / (item.size * 1.0)));
    return total + Math.max(1, Math.ceil(item.text.length / capacity)) * item.size * 1.2 + 3;
  }, 0), 0);
  card.photoMaxHeight = Math.max(80, Math.min(280, 680 - textHeight));
  return card;
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
    body.setPageWidth(595.28).setPageHeight(841.89).setMarginTop(64).setMarginBottom(64).setMarginLeft(80).setMarginRight(80);
    // Les paragraphes vides autour des tableaux ne doivent pas créer de pages supplémentaires.
    body.setAttributes({[DocumentApp.Attribute.FONT_FAMILY]: 'Arial', [DocumentApp.Attribute.FONT_SIZE]: 1});
    records.forEach((record, index) => {
      if (index) body.appendPageBreak();
      const card = routeCard_(record, index, records.length, day);
      const spacer = body.appendParagraph('').setSpacingBefore(0).setSpacingAfter(0).setLineSpacing(1);
      spacer.editAsText().setFontSize(1);
      const table = body.appendTable(card.rows.map(row => [row.lines[0].text]));
      table.setColumnWidth(0, card.width).setBorderColor('#CCD7DF').setBorderWidth(0.75);
      let estimatedHeight = 0;
      card.rows.forEach((row, rowIndex) => {
        const cell = table.getRow(rowIndex).getCell(0);
        cell.setBackgroundColor(row.background).setPaddingTop(row.padding).setPaddingBottom(row.padding).setPaddingLeft(14).setPaddingRight(14);
        estimatedHeight += row.padding * 2;
        row.lines.forEach((line, lineIndex) => {
          const paragraph = lineIndex === 0 ? cell.getChild(0).asParagraph() : cell.appendParagraph(line.text);
          paragraph.setSpacingBefore(0).setSpacingAfter(3).setLineSpacing(1)
            .setAlignment(row.center ? DocumentApp.HorizontalAlignment.CENTER : DocumentApp.HorizontalAlignment.LEFT);
          paragraph.editAsText().setFontFamily('Arial').setFontSize(line.size).setBold(line.bold).setForegroundColor(line.color);
          const charactersPerLine = Math.max(1, Math.floor((card.width - 28) / (line.size * 1.0)));
          estimatedHeight += Math.max(1, Math.ceil(line.text.length / charactersPerLine)) * line.size * 1.2 + 3;
        });
        if (row.photo) {
          const paragraph = cell.appendParagraph('').setSpacingBefore(5).setSpacingAfter(0).setLineSpacing(1)
            .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
          const image = paragraph.appendInlineImage(Utilities.newBlob(Utilities.base64Decode(row.photo), 'image/jpeg', 'etiquette.jpg'));
          const width = image.getWidth(), height = image.getHeight();
          const scale = Math.min((card.width - 28) / width, card.photoMaxHeight / height, 1);
          image.setWidth(Math.max(1, Math.floor(width * scale))).setHeight(Math.max(1, Math.floor(height * scale)));
          estimatedHeight += Math.floor(height * scale) + 8;
        }
      });
      // Centrage du cadre sur sa page ; une carte longue garde toute la hauteur disponible.
      spacer.setSpacingAfter(Math.max(0, (700 - estimatedHeight) / 2));
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
