// ============================================
// Módulo: Tarefas do Sistema (To Do List)
// Coleções raiz (não vinculadas a obra):
//   tarefasSistema   { texto, projeto, categoria, dependencia, concluida, ordem, importancia, updatedAtMs }
//   todoProjetos     { nome, importancia }
//   todoCategorias   { nome, cor, importancia }
// Acesso oculto do menu lateral — só quem tem o link direto (todo.html) chega aqui.
// ============================================
const Todo = (() => {
  const COL = 'tarefasSistema';
  const COL_PROJ = 'todoProjetos';
  const COL_CAT = 'todoCategorias';

  let tarefas = [];
  let projetos = [];   // [{id, nome, importancia}]
  let categorias = []; // [{id, nome, cor, importancia}]

  let filtroProjeto = '';
  let filtroCategoria = '';
  let filtroDependencia = '';
  let busca = '';
  let mostrarConcluidas = false;
  let editandoCategoriaId = null;
  let editandoProjetoId = null;

  const PALETA_PROJETO = ['#2563eb', '#16a34a', '#7c3aed', '#d97706', '#0891b2', '#dc2626', '#db2777'];
  const SWATCHES = ['#F5C800', '#2563eb', '#16a34a', '#7c3aed', '#d97706', '#dc2626', '#0891b2', '#db2777', '#059669', '#4f46e5', '#ea580c', '#64748b'];
  const IMPORTANCIA_LABEL = { 1: '🔴 Urgente', 2: '🟠 Alta', 3: '🟡 Média', 4: '⚪ Baixa' };

  function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function corProjeto(nome) {
    if (!nome) return '#9ca3af';
    let hash = 0;
    for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) >>> 0;
    return PALETA_PROJETO[hash % PALETA_PROJETO.length];
  }

  function mapaProjetos() { return new Map(projetos.map(p => [p.nome, p])); }
  function mapaCategorias() { return new Map(categorias.map(c => [c.nome, c])); }

  async function init() {
    const ok = await Utils.initPagina();
    if (!ok) return;
    garantirEstilos();
    await carregarTudo();
    await seedInicial();
    await reconciliarProjetosAusentes();
    renderizar();
  }

  async function carregarTudo() {
    [tarefas, projetos, categorias] = await Promise.all([
      Database.listarRaiz(COL, 'ordem', 'asc'),
      Database.listarRaiz(COL_PROJ).catch(() => []),
      Database.listarRaiz(COL_CAT).catch(() => [])
    ]);
  }

  // Garante que todo projeto referenciado por alguma tarefa exista
  // como entidade própria (pra poder ser rankeado), mesmo tarefas
  // antigas que só tinham o nome em texto livre.
  async function reconciliarProjetosAusentes() {
    const nomesExistentes = new Set(projetos.map(p => p.nome));
    const nomesUsados = new Set(tarefas.map(t => t.projeto).filter(Boolean));
    for (const nome of nomesUsados) {
      if (!nomesExistentes.has(nome)) {
        const id = await Database.criarRaiz(COL_PROJ, { nome, importancia: 3 });
        projetos.push({ id, nome, importancia: 3 });
      }
    }
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
      const id = await Database.criarRaiz(COL, { texto: item.texto, projeto: item.projeto, categoria: '', dependencia: '', concluida: false, ordem, importancia: 3 });
      tarefas.push({ id, texto: item.texto, projeto: item.projeto, categoria: '', dependencia: '', concluida: false, ordem, importancia: 3 });
      ordem++;
    }
    localStorage.setItem('todo_seed_v1', '1');
  }

  function dependenciasExistentes() {
    return [...new Set(tarefas.map(t => t.dependencia).filter(Boolean))].sort();
  }

  // ============================================
  // Estilos
  // ============================================
  function garantirEstilos() {
    if (document.getElementById('todo-styles')) return;
    const style = document.createElement('style');
    style.id = 'todo-styles';
    style.textContent = `
      .todo-topo { display:flex; gap:18px; align-items:stretch; flex-wrap:wrap; margin-bottom:16px; }
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
        flex:2; min-width:340px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; background:#fff;
        border:1.5px solid var(--cor-borda); border-radius:var(--borda-radius-lg); padding:8px 8px 8px 16px;
        box-shadow:0 1px 2px rgba(0,0,0,.03);
      }
      .todo-addbar:focus-within { border-color:var(--cor-primaria); box-shadow:0 0 0 3px var(--cor-primaria-light); }
      .todo-addbar input[type=text], .todo-addbar select { border:none; outline:none; background:transparent; font-size:14px; font-family:var(--font-principal); }
      .todo-addbar-texto { flex:1; min-width:140px; }
      .todo-addbar-projeto { width:130px; border-left:1.5px solid var(--cor-borda-light) !important; padding-left:10px !important; color:var(--cor-texto-secundario); }
      .todo-addbar-imp { width:110px; border-left:1.5px solid var(--cor-borda-light) !important; padding-left:10px !important; color:var(--cor-texto-secundario); cursor:pointer; }
      .todo-addbar button { flex-shrink:0; white-space:nowrap; }

      .todo-searchbar { position:relative; margin-bottom:14px; }
      .todo-searchbar input {
        width:100%; padding:11px 14px 11px 40px; border-radius:var(--borda-radius-lg); border:1.5px solid var(--cor-borda);
        font-size:14px; font-family:var(--font-principal); outline:none; background:#fff url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23888" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>') no-repeat 12px center;
        background-size:16px;
      }
      .todo-searchbar input:focus { border-color:var(--cor-primaria); box-shadow:0 0 0 3px var(--cor-primaria-light); }

      .todo-filtros-row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:10px; }
      .todo-filtros-row:last-of-type { margin-bottom:18px; }
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
      .todo-select-filtro {
        padding:6px 12px; border-radius:999px; font-size:12.5px; font-weight:600; border:1.5px solid var(--cor-borda);
        background:#fff; color:var(--cor-texto-secundario); cursor:pointer; max-width:220px;
      }
      .todo-gear-btn {
        width:33px; height:33px; border-radius:50%; border:1.5px solid var(--cor-borda); background:#fff; cursor:pointer;
        display:flex; align-items:center; justify-content:center; font-size:15px; color:var(--cor-texto-secundario); flex-shrink:0;
      }
      .todo-gear-btn:hover { border-color:var(--cor-dark-900); color:var(--cor-texto); transform:rotate(25deg); transition:.2s; }

      .todo-grupo { margin-bottom:22px; }
      .todo-grupo-header { display:flex; align-items:center; gap:9px; margin-bottom:9px; padding-left:2px; }
      .todo-grupo-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
      .todo-grupo-titulo { font-size:12.5px; font-weight:800; text-transform:uppercase; letter-spacing:.6px; color:var(--cor-texto-secundario); }
      .todo-grupo-count { font-size:12px; color:var(--cor-texto-muted); font-weight:600; }
      .todo-grupo-imp { font-size:10.5px; padding:1px 7px; border-radius:999px; background:var(--cor-fundo); color:var(--cor-texto-muted); font-weight:700; }

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
      .todo-texto { font-size:14.5px; color:var(--cor-texto); line-height:1.45; word-break:break-word; }
      .todo-item.concluida .todo-texto { text-decoration:line-through; color:var(--cor-texto-muted); }
      .todo-metatags { display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; }
      .todo-tag { font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:999px; display:inline-flex; align-items:center; gap:4px; }
      .todo-tag-cat { color:#fff; }
      .todo-tag-dep { background:var(--cor-alerta-bg); color:#b45309; }
      .todo-tag-imp1 { background:#fee2e2; color:#b91c1c; }
      .todo-tag-imp2 { background:#ffedd5; color:#c2410c; }
      .todo-tag-imp3 { background:#fef9c3; color:#a16207; }
      .todo-tag-imp4 { background:var(--cor-neutro-bg); color:#4b5563; }

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

      /* Modal de edição / gerenciamento */
      .todo-modal { max-width:480px; }
      .todo-form-grupo { margin-bottom:14px; }
      .todo-form-grupo label { display:block; font-size:12px; font-weight:700; color:var(--cor-texto-secundario); text-transform:uppercase; letter-spacing:.4px; margin-bottom:6px; }
      .todo-swatch-grid { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
      .todo-swatch { width:26px; height:26px; border-radius:50%; cursor:pointer; border:2px solid transparent; transition:.15s; }
      .todo-swatch:hover { transform:scale(1.15); }
      .todo-swatch.selecionado { border-color:var(--cor-dark-900); box-shadow:0 0 0 2px #fff, 0 0 0 4px var(--cor-dark-900); }
      .todo-cat-nova-form { display:none; gap:8px; align-items:flex-end; margin-top:10px; padding:12px; background:var(--cor-fundo); border-radius:8px; flex-wrap:wrap; }
      .todo-cat-nova-form.aberto { display:flex; }
      .todo-manage-lista { display:flex; flex-direction:column; gap:6px; max-height:220px; overflow-y:auto; margin-bottom:10px; }
      .todo-manage-item { display:flex; align-items:center; gap:8px; padding:7px 9px; border-radius:8px; background:var(--cor-fundo); }
      .todo-manage-item .nome { flex:1; font-size:13.5px; font-weight:600; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .todo-manage-item select { font-size:12px; padding:3px 6px; border-radius:6px; border:1px solid var(--cor-borda); }
      .todo-manage-dot { width:14px; height:14px; border-radius:50%; flex-shrink:0; }
      .todo-manage-del { background:none; border:none; cursor:pointer; color:var(--cor-texto-muted); font-size:13px; padding:2px 6px; }
      .todo-manage-del:hover { color:var(--cor-perigo); }
      .todo-manage-secao-titulo { font-size:13px; font-weight:800; margin:18px 0 10px; text-transform:uppercase; letter-spacing:.4px; color:var(--cor-texto-secundario); }
      .todo-manage-secao-titulo:first-child { margin-top:0; }
      .todo-manage-add { display:flex; gap:6px; }
      .todo-manage-add input { flex:1; }

      @media (max-width:720px) {
        .todo-topo { flex-direction:column; }
        .todo-addbar { flex-wrap:wrap; }
        .todo-addbar-projeto, .todo-addbar-imp { border-left:none !important; padding-left:0 !important; border-top:1.5px solid var(--cor-borda-light); padding-top:8px !important; }
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================
  // Render principal
  // ============================================
  function renderizar() {
    const container = document.getElementById('modulo-content');
    if (!container) return;

    const mapProj = mapaProjetos();
    const mapCat = mapaCategorias();

    const pendentesTodas = tarefas.filter(t => !t.concluida);
    const concluidasTodas = tarefas.filter(t => t.concluida);
    const buscaLower = busca.trim().toLowerCase();

    const passaFiltro = (t) => {
      if (filtroProjeto && t.projeto !== filtroProjeto) return false;
      if (filtroCategoria && t.categoria !== filtroCategoria) return false;
      if (filtroDependencia && t.dependencia !== filtroDependencia) return false;
      if (buscaLower) {
        const alvo = `${t.texto} ${t.projeto || ''} ${t.categoria || ''} ${t.dependencia || ''}`.toLowerCase();
        if (!alvo.includes(buscaLower)) return false;
      }
      return true;
    };

    const pendentes = pendentesTodas.filter(passaFiltro);
    const concluidas = concluidasTodas.filter(passaFiltro)
      .sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));

    const totalFiltrado = pendentes.length + concluidas.length;
    const pct = totalFiltrado > 0 ? Math.round((concluidas.length / totalFiltrado) * 100) : 0;

    // Agrupa pendentes por projeto
    const grupos = new Map();
    pendentes.forEach(t => {
      const chave = t.projeto || '';
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(t);
    });

    // Ordena grupos por importância do projeto (1=mais importante), sem-projeto sempre por último
    const chavesOrdenadas = [...grupos.keys()].sort((a, b) => {
      if (!a) return 1;
      if (!b) return -1;
      const impA = mapProj.get(a)?.importancia ?? 3;
      const impB = mapProj.get(b)?.importancia ?? 3;
      if (impA !== impB) return impA - impB;
      return a.localeCompare(b, 'pt-BR');
    });

    // Ordena tarefas dentro do grupo: importância da tarefa > importância da categoria > ordem manual
    const ordenarGrupo = (itens) => itens.slice().sort((a, b) => {
      const impA = a.importancia ?? 3, impB = b.importancia ?? 3;
      if (impA !== impB) return impA - impB;
      const catImpA = mapCat.get(a.categoria)?.importancia ?? 3;
      const catImpB = mapCat.get(b.categoria)?.importancia ?? 3;
      if (catImpA !== catImpB) return catImpA - catImpB;
      return (a.ordem || 0) - (b.ordem || 0);
    });

    const dependencias = dependenciasExistentes();

    container.innerHTML = `
      <div class="page-header">
        <div><h2>Tarefas do Sistema</h2><span class="subtitulo">Organização e roadmap do sistema — acesso restrito</span></div>
      </div>

      <div class="todo-topo">
        <div class="todo-progresso-card">
          <div class="todo-progresso-topo">
            <div class="todo-progresso-numero">${concluidas.length}<span>/ ${totalFiltrado} concluídas</span></div>
            <div class="todo-progresso-pct">${pct}%</div>
          </div>
          <div class="todo-progresso-track"><div class="todo-progresso-fill" style="width:${pct}%"></div></div>
          <div class="todo-progresso-legenda">${pendentes.length} tarefa${pendentes.length === 1 ? '' : 's'} pendente${pendentes.length === 1 ? '' : 's'}${(filtroProjeto || filtroCategoria || filtroDependencia || buscaLower) ? ' com os filtros atuais' : ''}</div>
        </div>

        <form id="form-nova-tarefa" class="todo-addbar">
          <input type="text" id="todo-texto" class="todo-addbar-texto" placeholder="+ Adicionar tarefa..." required>
          <input type="text" id="todo-projeto" class="todo-addbar-projeto" list="todo-projetos-lista" placeholder="Projeto">
          <datalist id="todo-projetos-lista">
            ${projetos.map(p => `<option value="${esc(p.nome)}">`).join('')}
          </datalist>
          <select id="todo-importancia" class="todo-addbar-imp">
            ${Object.entries(IMPORTANCIA_LABEL).map(([v, l]) => `<option value="${v}" ${v === '3' ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
          <button type="submit" class="btn btn-primario">Adicionar</button>
        </form>
      </div>

      <div class="todo-searchbar">
        <input type="text" id="todo-busca" placeholder="Buscar tarefa, projeto, categoria ou dependência..." value="${esc(busca)}">
      </div>

      <div class="todo-filtros-row">
        <div class="todo-chip ${!filtroProjeto ? 'ativo' : ''}" data-tipo="projeto" data-valor="">
          Todos os projetos <span class="todo-chip-count">${pendentesTodas.length}</span>
        </div>
        ${projetosOrdenadosPorImportancia().map(p => `
          <div class="todo-chip ${filtroProjeto === p.nome ? 'ativo' : ''}" data-tipo="projeto" data-valor="${esc(p.nome)}">
            <span class="todo-chip-dot" style="background:${corProjeto(p.nome)}"></span>
            ${esc(p.nome)}
            <span class="todo-chip-count">${pendentesTodas.filter(t => t.projeto === p.nome).length}</span>
          </div>
        `).join('')}
        <button type="button" class="todo-gear-btn" id="todo-abrir-gerenciar" title="Gerenciar projetos e categorias">⚙</button>
      </div>

      <div class="todo-filtros-row">
        <div class="todo-chip ${!filtroCategoria ? 'ativo' : ''}" data-tipo="categoria" data-valor="">
          Todas as categorias
        </div>
        ${categoriasOrdenadasPorImportancia().map(c => `
          <div class="todo-chip ${filtroCategoria === c.nome ? 'ativo' : ''}" data-tipo="categoria" data-valor="${esc(c.nome)}">
            <span class="todo-chip-dot" style="background:${esc(c.cor)}"></span>
            ${esc(c.nome)}
            <span class="todo-chip-count">${pendentesTodas.filter(t => t.categoria === c.nome).length}</span>
          </div>
        `).join('')}
        ${dependencias.length > 0 ? `
          <select id="todo-filtro-dependencia" class="todo-select-filtro">
            <option value="">Todas as dependências</option>
            ${dependencias.map(d => `<option value="${esc(d)}" ${filtroDependencia === d ? 'selected' : ''}>⛓ ${esc(d)}</option>`).join('')}
          </select>
        ` : ''}
      </div>

      <div id="todo-grupos">
        ${pendentes.length === 0
          ? `<div class="todo-vazio"><div class="icone">✅</div><p>${(filtroProjeto || filtroCategoria || filtroDependencia || buscaLower) ? 'Nenhuma tarefa encontrada com esses filtros.' : 'Nenhuma tarefa pendente. Tudo em dia!'}</p></div>`
          : chavesOrdenadas.map(chave => {
              const itens = ordenarGrupo(grupos.get(chave));
              const nomeGrupo = chave || 'Sem projeto';
              const impGrupo = chave ? (mapProj.get(chave)?.importancia ?? 3) : null;
              return `
                <div class="todo-grupo">
                  <div class="todo-grupo-header">
                    <span class="todo-grupo-dot" style="background:${corProjeto(chave)}"></span>
                    <span class="todo-grupo-titulo">${esc(nomeGrupo)}</span>
                    <span class="todo-grupo-count">${itens.length}</span>
                    ${impGrupo ? `<span class="todo-grupo-imp">${IMPORTANCIA_LABEL[impGrupo]}</span>` : ''}
                  </div>
                  <div class="todo-lista">
                    ${itens.map((t, i) => linhaTarefa(t, i, itens.length, chave, mapCat)).join('')}
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
            ? `<p class="text-sm text-muted" style="padding:8px 4px;">Nenhuma tarefa concluída encontrada.</p>`
            : concluidas.map(t => linhaTarefa(t, 0, 0, t.projeto || '', mapCat)).join('')}
        </div>
      ` : ''}
    `;

    document.getElementById('form-nova-tarefa').addEventListener('submit', async (e) => {
      e.preventDefault();
      const texto = document.getElementById('todo-texto').value.trim();
      const projeto = document.getElementById('todo-projeto').value.trim();
      const importancia = parseInt(document.getElementById('todo-importancia').value, 10) || 3;
      if (!texto) return;
      await adicionar(texto, projeto, importancia);
    });
    let buscaTimer = null;
    document.getElementById('todo-busca').addEventListener('input', (e) => {
      clearTimeout(buscaTimer);
      const valor = e.target.value;
      buscaTimer = setTimeout(() => { busca = valor; renderizar(); document.getElementById('todo-busca')?.focus(); }, 220);
    });
    container.querySelectorAll('.todo-chip[data-tipo]').forEach(chip => {
      chip.addEventListener('click', () => {
        const tipo = chip.dataset.tipo, valor = chip.dataset.valor;
        if (tipo === 'projeto') filtroProjeto = valor;
        if (tipo === 'categoria') filtroCategoria = valor;
        renderizar();
      });
    });
    const selDep = document.getElementById('todo-filtro-dependencia');
    if (selDep) selDep.addEventListener('change', (e) => { filtroDependencia = e.target.value; renderizar(); });
    document.getElementById('todo-toggle-concluidas').addEventListener('click', () => {
      mostrarConcluidas = !mostrarConcluidas;
      renderizar();
    });
    document.getElementById('todo-abrir-gerenciar').addEventListener('click', abrirModalGerenciar);
  }

  function projetosOrdenadosPorImportancia() {
    return projetos.slice().sort((a, b) => (a.importancia ?? 3) - (b.importancia ?? 3) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  function categoriasOrdenadasPorImportancia() {
    return categorias.slice().sort((a, b) => (a.importancia ?? 3) - (b.importancia ?? 3) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  function linhaTarefa(t, idx, total, chaveGrupo, mapCat) {
    const concluida = !!t.concluida;
    const cor = corProjeto(chaveGrupo);
    const cat = t.categoria ? mapCat.get(t.categoria) : null;
    const imp = t.importancia ?? 3;
    const check = `<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const tags = [];
    if (cat) tags.push(`<span class="todo-tag todo-tag-cat" style="background:${esc(cat.cor)}">${esc(cat.nome)}</span>`);
    if (t.dependencia) tags.push(`<span class="todo-tag todo-tag-dep">⛓ ${esc(t.dependencia)}</span>`);
    if (!concluida && imp !== 3) tags.push(`<span class="todo-tag todo-tag-imp${imp}">${IMPORTANCIA_LABEL[imp]}</span>`);
    return `
      <div class="todo-item ${concluida ? 'concluida' : ''}" style="border-left-color:${cor};">
        <div class="todo-check ${concluida ? 'marcado' : ''}" onclick="Todo.alternarStatus('${t.id}')">${check}</div>
        <div class="todo-corpo">
          <div class="todo-texto">${esc(t.texto)}</div>
          ${tags.length ? `<div class="todo-metatags">${tags.join('')}</div>` : ''}
        </div>
        <div class="todo-acoes">
          ${!concluida ? `
          <button class="todo-acao-btn" title="Subir" onclick="Todo.mover('${t.id}',-1)" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button class="todo-acao-btn" title="Descer" onclick="Todo.mover('${t.id}',1)" ${idx === total - 1 ? 'disabled' : ''}>↓</button>
          ` : ''}
          <button class="todo-acao-btn" title="Editar" onclick="Todo.abrirModalEditar('${t.id}')">✎</button>
          <button class="todo-acao-btn" title="Excluir" onclick="Todo.excluir('${t.id}')">🗑</button>
        </div>
      </div>`;
  }

  async function adicionar(texto, projeto, importancia) {
    if (projeto && !projetos.some(p => p.nome === projeto)) {
      const id = await Database.criarRaiz(COL_PROJ, { nome: projeto, importancia: 3 });
      projetos.push({ id, nome: projeto, importancia: 3 });
    }
    const maxOrdem = tarefas.reduce((m, t) => Math.max(m, t.ordem || 0), 0);
    const dados = { texto, projeto: projeto || '', categoria: '', dependencia: '', concluida: false, ordem: maxOrdem + 1, importancia: importancia || 3 };
    const id = await Database.criarRaiz(COL, dados);
    tarefas.push({ id, ...dados });
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

  // ============================================
  // Modal overlay genérico (não usa o container do módulo,
  // pra não ser apagado quando a lista re-renderiza)
  // ============================================
  function abrirOverlay(html, modalClass) {
    fecharOverlay();
    const overlay = document.createElement('div');
    overlay.id = 'todo-overlay';
    overlay.className = 'modal-overlay ativo';
    overlay.innerHTML = `<div class="modal ${modalClass || ''}">${html}</div>`;
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) fecharOverlay(); });
    document.body.appendChild(overlay);
    return overlay;
  }
  function fecharOverlay() {
    document.getElementById('todo-overlay')?.remove();
  }

  // ============================================
  // Modal: Editar tarefa (nome, projeto, categoria, dependência, importância)
  // ============================================
  function abrirModalEditar(id) {
    const t = tarefas.find(x => x.id === id);
    if (!t) return;
    const dependencias = dependenciasExistentes();
    const html = `
      <div class="modal-header"><h3>Editar tarefa</h3></div>
      <div class="modal-body">
        <div class="todo-form-grupo">
          <label>Nome</label>
          <input type="text" id="ed-texto" class="form-control" value="${esc(t.texto)}">
        </div>
        <div class="todo-form-grupo">
          <label>Projeto</label>
          <input type="text" id="ed-projeto" class="form-control" list="ed-projetos-lista" value="${esc(t.projeto || '')}" placeholder="Sem projeto">
          <datalist id="ed-projetos-lista">${projetos.map(p => `<option value="${esc(p.nome)}">`).join('')}</datalist>
        </div>
        <div class="todo-form-grupo">
          <label>Categoria</label>
          <select id="ed-categoria" class="form-control">
            <option value="">Sem categoria</option>
            ${categorias.map(c => `<option value="${esc(c.nome)}" ${t.categoria === c.nome ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
          </select>
          <div style="margin-top:6px;"><a href="#" id="ed-nova-categoria-link" style="font-size:12.5px;">+ Criar nova categoria</a></div>
          <div class="todo-cat-nova-form" id="ed-cat-nova-form">
            <div style="flex:1; min-width:140px;">
              <input type="text" id="ed-cat-nome" class="form-control" placeholder="Nome da categoria">
              <div class="todo-swatch-grid" id="ed-cat-swatches">
                ${SWATCHES.map((c, i) => `<div class="todo-swatch ${i === 0 ? 'selecionado' : ''}" style="background:${c}" data-cor="${c}"></div>`).join('')}
              </div>
            </div>
            <button type="button" class="btn btn-secundario btn-sm" id="ed-cat-salvar">Salvar categoria</button>
          </div>
        </div>
        <div class="todo-form-grupo">
          <label>Dependência</label>
          <input type="text" id="ed-dependencia" class="form-control" list="ed-dependencias-lista" value="${esc(t.dependencia || '')}" placeholder="Ex: aguardando aprovação do Gabriel">
          <datalist id="ed-dependencias-lista">${dependencias.map(d => `<option value="${esc(d)}">`).join('')}</datalist>
        </div>
        <div class="todo-form-grupo">
          <label>Importância</label>
          <select id="ed-importancia" class="form-control">
            ${Object.entries(IMPORTANCIA_LABEL).map(([v, l]) => `<option value="${v}" ${(t.importancia ?? 3) == v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="modal-footer" style="display:flex; justify-content:space-between;">
        <button type="button" class="btn btn-secundario" id="ed-excluir" style="color:var(--cor-perigo);">Excluir</button>
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn btn-secundario" id="ed-cancelar">Cancelar</button>
          <button type="button" class="btn btn-primario" id="ed-salvar">Salvar</button>
        </div>
      </div>`;
    abrirOverlay(html, 'todo-modal');

    document.getElementById('ed-nova-categoria-link').addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('ed-cat-nova-form').classList.toggle('aberto');
    });
    let corSelecionada = SWATCHES[0];
    document.querySelectorAll('#ed-cat-swatches .todo-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        document.querySelectorAll('#ed-cat-swatches .todo-swatch').forEach(s => s.classList.remove('selecionado'));
        sw.classList.add('selecionado');
        corSelecionada = sw.dataset.cor;
      });
    });
    document.getElementById('ed-cat-salvar').addEventListener('click', async () => {
      const nome = document.getElementById('ed-cat-nome').value.trim();
      if (!nome) { Utils.toast('Dê um nome pra categoria.', 'alerta'); return; }
      if (categorias.some(c => c.nome === nome)) { Utils.toast('Já existe uma categoria com esse nome.', 'alerta'); return; }
      const idCat = await Database.criarRaiz(COL_CAT, { nome, cor: corSelecionada, importancia: 3 });
      categorias.push({ id: idCat, nome, cor: corSelecionada, importancia: 3 });
      const sel = document.getElementById('ed-categoria');
      sel.insertAdjacentHTML('beforeend', `<option value="${esc(nome)}" selected>${esc(nome)}</option>`);
      sel.value = nome;
      document.getElementById('ed-cat-nova-form').classList.remove('aberto');
      Utils.toast('Categoria criada.', 'sucesso');
    });
    document.getElementById('ed-cancelar').addEventListener('click', fecharOverlay);
    document.getElementById('ed-excluir').addEventListener('click', async () => {
      fecharOverlay();
      await excluir(id);
    });
    document.getElementById('ed-salvar').addEventListener('click', async () => {
      const texto = document.getElementById('ed-texto').value.trim();
      if (!texto) { Utils.toast('O nome da tarefa não pode ficar em branco.', 'alerta'); return; }
      const projeto = document.getElementById('ed-projeto').value.trim();
      const categoria = document.getElementById('ed-categoria').value;
      const dependencia = document.getElementById('ed-dependencia').value.trim();
      const importancia = parseInt(document.getElementById('ed-importancia').value, 10) || 3;

      if (projeto && !projetos.some(p => p.nome === projeto)) {
        const idProj = await Database.criarRaiz(COL_PROJ, { nome: projeto, importancia: 3 });
        projetos.push({ id: idProj, nome: projeto, importancia: 3 });
      }

      const dados = { texto, projeto: projeto || '', categoria, dependencia, importancia };
      await Database.atualizarRaiz(COL, id, dados);
      Object.assign(t, dados);
      fecharOverlay();
      Utils.toast('Tarefa atualizada.', 'sucesso');
      renderizar();
    });
  }

  // ============================================
  // Modal: Gerenciar Projetos e Categorias (nome, cor, importância)
  // ============================================
  function abrirModalGerenciar() {
    editandoCategoriaId = null;
    editandoProjetoId = null;
    const html = `
      <div class="modal-header"><h3>Gerenciar projetos e categorias</h3></div>
      <div class="modal-body">
        <div class="todo-manage-secao-titulo">Projetos</div>
        <div class="todo-manage-lista" id="mg-lista-projetos">${renderListaProjetos()}</div>
        <div class="todo-manage-add">
          <input type="text" id="mg-novo-projeto" class="form-control" placeholder="Novo projeto...">
          <select id="mg-novo-projeto-imp" class="form-control" style="max-width:130px;">
            ${Object.entries(IMPORTANCIA_LABEL).map(([v, l]) => `<option value="${v}" ${v === '3' ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
          <button type="button" class="btn btn-secundario btn-sm" id="mg-add-projeto">+ Adicionar</button>
        </div>

        <div class="todo-manage-secao-titulo">Categorias</div>
        <div class="todo-manage-lista" id="mg-lista-categorias">${renderListaCategorias()}</div>
        <div class="todo-form-grupo" style="margin-bottom:6px;">
          <input type="text" id="mg-nova-categoria" class="form-control" placeholder="Nova categoria...">
          <div class="todo-swatch-grid" id="mg-cat-swatches">
            ${SWATCHES.map((c, i) => `<div class="todo-swatch ${i === 0 ? 'selecionado' : ''}" style="background:${c}" data-cor="${c}"></div>`).join('')}
          </div>
        </div>
        <div class="todo-manage-add">
          <select id="mg-nova-categoria-imp" class="form-control" style="max-width:130px;">
            ${Object.entries(IMPORTANCIA_LABEL).map(([v, l]) => `<option value="${v}" ${v === '3' ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
          <button type="button" class="btn btn-secundario btn-sm" id="mg-add-categoria" style="flex:1;">+ Adicionar categoria</button>
        </div>
      </div>
      <div class="modal-footer" style="justify-content:flex-end;">
        <button type="button" class="btn btn-primario" id="mg-fechar">Concluído</button>
      </div>`;
    abrirOverlay(html, 'todo-modal');
    ligarEventosGerenciar();
  }

  function renderListaProjetos() {
    if (projetos.length === 0) return `<p class="text-sm text-muted">Nenhum projeto cadastrado ainda.</p>`;
    return projetosOrdenadosPorImportancia().map(p => {
      if (p.id === editandoProjetoId) {
        return `
          <div class="todo-manage-item todo-manage-item-editando">
            <input type="text" id="mg-proj-edit-nome" class="form-control" value="${esc(p.nome)}" style="flex:1;">
            <button class="todo-manage-del" id="mg-proj-edit-salvar" title="Salvar">✔</button>
            <button class="todo-manage-del" id="mg-proj-edit-cancelar" title="Cancelar">✕</button>
          </div>`;
      }
      return `
      <div class="todo-manage-item">
        <span class="todo-manage-dot" style="background:${corProjeto(p.nome)}"></span>
        <span class="nome">${esc(p.nome)}</span>
        <select data-id="${p.id}" class="mg-proj-imp">
          ${Object.entries(IMPORTANCIA_LABEL).map(([v, l]) => `<option value="${v}" ${(p.importancia ?? 3) == v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <button class="todo-manage-del" data-id="${p.id}" data-tipo="projeto" data-acao="editar" title="Editar">✎</button>
        <button class="todo-manage-del" data-id="${p.id}" data-tipo="projeto" data-acao="excluir" title="Excluir">🗑</button>
      </div>`;
    }).join('');
  }
  function renderListaCategorias() {
    if (categorias.length === 0) return `<p class="text-sm text-muted">Nenhuma categoria cadastrada ainda.</p>`;
    return categoriasOrdenadasPorImportancia().map(c => {
      if (c.id === editandoCategoriaId) {
        return `
          <div class="todo-manage-item todo-manage-item-editando" style="flex-direction:column; align-items:stretch; gap:8px;">
            <input type="text" id="mg-cat-edit-nome" class="form-control" value="${esc(c.nome)}">
            <div class="todo-swatch-grid" id="mg-cat-edit-swatches">
              ${SWATCHES.map(cor => `<div class="todo-swatch ${cor.toLowerCase() === c.cor.toLowerCase() ? 'selecionado' : ''}" style="background:${cor}" data-cor="${cor}"></div>`).join('')}
            </div>
            <div style="display:flex; gap:6px; justify-content:flex-end;">
              <button class="btn btn-secundario btn-sm" id="mg-cat-edit-cancelar">Cancelar</button>
              <button class="btn btn-primario btn-sm" id="mg-cat-edit-salvar">Salvar</button>
            </div>
          </div>`;
      }
      return `
      <div class="todo-manage-item">
        <span class="todo-manage-dot" style="background:${esc(c.cor)}"></span>
        <span class="nome">${esc(c.nome)}</span>
        <select data-id="${c.id}" class="mg-cat-imp">
          ${Object.entries(IMPORTANCIA_LABEL).map(([v, l]) => `<option value="${v}" ${(c.importancia ?? 3) == v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <button class="todo-manage-del" data-id="${c.id}" data-tipo="categoria" data-acao="editar" title="Editar">✎</button>
        <button class="todo-manage-del" data-id="${c.id}" data-tipo="categoria" data-acao="excluir" title="Excluir">🗑</button>
      </div>`;
    }).join('');
  }

  function ligarEventosGerenciar() {
    document.getElementById('mg-fechar').addEventListener('click', () => { fecharOverlay(); renderizar(); });
    religarListasGerenciar();

    let corSelecionadaMg = SWATCHES[0];
    document.querySelectorAll('#mg-cat-swatches .todo-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        document.querySelectorAll('#mg-cat-swatches .todo-swatch').forEach(s => s.classList.remove('selecionado'));
        sw.classList.add('selecionado');
        corSelecionadaMg = sw.dataset.cor;
      });
    });

    document.getElementById('mg-add-projeto').addEventListener('click', async () => {
      const nome = document.getElementById('mg-novo-projeto').value.trim();
      if (!nome) return;
      if (projetos.some(p => p.nome === nome)) { Utils.toast('Esse projeto já existe.', 'alerta'); return; }
      const importancia = parseInt(document.getElementById('mg-novo-projeto-imp').value, 10) || 3;
      const id = await Database.criarRaiz(COL_PROJ, { nome, importancia });
      projetos.push({ id, nome, importancia });
      document.getElementById('mg-lista-projetos').innerHTML = renderListaProjetos();
      document.getElementById('mg-novo-projeto').value = '';
      religarListasGerenciar();
      Utils.toast('Projeto criado.', 'sucesso');
    });
    document.getElementById('mg-add-categoria').addEventListener('click', async () => {
      const nome = document.getElementById('mg-nova-categoria').value.trim();
      if (!nome) return;
      if (categorias.some(c => c.nome === nome)) { Utils.toast('Essa categoria já existe.', 'alerta'); return; }
      const importancia = parseInt(document.getElementById('mg-nova-categoria-imp').value, 10) || 3;
      const id = await Database.criarRaiz(COL_CAT, { nome, cor: corSelecionadaMg, importancia });
      categorias.push({ id, nome, cor: corSelecionadaMg, importancia });
      document.getElementById('mg-lista-categorias').innerHTML = renderListaCategorias();
      document.getElementById('mg-nova-categoria').value = '';
      religarListasGerenciar();
      Utils.toast('Categoria criada.', 'sucesso');
    });
  }

  // Religa TODOS os eventos das listas de gerenciamento (selects de
  // importância, editar, excluir, e o mini-formulário de edição
  // inline) — chamada sempre que uma lista é reconstruída via innerHTML.
  function religarListasGerenciar() {
    document.querySelectorAll('.mg-proj-imp').forEach(sel => {
      sel.onchange = async (e) => {
        const id = e.target.dataset.id;
        const importancia = parseInt(e.target.value, 10);
        await Database.atualizarRaiz(COL_PROJ, id, { importancia });
        const p = projetos.find(x => x.id === id); if (p) p.importancia = importancia;
      };
    });
    document.querySelectorAll('.mg-cat-imp').forEach(sel => {
      sel.onchange = async (e) => {
        const id = e.target.dataset.id;
        const importancia = parseInt(e.target.value, 10);
        await Database.atualizarRaiz(COL_CAT, id, { importancia });
        const c = categorias.find(x => x.id === id); if (c) c.importancia = importancia;
      };
    });
    document.querySelectorAll('.todo-manage-del[data-acao]').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id, tipo = btn.dataset.tipo, acao = btn.dataset.acao;
        if (acao === 'editar') {
          if (tipo === 'projeto') editandoProjetoId = id; else editandoCategoriaId = id;
          document.getElementById(tipo === 'projeto' ? 'mg-lista-projetos' : 'mg-lista-categorias').innerHTML =
            tipo === 'projeto' ? renderListaProjetos() : renderListaCategorias();
          religarListasGerenciar();
          document.getElementById(tipo === 'projeto' ? 'mg-proj-edit-nome' : 'mg-cat-edit-nome')?.focus();
          return;
        }
        // excluir
        const nomeItem = tipo === 'projeto' ? projetos.find(p => p.id === id)?.nome : categorias.find(c => c.id === id)?.nome;
        if (!confirm(`Excluir "${nomeItem}"? Tarefas que usam esse ${tipo} continuam existindo, só perdem essa referência.`)) return;
        if (tipo === 'projeto') {
          await Database.deletarRaiz(COL_PROJ, id);
          projetos = projetos.filter(p => p.id !== id);
          document.getElementById('mg-lista-projetos').innerHTML = renderListaProjetos();
        } else {
          await Database.deletarRaiz(COL_CAT, id);
          categorias = categorias.filter(c => c.id !== id);
          document.getElementById('mg-lista-categorias').innerHTML = renderListaCategorias();
        }
        religarListasGerenciar();
      };
    });

    // Formulário de edição inline — Projeto (só nome)
    const btnProjSalvar = document.getElementById('mg-proj-edit-salvar');
    if (btnProjSalvar) {
      btnProjSalvar.onclick = async () => {
        const id = editandoProjetoId;
        const nomeNovo = document.getElementById('mg-proj-edit-nome').value.trim();
        if (!nomeNovo) { Utils.toast('O nome do projeto não pode ficar em branco.', 'alerta'); return; }
        if (projetos.some(p => p.id !== id && p.nome === nomeNovo)) { Utils.toast('Já existe um projeto com esse nome.', 'alerta'); return; }
        const p = projetos.find(x => x.id === id);
        const nomeAntigo = p.nome;
        await Database.atualizarRaiz(COL_PROJ, id, { nome: nomeNovo });
        p.nome = nomeNovo;
        // Propaga o novo nome pra todas as tarefas que referenciavam o nome antigo
        const afetadas = tarefas.filter(t => t.projeto === nomeAntigo);
        for (const t of afetadas) {
          await Database.atualizarRaiz(COL, t.id, { projeto: nomeNovo });
          t.projeto = nomeNovo;
        }
        editandoProjetoId = null;
        document.getElementById('mg-lista-projetos').innerHTML = renderListaProjetos();
        religarListasGerenciar();
        Utils.toast('Projeto atualizado.', 'sucesso');
      };
    }
    const btnProjCancelar = document.getElementById('mg-proj-edit-cancelar');
    if (btnProjCancelar) {
      btnProjCancelar.onclick = () => {
        editandoProjetoId = null;
        document.getElementById('mg-lista-projetos').innerHTML = renderListaProjetos();
        religarListasGerenciar();
      };
    }

    // Formulário de edição inline — Categoria (nome + cor)
    const catSwatches = document.getElementById('mg-cat-edit-swatches');
    let corEdicaoCategoria = null;
    if (catSwatches) {
      const jaSelecionado = catSwatches.querySelector('.todo-swatch.selecionado');
      corEdicaoCategoria = jaSelecionado ? jaSelecionado.dataset.cor : SWATCHES[0];
      catSwatches.querySelectorAll('.todo-swatch').forEach(sw => {
        sw.onclick = () => {
          catSwatches.querySelectorAll('.todo-swatch').forEach(s => s.classList.remove('selecionado'));
          sw.classList.add('selecionado');
          corEdicaoCategoria = sw.dataset.cor;
        };
      });
    }
    const btnCatSalvar = document.getElementById('mg-cat-edit-salvar');
    if (btnCatSalvar) {
      btnCatSalvar.onclick = async () => {
        const id = editandoCategoriaId;
        const nomeNovo = document.getElementById('mg-cat-edit-nome').value.trim();
        if (!nomeNovo) { Utils.toast('O nome da categoria não pode ficar em branco.', 'alerta'); return; }
        if (categorias.some(c => c.id !== id && c.nome === nomeNovo)) { Utils.toast('Já existe uma categoria com esse nome.', 'alerta'); return; }
        const c = categorias.find(x => x.id === id);
        const nomeAntigo = c.nome;
        const corNova = corEdicaoCategoria || c.cor;
        await Database.atualizarRaiz(COL_CAT, id, { nome: nomeNovo, cor: corNova });
        c.nome = nomeNovo; c.cor = corNova;
        // Propaga o novo nome pra todas as tarefas que referenciavam o nome antigo
        const afetadas = tarefas.filter(t => t.categoria === nomeAntigo);
        for (const t of afetadas) {
          await Database.atualizarRaiz(COL, t.id, { categoria: nomeNovo });
          t.categoria = nomeNovo;
        }
        editandoCategoriaId = null;
        document.getElementById('mg-lista-categorias').innerHTML = renderListaCategorias();
        religarListasGerenciar();
        Utils.toast('Categoria atualizada.', 'sucesso');
      };
    }
    const btnCatCancelar = document.getElementById('mg-cat-edit-cancelar');
    if (btnCatCancelar) {
      btnCatCancelar.onclick = () => {
        editandoCategoriaId = null;
        document.getElementById('mg-lista-categorias').innerHTML = renderListaCategorias();
        religarListasGerenciar();
      };
    }
  }

  return { init, alternarStatus, excluir, mover, abrirModalEditar };
})();
