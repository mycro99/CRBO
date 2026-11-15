/**
 * Envoi des checklists et commandes de tenues — CS Oupeye.
 * Remplacer Code.gs dans le projet existant, puis :
 * Déployer > Gérer les déploiements > Modifier > Nouvelle version > Déployer.
 * Exécuter installerFileEnvoi UNE FOIS dans l’éditeur et autoriser Drive + déclencheurs.
 * Conserver « Moi » (contactoupeye@gmail.com), « Tout le monde » et la même URL.
 */
const CONFIG = Object.freeze({
  expectedSender: "contactoupeye@gmail.com",
  recipient: "logistique.cs.oupeye@croix-rouge.be",
  dailyLimit: 30,
  maxPdfBytes: 10 * 1024 * 1024,
  maxPhotos: 12,
  maxPhotoBytes: 6 * 1024 * 1024,
  maxPendingDocuments: 60,
  timezone: "Europe/Brussels",
  senderName: "Checklist Ambulance - CS Oupeye"
});

const DOCUMENT_TYPES = Object.freeze({
  ambulance: "Checklist ambulance",
  tpmr: "Checklist TPMR",
  fit: "Checklist FIT",
  peremption: "Checklist péremption",
  tenues: "Commande de tenues"
});

// Les reçus ne contiennent ni PDF, ni photos, ni plaque. Leur identifiant est secret.
const RECEIPT_PREFIX = "MAIL_RECEIPT:";
const RECEIPT_DAYS = 30;

function readReceipt_(id) {
  const raw = PropertiesService.getScriptProperties().getProperty(RECEIPT_PREFIX + id);
  return raw ? JSON.parse(raw) : null;
}

function writeReceipt_(id, state, error) {
  if (!id) return;
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty(RECEIPT_PREFIX + id, JSON.stringify({
    state: state, updatedAt: Date.now(), ...(error ? { error: String(error).slice(0, 300) } : {})
  }));
}

function pruneReceipts_() {
  const properties = PropertiesService.getScriptProperties();
  const all = properties.getProperties();
  const cutoff = Date.now() - RECEIPT_DAYS * 86400000;
  Object.keys(all).forEach(function (key) {
    if (key.indexOf(RECEIPT_PREFIX) !== 0) return;
    try {
      const receipt = JSON.parse(all[key]);
      if (["sent", "failed"].indexOf(receipt.state) !== -1 && receipt.updatedAt < cutoff) properties.deleteProperty(key);
    } catch (_) {}
  });
}

function doGet(event) {
  const receipt = event && event.parameter && event.parameter.receipt;
  if (receipt !== undefined) {
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(String(receipt))) {
      return jsonResponse_({ ok: false, error: "Identifiant de reçu invalide." });
    }
    let result = readReceipt_(String(receipt));
    let stored = false;
    // Un manifest Drive complet fait foi même si la copie du reçu a échoué.
    if (!result || result.state !== "sent") {
      const entry = findJob_(String(receipt));
      if (entry) { stored = true; result = { state: entry.job.state, error: publicQueueError_(entry.job.state) }; }
    }
    return jsonResponse_({ ok: true, stored: stored, state: result ? result.state : "missing",
      ...(result && result.error ? { error: result.error } : {}) });
  }
  return jsonResponse_({
    ok: true,
    service: "checklist-ambulance",
    supportedTypes: Object.keys(DOCUMENT_TYPES),
    photoAttachments: true,
    receiptApi: 1,
    serverQueue: 1,
    queueReady: queueReady_(),
    message: "Le service d'envoi est actif."
  });
}

// Dossier privé : seul l’installateur exécuté dans l’éditeur peut le créer.
const QUEUE_ROOT_KEY = "CRBO_MAIL_QUEUE_ROOT";
const QUEUE_HANDLER = "traiterFileEnvoi";
const JOB_NAME = "envoi.json";

