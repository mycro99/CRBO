import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const serverSource = fs.readFileSync(new URL('../Code.gs', import.meta.url), 'utf8');
const browserSource = fs.readFileSync(new URL('../../checklist-email.js', import.meta.url), 'utf8');

function server(options = {}) {
  const state = { count: 0, quota: 100, account: 'contactoupeye@gmail.com', active: 'contactoupeye@gmail.com',
    locked: false, signedBytes: false, mailError: false, failSentReceipt: false, failSentManifest: false,
    installed: true, failCreateAt: 0, failTrash: false, shared: false, now: Date.parse('2026-10-09T12:00:00Z'), ...options };
  const mails = [], properties = new Map(), logs = [], files = new Map(), folders = new Map(), triggers = [];
  properties.set('CHECKLIST_SEND_COUNTER', JSON.stringify({ date: '2026-10-09', count: state.count }));
  let held = false, nextId = 0, creates = 0;
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [state.now])); } static now() { return state.now; } }
  function iterator(items) { let i = 0; return { hasNext: () => i < items.length, next: () => items[i++] }; }
  function blob(content, type, name) {
    const bytes = typeof content === 'string' ? [...Buffer.from(content)] : Array.from(content);
    return { bytes, type, name, getBytes: () => bytes, getName: () => name, getContentType: () => type,
      getDataAsString: () => Buffer.from(bytes.map(b => b & 255)).toString(),
      setName(value) { name = value; this.name = value; return this; },
      setContentType(value) { type = value; this.type = value; return this; } };
  }
  function folder(name, parent) {
    const id = 'folder-' + ++nextId;
    const item = { id, name, parent, trashed: false, childFolders: [], childFiles: [],
      getId: () => id, getUrl: () => 'https://drive.google.com/drive/folders/' + id,
      isTrashed: () => item.trashed || !!(parent && parent.isTrashed()),
      getSharingAccess: () => state.shared ? 'PUBLIC' : 'PRIVATE', getEditors: () => [], getViewers: () => [],
      setSharing(access, permission) { assert.equal(access, 'PRIVATE'); assert.equal(permission, 'NONE'); return item; },
      getFolders: () => iterator(item.childFolders.filter(f => !f.isTrashed())),
      getFoldersByName: value => iterator(item.childFolders.filter(f => f.name === value && !f.isTrashed())),
      getFiles: () => iterator(item.childFiles.filter(f => !f.isTrashed())),
      getFilesByName: value => iterator(item.childFiles.filter(f => f.name === value && !f.isTrashed())),
      createFolder(value) { return folder(value, item); },
      setTrashed(value) { if (state.failTrash) throw new Error('Drive cleanup failed'); item.trashed = value; return item; },
      createFile(value) {
        creates++;
        if (state.failCreateAt === creates) throw new Error('Drive upload failed');
        const fileId = 'file-' + ++nextId;
        let contents = blob(value.getBytes(), value.getContentType(), value.getName());
        const file = { id: fileId, name: value.getName(), trashed: false,
          getId: () => fileId, getSize: () => contents.getBytes().length,
          getBlob: () => blob(contents.getBytes(), contents.getContentType(), file.name),
          isTrashed: () => file.trashed || item.isTrashed(),
          setTrashed(value) { file.trashed = value; return file; },
          setContent(value) {
            if (file.name === 'envoi.json' && state.failSentManifest && JSON.parse(value).state === 'sent') throw new Error('Drive sent marker failed');
            contents = blob(value, contents.getContentType(), file.name); return file;
          }
        };
        item.childFiles.push(file); files.set(fileId, file); return file;
      }
    };
    folders.set(id, item); if (parent) parent.childFolders.push(item); return item;
  }
  const context = {
    Date: Clock, console: { error: value => logs.push(value), warn: value => logs.push(value), log: value => logs.push(value) },
    LockService: { getScriptLock: () => ({ tryLock: () => (held = !state.locked), hasLock: () => held, releaseLock: () => { held = false; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties.get(key),
      setProperty: (key, value) => { if (state.failSentReceipt && key.startsWith('MAIL_RECEIPT:') && JSON.parse(value).state === 'sent') throw new Error('Storage down'); properties.set(key, value); },
      getProperties: () => Object.fromEntries(properties), deleteProperty: key => properties.delete(key) }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => state.account }), getActiveUser: () => ({ getEmail: () => state.active }) },
    Utilities: {
      getUuid: () => 'generated-uuid-12345678901234567890',
      formatDate: date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(date),
      base64Decode: value => [...Buffer.from(value, 'base64')].map(b => state.signedBytes && b > 127 ? b - 256 : b),
      newBlob: blob
    },
    DriveApp: { Access: { PRIVATE: 'PRIVATE' }, Permission: { NONE: 'NONE' },
      createFolder: name => folder(name), getFolderById: id => { if (!folders.has(id)) throw new Error('Folder missing'); return folders.get(id); },
      getFileById: id => { if (!files.has(id)) throw new Error('File missing'); return files.get(id); } },
    ScriptApp: { getProjectTriggers: () => [...triggers], deleteTrigger: trigger => triggers.splice(triggers.indexOf(trigger), 1),
      newTrigger: handler => ({ timeBased() { return this; }, everyMinutes(minutes) { assert.equal(minutes, 5); return this; },
        create() { const trigger = { getHandlerFunction: () => handler }; triggers.push(trigger); return trigger; } }) },
    MailApp: { getRemainingDailyQuota: () => state.quota, sendEmail: mail => {
      if (state.mailError) throw new Error('Google timeout'); mails.push(mail); state.quota--;
    } },
    ContentService: { MimeType: { JSON: 'JSON' }, createTextOutput: value => ({ setMimeType: () => JSON.parse(value) }) }
  };
  vm.createContext(context); vm.runInContext(serverSource, context);
  if (state.installed) context.installerFileEnvoi();
  function pending() {
    const root = folders.get(properties.get('CRBO_MAIL_QUEUE_ROOT'));
    return root ? root.childFolders.filter(f => !f.isTrashed()) : [];
  }
  function job(id) {
    const f = pending().find(f => f.name === 'envoi-' + id);
    if (!f) return null;
    const manifest = f.getFilesByName('envoi.json');
    return manifest.hasNext() ? JSON.parse(manifest.next().getBlob().getDataAsString()) : null;
  }
  return {
    get: id => context.doGet(id ? { parameter: { receipt: id } } : undefined),
    post: payload => context.doPost({ postData: { contents: JSON.stringify(payload) } }),
    run: () => context.traiterFileEnvoi(), install: () => context.installerFileEnvoi(),
    mails, properties, clearCache() {}, held: () => held, state, folders, files, triggers, pending, job, logs,
    advance: milliseconds => { state.now += milliseconds; }
  };
}

