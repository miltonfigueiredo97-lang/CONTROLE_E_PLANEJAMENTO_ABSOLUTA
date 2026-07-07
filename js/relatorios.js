// ============================================
// Módulo: Relatórios — V2.0
// "Relatórios de Vista": importa PDF de nota (digitada ou
// manuscrita, ex: Samsung Notes) e converte via IA em relatório
// estruturado. Agora numa coleção raiz "relatorios" (não mais
// por obra), pra suportar relatórios recebidos via compartilhamento
// do Android (PWA share_target) ANTES de saber a qual obra pertencem
// — eles ficam na aba "Pendentes" até serem atribuídos a uma obra.
// ============================================
const Relatorios = (() => {
  const COL = 'relatorios';
  let obraId = null;
  let obraNome = '';
  let obrasDisponiveis = [];
  let abaAtiva = 'obra'; // 'obra' | 'pendentes'
  let listaObra = [];
  let listaPendentes = [];
  let visualizando = null;
  let arquivoSelecionado = null;

  async function init() {
    const ok = await Utils.initPagina();
    if (!ok) return;
    obraId = Router.getObraId();
    if (!obraId) {
      const c = document.getElementById('modulo-content');
      if (c) c.innerHTML = '<div class="estado-vazio"><div class="icone">📈</div><p>Selecione uma obra.</p></div>';
      return;
    }
    const obra = Router.getObra();
    obraNome = obra?.nome || '';
    visualizando = null;

    const params = new URLSearchParams(window.location.search);
    abaAtiva = params.get('aba') === 'pendentes' ? 'pendentes' : 'obra';

    try {
      obrasDisponiveis = await Database.getObras();
    } catch (e) {
      console.error(e);
      obrasDisponiveis = [];
    }

    await carregar();
  }

  async function carregar() {
    try {
      Utils.mostrarLoading('Carregando relatórios...');
      if (abaAtiva === 'obra') {
        listaObra = await Database.queryRaiz(COL, [{ field: 'obraId', op: '==', value: obraId }]).catch(() => []);
        listaObra.sort((a, b) => _tempoOrdenacao(b) - _tempoOrdenacao(a));
      } else {
        listaPendentes = await Database.queryRaiz(COL, [{ field: 'obraId', op: '==', value: null }]).catch(() => []);
        listaPendentes.sort((a, b) => _tempoOrdenacao(b) - _tempoOrdenacao(a));
      }
      renderizar();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao carregar relatórios.', 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function _tempoOrdenacao(r) {
    const c = r.createdAt;
    if (!c) return 0;
    return c.toMillis ? c.toMillis() : new Date(c).getTime();
  }

  async function trocarAba(aba) {
    if (aba === abaAtiva) return;
    abaAtiva = aba;
    visualizando = null;
    await carregar();
  }

  function _listaAtual() {
    return abaAtiva === 'obra' ? listaObra : listaPendentes;
  }

  // ====== RENDER: LISTA ======
  function renderizar() {
    const c = document.getElementById('modulo-content');
    if (!c) return;

    if (visualizando) {
      c.innerHTML = _renderVisualizacao(visualizando);
      return;
    }

    c.innerHTML = `
      <div class="page-header">
        <div><h2>Relatórios de Vista</h2>
          <span class="subtitulo">Notas de campo organizadas por IA</span></div>
        <div class="btn-grupo">
          ${abaAtiva === 'obra' ? '<button class="btn btn-primario btn-sm" onclick="Relatorios.abrirModalNovo()">+ Novo Relatório</button>' : ''}
        </div>
      </div>
      <div class="rel-tabs">
        <button class="rel-tab ${abaAtiva === 'obra' ? 'ativa' : ''}" onclick="Relatorios.trocarAba('obra')">📁 Desta Obra</button>
        <button class="rel-tab ${abaAtiva === 'pendentes' ? 'ativa' : ''}" onclick="Relatorios.trocarAba('pendentes')">📥 Pendentes${listaPendentes.length ? ` (${listaPendentes.length})` : ''}</button>
      </div>
      <div id="rel-lista">${abaAtiva === 'obra' ? _renderListaObra() : _renderListaPendentes()}</div>`;
  }

  function _renderListaObra() {
    if (!listaObra.length) {
      return `<div class="estado-vazio">
        <div class="icone">📈</div>
        <p>Nenhum relatório desta obra ainda.</p>
        <p class="text-sm text-muted">Importe o PDF de uma nota (Samsung Notes) e a IA organiza tudo pra você.</p>
        <button class="btn btn-primario" onclick="Relatorios.abrirModalNovo()">+ Novo Relatório</button>
      </div>`;
    }
    return `<div class="cards-grid">${listaObra.map(_cardRelatorio).join('')}</div>`;
  }

  function _renderListaPendentes() {
    if (!listaPendentes.length) {
      return `<div class="estado-vazio">
        <div class="icone">📥</div>
        <p>Nenhum relatório pendente.</p>
        <p class="text-sm text-muted">Relatórios recebidos por compartilhamento do celular (antes de escolher a obra) aparecem aqui.</p>
      </div>`;
    }
    return `<div class="cards-grid">${listaPendentes.map(_cardPendente).join('')}</div>`;
  }

  function _cardRelatorio(r) {
    const j = r.conteudoJson || {};
    const titulo = j.titulo || r.titulo || 'Relatório sem título';
    const dataRel = j.dataRelatorio || Utils.formatarData(r.createdAt);
    const resumo = j.resumo ? `<div class="obra-info text-sm text-muted" style="margin-top:4px;">${_escapar(j.resumo).slice(0, 140)}${j.resumo.length > 140 ? '…' : ''}</div>` : '';
    return `<div class="card relatorio-card" onclick="Relatorios.visualizar('${r.id}')">
      <div class="card-body">
        <div class="obra-nome">${_escapar(titulo)}</div>
        <div class="obra-info text-sm">📅 ${_escapar(String(dataRel))}</div>
        ${resumo}
        <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-secundario btn-sm" onclick="event.stopPropagation();Relatorios.baixarPDF('${r.id}')">⬇ Baixar</button>
          <button class="btn btn-secundario btn-sm" onclick="event.stopPropagation();Relatorios.compartilharWhatsapp('${r.id}')">📲 Compartilhar</button>
          <button class="btn btn-perigo btn-sm btn-icon" onclick="event.stopPropagation();Relatorios.excluir('${r.id}')">✕</button>
        </div>
      </div>
    </div>`;
  }

  function _cardPendente(r) {
    const j = r.conteudoJson || {};
    const titulo = j.titulo || r.titulo || 'Relatório sem título';
    const dataRel = j.dataRelatorio || Utils.formatarData(r.createdAt);
    const opcoesObra = obrasDisponiveis.map((o) => `<option value="${o.id}">${_escapar(o.nome)}</option>`).join('');
    return `<div class="card relatorio-card relatorio-pendente">
      <div class="card-body">
        <div class="obra-nome" onclick="Relatorios.visualizar('${r.id}')" style="cursor:pointer;">${_escapar(titulo)}</div>
        <div class="obra-info text-sm">📅 ${_escapar(String(dataRel))}</div>
        <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <select id="rel-sel-obra-${r.id}" class="form-control" style="max-width:220px;">
            <option value="">Atribuir à obra...</option>
            ${opcoesObra}
          </select>
          <button class="btn btn-primario btn-sm" onclick="Relatorios.atribuirObra('${r.id}')">Mover</button>
        </div>
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-secundario btn-sm" onclick="Relatorios.baixarPDF('${r.id}')">⬇ Baixar</button>
          <button class="btn btn-perigo btn-sm btn-icon" onclick="Relatorios.excluir('${r.id}')">✕</button>
        </div>
      </div>
    </div>`;
  }

  async function atribuirObra(id) {
    const sel = document.getElementById(`rel-sel-obra-${id}`);
    const novoObraId = sel ? sel.value : '';
    if (!novoObraId) { Utils.toast('Selecione uma obra primeiro.', 'erro'); return; }
    const obraEscolhida = obrasDisponiveis.find((o) => o.id === novoObraId);
    try {
      Utils.mostrarLoading('Movendo relatório...');
      await Database.atualizarRaiz(COL, id, { obraId: novoObraId, obraNome: obraEscolhida?.nome || '' });
      listaPendentes = listaPendentes.filter((r) => r.id !== id);
      Utils.toast('Relatório movido para a obra.', 'sucesso');
      renderizar();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao mover relatório.', 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ====== RENDER: VISUALIZAÇÃO FORMATADA ======
  function _renderVisualizacao(r) {
    const j = r.conteudoJson || {};
    const secoes = (j.secoes || []).map((s) => `
      <div class="rel-secao">
        <h3>${_escapar(s.titulo || 'Seção')}</h3>
        <ul>${(s.itens || []).map((it) => `<li>${_escapar(it)}</li>`).join('')}</ul>
      </div>`).join('');

    const pendencias = (j.pendencias && j.pendencias.length)
      ? `<div class="rel-secao rel-pendencias">
          <h3>⚠ Pendências</h3>
          <ul>${j.pendencias.map((p) => `<li>${_escapar(p)}</li>`).join('')}</ul>
        </div>` : '';

    const nomeObraExibir = r.obraNome || obraNome;

    return `
      <div class="page-header">
        <div><button class="btn btn-secundario btn-sm" onclick="Relatorios.fecharVisualizacao()">← Voltar</button></div>
        <div class="btn-grupo">
          <button class="btn btn-secundario btn-sm" onclick="Relatorios.baixarPDF('${r.id}')">⬇ Baixar PDF</button>
          ${r.obraId ? `<button class="btn btn-secundario btn-sm" onclick="Relatorios.compartilharWhatsapp('${r.id}')">📲 Compartilhar</button>` : ''}
        </div>
      </div>
      <div class="rel-doc" id="rel-doc-conteudo">
        <div class="rel-doc-header">
          <div class="rel-doc-marca">ABSOLUTA <span>Engenharia</span></div>
          <div class="rel-doc-titulo">${_escapar(j.titulo || r.titulo || 'Relatório')}</div>
          <div class="rel-doc-meta">
            ${nomeObraExibir ? `<span>🏗️ ${_escapar(nomeObraExibir)}</span>` : '<span>🏗️ Sem obra atribuída</span>'}
            <span>📅 ${_escapar(String(j.dataRelatorio || Utils.formatarData(r.createdAt)))}</span>
            ${j.autor ? `<span>👤 ${_escapar(j.autor)}</span>` : ''}
          </div>
        </div>
        ${j.resumo ? `<div class="rel-resumo">${_escapar(j.resumo)}</div>` : ''}
        ${secoes}
        ${pendencias}
        ${r.urlPdfOriginal ? `<div class="rel-doc-original"><a href="${r.urlPdfOriginal}" target="_blank" rel="noopener">📄 Ver nota original (PDF)</a></div>` : ''}
      </div>`;
  }

  function _escapar(txt) {
    if (txt == null) return '';
    return String(txt).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // ====== MODAL: NOVO RELATÓRIO ======
  function abrirModalNovo() {
    arquivoSelecionado = null;
    Utils.limparForm('form-rel-novo');
    const preview = document.getElementById('rel-arquivo-nome');
    if (preview) preview.textContent = 'Nenhum arquivo selecionado.';
    const btn = document.getElementById('rel-btn-gerar');
    if (btn) { btn.disabled = false; btn.textContent = '✨ Gerar Relatório'; }
    Utils.abrirModal('modal-rel-novo');
  }

  function selecionarArquivo(input) {
    const file = input.files && input.files[0];
    const preview = document.getElementById('rel-arquivo-nome');
    if (!file) {
      arquivoSelecionado = null;
      if (preview) preview.textContent = 'Nenhum arquivo selecionado.';
      return;
    }
    if (file.type !== 'application/pdf') {
      Utils.toast('Selecione um arquivo PDF.', 'erro');
      input.value = '';
      arquivoSelecionado = null;
      return;
    }
    arquivoSelecionado = file;
    if (preview) preview.textContent = `📄 ${file.name} (${(file.size/1024).toFixed(0)} KB)`;
  }

  function _lerArquivoBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function gerarRelatorio() {
    if (!arquivoSelecionado) {
      Utils.toast('Selecione o PDF da nota primeiro.', 'erro');
      return;
    }

    const btn = document.getElementById('rel-btn-gerar');
    if (btn) { btn.disabled = true; btn.textContent = 'Gerando... (a IA está lendo a nota)'; }

    try {
      const pdfBase64 = await _lerArquivoBase64(arquivoSelecionado);

      const resp = await fetch('/api/gerar-relatorio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64, mediaType: 'application/pdf', obraNome }),
      });
      const resultado = await resp.json();

      if (!resultado.ok) throw new Error(resultado.error || 'Erro ao gerar relatório.');

      const conteudoJson = resultado.data;
      if (resultado.provedor === 'anthropic') {
        Utils.toast('Gemini indisponível no momento — relatório gerado pelo Claude (fallback pago).', 'alerta', 6000);
      }

      Utils.mostrarLoading('Salvando relatório...');

      const novoId = Database.novoIdRaiz(COL);
      const pathOriginal = `relatorios/${novoId}/original.pdf`;
      const urlPdfOriginal = await _uploadArquivo(pathOriginal, arquivoSelecionado);

      const doc = {
        obraId,
        obraNome,
        titulo: conteudoJson.titulo || arquivoSelecionado.name,
        dataRelatorio: conteudoJson.dataRelatorio || null,
        conteudoJson,
        urlPdfOriginal,
        urlPdfGerado: null,
      };

      await Database.criarRaiz(COL, doc, novoId);

      Utils.fecharModal('modal-rel-novo');
      Utils.toast('Relatório gerado com sucesso!', 'sucesso');
      await carregar();
      visualizar(novoId);
    } catch (e) {
      console.error(e);
      Utils.toast(e.message || 'Erro ao gerar relatório.', 'erro');
    } finally {
      Utils.esconderLoading();
      if (btn) { btn.disabled = false; btn.textContent = '✨ Gerar Relatório'; }
    }
  }

  async function _uploadArquivo(path, file) {
    const ref = storage.ref(path);
    await ref.put(file);
    return await ref.getDownloadURL();
  }

  async function _uploadBlob(path, blob, nomeArquivo) {
    const ref = storage.ref(path);
    const metadata = {
      contentType: 'application/pdf',
      contentDisposition: `attachment; filename="${(nomeArquivo || 'relatorio.pdf').replace(/"/g, '')}"`,
    };
    await ref.put(blob, metadata);
    return await ref.getDownloadURL();
  }

  function _sanitizarNomeArquivo(txt) {
    return String(txt).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  }

  function _nomeArquivoPdf(r) {
    const j = r.conteudoJson || {};
    const dataStr = (j.dataRelatorio || Utils.formatarData(r.createdAt) || '').replace(/\//g, '-');
    const nomeObra = r.obraNome || obraNome || 'Obra';
    const partes = [nomeObra, 'Planejamento e Andamento', dataStr].filter(Boolean);
    return `${_sanitizarNomeArquivo(partes.join(' - '))}.pdf`;
  }

  // ====== VISUALIZAR / VOLTAR ======
  function _encontrarRelatorio(id) {
    return listaObra.find((x) => x.id === id) || listaPendentes.find((x) => x.id === id) || (visualizando && visualizando.id === id ? visualizando : null);
  }

  function visualizar(id) {
    const r = _encontrarRelatorio(id);
    if (!r) { Utils.toast('Relatório não encontrado.', 'erro'); return; }
    visualizando = r;
    renderizar();
  }

  function fecharVisualizacao() {
    visualizando = null;
    renderizar();
  }

  // ====== BAIXAR PDF ======
  async function baixarPDF(id) {
    const r = _encontrarRelatorio(id);
    if (!r) return;
    try {
      Utils.mostrarLoading('Gerando PDF...');
      if (typeof window.jspdf === 'undefined') {
        await _ls('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      }
      const blob = _gerarPdfBlob(r);
      const nomeArquivo = _nomeArquivoPdf(r);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nomeArquivo;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);

      if (!r.urlPdfGerado) {
        const path = `relatorios/${r.id}/gerado.pdf`;
        const urlPdfGerado = await _uploadBlob(path, blob, nomeArquivo);
        await Database.atualizarRaiz(COL, r.id, { urlPdfGerado });
        r.urlPdfGerado = urlPdfGerado;
      }
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao gerar PDF.', 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function _gerarPdfBlob(r) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const j = r.conteudoJson || {};
    const margem = 48;
    let y = margem;
    const largura = doc.internal.pageSize.getWidth() - margem * 2;

    function quebraPagina(alturaNecessaria) {
      if (y + alturaNecessaria > doc.internal.pageSize.getHeight() - margem) {
        doc.addPage();
        y = margem;
      }
    }

    doc.setFillColor(13,13,13);
    doc.rect(0,0,doc.internal.pageSize.getWidth(),70,'F');
    doc.setTextColor(245,200,0);
    doc.setFont('helvetica','bold'); doc.setFontSize(16);
    doc.text('ABSOLUTA ENGENHARIA', margem, 42);
    y = 100;

    doc.setTextColor(20,20,20);
    doc.setFont('helvetica','bold'); doc.setFontSize(18);
    const tituloLinhas = doc.splitTextToSize(j.titulo || r.titulo || 'Relatório', largura);
    doc.text(tituloLinhas, margem, y);
    y += tituloLinhas.length * 22 + 6;

    doc.setFont('helvetica','normal'); doc.setFontSize(10);
    doc.setTextColor(90,90,90);
    const nomeObraMeta = r.obraNome || obraNome;
    const meta = [
      nomeObraMeta ? `Obra: ${nomeObraMeta}` : null,
      `Data: ${j.dataRelatorio || Utils.formatarData(r.createdAt)}`,
      j.autor ? `Autor: ${j.autor}` : null,
    ].filter(Boolean).join('   |   ');
    doc.text(meta, margem, y);
    y += 20;
    doc.setDrawColor(245,200,0); doc.setLineWidth(1.5);
    doc.line(margem, y, margem+largura, y);
    y += 24;

    if (j.resumo) {
      doc.setFont('helvetica','italic'); doc.setFontSize(11); doc.setTextColor(60,60,60);
      const linhas = doc.splitTextToSize(j.resumo, largura);
      quebraPagina(linhas.length*14+10);
      doc.text(linhas, margem, y);
      y += linhas.length*14+18;
    }

    (j.secoes||[]).forEach((s) => {
      quebraPagina(30);
      doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(20,20,20);
      doc.text(s.titulo||'Seção', margem, y);
      y += 18;
      doc.setFont('helvetica','normal'); doc.setFontSize(10.5); doc.setTextColor(40,40,40);
      (s.itens||[]).forEach((item) => {
        const linhas = doc.splitTextToSize('•  ' + item, largura-10);
        quebraPagina(linhas.length*13+4);
        doc.text(linhas, margem+6, y);
        y += linhas.length*13+6;
      });
      y += 10;
    });

    if (j.pendencias && j.pendencias.length) {
      quebraPagina(30);
      doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(180,80,0);
      doc.text('⚠ Pendências', margem, y);
      y += 18;
      doc.setFont('helvetica','normal'); doc.setFontSize(10.5); doc.setTextColor(40,40,40);
      j.pendencias.forEach((p) => {
        const linhas = doc.splitTextToSize('•  ' + p, largura-10);
        quebraPagina(linhas.length*13+4);
        doc.text(linhas, margem+6, y);
        y += linhas.length*13+6;
      });
    }

    return doc.output('blob');
  }

  // ====== COMPARTILHAR WHATSAPP ======
  async function compartilharWhatsapp(id) {
    const r = _encontrarRelatorio(id);
    if (!r) return;
    try {
      Utils.mostrarLoading('Preparando arquivo para compartilhar...');
      if (typeof window.jspdf === 'undefined') {
        await _ls('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      }
      const blob = _gerarPdfBlob(r);
      const nomeArquivo = _nomeArquivoPdf(r);

      const j = r.conteudoJson || {};
      const titulo = j.titulo || r.titulo || 'Relatório';
      const resumo = j.resumo ? `\n${j.resumo}` : '';
      const nomeObraTxt = r.obraNome || obraNome;
      const textoBase = `📈 ${titulo}${nomeObraTxt ? ' — ' + nomeObraTxt : ''}${resumo}`;

      let arquivoCompartilhado = false;
      try {
        const file = new File([blob], nomeArquivo, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          Utils.esconderLoading();
          await navigator.share({ files: [file], title: titulo, text: textoBase });
          arquivoCompartilhado = true;
        }
      } catch (eShare) {
        if (eShare.name === 'AbortError') { Utils.esconderLoading(); return; }
        arquivoCompartilhado = false;
      }

      if (!r.urlPdfGerado) {
        const path = `relatorios/${r.id}/gerado.pdf`;
        const urlPdfGerado = await _uploadBlob(path, blob, nomeArquivo);
        await Database.atualizarRaiz(COL, r.id, { urlPdfGerado });
        r.urlPdfGerado = urlPdfGerado;
      }

      if (arquivoCompartilhado) return;

      Utils.esconderLoading();
      const texto = `${textoBase}\n\n📥 Baixar relatório (PDF):\n${r.urlPdfGerado}`;
      const link = `https://wa.me/?text=${encodeURIComponent(texto)}`;
      window.open(link, '_blank');
    } catch (e) {
      Utils.esconderLoading();
      console.error(e);
      Utils.toast('Erro ao preparar compartilhamento.', 'erro');
    }
  }

  // ====== EXCLUIR ======
  async function excluir(id) {
    if (!Utils.confirmar('Excluir este relatório? Essa ação não pode ser desfeita.')) return;
    const r = _encontrarRelatorio(id);
    try {
      Utils.mostrarLoading('Excluindo...');
      await Database.deletarRaiz(COL, id);
      if (r) {
        try { await storage.ref(`relatorios/${id}/original.pdf`).delete(); } catch(e) {}
        try { await storage.ref(`relatorios/${id}/gerado.pdf`).delete(); } catch(e) {}
      }
      if (visualizando && visualizando.id === id) visualizando = null;
      Utils.toast('Relatório excluído.', 'sucesso');
      await carregar();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao excluir.', 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function _ls(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  return {
    init, renderizar, trocarAba, abrirModalNovo, selecionarArquivo, gerarRelatorio,
    visualizar, fecharVisualizacao, baixarPDF, compartilharWhatsapp, excluir, atribuirObra,
  };
})();

function onObraChanged() { Relatorios.init(); }
