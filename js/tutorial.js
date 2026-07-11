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
      oque: 'É a tela inicial do sistema — o hub de navegação entre todas as obras cadastradas.',
      recursos: [
        'Cada obra vira um card, com nome, cliente, cidade, endereço e datas previstas',
        'Upload de imagem de capa pra identificar a obra visualmente',
        'Ao clicar em uma obra ela vira a "obra ativa" — todos os outros módulos do menu passam a mostrar os dados dela',
        'Barra de % executado calculada automaticamente a partir do Planejamento, com início real e fim provável',
        'Editar, ativar/inativar e excluir obras diretamente por aqui',
      ] },
    { icone: '📊', nome: 'Dashboard', href: 'dashboard.html', status: 'construcao',
      oque: 'Painel de indicadores gerais da obra ativa — visão executiva rápida.',
      recursos: [
        'Ainda não foi construído (só existe a página com o menu)',
        'A ideia é reunir aqui, em um só lugar: avanço físico, prazos, alertas de restrições e destaques do Diário/Medições',
      ] },
    { icone: '📅', nome: 'Planejamento', href: 'planejamento.html', status: 'ok',
      oque: 'O cronograma da obra em formato de Gantt, no estilo MS Project.',
      recursos: [
        'Hierarquia de tarefas (grupo → sub-tarefas) com níveis indentados e coloridos',
        '% concluído do "pai" é calculado automaticamente a partir dos filhos (ponderado por quantidade quando existe)',
        'Predecessoras entre tarefas — muda a data de uma e as dependentes recalculam sozinhas',
        'Status automático por tarefa: atrasado, alerta, em andamento, em dia, concluído (cores no Gantt)',
        'Custo Material e Custo Mão de Obra por tarefa, puxados automaticamente dos vínculos feitos em Materiais e Mão de Obra',
        'Reordenar tarefas arrastando a linha, zoom do Gantt (dia/semana/mês), colunas que você mostra/oculta/redimensiona/reordena',
        'Importação de cronograma via Excel e exportação do Gantt inteiro em PNG (mesmo com centenas de linhas)',
        'Desfazer (undo) as últimas alterações',
      ] },
    { icone: '📐', nome: 'Levantamentos', href: 'levantamento.html', status: 'ok',
      oque: 'Hub com as calculadoras de quantitativos da obra — cada uma com sua lógica própria.',
      recursos: [
        'Fachada: hierarquia Fachada → Balancim → Vista → Peça, cálculo de m² com e sem metro linear, 4 modos de desconto de vão configuráveis, mapa visual com caixas posicionáveis sobre a planta',
        'Ar Condicionado: hierarquia Área → Subárea → Item, com busca inteligente (fuzzy) que sugere o material certo da biblioteca conforme você digita',
        'Concreto: cadastro de peças com diagrama de pilar em SVG, calculadora de volume, importação em massa por TSV/CSV e um assistente (wizard) de concretagem com ordenação de andares por arrasto',
      ] },
    { icone: '✅', nome: 'Controle', href: 'controle.html', status: 'ok',
      oque: 'Hub de controle operacional — o que já foi executado de fato no campo, não só planejado.',
      recursos: [
        'Controle de Concreto já está funcionando por completo: 6 KPIs (Volume Total, Previsto +10%, Real Concretado, Executado de Projeto, Faltando, Índice de Perda)',
        'Lançamento e edição de Boletins de Concretagem (BT), com alerta automático de excesso de volume por peça',
        'Gráficos de progresso por tipo de peça e status das BTs por concretagem',
        'Aba de Relatórios com gráficos donut e de barras (volume por andar) e exportação em CSV',
        'Outros controles operacionais (além de concreto) serão adicionados aqui com o tempo',
      ] },
    { icone: '🚧', nome: 'Restrições', href: 'restricoes.html', status: 'construcao',
      oque: 'Controle de restrições/impedimentos que travam o andamento da obra.',
      recursos: [
        'Ainda não foi construído',
        'A ideia é listar pendências (material, projeto, terceiros, decisão do cliente) com um responsável e um prazo pra cada uma ser resolvida, alimentando alertas no Dashboard e no Planejamento',
      ] },
    { icone: '📋', nome: 'Semanal', href: 'semanal.html', status: 'ok',
      oque: 'Planejamento de curto prazo — o que efetivamente será executado na semana, puxado do cronograma geral.',
      recursos: [
        'Seleção de tarefas do Planejamento pra compor a semana de trabalho',
        'Edição de data, início, responsável e progresso direto na tela, sem precisar ir ao Planejamento',
        'Fechamento da semana com histórico guardado por obra, pra consultar semanas anteriores',
        'Relatório automático comparando planejado x realizado, e opção de omitir/reabrir tarefas específicas',
      ] },
    { icone: '📓', nome: 'Diário de Obra', href: 'diario.html', status: 'ok',
      oque: 'Registro diário do que aconteceu na obra — o "diário de bordo" de cada dia de trabalho.',
      recursos: [
        '"Pauta do dia" puxada automaticamente das tarefas em andamento no Planejamento',
        'Lançamento de avanço físico direto no diário, que já atualiza o % da tarefa no Planejamento',
        'Registro de atividades avulsas (fora do planejamento original), efetivo, clima e ocorrências',
        'Busca de tarefas por similaridade (fuzzy), útil quando o nome não bate 100% com o cronograma',
        'Geração e impressão de relatório do dia, com histórico por data e por obra',
      ] },
    { icone: '📏', nome: 'Medições', href: 'medicoes.html', status: 'ok',
      oque: 'Medição de serviços executados, para fins de faturamento/contrato com o cliente ou fornecedor.',
      recursos: [
        'Medição calculada a partir do avanço já registrado no Planejamento, agrupada por etapa',
        'Anexo de fotos por item medido, como comprovação',
        'Histórico de medições por obra, com opção de descartar item ou excluir a medição inteira',
      ] },
    { icone: '💰', nome: 'Orçamentos', href: 'orcamentos.html', status: 'construcao',
      oque: 'Orçamento da obra e comparação entre previsto e realizado.',
      recursos: [
        'Ainda não foi construído',
        'A ideia é cruzar o orçamento contratado com os custos reais que já vêm sendo calculados em Materiais e Mão de Obra',
      ] },
    { icone: '👷', nome: 'Mão de Obra', href: 'mao-de-obra.html', status: 'ok',
      oque: 'Controle de efetivo e custo de mão de obra, ligado diretamente ao cronograma.',
      recursos: [
        'Biblioteca de funções/equipes cadastrada uma vez só e reaproveitada em qualquer obra',
        'Vínculo de mão de obra a uma ou mais tarefas do Planejamento, com busca inteligente (fuzzy) pra achar a tarefa certa',
        'Cálculo automático do custo total por tarefa, que alimenta a coluna "Custo Mão de Obra" lá no Planejamento',
        'Exportação dos dados',
      ] },
    { icone: '📦', nome: 'Suprimentos', href: 'suprimentos.html', status: 'construcao',
      oque: 'Controle de pedidos de compra e prazos de entrega de insumos.',
      recursos: [
        'Ainda não foi construído',
        'A ideia é acompanhar pedido → aprovação → entrega, com alerta de atraso que pode virar uma Restrição',
      ] },
    { icone: '🧱', nome: 'Materiais', href: 'materiais.html', status: 'ok',
      oque: 'Controle de consumo de materiais da obra, ligado diretamente ao cronograma.',
      recursos: [
        'Biblioteca de materiais cadastrada uma vez só e reaproveitada em qualquer obra',
        'Vínculo de material a uma ou mais tarefas, com quantidade base e custo — e alerta de possível material duplicado ao cadastrar um novo',
        'Relatório de materiais cruzado com o Levantamento de Fachada',
        'Alimenta automaticamente a coluna "Custo Material" no Planejamento',
      ] },
    { icone: '📈', nome: 'Relatórios', href: 'relatorios.html', status: 'ok',
      oque: 'Geração de relatórios em PDF da obra, com apoio de inteligência artificial.',
      recursos: [
        'Geração automática de texto do relatório usando IA (Gemini como principal, Claude como reserva caso o primeiro falhe)',
        'Lista de relatórios pendentes e já gerados por obra, com visualização antes de baixar',
        'Download do PDF e compartilhamento direto por WhatsApp',
      ] },
    { icone: '📊', nome: 'Histograma', href: 'histograma.html', status: 'construcao',
      oque: 'Gráfico de histograma de mão de obra/recursos ao longo do cronograma.',
      recursos: [
        'Ainda não foi construído',
        'A ideia é mostrar a curva de efetivo necessário por período, cruzando Planejamento com Mão de Obra',
      ] },
    { icone: '🔑', nome: 'Permissões', href: 'admin-permissoes.html', status: 'construcao',
      oque: 'Controle de quais módulos cada usuário pode ver, editar ou excluir.',
      recursos: [
        'Ainda não foi construído',
        'Por enquanto, todo usuário criado no sistema é tratado como administrador e tem acesso total a todos os módulos e obras',
      ] },
    { icone: '📋', nome: 'Notas de Versão', href: 'notas-versao.html', status: 'ok',
      oque: 'Histórico completo de tudo que já foi entregue no sistema, versão por versão.',
      recursos: [
        'Cada versão lista exatamente o que mudou: funcionalidades novas, correções e melhorias',
        'Vale a pena dar uma olhada de vez em quando pra acompanhar as novidades e o que já foi corrigido',
      ] },
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
    const listaRecursos = (p.recursos || []).map(r => `<li>${r}</li>`).join('');

    modal.innerHTML = `
      <div class="modal-header">
        <h3>${p.icone} ${p.nome}</h3>
        <span class="text-sm text-muted">${passoAtual + 1} de ${PASSOS.length}</span>
      </div>
      <div class="modal-body">
        <div class="tutorial-progresso"><div class="tutorial-progresso-fill" style="width:${((passoAtual + 1) / PASSOS.length) * 100}%;"></div></div>
        ${statusBadge}
        <p style="margin-top:12px;"><strong>O que é:</strong> ${p.oque}</p>
        <p class="tutorial-recursos-titulo"><strong>Como funciona:</strong></p>
        <ul class="tutorial-recursos">${listaRecursos}</ul>
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
    overlay.innerHTML = `<div class="modal modal-lg" id="tutorial-modal"></div>`;
    document.body.appendChild(overlay);
  }

  return { iniciarSeNecessario, abrir, pular, proximo };
})();