const valid = {
  pdfBase64: Buffer.from('%PDF-1.4\nTest').toString('base64'),
  checklistDate: '2026-10-09', requestId: 'test-request', website: ''
};

test('uniform PDF uses the name, fixed recipient, date and attachment', () => {
  const service = server();
  const result = service.post({ ...valid, checklistType: 'tenues', demandeur: '  Kévin\r\n Leruth  ', recipient: 'ignored@example.com' });
  assert.equal(result.ok, true);
  assert.equal(result.subject, 'Commande de tenues - Kévin Leruth');
  assert.equal(result.filename, 'commande-tenues-09-10-26.pdf');
  assert.equal(service.mails[0].to, 'logistique.cs.oupeye@croix-rouge.be');
  assert.equal(service.mails[0].attachments[0].type, 'application/pdf');
  assert.equal(service.mails[0].attachments[0].name, result.filename);
  assert.match(service.mails[0].body, /Demandeur : Kévin Leruth/);
  assert.equal(service.held(), false);
});

test('all four checklists and legacy requests preserve the existing subject and filename', () => {
  for (const type of [undefined, 'ambulance', 'tpmr', 'fit', 'peremption']) {
    const service = server();
    const result = service.post({ ...valid, checklistType: type, plaque: '1-abc-234' });
    assert.equal(result.ok, true);
    assert.equal(result.subject, 'Checklist - 1-ABC-234');
    assert.equal(result.filename, 'checklist-09-10-26.pdf');
    assert.equal(service.mails.length, 1);
  }
});

test('duplicates send once and update the shared existing counter once', () => {
  const service = server({ count: 4 });
  const payload = { ...valid, checklistType: 'tenues', demandeur: 'Kevin' };
  assert.equal(service.post(payload).ok, true);
  assert.equal(service.post(payload).duplicate, true);
  assert.equal(service.mails.length, 1);
  assert.equal(JSON.parse(service.properties.get('CHECKLIST_SEND_COUNTER')).count, 5);
  assert.equal(service.held(), false);
});

