/**
 * Envoi des checklists et commandes de tenues — CS Oupeye.
 * Remplacer Code.gs dans le projet existant, puis :
 * Déployer > Gérer les déploiements > Modifier > Nouvelle version > Déployer.
 * Conserver « Moi » (contactoupeye@gmail.com), « Tout le monde » et la même URL.
 */
const CONFIG = Object.freeze({
  expectedSender: "contactoupeye@gmail.com",
  recipient: "logistique.cs.oupeye@croix-rouge.be",
  dailyLimit: 30,
  maxPdfBytes: 10 * 1024 * 1024,
  maxPhotos: 12,
  maxPhotoBytes: 6 * 1024 * 1024,
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

function doGet() {
  return jsonResponse_({
    ok: true,
    service: "checklist-ambulance",
    supportedTypes: Object.keys(DOCUMENT_TYPES),
    photoAttachments: true,
    message: "Le service d'envoi est actif."
  });
}

function doPost(event) {
  const lock = LockService.getScriptLock();
  try {
    if (!event || !event.postData || !event.postData.contents) {
      throw new Error("Requête vide.");
    }
    const payload = JSON.parse(event.postData.contents);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Requête invalide.");
    }
    if (payload.website) return jsonResponse_({ ok: true });

    // Les anciennes requêtes sans type restent des checklists ambulance.
    const type = String(payload.checklistType || "ambulance");
    if (!Object.prototype.hasOwnProperty.call(DOCUMENT_TYPES, type)) {
      throw new Error("Type de document inconnu.");
    }
    const uniformOrder = type === "tenues";
    const identity = uniformOrder
      ? sanitizeName_(payload.demandeur)
      : sanitizePlaque_(payload.plaque);
    if (!identity) {
      throw new Error(uniformOrder ? "Nom du demandeur manquant." : "Plaque manquante.");
    }
    const checklistDate = normalizeDate_(payload.checklistDate);
    const requestId = sanitizeRequestId_(payload.requestId);
    const pdfBase64 = String(payload.pdfBase64 || "");
    const approximateBytes = Math.floor((pdfBase64.length * 3) / 4);
    if (!pdfBase64 || approximateBytes > CONFIG.maxPdfBytes + 3) {
      throw new Error("PDF absent ou trop volumineux.");
    }
    if (!lock.tryLock(5000)) {
      throw new Error("Un autre envoi est en cours. Réessaie dans quelques secondes.");
    }
    const cache = CacheService.getScriptCache();
    if (requestId && cache.get("sent:" + requestId)) {
      return jsonResponse_({ ok: true, duplicate: true });
    }
    validateDeploymentAccount_();
    validateDailyLimit_();
    const bytes = Utilities.base64Decode(pdfBase64);
    if (bytes.length > CONFIG.maxPdfBytes || !isPdf_(bytes)) {
      throw new Error("Le document reçu n'est pas un PDF valide.");
    }
    const photoAttachments = preparePhotoAttachments_(payload.photos, type, identity, checklistDate);
    if (MailApp.getRemainingDailyQuota() < 1) {
      throw new Error("Le quota Gmail quotidien est épuisé.");
    }
    const displayDate = filenameDate_(checklistDate);
    const filename = (uniformOrder ? "commande-tenues-" : "checklist-") + displayDate + ".pdf";
    const subject = (uniformOrder ? "Commande de tenues - " : "Checklist - ") + identity;
    const attachment = Utilities.newBlob(bytes, "application/pdf", filename);
    MailApp.sendEmail({
      to: CONFIG.recipient,
      subject: subject,
      body: DOCUMENT_TYPES[type] + "\n" +
        (uniformOrder ? "Demandeur : " : "Plaque : ") + identity + "\n" +
        "Date : " + displayDate + "\n\n" +
        "Le document PDF est joint à ce message." +
        (photoAttachments.length ? "\n" + photoAttachments.length + " photo(s) du véhicule sont jointes séparément au format JPEG." : ""),
      attachments: [attachment].concat(photoAttachments),
      name: uniformOrder ? "Commande de tenues - CS Oupeye" : CONFIG.senderName
    });
    incrementDailyCount_();
    if (requestId) cache.put("sent:" + requestId, "1", 21600);
    return jsonResponse_({ ok: true, filename: filename, subject: subject, photoCount: photoAttachments.length });
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return jsonResponse_({
      ok: false,
      error: error && error.message ? error.message : "Erreur d'envoi."
    });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
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