function privateQueueRoot_() {
  const id = PropertiesService.getScriptProperties().getProperty(QUEUE_ROOT_KEY);
  if (!id) throw new Error("Exécutez installerFileEnvoi dans l’éditeur Apps Script avant les envois.");
  const root = DriveApp.getFolderById(id);
  if (root.isTrashed() || root.getSharingAccess() !== DriveApp.Access.PRIVATE || root.getEditors().length || root.getViewers().length) {
    throw new Error("Le dossier de sauvegarde doit rester privé, sans partage et hors corbeille.");
  }
  return root;
}

function queueReady_() {
  if (!PropertiesService.getScriptProperties().getProperty(QUEUE_ROOT_KEY)) return false;
  return ScriptApp.getProjectTriggers().some(function (trigger) { return trigger.getHandlerFunction() === QUEUE_HANDLER; });
}

function publicQueueError_(state) {
  if (state === "review") return "Envoi incertain : copie conservée sur Drive. Vérification manuelle nécessaire, sans renvoi automatique.";
  if (state === "retry") return "Copie conservée sur Drive. Nouvelle tentative automatique prévue.";
  return "";
}

function loadJob_(folder) {
  const files = folder.getFilesByName(JOB_NAME);
  if (!files.hasNext()) return null; // Téléversement incomplet : ne jamais envoyer.
  const file = files.next();
  if (files.hasNext()) throw new Error("Plusieurs manifests dans un dossier : vérification manuelle nécessaire.");
  const job = JSON.parse(file.getBlob().getDataAsString());
  if (job.version !== 1 || !job.requestId || !Array.isArray(job.files) || !job.files.length) {
    throw new Error("Manifest invalide : sauvegarde conservée pour vérification.");
  }
  return { folder: folder, file: file, job: job };
}

function findJob_(id) {
  if (!PropertiesService.getScriptProperties().getProperty(QUEUE_ROOT_KEY)) return null;
  const folders = privateQueueRoot_().getFoldersByName("envoi-" + id);
  if (!folders.hasNext()) return null;
  const folder = folders.next();
  if (folders.hasNext()) throw new Error("Dossiers d’envoi en double : vérification nécessaire.");
  return loadJob_(folder);
}

function saveJob_(entry) {
  entry.job.updatedAt = Date.now();
  entry.file.setContent(JSON.stringify(entry.job, null, 2));
}

function syncReceipt_(job) {
  writeReceipt_(job.requestId, job.state, publicQueueError_(job.state));
}

function assertOwner_() {
  validateDeploymentAccount_();
  const active = String(Session.getActiveUser().getEmail() || "").toLowerCase();
  if (active !== CONFIG.expectedSender) throw new Error("Cette opération doit être exécutée dans l’éditeur par " + CONFIG.expectedSender + ".");
}

// Fonction visible dans le menu « Exécuter ». À lancer une seule fois, avant redéploiement.
function installerFileEnvoi() {
  assertOwner_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error("Un traitement est en cours. Réessayez l’installation.");
  try {
    const properties = PropertiesService.getScriptProperties();
    if (!properties.getProperty(QUEUE_ROOT_KEY)) {
      const root = DriveApp.createFolder("CRBO - Envois documents - PRIVÉ");
      root.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
      properties.setProperty(QUEUE_ROOT_KEY, root.getId());
    }
    const root = privateQueueRoot_();
    const triggers = ScriptApp.getProjectTriggers().filter(function (trigger) { return trigger.getHandlerFunction() === QUEUE_HANDLER; });
    if (!triggers.length) ScriptApp.newTrigger(QUEUE_HANDLER).timeBased().everyMinutes(5).create();
    // Ne touche pas aux déclencheurs d’autres fonctions.
    triggers.slice(1).forEach(function (trigger) { ScriptApp.deleteTrigger(trigger); });
    console.log("File installée. Dossier privé : " + root.getUrl() + ". Traitement automatique environ toutes les 5 minutes.");
  } finally { lock.releaseLock(); }
}