test('invalid documents, missing names and unknown types never send a mail', () => {
  for (const changes of [
    { demandeur: '' }, { checklistType: 'constructor' }, { checklistType: 'other' },
    { pdfBase64: Buffer.from('not a PDF').toString('base64') }, { pdfBase64: '' }
  ]) {
    const service = server();
    const result = service.post({ ...valid, checklistType: 'tenues', demandeur: 'Kevin', ...changes });
    assert.equal(result.ok, false);
    assert.equal(service.mails.length, 0);
    assert.equal(service.held(), false);
  }
});

test('existing quota, daily limit, lock and sender protections remain active', () => {
  for (const settings of [{ locked: true, installed: false }, { account: 'other@example.com', active: 'other@example.com', installed: false }]) {
    const service = server(settings);
    assert.equal(service.post({ ...valid, checklistType: 'tenues', demandeur: 'Kevin' }).ok, false);
    assert.equal(service.mails.length, 0);
    assert.equal(service.held(), false);
  }
  for (const settings of [{ count: 30 }, { quota: 0 }]) {
    const service = server(settings);
    assert.equal(service.post({ ...valid, plaque: 'ABC' }).ok, true);
    assert.equal(service.pending().length, 1);
    assert.equal(service.mails.length, 0);
  }
  const service = server();
  assert.equal(service.post({ ...valid, website: 'bot' }).ok, true);
  assert.equal(service.mails.length, 0);
  assert.ok(service.get().supportedTypes.includes('tenues'));
});

// Un double IndexedDB valide les transactions, y compris la reprise après rechargement.
function fakeDatabase(records, failSave) {
  return { open() {
    const opening = {};
    queueMicrotask(() => {
      opening.result = { transaction() {
        const transaction = { objectStore: () => ({
          getAll: () => operation(() => [...records.values()]),
          put: value => operation(() => { if (failSave) throw new Error('Quota'); records.set(value.requestId, structuredClone(value)); }),
          delete: key => operation(() => records.delete(key))
        }) };
        function operation(fn) {
          const request = {};
          queueMicrotask(() => { try { request.result = fn(); transaction.oncomplete(); } catch (_) { transaction.onabort(); } });
          return request;
        }
        return transaction;
      } };
      opening.onsuccess();
    });
    return opening;
  } };
}

async function browser({ type = 'tenues', name = 'Kévin Leruth', date = '2026-10-09', ready = true,
  networkError = false, action = 'send', photos, photoReady = true, failPost = false,
  receipt = 'sent', stored = false, queueReady = true, records = new Map(), failSave = false, submit = true } = {}) {
  function element() {
    return { textContent: '', children: [], style: {}, listeners: {},
      appendChild(child) { this.children.push(child); }, replaceChildren() { this.children = []; },
      setAttribute() {}, addEventListener(event, fn) { this.listeners[event] = fn; }, focus() {},
      parentNode: { insertBefore() {} }
    };
  }
  const elements = {
    nom: { value: name, focus() {} }, plaque: { value: '1-ABC-234', focus() {} },
    date: { value: date, focus() {} }, actionStatus: element(),
    pdfButton: { textContent: 'Télécharger' }, emailButton: { textContent: 'Envoyer' }
  };
  let built = 0, downloaded = 0, payload, probes = 0, released = 0, posts = 0, uuid = 0, time = Date.now();
  const receivedIds = new Set();
  const created = [];
  class Clock extends Date { static now() { time += 10000; return time; } }
  const context = {
    document: { readyState: 'loading', addEventListener() {}, getElementById: id => elements[id],
      createElement: () => { const item = element(); created.push(item); return item; } },
    console: { error() {} }, URL, Blob, indexedDB: fakeDatabase(records, failSave),
    Uint8Array, Date: Clock, Math, Error, AbortController,
    setTimeout: (fn, ms) => ms === 1500 ? setTimeout(fn, 0) : setTimeout(fn, ms), clearTimeout,
    window: { location: { pathname: '/test' }, btoa: value => Buffer.from(value, 'binary').toString('base64'),
      atob: value => Buffer.from(value, 'base64').toString('binary'), crypto: { randomUUID: () => 'test-uuid-1234567890123456789-' + ++uuid } },
    fetch: async (url, options) => {
      if (networkError) throw new Error('Réseau indisponible');
      assert.equal(options.credentials, 'omit');
      if (!options.method) {
        if (new URL(url).searchParams.has('receipt')) {
          const known = receivedIds.has(new URL(url).searchParams.get('receipt'));
          return { ok: true, json: async () => ({ ok: true, stored: known && stored, state: known ? receipt : 'missing', error: receipt === 'failed' ? 'Quota épuisé' : undefined }) };
        }
        probes++;
        return { ok: true, json: async () => ({ ok: true, receiptApi: ready ? 1 : undefined, serverQueue: ready ? 1 : undefined, queueReady,
          supportedTypes: ['ambulance','tpmr','fit','peremption','tenues'], photoAttachments: photoReady }) };
      }
      posts++;
      if (failPost) throw new Error('Transmission interrompue');
      assert.equal(options.mode, 'no-cors');
      assert.equal(records.has(JSON.parse(options.body).requestId), true, 'la copie doit être validée avant le POST');
      payload = JSON.parse(options.body);
      receivedIds.add(payload.requestId);
      return {};
    }
  };
  vm.createContext(context); vm.runInContext(browserSource, context);
  if (submit) await context.window.ChecklistMailer.run({
    action, type, filename: 'commande.pdf',
    ...(photos ? { prepareAttachments: async () => ({ photos, release: () => released++ }) } : {}),
    buildPdf: async () => {
      built++;
      return { save: () => downloaded++, output: () => ({ size: 5, arrayBuffer: async () => Uint8Array.from([37, 80, 68, 70, 45]).buffer }) };
    }
  });
  return { built, downloaded, payload, probes, elements, released, records, created, context, posts };
}

