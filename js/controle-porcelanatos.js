// ============================================
// Módulo: Controle de Porcelanatos (BASE — em construção)
// Objetivo final: juntar Piso + Paredes (azulejo) num só controle,
// com planilha de exportação usando a mesma "chave" de cruzamento
// (Apartamento + Local + Local-detalhe: "Piso" ou "Parede N") pra
// linkar com planilhas de outros programas.
//
// Nesta base: lê o Levantamento de Piso (pisoAreas) — a parte de
// Paredes/Azulejo entra numa próxima rodada.
//
// Dados lidos: Firestore obras/{obraId}/pisoAreas + config/pisoArvore
// Config própria: obras/{obraId}/config/porcelanatosConfig
// ============================================

const ControlePorcelanatos = (() => {
  const COL_AREAS_PISO = 'pisoAreas';
  const CONFIG_DOC_PISO = 'pisoArvore';       // fonte da árvore (Apartamento) e do % de perda legado (V3.12.0.6, dentro do módulo Piso)
  const CONFIG_DOC_PROPRIO = 'porcelanatosConfig'; // config própria deste módulo, daqui pra frente

  let obraId = null;
  let arvorePiso = [];
  let areasPiso = [];
  let config = { percentualPerda: 30 };
  let usouCacheNaUltimaCarga = false;

  function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmt2(n) { return (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function _ls(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }

  // Busca sempre tentando o SERVIDOR primeiro (evita o bug de exportar dados velhos do
  // cache local do Firestore — este app usa enablePersistence, então um .get() comum pode
  // devolver o que ficou salvo no navegador antes da última sincronização). Só cai pro
  // cache se estiver genuinamente sem conexão, e avisa na tela quando isso acontece.
  async function _getServerFirst(ref) {
    try {
      return await ref.get({ source: 'server' });
    } catch (e) {
      console.warn('Sem conexão com o servidor — usando cache local (pode estar desatualizado):', e.message);
      usouCacheNaUltimaCarga = true;
      try { return await ref.get({ source: 'cache' }); } catch (e2) { return await ref.get(); }
    }
  }

  function _acharNode(id, nodes = arvorePiso, parent = null) {
    for (const n of nodes) {
      if (n.id === id) return { node: n, parent, lista: nodes };
      const r = _acharNode(id, n.filhos || [], n);
      if (r) return r;
    }
    return null;
  }

  // Convenção esperada no campo "Tipo de Piso": "Nome do Piso - AxB" (ex: "Porcelanato Alta Mountain - 90x90").
  // Separa nome limpo (pra coluna Tipo) e dimensão (pra coluna Dimensões) na exportação.
  // Registros antigos sem esse padrão (ex: só "Porcelanato 1") voltam com dimensão vazia — não tem como adivinhar.
  function _separarTipoEDimensao(tipoPiso) {
    const texto = String(tipoPiso || '').trim();
    const m = texto.match(/^(.*?)\s*-\s*([\d]+(?:[.,]\d+)?\s*[xX]\s*[\d]+(?:[.,]\d+)?)\s*$/);
    if (m) return { tipo: m[1].trim(), dimensao: m[2].replace(/\s+/g, '') };
    return { tipo: texto, dimensao: '' };
  }

  // ══════════════════════════════════════════
  // INIT / CARREGAMENTO
  // ══════════════════════════════════════════
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    obraId = Router.getObraId();
    if (!obraId) {
      document.getElementById('cp-content').innerHTML =
        `<div class="estado-vazio"><div class="icone">🧱</div><p>Selecione uma obra para acessar o controle de porcelanatos.</p></div>`;
      return;
    }
    await carregar();
  }

  async function carregar() {
    Utils.mostrarLoading('Carregando dados (do servidor)...');
    usouCacheNaUltimaCarga = false;
    try {
      const refCfgProprio = db.collection('obras').doc(obraId).collection('config').doc(CONFIG_DOC_PROPRIO);
      const refCfgPiso = db.collection('obras').doc(obraId).collection('config').doc(CONFIG_DOC_PISO);
      const refAreasPiso = db.collection('obras').doc(obraId).collection(COL_AREAS_PISO);

      const [cfgProprioSnap, cfgPisoSnap, areasSnap] = await Promise.all([
        _getServerFirst(refCfgProprio),
        _getServerFirst(refCfgPiso),
        _getServerFirst(refAreasPiso),
      ]);

      arvorePiso = (cfgPisoSnap.exists && Array.isArray(cfgPisoSnap.data().arvore)) ? cfgPisoSnap.data().arvore : [];
      // % de perda: usa o valor já configurado aqui; se ainda não existir, herda o legado salvo
      // dentro do módulo Piso (V3.12.0.6) uma única vez, como valor inicial.
      if (cfgProprioSnap.exists && typeof cfgProprioSnap.data().percentualPerda === 'number') {
        config.percentualPerda = cfgProprioSnap.data().percentualPerda;
      } else if (cfgPisoSnap.exists && typeof cfgPisoSnap.data().percentualPerda === 'number') {
        config.percentualPerda = cfgPisoSnap.data().percentualPerda;
      } else {
        config.percentualPerda = 30;
      }
      areasPiso = areasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      renderizar();
      if (usouCacheNaUltimaCarga) Utils.toast('Sem conexão com o servidor agora — mostrando dados do cache local (podem estar desatualizados).', 'alerta');
    } catch (e) {
      console.error('Erro ao carregar Controle de Porcelanatos:', e);
      Utils.toast('Erro ao carregar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function recarregar() { await carregar(); Utils.toast('Recarregado do servidor!', 'sucesso'); }

  // ══════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════
  function renderizar() {
    const actions = document.getElementById('cp-header-actions');
    if (actions) actions.innerHTML = `
      <button class="btn btn-secundario btn-sm" onclick="ControlePorcelanatos.recarregar()" title="Buscar de novo do servidor (ignora cache local)">🔄 Recarregar</button>
      <button class="btn btn-secundario btn-sm" data-perm="controlePorcelanatos:editar" onclick="ControlePorcelanatos.abrirConfig()" title="Configurar % de perda usado na planilha">⚙️ Config</button>
      <button class="btn btn-primario btn-sm" data-perm="controlePorcelanatos:exportar" onclick="ControlePorcelanatos.exportarPlanilha()">📊 Exportar Planilha</button>
    `;

    const el = document.getElementById('cp-content');
    if (!el) return;

    const linhas = areasPiso.map(a => {
      const r = _acharNode(a.nodeId);
      const apartamento = r ? r.node.nome : '(local removido)';
      const { tipo, dimensao } = _separarTipoEDimensao(a.tipoPiso);
      return { apartamento, local: a.nome || '', tipo, dimensao, m2: a.areaM2 || 0 };
    }).sort((x, y) => x.apartamento.localeCompare(y.apartamento, 'pt-BR') || x.local.localeCompare(y.local, 'pt-BR'));

    const apartamentosDistintos = new Set(linhas.map(l => l.apartamento)).size;
    const totalM2 = linhas.reduce((s, l) => s + l.m2, 0);

    el.innerHTML = `
      <div class="page-header">
        <div>
          <h2>🧱 Controle de Porcelanatos</h2>
          <span class="subtitulo">${linhas.length} área(s) de piso · ${apartamentosDistintos} apartamento(s)/local(is) · ${fmt2(totalM2)} m²</span>
        </div>
      </div>

      <div class="lp-toolbar" style="margin-bottom:12px;">
        <span class="info">🚧 Base em construção — hoje só traz o Levantamento de Piso. A parte de Paredes/Azulejo entra numa próxima etapa, juntando os dois num controle só.</span>
      </div>

      ${linhas.length === 0 ? `
        <div class="estado-vazio"><div class="icone">🧱</div><p>Nenhuma área de piso encontrada. Meça alguma coisa no Levantamento de Piso primeiro.</p></div>
      ` : `
        <div class="tabela-wrap">
          <table class="tabela">
            <thead>
              <tr>
                <th>Apartamento</th>
                <th>Local</th>
                <th>Local (Nº Parede ou Piso)</th>
                <th>Tipo de Piso</th>
                <th>Dimensões</th>
                <th>M²</th>
                <th>M² com perda de ${config.percentualPerda}%</th>
              </tr>
            </thead>
            <tbody>
              ${linhas.map(l => `
                <tr>
                  <td>${esc(l.apartamento)}</td>
                  <td>${esc(l.local)}</td>
                  <td>Piso</td>
                  <td>${esc(l.tipo)}</td>
                  <td>${esc(l.dimensao)}</td>
                  <td>${fmt2(l.m2)}</td>
                  <td>${fmt2(l.m2 * (1 + config.percentualPerda / 100))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;
    Permissions.aplicarNaTela();
  }

  // ══════════════════════════════════════════
  // CONFIGURAÇÃO — % de perda usado no "M² com perda" da planilha exportada
  // ══════════════════════════════════════════
  function abrirConfig() {
    if (!Permissions.pode('controlePorcelanatos', 'editar')) { Utils.toast('Sem permissão para editar configurações.', 'alerta'); return; }
    document.getElementById('cp-config-percentual-perda').value = config.percentualPerda;
    Utils.abrirModal('modal-cp-config');
  }

  async function salvarConfig() {
    if (!Permissions.pode('controlePorcelanatos', 'editar')) { Utils.toast('Sem permissão para editar configurações.', 'alerta'); return; }
    const valor = Utils.parseNum(document.getElementById('cp-config-percentual-perda').value);
    if (valor < 0 || valor > 100) { Utils.toast('Informe um percentual entre 0 e 100.', 'alerta'); return; }
    try {
      Utils.mostrarLoading('Salvando configuração...');
      await db.collection('obras').doc(obraId).collection('config').doc(CONFIG_DOC_PROPRIO).set({ percentualPerda: valor }, { merge: true });
      config.percentualPerda = valor;
      Utils.fecharModal('modal-cp-config');
      Utils.toast('Configuração salva!', 'sucesso');
      renderizar();
    } catch (e) {
      console.error('Erro ao salvar configuração:', e);
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // EXPORTAR PLANILHA (XLSX) — uma linha por área, com colunas pensadas pra
  // linkar/combinar com planilhas de outros programas ou outros levantamentos
  // (Apartamento + Local + Local-detalhe formam a "chave" de cruzamento).
  // Sempre busca do servidor de novo antes de exportar — mesmo motivo do
  // _getServerFirst: exportar do cache local pode sair incompleto/desatualizado.
  // ══════════════════════════════════════════
  async function exportarPlanilha() {
    if (!Permissions.pode('controlePorcelanatos', 'exportar')) { Utils.toast('Sem permissão para exportar.', 'alerta'); return; }
    try {
      Utils.mostrarLoading('Buscando dados atualizados e gerando planilha...');
      await carregarSilencioso();
      if (!areasPiso.length) { Utils.toast('Nenhuma área medida ainda.', 'alerta'); return; }

      if (typeof XLSX === 'undefined') await _ls('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');

      const obra = Router.getObra();
      const nomeObra = (obra?.nome || 'Obra sem nome').toUpperCase();
      const dataExp = new Date().toLocaleDateString('pt-BR');
      const perda = config.percentualPerda || 0;

      const H = ['Apartamento', 'Local', 'Local (Nº Parede ou Piso)', 'Tipo de Piso', 'Dimensões do Piso', 'M²', `M² com perda de ${perda}%`];
      const rows = areasPiso.map(a => {
        const r = _acharNode(a.nodeId);
        const apartamento = r ? r.node.nome : '(local removido)';
        const { tipo, dimensao } = _separarTipoEDimensao(a.tipoPiso);
        const m2 = a.areaM2 || 0;
        const m2ComPerda = m2 * (1 + perda / 100);
        return [apartamento, a.nome || '', 'Piso', tipo, dimensao, m2, m2ComPerda];
      });
      rows.sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'pt-BR') || String(a[1]).localeCompare(String(b[1]), 'pt-BR'));

      const totalM2 = rows.reduce((s, r) => s + (r[5] || 0), 0);
      const totalM2Perda = rows.reduce((s, r) => s + (r[6] || 0), 0);
      rows.push(['', '', '', '', 'TOTAL GERAL', totalM2, totalM2Perda]);

      const ncols = H.length;
      const aoa = [[nomeObra], ['Controle de Porcelanatos — Exportado em ' + dataExp], [], H, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: ncols - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: ncols - 1 } },
      ];
      ws['!rows'] = [{ hpx: 34 }, { hpx: 20 }, { hpx: 8 }];
      if (ws['A1']) ws['A1'].s = { font: { bold: true, sz: 20 }, alignment: { horizontal: 'center', vertical: 'center' } };
      if (ws['A2']) ws['A2'].s = { font: { bold: true, sz: 12, color: { rgb: '8a6d00' } }, alignment: { horizontal: 'center' } };
      ws['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 26 }, { wch: 16 }, { wch: 12 }, { wch: 18 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Porcelanatos');
      const nomeArquivo = `controle_porcelanatos_${(obra?.nome || 'obra').replace(/[^a-z0-9]/gi, '_')}.xlsx`;
      XLSX.writeFile(wb, nomeArquivo, { cellStyles: true });
      Utils.toast(`Planilha exportada! ${rows.length - 1} área(s) em ${new Set(rows.slice(0, -1).map(r => r[0])).size} apartamento(s)/local(is).`, 'sucesso');
    } catch (e) {
      console.error('Erro ao exportar planilha:', e);
      Utils.toast('Erro ao exportar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // Mesma busca de carregar(), mas sem re-renderizar a tela (usado antes de exportar,
  // pra garantir que o arquivo saia com os dados mais atuais do servidor).
  async function carregarSilencioso() {
    const refCfgProprio = db.collection('obras').doc(obraId).collection('config').doc(CONFIG_DOC_PROPRIO);
    const refCfgPiso = db.collection('obras').doc(obraId).collection('config').doc(CONFIG_DOC_PISO);
    const refAreasPiso = db.collection('obras').doc(obraId).collection(COL_AREAS_PISO);
    const [cfgProprioSnap, cfgPisoSnap, areasSnap] = await Promise.all([
      _getServerFirst(refCfgProprio), _getServerFirst(refCfgPiso), _getServerFirst(refAreasPiso),
    ]);
    arvorePiso = (cfgPisoSnap.exists && Array.isArray(cfgPisoSnap.data().arvore)) ? cfgPisoSnap.data().arvore : [];
    if (cfgProprioSnap.exists && typeof cfgProprioSnap.data().percentualPerda === 'number') config.percentualPerda = cfgProprioSnap.data().percentualPerda;
    areasPiso = areasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  return { init, recarregar, abrirConfig, salvarConfig, exportarPlanilha };
})();

function onObraChanged() { ControlePorcelanatos.init(); }