// Diagnostic privé depuis l’éditeur : aucune liste publique des documents.
function consulterFileEnvoi() {
  assertOwner_();
  const folders = privateQueueRoot_().getFolders();
  let count = 0;
  while (folders.hasNext()) {
    const folder = folders.next();
    try {
      const entry = loadJob_(folder);
      console.log(JSON.stringify({ dossier: folder.getUrl(), etat: entry ? entry.job.state : "incomplet",
        ...(entry ? { document: entry.job.subject, tentatives: entry.job.attempts, erreur: entry.job.lastError || "" } : {}) }));
      count++;
    } catch (error) { console.error(folder.getUrl() + " : " + error.message); }
  }
  console.log(count + " sauvegarde(s) sur Drive. Un dossier ne disparaît qu’après envoi confirmé.");
}

function cleanupSent_(entry) {
  // Aucun effacement tant qu’au moins un marqueur durable ne confirme pas MailApp.
  const receipt = readReceipt_(entry.job.requestId);
  if (entry.job.state !== "sent" && !(receipt && receipt.state === "sent")) return;
  if (entry.job.state !== "sent") { entry.job.state = "sent"; saveJob_(entry); }
  syncReceipt_(entry.job); // Garantit un reçu indépendant AVANT de mettre le dossier à la corbeille.
  entry.folder.setTrashed(true);
}

function retryJob_(entry, error, delay) {
  entry.job.state = "retry";
  entry.job.lastError = String(error && error.message ? error.message : error).slice(0, 1000);
  entry.job.nextAttemptAt = Date.now() + delay;
  saveJob_(entry);
  syncReceipt_(entry.job);
  console.warn("Document conservé sur Drive, nouvelle tentative prévue : " + entry.job.requestId + " — " + entry.job.lastError);
}

function attemptJob_(entry) {
  const job = entry.job;
  const receipt = readReceipt_(job.requestId);
  if (job.state === "sent" || (receipt && receipt.state === "sent")) { cleanupSent_(entry); return; }
  if (job.state === "review") return;
  if (job.state === "sending") {
    // Le verrou est de nouveau libre : l’exécution précédente s’est arrêtée après son marqueur d’envoi.
    job.state = "review";
    job.lastError = "Exécution interrompue pendant l’envoi : vérifier les exécutions et la réception avant toute reprise.";
    saveJob_(entry); syncReceipt_(job);
    console.error(publicQueueError_("review") + " " + job.requestId);
    return;
  }
  if (["queued", "retry"].indexOf(job.state) === -1) throw new Error("État de file inconnu : copie conservée.");
  if (job.nextAttemptAt > Date.now()) return;
  let attachments;
  try {
    validateDeploymentAccount_();
    validateDailyLimit_();
    if (MailApp.getRemainingDailyQuota() < 1) throw new Error("Le quota Gmail quotidien est épuisé.");
    attachments = job.files.map(function (item) {
      const file = DriveApp.getFileById(item.id);
      if (file.isTrashed() || file.getSize() !== item.size) throw new Error("Pièce jointe manquante ou modifiée sur Drive.");
      return file.getBlob().setName(item.name).setContentType(item.mimeType);
    });
  } catch (error) {
    retryJob_(entry, error, /quota|Limite de/.test(error.message) ? 3600000 : 300000);
    return;
  }
  // Tout ce qui précède reste réessayable. Dès ce marqueur, on privilégie l’absence de doublon.
  job.state = "sending"; job.attempts += 1; job.lastError = "";
  saveJob_(entry);
  syncReceipt_(job);
  try {
    // Réservation avant MailApp : un crash ne permet pas de dépasser la limite quotidienne.
    incrementDailyCount_();
  } catch (error) {
    retryJob_(entry, error, 300000);
    return;
  }
  try {
    MailApp.sendEmail({ to: CONFIG.recipient, subject: job.subject, body: job.body,
      attachments: attachments, name: job.senderName });
  } catch (error) {
    // Une exception MailApp peut survenir après une acceptation : conserver, ne pas renvoyer aveuglément.
    job.state = "review"; job.lastError = String(error.message || error).slice(0, 1000);
    saveJob_(entry); syncReceipt_(job);
    console.error(publicQueueError_("review") + " " + job.requestId + " — " + job.lastError);
    return;
  }
  job.state = "sent"; job.sentAt = Date.now();
  saveJob_(entry); // Si cette écriture échoue, le marqueur « sending » interdit tout doublon.
  syncReceipt_(job);
  cleanupSent_(entry);
}