test('old deployment blocks POST but preserves a complete local copy', async () => {
  const result = await browser({ ready: false });
  assert.equal(result.built, 1);
  assert.equal(result.posts, 0);
  assert.equal(result.records.size, 1);
  assert.match(result.elements.actionStatus.textContent, /script Google doit être mis à jour/);
  assert.equal(result.elements.emailButton.disabled, false);
});

test('browser only confirms after the server receipt, then removes the copy', async () => {
  const result = await browser();
  assert.equal(result.payload.demandeur, 'Kévin Leruth');
  assert.equal(result.payload.checklistType, 'tenues');
  assert.equal(server().post(result.payload).ok, true);
  assert.match(result.elements.actionStatus.textContent, /Envoi confirmé par Google/);
  assert.equal(result.records.size, 0);
  assert.equal(result.elements.emailButton.disabled, false);
});

test('all document types require receipts; download needs no mail service', async () => {
  for (const type of ['ambulance','tpmr','fit','peremption']) {
    const result = await browser({ type });
    assert.equal(result.probes, 1);
    assert.equal(result.payload.plaque, '1-ABC-234');
    assert.equal(result.records.size, 0);
  }
  const download = await browser({ action: 'download', networkError: true });
  assert.equal(download.downloaded, 1);
  assert.equal(download.probes, 0);
});

test('missing fields block; network and local storage failures never claim success', async () => {
  for (const settings of [{ name: '' }, { date: '' }]) {
    const result = await browser(settings);
    assert.equal(result.built, 0); assert.equal(result.posts, 0);
  }
  const network = await browser({ networkError: true });
  assert.equal(network.records.size, 1);
  assert.match(network.elements.actionStatus.textContent, /Réseau indisponible/);
  const storage = await browser({ failSave: true });
  assert.equal(storage.posts, 0);
  assert.match(storage.elements.actionStatus.textContent, /sauvegarder/);
});

test('opaque response without receipt is not success; PDF and photos survive reload and retry', async () => {
  const records = new Map();
  const attempt = await browser({ type: 'ambulance', receipt: 'missing', records, photos: [photo] });
  assert.equal(attempt.records.size, 1);
  assert.match(attempt.elements.actionStatus.textContent, /Envoi non confirmé/);
  const id = [...records.keys()][0];
  const retry = await browser({ records });
  assert.equal(retry.posts, 0, 'un nouveau document ne doit pas remplacer la copie');
  const button = retry.created.find(item => item.textContent === 'Vérifier / réessayer');
  await button.listeners.click();
  assert.equal(retry.records.size, 0);
  assert.match(retry.elements.actionStatus.textContent, /Envoi confirmé/);
  assert.equal(id, attempt.payload.requestId);
});

