// ============================================
// Service Worker — Absoluta Engenharia
// Único propósito por enquanto: interceptar o compartilhamento de
// arquivo (share_target) vindo de outros apps (ex: Samsung Notes),
// guardar o PDF temporariamente e redirecionar pra tela que processa.
// ============================================

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname === '/share-target/') {
    event.respondWith(_tratarCompartilhamento(event.request));
  }
  // Todo o resto passa direto pro servidor (sem cache offline por enquanto)
});

async function _tratarCompartilhamento(request) {
  try {
    const formData = await request.formData();
    const arquivo = formData.get('arquivo');

    const shareId = 'share_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

    if (arquivo) {
      await _salvarArquivo(shareId, arquivo);
      return Response.redirect(`/share-target.html?share_id=${shareId}`, 303);
    }
    return Response.redirect('/share-target.html?erro=1', 303);
  } catch (e) {
    return Response.redirect('/share-target.html?erro=1', 303);
  }
}

function _abrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('absoluta-share', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('arquivos'); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function _salvarArquivo(id, file) {
  const db = await _abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('arquivos', 'readwrite');
    tx.objectStore('arquivos').put({ blob: file, nome: file.name, tipo: file.type, criadoEm: Date.now() }, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
