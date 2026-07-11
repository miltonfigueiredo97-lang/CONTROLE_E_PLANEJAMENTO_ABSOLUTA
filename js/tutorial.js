// ============================================
// Módulo: Tutorial
// Pop-up de boas-vindas no primeiro acesso, com tour rápido
// explicando cada aba do menu lateral (sem sair da tela inicial).
// ============================================
const Tutorial = (() => {
  const STORAGE_KEY = 'absoluta_tutorial_visto';

  // Ordem e conteúdo espelham exatamente o menu lateral (obras.html).
  const PASSOS = [
    { icone: '🏗️', nome: 'Obras', href: 'obras.html', status: 'ok',
      oque: 'É a tela inicial do sistema — o hub de navegação entre as obras cadastradas.',
      como: 'Cada obra vira um card. Ao clicar em uma obra, ela passa a ser a "obra ativa" e todos os outros módulos do menu passam a mostrar os dados dela.' },
    { icone: '📊', nome: 'Dashboard', href: 'dashboard.html', status: 'construcao',
      oque: 'Painel com os indicadores gerais da obra ativa (avanço físico, prazos, alertas).',
      como: 'Ainda não foi construído. A ideia é reunir aqui, em um só lugar, um resumo visual do que está acontecendo na obra.' },
    { icone: '📅', nome: 'Planejamento', href: 'planejamento.html', status: 'ok',
      oque: 'O cronograma da obra em formato de Gantt, com hierarquia de tarefas.',
      como: 'Já está funcionando: cadastro de tarefas, datas, % concluído (que sobe automaticamente para as tarefas "pai"), linha de balanço e escadinha.' },
    { icone: '📐', nome: 'Levantamentos', href: 'levantamento.html', status: 'ok',
      oque: 'Hub com as calculadoras de quantitativos da obra: Fachada, Ar Condicionado e Concreto.',
      como: 'Cada levantamento já está funcionando de forma independente, com sua própria lógica de cálculo (m², peças, volume de concreto etc).' },
    { icone: '✅', nome: 'Controle', href: 'controle.html', status: 'ok',
      oque: 'Hub de controle operacional — acompanhamento do que já foi executado no campo.',
      como: 'O Controle de Concreto já está funcionando (KPIs, boletins de concretagem, gráficos e relatórios). Os demais controles serão adicionados aqui com o tempo.' },
    { icone: '🚧', nome: 'Restrições', href: 'restricoes.html', status: 'construcao',
      oque: 'Controle de restrições/impedimentos que travam o andamento da obra.',
      como: 'Ainda não foi construído. A ideia é listar pendências (material, projeto, terceiros) e o prazo pra cada uma ser resolvida.' },
    { icone: '📋', nome: 'Semanal', href: 'semanal.html', status: 'ok',
      oque: 'Planejamento de curto prazo — o que será executado na semana.',
      como: 'Já está funcionando: seleção de tarefas da semana, acompanhamento e comparação com o planejado.' },
    { icone: '📓', nome: 'Diário de Obra', href: 'diario.html', status: 'ok',
      oque: 'Registro diário do que aconteceu na obra: efetivo, clima, ocorrências, fotos.',
      como: 'Já está funcionando, com histórico por data e por obra.' },
    { icone: '📏', nome: 'Medições', href: 'medicoes.html', status: 'ok',
      oque: 'Medição de serviços executados para fins de faturamento/contrato.',
      como: 'Já está funcionando, com cálculo por período e por etapa.' },
    { icone: '💰', nome: 'Orçamentos', href: 'orcamentos.html', status: 'construcao',
      oque: 'Orçamento da obra e comparação entre previsto e realizado.',
      como: 'Ainda não foi construído.' },
    { icone: '👷', nome: 'Mão de Obra', href: 'mao-de-obra.html', status: 'ok',
      oque: 'Controle de efetivo e produtividade das equipes na obra.',
      como: 'Já está funcionando, vinculado às tarefas do Planejamento.' },
    { icone: '📦', nome: 'Suprimentos', href: 'suprimentos.html', status: 'construcao',
      oque: 'Controle de pedidos de compra e prazos de entrega de insumos.',
      como: 'Ainda não foi construído.' },
    { icone: '🧱', nome: 'Materiais', href: 'materiais.html', status: 'ok',
      oque: 'Controle de consumo de materiais na obra.',
      como: 'Já está funcionando, vinculado às tarefas do Planejamento.' },
    { icone: '📈', nome: 'Relatórios', href: 'relatorios.html', status: 'ok',
      oque: 'Geração de relatórios da obra com apoio de inteligência artificial.',
      como: 'Já está funcionando.' },
    { icone: '📊', nome: 'Histograma', href: 'histograma.html', status: 'construcao',
      oque: 'Gráfico de histograma de mão de obra/recursos ao longo do cronograma.',
      como: 'Ainda não foi construído.' },
    { icone: '🔑', nome: 'Permissões', href: 'admin-permissoes.html', status: 'construcao',
      oque: 'Controle de quais módulos cada usuário pode ver, editar ou excluir.',
      como: 'Ainda não foi construído — por enquanto todo usuário criado tem acesso total ao sistema.' },
    { icone: '📋', nome: 'Notas de Versão', href: 'notas-versao.html', status: 'ok',
      oque: 'Histórico de tudo que já foi entregue no sistema, versão por versão.',
      como: 'Já está funcionando — vale a pena dar uma olhada de vez em quando pra ver as novidades.' },
  ];

  let passoAtual = -1; // -1 = tela de boas-vindas

  function iniciarSeNecessario() {
    if (localStorage.getItem(STORAGE_KEY) === '1') return;
    _montarDom();
    passoAtual = -1;
    _render();
    _abrirOverlay();
  }

  // Reabertura manual (botão "Tutorial" na tela de Obras), ignora o flag.
  function abrir() {
    _montarDom();
    passoAtual = -1;
    _render();
    _abrirOverlay();
  }

  function pular() {
    _fechar();
  }

  function proximo() {
    if (passoAtual >= PASSOS.length - 1) { _fechar(); return; }
    passoAtual++;
    _render();
  }

  function _fechar() {
    localStorage.setItem(STORAGE_KEY, '1');
    _destacarSidebar(null);
    const overlay = document.getElementById('tutorial-overlay');
    if (overlay) overlay.classList.remove('ativo');
    document.body.style.overflow = '';
  }

  function _abrirOverlay() {
    const overlay = document.getElementById('tutorial-overlay');
    if (overlay) overlay.classList.add('ativo');
    document.body.style.overflow = 'hidden';
  }

  function _destacarSidebar(href) {
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('tutorial-destaque'));
    if (!href) return;
    const link = document.querySelector(`.sidebar-nav a[href="${href}"]`);
    if (link) link.classList.add('tutorial-destaque');
  }

  function _render() {
    const modal = document.getElementById('tutorial-modal');
    if (!modal) return;

    if (passoAtual === -1) {
      _destacarSidebar(null);
      modal.innerHTML = `
        <div class="modal-header">
          <h3>👋 Bem-vindo ao sistema</h3>
        </div>
        <div class="modal-body">
          <p>Este é o <strong>Controle e Planejamento de Obras</strong>. Quer conhecer rapidamente o que cada aba do menu à esquerda faz antes de começar?</p>
          <p class="text-sm text-muted">São ${PASSOS.length} passos rápidos — leva menos de 2 minutos.</p>
        </div>
        <div class="modal-footer" style="justify-content:space-between;">
          <button class="btn btn-secundario" onclick="Tutorial.pular()">Pular</button>
          <button class="btn btn-primario" onclick="Tutorial.proximo()">Ver tutorial →</button>
        </div>`;
      return;
    }

    if (passoAtual >= PASSOS.length) {
      _destacarSidebar(null);
      modal.innerHTML = `
        <div class="modal-header">
          <h3>🎉 Tutorial concluído</h3>
        </div>
        <div class="modal-body">
          <p>Pronto! Agora você já sabe o que cada módulo faz e o que já está funcionando.</p>
          <p class="text-sm text-muted">Você pode rever esse tour a qualquer momento clicando em "🎓 Tutorial" no topo da tela de Obras.</p>
        </div>
        <div class="modal-footer" style="justify-content:flex-end;">
          <button class="btn btn-primario" onclick="Tutorial.pular()">Começar a usar</button>
        </div>`;
      return;
    }

    const p = PASSOS[passoAtual];
    _destacarSidebar(p.href);
    const statusBadge = p.status === 'ok'
      ? '<span class="badge badge-sucesso">✓ Já está funcionando</span>'
      : '<span class="badge badge-alerta">🚧 Em construção</span>';
    const ultimo = passoAtual === PASSOS.length - 1;

    modal.innerHTML = `
      <div class="modal-header">
        <h3>${p.icone} ${p.nome}</h3>
        <span class="text-sm text-muted">${passoAtual + 1} de ${PASSOS.length}</span>
      </div>
      <div class="modal-body">
        <div class="tutorial-progresso"><div class="tutorial-progresso-fill" style="width:${((passoAtual + 1) / PASSOS.length) * 100}%;"></div></div>
        <p style="margin-top:14px;"><strong>O que é:</strong> ${p.oque}</p>
        <p><strong>Como funciona:</strong> ${p.como}</p>
        ${statusBadge}
      </div>
      <div class="modal-footer" style="justify-content:space-between;">
        <button class="btn btn-secundario" onclick="Tutorial.pular()">Pular tutorial</button>
        <button class="btn btn-primario" onclick="Tutorial.proximo()">${ultimo ? 'Concluir' : 'Próximo →'}</button>
      </div>`;
  }

  function _montarDom() {
    if (document.getElementById('tutorial-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'tutorial-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal" id="tutorial-modal"></div>`;
    document.body.appendChild(overlay);
  }

  return { iniciarSeNecessario, abrir, pular, proximo };
})();
