// Notas de Versão — atualizado a cada commit
const NotasVersao = {
  versaoAtual: 'V1.2.1',

  versoes: [
    {
      versao: 'V1.0',
      status: 'fechada',
      data: '2025-07-04',
      tipo: 'lancamento',
      titulo: 'Lançamento Oficial da Base',
      itens: [
        'Sistema publicado em produção (Vercel + Firebase)',
        'Identidade visual Absoluta: preto + amarelo #F5C800',
        'Logo oficial, sidebar escura, header com borda amarela',
        'Card especial obra Essence/Zenith com foto',
        'Módulo Obras: criar, listar, editar, excluir',
        'Módulo Configuração da Obra: etapas, pacotes, locais, equipes',
        'Módulo Levantamentos (hub)',
        'Módulo Levantamento de Fachada — calculadora completa',
        '  → Hierarquia: Fachada → Balancim → Vista → Peça',
        '  → m² sem ML, m² com ML, Metro Linear, Vão Fechado',
        '  → Checkbox "Pode ser ML" por peça',
        '  → 4 modos de desconto de janela configuráveis',
        '  → Vão fechado por Vista (não por peça)',
        '  → Visão Geral com mapa PNG + caixas posicionáveis',
        '  → Exportação CSV',
        'Módulo Planejamento V1: Gantt, Linha de Balanço, Escadinha, Tabela',
        'Auditoria automática em todas as operações',
      ]
    },
    {
      versao: 'V1.0.1',
      status: 'fechada',
      data: '2025-07-04',
      tipo: 'correcao',
      titulo: 'Correções de autenticação e dados',
      itens: [
        'firebase-config.js: reutiliza app existente (não chama initializeApp duas vezes)',
        'Fachada: carregar com fallback duplo (sem orderBy → com createdAt)',
        'Fachada: múltiplas fachadas abertas na árvore simultaneamente',
        'Fachada: ✎ inline para renomear fachada/balancim',
        'Fachada: Visão Geral antes do Resumo Geral',
        'Fachada: canvas branco com padding para posicionamento',
        'Fachada: card de total geral na Visão Geral',
        'Obras: editar obra existente funcionando',
        'Router: troca de obra recarrega módulo automaticamente',
        'Notas de Versão: criadas e acessíveis na sidebar',
      ]
    },
    {
      versao: 'V1.0.2',
      status: 'fechada',
      data: '2025-07-04',
      tipo: 'correcao',
      titulo: 'Correção definitiva de autenticação',
      itens: [
        'auth.js: reescrito do zero — sem timers conflitantes',
        '  → onAuthStateChanged ignora null completamente (Firebase restaurando sessão)',
        '  → Timeout único de 8s só ativa se realmente não houver sessão',
        '  → Resolve definitivamente o bug de usuário sumindo ao navegar',
        'utils.js: initPagina sem timeout próprio — usa apenas o do auth',
        '  → Erros do Firestore (seletor de obras) não bloqueiam a página',
        '  → Usuário nunca é redirecionado por erro de Firestore',
        'Versão atual visível na sidebar (ex: V1.0.2)',
        'Notas de versão bumpeadas a cada commit (V1.0.2)',
        'CRÍTICO fachada: cxVincular não existia → travava o módulo inteiro',
        '  → Corrigido para cxEditar e salvarCxEdit',
        '  → LevantamentoFachada undefined era consequência deste erro',
        'Obras: removidas imagens hardcoded (Essence/Zenith)',
        'Obras: botão Inserir Imagem no modal — cada obra tem sua própria foto',
        'Fachada: toggle Visão Geral agora abre primeiro (antes de Resumo Geral)',
        'Fachada: mapa migra dados de chave antiga (fachadaMap_null) para chave correta',
        '  → Imagem importada volta a aparecer após correção do bug anterior',
        'Mapa (Visão Geral): migrado de localStorage para Firestore',
        '  → Imagem e posições das caixas disponíveis em qualquer dispositivo',
        '  → Carregado junto com os dados da fachada no init()',
        'Layout geral: sidebar fixa em 100vh, usuário sempre visível sem scroll',
        'Visão Geral: layout compacto — topbar, total e mapa cabem na tela',
        '  → Toggle + botões na mesma linha (topbar)',
        '  → Mapa ocupa o espaço restante da tela automaticamente',
        '  → Imagem responsiva dentro da área de mapa',
        'Imagens: migradas de base64/localStorage para Firebase Storage',
        '  → Mapa da Visão Geral: upload para Storage, URL salva no Firestore',
        '  → Imagem de capa das obras: upload para Storage',
        '  → Resolve limite de 1MB do Firestore e persistência entre dispositivos',
        'Mapa: imagem no tamanho natural com scroll — não mais cortada',
        'Imagem: compressão via canvas (sem Firebase Storage) — sem loading infinito',
        '  → Reduz para <900KB antes de salvar no Firestore',
        '  → Qualidade progressiva: 85% → 30% até caber',
        'Visão Geral: sidebar esquerda oculta para maximizar área do mapa',
        '  → Aparece de volta ao entrar no Resumo Geral',
        'Visão Geral: imagem ocupa toda a largura disponível (fit)',
        'Drag das caixas: reescrito com mouse events (mousedown/mousemove/mouseup)',
        '  → Movimento preciso, sem travar, sem voltar ao lugar inicial',
        '  → Considera scroll do wrapper no cálculo de posição',
      ]
    },
    {
      versao: 'V1.0.3',
      status: 'fechada',
      data: '2025-07-04',
      tipo: 'correcao',
      titulo: 'Correções de layout e mapa',
      itens: [
        'Imagem do mapa: compressão via canvas — sem loading infinito',
        'Imagem do mapa: salva comprimida no Firestore (sem Firebase Storage)',
        'Visão Geral: sidebar esquerda oculta para maximizar área do mapa',
        'Visão Geral: imagem ocupa toda a largura disponível (fit)',
        'Drag das caixas: reescrito com mousedown/mousemove/mouseup',
        '  → Movimento preciso, não volta ao lugar inicial',
        '  → Considera scroll do wrapper no cálculo de posição',
        'Layout geral: sidebar fixa em 100vh, usuário sempre visível',
        'Versão atualizada para V1.0.3 em todos os arquivos',
      ]
    },
    {
      versao: 'V1.0.4',
      status: 'fechada',
      data: '2025-07-04',
      tipo: 'correcao',
      titulo: 'Visão Geral: sidebar, drag e imagem corrigidos',
      itens: [
        'Sidebar esquerda oculta na Visão Geral — toda a tela para o mapa',
        '  → Grade muda para 1 coluna (sem sidebar)',
        '  → Volta ao normal no Resumo Geral',
        'Drag das caixas reescrito corretamente com mouse events',
        '  → Caixas se movem livremente, não travam, não voltam ao lugar',
        '  → Offset calculado relativo ao mapa-area com scroll do wrapper',
        'Ícone de cadeado: 🔓 aberto (livre) / 🔒 fechado (travado) — visível',
        'Botões da caixa não ativam drag ao clicar (stopPropagation)',
        'Imagem ocupa 100% da largura do mapa com scroll quando maior',
        'pointer-events:none no container, pointer-events:all por caixa',
      ]
    }
    ,{
      versao: 'V1.0.5',
      status: 'fechada',
      data: '2025-07-04',
      tipo: 'correcao',
      titulo: 'Sidebar, caixas livres e imagem fit',
      itens: [
        'Sidebar da estrutura: id adicionado ao HTML — agora some de verdade na Visão Geral',
        'Caixas sem limite de posição — movem livremente para qualquer lugar',
        'Imagem do mapa: object-fit contain — cabe na tela sem scroll, sem corte',
        'Save do mapa: log de debug + validação de tamanho antes de salvar',
        '  → Mostra erro claro se imagem ainda for grande demais',
      ]
    },
    {
      versao: 'V1.0.6',
      status: 'fechada',
      data: '2025-07-04',
      tipo: 'correcao',
      titulo: 'Estrutura some + zoom do mapa',
      itens: [
        'Coluna Estrutura (fachada-tree): agora some de verdade na Visão Geral',
        '  → renderPainel() usa getElementById corretamente',
        '  → Volta ao abrir Resumo Geral',
        'Controles de zoom na Visão Geral: − / % / + / ↺ reset',
        '  → Zoom de 20% a 300% para ajustar a imagem na tela',
        '  → Caixas escalam junto com a imagem',
        'Mapa: overflow auto — scroll só quando zoom > tela',
      ]
    },
    {
      versao: 'V1.0.7',
      status: 'fechada',
      data: '2025-07-04',
      tipo: 'correcao',
      titulo: 'Canvas infinito + redimensionar imagem',
      itens: [
        'Botão ✎ Tamanho na topbar — abre slider para ajustar largura da imagem',
        '  → Slider de 200px a 3000px em tempo real',
        '  → Caixas permanecem onde estão ao redimensionar',
        'Canvas infinito (2000×1400px mínimo) com fundo pontilhado',
        '  → Caixas podem ficar em qualquer lugar, inclusive fora da imagem',
        '  → Scroll livre para navegar pelo canvas',
        'Imagem posicionada no canto superior esquerdo do canvas',
        '  → Margem de 40px ao redor para posicionar caixas fora da imagem',
      ]
    },
        {
      versao: 'V1.0.8',
      status: 'fechada',
      data: '2025-07-04',
      tipo: 'correcao',
      titulo: 'Imagem arrastável e redimensionável com handles',
      itens: [
        'Imagem do mapa: drag para mover (arrastar em qualquer direção)',
        'Imagem do mapa: 8 handles amarelos nos cantos e bordas para redimensionar',
        '  → Arrastar canto: resize proporcional',
        '  → Arrastar borda: resize direcional',
        'Imagem cabe na tela ao importar (fit automático)',
        'Canvas sem overflow/scroll — imagem e caixas sempre visíveis',
        'Borda tracejada amarela indica que a imagem é editável',
      ]
    },
    {
      versao: 'V1.0.9',
      status: 'fechada',
      data: '2025-07-04',
      tipo: 'correcao',
      titulo: 'Resize correto, fundo branco, caixas livres, cadeado legível',
      itens: [
        'Handles de resize: corrigidos — agora redimensiona a imagem corretamente',
        'Caixas: drag corrigido — posição relativa ao canvas (não à area)',
        'Fundo do canvas: branco puro (sem pontinhos)',
        'Cadeado: substituído por texto LIVRE (verde) / TRAV (vermelho)',
        '  → Muito mais legível que emoji de cadeado',
      ]
    },
    {
      versao: 'V1.1.0',
      status: 'fechada',
      data: '2025-07-04',
      tipo: 'funcionalidade',
      titulo: 'Resize completo de imagem e caixas na Visão Geral',
      itens: [
        'Imagem: 8 handles amarelos para redimensionar (4 cantos + 4 bordas)',
        '  → Cantos: resize proporcional (mantém proporção da imagem)',
        '  → Bordas E/W: estica horizontalmente',
        '  → Bordas N/S: estica verticalmente com proporção',
        'Imagem: arrastar para mover livremente no canvas',
        'Imagem: fit automático ao importar (cabe na tela)',
        'Caixas: handle ⤡ no canto inferior direito para redimensionar largura',
        '  → Conteúdo se adapta à largura da caixa',
        'Caixas: ficam sempre em cima da imagem (z-index:20 vs z-index:1)',
        'Canvas: fundo branco puro, sem pontinhos',
        'Lock: LIVRE (verde) / TRAV (vermelho) — legível',
      ]
    },
    {
      versao: 'V1.1.1',
      status: 'fechada',
      data: '2025-07-04',
      tipo: 'correcao',
      titulo: 'Visão Geral: modo edição, imgState no Firestore, resize caixas',
      itens: [
        'Imagem: botão Editar Imagem ativa modo edição (borda amarela)',
        'Imagem: botão Confirmar salva posição/tamanho no Firestore e trava',
        '  → Imagem não se move/redimensiona fora do modo edição',
        'Imagem: imgState (x,y,w) salvo no Firestore — persiste ao recarregar',
        'Caixas: resize em largura (E) e altura (S) separados',
        '  → Handle ⤡ no canto: resize em diagonal (largura+altura)',
        '  → Barra na base: resize só em altura',
        'Caixas: ficam acima da imagem (z-index:30 vs z-index:1)',
      ]
    },
    {
      versao: 'V1.1.2',
      status: 'fechada',
      data: '2025-07-04',
      tipo: 'correcao',
      titulo: 'Caixas nunca cortadas + imgState persistido',
      itens: [
        'Caixas: movidas para overlay fora do canvas (overflow:visible)',
        '  → Nunca mais cortadas — podem ir para qualquer lugar da tela',
        'imgState salvo no Firestore — posição e tamanho da imagem persistem',
        'Modo edição: botão confirmar salva e trava imagem',
        'Resize caixas: handle ⤡ para largura+altura simultâneos',
        'Texto das caixas: flex-wrap para refluir ao redimensionar',
      ]
    },
    {
      versao: 'V1.1.3',
      status: 'fechada',
      data: '2025-07-05',
      tipo: 'correcao',
      titulo: 'Auth corrigido, fórmula ML do config, vãos múltiplos',
      itens: [
        'CRÍTICO: carregar() agora carrega mapaVisao do Firestore novamente',
        '  → Imagem e caixas voltam ao abrir a página',
        '  → Usuário não buga mais ao entrar em fachada',
        'Fórmula ML: usa ml_percentual do config (não mais fixo em 50%)',
        '  → Ex: 100% → ml conta inteiro no equivalente: 6m² + 4ml = 10m²',
        '  → Ex: 50%  → ml conta metade: 6m² + 4ml = 8m²',
        'Vão Fechado por Vista: múltiplos vãos por vista',
        '  → Cada vão tem Comprimento, Altura e Quantidade',
        '  → Botão + Adicionar Vão para incluir mais vãos',
        '  → Total acumulado exibido em tempo real',
      ]
    },
    {
      versao: 'V1.1.4',
      status: 'fechada',
      data: '2025-07-05',
      tipo: 'correcao',
      titulo: 'CRÍTICO: funções perdidas restauradas',
      itens: [
        'CAUSA RAIZ do bug: reescritas da Visão Geral deletaram funções essenciais',
        '  → importarMapa, cxAdicionar, cxRemover, cxTravar, cxEditar, salvarCxEdit, limparMapa',
        '  → return{} exportava funções inexistentes → IIFE falhava → módulo undefined',
        '  → Usuário bugava porque o módulo não carregava',
        'Todas as funções restauradas e verificadas (47 exportadas, todas existem)',
        'cxTravar e cxEditar agora rerenderizam só as caixas (sem reload do painel inteiro)',
      ]
    },
    {
      versao: 'V1.1.5',
      status: 'fechada',
      data: '2025-07-05',
      tipo: 'correcao',
      titulo: 'Drag das caixas: reescrito simples e direto',
      itens: [
        'cxMouseDown: usa delta (startX/startY) em vez de getBoundingClientRect do overlay',
        '  → Não depende do overlay existir ou ter posição correta',
        '  → Move exatamente o quanto o mouse se deslocou',
        '  → Salva posição final no Firestore ao soltar',
      ]
    },
    {
      versao: 'V1.1.6',
      status: 'fechada',
      data: '2025-07-05',
      tipo: 'correcao',
      titulo: 'Drag caixas: header é a alça de arrasto',
      itens: [
        'CAUSA RAIZ do drag não funcionar:',
        '  → onmousedown estava no div pai, mas header tinha stopPropagation',
        '  → Qualquer clique passava pelo header e cancelava o evento',
        'Fix: onmousedown movido para o HEADER (barra amarela)',
        '  → Arrastar pelo header amarelo move a caixa',
        '  → Botões ainda têm stopPropagation para não arrastar ao clicar',
      ]
    },
    {
      versao: 'V1.2',
      status: 'fechada',
      data: '2025-07-05',
      tipo: 'funcionalidade',
      titulo: 'Planejamento funcional + Módulo Materiais',
      itens: [
        'PLANEJAMENTO — Importar Excel:',
        '  → Aceita .xlsx e .xls (SheetJS via CDN, sem instalação)',
        '  → Detecta colunas em PT e EN automaticamente',
        '  → Importa: Código, Nome, Tipo, Datas, Duração, %, Responsável, Etapa, Pacote, Local',
        '  → Calcula duração automaticamente se tiver datas',
        '  → Trata datas em DD/MM/YYYY, YYYY-MM-DD e serial Excel',
        'PLANEJAMENTO — Exportar Excel:',
        '  → Gera .xlsx com todas as tarefas',
        '  → Inclui aba de Instruções de importação',
        '  → Nome do arquivo inclui obra e data',
        'PLANEJAMENTO — Gantt melhorado:',
        '  → Linha Hoje em amarelo com label',
        '  → Barra executada real (início/término real)',
        '  → Zoom dia/semana/mês/trimestre/ano',
        'MATERIAIS — Novo módulo:',
        '  → Vínculo com tarefas do Planejamento',
        '  → Vínculo com Fachadas do Levantamento',
        '  → Consumo Previsto × Quantidade da tarefa = total calculado',
        '  → Detalhes da tarefa/fachada ao filtrar',
        '  → CRUD completo com tipo, fabricante, unidade',
      ]
    },
    {
      versao: 'V1.2.1',
      status: 'aberta',
      data: '2025-07-05',
      tipo: 'correcao',
      titulo: 'Correções Planejamento e Materiais',
      itens: [
        'Planejamento: Router.getObraAtiva → Router.getObra (exportar funcionando)',
        'Materiais: removido stub de desenvolvimento',
        'Materiais: modal de cadastro adicionado ao HTML',
        'Materiais: Levantamento Fachada aparece como UMA entrada agregada',
        '  → Agrupa todas as fachadas com m² total e detalhe por fachada',
        '  → Não lista cada fachada separada',
        'Materiais: layout organizado com tabela e filtros no topo',
      ]
    }
  ],

  render(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    const icon = { lancamento:'🚀', correcao:'🔧', funcionalidade:'✨', melhoria:'📈' };
    const stLabel = { aberta:'Em aberto', fechada:'Fechada' };
    c.innerHTML = `
      <div class="page-header">
        <div>
          <h2>📋 Notas de Versão</h2>
          <span class="subtitulo">Versão atual: <strong>${this.versaoAtual}</strong></span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;">
        ${this.versoes.slice().reverse().map(v => `
          <div style="background:#fff;border-radius:10px;border:1.5px solid ${v.status==='aberta'?'var(--cor-primaria)':'var(--cor-borda-light)'};overflow:hidden;">
            <div style="background:${v.status==='aberta'?'var(--cor-primaria)':'var(--cor-dark-800)'};padding:13px 20px;display:flex;align-items:center;gap:10px;">
              <span style="font-size:1.2rem;">${icon[v.tipo]||'📌'}</span>
              <div style="flex:1">
                <div style="font-weight:800;color:${v.status==='aberta'?'#000':'#fff'};">${v.versao} — ${v.titulo}</div>
                <div style="font-size:.75rem;color:${v.status==='aberta'?'rgba(0,0,0,.55)':'#777'};margin-top:2px;">${new Date(v.data).toLocaleDateString('pt-BR')}</div>
              </div>
              <span style="padding:2px 10px;border-radius:100px;font-size:.7rem;font-weight:700;background:${v.status==='aberta'?'rgba(0,0,0,.12)':'rgba(255,255,255,.08)'};color:${v.status==='aberta'?'#000':'#aaa'};">${stLabel[v.status]}</span>
            </div>
            <ul style="list-style:none;padding:14px 20px;display:flex;flex-direction:column;gap:5px;margin:0;">
              ${v.itens.map(item => {
                const sub = item.startsWith('  →');
                const text = item.replace(/^  →\s*/,'');
                return `<li style="display:flex;gap:8px;font-size:${sub?.8:.855}rem;color:${sub?'#888':'var(--cor-texto)'};padding-left:${sub?14:0}px;">
                  <span style="margin-top:3px;color:${sub?'#bbb':'var(--cor-primaria-dark)'};font-size:.65rem;flex-shrink:0;">${sub?'↳':'▸'}</span>${text}</li>`;
              }).join('')}
            </ul>
          </div>`).join('')}
      </div>`;
  }
};
