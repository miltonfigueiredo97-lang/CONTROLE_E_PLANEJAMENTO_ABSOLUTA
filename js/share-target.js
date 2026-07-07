// ============================================
// ShareTarget — recebe o PDF compartilhado (ex: Samsung Notes)
// via PWA share_target, processa com a IA e salva como relatório
// pendente (sem obra atribuída ainda).
// ============================================
const ShareTarget = (() => {
  function _status(msg) {
    const el = document.getElementById('share-status');
    if (el) el.textContent = msg;
  }
  function _titulo(msg) {
    const el = document.getElementById('share-titulo');
    if (el) el.textContent = msg;
  }
  function _icone(ic) {
    const el = document.getElementById('share-icone');
    if (el) el.textContent = ic;
  }
  function _mostrarAcoes() {
    const el = document.getElementById('share-acoes');
    if (el) el.style.display = 'block';
  }
  function _falhar(msg) {
    _icone('⚠');
    _titulo('Não deu certo');
    _status(msg);
  }

  function _abrirDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('absoluta-share', 1);
      req.onupgradeneeded = () => { req.result.createObjectStore('arquivos'); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function _lerArquivo(shareId) {
    return _abrirDB().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction('arquivos', 'readonly');
      const req = tx.objectStore('arquivos').get(shareId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    }));
  }

  function _apagarArquivo(shareId) {
    _abrirDB().then((db) => {
      const tx = db.transaction('arquivos', 'readwrite');
      tx.objectStore('arquivos').delete(shareId);
    }).catch(() => {});
  }

  function _blobParaBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('share_id');
    const erro = params.get('erro');

    if (erro) {
      _falhar('Tente compartilhar novamente pelo Samsung Notes.');
      return;
    }
    if (!shareId) {
      _icone('📈');
      _titulo('Nada recebido');
      _status('Abra esta página compartilhando um PDF pelo Samsung Notes.');
      return;
    }

    if (!initFirebase()) { _falhar('Erro ao iniciar o sistema.'); return; }
    const user = await Auth.init();
    if (!user) {
      window.location.href = `login.html?redirect=${encodeURIComponent(`share-target.html?share_id=${shareId}`)}`;
      return;
    }

    try {
      _status('Localizando o arquivo compartilhado...');
      const registro = await _lerArquivo(shareId);
      if (!registro || !registro.blob) {
        _falhar('Não encontrei o arquivo compartilhado (pode ter expirado). Tente compartilhar de novo.');
        return;
      }

      _status('A IA está lendo a nota...');
      const pdfBase64 = await _blobParaBase64(registro.blob);

      const resp = await fetch('/api/gerar-relatorio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64, mediaType: 'application/pdf', obraNome: null }),
      });
      const resultado = await resp.json();
      if (!resultado.ok) throw new Error(resultado.error || 'Erro ao gerar relatório.');

      const conteudoJson = resultado.data;

      _status('Salvando relatório...');
      const novoId = Database.novoIdRaiz('relatorios');
      const path = `relatorios/${novoId}/original.pdf`;
      const ref = storage.ref(path);
      await ref.put(registro.blob, { contentType: 'application/pdf' });
      const urlPdfOriginal = await ref.getDownloadURL();

      await Database.criarRaiz('relatorios', {
        obraId: null,
        obraNome: null,
        titulo: conteudoJson.titulo || registro.nome || 'Relatório',
        dataRelatorio: conteudoJson.dataRelatorio || null,
        conteudoJson,
        urlPdfOriginal,
        urlPdfGerado: null,
      }, novoId);

      _apagarArquivo(shareId);

      _icone('✅');
      _titulo('Relatório recebido!');
      _status('Já foi organizado pela IA. Agora é só atribuir a uma obra.');
      _mostrarAcoes();
    } catch (e) {
      console.error(e);
      _falhar(e.message || 'Erro ao processar o relatório.');
    }
  }

  return { init };
})();
