(function () {
  "use strict";

  const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxc9QPkfMF0uT-tavmtW6gMXqIcqJccI6qiKzYRPL6HUuHuSqBVhj6rngQpQyrTkRbN/exec";
  const MAX_PDF_BYTES = 10 * 1024 * 1024;
  const TYPE_LABELS = Object.freeze({
    ambulance: "AMBULANCE",
    tpmr: "TPMR",
    fit: "FIT",
    peremption: "PEREMPTION"
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

  function setStatus(message) {
    const status = document.getElementById("actionStatus");
    if (status) status.textContent = message;
  }

  function setButtonsDisabled(disabled) {
    ["pdfButton", "emailButton"].forEach(function (id) {
      const button = document.getElementById(id);
      if (button) button.disabled = disabled;
    });
  }

  async function sendPdf(pdf, type) {
    const typeLabel = TYPE_LABELS[type];
    const plaqueInput = document.getElementById("plaque");
    const dateInput = document.getElementById("date");
    const plaque = plaqueInput ? plaqueInput.value.trim() : "";
    const checklistDate = dateInput ? dateInput.value : "";

    if (!typeLabel) throw new Error("Type de checklist inconnu.");
    if (!plaque) {
      if (plaqueInput) plaqueInput.focus();
      throw new Error("Indiquez la plaque avant l’envoi.");
    }
    if (!checklistDate) {
      if (dateInput) dateInput.focus();
      throw new Error("Indiquez la date avant l’envoi.");
    }

    const blob = pdf.output("blob");
    if (blob.size > MAX_PDF_BYTES) {
      throw new Error("Le PDF dépasse 10 Mo. Utilisez le téléchargement en attendant.");
    }

    setStatus("Transmission sécurisée du PDF vers Gmail…");
    const pdfBase64 = await blobToBase64(blob);
    const requestId = Date.now() + "-" + (window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : Math.random().toString(36).slice(2));

    await fetch(WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        pdfBase64: pdfBase64,
        plaque: plaque,
        checklistDate: checklistDate,
        checklistType: type,
        requestId: requestId,
        website: ""
      })
    });
  }

  async function run(options) {
    const action = options.action;
    const activeButton = document.getElementById(action === "send" ? "emailButton" : "pdfButton");
    const originalText = activeButton ? activeButton.textContent : "";

    if (action === "send") {
      const plaque = document.getElementById("plaque");
      const date = document.getElementById("date");
      if (!plaque || !plaque.value.trim()) {
        setStatus("Indiquez la plaque avant l’envoi.");
        if (plaque) plaque.focus();
        return;
      }
      if (!date || !date.value) {
        setStatus("Indiquez la date avant l’envoi.");
        if (date) date.focus();
        return;
      }
    }

    setButtonsDisabled(true);
    if (activeButton) activeButton.textContent = action === "send" ? "Envoi en cours…" : "Création du PDF…";
    setStatus("Préparation du rapport complet…");

    try {
      const pdf = await options.buildPdf();

      if (action === "download") {
        pdf.save(options.filename);
        setStatus("Le rapport PDF a été téléchargé.");
      } else {
        await sendPdf(pdf, options.type);
        setStatus("Checklist transmise. Le mail peut prendre quelques secondes pour arriver.");
      }
    } catch (error) {
      console.error("Erreur PDF ou envoi :", error);
      setStatus(error && error.message ? error.message : "Impossible de traiter la checklist. Veuillez réessayer.");
    } finally {
      setButtonsDisabled(false);
      if (activeButton) activeButton.textContent = originalText;
    }
  }

  window.ChecklistMailer = Object.freeze({ run: run });
})();
