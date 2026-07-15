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

  function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  async function init() {
    const ok = await Utils.initPagina();
    if (!ok) return;
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

  function renderizar() {
    const container = document.getElementById('modulo-content');
    if (!container) return;

    const pendentes = tarefas.filter(t => !t.concluida && (!filtroProjeto || t.projeto === filtroProjeto))
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const concluidas = tarefas.filter(t => t.concluida && (!filtroProjeto || t.projeto === filtroProjeto))
      .sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));

    const projetos = projetosExistentes();

    container.innerHTML = `
      <div class="page-header">
        <div><h2>Tarefas do Sistema</h2><span class="subtitulo">Lista de organização e roadmap — ${pendentes.length} pendente(s)</span></div>
      </div>

      <div class="card" style="padding:16px; margin-bottom:16px;">
        <form id="form-nova-tarefa" style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <input type="text" id="todo-texto" class="form-control" placeholder="Nova tarefa..." style="flex:2; min-width:220px;" required>
          <input type="text" id="todo-projeto" class="form-control" list="todo-projetos-lista" placeholder="Projeto (opcional)" style="flex:1; min-width:160px;">
          <datalist id="todo-projetos-lista">
            ${projetos.map(p => `<option value="${esc(p)}">`).join('')}
          </datalist>
          <button type="submit" class="btn btn-primario">+ Adicionar</button>
        </form>
      </div>

      <div style="display:flex; gap:8px; align-items:center; margin-bottom:14px; flex-wrap:wrap;">
        <select id="todo-filtro-projeto" class="form-control" style="max-width:220px;">
          <option value="">Todos os projetos</option>
          ${projetos.map(p => `<option value="${esc(p)}" ${filtroProjeto === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}
        </select>
        <button class="btn btn-secundario btn-sm" id="todo-toggle-concluidas">${mostrarConcluidas ? 'Ocultar' : 'Mostrar'} concluídas (${concluidas.length})</button>
      </div>

      <div id="todo-lista-pendentes">
        ${pendentes.length === 0
          ? `<div class="estado-vazio"><div class="icone">✅</div><p>Nenhuma tarefa pendente.</p></div>`
          : pendentes.map((t, i) => linhaTarefa(t, i, pendentes.length)).join('')}
      </div>

      ${mostrarConcluidas ? `
        <div class="sidebar-section-title" style="margin-top:20px;">Concluídas</div>
        <div id="todo-lista-concluidas">
          ${concluidas.length === 0
            ? `<p class="text-sm text-muted">Nenhuma tarefa concluída ainda.</p>`
            : concluidas.map(t => linhaTarefa(t, 0, 0)).join('')}
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
    document.getElementById('todo-filtro-projeto').addEventListener('change', (e) => {
      filtroProjeto = e.target.value;
      renderizar();
    });
    document.getElementById('todo-toggle-concluidas').addEventListener('click', () => {
      mostrarConcluidas = !mostrarConcluidas;
      renderizar();
    });
  }

  function linhaTarefa(t, idx, total) {
    const concluida = !!t.concluida;
    return `
      <div class="card" style="padding:12px 14px; margin-bottom:8px; display:flex; align-items:center; gap:10px; ${concluida ? 'opacity:.6;' : ''}">
        <input type="checkbox" ${concluida ? 'checked' : ''} onchange="Todo.alternarStatus('${t.id}')" style="width:18px; height:18px; cursor:pointer; flex-shrink:0;">
        <div style="flex:1; min-width:0;">
          <div id="texto-${t.id}" style="${concluida ? 'text-decoration:line-through;' : ''} cursor:text; word-break:break-word;" ondblclick="Todo.editarTexto('${t.id}')">${esc(t.texto)}</div>
          ${t.projeto ? `<span class="badge badge-neutro" style="margin-top:4px; display:inline-block;">${esc(t.projeto)}</span>` : ''}
        </div>
        ${!concluida ? `
        <div style="display:flex; gap:2px; flex-shrink:0;">
          <button class="btn btn-icon btn-sm" title="Subir" onclick="Todo.mover('${t.id}',-1)" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn btn-icon btn-sm" title="Descer" onclick="Todo.mover('${t.id}',1)" ${idx === total - 1 ? 'disabled' : ''}>↓</button>
        </div>` : ''}
        <button class="btn btn-icon btn-sm" title="Editar" onclick="Todo.editarTexto('${t.id}')">✎</button>
        <button class="btn btn-icon btn-sm" title="Excluir" onclick="Todo.excluir('${t.id}')">🗑</button>
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
    div.outerHTML = `<input type="text" id="texto-${id}" class="form-control" value="${esc(atual)}" style="width:100%;">`;
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
    const pendentesOrdenadas = tarefas.filter(t => !t.concluida && (!filtroProjeto || t.projeto === filtroProjeto))
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const i = pendentesOrdenadas.findIndex(t => t.id === id);
    const j = i + direcao;
    if (i < 0 || j < 0 || j >= pendentesOrdenadas.length) return;
    const a = pendentesOrdenadas[i], b = pendentesOrdenadas[j];
    const ordemA = a.ordem, ordemB = b.ordem;
    a.ordem = ordemB; b.ordem = ordemA;
    await Database.atualizarRaiz(COL, a.id, { ordem: a.ordem });
    await Database.atualizarRaiz(COL, b.id, { ordem: b.ordem });
    renderizar();
  }

  return { init, alternarStatus, editarTexto, excluir, mover };
})();
