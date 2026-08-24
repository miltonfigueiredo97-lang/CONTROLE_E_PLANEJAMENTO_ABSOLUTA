// ============================================
// Módulo: Tarefas do Sistema (To Do List)
// Coleções raiz (não vinculadas a obra):
//   tarefasSistema   { texto, projeto, categoria, dependencia, concluida, ordem, importancia, updatedAtMs }
//   todoProjetos     { nome, importancia }
//   todoCategorias   { nome, cor, importancia }
//   tarefasAgenda    { tarefaId, data ('YYYY-MM-DD'), horario ('HH:MM') } — alocações da Agenda,
//                       desacopladas da tarefa em si: a MESMA tarefa pode ter várias alocações
//                       (horários/dias diferentes) ao mesmo tempo.
// Acesso oculto do menu lateral — só quem tem o link direto (todo.html) chega aqui.
// ============================================
const Todo = (() => {
  const COL = 'tarefasSistema';
  const COL_PROJ = 'todoProjetos';
  const COL_CAT = 'todoCategorias';
  const COL_AGENDA = 'tarefasAgenda';

  let tarefas = [];
  let projetos = [];   // [{id, nome, importancia}]
  let categorias = []; // [{id, nome, cor, importancia}]
  let agendaAlocacoes = []; // [{id, tarefaId, data, horario}]

  let filtroProjeto = '';
  let filtrosCategoria = new Set(); // multi-select — vazio = todas
  let filtroDependencia = '';
  let busca = '';
  let mostrarConcluidas = false;
  let filtrosPainelAberto = false;
  let editandoCategoriaId = null;
  let editandoProjetoId = null;
  let agendaDataAtual = null; // 'YYYY-MM-DD' — dia exibido na Agenda
  let agendaSlotAberto = null; // horário (HH:MM) com o seletor de tarefa aberto no momento, ou null
  let agendaFiltroPicker = ''; // texto de busca dentro do seletor de tarefa da Agenda
  let agendaPickerProjeto = null; // projeto escolhido na navegação hierárquica do seletor (null = nível raiz)
  let agendaPickerCategoria = null; // categoria escolhida dentro do projeto ('__todas__'/'__sem__'/nome, ou null)
  let agendaCriandoNova = false; // true quando o formulário de "criar tarefa nova direto na Agenda" está aberto
  let agendaMostrarJaEscolhidas = false; // true = mostra no seletor também as tarefas/itens já agendados nesse dia
  let agendaTarefasJaAlocadas = new Set(); // ids de tarefas já alocadas (inteiras) no dia exibido — recalculado a cada render
  let agendaItensJaAlocados = new Set(); // chaves "tarefaId::itemId" de itens de checklist já alocados no dia exibido
  let agendaClipboard = null; // { tarefaId, itemId, label } — alocação copiada, pronta pra colar em outro horário
  let agendaMostrandoAtrasadas = false; // true = seletor está mostrando a lista de "puxar não concluídas de horário anterior"
  let agendaEsconderPassadas = localStorage.getItem('agenda_esconder_passadas') === '1'; // esconder horários já passados (só quando o dia exibido é hoje)

  const PALETA_PROJETO = ['#2563eb', '#16a34a', '#7c3aed', '#d97706', '#0891b2', '#dc2626', '#db2777'];
  const SWATCHES = [
    '#F5C800', '#eab308', '#facc15', '#f59e0b', '#d97706', '#ea580c', '#f97316', '#fb923c',
    '#dc2626', '#ef4444', '#f43f5e', '#db2777', '#ec4899', '#d946ef', '#c026d3', '#a855f7',
    '#7c3aed', '#8b5cf6', '#6366f1', '#4f46e5', '#2563eb', '#3b82f6', '#0ea5e9', '#0891b2',
    '#06b6d4', '#14b8a6', '#059669', '#16a34a', '#22c55e', '#65a30d', '#84cc16', '#64748b',
    '#475569', '#334155', '#78716c', '#57534e',
  ];
  const IMPORTANCIA_LABEL = { 1: '🔴 Urgente', 2: '🟠 Alta', 3: '🟡 Média', 4: '⚪ Baixa' };

  function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // ============================================
  // Grade de cores reutilizável: paleta curada + cor livre
  // (input type=color, unlimitada) — usada em todo lugar que
  // escolhe cor de categoria.
  // ============================================
  function _swatchGridHtml(gridId, corAtual) {
    const corNorm = (corAtual || '').toLowerCase();
    const naPaleta = SWATCHES.some(c => c.toLowerCase() === corNorm);
    const corCustomAtual = (corAtual && !naPaleta) ? corAtual : '#888888';
    return `
      <div class="todo-swatch-grid" id="${gridId}">
        ${SWATCHES.map(c => `<div class="todo-swatch ${c.toLowerCase() === corNorm ? 'selecionado' : ''}" style="background:${c}" data-cor="${c}"></div>`).join('')}
        <label class="todo-swatch-custom ${(corAtual && !naPaleta) ? 'selecionado' : ''}" id="${gridId}-custom" title="Cor personalizada" style="${(corAtual && !naPaleta) ? `background:${esc(corAtual)};` : ''}">
          <input type="color" value="${esc(corCustomAtual)}">🎨
        </label>
      </div>`;
  }

  function _wireSwatchGrid(gridId, onEscolher) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    const custom = document.getElementById(`${gridId}-custom`);
    const input = custom ? custom.querySelector('input[type=color]') : null;
    grid.querySelectorAll('.todo-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        grid.querySelectorAll('.todo-swatch').forEach(s => s.classList.remove('selecionado'));
        if (custom) { custom.classList.remove('selecionado'); custom.style.background = ''; }
        sw.classList.add('selecionado');
        onEscolher(sw.dataset.cor);
      });
    });
    if (input && custom) {
      input.addEventListener('input', () => {
        grid.querySelectorAll('.todo-swatch').forEach(s => s.classList.remove('selecionado'));
        custom.classList.add('selecionado');
        custom.style.background = input.value;
        onEscolher(input.value);
      });
    }
  }

  // Re-marca a seleção quando o alvo muda dinamicamente (ex: trocar
  // qual categoria está sendo editada num formulário já aberto).
  function _marcarSwatchGrid(gridId, cor) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    const corNorm = (cor || '').toLowerCase();
    const custom = document.getElementById(`${gridId}-custom`);
    let achou = false;
    grid.querySelectorAll('.todo-swatch').forEach(sw => {
      const bate = sw.dataset.cor.toLowerCase() === corNorm;
      sw.classList.toggle('selecionado', bate);
      if (bate) achou = true;
    });
    if (custom) {
      custom.classList.toggle('selecionado', !achou && !!cor);
      custom.style.background = (!achou && cor) ? cor : '';
      if (!achou && cor) custom.querySelector('input').value = cor;
    }
  }

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
    await _migrarTitulosAntigos();
    await _processarFilaChat();
    renderizar();
  }

  // ============================================
  // Fila de tarefas via chat — Milton fala a tarefa (título, descrição,
  // categoria, checklist) pro Claude no chat; o Claude escreve num JSON
  // estático no repositório (chat-fila-tarefas.json) e dá push. Na
  // próxima vez que este módulo abre, cada item da fila é inserido no
  // Firestore automaticamente. Cada item tem um "id" próprio e é gravado
  // com esse MESMO id como customId da tarefa — assim, se a fila for
  // recarregada de novo (ou nunca for limpa), o item já existente é
  // ignorado (dedupe por id), sem duplicar. Não precisa de nenhuma ação
  // manual pra "limpar" a fila depois de processada.
  // ============================================
  function _corParaCategoriaFila(nome) {
    let hash = 0;
    for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) >>> 0;
    return SWATCHES[hash % SWATCHES.length];
  }

  async function _processarFilaChat() {
    let fila;
    try {
      const resp = await fetch('/chat-fila-tarefas.json', { cache: 'no-store' });
      if (!resp.ok) return;
      fila = await resp.json();
    } catch (e) { return; } // arquivo não existe ainda ou erro de rede — silencioso, não é crítico

    if (!Array.isArray(fila) || fila.length === 0) return;

    let novasCriadas = 0;
    for (const item of fila) {
      if (!item.id || !item.texto) continue;
      if (tarefas.some(t => t.id === item.id)) continue; // já processado antes, ignora

      let categoriaFinal = '';
      if (item.categoria) {
        const jaExiste = categorias.find(c => c.nome.toLowerCase() === item.categoria.toLowerCase());
        if (jaExiste) {
          categoriaFinal = jaExiste.nome;
        } else {
          const cor = _corParaCategoriaFila(item.categoria);
          const idCat = await Database.criarRaiz(COL_CAT, { nome: item.categoria, cor, importancia: 3 });
          categorias.push({ id: idCat, nome: item.categoria, cor, importancia: 3 });
          categoriaFinal = item.categoria;
        }
      }
      if (item.projeto && !projetos.some(p => p.nome === item.projeto)) {
        const idProj = await Database.criarRaiz(COL_PROJ, { nome: item.projeto, importancia: 3 });
        projetos.push({ id: idProj, nome: item.projeto, importancia: 3 });
      }

      const maxOrdem = tarefas.reduce((m, t) => Math.max(m, t.ordem || 0), 0);
      const dados = {
        texto: item.texto,
        descricao: item.descricao || '',
        projeto: item.projeto || '',
        categoria: categoriaFinal,
        dependencia: '',
        concluida: false,
        ordem: maxOrdem + 1,
        importancia: item.importancia || 3,
        checklist: item.checklist || [],
      };
      await Database.criarRaiz(COL, dados, item.id);
      tarefas.push({ id: item.id, ...dados });
      novasCriadas++;
    }
    if (novasCriadas > 0) {
      Utils.toast(`${novasCriadas} tarefa${novasCriadas === 1 ? '' : 's'} do chat adicionada${novasCriadas === 1 ? '' : 's'}.`, 'sucesso');
    }
  }

  // ============================================
  // Migração: tarefas antigas tinham só "texto" (tudo junto, sem
  // Título/Descrição separados). Quando o texto segue o padrão
  // "Ação: detalhes" ou "Ação — detalhes" (convenção já usada em
  // quase todas as tarefas existentes), divide automaticamente:
  // título = a ação, descrição = o resto. Roda pra qualquer tarefa
  // sem descrição ainda — não precisa de flag, é auto-suficiente
  // (tarefa já migrada tem descricao preenchida e não entra de novo).
  // ============================================
  function _dividirTituloDescricao(texto) {
    const idxColon = texto.indexOf(': ');
    const idxDash = texto.indexOf(' — ');
    let idx = -1, tamanhoSeparador = 0;
    if (idxColon !== -1 && (idxDash === -1 || idxColon < idxDash)) { idx = idxColon; tamanhoSeparador = 2; }
    else if (idxDash !== -1) { idx = idxDash; tamanhoSeparador = 3; }
    if (idx < 8) return null; // sem separador claro, ou separador logo no início (não dá um título útil)
    const titulo = texto.slice(0, idx).trim();
    const descricao = texto.slice(idx + tamanhoSeparador).trim();
    if (!titulo || !descricao) return null;
    // Se o que sobra depois do separador for muito curto (ex: só uma palavra,
    // "Esgoto"), provavelmente é o identificador da tarefa, não uma descrição
    // de verdade — nesse caso é melhor manter tudo junto no título.
    if (descricao.length < 15 || descricao.split(/\s+/).length <= 2) return null;
    return { titulo, descricao };
  }

  async function _migrarTitulosAntigos() {
    const candidatas = tarefas.filter(t => !t.descricao && t.texto && t.texto.length > 40);
    for (const t of candidatas) {
      const partes = _dividirTituloDescricao(t.texto);
      if (!partes) continue;
      await Database.atualizarRaiz(COL, t.id, { texto: partes.titulo, descricao: partes.descricao });
      t.texto = partes.titulo;
      t.descricao = partes.descricao;
    }
  }

  async function carregarTudo() {
    [tarefas, projetos, categorias, agendaAlocacoes] = await Promise.all([
      Database.listarRaiz(COL, 'ordem', 'asc'),
      Database.listarRaiz(COL_PROJ).catch(() => []),
      Database.listarRaiz(COL_CAT).catch(() => []),
      Database.listarRaiz(COL_AGENDA).catch(() => [])
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
      .todo-progresso-track { height:4px; border-radius:999px; background:var(--cor-borda-light); overflow:hidden; margin:2px 0 14px; }
      .todo-progresso-fill { height:100%; border-radius:999px; background:linear-gradient(90deg,var(--cor-primaria-dark),var(--cor-primaria)); transition:width .5s cubic-bezier(.4,0,.2,1); }

      .todo-addbar {
        flex:1; min-width:360px; display:flex; flex-direction:column; gap:12px; background:#fff;
        border:1.5px solid var(--cor-borda); border-radius:var(--borda-radius-lg); padding:16px;
        box-shadow:0 1px 2px rgba(0,0,0,.03);
      }
      .todo-addbar:focus-within { border-color:var(--cor-primaria); box-shadow:0 0 0 3px var(--cor-primaria-light); }
      .todo-addbar-texto {
        width:100%; border:none; outline:none; background:transparent; font-size:15.5px; font-weight:600;
        font-family:var(--font-principal); padding:2px;
      }
      .todo-addbar-texto::placeholder { color:var(--cor-texto-muted); font-weight:500; }
      .todo-addbar-descricao {
        width:100%; border:1.5px solid var(--cor-borda-light); border-radius:8px; padding:8px 10px; font-size:13px;
        font-family:var(--font-principal); color:var(--cor-texto); resize:vertical; outline:none; box-sizing:border-box; min-height:44px;
      }
      .todo-addbar-descricao:focus { border-color:var(--cor-primaria); }
      .todo-addbar-linha2 { display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap; border-top:1.5px solid var(--cor-borda-light); padding-top:12px; }
      .todo-addbar-checklist { border-top:1.5px solid var(--cor-borda-light); padding-top:10px; margin-top:2px; }
      .todo-addbar-checklist-titulo { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:var(--cor-texto-muted); margin-bottom:7px; }
      .todo-checklist-item-row { display:flex; align-items:center; gap:7px; margin-bottom:6px; }
      .todo-checklist-item-check { width:15px; height:15px; flex-shrink:0; cursor:pointer; accent-color:var(--cor-primaria); }
      .todo-checklist-item-input {
        flex:1; border:1.5px solid var(--cor-borda-light); border-radius:6px; padding:6px 9px; font-size:12.5px;
        font-family:var(--font-principal); outline:none; color:var(--cor-texto);
      }
      .todo-checklist-item-input:focus { border-color:var(--cor-primaria); }
      .todo-checklist-item-remover { border:none; background:none; cursor:pointer; color:var(--cor-texto-muted); font-size:15px; padding:2px 5px; flex-shrink:0; }
      .todo-checklist-item-remover:hover { color:var(--cor-perigo); }
      .todo-checklist-add-btn { border:none; background:none; font-size:11.5px; font-weight:600; color:var(--cor-texto-muted); cursor:pointer; padding:2px 0; }
      .todo-checklist-add-btn:hover { color:var(--cor-texto-secundario); }
      .todo-checklist-badge {
        font-size:10.5px; font-weight:700; background:var(--cor-neutro-bg); color:#4b5563; border-radius:999px;
        padding:2px 8px; display:inline-flex; align-items:center; gap:4px;
      }
      .todo-addbar-campo { display:flex; flex-direction:column; gap:5px; flex:1; min-width:110px; }
      .todo-addbar-campo label { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:var(--cor-texto-muted); }
      .todo-addbar-campo input, .todo-addbar-campo select {
        border:1.5px solid var(--cor-borda-light); border-radius:8px; padding:7px 10px; font-size:13.5px;
        font-family:var(--font-principal); outline:none; background:var(--cor-fundo); color:var(--cor-texto);
        width:100%; cursor:pointer;
      }
      .todo-addbar-campo input { cursor:text; }
      .todo-addbar-campo input:focus, .todo-addbar-campo select:focus { border-color:var(--cor-primaria); background:#fff; }
      .todo-addbar-cat-row { display:flex; gap:6px; }
      .todo-addbar-cat-row select { flex:1; min-width:0; }
      .todo-addbar-cat-nova-btn {
        width:32px; height:32px; flex-shrink:0; border-radius:8px; border:1.5px solid var(--cor-borda-light);
        background:var(--cor-fundo); cursor:pointer; font-size:16px; font-weight:700; color:var(--cor-texto-secundario);
        display:flex; align-items:center; justify-content:center; transition:.15s;
      }
      .todo-addbar-cat-nova-btn:hover { border-color:var(--cor-primaria); color:var(--cor-texto); background:#fff; }
      .todo-addbar-submit { flex-shrink:0; height:33px; padding:0 18px; }

      .todo-searchbar { position:relative; margin-bottom:14px; }
      .todo-searchbar input {
        width:100%; padding:11px 14px 11px 40px; border-radius:var(--borda-radius-lg); border:1.5px solid var(--cor-borda);
        font-size:14px; font-family:var(--font-principal); outline:none; background:#fff url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23888" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>') no-repeat 12px center;
        background-size:16px;
      }
      .todo-searchbar input:focus { border-color:var(--cor-primaria); box-shadow:0 0 0 3px var(--cor-primaria-light); }

      .todo-filtros-bar { display:flex; gap:8px; align-items:center; margin-bottom:10px; }
      .todo-filtros-toggle {
        display:flex; align-items:center; gap:7px; padding:7px 14px; border-radius:999px; font-size:12.5px; font-weight:700;
        border:1.5px solid var(--cor-borda); background:#fff; cursor:pointer; color:var(--cor-texto-secundario); transition:.15s;
      }
      .todo-filtros-toggle:hover { border-color:var(--cor-dark-900); color:var(--cor-texto); }
      .todo-filtros-toggle.aberto { border-color:var(--cor-dark-900); color:var(--cor-texto); background:var(--cor-fundo); }
      .todo-filtros-toggle .seta { font-size:10px; transition:.2s; }
      .todo-filtros-toggle.aberto .seta { transform:rotate(180deg); }
      .todo-filtros-badge { background:var(--cor-primaria); color:#000; border-radius:999px; padding:1px 7px; font-size:11px; font-weight:800; }
      .todo-filtros-limpar { border:none; background:none; cursor:pointer; color:var(--cor-texto-muted); font-size:12px; font-weight:600; text-decoration:underline; }
      .todo-filtros-limpar:hover { color:var(--cor-perigo); }
      .todo-filtros-painel {
        display:flex; flex-direction:column; gap:14px; background:var(--cor-fundo); border:1.5px solid var(--cor-borda-light);
        border-radius:var(--borda-radius-lg); padding:14px 16px; margin-bottom:14px;
      }
      .todo-filtros-secao-titulo { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.4px; color:var(--cor-texto-muted); margin-bottom:7px; }
      .todo-filtros-hint { text-transform:none; font-weight:500; letter-spacing:0; color:var(--cor-texto-muted); font-size:11px; }
      .todo-filtros-chips { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
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
      .todo-chip-add { border-style:dashed; color:var(--cor-texto-secundario); background:transparent; }
      .todo-chip-add:hover { border-color:var(--cor-primaria); border-style:solid; color:var(--cor-texto); }
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
      .todo-texto { font-size:14.5px; color:var(--cor-texto); line-height:1.45; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .todo-item.concluida .todo-texto { text-decoration:line-through; color:var(--cor-texto-muted); }
      .todo-detalhe-titulo { font-size:17px; font-weight:700; color:var(--cor-texto); line-height:1.4; margin-bottom:10px; }
      .todo-detalhe-descricao { font-size:14px; color:var(--cor-texto-secundario); line-height:1.6; white-space:pre-wrap; }
      .todo-detalhe-checklist-titulo { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:var(--cor-texto-muted); margin:16px 0 8px; }
      .todo-detalhe-checklist { display:flex; flex-direction:column; gap:7px; }
      .todo-detalhe-checklist-item { display:flex; align-items:center; gap:9px; cursor:pointer; font-size:13.5px; color:var(--cor-texto); }
      .todo-detalhe-checklist-item.concluido { text-decoration:line-through; color:var(--cor-texto-muted); }
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
      .todo-modal { max-width:640px; }
      .todo-form-grupo { margin-bottom:14px; }
      .todo-form-grupo label { display:block; font-size:12px; font-weight:700; color:var(--cor-texto-secundario); text-transform:uppercase; letter-spacing:.4px; margin-bottom:6px; }
      .todo-swatch-grid { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
      .todo-swatch { width:26px; height:26px; border-radius:50%; cursor:pointer; border:2px solid transparent; transition:.15s; }
      .todo-swatch:hover { transform:scale(1.15); }
      .todo-swatch.selecionado { border-color:var(--cor-dark-900); box-shadow:0 0 0 2px #fff, 0 0 0 4px var(--cor-dark-900); }
      .todo-swatch-custom {
        width:26px; height:26px; border-radius:50%; cursor:pointer; border:2px dashed var(--cor-borda); flex-shrink:0;
        display:flex; align-items:center; justify-content:center; font-size:11px; position:relative; overflow:hidden; background:#fff; transition:.15s;
      }
      .todo-swatch-custom:hover { transform:scale(1.15); }
      .todo-swatch-custom.selecionado { border-color:var(--cor-dark-900); border-style:solid; box-shadow:0 0 0 2px #fff, 0 0 0 4px var(--cor-dark-900); }
      .todo-swatch-custom input[type=color] { position:absolute; inset:0; opacity:0; cursor:pointer; width:100%; height:100%; }
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
        .todo-addbar-linha2 { flex-direction:column; align-items:stretch; }
        .todo-addbar-submit { width:100%; height:38px; }
      }

      /* Agenda — visual limpo, mesma linguagem do resto do app */
      .modal.todo-modal-agenda { max-width:min(960px, 94vw); max-height:92vh; }
      .agenda-nav {
        display:flex; align-items:center; justify-content:space-between; gap:10px; padding:18px 22px 14px;
        border-bottom:1.5px solid var(--cor-borda-light);
      }
      .agenda-nav-data { display:flex; flex-direction:column; align-items:center; gap:4px; flex:1; }
      .agenda-nav-label { font-size:16px; font-weight:800; color:var(--cor-texto); text-align:center; line-height:1.2; }
      .agenda-nav-hoje-tag { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.5px; color:var(--cor-dark-900); background:var(--cor-primaria); border-radius:999px; padding:2px 9px; }
      .agenda-nav-hoje { font-size:11.5px; font-weight:700; color:var(--cor-texto-secundario); background:none; border:none; cursor:pointer; text-decoration:underline; }
      .agenda-toggle-passadas-row { display:flex; justify-content:center; padding:8px 0; border-bottom:1px solid var(--cor-borda-light); }
      .agenda-toggle-passadas {
        font-size:11.5px; font-weight:700; color:var(--cor-texto-secundario); background:var(--cor-fundo); border:1.5px solid var(--cor-borda-light);
        border-radius:999px; padding:5px 14px; cursor:pointer;
      }
      .agenda-toggle-passadas:hover { border-color:var(--cor-primaria); color:var(--cor-texto); }
      .agenda-trazer-pendencias {
        font-size:11.5px; font-weight:700; color:var(--cor-dark-900); background:var(--cor-primaria-light); border:1.5px solid var(--cor-primaria);
        border-radius:999px; padding:5px 14px; cursor:pointer;
      }
      .agenda-trazer-pendencias:hover { background:var(--cor-primaria); }
      .agenda-nav-btn {
        width:30px; height:30px; border-radius:50%; border:1.5px solid var(--cor-borda-light); background:#fff; cursor:pointer;
        font-size:16px; color:var(--cor-texto-secundario); flex-shrink:0; display:flex; align-items:center; justify-content:center;
      }
      .agenda-nav-btn:hover { border-color:var(--cor-dark-900); color:var(--cor-texto); }
      .agenda-lista { max-height:76vh; overflow-y:auto; padding:6px 10px; }
      .agenda-linha {
        display:flex; align-items:flex-start; gap:14px; min-height:36px; padding:8px 10px;
        border-bottom:1px solid var(--cor-borda-light);
      }
      .agenda-linha:last-child { border-bottom:none; }
      .agenda-linha:hover { background:var(--cor-fundo); border-radius:8px; }
      .agenda-hora { width:100px; flex-shrink:0; font-size:12px; font-weight:700; color:var(--cor-texto-muted); line-height:1.5; margin-top:2px; border-radius:6px; padding:2px 4px; margin-left:-4px; }
      .agenda-hora.clicavel { cursor:pointer; }
      .agenda-hora.clicavel:hover { background:var(--cor-primaria-light); color:var(--cor-dark-900); }
      .agenda-corpo { flex:1; min-width:0; display:flex; flex-direction:column; gap:6px; }
      .agenda-tarefas-lista { display:flex; flex-direction:column; gap:5px; }
      .agenda-add-icon {
        width:24px; height:24px; border-radius:50%; border:1.5px dashed var(--cor-borda); background:#fff; flex-shrink:0;
        color:var(--cor-texto-muted); cursor:pointer; font-size:14px; line-height:1; display:flex; align-items:center; justify-content:center;
        margin-top:1px;
      }
      .agenda-add-icon:hover { border-color:var(--cor-primaria); border-style:solid; color:var(--cor-texto); }
      .agenda-add-icon.tem-clipboard { border-style:solid; border-color:var(--cor-primaria); background:var(--cor-primaria-light); color:var(--cor-dark-900); }
      .agenda-tarefa {
        display:flex; align-items:center; gap:9px; background:#fff; border:1.5px solid var(--cor-borda-light); border-radius:8px;
        padding:6px 10px; border-left:3px solid var(--cor-primaria);
      }
      .agenda-tarefa.concluida { opacity:.5; }
      .agenda-tarefa.concluida .agenda-tarefa-texto { text-decoration:line-through; }
      .agenda-tarefa-texto { flex:1; min-width:0; font-size:13.5px; font-weight:600; color:var(--cor-texto); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer; }
      .agenda-tarefa-texto:hover { text-decoration:underline; }
      .agenda-x { border:none; background:none; cursor:pointer; color:var(--cor-texto-muted); font-size:15px; padding:2px 5px; flex-shrink:0; }
      .agenda-x:hover { color:var(--cor-perigo); }
      .agenda-copiar { border:none; background:none; cursor:pointer; color:var(--cor-texto-muted); font-size:13px; padding:2px 4px; flex-shrink:0; }
      .agenda-copiar:hover { color:var(--cor-primaria-dark); }
      .agenda-picker-colar-btn {
        width:100%; text-align:left; border:1.5px dashed var(--cor-primaria); background:var(--cor-primaria-light);
        border-radius:8px; padding:8px 12px; font-size:12.5px; font-weight:700; color:var(--cor-dark-900); cursor:pointer; margin-bottom:8px;
      }
      .agenda-picker-colar-btn:hover { background:var(--cor-primaria); }
      .agenda-picker-atrasadas-btn {
        width:100%; text-align:left; border:1.5px solid #fca5a5; background:#fef2f2;
        border-radius:8px; padding:8px 12px; font-size:12.5px; font-weight:700; color:#991b1b; cursor:pointer; margin-bottom:8px;
      }
      .agenda-picker-atrasadas-btn:hover { background:#fee2e2; }
      .agenda-picker-atrasadas-titulo { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.3px; color:#991b1b; margin-bottom:8px; }

      .agenda-picker { background:var(--cor-fundo); border:1.5px solid var(--cor-borda-light); border-radius:10px; padding:10px; padding-top:36px; box-sizing:border-box; position:relative; }
      .agenda-picker-fechar-x {
        position:absolute; top:8px; right:8px; width:26px; height:26px; border-radius:50%; border:1.5px solid #fca5a5;
        background:#fef2f2; color:#dc2626; font-size:13px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:2;
      }
      .agenda-picker-fechar-x:hover { background:#fee2e2; border-color:#dc2626; }
      .agenda-picker-busca {
        width:100%; border:1.5px solid var(--cor-borda-light); border-radius:8px; padding:8px 12px; font-size:13px;
        font-family:var(--font-principal); outline:none; margin-bottom:8px; box-sizing:border-box; color:var(--cor-texto); background:#fff;
      }
      .agenda-picker-busca:focus { border-color:var(--cor-primaria); box-shadow:0 0 0 3px var(--cor-primaria-light); }
      .agenda-picker-breadcrumb { display:flex; gap:5px; align-items:center; font-size:11px; font-weight:700; color:var(--cor-texto-muted); margin-bottom:8px; text-transform:uppercase; letter-spacing:.3px; flex-wrap:wrap; }
      .agenda-picker-breadcrumb span[data-agenda-picker-voltar] { cursor:pointer; color:var(--cor-primaria-dark); }
      .agenda-picker-breadcrumb .sep { cursor:default; color:var(--cor-borda); }
      .agenda-picker-lista { max-height:240px; overflow-y:auto; display:flex; flex-direction:column; gap:6px; padding:1px; }
      .agenda-picker-dot { width:9px; height:9px; border-radius:50%; flex-shrink:0; }
      .agenda-picker-item {
        padding:10px 12px; border-radius:9px; cursor:pointer; font-size:13px; font-family:var(--font-principal);
        color:var(--cor-texto); display:flex; gap:8px; align-items:center; background:#fff;
        border:1.5px solid var(--cor-borda-light); transition:.12s;
      }
      .agenda-picker-item:hover { border-color:var(--cor-primaria); box-shadow:0 2px 6px rgba(0,0,0,.07); }
      .agenda-picker-item-proj { font-size:10px; font-weight:700; color:var(--cor-texto-secundario); background:var(--cor-fundo); border:1px solid var(--cor-borda-light); border-radius:4px; padding:2px 7px; flex-shrink:0; white-space:nowrap; }
      .agenda-picker-item-cat { font-size:10px; font-weight:700; color:#fff; border-radius:4px; padding:2px 7px; flex-shrink:0; white-space:nowrap; }
      .agenda-picker-item-texto { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .agenda-picker-info-btn {
        border:none; background:none; cursor:pointer; color:var(--cor-texto-muted); font-size:15px; padding:2px 4px; flex-shrink:0; line-height:1;
      }
      .agenda-picker-info-btn:hover { color:var(--cor-primaria-dark); }
      .agenda-picker-item-sub { margin-left:20px; background:var(--cor-fundo); border-style:dashed; }
      .agenda-picker-item-sub .agenda-picker-item-texto { font-size:12.5px; color:var(--cor-texto-secundario); }
      .agenda-picker-nivel-item {
        display:flex; align-items:center; justify-content:space-between; gap:8px; padding:11px 13px; border-radius:9px;
        cursor:pointer; font-size:13.5px; font-weight:600; color:var(--cor-texto); background:#fff;
        border:1.5px solid var(--cor-borda-light); transition:.12s;
      }
      .agenda-picker-nivel-item:hover { border-color:var(--cor-primaria); box-shadow:0 2px 6px rgba(0,0,0,.07); }
      .agenda-picker-nivel-nome { display:flex; align-items:center; gap:9px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .agenda-picker-nivel-count { font-size:11.5px; font-weight:700; color:var(--cor-texto-muted); flex-shrink:0; }
      .agenda-picker-vazio { font-size:12.5px; color:var(--cor-texto-muted); padding:10px 6px; font-style:italic; }
      .agenda-picker-toggle-escolhidas {
        display:block; width:fit-content; border:none; background:none; font-size:11px; font-weight:600;
        color:var(--cor-texto-muted); cursor:pointer; padding:0 0 8px; text-decoration:underline;
      }
      .agenda-picker-toggle-escolhidas:hover { color:var(--cor-texto-secundario); }
      .agenda-picker-cancelar { margin-top:8px; border:none; background:none; font-size:12px; color:var(--cor-texto-muted); cursor:pointer; text-decoration:underline; padding:0; }
      .agenda-picker-criar-link {
        display:block; width:100%; text-align:left; border:none; background:none; font-size:12px; font-weight:600;
        color:var(--cor-primaria-dark); cursor:pointer; padding:8px 2px 2px; text-decoration:underline;
      }
      .agenda-picker-nova { display:flex; flex-direction:column; gap:8px; }
      .agenda-picker-nova-input, .agenda-picker-nova-textarea {
        width:100%; border:1.5px solid var(--cor-borda-light); border-radius:8px; padding:8px 12px; font-size:13px;
        font-family:var(--font-principal); outline:none; box-sizing:border-box; color:var(--cor-texto); background:#fff;
      }
      .agenda-picker-nova-textarea { resize:vertical; min-height:44px; }
      .agenda-picker-nova-input:focus, .agenda-picker-nova-textarea:focus { border-color:var(--cor-primaria); box-shadow:0 0 0 3px var(--cor-primaria-light); }
      .agenda-picker-nova-botoes { display:flex; justify-content:flex-end; gap:8px; }
      .agenda-picker-criar-btn {
        border:none; border-radius:8px; padding:8px 16px; font-size:12.5px; font-weight:700; cursor:pointer;
        background:var(--cor-primaria); color:var(--cor-dark-900);
      }
      .agenda-picker-criar-btn:hover { background:var(--cor-primaria-dark); }
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
      if (filtrosCategoria.size > 0 && !filtrosCategoria.has(t.categoria)) return false;
      if (filtroDependencia && t.dependencia !== filtroDependencia) return false;
      if (buscaLower) {
        const alvo = `${t.texto} ${t.projeto || ''} ${t.categoria || ''} ${t.dependencia || ''}`.toLowerCase();
        if (!alvo.includes(buscaLower)) return false;
      }
      return true;
    };

    const temFiltroAtivo = !!(filtroProjeto || filtrosCategoria.size > 0 || filtroDependencia || buscaLower);
    const contagemFiltrosAtivos = (filtroProjeto ? 1 : 0) + (filtrosCategoria.size > 0 ? 1 : 0) + (filtroDependencia ? 1 : 0);

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
        <div>
          <h2>Tarefas do Sistema</h2>
          <span class="subtitulo">${concluidas.length}/${totalFiltrado} concluídas (${pct}%) · ${pendentes.length} pendente${pendentes.length === 1 ? '' : 's'}${temFiltroAtivo ? ' filtrado' : ''}</span>
        </div>
        <button type="button" class="btn btn-secundario" id="todo-abrir-agenda">🗓️ Agendar</button>
      </div>
      <div class="todo-progresso-track"><div class="todo-progresso-fill" style="width:${pct}%"></div></div>

      <div class="todo-topo">
        <form id="form-nova-tarefa" class="todo-addbar">
          <input type="text" id="todo-texto" class="todo-addbar-texto" placeholder="Título da tarefa" required>
          <textarea id="todo-descricao" class="todo-addbar-descricao" placeholder="Descrição (obrigatória) — detalhes, contexto, o que for preciso" rows="2" required></textarea>
          <div class="todo-addbar-checklist">
            <div class="todo-addbar-checklist-titulo">Checklist (opcional)</div>
            <div id="todo-checklist-itens"></div>
            <button type="button" class="todo-checklist-add-btn" id="todo-checklist-add">+ adicionar item</button>
          </div>
          <div class="todo-addbar-linha2">
            <div class="todo-addbar-campo">
              <label>Projeto</label>
              <input type="text" id="todo-projeto" list="todo-projetos-lista" placeholder="Sem projeto">
              <datalist id="todo-projetos-lista">
                ${projetos.map(p => `<option value="${esc(p.nome)}">`).join('')}
              </datalist>
            </div>
            <div class="todo-addbar-campo">
              <label>Categoria</label>
              <div class="todo-addbar-cat-row">
                <select id="todo-categoria">
                  <option value="">Sem categoria</option>
                  ${categorias.map(c => `<option value="${esc(c.nome)}">${esc(c.nome)}</option>`).join('')}
                </select>
                <button type="button" class="todo-addbar-cat-nova-btn" id="todo-addbar-editar-categoria" title="Editar categoria selecionada">✎</button>
                <button type="button" class="todo-addbar-cat-nova-btn" id="todo-addbar-nova-categoria" title="Criar nova categoria">+</button>
              </div>
            </div>
            <div class="todo-addbar-campo">
              <label>Importância</label>
              <select id="todo-importancia">
                ${Object.entries(IMPORTANCIA_LABEL).map(([v, l]) => `<option value="${v}" ${v === '3' ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </div>
            <button type="submit" class="btn btn-primario todo-addbar-submit">Adicionar</button>
          </div>
        </form>
      </div>

      <div class="todo-searchbar">
        <input type="text" id="todo-busca" placeholder="Buscar tarefa, projeto, categoria ou dependência..." value="${esc(busca)}">
      </div>

      <div class="todo-filtros-bar">
        <button type="button" class="todo-filtros-toggle ${filtrosPainelAberto ? 'aberto' : ''}" id="todo-filtros-toggle">
          🔍 Filtros ${contagemFiltrosAtivos > 0 ? `<span class="todo-filtros-badge">${contagemFiltrosAtivos}</span>` : ''}
          <span class="seta">▾</span>
        </button>
        ${contagemFiltrosAtivos > 0 ? `<button type="button" class="todo-filtros-limpar" id="todo-filtros-limpar">Limpar filtros</button>` : ''}
        <button type="button" class="todo-gear-btn" id="todo-abrir-gerenciar" title="Gerenciar projetos e categorias">⚙</button>
      </div>

      <div class="todo-filtros-painel" id="todo-filtros-painel" style="display:${filtrosPainelAberto ? 'flex' : 'none'};">
        <div class="todo-filtros-secao">
          <div class="todo-filtros-secao-titulo">Projeto</div>
          <div class="todo-filtros-chips">
            <div class="todo-chip ${!filtroProjeto ? 'ativo' : ''}" data-tipo="projeto" data-valor="">
              Todos <span class="todo-chip-count">${pendentesTodas.length}</span>
            </div>
            ${projetosOrdenadosPorImportancia().map(p => `
              <div class="todo-chip ${filtroProjeto === p.nome ? 'ativo' : ''}" data-tipo="projeto" data-valor="${esc(p.nome)}">
                <span class="todo-chip-dot" style="background:${corProjeto(p.nome)}"></span>
                ${esc(p.nome)}
                <span class="todo-chip-count">${pendentesTodas.filter(t => t.projeto === p.nome).length}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="todo-filtros-secao">
          <div class="todo-filtros-secao-titulo">Categoria <span class="todo-filtros-hint">pode escolher mais de uma</span></div>
          <div class="todo-filtros-chips">
            <div class="todo-chip ${filtrosCategoria.size === 0 ? 'ativo' : ''}" data-tipo="categoria" data-valor="">
              Todas
            </div>
            ${categoriasOrdenadasPorImportancia().map(c => `
              <div class="todo-chip ${filtrosCategoria.has(c.nome) ? 'ativo' : ''}" data-tipo="categoria" data-valor="${esc(c.nome)}">
                <span class="todo-chip-dot" style="background:${esc(c.cor)}"></span>
                ${esc(c.nome)}
                <span class="todo-chip-count">${pendentesTodas.filter(t => t.categoria === c.nome).length}</span>
              </div>
            `).join('')}
            <button type="button" class="todo-chip todo-chip-add" id="todo-filtros-nova-categoria">+ Nova categoria</button>
          </div>
        </div>

        ${dependencias.length > 0 ? `
          <div class="todo-filtros-secao">
            <div class="todo-filtros-secao-titulo">Dependência</div>
            <select id="todo-filtro-dependencia" class="todo-select-filtro">
              <option value="">Todas as dependências</option>
              ${dependencias.map(d => `<option value="${esc(d)}" ${filtroDependencia === d ? 'selected' : ''}>⛓ ${esc(d)}</option>`).join('')}
            </select>
          </div>
        ` : ''}
      </div>

      <div id="todo-grupos">
        ${pendentes.length === 0
          ? `<div class="todo-vazio"><div class="icone">✅</div><p>${temFiltroAtivo ? 'Nenhuma tarefa encontrada com esses filtros.' : 'Nenhuma tarefa pendente. Tudo em dia!'}</p></div>`
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
      const descricao = document.getElementById('todo-descricao').value.trim();
      const projeto = document.getElementById('todo-projeto').value.trim();
      const categoria = document.getElementById('todo-categoria').value;
      const importancia = parseInt(document.getElementById('todo-importancia').value, 10) || 3;
      if (!texto) return;
      if (!descricao) { Utils.toast('Descrição é obrigatória.', 'alerta'); document.getElementById('todo-descricao').focus(); return; }
      const checklist = [...document.querySelectorAll('#todo-checklist-itens .todo-checklist-item-input')]
        .map(inp => inp.value.trim())
        .filter(Boolean)
        .map(txt => ({ id: _novoIdChecklist(), texto: txt, concluido: false }));
      await adicionar(texto, projeto, categoria, importancia, descricao, checklist);
    });
    document.getElementById('todo-addbar-nova-categoria').addEventListener('click', () => {
      abrirCriarCategoriaRapida();
    });
    document.getElementById('todo-addbar-editar-categoria').addEventListener('click', () => {
      const nomeAtual = document.getElementById('todo-categoria').value;
      if (!nomeAtual) { Utils.toast('Escolha uma categoria pra editar.', 'alerta'); return; }
      const cat = categorias.find(c => c.nome === nomeAtual);
      if (!cat) return;
      abrirEditarCategoriaRapida(cat.id, (nomeNovo) => {
        const sel = document.getElementById('todo-categoria');
        if (sel) {
          const opt = [...sel.options].find(o => o.value === nomeAtual);
          if (opt) { opt.value = nomeNovo; opt.textContent = nomeNovo; }
          sel.value = nomeNovo;
        }
      });
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
        if (tipo === 'projeto') { filtroProjeto = valor; }
        if (tipo === 'categoria') {
          if (!valor) { filtrosCategoria.clear(); }
          else if (filtrosCategoria.has(valor)) { filtrosCategoria.delete(valor); }
          else { filtrosCategoria.add(valor); }
        }
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
    document.getElementById('todo-abrir-agenda').addEventListener('click', abrirModalAgenda);
    document.getElementById('todo-filtros-toggle').addEventListener('click', () => {
      filtrosPainelAberto = !filtrosPainelAberto;
      renderizar();
    });
    const btnLimparFiltros = document.getElementById('todo-filtros-limpar');
    if (btnLimparFiltros) btnLimparFiltros.addEventListener('click', () => {
      filtroProjeto = ''; filtrosCategoria.clear(); filtroDependencia = ''; busca = '';
      renderizar();
    });
    document.getElementById('todo-filtros-nova-categoria').addEventListener('click', () => {
      abrirCriarCategoriaRapida();
    });
    document.getElementById('todo-checklist-add').addEventListener('click', () => {
      _adicionarLinhaChecklist(document.getElementById('todo-checklist-itens'));
    });
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
    if (Array.isArray(t.checklist) && t.checklist.length) {
      const feitos = t.checklist.filter(i => i.concluido).length;
      tags.push(`<span class="todo-checklist-badge">☑ ${feitos}/${t.checklist.length}</span>`);
    }
    return `
      <div class="todo-item ${concluida ? 'concluida' : ''}" style="border-left-color:${cor};">
        <div class="todo-check ${concluida ? 'marcado' : ''}" onclick="Todo.alternarStatus('${t.id}')">${check}</div>
        <div class="todo-corpo" onclick="Todo.abrirDetalheTarefa('${t.id}')" style="cursor:pointer;">
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

  function _novoIdChecklist() {
    return 'chk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // Cria uma linha de item de checklist vazia (sem data-id — entra
  // como item novo no momento de salvar). Usada tanto no formulário
  // de criação quanto no modal de editar.
  function _adicionarLinhaChecklist(container) {
    const row = document.createElement('div');
    row.className = 'todo-checklist-item-row';
    row.innerHTML = `<input type="checkbox" class="todo-checklist-item-check">
                      <input type="text" class="todo-checklist-item-input" placeholder="Item do checklist...">
                      <button type="button" class="todo-checklist-item-remover" title="Remover">×</button>`;
    row.querySelector('.todo-checklist-item-remover').onclick = () => row.remove();
    container.appendChild(row);
    row.querySelector('.todo-checklist-item-input').focus();
  }

  function _scrollTopoLista() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('modulo-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function adicionar(texto, projeto, categoria, importancia, descricao, checklist) {
    if (projeto && !projetos.some(p => p.nome === projeto)) {
      const id = await Database.criarRaiz(COL_PROJ, { nome: projeto, importancia: 3 });
      projetos.push({ id, nome: projeto, importancia: 3 });
    }
    const maxOrdem = tarefas.reduce((m, t) => Math.max(m, t.ordem || 0), 0);
    const dados = { texto, descricao: descricao || '', projeto: projeto || '', categoria: categoria || '', dependencia: '', concluida: false, ordem: maxOrdem + 1, importancia: importancia || 3, checklist: checklist || [] };
    const id = await Database.criarRaiz(COL, dados);
    tarefas.push({ id, ...dados });
    Utils.toast('Tarefa adicionada.', 'sucesso');
    renderizar();
    _scrollTopoLista();
  }

  async function alternarStatus(id) {
    const t = tarefas.find(x => x.id === id);
    if (!t) return;
    t.concluida = !t.concluida;
    t.updatedAtMs = Date.now();
    await Database.atualizarRaiz(COL, id, { concluida: t.concluida });
    renderizar();
  }

  // Marca/desmarca um item do checklist de uma tarefa. Regrava o array
  // inteiro (Firestore não faz update parcial por índice de array).
  async function alternarChecklistItem(tarefaId, itemId) {
    const t = tarefas.find(x => x.id === tarefaId);
    if (!t || !Array.isArray(t.checklist)) return;
    const item = t.checklist.find(i => i.id === itemId);
    if (!item) return;
    item.concluido = !item.concluido;
    await Database.atualizarRaiz(COL, tarefaId, { checklist: t.checklist });
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

  // Overlay secundário — fica POR CIMA de um overlay já aberto (ex: abrir
  // o detalhe de uma tarefa sem fechar a Agenda que está atrás dela).
  function abrirOverlaySecundario(html, modalClass) {
    fecharOverlaySecundario();
    const overlay = document.createElement('div');
    overlay.id = 'todo-overlay-2';
    overlay.className = 'modal-overlay ativo';
    overlay.style.zIndex = '1100';
    overlay.innerHTML = `<div class="modal ${modalClass || ''}">${html}</div>`;
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) fecharOverlaySecundario(); });
    document.body.appendChild(overlay);
    return overlay;
  }
  function fecharOverlaySecundario() {
    document.getElementById('todo-overlay-2')?.remove();
  }

  // ============================================
  // Detalhe da tarefa (somente leitura) — título + descrição
  // formatados, com botão pra editar. Abre em overlay secundário pra
  // funcionar tanto na lista principal quanto por cima da Agenda.
  // ============================================
  function abrirDetalheTarefa(id) {
    const t = tarefas.find(x => x.id === id);
    if (!t) return;
    const cat = t.categoria ? categorias.find(c => c.nome === t.categoria) : null;
    const checklist = Array.isArray(t.checklist) ? t.checklist : [];
    const html = `
      <div class="modal-header"><h3>Detalhe da tarefa</h3></div>
      <div class="modal-body">
        <div class="todo-detalhe-titulo">${esc(t.texto)}</div>
        ${(t.projeto || cat || t.dependencia) ? `
          <div class="todo-metatags" style="margin-bottom:14px;">
            ${t.projeto ? `<span class="todo-tag" style="background:${corProjeto(t.projeto)};color:#fff;">${esc(t.projeto)}</span>` : ''}
            ${cat ? `<span class="todo-tag" style="background:${esc(cat.cor)};color:#fff;">${esc(cat.nome)}</span>` : ''}
            ${t.dependencia ? `<span class="todo-tag todo-tag-dep">⛓ ${esc(t.dependencia)}</span>` : ''}
          </div>` : ''}
        <div class="todo-detalhe-descricao">${t.descricao ? esc(t.descricao).replace(/\n/g, '<br>') : '<span class="text-sm text-muted">Sem descrição.</span>'}</div>
        ${checklist.length ? `
          <div class="todo-detalhe-checklist-titulo">Checklist</div>
          <div class="todo-detalhe-checklist">
            ${checklist.map(item => `
              <div class="todo-detalhe-checklist-item ${item.concluido ? 'concluido' : ''}" data-detalhe-check-item="${item.id}">
                <div class="todo-check ${item.concluido ? 'marcado' : ''}" style="width:16px;height:16px;flex-shrink:0;">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
                <span>${esc(item.texto)}</span>
              </div>`).join('')}
          </div>
        ` : ''}
      </div>
      <div class="modal-footer" style="justify-content:space-between;">
        <button type="button" class="btn btn-secundario" id="det-fechar">Fechar</button>
        <button type="button" class="btn btn-primario" id="det-editar">✎ Editar</button>
      </div>`;
    abrirOverlaySecundario(html, 'todo-modal');
    document.getElementById('det-fechar').onclick = fecharOverlaySecundario;
    document.getElementById('det-editar').onclick = () => { fecharOverlaySecundario(); abrirModalEditar(id); };
    document.querySelectorAll('[data-detalhe-check-item]').forEach(el => {
      el.onclick = async () => { await alternarChecklistItem(id, el.dataset.detalheCheckItem); abrirDetalheTarefa(id); };
    });
  }

  // ============================================
  // Agenda do dia — grade de horários (30min, 07:00–18:00), visual
  // limpo (mesma linguagem do resto do app, sem tema temático).
  // Alocações vivem em tarefasAgenda, desacopladas da tarefa — a
  // MESMA tarefa pode ocupar vários horários ao mesmo tempo.
  // ============================================
  function _hojeStr(offsetDias) {
    const d = new Date();
    d.setDate(d.getDate() + (offsetDias || 0));
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dia = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dia}`;
  }

  function _gerarSlots() {
    const slots = [];
    for (let h = 7; h < 18; h++) {
      for (const m of [0, 30]) {
        const inicio = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const fimMin = m + 30, fimH = fimMin >= 60 ? h + 1 : h, fimM = fimMin % 60;
        const fim = `${String(fimH).padStart(2, '0')}:${String(fimM).padStart(2, '0')}`;
        slots.push({ inicio, fim });
      }
    }
    return slots;
  }

  function _formatarDataAgenda(dataStr) {
    const [y, m, d] = dataStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    let label = dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    label = label.charAt(0).toUpperCase() + label.slice(1);
    return label;
  }

  function abrirModalAgenda() {
    if (!agendaDataAtual) agendaDataAtual = _hojeStr();
    agendaSlotAberto = null;
    agendaFiltroPicker = '';
    agendaPickerProjeto = null;
    agendaPickerCategoria = null;
    agendaCriandoNova = false;
    agendaMostrarJaEscolhidas = false;
    agendaMostrandoAtrasadas = false;
    abrirOverlay('<div id="agenda-conteudo"></div>', 'todo-modal-agenda');
    _renderizarAgenda();
  }

  // Picker hierárquico: Sistema (projeto) → Categoria → Tarefa, com
  // busca sempre disponível pra pular direto pra tarefa.
  const AGENDA_PROJ_VAZIO = '__proj_vazio__';
  const AGENDA_CAT_TODAS = '__cat_todas__';
  const AGENDA_CAT_VAZIA = '__cat_vazia__';

  function _agendaProjetoReal(valor) { return valor === AGENDA_PROJ_VAZIO ? '' : valor; }
  function _agendaCategoriaBate(catTarefa, alvo) {
    if (alvo === AGENDA_CAT_TODAS) return true;
    const alvoReal = alvo === AGENDA_CAT_VAZIA ? '' : alvo;
    return (catTarefa || '') === alvoReal;
  }

  function _htmlPickerConteudo(pendentes) {
    const filtro = (agendaFiltroPicker || '').trim().toLowerCase();
    if (filtro) {
      const achados = pendentes.filter(p => `${p.texto} ${p.projeto || ''} ${p.categoria || ''}`.toLowerCase().includes(filtro));
      return `<div class="agenda-picker-lista" id="agenda-picker-lista">${_htmlListaTarefas(achados)}</div>`;
    }
    if (!agendaPickerProjeto) {
      const nomes = [...new Set(pendentes.map(p => p.projeto || ''))].sort((a, b) => (a || 'zzz').localeCompare(b || 'zzz', 'pt-BR'));
      return `<div class="agenda-picker-lista" id="agenda-picker-lista">
        ${nomes.map(nome => `
          <div class="agenda-picker-nivel-item" data-agenda-picker-projeto="${nome === '' ? AGENDA_PROJ_VAZIO : esc(nome)}">
            <span class="agenda-picker-nivel-nome"><span class="agenda-picker-dot" style="background:${corProjeto(nome)}"></span>${esc(nome || 'Sem projeto')}</span>
            <span class="agenda-picker-nivel-count">${pendentes.filter(p => (p.projeto || '') === nome).length} ›</span>
          </div>`).join('')}
      </div>`;
    }
    const projetoReal = _agendaProjetoReal(agendaPickerProjeto);
    if (!agendaPickerCategoria) {
      const doProjeto = pendentes.filter(p => (p.projeto || '') === projetoReal);
      const nomesCat = [...new Set(doProjeto.map(p => p.categoria || ''))].sort((a, b) => (a || 'zzz').localeCompare(b || 'zzz', 'pt-BR'));
      return `
        ${_htmlBreadcrumb()}
        <div class="agenda-picker-lista" id="agenda-picker-lista">
          <div class="agenda-picker-nivel-item" data-agenda-picker-categoria="${AGENDA_CAT_TODAS}">
            <span class="agenda-picker-nivel-nome"><span class="agenda-picker-dot" style="background:${corProjeto(projetoReal)}"></span>Todas as tarefas do projeto</span>
            <span class="agenda-picker-nivel-count">${doProjeto.length} ›</span>
          </div>
          ${nomesCat.map(nome => {
            const catObj = nome ? categorias.find(c => c.nome === nome) : null;
            const cor = catObj ? catObj.cor : '#9ca3af';
            return `
            <div class="agenda-picker-nivel-item" data-agenda-picker-categoria="${nome === '' ? AGENDA_CAT_VAZIA : esc(nome)}">
              <span class="agenda-picker-nivel-nome"><span class="agenda-picker-dot" style="background:${esc(cor)}"></span>${esc(nome || 'Sem categoria')}</span>
              <span class="agenda-picker-nivel-count">${doProjeto.filter(p => (p.categoria || '') === nome).length} ›</span>
            </div>`;
          }).join('')}
        </div>`;
    }
    const doProjetoCategoria = pendentes.filter(p => (p.projeto || '') === projetoReal && _agendaCategoriaBate(p.categoria, agendaPickerCategoria));
    return `
      ${_htmlBreadcrumb()}
      <div class="agenda-picker-lista" id="agenda-picker-lista">${_htmlListaTarefas(doProjetoCategoria)}</div>`;
  }

  function _htmlBreadcrumb() {
    const partes = [`<span data-agenda-picker-voltar="raiz">Sistemas</span>`];
    if (agendaPickerProjeto) {
      const nomeProj = _agendaProjetoReal(agendaPickerProjeto) || 'Sem projeto';
      partes.push(`<span ${agendaPickerCategoria ? 'data-agenda-picker-voltar="projeto"' : ''}>${esc(nomeProj)}</span>`);
    }
    if (agendaPickerCategoria) {
      const nomeCat = agendaPickerCategoria === AGENDA_CAT_TODAS ? 'Todas' : (agendaPickerCategoria === AGENDA_CAT_VAZIA ? 'Sem categoria' : agendaPickerCategoria);
      partes.push(`<span>${esc(nomeCat)}</span>`);
    }
    return `<div class="agenda-picker-breadcrumb">${partes.join(' <span class="sep">›</span> ')}</div>`;
  }

  // Alocações do MESMO dia, em horário anterior ao informado, cuja
  // tarefa/item ainda não foi concluído — candidatas a "puxar pra agora".
  function _alocacoesAtrasadas(dataStr, horarioLimite) {
    return agendaAlocacoes
      .filter(a => a.data === dataStr && a.horario < horarioLimite)
      .filter(a => {
        const t = tarefas.find(x => x.id === a.tarefaId);
        if (!t) return false;
        if (a.itemId) {
          const item = (Array.isArray(t.checklist) ? t.checklist : []).find(i => i.id === a.itemId);
          return !!item && !item.concluido;
        }
        return !t.concluida;
      });
  }

  function _htmlListaAtrasadas(alocs) {
    if (alocs.length === 0) return `<div class="agenda-picker-vazio">Nada pendente em horário anterior.</div>`;
    return alocs.map(a => {
      const t = tarefas.find(x => x.id === a.tarefaId);
      if (!t) return '';
      const item = a.itemId ? (Array.isArray(t.checklist) ? t.checklist.find(i => i.id === a.itemId) : null) : null;
      const label = item ? item.texto : t.texto;
      return `
      <div class="agenda-picker-item" data-agenda-puxar-alocacao="${a.id}">
        <span class="agenda-picker-item-proj">${esc(a.horario)}</span>
        <span class="agenda-picker-item-texto">${item ? '↳ ' : ''}${esc(label)}</span>
      </div>`;
    }).join('');
  }

  function _htmlListaTarefas(lista) {
    if (lista.length === 0) return `<div class="agenda-picker-vazio">Nenhuma tarefa encontrada.</div>`;
    const check = `<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    return lista.map(p => {
      const cat = p.categoria ? categorias.find(c => c.nome === p.categoria) : null;
      const itensChecklistPendentes = (Array.isArray(p.checklist) ? p.checklist : [])
        .filter(i => !i.concluido && (agendaMostrarJaEscolhidas || !agendaItensJaAlocados.has(`${p.id}::${i.id}`)));
      const linhaTarefaHtml = `
      <div class="agenda-picker-item" data-agenda-escolher="${p.id}" data-agenda-detalhe-picker="${p.id}">
        <div class="todo-check" style="width:16px;height:16px;flex-shrink:0;" data-agenda-picker-concluir="${p.id}" title="Marcar como concluída">${check}</div>
        <span class="agenda-picker-dot" style="background:${p.projeto ? corProjeto(p.projeto) : '#9ca3af'}"></span>
        ${p.projeto ? `<span class="agenda-picker-item-proj">${esc(p.projeto)}</span>` : ''}
        ${cat ? `<span class="agenda-picker-item-cat" style="background:${esc(cat.cor)}">${esc(cat.nome)}</span>` : ''}
        <span class="agenda-picker-item-texto">${esc(p.texto)}</span>
        <button type="button" class="agenda-picker-info-btn" data-agenda-ver-descricao="${p.id}" title="Ver descrição">ⓘ</button>
      </div>`;
      const linhasChecklistHtml = itensChecklistPendentes.map(item => `
      <div class="agenda-picker-item agenda-picker-item-sub" data-agenda-escolher="${p.id}::${item.id}" data-agenda-detalhe-picker="${p.id}">
        <div class="todo-check" style="width:15px;height:15px;flex-shrink:0;" data-agenda-picker-concluir-item="${p.id}::${item.id}" title="Marcar como concluído">${check}</div>
        <span class="agenda-picker-item-texto">↳ ${esc(item.texto)}</span>
        <button type="button" class="agenda-picker-info-btn" data-agenda-ver-descricao="${p.id}" title="Ver descrição da tarefa">ⓘ</button>
      </div>`).join('');
      return linhaTarefaHtml + linhasChecklistHtml;
    }).join('');
  }

  function _wirePicker(container, pendentes, dataStr, slot) {
    if (!container) return;
    container.querySelectorAll('[data-agenda-picker-projeto]').forEach(item => {
      item.onclick = () => { agendaPickerProjeto = item.dataset.agendaPickerProjeto; _renderizarAgenda(); };
    });
    container.querySelectorAll('[data-agenda-picker-categoria]').forEach(item => {
      item.onclick = () => { agendaPickerCategoria = item.dataset.agendaPickerCategoria; _renderizarAgenda(); };
    });
    container.querySelectorAll('[data-agenda-picker-voltar]').forEach(item => {
      item.onclick = () => {
        const alvo = item.dataset.agendaPickerVoltar;
        if (alvo === 'raiz') { agendaPickerProjeto = null; agendaPickerCategoria = null; }
        if (alvo === 'projeto') { agendaPickerCategoria = null; }
        _renderizarAgenda();
      };
    });
    container.querySelectorAll('[data-agenda-escolher]').forEach(item => {
      item.onclick = async () => {
        // Não fecha nem reseta a navegação — assim dá pra escolher várias
        // tarefas seguidas pro mesmo horário sem reabrir tudo de novo.
        // A tarefa escolhida some da lista sozinha (já fica "já alocada").
        const [tarefaId, itemId] = item.dataset.agendaEscolher.split('::');
        await _atribuirTarefaSlot(tarefaId, dataStr, slot, itemId || null);
      };
      // Clique direito: mostra a descrição da tarefa sem escolher/alocar nada.
      item.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation(); // não deixa "vazar" pro clique-direito-de-colar da linha do horário por baixo
        const tarefaId = item.dataset.agendaDetalhePicker;
        if (tarefaId) abrirDetalheTarefa(tarefaId);
      };
    });
    container.querySelectorAll('[data-agenda-picker-concluir]').forEach(chk => {
      chk.onclick = async (e) => {
        e.stopPropagation();
        await alternarStatus(chk.dataset.agendaPickerConcluir);
        _renderizarAgenda();
      };
    });
    container.querySelectorAll('[data-agenda-picker-concluir-item]').forEach(chk => {
      chk.onclick = async (e) => {
        e.stopPropagation();
        const [tarefaId, itemId] = chk.dataset.agendaPickerConcluirItem.split('::');
        await alternarChecklistItem(tarefaId, itemId);
        _renderizarAgenda();
      };
    });
    container.querySelectorAll('[data-agenda-ver-descricao]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        abrirDetalheTarefa(btn.dataset.agendaVerDescricao);
      };
    });
  }

  function _renderizarAgenda() {
    const el = document.getElementById('agenda-conteudo');
    if (!el) return;
    // Preserva a posição de rolagem — sem isso, toda vez que algo mudava
    // (fechar seletor, escolher tarefa, etc.) a lista voltava pro topo.
    // Só restaura se for o MESMO dia (trocar de dia deve voltar ao topo).
    const listaAntiga = el.querySelector('.agenda-lista');
    const diaAntigo = listaAntiga ? listaAntiga.dataset.dia : null;
    const scrollSalvo = listaAntiga ? listaAntiga.scrollTop : 0;
    const dataStr = agendaDataAtual;
    const ehHoje = dataStr === _hojeStr();
    const agora = new Date();
    const horaAgora = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
    const todosSlots = _gerarSlots();
    const slots = (agendaEsconderPassadas && ehHoje) ? todosSlots.filter(s => s.fim > horaAgora) : todosSlots;
    const qtdEscondidos = todosSlots.length - slots.length;

    // Quem já está agendado NESTE dia não deve continuar aparecendo pra
    // escolher de novo (nem no mesmo horário nem em outro) — a menos que
    // "mostrar já escolhidas" esteja ligado.
    const alocacoesHoje = agendaAlocacoes.filter(a => a.data === dataStr);
    agendaTarefasJaAlocadas = new Set(alocacoesHoje.filter(a => !a.itemId).map(a => a.tarefaId));
    agendaItensJaAlocados = new Set(alocacoesHoje.filter(a => a.itemId).map(a => `${a.tarefaId}::${a.itemId}`));

    const diaAnteriorStr = _diaOffset(dataStr, -1);
    const pendenciasOntem = agendaAlocacoes.filter(a => a.data === diaAnteriorStr).filter(a => {
      const t = tarefas.find(x => x.id === a.tarefaId);
      if (!t) return false;
      if (a.itemId) {
        const item = (Array.isArray(t.checklist) ? t.checklist : []).find(i => i.id === a.itemId);
        return item && !item.concluido;
      }
      return !t.concluida;
    });

    const pendentesTodas = tarefas.filter(t => !t.concluida)
      .sort((a, b) => (a.importancia ?? 3) - (b.importancia ?? 3) || (a.ordem || 0) - (b.ordem || 0));
    const pendentes = agendaMostrarJaEscolhidas ? pendentesTodas : pendentesTodas.filter(p => !agendaTarefasJaAlocadas.has(p.id));

    el.innerHTML = `
      <div class="agenda-nav">
        <button type="button" class="agenda-nav-btn" id="agenda-dia-anterior" title="Dia anterior">‹</button>
        <div class="agenda-nav-data">
          <div class="agenda-nav-label">${esc(_formatarDataAgenda(dataStr))}</div>
          ${ehHoje ? `<span class="agenda-nav-hoje-tag">hoje</span>` : `<button type="button" class="agenda-nav-hoje" id="agenda-ir-hoje">ir pra hoje</button>`}
        </div>
        <button type="button" class="agenda-nav-btn" id="agenda-dia-seguinte" title="Dia seguinte">›</button>
      </div>
      ${ehHoje ? `
        <div class="agenda-toggle-passadas-row">
          <button type="button" class="agenda-toggle-passadas" id="agenda-toggle-passadas">
            ${agendaEsconderPassadas ? `👁 mostrar horários passados${qtdEscondidos ? ` (${qtdEscondidos})` : ''}` : '🕐 esconder horários que já passaram'}
          </button>
        </div>
      ` : ''}
      ${pendenciasOntem.length > 0 ? `
        <div class="agenda-toggle-passadas-row">
          <button type="button" class="agenda-trazer-pendencias" id="agenda-trazer-pendencias">
            ↩️ Trazer ${pendenciasOntem.length} pendência${pendenciasOntem.length === 1 ? '' : 's'} do dia anterior
          </button>
        </div>
      ` : ''}
      <div class="agenda-lista" data-dia="${dataStr}">
        ${slots.map(s => {
          const alocsSlot = agendaAlocacoes.filter(a => a.data === dataStr && a.horario === s.inicio);
          const pickerAberto = agendaSlotAberto === s.inicio;
          const atrasadasSlot = pickerAberto ? _alocacoesAtrasadas(dataStr, s.inicio) : [];
          return `
            <div class="agenda-linha" data-agenda-slot-hora="${s.inicio}">
              <div class="agenda-hora ${!pickerAberto ? 'clicavel' : ''}" ${!pickerAberto ? `data-agenda-abrir="${s.inicio}"` : ''}>${s.inicio} a ${s.fim}</div>
              <div class="agenda-corpo">
                ${alocsSlot.length ? `<div class="agenda-tarefas-lista">
                  ${alocsSlot.map(a => {
                    const t = tarefas.find(x => x.id === a.tarefaId);
                    if (!t) return '';
                    const item = a.itemId ? (Array.isArray(t.checklist) ? t.checklist.find(i => i.id === a.itemId) : null) : null;
                    if (a.itemId && !item) return ''; // item do checklist foi removido depois de agendado
                    const label = item ? item.texto : t.texto;
                    const concluidoAloc = item ? !!item.concluido : !!t.concluida;
                    return `
                      <div class="agenda-tarefa ${concluidoAloc ? 'concluida' : ''}">
                        <div class="todo-check" style="width:16px;height:16px;flex-shrink:0;" data-agenda-check="${t.id}" data-agenda-check-item="${a.itemId || ''}">
                          <svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </div>
                        <span class="agenda-tarefa-texto" data-agenda-detalhe="${t.id}" title="Ver detalhe">${item ? '↳ ' : ''}${esc(label)}</span>
                        <button type="button" class="agenda-copiar" title="Copiar pra outro horário" data-agenda-copiar-tarefa="${t.id}" data-agenda-copiar-item="${a.itemId || ''}" data-agenda-copiar-label="${esc(label)}">📋</button>
                        <button type="button" class="agenda-x" title="Remover deste horário" data-agenda-remover="${a.id}">×</button>
                      </div>`;
                  }).join('')}
                </div>` : ''}
                ${pickerAberto ? `
                  <div class="agenda-picker">
                    <button type="button" class="agenda-picker-fechar-x" data-agenda-fechar-picker title="Fechar seletor">✕</button>
                    ${agendaCriandoNova ? `
                      <div class="agenda-picker-nova">
                        <input type="text" id="agenda-nova-titulo" class="agenda-picker-nova-input" placeholder="Título da nova tarefa" value="${esc(agendaFiltroPicker)}">
                        <textarea id="agenda-nova-descricao" class="agenda-picker-nova-textarea" placeholder="Descrição (obrigatória)" rows="2"></textarea>
                        <div class="agenda-picker-nova-botoes">
                          <button type="button" class="agenda-picker-cancelar" id="agenda-nova-cancelar">Cancelar</button>
                          <button type="button" class="agenda-picker-criar-btn" id="agenda-nova-criar">Criar e agendar aqui</button>
                        </div>
                      </div>
                    ` : agendaMostrandoAtrasadas ? `
                      <div class="agenda-picker-atrasadas-titulo">Não concluídas em horários anteriores de hoje:</div>
                      <div class="agenda-picker-lista">${_htmlListaAtrasadas(atrasadasSlot)}</div>
                      <button type="button" class="agenda-picker-cancelar" id="agenda-fechar-atrasadas">‹ Voltar pra busca</button>
                    ` : `
                      ${agendaClipboard ? `
                        <button type="button" class="agenda-picker-colar-btn" id="agenda-colar-aqui">📌 Colar aqui: ${esc(agendaClipboard.label)}</button>
                      ` : ''}
                      ${atrasadasSlot.length > 0 ? `
                        <button type="button" class="agenda-picker-atrasadas-btn" id="agenda-abrir-atrasadas">⏪ Puxar ${atrasadasSlot.length} não concluída${atrasadasSlot.length === 1 ? '' : 's'} de horário anterior</button>
                      ` : ''}
                      <input type="text" class="agenda-picker-busca" id="agenda-picker-busca" placeholder="🔍 Buscar tarefa por nome, sistema ou categoria..." value="${esc(agendaFiltroPicker)}">
                      <button type="button" class="agenda-picker-toggle-escolhidas" id="agenda-toggle-ja-escolhidas">
                        ${agendaMostrarJaEscolhidas ? '🙈 esconder já escolhidas' : '👁 mostrar já escolhidas'}
                      </button>
                      <div id="agenda-picker-dinamico">${_htmlPickerConteudo(pendentes)}</div>
                      <button type="button" class="agenda-picker-criar-link" id="agenda-abrir-criar-nova">+ Não existe ainda? Criar tarefa nova</button>
                    `}
                  </div>
                ` : ''}
              </div>
              ${!pickerAberto ? `<button type="button" class="agenda-add-icon ${agendaClipboard ? 'tem-clipboard' : ''}" data-agenda-abrir="${s.inicio}" title="${agendaClipboard ? 'Clique pra escolher — ou botão direito pra colar: ' + esc(agendaClipboard.label) : 'Adicionar tarefa neste horário'}">+</button>` : ''}
            </div>`;
        }).join('')}
      </div>`;

    const listaNova = el.querySelector('.agenda-lista');
    if (listaNova && diaAntigo === dataStr) listaNova.scrollTop = scrollSalvo;

    document.getElementById('agenda-dia-anterior').onclick = () => { agendaDataAtual = _diaOffset(dataStr, -1); agendaSlotAberto = null; agendaCriandoNova = false; agendaMostrarJaEscolhidas = false; agendaMostrandoAtrasadas = false; _renderizarAgenda(); };
    document.getElementById('agenda-dia-seguinte').onclick = () => { agendaDataAtual = _diaOffset(dataStr, 1); agendaSlotAberto = null; agendaCriandoNova = false; agendaMostrarJaEscolhidas = false; agendaMostrandoAtrasadas = false; _renderizarAgenda(); };
    const btnHoje = document.getElementById('agenda-ir-hoje');
    if (btnHoje) btnHoje.onclick = () => { agendaDataAtual = _hojeStr(); agendaSlotAberto = null; agendaCriandoNova = false; agendaMostrarJaEscolhidas = false; agendaMostrandoAtrasadas = false; _renderizarAgenda(); };
    const btnTogglePassadas = document.getElementById('agenda-toggle-passadas');
    if (btnTogglePassadas) btnTogglePassadas.onclick = () => {
      agendaEsconderPassadas = !agendaEsconderPassadas;
      localStorage.setItem('agenda_esconder_passadas', agendaEsconderPassadas ? '1' : '0');
      _renderizarAgenda();
    };
    const btnTrazerPendencias = document.getElementById('agenda-trazer-pendencias');
    if (btnTrazerPendencias) btnTrazerPendencias.onclick = () => _trazerPendenciasDeOntem();
    el.querySelectorAll('[data-agenda-abrir]').forEach(btn => {
      btn.onclick = () => {
        agendaSlotAberto = btn.dataset.agendaAbrir;
        agendaFiltroPicker = '';
        agendaPickerProjeto = null;
        agendaPickerCategoria = null;
        agendaCriandoNova = false;
        agendaMostrarJaEscolhidas = false;
        agendaMostrandoAtrasadas = false;
        _renderizarAgenda();
      };
    });
    // Clique com o botão direito em QUALQUER lugar da linha do horário
    // (no horário, na área vazia, ou em cima de uma tarefa já alocada)
    // cola ali o que estiver copiado — um único lugar pra essa lógica,
    // pra não ter parte da linha respondendo e outra não.
    el.querySelectorAll('[data-agenda-slot-hora]').forEach(linha => {
      linha.oncontextmenu = async (e) => {
        e.preventDefault();
        if (!agendaClipboard) { Utils.toast('Nada copiado ainda — clique no 📋 de uma tarefa primeiro.', 'alerta'); return; }
        const slotAlvo = linha.dataset.agendaSlotHora;
        const jaExisteAqui = agendaAlocacoes.some(a => a.data === dataStr && a.horario === slotAlvo
          && a.tarefaId === agendaClipboard.tarefaId && (a.itemId || '') === (agendaClipboard.itemId || ''));
        if (jaExisteAqui) { Utils.toast('Essa tarefa já está nesse horário.', 'alerta'); return; }
        await _atribuirTarefaSlot(agendaClipboard.tarefaId, dataStr, slotAlvo, agendaClipboard.itemId || null);
      };
    });
    const btnFecharPicker = el.querySelector('[data-agenda-fechar-picker]');
    if (btnFecharPicker) btnFecharPicker.onclick = () => { agendaSlotAberto = null; agendaCriandoNova = false; agendaMostrarJaEscolhidas = false; agendaMostrandoAtrasadas = false; _renderizarAgenda(); };
    const btnToggleJaEscolhidas = document.getElementById('agenda-toggle-ja-escolhidas');
    if (btnToggleJaEscolhidas) btnToggleJaEscolhidas.onclick = () => {
      agendaMostrarJaEscolhidas = !agendaMostrarJaEscolhidas;
      _renderizarAgenda();
    };
    const btnAbrirAtrasadas = document.getElementById('agenda-abrir-atrasadas');
    if (btnAbrirAtrasadas) btnAbrirAtrasadas.onclick = () => { agendaMostrandoAtrasadas = true; _renderizarAgenda(); };
    const btnFecharAtrasadas = document.getElementById('agenda-fechar-atrasadas');
    if (btnFecharAtrasadas) btnFecharAtrasadas.onclick = () => { agendaMostrandoAtrasadas = false; _renderizarAgenda(); };
    el.querySelectorAll('[data-agenda-puxar-alocacao]').forEach(item => {
      item.onclick = async () => { await _puxarAlocacaoAtrasada(item.dataset.agendaPuxarAlocacao, dataStr, agendaSlotAberto); };
    });
    const btnAbrirCriarNova = document.getElementById('agenda-abrir-criar-nova');
    if (btnAbrirCriarNova) btnAbrirCriarNova.onclick = () => { agendaCriandoNova = true; _renderizarAgenda(); };
    const btnCancelarNova = document.getElementById('agenda-nova-cancelar');
    if (btnCancelarNova) btnCancelarNova.onclick = () => { agendaCriandoNova = false; _renderizarAgenda(); };
    const btnCriarNova = document.getElementById('agenda-nova-criar');
    if (btnCriarNova) btnCriarNova.onclick = async () => {
      const tituloNovo = document.getElementById('agenda-nova-titulo').value.trim();
      const descricaoNova = document.getElementById('agenda-nova-descricao').value.trim();
      if (!tituloNovo) { Utils.toast('Título é obrigatório.', 'alerta'); return; }
      if (!descricaoNova) { Utils.toast('Descrição é obrigatória.', 'alerta'); return; }
      await _criarTarefaInlineNaAgenda(tituloNovo, descricaoNova, dataStr, agendaSlotAberto);
    };
    const buscaPicker = document.getElementById('agenda-picker-busca');
    if (buscaPicker) {
      buscaPicker.focus();
      buscaPicker.selectionStart = buscaPicker.selectionEnd = buscaPicker.value.length;
      buscaPicker.addEventListener('input', (e) => {
        agendaFiltroPicker = e.target.value;
        const dinamico = document.getElementById('agenda-picker-dinamico');
        if (dinamico) {
          dinamico.innerHTML = _htmlPickerConteudo(pendentes);
          _wirePicker(dinamico, pendentes, dataStr, agendaSlotAberto);
        }
      });
    }
    const pickerEl = el.querySelector('.agenda-picker');
    if (pickerEl) _wirePicker(pickerEl, pendentes, dataStr, agendaSlotAberto);
    el.querySelectorAll('[data-agenda-remover]').forEach(btn => {
      btn.onclick = async () => { await _removerDoSlot(btn.dataset.agendaRemover); };
    });
    el.querySelectorAll('[data-agenda-copiar-tarefa]').forEach(btn => {
      const copiar = () => {
        agendaClipboard = {
          tarefaId: btn.dataset.agendaCopiarTarefa,
          itemId: btn.dataset.agendaCopiarItem || '',
          label: btn.dataset.agendaCopiarLabel,
        };
        Utils.toast('Copiado — clique com o botão direito em cima do horário de destino pra colar ali.', 'sucesso');
        _renderizarAgenda();
      };
      btn.onclick = copiar;
    });
    const btnColarAqui = document.getElementById('agenda-colar-aqui');
    if (btnColarAqui) btnColarAqui.onclick = async () => {
      if (!agendaClipboard) return;
      const jaExisteAqui = agendaAlocacoes.some(a => a.data === dataStr && a.horario === agendaSlotAberto
        && a.tarefaId === agendaClipboard.tarefaId && (a.itemId || '') === (agendaClipboard.itemId || ''));
      if (jaExisteAqui) { Utils.toast('Essa tarefa já está nesse horário.', 'alerta'); return; }
      await _atribuirTarefaSlot(agendaClipboard.tarefaId, dataStr, agendaSlotAberto, agendaClipboard.itemId || null);
    };
    el.querySelectorAll('[data-agenda-check]').forEach(chk => {
      const tarefaId = chk.dataset.agendaCheck;
      const itemId = chk.dataset.agendaCheckItem;
      const t = tarefas.find(x => x.id === tarefaId);
      const item = (itemId && t && Array.isArray(t.checklist)) ? t.checklist.find(i => i.id === itemId) : null;
      chk.classList.toggle('marcado', item ? !!item.concluido : !!t?.concluida);
      chk.onclick = async () => {
        if (itemId) { await alternarChecklistItem(tarefaId, itemId); } else { await alternarStatus(tarefaId); }
        _renderizarAgenda();
      };
    });
    el.querySelectorAll('[data-agenda-detalhe]').forEach(span => {
      span.onclick = () => abrirDetalheTarefa(span.dataset.agendaDetalhe);
    });
  }

  function _diaOffset(dataStr, offset) {
    const [y, m, d] = dataStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + offset);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  async function _atribuirTarefaSlot(taskId, dataStr, slot, itemId, semRenderizar) {
    const dados = { tarefaId: taskId, data: dataStr, horario: slot, itemId: itemId || '' };
    const id = await Database.criarRaiz(COL_AGENDA, dados);
    agendaAlocacoes.push({ id, ...dados });
    if (!semRenderizar) _renderizarAgenda();
  }

  // Move (não copia) uma alocação de um horário anterior — já passado e
  // não concluída — pro horário atual. Some do horário velho, some pro novo.
  async function _puxarAlocacaoAtrasada(alocacaoId, dataStr, novoSlot) {
    const aloc = agendaAlocacoes.find(a => a.id === alocacaoId);
    if (!aloc) return;
    await Database.deletarRaiz(COL_AGENDA, alocacaoId);
    agendaAlocacoes = agendaAlocacoes.filter(a => a.id !== alocacaoId);
    agendaMostrandoAtrasadas = false;
    await _atribuirTarefaSlot(aloc.tarefaId, dataStr, novoSlot, aloc.itemId || null);
    Utils.toast('Tarefa movida pro horário atual.', 'sucesso');
  }

  // "Puxa" pro dia exibido as alocações do dia anterior cuja tarefa/item
  // ainda não foi concluído — pra não perder o que ficou pra trás sem
  // ter que reagendar tudo na mão de novo.
  async function _trazerPendenciasDeOntem() {
    const dataStr = agendaDataAtual;
    const diaAnteriorStr = _diaOffset(dataStr, -1);
    const alocacoesOntem = agendaAlocacoes.filter(a => a.data === diaAnteriorStr);
    let trazidas = 0;
    for (const a of alocacoesOntem) {
      const t = tarefas.find(x => x.id === a.tarefaId);
      if (!t) continue;
      let pendente;
      if (a.itemId) {
        const item = (Array.isArray(t.checklist) ? t.checklist : []).find(i => i.id === a.itemId);
        pendente = !!item && !item.concluido;
      } else {
        pendente = !t.concluida;
      }
      if (!pendente) continue;
      const jaExisteHoje = agendaAlocacoes.some(x => x.data === dataStr && x.horario === a.horario
        && x.tarefaId === a.tarefaId && (x.itemId || '') === (a.itemId || ''));
      if (jaExisteHoje) continue;
      await _atribuirTarefaSlot(a.tarefaId, dataStr, a.horario, a.itemId || null, true);
      trazidas++;
    }
    _renderizarAgenda();
    Utils.toast(trazidas > 0 ? `${trazidas} pendência${trazidas === 1 ? '' : 's'} trazida${trazidas === 1 ? '' : 's'} de ontem.` : 'Nenhuma pendência nova pra trazer.', 'sucesso');
  }

  // Cria uma tarefa nova direto da Agenda (pra quando ela ainda não
  // existe na lista) e já agenda ela no horário que estava sendo aberto.
  async function _criarTarefaInlineNaAgenda(texto, descricao, dataStr, slot) {
    const maxOrdem = tarefas.reduce((m, t) => Math.max(m, t.ordem || 0), 0);
    const dados = { texto, descricao, projeto: '', categoria: '', dependencia: '', concluida: false, ordem: maxOrdem + 1, importancia: 3, checklist: [] };
    const id = await Database.criarRaiz(COL, dados);
    tarefas.push({ id, ...dados });
    agendaCriandoNova = false; // volta pro modo de buscar/escolher — seletor continua aberto pra escolher mais
    await _atribuirTarefaSlot(id, dataStr, slot);
    Utils.toast('Tarefa criada e agendada.', 'sucesso');
  }

  async function _removerDoSlot(alocacaoId) {
    await Database.deletarRaiz(COL_AGENDA, alocacaoId);
    agendaAlocacoes = agendaAlocacoes.filter(a => a.id !== alocacaoId);
    _renderizarAgenda();
  }

  // ============================================
  // Criação rápida de categoria a partir da barra de
  // "+ Adicionar tarefa" — não chama renderizar() pra não apagar
  // o que a pessoa já digitou no nome da tarefa.
  // ============================================
  function abrirCriarCategoriaRapida() {
    const html = `
      <div class="modal-header"><h3>Nova categoria</h3></div>
      <div class="modal-body">
        <div class="todo-form-grupo">
          <label>Nome</label>
          <input type="text" id="rc-nome" class="form-control" placeholder="Ex: Urgente, Cliente, Bug...">
        </div>
        <div class="todo-form-grupo">
          <label>Cor</label>
          ${_swatchGridHtml('rc-swatches', SWATCHES[0])}
        </div>
      </div>
      <div class="modal-footer" style="justify-content:flex-end;">
        <button type="button" class="btn btn-secundario" id="rc-cancelar">Cancelar</button>
        <button type="button" class="btn btn-primario" id="rc-salvar">Criar categoria</button>
      </div>`;
    abrirOverlay(html, 'todo-modal');
    document.getElementById('rc-nome').focus();

    let corSelecionada = SWATCHES[0];
    _wireSwatchGrid('rc-swatches', (cor) => { corSelecionada = cor; });
    document.getElementById('rc-cancelar').addEventListener('click', fecharOverlay);
    document.getElementById('rc-salvar').addEventListener('click', async () => {
      const nome = document.getElementById('rc-nome').value.trim();
      if (!nome) { Utils.toast('Dê um nome pra categoria.', 'alerta'); return; }
      if (categorias.some(c => c.nome === nome)) { Utils.toast('Já existe uma categoria com esse nome.', 'alerta'); return; }
      const id = await Database.criarRaiz(COL_CAT, { nome, cor: corSelecionada, importancia: 3 });
      categorias.push({ id, nome, cor: corSelecionada, importancia: 3 });
      fecharOverlay();
      Utils.toast('Categoria criada.', 'sucesso');
      // Atualiza só o <select> da barra de adicionar, sem re-renderizar
      // a tela inteira (preserva o que já foi digitado no nome da tarefa).
      const sel = document.getElementById('todo-categoria');
      if (sel) {
        sel.insertAdjacentHTML('beforeend', `<option value="${esc(nome)}" selected>${esc(nome)}</option>`);
        sel.value = nome;
      }
    });
  }

  // ============================================
  // Edição rápida de uma categoria já existente, a partir de
  // qualquer lugar que tenha o seletor de Categoria (barra de
  // adicionar, modal de editar tarefa) — recebe um callback pra
  // atualizar só aquele seletor, sem re-renderizar a tela inteira.
  // ============================================
  function abrirEditarCategoriaRapida(id, aoSalvar) {
    const cat = categorias.find(c => c.id === id);
    if (!cat) return;
    const html = `
      <div class="modal-header"><h3>Editar categoria</h3></div>
      <div class="modal-body">
        <div class="todo-form-grupo">
          <label>Nome</label>
          <input type="text" id="rc-nome" class="form-control" value="${esc(cat.nome)}">
        </div>
        <div class="todo-form-grupo">
          <label>Cor</label>
          ${_swatchGridHtml('rc-swatches', cat.cor)}
        </div>
      </div>
      <div class="modal-footer" style="justify-content:space-between;">
        <button type="button" class="btn btn-secundario" id="rc-excluir" style="color:var(--cor-perigo);">Excluir categoria</button>
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn btn-secundario" id="rc-cancelar">Cancelar</button>
          <button type="button" class="btn btn-primario" id="rc-salvar">Salvar</button>
        </div>
      </div>`;
    abrirOverlay(html, 'todo-modal');
    document.getElementById('rc-nome').focus();
    document.getElementById('rc-nome').select();

    let corSelecionada = cat.cor;
    _wireSwatchGrid('rc-swatches', (cor) => { corSelecionada = cor; });
    document.getElementById('rc-cancelar').addEventListener('click', fecharOverlay);
    document.getElementById('rc-excluir').addEventListener('click', async () => {
      if (!confirm(`Excluir a categoria "${cat.nome}"? Tarefas que usam ela continuam existindo, só perdem essa referência.`)) return;
      await Database.deletarRaiz(COL_CAT, id);
      categorias = categorias.filter(c => c.id !== id);
      fecharOverlay();
      Utils.toast('Categoria excluída.', 'info');
      renderizar();
    });
    document.getElementById('rc-salvar').addEventListener('click', async () => {
      const nomeNovo = document.getElementById('rc-nome').value.trim();
      if (!nomeNovo) { Utils.toast('O nome da categoria não pode ficar em branco.', 'alerta'); return; }
      if (categorias.some(c => c.id !== id && c.nome === nomeNovo)) { Utils.toast('Já existe uma categoria com esse nome.', 'alerta'); return; }
      const nomeAntigo = cat.nome;
      await Database.atualizarRaiz(COL_CAT, id, { nome: nomeNovo, cor: corSelecionada });
      cat.nome = nomeNovo; cat.cor = corSelecionada;
      // Propaga o novo nome pra todas as tarefas que referenciavam o nome antigo
      const afetadas = tarefas.filter(t => t.categoria === nomeAntigo);
      for (const t of afetadas) {
        await Database.atualizarRaiz(COL, t.id, { categoria: nomeNovo });
        t.categoria = nomeNovo;
      }
      fecharOverlay();
      Utils.toast('Categoria atualizada.', 'sucesso');
      if (aoSalvar) aoSalvar(nomeNovo);
    });
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
          <label>Título</label>
          <input type="text" id="ed-texto" class="form-control" value="${esc(t.texto)}">
        </div>
        <div class="todo-form-grupo">
          <label>Descrição <span style="color:var(--cor-perigo);">*</span></label>
          <textarea id="ed-descricao" class="form-control" rows="3" placeholder="Detalhes, contexto, o que for preciso...">${esc(t.descricao || '')}</textarea>
        </div>
        <div class="todo-form-grupo">
          <label>Checklist (opcional)</label>
          <div id="ed-checklist-itens">
            ${(Array.isArray(t.checklist) ? t.checklist : []).map(item => `
              <div class="todo-checklist-item-row" data-id="${esc(item.id)}">
                <input type="checkbox" class="todo-checklist-item-check" ${item.concluido ? 'checked' : ''}>
                <input type="text" class="todo-checklist-item-input" value="${esc(item.texto)}">
                <button type="button" class="todo-checklist-item-remover" title="Remover">×</button>
              </div>`).join('')}
          </div>
          <button type="button" class="todo-checklist-add-btn" id="ed-checklist-add">+ adicionar item</button>
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
          <div style="margin-top:6px; display:flex; gap:14px;">
            <a href="#" id="ed-nova-categoria-link" style="font-size:12.5px;">+ Criar nova categoria</a>
            <a href="#" id="ed-editar-categoria-link" style="font-size:12.5px;">✎ Editar categoria selecionada</a>
          </div>
          <div class="todo-cat-nova-form" id="ed-cat-nova-form">
            <div style="flex:1; min-width:140px;">
              <input type="text" id="ed-cat-nome" class="form-control" placeholder="Nome da categoria">
              ${_swatchGridHtml('ed-cat-swatches', SWATCHES[0])}
            </div>
            <button type="button" class="btn btn-secundario btn-sm" id="ed-cat-salvar">Salvar categoria</button>
          </div>
          <div class="todo-cat-nova-form" id="ed-cat-editar-form">
            <div style="flex:1; min-width:140px;">
              <input type="text" id="ed-cat-edit-nome" class="form-control" placeholder="Nome da categoria">
              ${_swatchGridHtml('ed-cat-edit-swatches', null)}
            </div>
            <button type="button" class="btn btn-secundario btn-sm" id="ed-cat-edit-salvar">Salvar edição</button>
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

    document.querySelectorAll('#ed-checklist-itens .todo-checklist-item-remover').forEach(btn => {
      btn.onclick = () => btn.closest('.todo-checklist-item-row').remove();
    });
    document.getElementById('ed-checklist-add').addEventListener('click', () => {
      _adicionarLinhaChecklist(document.getElementById('ed-checklist-itens'));
    });

    document.getElementById('ed-nova-categoria-link').addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('ed-cat-editar-form').classList.remove('aberto');
      document.getElementById('ed-cat-nova-form').classList.toggle('aberto');
    });
    let corSelecionada = SWATCHES[0];
    _wireSwatchGrid('ed-cat-swatches', (cor) => { corSelecionada = cor; });
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

    document.getElementById('ed-editar-categoria-link').addEventListener('click', (e) => {
      e.preventDefault();
      const nomeAtual = document.getElementById('ed-categoria').value;
      if (!nomeAtual) { Utils.toast('Escolha uma categoria pra editar.', 'alerta'); return; }
      const catAlvo = categorias.find(c => c.nome === nomeAtual);
      if (!catAlvo) return;
      document.getElementById('ed-cat-nova-form').classList.remove('aberto');
      const form = document.getElementById('ed-cat-editar-form');
      form.classList.toggle('aberto');
      if (!form.classList.contains('aberto')) return;
      document.getElementById('ed-cat-edit-nome').value = catAlvo.nome;
      _marcarSwatchGrid('ed-cat-edit-swatches', catAlvo.cor);
    });
    let corEdicaoCategoriaModal = null;
    _wireSwatchGrid('ed-cat-edit-swatches', (cor) => { corEdicaoCategoriaModal = cor; });
    document.getElementById('ed-cat-edit-salvar').addEventListener('click', async () => {
      const nomeAtual = document.getElementById('ed-categoria').value;
      const catAlvo = categorias.find(c => c.nome === nomeAtual);
      if (!catAlvo) return;
      const nomeNovo = document.getElementById('ed-cat-edit-nome').value.trim();
      if (!nomeNovo) { Utils.toast('O nome da categoria não pode ficar em branco.', 'alerta'); return; }
      if (categorias.some(c => c.id !== catAlvo.id && c.nome === nomeNovo)) { Utils.toast('Já existe uma categoria com esse nome.', 'alerta'); return; }
      const nomeAntigo = catAlvo.nome;
      const corNova = corEdicaoCategoriaModal || catAlvo.cor;
      await Database.atualizarRaiz(COL_CAT, catAlvo.id, { nome: nomeNovo, cor: corNova });
      catAlvo.nome = nomeNovo; catAlvo.cor = corNova;
      const afetadas = tarefas.filter(x => x.categoria === nomeAntigo);
      for (const x of afetadas) {
        await Database.atualizarRaiz(COL, x.id, { categoria: nomeNovo });
        x.categoria = nomeNovo;
      }
      const sel = document.getElementById('ed-categoria');
      const opt = [...sel.options].find(o => o.value === nomeAntigo);
      if (opt) { opt.value = nomeNovo; opt.textContent = nomeNovo; }
      sel.value = nomeNovo;
      document.getElementById('ed-cat-editar-form').classList.remove('aberto');
      Utils.toast('Categoria atualizada.', 'sucesso');
    });
    document.getElementById('ed-cancelar').addEventListener('click', fecharOverlay);
    document.getElementById('ed-excluir').addEventListener('click', async () => {
      fecharOverlay();
      await excluir(id);
    });
    document.getElementById('ed-salvar').addEventListener('click', async () => {
      const texto = document.getElementById('ed-texto').value.trim();
      if (!texto) { Utils.toast('O nome da tarefa não pode ficar em branco.', 'alerta'); return; }
      const descricao = document.getElementById('ed-descricao').value.trim();
      if (!descricao) { Utils.toast('Descrição é obrigatória.', 'alerta'); document.getElementById('ed-descricao').focus(); return; }
      const projeto = document.getElementById('ed-projeto').value.trim();
      const categoria = document.getElementById('ed-categoria').value;
      const dependencia = document.getElementById('ed-dependencia').value.trim();
      const importancia = parseInt(document.getElementById('ed-importancia').value, 10) || 3;
      const checklist = [...document.querySelectorAll('#ed-checklist-itens .todo-checklist-item-row')]
        .map(row => {
          const txt = row.querySelector('.todo-checklist-item-input').value.trim();
          if (!txt) return null;
          return {
            id: row.dataset.id || _novoIdChecklist(),
            texto: txt,
            concluido: row.querySelector('.todo-checklist-item-check').checked,
          };
        })
        .filter(Boolean);

      if (projeto && !projetos.some(p => p.nome === projeto)) {
        const idProj = await Database.criarRaiz(COL_PROJ, { nome: projeto, importancia: 3 });
        projetos.push({ id: idProj, nome: projeto, importancia: 3 });
      }

      const dados = { texto, descricao, projeto: projeto || '', categoria, dependencia, importancia, checklist };
      await Database.atualizarRaiz(COL, id, dados);
      Object.assign(t, dados);
      fecharOverlay();
      Utils.toast('Tarefa atualizada.', 'sucesso');
      renderizar();
      _scrollTopoLista();
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
          ${_swatchGridHtml('mg-cat-swatches', SWATCHES[0])}
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
            ${_swatchGridHtml('mg-cat-edit-swatches', c.cor)}
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
    _wireSwatchGrid('mg-cat-swatches', (cor) => { corSelecionadaMg = cor; });

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
    let corEdicaoCategoria = null;
    _wireSwatchGrid('mg-cat-edit-swatches', (cor) => { corEdicaoCategoria = cor; });
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

  return { init, alternarStatus, excluir, mover, abrirModalEditar, abrirDetalheTarefa };
})();
