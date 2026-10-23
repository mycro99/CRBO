(function () {
  "use strict";

  const MAX_PHOTOS = 12;
  const MAX_TOTAL_BYTES = 6 * 1024 * 1024;
  const photos = [];
  let pending = Promise.resolve();
  let loading = false;
  let exporting = false;
  let panel;

  function refresh() {
    if (!panel) return;
    panel.querySelectorAll("button, input").forEach(control => {
      control.disabled = loading || exporting;
    });
    panel.querySelector(".vehicle-photo-count").textContent = photos.length
      ? photos.length + " photo" + (photos.length > 1 ? "s" : "") + " jointe" + (photos.length > 1 ? "s" : "") + " au PDF"
      : "Les photos seront jointes au PDF envoyé par mail (12 maximum).";
    const gallery = panel.querySelector(".vehicle-photo-gallery");
    gallery.replaceChildren();
    photos.forEach((photo, index) => {
      const figure = document.createElement("figure");
      const image = document.createElement("img");
      image.src = photo.data;
      image.alt = "Photo du véhicule " + (index + 1);
      const caption = document.createElement("figcaption");
      caption.textContent = "Photo " + (index + 1);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "secondary-button";
      remove.textContent = "Retirer";
      remove.setAttribute("aria-label", "Retirer la photo " + (index + 1));
      remove.disabled = loading || exporting;
      remove.addEventListener("click", () => {
        if (loading || exporting) return;
        photos.splice(index, 1);
        refresh();
        panel.querySelector(".vehicle-photo-status").textContent = "Photo retirée.";
      });
      figure.append(image, caption, remove);
      gallery.appendChild(figure);
    });
  }

  async function prepareImage(file) {
    const url = URL.createObjectURL(file);
    const image = new Image();
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("Photo illisible. Essayez une autre image ou une photo JPEG."));
        image.src = url;
      });
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", 0.78);
      const result = { data, width: canvas.width, height: canvas.height,
        bytes: Math.ceil((data.length - data.indexOf(",") - 1) * 3 / 4) };
      canvas.width = canvas.height = 1;
      return result;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function selectFiles(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = ""; // Selecting the same photo again must fire change.
    if (!files.length || exporting) return;
    loading = true;
    refresh();
    const status = panel.querySelector(".vehicle-photo-status");
    status.textContent = "Préparation des photos…";
    pending = pending.then(async () => {
      let added = 0;
      const errors = [];
      for (const file of files) {
        if (photos.length >= MAX_PHOTOS) {
          errors.push("12 photos maximum. Retirez une photo pour en ajouter une autre.");
          break;
        }
        try {
          const photo = await prepareImage(file);
          if (photos.reduce((total, item) => total + item.bytes, 0) + photo.bytes > MAX_TOTAL_BYTES) {
            throw new Error("Ces photos sont trop volumineuses pour le mail. Retirez quelques images.");
          }
          photos.push(photo);
          added++;
        } catch (error) {
          errors.push(error.message || "Impossible d’ajouter cette photo.");
        }
      }
      status.textContent = (added ? added + " photo" + (added > 1 ? "s ajoutées. " : " ajoutée. ") : "") + [...new Set(errors)].join(" ");
    }).finally(() => {
      loading = false;
      refresh();
    });
  }

  function mount() {
    panel = document.getElementById("vehiclePhotos");
    if (!panel) return;
    panel.innerHTML = `
      <h4>Photos du véhicule</h4>
      <p class="vehicle-photo-count"></p>
      <div class="vehicle-photo-actions">
        <button type="button" class="secondary-button" data-photo-camera><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h4l2-3h4l2 3h4v15H4z"/><circle cx="12" cy="13" r="4"/></svg>Prendre une photo</button>
        <button type="button" class="secondary-button" data-photo-gallery>Choisir des photos</button>
      </div>
      <input type="file" accept="image/*" capture="environment" data-photo-capture hidden aria-label="Prendre une photo du véhicule">
      <input type="file" accept="image/*" multiple data-photo-files hidden aria-label="Choisir des photos du véhicule dans la galerie">
      <p class="vehicle-photo-status" role="status" aria-live="polite"></p>
      <div class="vehicle-photo-gallery"></div>`;
    panel.querySelector("[data-photo-camera]").addEventListener("click", () => panel.querySelector("[data-photo-capture]").click());
    panel.querySelector("[data-photo-gallery]").addEventListener("click", () => panel.querySelector("[data-photo-files]").click());
    panel.querySelectorAll('input[type="file"]').forEach(input => input.addEventListener("change", selectFiles));
    refresh();
  }

  function appendToPdf(pdf, items) {
    const width = pdf.internal.pageSize.getWidth();
    const height = pdf.internal.pageSize.getHeight();
    const margin = 12;
    const slotHeight = (height - 52) / 2;
    const plaque = document.getElementById("plaque")?.value.trim() || "";
    const date = document.getElementById("date")?.value || "";
    items.forEach((photo, index) => {
      if (index % 2 === 0) {
        pdf.addPage();
        pdf.setTextColor(7, 29, 50);
        pdf.setFontSize(16);
        pdf.text("Photos du véhicule", margin, 18);
        pdf.setFontSize(10);
        pdf.text([plaque, date].filter(Boolean).join(" - "), margin, 25, { maxWidth: width - 2 * margin });
      }
      const top = 36 + (index % 2) * slotHeight;
      pdf.setFontSize(10);
      pdf.text("Photo " + (index + 1), margin, top);
      const ratio = Math.min((width - 2 * margin) / photo.width, (slotHeight - 16) / photo.height);
      const imageWidth = photo.width * ratio;
      const imageHeight = photo.height * ratio;
      pdf.addImage(photo.data, "JPEG", (width - imageWidth) / 2, top + 4, imageWidth, imageHeight, undefined, "FAST");
    });
  }

  async function withPhotos(buildPdf) {
    exporting = true;
    refresh();
    try {
      await pending;
      const snapshot = photos.slice();
      const pdf = await buildPdf();
      appendToPdf(pdf, snapshot);
      return pdf;
    } finally {
      exporting = false;
      refresh();
    }
  }

  window.VehiclePhotos = Object.freeze({ withPhotos });
  document.addEventListener("DOMContentLoaded", mount);
})();