test('explicit refusal and uncertain send keep backup and show no success', async () => {
  for (const receipt of ['failed', 'review', 'sending']) {
    const result = await browser({ receipt });
    assert.equal(result.records.size, 1);
    assert.doesNotMatch(result.elements.actionStatus.textContent, /Envoi confirmé/);
    if (receipt === 'failed') assert.match(result.elements.actionStatus.textContent, /Quota épuisé/);
  }
});

const photo = {
  filename: 'photo-1-ABC-234-2026-10-09-01.jpg',
  mimeType: 'image/jpeg',
  base64: Buffer.from([255, 216, 255, 217]).toString('base64')
};

test('all three vehicle checklists send JPEGs separately from the unchanged PDF', async () => {
  for (const type of ['ambulance', 'tpmr', 'fit']) {
    const result = await browser({ type, photos: [photo], photoReady: true });
    assert.equal(result.probes, 1);
    assert.equal(result.built, 1);
    assert.equal(result.payload.checklistType, type);
    assert.equal(result.payload.pdfBase64, Buffer.from('%PDF-').toString('base64'));
    assert.equal(JSON.stringify(result.payload.photos), JSON.stringify([photo]));
    assert.equal(result.released, 1);
    assert.match(result.elements.actionStatus.textContent, /Envoi confirmé/);
  }
});

test('photo requests cannot silently lose JPEGs on the current Google script', async () => {
  const result = await browser({ type: 'ambulance', photos: [photo], photoReady: false });
  assert.equal(result.probes, 1);
  assert.equal(result.built, 1);
  assert.equal(result.payload, undefined);
  assert.equal(result.released, 1);
  assert.equal(result.elements.emailButton.disabled, false);
  assert.match(result.elements.actionStatus.textContent, /ne prend pas encore en charge les photos/);
});

test('empty photo selections use the same confirmed sending', async () => {
  for (const type of ['ambulance', 'tpmr', 'fit']) {
    const result = await browser({ type, photos: [] });
    assert.equal(result.probes, 1);
    assert.equal(result.payload.photos.length, 0);
    assert.equal(result.released, 1);
    assert.equal(server().post(result.payload).ok, true);
  }
});

test('photo controls are released when network transmission fails', async () => {
  const result = await browser({ type: 'fit', photos: [photo], photoReady: true, failPost: true, receipt: 'missing' });
  assert.equal(result.released, 1);
  assert.equal(result.elements.emailButton.disabled, false);
  assert.equal(result.payload, undefined);
  assert.match(result.elements.actionStatus.textContent, /Envoi non confirmé/);
});

const jpeg = { filename: '../../ignored.exe', mimeType: 'image/jpeg', base64: Buffer.from([255, 216, 255, 224, 0, 255, 217]).toString('base64') };

test('Google script attaches JPEGs beside the PDF for all three vehicles, including signed Google bytes', () => {
  for (const type of ['ambulance', 'tpmr', 'fit']) {
    const service = server({ signedBytes: true });
    const result = service.post({ ...valid, checklistType: type, plaque: '1-ABC-234', photos: [jpeg, jpeg] });
    assert.equal(service.get().photoAttachments, true);
    assert.equal(result.ok, true);
    assert.equal(result.photoCount, 2);
    assert.equal(service.mails.length, 1);
    const attachments = service.mails[0].attachments;
    assert.equal(attachments.length, 3);
    assert.equal(attachments[0].type, 'application/pdf');
    assert.equal(attachments[1].type, 'image/jpeg');
    assert.equal(attachments[1].name, 'photo-1-ABC-234-09-10-26-01.jpg');
    assert.equal(attachments[2].name, 'photo-1-ABC-234-09-10-26-02.jpg');
    assert.match(service.mails[0].body, /2 photo\(s\)/);
    assert.equal(JSON.parse(service.properties.get('CHECKLIST_SEND_COUNTER')).count, 1);
  }
});

