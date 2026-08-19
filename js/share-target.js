// ============================================
// ShareTarget — recebe o PDF compartilhado (ex: Samsung Notes)
// via PWA share_target. Antes de processar, pergunta o destino
// (Relatório de obra OU Tarefa do To Do List) e processa com a IA
// de acordo com a escolha.
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
  function _mostrarAcoes(href, label) {
    const el = document.getElementById('share-acoes');
    if (!el) return;
    if (href) {
      const link = el.querySelector('a');
      if (link) { link.href = href; link.textContent = label || link.textContent; }
    }
    el.style.display = 'block';
  }
  function _falhar(msg) {
    _icone('⚠');
    _titulo('Não deu certo');
    _status(msg);
  }
  function _esconderEscolha() {
    const el = document.getElementById('share-escolha');
    if (el) el.style.display = 'none';
  }
  function _mostrarEscolha() {
    const el = document.getElementById('share-escolha');
    if (el) el.style.display = 'flex';
  }

  // Paleta simples só pra colorir categoria nova criada automaticamente
  // pela IA (mesmo espírito da paleta de todo.js, sem duplicar o arquivo).
  const CORES_CATEGORIA = ['#F5C800', '#2563eb', '#16a34a', '#7c3aed', '#d97706', '#dc2626', '#0891b2', '#db2777', '#059669', '#4f46e5', '#ea580c', '#64748b'];
  function _corParaCategoria(nome) {
    let hash = 0;
    for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) >>> 0;
    return CORES_CATEGORIA[hash % CORES_CATEGORIA.length];
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

      _icone('📋');
      _titulo('O que é essa nota?');
      _status('Escolha pra onde mandar esse PDF.');
      _mostrarEscolha();

      const btnRelatorio = document.getElementById('share-btn-relatorio');
      const btnTarefa = document.getElementById('share-btn-tarefa');
      if (btnRelatorio) btnRelatorio.onclick = () => _processarRelatorio(shareId, registro);
      if (btnTarefa) btnTarefa.onclick = () => _processarTarefas(shareId, registro);
    } catch (e) {
      console.error(e);
      _falhar(e.message || 'Erro ao localizar o arquivo compartilhado.');
    }
  }

  async function _processarRelatorio(shareId, registro) {
    _esconderEscolha();
    try {
      _icone('📥');
      _titulo('Recebendo relatório...');
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
      _mostrarAcoes('relatorios.html?aba=pendentes', 'Ver em Relatórios → Pendentes');
    } catch (e) {
      console.error(e);
      _falhar(e.message || 'Erro ao processar o relatório.');
    }
  }

  async function _processarTarefas(shareId, registro) {
    _esconderEscolha();
    try {
      _icone('✅');
      _titulo('Recebendo tarefa(s)...');
      _status('Verificando categorias existentes...');
      const pdfBase64 = await _blobParaBase64(registro.blob);

      const categoriasAtuais = await Database.listarRaiz('todoCategorias').catch(() => []);
      const nomesCategorias = categoriasAtuais.map((c) => c.nome);

      _status('A IA está lendo a nota...');
      const resp = await fetch('/api/extrair-tarefas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64, mediaType: 'application/pdf', categoriasExistentes: nomesCategorias }),
      });
      const resultado = await resp.json();
      if (!resultado.ok) throw new Error(resultado.error || 'Erro ao extrair tarefas.');

      const itens = (resultado.data && resultado.data.tarefas) || [];
      if (itens.length === 0) {
        _falhar('A IA não encontrou nenhuma tarefa nessa nota.');
        return;
      }

      _status('Salvando tarefa(s)...');
      const existentes = await Database.listarRaiz('tarefasSistema', 'ordem', 'desc');
      let ordem = existentes.length ? (existentes[0].ordem || 0) + 1 : 1;
      const categoriasLocais = categoriasAtuais.slice();

      for (const item of itens) {
        if (!item.titulo) continue;

        let categoriaFinal = '';
        if (item.categoria) {
          const jaExiste = categoriasLocais.find((c) => c.nome.toLowerCase() === item.categoria.toLowerCase());
          if (jaExiste) {
            categoriaFinal = jaExiste.nome;
          } else {
            const cor = _corParaCategoria(item.categoria);
            const idCat = await Database.criarRaiz('todoCategorias', { nome: item.categoria, cor, importancia: 3 });
            categoriasLocais.push({ id: idCat, nome: item.categoria, cor, importancia: 3 });
            categoriaFinal = item.categoria;
          }
        }

        await Database.criarRaiz('tarefasSistema', {
          texto: item.titulo,
          descricao: item.descricao || '',
          projeto: item.projeto || '',
          categoria: categoriaFinal,
          dependencia: '',
          concluida: false,
          ordem,
          importancia: 3,
        });
        ordem++;
      }

      _apagarArquivo(shareId);

      _icone('✅');
      _titulo(itens.length === 1 ? 'Tarefa criada!' : `${itens.length} tarefas criadas!`);
      _status('Já entraram no To Do List, com título, descrição e categoria organizados pela IA.');
      _mostrarAcoes('todo.html', 'Ver em Tarefas do Sistema');
    } catch (e) {
      console.error(e);
      _falhar(e.message || 'Erro ao processar as tarefas.');
    }
  }

  return { init };
})();
