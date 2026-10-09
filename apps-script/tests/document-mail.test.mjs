import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const serverSource = fs.readFileSync(new URL('../Code.gs', import.meta.url), 'utf8');
const browserSource = fs.readFileSync(new URL('../../checklist-email.js', import.meta.url), 'utf8');

function server({ count = 0, quota = 100, account = 'contactoupeye@gmail.com', locked = false } = {}) {
  const mails = [], cache = new Map(), properties = new Map();
  properties.set('CHECKLIST_SEND_COUNTER', JSON.stringify({ date: '2026-10-09', count }));
  let held = false;
  const context = {
    console: { error() {} },
    LockService: { getScriptLock: () => ({
      tryLock: () => (held = !locked), hasLock: () => held, releaseLock: () => { held = false; }
    }) },
    CacheService: { getScriptCache: () => ({ get: key => cache.get(key), put: (key, value) => cache.set(key, value) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties.get(key), setProperty: (key, value) => properties.set(key, value) }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => account }) },
    Utilities: {
      formatDate: () => '2026-10-09',
      base64Decode: value => [...Buffer.from(value, 'base64')],
      newBlob: (bytes, type, name) => ({ bytes, type, name })
    },
    MailApp: { getRemainingDailyQuota: () => quota, sendEmail: mail => mails.push(mail) },
    ContentService: { MimeType: { JSON: 'JSON' }, createTextOutput: value => ({ setMimeType: () => JSON.parse(value) }) }
  };
  vm.createContext(context);
  vm.runInContext(serverSource, context);
  return {
    get: () => context.doGet(),
    post: payload => context.doPost({ postData: { contents: JSON.stringify(payload) } }),
    mails, properties, held: () => held
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
  for (const settings of [{ count: 30 }, { quota: 0 }, { locked: true }, { account: 'other@example.com' }]) {
    const service = server(settings);
    assert.equal(service.post({ ...valid, checklistType: 'tenues', demandeur: 'Kevin' }).ok, false);
    assert.equal(service.mails.length, 0);
    assert.equal(service.held(), false);
  }
  const service = server();
  assert.equal(service.post({ ...valid, website: 'bot' }).ok, true);
  assert.equal(service.mails.length, 0);
  assert.ok(service.get().supportedTypes.includes('tenues'));
});

async function browser({ type = 'tenues', name = 'Kévin Leruth', date = '2026-10-09', ready = true, networkError = false, action = 'send' } = {}) {
  const elements = {
    nom: { value: name, focus() {} }, plaque: { value: '1-ABC-234', focus() {} },
    date: { value: date, focus() {} }, actionStatus: { textContent: '' },
    pdfButton: { textContent: 'Télécharger' }, emailButton: { textContent: 'Envoyer' }
  };
  let built = 0, downloaded = 0, payload, probes = 0;
  const context = {
    document: { getElementById: id => elements[id] }, console: { error() {} },
    Uint8Array, Date, Math, Error, AbortController, setTimeout, clearTimeout,
    window: { btoa: value => Buffer.from(value, 'binary').toString('base64'), crypto: { randomUUID: () => 'test' } },
    fetch: async (url, options) => {
      if (networkError) throw new Error('Réseau indisponible');
      if (!options.method) {
        probes++;
        return { ok: true, json: async () => ready ? { ok: true, supportedTypes: ['tenues'] } : { ok: true } };
      }
      assert.equal(options.mode, 'no-cors');
      payload = JSON.parse(options.body);
      return {};
    }
  };
  vm.createContext(context);
  vm.runInContext(browserSource, context);
  await context.window.ChecklistMailer.run({
    action, type, filename: 'commande.pdf',
    buildPdf: async () => {
      built++;
      return { save: () => downloaded++, output: () => ({ size: 5, arrayBuffer: async () => Uint8Array.from([37, 80, 68, 70, 45]).buffer }) };
    }
  });
  return { built, downloaded, payload, probes, elements };
}

test('browser blocks an old server before PDF creation or POST', async () => {
  const result = await browser({ ready: false });
  assert.equal(result.built, 0);
  assert.equal(result.payload, undefined);
  assert.match(result.elements.actionStatus.textContent, /script Google doit être mis à jour/);
  assert.equal(result.elements.emailButton.disabled, false);
});

test('browser transmits a uniform order accepted by the server', async () => {
  const result = await browser();
  assert.equal(result.payload.demandeur, 'Kévin Leruth');
  assert.equal(result.payload.checklistType, 'tenues');
  assert.equal(result.payload.plaque, undefined);
  assert.equal(server().post(result.payload).ok, true);
  assert.match(result.elements.actionStatus.textContent, /transmise au service/);
  assert.equal(result.elements.emailButton.disabled, false);
  assert.equal(result.elements.emailButton.textContent, 'Envoyer');
});

test('checklists skip readiness, while downloads work without a mail service', async () => {
  for (const type of ['ambulance', 'tpmr', 'fit', 'peremption']) {
    const result = await browser({ type, ready: false });
    assert.equal(result.probes, 0);
    assert.equal(result.payload.plaque, '1-ABC-234');
    assert.equal(server().post(result.payload).ok, true);
  }
  const download = await browser({ action: 'download', networkError: true });
  assert.equal(download.downloaded, 1);
  assert.equal(download.probes, 0);
});

test('missing identity or date prevents transmission; network errors restore buttons', async () => {
  for (const settings of [{ name: '' }, { date: '' }]) {
    const result = await browser(settings);
    assert.equal(result.built, 0);
    assert.equal(result.payload, undefined);
  }
  const failure = await browser({ networkError: true });
  assert.equal(failure.payload, undefined);
  assert.equal(failure.elements.emailButton.disabled, false);
  assert.match(failure.elements.actionStatus.textContent, /Réseau indisponible/);
});
