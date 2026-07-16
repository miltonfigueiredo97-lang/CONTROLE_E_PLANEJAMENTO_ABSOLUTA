// ============================================
// Módulo: Tarefas do Sistema (To Do List)
// Coleção raiz "tarefasSistema" (não vinculada a obra).
// Lista pessoal de organização/roadmap — pode ser alimentada
// tanto pelo sistema quanto por fora (ex: chat de planejamento).
// ============================================
const Todo = (() => {
  const COL = 'tarefasSistema';
  let tarefas = [];
  let filtroProjeto = '';
  let mostrarConcluidas = false;

  // Paleta de cores cíclica para identificar projetos visualmente
  // (não usa o amarelo da marca, que fica reservado pro progresso/CTA).
  const PALETA_PROJETO = ['#2563eb', '#16a34a', '#7c3aed', '#d97706', '#0891b2', '#dc2626', '#db2777'];

  function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function corProjeto(nome) {
    if (!nome) return '#9ca3af';
    let hash = 0;
    for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) >>> 0;
    return PALETA_PROJETO[hash % PALETA_PROJETO.length];
  }

  async function init() {
    const ok = await Utils.initPagina();
    if (!ok) return;
    garantirEstilos();
    await carregar();
    await seedInicial();
    renderizar();
  }

  // Popula a lista, uma única vez, com o backlog atual combinado no
  // chat de planejamento (só roda se a coleção estiver vazia e o
  // navegador ainda não tiver feito o seed).
  async function seedInicial() {
    if (tarefas.length > 0) return;
    if (localStorage.getItem('todo_seed_v1')) return;
    const backlog = [
      { texto: 'Finalizar Levantamento de Fachada: adicionar Shaft no miolo central', projeto: 'Sistema Absoluta' },
      { texto: 'Finalizar Levantamento de Fachada: campo "tipo" por peça (ex: beiral) para filtrar/testar valores isolados por tipo — opções 1,2,3,4 pedidas pelo Gabriel', projeto: 'Sistema Absoluta' },
      { texto: 'Tela principal: mostrar atividades em execução/próximas (visão obra e visão torre/apartamento), com acesso ao campo de conclusão', projeto: 'Sistema Absoluta' },
      { texto: 'Edição da obra: tela para cadastrar áreas, apartamentos, etc.', projeto: 'Sistema Absoluta' },
      { texto: 'Levantamento de material hidráulico por apartamento: Esgoto', projeto: 'Sistema Absoluta' },
      { texto: 'Levantamento de material hidráulico por apartamento: Água quente/fria', projeto: 'Sistema Absoluta' },
      { texto: 'Levantamento de material hidráulico por apartamento: Prumadas', projeto: 'Sistema Absoluta' },
      { texto: 'Levantamento de material hidráulico por apartamento: Registros', projeto: 'Sistema Absoluta' },
      { texto: 'Levantamento de material hidráulico por apartamento: Gás', projeto: 'Sistema Absoluta' },
      { texto: 'Levantamento de material hidráulico por apartamento: Ar condicionado (aspiração central)', projeto: 'Sistema Absoluta' },
      { texto: 'Vínculo de metragem quadrada: separar valor de material e de mão de obra (mão de obra paga vãos, material não)', projeto: 'Sistema Absoluta' },
      { texto: 'Vínculos: incluir Gesso e Ar Condicionado nas possibilidades, além de paredes', projeto: 'Sistema Absoluta' },
      { texto: 'Controle de Solo Grampeado — execução e levantamento', projeto: 'Sistema Absoluta' },
      { texto: 'Controle de Estacas — execução e levantamento', projeto: 'Sistema Absoluta' },
      { texto: 'Portar planilha do Patrick: nome, obra, função, salário base, produção e valor, detalhe do serviço, bônus fixo/variável, motivo, faltas e horas extras', projeto: 'Planilha Patrick' },
    ];
    let ordem = 1;
    for (const item of backlog) {
      const id = await Database.criarRaiz(COL, { texto: item.texto, projeto: item.projeto, concluida: false, ordem });
      tarefas.push({ id, texto: item.texto, projeto: item.projeto, concluida: false, ordem });
      ordem++;
    }
    localStorage.setItem('todo_seed_v1', '1');
  }

  async function carregar() {
    tarefas = await Database.listarRaiz(COL, 'ordem', 'asc');
  }

  function projetosExistentes() {
    const set = new Set(tarefas.map(t => t.projeto).filter(Boolean));
    ['Sistema Absoluta', 'Planilha Patrick'].forEach(p => set.add(p));
    return [...set].sort();
  }

  function garantirEstilos() {
    if (document.getElementById('todo-styles')) return;
    const style = document.createElement('style');
    style.id = 'todo-styles';
    style.textContent = `
      .todo-topo { display:flex; gap:18px; align-items:stretch; flex-wrap:wrap; margin-bottom:18px; }
      .todo-progresso-card {
        flex:1; min-width:260px; background:var(--cor-dark-900); border-radius:var(--borda-radius-lg);
        padding:18px 22px; color:#fff; display:flex; flex-direction:column; justify-content:center; gap:10px;
      }
      .todo-progresso-topo { display:flex; justify-content:space-between; align-items:baseline; }
      .todo-progresso-numero { font-size:26px; font-weight:800; letter-spacing:-.5px; }
      .todo-progresso-numero span { font-size:14px; font-weight:600; color:#bbb; margin-left:4px; }
      .todo-progresso-pct { font-size:13px; font-weight:700; color:var(--cor-primaria); }
      .todo-progresso-track { height:8px; border-radius:999px; background:rgba(255,255,255,.12); overflow:hidden; }
      .todo-progresso-fill { height:100%; border-radius:999px; background:linear-gradient(90deg,var(--cor-primaria-dark),var(--cor-primaria)); transition:width .5s cubic-bezier(.4,0,.2,1); }
      .todo-progresso-legenda { font-size:12px; color:#999; }

      .todo-addbar {
        flex:2; min-width:320px; display:flex; gap:8px; align-items:center; background:#fff;
        border:1.5px solid var(--cor-borda); border-radius:var(--borda-radius-lg); padding:8px 8px 8px 16px;
        box-shadow:0 1px 2px rgba(0,0,0,.03);
      }
      .todo-addbar:focus-within { border-color:var(--cor-primaria); box-shadow:0 0 0 3px var(--cor-primaria-light); }
      .todo-addbar input[type=text] { border:none; outline:none; background:transparent; font-size:14.5px; font-family:var(--font-principal); }
      .todo-addbar-texto { flex:1; min-width:120px; }
      .todo-addbar-projeto { width:150px; border-left:1.5px solid var(--cor-borda-light) !important; padding-left:10px !important; color:var(--cor-texto-secundario); }
      .todo-addbar button { flex-shrink:0; white-space:nowrap; }

      .todo-filtros { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:18px; }
      .todo-chip {
        padding:6px 14px; border-radius:999px; font-size:12.5px; font-weight:600; border:1.5px solid var(--cor-borda);
        background:#fff; cursor:pointer; color:var(--cor-texto-secundario); display:inline-flex; align-items:center;
        gap:7px; transition:.15s; user-select:none;
      }
      .todo-chip:hover { border-color:var(--cor-dark-900); color:var(--cor-texto); }
      .todo-chip.ativo { background:var(--cor-dark-900); border-color:var(--cor-dark-900); color:#fff; }
      .todo-chip-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
      .todo-chip-count { background:rgba(0,0,0,.07); border-radius:999px; padding:1px 7px; font-size:11px; font-weight:700; }
      .todo-chip.ativo .todo-chip-count { background:rgba(255,255,255,.2); }

      .todo-grupo { margin-bottom:22px; }
      .todo-grupo-header { display:flex; align-items:center; gap:9px; margin-bottom:9px; padding-left:2px; }
      .todo-grupo-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
      .todo-grupo-titulo { font-size:12.5px; font-weight:800; text-transform:uppercase; letter-spacing:.6px; color:var(--cor-texto-secundario); }
      .todo-grupo-count { font-size:12px; color:var(--cor-texto-muted); font-weight:600; }

      .todo-lista { display:flex; flex-direction:column; gap:7px; }
      .todo-item {
        display:flex; align-items:flex-start; gap:12px; background:#fff; border:1.5px solid var(--cor-borda-light);
        border-radius:var(--borda-radius); padding:12px 12px 12px 14px; transition:.15s; position:relative;
        border-left-width:3px;
      }
      .todo-item:hover { border-color:var(--cor-borda); box-shadow:0 2px 10px rgba(0,0,0,.06); transform:translateY(-1px); }
      .todo-item.concluida { opacity:.55; background:var(--cor-fundo); }
      .todo-item.concluida:hover { transform:none; box-shadow:none; }

      .todo-check {
        width:22px; height:22px; border-radius:50%; border:2px solid var(--cor-borda); flex-shrink:0; cursor:pointer;
        display:flex; align-items:center; justify-content:center; transition:.15s; margin-top:1px; background:#fff;
      }
      .todo-check:hover { border-color:var(--cor-primaria-dark); }
      .todo-check.marcado { background:var(--cor-sucesso); border-color:var(--cor-sucesso); }
      .todo-check svg { width:12px; height:12px; opacity:0; transform:scale(.4); transition:.15s; }
      .todo-check.marcado svg { opacity:1; transform:scale(1); }

      .todo-corpo { flex:1; min-width:0; }
      .todo-texto {
        font-size:14.5px; color:var(--cor-texto); line-height:1.45; word-break:break-word; cursor:text;
        padding:2px 4px; margin:-2px -4px; border-radius:4px;
      }
      .todo-texto:hover { background:var(--cor-fundo); }
      .todo-item.concluida .todo-texto { text-decoration:line-through; color:var(--cor-texto-muted); }
      .todo-texto-input { width:100%; font-size:14.5px; font-family:var(--font-principal); padding:5px 8px; border-radius:6px; border:1.5px solid var(--cor-primaria); outline:none; }

      .todo-acoes { display:flex; gap:1px; opacity:0; transition:.15s; flex-shrink:0; }
      .todo-item:hover .todo-acoes { opacity:1; }
      .todo-acao-btn {
        width:27px; height:27px; border:none; background:transparent; border-radius:6px; cursor:pointer;
        display:flex; align-items:center; justify-content:center; color:var(--cor-texto-muted); font-size:13px;
      }
      .todo-acao-btn:hover { background:var(--cor-fundo); color:var(--cor-texto); }
      .todo-acao-btn:disabled { opacity:.2; cursor:default; }
      .todo-acao-btn:disabled:hover { background:transparent; }

      .todo-concluidas-toggle {
        display:flex; align-items:center; gap:7px; padding:12px 4px; cursor:pointer; color:var(--cor-texto-secundario);
        font-size:13px; font-weight:700; border-top:1.5px solid var(--cor-borda-light); margin-top:6px; user-select:none;
      }
      .todo-concluidas-toggle:hover { color:var(--cor-texto); }
      .todo-concluidas-toggle .seta { transition:.2s; display:inline-block; }
      .todo-concluidas-toggle.aberto .seta { transform:rotate(90deg); }

      .todo-vazio { text-align:center; padding:44px 20px; color:var(--cor-texto-muted); }
      .todo-vazio .icone { font-size:34px; margin-bottom:10px; }

      @media (max-width:720px) {
        .todo-topo { flex-direction:column; }
        .todo-addbar { flex-wrap:wrap; }
        .todo-addbar-projeto { width:100%; border-left:none !important; padding-left:0 !important; border-top:1.5px solid var(--cor-borda-light); padding-top:8px !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function renderizar() {
    const container = document.getElementById('modulo-content');
    if (!container) return;

    const todosProjetos = projetosExistentes();
    const pendentesTodas = tarefas.filter(t => !t.concluida);
    const concluidasTodas = tarefas.filter(t => t.concluida);

    const pendentes = pendentesTodas.filter(t => !filtroProjeto || t.projeto === filtroProjeto)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const concluidas = concluidasTodas.filter(t => !filtroProjeto || t.projeto === filtroProjeto)
      .sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));

    const totalFiltrado = pendentes.length + concluidas.length;
    const pct = totalFiltrado > 0 ? Math.round((concluidas.length / totalFiltrado) * 100) : 0;

    // Agrupa pendentes por projeto (mantendo ordem alfabética; sem projeto por último)
    const grupos = new Map();
    pendentes.forEach(t => {
      const chave = t.projeto || '';
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(t);
    });
    const chavesOrdenadas = [...grupos.keys()].sort((a, b) => {
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b, 'pt-BR');
    });

    container.innerHTML = `
      <div class="page-header">
        <div><h2>Tarefas do Sistema</h2><span class="subtitulo">Organização e roadmap do sistema</span></div>
      </div>

      <div class="todo-topo">
        <div class="todo-progresso-card">
          <div class="todo-progresso-topo">
            <div class="todo-progresso-numero">${concluidas.length}<span>/ ${totalFiltrado} concluídas</span></div>
            <div class="todo-progresso-pct">${pct}%</div>
          </div>
          <div class="todo-progresso-track"><div class="todo-progresso-fill" style="width:${pct}%"></div></div>
          <div class="todo-progresso-legenda">${pendentes.length} tarefa${pendentes.length === 1 ? '' : 's'} pendente${pendentes.length === 1 ? '' : 's'}${filtroProjeto ? ` em "${esc(filtroProjeto)}"` : ''}</div>
        </div>

        <form id="form-nova-tarefa" class="todo-addbar">
          <input type="text" id="todo-texto" class="todo-addbar-texto" placeholder="+ Adicionar tarefa..." required>
          <input type="text" id="todo-projeto" class="todo-addbar-projeto" list="todo-projetos-lista" placeholder="Projeto">
          <datalist id="todo-projetos-lista">
            ${todosProjetos.map(p => `<option value="${esc(p)}">`).join('')}
          </datalist>
          <button type="submit" class="btn btn-primario">Adicionar</button>
        </form>
      </div>

      <div class="todo-filtros">
        <div class="todo-chip ${!filtroProjeto ? 'ativo' : ''}" data-projeto="">
          Todas <span class="todo-chip-count">${pendentesTodas.length}</span>
        </div>
        ${todosProjetos.map(p => `
          <div class="todo-chip ${filtroProjeto === p ? 'ativo' : ''}" data-projeto="${esc(p)}">
            <span class="todo-chip-dot" style="background:${corProjeto(p)}"></span>
            ${esc(p)}
            <span class="todo-chip-count">${pendentesTodas.filter(t => t.projeto === p).length}</span>
          </div>
        `).join('')}
      </div>

      <div id="todo-grupos">
        ${pendentes.length === 0
          ? `<div class="todo-vazio"><div class="icone">✅</div><p>${filtroProjeto ? 'Nenhuma tarefa pendente neste projeto.' : 'Nenhuma tarefa pendente. Tudo em dia!'}</p></div>`
          : chavesOrdenadas.map(chave => {
              const itens = grupos.get(chave).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
              const nomeGrupo = chave || 'Sem projeto';
              return `
                <div class="todo-grupo">
                  <div class="todo-grupo-header">
                    <span class="todo-grupo-dot" style="background:${corProjeto(chave)}"></span>
                    <span class="todo-grupo-titulo">${esc(nomeGrupo)}</span>
                    <span class="todo-grupo-count">${itens.length}</span>
                  </div>
                  <div class="todo-lista">
                    ${itens.map((t, i) => linhaTarefa(t, i, itens.length, chave)).join('')}
                  </div>
                </div>`;
            }).join('')}
      </div>

      <div class="todo-concluidas-toggle ${mostrarConcluidas ? 'aberto' : ''}" id="todo-toggle-concluidas">
        <span class="seta">▶</span> ${mostrarConcluidas ? 'Ocultar' : 'Mostrar'} concluídas (${concluidas.length})
      </div>
      ${mostrarConcluidas ? `
        <div class="todo-lista" id="todo-lista-concluidas" style="margin-top:4px;">
          ${concluidas.length === 0
            ? `<p class="text-sm text-muted" style="padding:8px 4px;">Nenhuma tarefa concluída ${filtroProjeto ? 'neste projeto' : ''} ainda.</p>`
            : concluidas.map(t => linhaTarefa(t, 0, 0, t.projeto || '')).join('')}
        </div>
      ` : ''}
    `;

    document.getElementById('form-nova-tarefa').addEventListener('submit', async (e) => {
      e.preventDefault();
      const texto = document.getElementById('todo-texto').value.trim();
      const projeto = document.getElementById('todo-projeto').value.trim();
      if (!texto) return;
      await adicionar(texto, projeto);
    });
    container.querySelectorAll('.todo-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        filtroProjeto = chip.dataset.projeto;
        renderizar();
      });
    });
    document.getElementById('todo-toggle-concluidas').addEventListener('click', () => {
      mostrarConcluidas = !mostrarConcluidas;
      renderizar();
    });
  }

  function linhaTarefa(t, idx, total, chaveGrupo) {
    const concluida = !!t.concluida;
    const cor = corProjeto(chaveGrupo);
    const check = `
      <svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    return `
      <div class="todo-item ${concluida ? 'concluida' : ''}" style="border-left-color:${cor};">
        <div class="todo-check ${concluida ? 'marcado' : ''}" onclick="Todo.alternarStatus('${t.id}')">${check}</div>
        <div class="todo-corpo">
          <div id="texto-${t.id}" class="todo-texto" ondblclick="Todo.editarTexto('${t.id}')">${esc(t.texto)}</div>
        </div>
        ${!concluida ? `
        <div class="todo-acoes">
          <button class="todo-acao-btn" title="Subir" onclick="Todo.mover('${t.id}',-1)" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button class="todo-acao-btn" title="Descer" onclick="Todo.mover('${t.id}',1)" ${idx === total - 1 ? 'disabled' : ''}>↓</button>
          <button class="todo-acao-btn" title="Editar" onclick="Todo.editarTexto('${t.id}')">✎</button>
          <button class="todo-acao-btn" title="Excluir" onclick="Todo.excluir('${t.id}')">🗑</button>
        </div>` : `
        <div class="todo-acoes">
          <button class="todo-acao-btn" title="Excluir" onclick="Todo.excluir('${t.id}')">🗑</button>
        </div>`}
      </div>`;
  }

  async function adicionar(texto, projeto) {
    const maxOrdem = tarefas.reduce((m, t) => Math.max(m, t.ordem || 0), 0);
    const id = await Database.criarRaiz(COL, {
      texto, projeto: projeto || '', concluida: false, ordem: maxOrdem + 1
    });
    tarefas.push({ id, texto, projeto: projeto || '', concluida: false, ordem: maxOrdem + 1 });
    Utils.toast('Tarefa adicionada.', 'sucesso');
    renderizar();
  }

  async function alternarStatus(id) {
    const t = tarefas.find(x => x.id === id);
    if (!t) return;
    t.concluida = !t.concluida;
    t.updatedAtMs = Date.now();
    await Database.atualizarRaiz(COL, id, { concluida: t.concluida });
    renderizar();
  }

  function editarTexto(id) {
    const t = tarefas.find(x => x.id === id);
    if (!t) return;
    const div = document.getElementById(`texto-${id}`);
    if (!div) return;
    const atual = t.texto;
    div.outerHTML = `<input type="text" id="texto-${id}" class="todo-texto-input" value="${esc(atual)}">`;
    const input = document.getElementById(`texto-${id}`);
    input.focus();
    input.select();
    const salvar = async () => {
      const novo = input.value.trim();
      if (novo && novo !== atual) {
        t.texto = novo;
        await Database.atualizarRaiz(COL, id, { texto: novo });
      }
      renderizar();
    };
    input.addEventListener('blur', salvar);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { input.removeEventListener('blur', salvar); renderizar(); }
    });
  }

  async function excluir(id) {
    if (!confirm('Excluir esta tarefa?')) return;
    await Database.deletarRaiz(COL, id);
    tarefas = tarefas.filter(t => t.id !== id);
    Utils.toast('Tarefa excluída.', 'info');
    renderizar();
  }

  async function mover(id, direcao) {
    const t0 = tarefas.find(x => x.id === id);
    if (!t0) return;
    const chave = t0.projeto || '';
    const doGrupo = tarefas.filter(t => !t.concluida && (t.projeto || '') === chave)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const i = doGrupo.findIndex(t => t.id === id);
    const j = i + direcao;
    if (i < 0 || j < 0 || j >= doGrupo.length) return;
    const a = doGrupo[i], b = doGrupo[j];
    const ordemA = a.ordem, ordemB = b.ordem;
    a.ordem = ordemB; b.ordem = ordemA;
    await Database.atualizarRaiz(COL, a.id, { ordem: a.ordem });
    await Database.atualizarRaiz(COL, b.id, { ordem: b.ordem });
    renderizar();
  }

  return { init, alternarStatus, editarTexto, excluir, mover };
})();