// Déclencheur permanent : la page et le téléphone n’ont plus besoin de rester ouverts.
function traiterFileEnvoi() {
  validateDeploymentAccount_();
  const folders = privateQueueRoot_().getFolders();
  const deadline = Date.now() + 180000;
  let processed = 0, reviews = 0;
  while (folders.hasNext() && Date.now() < deadline) {
    const folder = folders.next();
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(1000)) continue;
    try {
      const entry = loadJob_(folder);
      if (!entry) { console.warn("Téléversement incomplet conservé : " + folder.getUrl()); continue; }
      attemptJob_(entry);
      if (entry.job.state === "review") reviews++;
      processed++;
    } catch (error) { console.error("Sauvegarde conservée : " + folder.getUrl() + " — " + error.message); }
    finally { lock.releaseLock(); }
  }
  pruneReceipts_();
  console.log(processed + " dossier(s) vérifié(s), " + reviews + " envoi(s) à vérifier manuellement.");
}

function doPost(event) {
  const lock = LockService.getScriptLock();
  let requestId = "", existing = null, committed = false;
  try {
    if (!event || !event.postData || !event.postData.contents) throw new Error("Requête vide.");
    const payload = JSON.parse(event.postData.contents);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Requête invalide.");
    if (payload.website) return jsonResponse_({ ok: true });
    requestId = sanitizeRequestId_(payload.requestId) || Utilities.getUuid();
    const type = String(payload.checklistType || "ambulance");
    if (!Object.prototype.hasOwnProperty.call(DOCUMENT_TYPES, type)) throw new Error("Type de document inconnu.");
    const uniformOrder = type === "tenues";
    const identity = uniformOrder ? sanitizeName_(payload.demandeur) : sanitizePlaque_(payload.plaque);
    if (!identity) throw new Error(uniformOrder ? "Nom du demandeur manquant." : "Plaque manquante.");
    const checklistDate = normalizeDate_(payload.checklistDate);
    const pdfBase64 = String(payload.pdfBase64 || "");
    if (!pdfBase64 || Math.floor(pdfBase64.length * 3 / 4) > CONFIG.maxPdfBytes + 3) throw new Error("PDF absent ou trop volumineux.");
    if (!lock.tryLock(10000)) throw new Error("Un autre enregistrement est en cours. Réessayez dans quelques secondes.");
    const receipt = readReceipt_(requestId);
    if (receipt && receipt.state === "sent") return jsonResponse_({ ok: true, duplicate: true, state: "sent" });
    existing = findJob_(requestId);
    if (existing) {
      // Ne modifie jamais les pièces jointes d’un envoi déjà enregistré.
      syncReceipt_(existing.job);
      return jsonResponse_({ ok: true, duplicate: true, state: existing.job.state });
    }
    if (receipt && ["sending", "review"].indexOf(receipt.state) !== -1) {
      throw new Error("Ancien envoi incertain : vérifier les exécutions avant toute reprise.");
    }
    validateDeploymentAccount_();
    if (!queueReady_()) throw new Error("La file automatique n’est pas installée. Exécutez installerFileEnvoi dans l’éditeur.");
    const root = privateQueueRoot_();
    const bytes = Utilities.base64Decode(pdfBase64);
    if (bytes.length > CONFIG.maxPdfBytes || !isPdf_(bytes)) throw new Error("Le document reçu n’est pas un PDF valide.");
    const photos = preparePhotoAttachments_(payload.photos, type, identity, checklistDate);
    const displayDate = filenameDate_(checklistDate);
    const filename = (uniformOrder ? "commande-tenues-" : "checklist-") + displayDate + ".pdf";
    const subject = (uniformOrder ? "Commande de tenues - " : "Checklist - ") + identity;
    const attachments = [Utilities.newBlob(bytes, "application/pdf", filename)].concat(photos);
    const matching = root.getFoldersByName("envoi-" + requestId);
    let folder;
    if (matching.hasNext()) {
      folder = matching.next();
      if (matching.hasNext()) throw new Error("Dossiers en double : copie conservée pour vérification.");
      // Une précédente création incomplète n’a jamais été envoyée : remplacer ses fragments.
      const fragments = folder.getFiles();
      while (fragments.hasNext()) fragments.next().setTrashed(true);
    } else {
      let count = 0; const folders = root.getFolders();
      while (folders.hasNext()) { folders.next(); count++; }
      if (count >= CONFIG.maxPendingDocuments) throw new Error("La file Drive est pleine. Le responsable doit vérifier les sauvegardes ; copie locale conservée.");
      folder = root.createFolder("envoi-" + requestId);
    }
    const files = attachments.map(function (blob) {
      const file = folder.createFile(blob);
      const size = blob.getBytes().length;
      if (file.getSize() !== size) throw new Error("La sauvegarde d’une pièce jointe n’est pas complète.");
      return { id: file.getId(), name: blob.getName(), mimeType: blob.getContentType(), size: size };
    });
    const job = {
      version: 1, requestId: requestId, state: "queued", createdAt: Date.now(), updatedAt: Date.now(),
      attempts: 0, nextAttemptAt: 0, filename: filename, subject: subject, files: files,
      senderName: uniformOrder ? "Commande de tenues - CS Oupeye" : CONFIG.senderName,
      body: DOCUMENT_TYPES[type] + "\n" + (uniformOrder ? "Demandeur : " : "Plaque : ") + identity +
        "\nDate : " + displayDate + "\n\nLe document PDF est joint à ce message." +
        (photos.length ? "\n" + photos.length + " photo(s) du véhicule sont jointes séparément au format JPEG." : ""),
      lastError: ""
    };
    // Commit EN DERNIER : aucun travail ne peut envoyer un dossier partiel.
    const manifest = folder.createFile(Utilities.newBlob(JSON.stringify(job, null, 2), "application/json", JOB_NAME));
    committed = true;
    const entry = { folder: folder, file: manifest, job: job };
    syncReceipt_(job);
    try { attemptJob_(entry); }
    catch (error) { console.error("Copie conservée sur Drive : " + requestId + " — " + error.message); }
    return jsonResponse_({ ok: true, requestId: requestId, state: job.state, filename: filename, subject: subject, photoCount: photos.length });
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    // Un dossier déjà complet ne doit jamais être masqué par un reçu « failed ».
    if (lock.hasLock() && requestId && !existing && !committed) {
      try {
        const receipt = readReceipt_(requestId);
        if (!receipt || ["failed", "missing"].indexOf(receipt.state) !== -1) writeReceipt_(requestId, "failed", String(error.message).slice(0, 300));
      } catch (receiptError) { console.error(receiptError); }
    }
    return jsonResponse_({ ok: false, error: error.message || "Erreur d’enregistrement." });
  } finally { if (lock.hasLock()) lock.releaseLock(); }
}

