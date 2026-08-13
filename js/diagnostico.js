// ============================================
// DIAGNÓSTICO — mostra na tela os dados brutos que o suporte precisa ver
// pra investigar bugs sem depender do console do navegador (F12) nem de
// exportar coleções do Firestore. Somente leitura: NÃO grava nada.
// ============================================
const Diagnostico = (() => {
  let obraAtual = null;

  async function init() {
    const ok = await Utils.initPagina();
    if (!ok) return;
    obraAtual = Router.getObra();
    await rodar();
  }

  function onObraChanged() {
    obraAtual = Router.getObra();
    rodar();
  }

  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const badge = (txt, cor) => `<span class="diag-badge" style="background:${cor}22;color:${cor};">${txt}</span>`;
  const OK = '#16a34a', ERRO = '#dc2626', ALERTA = '#d97706';

  async function rodar() {
    const el = document.getElementById('modulo-content');
    if (!obraAtual) {
      el.innerHTML = '<div class="estado-vazio"><p>Selecione uma obra na barra lateral.</p></div>';
      return;
    }
    el.innerHTML = '<div class="estado-vazio"><p>Rodando diagnóstico...</p></div>';
    const obraId = obraAtual.id;

    let html = `<div class="diag-bloco">
      <div class="diag-titulo">Obra analisada</div>
      <div class="diag-linha">${esc(obraAtual.nome || '—')} · id: ${esc(obraId)}</div>
      <div class="diag-linha">Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
    </div>`;

    // ---- 1. MOTORES DE CÁLCULO (scripts globais) ----
    const motores = [
      ['SoloGrampeadoCalculos', window.SoloGrampeadoCalculos],
      ['ConcretoCalculos', window.ConcretoCalculos],
      ['EstacasCalculos', window.EstacasCalculos],
      ['Utils', window.Utils],
      ['Database', window.Database],
    ];
    html += `<div class="diag-bloco">
      <div class="diag-titulo">1. Motores de cálculo carregados</div>
      ${motores.map(([nome, ref]) => `<div class="diag-linha">${nome}: ${ref ? badge('OK', OK) : badge('NÃO CARREGOU', ERRO)}</div>`).join('')}
      <div class="diag-linha" style="color:#666;">Se algum estiver vermelho, o arquivo .js correspondente não chegou no navegador (rede/CDN).</div>
    </div>`;

    try {
      const [tarefas, pecas, lancamentos, btsConfig, pecaConc, concretagens, marcadores, pranchas, cfgConcreto, estruturaObra, historico] = await Promise.all([
        Database.listar(obraId, 'tarefas', 'ordem').catch(e => ({ _erro: e.message })),
        Database.listar(obraId, 'concretoPecas', null).catch(e => ({ _erro: e.message })),
        Database.listar(obraId, 'concretoLancamentos', null).catch(e => ({ _erro: e.message })),
        Database.listar(obraId, 'concretoBTs', null).catch(e => ({ _erro: e.message })),
        Database.listar(obraId, 'concretoPecaConc', null).catch(e => ({ _erro: e.message })),
        Database.listar(obraId, 'concretoConcretagens', null).catch(e => ({ _erro: e.message })),
        Database.listar(obraId, 'estacasMarcadores', null).catch(e => ({ _erro: e.message })),
        Database.listar(obraId, 'estacasPranchas', null).catch(e => ({ _erro: e.message })),
        Database.obter(obraId, 'config', 'concreto').catch(() => null),
        Database.obter(obraId, 'config', 'estruturaObra').catch(() => null),
        Database.listar(obraId, 'historicoExecucao', 'data', 'asc').catch(() => []),
      ]);

      // ---- 2. CURVA S: quantas tarefas-folha têm data ----
      const arr = v => Array.isArray(v) ? v : [];
      const tf = arr(tarefas);
      const sorted = [...tf].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      const folhas = [];
      sorted.forEach((t, i) => {
        const nxt = sorted[i + 1];
        if (!nxt || (nxt.nivel || 0) <= (t.nivel || 0)) folhas.push(t);
      });
      const folhasComData = folhas.filter(t => t.inicioPlanejado || t.inicioPlanejadoBase);
      const folhasSemData = folhas.filter(t => !t.inicioPlanejado && !t.inicioPlanejadoBase);
      let dMin = null, dMax = null;
      folhasComData.forEach(t => {
        const ini = new Date(t.inicioPlanejadoBase || t.inicioPlanejado);
        const fim = new Date(t.terminoPlanejadoBase || t.terminoPlanejado || t.inicioPlanejado);
        if (!isNaN(ini) && (!dMin || ini < dMin)) dMin = ini;
        if (!isNaN(fim) && (!dMax || fim > dMax)) dMax = fim;
      });
      const datasInvalidas = folhasComData.filter(t => isNaN(new Date(t.inicioPlanejadoBase || t.inicioPlanejado)));

      html += `<div class="diag-bloco">
        <div class="diag-titulo">2. Curva S — dados de data das tarefas</div>
        <div class="diag-linha">Total de tarefas: <b>${tf.length}</b> · tarefas-folha: <b>${folhas.length}</b></div>
        <div class="diag-linha">Folhas COM data: ${folhasComData.length ? badge(folhasComData.length, OK) : badge('0', ERRO)} · folhas SEM data: ${folhasSemData.length ? badge(folhasSemData.length, ALERTA) : badge('0', OK)}</div>
        <div class="diag-linha">Período encontrado: <b>${dMin ? dMin.toLocaleDateString('pt-BR') : '—'}</b> até <b>${dMax ? dMax.toLocaleDateString('pt-BR') : '—'}</b></div>
        <div class="diag-linha">Datas inválidas (texto que não vira data): ${datasInvalidas.length ? badge(datasInvalidas.length, ERRO) : badge('0', OK)}</div>
        <div class="diag-linha">Registros de histórico de execução: <b>${arr(historico).length}</b></div>
        ${folhasComData.length ? `<div style="margin-top:8px;"><b style="font-size:.8rem;">Amostra (5 primeiras folhas com data):</b>
          <table class="diag-tabela" style="margin-top:4px;">
            <tr><th>Tarefa</th><th>inicioPlanejado</th><th>terminoPlanejado</th><th>inicioPlanejadoBase</th><th>duracao</th></tr>
            ${folhasComData.slice(0, 5).map(t => `<tr>
              <td>${esc((t.nome || '').slice(0, 34))}</td>
              <td>${esc(t.inicioPlanejado || '—')}</td>
              <td>${esc(t.terminoPlanejado || '—')}</td>
              <td>${esc(t.inicioPlanejadoBase || '—')}</td>
              <td>${esc(t.duracao ?? '—')}</td></tr>`).join('')}
          </table></div>` : ''}
        ${folhasSemData.length ? `<div style="margin-top:8px;"><b style="font-size:.8rem;">Amostra (5 folhas SEM data — não entram na Curva S):</b>
          <table class="diag-tabela" style="margin-top:4px;">
            <tr><th>Tarefa</th><th>nível</th><th>ordem</th></tr>
            ${folhasSemData.slice(0, 5).map(t => `<tr><td>${esc((t.nome || '').slice(0, 40))}</td><td>${t.nivel ?? '—'}</td><td>${t.ordem ?? '—'}</td></tr>`).join('')}
          </table></div>` : ''}
      </div>`;

      // ---- 3. ESTACAS / CONCRETO ----
      const pc = arr(pecas), lans = arr(lancamentos);
      const isEstaca = p => p.tipo === 'Fundação' && (p.subTipo === 'Estacas' || (!p.subTipo && parseFloat(String(p.diametro ?? '').replace(',', '.')) > 0));
      const pecasEstaca = pc.filter(isEstaca);
      const pecasFundacao = pc.filter(p => p.tipo === 'Fundação' && !isEstaca(p));
      const pecasEstrutura = pc.filter(p => p.tipo !== 'Fundação');
      const CC = window.ConcretoCalculos;
      // Normalizador de nome de andar (tolera acento/grau/maiúscula) — usado
      // já na seção 3 e de novo na 4, por isso declarado aqui no topo.
      const norm = a => CC ? CC.normalizarAndar(a) : String(a || '').trim();
      const comLancamento = pecasEstaca.filter(p => lans.some(l => l.pecaId === p.id));
      const pctPorPeca = pecasEstaca.map(p => ({ p, pct: CC ? CC.pctConcretado(p, lans) : 0 }));
      const emExecucao = pctPorPeca.filter(x => x.pct > 0);

      html += `<div class="diag-bloco">
        <div class="diag-titulo">3. Concreto / Estacas</div>
        <div class="diag-linha">Peças totais: <b>${pc.length}</b> — Estacas: <b>${pecasEstaca.length}</b> · Fundação: <b>${pecasFundacao.length}</b> · Estrutura: <b>${pecasEstrutura.length}</b></div>
        <div style="margin-top:8px;"><b style="font-size:.8rem;">Valores REAIS do campo "tipo" nas peças (a categorização depende disso):</b>
          <table class="diag-tabela" style="margin-top:4px;">
            <tr><th>tipo (exato)</th><th>nº peças</th><th>subTipo(s) encontrados</th></tr>
            ${[...new Set(pc.map(p => p.tipo ?? '(sem campo tipo)'))].map(t => {
              const doTipo = pc.filter(p => (p.tipo ?? '(sem campo tipo)') === t);
              const subs = [...new Set(doTipo.map(p => p.subTipo ?? '(vazio)'))];
              return `<tr><td>"${esc(t)}"</td><td>${doTipo.length}</td><td>${subs.map(s => '"' + esc(s) + '"').join(', ')}</td></tr>`;
            }).join('')}
          </table></div>
        <div style="margin-top:8px;"><b style="font-size:.8rem;">Peças do andar "Fundação" (amostra de 5) — pra ver que tipo elas têm de verdade:</b>
          <table class="diag-tabela" style="margin-top:4px;">
            <tr><th>Nome</th><th>tipo</th><th>subTipo</th><th>volume</th><th>diâmetro</th><th>comprimento</th></tr>
            ${pc.filter(p => norm(p.andar || '') === norm('Fundação')).slice(0, 5).map(p => `<tr>
              <td>${esc((p.nome || '').slice(0, 26))}</td>
              <td>"${esc(p.tipo ?? '(sem)')}"</td>
              <td>"${esc(p.subTipo ?? '(vazio)')}"</td>
              <td>${esc(p.volume ?? '—')}</td>
              <td>${esc(p.diametro ?? '—')}</td>
              <td>${esc(p.comprimento ?? '—')}</td></tr>`).join('') || '<tr><td colspan="6">nenhuma</td></tr>'}
          </table></div>
        <div class="diag-linha" style="margin-top:8px;">Lançamentos (concretoLancamentos): <b>${lans.length}</b> · BTs: <b>${arr(btsConfig).length}</b> · Concretagens: <b>${arr(concretagens).length}</b> · Vínculos peça-concretagem: <b>${arr(pecaConc).length}</b></div>
        <div class="diag-linha">Estacas COM lançamento vinculado: ${comLancamento.length ? badge(comLancamento.length, OK) : badge('0', ERRO)}</div>
        <div class="diag-linha">Estacas com % > 0 (em execução): ${emExecucao.length ? badge(emExecucao.length, OK) : badge('0', ERRO)}</div>
        <div class="diag-linha">Marcadores no mapa: <b>${arr(marcadores).length}</b> · com peça vinculada: <b>${arr(marcadores).filter(m => m.pecaId).length}</b> · Pranchas: <b>${arr(pranchas).length}</b></div>
        ${pecasEstaca.length ? `<div style="margin-top:8px;"><b style="font-size:.8rem;">Amostra (5 estacas):</b>
          <table class="diag-tabela" style="margin-top:4px;">
            <tr><th>Nome</th><th>andar (exato)</th><th>tipo</th><th>subTipo</th><th>volume</th><th>diâmetro</th><th>% calc.</th><th>nº lanç.</th></tr>
            ${pctPorPeca.slice(0, 5).map(({ p, pct }) => `<tr>
              <td>${esc((p.nome || '').slice(0, 22))}</td>
              <td>"${esc(p.andar || '')}"</td>
              <td>${esc(p.tipo || '—')}</td>
              <td>${esc(p.subTipo || '(vazio)')}</td>
              <td>${esc(p.volume ?? '—')}</td>
              <td>${esc(p.diametro ?? '—')}</td>
              <td>${pct.toFixed(1)}%</td>
              <td>${lans.filter(l => l.pecaId === p.id).length}</td></tr>`).join('')}
          </table></div>` : ''}
        ${lans.length ? `<div style="margin-top:8px;"><b style="font-size:.8rem;">Amostra (3 lançamentos):</b>
          <table class="diag-tabela" style="margin-top:4px;">
            <tr><th>pecaId</th><th>peça existe?</th><th>volume</th><th>concretagemId</th><th>btConfigId</th></tr>
            ${lans.slice(0, 3).map(l => `<tr>
              <td>${esc(String(l.pecaId || '').slice(0, 20))}</td>
              <td>${pc.some(p => p.id === l.pecaId) ? badge('sim', OK) : badge('NÃO', ERRO)}</td>
              <td>${esc(l.volume ?? '—')}</td>
              <td>${esc(String(l.concretagemId || '—').slice(0, 16))}</td>
              <td>${esc(String(l.btConfigId || '—').slice(0, 16))}</td></tr>`).join('')}
          </table></div>` : ''}
      </div>`;

      // ---- 4. ANDARES: grafias distintas (causa de barra duplicada/split) ----
      const andaresBrutos = [...new Set(pc.map(p => p.andar || '(vazio)'))];
      const ordemSalva = cfgConcreto?.ordemAndares || [];
      const gruposNorm = new Map();
      andaresBrutos.forEach(a => {
        const k = norm(a);
        if (!gruposNorm.has(k)) gruposNorm.set(k, []);
        gruposNorm.get(k).push(a);
      });
      const duplicados = [...gruposNorm.entries()].filter(([, lista]) => lista.length > 1);

      html += `<div class="diag-bloco">
        <div class="diag-titulo">4. Andares (nomes exatos gravados nas peças)</div>
        <div class="diag-linha">Grafias distintas nas peças: <b>${andaresBrutos.length}</b> · na ordem configurada: <b>${ordemSalva.length}</b></div>
        <div class="diag-linha">Grafias diferentes do MESMO andar: ${duplicados.length ? badge(duplicados.length + ' — causa split de volume', ERRO) : badge('nenhuma', OK)}</div>
        ${duplicados.length ? duplicados.map(([k, lista]) => `<div class="diag-linha" style="color:#dc2626;">"${esc(k)}" aparece como: ${lista.map(x => '"' + esc(x) + '"').join(' , ')}</div>`).join('') : ''}
        <table class="diag-tabela" style="margin-top:6px;">
          <tr><th>Andar nas peças (exato)</th><th>nº peças</th><th>está na ordem configurada?</th></tr>
          ${andaresBrutos.map(a => `<tr>
            <td>"${esc(a)}"</td>
            <td>${pc.filter(p => (p.andar || '(vazio)') === a).length}</td>
            <td>${ordemSalva.some(o => norm(o) === norm(a)) ? badge('sim', OK) : badge('não', ALERTA)}</td></tr>`).join('')}
        </table>
      </div>`;

      // ---- 5. ESTRUTURA DA OBRA + VÍNCULOS (Painel de Andamento) ----
      const torres = estruturaObra?.torres || [];
      let qtdPav = 0, qtdApto = 0;
      torres.forEach(t => { (t.pavimentos || []).forEach(p => { qtdPav++; qtdApto += (p.apartamentos || []).length; }); });
      const tarefasComVinculo = tf.filter(t => (t.vinculoEstrutura || []).length);

      html += `<div class="diag-bloco">
        <div class="diag-titulo">5. Estrutura da Obra e vínculos (Painel de Andamento)</div>
        <div class="diag-linha">Torres: <b>${torres.length}</b> · Pavimentos: <b>${qtdPav}</b> · Apartamentos: <b>${qtdApto}</b> ${torres.length ? '' : badge('não cadastrada', ERRO)}</div>
        <div class="diag-linha">Tarefas com vínculo de local preenchido: ${tarefasComVinculo.length ? badge(tarefasComVinculo.length + ' de ' + tf.length, OK) : badge('0 — Painel fica vazio sem isso', ERRO)}</div>
        <div style="margin-top:8px;"><b style="font-size:.8rem;">Nomes cadastrados na Estrutura da Obra × quantas tarefas contêm esse nome (é assim que o Auto-vincular casa):</b>
          <table class="diag-tabela" style="margin-top:4px;">
            <tr><th>Tipo</th><th>Nome cadastrado (exato)</th><th>Tarefas que contêm esse texto</th></tr>
            ${torres.flatMap(t => (t.pavimentos || []).flatMap(p => {
              const nomeP = p.nome || '';
              const achouP = tf.filter(x => (x.nome || '').toLowerCase().includes(nomeP.toLowerCase())).length;
              const linhaP = `<tr><td>Pavimento</td><td>"${esc(nomeP)}"</td><td>${achouP ? badge(achouP, OK) : badge('0 — não casa', ERRO)}</td></tr>`;
              const linhasA = (p.apartamentos || []).map(a => {
                const nomeA = a.nome || '';
                const achouA = tf.filter(x => (x.nome || '').toLowerCase().includes(nomeA.toLowerCase())).length;
                return `<tr><td style="padding-left:18px;">↳ Apto</td><td>"${esc(nomeA)}"</td><td>${achouA ? badge(achouA, OK) : badge('0 — não casa', ERRO)}</td></tr>`;
              });
              return [linhaP, ...linhasA];
            })).join('')}
          </table></div>
        <div style="margin-top:8px;"><b style="font-size:.8rem;">Amostra de 8 nomes REAIS de tarefas-folha (compare com os nomes acima):</b>
          ${folhas.slice(0, 8).map(t => `<div class="diag-linha">"${esc(t.nome || '')}"</div>`).join('')}
        </div>
        <div class="diag-linha" style="color:#666;margin-top:6px;">Se um pavimento/apto aparece com "0 — não casa", o nome cadastrado na Estrutura precisa ser escrito igual ao que aparece dentro do nome das tarefas (ex: se a tarefa diz "1° Pavimento" com símbolo de grau e a Estrutura tem "1º Pavimento" com ordinal, não casa).</div>
      </div>`;

      // ---- 6. Erros de leitura de coleção ----
      const erros = [
        ['tarefas', tarefas], ['concretoPecas', pecas], ['concretoLancamentos', lancamentos],
        ['concretoBTs', btsConfig], ['concretoPecaConc', pecaConc], ['concretoConcretagens', concretagens],
        ['estacasMarcadores', marcadores], ['estacasPranchas', pranchas],
      ].filter(([, v]) => v && v._erro);
      if (erros.length) {
        html += `<div class="diag-bloco">
          <div class="diag-titulo diag-erro">6. Erros ao ler coleções</div>
          ${erros.map(([nome, v]) => `<div class="diag-linha diag-erro">${nome}: ${esc(v._erro)}</div>`).join('')}
        </div>`;
      }

      el.innerHTML = html;
    } catch (e) {
      el.innerHTML = html + `<div class="diag-bloco"><div class="diag-titulo diag-erro">Erro ao rodar o diagnóstico</div>
        <div class="diag-linha diag-erro">${esc(e && e.message ? e.message : String(e))}</div></div>`;
    }
  }

  // Copia o diagnóstico como TEXTO PURO (sem HTML/formatação) pro clipboard —
  // colar em qualquer lugar fica legível, sem quebrar a formatação.
  function copiar() {
    const el = document.getElementById('modulo-content');
    if (!el) return;
    // innerText já respeita quebras de linha visuais e ignora tags.
    let txt = el.innerText || el.textContent || '';
    txt = txt.split('\n').map(l => l.trim()).filter(l => l).join('\n');
    const cabecalho = `DIAGNÓSTICO — ${obraAtual?.nome || ''} — ${new Date().toLocaleString('pt-BR')}\n${'='.repeat(60)}\n`;
    const final = cabecalho + txt;
    navigator.clipboard.writeText(final).then(() => {
      Utils.toast('Diagnóstico copiado! Cole aqui no chat.', 'sucesso');
    }).catch(() => {
      // Fallback pra navegador que bloqueia clipboard: mostra num textarea
      // selecionável, pra copiar manualmente com Ctrl+C.
      const ta = document.createElement('textarea');
      ta.value = final;
      ta.style.cssText = 'position:fixed;inset:5%;width:90%;height:80%;z-index:900;font-family:monospace;font-size:12px;padding:10px;';
      document.body.appendChild(ta);
      ta.select();
      Utils.toast('Selecionado — aperte Ctrl+C e depois Esc.', 'info');
      const fechar = (e) => { if (e.key === 'Escape') { ta.remove(); document.removeEventListener('keydown', fechar); } };
      document.addEventListener('keydown', fechar);
    });
  }

  // Baixa o diagnóstico como arquivo .txt — alternativa ao copiar, útil
  // quando o texto é grande demais pra colar confortavelmente.
  function baixar() {
    const el = document.getElementById('modulo-content');
    if (!el) return;
    let txt = (el.innerText || el.textContent || '').split('\n').map(l => l.trim()).filter(l => l).join('\n');
    const cabecalho = `DIAGNÓSTICO — ${obraAtual?.nome || ''} — ${new Date().toLocaleString('pt-BR')}\n${'='.repeat(60)}\n`;
    const blob = new Blob([cabecalho + txt], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `diagnostico-${(obraAtual?.nome || 'obra').replace(/[^\w]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return { init, onObraChanged, rodar, copiar, baixar };
})();

function onObraChanged() {
  Diagnostico.onObraChanged();
}
