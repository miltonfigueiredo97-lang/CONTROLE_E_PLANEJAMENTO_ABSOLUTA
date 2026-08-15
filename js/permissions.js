// ============================================
// Módulo de Permissões
// Controle de acesso por módulo/ação + acesso por obra
// V2.58.0
// ============================================

const Permissions = (() => {

  // Catálogo central de módulos do sistema.
  // acoes disponíveis: ver, criar, editar, excluir, exportar, importar, convidar
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
    producao:            { label: 'Produção',                       categoria: 'Produção', acoes: ['ver','criar','editar','excluir'] },

    restricoes:          { label: 'Restrições',                     categoria: 'Gestão', acoes: ['ver','criar','editar','excluir'] },
    semanal:             { label: 'Semanal',                        categoria: 'Gestão', acoes: ['ver','editar'] },
    diario:              { label: 'Diário de Obra',                 categoria: 'Gestão', acoes: ['ver','criar','editar','excluir'] },
    medicoes:            { label: 'Medições',                       categoria: 'Gestão', acoes: ['ver','criar','editar','excluir'] },

    orcamentos:          { label: 'Orçamentos',                     categoria: 'Custos', acoes: ['ver','criar','editar','excluir'] },
    maoDeObra:           { label: 'Mão de Obra',                    categoria: 'Custos', acoes: ['ver','criar','editar','excluir','exportar'] },
    suprimentos:         { label: 'Suprimentos',                    categoria: 'Custos', acoes: ['ver','criar','editar','excluir'] },
    materiais:           { label: 'Materiais',                      categoria: 'Custos', acoes: ['ver','criar','editar','excluir'] },

    relatorios:          { label: 'Relatórios',                     categoria: 'Análise', acoes: ['ver','criar','excluir','exportar'] },
    histograma:          { label: 'Histograma',                     categoria: 'Análise', acoes: ['ver'] },

    configuracaoObra:    { label: 'Configuração de Obra',           categoria: 'Sistema', acoes: ['ver','editar'] },
    backupPlanejamento:  { label: 'Backup de Planejamentos',        categoria: 'Sistema', acoes: ['ver','excluir'] },
    admin:               { label: 'Administração / Permissões',     categoria: 'Sistema', acoes: ['ver','convidar','editar','excluir'] },
  };

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
    'admin-permissoes': 'admin',
  };

  let permissoes = {};   // modulos do usuário atual
  let perfil = null;     // 'admin' | 'usuario'
  let ativo = true;
  let acessoObras = 'todas'; // 'todas' | [obraId,...]
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
        permissoes = _fullAccess();
      } else {
        const permDoc = await Database.obterRaiz('permissions', uid);
        permissoes = permDoc?.modulos || {};
      }
    } catch (e) {
      console.error('Erro ao carregar permissões:', e);
      _resetVazio();
    }
    carregado = true;
  }

  function _resetVazio() {
    perfil = 'usuario'; ativo = false; acessoObras = 'todas'; permissoes = {};
  }

  function _fullAccess() {
    const access = {};
    Object.entries(MODULOS).forEach(([key, mod]) => {
      access[key] = {};
      mod.acoes.forEach(a => access[key][a] = true);
    });
    return access;
  }

  // Template para usuário novo: nada liberado além do Dashboard.
  function templateVazio() {
    const modulos = {};
    Object.entries(MODULOS).forEach(([key, mod]) => {
      modulos[key] = {};
      mod.acoes.forEach(a => modulos[key][a] = (key === 'dashboard' && a === 'ver'));
    });
    return modulos;
  }

  function pode(modulo, acao = 'ver') {
    if (perfil === 'admin') return true;
    if (!ativo) return false;
    return !!(permissoes[modulo] && permissoes[modulo][acao] === true);
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
  // redireciona se a página atual exigir um módulo que o usuário não tem.
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
  // "ver" em QUALQUER um dos módulos que ele agrupa).
  const HUBS = {
    levantamento: ['levantamentoFachada','levantamentoPiso','levantamentoTeto','levantamentoParedes',
                   'levantamentoConcreto','levantamentoAr','levantamentoPintura','levantamentoSolo','levantamentoTerra'],
    controle: ['controleConcreto','controleSolo','controleTerra','controleEstacas'],
  };

  function podeHub(hub) {
    return (HUBS[hub] || []).some(m => pode(m, 'ver'));
  }

  // Esconde qualquer elemento marcado com data-perm="modulo:acao" se o
  // usuário não tiver a permissão, e data-perm-hub="levantamento|controle"
  // se ele não tiver "ver" em nenhum módulo daquele grupo. Depois, esconde
  // os títulos de categoria da sidebar (Gestão, Custos...) que ficaram sem
  // nenhum link visível embaixo. Chamar depois de renderizar botões
  // dinâmicos de cada módulo.
  function aplicarNaTela(root = document) {
    root.querySelectorAll('[data-perm]').forEach(el => {
      const [modulo, acao] = el.dataset.perm.split(':');
      if (!pode(modulo, acao || 'ver')) el.classList.add('hidden');
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

  async function salvarPermissoesUsuario(uid, modulos, acessoObrasNovo) {
    // set(merge:true) em vez de atualizarRaiz (.update()): usuários criados antes
    // do V2.58 (ex: admin/chefe originais) ainda não têm doc em permissions/{uid} —
    // .update() falharia com "No document to update". set+merge cria se não existir.
    await db.collection('permissions').doc(uid).set({
      modulos,
      atualizadoPor: Auth.getUid(),
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await db.collection('users').doc(uid).set({
      acessoObras: acessoObrasNovo,
      updatedBy: Auth.getUid(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    if (uid === Auth.getUid()) { permissoes = modulos; acessoObras = acessoObrasNovo; }
  }

  return {
    MODULOS, ACAO_LABEL,
    carregar, pode, podeHub, podeAcessarObra, isAtivo, isAdminAtual, getAcessoObras,
    bloquearPaginaSemAcesso, aplicarNaTela, templateVazio, salvarPermissoesUsuario,
  };
})();