function preparePhotoAttachments_(photos, type, plaque, date) {
  if (photos === undefined) return [];
  if (!Array.isArray(photos) || photos.length > CONFIG.maxPhotos) {
    throw new Error("Liste de photos invalide (12 maximum).");
  }
  if (!photos.length) return [];
  if (["ambulance", "tpmr", "fit"].indexOf(type) === -1) {
    throw new Error("Les photos sont réservées aux checklists des véhicules.");
  }
  let totalBytes = 0;
  const safePlaque = sanitizePlaque_(plaque).replace(/[^A-Z0-9_-]/g, "-");
  return photos.map(function (photo, index) {
    if (!photo || typeof photo !== "object" || photo.mimeType !== "image/jpeg" ||
        typeof photo.base64 !== "string" || !photo.base64 ||
        photo.base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(photo.base64)) {
      throw new Error("Photo " + (index + 1) + " invalide : un JPEG encodé est requis.");
    }
    const padding = photo.base64.slice(-2) === "==" ? 2 : photo.base64.slice(-1) === "=" ? 1 : 0;
    const estimatedBytes = photo.base64.length * 3 / 4 - padding;
    if (totalBytes + estimatedBytes > CONFIG.maxPhotoBytes) {
      throw new Error("Les photos dépassent la limite totale de 6 Mo.");
    }
    const bytes = Utilities.base64Decode(photo.base64);
    totalBytes += bytes.length;
    if (totalBytes > CONFIG.maxPhotoBytes || !isJpeg_(bytes)) {
      throw new Error("Photo " + (index + 1) + " invalide ou trop volumineuse.");
    }
    // Rebuild names on the server rather than trusting uploaded filenames.
    const number = String(index + 1).padStart(2, "0");
    const filename = "photo-" + safePlaque + "-" + filenameDate_(date) + "-" + number + ".jpg";
    return Utilities.newBlob(bytes, "image/jpeg", filename);
  });
}