test('a bad JPEG rejects the whole mail, including otherwise valid preceding attachments', () => {
  for (const photos of [
    null, {}, [null], Array(13).fill(jpeg),
    [jpeg, { ...jpeg, mimeType: 'image/png' }],
    [jpeg, { ...jpeg, base64: Buffer.from('%PDF-not-a-jpeg').toString('base64') }],
    [{ ...jpeg, base64: 'invalid base64!!' }],
    [{ ...jpeg, base64: jpeg.base64.slice(0, -1) }],
    [{ ...jpeg, base64: Buffer.from([255, 216, 255, 224]).toString('base64') }]
  ]) {
    const service = server();
    const result = service.post({ ...valid, checklistType: 'ambulance', plaque: 'ABC', photos });
    assert.equal(result.ok, false);
    assert.equal(service.mails.length, 0);
    assert.equal(JSON.parse(service.properties.get('CHECKLIST_SEND_COUNTER')).count, 0);
    assert.equal(service.held(), false);
  }
});

test('photos stay forbidden for expiry checks and uniform orders', () => {
  for (const type of ['peremption', 'tenues']) {
    const service = server();
    assert.equal(service.post({ ...valid, checklistType: type, demandeur: 'Kevin', plaque: 'ABC', photos: [jpeg] }).ok, false);
    assert.equal(service.mails.length, 0);
  }
});

test('combined JPEG size is limited to 6 MiB and photo retries never send twice', () => {
  const big = Buffer.alloc(3 * 1024 * 1024 + 1, 0);
  big[0] = 255; big[1] = 216; big[2] = 255;
  big[big.length - 2] = 255; big[big.length - 1] = 217;
  const largePhoto = { ...jpeg, base64: big.toString('base64') };
  const service = server();
  assert.equal(service.post({ ...valid, plaque: 'ABC', photos: [largePhoto, largePhoto] }).ok, false);
  assert.equal(service.mails.length, 0);
  const request = { ...valid, plaque: 'ABC', photos: [jpeg] };
  assert.equal(service.post(request).ok, true);
  assert.equal(service.post(request).duplicate, true);
  assert.equal(service.mails.length, 1);
});


test('durable receipt confirms send even after volatile cache is gone', () => {
  const service = server();
  const payload = { ...valid, requestId: 'durable-request-123456789', plaque: 'ABC' };
  assert.equal(service.post(payload).ok, true);
  assert.equal(service.get(payload.requestId).state, 'sent');
  service.clearCache();
  assert.equal(service.post(payload).duplicate, true);
  assert.equal(service.mails.length, 1);
  assert.equal(service.get('unknown-request-123456789').state, 'missing');
  assert.equal(service.get('../invalid').ok, false);
  const receipt = JSON.stringify(service.get(payload.requestId));
  assert.doesNotMatch(receipt, /ABC|PDF|base64|recipient/);
});

test('server quota failure is readable by receipt; ambiguous mail errors prohibit resending', () => {
  const payload = { ...valid, requestId: 'failure-request-123456789', plaque: 'ABC' };
  const quota = server({ quota: 0 });
  assert.equal(quota.post(payload).ok, true);
  assert.equal(quota.get(payload.requestId).state, 'retry');
  assert.equal(quota.get(payload.requestId).stored, true);
  assert.match(quota.job(payload.requestId).lastError, /quota/);
  const uncertain = server({ mailError: true });
  assert.equal(uncertain.post(payload).ok, true);
  assert.equal(uncertain.get(payload.requestId).state, 'review');
  assert.equal(uncertain.post(payload).ok, true);
  assert.equal(uncertain.get(payload.requestId).state, 'review');
});

test('receipt persistence failure after MailApp never allows a second mail', () => {
  const service = server({ failSentReceipt: true });
  const payload = { ...valid, requestId: 'storage-failure-123456789', plaque: 'ABC' };
  assert.equal(service.post(payload).ok, true);
  assert.equal(service.mails.length, 1);
  assert.equal(service.get(payload.requestId).state, 'sent');
  service.post(payload);
  assert.equal(service.mails.length, 1);
});


test('installer is owner-only, idempotent and preserves other triggers and saved documents', () => {
  const service = server({ installed: false });
  assert.equal(service.get().queueReady, false);
  service.install(); service.install();
  assert.equal(service.get().serverQueue, 1);
  assert.equal(service.get().queueReady, true);
  assert.equal(service.triggers.length, 1);
  service.triggers.push({ getHandlerFunction: () => 'otherJob' });
  service.install();
  assert.equal(service.triggers.length, 2);
  const unauthenticated = server({ installed: false, active: '' });
  assert.throws(() => unauthenticated.install(), /éditeur/);
  assert.equal(unauthenticated.folders.size, 0);
  assert.equal(unauthenticated.post({ ...valid, plaque: 'ABC' }).ok, false);
  assert.equal(unauthenticated.mails.length, 0);
});

