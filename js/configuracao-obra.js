// ============================================
// Módulo: Configuração da Obra
// CRUD de etapas, pacotes, locais, equipes, funcionários
// ============================================

const ConfiguracaoObra = (() => {
  let obraId = null;
  let etapas = [];
  let pacotes = [];
  let locais = [];
  let equipes = [];
  let calendario = null;
  let calAnoVisivel = new Date().getFullYear();
  let tabAtiva = 'etapas';

  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    
    obraId = Router.getObraId();
    if (!obraId) {
      document.getElementById('config-content').innerHTML = `
        <div class="estado-vazio">
          <div class="icone">🏗️</div>
          <p>Selecione uma obra na barra lateral para configurá-la.</p>
        </div>`;
      return;
    }

    _bindTabs();
    await carregar();
  }

  function _bindTabs() {
    document.querySelectorAll('.tab[data-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        tabAtiva = tab.dataset.tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('ativo'));
        tab.classList.add('ativo');
        renderizar();
      });
    });
  }

  async function carregar() {
    if (!obraId) return;
    try {
      Utils.mostrarLoading();
      [etapas, pacotes, locais, equipes, calendario] = await Promise.all([
        Database.listar(obraId, 'etapas', 'nome'),
        Database.listar(obraId, 'pacotes', 'nome'),
        Database.listar(obraId, 'locais', 'ordem'),
        Database.listar(obraId, 'equipes', 'nome'),
        Calendario.carregar(obraId)
      ]);
      renderizar();
    } catch (e) {
      console.error('Erro:', e);
      Utils.toast('Erro ao carregar configuração.', 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function renderizar() {
    const container = document.getElementById('config-content');
    if (!container) return;

    const renderFns = {
      etapas: () => _renderLista('etapas', etapas, 'Etapa'),
      pacotes: () => _renderLista('pacotes', pacotes, 'Pacote'),
      locais: () => _renderLista('locais', locais, 'Local'),
      equipes: () => _renderLista('equipes', equipes, 'Equipe'),
      calendario: () => _renderCalendario()
    };

    const fn = renderFns[tabAtiva];
    container.innerHTML = fn ? fn() : '';
  }

  function _renderLista(tipo, items, label) {
    const btns = `<div class="toolbar">
      <span class="text-sm text-muted">${items.length} ${items.length === 1 ? label.toLowerCase() : label.toLowerCase() + 's'}</span>
      <button class="btn btn-primario btn-sm" onclick="ConfiguracaoObra.abrirForm('${tipo}')">+ ${label}</button>
    </div>`;

    if (items.length === 0) {
      return btns + `<div class="estado-vazio"><p>Nenhum(a) ${label.toLowerCase()} cadastrado(a).</p></div>`;
    }

    const rows = items.map(item => `
      <tr>
        <td>${item.codigo || ''}</td>
        <td>${item.nome}</td>
        <td class="text-muted text-sm">${item.descricao || ''}</td>
        <td class="col-acoes">
          <button class="btn btn-secundario btn-sm" onclick="ConfiguracaoObra.editarItem('${tipo}','${item.id}')">✎</button>
          <button class="btn btn-perigo btn-sm btn-icon" onclick="ConfiguracaoObra.excluirItem('${tipo}','${item.id}','${item.nome}')">✕</button>
        </td>
      </tr>
    `).join('');

    return btns + `<div class="tabela-container"><table class="tabela tabela-compacta">
      <thead><tr><th>Código</th><th>Nome</th><th>Descrição</th><th class="col-acoes">Ações</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

  function abrirForm(tipo, item = null) {
    if(!Permissions.pode('configuracaoObra','editar:'+tipo)){Utils.toast('Sem permissão.','erro');return;}
    const label = { etapas: 'Etapa', pacotes: 'Pacote', locais: 'Local', equipes: 'Equipe' }[tipo];
    document.getElementById('modal-config-titulo').textContent = item ? `Editar ${label}` : `Nova ${label}`;
    document.getElementById('form-config-tipo').value = tipo;
    document.getElementById('form-config-id').value = item ? item.id : '';
    
    const campoOrdem = document.getElementById('campo-ordem');
    if (tipo === 'locais') {
      campoOrdem.classList.remove('hidden');
    } else {
      campoOrdem.classList.add('hidden');
    }

    if (item) {
      Utils.setFormData('form-config', item);
    } else {
      Utils.limparForm('form-config');
    }
    
    Utils.abrirModal('modal-config');
  }

  async function editarItem(tipo, id) {
    if(!Permissions.pode('configuracaoObra','editar:'+tipo)){Utils.toast('Sem permissão para editar.','erro');return;}
    const listas = { etapas, pacotes, locais, equipes };
    const item = listas[tipo]?.find(i => i.id === id);
    if (item) abrirForm(tipo, item);
  }

  async function salvarItem() {
    const tipo = document.getElementById('form-config-tipo').value;
    if(!Permissions.pode('configuracaoObra','editar:'+tipo)){Utils.toast('Sem permissão para editar.','erro');return;}
    const id = document.getElementById('form-config-id').value;
    const data = Utils.getFormData('form-config');
    delete data[''];

    if (!data.nome) {
      Utils.toast('Informe o nome.', 'alerta');
      return;
    }

    try {
      if (id) {
        await Database.atualizar(obraId, tipo, id, data);
        Utils.toast('Atualizado!', 'sucesso');
      } else {
        await Database.criar(obraId, tipo, data);
        Utils.toast('Criado!', 'sucesso');
      }
      Utils.fecharModal('modal-config');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao salvar.', 'erro');
    }
  }

  async function excluirItem(tipo, id, nome) {
    if(!Permissions.pode('configuracaoObra','editar:'+tipo)){Utils.toast('Sem permissão para editar.','erro');return;}
    if (!Utils.confirmar(`Excluir "${nome}"?`)) return;
    try {
      await Database.deletar(obraId, tipo, id);
      Utils.toast('Excluído.', 'sucesso');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao excluir.', 'erro');
    }
  }

  // ============================================================
  // ABA CALENDÁRIO
  // ============================================================
  // Define o que é dia de obra nesta obra. A conta em si mora em
  // js/calendario.js — aqui é só tela. Mudar qualquer coisa aqui NÃO mexe em
  // data de tarefa: quem recalcula é o Planejamento, com simulação antes, no
  // botão "Aplicar Calendário às Datas".

  const _esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const _fd = d => { if (!d) return '—'; try { return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR'); } catch (e) { return d; } };
  const _cal = () => (calendario = Calendario.normalizar(calendario));

  function _renderCalendario() {
    const c = _cal();
    const podeEditar = Permissions.pode('configuracaoObra', 'editar:calendario');

    const diasBtns = [0, 1, 2, 3, 4, 5, 6].map(d => {
      const on = c.jornada.includes(d);
      const meio = on && c.jornadaMeio.includes(d);
      const dica = !on ? 'Não trabalha — clique para dia inteiro'
        : meio ? 'Meio período (rende meia jornada) — clique para desligar'
          : 'Dia inteiro — clique para meio período';
      return `<button class="btn btn-sm ${on ? 'btn-primario' : 'btn-secundario'}" style="min-width:58px;font-size:.72rem;${meio ? 'opacity:.75;' : ''}"
        onclick="ConfiguracaoObra.calToggleDia(${d})" title="${dica}">${Calendario.nomeDiaSemana(d)}${meio ? ' ½' : ''}</button>`;
    }).join('');

    const feriados = c.feriadosAuto ? Calendario.feriadosDoAno(calAnoVisivel) : [];
    const manuaisAno = c.feriadosManuais.filter(f => String(f.data).startsWith(String(calAnoVisivel)));
    const linhasFer = [
      ...feriados.map(f => {
        const desligado = f.tipo === 'facultativo' && !c.facultativos[f.chave];
        return `<tr style="${desligado ? 'opacity:.45;' : ''}">
          <td style="white-space:nowrap;">${_fd(f.data)}</td>
          <td>${_esc(f.nome)}</td>
          <td>${f.tipo === 'facultativo'
            ? `<span class="badge badge-neutro">facultativo${desligado ? ' · obra trabalha' : ''}</span>`
            : '<span class="badge badge-info">nacional</span>'}</td>
          <td class="text-muted" style="font-size:.72rem;">automático</td>
        </tr>`;
      }),
      ...manuaisAno.map(f => `<tr>
        <td style="white-space:nowrap;">${_fd(f.data)}</td>
        <td>${_esc(f.nome || 'Feriado')}</td>
        <td><span class="badge badge-amarelo">${_esc(f.tipo || 'municipal')}</span></td>
        <td class="col-acoes">${podeEditar ? `<button class="btn btn-perigo btn-sm" onclick="ConfiguracaoObra.calRemoverFeriado('${_esc(f.data)}')" title="Remover">✕</button>` : ''}</td>
      </tr>`)
    ].join('');

    const linhasPar = c.paralisacoes.map((p, i) => `<tr>
      <td style="white-space:nowrap;">${_fd(p.ini)} → ${_fd(p.fim)}</td>
      <td>${_esc(p.motivo || '—')}</td>
      <td class="col-acoes">${podeEditar ? `<button class="btn btn-perigo btn-sm" onclick="ConfiguracaoObra.calRemoverParalisacao(${i})" title="Remover">✕</button>` : ''}</td>
    </tr>`).join('');

    const linhasExc = [...c.excecoes].sort((a, b) => a.data < b.data ? -1 : 1).map(e => `<tr>
      <td style="white-space:nowrap;">${_fd(e.data)}</td>
      <td><span class="badge ${e.trabalha ? 'badge-sucesso' : 'badge-perigo'}">${e.trabalha ? 'trabalha mesmo assim' : 'não trabalha'}</span></td>
      <td>${_esc(e.motivo || '—')}</td>
      <td class="col-acoes">${podeEditar ? `<button class="btn btn-perigo btn-sm" onclick="ConfiguracaoObra.calRemoverExcecao('${_esc(e.data)}')" title="Remover">✕</button>` : ''}</td>
    </tr>`).join('');

    const chk = (marcado, acao, rotulo, dica) => `<label class="form-check" style="display:inline-flex;font-size:.78rem;cursor:pointer;margin-right:18px;color:var(--cor-texto);" title="${_esc(dica)}">
      <input type="checkbox" ${marcado ? 'checked' : ''} onchange="ConfiguracaoObra.${acao}"> ${_esc(rotulo)}</label>`;

    const bloco = (titulo, subtitulo, corpo) => `<div class="card" style="margin-bottom:14px;">
      <div class="card-header" style="display:block;padding:12px 16px;">
        <div style="font-size:.9rem;font-weight:700;color:var(--cor-texto);">${titulo}</div>
        <div class="text-sm text-muted" style="font-size:.75rem;margin-top:2px;">${subtitulo}</div>
      </div>
      <div class="card-body" style="padding:14px 16px;">${corpo}</div>
    </div>`;

    const tabela = (cabecalhos, linhas, vazio) => linhas
      ? `<div class="tabela-container" style="max-height:280px;overflow:auto;">
          <table class="tabela tabela-compacta">
            <thead><tr>${cabecalhos.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${linhas}</tbody></table></div>`
      : `<div class="text-sm text-muted" style="padding:10px;">${vazio}</div>`;

    return `
      ${bloco(
        `<span class="badge ${c.ativo ? 'badge-sucesso' : 'badge-neutro'}">${c.ativo ? '● ligado' : '○ desligado'}</span> Calendário desta obra`,
        c.ativo
          ? `Datas e durações contam <b>dias úteis</b>: ${Calendario.resumoJornada(c)}. ${c.aplicado ? 'As datas do cronograma já foram recalculadas com esta régua.' : '<b style="color:var(--cor-alerta);">As datas salvas ainda estão em dias corridos</b> — abra o Planejamento e use "Aplicar Calendário às Datas".'}`
          : 'Enquanto está desligado, o sistema conta <b>dias corridos</b> — exatamente como sempre contou. Nenhuma data muda ao ligar: o recálculo é um passo separado, com simulação antes.',
        `<button class="btn ${c.ativo ? 'btn-perigo' : 'btn-primario'} btn-sm" ${podeEditar ? '' : 'disabled'} onclick="ConfiguracaoObra.calToggleAtivo()">${c.ativo ? 'Desligar calendário' : 'Ligar calendário'}</button>`
      )}

      ${bloco('Jornada semanal', 'Cada clique cicla três estados: não trabalha → dia inteiro → meio período (½). Um dia de meio período é dia de obra, mas rende meia jornada na contagem de duração.',
        `<div style="display:flex;gap:6px;flex-wrap:wrap;">${diasBtns}</div>
         <div class="text-sm text-muted" style="font-size:.74rem;margin-top:8px;">Jornada atual: <b style="color:var(--cor-texto);">${Calendario.resumoJornada(c)}</b></div>`)}

      ${bloco('Feriados', 'Os nacionais são calculados automaticamente (inclusive os móveis, derivados da Páscoa). Estadual e municipal você cadastra aqui.',
        `<div style="margin-bottom:12px;">
          ${chk(c.trabalhaFeriado, 'calToggle(\'trabalhaFeriado\')', 'A obra trabalha em feriado', 'Ligado, feriado passa a ser dia útil — exceto onde houver exceção pontual')}
          ${chk(c.feriadosAuto, 'calToggle(\'feriadosAuto\')', 'Gerar feriados nacionais', 'Desligado, só valem os feriados que você cadastrar na mão')}
        </div>
        <div style="margin-bottom:12px;">
          <div class="text-sm text-muted" style="font-size:.75rem;margin-bottom:5px;">Ponto facultativo — marcado significa que a obra PARA:</div>
          ${chk(c.facultativos.carnaval, 'calToggleFacultativo(\'carnaval\')', 'Carnaval (seg e ter)', 'Carnaval não é feriado nacional por lei, é ponto facultativo')}
          ${chk(c.facultativos.corpusChristi, 'calToggleFacultativo(\'corpusChristi\')', 'Corpus Christi', 'Corpus Christi não é feriado nacional por lei, é ponto facultativo')}
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
          <button class="btn btn-secundario btn-sm" onclick="ConfiguracaoObra.calMudarAno(-1)">←</button>
          <b style="font-size:.85rem;color:var(--cor-texto);">${calAnoVisivel}</b>
          <button class="btn btn-secundario btn-sm" onclick="ConfiguracaoObra.calMudarAno(1)">→</button>
          ${podeEditar ? `<span style="margin-left:auto;display:flex;gap:6px;align-items:center;">
            <input type="date" id="cal-fer-data" class="form-control" style="width:150px;font-size:.72rem;">
            <input type="text" id="cal-fer-nome" class="form-control" placeholder="Nome (ex: São João)" style="width:180px;font-size:.72rem;">
            <button class="btn btn-primario btn-sm" onclick="ConfiguracaoObra.calAddFeriado()">+ Feriado</button>
          </span>` : ''}
        </div>
        ${tabela(['Data', 'Feriado', 'Tipo', ''], linhasFer, 'Nenhum feriado neste ano.')}`)}

      ${bloco('Paralisações', 'Faixa de dias parados: recesso, período de chuva, interdição. Uma exceção pontual ainda vence a paralisação — dá pra trabalhar um dia no meio dela.',
        `${podeEditar ? `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px;">
          <input type="date" id="cal-par-ini" class="form-control" style="width:150px;font-size:.72rem;">
          <span class="text-muted">→</span>
          <input type="date" id="cal-par-fim" class="form-control" style="width:150px;font-size:.72rem;">
          <input type="text" id="cal-par-motivo" class="form-control" placeholder="Motivo" style="width:200px;font-size:.72rem;">
          <button class="btn btn-primario btn-sm" onclick="ConfiguracaoObra.calAddParalisacao()">+ Paralisação</button>
        </div>` : ''}
        ${tabela(['Período', 'Motivo', ''], linhasPar, 'Nenhuma paralisação cadastrada.')}`)}

      ${bloco('Exceções por data', 'Manda em tudo — feriado, paralisação e jornada. Serve nos dois sentidos: um domingo que a obra trabalha, ou uma terça que ela para.',
        `${podeEditar ? `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px;">
          <input type="date" id="cal-exc-data" class="form-control" style="width:150px;font-size:.72rem;">
          <select id="cal-exc-tipo" class="form-control" style="width:190px;font-size:.72rem;">
            <option value="0">não trabalha neste dia</option>
            <option value="1">trabalha mesmo assim</option>
          </select>
          <input type="text" id="cal-exc-motivo" class="form-control" placeholder="Motivo" style="width:200px;font-size:.72rem;">
          <button class="btn btn-primario btn-sm" onclick="ConfiguracaoObra.calAddExcecao()">+ Exceção</button>
        </div>` : ''}
        ${tabela(['Data', 'Efeito', 'Motivo', ''], linhasExc, 'Nenhuma exceção cadastrada.')}`)}

      ${bloco('Prévia — ' + calAnoVisivel, 'Confira de olho antes de ligar. Cinza = dia não trabalhado, com o motivo no passar do mouse.', _previaAno())}
    `;
  }

  // Grade dos 12 meses do ano visível, pintando o que não é dia de obra. É a
  // conferência visual: se um mês inteiro ficou cinza, o erro está na jornada.
  // Cada dia é clicável e cria/remove exceção — é o caminho mais curto pra
  // "esse domingo a obra trabalha" sem passar por formulário.
  function _previaAno() {
    const c = _cal();
    const podeEditar = Permissions.pode('configuracaoObra', 'editar:calendario');
    if (!c.ativo) return '<div class="text-sm text-muted">Ligue o calendário para ver a prévia.</div>';
    const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    // Grade de calendário de verdade: 7 colunas fixas, Dom a Sáb, e o dia 1 cai
    // na coluna do dia da semana correto. Antes os dias vinham enfileirados e não
    // dava pra saber em que dia da semana cada número caía.
    const GRADE = 'display:grid;grid-template-columns:repeat(7,20px);gap:2px;';
    const cabecalho = [0, 1, 2, 3, 4, 5, 6].map(d =>
      `<div style="text-align:center;font-size:.56rem;font-weight:700;text-transform:uppercase;color:${c.jornada.includes(d) ? 'var(--cor-texto-secundario)' : 'var(--cor-texto-muted)'};">${Calendario.nomeDiaSemana(d)}</div>`
    ).join('');

    let html = '<div style="display:flex;gap:12px;flex-wrap:wrap;">';
    for (let m = 1; m <= 12; m++) {
      const ultimo = new Date(calAnoVisivel, m, 0).getDate();
      const offset = new Date(calAnoVisivel, m - 1, 1).getDay(); // 0=dom: quantas células vazias antes do dia 1
      let dias = offset ? `<div style="grid-column:span ${offset};"></div>` : '';
      let uteis = 0;
      for (let d = 1; d <= ultimo; d++) {
        const data = `${calAnoVisivel}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const motivo = Calendario.motivoNaoUtil(data, c);
        const cap = Calendario.capacidade(data, c);
        const temExcecao = c.excecoes.some(e => e.data === data);
        uteis += cap;
        const dica = `${_fd(data)} (${Calendario.nomeDiaSemana(Calendario.diaSemanaDe(data), true)})`
          + (motivo ? ' — ' + motivo : cap === 0.5 ? ' — meio período' : ' — dia útil')
          + (podeEditar ? (temExcecao ? '\nExceção manual. Clique para voltar ao padrão.' : `\nClique para ${motivo ? 'trabalhar' : 'parar'} neste dia.`) : '');
        // Meio período recebe um degradê: metade amarela, metade cinza — dá pra
        // ver de longe qual coluna rende meia jornada.
        const fundo = motivo ? 'var(--cor-neutro-bg)'
          : cap === 0.5 ? 'linear-gradient(180deg,var(--cor-primaria) 50%,var(--cor-neutro-bg) 50%)'
            : 'var(--cor-primaria)';
        dias += `<div title="${_esc(dica)}" ${podeEditar ? `onclick="ConfiguracaoObra.calCliqueDia('${data}')"` : ''}
          style="height:20px;line-height:20px;text-align:center;font-size:.6rem;font-weight:600;border-radius:3px;${podeEditar ? 'cursor:pointer;' : ''}
          background:${fundo};color:${motivo ? 'var(--cor-texto-muted)' : 'var(--cor-dark-900)'};
          ${temExcecao ? 'box-shadow:0 0 0 2px var(--cor-info);' : ''}">${d}</div>`;
      }
      html += `<div style="border:1.5px solid var(--cor-borda-light);border-radius:8px;padding:10px;background:var(--cor-fundo-card);">
        <div style="font-size:.76rem;font-weight:700;margin-bottom:6px;color:var(--cor-texto);">${MESES[m - 1]}
          <span class="text-muted" style="font-weight:400;">· ${String(uteis).replace('.', ',')} úteis</span></div>
        <div style="${GRADE}margin-bottom:3px;">${cabecalho}</div>
        <div style="${GRADE}">${dias}</div></div>`;
    }
    html += '</div>';

    const leg = (estilo, rotulo) => `<span style="display:inline-flex;align-items:center;gap:5px;font-size:.7rem;color:var(--cor-texto-secundario);">
      <span style="width:14px;height:14px;border-radius:3px;${estilo}"></span>${rotulo}</span>`;
    return `<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px;">
        ${leg('background:var(--cor-primaria);', 'dia de obra')}
        ${leg('background:linear-gradient(180deg,var(--cor-primaria) 50%,var(--cor-neutro-bg) 50%);', 'meio período')}
        ${leg('background:var(--cor-neutro-bg);', 'parado')}
        ${leg('background:var(--cor-primaria);box-shadow:0 0 0 2px var(--cor-info);', 'exceção manual')}
        ${podeEditar ? '<span class="text-muted" style="font-size:.7rem;">Clique num dia para inverter · clique de novo para voltar ao padrão</span>' : ''}
      </div>${html}`;
  }

  // Toda mutação passa por aqui: grava, recarrega e redesenha. Se a definição
  // mudou, Calendario.salvar zera o `aplicado` sozinho — então o aviso de
  // "datas ainda em dias corridos" volta a aparecer no Planejamento.
  async function _calSalvar(mut) {
    if (!Permissions.pode('configuracaoObra', 'editar:calendario')) { Utils.toast('Sem permissão.', 'erro'); return; }
    const c = _cal();
    try {
      if (mut(c) === false) return; // mutação abortou (duplicata, regra violada) — não grava nem avisa "salvo"
      calendario = await Calendario.salvar(obraId, c);
      renderizar();
      Utils.toast('Calendário salvo.', 'sucesso');
    } catch (e) {
      console.error('[Calendario]', e);
      Utils.toast('Erro ao salvar o calendário.', 'erro');
      await carregar();
    }
  }

  function calToggleAtivo() {
    const c = _cal();
    if (!c.ativo && !c.jornada.length) { Utils.toast('Escolha ao menos um dia de trabalho na jornada antes de ligar.', 'alerta'); return; }
    _calSalvar(x => { x.ativo = !x.ativo; });
  }

  // Clique no dia da semana cicla três estados: não trabalha → dia inteiro →
  // meio período → não trabalha. Meio período existe porque muita obra trabalha
  // sábado até o meio-dia, e contar esse sábado como dia cheio infla o cronograma.
  function calToggleDia(d) {
    _calSalvar(x => {
      const trabalha = x.jornada.includes(d);
      const meio = x.jornadaMeio.includes(d);
      if (!trabalha) { x.jornada.push(d); return; }                       // não trabalha → inteiro
      if (!meio) { x.jornadaMeio.push(d); return; }                       // inteiro → meio período
      if (x.jornada.length === 1) { Utils.toast('A obra precisa de pelo menos um dia de trabalho.', 'alerta'); return false; }
      x.jornada = x.jornada.filter(v => v !== d);                         // meio → não trabalha
      x.jornadaMeio = x.jornadaMeio.filter(v => v !== d);
    });
  }

  // Clique num dia da prévia: cria a exceção que inverte aquele dia, ou remove a
  // exceção que já existe (voltando ao padrão da jornada). É o caminho curto pra
  // "esse domingo a gente trabalha" sem preencher formulário.
  function calCliqueDia(data) {
    const y = window.scrollY;
    _calSalvar(x => {
      const i = x.excecoes.findIndex(e => e.data === data);
      if (i >= 0) { x.excecoes.splice(i, 1); return; }
      const util = Calendario.ehDiaUtil(data, x);
      x.excecoes.push({ data, trabalha: !util, motivo: '' });
    }).then(() => window.scrollTo(0, y)); // a prévia fica no fim da página: sem isso o clique joga o scroll pro topo
  }
  function calToggle(campo) { _calSalvar(x => { x[campo] = !x[campo]; }); }
  function calToggleFacultativo(chave) { _calSalvar(x => { x.facultativos[chave] = !x.facultativos[chave]; }); }
  function calMudarAno(delta) { calAnoVisivel += delta; renderizar(); }

  function calAddFeriado() {
    const data = (document.getElementById('cal-fer-data') || {}).value || '';
    const nome = ((document.getElementById('cal-fer-nome') || {}).value || '').trim();
    if (!data) { Utils.toast('Informe a data do feriado.', 'alerta'); return; }
    _calSalvar(x => {
      if (x.feriadosManuais.some(f => f.data === data)) { Utils.toast('Já existe feriado cadastrado nesta data.', 'alerta'); return false; }
      x.feriadosManuais.push({ data, nome: nome || 'Feriado', tipo: 'municipal' });
    });
  }
  function calRemoverFeriado(data) { _calSalvar(x => { x.feriadosManuais = x.feriadosManuais.filter(f => f.data !== data); }); }

  function calAddParalisacao() {
    const ini = (document.getElementById('cal-par-ini') || {}).value || '';
    const fim = (document.getElementById('cal-par-fim') || {}).value || '';
    const motivo = ((document.getElementById('cal-par-motivo') || {}).value || '').trim();
    if (!ini || !fim) { Utils.toast('Informe início e fim da paralisação.', 'alerta'); return; }
    if (fim < ini) { Utils.toast('O fim não pode ser antes do início.', 'alerta'); return; }
    _calSalvar(x => { x.paralisacoes.push({ ini, fim, motivo }); });
  }
  function calRemoverParalisacao(i) { _calSalvar(x => { x.paralisacoes.splice(i, 1); }); }

  function calAddExcecao() {
    const data = (document.getElementById('cal-exc-data') || {}).value || '';
    const trabalha = ((document.getElementById('cal-exc-tipo') || {}).value || '0') === '1';
    const motivo = ((document.getElementById('cal-exc-motivo') || {}).value || '').trim();
    if (!data) { Utils.toast('Informe a data da exceção.', 'alerta'); return; }
    _calSalvar(x => {
      x.excecoes = x.excecoes.filter(e => e.data !== data); // uma exceção por data
      x.excecoes.push({ data, trabalha, motivo });
    });
  }
  function calRemoverExcecao(data) { _calSalvar(x => { x.excecoes = x.excecoes.filter(e => e.data !== data); }); }

  return { init, carregar, renderizar, abrirForm, editarItem, salvarItem, excluirItem,
    calToggleAtivo, calToggleDia, calCliqueDia, calToggle, calToggleFacultativo, calMudarAno,
    calAddFeriado, calRemoverFeriado, calAddParalisacao, calRemoverParalisacao,
    calAddExcecao, calRemoverExcecao };
})();

// Callback quando muda obra na sidebar
function onObraChanged() {
  ConfiguracaoObra.init();
}
