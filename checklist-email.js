(function () {
  "use strict";

  const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxc9QPkfMF0uT-tavmtW6gMXqIcqJccI6qiKzYRPL6HUuHuSqBVhj6rngQpQyrTkRbN/exec";
  const MAX_PDF_BYTES = 10 * 1024 * 1024;
  const TYPE_LABELS = Object.freeze({
    ambulance: "AMBULANCE",
    tpmr: "TPMR",
    fit: "FIT",
    peremption: "PEREMPTION",
    tenues: "TENUES"
  });

  function blobToBase64(blob) {
    return blob.arrayBuffer().then(function (buffer) {
      const bytes = new Uint8Array(buffer);
      const chunkSize = 32768;
      let binary = "";

      for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunkSize));
      }

      return window.btoa(binary);
    });
  }

  function setStatus(message, tone) {
    const status = document.getElementById("actionStatus");
    if (!status) return;
    const waiting = !tone && busy && sending;
    const color = tone === "success" ? ["#ecfdf5", "#166534"] :
      tone === "error" || tone === "warning" ? ["#fff1f2", "#9f1239"] :
      waiting ? ["#fff7d6", "#713f12"] : ["#eff6ff", "#1e3a8a"];
    status.textContent = waiting ? "ENVOI EN COURS — GARDEZ CETTE PAGE OUVERTE.\n" + message : message;
    if (status.parentElement) status.parentElement.style.flexWrap = "wrap";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.style.cssText = "display:block;box-sizing:border-box;flex:0 0 auto;width:100%;max-width:none;margin:12px 0;padding:16px;border:2px solid " + color[1] + ";border-radius:10px;background:" + color[0] + ";color:" + color[1] + ";font-size:17px;font-weight:700;line-height:1.5;white-space:pre-line";
  }

  function setButtonsDisabled(disabled) {
    ["pdfButton", "emailButton"].forEach(function (id) {
      const button = document.getElementById(id);
      if (button) button.disabled = disabled;
    });
  }

  let busy = false;
  let sending = false;
  let database;
  let pendingPanel;

  // IndexedDB, plutôt que localStorage : le PDF et les photos peuvent dépasser 5 Mo.
  function openDatabase() {
    if (!database) database = new Promise(function (resolve, reject) {
      const request = indexedDB.open("crbo-checklist-outbox", 1);
      request.onupgradeneeded = function () { request.result.createObjectStore("outbox", { keyPath: "requestId" }); };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(new Error("Sauvegarde locale indisponible. Aucun envoi lancé ; gardez cette page ouverte.")); };
      request.onblocked = function () { reject(new Error("Sauvegarde locale bloquée. Fermez les autres onglets CRBO puis réessayez.")); };
    });
    return database;
  }

  async function outbox(operation, value) {
    const db = await openDatabase();
    return new Promise(function (resolve, reject) {
      const transaction = db.transaction("outbox", operation === "getAll" ? "readonly" : "readwrite");
      const request = transaction.objectStore("outbox")[operation](value);
      transaction.oncomplete = function () { resolve(request.result); };
      transaction.onabort = transaction.onerror = function () {
        reject(new Error("Impossible de sauvegarder le document sur cet appareil. Gardez cette page ouverte."));
      };
    });
  }

  async function getService(parameters) {
    const controller = new AbortController();
    const timeout = setTimeout(function () { controller.abort(); }, 12000);
    try {
      const url = new URL(WEB_APP_URL);
      Object.entries(parameters || {}).forEach(function (entry) { url.searchParams.set(entry[0], entry[1]); });
      url.searchParams.set("_", Date.now());
      const response = await fetch(url.href, { credentials: "omit", cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Le service Google ne répond pas correctement.");
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || "Réponse du service Google invalide.");
      return result;
    } finally { clearTimeout(timeout); }
  }

  async function requireService(record) {
    const service = await getService();
    if (service.receiptApi !== 1 || service.serverQueue !== 1) {
      throw new Error("Le script Google doit être mis à jour pour activer la file d’envoi. Le document est sauvegardé sur cet appareil ; aucun nouvel envoi lancé.");
    }
    if (service.queueReady !== true) throw new Error("Exécutez installerFileEnvoi dans l’éditeur Google puis redéployez. Le document reste sauvegardé sur cet appareil.");
    if (record.photos && record.photos.length && service.photoAttachments !== true) {
      throw new Error("Le script Google ne prend pas encore en charge les photos. Le document est sauvegardé.");
    }
    if (!Array.isArray(service.supportedTypes) || !service.supportedTypes.includes(record.checklistType)) {
      throw new Error("Ce type de document n’est pas pris en charge par le script Google.");
    }
  }

  async function finishReceipt(record, receipt) {
    if (receipt.state === "sent") {
      await outbox("delete", record.requestId);
      setStatus("Envoi confirmé par Google. Vous pouvez fermer cette page. La réception du mail peut prendre quelques instants.", "success");
      return true;
    }
    if (receipt.stored === true && ["queued", "retry", "sending", "review"].includes(receipt.state)) {
      record.serverAccepted = true;
      record.serverState = receipt.state;
      await outbox("put", record);
      setStatus(receipt.state === "review"
        ? "Copie enregistrée sur Drive, mais envoi incertain : prévenez le responsable pour vérification. Le document et les photos sont conservés."
        : "Document et photos enregistrés sur Drive. Vous pouvez fermer cette page : l’envoi par mail est pris en charge automatiquement.", receipt.state === "review" ? "warning" : "success");
      return true;
    }
    if (receipt.state === "failed") throw new Error("Envoi refusé : " + (receipt.error || "réessayez ultérieurement."));
    if (receipt.state === "review") throw new Error(receipt.error || "Envoi incertain : faites vérifier les exécutions du script avant de renvoyer.");
    return false;
  }

  async function transmit(record) {
    await requireService(record);
    const previous = await getService({ receipt: record.requestId });
    // Une erreur connue avant MailApp peut être réessayée ; un envoi incertain reste bloqué.
    if (previous.stored === true || previous.state === "sent" || previous.state === "review") {
      await finishReceipt(record, previous);
      return;
    }
    if (Date.now() - record.savedAt > 29 * 86400000) {
      throw new Error("Cette copie a plus de 29 jours : vérifiez les anciens envois avant de la renvoyer. Son PDF reste téléchargeable.");
    }
    if (previous.state === "missing" || previous.state === "failed") {
      setStatus("Transmission du document et des photos…");
      const controller = new AbortController();
      const timeout = setTimeout(function () { controller.abort(); }, 45000);
      try {
        await fetch(WEB_APP_URL, {
          method: "POST", mode: "no-cors", credentials: "omit", signal: controller.signal,
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(record)
        });
      } catch (_) {
        // Une coupure ne prouve pas que MailApp n’a pas travaillé : chercher le reçu.
      } finally { clearTimeout(timeout); }
    } else if (previous.state !== "sending") {
      throw new Error("État d’envoi inconnu. La copie est conservée ; aucun renvoi lancé.");
    }
    setStatus("Attendez le message de confirmation avant de quitter la checklist.");
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      const receipt = await getService({ receipt: record.requestId });
      if (await finishReceipt(record, receipt)) return;
      await new Promise(function (resolve) { setTimeout(resolve, 1500); });
    }
    throw new Error("Envoi non confirmé. Le PDF et les photos restent sauvegardés sur cet appareil. Utilisez « Vérifier / réessayer » ; ne recréez pas la checklist.");
  }

  async function sendPdf(pdf, type, photos) {
    const uniformOrder = type === "tenues";
    const identity = document.getElementById(uniformOrder ? "nom" : "plaque").value.trim();
    const checklistDate = document.getElementById("date").value;
    if (!TYPE_LABELS[type] || !identity || !checklistDate) throw new Error("Identité, date ou type de document manquant.");
    const blob = pdf.output("blob");
    if (blob.size > MAX_PDF_BYTES) throw new Error("Le PDF dépasse 10 Mo. Réduisez le contenu puis réessayez.");
    if (!window.crypto || !window.crypto.randomUUID) throw new Error("Ce navigateur doit être mis à jour pour sécuriser le suivi des envois.");
    const record = {
      requestId: window.crypto.randomUUID(), savedAt: Date.now(), path: window.location.pathname,
      pdfBase64: await blobToBase64(blob), checklistType: type, checklistDate: checklistDate,
      ...(uniformOrder ? { demandeur: identity } : { plaque: identity }), photos: photos, website: ""
    };
    await outbox("put", record);
    await renderPending();
    await transmit(record);
  }

  function downloadAttachment(base64, mimeType, filename) {
    const binary = window.atob(base64);
    const bytes = Uint8Array.from(binary, function (character) { return character.charCodeAt(0); });
    const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    const link = document.createElement("a");
    link.href = url; link.download = filename; link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  async function renderPending() {
    const records = (await outbox("getAll")).filter(function (record) {
      return record.path === window.location.pathname && (!record.serverAccepted || record.serverState === "review");
    });
    if (!pendingPanel) {
      pendingPanel = document.createElement("details");
      pendingPanel.setAttribute("aria-label", "Documents dont l’envoi reste à confirmer");
      pendingPanel.style.cssText = "box-sizing:border-box;width:100%;margin:8px 0;padding:12px;border:1px solid #b7791f;border-radius:10px;background:#fffbeb;color:#3d2b10";
      const status = document.getElementById("actionStatus");
      if (!status) return;
      status.parentNode.insertBefore(pendingPanel, status.nextSibling);
    }
    pendingPanel.replaceChildren();
    pendingPanel.hidden = busy || !records.length;
    if (!records.length) return;
    const title = document.createElement("summary");
    title.style.cssText = "cursor:pointer;font-weight:700";
    title.textContent = "Envoi à vérifier — options de récupération";
    pendingPanel.appendChild(title);
    const info = document.createElement("p");
    info.textContent = "Sans confirmation Drive, reprenez l’envoi ici sur le même appareil. Une fois le document enregistré sur Drive, le serveur s’occupe du mail même si vous fermez cette page. Les copies locales restent disponibles jusqu’à confirmation d’envoi.";
    pendingPanel.appendChild(info);
    records.sort(function (a, b) { return a.savedAt - b.savedAt; }).forEach(function (record) {
      const row = document.createElement("div");
      row.style.cssText = "padding:10px 0;border-top:1px solid #d6b878";
      const label = document.createElement("p");
      label.textContent = (record.plaque || record.demandeur) + " — " + record.checklistDate + " — " + record.photos.length + " photo(s) — " + (record.serverAccepted ? record.serverState === "review" ? "Sur Drive — vérification nécessaire" : "Sur Drive — envoi pris en charge" : "Enregistrement Drive non confirmé");
      row.appendChild(label);
      function button(text, handler) {
        const element = document.createElement("button");
        element.type = "button"; element.textContent = text; element.disabled = busy;
        element.style.cssText = "margin:4px;padding:8px;cursor:pointer";
        element.addEventListener("click", handler); row.appendChild(element);
      }
      button(record.serverAccepted ? "Vérifier l’envoi" : "Vérifier / réessayer", async function () {
        if (busy) return;
        busy = true; sending = true; setButtonsDisabled(true);
        try { await renderPending(); await transmit(record); }
        catch (error) { setStatus(error.message || "Envoi non confirmé. Copie conservée.", "error"); }
        finally { busy = false; sending = false; setButtonsDisabled(false); await renderPending(); }
      });
      button("Télécharger le PDF sauvegardé", function () {
        downloadAttachment(record.pdfBase64, "application/pdf", "checklist-" + record.checklistDate + ".pdf");
      });
      button("Supprimer la copie locale", async function () {
        if (busy || !window.confirm("Supprimer définitivement le PDF et les photos sauvegardés sur cet appareil ? Cela ne confirme ni n’annule un éventuel envoi. En cas de doute, vérifiez d’abord les exécutions du script.")) return;
        try { await outbox("delete", record.requestId); await renderPending(); }
        catch (error) { setStatus(error.message, "error"); }
      });
      record.photos.forEach(function (photo, index) {
        button("Photo " + (index + 1), function () { downloadAttachment(photo.base64, "image/jpeg", "photo-" + (index + 1) + ".jpg"); });
      });
      pendingPanel.appendChild(row);
    });
  }

  async function run(options) {
    if (busy) return;
    const action = options.action;
    const activeButton = document.getElementById(action === "send" ? "emailButton" : "pdfButton");
    const originalText = activeButton ? activeButton.textContent : "";

    if (action === "send") {
      const plaque = document.getElementById(options.type === "tenues" ? "nom" : "plaque");
      const date = document.getElementById("date");
      if (!plaque || !plaque.value.trim()) {
        setStatus(options.type === "tenues" ? "Indiquez votre nom avant l’envoi." : "Indiquez la plaque avant l’envoi.");
        if (plaque) plaque.focus();
        return;
      }
      if (!date || !date.value) {
        setStatus("Indiquez la date avant l’envoi.");
        if (date) date.focus();
        return;
      }
    }

    busy = true;
    sending = action === "send";
    setButtonsDisabled(true);
    await renderPending().catch(function () {});
    if (activeButton) activeButton.textContent = action === "send" ? "Envoi en cours…" : "Création du PDF…";
    setStatus(options.type === "tenues" ? "Préparation du bon de commande…" : "Préparation du rapport complet…");

    let photoSelection;
    try {
      if (action === "send") {
        const existing = (await outbox("getAll")).some(function (record) { return record.path === window.location.pathname && !record.serverAccepted; });
        if (existing) throw new Error("Un document attend déjà confirmation. Utilisez « Vérifier / réessayer » pour ce document avant de créer un nouvel envoi.");
      }
      const photos = [];
      if (action === "send" && options.prepareAttachments) {
        photoSelection = await options.prepareAttachments();
        photos.push(...photoSelection.photos);
        if (photos.length) {
          if (!["ambulance", "tpmr", "fit"].includes(options.type)) {
            throw new Error("Les photos sont réservées aux checklists des véhicules.");
          }

        }
      }
      const pdf = await options.buildPdf();

      if (action === "download") {
        pdf.save(options.filename);
        setStatus(options.type === "tenues" ? "Le bon de commande PDF a été téléchargé." : "Le rapport PDF a été téléchargé.");
      } else {
        await sendPdf(pdf, options.type, photos);

      }
    } catch (error) {
      console.error("Erreur PDF ou envoi :", error);
      setStatus(error && error.message ? error.message : "Impossible de traiter la checklist. Veuillez réessayer.", "error");
    } finally {
      if (photoSelection) photoSelection.release();
      busy = false;
      sending = false;
      setButtonsDisabled(false);
      try { await renderPending(); } catch (_) {}
      if (activeButton) activeButton.textContent = originalText;
    }
  }

  function initializeRecovery() {
    setStatus("Après avoir appuyé sur Envoyer, gardez cette page ouverte jusqu’au message de confirmation.", "info");
    renderPending().then(async function () {
      const records = (await outbox("getAll")).filter(function (record) { return record.path === window.location.pathname && record.serverAccepted; });
      for (const record of records) {
        if (busy) break;
        try {
          const receipt = await getService({ receipt: record.requestId });
          if (!busy) await finishReceipt(record, receipt);
        } catch (_) { /* Hors connexion : laisser les copies et leurs boutons disponibles. */ }
      }
      await renderPending();
    }).catch(function () {
      setStatus("La sauvegarde locale n’est pas disponible sur ce navigateur. Les envois seront bloqués pour éviter de perdre le document.");
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeRecovery);
  else initializeRecovery();

  window.ChecklistMailer = Object.freeze({ run: run });
})();