test('quota failure preserves the complete PDF and JPEGs; trigger later sends and cleans up', () => {
  const service = server({ quota: 0 });
  const payload = { ...valid, requestId: 'queued-request-123456789', plaque: 'ABC', photos: [jpeg] };
  assert.equal(service.post(payload).ok, true);
  const job = service.job(payload.requestId);
  assert.equal(job.state, 'retry'); assert.equal(job.files.length, 2);
  assert.equal(service.get(payload.requestId).stored, true);
  assert.equal(service.get(payload.requestId).state, 'retry');
  assert.equal(service.mails.length, 0);
  for (const item of job.files) assert.equal(service.files.get(item.id).isTrashed(), false);
  service.state.quota = 10;
  service.run(); assert.equal(service.mails.length, 0, 'respecter la date de reprise');
  service.advance(3600001); service.run();
  assert.equal(service.mails.length, 1);
  assert.equal(service.mails[0].attachments.length, 2);
  assert.equal(service.pending().length, 0);
  assert.equal(service.get(payload.requestId).state, 'sent');
  service.run(); service.post(payload);
  assert.equal(service.mails.length, 1, 'pas de doublon après nettoyage Drive');
});

test('failed automated retry keeps all backups and sends nothing', () => {
  const service = server({ quota: 0 });
  const payload = { ...valid, requestId: 'failed-retry-1234567890', plaque: 'ABC', photos: [jpeg, jpeg] };
  service.post(payload); service.advance(3600001); service.run();
  assert.equal(service.pending().length, 1); assert.equal(service.mails.length, 0);
  assert.equal(service.job(payload.requestId).files.length, 3);
  assert.equal(service.job(payload.requestId).state, 'retry');
  service.advance(86400000 * 31); service.run();
  assert.equal(service.get(payload.requestId).stored, true);
  assert.equal(service.pending().length, 1, 'aucune expiration des sauvegardes non envoyées');
});

test('partial Drive upload is never acknowledged as stored and never sent; same-ID retry recovers', () => {
  const service = server({ failCreateAt: 2 });
  const payload = { ...valid, requestId: 'partial-upload-123456789', plaque: 'ABC', photos: [jpeg] };
  assert.equal(service.post(payload).ok, false);
  assert.equal(service.get(payload.requestId).stored, false);
  service.run(); assert.equal(service.mails.length, 0);
  assert.equal(service.pending().length, 1, 'fragments conservés pour diagnostic');
  assert.equal(service.post(payload).ok, true);
  assert.equal(service.mails.length, 1);
  assert.equal(service.pending().length, 0);
});

test('lost property receipt does not hide a complete Drive job or authorize another POST', () => {
  const service = server({ quota: 0 });
  const payload = { ...valid, requestId: 'lost-receipt-123456789', plaque: 'ABC' };
  service.post(payload); service.properties.delete('MAIL_RECEIPT:' + payload.requestId);
  assert.equal(service.get(payload.requestId).state, 'retry');
  assert.equal(service.get(payload.requestId).stored, true);
  assert.equal(service.post(payload).duplicate, true);
  assert.equal(service.pending().length, 1);
});

test('interruption after sending marker or exception during MailApp retains Drive copy in review', () => {
  const service = server({ failSentManifest: true });
  const payload = { ...valid, requestId: 'crash-after-mail-123456789', plaque: 'ABC', photos: [jpeg] };
  service.post(payload);
  assert.equal(service.mails.length, 1);
  assert.equal(service.job(payload.requestId).state, 'sending');
  service.run();
  assert.equal(service.job(payload.requestId).state, 'review');
  assert.equal(service.pending().length, 1);
  service.run(); service.post(payload);
  assert.equal(service.mails.length, 1);
  const exception = server({ mailError: true });
  exception.post(payload); exception.run(); exception.run();
  assert.equal(exception.job(payload.requestId).state, 'review');
  assert.equal(exception.pending().length, 1);
});

