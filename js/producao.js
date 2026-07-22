// ============================================================
// Módulo: Produção
// Calcula a produtividade real (unidade/dia) de cada tarefa do
// Planejamento, cruzando:
//  - t.quantidade / t.unidade      → total da tarefa (vínculo com
//    Levantamento ou digitado manualmente aqui mesmo)
//  - t.percentualConcluido         → % atual
//  - obras/{id}/historicoExecucao  → snapshots diários gravados
//    automaticamente pelo Database.criar/atualizar. O primeiro
//    snapshot com percentualConcluido de uma tarefa marca o
//    "início real" da execução dela.
//  - t.equipeAlocada                → nº de pessoas (editável aqui
//    e também em Planejamento — mesmo campo)
//
// Fórmula (folha):
//   qtdProduzida = quantidade × (%atual - %inicial)/100
//   dias         = hoje - data do 1º snapshot (mín. 1)
//   produção     = qtdProduzida / dias
//   produção/pessoa = produção / equipeAlocada
//
// Agregação (tarefa-pai): soma a qtdProduzida de todas as folhas
// descendentes que tenham a MESMA unidade, e divide pelos dias
// corridos desde o início real mais antigo entre elas — nunca faz
// média das taxas dos filhos (soma throughput real, não médias).
// Se os filhos tiverem unidades diferentes, mostra "—" (unidades
// mistas não são somáveis).
//
// Se a tarefa não tem quantidade nem vínculo com Levantamento,
// permite digitar a quantidade manualmente aqui mesmo (grava em
// t.quantidade/t.unidade/t.fonteQuantidade='manual' — mesmos campos
// que o Planejamento usa).
// ============================================================

