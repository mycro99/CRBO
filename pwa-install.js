(function () {
  "use strict";

  const currentScript = document.currentScript;
  if (!currentScript || !currentScript.src) return;

  const baseUrl = new URL(".", currentScript.src);
  const iconUrl = new URL("icons/icon-192.png", baseUrl).href;
  const workerUrl = new URL("sw.js", baseUrl).href;
  const dismissKey = "crbo-pwa-install-dismissed";
  let installPrompt = null;
  let installButton = null;
  let helpBackdrop = null;
  let closeButton = null;
  let previousFocus = null;

  function isInstalled() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  }

  function isAppleDevice() {
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  }

  function wasDismissed() {
    try {
      return window.sessionStorage.getItem(dismissKey) === "yes";
    } catch (_) {
      return false;
    }
  }

  function rememberDismissal() {
    try {
      window.sessionStorage.setItem(dismissKey, "yes");
    } catch (_) {
      // L'installation reste utilisable même si le stockage du navigateur est bloqué.
    }
  }

  function mountInstaller() {
    if (installButton || !document.body || isInstalled()) return;

    installButton = document.createElement("button");
    installButton.className = "pwa-install-button";
    installButton.type = "button";
    installButton.hidden = true;
    installButton.setAttribute("aria-haspopup", "dialog");
    installButton.innerHTML = '<img src="' + iconUrl + '" alt=""><span>Installer l’app</span>';

    helpBackdrop = document.createElement("div");
    helpBackdrop.className = "pwa-help-backdrop";
    helpBackdrop.hidden = true;
    helpBackdrop.innerHTML =
      '<section class="pwa-help-card" role="dialog" aria-modal="true" aria-labelledby="pwa-help-title">' +
        '<button class="pwa-help-close" type="button" aria-label="Fermer">×</button>' +
        '<img src="' + iconUrl + '" alt="">' +
        '<p class="pwa-help-eyebrow">Application mobile</p>' +
        '<h2 id="pwa-help-title">Installez CS Oupeye</h2>' +
        '<p class="pwa-help-instructions"></p>' +
        '<small>L’icône ouvrira ensuite le portail comme une vraie application, sans barre de navigateur.</small>' +
      '</section>';

    closeButton = helpBackdrop.querySelector(".pwa-help-close");
    installButton.addEventListener("click", install);
    closeButton.addEventListener("click", dismiss);
    helpBackdrop.addEventListener("click", function (event) {
      if (event.target === helpBackdrop) dismiss();
    });

    document.body.append(installButton, helpBackdrop);
  }

  function showInstaller() {
    if (isInstalled()) return;
    mountInstaller();
    if (installButton) installButton.hidden = false;
  }

  function showHelp() {
    mountInstaller();
    if (!helpBackdrop) return;

    const instructions = helpBackdrop.querySelector(".pwa-help-instructions");
    instructions.innerHTML = isAppleDevice()
      ? 'Sur iPhone ou iPad, ouvrez cette page dans <strong>Safari</strong>. Touchez <strong>Partager</strong>, puis <strong>Sur l’écran d’accueil</strong> et enfin <strong>Ajouter</strong>.'
      : 'Ouvrez le menu du navigateur, puis choisissez <strong>Installer l’application</strong> ou <strong>Ajouter à l’écran d’accueil</strong>.';

    previousFocus = document.activeElement;
    helpBackdrop.hidden = false;
    document.body.classList.add("pwa-install-modal-open");
    closeButton.focus();
    document.addEventListener("keydown", onKeyDown);
  }

  function hideHelp() {
    if (!helpBackdrop) return;
    helpBackdrop.hidden = true;
    document.body.classList.remove("pwa-install-modal-open");
    document.removeEventListener("keydown", onKeyDown);
    if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
  }

  function dismiss() {
    rememberDismissal();
    hideHelp();
    if (installButton) installButton.hidden = true;
  }

  function onKeyDown(event) {
    if (event.key === "Escape") dismiss();
  }

  async function install() {
    if (!installPrompt) {
      showHelp();
      return;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      installPrompt = null;
      if (choice.outcome === "accepted" && installButton) installButton.hidden = true;
    } catch (_) {
      installPrompt = null;
      showHelp();
    }
  }

  function registerWorker() {
    if (!("serviceWorker" in window.navigator)) return;
    window.navigator.serviceWorker.register(workerUrl, { scope: baseUrl.pathname }).catch(function () {
      // Le guide d'installation manuel reste disponible si le worker ne démarre pas.
    });
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    installPrompt = event;
    showInstaller();
  });

  window.addEventListener("appinstalled", function () {
    installPrompt = null;
    hideHelp();
    if (installButton) installButton.hidden = true;
  });

  function initialise() {
    if (isInstalled()) return;
    mountInstaller();
    window.setTimeout(function () {
      if (!wasDismissed()) showInstaller();
    }, 1600);

    if (document.readyState === "complete") registerWorker();
    else window.addEventListener("load", registerWorker, { once: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  } else {
    initialise();
  }
})();