test('cleanup failure after success retains backup but never resends; next trigger only cleans', () => {
  const service = server({ failTrash: true });
  const payload = { ...valid, requestId: 'cleanup-failure-123456789', plaque: 'ABC' };
  service.post(payload); service.run();
  assert.equal(service.mails.length, 1);
  assert.equal(service.pending().length, 1);
  assert.equal(service.get(payload.requestId).state, 'sent');
  service.state.failTrash = false; service.run();
  assert.equal(service.pending().length, 0);
  assert.equal(service.mails.length, 1);
});

test('worker preserves documents if an attachment is missing or queue folder is shared', () => {
  const service = server({ quota: 0 });
  const payload = { ...valid, requestId: 'missing-attachment-123456789', plaque: 'ABC' };
  service.post(payload);
  const item = service.job(payload.requestId).files[0];
  service.files.get(item.id).setTrashed(true); service.state.quota = 10;
  service.advance(3600001); service.run();
  assert.equal(service.mails.length, 0);
  assert.match(service.job(payload.requestId).lastError, /manquante/);
  service.state.shared = true;
  assert.throws(() => service.run(), /privé/);
  assert.equal(service.pending().length, 1);
});

test('client acknowledges only durable server copies and does not require the phone for retry', async () => {
  for (const receipt of ['queued', 'retry', 'sending']) {
    const result = await browser({ type: 'ambulance', receipt, stored: true, photos: [photo] });
    assert.match(result.elements.actionStatus.textContent, /enregistrés sur Drive/);
    assert.match(result.elements.actionStatus.textContent, /pouvez fermer/);
    assert.equal([...result.records.values()][0].serverAccepted, true);
    assert.equal([...result.records.values()][0].photos.length, 1);
    assert.equal(result.records.size, 1, 'copie locale conservée jusqu’au mail confirmé');
  }
  const incomplete = await browser({ receipt: 'queued', stored: false });
  assert.doesNotMatch(incomplete.elements.actionStatus.textContent, /pouvez fermer/);
  assert.equal([...incomplete.records.values()][0].serverAccepted, undefined);
  const uninstalled = await browser({ queueReady: false });
  assert.equal(uninstalled.posts, 0);
  assert.equal(uninstalled.records.size, 1);
  assert.match(uninstalled.elements.actionStatus.textContent, /installerFileEnvoi/);
});

test('client signals manual review while retaining local and server copies', async () => {
  const result = await browser({ receipt: 'review', stored: true });
  assert.match(result.elements.actionStatus.textContent, /envoi incertain/);
  assert.equal([...result.records.values()][0].serverState, 'review');
  assert.equal(result.records.size, 1);
});


test('daily cap queues documents and resumes on the next Brussels day', () => {
  const service = server({ count: 30 });
  const payload = { ...valid, requestId: 'next-day-retry-123456789', plaque: 'ABC' };
  service.post(payload);
  assert.equal(service.mails.length, 0);
  assert.equal(service.job(payload.requestId).state, 'retry');
  service.advance(86400001); service.run();
  assert.equal(service.mails.length, 1);
  assert.equal(JSON.parse(service.properties.get('CHECKLIST_SEND_COUNTER')).count, 1);
  assert.equal(service.pending().length, 0);
});

test('client may start another checklist after Drive acknowledgement without overwriting the first backup', async () => {
  const result = await browser({ type: 'ambulance', receipt: 'queued', stored: true, photos: [photo] });
  const firstId = [...result.records.keys()][0];
  await result.context.window.ChecklistMailer.run({ action: 'send', type: 'ambulance',
    buildPdf: async () => ({ output: () => ({ size: 5, arrayBuffer: async () => Uint8Array.from([37,80,68,70,45]).buffer }) }) });
  assert.equal(result.records.size, 2);
  assert.equal(result.records.has(firstId), true);
  assert.equal([...result.records.values()].every(record => record.serverAccepted === true), true);
});

test('queue capacity rejects new uploads without deleting any existing incomplete or failed backups', () => {
  const service = server({ quota: 0 });
  const root = service.folders.get(service.properties.get('CRBO_MAIL_QUEUE_ROOT'));
  for (let i = 0; i < 60; i++) root.createFolder('existing-' + i);
  const payload = { ...valid, requestId: 'full-queue-test-123456789', plaque: 'ABC' };
  assert.equal(service.post(payload).ok, false);
  assert.equal(service.pending().length, 60);
  assert.equal(service.get(payload.requestId).stored, false);
  assert.equal(service.mails.length, 0);
});