const Producao = (() => {
  const COL = 'tarefas';
  let tarefas = [], historico = [], recolhidos = new Set();
  let _editandoCelula = false;
  const _cachePrimeiroRegistro = new Map();

  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    await carregar();
  }

  async function carregar() {
    const obraId = Router.getObraId();
    const container = document.getElementById('modulo-content');
    if (!obraId) {
      if (container) container.innerHTML = `<div class="estado-vazio"><div class="icone">⚙️</div><p>Selecione uma obra para acessar a Produção.</p></div>`;
      return;
    }
    if (container) container.innerHTML = `<div class="estado-vazio"><div class="icone">⚙️</div><p>Carregando...</p></div>`;
    [tarefas, historico] = await Promise.all([
      Database.listar(obraId, COL, 'ordem').catch(() => []),
      Database.listar(obraId, 'historicoExecucao', 'data', 'asc').catch(() => [])
    ]);
    _cachePrimeiroRegistro.clear();
    render();
  }

  // ---- Busca o primeiro dia (mais antigo) em que a tarefa tem um
  // snapshot real de percentualConcluido. Cacheado por tarefa. ----
  function _primeiroRegistro(tarefaId) {
    if (_cachePrimeiroRegistro.has(tarefaId)) return _cachePrimeiroRegistro.get(tarefaId);
    let res = null;
    for (const dia of historico) {
      const reg = dia.tarefas && dia.tarefas[tarefaId];
      if (reg && reg.percentualConcluido != null) {
        res = { data: dia.data, perc: parseFloat(reg.percentualConcluido) || 0 };
        break;
      }
    }
    _cachePrimeiroRegistro.set(tarefaId, res);
    return res;
  }

  function _diasCorridos(dataInicioISO) {
    const d1 = new Date(dataInicioISO + 'T00:00:00'), d2 = new Date();
    return Math.max(1, Math.ceil((d2 - d1) / 864e5));
  }

  // ---- Cálculo de produção de uma tarefa-folha ----
  function _calcFolha(t) {
    const qtd = parseFloat(t.quantidade) || 0;
    if (!qtd) return null;
    const percAtual = parseFloat(t.percentualConcluido) || 0;
    const primeiro = _primeiroRegistro(t.id);
    let dataInicio, percInicial, estimado = false;
    if (primeiro) {
      dataInicio = primeiro.data; percInicial = primeiro.perc;
    } else if (t.inicioPlanejado) {
      dataInicio = t.inicioPlanejado; percInicial = 0; estimado = true;
    } else {
      return null;
    }
    const qtdProduzida = qtd * Math.max(0, percAtual - percInicial) / 100;
    const dias = _diasCorridos(dataInicio);
    const producao = qtdProduzida / dias;
    const equipe = parseInt(t.equipeAlocada) || 0;
    const producaoPorPessoa = equipe > 0 ? producao / equipe : null;
    return { qtdProduzida, dias, producao, producaoPorPessoa, estimado, dataInicio, unidade: t.unidade || '' };
  }

  // ---- Cálculo agregado para tarefa-pai (soma folhas de mesma unidade) ----
  function _calcPai(t, fam) {
    const folhas = fam.descendentes(t).filter(d => fam.filhosDiretos(d).length === 0);
    const comCalc = folhas.map(d => ({ d, c: _calcFolha(d) })).filter(x => x.c);
    if (!comCalc.length) return null;
    const porUnidade = {};
    comCalc.forEach(({ c }) => {
      const u = c.unidade || 'un';
      porUnidade[u] = porUnidade[u] || { qtdProduzida: 0, dataMin: null, estimado: false };
      porUnidade[u].qtdProduzida += c.qtdProduzida;
      if (!porUnidade[u].dataMin || c.dataInicio < porUnidade[u].dataMin) porUnidade[u].dataMin = c.dataInicio;
      if (c.estimado) porUnidade[u].estimado = true;
    });
    const unidades = Object.keys(porUnidade);
    if (unidades.length !== 1) return { multiUnidade: true, unidades };
    const u = unidades[0], agg = porUnidade[u];
    const dias = _diasCorridos(agg.dataMin);
    const producao = agg.qtdProduzida / dias;
    const equipeSoma = comCalc.reduce((s, { d }) => s + (parseInt(d.equipeAlocada) || 0), 0);
    const producaoPorPessoa = equipeSoma > 0 ? producao / equipeSoma : null;
    return { qtdProduzida: agg.qtdProduzida, dias, producao, producaoPorPessoa, unidade: u, estimado: agg.estimado, equipeSoma };
  }

  function _fd(d) { if (!d) return '—'; try { return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR'); } catch (e) { return d; } }
  function _fNum(n) { return Utils.formatarNumero ? Utils.formatarNumero(n) : Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function _fPerc(n) { return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'; }

  function render() {
    const container = document.getElementById('modulo-content');
    if (!container) return;
    if (!tarefas.length) {
      container.innerHTML = `<div class="estado-vazio"><div class="icone">⚙️</div><p>Nenhuma tarefa cadastrada no Planejamento ainda.</p></div>`;
      return;
    }
    const fam = Utils.percFamilia(tarefas);
    const sorted = fam.sorted;

    let linhas = '';
    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i];
      const ehPai = fam.filhosDiretos(t).length > 0;
      if (_estaEscondida(t, sorted, i)) continue;
      const calc = ehPai ? _calcPai(t, fam) : _calcFolha(t);
      linhas += _linhaHtml(t, ehPai, calc, fam);
    }

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Produção</h2>
          <span class="subtitulo">Produtividade real por tarefa — cruza Planejamento (% e equipe) com o total do Levantamento</span>
        </div>
      </div>
      <div class="tabela-container">
        <table class="tabela tabela-compacta">
          <thead>
            <tr>
              <th style="min-width:260px;">Tarefa</th>
              <th class="col-num">Total</th>
              <th class="col-num">% Concl.</th>
              <th class="col-num">Qtd. Produzida</th>
              <th class="col-num">Dias</th>
              <th class="col-num">Produção</th>
              <th class="col-centro">Equipe</th>
              <th class="col-num">Prod./Pessoa</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>`;
  }

  // Esconde linha se algum ancestral está recolhido
  function _estaEscondida(t, sorted, idx) {
    let nivel = t.nivel || 0;
    for (let i = idx - 1; i >= 0; i--) {
      const anterior = sorted[i];
      const nivelAnt = anterior.nivel || 0;
      if (nivelAnt < nivel) {
        if (recolhidos.has(anterior.id)) return true;
        nivel = nivelAnt;
        if (nivel === 0) break;
      }
    }
    return false;
  }

  function _linhaHtml(t, ehPai, calc, fam) {
    const indent = (t.nivel || 0) * 18;
    const toggle = ehPai
      ? `<span onclick="Producao.toggle('${t.id}')" style="cursor:pointer;display:inline-block;width:14px;">${recolhidos.has(t.id) ? '▶' : '▼'}</span>`
      : `<span style="display:inline-block;width:14px;"></span>`;
    const nomeStyle = ehPai ? 'font-weight:700;' : '';

    const vinc = t.fonteQuantidade === 'levantamento';
    let totalCel;
    if (ehPai) {
      // Total do pai = soma das quantidades das folhas descendentes com a mesma unidade
      const folhas = fam.descendentes(t).filter(d => fam.filhosDiretos(d).length === 0 && parseFloat(d.quantidade) > 0);
      const unidades = [...new Set(folhas.map(d => d.unidade || 'un'))];
      if (unidades.length === 1 && folhas.length) {
        const total = folhas.reduce((s, d) => s + (parseFloat(d.quantidade) || 0), 0);
        totalCel = `${_fNum(total)} ${unidades[0]}`;
      } else if (unidades.length > 1) {
        totalCel = `<span title="Unidades diferentes entre os filhos (${unidades.join(', ')})" style="color:#999;">— unid. mistas</span>`;
      } else {
        totalCel = '—';
      }
    } else {
      totalCel = t.quantidade
        ? `<span style="${vinc ? 'color:var(--cor-primaria);' : ''}" title="${vinc ? 'Vinculado ao Levantamento' : 'Manual'}">${vinc ? '🔗 ' : ''}${_fNum(t.quantidade)} ${t.unidade || ''}</span>`
        : `<span onclick="Producao.editarQtd('${t.id}')" style="cursor:pointer;color:#999;text-decoration:underline dotted;">+ digitar quantidade</span>`;
    }

    const percCel = _fPerc(t.percentualConcluido || 0);

    const qtdProdCel = calc && !calc.multiUnidade ? `${_fNum(calc.qtdProduzida)} ${calc.unidade || ''}` : '—';
    const diasCel = calc && !calc.multiUnidade ? `${calc.dias}${calc.estimado ? ' <span title="Sem histórico diário para esta tarefa — dias estimados a partir do Início Planejado, não da execução real." style="color:#c99;">≈</span>' : ''}` : '—';
    const prodCel = calc && !calc.multiUnidade ? `<b>${_fNum(calc.producao)}</b> ${calc.unidade || ''}/dia` : '—';

    const equipe = parseInt(t.equipeAlocada) || 0;
    const equipeCel = ehPai
      ? (calc && !calc.multiUnidade && calc.equipeSoma ? `${calc.equipeSoma} 👷` : '—')
      : `<span onclick="Producao.editarEquipe('${t.id}')" style="cursor:pointer;text-decoration:underline dotted;">${equipe ? equipe + ' 👷' : '—'}</span>`;

    const prodPessoaCel = calc && !calc.multiUnidade && calc.producaoPorPessoa != null ? `${_fNum(calc.producaoPorPessoa)} ${calc.unidade || ''}/dia/pessoa` : '—';

    return `<tr data-id="${t.id}">
      <td style="padding-left:${14 + indent}px;">${toggle}<span style="${nomeStyle}">${t.nome || '—'}</span></td>
      <td class="col-num" data-cel="total">${totalCel}</td>
      <td class="col-num">${percCel}</td>
      <td class="col-num">${qtdProdCel}</td>
      <td class="col-num">${diasCel}</td>
      <td class="col-num">${prodCel}</td>
      <td class="col-centro" data-cel="equipe">${equipeCel}</td>
      <td class="col-num">${prodPessoaCel}</td>
    </tr>`;
  }

  function toggle(id) {
    if (recolhidos.has(id)) recolhidos.delete(id); else recolhidos.add(id);
    render();
  }

  // ---- Edição inline: quantidade manual (tarefa sem vínculo) ----
  function editarQtd(id) {
    const t = tarefas.find(x => x.id === id); if (!t) return;
    const tr = document.querySelector(`tr[data-id="${id}"] td[data-cel="total"]`); if (!tr) return;
    _editandoCelula = true;
    tr.innerHTML = `<input id="_prodQtdInput" type="number" min="0" step="any" style="width:80px;height:26px;border:2px solid var(--cor-primaria);padding:0 4px;font-size:.78rem;" value="${t.quantidade || ''}">
      <input id="_prodUnidInput" type="text" placeholder="un." style="width:50px;height:26px;border:2px solid var(--cor-primaria);padding:0 4px;font-size:.78rem;" value="${t.unidade || ''}">`;
    const qtdInput = document.getElementById('_prodQtdInput'), unidInput = document.getElementById('_prodUnidInput');
    qtdInput.focus(); qtdInput.select();
    let saved = false;
    const salvar = async () => {
      if (saved) return; saved = true; _editandoCelula = false;
      const v = parseFloat(qtdInput.value) || 0, u = unidInput.value.trim();
      const obraId = Router.getObraId();
      t.quantidade = v; t.unidade = u; t.fonteQuantidade = 'manual';
      render();
      await Database.atualizar(obraId, COL, id, { quantidade: v, unidade: u, fonteQuantidade: 'manual' }).catch(console.error);
    };
    [qtdInput, unidInput].forEach(inp => {
      inp.addEventListener('blur', () => setTimeout(salvar, 120));
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') salvar(); });
    });
  }

  // ---- Edição inline: equipe alocada (mesmo campo do Planejamento) ----
  function editarEquipe(id) {
    const t = tarefas.find(x => x.id === id); if (!t) return;
    const td = document.querySelector(`tr[data-id="${id}"] td[data-cel="equipe"]`); if (!td) return;
    _editandoCelula = true;
    td.innerHTML = `<input id="_prodEquipeInput" type="number" min="0" step="1" style="width:56px;height:26px;border:2px solid var(--cor-primaria);padding:0 4px;font-size:.78rem;text-align:center;" value="${t.equipeAlocada || ''}">`;
    const input = document.getElementById('_prodEquipeInput');
    input.focus(); input.select();
    let saved = false;
    const salvar = async () => {
      if (saved) return; saved = true; _editandoCelula = false;
      const v = parseInt(input.value) || 0;
      const obraId = Router.getObraId();
      t.equipeAlocada = v;
      render();
      await Database.atualizar(obraId, COL, id, { equipeAlocada: v }).catch(console.error);
    };
    input.addEventListener('blur', () => setTimeout(salvar, 120));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') salvar(); });
  }

  return { init, carregar, toggle, editarQtd, editarEquipe };
})();

function onObraChanged() { Producao.carregar(); }
