// ============================================
// Dashboard — Resumo por Apartamento (DashResumo)
// Tabela Torre > Pavimento > Apto com quantidades (ou custo) por item de
// levantamento (Piso, Paredes, Teto). As árvores de local são independentes
// entre módulos — agrupamento por CAMINHO/NOME NORMALIZADO (ver comentários).
// ============================================
const DashResumo = (() => {
  let _ctx = null;
  let _view = 'unidade'; // 'unidade' | 'custo'
  let _dados = null;

  // Módulos de levantamento com árvore hierárquica. Espelha (subconjunto) do
  // LEVANTAMENTO_MODULOS do js/planejamento.js — sincronia manual (mesma
  // convenção de Utils.calcularFachadaM2). Se a fórmula mudar lá, replicar.
  const LEV_TREE = {
    piso: {
      label: 'Piso', configDoc: 'pisoArvore', colecao: 'pisoAreas',
      linhas: [
        { metrica: 'areaContrapiso', label: 'Contrapiso', unidade: 'm²' },
        { metrica: 'areaImperm', label: 'Impermeabilização', unidade: 'm²' },
        { metrica: 'areaM2', label: 'Revestimento de Piso', unidade: 'm²' },
        { metrica: 'mlRodape', label: 'Rodapé', unidade: 'ml' },
      ],
      valor(reg, metrica) {
        if (metrica === 'areaContrapiso') return (reg.tipoContrapiso && reg.tipoContrapiso !== '') ? (Number(reg.areaM2) || 0) : 0;
        if (metrica === 'areaImperm') return (reg.impermeabilizacao === true || reg.impermeabilizacao === 'true') ? (Number(reg.areaM2) || 0) : 0;
        if (metrica === 'areaM2') return Number(reg.areaM2) || 0;
        if (metrica === 'mlRodape') return Number(reg.mlRodape) || 0;
        return 0;
      }
    },
    paredesAlvenaria: {
      label: 'Paredes', configDoc: 'paredesArvore', colecao: 'paredesAlvenariaPecas', moduloVinculo: 'paredes',
      linhas: [
        { metrica: 'vedacao', label: 'Alvenaria de Vedação', unidade: 'm²' },
        { metrica: 'estrutural', label: 'Alvenaria Estrutural', unidade: 'm²' },
      ],
      valor(reg, metrica) {
        const c = _calcParedeBruta(reg);
        if (metrica === 'vedacao') return c.tipoAlvenaria === 'vedacao' ? c.areaLiquida : 0;
        if (metrica === 'estrutural') return c.tipoAlvenaria === 'estrutural' ? c.areaLiquida : 0;
        return 0;
      }
    },
    paredesAcabamento: {
      label: 'Paredes', configDoc: 'paredesArvore', colecao: 'paredesAcabamentoPecas', moduloVinculo: 'paredes',
      linhas: [
        { metrica: 'gesso', label: 'Gesso Liso', unidade: 'm²' },
        { metrica: 'reboco', label: 'Reboco', unidade: 'm²' },
        { metrica: 'revestimento', label: 'Revestimento de Parede', unidade: 'm²' },
        { metrica: 'pinturaParede', label: 'Pintura de Parede', unidade: 'm²' },
      ],
      valor(reg, metrica) {
        const c = _calcAcabBruta(reg);
        if (metrica === 'gesso') return c.gesso;
        if (metrica === 'reboco') return c.reboco;
        if (metrica === 'revestimento') return c.revestimento;
        if (metrica === 'pinturaParede') return c.pinturaM2;
        return 0;
      }
    },
    teto: {
      label: 'Teto / Forro', configDoc: 'tetoArvore', colecao: 'tetoAreas',
      linhas: [
        { metrica: 'areaM2', label: 'Área de Teto', unidade: 'm²' },
        { metrica: 'areaDrywall', label: 'Forro de Drywall', unidade: 'm²' },
        { metrica: 'areaGesso', label: 'Placa de Gesso', unidade: 'm²' },
        { metrica: 'mlTabica', label: 'Tabica', unidade: 'ml' },
        { metrica: 'pinturaTeto', label: 'Pintura de Teto', unidade: 'm²' },
      ],
      valor(reg, metrica) {
        if (metrica === 'areaM2') return Number(reg.areaM2) || 0;
        if (metrica === 'areaDrywall') return (reg.tipoDryWall && reg.tipoDryWall !== '') ? (Number(reg.areaM2) || 0) : 0;
        if (metrica === 'areaGesso') return (reg.tipoPlacaGesso && reg.tipoPlacaGesso !== '') ? (Number(reg.areaM2) || 0) : 0;
        if (metrica === 'mlTabica') return Number(reg.mlTabica) || 0;
        if (metrica === 'pinturaTeto') return _pinturaM2Teto(reg);
        return 0;
      }
    },
  };

  // ---- Fórmulas replicadas de planejamento.js (sincronia manual) ----
  function _calcParedeBruta(p) {
    const comp = Number(p.comprimento || 0) / 100, alt = Number(p.altura || 0) / 100;
    const areaBruta = comp * alt;
    const areaVaos = (p.vaos || []).reduce((s, v) => s + (Number(v.comprimento || 0) / 100) * (Number(v.altura || 0) / 100) * (Number(v.qtd) || 1), 0);
    return { areaLiquida: Math.max(0, areaBruta - areaVaos), tipoAlvenaria: p.tipoAlvenaria || '' };
  }
  function _calcAcabBruta(p) {
    const comp = Number(p.comprimento || 0) / 100, alt = Number(p.altura || 0) / 100;
    const areaBruta = comp * alt;
    const areaVaos = (p.vaos || []).reduce((s, v) => s + (Number(v.comprimento || 0) / 100) * (Number(v.altura || 0) / 100) * (Number(v.qtd) || 1), 0);
    const areaLiquida = Math.max(0, areaBruta - areaVaos);
    const pinturaM2 = p.temPintura ? (p.pintura || []).reduce((s, pt) => s + areaLiquida * (Number(pt.pct || 0) / 100), 0) : 0;
    const acab = { gesso: 0, reboco: 0, revestimento: 0 };
    (p.acabamentos || []).forEach(a => { if (acab[a.tipo] != null) acab[a.tipo] += areaLiquida * (Number(a.pct || 0) / 100); });
    return { areaLiquida, pinturaM2, gesso: acab.gesso, reboco: acab.reboco, revestimento: acab.revestimento };
  }
  function _pinturaM2Teto(a) {
    if (!a.temPintura || !(a.pintura || []).length) return 0;
    return (a.pintura || []).reduce((s, pt) => s + (Number(a.areaM2) || 0) * (Number(pt.pct || 0) / 100), 0);
  }

  // ---------- Render ----------
  async function render(ctx) {
    _ctx = ctx;
    const host = document.getElementById('db-resumo-apartamento');
    if (!host) return;
    host.innerHTML = '<div class="text-sm text-muted" style="padding:12px 0;">Carregando levantamentos...</div>';
    try {
      _dados = await _calcular();
      _renderTabela();
    } catch (e) {
      console.error(e);
      host.innerHTML = '<div class="db-vazio-inline">Erro ao montar o resumo por apartamento.</div>';
    }
  }

  function setView(v) {
    _view = v;
    document.querySelectorAll('#db-resumo-toggle .aba-btn').forEach(b => b.classList.toggle('ativo', b.dataset.v === v));
    _renderTabela();
  }

  async function _calcular() {
    const obraId = _ctx.obraId;
    const chaves = Object.keys(LEV_TREE);

    const resultados = await Promise.all(chaves.map(async (chave) => {
      const mod = LEV_TREE[chave];
      const [dados, cfg] = await Promise.all([
        Database.listar(obraId, mod.colecao, null).catch(() => []),
        Database.obter(obraId, 'config', mod.configDoc).catch(() => null),
      ]);
      return { chave, dados, arvore: cfg?.arvore || [] };
    }));

    const [materiaisBib, materiaisVinc, maoDeObraVinc] = await Promise.all([
      Database.listar(obraId, 'materiais', 'nome').catch(() => []),
      Database.listar(obraId, 'materiais_vinculos', 'createdAt').catch(() => []),
      Database.listar(obraId, 'maoDeObra_vinculos', 'createdAt').catch(() => []),
    ]);
    const { custoMaterialPorTarefa, custoMaoObraPorTarefa } = _calcularCustosTarefas(materiaisBib, materiaisVinc, maoDeObraVinc);

    // Árvores de local são INDEPENDENTES entre módulos — agrupamento por
    // caminho/nome NORMALIZADO ("1° Pavimento" e "1º Pavimento" caem na
    // mesma coluna). O texto exibido continua o original.
    const mapaPorModulo = {};
    Object.keys(LEV_TREE).forEach(chave => {
      const r = resultados.find(x => x.chave === chave);
      mapaPorModulo[chave] = _mapaApartamentosPorLabel(r ? r.arvore : []);
    });

    const infoPorChave = new Map();
    Object.values(mapaPorModulo).forEach(mapa => {
      mapa.forEach(info => { if (!infoPorChave.has(info.chave)) infoPorChave.set(info.chave, info); });
    });

    const linhas = [];
    resultados.forEach(r => {
      const mod = LEV_TREE[r.chave];
      const mapaNode = mapaPorModulo[r.chave];
      mod.linhas.forEach(linhaCfg => {
        const porApto = new Map();
        let total = 0;
        r.dados.forEach(reg => {
          const v = mod.valor(reg, linhaCfg.metrica);
          if (!v) return;
          total += v;
          const info = mapaNode.get(reg.nodeId);
          const aptoChave = info ? info.chave : '__sem_local__';
          porApto.set(aptoChave, (porApto.get(aptoChave) || 0) + v);
        });
        if (total <= 0) return;
        const moduloVinculo = mod.moduloVinculo || r.chave;
        const custoInfo = _custoMedioPorUnidade(moduloVinculo, linhaCfg.metrica, custoMaterialPorTarefa, custoMaoObraPorTarefa);
        linhas.push({
          categoria: mod.label, metrica: linhaCfg.metrica, label: linhaCfg.label, unidade: linhaCfg.unidade,
          porApto, total, custoUnitario: custoInfo,
        });
      });
    });

    // Só entram como coluna as chaves que REALMENTE têm dado lançado —
    // evita colunas fantasma pra nós de árvore sem lançamento direto.
    const chavesUsadas = new Map();
    linhas.forEach(l => {
      l.porApto.forEach((v, chave) => {
        if (chave === '__sem_local__' || !(v > 0)) return;
        chavesUsadas.set(chave, (chavesUsadas.get(chave) || 0) + 1);
      });
    });

    function _nivel(caminho, n) { const p = caminho.split(' › '); return p.slice(0, Math.min(p.length, n)).join(' › '); }

    const apartamentos = [...chavesUsadas.keys()]
      .map(chave => infoPorChave.get(chave))
      .filter(Boolean)
      .map(info => ({ ...info, completude: chavesUsadas.get(info.chave) || 0, pavimentoChave: _nivel(info.chave, 2) }))
      .sort((a, b) => {
        const t = a.torreChave.localeCompare(b.torreChave, 'pt-BR', { numeric: true });
        if (t !== 0) return t;
        const p = a.pavimentoChave.localeCompare(b.pavimentoChave, 'pt-BR', { numeric: true });
        if (p !== 0) return p;
        if (b.completude !== a.completude) return b.completude - a.completude;
        return a.chave.localeCompare(b.chave, 'pt-BR', { numeric: true });
      });

    return { apartamentos, linhas };
  }

  // "Apartamento" = SEMPRE os 3 primeiros níveis do caminho (Torre >
  // Pavimento > Apto) — funciona tanto pra área lançada direto no Apto
  // quanto num Cômodo abaixo dele. Ver histórico no git pra justificativa.
  function _mapaApartamentosPorLabel(arvore) {
    const mapaNode = new Map();
    const PROFUNDIDADE_APTO = 3;
    function ordenar(nodes) { return [...(nodes || [])].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { numeric: true })); }
    function walk(nodes, caminho, caminhoChave) {
      ordenar(nodes).forEach(n => {
        const nome = n.nome || '';
        const novoCaminho = [...caminho, nome];
        const novoCaminhoChave = [...caminhoChave, DashCore.normalizarChave(nome)];
        const filhos = n.filhos || [];
        const corte = Math.min(novoCaminho.length, PROFUNDIDADE_APTO);
        const aptoCaminho = novoCaminho.slice(0, corte);
        const aptoCaminhoChave = novoCaminhoChave.slice(0, corte);
        mapaNode.set(n.id, {
          label: aptoCaminho.join(' › '), chave: aptoCaminhoChave.join(' › '),
          torre: novoCaminho[0] || '', torreChave: novoCaminhoChave[0] || '',
        });
        if (filhos.length) walk(filhos, novoCaminho, novoCaminhoChave);
      });
    }
    walk(arvore, [], []);
    return mapaNode;
  }

  // Réplica simplificada de Planejamento._calcularCustos — custo direto por
  // tarefa (Material + Mão de Obra). Sincronia manual com js/planejamento.js.
  function _calcularCustosTarefas(materiaisBib, materiaisVinc, maoDeObraVinc) {
    const custoMaterialPorTarefa = new Map(), custoMaoObraPorTarefa = new Map();
    const bibPorId = new Map(materiaisBib.map(m => [m.id, m]));
    const tarefas = _ctx.tarefas;
    materiaisVinc.forEach(v => {
      const ids = v.tarefaIds || (v.tarefaId ? [v.tarefaId] : []);
      ids.forEach(tarefaId => {
        if (!tarefaId || tarefaId === '__fachada__') return;
        const t = tarefas.find(x => x.id === tarefaId);
        const mat = bibPorId.get(v.materialId);
        if (!t || !mat || !mat.preco) return;
        const cons = parseFloat(v.consumoPrevisto) || 0;
        const custo = (t.quantidade || 0) * cons * parseFloat(mat.preco);
        custoMaterialPorTarefa.set(tarefaId, (custoMaterialPorTarefa.get(tarefaId) || 0) + custo);
      });
    });
    maoDeObraVinc.forEach(v => {
      const ids = v.tarefaIds || (v.tarefaId ? [v.tarefaId] : []);
      ids.forEach(tarefaId => {
        if (!tarefaId) return;
        const t = tarefas.find(x => x.id === tarefaId);
        if (!t) return;
        const valor = parseFloat(v.valor) || 0;
        const custo = t.quantidade ? valor * t.quantidade : valor;
        custoMaoObraPorTarefa.set(tarefaId, (custoMaoObraPorTarefa.get(tarefaId) || 0) + custo);
      });
    });
    return { custoMaterialPorTarefa, custoMaoObraPorTarefa };
  }

  function _custoMedioPorUnidade(modulo, metrica, custoMaterialPorTarefa, custoMaoObraPorTarefa) {
    const alvo = _ctx.tarefas.filter(t => t.fonteQuantidade === 'levantamento' && t.levantamentoModulo === modulo && t.levantamentoMetrica === metrica);
    if (!alvo.length) return null;
    let custoTotal = 0, qtdTotal = 0;
    alvo.forEach(t => {
      custoTotal += (custoMaterialPorTarefa.get(t.id) || 0) + (custoMaoObraPorTarefa.get(t.id) || 0);
      qtdTotal += Number(t.quantidade) || 0;
    });
    if (!qtdTotal) return null;
    return custoTotal / qtdTotal;
  }

  function _renderTabela() {
    const host = document.getElementById('db-resumo-apartamento');
    if (!host || !_dados) return;
    const { apartamentos, linhas } = _dados;

    if (!linhas.length) {
      host.innerHTML = `<div class="db-vazio">
        <div class="db-vazio-icone">📐</div>
        <div class="db-vazio-titulo">Nenhum dado de levantamento lançado ainda</div>
        <div class="db-vazio-sub">Assim que Piso, Paredes ou Teto tiverem áreas cadastradas, o resumo aparece aqui automaticamente.</div>
      </div>`;
      return;
    }

    const fmt = (v, unidade) => v ? Utils.formatarNumero(v) + ' ' + unidade : '—';
    const fmtCusto = (v) => (v != null) ? 'R$ ' + Utils.formatarNumero(v) : '<span class="text-muted">—</span>';
    const valorLinha = (l, chave) => l.porApto.get(chave) || 0;
    const celula = (l, v) => {
      if (_view === 'custo') {
        const custo = (l.custoUnitario != null) ? v * l.custoUnitario : null;
        return fmtCusto(custo);
      }
      return fmt(v, l.unidade);
    };

    const semLocal = apartamentos.length === 0;

    if (semLocal) {
      let categoriaAtual = null;
      const linhasHtml = linhas.map(l => {
        let headerCategoria = '';
        if (l.categoria !== categoriaAtual) {
          categoriaAtual = l.categoria;
          headerCategoria = `<tr class="db-resumo-categoria"><td colspan="3">${l.categoria}</td></tr>`;
        }
        const v = valorLinha(l, '__sem_local__');
        return `${headerCategoria}<tr><td>${l.label}</td><td class="col-num">${celula(l, v)}</td><td class="col-num" style="font-weight:700;">${celula(l, l.total)}</td></tr>`;
      }).join('');
      host.innerHTML = `
        <div class="text-sm text-muted" style="margin-bottom:8px;">Nenhuma árvore de local configurada ainda — mostrando totais da obra.</div>
        <div class="tabela-container" style="max-height:520px;">
          <table class="tabela">
            <thead><tr><th>Item</th><th class="col-num">Toda a obra</th><th class="col-num">Total</th></tr></thead>
            <tbody>${linhasHtml}</tbody>
          </table>
        </div>`;
      return;
    }

    // Torre > Pavimento > Apto, com subtotais por pavimento e por torre.
    const torresMap = new Map();
    apartamentos.forEach(a => {
      if (!torresMap.has(a.torreChave)) torresMap.set(a.torreChave, { torre: a.torre || '—', pavimentos: new Map() });
      const tg = torresMap.get(a.torreChave);
      if (!tg.pavimentos.has(a.pavimentoChave)) {
        const labelPav = a.label.split(' › ').slice(0, 2).join(' › ');
        tg.pavimentos.set(a.pavimentoChave, { label: labelPav, cols: [] });
      }
      tg.pavimentos.get(a.pavimentoChave).cols.push(a);
    });
    const torres = [...torresMap.values()];

    const colunasOrdenadas = [];
    torres.forEach(tg => {
      [...tg.pavimentos.values()].forEach(pav => {
        pav.cols.forEach(a => colunasOrdenadas.push({ tipo: 'apto', a }));
        colunasOrdenadas.push({ tipo: 'subtotalPav', pav });
      });
      colunasOrdenadas.push({ tipo: 'subtotalTorre', tg });
    });

    function valorColuna(l, col) {
      if (col.tipo === 'apto') return valorLinha(l, col.a.chave);
      if (col.tipo === 'subtotalPav') return col.pav.cols.reduce((s, a) => s + valorLinha(l, a.chave), 0);
      let s = 0; col.tg.pavimentos.forEach(pav => { s += pav.cols.reduce((s2, a) => s2 + valorLinha(l, a.chave), 0); });
      return s;
    }

    let headerTorre = '';
    let headerPav = '';
    let headerApto = '';
    torres.forEach(tg => {
      const pavimentos = [...tg.pavimentos.values()];
      let colsNaTorre = 1;
      pavimentos.forEach(pav => {
        colsNaTorre += pav.cols.length + 1;
        headerPav += `<th colspan="${pav.cols.length + 1}" style="text-align:center;">${pav.label}</th>`;
        pav.cols.forEach(a => {
          headerApto += `<th class="col-num" style="text-align:center;" title="${a.label}">${a.label.split(' › ').pop()}</th>`;
        });
        headerApto += `<th class="col-num db-subtotal-col" style="text-align:center;">Subtot.</th>`;
      });
      headerTorre += `<th colspan="${colsNaTorre}" style="text-align:center;">${tg.torre}</th>`;
      headerPav += `<th rowspan="2" class="col-num db-subtotal-col" style="text-align:center;">Subtot.<br>Torre</th>`;
    });

    let categoriaAtual = null;
    const linhasHtml = linhas.map(l => {
      let headerCategoria = '';
      if (l.categoria !== categoriaAtual) {
        categoriaAtual = l.categoria;
        headerCategoria = `<tr class="db-resumo-categoria"><td colspan="${colunasOrdenadas.length + 2}">${l.categoria}</td></tr>`;
      }
      const cels = colunasOrdenadas.map(col => {
        const v = valorColuna(l, col);
        const cls = col.tipo === 'apto' ? 'col-num' : 'col-num db-subtotal-col';
        return `<td class="${cls}">${celula(l, v)}</td>`;
      }).join('');
      const totalCel = `<td class="col-num" style="font-weight:700;">${celula(l, l.total)}</td>`;
      return `${headerCategoria}<tr><td>${l.label}</td>${cels}${totalCel}</tr>`;
    }).join('');

    host.innerHTML = `
      <div class="tabela-container" style="max-height:520px;">
        <table class="tabela">
          <thead>
            <tr><th rowspan="3">Item</th>${headerTorre}<th rowspan="3" class="col-num">Total</th></tr>
            <tr>${headerPav}</tr>
            <tr>${headerApto}</tr>
          </thead>
          <tbody>${linhasHtml}</tbody>
        </table>
      </div>`;
  }

  return { render, setView };
})();
window.DashResumo = DashResumo;
