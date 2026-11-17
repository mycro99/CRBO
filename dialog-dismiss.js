(function () {
  'use strict';
  let pressed = null, candidate = null;

  function backdropDialog(event) {
    const dialog = event.target;
    if (!dialog || dialog.tagName !== 'DIALOG' || !dialog.open) return null;
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom ? dialog : null;
  }
  document.addEventListener('pointerdown', function (event) {
    pressed = null; candidate = null;
    if (event.button !== 0 || event.isPrimary === false) return;
    const dialog = backdropDialog(event);
    if (dialog) pressed = { dialog: dialog, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  }, true);
  document.addEventListener('pointerup', function (event) {
    candidate = null;
    if (pressed && pressed.pointerId === event.pointerId && pressed.dialog === backdropDialog(event) &&
        Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) <= 8) {
      candidate = pressed.dialog;
    }
    pressed = null;
  }, true);
  document.addEventListener('pointercancel', function () { pressed = null; candidate = null; }, true);
  document.addEventListener('click', function (event) {
    const dialog = candidate;
    candidate = null;
    if (!dialog || dialog !== backdropDialog(event)) return;
    // Follow the same cancellation path as Escape: dirty-form guards, save guards,
    // scanner cleanup and statistics-load cancellation remain in their existing owners.
    const accepted = dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    if (accepted && dialog.open) dialog.close();
  }, true);
})();
