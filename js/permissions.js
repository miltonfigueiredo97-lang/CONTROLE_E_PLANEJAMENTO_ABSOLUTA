// ============================================
// Módulo de Permissões
// Controle de acesso por módulo/ação + acesso por obra
// Desde V3.14: permissões podem ser configuradas por obra individualmente
// quando o acesso do usuário é "Restrito" (em vez de um conjunto único
// valendo pra todas as obras liberadas pra ele).
// ============================================

const Permissions = (() => {

  // Catálogo central de módulos do sistema.
  // acoes disponíveis: ver, criar, editar, excluir, exportar, importar, convidar, limpar
  const MODULOS = {
    obras:               { label: 'Obras (criar/editar)',            categoria: 'Principal', acoes: ['criar','editar'] },
    dashboard:           { label: 'Dashboard',                      categoria: 'Principal', acoes: ['ver'] },

    planejamento:        { label: 'Planejamento',                   categoria: 'Produção', acoes: ['ver','criar','editar','excluir','importar','exportar'] },
    levantamentoFachada: { label: 'Levantamento — Fachada',         categoria: 'Produção', acoes: ['ver','criar','editar','excluir','exportar'] },
    levantamentoPiso:    { label: 'Levantamento — Piso',            categoria: 'Produção', acoes: ['ver','criar','editar','excluir'] },
    levantamentoTeto:    { label: 'Levantamento — Teto',            categoria: 'Produção', acoes: ['ver','criar','editar','excluir'] },
    levantamentoParedes: { label: 'Levantamento — Paredes',         categoria: 'Produção', acoes: ['ver','criar','editar','excluir'] },
    levantamentoConcreto:{ label: 'Levantamento — Concreto',        categoria: 'Produção', acoes: ['ver','criar','editar','excluir'] },
    levantamentoAr:      { label: 'Levantamento — Ar Condicionado', categoria: 'Produção', acoes: ['ver','criar','editar','excluir','exportar'] },
    levantamentoPintura: { label: 'Levantamento — Pintura',         categoria: 'Produção', acoes: ['ver','criar','editar','excluir'] },
    levantamentoSolo:    { label: 'Levantamento — Solo Grampeado',  categoria: 'Produção', acoes: ['ver','criar','editar','excluir'] },
    levantamentoTerra:   { label: 'Levantamento — Terraplanagem',   categoria: 'Produção', acoes: ['ver','criar','editar','excluir','limpar'] },
    controleConcreto:    { label: 'Controle — Concreto',            categoria: 'Produção', acoes: ['ver','criar','editar','excluir'] },
    controleSolo:        { label: 'Controle — Solo Grampeado',      categoria: 'Produção', acoes: ['ver','criar','editar','excluir'] },
    controleTerra:       { label: 'Controle — Terraplanagem',       categoria: 'Produção', acoes: ['ver','criar','editar','excluir','importar','exportar','limpar'] },
    controleEstacas:     { label: 'Controle — Estacas e Fundações', categoria: 'Produção', acoes: ['ver','criar','editar','excluir'] },
    controlePorcelanatos:{ label: 'Controle — Porcelanatos',        categoria: 'Produção', acoes: ['ver','criar','editar','excluir','exportar'] },
    producao:            { label: 'Produção',                       categoria: 'Produção', acoes: ['ver','criar','editar','excluir'] },

    restricoes:          { label: 'Restrições',                     categoria: 'Gestão', acoes: ['ver','criar','editar','excluir'] },
    semanal:             { label: 'Semanal',                        categoria: 'Gestão', acoes: ['ver','editar'] },
    diario:              { label: 'Diário de Obra',                 categoria: 'Gestão', acoes: ['ver','criar','editar','excluir'] },
    medicoes:            { label: 'Medições',                       categoria: 'Gestão', acoes: ['ver','criar','editar','excluir'] },

    orcamentos:          { label: 'Orçamentos',                     categoria: 'Custos', acoes: ['ver','criar','editar','excluir'] },
    maoDeObra:           { label: 'Mão de Obra',                    categoria: 'Custos', acoes: ['ver','criar','editar','excluir','exportar'] },
    suprimentos:         { label: 'Suprimentos',                    categoria: 'Custos', acoes: ['ver','editar'] },
    materiais:           { label: 'Materiais',                      categoria: 'Custos', acoes: ['ver','criar','editar','excluir'] },

    relatorios:          { label: 'Relatórios',                     categoria: 'Análise', acoes: ['ver','criar','excluir','exportar'] },
    histograma:          { label: 'Histograma',                     categoria: 'Análise', acoes: ['ver'] },

    configuracaoObra:    { label: 'Configuração de Obra',           categoria: 'Sistema', acoes: ['ver','editar'] },
    backupPlanejamento:  { label: 'Backup de Planejamentos',        categoria: 'Sistema', acoes: ['ver','excluir'] },
    diagnostico:         { label: 'Diagnóstico Técnico',            categoria: 'Sistema', acoes: ['ver'] },
    admin:               { label: 'Administração / Permissões',     categoria: 'Sistema', acoes: ['ver','convidar','editar','excluir'] },
  };

  // Módulos GLOBAIS: não pertencem a uma obra específica, então nunca têm
  // configuração por-obra — um conjunto único vale sempre, independente de
  // "Todas/Restrito". Todo o resto do catálogo é "obra-escopado": quando o
  // acesso do usuário é Restrito, cada obra da lista pode ter seu próprio
  // conjunto de permissões pra esses módulos.
  const GLOBAL_MODULOS = ['obras', 'admin'];

  // ---------------------------------------------------------------
  // SUB-AÇÕES: granularidade real dentro de cada ação grossa.
  // "editar" num módulo grande não é UMA coisa — são várias edições
  // diferentes. Aqui cada ação grossa pode ser destrinchada em itens
  // individuais, liberáveis um por um.
  //
  // Chave de armazenamento: "editar" = grupo inteiro (libera tudo);
  // "editar:celula" = só aquele item. pode(m,'editar') = true se o grupo
  // OU qualquer sub estiver liberado; pode(m,'editar:celula') = true se o
  // grupo OU aquele sub específico estiver liberado.
  //
  // Módulo/ação SEM entrada aqui = comportamento antigo (uma caixinha só).
  // ---------------------------------------------------------------
  const SUBACOES = {
    planejamento: {
      criar: [
        { key: 'tarefa',       label: 'Inserir tarefa' },
        { key: 'duplicar',     label: 'Duplicar tarefa/pavimento' },
        { key: 'estruturaNo',  label: 'Criar nó na estrutura (torre/pavimento/apto)' },
      ],
      editar: [
        { key: 'celula',       label: 'Editar célula na planilha' },
        { key: 'estrutura',    label: 'Mover/reorganizar estrutura (drag & drop)' },
        { key: 'predecessora', label: 'Editar predecessoras' },
        { key: 'nivel',        label: 'Alterar nível/hierarquia em lote' },
        { key: 'vinculo',      label: 'Vincular/desvincular Levantamento' },
        { key: 'recalculo',    label: 'Recalcular datas/% e corrigir inconsistências' },
        { key: 'datasReais',   label: 'Liberar e editar datas reais' },
        { key: 'frentes',      label: 'Classificar frentes de serviço' },
      ],
      excluir: [
        { key: 'tarefa',       label: 'Excluir tarefa' },
        { key: 'bulk',         label: 'Excluir várias selecionadas' },
        { key: 'orfas',        label: 'Excluir tarefas órfãs' },
      ],
      importar: [
        { key: 'baseCompleta', label: 'Importar base completa (substitui tudo)' },
        { key: 'correcoes',    label: 'Importar correções' },
        { key: 'excel',        label: 'Importar Excel' },
      ],
      exportar: [
        { key: 'excel',        label: 'Exportar Excel' },
        { key: 'msproject',    label: 'Exportar MS Project' },
        { key: 'png',          label: 'Exportar PNG do Gantt' },
        { key: 'pdf',          label: 'Baixar/imprimir PDF' },
        { key: 'frentes',      label: 'Exportar frentes' },
      ],
    },

    diario: {
      criar: [
        { key: 'lancamento',  label: 'Lançar apontamento' },
        { key: 'avulsa',       label: 'Adicionar tarefa avulsa' },
        { key: 'pautaRapida',  label: 'Usar pauta rápida (avanço/parado)' },
      ],
      editar: [
        { key: 'lancamento',  label: 'Editar apontamento já lançado' },
      ],
      excluir: [
        { key: 'lancamento',  label: 'Excluir apontamento' },
        { key: 'avulsa',       label: 'Excluir tarefa avulsa' },
      ],
    },

    materiais: {
      criar:   [ { key: 'material', label: 'Cadastrar material na biblioteca' },
                 { key: 'vinculo',  label: 'Vincular material a tarefa' } ],
      editar:  [ { key: 'material', label: 'Editar material da biblioteca' },
                 { key: 'vinculo',  label: 'Editar vínculo' } ],
      excluir: [ { key: 'material', label: 'Excluir material da biblioteca' },
                 { key: 'vinculo',  label: 'Remover vínculo' } ],
    },

    maoDeObra: {
      criar:   [ { key: 'equipe',  label: 'Cadastrar mão de obra na biblioteca' },
                 { key: 'vinculo', label: 'Vincular mão de obra a tarefa' } ],
      editar:  [ { key: 'equipe',  label: 'Editar mão de obra da biblioteca' },
                 { key: 'vinculo', label: 'Editar vínculo' } ],
      excluir: [ { key: 'equipe',  label: 'Excluir mão de obra da biblioteca' },
                 { key: 'vinculo', label: 'Remover vínculo' } ],
    },

    medicoes: {
      criar:   [ { key: 'medicao', label: 'Criar e salvar medição' } ],
      editar:  [ { key: 'foto',    label: 'Adicionar/remover fotos' } ],
      excluir: [ { key: 'medicao', label: 'Excluir medição' } ],
    },

    semanal: {
      editar: [
        { key: 'progresso',   label: 'Editar % de progresso' },
        { key: 'datas',        label: 'Editar datas' },
        { key: 'responsavel',  label: 'Alterar responsável' },
        { key: 'omitir',       label: 'Omitir tarefas da semana' },
        { key: 'fechamento',   label: 'Fechar/reabrir a semana' },
      ],
    },

    suprimentos: {
      editar: [
        { key: 'selecao',     label: 'Escolher quais tarefas entram' },
        { key: 'prazos',      label: 'Configurar prazos das etapas' },
        { key: 'dataStatus',  label: 'Editar data/status de uma etapa' },
        { key: 'override',    label: 'Definir prazo específico (override)' },
      ],
    },

    relatorios: {
      criar:    [ { key: 'relatorio', label: 'Criar relatório' } ],
      excluir:  [ { key: 'relatorio', label: 'Excluir relatório' } ],
      exportar: [ { key: 'pdf',       label: 'Baixar PDF' } ],
    },

    configuracaoObra: {
      editar: [
        { key: 'etapas',   label: 'Etapas' },
        { key: 'pacotes',  label: 'Pacotes' },
        { key: 'locais',   label: 'Locais' },
        { key: 'equipes',  label: 'Equipes' },
        { key: 'dadosObra',label: 'Dados gerais / cálculo da obra' },
      ],
    },
  };

  function subsDe(modulo, acao) {
    return SUBACOES[modulo]?.[acao] || null;
  }

  function temSubs(modulo, acao) {
    return !!subsDe(modulo, acao);
  }

  const ACAO_LABEL = {
    ver: 'Ver', criar: 'Criar', editar: 'Editar', excluir: 'Excluir',
    exportar: 'Exportar', importar: 'Importar', convidar: 'Convidar usuário',
    limpar: 'Limpar base (tudo)'
  };

  // Nome do arquivo (sem .html) -> chave do módulo, para o gate de página.
  // Páginas ausentes daqui (hubs, login, notas-versao etc.) não são bloqueadas.
  const PAGINA_MODULO = {
    'dashboard': 'dashboard',
    'planejamento': 'planejamento',
    'levantamento-fachada': 'levantamentoFachada',
    'levantamento-piso': 'levantamentoPiso',
    'levantamento-teto': 'levantamentoTeto',
    'levantamento-paredes': 'levantamentoParedes',
    'levantamento-concreto': 'levantamentoConcreto',
    'levantamento-ar-condicionado': 'levantamentoAr',
    'levantamento-ar-config': 'levantamentoAr',
    'levantamento-pintura': 'levantamentoPintura',
    'levantamento-solo-grampeado': 'levantamentoSolo',
    'levantamento-terraplanagem': 'levantamentoTerra',
    'controle-concreto': 'controleConcreto',
    'controle-solo-grampeado': 'controleSolo',
    'controle-terraplanagem': 'controleTerra',
    'controle-estacas': 'controleEstacas',
    'controle-porcelanatos': 'controlePorcelanatos',
    'producao': 'producao',
    'restricoes': 'restricoes',
    'semanal': 'semanal',
    'diario': 'diario',
    'medicoes': 'medicoes',
    'orcamentos': 'orcamentos',
    'mao-de-obra': 'maoDeObra',
    'suprimentos': 'suprimentos',
    'materiais': 'materiais',
    'relatorios': 'relatorios',
    'histograma': 'histograma',
    'configuracao-obra': 'configuracaoObra',
    'backup-planejamento': 'backupPlanejamento',
    'diagnostico': 'diagnostico',
    'admin-permissoes': 'admin',
  };

  let permissoesGlobais = {};  // módulos GLOBAL_MODULOS (obras, admin) — um conjunto só
  let permissoesTodas = {};    // módulos obra-escopados, usado quando acessoObras==='todas'
                                // e também como fallback pra obra restrita sem config própria
  let permissoesPorObra = {};  // { obraId: {modulos} } — usado quando acessoObras==='restrito'
  let perfil = null;           // 'admin' | 'usuario'
  let ativo = true;
  let acessoObras = 'todas';   // 'todas' | [obraId,...]
  let carregado = false;

  async function carregar(uid) {
    carregado = false;
    if (!uid) { _resetVazio(); carregado = true; return; }

    try {
      const userDoc = await Database.getUser(uid);
      perfil = userDoc?.perfil || 'usuario';
      ativo = userDoc?.ativo !== false;
      acessoObras = userDoc?.acessoObras || 'todas';

      if (perfil === 'admin') {
        permissoesGlobais = _fullAccess(GLOBAL_MODULOS);
        permissoesTodas = _fullAccess(_obraEscopados());
        permissoesPorObra = {};
      } else {
        const permDoc = await Database.obterRaiz('permissions', uid);
        // Retrocompatibilidade: docs de antes do modelo por-obra só tinham
        // um `modulos` plano (que misturava tudo, inclusive obras/admin).
        permissoesGlobais = permDoc?.global || _extrairDoLegado(permDoc?.modulos, GLOBAL_MODULOS);
        permissoesTodas = permDoc?.modulos || {};
        permissoesPorObra = permDoc?.porObra || {};
      }
    } catch (e) {
      console.error('Erro ao carregar permissões:', e);
      _resetVazio();
    }
    carregado = true;
  }

  function _extrairDoLegado(modulosPlano, chaves) {
    const out = {};
    chaves.forEach(k => { if (modulosPlano?.[k]) out[k] = modulosPlano[k]; });
    return out;
  }

  function _obraEscopados() {
    return Object.keys(MODULOS).filter(k => !GLOBAL_MODULOS.includes(k));
  }

  function _resetVazio() {
    perfil = 'usuario'; ativo = false; acessoObras = 'todas';
    permissoesGlobais = {}; permissoesTodas = {}; permissoesPorObra = {};
  }

  function _fullAccess(chaves) {
    const access = {};
    chaves.forEach(key => {
      access[key] = {};
      (MODULOS[key]?.acoes || []).forEach(a => {
        access[key][a] = true;
        (subsDe(key, a) || []).forEach(s => { access[key][`${a}:${s.key}`] = true; });
      });
    });
    return access;
  }

  // Módulos obra-escopados aplicáveis à obra atualmente selecionada (ou ao
  // conjunto único, se o acesso do usuário for "Todas as obras"). Se o
  // acesso é "Restrito" e a obra ativa ainda não tem configuração própria,
  // cai no conjunto "modulos" (permissoesTodas) como padrão — assim nenhuma
  // obra fica sem nada só porque ainda não foi configurada individualmente.
  function _modulosDaObraAtiva() {
    if (acessoObras === 'todas') return permissoesTodas;
    const obraId = (typeof Router !== 'undefined' && Router.getObraId) ? Router.getObraId() : null;
    if (obraId && permissoesPorObra[obraId]) return permissoesPorObra[obraId];
    return permissoesTodas;
  }

  // Template para usuário novo: nada liberado além do Dashboard (nos
  // módulos obra-escopados). Usado tanto no conjunto "Todas" quanto como
  // ponto de partida ao configurar uma obra nova dentro do "Restrito".
  function templateVazio() {
    const modulos = {};
    _obraEscopados().forEach(key => {
      modulos[key] = {};
      (MODULOS[key].acoes || []).forEach(a => {
        modulos[key][a] = (key === 'dashboard' && a === 'ver');
        (subsDe(key, a) || []).forEach(s => { modulos[key][`${a}:${s.key}`] = false; });
      });
    });
    return modulos;
  }

  function templateVazioGlobal() {
    const modulos = {};
    GLOBAL_MODULOS.forEach(key => {
      modulos[key] = {};
      (MODULOS[key].acoes || []).forEach(a => {
        modulos[key][a] = false;
        (subsDe(key, a) || []).forEach(s => { modulos[key][`${a}:${s.key}`] = false; });
      });
    });
    return modulos;
  }

  // Aceita ação grossa ('editar') ou sub-ação ('editar:celula').
  // - 'editar'        → true se o grupo inteiro estiver liberado OU
  //                     qualquer sub-item dele estiver (= "pode editar
  //                     alguma coisa"), o que mantém compatível todo guard
  //                     antigo que só checava a ação grossa.
  // - 'editar:celula' → true se o grupo inteiro estiver liberado (grupo
  //                     libera tudo) OU aquele sub específico estiver.
  function pode(modulo, acao = 'ver') {
    if (perfil === 'admin') return true;
    if (!ativo) return false;
    const modulos = GLOBAL_MODULOS.includes(modulo) ? permissoesGlobais : _modulosDaObraAtiva();
    const m = modulos[modulo];
    if (!m) return false;

    const [grupo, sub] = String(acao).split(':');
    if (m[grupo] === true) return true;          // grupo inteiro liberado
    if (sub) return m[`${grupo}:${sub}`] === true;

    // Ação grossa sem grupo liberado: vale se algum sub-item estiver.
    const subs = subsDe(modulo, grupo);
    if (subs) return subs.some(s => m[`${grupo}:${s.key}`] === true);
    return false;
  }

  function podeAcessarObra(obraId) {
    if (perfil === 'admin') return true;
    if (!ativo) return false;
    if (acessoObras === 'todas') return true;
    return Array.isArray(acessoObras) && acessoObras.includes(obraId);
  }

  function isAtivo() { return ativo; }
  function isAdminAtual() { return perfil === 'admin'; }
  function getAcessoObras() { return acessoObras; }

  // Gate de página: chamado pelo Utils.initPagina(). Retorna false e já
  // redireciona se a página atual exigir um módulo que o usuário não tem
  // (considerando a obra ativa, se o módulo for obra-escopado).
  function bloquearPaginaSemAcesso() {
    if (!ativo) {
      Auth.logout();
      return false;
    }
    const arquivo = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
    const modulo = PAGINA_MODULO[arquivo];
    if (modulo && !pode(modulo, 'ver')) {
      window.location.href = 'obras.html';
      return false;
    }
    return true;
  }

  // Links de menu que são "hub" de vários módulos (o próprio hub não é um
  // módulo com permissão própria — ele deve aparecer se o usuário tiver
  // "ver" em QUALQUER um dos módulos que ele agrupa, na obra ativa).
  const HUBS = {
    levantamento: ['levantamentoFachada','levantamentoPiso','levantamentoTeto','levantamentoParedes',
                   'levantamentoConcreto','levantamentoAr','levantamentoPintura','levantamentoSolo','levantamentoTerra'],
    controle: ['controleConcreto','controleSolo','controleTerra','controleEstacas','controlePorcelanatos'],
  };

  function podeHub(hub) {
    return (HUBS[hub] || []).some(m => pode(m, 'ver'));
  }

  // Esconde qualquer elemento marcado com data-perm="modulo:acao" se o
  // usuário não tiver a permissão (na obra ativa, se aplicável), e
  // data-perm-hub="levantamento|controle" se ele não tiver "ver" em nenhum
  // módulo daquele grupo. Depois, esconde os títulos de categoria da
  // sidebar (Gestão, Custos...) que ficaram sem nenhum link visível
  // embaixo. Chamar depois de renderizar botões dinâmicos de cada módulo,
  // e de novo sempre que a obra ativa mudar (Router troca a obra).
  function aplicarNaTela(root = document) {
    root.querySelectorAll('[data-perm]').forEach(el => {
      // Pode ser "modulo:acao" ou "modulo:acao:sub" — só a primeira parte é
      // o módulo, todo o resto é a ação (com sub-ação, se houver).
      const partes = el.dataset.perm.split(':');
      const modulo = partes.shift();
      const acao = partes.join(':') || 'ver';
      if (!pode(modulo, acao)) el.classList.add('hidden');
    });
    root.querySelectorAll('[data-perm-hub]').forEach(el => {
      if (!podeHub(el.dataset.permHub)) el.classList.add('hidden');
    });
    _ocultarCategoriasVaziasSidebar(root);
  }

  function _ocultarCategoriasVaziasSidebar(root) {
    const nav = (root.querySelector ? root : document).querySelector('.sidebar-nav');
    if (!nav) return;
    const filhos = Array.from(nav.children);
    filhos.forEach((el, i) => {
      if (!el.classList.contains('sidebar-section-title')) return;
      let temVisivel = false;
      for (let j = i + 1; j < filhos.length; j++) {
        if (filhos[j].classList.contains('sidebar-section-title')) break;
        if (filhos[j].tagName === 'A' && !filhos[j].classList.contains('hidden')) { temVisivel = true; break; }
      }
      el.classList.toggle('hidden', !temVisivel);
    });
  }

  // Grava as permissões de um usuário.
  // - global: {obras:{...}, admin:{...}} — sempre um conjunto único
  // - modulos: módulos obra-escopados usados quando acessoObrasNovo==='todas'
  //   (e como fallback de qualquer obra restrita ainda sem config própria)
  // - porObra: { [obraId]: modulos } — só relevante quando acessoObrasNovo
  //   é uma lista (Restrito); obras fora da lista são ignoradas/removidas
  async function salvarPermissoesUsuario(uid, { global, modulos, porObra }, acessoObrasNovo) {
    await db.collection('permissions').doc(uid).set({
      global: global || {},
      modulos: modulos || {},
      porObra: porObra || {},
      atualizadoPor: Auth.getUid(),
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await db.collection('users').doc(uid).set({
      acessoObras: acessoObrasNovo,
      updatedBy: Auth.getUid(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    if (uid === Auth.getUid()) {
      permissoesGlobais = global || {};
      permissoesTodas = modulos || {};
      permissoesPorObra = porObra || {};
      acessoObras = acessoObrasNovo;
    }
  }

  return {
    MODULOS, ACAO_LABEL, GLOBAL_MODULOS, SUBACOES, subsDe, temSubs,
    carregar, pode, podeHub, podeAcessarObra, isAtivo, isAdminAtual, getAcessoObras,
    bloquearPaginaSemAcesso, aplicarNaTela, templateVazio, templateVazioGlobal, salvarPermissoesUsuario,
  };
})();