function isJpeg_(bytes) {
  // Apps Script returns signed bytes; normalize them before checking JPEG markers.
  return bytes.length >= 5 && (bytes[0] & 255) === 255 &&
    (bytes[1] & 255) === 216 && (bytes[2] & 255) === 255 &&
    (bytes[bytes.length - 2] & 255) === 255 && (bytes[bytes.length - 1] & 255) === 217;
}

function validateDeploymentAccount_() {
  const effectiveEmail = String(Session.getEffectiveUser().getEmail() || "").toLowerCase();
  if (effectiveEmail && effectiveEmail !== CONFIG.expectedSender) {
    throw new Error("Ce script doit être déployé depuis " + CONFIG.expectedSender + ".");
  }
}

function validateDailyLimit_() {
  if (readCounter_().count >= CONFIG.dailyLimit) {
    throw new Error("Limite de " + CONFIG.dailyLimit + " envois atteinte aujourd'hui.");
  }
}

function incrementDailyCount_() {
  const counter = readCounter_();
  counter.count += 1;
  PropertiesService.getScriptProperties().setProperty("CHECKLIST_SEND_COUNTER", JSON.stringify(counter));
}

function readCounter_() {
  const today = Utilities.formatDate(new Date(), CONFIG.timezone, "yyyy-MM-dd");
  const raw = PropertiesService.getScriptProperties().getProperty("CHECKLIST_SEND_COUNTER");
  if (!raw) return { date: today, count: 0 };
  try {
    const parsed = JSON.parse(raw);
    if (parsed.date !== today) return { date: today, count: 0 };
    return { date: today, count: Number(parsed.count) || 0 };
  } catch (error) {
    return { date: today, count: 0 };
  }
}

function sanitizeName_(value) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, 100);
}

function sanitizePlaque_(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9 ._-]/g, "").trim().slice(0, 24);
}

function sanitizeRequestId_(value) {
  return String(value || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 100);
}

function normalizeDate_(value) {
  const date = String(value || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return Utilities.formatDate(new Date(), CONFIG.timezone, "yyyy-MM-dd");
}

function filenameDate_(date) {
  const parts = date.split("-");
  return parts[2] + "-" + parts[1] + "-" + parts[0].slice(-2);
}

function isPdf_(bytes) {
  return bytes.length >= 5 && bytes[0] === 37 && bytes[1] === 80 &&
    bytes[2] === 68 && bytes[3] === 70 && bytes[4] === 45;
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
