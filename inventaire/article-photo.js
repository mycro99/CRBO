import { MAX_PHOTO_LENGTH, isArticlePhoto } from './inventory-core.js?v=4';

// Store only a small JPEG thumbnail in the existing article document. The original
// never leaves the device; drawing to canvas also discards its camera metadata.
export async function prepareArticlePhoto(file) {
  if (!file || !file.size || file.size > 25 * 1024 * 1024) throw new Error('Choisissez une photo de moins de 25 Mo.');
  if (file.type && !/^image\/(jpeg|png|webp|heic|heif|avif)$/i.test(file.type)) throw new Error('Choisissez une photo JPEG, PNG ou une photo prise avec le téléphone.');
  const url = URL.createObjectURL(file), img = new Image();
  try {
    img.src = url;
    try { await img.decode(); } catch { throw new Error('Ce format de photo ne peut pas être lu ici. Reprenez une photo ou choisissez un JPEG.'); }
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('Photo illisible.');
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('La préparation de la photo est indisponible sur cet appareil.');
    for (const edge of [512, 400, 320]) {
      const scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.65, 0.45]) {
        const result = canvas.toDataURL('image/jpeg', quality);
        if (result.length <= MAX_PHOTO_LENGTH && isArticlePhoto(result)) return result;
      }
    }
    throw new Error('Cette photo reste trop volumineuse. Essayez un cadrage plus simple.');
  } finally { URL.revokeObjectURL(url); }
}
