// Notas de Versão — atualizado a cada commit
const NotasVersao = {
  versaoAtual: 'V3.26.0.3',

  versoes: [
    {
      "versao": "V1.0.0",
      "legado": "V1.0",
      "status": "fechada",
      "data": "2026-07-04",
      "tipo": "lancamento",
      "titulo": "Lançamento Oficial da Base",
      "itens": [
        "Sistema publicado em produção (Vercel + Firebase)",
        "Identidade visual Absoluta: preto + amarelo #F5C800",
        "Logo oficial, sidebar escura, header com borda amarela",
        "Card especial obra Essence/Zenith com foto",
        "Módulo Obras: criar, listar, editar, excluir",
        "Módulo Configuração da Obra: etapas, pacotes, locais, equipes",
        "Módulo Levantamentos (hub)",
        "Módulo Levantamento de Fachada — calculadora completa",
        "  → Hierarquia: Fachada → Balancim → Vista → Peça",
        "  → m² sem ML, m² com ML, Metro Linear, Vão Fechado",
        "  → Checkbox \"Pode ser ML\" por peça",
        "  → 4 modos de desconto de janela configuráveis",
        "  → Vão fechado por Vista (não por peça)",
        "  → Visão Geral com mapa PNG + caixas posicionáveis",
        "  → Exportação CSV",
        "Módulo Planejamento V1: Gantt, Linha de Balanço, Escadinha, Tabela",
        "Auditoria automática em todas as operações"
      ]
    },
    {
      "versao": "V1.0.1",
      "legado": "V1.0.1",
      "status": "fechada",
      "data": "2026-07-04",
      "tipo": "correcao",
      "titulo": "Correções de autenticação e dados",
      "itens": [
        "firebase-config.js: reutiliza app existente (não chama initializeApp duas vezes)",
        "Fachada: carregar com fallback duplo (sem orderBy → com createdAt)",
        "Fachada: múltiplas fachadas abertas na árvore simultaneamente",
        "Fachada: ✎ inline para renomear fachada/balancim",
        "Fachada: Visão Geral antes do Resumo Geral",
        "Fachada: canvas branco com padding para posicionamento",
        "Fachada: card de total geral na Visão Geral",
        "Obras: editar obra existente funcionando",
        "Router: troca de obra recarrega módulo automaticamente",
        "Notas de Versão: criadas e acessíveis na sidebar"
      ]
    },
    {
      "versao": "V1.0.2",
      "legado": "V1.0.2",
      "status": "fechada",
      "data": "2026-07-04",
      "tipo": "correcao",
      "titulo": "Correção definitiva de autenticação",
      "itens": [
        "auth.js: reescrito do zero — sem timers conflitantes",
        "  → onAuthStateChanged ignora null completamente (Firebase restaurando sessão)",
        "  → Timeout único de 8s só ativa se realmente não houver sessão",
        "  → Resolve definitivamente o bug de usuário sumindo ao navegar",
        "utils.js: initPagina sem timeout próprio — usa apenas o do auth",
        "  → Erros do Firestore (seletor de obras) não bloqueiam a página",
        "  → Usuário nunca é redirecionado por erro de Firestore",
        "Versão atual visível na sidebar (ex: V1.0.2)",
        "Notas de versão bumpeadas a cada commit (V1.0.2)",
        "CRÍTICO fachada: cxVincular não existia → travava o módulo inteiro",
        "  → Corrigido para cxEditar e salvarCxEdit",
        "  → LevantamentoFachada undefined era consequência deste erro",
        "Obras: removidas imagens hardcoded (Essence/Zenith)",
        "Obras: botão Inserir Imagem no modal — cada obra tem sua própria foto",
        "Fachada: toggle Visão Geral agora abre primeiro (antes de Resumo Geral)",
        "Fachada: mapa migra dados de chave antiga (fachadaMap_null) para chave correta",
        "  → Imagem importada volta a aparecer após correção do bug anterior",
        "Mapa (Visão Geral): migrado de localStorage para Firestore",
        "  → Imagem e posições das caixas disponíveis em qualquer dispositivo",
        "  → Carregado junto com os dados da fachada no init()",
        "Layout geral: sidebar fixa em 100vh, usuário sempre visível sem scroll",
        "Visão Geral: layout compacto — topbar, total e mapa cabem na tela",
        "  → Toggle + botões na mesma linha (topbar)",
        "  → Mapa ocupa o espaço restante da tela automaticamente",
        "  → Imagem responsiva dentro da área de mapa",
        "Imagens: migradas de base64/localStorage para Firebase Storage",
        "  → Mapa da Visão Geral: upload para Storage, URL salva no Firestore",
        "  → Imagem de capa das obras: upload para Storage",
        "  → Resolve limite de 1MB do Firestore e persistência entre dispositivos",
        "Mapa: imagem no tamanho natural com scroll — não mais cortada",
        "Imagem: compressão via canvas (sem Firebase Storage) — sem loading infinito",
        "  → Reduz para <900KB antes de salvar no Firestore",
        "  → Qualidade progressiva: 85% → 30% até caber",
        "Visão Geral: sidebar esquerda oculta para maximizar área do mapa",
        "  → Aparece de volta ao entrar no Resumo Geral",
        "Visão Geral: imagem ocupa toda a largura disponível (fit)",
        "Drag das caixas: reescrito com mouse events (mousedown/mousemove/mouseup)",
        "  → Movimento preciso, sem travar, sem voltar ao lugar inicial",
        "  → Considera scroll do wrapper no cálculo de posição"
      ]
    },
    {
      "versao": "V1.0.3",
      "legado": "V1.0.3",
      "status": "fechada",
      "data": "2026-07-04",
      "tipo": "correcao",
      "titulo": "Correções de layout e mapa",
      "itens": [
        "Imagem do mapa: compressão via canvas — sem loading infinito",
        "Imagem do mapa: salva comprimida no Firestore (sem Firebase Storage)",
        "Visão Geral: sidebar esquerda oculta para maximizar área do mapa",
        "Visão Geral: imagem ocupa toda a largura disponível (fit)",
        "Drag das caixas: reescrito com mousedown/mousemove/mouseup",
        "  → Movimento preciso, não volta ao lugar inicial",
        "  → Considera scroll do wrapper no cálculo de posição",
        "Layout geral: sidebar fixa em 100vh, usuário sempre visível",
        "Versão atualizada para V1.0.3 em todos os arquivos"
      ]
    },
    {
      "versao": "V1.0.4",
      "legado": "V1.0.4",
      "status": "fechada",
      "data": "2026-07-04",
      "tipo": "correcao",
      "titulo": "Visão Geral: sidebar, drag e imagem corrigidos",
      "itens": [
        "Sidebar esquerda oculta na Visão Geral — toda a tela para o mapa",
        "  → Grade muda para 1 coluna (sem sidebar)",
        "  → Volta ao normal no Resumo Geral",
        "Drag das caixas reescrito corretamente com mouse events",
        "  → Caixas se movem livremente, não travam, não voltam ao lugar",
        "  → Offset calculado relativo ao mapa-area com scroll do wrapper",
        "Ícone de cadeado: 🔓 aberto (livre) / 🔒 fechado (travado) — visível",
        "Botões da caixa não ativam drag ao clicar (stopPropagation)",
        "Imagem ocupa 100% da largura do mapa com scroll quando maior",
        "pointer-events:none no container, pointer-events:all por caixa"
      ]
    },
    {
      "versao": "V1.0.5",
      "legado": "V1.0.5",
      "status": "fechada",
      "data": "2026-07-04",
      "tipo": "correcao",
      "titulo": "Sidebar, caixas livres e imagem fit",
      "itens": [
        "Sidebar da estrutura: id adicionado ao HTML — agora some de verdade na Visão Geral",
        "Caixas sem limite de posição — movem livremente para qualquer lugar",
        "Imagem do mapa: object-fit contain — cabe na tela sem scroll, sem corte",
        "Save do mapa: log de debug + validação de tamanho antes de salvar",
        "  → Mostra erro claro se imagem ainda for grande demais"
      ]
    },
    {
      "versao": "V1.0.6",
      "legado": "V1.0.6",
      "status": "fechada",
      "data": "2026-07-04",
      "tipo": "correcao",
      "titulo": "Estrutura some + zoom do mapa",
      "itens": [
        "Coluna Estrutura (fachada-tree): agora some de verdade na Visão Geral",
        "  → renderPainel() usa getElementById corretamente",
        "  → Volta ao abrir Resumo Geral",
        "Controles de zoom na Visão Geral: − / % / + / ↺ reset",
        "  → Zoom de 20% a 300% para ajustar a imagem na tela",
        "  → Caixas escalam junto com a imagem",
        "Mapa: overflow auto — scroll só quando zoom > tela"
      ]
    },
    {
      "versao": "V1.0.7",
      "legado": "V1.0.7",
      "status": "fechada",
      "data": "2026-07-04",
      "tipo": "correcao",
      "titulo": "Canvas infinito + redimensionar imagem",
      "itens": [
        "Botão ✎ Tamanho na topbar — abre slider para ajustar largura da imagem",
        "  → Slider de 200px a 3000px em tempo real",
        "  → Caixas permanecem onde estão ao redimensionar",
        "Canvas infinito (2000×1400px mínimo) com fundo pontilhado",
        "  → Caixas podem ficar em qualquer lugar, inclusive fora da imagem",
        "  → Scroll livre para navegar pelo canvas",
        "Imagem posicionada no canto superior esquerdo do canvas",
        "  → Margem de 40px ao redor para posicionar caixas fora da imagem"
      ]
    },
    {
      "versao": "V1.0.8",
      "legado": "V1.0.8",
      "status": "fechada",
      "data": "2026-07-04",
      "tipo": "correcao",
      "titulo": "Imagem arrastável e redimensionável com handles",
      "itens": [
        "Imagem do mapa: drag para mover (arrastar em qualquer direção)",
        "Imagem do mapa: 8 handles amarelos nos cantos e bordas para redimensionar",
        "  → Arrastar canto: resize proporcional",
        "  → Arrastar borda: resize direcional",
        "Imagem cabe na tela ao importar (fit automático)",
        "Canvas sem overflow/scroll — imagem e caixas sempre visíveis",
        "Borda tracejada amarela indica que a imagem é editável"
      ]
    },
    {
      "versao": "V1.0.9",
      "legado": "V1.0.9",
      "status": "fechada",
      "data": "2026-07-04",
      "tipo": "correcao",
      "titulo": "Resize correto, fundo branco, caixas livres, cadeado legível",
      "itens": [
        "Handles de resize: corrigidos — agora redimensiona a imagem corretamente",
        "Caixas: drag corrigido — posição relativa ao canvas (não à area)",
        "Fundo do canvas: branco puro (sem pontinhos)",
        "Cadeado: substituído por texto LIVRE (verde) / TRAV (vermelho)",
        "  → Muito mais legível que emoji de cadeado"
      ]
    },
    {
      "versao": "V1.0.9.1",
      "legado": "V1.1.0",
      "status": "fechada",
      "data": "2026-07-04",
      "tipo": "funcionalidade",
      "titulo": "Resize completo de imagem e caixas na Visão Geral",
      "itens": [
        "Imagem: 8 handles amarelos para redimensionar (4 cantos + 4 bordas)",
        "  → Cantos: resize proporcional (mantém proporção da imagem)",
        "  → Bordas E/W: estica horizontalmente",
        "  → Bordas N/S: estica verticalmente com proporção",
        "Imagem: arrastar para mover livremente no canvas",
        "Imagem: fit automático ao importar (cabe na tela)",
        "Caixas: handle ⤡ no canto inferior direito para redimensionar largura",
        "  → Conteúdo se adapta à largura da caixa",
        "Caixas: ficam sempre em cima da imagem (z-index:20 vs z-index:1)",
        "Canvas: fundo branco puro, sem pontinhos",
        "Lock: LIVRE (verde) / TRAV (vermelho) — legível"
      ]
    },
    {
      "versao": "V1.0.10",
      "legado": "V1.1.1",
      "status": "fechada",
      "data": "2026-07-04",
      "tipo": "correcao",
      "titulo": "Visão Geral: modo edição, imgState no Firestore, resize caixas",
      "itens": [
        "Imagem: botão Editar Imagem ativa modo edição (borda amarela)",
        "Imagem: botão Confirmar salva posição/tamanho no Firestore e trava",
        "  → Imagem não se move/redimensiona fora do modo edição",
        "Imagem: imgState (x,y,w) salvo no Firestore — persiste ao recarregar",
        "Caixas: resize em largura (E) e altura (S) separados",
        "  → Handle ⤡ no canto: resize em diagonal (largura+altura)",
        "  → Barra na base: resize só em altura",
        "Caixas: ficam acima da imagem (z-index:30 vs z-index:1)"
      ]
    },
    {
      "versao": "V1.0.11",
      "legado": "V1.1.2",
      "status": "fechada",
      "data": "2026-07-04",
      "tipo": "correcao",
      "titulo": "Caixas nunca cortadas + imgState persistido",
      "itens": [
        "Caixas: movidas para overlay fora do canvas (overflow:visible)",
        "  → Nunca mais cortadas — podem ir para qualquer lugar da tela",
        "imgState salvo no Firestore — posição e tamanho da imagem persistem",
        "Modo edição: botão confirmar salva e trava imagem",
        "Resize caixas: handle ⤡ para largura+altura simultâneos",
        "Texto das caixas: flex-wrap para refluir ao redimensionar"
      ]
    },
    {
      "versao": "V1.0.12",
      "legado": "V1.1.3",
      "status": "fechada",
      "data": "2026-07-05",
      "tipo": "correcao",
      "titulo": "Auth corrigido, fórmula ML do config, vãos múltiplos",
      "itens": [
        "CRÍTICO: carregar() agora carrega mapaVisao do Firestore novamente",
        "  → Imagem e caixas voltam ao abrir a página",
        "  → Usuário não buga mais ao entrar em fachada",
        "Fórmula ML: usa ml_percentual do config (não mais fixo em 50%)",
        "  → Ex: 100% → ml conta inteiro no equivalente: 6m² + 4ml = 10m²",
        "  → Ex: 50%  → ml conta metade: 6m² + 4ml = 8m²",
        "Vão Fechado por Vista: múltiplos vãos por vista",
        "  → Cada vão tem Comprimento, Altura e Quantidade",
        "  → Botão + Adicionar Vão para incluir mais vãos",
        "  → Total acumulado exibido em tempo real"
      ]
    },
    {
      "versao": "V1.0.13",
      "legado": "V1.1.4",
      "status": "fechada",
      "data": "2026-07-05",
      "tipo": "correcao",
      "titulo": "CRÍTICO: funções perdidas restauradas",
      "itens": [
        "CAUSA RAIZ do bug: reescritas da Visão Geral deletaram funções essenciais",
        "  → importarMapa, cxAdicionar, cxRemover, cxTravar, cxEditar, salvarCxEdit, limparMapa",
        "  → return{} exportava funções inexistentes → IIFE falhava → módulo undefined",
        "  → Usuário bugava porque o módulo não carregava",
        "Todas as funções restauradas e verificadas (47 exportadas, todas existem)",
        "cxTravar e cxEditar agora rerenderizam só as caixas (sem reload do painel inteiro)"
      ]
    },
    {
      "versao": "V1.0.14",
      "legado": "V1.1.5",
      "status": "fechada",
      "data": "2026-07-05",
      "tipo": "correcao",
      "titulo": "Drag das caixas: reescrito simples e direto",
      "itens": [
        "cxMouseDown: usa delta (startX/startY) em vez de getBoundingClientRect do overlay",
        "  → Não depende do overlay existir ou ter posição correta",
        "  → Move exatamente o quanto o mouse se deslocou",
        "  → Salva posição final no Firestore ao soltar"
      ]
    },
    {
      "versao": "V1.0.15",
      "legado": "V1.1.6",
      "status": "fechada",
      "data": "2026-07-05",
      "tipo": "correcao",
      "titulo": "Drag caixas: header é a alça de arrasto",
      "itens": [
        "CAUSA RAIZ do drag não funcionar:",
        "  → onmousedown estava no div pai, mas header tinha stopPropagation",
        "  → Qualquer clique passava pelo header e cancelava o evento",
        "Fix: onmousedown movido para o HEADER (barra amarela)",
        "  → Arrastar pelo header amarelo move a caixa",
        "  → Botões ainda têm stopPropagation para não arrastar ao clicar"
      ]
    },
    {
      "versao": "V1.1.0",
      "legado": "V1.2",
      "status": "fechada",
      "data": "2026-07-05",
      "tipo": "funcionalidade",
      "titulo": "Planejamento funcional + Módulo Materiais",
      "itens": [
        "PLANEJAMENTO — Importar Excel:",
        "  → Aceita .xlsx e .xls (SheetJS via CDN, sem instalação)",
        "  → Detecta colunas em PT e EN automaticamente",
        "  → Importa: Código, Nome, Tipo, Datas, Duração, %, Responsável, Etapa, Pacote, Local",
        "  → Calcula duração automaticamente se tiver datas",
        "  → Trata datas em DD/MM/YYYY, YYYY-MM-DD e serial Excel",
        "PLANEJAMENTO — Exportar Excel:",
        "  → Gera .xlsx com todas as tarefas",
        "  → Inclui aba de Instruções de importação",
        "  → Nome do arquivo inclui obra e data",
        "PLANEJAMENTO — Gantt melhorado:",
        "  → Linha Hoje em amarelo com label",
        "  → Barra executada real (início/término real)",
        "  → Zoom dia/semana/mês/trimestre/ano",
        "MATERIAIS — Novo módulo:",
        "  → Vínculo com tarefas do Planejamento",
        "  → Vínculo com Fachadas do Levantamento",
        "  → Consumo Previsto × Quantidade da tarefa = total calculado",
        "  → Detalhes da tarefa/fachada ao filtrar",
        "  → CRUD completo com tipo, fabricante, unidade"
      ]
    },
    {
      "versao": "V1.1.1",
      "legado": "V1.2.1",
      "status": "fechada",
      "data": "2026-07-05",
      "tipo": "correcao",
      "titulo": "Correções Planejamento e Materiais",
      "itens": [
        "Planejamento: Router.getObraAtiva → Router.getObra (exportar funcionando)",
        "Materiais: removido stub de desenvolvimento",
        "Materiais: modal de cadastro adicionado ao HTML",
        "Materiais: Levantamento Fachada aparece como UMA entrada agregada",
        "  → Agrupa todas as fachadas com m² total e detalhe por fachada",
        "  → Não lista cada fachada separada",
        "Materiais: layout organizado com tabela e filtros no topo"
      ]
    },
    {
      "versao": "V1.1.1.1",
      "legado": "V1.2.2",
      "status": "fechada",
      "data": "2026-07-05",
      "tipo": "funcionalidade",
      "titulo": "Materiais: biblioteca + vínculos por UID",
      "itens": [
        "Estrutura em duas coleções separadas:",
        "  → materiais/ = biblioteca (cada material com UID único)",
        "  → materiais_vinculos/ = vínculo materialId + tarefaId + consumo",
        "Aba Biblioteca: cadastrar materiais com nome, tipo, fabricante, referência",
        "  → Ex: Cimento CP-III Votorantim e Cimento CP-III Cauê são IDs diferentes",
        "  → Coluna mostra em quantas tarefas cada material é usado",
        "Aba Por Tarefa: vincular material da biblioteca a uma tarefa/serviço",
        "  → Busca material pelo nome na biblioteca (não digitação manual)",
        "  → Consumo Previsto × Quantidade da tarefa = total calculado",
        "  → Avisa duplicidade (mesmo material + mesma tarefa)",
        "  → Link rápido para cadastrar na biblioteca se não encontrar"
      ]
    },
    {
      "versao": "V1.1.2",
      "legado": "V1.2.3",
      "status": "fechada",
      "data": "2026-07-05",
      "tipo": "correcao",
      "titulo": "Materiais polido + Excel sem conflito",
      "itens": [
        "Excel exportar: colunas sem acentos (Inicio, Termino, Nivel, Perc Concluido)",
        "  → Importar detecta com ou sem acento, normaliza automaticamente",
        "Materiais: botão ← Por Tarefa na tela de Biblioteca",
        "Materiais: modal único Vincular / Criar com toggle no topo",
        "  → Vincular: busca na biblioteca",
        "  → Criar: formulário inline, salva na biblioteca e vincula de uma vez",
        "Unidade de consumo: sempre no formato X/Y (kg/m², L/m², un/un...)",
        "  → Consumo real herda a mesma unidade (label dinâmico)",
        "  → Dropdown com opções padrão de mercado",
        "Card de tarefa: exibe apenas total (m², un...) sem listar fachadas"
      ]
    },
    {
      "versao": "V1.1.3",
      "legado": "V1.2.4",
      "status": "fechada",
      "data": "2026-07-05",
      "tipo": "correcao",
      "titulo": "Materiais: editar corrigido, embalagem, relatório por balancim",
      "itens": [
        "Editar material na biblioteca: botão funcionando (preenchimento manual)",
        "Material com conversão de embalagem: 1 saco = 20 kg",
        "  → Total exibido em unidade base E em embalagem",
        "  → Ex: 840 kg = 42 sacos de 20 kg",
        "Relatório Fachada: ao filtrar por [Levantamento] Fachada",
        "  → Tabela por material com breakdown por Fachada e por Balancim",
        "  → Total por fachada e total geral em destaque amarelo",
        "  → Mostra total em unidade base e em embalagem se configurado",
        "HTML do modal reconstruído limpo (sem duplicação)",
        "Consumo real: label dinâmico com mesma unidade do previsto"
      ]
    },
    {
      "versao": "V1.1.4",
      "legado": "V1.2.5",
      "status": "fechada",
      "data": "2026-07-05",
      "tipo": "correcao",
      "titulo": "Importar/Exportar Excel: formato exato do modelo",
      "itens": [
        "IMPORTAR: detecta colunas do modelo real (ID, Código, Nome, Duração...)",
        "  → Colunas: ID, Código, Nome, Duração, Início, Término, % Esperado",
        "  → % Concluído, Prececessora, Tarefa Pai, Grupo, Local, Custo, Receita",
        "  → Responsável, Inicio/Termino Linha de Base, Inicio/Termino Desafio",
        "  → Duração no formato Xd (ex: 20d)",
        "  → Datas no formato DD/MM/YYYY",
        "  → Hierarquia detectada por recuo de espaços no nome",
        "IMPORTAR: gravação em lotes de 50 (sem loading infinito)",
        "  → Antes: 2399 awaits sequenciais = travava",
        "  → Agora: Promise.all em lotes = rápido",
        "EXPORTAR: cabeçalho idêntico ao modelo importável",
        "  → Nome com recuo por nível (2 espaços por nível)",
        "  → Datas em DD/MM/YYYY, duração com sufixo d",
        "  → Todas as 19 colunas do modelo"
      ]
    },
    {
      "versao": "V1.2.0",
      "legado": "V1.3",
      "status": "fechada",
      "data": "2026-07-06",
      "tipo": "funcionalidade",
      "titulo": "Planejamento: Gantt tipo MS Project",
      "itens": [
        "Hierarquia: grupos com ▼/▶ para recolher/expandir filhos",
        "Hierarquia: botões ← → na tabela para recuar/avançar nível",
        "Hierarquia: Ctrl++ nova tarefa, Ctrl+- excluir selecionada",
        "Colunas: botão ⚙ Colunas para mostrar/esconder cada coluna",
        "Divisor: barra amarela entre tabela e Gantt é arrastável",
        "Scroll sincronizado: esquerda e direita rolam juntos",
        "Importar: confirma antes de substituir, apaga antigas primeiro",
        "Exportar Gantt: botão 🖼 Gantt PDF gera imagem PNG",
        "Zoom: dia/semana/mês/trimestre/ano com escala correta",
        "Modal tarefa: todos os campos do modelo Excel",
        "Barras de grupo: formato chapéu (MS Project style)",
        "Linha de base e desafio como campos separados"
      ]
    },
    {
      "versao": "V1.2.1",
      "legado": "V1.3.1",
      "status": "fechada",
      "data": "2026-07-06",
      "tipo": "correcao",
      "titulo": "Planejamento: performance + duplicatas + colunas",
      "itens": [
        "PERFORMANCE: renderização virtual — só linhas visíveis no viewport",
        "  → 2400 tarefas sem travar (antes renderizava tudo de uma vez)",
        "  → Scroll sincronizado esquerda/direita",
        "Coluna # (número da linha) sempre visível",
        "Coluna Predecessora visível",
        "Esconder coluna: clique no ▼ no header da própria coluna",
        "  → Botão \"Mostrar colunas\" aparece quando alguma está oculta",
        "Import: evita duplicatas (chave código+nome)",
        "  → Limpa tudo antes de importar",
        "Inserir tarefa: herda nível/grupo da selecionada, empurra as demais",
        "Ctrl++ insere, Ctrl+- exclui selecionada",
        "Divisor amarelo arrastável entre tabela e Gantt"
      ]
    },
    {
      "versao": "V1.2.2",
      "legado": "V1.3.2",
      "status": "fechada",
      "data": "2026-07-06",
      "tipo": "correcao",
      "titulo": "Planejamento: colunas, import, hierarquia, zoom",
      "itens": [
        "Colunas: nomes completos (Duração, % Esperado, % Concluído, Predecessora)",
        "Colunas: clique DIREITO no header para esconder (menos sensível)",
        "Colunas: mostrar individual — popup lista apenas as ocultas",
        "Colunas: arrastar borda direita do header para redimensionar largura",
        "Import: removida deduplicação — todas as linhas são importadas",
        "  → Suporte a 10.000+ linhas (lotes de 200)",
        "  → Linhas com mesmo nome mas níveis diferentes são mantidas",
        "Hierarquia ← →: move a tarefa E todos os filhos abaixo dela",
        "  → Igual MS Project: outdent/indent puxa a família inteira",
        "Zoom: escala correta dia/semana/mês/trimestre/ano"
      ]
    },
    {
      "versao": "V1.2.3",
      "legado": "V1.3.3",
      "status": "fechada",
      "data": "2026-07-06",
      "tipo": "correcao",
      "titulo": "Planejamento: ← → no Gantt, zoom correto, esconder Gantt",
      "itens": [
        "Aba Tabela removida — tudo feito pelo Gantt",
        "Botões ← → de hierarquia agora no Gantt (coluna Ações)",
        "  → Recuar/avançar move tarefa + todos os filhos abaixo",
        "Botão Esconder Gantt: esconde as barras e deixa só a tabela",
        "  → Toggle: clica de novo para mostrar o Gantt",
        "Zoom headers corrigidos:",
        "  → Dia: mostra cada dia individualmente",
        "  → Semana: linhas verticais por semana com número do dia",
        "  → Mês: label por mês com ano",
        "  → Trimestre: T1/T2/T3/T4 com ano",
        "  → Ano: só o número do ano",
        "Coluna Ações alargada (64px) para caber ← → ✎"
      ]
    },
    {
      "versao": "V2.0.0",
      "legado": "V2.0",
      "status": "fechada",
      "data": "2026-07-06",
      "tipo": "funcionalidade",
      "titulo": "Planejamento V2.0 — reescrita completa",
      "itens": [
        "EDIÇÃO INLINE: clique na célula para editar direto (sem modal)",
        "  → Enter salva, Escape cancela, Tab avança",
        "  → Funciona para todos os campos editáveis",
        "COLUNA NÍVEL: mostra o nível hierárquico de cada tarefa",
        "HIERARQUIA ← →: move tarefa + todos os filhos abaixo",
        "  → Update em paralelo para performance",
        "  → Atualiza dados locais antes de recarregar",
        "COLUNAS:",
        "  → Nomes completos sem abreviação",
        "  → Clique DIREITO no header para esconder",
        "  → Mostrar: popup lista ocultas individualmente",
        "  → Arrastar borda direita do header para redimensionar",
        "  → Arrastar header para reordenar (drag and drop)",
        "  → Reorder não afeta importar/exportar Excel",
        "TOGGLE GANTT: 1 clique para esconder/mostrar",
        "  → Tabela ocupa tela toda quando Gantt oculto",
        "  → Não reaparece ao scrollar",
        "ZOOM CORRETO:",
        "  → Dia: cada dia individualmente",
        "  → Semana: linhas por semana",
        "  → Mês: label por mês",
        "  → Trimestre: T1/T2/T3/T4",
        "  → Ano: só número do ano",
        "EXPORTAR PNG: gera imagem completa do Gantt",
        "  → Expande temporariamente para capturar tudo",
        "IMPORT: sem deduplicação, lotes de 200, limpa antes",
        "PERFORMANCE: virtual scroll + requestAnimationFrame"
      ]
    },
    {
      "versao": "V2.0.1",
      "legado": "V2.0.1",
      "status": "fechada",
      "data": "2026-07-06",
      "tipo": "correcao",
      "titulo": "Gantt corrigido, hierarquia funcional, nível por código",
      "itens": [
        "Gantt: barras voltaram — linha Hoje usa getElementById (não querySelector)",
        "  → querySelector encontrava barras de grupo e corrompia o HTML",
        "Hierarquia ← →: atualiza dados LOCALMENTE primeiro (sem esperar Firestore)",
        "  → Feedback visual imediato ao clicar",
        "  → Salva no Firestore em background em lotes de 20",
        "  → Mostra erro se tarefa já está no nível mínimo (0)",
        "Nível importado pelo CÓDIGO: 1=nível 0, 1.1=nível 1, 1.1.1=nível 2",
        "  → Antes usava espaços no nome (impreciso)",
        "  → Agora conta pontos no código = nível"
      ]
    },
    {
      "versao": "V2.0.2",
      "legado": "V2.0.2",
      "status": "fechada",
      "data": "2026-07-06",
      "tipo": "correcao",
      "titulo": "Gantt restaurado, hierarquia por nível, famílias",
      "itens": [
        "GANTT BARRAS: corrigido width:440% → width:440px no painel esquerdo",
        "  → Painel esquerdo ocupava 440% da tela, empurrando Gantt pra fora",
        "FAMÍLIAS por nível: ▼/▶ funciona baseado no NÍVEL hierárquico",
        "  → Recolher grupo esconde tudo abaixo com nível maior",
        "  → Detecta filhos pela próxima tarefa na ordem ter nível maior",
        "  → Não depende mais do campo tarefaPai",
        "NÍVEL NO IMPORT: conta pontos no código (1.3.1.1 = nível 3)",
        "  → PRECISA REIMPORTAR o Excel para corrigir os níveis",
        "← → HIERARQUIA: atualiza local primeiro (resposta imediata)",
        "  → Salva no Firestore em background"
      ]
    },
    {
      "versao": "V2.0.3",
      "legado": "V2.0.3",
      "status": "fechada",
      "data": "2026-07-06",
      "tipo": "correcao",
      "titulo": "Divisor livre, nível por spinner, datas automáticas, predecessora",
      "itens": [
        "DIVISOR: arrasta de 60px até quase o final da tela (sem limite rígido)",
        "NÍVEL: spinner funciona — change event dispara save automaticamente",
        "  → Ao mudar nível, filhos são movidos junto (MS Project)",
        "DATAS AUTOMÁTICAS (3 modos):",
        "  → Início + Fim → calcula Duração",
        "  → Início + Duração → calcula Fim",
        "  → Predecessora → calcula Início e Fim",
        "PREDECESSORA tipo MS Project:",
        "  → Formato: código + tipo (ex: 3TI, 1.2II, 5TT)",
        "  → TI = Término-Início (default): começa após a predecessora",
        "  → II = Início-Início: começa junto com a predecessora",
        "  → TT = Término-Término: termina junto com a predecessora",
        "  → Defasagem: 3TI+2 = 2 dias após término da tarefa 3",
        "RESIZE COLUNAS: arrasta borda direita do header"
      ]
    },
    {
      "versao": "V2.0.4",
      "legado": "V2.0.4",
      "status": "fechada",
      "data": "2026-07-06",
      "tipo": "correcao",
      "titulo": "Colunas resize/reorder, predecessora popup, esconder coluna",
      "itens": [
        "RESIZE COLUNAS: handle visível (amarelo ao hover) na borda direita do header",
        "  → Arrasta para redimensionar, cursor muda para col-resize",
        "  → Re-renderiza ao soltar para consistência",
        "REORDENAR COLUNAS: drag and drop nos headers",
        "  → Borda amarela indica onde vai cair",
        "  → Não afeta exportar/importar Excel",
        "ESCONDER COLUNA: clique direito no header (restaurado)",
        "  → Botão + Colunas aparece quando há ocultas",
        "PREDECESSORA — duplo clique abre popup:",
        "  → Campo de código com preview da tarefa em tempo real",
        "  → Seletor TI/II/TT/IT com descrição",
        "  → Campo de defasagem em dias",
        "  → Mostra nome, datas da predecessora",
        "  → Botão Limpar para remover predecessora",
        "PREDECESSORA — clique simples: edita o código inline"
      ]
    },
    {
      "versao": "V2.0.5",
      "legado": "V2.0.5",
      "status": "fechada",
      "data": "2026-07-06",
      "tipo": "correcao",
      "titulo": "Resize/reorder colunas corrigidos, predecessora popup, PNG intervalo",
      "itens": [
        "RESIZE COLUNAS: overlay invisível durante arrasto (sem conflito com drag)",
        "  → Desativa draggable dos headers enquanto resize",
        "  → Cursor col-resize no corpo inteiro durante arrasto",
        "REORDENAR COLUNAS: drag & drop com dataTransfer",
        "  → Coluna arrastada fica translúcida",
        "  → Borda amarela no destino",
        "  → Funciona com todas as colunas não-fixas",
        "PREDECESSORA: clique abre popup direto (sem inline)",
        "  → Código azul sublinhado indica que é clicável",
        "  → Popup com preview, tipo TI/II/TT/IT, defasagem",
        "PNG: popup pede intervalo (início/fim)",
        "  → Datas pré-preenchidas com período do projeto",
        "  → Gera PNG completo no intervalo selecionado"
      ]
    },
    {
      "versao": "V2.0.6",
      "legado": "V2.0.6",
      "status": "fechada",
      "data": "2026-07-06",
      "tipo": "correcao",
      "titulo": "Resize colunas, reordenar, predecessora, PNG corrigidos",
      "itens": [
        "RESIZE COLUNAS: overlay + linha guia amarela",
        "  → Removido HTML5 drag API (conflitava com resize)",
        "  → Handle na borda direita fica amarelo ao hover",
        "  → Overlay captura mouse, linha guia mostra posição",
        "REORDENAR COLUNAS: via menu (clique direito no header)",
        "  → Opções: ◀ Mover esquerda, Mover direita ▶, ✕ Esconder",
        "  → Removido drag&drop que não funcionava",
        "PREDECESSORA: console.log adicionado para debug",
        "  → Clique abre popup com preview em tempo real",
        "PNG: scale reduzido para 1x e altura limitada a 8000px",
        "  → Evita arquivo corrompido por canvas muito grande"
      ]
    },
    {
      "versao": "V2.0.7",
      "legado": "V2.0.7",
      "status": "fechada",
      "data": "2026-07-06",
      "tipo": "correcao",
      "titulo": "CRÍTICO: funções faltando no return corrigidas",
      "itens": [
        "insertTarefa removido (alias duplicado de inserirTarefa)",
        "_hideCol adicionada como função standalone",
        "  → Estava referenciada no menu mas não definida",
        "  → IIFE falhava → módulo undefined → usuário bugava",
        "Verificação: todas as 30 funções do return confirmadas"
      ]
    },
    {
      "versao": "V2.0.8",
      "legado": "V2.0.8",
      "status": "fechada",
      "data": "2026-07-06",
      "tipo": "correcao",
      "titulo": "Divisor independente, resize colunas, PNG confiável",
      "itens": [
        "DIVISOR: tabela tem min-width fixo e overflow:hidden",
        "  → Arrastar o divisor CORTA a tabela (não encolhe colunas)",
        "  → Colunas mantêm largura original, conteúdo é clipado",
        "RESIZE COLUNAS: handle de 8px com borda amarela visível ao hover",
        "  → Posição right:-3px para facilitar o clique",
        "  → stopPropagation evita conflito com outros eventos",
        "PNG: captura a tela como está (sem expandir)",
        "  → Usa toBlob em vez de toDataURL (mais confiável)",
        "  → Scale 2x para qualidade boa",
        "  → Sem expandir container (evita canvas gigante corrompido)",
        "30/30 funções do return verificadas"
      ]
    },
    {
      "versao": "V2.0.9",
      "legado": "V2.0.9",
      "status": "fechada",
      "data": "2026-07-07",
      "tipo": "correcao",
      "titulo": "CRÍTICO: _totalColWidth não definida quebrava o módulo",
      "itens": [
        "_totalColWidth era chamada no render mas nunca foi definida",
        "  → ReferenceError quebrava todo o Planejamento",
        "Função adicionada: soma larguras das colunas visíveis",
        "Verificação ampliada: return{} + TODAS as funções chamadas no código",
        "  → 30 funções do return OK, 29 funções internas OK"
      ]
    },
    {
      "versao": "V2.1.0",
      "legado": "V2.1.0",
      "status": "fechada",
      "data": "2026-07-07",
      "tipo": "funcionalidade",
      "titulo": "Módulo Relatórios: \"Relatórios de Vista\" com IA",
      "itens": [
        "Novo módulo Relatórios implementado (antes stub)",
        "Importa PDF de nota (Samsung Notes, digitada ou manuscrita)",
        "  → Nova Vercel Function api/gerar-relatorio.js chama a IA (Claude)",
        "  → Lê o PDF diretamente (sem OCR separado) e devolve JSON estruturado",
        "  → Chave de API fica só no servidor (ANTHROPIC_API_KEY no Vercel)",
        "Relatório salvo no Firestore: obras/{obraId}/relatorios",
        "PDF original arquivado no Firebase Storage",
        "Tela \"Relatórios de Vista\": lista os últimos relatórios em cards",
        "Visualização formatada: título, resumo, seções, pendências",
        "Botão Baixar: gera novo PDF formatado (jsPDF) e também arquiva no Storage",
        "Botão Compartilhar: abre WhatsApp com texto + link do PDF gerado",
        "Botão Excluir: remove do Firestore e do Storage (original + gerado)",
        "10/10 funções do return OK, 8/8 funções internas OK"
      ]
    },
    {
      "versao": "V2.1.1",
      "legado": "V2.1.1",
      "status": "fechada",
      "data": "2026-07-07",
      "tipo": "correcao",
      "titulo": "Relatórios: troca de provedor de IA para API gratuita",
      "itens": [
        "api/gerar-relatorio.js migrada de Anthropic (paga) para Google Gemini",
        "  → Camada gratuita da API (sem custo dentro da cota de uso)",
        "  → Variável de ambiente agora é GEMINI_API_KEY (não usa mais ANTHROPIC_API_KEY)",
        "  → Chave gerada sem cartão em aistudio.google.com/apikey",
        "Modelo usado: gemini-2.5-flash, com responseMimeType JSON nativo",
        "Testado manualmente no AI Studio com nota real — aprovado",
        "Layout do PDF de saída (jsPDF) validado com conteúdo real gerado pela IA"
      ]
    },
    {
      "versao": "V2.1.2",
      "legado": "V2.1.2",
      "status": "fechada",
      "data": "2026-07-07",
      "tipo": "correcao",
      "titulo": "CRÍTICO: relatorios.html não chamava Relatorios.init()",
      "itens": [
        "relatorios.html chamava Utils.initPagina() direto no DOMContentLoaded",
        "  → Relatorios.init() nunca era executado",
        "  → Tela ficava travada no placeholder estático \"Módulo em desenvolvimento\"",
        "Corrigido para chamar Relatorios.init(), igual aos demais módulos"
      ]
    },
    {
      "versao": "V2.1.2.1",
      "legado": "V2.1.3",
      "status": "fechada",
      "data": "2026-07-07",
      "tipo": "funcionalidade",
      "titulo": "Relatórios: fallback automático Gemini → Claude",
      "itens": [
        "api/gerar-relatorio.js agora tenta Gemini primeiro (gratuito)",
        "  → Se falhar (erro, timeout, JSON inválido, bug de billing do Google), cai automaticamente para Anthropic (pago, estável)",
        "  → Precisa de GEMINI_API_KEY e ANTHROPIC_API_KEY configuradas no Vercel",
        "Timeout de 25s (Gemini) e 30s (Anthropic) via AbortController",
        "maxDuration da function ampliado para 60s (tenta os dois provedores em sequência se necessário)",
        "Resposta da API agora inclui \"provedor\" usado (gemini ou anthropic)",
        "relatorios.js: exibe aviso ao usuário quando o fallback pago é usado"
      ]
    },
    {
      "versao": "V2.1.3",
      "legado": "V2.1.4",
      "status": "fechada",
      "data": "2026-07-07",
      "tipo": "correcao",
      "titulo": "Relatórios: link de compartilhar força download do PDF",
      "itens": [
        "PDF gerado agora sobe ao Storage com Content-Disposition: attachment",
        "  → Ao abrir o link no WhatsApp, o PDF baixa em vez de só abrir em visualização inline",
        "Mensagem do WhatsApp deixa explícito \"📥 Baixar relatório (PDF)\" antes do link",
        "Nome do arquivo padronizado (mesmo nome usado no botão Baixar)"
      ]
    },
    {
      "versao": "V2.1.3.1",
      "legado": "V2.1.5",
      "status": "fechada",
      "data": "2026-07-07",
      "tipo": "funcionalidade",
      "titulo": "Relatórios: compartilhar envia o PDF anexado de verdade (no celular)",
      "itens": [
        "compartilharWhatsapp agora tenta Web Share API (navigator.share) com o PDF como File",
        "  → No celular, abre o menu nativo de compartilhar com o arquivo já anexado",
        "  → Escolhendo WhatsApp, o PDF vai anexado de verdade, não como link",
        "Cancelamento do usuário no menu nativo (AbortError) não gera erro/toast",
        "Fallback mantido: desktop ou navegador sem suporte usa o link via wa.me como antes",
        "PDF sempre salvo no Storage independente do método (link de backup)"
      ]
    },
    {
      "versao": "V2.1.4",
      "legado": "V2.1.6",
      "status": "fechada",
      "data": "2026-07-07",
      "tipo": "correcao",
      "titulo": "Relatórios: nome do arquivo baixado/compartilhado padronizado",
      "itens": [
        "Formato: \"Nome da Obra - Planejamento e Andamento - Data do relatório.pdf\"",
        "  → Ex: \"Residencial Essence - Planejamento e Andamento - 17-07-2025.pdf\"",
        "Usa a data extraída pela IA (dataRelatorio) quando disponível, senão a data de criação",
        "Sanitização de caracteres inválidos em nome de arquivo (\\ / : * ? \" < > |)",
        "Mesmo nome usado no botão Baixar, no Compartilhar (share nativo) e no fallback de link"
      ]
    },
    {
      "versao": "V2.1.4.1",
      "legado": "V2.2.0",
      "status": "fechada",
      "data": "2026-07-07",
      "tipo": "funcionalidade",
      "titulo": "Relatórios: compartilhamento direto do Samsung Notes (PWA) + aba Pendentes",
      "itens": [
        "ATENÇÃO: Relatórios migraram de subcoleção por obra (obras/{obraId}/relatorios)",
        "  para coleção raiz \"relatorios\" com campo obraId — relatórios de teste antigos",
        "  criados antes desta versão não aparecem mais (não foram migrados)",
        "database.js: novos helpers genéricos para coleções de nível raiz",
        "  (listarRaiz, obterRaiz, criarRaiz, atualizarRaiz, deletarRaiz, queryRaiz, novoIdRaiz)",
        "manifest.json novo: site agora é instalável como PWA, com share_target",
        "  → aceita receber arquivo PDF compartilhado por outros apps (Samsung Notes)",
        "service-worker.js novo: intercepta o POST do compartilhamento, guarda o PDF",
        "  temporariamente no IndexedDB e redireciona para share-target.html",
        "share-target.html + js/share-target.js novos: recebem o PDF, chamam a IA",
        "  (mesmo endpoint /api/gerar-relatorio) e salvam como relatório PENDENTE (obraId: null)",
        "vercel.json novo: rewrite de /share-target/ para /share-target.html",
        "Ícones do PWA gerados a partir do logo existente (icons/icon-192.png, icon-512.png)",
        "utils.js: registra manifest + service worker automaticamente em toda página autenticada",
        "relatorios.js: nova estrutura com abas \"Desta Obra\" e \"Pendentes\"",
        "  → Pendentes lista relatórios sem obraId, com dropdown pra atribuir à obra certa",
        "  → Ao atribuir, só atualiza o campo obraId (arquivo já processado, sem reprocessar)",
        "relatorios.html?aba=pendentes abre direto na aba Pendentes (usado pelo botão pós-compartilhamento)",
        "12/12 funções do return OK (relatorios.js), verificado manualmente (comentários no",
        "  return{} do database.js geraram falso positivo no script automático de checagem)"
      ]
    },
    {
      "versao": "V2.1.5",
      "legado": "V2.2.1",
      "status": "fechada",
      "data": "2026-07-07",
      "tipo": "correcao",
      "titulo": "CRÍTICO: drag travado (Pointer Capture) — Planejamento e Fachada",
      "itens": [
        "CAUSA RAIZ identificada: arrastar (resize de coluna, divisor, caixas",
        "  da Visão Geral, mover/redimensionar imagem) usava mousemove/mouseup",
        "  no document. Se o botão do mouse era solto FORA da janela do",
        "  navegador (comum com trackpad/monitor externo), o evento de",
        "  soltura nunca chegava — o listener ficava \"vivo\" para sempre,",
        "  reagindo a qualquer movimento de mouse na página depois.",
        "  Isso explica: caixas da fachada \"enlouquecendo\", imagem travada",
        "  sem conseguir confirmar posição, e o Planejamento parecendo",
        "  travar/sumir (um overlay invisível de tela cheia ficava preso",
        "  bloqueando cliques em tudo, inclusive a barra lateral).",
        "",
        "CORREÇÃO: todos os arrastos agora usam Pointer Capture",
        "  (setPointerCapture/releasePointerCapture), que garante que o",
        "  evento de soltura SEMPRE chega ao elemento correto, não importa",
        "  onde o mouse for solto. Aplicado em:",
        "  → Planejamento: resize de coluna, divisor tabela/Gantt",
        "  → Fachada: arrastar caixa, redimensionar caixa, arrastar imagem,",
        "    redimensionar imagem",
        "Removido overlay de tela cheia do resize de coluna (não é mais",
        "  necessário — Pointer Capture dispensa essa técnica)",
        "Botões dentro do header das caixas (Travar/Editar/Remover) agora",
        "  bloqueiam a propagação corretamente (estavam usando mousedown",
        "  enquanto o arrasto passou a escutar pointerdown — clique neles",
        "  também iniciava um arrasto por engano)"
      ]
    },
    {
      "versao": "V2.1.6",
      "legado": "V2.2.2",
      "status": "fechada",
      "data": "2026-07-07",
      "tipo": "correcao",
      "titulo": "CRÍTICO: Service Worker com escopo raiz travava troca de módulo",
      "itens": [
        "CAUSA RAIZ: o service worker do compartilhamento (Samsung Notes)",
        "  era registrado com escopo raiz (\"/\"), passando a controlar TODA",
        "  a navegação do site — literalmente toda troca de módulo (cada",
        "  link da sidebar) passava a ser interceptada por ele.",
        "",
        "CORREÇÃO: service worker agora registrado com escopo restrito a",
        "  /share-target/ (única rota que ele realmente precisa controlar,",
        "  usada pelo compartilhamento do Android). A navegação normal",
        "  entre módulos deixa de passar por ele.",
        "",
        "LIMPEZA AUTOMÁTICA: navegadores que já tinham o service worker",
        "  antigo (escopo raiz) registrado de antes desta correção têm",
        "  esse registro antigo removido automaticamente no próximo",
        "  carregamento de qualquer página — não precisa limpar cache",
        "  manualmente."
      ]
    },
    {
      "versao": "V2.1.7",
      "legado": "V2.2.8",
      "status": "fechada",
      "data": "2026-07-07",
      "tipo": "correcao",
      "titulo": "PNG do Gantt: renderiza o Gantt completo no intervalo, não mais print da tela",
      "itens": [
        "CORRIGIDO: o botão PNG estava tirando um \"print\" da área visível",
        "  na tela (html2canvas na viewport atual) — o intervalo de datas",
        "  escolhido no popup nem era usado no cálculo.",
        "",
        "NOVO COMPORTAMENTO: monta um Gantt completo à parte (fora da",
        "  tela, sem paginação/scroll virtual) com TODAS as tarefas",
        "  visíveis (respeitando famílias recolhidas), com a linha do",
        "  tempo cortada exatamente no intervalo início/fim solicitado.",
        "  Só depois disso tira o PNG — do Gantt inteiro, não da tela.",
        "Barras fora do intervalo não aparecem; barras que cruzam a",
        "  borda do intervalo aparecem cortadas corretamente.",
        "Nome do arquivo agora inclui o intervalo: gantt_INICIO_a_FIM.png",
        "Proteção: avisa e cancela se o intervalo + zoom gerariam uma",
        "  imagem grande demais (reduzir período ou usar zoom Mês/Trimestre)."
      ]
    },
    {
      "versao": "V2.1.8",
      "legado": "V2.2.9",
      "status": "fechada",
      "data": "2026-07-07",
      "tipo": "correcao",
      "titulo": "CRÍTICO: PNG do Gantt sempre pedia intervalo mesmo já selecionado",
      "itens": [
        "CAUSA: o popup de datas era removido do DOM ANTES de ler os",
        "  valores dos campos início/fim. Como os campos são filhos do",
        "  popup, remover primeiro apaga os valores — a leitura seguinte",
        "  sempre retornava vazio, disparando \"Selecione o intervalo\"",
        "  mesmo com as datas corretamente preenchidas na tela.",
        "CORREÇÃO: os valores agora são lidos ANTES de remover o popup."
      ]
    },
    {
      "versao": "V2.1.9",
      "legado": "V2.3.0",
      "status": "fechada",
      "data": "2026-07-07",
      "tipo": "correcao",
      "titulo": "PNG do Gantt: escala automática — agora exporta anos inteiros sem travar",
      "itens": [
        "CAUSA: a largura da imagem usava o zoom atual DA TELA (ex: Dia,",
        "  32px/dia). Pedir 3 anos nesse zoom geraria ~35.000px de",
        "  largura — daí o aviso de \"intervalo grande demais\".",
        "",
        "CORREÇÃO: a escala do PNG agora é escolhida automaticamente pelo",
        "  TAMANHO DO INTERVALO pedido, independente do zoom da tela:",
        "  → até 60 dias: zoom Dia",
        "  → até 240 dias: zoom Semana",
        "  → até 900 dias: zoom Mês",
        "  → até ~7 anos (2500 dias): zoom Trimestre",
        "  → períodos maiores: zoom Ano",
        "3 anos agora gera ~1300px de largura (zoom Trimestre) — rápido",
        "  e sem travar.",
        "Escala de captura (nitidez) também se ajusta automaticamente:",
        "  usa alta resolução quando cabe, reduz sozinha se a lista de",
        "  tarefas visíveis for muito grande.",
        "Aviso de erro agora diz o motivo real quando algo não cabe",
        "  (muitas tarefas visíveis vs período extenso), com sugestão",
        "  do que fazer em cada caso.",
        "Popup avisa que a escala da imagem é automática."
      ]
    },
    {
      "versao": "V2.1.9.1",
      "legado": "V2.3.1",
      "status": "fechada",
      "data": "2026-07-07",
      "tipo": "funcionalidade",
      "titulo": "PNG do Gantt: paginação automática — captura TODAS as linhas (2500+)",
      "itens": [
        "PROBLEMA: uma imagem só com 2500 tarefas ficaria altíssima",
        "  (~75.000px), acima do que qualquer navegador aguenta — travava",
        "  ou corrompia o arquivo.",
        "",
        "SOLUÇÃO: paginação automática. Se as tarefas não couberem numa",
        "  imagem só (limite seguro de altura), o sistema gera VÁRIAS",
        "  imagens em sequência — cada uma com o mesmo cabeçalho de",
        "  colunas e o mesmo período de datas, cobrindo um bloco de",
        "  linhas por vez, até cobrir TODAS as tarefas.",
        "  → Ex: 2500 tarefas → 10 páginas de ~266 linhas cada",
        "  → Cada arquivo nomeado: gantt_INICIO_a_FIM_pagina_01_de_10.png",
        "  → Cada página numerada no canto (Página X de Y — linhas A–B)",
        "Toast de progresso mostra qual página está sendo gerada",
        "Pequena pausa entre downloads para o navegador não bloquear",
        "  múltiplos arquivos automáticos de uma vez",
        "Casos pequenos (cabem numa imagem só) continuam gerando um",
        "  único arquivo, sem sufixo de página — sem mudança de",
        "  comportamento pro caso comum"
      ]
    },
    {
      "versao": "V2.2.0",
      "legado": "V2.4.0",
      "status": "fechada",
      "data": "2026-07-07",
      "tipo": "funcionalidade",
      "titulo": "Novo módulo: Levantamento de Ar Condicionado / Hidráulica",
      "itens": [
        "Novo módulo dentro de Levantamentos: Ar Condicionado / Hidráulica",
        "Estrutura de Áreas configurável e editável (adicionar, renomear,",
        "  excluir área e subárea/local) — começa com \"Área Comum\" e",
        "  \"Torre (Apartamentos)\", mas totalmente livre para o usuário",
        "  reorganizar (ex: subdividir Área Comum por pavimento/local)",
        "Adicionar item ao levantamento tem 2 modos:",
        "  → Buscar da biblioteca: busca por nome com tolerância a",
        "    erro de digitação, filtrando materiais tipo \"Ar",
        "    Condicionado\" ou \"Hidráulica\"",
        "  → Criar novo material: cria direto na biblioteca de",
        "    Materiais e já usa no levantamento na mesma operação",
        "Novos tipos \"Ar Condicionado\" e \"Hidráulica\" adicionados à",
        "  biblioteca de Materiais (cadastro e criação rápida)",
        "Visão Geral consolida o total por material somando todas as",
        "  áreas — base para futura vinculação com tarefas do",
        "  Planejamento (cálculo de valor/consumo por dia no cronograma)"
      ]
    },
    {
      "versao": "V2.2.1",
      "legado": "V2.4.1",
      "status": "fechada",
      "data": "2026-07-07",
      "tipo": "correcao",
      "titulo": "Levantamento de Ar Condicionado: busca de material mais clara",
      "itens": [
        "Campo \"Buscar da biblioteca\" ganha foco automático ao abrir o",
        "  modal e ao trocar de aba",
        "Nome do material destaca (highlight) o trecho que bateu com o",
        "  termo buscado, deixando visível a aproximação por nome"
      ]
    },
    {
      "versao": "V2.3.0",
      "legado": "V2.5.0",
      "status": "fechada",
      "data": "2026-07-07",
      "tipo": "funcionalidade",
      "titulo": "Módulos Semanal/Diário e Medições implementados",
      "itens": [
        "SEMANAL/DIÁRIO — módulo completo, alimentado pelo Planejamento:",
        "  Modos Semana (dom-sáb) e Dia, com navegação ‹ › e botão \"hoje\"",
        "  Mostra tarefas planejadas para o período + atrasadas (término",
        "  vencido e % < 100), com status Atual/Atrasada/Adicionada/Omitida",
        "  Colunas: Início, Término, Esperado (calculado pela data),",
        "  Progresso, Local, Grupo, Início/Término Real, Responsável e",
        "  grade de dias com marcação amarela dos dias planejados",
        "  Lançar Progresso grava no % Concluído do Planejamento e",
        "  atualiza Início Real (1º avanço) e Término Real (100%)",
        "  Início planejado editável apenas para tarefa não iniciada",
        "  (recalcula o término pela duração)",
        "  Adicionar tarefas externas ao período (modal com árvore + busca)",
        "  Omitir tarefas com motivo obrigatório (15 opções) + detalhamento;",
        "  vista Omitidas com restauração",
        "  Seleção múltipla: barra flutuante com Datas, Responsável e Omitir",
        "  Iniciar período (baseline do avanço) e Fechar relatório:",
        "  tarefas abaixo do esperado exigem justificativa (motivo ou",
        "  observação); relatório salvo com % do período real/esperado,",
        "  % total atual/esperado da obra e PPC",
        "  Dashboard com cards do período e histórico de fechamentos",
        "MEDIÇÕES — módulo funcional:",
        "  Nova Medição: árvore completa do cronograma com recolher/expandir,",
        "  Esperado/Real por grupo (média ponderada por duração) e por tarefa",
        "  Modal de lançamento: progresso (−/＋/＝100), Início/Fim Real e",
        "  fotos (comprimidas e enviadas ao Storage)",
        "  Chips de % Total, % Medição (avanço da sessão) e % Esperado hoje",
        "  Salvar grava os % no Planejamento e registra a sessão em",
        "  obras/{id}/medicoes; lista de medições com detalhes e exclusão",
        "Novos campos nas tarefas: inicioReal e terminoReal"
      ]
    },
    {
      "versao": "V2.3.1",
      "legado": "V2.5.1",
      "status": "fechada",
      "data": "2026-07-08",
      "tipo": "correcao",
      "titulo": "Semanal: robustez no fechamento de relatório",
      "itens": [
        "Correção de erro potencial ao destacar tarefa sem justificativa",
        "  no modal de fechamento (proteção para navegadores/WebViews",
        "  sem suporte a scrollIntoView)",
        "Módulos Semanal e Medições validados com bateria de 124 testes",
        "  funcionais automatizados simulando o uso real (lançamentos,",
        "  omissões, adições, fechamentos, medições e casos extremos)"
      ]
    },
    {
      "versao": "V2.4.0",
      "legado": "V2.6.0",
      "status": "fechada",
      "data": "2026-07-08",
      "tipo": "funcionalidade",
      "titulo": "Novo módulo: Mão de Obra (Custos)",
      "itens": [
        "Novo módulo Mão de Obra dentro da seção Custos",
        "Biblioteca de mão de obra: nome e categoria (Pedreiro, Servente,",
        "  Empreiteira, etc.), reutilizável entre tarefas",
        "Vínculo por tarefa: valor unitário + unidade do valor (m², m, un,",
        "  vb, h, diária, mês) vinculado a uma tarefa do Planejamento",
        "Cálculo automático do custo total (valor unitário × quantidade",
        "  da tarefa), exibido por vínculo e como total geral/por serviço",
        "Modo \"Vincular / Criar nova\" no mesmo modal, igual ao módulo",
        "  Materiais, para agilizar o cadastro",
        "Adicionado ao menu de permissões (admin com acesso total,",
        "  usuário padrão sem acesso por padrão)"
      ]
    },
    {
      "versao": "V2.4.0.1",
      "legado": "V2.7.0",
      "status": "fechada",
      "data": "2026-07-08",
      "tipo": "funcionalidade",
      "titulo": "Seletor hierárquico de tarefas + Custo Material/Mão de Obra no Planejamento",
      "itens": [
        "SELETOR HIERÁRQUICO (Materiais e Mão de Obra):",
        "  → Antes só apareciam tarefas-folha (grupos ficavam de fora)",
        "  → Agora aparece TODA a hierarquia, com indentação por nível",
        "  → Permite vincular material/mão de obra a um nível maior",
        "    (grupo) ou a um nível menor (tarefa específica)",
        "  → Helper compartilhado: Utils.opcoesTarefaHierarquia()",
        "",
        "PREÇO DO MATERIAL (Materiais):",
        "  → Novo campo \"Preço unitário (R$)\" na biblioteca",
        "  → Nova coluna \"Custo (R$)\" na tabela Por Tarefa",
        "  → Total geral de custo em materiais exibido no topo",
        "",
        "PLANEJAMENTO — 2 colunas novas:",
        "  → \"Custo Material\" e \"Custo M.Obra\", alimentadas",
        "    automaticamente pelos módulos Materiais e Mão de Obra",
        "",
        "REGRA DE DISTRIBUIÇÃO HIERÁRQUICA:",
        "  → Custo vinculado a uma tarefa de nível N é dividido IGUALMENTE",
        "    entre os filhos diretos (nível N+1)",
        "  → Cada filho redistribui a própria parte + o que já tinha entre",
        "    os SEUS filhos, e assim por diante até as folhas",
        "  → O valor exibido em qualquer tarefa = soma de tudo que está",
        "    abaixo dela (uma tarefa-folha soma o que herdou + o que foi",
        "    vinculado direto nela; um grupo soma todos os filhos)",
        "  → Testado com 3 cenários (custo só no pai / pai+filho / só",
        "    folhas) — todos batem com a regra descrita"
      ]
    },
    {
      "versao": "V2.4.1",
      "legado": "V2.7.1",
      "status": "fechada",
      "data": "2026-07-08",
      "tipo": "correcao",
      "titulo": "Tabela do Planejamento: scroll horizontal com arrasto",
      "itens": [
        "Com as novas colunas de custo, a tabela ficou mais larga que a",
        "  área visível — antes não tinha como ver as colunas escondidas",
        "  sem arrastar o divisor até o fim",
        "Agora dá pra rolar a tabela na horizontal: barra de rolagem",
        "  normal OU clique e arraste o conteúdo pro lado (como um mapa)",
        "Cabeçalho das colunas acompanha o scroll horizontal da tabela",
        "Gantt (lado direito) continua fixo, sem ser afetado",
        "Arrastar não dispara seleção/edição de célula por engano"
      ]
    },
    {
      "versao": "V2.4.2",
      "legado": "V2.7.2",
      "status": "fechada",
      "data": "2026-07-08",
      "tipo": "correcao",
      "titulo": "CRÍTICO: scroll horizontal da tabela sequestrava TODOS os cliques",
      "itens": [
        "CAUSA: o scroll-com-arrasto (V2.7.1) capturava o ponteiro",
        "  (setPointerCapture) logo no clique, antes de confirmar que",
        "  era um arrasto de verdade. Isso sequestrava o clique de TUDO",
        "  dentro da tabela: toggle ▼/▶ de famílias, edição de célula,",
        "  botões ← → ✕ — nada respondia mais.",
        "CORREÇÃO: a captura do ponteiro só acontece DEPOIS de confirmar",
        "  movimento real (>4px). Um clique parado nunca ativa a",
        "  captura, então não interfere em nada — toggle, edição e",
        "  botões voltam a funcionar normalmente, e o arrasto horizontal",
        "  continua funcionando quando o movimento é intencional."
      ]
    },
    {
      "versao": "V2.4.2.1",
      "legado": "V2.8.0",
      "status": "fechada",
      "data": "2026-07-08",
      "tipo": "funcionalidade",
      "titulo": "Materiais: busca inteligente para vincular material à tarefa",
      "itens": [
        "Vínculo de material à tarefa: os antigos menus <select> de",
        "  \"Material\" e \"Serviço/Tarefa\" foram substituídos por campos",
        "  de busca com resultado mais próximo (fuzzy, tolera erro de",
        "  digitação), igual ao padrão já usado no Levantamento de Ar",
        "  Condicionado.",
        "Busca de tarefa mantém a hierarquia do Planejamento: Nível 1,",
        "  depois seus Níveis 2, e assim por diante — permite vincular",
        "  material tanto numa tarefa-mãe quanto numa tarefa-filha.",
        "Modo \"+ Criar novo material\": ao digitar o nome, o sistema",
        "  mostra materiais parecidos já cadastrados na biblioteca",
        "  (mesma busca fuzzy) para evitar duplicidade — um clique usa",
        "  o material existente em vez de criar outro.",
        "Custo unitário do material (campo já existente na Biblioteca)",
        "  continua gerando automaticamente o custo total de cada",
        "  vínculo material↔tarefa, exibido na aba \"Por Tarefa\"."
      ]
    },
    {
      "versao": "V2.4.2.2",
      "legado": "V2.8.1",
      "status": "fechada",
      "data": "2026-07-08",
      "tipo": "funcionalidade",
      "titulo": "Mão de Obra: busca hierárquica para vincular tarefa",
      "itens": [
        "Vínculo de mão de obra à tarefa: o antigo <select> de",
        "  \"Serviço/Tarefa\" foi substituído por busca com resultado mais",
        "  próximo do que é digitado (fuzzy, tolera erro de digitação),",
        "  no mesmo padrão adotado em Materiais.",
        "Busca mantém a hierarquia do Planejamento: Nível 1, depois seus",
        "  Níveis 2, e assim por diante — permite vincular mão de obra",
        "  tanto a um nível maior (grupo/etapa) quanto a um nível menor",
        "  (tarefa folha).",
        "Válido tanto para vincular uma mão de obra já existente na",
        "  biblioteca quanto para criar uma nova na hora.",
        "Reaproveita o helper compartilhado Utils.opcoesTarefaHierarquia,",
        "  mesmo já usado no módulo Materiais, para manter os dois",
        "  módulos consistentes."
      ]
    },
    {
      "versao": "V2.4.2.3",
      "legado": "V2.8.2",
      "status": "fechada",
      "data": "2026-07-08",
      "tipo": "funcionalidade",
      "titulo": "Planejamento: reordenar linha por arrasto + cor por nível",
      "itens": [
        "REORDENAR POR ARRASTO: Ctrl + botão direito + arrastar move a",
        "  tarefa (e os filhos diretos dela, se houver) pra cima ou pra",
        "  baixo na lista, encaixando antes/depois de onde soltar",
        "  → Resolve o problema de vincular um nível 4 ao nível 3 errado",
        "    quando há vários grupos do mesmo nível em sequência",
        "  → Linha some parcialmente (fica translúcida) durante o arrasto",
        "  → Barra amarela indica onde vai encaixar (antes/depois da linha)",
        "  → Local-first: tela atualiza na hora, salva no Firestore atrás",
        "",
        "COR POR NÍVEL: badge colorido na coluna Nível (cores diferentes",
        "  por nível, cíclico), ajuda a identificar rapidamente a que",
        "  grupo uma tarefa pertence mesmo com vários níveis iguais",
        "  em sequência",
        "Indentação da coluna Tarefa aumentada (14px → 20px por nível)",
        "  + linha guia vertical sutil marcando a profundidade"
      ]
    },
    {
      "versao": "V2.4.2.4",
      "legado": "V2.8.3",
      "status": "fechada",
      "data": "2026-07-08",
      "tipo": "funcionalidade",
      "titulo": "Mão de Obra: exportar planilha com nome da obra em destaque",
      "itens": [
        "Novo botão \"📤 Exportar\" no módulo Mão de Obra, gera arquivo",
        "  .xlsx (mesma biblioteca já usada em Planejamento)",
        "Nome da obra em letra grande, mesclado no topo da planilha,",
        "  antes da tabela em si — seguido de um subtítulo com a aba",
        "  exportada (Biblioteca ou Por Tarefa) e a data da exportação",
        "Aba \"Por Tarefa\": exporta Mão de Obra, Categoria, Serviço/Tarefa,",
        "  Valor Unit., Unidade, Quantidade da Tarefa e Custo Total, com",
        "  linha de TOTAL GERAL ao final (respeita o filtro de tarefa",
        "  ativo, se houver)",
        "Aba \"Biblioteca\": exporta Mão de Obra, Categoria, Observações",
        "  e número de vínculos de cada uma"
      ]
    },
    {
      "versao": "V2.4.2.5",
      "legado": "V2.9.0",
      "status": "fechada",
      "data": "2026-07-09",
      "tipo": "funcionalidade",
      "titulo": "Seleção múltipla com barra de ações + coluna de status com filtro",
      "itens": [
        "COLUNA DE STATUS (bolinha colorida) — 5 estados:",
        "  → Atrasado (vermelho), Alerta (laranja, vence em até 7 dias),",
        "    Em Andamento (amarelo), Em Dia (azul), Concluído (verde)",
        "  → Ícone ▼ no cabeçalho abre popup para filtrar por status",
        "  → Cores das barras do Gantt atualizadas para bater com o status",
        "",
        "SELEÇÃO MÚLTIPLA (checkbox):",
        "  → Nova coluna de checkbox na tabela",
        "  → Ao marcar 1+ tarefas, aparece barra flutuante no rodapé",
        "  → Ações em massa: ← Recuar nível, → Avançar nível,",
        "    ⧉ Duplicar, ✕ Excluir — aplicadas a todas as selecionadas",
        "  → Recuar/Avançar em massa muda só as tarefas marcadas",
        "    (não arrasta filhos junto, diferente do botão individual —",
        "    aqui você escolhe exatamente quais linhas quer mudar)",
        "",
        "CORREÇÃO: reordenar coluna por arrastar (HTML5 drag) estava",
        "  quebrada — referenciava funções que não existiam mais",
        "  (_colDragStart/_colDrop). Substituída pelo menu de clique",
        "  direito que já funcionava (mover esquerda/direita/esconder)."
      ]
    },
    {
      "versao": "V2.4.2.6",
      "legado": "V2.10.0",
      "status": "fechada",
      "data": "2026-07-09",
      "tipo": "funcionalidade",
      "titulo": "Semanal: nova aba Diário — lançamento rápido de campo + relatório do dia",
      "itens": [
        "NOVA ABA \"DIÁRIO\" no módulo Semanal — pensada pra ser rápida",
        "  no dia a dia da obra:",
        "  → Busca de tarefa por código ou nome (fuzzy, tolerante a erro",
        "    de digitação, hierárquica — mesmo padrão de Materiais/MO)",
        "  → Campo \"o que está sendo feito\" + 3 situações:",
        "    ✅ Executado · ◐ Parcial · ✖ Não executado",
        "  → Parcial/Não executado pedem o motivo (mesma lista de",
        "    motivos do fechamento semanal) + detalhe opcional",
        "  → Após lançar, o formulário limpa e volta o foco pra busca —",
        "    lançamentos em sequência sem pegar no mouse",
        "  → Lançamentos do dia listados por situação, com editar/excluir",
        "  → Navegação por dia (‹ › · hoje · seletor de data)",
        "",
        "RELATÓRIO DO DIA (botão 📄):",
        "  → ✅ Executado / ◐ Parcial / ✖ Não executado (com motivos)",
        "  → ⚠️ Deveria estar em execução: tarefas previstas no",
        "    Planejamento para o dia (início ≤ dia ≤ término, não",
        "    concluídas) que NÃO receberam nenhum lançamento",
        "  → 📋 Porquês do dia: todos os motivos registrados, agregados",
        "  → Botão imprimir (janela própria, pronta pra PDF)",
        "",
        "TESTE INTERNO COMPLETO (todos os módulos): sintaxe 28/28,",
        "  return{} de 20 módulos, handlers onclick 100% resolvidos,",
        "  versão consistente nos 19 HTMLs, coleções Firestore conferidas."
      ]
    },
    {
      "versao": "V2.5.0",
      "legado": "V2.11.0",
      "status": "fechada",
      "data": "2026-07-09",
      "tipo": "funcionalidade",
      "titulo": "Diário de Obra vira módulo próprio (Gestão) + lançamento de % no Planejamento",
      "itens": [
        "DIÁRIO SAIU DO SEMANAL: agora é um módulo independente na",
        "  seção Gestão da barra lateral (📓 Diário) — o Semanal voltou",
        "  a ter só Dashboard e Tarefas, como antes",
        "",
        "NOVO: campo \"Avanço %\" no lançamento (opcional):",
        "  → Mostra o % atual da tarefa selecionada ao lado do nome",
        "  → O % informado é gravado DIRETO no Planejamento",
        "    (percentualConcluido), com as mesmas regras do Semanal:",
        "    primeiro avanço marca Início Real, 100% marca Término Real,",
        "    voltar de 100% limpa o Término Real",
        "  → O lançamento guarda o antes/depois (ex: 40% → 60%) e o",
        "    relatório do dia mostra essa evolução",
        "",
        "Mantido do fluxo anterior: busca fuzzy hierárquica de tarefa,",
        "  situação (Executado/Parcial/Não executado), motivo + detalhe,",
        "  lançamentos em sequência sem mouse, relatório do dia com",
        "  executado / não executado / deveria estar / porquês, impressão.",
        "",
        "Obs: estrutura pensada para evoluir — o formato do relatório",
        "  ainda vai ser amadurecido junto com o módulo Relatórios."
      ]
    },
    {
      "versao": "V2.5.1",
      "legado": "V2.11.1",
      "status": "fechada",
      "data": "2026-07-09",
      "tipo": "correcao",
      "titulo": "Correção: Diário de Obra travava em \"Carregando...\"",
      "itens": [
        "BUG: diario.html chamava Semanal.init() (resquício de quando",
        "  o Diário era aba do Semanal) em vez de Diario.init() —",
        "  Semanal nem é carregado nessa página, então o módulo",
        "  quebrava e a tela ficava travada em \"Carregando...\" pra sempre",
        "CORRIGIDO: chamada trocada para Diario.init()",
        "Menu lateral: rótulo alterado de \"Diário\" para \"Diário de Obra\"",
        "  em todas as 20 páginas do sistema"
      ]
    },
    {
      "versao": "V2.5.1.1",
      "legado": "V2.12.0",
      "status": "fechada",
      "data": "2026-07-09",
      "tipo": "funcionalidade",
      "titulo": "% em família no Planejamento (pai ↔ filhos)",
      "itens": [
        "NOVO: porcentagem de conclusão agora trabalha em família,",
        "  estilo MS Project — caminho de mão dupla:",
        "  • Lançou % numa FOLHA → o % do pai (e avós) é recalculado",
        "    automaticamente como média dos filhos ponderada pela",
        "    quantidade (se todos os filhos diretos têm quantidade;",
        "    senão, média simples)",
        "  • Lançou % num PAI → o valor é distribuído para todos os",
        "    descendentes (toast informa quantas tarefas foram afetadas)",
        "Vale nos 3 pontos de lançamento: Planejamento (edição inline",
        "  e modal), Semanal e Diário de Obra — lógica única e",
        "  compartilhada em Utils (percFamilia, recalcularPercAncestrais,",
        "  distribuirPercDescendentes), sem duplicação",
        "Hierarquia lida por ordem + nível, igual ao restante do sistema"
      ]
    },
    {
      "versao": "V2.5.1.2",
      "legado": "V2.13.0",
      "status": "fechada",
      "data": "2026-07-09",
      "tipo": "funcionalidade",
      "titulo": "Diário de Obra: Pauta do Dia",
      "itens": [
        "NOVO: ao abrir o Diário, a pauta da reunião já vem montada —",
        "  tarefas-folha previstas para o dia no Planejamento",
        "  (início <= dia <= término, % < 100), agrupadas pelo pai,",
        "  com % e quantidade/unidade de cada uma. Nada fixo no código:",
        "  a pauta é 100% dirigida pelos dados do Planejamento da obra.",
        "Cards com 3 ações rápidas: ✅ Andou (lança % novo, com prévia",
        "  ao vivo da produção física — delta% × quantidade, na unidade",
        "  da tarefa — e do novo % do pai), ✖ Parado (motivo + detalhe)",
        "  e ⏭ Pular. Tarefa já tratada mostra o badge do lançamento.",
        "Lançamento no PAI (botão \"Lançar no grupo\" no cabeçalho):",
        "  distribui o % para todas as subtarefas (% em família da V2.12.0)",
        "Seção recolhível de ATRASADAS: término já passou e não concluiu",
        "Tarefas AVULSAS (fora do planejamento, ex: falar com projetista):",
        "  rolam automaticamente para os dias seguintes até serem",
        "  concluídas, e saem como pendências no relatório",
        "Relatório do dia ganhou PRODUÇÃO FÍSICA: totais agrupados por",
        "  unidade (m², m³, un...) + detalhe por tarefa, e bloco de",
        "  pendências avulsas em aberto",
        "Formulário antigo virou \"Fora da pauta\" (recolhível), com a",
        "  mesma busca fuzzy em todo o Planejamento",
        "Gravação de avanço unificada em caminho único (_gravarAvanco):",
        "  regras de início/término real + % em família"
      ]
    },
    {
      "versao": "V2.5.1.3",
      "legado": "V2.13.1",
      "status": "fechada",
      "data": "2026-07-09",
      "tipo": "melhoria",
      "titulo": "Pauta do Dia: ajustes de uso em campo",
      "itens": [
        "Cards mostram só o NOME da tarefa (sem o código) — o código",
        "  aparece como tooltip ao passar o mouse no nome",
        "Grupos da pauta agora são RECOLHÍVEIS: clique no cabeçalho",
        "  para abrir/fechar e ver os filhos; contador de tratadas",
        "  por grupo (ex: 2/5 tratadas) direto no cabeçalho",
        "ATRASADAS: ordenadas pela ordem do planejamento e agrupadas",
        "  por família (todas as alvenarias juntas, etc.), com o nome",
        "  do pai como divisor",
        "NOVO: busca \"Adicionar tarefa do planejamento à pauta\" —",
        "  fuzzy pelo nome, adiciona à pauta tarefas do planejamento",
        "  que não estavam previstas para o dia (adiantadas, etc.).",
        "  Avulsas continuam sendo só o que está FORA do planejamento.",
        "Tooltips em todos os botões (Andou, Parado, ⏭ Pular,",
        "  Lançar no grupo, navegação de dias, avulsas...)"
      ]
    },
    {
      "versao": "V2.5.2",
      "legado": "V2.14.0",
      "status": "fechada",
      "data": "2026-07-10",
      "tipo": "correcao",
      "titulo": "Planejamento: 7 correções críticas de usabilidade",
      "itens": [
        "1. COLUNA #: número fixo por ordem real da tarefa, não muda",
        "   ao filtrar/recolher famílias. Predecessoras agora buscam por",
        "   esse número (igual MS Project) — digitar \"3TI\" vincula à",
        "   tarefa de linha 3 do planejamento, não ao código \"3\".",
        "",
        "2. PREDECESSORAS: agora funcionam de verdade. Ao salvar o campo",
        "   \"Predecessora\" com o número da linha (ex: \"5TI\" ou \"12TI+2\"),",
        "   o início/fim da tarefa é recalculado automaticamente.",
        "",
        "3. TOGGLE ▼/▶: área de clique aumentada (20×20px com fundo",
        "   visível) — muito mais fácil de acertar no celular/tablet.",
        "",
        "4. SCROLL AO TOGGLEAR: abrir/fechar uma família não salta mais",
        "   para o topo — a posição do scroll é preservada.",
        "",
        "5. RESIZE DE COLUNA: área de arraste aumentada de 4px para 10px",
        "   (com margem negativa para facilitar pegar a borda)",
        "   e cursor col-resize visível com dica ao passar o mouse.",
        "",
        "6. CTRL+Z: desfaz a última ação (edição de célula, reordenação).",
        "   Guarda os últimos 30 estados. Funciona no teclado enquanto",
        "   não há nenhum campo de texto ativo.",
        "",
        "7. EDIÇÃO DE CÉLULA: _paintRows() (virtual scroll) não destrói",
        "   mais o input aberto ao rolar a tela. Enquanto há um campo",
        "   em edição, só o Gantt é repintado; a tabela esquerda fica",
        "   intacta até o usuário confirmar (Enter/Tab) ou cancelar (Esc).",
        "",
        "BÔNUS: barra de seleção ganha botões ↑ Acima / ↓ Abaixo",
        "   para mover a tarefa selecionada uma posição (alternativa",
        "   visual ao Ctrl+BotãoDireito+Arrastar)."
      ]
    },
    {
      "versao": "V2.5.2.1",
      "legado": "V2.14.1",
      "status": "fechada",
      "data": "2026-07-10",
      "tipo": "funcionalidade",
      "titulo": "Mão de Obra e Materiais: vínculo múltiplo + unidades livres",
      "itens": [
        "Botão renomeado: \"+ Vincular à Tarefa\" agora é",
        "  \"+ Adicionar Nova Mão de Obra\" (módulo Mão de Obra)",
        "VÍNCULO A VÁRIAS TAREFAS DE UMA VEZ: ao adicionar uma mão de",
        "  obra ou material novo, agora dá pra selecionar mais de uma",
        "  tarefa na busca — cada clique adiciona/remove da lista",
        "  (chips abaixo da busca, com \"✕\" para remover individualmente)",
        "  → Salva um vínculo para cada tarefa selecionada, com o mesmo",
        "    valor/unidade/consumo. Vínculos já existentes são",
        "    ignorados silenciosamente (evita duplicidade)",
        "  → Ao EDITAR um vínculo já existente, a seleção continua",
        "    única (o vínculo representa uma tarefa só)",
        "Válido nos dois módulos: Mão de Obra e Materiais",
        "",
        "UNIDADES DE MEDIÇÃO LIVRES: os campos de unidade que antes",
        "  eram <select> fechado (limitado à lista pré-definida) agora",
        "  aceitam digitação livre, com sugestões da lista existente",
        "  — resolve o caso de unidades faltando, como m³",
        "  → Mão de Obra: \"Unidade do valor\"",
        "  → Materiais: unidade base do material (biblioteca e ao",
        "    criar novo), unidade de embalagem, unidade base da",
        "    embalagem, unidade de consumo (previsto/real)",
        "  → m³ e combinações com m³ (kg/m³, L/m³, etc.) adicionadas",
        "    como sugestões prontas na lista"
      ]
    },
    {
      "versao": "V2.5.3",
      "legado": "V2.14.1",
      "status": "fechada",
      "data": "2026-07-10",
      "tipo": "correcao",
      "titulo": "Coluna Tarefa redimensionável + predecessoras seguem vínculo ao reordenar",
      "itens": [
        "COLUNA \"TAREFA\" REDIMENSIONÁVEL:",
        "  A coluna de nome da tarefa era do tipo flex:1 (ocupa o espaço",
        "  que sobra), o que impedia o resize por arrasto. Agora:",
        "  → Handle de arrasto visível no cabeçalho da coluna Tarefa",
        "  → Ao arrastar, muda para largura fixa em pixels (gravada em",
        "    colLarguras) — se não foi redimensionada, continua flex:1",
        "  → Atualizado nos 4 lugares: live, PNG header, PNG rows",
        "",
        "PREDECESSORAS SEGUEM O VÍNCULO AO REORDENAR:",
        "  Ao mover uma tarefa (↑ Acima, ↓ Abaixo, ou Ctrl+drag),",
        "  o número # de todas as tarefas que mudaram de posição é",
        "  recalculado. O sistema então varre todas as predecessoras",
        "  e atualiza automaticamente qualquer referência numérica",
        "  que tenha mudado.",
        "  → Exemplo: Concreto era #3, Alvenaria tinha \"3TI\".",
        "    Após mover Concreto para #4, Alvenaria passa a \"4TI\".",
        "  → Formatos suportados: \"3\", \"3TI\", \"3TI+2\", \"3TT-1\" etc.",
        "  → Só atualiza referências que realmente mudaram de número.",
        "  → Toast confirma quantas predecessoras foram atualizadas.",
        "  → Salvamento no Firestore em background."
      ]
    },
    {
      "versao": "V2.5.4",
      "legado": "V2.14.2",
      "status": "fechada",
      "data": "2026-07-10",
      "tipo": "correcao",
      "titulo": "Coluna Tarefa realmente redimensionável + mover múltiplas linhas",
      "itens": [
        "COLUNA TAREFA — resize corrigido de verdade:",
        "  Havia 2 bugs: (1) o header de \"nome\" entrava num branch",
        "  COL_FIXED que gerava um div sem data-hcol e sem handle;",
        "  (2) o resize live (durante o arrasto) atualizava só o",
        "  data-hcol do header mas as células usam flex:1 e ignoram",
        "  width inline. Correções:",
        "  → Header de \"nome\" agora tem data-hcol e handle de 10px",
        "  → Células da coluna nome têm data-col=\"nome\"",
        "  → _colResizeStart atualiza header + todas as células",
        "    visíveis por data-col em tempo real, removendo flex",
        "",
        "MOVER MÚLTIPLAS LINHAS:",
        "  Os botões ↑ Acima e ↓ Abaixo agora funcionam com",
        "  1 ou mais tarefas selecionadas ao mesmo tempo.",
        "  → Mover para cima: cada linha selecionada sobe uma posição",
        "    em relação à linha não-selecionada imediatamente acima",
        "    (linhas selecionadas contíguas sobem juntas como bloco)",
        "  → Mover para baixo: idem, descendo",
        "  → Predecessoras remapeadas automaticamente após o movimento",
        "  → Testado: bloco de 2 linhas sobe/desce junto, para no topo",
        "    corretamente quando já está na primeira posição"
      ]
    },
    {
      "versao": "V2.6.0",
      "legado": "V2.15.0",
      "status": "fechada",
      "data": "2026-07-10",
      "tipo": "funcionalidade",
      "titulo": "Módulo Obras vira o hub central de navegação",
      "itens": [
        "Tela inicial pós-login agora é a seleção de Obra (era Dashboard)",
        "Sidebar reordenada: Obras aparece antes de Dashboard",
        "Config. da Obra sai do menu lateral e vira ícone ⚙️ direto no card da obra",
        "Card de cada obra mostra % executada (calculada do Planejamento, ponderada por duração das tarefas-folha)",
        "Card de cada obra mostra Início Real (menor inicioReal das tarefas) e Fim Provável (maior terminoPlanejado)",
        "Progresso de cada obra carrega em paralelo e atualiza o card assim que pronto, sem travar a listagem"
      ]
    },
    {
      "versao": "V2.7.0",
      "legado": "V2.16.0",
      "status": "fechada",
      "data": "2026-07-11",
      "tipo": "funcionalidade",
      "titulo": "Módulo Concreto: Levantamento + Controle",
      "itens": [
        "Novos módulos \"Levantamento de Concreto\" e \"Controle de Concreto\",",
        "  integrados a partir do dashboard de concreto (antes em planilha",
        "  Google Sheets + Apps Script separados) para dentro do sistema",
        "  principal, com todos os dados agora no Firestore da obra.",
        "",
        "LEVANTAMENTO DE CONCRETO (aba Levantamentos):",
        "  → Calculadora de volumes com diagramas: Pilar (retangular,",
        "    redondo, L, T), Rampa e Escada (laje inclinada + patamares",
        "    + degraus), envio direto para a base de peças",
        "  → Base de peças com busca, filtro por andar/tipo e edição",
        "  → Importação em lote (colar do Excel ou carregar TSV/CSV),",
        "    com normalização automática de nomes de andar e modelo",
        "    de planilha para download",
        "  → Montagem de Concretagens em 4 passos: dados → vínculo de",
        "    peças com % (bloqueia peças já 100% alocadas em outra",
        "    concretagem) → configuração das BTs previstas → resumo",
        "  → Configuração da ordem dos andares (arrastar e soltar)",
        "",
        "CONTROLE DE CONCRETO (aba Controle):",
        "  → 6 KPIs: Volume Total, Previsto (+10%), Real Concretado,",
        "    Executado de Projeto, Faltando e Índice de Perda",
        "  → Alerta de peças com lançamento acima do volume de projeto",
        "  → Lançamento e edição de BTs, com % relativo ao volume da",
        "    peça NESTA concretagem e detecção de excesso considerando",
        "    outras BTs já lançadas",
        "  → Progresso por tipo de peça (acordeão) com detalhe da peça",
        "    e histórico de lançamentos por concretagem",
        "  → Status das BTs por concretagem (previsto × usado, perda/",
        "    sobra de caminhão, perda de cocho)",
        "  → Painel da última BT lançada",
        "  → Exportação CSV de peças por concretagem",
        "  → Aba Relatórios: gráficos donut (execução geral e",
        "    distribuição de perdas), volume por andar (gráfico de",
        "    barras SVG com 4 séries), resumo por tipo e índice",
        "    detalhado por BT",
        "",
        "Regras de negócio preservadas do sistema original:",
        "  → Editar concretagem substitui todos os vínculos e BTs",
        "  → Excluir peça remove seus vínculos com concretagens",
        "  → Editar BT já lançada substitui os lançamentos anteriores"
      ]
    },
    {
      "versao": "V2.7.0.1",
      "legado": "V2.17.0",
      "status": "fechada",
      "data": "2026-07-11",
      "tipo": "funcionalidade",
      "titulo": "Acesso simplificado + Tutorial guiado",
      "itens": [
        "Login: acesso simplificado (usuário \"0\" / senha \"0\") traduzido",
        "  internamente para uma credencial real do Firebase Auth,",
        "  pensado para acesso rápido de convidados/gestores",
        "Novo módulo Tutorial: pop-up de boas-vindas no primeiro acesso",
        "  → Tour rápido explicando cada aba do menu lateral (o que é,",
        "    como funciona, se já está ou não em funcionamento)",
        "  → Botão \"Pular\" a qualquer momento e \"Próximo\" entre os passos",
        "  → Não abre as telas de fato, só um pop-up sobre a tela de Obras",
        "  → Pode ser revisto a qualquer momento pelo botão \"🎓 Tutorial\"",
        "    na tela de Obras",
        "  → Preferência salva no navegador (não repete depois da 1ª vez)"
      ]
    },
    {
      "versao": "V2.7.0.2",
      "legado": "V2.17.1",
      "status": "fechada",
      "data": "2026-07-11",
      "tipo": "melhoria",
      "titulo": "Tutorial: explicações completas por módulo",
      "itens": [
        "Cada passo do tutorial ganhou lista detalhada de recursos reais",
        "  do módulo (não mais 1 frase genérica), incluindo:",
        "  → Planejamento: hierarquia, % em família, predecessoras,",
        "    custo material/mão de obra, undo, exportação PNG paginada",
        "  → Levantamentos: detalhe de Fachada, Ar Condicionado e Concreto",
        "  → Controle: detalhe dos 6 KPIs e recursos do Controle de Concreto",
        "  → Semanal, Diário, Medições, Mão de Obra, Materiais e Relatórios",
        "    com os fluxos reais de cada um",
        "Modal do tutorial ampliado (modal-lg) para acomodar o conteúdo"
      ]
    },
    {
      "versao": "V2.7.1",
      "legado": "V2.17.2",
      "status": "fechada",
      "data": "2026-07-11",
      "tipo": "correcao",
      "titulo": "Concreto: navegação corrigida + visão fiel ao dashboard original",
      "itens": [
        "NAVEGAÇÃO: removidos os links cruzados nos cabeçalhos de",
        "  Levantamento Concreto e Controle Concreto — cada módulo só",
        "  é acessado pelo seu próprio hub (Levantamentos / Controle),",
        "  sem atalho de um para o outro pelo topo da página",
        "",
        "VISÃO: layout reconstruído para bater com o dashboard original",
        "  (Next.js), recolorido para o Design System Absoluta — mesma",
        "  estrutura, cores novas:",
        "  → FiltroBar: cards clicáveis com dropdown (Andar / Concretagem/",
        "    Andar), como no original, no lugar de <select> simples",
        "  → KPIs: cartão com ícone circular colorido por categoria",
        "    (verde/azul/roxo/vermelho/laranja), igual ao original",
        "  → Launch Bar: banner escuro com selo, título, descrição e",
        "    botão grande \"⊕ LANÇAR BT →\" (Controle) + atalho para o",
        "    Levantamento — recriando a barra de lançamento do original",
        "  → Última BT: painel com selo \"Última BT\", número grande,",
        "    grid de 4 itens (Concretagem/Previsto/Executado/Perda ou",
        "    Sobra) e selo \"Concluído ✓\", como no dashboard original",
        "  → Painéis (Progresso por Tipo, Status das BTs, Relatórios)",
        "    convertidos para o componente de painel do original",
        "  → Tabelas e badges (Levantamento e Controle) convertidos",
        "    para o estilo de tabela/badge do dashboard original",
        "  → Wizard de Concretagem: indicador de passos com círculos",
        "    numerados, igual ao original (era um conjunto de pílulas)",
        "  → Cards de seleção (tipo de peça, menu de concretagem)",
        "    convertidos para o \"menuCard\" do original"
      ]
    },
    {
      "versao": "V2.7.2",
      "legado": "V2.17.3",
      "status": "fechada",
      "data": "2026-07-11",
      "tipo": "correcao",
      "titulo": "Mão de Obra/Materiais: tarefas sem código, vínculo somado em uma linha, correção de bug ao selecionar tarefa",
      "itens": [
        "TAREFAS SEM CÓDIGO: a busca/árvore de tarefas (Mão de Obra,",
        "  Materiais e Diário) agora mostra só o nome do serviço/tarefa,",
        "  sem o código na frente (helper compartilhado",
        "  Utils.opcoesTarefaHierarquia)",
        "",
        "VÍNCULO A VÁRIAS TAREFAS = UMA LINHA SÓ: selecionar mais de uma",
        "  tarefa não cria mais uma linha por tarefa — agora gera UM",
        "  único vínculo com todas as tarefas somadas: nomes unidos",
        "  (\"Tarefa A + Tarefa B\") e quantidade somada (base do cálculo",
        "  do custo total). Vale para Mão de Obra e Materiais.",
        "  → Editar um vínculo existente também permite adicionar ou",
        "    remover tarefas dele (antes só uma tarefa era permitida",
        "    na edição)",
        "  → Planejamento (colunas Custo Material/Custo M.Obra) já lê",
        "    o novo formato — cada tarefa recebe valor×sua própria",
        "    quantidade, mesmo quando o vínculo cobre várias tarefas",
        "  → Vínculos antigos (uma tarefa só) continuam funcionando",
        "    normalmente, sem precisar recriar nada",
        "",
        "CORREÇÃO DE BUG: selecionar uma tarefa na busca não apaga mais",
        "  o que já tinha sido digitado (nome, valor, categoria,",
        "  observações...) — antes o clique recarregava o modal inteiro",
        "  e perdia tudo. Agora só a lista de resultados e os",
        "  \"chips\" de tarefas selecionadas são atualizados."
      ]
    },
    {
      "versao": "V2.7.3",
      "legado": "V2.17.4",
      "status": "fechada",
      "data": "2026-07-11",
      "tipo": "correcao",
      "titulo": "Controle: hub do Concreto não estava sendo exibido",
      "itens": [
        "BUG: a aba Controle continuava mostrando \"Módulo em",
        "  desenvolvimento\" mesmo depois do hub com o card Controle",
        "  Concreto ter sido implementado — o controle.html ainda",
        "  chamava Utils.initPagina() direto no carregamento, em vez",
        "  de Controle.init() (que é quem de fato desenha o hub)",
        "  → Corrigido: controle.html agora inicializa via",
        "    Controle.init(), igual às demais páginas do sistema",
        "  → Card \"🪨 Controle Concreto\" volta a aparecer normalmente",
        "    ao entrar em Controle"
      ]
    },
    {
      "versao": "V2.7.3.1",
      "legado": "V2.17.5",
      "status": "fechada",
      "data": "2026-07-12",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Fachada: clonar peças entre balancins",
      "itens": [
        "Novo botão \"⧉\" na árvore, ao lado do lápis, em cada",
        "  balancim — clona as peças de outro balancim (já",
        "  levantado) para dentro do balancim atual",
        "O nome do balancim atual não muda; apenas as peças",
        "  (Vista Externa + Vista Interna) são copiadas com os",
        "  mesmos valores, mas passam a pertencer a este balancim",
        "Se o balancim atual já tiver peças, o sistema avisa e",
        "  substitui pelas peças clonadas (evita duplicidade)",
        "CORREÇÃO: LF.editarNomeInline (renomear na árvore) estava",
        "  faltando no export do módulo — o botão de lápis na",
        "  árvore não funcionava (erro \"LF.editarNomeInline is not",
        "  a function\"); corrigido, e agora busca o nome atual",
        "  internamente ao invés de depender do onclick"
      ]
    },
    {
      "versao": "V2.7.3.2",
      "legado": "V2.17.6",
      "status": "fechada",
      "data": "2026-07-12",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Fachada: coluna \"ML?\" no relatório de peças",
      "itens": [
        "Nova coluna \"ML?\" na tabela de peças da Vista, com um",
        "  check clicável — mostra se a peça está sendo tratada",
        "  como Metro Linear e permite alternar direto ali",
        "No formulário de Nova Peça, o campo \"Pode ser considerado",
        "  Metro Linear\" agora é pré-marcado automaticamente com",
        "  base na Configuração de Cálculo (peça com área menor ou",
        "  igual ao limite definido já nasce marcada como ML)",
        "A checkbox continua sendo um double-check manual: se o",
        "  usuário clicar nela, a sugestão automática para de",
        "  sobrescrever aquela peça (respeita a escolha manual)",
        "Ao editar uma peça já existente, o valor salvo é mantido",
        "  como está (não recalcula sozinho por cima do que já foi",
        "  decidido antes)"
      ]
    },
    {
      "versao": "V2.7.4",
      "legado": "V2.17.7",
      "status": "fechada",
      "data": "2026-07-12",
      "tipo": "correcao",
      "titulo": "Levantamento de Fachada: Vão Fechado zerado + coluna m² unitário",
      "itens": [
        "BUG: o card \"M² Vão Fechado\" no topo da tela de Vista",
        "  sempre mostrava 0,00, mesmo com vão(s) cadastrado(s)",
        "  para aquela vista — a função de soma não estava",
        "  recebendo a vista ao calcular o total; corrigido",
        "BUG: exportar CSV (geral ou da vista) quebrava com erro,",
        "  pois tentava usar um campo \"vão\" que não existia mais",
        "  no cálculo por peça; corrigido",
        "Coluna \"Vão F.\" por peça removida da tabela (não fazia",
        "  sentido — vão fechado é por vista, não por peça)",
        "Nova coluna \"m² unit.\" no lugar: mostra o m² de UMA peça",
        "  só, sem multiplicar pela quantidade (a coluna \"m² sem",
        "  ML\" continua mostrando o total já multiplicado)"
      ]
    },
    {
      "versao": "V2.7.4.1",
      "legado": "V2.17.8",
      "status": "fechada",
      "data": "2026-07-12",
      "tipo": "melhoria",
      "titulo": "Levantamento de Fachada: ordem alfabética, cards de vista clicáveis e histórico de acabamento",
      "itens": [
        "Peças da tabela da Vista agora aparecem em ordem",
        "  alfabética (antes era pela ordem de cadastro)",
        "Nos cards \"Vista Externa\" / \"Vista Interna\" (dentro do",
        "  balancim), o card inteiro agora é clicável — antes só",
        "  o corpo abaixo do título respondia ao clique, e clicar",
        "  em cima do título/ícone não abria a vista",
        "Campo \"Acabamento\" no formulário de peça agora sugere",
        "  (autocomplete) os acabamentos já usados em outras",
        "  peças da obra, mas continua aceitando texto livre",
        "  digitado na hora"
      ]
    },
    {
      "versao": "V2.7.4.2",
      "legado": "V2.17.9",
      "status": "fechada",
      "data": "2026-07-12",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Fachada: contas dentro dos campos de medida (cm)",
      "itens": [
        "Agora dá pra digitar uma conta direto nos campos",
        "  Comprimento, Altura, Largura Janela e Altura Janela",
        "  da peça — ex: \"291+100\" e apertar Enter vira \"391\"",
        "Aceita +, -, * e / (e parênteses); se não tiver operador",
        "  ou o texto não for uma conta válida, o campo fica",
        "  como o usuário digitou, sem mexer em nada"
      ]
    },
    {
      "versao": "V2.7.5",
      "legado": "V2.17.10",
      "status": "fechada",
      "data": "2026-07-12",
      "tipo": "correcao",
      "titulo": "Levantamento de Fachada: contas também no Vão Fechado",
      "itens": [
        "Os campos Comp (cm) e Alt (cm) do modal de Vão Fechado",
        "  agora também aceitam conta (ex: \"291+100\" + Enter =",
        "  \"391\"), igual ao formulário de peça",
        "CORREÇÃO: o preview de m² do Vão Fechado estava quebrado",
        "  — o oninput dos campos chamava uma função global que",
        "  não existia (_atualizarPreviewVao em vez de",
        "  LF._atualizarPreviewVao), gerando erro no console",
        "  toda vez que o usuário digitava; corrigido"
      ]
    },
    {
      "versao": "V2.7.6",
      "legado": "V2.17.11",
      "status": "fechada",
      "data": "2026-07-12",
      "tipo": "correcao",
      "titulo": "Levantamento de Fachada: clonar balancim não puxava Vão Fechado nem contava peças na fachada",
      "itens": [
        "BUG: ao clonar peças de outro balancim (⧉), o Vão Fechado",
        "  das vistas de origem não era copiado para as vistas do",
        "  balancim de destino; agora é copiado junto",
        "BUG: as peças clonadas ficavam com o fachadaId da",
        "  fachada de ORIGEM em vez da fachada de DESTINO — por",
        "  isso o contador de peças na árvore, ao lado do nome da",
        "  fachada, não batia com a realidade quando se clonava",
        "  entre balancins de fachadas diferentes; corrigido",
        "IMPORTANTE: clones feitos ANTES desta correção continuam",
        "  com o fachadaId errado no banco — se algum balancim",
        "  clonado estiver com contagem estranha, refaça o clone",
        "  (⧉) nele para corrigir os dados"
      ]
    },
    {
      "versao": "V2.7.6.1",
      "legado": "V2.17.12",
      "status": "fechada",
      "data": "2026-07-12",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Fachada: botão de corrigir vínculos antigos + breakdown de ML na Visão Geral",
      "itens": [
        "Novo botão \"🔧\" ao lado de \"+ Fachada\" na Estrutura —",
        "  revisa TODAS as peças e vistas da obra de uma vez e",
        "  corrige o vínculo com a fachada certa (baseado no",
        "  balancim de cada uma). Resolve de vez os clones feitos",
        "  antes da V2.17.11 sem precisar refazer um por um",
        "Nos cards da Visão Geral (mapa), \"M² COM ML\" agora mostra",
        "  o valor separado: Xm² + YML, com \"= Zm²\" embaixo — igual",
        "  já aparecia nas outras telas do sistema"
      ]
    },
    {
      "versao": "V2.7.6.2",
      "legado": "V2.17.13",
      "status": "fechada",
      "data": "2026-07-12",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Fachada: friso (arquitetônico/estrutural) + fachada não reconhecia clone (raiz do problema)",
      "itens": [
        "CORREÇÃO DEFINITIVA: os totais de peças/m²/vão por fachada",
        "  (árvore, Resumo Geral, tela da Fachada, Visão Geral)",
        "  dependiam do campo fachadaId gravado em cada peça/vista",
        "  — se esse campo ficasse desatualizado (ex: em clones),",
        "  a fachada \"não reconhecia\" as peças mesmo elas estando",
        "  no balancim certo. Agora os totais são calculados pelo",
        "  balancim (fonte da verdade), não mais pelo fachadaId",
        "  solto — o problema de \"Fachada Frontal Esquerda\" não",
        "  bater com a \"Direita\" clonada está resolvido de raiz,",
        "  mesmo sem precisar rodar o botão 🔧 de correção",
        "Novo seletor \"Possui friso?\" na peça (igual ao de janela):",
        "  Comprimento do friso (cm, aceita conta), Tipo",
        "  (Arquitetônico ou Estrutural) e Qtd de frisos",
        "Todo o levantamento agora soma o ML de friso separado",
        "  por tipo — \"Friso Arquitetônico\" e \"Friso Estrutural\"",
        "  aparecem no resumo (m² sem ML / com ML / vão) de toda",
        "  vista, balancim, fachada e no total geral, e também nos",
        "  cards da Visão Geral (mapa) e no CSV exportado",
        "Nova coluna \"Friso\" na tabela de peças, mostrando",
        "  comprimento e tipo (Arq/Est) quando a peça tiver friso"
      ]
    },
    {
      "versao": "V2.7.6.3",
      "legado": "V2.17.14",
      "status": "fechada",
      "data": "2026-07-12",
      "tipo": "melhoria",
      "titulo": "Levantamento de Fachada: múltiplos frisos por peça",
      "itens": [
        "\"Possui friso?\" agora permite adicionar MAIS DE UM friso",
        "  na mesma peça (igual à lista de Vão Fechado) — botão",
        "  \"+ Friso\" adiciona linha, cada uma com seu próprio",
        "  Comprimento, Tipo (Arquitetônico/Estrutural) e Qtd",
        "Os totais de ML Friso Arquitetônico/Estrutural agora",
        "  somam todos os frisos de todas as peças corretamente",
        "Coluna \"Friso\" na tabela mostra o primeiro friso e um",
        "  \"+N\" quando a peça tem mais de um; passe o mouse em",
        "  cima pra ver a lista completa",
        "Peças com friso cadastrado no formato antigo (um só)",
        "  continuam funcionando normalmente"
      ]
    },
    {
      "versao": "V2.7.6.4",
      "legado": "V2.17.15",
      "status": "fechada",
      "data": "2026-07-12",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Fachada: mover peça entre Vista Externa/Interna",
      "itens": [
        "Novo botão \"⇄\" na tabela de peças da Vista — move a peça",
        "  direto pra outra vista do mesmo balancim (Externa ↔",
        "  Interna), sem precisar excluir e recadastrar tudo",
        "Útil pra quando a peça foi lançada na vista errada por",
        "  engano"
      ]
    },
    {
      "versao": "V2.7.7",
      "legado": "V2.17.16",
      "status": "fechada",
      "data": "2026-07-12",
      "tipo": "correcao",
      "titulo": "Levantamento de Fachada: botão \"✓\" sem título explicativo",
      "itens": [
        "O botão \"✓\" nas Ações da tabela de peças (marca a peça",
        "  como conferida/já revisada) não tinha texto ao passar",
        "  o mouse — agora mostra \"Marcar peça como conferida\" ou",
        "  \"Desmarcar conferência\", conforme o estado atual"
      ]
    },
    {
      "versao": "V2.7.7.1",
      "legado": "V2.17.17",
      "status": "fechada",
      "data": "2026-07-12",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Fachada: mover peça para outro balancim",
      "itens": [
        "Novo botão \"↗\" nas Ações da tabela de peças — abre uma",
        "  janela pra escolher o balancim de destino (de qualquer",
        "  fachada) e a vista (Externa ou Interna)",
        "A peça sai do balancim/fachada atual e passa a pertencer",
        "  ao balancim escolhido, mantendo nome e valores; a",
        "  conferência é reiniciada (peça precisa ser reconferida",
        "  no lugar novo)",
        "Complementa o botão \"⇄\" (que só troca entre Externa e",
        "  Interna do MESMO balancim) — agora dá pra corrigir",
        "  peça lançada no balancim errado também"
      ]
    },
    {
      "versao": "V2.7.7.2",
      "legado": "V2.17.18",
      "status": "fechada",
      "data": "2026-07-12",
      "tipo": "melhoria",
      "titulo": "Levantamento de Fachada: múltiplos tipos de janela por peça",
      "itens": [
        "\"Possui janela?\" agora permite adicionar MAIS DE UMA",
        "  janela na mesma peça (igual ao Vão Fechado e ao Friso)",
        "  — botão \"+ Janela\" adiciona linha, cada uma com sua",
        "  própria Largura, Altura e Qtd",
        "O desconto de área por janela (segundo a Configuração de",
        "  Cálculo) agora soma o desconto de TODOS os tipos de",
        "  janela da peça, não só de um",
        "Coluna \"Jan\" na tabela mostra \"✓\" e um \"+N\" quando a peça",
        "  tem mais de um tipo de janela; passe o mouse em cima",
        "  pra ver as medidas de cada uma",
        "Peças com janela cadastrada no formato antigo (uma só)",
        "  continuam funcionando normalmente"
      ]
    },
    {
      "versao": "V2.7.7.3",
      "legado": "V2.17.19",
      "status": "fechada",
      "data": "2026-07-12",
      "tipo": "melhoria",
      "titulo": "Levantamento de Fachada: aviso quando desconto de janela zera a peça",
      "itens": [
        "Se a peça tem comprimento/altura válidos mas o desconto",
        "  de janela some com 100% da área (m² sem ML = 0,00),",
        "  a linha agora aparece destacada em vermelho com \"⚠️\"",
        "  no nome, e um aviso ao passar o mouse",
        "Isso normalmente acontece quando a Largura/Altura da",
        "  janela foi digitada igual (ou maior) à da própria peça",
        "  por engano — o sistema não estava avisando, só zerava",
        "  o valor silenciosamente"
      ]
    },
    {
      "versao": "V2.7.7.4",
      "legado": "V2.17.20",
      "status": "fechada",
      "data": "2026-07-12",
      "tipo": "melhoria",
      "titulo": "Levantamento de Fachada: opção \"Não Descontar\" na config de janela + clareza no Qtd por peça",
      "itens": [
        "Nova opção na Configuração de Cálculo: \"Não Descontar\" —",
        "  a janela não reduz nada do m² da peça, seja qual for",
        "  o tamanho dela",
        "CAUSA DO ZERAMENTO ANTERIOR (não era bug): o campo \"Qtd\"",
        "  de Janela e de Friso é por PEÇA — se a peça tem",
        "  Quantidade 16 e você bota Qtd Janela 16, o sistema",
        "  entende 16 janelas em CADA uma das 16 peças (256 no",
        "  total), não 16 no total. Adicionei um aviso no",
        "  formulário mostrando isso, e troquei o rótulo do campo",
        "  para \"Qtd (por peça)\" nos dois (Janela e Friso)"
      ]
    },
    {
      "versao": "V2.7.7.5",
      "legado": "V2.17.21",
      "status": "fechada",
      "data": "2026-07-12",
      "tipo": "melhoria",
      "titulo": "Levantamento de Fachada: aviso \"por peça\" logo no checkbox de janela/friso",
      "itens": [
        "Os checkboxes \"Possui janela / abertura\" e \"Possui",
        "  friso\" agora já mostram, desde o início (antes de",
        "  abrir os campos), a instrução \"(coloque a quantidade",
        "  para UMA única peça)\" — pra evitar o erro de colocar a",
        "  quantidade total (ex: 16) em vez da quantidade por",
        "  peça (ex: 1)"
      ]
    },
    {
      "versao": "V2.7.7.6",
      "legado": "V2.17.22",
      "status": "fechada",
      "data": "2026-07-12",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Fachada: copiar todas as peças da Vista oposta de uma vez",
      "itens": [
        "Novo botão \"⧉ Copiar de Vista Externa/Interna (N)\" no",
        "  topo da tela de peças da Vista — copia TODAS as peças",
        "  da vista oposta do mesmo balancim de uma vez só, para",
        "  os casos em que Externa e Interna são iguais",
        "Só aparece quando a vista oposta tem peças cadastradas",
        "Se a vista atual já tiver peças, avisa que elas serão",
        "  substituídas pelas copiadas antes de continuar"
      ]
    },
    {
      "versao": "V2.7.7.7",
      "legado": "V2.17.23",
      "status": "fechada",
      "data": "2026-07-12",
      "tipo": "funcionalidade",
      "titulo": "Mão de Obra: vincular direto ao Levantamento de Fachada (m² real, com desconto de janela)",
      "itens": [
        "PROBLEMA RESOLVIDO: serviços de fachada no Planejamento",
        "  (chapisco, reboco, limpeza...) tinham cada um seu próprio",
        "  campo \"quantidade\" na tarefa, que não necessariamente batia",
        "  com o m² real calculado no Levantamento de Fachada",
        "",
        "Mão de Obra agora tem a mesma opção que já existia em",
        "  Materiais: na busca de serviço/tarefa, aparece também",
        "  \"[Levantamento] Fachada\" (ícone 🏗️) — ao selecionar essa",
        "  opção em vez de uma tarefa do Planejamento, a quantidade",
        "  usada no cálculo do custo passa a ser o m² real do",
        "  levantamento, não o campo da tarefa",
        "  → Chapisco, Reboco, Limpeza (e qualquer outro serviço de",
        "    fachada) podem todos apontar para essa MESMA opção —",
        "    todos usam o mesmo m² automaticamente, sem duplicar",
        "    nem digitar quantidade manualmente em cada tarefa",
        "",
        "CORREÇÃO DE PRECISÃO: o cálculo desse m² (tanto em Mão de",
        "  Obra quanto em Materiais) agora usa a mesma lógica de",
        "  desconto de janela/vão do Levantamento de Fachada (antes,",
        "  Materiais usava um cálculo simplificado que ignorava os",
        "  descontos configurados) — novo helper compartilhado",
        "  Utils.calcularFachadaM2()",
        "",
        "Observação: um vínculo apontado para \"[Levantamento]",
        "  Fachada\" não aparece nas colunas de custo do Planejamento",
        "  (que são por tarefa) — ele fica visível e correto dentro",
        "  do próprio módulo Mão de Obra / Materiais, na aba Por",
        "  Tarefa, filtrando por essa opção"
      ]
    },
    {
      "versao": "V2.7.7.8",
      "legado": "V2.18.0",
      "status": "fechada",
      "data": "2026-07-12",
      "tipo": "funcionalidade",
      "titulo": "Planejamento: aba \"Vínculos com Levantamento\" — arquitetura correta (Milton pediu para reformular)",
      "itens": [
        "MUDANÇA DE ARQUITETURA (a pedido do Milton, corrigindo a",
        "  V2.17.23 desta mesma sessão): removida a opção de vincular",
        "  Material/Mão de Obra DIRETO ao Levantamento de Fachada.",
        "  Motivo: isso fazia o custo não aparecer nas colunas do",
        "  Planejamento (Custo Material/Custo M.Obra), porque o",
        "  vínculo não passava por nenhuma tarefa real.",
        "",
        "NOVA ARQUITETURA — tudo se vincula ao Planejamento, e o",
        "  Planejamento se vincula ao Levantamento:",
        "  → Material, Mão de Obra, Suprimento etc. continuam se",
        "    vinculando só a tarefas REAIS do Planejamento (como",
        "    sempre foi) — nada mudou aí",
        "  → Nova aba/botão \"🔗 Vínculos com Levantamento\" dentro do",
        "    Planejamento (separada da visão de Gantt) — lista TODAS",
        "    as tarefas, pai e filho, uma por linha",
        "  → Em cada linha, escolhe: qual Levantamento (por enquanto:",
        "    Fachada) + qual quantidade considerar (m² líquido ou",
        "    m² + metro linear equivalente) + aplicar só nessa tarefa",
        "    OU nessa tarefa + todos os filhos de uma vez",
        "  → Ao salvar, a quantidade da(s) tarefa(s) escolhida(s) é",
        "    calculada e gravada no campo quantidade da própria",
        "    tarefa — e como Material/Mão de Obra já leem esse campo,",
        "    o custo passa a aparecer certinho nas colunas do",
        "    Planejamento também, sem precisar mudar mais nada",
        "  → Botão \"🔄 Recalcular vínculos\" — atualiza a quantidade",
        "    de todas as tarefas vinculadas, lendo o Levantamento",
        "    mais recente (útil depois de editar peças na Fachada)",
        "  → Botão \"✕\" remove o vínculo (tarefa volta a ser manual)",
        "",
        "NOVA COLUNA \"Quantidade\" no Gantt (visível/escondível como",
        "  as outras) — mostra o valor + unidade, com ícone 🔗 quando",
        "  vem de um Levantamento",
        "Modal de Editar Tarefa ganhou campos Quantidade/Unidade",
        "  (para quando a fonte é manual) — mostra aviso quando a",
        "  tarefa está vinculada a um Levantamento"
      ]
    },
    {
      "versao": "V2.7.7.9",
      "legado": "V2.18.1",
      "status": "fechada",
      "data": "2026-07-12",
      "tipo": "melhoria",
      "titulo": "Vínculos com Levantamento: busca, seleção granular, divisão entre irmãos, exclusão em cascata",
      "itens": [
        "BUSCA: campo de busca no topo da tela de Vínculos, filtra a",
        "  lista de tarefas por nome/código sem precisar rolar tudo",
        "",
        "PROBLEMA RESOLVIDO — \"aplicar a todos os filhos\" era tudo ou",
        "  nada: agora, ao clicar \"Vincular\" numa tarefa, abre uma",
        "  árvore com TODOS os descendentes, cada um com checkbox",
        "  (incluir ou não) — assim dá pra excluir da vez as tarefas",
        "  que não fazem sentido (ex: Pingadeiras, Esquadria Alumínio)",
        "  sem ter que desfazer uma por uma depois",
        "",
        "DIVISÃO ENTRE IRMÃOS: cada tarefa incluída tem um campo de",
        "  fração (padrão \"1\" = valor cheio; aceita \"1/8\", \"0,5\" etc.)",
        "  — grupos de tarefas-irmãs (ex: 8 \"Etapas\" dentro de",
        "  \"Montagem Balancim\") ganham um botão \"÷ Dividir estes N em",
        "  partes iguais\" que marca todas e já calcula 1/N sozinho",
        "  (pode ajustar manualmente depois se precisar)",
        "",
        "EXCLUSÃO EM CASCATA: remover o vínculo da tarefa-raiz (a que",
        "  originou a ação) agora remove junto todas as tarefas que",
        "  vieram vinculadas nessa mesma ação — não fica mais o pai",
        "  manual e os filhos com o valor antigo perdido",
        "",
        "CORREÇÃO DE SCROLL: salvar/remover/recalcular vínculo não",
        "  recarrega mais a tela inteira — atualiza só a tabela, então",
        "  a posição de rolagem (e o campo de busca) ficam onde você",
        "  estava, sem voltar pro topo",
        "",
        "Observação: vínculos criados na versão anterior (V2.18.0)",
        "  não tinham essas informações de grupo/fração — continuam",
        "  funcionando normalmente, mas recomendo refazer usando a",
        "  nova tela pra aproveitar a seleção granular e a divisão",
        "  automática"
      ]
    },
    {
      "versao": "V2.7.8",
      "legado": "V2.18.2",
      "status": "fechada",
      "data": "2026-07-12",
      "tipo": "correcao",
      "titulo": "Vínculos com Levantamento: cascata corrigida + scroll do modal não pula mais pro topo",
      "itens": [
        "EXCLUSÃO EM CASCATA CORRIGIDA: a versão anterior só cascateava",
        "  se o vínculo tivesse sido salvo com o campo de rastreio de",
        "  grupo (levantamentoOrigemId) — vínculos que não tinham esse",
        "  campo (ou qualquer caso em que não batesse certinho) não",
        "  cascateavam. Agora a cascata é baseada direto na hierarquia",
        "  real do Planejamento: remover o vínculo de uma tarefa",
        "  remove junto o de TODOS os descendentes dela (filhos, netos",
        "  etc.) que também estejam vinculados a levantamento — não",
        "  depende mais de nenhum campo de rastreio, funciona tanto",
        "  pra vínculos novos quanto antigos",
        "",
        "SCROLL DO MODAL CORRIGIDO: no modal de \"Vincular quantidade\",",
        "  cada clique num checkbox, edição de fração ou clique no",
        "  botão \"÷ Dividir\" fazia a lista de tarefas voltar pro topo",
        "  — muito ruim em grupos com vários irmãos (ex: 8 etapas),",
        "  porque cada ação te jogava de volta lá em cima. Agora a",
        "  posição de rolagem da lista fica exatamente onde você",
        "  estava mexendo"
      ]
    },
    {
      "versao": "V2.7.8.1",
      "legado": "V2.18.3",
      "status": "fechada",
      "data": "2026-07-10",
      "tipo": "funcionalidade",
      "titulo": "Planejamento: barra de busca de tarefa",
      "itens": [
        "Barra de busca integrada à toolbar do Planejamento:",
        "  → Busca por nome, código, responsável, local, grupo ou",
        "    número de linha (#)",
        "  → Ao digitar, pula automaticamente para o 1º resultado",
        "  → Resultado atual destacado em amarelo vivo; outros",
        "    resultados (também encontrados) em amarelo suave",
        "  → Enter ou ↓: próximo resultado",
        "  → ↑: resultado anterior",
        "  → Esc ou ✕: limpa a busca",
        "  → Contador de resultados ao lado da barra",
        "  → Foco retorna ao campo após re-render"
      ]
    },
    {
      "versao": "V2.7.8.2",
      "legado": "V2.18.4",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "funcionalidade",
      "titulo": "Vínculos com Levantamento: seleção granular por Fachada/Balancim/Vista",
      "itens": [
        "PROBLEMA: o valor usado no vínculo sempre somava TODAS as",
        "  peças de TODAS as fachadas/balancins/vistas da obra — só",
        "  dava pra \"recortar\" esse total com uma fração digitada à",
        "  mão (ex: 1/8), sem nenhuma relação real com a estrutura",
        "  do levantamento (ex: não dava pra vincular só a Fachada",
        "  Frontal, ou só um Balancim específico)",
        "",
        "NOVO: modal de vínculo ganhou 3 seletores em cascata —",
        "  Fachada → Balancim → Vista — que filtram as peças ANTES",
        "  de calcular o m², restringindo o valor a só aquela parte",
        "  do levantamento real. Deixar em branco em qualquer nível",
        "  soma tudo que está abaixo dele (ex: escolher só a fachada",
        "  soma todos os balancins/vistas dela)",
        "  → A fração manual (1/8, 0,5 etc.) continua existindo e",
        "  agora funciona JUNTO com a seleção estrutural: primeiro",
        "  escolhe a fonte (ex: Balancim 3), depois divide entre",
        "  tarefas-irmãs com fração se precisar",
        "  → A tela de Vínculos (lista) agora mostra a fonte",
        "  estrutural escolhida ao lado da fração (ex: \"Fachada",
        "  Frontal › BAL-01 › Vista Externa\")",
        "  → Recalcular vínculos também respeita a fonte salva de",
        "  cada tarefa",
        "  → Mecanismo genérico: a mesma lógica de filtro por níveis",
        "  serve de base pra quando o vínculo de Levantamento de",
        "  Concreto for implementado"
      ]
    },
    {
      "versao": "V2.8.0",
      "legado": "V2.19.0",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "funcionalidade",
      "titulo": "Novo módulo: Levantamento de Paredes",
      "itens": [
        "Novo módulo dentro de Levantamentos: um único cadastro de",
        "  \"Parede\" no lugar de módulos separados por acabamento",
        "  (Alvenaria, Reboco, Gesso, Revestimento)",
        "Árvore de locais genérica e ilimitada em profundidade —",
        "  monta a hierarquia como quiser (ex: Torre → 1º Andar →",
        "  Apto 11 → Cozinha), sem níveis fixos no sistema",
        "Peça = Parede, com Comprimento (cm), Altura (cm), tipo de",
        "  Alvenaria (Estrutural ou Vedação) e vãos (porta/janela)",
        "  — pode adicionar quantos vãos precisar, cada um com",
        "  comprimento, altura e quantidade",
        "Lado A e Lado B configurados separadamente, cada um com:",
        "  → Acabamento por %, podendo misturar Gesso Liso + Reboco",
        "  + Revestimento na mesma parede (ex: 60% reboco + 40%",
        "  revestimento)",
        "  → Pintura independente do acabamento (pode ter reboco/",
        "  revestimento/gesso E pintura na mesma parede), com mais",
        "  de uma cor por %",
        "Geração automática dos quantitativos a partir das peças:",
        "  → Alvenaria de Vedação (m²) e Alvenaria Estrutural (m²)",
        "  separadas",
        "  → Gesso Liso, Reboco e Revestimento (m²)",
        "  → Pintura total (m²) com detalhamento por cor",
        "Visão Geral com resumo de quantitativos da obra toda e",
        "  resumo por local de nível superior (ex: Térreo vs Torre)"
      ]
    },
    {
      "versao": "V2.8.1",
      "legado": "V2.19.1",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "correcao",
      "titulo": "Levantamento de Paredes: opção \"Fachada\" no acabamento",
      "itens": [
        "Adicionada opção \"Fachada\" na lista de acabamentos de",
        "  Lado A/Lado B — usada para marcar que aquele lado da",
        "  parede já é resolvido pelo módulo de Levantamento de",
        "  Fachada, sem gerar nenhum quantitativo aqui (não entra",
        "  em Gesso Liso, Reboco ou Revestimento)"
      ]
    },
    {
      "versao": "V2.8.2",
      "legado": "V2.19.2",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "correcao",
      "titulo": "Levantamento de Paredes: correção de digitação, fórmula, alturas separadas e fluxo rápido",
      "itens": [
        "CORREÇÃO: campos de Comprimento/Altura/Vão/% invertiam os",
        "  dígitos digitados (ex: escrever \"123\" virava \"321\") —",
        "  causado por re-renderizar o formulário inteiro a cada",
        "  tecla, recriando o input e jogando o cursor pro início.",
        "  Agora a digitação só atualiza os dados em memória e um",
        "  bloco de resumo à parte, sem recriar o campo",
        "NOVO: campos de medida aceitam fórmula simples + Enter,",
        "  igual ao Levantamento de Fachada (ex: digitar \"150+200\"",
        "  e apertar Enter vira \"350\") — funciona em Comprimento,",
        "  Altura da Parede, Altura do Acabamento e nos vãos",
        "NOVO: Altura da Parede e Altura do Acabamento agora são",
        "  campos separados — a primeira calcula o m² de Alvenaria",
        "  (Estrutural/Vedação), a segunda calcula o m² usado por",
        "  Gesso Liso, Reboco, Revestimento e Pintura. Se a altura",
        "  do acabamento ficar em branco, usa a mesma da parede",
        "  → Peças antigas (só com \"altura\" única) continuam",
        "  funcionando normalmente (compatibilidade retroativa)",
        "NOVO: botão \"Salvar e Nova Parede\" no modal — salva a",
        "  parede atual e já abre um formulário novo em branco no",
        "  mesmo local, sem fechar o modal, para lançar várias",
        "  paredes seguidas mais rápido",
        "Tabela de paredes do local agora mostra m² de Alvenaria e",
        "  m² de Acabamento em colunas separadas"
      ]
    },
    {
      "versao": "V2.8.2.1",
      "legado": "V2.19.3",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Paredes: resumo por camadas, clonar local e ações de parede (mover/duplicar/conferir)",
      "itens": [
        "Ao clicar num local que tem sublocais (ex: um apartamento",
        "  modelo com vários cômodos), a tela agora mostra um",
        "  resumo por camadas igual ao Levantamento de Fachada:",
        "  → KPIs agregados de TODA a subárvore (não só do local",
        "  clicado): Vedação, Estrutural, Gesso, Reboco,",
        "  Revestimento e Pintura somando os sublocais",
        "  → Tabela \"Resumo por Sublocal\" com paredes e m² de cada",
        "  sublocal filho, clicável para entrar nele",
        "  → Continua mostrando as paredes lançadas diretamente",
        "  naquele local (ex: paredes externas do apartamento)",
        "NOVO: Clonar Local (ícone ⧉ na árvore e botão no painel) —",
        "  duplica um local com toda a estrutura de sublocais E as",
        "  paredes já lançadas dentro dele. Serve pra replicar um",
        "  \"Apartamento Modelo A\" inteiro como \"Modelo A (cópia)\"",
        "  sem recriar cômodo por cômodo",
        "NOVO: ações rápidas na linha de cada parede (igual à",
        "  Fachada):",
        "  → ⇄ Mover: manda a parede para outro local da árvore",
        "  → ⧉ Duplicar: cria uma cópia da parede no mesmo local",
        "  → ✓ Conferir: marca/desmarca a parede como conferida",
        "  (linha fica destacada em verde quando conferida)"
      ]
    },
    {
      "versao": "V2.8.2.2",
      "legado": "V2.19.4",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Paredes: Lado B opcional, Metro Linear e configuração geral (igual Fachada)",
      "itens": [
        "NOVO: checkbox \"Possui Lado B?\" na parede — cobre o caso de",
        "  paredes que só têm acabamento de um lado (ex: divisa com",
        "  outra unidade, parede de fundo). Quando desmarcado, o",
        "  Lado B some do formulário e não entra em nenhum cálculo",
        "NOVO: checkbox \"Pode ser ML?\" por parede — igual ao",
        "  Levantamento de Fachada. Paredes muito estreitas (área",
        "  bruta pequena) são sugeridas automaticamente como ML",
        "  assim que Comprimento/Altura são preenchidos, mas o",
        "  usuário pode marcar/desmarcar manualmente a qualquer",
        "  momento — depois disso, a sugestão automática para de",
        "  sobrescrever",
        "NOVO: \"⚙️ Configurações de Cálculo\" (botão na árvore de",
        "  Locais) — igual à Fachada, com:",
        "  → Vãos: 5 modos configuráveis (Não Descontar, Desconto",
        "  Total, 2 modos de Desconto Parcial com limite X/valor Y,",
        "  e Metade) — antes o desconto de vão era sempre \"total\"",
        "  → Metro Linear: a partir de quantos m² brutos considerar",
        "  ML, e qual % do m² conta no equivalente",
        "Alvenaria e Acabamento agora calculam ML separadamente",
        "  (cada um com sua própria altura), com um painel novo",
        "  \"📏 Metro Linear\" mostrando m² sem ML / ML / m² com ML",
        "  equivalente — tanto na Visão Geral quanto em cada local"
      ]
    },
    {
      "versao": "V2.8.2.3",
      "legado": "V2.20.0",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Paredes: separado em Alvenaria x Acabamento (corrige duplicação de m² estrutural)",
      "itens": [
        "PROBLEMA IDENTIFICADO: uma mesma parede física (ex: \"Parede",
        "  D/B\") tem UMA alvenaria mas DUAS faces de acabamento —",
        "  cada face com comprimento e acabamento próprios (a face",
        "  do cômodo D pode ser diferente da face do cômodo B). Ao",
        "  lançar as duas faces como peças separadas (necessário",
        "  para pegar os dois comprimentos/acabamentos), o m² de",
        "  Alvenaria (Vedação/Estrutural) duplicava, pois cada",
        "  lançamento contava a alvenaria de novo",
        "SOLUÇÃO: o módulo agora tem duas abas independentes, dentro",
        "  da mesma árvore de locais:",
        "  → 🧱 Alvenaria: a parede física, lançada 1 vez só",
        "  (Vedação ou Estrutural, com vão e ML). Sem Lado A/Lado B",
        "  — alvenaria não muda por face",
        "  → 🎨 Acabamento de Paredes: cada FACE lançada separada,",
        "  com seu próprio comprimento/altura, mistura de gesso/",
        "  reboco/revestimento por %, pintura por %, vão e ML.",
        "  O conceito de \"Lado A/Lado B\" foi removido — cada",
        "  lançamento já é uma face, não precisa mais duplicar",
        "  internamente",
        "Reaproveita a mesma árvore de Locais para as duas abas",
        "  (Torre → Andar → Apto → Cômodo), incluindo Clonar Local",
        "  (clona sublocais + alvenaria + acabamento juntos)",
        "Configurações de Cálculo (⚙️) agora valem para as duas",
        "  abas: desconto de vão (5 modos) e Metro Linear",
        "ATENÇÃO: dados do modelo anterior (paredes com Lado A/B)",
        "  foram descontinuados a pedido — Milton confirmou que",
        "  ainda está em fase de testes e prefere recomeçar do zero",
        "  nas duas coleções novas (paredesAlvenariaPecas e",
        "  paredesAcabamentoPecas) em vez de migrar os dados antigos"
      ]
    },
    {
      "versao": "V2.8.2.4",
      "legado": "V2.20.1",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Paredes: ordem alfabética, clonar entre locais, ML por categoria e novo modo de vão",
      "itens": [
        "Locais (árvore) e Faces/Paredes lançadas agora aparecem em",
        "  ordem alfabética em todas as listas e tabelas",
        "CLONAR mudou de comportamento: em vez de criar uma cópia do",
        "  local (duplicar), agora clona as peças de OUTRO local já",
        "  existente para dentro do local selecionado — igual ao",
        "  Levantamento de Fachada. Se o local de destino já tiver",
        "  peças, elas são substituídas pelas peças clonadas (com",
        "  confirmação antes de substituir)",
        "Metro Linear agora é detalhado por categoria em vez de um",
        "  número só: painel \"📏 Metro Linear por Categoria\" mostra",
        "  m² sem ML / ML / m² com ML equivalente separado por",
        "  Vedação e Estrutural (aba Alvenaria) e por Gesso Liso,",
        "  Reboco, Revestimento de Parede e Pintura (aba Acabamento)",
        "  — cada categoria com seu próprio percentual de ML de",
        "  acordo com a mistura de acabamento da face",
        "\"Revestimento\" renomeado para \"Revestimento de Parede\" em",
        "  todo o módulo (seletor de acabamento, cards, resumos)",
        "Configurações de Cálculo: novo modo de vão \"Limite Total\" —",
        "  vãos maiores que X m² descontam 100% da área; vãos",
        "  menores que X não descontam nada"
      ]
    },
    {
      "versao": "V2.9.0",
      "legado": "V2.21.0",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "funcionalidade",
      "titulo": "Novo módulo: Levantamento de Piso (medição sobre PDF)",
      "itens": [
        "Novo módulo Levantamento de Piso, independente (levantamento-piso.html)",
        "Fluxo por PDF em vez de digitar m² manualmente:",
        "  1) Envia a planta em PDF (armazenada no Firebase Storage)",
        "  2) Escolhe qual página do PDF vira cada Pavimento",
        "  3) Calibra a escala desenhando uma linha sobre uma medida",
        "     conhecida do desenho e informando a distância real em metros",
        "  4) Com a escala calibrada, desenha polígonos direto sobre a",
        "     planta para medir cada área de piso",
        "Cada polígono gera uma Área independente com nome, m² calculado",
        "  automaticamente (fórmula de Shoelace), tipo de piso, tipo de",
        "  contrapiso e impermeabilização (com tipo, quando marcada)",
        "Coordenadas de calibração e polígonos guardadas em espaço",
        "  ponto-PDF (independente do zoom de renderização em tela),",
        "  então a escala nunca se perde ao redimensionar",
        "PDF renderizado via pdf.js (carregado dinamicamente via CDN,",
        "  mesmo padrão de _ls usado para xlsx e html2canvas)",
        "Painel lateral com lista de áreas medidas e totais por pavimento",
        "Dados: obras/{obraId}/pisoPlantas, pisoPavimentos, pisoAreas",
        "Card \"🧩 Piso\" adicionado ao hub de Levantamentos"
      ]
    },
    {
      "versao": "V2.9.1",
      "legado": "V2.21.1",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "correcao",
      "titulo": "Levantamento de Piso: corrigido erro de CORS ao ler o PDF",
      "itens": [
        "Corrigido: pdf.js buscava a URL do Firebase Storage direto e usava",
        "  cabeçalho Range (streaming), o que disparava um preflight OPTIONS",
        "  bloqueado por CORS (bucket sem CORS configurado para Range)",
        "Agora o PDF é baixado com um fetch simples (GET puro, sem headers",
        "  extras) e os bytes são entregues prontos ao pdf.js — não depende",
        "  de configurar CORS no bucket do Storage"
      ]
    },
    {
      "versao": "V2.9.2",
      "legado": "V2.21.2",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "correcao",
      "titulo": "Levantamento de Piso: proxy serverless para ler o PDF (CORS definitivo)",
      "itens": [
        "O Firebase Storage não libera CORS para fetch()/XHR por padrão",
        "  (funciona sem CORS só em <img>/<embed>), então o fetch direto do",
        "  navegador continuava bloqueado mesmo em GET simples",
        "Nova função serverless api/pdf-proxy.js: busca o PDF no servidor",
        "  (sem restrição de CORS) e devolve pro navegador a partir do",
        "  mesmo domínio — não depende de configurar CORS no bucket",
        "Só aceita URLs do bucket controle-absoluta.firebasestorage.app",
        "  (evita virar um proxy aberto para qualquer URL da internet)",
        "js/levantamento-piso.js agora busca o PDF via /api/pdf-proxy?url=..."
      ]
    },
    {
      "versao": "V2.9.2.1",
      "legado": "V2.22.0",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Piso: reestruturado para árvore de locais (igual Paredes)",
      "itens": [
        "Reestruturado para o mesmo formato de menu do Levantamento de",
        "  Paredes: árvore de locais ilimitada em profundidade (ex: Torre >",
        "  Andar > Apto > Cômodo), em vez do fluxo linear Plantas > Páginas",
        "Cada NÓ da árvore pode ter uma página de PDF vinculada (em vez de",
        "  lançar as peças manualmente como em Paredes) — a partir dela",
        "  calibra-se a escala e mede-se os polígonos daquele local",
        "PDFs enviados ficam numa biblioteca reaproveitável entre vários",
        "  nós — a mesma planta arquitetônica pode ser vinculada a",
        "  diferentes locais, cada um usando a página correspondente",
        "Painel de \"Visão Geral\" (raiz da árvore) mostra totais gerais e",
        "  a biblioteca de plantas enviadas, com opção de excluir as que",
        "  não estão mais vinculadas a nenhum local",
        "Botão \"Trocar planta/página\" no local para religar a outra",
        "  página ou outra planta sem perder as áreas já medidas",
        "Removida a coleção pisoPavimentos — o vínculo de PDF (plantaId,",
        "  página, escala, linha de calibração) agora vive dentro do",
        "  próprio nó da árvore, salvo em obras/{id}/config/pisoArvore",
        "  (mesmo padrão do paredesArvore)",
        "obras/{obraId}/pisoAreas agora referencia nodeId em vez de",
        "  pavimentoId"
      ]
    },
    {
      "versao": "V2.9.2.2",
      "legado": "V2.22.1",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Piso: navegação estilo CAD (zoom e pan)",
      "itens": [
        "Roda do mouse: zoom in/out centralizado exatamente no cursor",
        "  (igual AutoCAD/visualizadores de CAD)",
        "Pan (mover a planta): botão do meio do mouse sempre funciona;",
        "  clique+arraste com o botão esquerdo também move a planta",
        "  quando não está no modo Calibrar/Medir",
        "Botões de zoom (➖ / percentual / ➕) na barra de ferramentas do",
        "  pavimento, com percentual atual exibido",
        "Zoom aplicado via CSS por cima do canvas já renderizado (mantém",
        "  os polígonos e a linha de calibração perfeitamente alinhados",
        "  em qualquer nível de zoom, sem precisar re-renderizar o PDF)",
        "Conversão de clique para coordenada do PDF agora usa o tamanho",
        "  real exibido em tela (funciona corretamente em qualquer zoom,",
        "  não só na escala inicial de ajuste à largura)",
        "Zoom é lembrado durante a sessão de trabalho no mesmo local",
        "  (não reseta ao calibrar, medir ou editar uma área) e só volta",
        "  a 100% quando você troca de local na árvore"
      ]
    },
    {
      "versao": "V2.9.3",
      "legado": "V2.22.2",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "correcao",
      "titulo": "Levantamento de Piso: mais espaço pra planta + zoom sem perder qualidade",
      "itens": [
        "Área de trabalho da planta muito maior: cabeçalho e avisos",
        "  compactados, árvore de locais mais estreita (220px) e agora",
        "  recolhível (botão \"⏴\" / \"☰ Locais\") pra usar quase a tela",
        "  inteira quando estiver medindo",
        "Canvas e painel lateral agora ocupam a altura real da tela",
        "  disponível (calc baseado em 100vh) em vez de uma altura fixa",
        "  pequena",
        "Corrigido: o zoom era só CSS esticando a imagem já renderizada,",
        "  perdendo nitidez ao ampliar. Agora, depois de um instante sem",
        "  mexer no zoom, o PDF é re-renderizado automaticamente na",
        "  resolução efetiva atual (debounced, não a cada tique da roda",
        "  do mouse) — mantém a planta nítida em qualquer nível de zoom",
        "Teto de zoom aumentado (até 800%) já que agora mantém qualidade"
      ]
    },
    {
      "versao": "V2.9.3.1",
      "legado": "V2.22.3",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Piso: modo tela cheia + corrige travamento ao arrastar em zoom alto",
      "itens": [
        "Novo botão \"⛶ Tela cheia\" no local vinculado a uma planta: abre a",
        "  planta num overlay cobrindo a tela inteira (não é um modal",
        "  cortado) — muito mais espaço pra calibrar e medir",
        "Tecla Esc também sai da tela cheia (quando não está no meio de",
        "  um desenho)",
        "Corrigido: arrastar (pan) travando/engasgando em zoom alto —",
        "  o movimento agora é sincronizado com requestAnimationFrame em",
        "  vez de recalcular a cada evento do mouse (que dispara mais",
        "  rápido do que a tela consegue desenhar)",
        "Limite de segurança no tamanho do canvas re-renderizado em alta",
        "  resolução (máx. 4096px de largura) — evita ficar pesado demais",
        "  pra arrastar/pintar em zooms muito extremos",
        "Teto de zoom ajustado para 600% (consistente com o limite de",
        "  re-renderização em alta resolução, mantendo a nitidez em",
        "  qualquer nível permitido)"
      ]
    },
    {
      "versao": "V2.9.4",
      "legado": "V2.22.4",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "correcao",
      "titulo": "Levantamento de Piso: corrige impossibilidade de arrastar em zoom alto (bug clássico de flexbox)",
      "itens": [
        "Causa raiz encontrada: o container do canvas usava flexbox com",
        "  justify-content:center para centralizar a planta. É um bug",
        "  conhecido do CSS — quando o conteúdo fica maior que o container",
        "  (zoom alto), o navegador não consegue rolar até o lado que",
        "  \"vaza\" da centralização, travando o arrastar bem antes do fim",
        "  real da imagem, especialmente em plantas grandes/detalhadas",
        "Trocado o container para layout em bloco normal (sem flexbox),",
        "  com a planta centralizada via margin:auto — isso centraliza",
        "  quando cabe na tela, mas não trava a rolagem quando o zoom",
        "  deixa a planta maior que a área visível",
        "Agora dá pra arrastar até qualquer canto da planta em qualquer",
        "  nível de zoom, mesmo em PDFs grandes e muito detalhados"
      ]
    },
    {
      "versao": "V2.9.4.1",
      "legado": "V2.23.0",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Piso: áreas na árvore com visão, ML de rodapé, m² contrapiso/impermeabilização",
      "itens": [
        "Áreas medidas agora aparecem como itens na árvore de locais,",
        "  logo abaixo do pavimento onde foram medidas — sempre visíveis",
        "  (não escondidas atrás do collapse), com o m² de cada uma",
        "Clicar numa área da árvore agora dá uma \"visão\": seleciona o",
        "  local (se necessário), centraliza a planta nela e destaca o",
        "  polígono por alguns segundos — fácil de achar qualquer área",
        "  já medida, mesmo que tenha sido lançada no local errado",
        "Novo recurso: ML de Rodapé — depois de fechar o polígono da",
        "  área, um novo passo permite clicar em cada parede (aresta do",
        "  polígono) que tem rodapé; o sistema soma o comprimento real",
        "  (via escala) só das paredes marcadas",
        "Rodapé de uma área já salva pode ser reeditado a qualquer",
        "  momento (botão \"🦶 Editar Rodapé\" no modal da área)",
        "Trechos com rodapé ficam marcados com um traço roxo grosso",
        "  em cima da parede correspondente, direto na planta",
        "Totais do pavimento agora mostram separadamente: M² de Piso,",
        "  M² de Contrapiso (soma das áreas com tipo de contrapiso",
        "  preenchido), M² de Impermeabilização (soma das áreas",
        "  marcadas) e ML de Rodapé total",
        "Cards de área na lateral também mostram o ML de rodapé quando",
        "  houver"
      ]
    },
    {
      "versao": "V2.9.5",
      "legado": "V2.23.1",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "correcao",
      "titulo": "Levantamento de Piso: corrige área salva no local errado + clique na árvore abre edição",
      "itens": [
        "Corrigido na raiz: o local (nodeId) da área agora é capturado no",
        "  exato momento em que o polígono é fechado, em vez de reler a",
        "  seleção da árvore só quando o usuário clica em \"Salvar\" — evita",
        "  a área cair num local diferente do que estava aberto ao medir",
        "Ao salvar, o sistema agora navega direto para o local onde a",
        "  área realmente foi gravada, mesmo que a seleção na árvore",
        "  tenha mudado nesse meio tempo",
        "Clicar numa área na árvore agora também abre a edição das",
        "  informações dela, além de centralizar e destacar na planta",
        "Novo: botão \"Mover esta área para outro local\" no modal de",
        "  edição — caso uma área tenha ficado no local errado, dá pra",
        "  corrigir direto, sem precisar excluir e remedir"
      ]
    },
    {
      "versao": "V2.9.5.1",
      "legado": "V2.24.0",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Piso: clonar/multiplicar pavimento + filtro de áreas",
      "itens": [
        "Novo botão \"⧉ Clonar/Multiplicar\" no local vinculado a uma",
        "  planta: copia todas as áreas medidas dele (m², tipo de piso,",
        "  contrapiso, impermeabilização, rodapé) para um ou vários",
        "  outros locais de uma vez — pensado pra pavimento tipo repetido",
        "  em vários andares da torre",
        "M² e ML de rodapé são recalculados na escala de cada local de",
        "  destino (a geometria do polígono é a mesma; só a escala pode",
        "  mudar entre locais)",
        "Se o destino já tiver áreas medidas, avisa antes de substituir",
        "Novo campo de busca na lista de áreas do local (filtra por nome",
        "  ou tipo de piso/contrapiso, sem precisar recarregar a planta)"
      ]
    },
    {
      "versao": "V2.9.6",
      "legado": "V2.24.1",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "correcao",
      "titulo": "Levantamento de Piso: dá pra minimizar a lista de áreas de um local sem fechar o pai",
      "itens": [
        "Corrigido: as áreas medidas de um local (ex: \"1º Pavimento\")",
        "  ficavam sempre abertas na árvore, e só dava pra escondê-las",
        "  fechando o local pai inteiro (ex: \"Torre\") — o que também",
        "  escondia os outros sublocais",
        "Agora cada local tem seu próprio collapse: clicar nele (ou na",
        "  seta ▶/▼) minimiza/expande só a lista de áreas dele, sem",
        "  mexer no local pai nem nos outros sublocais",
        "A seta de expandir agora aparece também em locais que só têm",
        "  áreas medidas (sem sublocais) — antes só aparecia quando",
        "  havia sublocais cadastrados"
      ]
    },
    {
      "versao": "V2.9.6.1",
      "legado": "V2.24.2",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Piso: Visão Geral agora é um dashboard completo",
      "itens": [
        "Visão Geral reformulada para mostrar tudo consolidado de toda",
        "  a obra: total de áreas, M² de Piso, M² de Contrapiso, M² de",
        "  Impermeabilização e ML de Rodapé",
        "M² por Tipo de Piso, por Tipo de Contrapiso e por Tipo de",
        "  Impermeabilização — soma agrupada por tipo, ordenada do maior",
        "  para o menor",
        "Tabela geral com todas as áreas medidas em todos os locais:",
        "  local, nome, m² de piso, tipo de piso, contrapiso,",
        "  impermeabilização e ML de rodapé — clicar numa linha leva",
        "  direto pra ela na planta (mesma \"visão\" da árvore)",
        "Biblioteca de plantas continua listada logo abaixo"
      ]
    },
    {
      "versao": "V2.9.7",
      "legado": "V2.24.3",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "correcao",
      "titulo": "Levantamento de Piso: Visão Geral com o mesmo acabamento visual dos outros levantamentos",
      "itens": [
        "Refeita a Visão Geral usando os mesmos componentes visuais já",
        "  usados no Levantamento de Concreto e Paredes: cards de KPI",
        "  coloridos (cc-kpi) em vez das caixinhas cruas de antes",
        "M² por Tipo de Piso/Contrapiso/Impermeabilização agora aparecem",
        "  como barras de progresso (maior valor primeiro), não mais",
        "  tabela simples",
        "Tabela de todas as áreas trocada pela tabela padrão do sistema",
        "  (cabeçalho escuro fixo, zebra no hover, linha de total no",
        "  rodapé) — a mesma usada em todo o resto do sistema"
      ]
    },
    {
      "versao": "V2.9.8",
      "legado": "V2.24.4",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "correcao",
      "titulo": "Levantamento de Piso: corrige scroll interno minúsculo na Visão Geral",
      "itens": [
        "Corrigido: a altura fixa aplicada ao layout (pensada pra tela de",
        "  medição com o canvas) também estava sendo aplicada à Visão",
        "  Geral, espremendo tudo numa altura de tela e criando um scroll",
        "  interno minúsculo que cortava a tabela em poucas linhas",
        "Agora essa altura fixa só se aplica quando o local selecionado",
        "  tem planta vinculada (tela de medição de verdade). Na Visão",
        "  Geral e nas telas sem planta, o conteúdo flui inteiro na",
        "  página normalmente, sem scroll interno cortado"
      ]
    },
    {
      "versao": "V2.9.9",
      "legado": "V2.24.5",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "correcao",
      "titulo": "Levantamento de Piso: remove de vez o scroll interno cortado fora da tela de medição",
      "itens": [
        "A correção anterior tirou a altura fixa, mas o painel e a",
        "  árvore ainda tinham overflow-y:auto sempre ligado (herdado do",
        "  estilo genérico), o que continuava criando um scroll interno",
        "  minúsculo mesmo sem altura forçada",
        "Agora, fora da tela de medição (Visão Geral, vincular planta),",
        "  esse overflow interno é removido de vez — o conteúdo (tabela,",
        "  cards, árvore de locais) flui até o fim de verdade, e quem",
        "  rola é a página inteira, como deveria ser desde o início"
      ]
    },
    {
      "versao": "V2.9.9.1",
      "legado": "V2.25.0",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Piso: corrige áreas sumindo da árvore + mover/copiar várias áreas de uma vez",
      "itens": [
        "Corrigido: clicar num local pra selecioná-lo (e abrir a tela de",
        "  medição) também estava expandindo/recolhendo a lista de áreas",
        "  dele — um clique fazia duas coisas ao mesmo tempo, e por isso",
        "  as áreas \"sumiam\" sem querer",
        "Agora selecionar o local (clicar nele) e expandir/recolher a",
        "  lista de áreas (clicar na seta ▶/▼) são ações separadas",
        "Locais agora começam expandidos por padrão ao abrir o módulo —",
        "  o collapse manual continua disponível, mas só quando você",
        "  realmente clicar na seta pra fechar",
        "Novo: seleção múltipla de áreas — cada área na lista tem uma",
        "  caixinha de marcar, mais um \"Selecionar todas\"",
        "Com uma ou mais áreas marcadas, aparece uma barra com opção de",
        "  escolher o local de destino e \"➜ Mover\" (envia as áreas",
        "  marcadas para outro local) ou \"⧉ Copiar\" (duplica lá, mantendo",
        "  as originais) — não precisa remedir nada",
        "M² e ML de rodapé são recalculados na escala do destino, igual",
        "  já acontecia no clonar de pavimento inteiro"
      ]
    },
    {
      "versao": "V2.9.10",
      "legado": "V2.25.1",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "correcao",
      "titulo": "Levantamento de Piso: corrige seta de expandir local \"travada\" (não reagia ao clique)",
      "itens": [
        "Corrigido: depois de separar o clique de \"selecionar local\" do",
        "  clique de \"expandir/recolher\" (seta ▶/▼), a seta passou a só",
        "  guardar o novo estado internamente, mas não redesenhava a",
        "  árvore — resultado: clicar pra reabrir um local fechado",
        "  parecia travado, não acontecia nada na tela",
        "Agora a seta atualiza a árvore imediatamente ao clicar, sem",
        "  precisar de nenhuma outra ação pra \"destravar\"",
        "Revisado todo o fluxo da árvore de locais (selecionar, expandir,",
        "  criar, renomear, excluir, auto-expandir no primeiro acesso) —",
        "  tudo consistente e testado antes de publicar",
        "Bônus: esse ajuste também deixou o clique na seta mais rápido,",
        "  já que agora só atualiza a árvore em vez de recarregar a",
        "  planta inteira à toa"
      ]
    },
    {
      "versao": "V2.9.11",
      "legado": "V2.25.2",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "correcao",
      "titulo": "Levantamento de Piso: nome do local não corta mais com \"...\"",
      "itens": [
        "Corrigido: nomes de locais mais longos (ex: \"APARTAMENTO...\")",
        "  apareciam cortados com reticências na árvore",
        "Agora o nome quebra linha e aparece por inteiro, em vez de",
        "  truncar",
        "Árvore de locais um pouco mais larga (250px) pra acomodar nomes",
        "  maiores com menos quebras de linha",
        "Adicionado tooltip com o nome completo ao passar o mouse, como",
        "  reforço"
      ]
    },
    {
      "versao": "V2.9.12",
      "legado": "V2.25.3",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "correcao",
      "titulo": "Levantamento de Piso: botão de excluir local sem estilo (feio) + botões desalinhados ao passar o mouse",
      "itens": [
        "Encontrado: o botão de excluir local (✕) nunca teve estilo",
        "  próprio no CSS — aparecia com a aparência crua padrão do",
        "  navegador, feio e destoando do resto do sistema",
        "Agora tem o mesmo acabamento do botão de renomear (✎), com",
        "  cor vermelha (faz sentido pra uma ação de excluir) e destaque",
        "  suave ao passar o mouse",
        "Corrigido também: como o nome do local agora pode quebrar linha,",
        "  os botões de renomear/excluir ficavam soltos/desalinhados ao",
        "  passar o mouse por cima. Agora ficam fixos no canto superior",
        "  direito do card, sem depender de quantas linhas o nome ocupa"
      ]
    },
    {
      "versao": "V2.9.12.1",
      "legado": "V2.26.0",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Piso: mover/clonar/copiar movidos pro menu de locais (esquerda), igual os outros levantamentos",
      "itens": [
        "Corrigido o motivo de não conseguir mover as áreas para um",
        "  sublocal recém-criado (ex: Apartamento 1): o seletor de",
        "  destino só listava locais que já tinham planta vinculada —",
        "  um sublocal novo criado só pra organizar não tinha, e por",
        "  isso nunca aparecia como opção. Mover não depende disso;",
        "  agora TODOS os locais aparecem como destino possível",
        "Tirado do painel principal (onde só ocupava espaço) e movido",
        "  pro menu de locais à esquerda, igual os outros levantamentos:",
        "  botão \"⧉\" pra clonar/multiplicar direto no local, checkbox em",
        "  cada área da árvore, e barra de mover/copiar logo abaixo do",
        "  cabeçalho \"Locais\"",
        "Botão \"☑\" no cabeçalho dos Locais seleciona de uma vez todas as",
        "  áreas visíveis na árvore, de qualquer local, pra mover/copiar",
        "  em lote sem precisar abrir cada uma",
        "Painel principal (à direita) voltou a ficar limpo, só com a",
        "  lista de áreas do local aberto e a busca — sem os controles",
        "  de seleção em massa ocupando espaço ali"
      ]
    },
    {
      "versao": "V2.9.13",
      "legado": "V2.26.1",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "correcao",
      "titulo": "Levantamento de Piso: corrige nome das áreas quebrando letra por letra + planta \"se multiplica\" ao mover",
      "itens": [
        "Corrigido: nome das áreas na árvore estava quebrando letra por",
        "  letra (\"Ba/nh/eir/o...\"). Causa: o espaço reservado pros",
        "  botões de ação (clonar/renomear/excluir) estava sendo aplicado",
        "  também nas linhas de área, que não têm esses botões — sobrava",
        "  quase nenhuma largura pro nome",
        "Áreas não usam mais esse espaço reservado, e a quebra de linha",
        "  ficou mais suave (só quebra entre palavras; só quebra no meio",
        "  de uma palavra se ela realmente não couber sozinha)",
        "Novo: ao mover (ou copiar) uma área pra um local que ainda não",
        "  tem planta vinculada, ele herda automaticamente a mesma",
        "  planta/página/escala de onde a área veio — não precisa",
        "  vincular e recalibrar tudo de novo",
        "O local de origem nunca é afetado: continua com a própria",
        "  planta e com as demais áreas que ficaram lá",
        "Mesmo comportamento aplicado no mover individual (modal da",
        "  área) e no Clonar/Multiplicar Pavimento inteiro"
      ]
    },
    {
      "versao": "V2.9.14",
      "legado": "V2.26.2",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "correcao",
      "titulo": "Levantamento de Piso: simplifica nome do local (corta com \"...\", igual os outros levantamentos) + tira o ícone de esquadro",
      "itens": [
        "Voltado ao padrão simples usado em todos os outros levantamentos:",
        "  nome muito grande corta com \"...\" em vez de quebrar linha (a",
        "  quebra de linha dava problema em nomes de uma palavra só,",
        "  tipo \"APARTAMENTO\")",
        "O nome completo continua disponível ao passar o mouse (tooltip)",
        "Trocado o ícone de esquadro (📐) das áreas na árvore por um",
        "  quadrado simples e discreto — menos poluído visualmente",
        "Ícone do card \"Total de Áreas\" na Visão Geral também trocado"
      ]
    },
    {
      "versao": "V2.9.15",
      "legado": "V2.26.3",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "correcao",
      "titulo": "Levantamento de Piso: corrige seleção de áreas se perdendo com um clique quase certeiro",
      "itens": [
        "Causa: a caixinha de marcar era muito pequena — um clique",
        "  levemente fora dela caía no local em vez da caixinha, abrindo",
        "  a área clicada. Como abrir uma área redesenha a árvore do",
        "  zero, todas as outras caixinhas já marcadas eram perdidas",
        "  silenciosamente",
        "Corrigido: a seleção agora fica guardada à parte (não só na",
        "  caixinha em si), então sobrevive a qualquer redesenho da",
        "  árvore — mesmo que um clique errado abra outra área no meio",
        "  do processo, o que já estava marcado continua marcado",
        "Área de clique da caixinha aumentada (de ~13px pra 22px) pra",
        "  ficar bem mais fácil de acertar"
      ]
    },
    {
      "versao": "V2.9.15.1",
      "legado": "V2.27.0",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Piso: nome completo na árvore (largura maior), aviso de exclusão bem mais claro, e clonar como novo local \"ao lado\"",
      "itens": [
        "Árvore bem mais larga (320px) e nome do local volta a quebrar",
        "  linha e aparecer por inteiro — dessa vez com espaço de sobra",
        "  reservado pros botões de ação, sem espremer o texto",
        "Aviso de exclusão de local bem mais claro: lista pelo nome cada",
        "  sublocal que também será apagado junto (com a contagem de",
        "  áreas de cada um), e o total geral de áreas que serão",
        "  perdidas — pra nunca mais excluir um local sem perceber que",
        "  ele tinha sublocais com dados dentro",
        "Novo no Clonar/Multiplicar: campo \"Criar um novo local ao lado",
        "  e clonar pra lá\" — cria um local irmão (no mesmo nível da",
        "  árvore) já com as áreas clonadas, em vez de só poder copiar",
        "  para um local já existente",
        "Texto desatualizado corrigido no Clonar/Multiplicar e no mover",
        "  individual (não exigem mais planta vinculada no destino)"
      ]
    },
    {
      "versao": "V2.9.16",
      "legado": "V2.27.1",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "correcao",
      "titulo": "Levantamento de Piso: corrige desenho do projeto ficando com escala diferente da área medida",
      "itens": [
        "Causa raiz encontrada: uma condição de corrida. Ao mover/copiar",
        "  áreas, o sistema disparava duas renderizações da planta quase",
        "  ao mesmo tempo (uma ao recarregar os dados, outra ao trocar de",
        "  local) — e elas podiam se atropelar, deixando o desenho de",
        "  fundo (a planta em si) numa escala de tela diferente da usada",
        "  pelo contorno da área desenhada por cima",
        "Importante: os dados medidos (m², rodapé etc.) nunca foram",
        "  afetados — o problema era só visual, na exibição em tela",
        "Corrigido com um controle de renderização: se uma renderização",
        "  mais nova começar enquanto uma mais antiga ainda está em",
        "  andamento, a mais antiga aborta em vez de terminar e bagunçar",
        "  o estado — assim o desenho de fundo e o contorno da área",
        "  sempre ficam na mesma escala de tela",
        "Mesma proteção aplicada também na re-renderização em alta",
        "  resolução (ao dar zoom)"
      ]
    },
    {
      "versao": "V2.9.17",
      "legado": "V2.27.2",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "correcao",
      "titulo": "Levantamento de Piso: Visão Geral mais limpa (menos cards, ícones que quebravam corrigidos)",
      "itens": [
        "Removidos os cards \"Total de Áreas\" e \"Locais c/ Planta\" — a",
        "  Visão Geral agora foca só no que importa: M² de Piso, M² de",
        "  Contrapiso, M² de Impermeabilização e ML de Rodapé",
        "Corrigido: alguns emojis (🧱 e 🪨) apareciam como quadrado",
        "  quebrado em alguns computadores/navegadores — trocados por",
        "  indicadores coloridos simples que sempre aparecem certinho",
        "Com menos cards na fileira de cima, cada um ficou mais largo —",
        "  não corta mais o texto (\"M² IMPERMEABILIZAÇÃO\" não invade",
        "  mais o card ao lado)"
      ]
    },
    {
      "versao": "V2.9.17.1",
      "legado": "V2.28.0",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Piso: Visão Geral com seletor de nível (ver por Torre, Pavimento ou Apartamento)",
      "itens": [
        "Removida a tabela \"Todas as Áreas Medidas\" da Visão Geral",
        "Novo seletor \"Ver dados de\" na Visão Geral: escolha qualquer",
        "  local da árvore (Torre, um Pavimento específico, um",
        "  Apartamento etc.) e os totais/M² por tipo mostrados são",
        "  recalculados só com os dados daquele local e dos sublocais",
        "  dele — não precisa mais olhar só o total geral da obra",
        "Opção \"Toda a obra\" continua disponível pra ver o consolidado",
        "  geral, como era antes"
      ]
    },
    {
      "versao": "V2.9.17.2",
      "legado": "V2.28.1",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "melhoria",
      "titulo": "Levantamento de Piso: acabamento visual alinhado com o Levantamento de Fachada",
      "itens": [
        "Árvore de locais agora usa o mesmo visual escuro do Levantamento",
        "  de Fachada (cabeçalho \"Locais\" com fundo escuro, itens da",
        "  árvore com cores ajustadas pro tema escuro) — antes usava um",
        "  visual claro diferente do resto do sistema",
        "Cards de M² de Piso/Contrapiso/Impermeabilização/Rodapé na Visão",
        "  Geral trocados pelo mesmo estilo simples e limpo usado no",
        "  \"Resumo Geral\" da Fachada (label em cima, valor grande embaixo,",
        "  sem bolha de ícone) em vez do estilo com ícone colorido usado",
        "  antes"
      ]
    },
    {
      "versao": "V2.9.18",
      "legado": "V2.28.2",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "correcao",
      "titulo": "Levantamento de Piso: corrige conteúdo espremido numa coluna estreita ao recolher a árvore",
      "itens": [
        "Corrigido: ao clicar em \"Recolher árvore\", o conteúdo (Visão",
        "  Geral, tela de medição etc.) continuava espremido numa coluna",
        "  estreita à esquerda, com um monte de espaço vazio sobrando —",
        "  em telas mais estreitas isso ficava bem ruim",
        "Agora, com a árvore recolhida, o painel principal passa a",
        "  ocupar 100% da largura disponível de forma direta, sem",
        "  depender de um cálculo de grade que podia falhar em telas",
        "  estreitas"
      ]
    },
    {
      "versao": "V2.9.19",
      "legado": "V2.28.3",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "correcao",
      "titulo": "Levantamento de Piso: corrige botão \"Locais\" flutuando por cima do título",
      "itens": [
        "Corrigido: o botão \"☰ Locais\" (pra reabrir a árvore recolhida)",
        "  ficava flutuando fixo no canto, sobrepondo o título \"Visão",
        "  Geral\" e o texto embaixo dele",
        "Agora o botão faz parte do fluxo normal da página, sempre",
        "  acima do conteúdo, sem sobrepor nada"
      ]
    },
    {
      "versao": "V2.9.20",
      "legado": "V2.28.4",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "correcao",
      "titulo": "Levantamento de Piso: corrige letras claras demais na árvore (fundo escuro não estava aplicando)",
      "itens": [
        "Causa raiz encontrada: existem duas definições conflitantes da",
        "  classe usada no fundo da árvore — uma clara em modulos.css,",
        "  outra escura em layout.css. A clara estava vencendo por causa",
        "  da ordem de carregamento dos arquivos CSS do sistema",
        "Resultado: o texto claro (ajustado pro tema escuro) ficava",
        "  quase ilegível sobre um fundo branco, em vez de escuro",
        "Corrigido forçando o fundo escuro direto na página do Piso, com",
        "  força suficiente pra ganhar de qualquer uma das duas versões",
        "  conflitantes, não importa a ordem de carregamento"
      ]
    },
    {
      "versao": "V2.9.21",
      "legado": "V2.28.5",
      "status": "fechada",
      "data": "2026-07-13",
      "tipo": "correcao",
      "titulo": "Levantamento de Piso: corrige árvore toda escura (só o cabeçalho \"Locais\" deveria ser escuro)",
      "itens": [
        "A correção anterior foi longe demais: forcei o fundo escuro em",
        "  toda a árvore, quando no exemplo do Fachada só o cabeçalho",
        "  (\"Estrutura\") é escuro — a lista de locais embaixo é clara,",
        "  com texto escuro normal",
        "Corrigido: removido o tema escuro dos itens da árvore. Fundo da",
        "  lista fixado como branco explicitamente (não depende mais da",
        "  ordem de carregamento entre os dois arquivos CSS conflitantes)",
        "O cabeçalho \"Locais\" continua escuro, como deveria — isso já",
        "  funcionava certo sem precisar de nenhum ajuste"
      ]
    },
    {
      "versao": "V2.10.0",
      "legado": "V2.29.0",
      "status": "fechada",
      "data": "2026-07-14",
      "tipo": "funcionalidade",
      "titulo": "Novo módulo: Levantamento de Teto",
      "itens": [
        "Mesma arquitetura do Levantamento de Piso: árvore de locais",
        "  (Torre → Andar → Apto → Cômodo), planta em PDF por nó, calibração",
        "  de escala e medição de áreas desenhando polígonos sobre o desenho",
        "Cada área medida tem: Tipo de Dry Wall, Tipo de Placa de Gesso e",
        "  Pintura (mistura de cores por %, mesmo modelo do Levantamento de",
        "  Paredes — Acabamento: nome + cor + percentual da área, com soma",
        "  validada em 100%)",
        "ML de Tabica: mesma mecânica do ML de Rodapé do Piso — seleciona",
        "  as arestas do polígono que têm tabica direto na planta",
        "Clone/Multiplicar pavimento, busca/filtro de áreas, mover/copiar",
        "  áreas entre locais em lote — tudo reaproveitado do Piso",
        "Card \"🔲 Teto\" adicionado no hub de Levantamentos"
      ]
    },
    {
      "versao": "V2.10.1",
      "legado": "V2.29.1",
      "status": "fechada",
      "data": "2026-07-14",
      "tipo": "correcao",
      "titulo": "Levantamento de Teto: Drywall e Placa de Gesso viram opções exclusivas (antes dava pra preencher os dois ao mesmo tempo)",
      "itens": [
        "Os dois campos de tipo eram independentes e podiam ficar",
        "  preenchidos ao mesmo tempo, o que não faz sentido — um teto",
        "  é Drywall OU Placa de Gesso, nunca os dois juntos",
        "Trocado por um seletor \"Sistema de Forro\": Nenhum / Drywall /",
        "  Placa de Gesso — o campo de tipo correspondente só aparece",
        "  depois de escolher, e o outro é limpo automaticamente ao trocar",
        "KPI \"M² de Drywall\" adicionado na Visão Geral e no painel do",
        "  local (antes só existia o de Placa de Gesso)"
      ]
    },
    {
      "versao": "V2.10.2",
      "legado": "V2.29.2",
      "status": "fechada",
      "data": "2026-07-14",
      "tipo": "correcao",
      "titulo": "Levantamento de Teto: corrige \"Nova Área\" e \"Editar Tabica\" jogando o scroll da página lá pra cima",
      "itens": [
        "Causa: o botão clicado (\"Nova Área\" no toolbar, ou o modal",
        "  fechando pra abrir a edição de tabica) fica com foco no",
        "  momento em que a tela é redesenhada — e como o redesenho",
        "  recria os elementos do zero, o elemento com foco é destruído,",
        "  fazendo o navegador jogar o scroll do container pra o topo",
        "Corrigido guardando a posição de scroll do painel de conteúdo",
        "  antes de redesenhar e restaurando ela logo em seguida — a",
        "  tela agora fica onde estava em vez de pular pro topo"
      ]
    },
    {
      "versao": "V2.10.3",
      "legado": "V2.29.3",
      "status": "fechada",
      "data": "2026-07-14",
      "tipo": "correcao",
      "titulo": "Levantamento de Teto: corrige de vez o \"pular lá pra cima\" — era o pan da planta resetando, não o scroll da página",
      "itens": [
        "A correção anterior (V2.29.2) guardava o scroll do painel geral,",
        "  mas o problema de verdade era outro: o canvas da planta é",
        "  recriado do zero toda vez que a tela é redesenhada (depois de",
        "  Salvar, Nova Área, Confirmar Área, Confirmar Tabica), e o",
        "  navegador zera a posição de pan/scroll desse canvas novo",
        "Corrigido guardando a posição de pan de cada local separadamente",
        "  (atualizada a cada arrasto/scroll) e restaurando ela assim que",
        "  o canvas termina de ser recriado — agora fica exatamente onde",
        "  você deixou, mesmo depois de salvar várias áreas seguidas",
        "Trocar a planta/página de um local ou excluir o local limpa a",
        "  posição guardada dele (evita restaurar um pan sem sentido",
        "  numa planta diferente)"
      ]
    },
    {
      "versao": "V2.10.4",
      "legado": "V2.29.4",
      "status": "fechada",
      "data": "2026-07-14",
      "tipo": "correcao",
      "titulo": "Levantamento de Teto: achada a causa raiz de vez — não era só o pan, era o ZOOM que resetava a cada rebuild do canvas",
      "itens": [
        "Print a print com o usuário: confirmado que \"Finalizar Área\",",
        "  \"Confirmar Tabica\" etc. jogavam a visão pra um zoom bem menor",
        "  do que o usuário tinha configurado (ex: de 130% pra algo",
        "  bem menor), não só perdendo a posição",
        "Causa raiz: toda vez que o canvas é recriado do zero, o sistema",
        "  recalcula a escala \"auto-fit\" (100% = encaixar na largura do",
        "  painel) do zero — só que o zoom que o usuário tinha (zoomCss)",
        "  continuava sendo aplicado em cima dessa NOVA escala base, que",
        "  quase nunca é igual à escala base anterior. Resultado: o zoom",
        "  visual mudava sem querer a cada rebuild, mesmo sem o código",
        "  nunca ter mexido diretamente na variável de zoom",
        "Corrigido guardando o zoom EFETIVO (relativo ao PDF, não o",
        "  número cru) de cada local, e recalculando o zoomCss certo",
        "  toda vez que o canvas é reconstruído, pra manter o mesmo",
        "  nível visual de zoom em vez de herdar o valor antigo aplicado",
        "  sobre uma escala base diferente"
      ]
    },
    {
      "versao": "V2.10.5",
      "legado": "V2.29.5",
      "status": "fechada",
      "data": "2026-07-14",
      "tipo": "correcao",
      "titulo": "Levantamento de Teto: corrige planta ficando borrada/travada até dar zoom in/out manualmente",
      "itens": [
        "Efeito colateral da correção anterior (V2.29.4): ao restaurar o",
        "  zoom efetivo do usuário, o canvas nativo continua na resolução",
        "  baixa do auto-fit e é só esticado via CSS — o que deixa a",
        "  imagem borrada até o sistema re-renderizar em alta resolução",
        "Antes, esse re-render em alta resolução só disparava quando o",
        "  usuário mexia manualmente na roda do mouse ou nos botões de",
        "  zoom — nunca depois de \"Finalizar Área\", \"Confirmar Tabica\" etc.",
        "Corrigido disparando esse re-render em alta resolução sozinho",
        "  sempre que o zoom restaurado precisa de mais nitidez do que o",
        "  auto-fit recém-calculado oferece — sem precisar de zoom manual"
      ]
    },
    {
      "versao": "V2.10.6",
      "legado": "V2.30.0",
      "status": "fechada",
      "data": "2026-07-11",
      "tipo": "correcao",
      "titulo": "Busca corrigida (não travava mais) + vínculos com todos os levantamentos",
      "itens": [
        "BUSCA CORRIGIDA:",
        "  Causa: onBusca() chamava _render() internamente, que recriava",
        "  o DOM inteiro incluindo o campo de busca — ao recriar o input,",
        "  o cursor era perdido e a digitação \"travava\" após 1 caractere.",
        "  Fix: busca agora atualiza só _paintRows() (destaque visual) e",
        "  scroll — nunca mais _render(). O contador e o ✕ são atualizados",
        "  via getElementById() sem destruir o input.",
        "",
        "VÍNCULOS COM TODOS OS LEVANTAMENTOS:",
        "  Antes só existia o módulo Fachada no seletor de vínculo.",
        "  Agora disponíveis:",
        "  → Fachada: m² líquido, m²+ML equiv, Metro Linear, Vão Fechado",
        "  → Piso: Área (m²), Rodapé (ML)",
        "  → Teto/Forro: Área (m²), Tabica (ML)",
        "  → Paredes: Área líquida, m²+ML, ML, Vedação, Estrutural",
        "  → Concreto: Volume (m³)",
        "  → Ar-Condicionado: Qtd de equipamentos, BTUs total",
        "  Todos carregados em paralelo ao abrir o painel de vínculos.",
        "  _calcularMetrica() expandida com lógica real de cada módulo."
      ]
    },
    {
      "versao": "V2.10.7",
      "legado": "V2.30.1",
      "status": "fechada",
      "data": "2026-07-11",
      "tipo": "correcao",
      "titulo": "Vínculos: métricas reais de Piso, Teto, Paredes",
      "itens": [
        "PISO — 4 métricas (antes só 2):",
        "  → Área total de piso (m²)",
        "  → Contrapiso (m²) — áreas com tipoContrapiso preenchido",
        "  → Impermeabilização (m²) — áreas com impermeabilizacao=true",
        "  → Rodapé (ML)",
        "",
        "TETO — 5 métricas (antes só 2):",
        "  → Área total de teto (m²)",
        "  → Forro de Drywall (m²) — áreas com tipoDryWall preenchido",
        "  → Placa de Gesso (m²) — áreas com tipoPlacaGesso preenchido",
        "  → Tabica (ML)",
        "  → Pintura de teto (m²) — áreas com temPintura=true",
        "",
        "PAREDES — adicionada métrica Pintura de parede (m²)"
      ]
    },
    {
      "versao": "V2.11.0",
      "legado": "V2.31.0",
      "status": "fechada",
      "data": "2026-07-14",
      "tipo": "funcionalidade",
      "titulo": "Novo módulo: Levantamento de Pintura",
      "itens": [
        "Módulo novo, 100% consolidador — não lança área nova, é",
        "  alimentado pelos módulos de Paredes (aba Acabamento) e Teto.",
        "Tem árvore de locais própria (Torre > Andar > Apto > Cômodo).",
        "  Cada nó pode ser VINCULADO a 1 local de Paredes + 1 local de",
        "  Teto (árvores independentes — vínculo manual com busca).",
        "Ao vincular, soma automaticamente m² de pintura (parede + teto)",
        "  daquele local e sublocais, com dash por cor (barras) e KPIs.",
        "Edição de cor/% é feita DIRETO no mesmo documento que Paredes",
        "  e Teto usam (paredesAcabamentoPecas / tetoAreas) — 100%",
        "  sincronizado nos dois sentidos, sem duplicar dado.",
        "\"Aplicar em massa\": escolhe uma mistura de cor e aplica de",
        "  uma vez em todas as faces/áreas vinculadas a um local",
        "  (com opção de incluir sublocais).",
        "Visão Geral com total por cor, resumo por local e alerta de",
        "  locais ainda sem vínculo.",
        "Card novo em Levantamentos (hub).",
        "",
        "CORREÇÃO relacionada (vínculos do Planejamento):",
        "  Removido o stub \"Pintura (em desenvolvimento)\" com campos de",
        "  demão que tinha sido adicionado por engano — nunca fez parte",
        "  do escopo. A pintura sempre viveu dentro de Paredes e Teto.",
        "  Corrigido também um bug real: a métrica \"Pintura de parede\"",
        "  estava somando o array de cores como se fosse um número",
        "  (sempre resultava em NaN/0). Agora calcula a área líquida",
        "  real (comp×alt − vãos) × % de cada cor."
      ]
    },
    {
      "versao": "V2.11.0.1",
      "legado": "V2.31.0",
      "status": "fechada",
      "data": "2026-07-11",
      "tipo": "funcionalidade",
      "titulo": "Vínculos: seletor de área genérico por levantamento (árvore hierárquica real)",
      "itens": [
        "PROBLEMA CORRIGIDO: o seletor de \"Fonte estrutural\" mostrava",
        "  sempre a hierarquia da Fachada (fachada/balancim/vista) mesmo",
        "  ao selecionar Piso, Teto ou Paredes.",
        "",
        "SOLUÇÃO — seletor genérico por módulo:",
        "  → Fachada: mantém Fachada → Balancim → Vista (como antes)",
        "  → Piso / Teto / Paredes: lê a árvore hierárquica real do",
        "    levantamento (pisoArvore, tetoArvore, paredesArvore) e",
        "    exibe em <select> com indentação por nível. Ex: Torre →",
        "    Andar → Apartamento → Cômodo. Qualquer nó pode ser",
        "    selecionado; o cálculo soma todas as áreas dos filhos.",
        "  → Concreto / Ar-Cond / Pintura: não têm subdivisão por",
        "    área — mostram mensagem explicativa.",
        "",
        "Novo campo salvo: levantamentoNodeId — persiste qual nó da",
        "  árvore foi selecionado para cada vínculo.",
        "Ao trocar de módulo, o filtro de área é limpo automaticamente.",
        "Todos os módulos carregados em paralelo ao abrir o modal."
      ]
    },
    {
      "versao": "V2.11.1",
      "legado": "V2.31.1",
      "status": "fechada",
      "data": "2026-07-11",
      "tipo": "correcao",
      "titulo": "Vínculos: cálculo correto para Paredes (campos brutos) e Piso/Teto (booleanos)",
      "itens": [
        "PAREDES — causa do erro:",
        "  O módulo de Paredes salva os campos BRUTOS no Firestore",
        "  (comprimento, altura em cm, vaos[], tipoAlvenaria, pintura[]).",
        "  Os campos areaLiquida/ml/pintura NÃO são gravados — são",
        "  recalculados pelo módulo na hora de exibir.",
        "  O Planejamento tentava ler p.areaLiquida que sempre era 0.",
        "  Correção: replicas _calcParedeBruta() e _calcAcabBruta()",
        "  que recalculam localmente com desconto total de vão.",
        "",
        "PISO / TETO — causa do erro:",
        "  impermeabilizacao/temPintura são checkboxes: chegam como",
        "  boolean true ou string \"true\". Filtro anterior usava apenas",
        "  a.impermeabilizacao (truthy) — falha para string \"false\".",
        "  Correção: ===true || ===\"true\" explícito.",
        "  tipoContrapiso/tipoDryWall/tipoPlacaGesso: filtro agora",
        "  verifica !=\"\" além de existir.",
        "",
        "Filtro por nodeId unificado: usa _idsDescendentes() em vez",
        "  de String.startsWith (que era frágil com IDs aleatórios)."
      ]
    },
    {
      "versao": "V2.11.1.1",
      "legado": "V2.32.0",
      "status": "fechada",
      "data": "2026-07-15",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Ar Condicionado: locais em árvore ilimitada + Configuração de Máquinas com cálculo automático",
      "itens": [
        "Locais agora em árvore com profundidade ILIMITADA — pode criar",
        "  sublocal dentro de sublocal quantos níveis quiser (ex: Área",
        "  Comum > Pavimento 1 > Casa de Máquinas)",
        "Nova tela \"Configuração de Máquinas\" (⚙️ no topo do",
        "  Levantamento) com modelos Cobre (funcional), PEX (mesmo motor",
        "  do Cobre) e Duto (em breve)",
        "Para cada máquina configurada: diâmetro, perda fixa (cm) e",
        "  perda percentual (%), item principal (barra de cobre/PEX)",
        "  com conversão em rolo, itens vinculados (mesma metragem do",
        "  item principal, ex: espuma), itens por metro linear (regra",
        "  cm/ML ou un/ML, ex: fita, silver tape, bucha, parafuso,",
        "  broca) e itens manuais (ex: dreno, lançado na hora)",
        "Todo nome de item é editável e novos itens podem ser",
        "  adicionados livremente à configuração, cada um já com",
        "  regra de cálculo por ML própria",
        "Pré-visualização ao vivo do cálculo dentro da tela de",
        "  configuração (ML de teste ajustável)",
        "No Levantamento: \"+ Máquina\" lança uma máquina em um local —",
        "  basta informar o ML de projeto e as quantidades manuais",
        "  (dreno); o sistema calcula automaticamente todas as peças",
        "Resumo consolidado por local (incluindo sublocais) e Resumo",
        "  Geral por material, somando itens avulsos + máquinas",
        "  calculadas em toda a árvore",
        "Todo item de configuração (cobre, vinculados, por ML,",
        "  manuais) já nasce/mantém-se sincronizado com a biblioteca",
        "  de Materiais automaticamente"
      ]
    },
    {
      "versao": "V2.11.2",
      "legado": "V2.32.0",
      "status": "fechada",
      "data": "2026-07-11",
      "tipo": "correcao",
      "titulo": "Migração localStorage → Firestore (configs de obra não ficam mais presas no navegador)",
      "itens": [
        "PROBLEMA: configurações de cálculo da obra estavam no localStorage",
        "  do navegador — invisíveis para outros dispositivos/usuários,",
        "  perdidas ao limpar o cache, e inacessíveis ao Planejamento.",
        "",
        "MIGRADO para Firestore:",
        "  → Fachada: fachadaCfg_obraId → config/fachadaCfg",
        "     (modo de janela, valor fixo, limite ML, percentual ML)",
        "  → Paredes: paredesCfg_obraId → config/paredesConfig",
        "     (modo de vão, limite X, valor Y, limite ML, percentual ML)",
        "  → Concreto: concretoLevantamento_obraId → config/concretoLevantamento",
        "     (lista de peças do levantamento de concreto)",
        "",
        "MIGRAÇÃO AUTOMÁTICA: na primeira abertura após a atualização,",
        "  o sistema detecta dados antigos no localStorage, os move para",
        "  o Firestore, e apaga a chave local — sem perder nada.",
        "",
        "Planejamento: cfg da Fachada agora é carregada do Firestore",
        "  ao calcular métricas de vínculo (antes usava localStorage,",
        "  que ficava vazio em outro dispositivo/sessão)."
      ]
    },
    {
      "versao": "V2.11.3",
      "legado": "V2.32.1",
      "status": "fechada",
      "data": "2026-07-15",
      "tipo": "correcao",
      "titulo": "Levantamento de Ar Condicionado: correções de usabilidade (locais, diâmetro, layout, itens manuais, unidades)",
      "itens": [
        "CORRIGIDO: não era possível criar sublocal dentro de sublocal",
        "  (a opção só aparecia em nós já expandidos, e nós sem filhos",
        "  não tinham como expandir). Agora todo local tem um botão \"+\"",
        "  fixo para adicionar sublocal, em qualquer profundidade",
        "Diâmetro do cobre/PEX agora aceita mm OU polegada em fração",
        "  (ex: 5/8\") — botão de alternância na Configuração de Máquinas",
        "Corrigido layout dos Itens Vinculados e Itens por Metro Linear:",
        "  cabeçalho de coluna fixo, grid consistente e botão de remover",
        "  menor e alinhado (não quebra mais linha em telas estreitas)",
        "Itens Manuais saíram da Configuração de Máquinas — agora são",
        "  adicionados livremente na hora de lançar cada máquina",
        "  (busca na biblioteca ou cria material novo na hora), em vez",
        "  de depender de uma lista fixa pré-configurada",
        "Itens por Metro Linear (cm/ML) ganharam campo opcional",
        "  \"1 UN = X metros\" (ex: fita isolante 1 rolo = 100m) — o",
        "  cálculo agora informa quantas unidades comprar, além dos",
        "  metros totais, tanto na pré-visualização quanto no",
        "  Resumo do Levantamento (nova coluna \"Comprar\")"
      ]
    },
    {
      "versao": "V2.11.4",
      "legado": "V2.32.2",
      "status": "fechada",
      "data": "2026-07-15",
      "tipo": "correcao",
      "titulo": "Levantamento de Paredes: corrige Clonar e traz de volta o Duplicar Local",
      "itens": [
        "CORREÇÃO: \"Clonar de Outro Local\" não dava nenhum retorno",
        "  visível quando falhava (erro engolido silenciosamente).",
        "  Agora toda falha mostra um toast com o motivo e registra",
        "  no console para diagnóstico; também avisa claramente se",
        "  não existe nenhum outro local cadastrado pra clonar de",
        "Havia uma função duplicada no código (_acharArrayPai",
        "  declarada duas vezes) que foi limpa",
        "NOVO: \"📋 Duplicar Local\" — volta a existir ao lado do",
        "  \"⧉ Clonar de Outro Local\" (árvore, painel do local e",
        "  tabela de sublocais). Cria uma CÓPIA NOVA do local, com",
        "  todos os sublocais, paredes de alvenaria e faces de",
        "  acabamento, sem mexer no que já existe — diferente do",
        "  Clonar, que substitui o conteúdo do local de destino",
        "  pelas peças de outro local escolhido"
      ]
    },
    {
      "versao": "V2.11.5",
      "legado": "V2.32.3",
      "status": "fechada",
      "data": "2026-07-15",
      "tipo": "correcao",
      "titulo": "Levantamento de Pintura: \"Pintar em Lote\" não pintava mais tudo à força",
      "itens": [
        "CORREÇÃO GRAVE: o antigo \"Aplicar em massa\" trocava a cor de",
        "  TODOS os itens do local de uma vez, inclusive os que não",
        "  tinham pintura nenhuma — forçando temPintura=true em itens",
        "  que deveriam continuar sem pintura.",
        "Renomeado para \"🖌️ Pintar em Lote\" (nome antigo não dizia",
        "  nada sobre o que o botão fazia).",
        "Agora mostra a lista de itens do local com CHECKBOX individual",
        "  — a cor só é aplicada em quem estiver marcado.",
        "Padrão ao abrir: marca automaticamente só quem JÁ tinha",
        "  pintura (seguro). Botões \"Só já pintados\" / \"Todos\" /",
        "  \"Nenhum\" pra ajustar rápido a seleção.",
        "Aviso claro no topo do modal explicando que só os itens",
        "  marcados são alterados."
      ]
    },
    {
      "versao": "V2.12.0",
      "legado": "V2.33.0",
      "status": "fechada",
      "data": "2026-07-15",
      "tipo": "funcionalidade",
      "titulo": "Novo módulo: Tarefas do Sistema (To Do List)",
      "itens": [
        "Novo item \"✅ Tarefas\" no menu Sistema da sidebar (todas as",
        "  páginas).",
        "Lista de tarefas/roadmap do próprio sistema, para organização",
        "  pessoal — adicionar, editar (duplo clique ou ✎), concluir",
        "  (checkbox), reordenar (↑/↓) e excluir.",
        "Campo opcional \"Projeto\" por tarefa, com sugestões (datalist)",
        "  e filtro por projeto.",
        "Tarefas concluídas ficam ocultas por padrão, com botão pra",
        "  mostrar/ocultar.",
        "Coleção raiz \"tarefasSistema\" no Firestore (não vinculada a",
        "  obra) — via novo módulo js/todo.js."
      ]
    },
    {
      "versao": "V2.12.0.1",
      "legado": "V2.33.1",
      "status": "fechada",
      "data": "2026-07-15",
      "tipo": "funcionalidade",
      "titulo": "Tarefas: seed automático do backlog atual",
      "itens": [
        "Na primeira vez que a tela Tarefas é aberta (por navegador),",
        "  popula automaticamente com o backlog combinado no chat de",
        "  planejamento: Fachada (Shaft + tipo de peça), atividades",
        "  em execução na tela principal, edição da estrutura da obra,",
        "  levantamento hidráulico por sistema (esgoto, água quente/",
        "  fria, prumadas, registros, gás, ar condicionado), vínculo",
        "  de m² material x mão de obra, vínculos de Gesso e Ar",
        "  Condicionado, Controle de Solo Grampeado, Controle de",
        "  Estacas, e a planilha do Patrick (projeto separado)."
      ]
    },
    {
      "versao": "V2.12.1",
      "legado": "V2.34.0",
      "status": "fechada",
      "data": "2026-07-16",
      "tipo": "correcao",
      "titulo": "Vínculos com Levantamento: correção geral (dados errados, cache travado, árvore ilegível)",
      "itens": [
        "CRÍTICO — \"Recalcular vínculos\" corrompia valores filtrados por local:",
        "  a chamada de cálculo esquecia o nodeId. Um vínculo de Piso/Teto/",
        "  Paredes filtrado por um local específico (ex: só o Apto 301) virava",
        "  o TOTAL DA OBRA INTEIRA ao clicar em Recalcular. Corrigido: novo",
        "  cálculo único (_calcularBaseValor) usado tanto ao salvar quanto",
        "  ao recalcular, sempre respeitando o local selecionado.",
        "",
        "CRÍTICO — cache de levantamento nunca era invalidado:",
        "  editar um Levantamento e voltar pro Planejamento sem F5 mostrava",
        "  árvore e valores desatualizados. \"Recalcular\" também só recarregava",
        "  Fachada, nunca Piso/Teto/Paredes/Concreto/Ar-Condicionado/Pintura.",
        "  Corrigido: recarga forçada (_invalidarLevCache) ao entrar na tela",
        "  de Vínculos, ao abrir o modal de vincular e ao recalcular.",
        "",
        "Unidade sempre gravada como \"m²\", mesmo para ML, BTU e Qtd de",
        "  equipamentos (Ar-Condicionado). Cada métrica agora tem sua unidade",
        "  própria (m², ml, m³, BTU, un) e ela é regravada certa ao recalcular.",
        "",
        "Tabela de Vínculos não mostrava ONDE um vínculo de Piso/Teto/Paredes",
        "  estava filtrado — só Fachada tinha esse rótulo (e ele tinha um bug",
        "  próprio: uma flag de controle nunca virava true, então nem pra",
        "  Fachada o rótulo aparecia). Agora toda linha vinculada mostra o",
        "  caminho completo do local (ex: \"Torre A › Pav 3 › Apto 301 › Sala\").",
        "",
        "Seletor de local no modal era um <select> achatado com TODOS os nós",
        "  da obra em uma lista única — com 5 níveis de hierarquia (Torre,",
        "  Pavimento, Apto, Cômodo) virava uma lista enorme e ilegível.",
        "  Trocado por árvore visual expansível (clica pra abrir/fechar cada",
        "  nível), igual ao padrão já usado dentro do próprio Piso/Teto/",
        "  Paredes. Ao reabrir um vínculo existente, a árvore já abre",
        "  expandida até o nó selecionado.",
        "",
        "Erros de carregamento (permissão/índice do Firestore) agora avisam",
        "  com um toast em vez de virar silenciosamente uma árvore vazia."
      ]
    },
    {
      "versao": "V2.12.1.1",
      "legado": "V2.35.0",
      "status": "fechada",
      "data": "2026-07-16",
      "tipo": "melhoria",
      "titulo": "Tarefas: redesenho visual completo",
      "itens": [
        "Cartão de progresso: mostra \"X / Y concluídas\" e % com barra",
        "  animada, refletindo o filtro de projeto ativo.",
        "Tarefas agora agrupadas por projeto, cada grupo com uma cor",
        "  própria (bolinha + barra lateral no card) — muito mais fácil",
        "  de escanear a lista com vários projetos misturados.",
        "Filtro por projeto virou chips clicáveis (com contagem), no",
        "  lugar do <select> antigo.",
        "Barra de adicionar tarefa reformulada: campo de texto + campo",
        "  de projeto lado a lado, num único cartão com foco destacado.",
        "Checkbox circular customizado com animação de check ao concluir.",
        "Ações (subir/descer/editar/excluir) só aparecem no hover do",
        "  card, deixando a lista mais limpa quando não em uso.",
        "Concluídas: contador com seta que gira ao abrir/fechar a seção."
      ]
    },
    {
      "versao": "V2.12.1.2",
      "legado": "V2.36.0",
      "status": "fechada",
      "data": "2026-07-16",
      "tipo": "melhoria",
      "titulo": "Vínculos com Levantamento: reestruturação completa (navegação em pastas)",
      "itens": [
        "A tela de Vínculos deixou de ser uma tabela com TODAS as tarefas do",
        "  Planejamento (onde o vínculo ficava escondido dentro de cada linha).",
        "  Agora é uma navegação em pastas, do jeito que o levantamento é",
        "  pensado na obra: Módulo → Métrica → Local → Local → Local...",
        "",
        "Como funciona:",
        "  1. Abre Vínculos → aparece um botão pra cada levantamento (Piso,",
        "     Fachada, Teto, Ar-Condicionado...).",
        "  2. Clica no módulo → aparecem as métricas dele (Área total,",
        "     Contrapiso, Impermeabilização, Rodapé...). A métrica escolhida",
        "     fica travada — todo o resto da navegação calcula só ela.",
        "  3. Clica na métrica → navega pelos locais em pastas (Torre →",
        "     Pavimento → Apartamento → Cômodo, ou Fachada → Balancim →",
        "     Vista) — com breadcrumb clicável no topo pra pular direto",
        "     pra qualquer nível já visitado.",
        "  4. Em QUALQUER nível dessa navegação (módulo inteiro, uma métrica",
        "     inteira, uma torre, um pavimento, um apto ou um cômodo) tem um",
        "     botão \"Vincular aqui\" com a quantidade já calculada daquele",
        "     nível pra baixo. Se aquele local já tem vínculo, o botão vira",
        "     \"Editar vínculo\" e mostra quantas tarefas já recebem o valor.",
        "",
        "Dentro do vínculo: a fonte (módulo/métrica/local) não é mais editável",
        "  ali — ela já vem travada de onde você clicou \"Vincular aqui\" — só",
        "  falta escolher a tarefa \"pai\" (busca por nome) e distribuir entre",
        "  as tarefas filhas dela, exatamente como a divisão de família já",
        "  funcionava antes (não mexi nessa parte, só em como se chega nela).",
        "",
        "Removida a tabela de tarefas, a busca de tarefa por texto e o antigo",
        "  seletor em árvore expansível dentro do modal — toda a navegação",
        "  de local agora acontece na tela principal, não mais dentro do popup."
      ]
    },
    {
      "versao": "V2.12.1.3",
      "legado": "V2.37.0",
      "status": "fechada",
      "data": "2026-07-16",
      "tipo": "funcionalidade",
      "titulo": "Tarefas: projeto, categoria, dependência, importância e busca",
      "itens": [
        "Editar tarefa agora abre um modal completo (não só o nome):",
        "  Nome, Projeto, Categoria, Dependência e Importância.",
        "Categoria: rótulo colorido e reutilizável — cria uma vez com nome",
        "  + cor (seletor de 12 cores), e ela fica salva pra usar em",
        "  qualquer outra tarefa depois. Gerenciável em ⚙ Gerenciar.",
        "Dependência: campo de texto livre por tarefa (ex: \"aguardando",
        "  aprovação do Gabriel\"), com sugestões dos valores já usados e",
        "  um filtro dedicado pra achar todas as tarefas presas na mesma",
        "  dependência.",
        "Importância (Urgente/Alta/Média/Baixa) agora pode ser definida",
        "  por tarefa, por categoria e por projeto — tudo pelo botão",
        "  ⚙ Gerenciar projetos e categorias.",
        "Ordenação padrão passou a respeitar essa importância: projetos",
        "  mais importantes aparecem primeiro, e dentro de cada projeto",
        "  as tarefas mais importantes (e categorias mais importantes)",
        "  sobem — tudo isso ANTES de aplicar qualquer filtro.",
        "Nova barra de busca (nome, projeto, categoria e dependência) e",
        "  filtros por chip para projeto e categoria, além do filtro de",
        "  dependência.",
        "Menu lateral: removido o item \"Tarefas\" de todas as páginas —",
        "  o acesso agora é só por link direto (todo.html), sem aparecer",
        "  pra outros usuários do sistema."
      ]
    },
    {
      "versao": "V2.12.2",
      "legado": "V2.38.0",
      "status": "fechada",
      "data": "2026-07-16",
      "tipo": "correcao",
      "titulo": "Vínculos: corrige duplicação no \"Dividir\", estética escura, e vínculo separado para Mão de Obra x Materiais",
      "itens": [
        "BUG CORRIGIDO — \"Dividir em partes iguais\" duplicava valor:",
        "  a tarefa \"pai\" ficava marcada com fração cheia (1) AO MESMO TEMPO",
        "  que os filhos dividiam o mesmo valor entre si — dobrando o custo",
        "  de Mão de Obra/Material pra quem já tinha usado \"Dividir\" antes.",
        "  Agora, ao dividir, o pai (e qualquer neto marcado por engano) sai",
        "  da seleção — só os filhos diretos ficam valendo o total.",
        "  Vínculos JÁ SALVOS com esse problema precisam ser reabertos e",
        "  salvos de novo (ou clicar em \"Dividir\" outra vez) pra corrigir.",
        "",
        "Tela de navegação em pastas (Módulo → Métrica → Local) redesenhada",
        "  com a mesma paleta escura do Gantt (fundo #0d0d0d/#111, texto",
        "  claro, acento amarelo) — antes usava cards brancos que destoavam",
        "  do resto do Planejamento.",
        "",
        "NOVO — vínculo separado por Mão de Obra e Materiais:",
        "  uma mesma tarefa pode precisar de uma quantidade pra calcular",
        "  Mão de Obra e outra quantidade (de outro local/métrica do",
        "  levantamento) pra calcular Materiais. Adicionado seletor",
        "  Geral / Mão de Obra / Materiais no topo da tela de Vínculos —",
        "  cada um grava em campos próprios na tarefa (quantidadeMaoObra/",
        "  quantidadeMaterial, com todos os campos de rastreio do",
        "  levantamento espelhados). \"Geral\" continua sendo os campos",
        "  originais (compatível com tudo que já existia). Materiais e",
        "  Mão de Obra agora usam sua quantidade específica quando ela",
        "  existe, e caem para a quantidade Geral quando não existe —",
        "  nenhum vínculo antigo quebra.",
        "  \"Recalcular todos os vínculos\" agora recalcula os 3 tipos."
      ]
    },
    {
      "versao": "V2.12.2.1",
      "legado": "V2.38.1",
      "status": "fechada",
      "data": "2026-07-16",
      "tipo": "melhoria",
      "titulo": "Tarefas: acesso por gatilho secreto na logo (não mais por URL)",
      "itens": [
        "A remoção do menu na V2.37.0 deixou o acesso só por digitar a",
        "  URL direto — não era essa a ideia.",
        "Agora: 5 cliques rápidos (em até 2s) na logo da Absoluta, no",
        "  topo da sidebar, abrem a tela de Tarefas. Funciona em",
        "  qualquer página do sistema — sem nenhum botão visível."
      ]
    },
    {
      "versao": "V2.12.2.2",
      "legado": "V2.38.2",
      "status": "fechada",
      "data": "2026-07-16",
      "tipo": "melhoria",
      "titulo": "Tarefas: editar categoria e projeto já criados",
      "itens": [
        "No botão ⚙ Gerenciar, categorias e projetos agora têm um botão",
        "  ✎ Editar, além do 🗑 Excluir.",
        "Categoria: dá pra trocar o nome e a cor (mesmo seletor de 12",
        "  cores usado na criação).",
        "Projeto: dá pra trocar o nome.",
        "Ao renomear, todas as tarefas que já usavam o nome antigo são",
        "  atualizadas automaticamente pro nome novo — nada fica órfão."
      ]
    },
    {
      "versao": "V2.12.2.3",
      "legado": "V2.39.0",
      "status": "fechada",
      "data": "2026-07-16",
      "tipo": "melhoria",
      "titulo": "Vínculos: títulos revisados, Paredes por tipo real, Pintura corrigida de verdade",
      "itens": [
        "Título \"Tipo de vínculo\" adicionado acima do seletor Geral / Mão de",
        "  Obra / Materiais — antes não tinha nenhuma explicação do que aquilo",
        "  significava.",
        "",
        "Módulos renomeados: \"Fachada\" → \"Fachadas\", \"Piso / Contrapiso /",
        "  Impermeabilização\" → \"Pisos\".",
        "",
        "Paredes reestruturada — agora aparece na tela inicial de Vínculos já",
        "  separada por tipo real (Alvenaria de Vedação, Alvenaria Estrutural,",
        "  Gesso Liso, Reboco/Chapisco, Revestimento Cerâmico), sem passar por",
        "  uma tela extra de métrica. Gesso/Reboco/Revestimento agora são",
        "  calculados de verdade a partir do campo real da peça de Acabamento",
        "  (acabamentos[] com tipo+percentual) — antes essas 3 nem existiam",
        "  como opção de vínculo.",
        "",
        "Removida a métrica \"Pintura\" duplicada de dentro de Paredes e de",
        "  dentro de Teto — já existe um módulo Pintura próprio.",
        "",
        "CORRIGIDO — módulo Pintura estava com dado inventado (\"1ª/2ª/3ª",
        "  demão\" não existe no Levantamento de Pintura real, e a área não",
        "  vinha de lugar nenhum, sempre dava zero). Agora usa o levantamento",
        "  de Pintura de verdade: soma a área pintada das peças de Acabamento",
        "  (Paredes) e das áreas de Teto marcadas com pintura, navegando pela",
        "  árvore própria de locais da Pintura — mostrando os níveis como os",
        "  outros módulos. Removido \"(em desenvolvimento)\" do nome."
      ]
    },
    {
      "versao": "V2.12.2.4",
      "legado": "V2.39.1",
      "status": "fechada",
      "data": "2026-07-16",
      "tipo": "melhoria",
      "titulo": "Tarefas: barra de adicionar redesenhada + criar categoria direto por lá",
      "itens": [
        "Barra de \"+ Adicionar tarefa\" estava cramped e confusa (campos",
        "  colados, sem rótulo). Redesenhada em duas linhas: nome da tarefa",
        "  em cima, Projeto / Categoria / Importância com rótulo embaixo.",
        "NOVO — campo Categoria na própria barra de adicionar, com botão",
        "  \"+\" ao lado pra criar uma categoria nova (nome + cor) sem sair",
        "  dali e sem perder o que já tinha sido digitado."
      ]
    },
    {
      "versao": "V2.12.2.5",
      "legado": "V2.40.0",
      "status": "fechada",
      "data": "2026-07-16",
      "tipo": "melhoria",
      "titulo": "Vínculos: Pintura dentro de Paredes/Teto, Piso reorganizado, layout de pastas em lista vertical",
      "itens": [
        "Pintura deixou de ser um módulo à parte — \"Pintura de Parede\" agora",
        "  é mais um card dentro de Paredes, e \"Pintura de Teto\" é mais uma",
        "  métrica dentro de Teto. Cada uma soma a área pintada real (peças",
        "  de Acabamento e áreas de Teto marcadas com pintura, ponderada por",
        "  % de cada cor) usando a própria árvore de local de Paredes/Teto —",
        "  não precisa mais de nenhuma árvore ou mapeamento à parte.",
        "",
        "Paredes: rótulos corrigidos pra bater com o levantamento real",
        "  (\"Gesso Liso\", \"Reboco\", \"Revestimento de Parede\"). Reboco e",
        "  Revestimento puxam do mesmo campo acabamentos[] com tipo+% que",
        "  já alimenta o Gesso Liso — nenhum dos três é inventado.",
        "",
        "Pisos: virou cards por tipo igual Paredes. \"Área de piso\" e",
        "  \"Rodapé\" renomeados pra \"Revestimento\" e \"Revestimento — Rodapé\"",
        "  — ficam lado a lado, deixando claro que são as duas faces do",
        "  mesmo revestimento de piso.",
        "",
        "Seletor de tipo de vínculo: removida a aba \"Geral\" — só Mão de",
        "  Obra e Materiais (vínculos antigos que usavam os campos gerais",
        "  continuam funcionando normalmente como esses módulos já liam).",
        "",
        "Layout da navegação por pastas: as pastas agora abrem em lista",
        "  vertical (uma embaixo da outra) em vez de grade horizontal, e o",
        "  valor + botão \"Vincular aqui\" viraram a primeira linha dessa",
        "  mesma lista — não é mais um bloco isolado flutuando sozinho",
        "  acima das pastas."
      ]
    },
    {
      "versao": "V2.13.0",
      "legado": "V2.41.0",
      "status": "fechada",
      "data": "2026-07-16",
      "tipo": "funcionalidade",
      "titulo": "Dashboard Principal — hero com capa da obra, Curva S, atividades e Resumo por Apartamento",
      "itens": [
        "NOVO módulo Dashboard (substitui o stub \"em desenvolvimento\"):",
        "  → Hero no topo com seletor de obra e a imagem de capa da obra",
        "  sobreposta ao fundo (com gradiente escuro por trás do texto).",
        "  → KPIs: % Executado, % Previsto Atual, Término Atual e",
        "  Término Linha de Base, com selo de \"No prazo\" ou \"X mês(es)",
        "  atrasado\" comparando as duas datas.",
        "",
        "Curva S do Planejamento: gráfico (SVG) com linha Esperado x",
        "  Executado acumulado, mais barras de Esperado/Executado mensal",
        "  por trás — calculado a partir da duração das tarefas-folha",
        "  distribuída no tempo (linha de base quando existir) e do",
        "  percentual concluído/datas reais para a curva executada.",
        "  Linha vertical marca \"hoje\".",
        "",
        "Lista de Atividades: \"Em Execução\" e \"Próximas\", cada uma com",
        "  prazo de conclusão e % concluído, com \"Atualizado em\" acima.",
        "",
        "Resumo por Apartamento: tabela com uma linha por métrica de",
        "  levantamento (Contrapiso, Impermeabilização, Revestimento de",
        "  Piso, Rodapé, Alvenaria de Vedação/Estrutural, Gesso Liso,",
        "  Reboco, Revestimento de Parede, Pintura de Parede, Área de",
        "  Teto, Forro de Drywall, Placa de Gesso, Tabica, Pintura de",
        "  Teto) e uma coluna por apartamento (agrupadas por Torre),",
        "  com toggle Unidade/Custo. O apartamento de cada área é",
        "  inferido como o nó pai do local onde ela foi lançada na",
        "  árvore (convenção Torre › Andar › Apto › Cômodo). Custo é",
        "  uma estimativa: custo médio por unidade das tarefas do",
        "  Planejamento vinculadas àquele módulo/métrica, aplicado à",
        "  quantidade de cada apartamento — v1, sujeita a refinamento.",
        "  Linhas sem nenhum dado lançado ainda não aparecem na tabela."
      ]
    },
    {
      "versao": "V2.13.0.1",
      "legado": "V2.41.1",
      "status": "fechada",
      "data": "2026-07-16",
      "tipo": "melhoria",
      "titulo": "Tarefas: editar categoria direto de onde ela é usada",
      "itens": [
        "Botão ✎ ao lado do seletor de Categoria na barra de \"+ Adicionar",
        "  tarefa\" — edita nome/cor da categoria escolhida sem precisar",
        "  abrir o ⚙ Gerenciar.",
        "Mesmo recurso dentro do modal \"Editar tarefa\": link \"✎ Editar",
        "  categoria selecionada\" ao lado de \"+ Criar nova categoria\".",
        "Ao salvar, o nome novo é propagado pra todas as tarefas que já",
        "  usavam essa categoria — igual já acontecia no ⚙ Gerenciar."
      ]
    },
    {
      "versao": "V2.13.0.2",
      "legado": "V2.42.0",
      "status": "fechada",
      "data": "2026-07-17",
      "tipo": "melhoria",
      "titulo": "Dashboard: Curva S grande com tooltip, IDP, Avanço por Pacotes, PPC Semanal/Motivos de Atraso e correção do Resumo por Apartamento",
      "itens": [
        "Curva S ampliada (era um gráfico pequeno dividindo espaço com",
        "  Atividades — agora ocupa a linha inteira, bem maior) e ganhou",
        "  tooltip ao passar o mouse sobre qualquer mês, mostrando Esperado",
        "  Mensal, Executado Mensal, Esperado Acumulado e Executado",
        "  Acumulado — igual ao comportamento pedido.",
        "",
        "NOVO — Índice de Desempenho de Prazo (IDP): gráfico separado",
        "  (Executado Acumulado ÷ Esperado Acumulado por mês), com linha",
        "  \"Ideal\" em 1.0 e rótulo do valor em cada ponto.",
        "",
        "NOVO — Avanço por Pacotes: agrupa as tarefas-folha do Planejamento",
        "  pelo campo Grupo, mostra Esperado x Executado por pacote (barras",
        "  pareadas) e o peso de cada pacote no total do projeto.",
        "",
        "NOVO — Curto Prazo: PPC Semanal (barra por período fechado do",
        "  módulo Semanal, com linha \"Ideal\" em 100%) e Motivos de Atraso",
        "  Semanais (barras empilhadas por motivo, usando a mesma lista de",
        "  motivos já cadastrada no Semanal). Some sozinho se não houver",
        "  período fechado ainda.",
        "",
        "Suprimentos: como o módulo ainda é só um stub sem dados reais,",
        "  o Dashboard mostra um aviso honesto em vez de inventar números",
        "  — assim que Suprimentos existir de verdade, este painel é",
        "  ligado aos dados reais.",
        "",
        "CORREÇÃO no Resumo por Apartamento: Piso, Teto e Paredes têm",
        "  árvores de local INDEPENDENTES entre si — \"Torre A\" no Piso e",
        "  \"Torre A\" em Paredes são nós com IDs diferentes mesmo sendo o",
        "  mesmo lugar físico. O agrupamento por apartamento comparava por",
        "  ID e por isso duplicava torres/apartamentos que já existiam em",
        "  mais de um levantamento. Agora agrupa pelo CAMINHO DE NOMES",
        "  (ex: \"Torre A › Pav 3 › Apto 301\"), unindo corretamente os três",
        "  levantamentos na mesma coluna — desde que os locais sejam",
        "  nomeados de forma consistente entre eles."
      ]
    },
    {
      "versao": "V2.13.1",
      "legado": "V2.42.1",
      "status": "fechada",
      "data": "2026-07-17",
      "tipo": "correcao",
      "titulo": "Dashboard: corrige overflow da Curva S/IDP, pondera por quantidade (não duração) e Avanço por Pacotes ganha abas Pacotes/Agrupadores/Locais/Responsáveis",
      "itens": [
        "CORREÇÃO — Curva S e IDP estavam vazando pra fora do card (o",
        "  gráfico ficava mais largo que a tela quando havia muitos meses).",
        "  Agora ficam dentro de um container com rolagem horizontal",
        "  própria, sem quebrar o layout da página.",
        "",
        "CORREÇÃO — ponderação trocada de duração (dias) para QUANTIDADE",
        "  em todos os cálculos agregados do Dashboard (Curva S, IDP, KPIs",
        "  do topo e Avanço por Pacotes) — é a mesma convenção que",
        "  Utils.percFamilia já usa em Planejamento/Semanal/Diário. Antes,",
        "  uma tarefa de 1 dia com 500m² pesava igual a uma de 1 dia com",
        "  5m², distorcendo a curva inteira.",
        "",
        "Avanço por Pacotes reformulado: agora tem 4 abas — \"Pacotes\"",
        "  (cada tarefa-folha do Planejamento aparece individualmente, sem",
        "  agrupar — é a visão padrão), \"Agrupadores\" (pelo campo Grupo),",
        "  \"Locais\" (pelo campo Local) e \"Responsáveis\" (pelo campo",
        "  Responsável). Todas ordenadas por peso decrescente."
      ]
    },
    {
      "versao": "V2.13.1.1",
      "legado": "V2.43.0",
      "status": "fechada",
      "data": "2026-07-17",
      "tipo": "funcionalidade",
      "titulo": "Histórico de Execução (snapshot diário do Planejamento) e correção do agrupamento no Resumo por Apartamento",
      "itens": [
        "NOVO — Histórico de Execução: toda vez que uma tarefa é criada ou",
        "  atualizada com % Concluído ou Quantidade (por Medições, Semanal,",
        "  Diário ou o próprio Planejamento — todos gravam tarefa pelo mesmo",
        "  caminho no Database, então isso vale pra qualquer um deles), o",
        "  sistema agora grava um snapshot do dia em",
        "  obras/{obra}/historicoExecucao/{AAAA-MM-DD}. É o registro real que",
        "  faltava pra Curva S e o IDP pararem de estimar o passado.",
        "",
        "Curva S / IDP: a partir do dia em que o histórico começar a existir",
        "  pra esta obra, os dois passam a usar o valor REAL registrado",
        "  naquele dia (marcado com uma linha verde pontilhada no gráfico e",
        "  um selo \"real\" no tooltip). Antes dessa linha, continua sendo uma",
        "  estimativa retroativa (selo \"estimado\") — não tem como reconstruir",
        "  um histórico que nunca foi salvo. Daqui pra frente, quanto mais",
        "  Milton usar Medições/Semanal/Diário, mais precisa a curva fica.",
        "",
        "CORREÇÃO no Resumo por Apartamento: o agrupamento por Torre estava",
        "  duplicando cabeçalhos quando a árvore de um levantamento tinha uma",
        "  pequena diferença de digitação em relação a outro (ex: \"1° Pavimento\"",
        "  vs \"1º Pavimento\", ou espaços/maiúsculas diferentes) — cada variação",
        "  virava uma coluna/torre separada. Agora a comparação usa uma chave",
        "  normalizada (sem acento, sem símbolo de grau, sem diferença de",
        "  maiúsculas) só para AGRUPAR; o texto exibido na tabela continua o",
        "  original. O agrupamento por Torre também passou a usar um mapa em",
        "  vez de comparar itens vizinhos, então não depende mais da ordem em",
        "  que os apartamentos aparecem."
      ]
    },
    {
      "versao": "V2.13.1.2",
      "legado": "V2.43.1",
      "status": "fechada",
      "data": "2026-07-17",
      "tipo": "melhoria",
      "titulo": "Dashboard: remove IDP e Avanço por Pacotes da tela, reordena prioridades e Curva S ganha toggle Mensal/Semanal",
      "itens": [
        "Índice de Desempenho de Prazo e Avanço por Pacotes saíram da tela",
        "  a pedido do Milton — ficaram mal resolvidos nesta primeira versão.",
        "  O código continua no arquivo (não foi apagado), então dá pra",
        "  reativar rápido se decidirmos retomar os dois no futuro.",
        "",
        "Nova ordem de prioridade da tela: Curva S → Atividades (Em",
        "  Execução / Próximas) → Resumo por Apartamento. O restante (PPC",
        "  Semanal, Motivos de Atraso, Suprimentos) desceu pro fim da página.",
        "",
        "Curva S ganhou toggle Mensal/Semanal (igual ao modelo de",
        "  referência) — Semanal usa a mesma numeração de semana (S<n> do",
        "  ano) já usada no módulo Semanal, domingo a sábado."
      ]
    },
    {
      "versao": "V2.13.2",
      "legado": "V2.43.2",
      "status": "fechada",
      "data": "2026-07-17",
      "tipo": "correcao",
      "titulo": "Dashboard: corrige ordem de prioridade (Atividades e Resumo por Apartamento primeiro, Curva S desceu pro \"resto\")",
      "itens": [
        "A versão anterior deixou a Curva S no topo por engano — Milton",
        "  pediu explicitamente que Atividades (Em Execução/Próximas) e",
        "  Resumo por Apartamento fossem as duas prioridades, com \"o resto\"",
        "  (incluindo a própria Curva S) abaixo. Ordem corrigida: Hero →",
        "  Atividades → Resumo por Apartamento → Curva S → PPC Semanal/",
        "  Motivos de Atraso → Suprimentos."
      ]
    },
    {
      "versao": "V2.13.3",
      "legado": "V2.43.3",
      "status": "fechada",
      "data": "2026-07-17",
      "tipo": "correcao",
      "titulo": "Resumo por Apartamento: Piso/Teto agora dividem por Apto (não só por Pavimento)",
      "itens": [
        "CORREÇÃO — Piso, Teto e afins não estavam dividindo por apartamento,",
        "  só por Pavimento. Causa: o \"apartamento\" era calculado como o NÓ",
        "  PAI de onde a área foi lançada — funciona em Paredes (a área fica",
        "  num Cômodo abaixo do Apto, então o pai é o Apto certinho), mas",
        "  quebra em Piso/Teto, onde a área costuma ser lançada DIRETO no",
        "  Apto (sem Cômodo por baixo) — nesse caso \"pegar o pai\" dava o",
        "  Pavimento por engano, perdendo a divisão por apartamento.",
        "",
        "Agora o \"apartamento\" é sempre os 3 primeiros níveis do caminho —",
        "  Torre (ou Subsolo/Térreo) / Nº do Pavimento / Nº do Ap — não",
        "  importa se a área foi lançada direto no Apto ou um nível abaixo",
        "  dele (Cômodo). Áreas realmente lançadas só no Pavimento (sem",
        "  divisão por apto, ex: corredor/área comum) continuam aparecendo",
        "  na própria coluna do Pavimento, sem inventar um Apto que não",
        "  existe."
      ]
    },
    {
      "versao": "V2.13.3.1",
      "legado": "V2.44.0",
      "status": "fechada",
      "data": "2026-07-17",
      "tipo": "melhoria",
      "titulo": "Dashboard: KPIs do topo corrigidos (detecção de folha por posição), Resumo por Apartamento com subtotal por Pavimento/Torre e ordem Piso/Parede/Teto",
      "itens": [
        "CORREÇÃO — % Executado e % Previsto Atual do topo do Dashboard",
        "  apareciam zerados. Causa: a tela detectava tarefa-folha pelo campo",
        "  `tipo==='grupo'`, que pode não estar 100% consistente nos dados;",
        "  isso podia incluir linha de grupo vazia na conta (derrubando a",
        "  média) ou excluir folha de verdade. Trocado pela MESMA lógica já",
        "  comprovada em Obras (card de % Executado) e Semanal (PPC): uma",
        "  tarefa é folha se a próxima na ordem tem nível igual ou menor —",
        "  não depende do campo tipo. Vale também pra Curva S.",
        "",
        "Resumo por Apartamento — reformulado:",
        "  → Colunas fantasma \"Torre\"/\"1º Pavimento\" (que apareciam 100%",
        "  vazias) sumiram — agora só viram coluna os locais que realmente",
        "  têm algum dado lançado.",
        "  → Em vez de misturar Torre/Pavimento como se fossem apartamentos",
        "  soltos, agora o cabeçalho é hierárquico de verdade: Torre → cada",
        "  Pavimento → cada Apto, com uma coluna de \"Subtot.\" ao final de",
        "  cada Pavimento e uma de \"Subtot. Torre\" ao final de cada Torre.",
        "  → Dentro de cada Pavimento, as colunas (Ap 1, Ap 2, Hall, Escada",
        "  Andar...) são ordenadas pela quantidade de dado lançado (quem tem",
        "  mais linhas preenchidas vem primeiro) — resolve casos como \"Hall\"",
        "  aparecer antes de \"Escada Andar\" quando a Escada só tem valor de",
        "  pintura ainda.",
        "  → Ordem das categorias trocada para Piso → Paredes → Teto/Forro."
      ]
    },
    {
      "versao": "V2.13.4",
      "legado": "V2.44.1",
      "status": "fechada",
      "data": "2026-07-17",
      "tipo": "correcao",
      "titulo": "Resumo por Apartamento: centraliza texto dos cabeçalhos de coluna e devolve rótulos \"Item\"/\"Total\"",
      "itens": [
        "Nome de coluna longo (ex: \"Hall do Elevador de Serviço\") estava",
        "  alinhado à direita igual os números — ficava esteticamente",
        "  estranho, muito afastado do centro da coluna. Agora o texto do",
        "  cabeçalho (nome do Apto e \"Subtot.\"/\"Subtot. Torre\") fica",
        "  centralizado, alinhado com os títulos de Torre/Pavimento acima.",
        "Corrigido também: as células de canto superior esquerdo/direito",
        "  do cabeçalho tinham ficado vazias na versão com hierarquia de",
        "  Torre/Pavimento — voltaram a mostrar \"Item\" e \"Total\"."
      ]
    },
    {
      "versao": "V2.13.5",
      "legado": "V2.44.2",
      "status": "fechada",
      "data": "2026-07-17",
      "tipo": "correcao",
      "titulo": "[DEBUG TEMPORÁRIO] Dashboard: linha de diagnóstico no Hero pra investigar %Executado/%Previsto zerados",
      "itens": [
        "Milton confirmou que o Planejamento tem tarefa com progresso",
        "  lançado, mas o Hero do Dashboard continua mostrando 0%/0% — ou",
        "  seja, não é falta de dado, é algo na conta/leitura. Como Término",
        "  Atual e Término Linha de Base aparecem certos (não vazios), as",
        "  tarefas estão sendo carregadas; o problema está isolado nos",
        "  campos de percentual.",
        "",
        "Adicionada uma linha de debug (temporária, cor amarela, abaixo dos",
        "  KPIs do Hero) mostrando: quantas tarefas foram carregadas,",
        "  quantas foram detectadas como folha, quantas folhas têm",
        "  %Concluído maior que 0, e a soma de peso usada na conta. Também",
        "  loga no console do navegador as 5 primeiras folhas e as 5",
        "  primeiras com progresso, pra comparar campo a campo. Assim que a",
        "  causa for identificada, essa linha sai."
      ]
    },
    {
      "versao": "V2.13.6",
      "legado": "V2.44.3",
      "status": "fechada",
      "data": "2026-07-17",
      "tipo": "correcao",
      "titulo": "Dashboard: corrige de vez o %Executado/%Previsto zerados (peso voltou a ser duração) e remove debug",
      "itens": [
        "CAUSA ENCONTRADA com a ajuda do debug da versão anterior: o debug",
        "  mostrou 2400 tarefas, 2195 folhas, 203 com progresso lançado e",
        "  soma de peso de 440.870 — os números batiam, mas o peso usado",
        "  era por QUANTIDADE. Algumas tarefas com quantidade gigante e 0%",
        "  de progresso afogavam completamente o peso de quem já tinha",
        "  avançado, derrubando a média ponderada pra perto de 0% (e o",
        "  Math.round arredondava pra \"0%\" na tela).",
        "",
        "Peso voltou a ser por DURAÇÃO — a mesma fórmula já usada (e",
        "  comprovadamente correta) no card de % Executado da listagem de",
        "  Obras — garantindo que o Hero do Dashboard bate com o que já",
        "  aparece lá. Afeta %Executado/%Previsto Atual do Hero e a Curva S.",
        "",
        "Removida a linha de debug amarela adicionada na versão anterior."
      ]
    },
    {
      "versao": "V2.13.6.1",
      "legado": "V2.44.4",
      "status": "fechada",
      "data": "2026-07-17",
      "tipo": "melhoria",
      "titulo": "Dashboard: %Executado/%Previsto Atual do Hero com 2 casas decimais (ex: 9,80%)",
      "itens": [
        "KPIs do Hero (Executado e Previsto Atual) agora mostram 2 casas",
        "  decimais em vez de arredondar pro inteiro mais próximo — ex:",
        "  \"9,80%\" em vez de \"10%\". Usa Utils.formatarNumero, o mesmo",
        "  padrão de vírgula/2 casas já usado no resto do sistema."
      ]
    },
    {
      "versao": "V2.13.6.2",
      "legado": "V2.45.0",
      "status": "fechada",
      "data": "2026-07-21",
      "tipo": "funcionalidade",
      "titulo": "Calculadora de Concreto ganha Viga, Laje e Fundação (9 tipos)",
      "itens": [
        "Port fiel das fórmulas da planilha pessoal do Milton (Obra Essence",
        "  V9.6.6) para dentro da Calculadora de Concreto, no Levantamento:",
        "",
        "VIGA: comp × altura × lado, igual ao pilar retangular",
        "",
        "LAJE: convencional ou pré-moldada com isopor —",
        "  Volume = (Hconcreto×x×y) − (desconto de área×Hconcreto) −",
        "  (área de isopor×Hisopor), onde Hconcreto = Hlaje − Hpainel",
        "  → Controle de treliça/isopor incluído: metragem de treliça e",
        "    área de isopor calculadas e salvas na peça (não entram no",
        "    volume de concreto, são só para controle de material)",
        "  → Novo painel \"Resumo de Treliça/Isopor\" no Levantamento de",
        "    Concreto, somando os totais de todas as lajes cadastradas",
        "",
        "FUNDAÇÃO: os 9 tipos da planilha original, num seletor único —",
        "  Viga Baldrame, Bloco Retângular, Bloco Triângular (fórmula",
        "  empírica ou trapezoidal detalhada), Estacas, Sapata Isolada",
        "  Piramidal, Sapata de Divisa Piramidal, Tubulão a Céu Aberto,",
        "  Sapata de Divisa em Bloco, Sapata Isolada em Bloco — cada um",
        "  com seu próprio desenho e campos",
        "  → Fórmulas conferidas uma a uma contra os dados reais da",
        "    planilha do Milton antes de publicar"
      ]
    },
    {
      "versao": "V2.14.0",
      "legado": "V2.46.0",
      "status": "fechada",
      "data": "2026-07-21",
      "tipo": "funcionalidade",
      "titulo": "Novos módulos: Solo Grampeado e Terraplanagem (Levantamento)",
      "itens": [
        "Dois módulos novos no Levantamento, portados da planilha pessoal",
        "  do Milton (Obra Essence V9.6.6). Ficam no Levantamento por ora —",
        "  local definitivo (Levantamento ou Controle) a definir depois.",
        "",
        "⛏️ SOLO GRAMPEADO:",
        "  → Cadastro de Vistas (faces) e Chumbadores (grampos/ancoragens),",
        "    com tipo Vertical/Horizontal, comprimento e as 4 datas de",
        "    etapa (Furo, Injeção 1ª e 2ª Parte, Conclusão) — o status",
        "    (Pendente → Furo feito → Injeção 1/2 → Concluído) é",
        "    calculado automaticamente pelas datas preenchidas",
        "  → Importação em lote de chumbadores (cola do Excel ou TSV/CSV),",
        "    criando as vistas automaticamente se ainda não existirem",
        "  → Produção Diária: registro de Grampos/Extras/Estacas por dia",
        "    (quantidade + tamanho), com o total em metros lineares/dia",
        "  → Área Executada por Vista: registro de m² por data e vista",
        "  → Curva de progresso: % acumulado de chumbadores concluídos",
        "    ao longo do tempo (gráfico de linha)",
        "  → KPIs: total de chumbadores, % concluído, metros lineares,",
        "    área executada total, dias com produção registrada",
        "",
        "🚚 TERRAPLANAGEM:",
        "  → Calculadora de Corte de Terra — método das seções",
        "    transversais: cada seção recebe uma lista de cotas de",
        "    nivelamento + cota final de projeto + distâncias entre",
        "    cotas, e a área é calculada pelo método da profundidade",
        "    média (mesma fórmula da planilha original, mas sem o",
        "    limite fixo de 10 cotas — aceita quantas o levantamento",
        "    tiver). O volume entre seções usa o método das áreas",
        "    médias, com seções Horizontais e Verticais separadas e",
        "    depois tiradas a média entre as duas (dupla checagem,",
        "    igual à planilha original)",
        "  → Taxa de empolamento configurável (padrão 30%) aplicada ao",
        "    volume médio para chegar no volume solto a transportar",
        "  → Cadastro de Caminhões (placa, tamanho Grande/Pequeno,",
        "    empresa) com capacidades configuráveis",
        "  → Registro de Viagens/Remoções com acumulado em m³ e % —",
        "    preenche o volume automaticamente pela capacidade do",
        "    caminhão selecionado",
        "  → KPIs: volume médio (banco), volume com empolamento, volume",
        "    já removido e % concluído",
        "",
        "Fórmulas conferidas contra os dados reais da planilha do Milton",
        "  antes de publicar (ex: área da seção V1 = 285,71 m² bateu",
        "  exatamente com o valor calculado no Excel)."
      ]
    },
    {
      "versao": "V2.14.0.1",
      "legado": "V2.47.0",
      "status": "fechada",
      "data": "2026-07-22",
      "tipo": "melhoria",
      "titulo": "Solo Grampeado e Terraplanagem separados em Levantamento x Controle",
      "itens": [
        "ORDEM DO HUB DE LEVANTAMENTOS: Solo Grampeado, Terraplanagem,",
        "  Concreto, Aço, Paredes, Piso, Teto, Pintura, Fachada (nessa",
        "  ordem). A seção de Bases de Quantitativos/Composições não",
        "  foi alterada.",
        "",
        "SEPARAÇÃO LEVANTAMENTO x CONTROLE: os dois módulos novos da",
        "  V2.46.0 misturavam cadastro (quantitativo) com execução",
        "  (datas, produção diária) numa página só. Corrigido para",
        "  seguir o mesmo padrão do Concreto:",
        "",
        "⛏️ Levantamento de Solo Grampeado agora só tem Vistas e o",
        "  cadastro/importação de Chumbadores (número, vista, tipo,",
        "  comprimento — sem datas de execução).",
        "✅ Controle de Solo Grampeado (NOVO — card no hub de Controle):",
        "  lançamento da execução de cada chumbador (datas de Furo,",
        "  Injeção 1ª/2ª Parte, Conclusão — status derivado igual antes),",
        "  Produção Diária, Área Executada por Vista e a Curva de",
        "  Progresso migraram todos pra cá.",
        "",
        "🚚 Levantamento de Terraplanagem agora só tem a Calculadora de",
        "  Corte de Terra (seções), Config (empolamento/capacidades) e",
        "  Cadastro de Caminhões.",
        "✅ Controle de Terraplanagem (NOVO — card no hub de Controle):",
        "  Registro de Viagens/Remoções e o progresso de volume",
        "  removido x previsto migraram pra cá.",
        "",
        "Navegação: cada módulo só é alcançado pelo seu próprio hub",
        "  (Levantamentos ou Controle) — sem atalho de Levantamento",
        "  para Controle no cabeçalho, mesma regra já aplicada ao",
        "  Concreto. Controle ainda linka de volta pro Levantamento",
        "  quando não há dados cadastrados (mesmo padrão do Concreto)."
      ]
    },
    {
      "versao": "V2.15.0",
      "legado": "V2.48.0",
      "status": "fechada",
      "data": "2026-07-22",
      "tipo": "funcionalidade",
      "titulo": "Novo módulo: Produção",
      "itens": [
        "NOVO MÓDULO PRODUÇÃO (aba Produção, logo abaixo de Controle):",
        "  calcula a produtividade real (unidade/dia) de cada tarefa",
        "  do Planejamento, cruzando quantidade total (do Levantamento",
        "  ou digitada manualmente), % concluído e o histórico diário",
        "  de execução já gravado automaticamente pelo sistema.",
        "",
        "  → Fórmula: qtdProduzida = quantidade × variação de % desde",
        "    o início real da tarefa; dias = do 1º snapshot de execução",
        "    até hoje; produção = qtdProduzida ÷ dias.",
        "  → Tarefa sem histórico ainda (pré-existente ao sistema de",
        "    snapshots) usa o Início Planejado como estimativa,",
        "    marcada com ≈ pra não confundir com dado real.",
        "  → Tarefas-pai (ex: Fachada) agregam os filhos somando a",
        "    quantidade produzida real e dividindo pelos dias corridos",
        "    do período — nunca faz média das taxas dos filhos.",
        "  → Unidades diferentes entre irmãos não são somadas (mostra",
        "    \"unid. mistas\").",
        "  → Tarefa sem quantidade vinculada permite digitar o total",
        "    manualmente direto na tela de Produção.",
        "",
        "NOVA COLUNA \"Equipe\" no Planejamento: nº de pessoas alocadas",
        "  por tarefa, editável igual às demais colunas. Alimenta a",
        "  produção por pessoa em Produção (mesmo campo nos dois",
        "  módulos — equipeAlocada)."
      ]
    },
    {
      "versao": "V2.15.0.1",
      "legado": "V2.49.0",
      "status": "fechada",
      "data": "2026-07-09",
      "tipo": "funcionalidade",
      "titulo": "Diário: pauta por categoria + % recomendadas + datas reais",
      "itens": [
        "Pauta agrupada por CATEGORIA (campo \"Grupo\" da tarefa no",
        "  Planejamento — ex: Estrutura, Elétrica, Hidráulica...),",
        "  recolhível, com contador de tratadas. Dentro da categoria,",
        "  as famílias (pais) viram divisores com % e quantidade,",
        "  mantendo o botão \"Lançar no grupo\" (distribui p/ subtarefas)",
        "Card mostra as 4 DATAS: Prev: início→término planejado e",
        "  Real: início→término real (— quando ainda não houve)",
        "Card mostra % PREVISTO PARA O DIA pelo planejamento (cálculo",
        "  linear pelas datas planejadas), verde se em dia, vermelho",
        "  se abaixo do previsto",
        "Ao lançar avanço: linha \"💡 Recomendado\" com o % do",
        "  Planejamento para o dia e o % do Controle (mostra \"sem",
        "  vínculo ainda\" — estrutura pronta p/ quando o Controle",
        "  ganhar vínculo com tarefas)",
        "NOVO campo DATA no lançamento (padrão = dia do diário aberto):",
        "  lançamento retroativo grava início/término REAL na data",
        "  certa no Planejamento. Lançar 100% atualiza o término real",
        "  para a data informada. CORRIGIDO: antes gravava a data de hoje."
      ]
    },
    {
      "versao": "V2.15.0.2",
      "legado": "V2.50.0",
      "status": "fechada",
      "data": "2026-07-09",
      "tipo": "funcionalidade",
      "titulo": "Pauta do Diário: visão Por Serviço / Por Local",
      "itens": [
        "NOVO seletor no topo da pauta: \"Por Serviço\" x \"Por Local\"",
        "  (a escolha fica salva no navegador). Por Serviço agrupa por",
        "  Gesso Liso, Alvenaria, Prumadas... (extraído do prefixo do",
        "  nome da tarefa antes dos dois pontos); Por Local agrupa por",
        "  Térreo, 1° Pavimento... (campo Grupo do Planejamento)",
        "CORRIGIDO: ordenação — locais em ordem natural de obra",
        "  (Subsolo → Térreo → 1° → 2° → ... → Cobertura) e serviços",
        "  em ordem alfabética. Antes ficava na ordem de aparição.",
        "Dentro de cada categoria, subdivisores da visão oposta",
        "  (serviço dentro do andar, ou andar dentro do serviço),",
        "  também ordenados",
        "NOVO \"Lançar em todas\" no subdivisor: aplica o mesmo % de",
        "  uma vez a todas as tarefas pendentes do bloco (1 lançamento",
        "  por tarefa, com percAntes correto e data retroativa)",
        "Cabeçalho da categoria ganhou barrinha de progresso das",
        "  tratadas — mais rápido de varrer na reunião",
        "Atrasadas seguem a mesma visão selecionada"
      ]
    },
    {
      "versao": "V2.16.0",
      "legado": "V2.51.0",
      "status": "fechada",
      "data": "2026-07-11",
      "tipo": "funcionalidade",
      "titulo": "Novo: Editor de Estrutura (árvore hierárquica do cronograma)",
      "itens": [
        "Botão \"🌳 Editor de Estrutura\" na toolbar do Planejamento.",
        "",
        "O editor mostra a hierarquia como árvore colapsável e permite:",
        "  → Expandir/recolher famílias clicando em ▼/▶",
        "  → Renomear qualquer tarefa com clique duplo no nome",
        "  → ＋ Criar filho direto: insere uma nova tarefa como filho",
        "    do nó clicado, já abrindo para edição do nome",
        "  → ＋ Nova raiz: cria um grupo de nível 0 no final",
        "  → ↗ Mover para: abre seletor de destino — escolha o novo",
        "    pai numa lista buscável; \"Raiz\" move para nível 0",
        "  → Arrastar: drag & drop visual direto na árvore —",
        "    soltar no meio do nó = filho, no topo = antes, na base = depois",
        "  → ← Recuar nível: sobe um nível (torna irmão do pai atual)",
        "  → ✕ Excluir",
        "",
        "Tudo preservado ao mover:",
        "  → Todos os dados da tarefa (duração, %, predecessora,",
        "    vínculos de levantamento, materiais, mão de obra)",
        "  → Predecessoras remapeadas automaticamente se o número",
        "    de linha mudar (mesmo mecanismo já existente)",
        "  → Filhos se movem junto com o pai",
        "Botão \"← Voltar ao Gantt\" retorna à visualização normal."
      ]
    },
    {
      "versao": "V2.16.1",
      "legado": "V2.51.1",
      "status": "fechada",
      "data": "2026-07-11",
      "tipo": "correcao",
      "titulo": "CRÍTICO: Editor de Estrutura não abria (_esc não definida)",
      "itens": [
        "_esc() usada dentro do Editor mas não definida no módulo de",
        "  Planejamento — ReferenceError ao primeiro render.",
        "Adicionada definição local de _esc no escopo do módulo.",
        "Corrigido também crash ao mover tarefa para raiz (targetId null)."
      ]
    },
    {
      "versao": "V2.16.2",
      "legado": "V2.51.2",
      "status": "fechada",
      "data": "2026-07-11",
      "tipo": "correcao",
      "titulo": "Editor de Estrutura: drag & drop funcionando",
      "itens": [
        "CAUSA: _arvDragStart e _arvDragOver chamavam _render(), que",
        "  reconstruía o DOM inteiro durante o drag — o navegador",
        "  perde a referência ao elemento arrastado e cancela o drag.",
        "CORREÇÃO: drag agora nunca chama _render():",
        "  → _arvDragStart: só marca opacidade via DOM direto",
        "  → _arvDragOver: atualiza borda/fundo do nó alvo via",
        "    querySelector, sem recriar nenhum elemento",
        "  → _arvDragEnd: limpa todos os indicadores via DOM",
        "  → Drop final: aí sim chama _arvMoverTarefa que re-renderiza"
      ]
    },
    {
      "versao": "V2.16.3",
      "legado": "V2.51.3",
      "status": "fechada",
      "data": "2026-07-11",
      "tipo": "correcao",
      "titulo": "Editor de Estrutura: drag mais fácil + loading infinito corrigido",
      "itens": [
        "ZONA DE DROP AMPLIADA: inside (virar filho) agora ocupa 80%",
        "  da altura da linha. Antes era 50%, ficava fácil de acionar",
        "  before/after sem querer e mudar o nível errado.",
        "  Topo 10% = before (irmão antes), base 10% = after (irmão depois).",
        "",
        "LOADING INFINITO CORRIGIDO: _remapearPredecessoras() estava",
        "  fora do try/finally do loading. Se ela travasse, o loading",
        "  nunca fechava. Agora tudo (remap + save) está no mesmo",
        "  try/catch/finally com mensagem de erro se falhar.",
        "",
        "NÍVEL CORRETO: before/after usa o nível do target (irmão),",
        "  não muda hierarquia de pai — apenas reordena dentro do",
        "  mesmo grupo. Inside adiciona como filho (nível+1)."
      ]
    },
    {
      "versao": "V2.16.4",
      "legado": "V2.51.4",
      "status": "fechada",
      "data": "2026-07-11",
      "tipo": "correcao",
      "titulo": "CRÍTICO: Editor de Estrutura salvava 2400 tarefas a cada movimento",
      "itens": [
        "CAUSA do loading infinito: ao mover qualquer tarefa, o código",
        "  renormalizava a ordem (1,2,3...) de TODAS as tarefas e depois",
        "  salvava TODAS no Firestore — 2400 ÷ 30 por lote = 80 lotes",
        "  em sequência, cada um com ~300ms de latência = ~24 segundos.",
        "",
        "CORREÇÃO: compara o estado antes/depois e salva APENAS as",
        "  tarefas cujo ordem ou nivel realmente mudou.",
        "  → Mover 1 tarefa entre grupos próximos: tipicamente <50",
        "    mudanças → <2 segundos.",
        "  → Loading agora mostra quantas tarefas estão sendo salvas."
      ]
    },
    {
      "versao": "V2.16.5",
      "legado": "V2.51.5",
      "status": "fechada",
      "data": "2026-07-11",
      "tipo": "correcao",
      "titulo": "Editor de Estrutura: mover funciona + instantâneo (sem loading)",
      "itens": [
        "3 correções simultâneas:",
        "",
        "1. CAPTURA DE ESTADO NO MOMENTO CERTO: ordemAntes/numAntes",
        "   eram capturados DEPOIS do splice do bloco, então a",
        "   comparação estava errada e salvava mais tarefas que o",
        "   necessário (ou as erradas). Agora capturado ANTES.",
        "",
        "2. SEM LOADING — UI instantânea: a movimentação atualiza",
        "   a tela imediatamente (local-first). O save vai pro",
        "   Firestore em background sem bloquear nada.",
        "",
        "3. DRAG CAÍA NO CONTAINER: _arvDragOver e _arvDrop não",
        "   tinham stopPropagation(). O evento subia para o",
        "   container #arv-corpo com targetId=null, fazendo tudo",
        "   virar nível 0. Adicionado stopPropagation() em ambos."
      ]
    },
    {
      "versao": "V2.17.0",
      "legado": "V2.53.0",
      "status": "fechada",
      "data": "2026-07-09",
      "tipo": "funcionalidade",
      "titulo": "Versões de Planejamento (Atual/Base/Desafio) + Backup de Planejamentos",
      "itens": [
        "PLANEJAMENTO — novo seletor Atual | Linha de Base | Desafio",
        "  no topo da tabela: escolhe qual par de datas as colunas",
        "  Início/Término mostram e editam. Os 3 já eram campos",
        "  separados no banco (inicioPlanejado/terminoPlanejado,",
        "  inicioPlanejadoBase/terminoPlanejadoBase, inicioDesafio/",
        "  terminoDesafio) — editar o Atual NUNCA mexe na Linha de",
        "  Base ou no Desafio, e vice-versa. Duração automática (ao",
        "  editar início+fim) só recalcula na versão Atual.",
        "NOVO módulo BACKUP DE PLANEJAMENTOS (menu Sistema): histórico",
        "  de todas as alterações de % e datas feitas via Planejamento,",
        "  Semanal, Diário de Obra e Medições — quem, quando, tarefa,",
        "  campo, valor antes → depois",
        "Filtros por módulo, texto (tarefa/campo/e-mail) e período",
        "DESFAZER linha a linha: volta o campo ao valor anterior na",
        "  tarefa (marca a entrada como \"desfeito\", não desfaz 2x)",
        "EXCLUIR linha a linha ou em lote (filtro atual): remove só",
        "  o registro do histórico, não mexe no dado",
        "\"Desfazer filtradas\" em lote: reverte todas as alterações",
        "  do filtro atual de uma vez",
        "Alimentado pelo módulo Audit (já existia, mas só era usado",
        "  pelo Levantamento de Fachada) — agora Planejamento, Semanal,",
        "  Diário e Medições também registram cada mudança de campo"
      ]
    },
    {
      "versao": "V2.17.1",
      "legado": "V2.53.1",
      "status": "fechada",
      "data": "2026-07-22",
      "tipo": "correcao",
      "titulo": "CRÍTICO: início/término sumindo — versão Base/Desafio ficando ativa",
      "itens": [
        "A feature de versões de datas (V2.53) salva a versão ativa no",
        "  localStorage. Se ficou em Base ou Desafio, as colunas",
        "  Início/Término mostram os campos inicioPlanejadoBase/",
        "  terminoPlanejadoBase (que a maioria das tarefas não tem)",
        "  resultando em — em toda a tabela.",
        "Correção: _versaoData valida o valor do localStorage",
        "  (só aceita atual/base/desafio, senão volta para atual).",
        "Aviso vermelho aparece na toolbar quando não está em Atual,",
        "  com instrução clara de como voltar.",
        "Borda do seletor fica vermelha quando não está em Atual."
      ]
    },
    {
      "versao": "V2.17.2",
      "legado": "V2.53.2",
      "status": "fechada",
      "data": "2026-07-22",
      "tipo": "correcao",
      "titulo": "Diário: cascata de % em família ponderava por quantidade, não duração",
      "itens": [
        "CAUSA: Utils.percFamilia().percCalculado() (usada pelo Diário para",
        "  recalcular % dos pais/avós ao salvar avanço de uma tarefa-folha)",
        "  ponderava os filhos por quantidade quando todos tinham quantidade",
        "  preenchida. obras.js:_calcularProgresso (Dashboard/KPIs/Curva S)",
        "  sempre pondera por duração — os dois podiam divergir para a",
        "  mesma tarefa-pai.",
        "CORREÇÃO: percCalculado agora pondera sempre por duração",
        "  (peso = Math.max(1, duracao || 1)), igual ao Dashboard.",
        "Efeito: o % que o Diário grava nos pais/avós ao dar baixa numa",
        "  tarefa-folha agora bate exatamente com o % mostrado no Dashboard."
      ]
    },
    {
      "versao": "V2.17.2.1",
      "legado": "V2.53.3",
      "status": "fechada",
      "data": "2026-07-22",
      "tipo": "funcionalidade",
      "titulo": "Editor de Estrutura: inserir acima/abaixo + nível editável direto",
      "itens": [
        "INSERIR ACIMA (↑＋): cria irmão imediatamente antes da tarefa,",
        "  mesmo nível, já abre para editar o nome.",
        "INSERIR ABAIXO (↓＋): cria irmão logo depois do bloco da tarefa",
        "  (depois dos filhos dela, se tiver), mesmo nível.",
        "CRIAR FILHO (＋▸): igual ao ＋ anterior, cria filho (nível+1).",
        "NÍVEL EDITÁVEL (campo \"nv\"): input numérico ao lado dos botões.",
        "  Clica e digita o nível desejado (0-10) → aplica na hora.",
        "  Muda só essa tarefa, não arrasta os filhos junto.",
        "  Útil para corrigir nível errado rapidamente sem arrastar."
      ]
    },
    {
      "versao": "V2.17.3",
      "legado": "V2.53.4",
      "status": "fechada",
      "data": "2026-07-22",
      "tipo": "correcao",
      "titulo": "Calculadora de Fundação: desenhos corrigidos com base nos originais",
      "itens": [
        "Milton enviou os desenhos reais da calculadora de Fundações da",
        "  planilha antiga (imagens que estavam embutidas no Excel e não",
        "  dava pra ler o texto) — os desenhos da calculadora de concreto",
        "  foram refeitos para bater com eles:",
        "  → Estacas: vista da seção (B = diâmetro) + vista do fuste com",
        "    marcação em X e cota de arrasamento (A = comprimento)",
        "  → Tubulão a Céu Aberto: fuste + transição + base, com A/B/C/D/E",
        "    nas posições certas",
        "  → Sapata Isolada Piramidal: elevação simétrica (F dos dois",
        "    lados) + corte frontal (A/B base maior, C/D pescoço)",
        "  → Sapata de Divisa Piramidal: elevação assimétrica (E do lado",
        "    da divisa, F do lado livre) + linha de divisa marcada",
        "  → Bloco Triângular: triângulo com os 3 pilares nos cantos,",
        "    A no topo, B/D na base, E/F de altura (modo detalhado)",
        "  → Bloco Retangular: retângulo com os 4 pilares nos cantos",
        "  As fórmulas não mudaram — só os desenhos e a organização",
        "  visual dos campos, que já estavam corretos e validados."
      ]
    },
    {
      "versao": "V2.17.4",
      "legado": "V2.53.5",
      "status": "fechada",
      "data": "2026-07-22",
      "tipo": "correcao",
      "titulo": "Calculadora de Fundação: imagens originais, sem redesenhar",
      "itens": [
        "A V2.53.4 tinha redesenhado os diagramas à mão em SVG — Milton",
        "  pediu pra usar as imagens que ele mandou direto, sem",
        "  reinterpretar, e com qualidade máxima. Corrigido:",
        "  → As 6 imagens originais (extraídas em alta resolução, sem",
        "    nenhuma perda — conferido por checksum bit a bit) foram",
        "    salvas em assets/images/fundacoes/ e são exibidas direto",
        "    na calculadora, sem nenhum desenho customizado",
        "  → Layout do formulário mudado: a imagem agora ocupa a largura",
        "    toda acima dos campos (até 480px), em vez de uma coluna",
        "    estreita de 170px — as imagens originais têm textos",
        "    pequenos e ficariam ilegíveis espremidas naquele tamanho"
      ]
    },
    {
      "versao": "V2.17.5",
      "legado": "V2.53.6",
      "status": "fechada",
      "data": "2026-07-22",
      "tipo": "correcao",
      "titulo": "Levantamento de Ar Condicionado: mais correções de usabilidade",
      "itens": [
        "CORRIGIDO: pop-up de editar máquina descia até o final da tela",
        "  a cada letra digitada ou seleção — causa era um re-render",
        "  completo do modal a cada tecla (nome/taxa dos itens por ML).",
        "  Agora só re-renderiza tudo quando o TIPO (cm/ML ↔ un/ML) muda;",
        "  demais campos só atualizam a prévia, sem perder o scroll/foco",
        "Nova opção \"⧉ Duplicar\" na Configuração de Máquinas — duplica",
        "  toda a composição de peças de uma máquina para criar uma",
        "  variante rapidamente (ex: outro BTU com poucos ajustes)",
        "O diâmetro configurado (mm ou polegada, ex: 5/8\") agora aparece",
        "  junto ao nome da barra de cobre/PEX em todas as prévias e no",
        "  detalhamento de peças da máquina lançada",
        "CORRIGIDO: ao lançar uma máquina, a busca de peça manual quase",
        "  nunca mostrava a opção de criar material novo (a busca por",
        "  aproximação retornava algum resultado quase sempre). Agora a",
        "  opção \"+ Criar material novo\" aparece sempre, além dos",
        "  resultados encontrados na biblioteca",
        "Nova opção \"⧉ Duplicar\" em cada local da árvore (Locais da",
        "  Obra) — duplica o local e todos os seus sublocais com novos",
        "  IDs (sem copiar itens/máquinas já lançados) e já abre o",
        "  campo para renomear (ex: duplicar \"Apto 1\" → renomear para",
        "  \"Apto 2\"; funciona em qualquer nível, inclusive andares)"
      ]
    },
    {
      "versao": "V2.17.6",
      "legado": "V2.53.7",
      "status": "fechada",
      "data": "2026-07-22",
      "tipo": "correcao",
      "titulo": "Concreto: popup maior, salvar-e-próxima, limpar base, fix import duplicado",
      "itens": [
        "Popup da Calculadora de Concreto maior (960px) e imagem de",
        "  Fundação limitada por altura (não largura) — não fica mais",
        "  gigante nas imagens verticais (Estacas, Tubulão)",
        "Botão \"💾 Salvar e Nova\" em Nova/Editar Peça — salva sem fechar",
        "  o modal, pronto pra próxima peça (calculadora já fazia isso)",
        "Novo botão \"🗑 Limpar Base\" — apaga todas as peças e vínculos",
        "  com concretagens (dupla confirmação, não afeta BTs lançadas)",
        "CORREÇÃO DE BUG: importação em lote duplicava tudo — o botão",
        "  não travava durante o processamento, então um clique duplo",
        "  disparava a gravação duas vezes. Corrigido com trava."
      ]
    },
    {
      "versao": "V3.0.0",
      "legado": "V2.54.0",
      "status": "fechada",
      "data": "2026-07-23",
      "tipo": "lancamento",
      "titulo": "Módulo Suprimentos — pipeline de compra por tarefa (padrão CSO)",
      "itens": [
        "Nova tabela: 1 linha por tarefa-folha do Planejamento, com 5",
        "  etapas em cascata contando pra trás a partir do Início:",
        "  Cadastro de Solicitação → Mapa de Cotação → Pedido de Compra",
        "  → Mobilização e Produção → Folga → Início",
        "Datas planejadas de cada etapa calculadas automaticamente ao",
        "  detectar tarefa nova com Início Planejado definido, com",
        "  prazos configuráveis (⚙️ Prazos das Etapas) — padrão garante",
        "  que o Mapa de Cotação comece pelo menos 30 dias antes do Início",
        "Cada etapa tem Data + Status (Não Iniciado/Concluído), editáveis",
        "  por célula — tooltip mostra Planejado × Real quando divergem",
        "Coloração por prazo: verde (concluído), vermelho (prazo já",
        "  vencido), laranja (prazo em até 15 dias), neutro (distante)",
        "Coluna Desvio (Dias): diferença entre Início Real e Planejado",
        "  da tarefa, puxada do Planejamento para dar contexto",
        "Recalcular prazos preserva tarefas já editadas manualmente",
        "  (evita sobrescrever ajustes reais feitos por Milton)"
      ]
    },
    {
      "versao": "V3.0.1",
      "legado": "V2.54.1",
      "status": "fechada",
      "data": "2026-07-23",
      "tipo": "correcao",
      "titulo": "Suprimentos: edição direto na célula (sem pop-up)",
      "itens": [
        "CORREÇÃO DE UX: removido o pop-up que abria pra editar cada",
        "  etapa — agora Data e Status são input/select direto na",
        "  célula, igual ao padrão do Planejamento (clica e edita ali)",
        "Flag de \"editado manualmente\" agora é por ETAPA individual,",
        "  não mais pela tarefa inteira — editar só o Pedido de Compra",
        "  não trava o recálculo automático das outras 4 etapas",
        "Tarefas novas continuam sempre no automático até serem",
        "  editadas manualmente pela 1ª vez"
      ]
    },
    {
      "versao": "V3.0.1.1",
      "legado": "V2.55.0",
      "status": "fechada",
      "data": "2026-07-23",
      "tipo": "funcionalidade",
      "titulo": "Dashboard: toggle \"Mostrar Contenção, Fundação e Estrutura\" — Fundação/Estrutura real, Contenção placeholder",
      "itens": [
        "NOVO — checkbox no topo do Dashboard (\"Mostrar Contenção,",
        "  Fundação e Estrutura\"), desligado por padrão. Preferência de",
        "  tela (localStorage), não é dado da obra.",
        "",
        "Fundação e Estrutura: barra simples Previsto x Executado (m³),",
        "  somada a partir do Controle de Concreto (concretoPecas +",
        "  concretoLancamentos) — \"Fundação\" = peças com tipo==='Fundação',",
        "  \"Estrutura\" = todas as outras (Pilar/Viga/Laje/Cortina/Escada/",
        "  Rampa/Caixa D'água/Outro), somadas juntas numa barra só.",
        "",
        "Contenção (Solo Grampeado): por enquanto só um placeholder — o",
        "  mapa de vistas (desenho da vista com os chumbadores marcados,",
        "  colorido por status) fica pra depois, a pedido do Milton.",
        "",
        "De passagem: card de Suprimentos no Dashboard tinha texto",
        "  desatualizado dizendo \"módulo não implementado\" — o módulo já",
        "  saiu do estágio de stub (V2.54.0). Texto corrigido pra deixar",
        "  claro que só o RESUMO aqui no Dashboard ainda não foi feito."
      ]
    },
    {
      "versao": "V3.0.1.2",
      "legado": "V2.55.1",
      "status": "fechada",
      "data": "2026-07-23",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Ar Condicionado: Resumo separa por diâmetro do cobre + exportar CSV para compras",
      "itens": [
        "CORRIGIDO: o Resumo Geral podia juntar diâmetros diferentes de",
        "  cobre na mesma linha (ou separar de forma inconsistente,",
        "  dependendo de como o material foi nomeado na biblioteca).",
        "  Agora a barra de cobre/PEX é SEMPRE separada por diâmetro",
        "  configurado na máquina (ex: \"Barra de Cobre (Ø 1/4\")\" e",
        "  \"Barra de Cobre (Ø 5/8\")\" aparecem como linhas distintas),",
        "  independente do nome que foi dado ao material",
        "NOVO — botão \"Exportar CSV\" no Resumo Geral e em qualquer",
        "  local com sublocais (Resumo consolidado). Baixa um arquivo",
        "  .csv (Material, Total, Unidade, Comprar em unidades) pronto",
        "  pra abrir no Excel/Sheets e mandar direto pra equipe de",
        "  compras — sem precisar copiar dado por dado da tela"
      ]
    },
    {
      "versao": "V3.0.2",
      "legado": "V2.55.2",
      "status": "fechada",
      "data": "2026-07-23",
      "tipo": "correcao",
      "titulo": "Levantamento de Ar Condicionado: botão de criar material novo sempre visível na busca de peça manual",
      "itens": [
        "CORRIGIDO: o botão \"+ Criar material novo\" ficava dentro da",
        "  lista rolável de resultados da busca por aproximação — se a",
        "  busca trouxesse vários resultados parecidos, o botão de criar",
        "  ficava escondido lá embaixo e passava despercebido",
        "Agora o botão \"+ Criar material novo: [texto buscado]\" fica",
        "  fixo logo abaixo do campo de busca, sempre visível, e a",
        "  lista de resultados encontrados na biblioteca fica separada",
        "  embaixo dele, numa área rolável própria"
      ]
    },
    {
      "versao": "V3.0.3",
      "legado": "V2.55.3",
      "status": "fechada",
      "data": "2026-07-22",
      "tipo": "correcao",
      "titulo": "Editor: 3 fixes críticos (filhos sumindo, scroll, saves concorrentes)",
      "itens": [
        "Filhos sumindo: ordemAntes capturado ANTES do splice (estava depois).",
        "Saves concorrentes: fila serializada _arvSaveQueue — movimentos rápidos não se sobrepõem.",
        "Scroll subindo: _arvToggle preserva scrollTop do arv-corpo."
      ]
    },
    {
      "versao": "V3.1.0",
      "legado": "V2.56.0",
      "status": "fechada",
      "data": "2026-07-23",
      "tipo": "funcionalidade",
      "titulo": "Levantamento e Controle de Solo Grampeado: mapa sobre PDF/imagem da elevação, escala calibrada e execução por etapas",
      "itens": [
        "Levantamento: cada vista recebe um PDF (elevação) ou imagem — chumbadores são posicionados livremente por clique sobre ela (as vistas reais são irregulares: espaçamento variável, terreno inclinado — não davam pra usar um grid regular).",
        "PDF renderizado via pdf.js e comprimido (JPEG, redimensionado se preciso) antes de salvar, respeitando o limite de ~950KB do Firestore.",
        "Escala calibrada por 2 cliques no mapa + comprimento real (cm), com m² da vista sugerido automaticamente (editável).",
        "Zoom (+/−) no editor do Levantamento pra marcar com precisão em desenhos compridos.",
        "Número do chumbador: sugestão automática (sequencial entre vistas, igual ao desenho real) sempre editável manualmente.",
        "Especificações de Materiais por chumbador (modelo, barra de aço, mangueira/espaguete, cimento de injeção) vinculadas à Biblioteca de Materiais, com criação de material novo direto no formulário.",
        "Controle: mesmo mapa, interativo — clique no chumbador marca etapas (Perfuração 20%, Injeção 1 15%, Injeção 2 15%); modo Projeção (30%) e Acabamento (20%) marca área arrastando um retângulo, convertido em m² reais pela escala.",
        "% de execução da vista pelo peso das 5 etapas; cada marcação gera lançamento automático no Relatório Diário.",
        "Vínculo com o Planejamento: métricas de Metro Linear, Quantidade de Chumbadores e Área (m²) de Solo Grampeado.",
        "Dashboard: painel \"Contenção (Solo Grampeado)\" com o mapa de cada vista na proporção real da imagem (larga/baixa nas elevações compridas)."
      ]
    },
    {
      "versao": "V3.1.0.1",
      "legado": "V2.57.0",
      "status": "fechada",
      "data": "2026-07-23",
      "tipo": "melhoria",
      "titulo": "Dashboard: reordenado (Atividades → Suprimentos → Contenção/Fundação/Estrutura → Curva S → Resumo por Apartamento), PPC Semanal/Motivos de Atraso removidos, Suprimentos e Fundação/Estrutura com dados reais",
      "itens": [
        "Nova ordem pedida pelo Milton: Atividades, Suprimentos, Contenção, Fundação e Estrutura, Curva S, Resumo por Apartamento — o resto (PPC Semanal, Motivos de Atraso Semanais) foi removido da tela.",
        "Suprimentos: card deixou de ser texto fixo — mostra as Próximas Atividades (ainda não iniciadas no Planejamento) cujo pipeline de Suprimentos ainda não foi tocado (todas as 5 etapas em \"não iniciado\", ou nem tem doc ainda). Selo vermelho \"Sem registro\" vs laranja \"Não iniciado\".",
        "Fundação e Estrutura: o gráfico comparava só 2 totais (Fundação x Estrutura) — trocado por Previsto x Executado (m³) POR ANDAR, na mesma ordem de andar do Controle de Concreto (CC.ordenarAndares, respeita ordem customizada se existir), com tooltip mostrando a data do último lançamento daquele andar.",
        "Contenção e Fundação/Estrutura trocaram de posição (Contenção primeiro, como pedido)."
      ]
    },
    {
      "versao": "V3.1.1",
      "legado": "V2.57.1",
      "status": "fechada",
      "data": "2026-07-24",
      "tipo": "correcao",
      "titulo": "Produção: % Concl. de tarefa-pai usava campo cru, não o cálculo ponderado por duração",
      "itens": [
        "Coluna \"% Concl.\" de tarefas-pai (grupos) na tela de Produção lia t.percentualConcluido direto do Firestore, que só é sincronizado quando alguém edita % pelo próprio Planejamento — podendo ficar dessincronizado do valor real quando o % do pai muda por outros caminhos.",
        "Corrigido para usar fam.percCalculado(t) — mesma convenção já usada por Dashboard/obras.js e Diário de Obra, ponderando por duração dos filhos.",
        "Sem impacto em tarefas-folha (continuam lendo percentualConcluido direto, que é o valor real editável)."
      ]
    },
    {
      "versao": "V3.1.2",
      "legado": "V2.57.2",
      "status": "fechada",
      "data": "2026-07-24",
      "tipo": "correcao",
      "titulo": "Planejamento: corrigido bug crítico que fazia tarefas mudarem de posição sozinhas ao salvar/recarregar",
      "itens": [
        "Causa raiz: o botão \"+ Tarefa\" calculava a ordem da tarefa nova como sel.ordem+1 — que colide exatamente com a ordem da próxima tarefa já existente (lista normalizada em inteiros sequenciais). Esse empate era resolvido pelo Firestore por ID do documento, não pela ordem pretendida, e por isso a posição (e o numLinha, usado nas Predecessoras) mudava sozinha no reload seguinte — carregar() roda a cada Salvar/Excluir/Importar.",
        "inserirTarefa() agora calcula a ordem da tarefa nova como um valor estritamente entre a tarefa selecionada e a próxima (mesma técnica já usada no Editor de Estrutura), garantindo que nunca colide.",
        "salvarTarefa() ganhou um guard anti-colisão: se o valor de \"Ordem\" (calculado ou digitado manualmente no formulário) já pertencer a outra tarefa, é ajustado em micro-incremento antes de salvar.",
        "Novo botão \"🔧 Corrigir Ordens\" na barra do Planejamento: renumera e persiste a ordem de TODAS as tarefas da obra em sequência única, corrigindo qualquer duplicata que já exista em produção (causada pelo bug antes desta versão). Preserva a ordem visual atual — só remove os empates internos. Recomendado rodar uma vez em cada obra."
      ]
    },
    {
      "versao": "V3.1.3",
      "legado": "V2.57.3",
      "status": "fechada",
      "data": "2026-07-24",
      "tipo": "correcao",
      "titulo": "Editor de Estrutura: corrigido o segundo bug que quebrava a estrutura — inserir tarefa (irmã acima/abaixo ou filha) desalinhava a ordem de TODAS as outras tarefas no Firestore",
      "itens": [
        "Causa raiz #2: _arvInserirAcima, _arvInserirAbaixo e _arvCriarFilho renumeravam a ordem de TODAS as tarefas localmente (para ficar 1,2,3... \"bonito\" na tela), mas só salvavam essa renumeração da tarefa recém-criada no Firestore. Todas as outras tarefas ficavam com a ordem antiga, desatualizada, gravada no banco — invisível na sessão atual, mas exposta assim que a tela era recarregada (ou lida pela outra conta Claude/sessão), reaparecendo em posições e níveis diferentes do esperado.",
        "As 3 funções agora só inserem a tarefa nova com uma ordem fracionária única entre as vizinhas (sem tocar na ordem das demais) — elimina de vez a divergência entre o que a tela mostra e o que está gravado.",
        "Se a Estrutura de alguma obra específica ainda estiver com posições/níveis errados (resíduo do bug antes desta versão), use o botão \"🔧 Corrigir Ordens\" (Gantt → barra superior) uma vez para renumerar e persistir tudo corretamente."
      ]
    },
    {
      "versao": "V3.1.4",
      "legado": "V2.57.4",
      "status": "fechada",
      "data": "2026-07-24",
      "tipo": "correcao",
      "titulo": "Editor de Estrutura: corrigido o terceiro bug — soltar o card fora de uma linha (espaço vazio da árvore) movia o galho inteiro para a raiz sem querer, zerando o nível",
      "itens": [
        "Causa raiz #3: o container da árvore tem seu próprio ondrop escutando \"mover para raiz\" (targetId=null) — usado para permitir soltar após a última linha. Como o alvo de drop no navegador é determinado pela posição exata do cursor, soltar perto da borda de uma linha (ou num espaço entre linhas) cai no container em vez da linha, disparando \"mover para raiz\" sem intenção. Isso zera o nível da tarefa arrastada e desloca todo o galho de filhos junto, na mesma proporção — exatamente o padrão de \"vários níveis 0 fantasmas com estrutura interna intacta\" visto pelo Milton.",
        "Mover para raiz via drop no espaço vazio agora exige confirmação explícita antes de aplicar. Mover para raiz de propósito continua disponível e direto pelo botão ↗ \"Mover para\" → Raiz.",
        "Barra de ferramentas do Planejamento: os botões não quebram mais para uma segunda linha (rolagem horizontal em vez de quebra)."
      ]
    },
    {
      "versao": "V3.1.5",
      "legado": "V2.57.5",
      "status": "fechada",
      "data": "2026-07-24",
      "tipo": "correcao",
      "titulo": "Importar/Exportar Excel: hierarquia (Nível) não sobrevivia a uma reestruturação manual da árvore seguida de reimportação",
      "itens": [
        "Causa raiz: o Código (texto digitado manualmente, ex. \"1.3.2.4.1\") não é recalculado quando a árvore é reestruturada no Editor de Estrutura (criar um grupo novo por cima de tarefas existentes, mover, etc.) — só o campo Nível (numérico) reflete a estrutura real. Só que o Importar priorizava o Código (contagem de pontos) para calcular o nível, e por estar desatualizado, tarefas reagrupadas voltavam \"soltas\" (irmãs) em vez de aninhadas dentro do novo grupo pai ao reimportar.",
        "Exportar agora grava uma coluna \"Nível\" explícita, sempre fiel à árvore atual.",
        "Importar agora prioriza essa coluna \"Nível\" quando presente — Código/indentação viram apenas fallback para planilhas externas que não tenham essa coluna.",
        "Recomendado: para editar e reimportar sem perder a estrutura, sempre exporte deste sistema primeiro (a coluna Nível vai junto) em vez de reaproveitar uma planilha antiga sem essa coluna."
      ]
    },
    {
      "versao": "V3.1.6",
      "legado": "V2.57.6",
      "status": "fechada",
      "data": "2026-07-24",
      "tipo": "correcao",
      "titulo": "Planejamento: revertida a troca de quebra-de-linha por scroll horizontal na barra de ferramentas — espremia o seletor Atual/Linha de Base/Desafio em telas estreitas",
      "itens": [
        "O fix da V2.57.4 (nowrap+scroll horizontal) evitava a 2ª linha, mas em telas mais estreitas forçava o grupo de botões \"Atual/Linha de Base/Desafio\" a encolher e sobrepor o próprio texto. Voltou a quebrar linha (flex-wrap), que é só cosmético e não causa esse problema visual."
      ]
    },
    {
      "versao": "V3.1.6.1",
      "legado": "V2.57.7",
      "status": "fechada",
      "data": "2026-07-24",
      "tipo": "melhoria",
      "titulo": "Planejamento: barra de ferramentas cabe numa linha só — Importar/Exportar/Corrigir Ordens/PNG/Vínculos agrupados em um menu \"⚙ Ferramentas\"",
      "itens": [
        "Reduz de 12 para 8 elementos na barra, cabendo numa linha só na maioria das telas sem quebrar nem espremer o seletor Atual/Linha de Base/Desafio."
      ]
    },
    {
      "versao": "V3.1.6.2",
      "legado": "V2.57.8",
      "status": "fechada",
      "data": "2026-07-24",
      "tipo": "funcionalidade",
      "titulo": "Editor de Estrutura: seleção múltipla de tarefas — clique+Shift (intervalo) ou clique+Ctrl (avulsas), depois arrasta todas juntas para dentro de uma nova tarefa/pai",
      "itens": [
        "Clique numa linha seleciona só ela; Shift+clique seleciona o intervalo entre a última clicada e essa; Ctrl/Cmd+clique adiciona/remove uma linha avulsa da seleção — linhas selecionadas ficam destacadas em amarelo.",
        "Arrastar qualquer linha selecionada move o grupo inteiro junto (cada uma com seus próprios filhos) para o novo pai/posição, de uma vez só — sem precisar arrastar uma de cada vez.",
        "Se a seleção incluir um pai e algum filho dele junto, o filho não é movido em duplicidade — só o bloco do pai (que já leva o filho junto).",
        "Mesma proteção da V2.57.4 se aplica: soltar fora de uma linha (mover tudo para a raiz) pede confirmação."
      ]
    },
    {
      "versao": "V3.1.7",
      "legado": "V2.57.9",
      "status": "fechada",
      "data": "2026-07-24",
      "tipo": "correcao",
      "titulo": "Editor de Estrutura: clicar numa linha para selecioná-la pulava a tela pro topo",
      "itens": [
        "Selecionar não preservava a posição do scroll. Corrigido."
      ]
    },
    {
      "versao": "V3.1.8",
      "legado": "V2.57.10",
      "status": "fechada",
      "data": "2026-07-24",
      "tipo": "correcao",
      "titulo": "Predecessoras: suporte a múltiplas predecessoras (ex: \"7TI; 98II+10d\") e a sufixo de dias no atraso (ex: \"+10d\") — formato usado pelo cronograma do CSO",
      "itens": [
        "Causa: o cálculo automático de datas por predecessora só entendia UMA predecessora por tarefa (regex ancorada do início ao fim da string) e não tolerava a letra \"d\" no atraso. Qualquer tarefa com mais de uma predecessora (separadas por \";\") ou com atraso escrito como \"+10d\" em vez de \"+10\" tinha o cálculo de data silenciosamente ignorado.",
        "Agora aceita múltiplas predecessoras separadas por \";\" e usa a mais restritiva (data mais tardia) entre elas — mesma regra do MS Project/CPM.",
        "Aceita sufixo \"d\"/\"dd\" no atraso.",
        "Remapeamento de predecessoras ao reordenar tarefas (_remapearPredecessoras) também corrigido para atualizar TODAS as predecessoras de uma tarefa, não só a primeira.",
        "Relevante para importar cronogramas vindos do CSO: cerca de 60% das tarefas de um cronograma típico usam múltiplas predecessoras."
      ]
    },
    {
      "versao": "V3.1.9",
      "legado": "V2.57.11",
      "status": "fechada",
      "data": "2026-07-24",
      "tipo": "correcao",
      "titulo": "Importar Excel: travava/parava na metade em planilhas grandes (ex: 1755 tarefas só importava ~1000)",
      "itens": [
        "Causa: toda tarefa criada também grava um snapshot em historicoExecucao/{hoje} — um único documento no Firestore. Ao importar centenas/milhares de tarefas de uma vez em paralelo, todas competem para escrever nesse MESMO documento, e o Firestore derruba parte dessas escritas concorrentes (limite prático de throughput por documento) — o import parava silenciosamente na metade sem erro visível.",
        "Import em massa agora pula esse snapshot (ele é só um histórico auxiliar de % concluído/quantidade por dia, não a tarefa em si).",
        "Import agora também informa se alguma tarefa falhou, em vez de contar silenciosamente menos do que o esperado."
      ]
    },
    {
      "versao": "V3.1.10",
      "legado": "V2.57.12",
      "status": "fechada",
      "data": "2026-07-24",
      "tipo": "correcao",
      "titulo": "Importar Excel: mesmo após a V2.57.11, planilha de 1755 linhas ainda travava sempre exatamente na linha 1000",
      "itens": [
        "O corte reprodutível sempre na mesma linha (não aleatório) indicava o SDK do Firestore travando por excesso de escrita simultânea — 200 tarefas em paralelo por lote era demais, mesmo sem o snapshot da V2.57.11 (provavelmente agravado pelo cache offline do navegador).",
        "Reduzido o lote de 200 para 20 escritas simultâneas, e adicionado timeout de 15s por tarefa: se uma escrita travar, ela vira uma falha reportada em vez de travar o import inteiro para sempre."
      ]
    },
    {
      "versao": "V3.1.11",
      "legado": "V2.57.13",
      "status": "fechada",
      "data": "2026-07-24",
      "tipo": "correcao",
      "titulo": "Importar Excel: o corte em ~1000 persistia mesmo com lote menor — causa era o import reiniciar do ZERO a cada tentativa (apagava tudo antes de recriar), travando sempre no mesmo ponto e nunca progredindo",
      "itens": [
        "Import agora NÃO apaga mais as tarefas existentes antes de importar. Em vez disso, faz upsert por Código: tarefa com Código já existente é ATUALIZADA, tarefa nova é CRIADA. Tarefas antigas que não estão mais na planilha não são apagadas.",
        "Isso torna o import retomável: se travar/falhar no meio de uma planilha grande por qualquer motivo de ambiente, importar de novo (o mesmo arquivo) completa só o que faltou, em vez de reiniciar do zero e travar no mesmo lugar de novo.",
        "Recomendado rodar \"🔧 Corrigir Ordens\" depois de um import grande, para garantir que a ordem de exibição fique limpa."
      ]
    },
    {
      "versao": "V3.1.11.1",
      "legado": "V2.57.14",
      "status": "fechada",
      "data": "2026-07-24",
      "tipo": "melhoria",
      "titulo": "Importar Excel: tarefas que existiam antes e não vieram na planilha agora aparecem num painel de revisão pra decidir excluir ou manter — em vez de ficarem soltas",
      "itens": [
        "Depois do import (upsert por Código da V2.57.13), abre um painel listando as tarefas que tinham Código mas não apareceram na planilha importada — com checkbox por tarefa, \"marcar/desmarcar todas\" e botão para excluir só as marcadas. Fechar sem marcar nada mantém tudo como está."
      ]
    },
    {
      "versao": "V3.1.11.2",
      "legado": "V2.57.15",
      "status": "fechada",
      "data": "2026-07-27",
      "tipo": "melhoria",
      "titulo": "Dashboard: filtro por grupo-pai nos cards Atividades e Suprimentos (substituído na V2.57.16)",
      "itens": [
        "Novo seletor no topo dos cards \"Atividades\" e \"Suprimentos\" pra restringir a lista ao grupo-pai escolhido (ex: só \"Alvenaria\", em vez de todos os apartamentos misturados de todos os serviços).",
        "O pai de cada tarefa-folha é achado pela mesma lógica de ordem/nível já usada no resto do sistema (não existe parentId nos dados) — é o registro mais próximo acima dela na ordem geral com nível menor.",
        "O filtro é independente entre os dois cards: pode ver \"Alvenaria\" em Atividades e \"Todos os grupos\" em Suprimentos ao mesmo tempo."
      ]
    },
    {
      "versao": "V3.1.11.3",
      "legado": "V2.57.16",
      "status": "fechada",
      "data": "2026-07-27",
      "tipo": "melhoria",
      "titulo": "Dashboard: filtro da V2.57.15 substituído por árvore navegável (igual ao Editor de Estrutura do Planejamento) em Atividades e Suprimentos",
      "itens": [
        "O filtro por grupo-pai escondia grupos cujas tarefas mais próximas estavam fora do corte de \"8 mais próximas\" (ex: \"1ª Demão\" com tudo daqui a meses simplesmente não aparecia na lista de opções).",
        "Substituído por árvore expansível: cada card mostra os grupos a partir de um nível fixo escolhido (botões \"Nível 0/1/2/3...\"), com clique pra abrir/fechar e ver os níveis abaixo ou o grupo acima.",
        "Grupo recolhido mostra resumo agregado das tarefas-folha dentro dele (peso por duração, mesma convenção do resto do Dashboard): quantidade de itens, % médio e a data mais próxima (prazo em Em Execução, início em Próximas/Suprimentos) — sem limite de 8, então grupos só com tarefas distantes no tempo continuam aparecendo.",
        "Estado de nível/expansão independente entre Atividades e Suprimentos."
      ]
    },
    {
      "versao": "V3.1.11.4",
      "legado": "V2.57.17",
      "status": "fechada",
      "data": "2026-07-27",
      "tipo": "melhoria",
      "titulo": "Dashboard: horizonte de tempo em Próximas/Suprimentos + Em Execução e Próximas empilhadas (não mais lado a lado) + nível sem teto",
      "itens": [
        "Sem limite de tempo, \"Próximas\" e \"Suprimentos\" mostrariam literalmente TODA tarefa futura da obra (anos à frente) — agora tem seletor de horizonte (7 dias / 1 mês / 3 meses / 6 meses / 1 ano / Tudo), padrão 1 mês. \"Em Execução\" não usa horizonte (é o que está rolando agora).",
        "\"Em Execução\" e \"Próximas\" deixaram de ficar lado a lado (um ficava vazio enquanto o outro lotava com o filtro) — agora empilhadas, cada uma com seu próprio nível fixo e (no caso de Próximas) seu próprio horizonte.",
        "Botões de nível fixo não travam mais em 4 — vão até o nível mais profundo que existir de fato nos dados da obra.",
        "Grupo recolhido não mostra mais a linha de data (só nome, contagem e %) — some ao abrir, deixando a árvore mais enxuta conforme desce de nível."
      ]
    },
    {
      "versao": "V3.1.12",
      "legado": "V2.57.18",
      "status": "fechada",
      "data": "2026-07-27",
      "tipo": "correcao",
      "titulo": "Levantamento Ar Condicionado: itens vinculados (ex: espuma) sumiam/se fundiam no Resumo consolidado quando duas máquinas com diâmetros diferentes usavam o mesmo material",
      "itens": [
        "Só o item principal de cobre separava por diâmetro no resumo (chave materialId+diâmetro); os itens vinculados (espuma etc.) agregavam só por materialId — se duas máquinas de diâmetros diferentes (ex: Ø 1/2\" e Ø 1/4\") usassem o mesmo material vinculado, uma entrada sobrescrevia/fundia com a outra e sumia do resumo.",
        "Corrigido: itens vinculados agora também separam por diâmetro no resumo (mesma lógica do cobre), com o diâmetro aparecendo no nome (ex: \"Espuma Polipex (Ø 1/2)\")."
      ]
    },
    {
      "versao": "V3.1.13",
      "legado": "V2.57.19",
      "status": "fechada",
      "data": "2026-07-27",
      "tipo": "correcao",
      "titulo": "Levantamento AC: fix V2.57.18 duplicava diâmetro no nome (ex: \"(Ø 1/4) (Ø 3/8)\") quando usuário já escreve o diâmetro manualmente no nome do item",
      "itens": [
        "Máquina não tem campo estruturado de diâmetro por item — usuário digita o diâmetro no próprio nome. V2.57.18 concatenava o diâmetro da máquina por cima, duplicando.",
        "Revertida concatenação automática; separação no resumo agora usa o nome completo como chave (sem sobrescrever nome digitado)."
      ]
    },
    {
      "versao": "V3.1.14",
      "legado": "V2.57.20",
      "status": "fechada",
      "data": "2026-07-27",
      "tipo": "correcao",
      "titulo": "Levantamento AC: fix V2.57.19 removeu diâmetro do Cobre principal no resumo (campo estruturado da máquina, diferente do texto livre dos vinculados)",
      "itens": [
        "Cobre principal tem campo de diâmetro estruturado próprio (separado do texto livre dos vinculados) — restaurado no nome do resumo."
      ]
    },
    {
      "versao": "V3.1.15",
      "legado": "V2.57.21",
      "status": "fechada",
      "data": "2026-07-27",
      "tipo": "correcao",
      "titulo": "Dashboard: árvore de Atividades/Suprimentos esquecia o nível e o horizonte de tempo escolhidos a cada F5",
      "itens": [
        "Nível fixo e horizonte de tempo dos cards Em Execução/Próximas/Suprimentos agora persistem em localStorage (preferência de UI, não dado da obra) — a árvore volta a abrir onde o usuário deixou, em vez de sempre no Nível 0.",
        "Quais grupos estavam abertos/fechados continua reiniciando a cada carregamento (não faz sentido persistir isso entre trocas de obra)."
      ]
    },
    {
      "versao": "V3.1.15.1",
      "legado": "V2.57.22",
      "status": "fechada",
      "data": "2026-07-27",
      "tipo": "melhoria",
      "titulo": "Dashboard: nível/horizonte da árvore agora seguem o usuário entre PCs (não só localStorage)",
      "itens": [
        "Preferência salva em Firestore (users/{uid}.dashboardArvorePrefs), por ser pessoal do usuário — não da obra. Abrir em outro computador já traz o nível e o horizonte que o usuário deixou da última vez.",
        "localStorage continua sendo usado como cache local instantâneo (evita a árvore nascer no Nível 0 e só \"pular\" pro nível certo depois que o Firestore responder).",
        "Gravação com pequeno atraso (debounce) pra não gerar uma escrita a cada clique isolado se o usuário mexer em vários controles em sequência."
      ]
    },
    {
      "versao": "V3.1.15.2",
      "legado": "V2.57.23",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "melhoria",
      "titulo": "Suprimentos: filtro por nível, status \"Em Andamento\", edição inline mais rápida e filtro de status por etapa",
      "itens": [
        "Filtro por nível hierárquico (botões Nível 0/1/2...) igual ao padrão do Dashboard — mostra só os pais do nível escolhido, preferência salva em localStorage.",
        "Novo status \"Em Andamento\" nas 5 etapas, além de Não Iniciado/Concluído (cor azul, --cor-info).",
        "Clique/edição inline (data e status) não reconstrói mais a tabela inteira a cada mudança — atualiza só a célula editada, resolvendo a lentidão/travamento reportado.",
        "Cores dos selects de status com contorno e fundo mais destacados (mais fácil bater o olho e diferenciar).",
        "Filtro por status (▼) no cabeçalho de cada etapa, igual ao filtro de status do Planejamento — combina com o filtro de nível."
      ]
    },
    {
      "versao": "V3.1.15.3",
      "legado": "V2.57.24",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "funcionalidade",
      "titulo": "Suprimentos: prazo customizável por tarefa (além do padrão global)",
      "itens": [
        "Modal de Configurações agora tem 2ª coluna com a lista de tarefas (filtrável por nível), cada uma marcada \"Padrão\" ou \"Customizado\".",
        "Editar o prazo de uma tarefa que tem filhos aplica o mesmo prazo a todos os descendentes dela (cascata pai → filhos).",
        "Botão para remover a customização e voltar ao padrão global.",
        "Cálculo de datas (geração de pendentes e recálculo) agora usa o prazo customizado da tarefa quando existir; senão usa o padrão global — sem mudar o comportamento de quem nunca customizou nada."
      ]
    },
    {
      "versao": "V3.1.15.4",
      "legado": "V2.57.25",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "melhoria",
      "titulo": "Suprimentos: seleção manual de quais tarefas entram no pipeline (troca o filtro por nível)",
      "itens": [
        "Removido o filtro por nível hierárquico da tela principal — causava linhas de grupo vazias/\"undefined\" e escondia dados em níveis intermediários.",
        "Novo botão \"☑️ Configurar Suprimentos\" abre a árvore inteira do Planejamento (todos os níveis) com checkbox por linha — o usuário escolhe exatamente quais tarefas precisam de suprimento (ex.: só \"Alvenaria Estrutural\", sem repetir por lado A/B).",
        "Tela principal agora é uma lista plana só com as tarefas marcadas — sempre com dados completos, sem depender de folha/grupo.",
        "Dados antigos gerados automaticamente (por tarefa-folha) foram zerados ao trocar de modelo — a seleção começa do zero, conforme combinado.",
        "Salvar a seleção apaga o pipeline das tarefas desmarcadas e gera pendentes das que entraram, sem duplicar quem já tinha doc."
      ]
    },
    {
      "versao": "V3.1.15.5",
      "legado": "V2.57.26",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "melhoria",
      "titulo": "Suprimentos: marcador de 3 estados (dados/título/oculto) e formatação visual das células",
      "itens": [
        "Marcador de seleção agora tem 3 estados ao clicar: vazio → ✓ (linha com dados/pipeline completo) → ● (linha só como título, sem pipeline) → vazio de novo.",
        "Linha em modo \"título\" mostra só o nome da tarefa, útil pra organizar visualmente sem gerar suprimento pra ela (ex.: mostrar o pai acima de um grupo de filhos).",
        "Correção visual: selects de status com fonte maior e seta customizada (o texto \"Não Iniciado\" cortava dentro da caixa antes), inputs de data com contorno mais grosso e cores mais sólidas.",
        "Colunas de Data/Status com largura mínima maior para não espremer o conteúdo."
      ]
    },
    {
      "versao": "V3.1.15.6",
      "legado": "V2.57.27",
      "status": "fechada",
      "data": "2026-07-24",
      "tipo": "funcionalidade",
      "titulo": "Planejamento: tarefas-pai (grupos) agora recebem início/término automaticamente — início = o menor dos filhos, término = o maior — inclusive gravado no Firestore (necessário pro Suprimentos e outros módulos que leem essa data direto)",
      "itens": [
        "Antes, um pai só tinha data se ela tivesse sido digitada/importada manualmente ali — se não tivesse, ficava em branco mesmo com todos os filhos preenchidos, e módulos que leem inicioPlanejado direto do documento da tarefa ficavam sem essa informação.",
        "Agora recalcula de baixo pra cima (filho antes do pai, pai antes do avô) e GRAVA o resultado no pai — não é só um efeito visual na tela.",
        "Roda automaticamente depois de: importar Excel, salvar uma tarefa pelo formulário, editar Início/Término/Início Real/Término Real direto na célula.",
        "Também disponível manualmente em ⚙ Ferramentas → \"📐 Recalcular Datas dos Pais\", pra rodar em obras que já tinham pais com data errada/em branco de antes desta versão.",
        "Novas colunas Início Real e Término Real na tabela do Planejamento (visualização — preenchidas pelo Diário de Obra, Medições e Semanal, que já alimentavam esses campos mas não apareciam aqui)."
      ]
    },
    {
      "versao": "V3.1.16",
      "legado": "V2.57.28",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "correcao",
      "titulo": "Suprimentos: colunas da direita cortadas — coluna Nome da Tarefa agora fixa (sticky) ao rolar",
      "itens": [
        "Larguras mínimas das colunas reduzidas (estavam exageradas, empurrando a tabela pra fora da tela sem indicação clara de rolagem).",
        "Coluna \"Nome da Tarefa\" fixa (sticky) na lateral esquerda — ao rolar horizontalmente pra ver Mobilização/Folga/Desvio, o nome da tarefa não some mais."
      ]
    },
    {
      "versao": "V3.1.17",
      "legado": "V2.57.29",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "correcao",
      "titulo": "Suprimentos: correção V2.57.28 (sticky) piorou o corte de colunas — revertida",
      "itens": [
        "O position:sticky na coluna Nome da Tarefa não funcionou bem junto com o scroll da tabela e piorou o corte à direita — removido.",
        "Larguras mínimas de todas as colunas (Data, Status, Desvio, Início) reduzidas mais uma vez, para caber mais colunas na tela antes de precisar rolar."
      ]
    },
    {
      "versao": "V3.1.18",
      "legado": "V2.57.30",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "correcao",
      "titulo": "Suprimentos: tabela agora usa table-layout:fixed — todas as colunas cabem na tela sem scroll horizontal",
      "itens": [
        "Causa raiz: os min-width somados de todas as colunas ultrapassavam a largura da tela, empurrando as últimas colunas (Mobilização, Folga) pra fora — cada correção anterior só mexeu nos números sem resolver a causa.",
        "Removidos todos os min-width forçados de colunas e do select de status. A tabela agora usa table-layout:fixed, que distribui o espaço disponível entre as colunas em vez de deixá-las \"vazar\" pra fora.",
        "Nome da Tarefa quebra em 2 linhas quando necessário, em vez de empurrar as demais colunas."
      ]
    },
    {
      "versao": "V3.1.19",
      "legado": "V2.57.31",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "correcao",
      "titulo": "Suprimentos: célula de data virou pill compacto sem ícone de calendário nativo — testado sem overflow em 1366px/1920px antes de publicar",
      "itens": [
        "O input date nativo do navegador reserva espaço fixo pro ícone de calendário, e isso — somado ao select de status — não deixava as 5 etapas caberem lado a lado em nenhuma largura de tela testada.",
        "Data agora aparece como texto colorido compacto (mesmo padrão do exemplo enviado), sem o ícone nativo — clicar em qualquer parte da célula ainda abre o calendário do navegador normalmente.",
        "Status voltou a ser um select simples com fundo branco (mais parecido com o exemplo de referência), sem seta customizada nem cores fortes no fundo.",
        "Desta vez a correção foi validada com medição real de largura (Playwright/Chromium headless) em 1366px, 1550px e 1920px antes do commit — sem overflow em nenhuma delas."
      ]
    },
    {
      "versao": "V3.1.20",
      "legado": "V2.57.32",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "correcao",
      "titulo": "Suprimentos: corrige \"undefined\" ao editar célula, e marcar Concluído agora pede a data real de conclusão",
      "itens": [
        "Causa raiz do \"undefined\": a edição inline reconstruía a célula usando um <tr> criado solto (fora de uma <table>) e definia innerHTML nele — isso não é um contexto válido de tabela, e o navegador descartava as tags <td>, deixando texto solto aparecer na tela. Corrigido usando uma <table> completa como contêiner temporário antes de mover as células — testado em navegador real antes de publicar.",
        "Ao marcar uma etapa como \"Concluído\", agora abre um pequeno popup pedindo a data real em que foi concluída (padrão: hoje) — antes o sistema só trocava o status sem perguntar a data, então \"Concluído\" ficava com a data planejada em vez da data real.",
        "Cancelar o popup de conclusão desfaz a troca de status (volta pro que estava salvo antes)."
      ]
    },
    {
      "versao": "V3.1.21",
      "legado": "V2.57.33",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "correcao",
      "titulo": "Suprimentos: célula de data com fundo colorido sólido (verde/vermelho/amarelo), igual ao modelo de referência",
      "itens": [
        "A versão anterior deixava a data como um \"pill\" pequeno dentro de uma célula branca — o modelo de referência enviado pede o fundo preenchendo a célula toda, cor sólida forte (verde = ok/concluído, vermelho = atrasado, amarelo = próximo do prazo).",
        "Mantido o clique em qualquer parte da célula abrindo o calendário nativo do navegador (input date real por baixo, só visualmente escondido)."
      ]
    },
    {
      "versao": "V3.1.22",
      "legado": "V2.57.34",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "correcao",
      "titulo": "Suprimentos: texto da data agora é preto (era branco/marrom em alguns estados), igual ao modelo de referência",
      "itens": [
        "Cor do texto dentro do fundo colorido (verde/vermelho/amarelo) padronizada pra preto em todos os estados."
      ]
    },
    {
      "versao": "V3.1.23",
      "legado": "V2.57.35",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "correcao",
      "titulo": "Suprimentos: cor do fundo verde e altura da célula corrigidas — extraídas pixel a pixel do print de referência",
      "itens": [
        "A cor verde usada antes (#66bb6a) era mais escura/dessaturada que a do modelo — extraída a cor exata do print enviado (#54F777) e conferida pixel a pixel antes de publicar.",
        "Vermelho e amarelo recalculados com a mesma saturação/luminosidade do verde de referência, pra manter a família de cores consistente.",
        "Altura da célula estava quase o dobro do modelo (o <input type=\"date\"> escondido estava reservando espaço extra) — corrigida para bater com a proporção do print de referência."
      ]
    },
    {
      "versao": "V3.1.24",
      "legado": "V2.57.36",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "correcao",
      "titulo": "Editor de Estrutura: soltar uma tarefa \"depois\" de outra quase sempre virava filho por engano",
      "itens": [
        "Zona de drop para \"depois\" (irmã, não filha) era só 10% da altura da linha — quase impossível de acertar. Alargada para 30%."
      ]
    },
    {
      "versao": "V3.1.25",
      "legado": "V2.57.37",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "correcao",
      "titulo": "Editor de Estrutura: bug real por trás dos \"filhos trocando de dono\" — soltar \"depois\" de uma tarefa que já tem filhos próprios entrava NO MEIO dela e dos filhos dela",
      "itens": [
        "Causa raiz: soltar \"depois\" de uma tarefa X inseria logo após a LINHA de X (índice+1) — mas se X já tinha filhos próprios logo em seguida, a tarefa recém-movida entrava bem ali no meio, entre X e os filhos dele. Como \"quem é filho de quem\" é decidido só pela sequência (nível maior logo depois = filho), os filhos verdadeiros de X ficaram \"órfãos\" de X e a tarefa recém-inserida roubou esse vínculo — exatamente o sintoma relatado: a tarefa de cima perde a setinha de expandir (vira um pontinho, sem filhos) e o que estava dentro dela aparece dentro da de baixo.",
        "Corrigido: soltar \"depois\" agora pula o bloco INTEIRO da tarefa-alvo (ela + todos os filhos próprios dela) antes de inserir — a nova tarefa vira irmã de verdade, depois de tudo que já pertencia ao alvo.",
        "Também corrigido: soltar/mover na árvore não pula mais o scroll pro topo — mantém a posição de onde você estava mexendo."
      ]
    },
    {
      "versao": "V3.1.26",
      "legado": "V2.57.38",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "correcao",
      "titulo": "Editor de Estrutura: mover/reordenar às vezes \"voltava sozinho\" depois de sair e voltar da página — falha ao salvar no Firestore era engolida silenciosamente",
      "itens": [
        "Causa: quando uma gravação de ordem/nível falhava (rede instável, sobrecarga de escritas simultâneas), o erro só ia pro console — a árvore continuava mostrando a mudança na tela (otimista), mas nada tinha sido salvo de verdade. Um reload trazia o estado antigo de volta, parecendo que o sistema \"desfez sozinho\".",
        "Reduzida a concorrência de escrita (50→20 simultâneas) e adicionado timeout de 15s por gravação, igual ao fix já aplicado no Importar Excel.",
        "Agora, se alguma gravação falhar, aparece um aviso explícito na tela avisando pra tentar mover de novo — em vez de falhar em silêncio."
      ]
    },
    {
      "versao": "V3.1.27",
      "legado": "V2.57.39",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "correcao",
      "titulo": "Editor de Estrutura e Planejamento mostravam estruturas DIFERENTES — causa: nível \"solto\" (com salto) torna uma tarefa invisível na árvore mas ela continua aparecendo normalmente na tabela",
      "itens": [
        "Causa raiz: o Editor de Estrutura só reconhece uma tarefa como raiz se nível===0, e só como filha de outra se nível===pai+1 (ver _arvFilhos). Se uma tarefa acaba com nível 4 mas a anterior tem nível 2 (faltando o 3 no meio — pode vir de import, edição manual do campo Nível, ou um bug já corrigido), ela não vira filha de ninguém nem raiz: some da árvore. A tabela do Planejamento não tem essa exigência (só usa nível pra indentar), então continua mostrando ela normalmente — daí a divergência entre as duas telas relatada pelo Milton (tarefa \"Forro Escadaria\" via na tabela, sumida na árvore).",
        "Novo botão ⚙ Ferramentas → \"🌳 Corrigir Níveis Soltos\": percorre a obra inteira e garante que nenhuma tarefa pule mais de 1 nível de profundidade em relação à anterior (mesma regra de qualquer outline — Word/PowerPoint/MS Project). Roda automaticamente também depois de importar Excel.",
        "Rode esse botão agora pra recuperar tarefas que sumiram da árvore por esse motivo."
      ]
    },
    {
      "versao": "V3.1.28",
      "legado": "V2.57.40",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "correcao",
      "titulo": "Achada a causa raiz de verdade da estrutura bagunçada: o campo Nível está corrompido em 1510 de 2398 tarefas desta obra (Código bate certinho, Nível não) — novo reparo \"Corrigir Nível pelo Código\"",
      "itens": [
        "O V2.57.39 corrigia só \"saltos impossíveis\" de nível — mas isso não pega um nível que está ERRADO só por estar errado (ex: devia ser 4 e ficou 6, sem pular etapa nenhuma). Analisando o Excel exportado, 63% das tarefas com Código têm o Nível salvo divergindo da contagem de pontos do próprio Código — resultado de bugs de drag&drop/import já corrigidos ao longo desta conversa, acumulados na obra.",
        "O Código nunca é escrito automaticamente pelo sistema (só vem de import ou digitação manual), então é a fonte confiável. Novo botão ⚙ Ferramentas → \"🩹 Corrigir Nível pelo Código\": para toda tarefa que tem Código, recalcula o Nível pela contagem de pontos dele (ex: \"1.3.6.20.2\" → nível 4) e grava no Firestore.",
        "Tarefas SEM Código (grupos criados manualmente na árvore, ex: \"Gesso e Forro\") não são tocadas por esse reparo — se alguma delas ainda ficar no nível errado depois, precisa de ajuste manual (← / →) uma a uma, mas são poucas comparado ao total."
      ]
    },
    {
      "versao": "V3.1.29",
      "legado": "V2.57.41",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "correcao",
      "titulo": "Predecessoras: inserir OU excluir qualquer tarefa (Editor de Estrutura ou tabela normal) não atualizava as predecessoras de tudo que vinha depois — só arrastar na árvore fazia isso",
      "itens": [
        "Inserir/excluir uma tarefa desloca o número de linha (o \"#\" que as predecessoras referenciam, tipo \"5TI\") de tudo que vem depois dela. Até esta versão, só o arrastar-e-soltar no Editor de Estrutura corrigia essas referências (_remapearPredecessoras); os botões ↑＋/↓＋/＋▸ de inserir na árvore, o \"+ Tarefa\" da tabela normal, e excluir tarefa não faziam esse remapeamento — deixando predecessoras de tarefas mais abaixo silenciosamente apontando pra linha errada toda vez que algo era inserido ou excluído antes delas.",
        "Agora TODA inserção e exclusão de tarefa (árvore ou tabela) remapeia as predecessoras de quem mudou de linha, do mesmo jeito que já acontecia ao arrastar."
      ]
    },
    {
      "versao": "V3.1.30",
      "legado": "V2.57.42",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "correcao",
      "titulo": "Auditoria completa de todos os botões do Planejamento/Editor de Estrutura: mais 4 pontos sem remapeamento de predecessoras corrigidos, e um botão que salvava a obra INTEIRA a cada clique",
      "itens": [
        "Duplicar tarefa(s) selecionada(s) pela tabela (botão em massa) — não remapeava. Corrigido.",
        "Excluir tarefa(s) selecionada(s) em massa pela tabela — não remapeava. Corrigido.",
        "Excluir tarefas órfãs no painel pós-import (V2.57.14) — não remapeava. Corrigido.",
        "Importar Excel — tarefas mantidas que não vieram na planilha (órfãs) podiam ter a predecessora desatualizada se o import deslocou a posição delas. Corrigido.",
        "Mover linha ↑/↓ (botões \"Acima\"/\"Abaixo\" da tabela): salvava TODAS as ~2400 tarefas da obra no Firestore a cada clique, mesmo as que não mudaram de posição — desnecessário e um risco real de sobrecarga (mesma causa que já travou o Importar Excel outras vezes). Agora só salva quem realmente mudou, em lotes com timeout.",
        "Conferido também: arrastar na tabela normal (_reordenarTarefa) e Mover-para-outro-pai (Editor de Estrutura) já remapeavam corretamente — nenhuma mudança necessária ali."
      ]
    },
    {
      "versao": "V3.1.30.1",
      "legado": "V2.57.43",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "funcionalidade",
      "titulo": "Dois novos modos de importar Excel: \"Importar Base Completa\" (substitui tudo) e \"Importar Correções\" (atualiza só campos escolhidos, casando por Nome — não mexe em posição/nível/estrutura)",
      "itens": [
        "\"Importar Base Completa\": apaga TODAS as tarefas da obra e recria do zero a partir da planilha — pra quando o Milton quer mesmo substituir a base inteira (ex: reconciliar com um cronograma do CSO totalmente reestruturado). Pede confirmação em dobro por ser destrutivo.",
        "\"Importar Correções\": não cria nem apaga nenhuma tarefa, não toca em posição/nível/código — casa cada linha da planilha com a tarefa de MESMO NOME já existente na obra, e atualiza só os campos marcados numa lista de checkbox (Início Real, Término Real, % Concluído, Duração, Responsável, etc). Pensado pro caso do Milton: preencheu datas reais numa planilha à parte e quer trazer só isso, sem risco de bagunçar a árvore que ele organizou no Editor de Estrutura.",
        "Correções mostra um resumo ANTES de aplicar: quantas tarefas serão atualizadas, quantas não foram encontradas (nome não bate) e quantas são ambíguas (mais de uma tarefa com o mesmo nome — puladas por segurança, para nunca atualizar a tarefa errada).",
        "O \"Importar\" original (upsert por Código) continua existindo e é o padrão recomendado no dia a dia."
      ]
    },
    {
      "versao": "V3.1.31",
      "legado": "V2.57.44",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "correcao",
      "titulo": "Removido do menu o botão \"Corrigir Nível pelo Código\" — era um reparo de uso único (dano histórico dos bugs já corrigidos) e perigoso como ferramenta recorrente",
      "itens": [
        "O Código de uma tarefa fica desatualizado assim que ela é reestruturada manualmente no Editor de Estrutura (aninhada num grupo novo, por exemplo) — só o Nível reflete a posição real depois disso. Deixar esse botão disponível no dia a dia significava correr o risco de, sem querer, reverter uma reestruturação manual de volta pro nível antigo (baseado no Código desatualizado), depois de já ter sido corrigida à mão.",
        "Serviu seu propósito (reparar o estrago histórico) e foi removido do menu. A função continua existindo no código só para emergência, mas não aparece mais como botão clicável no dia a dia."
      ]
    },
    {
      "versao": "V3.1.31.1",
      "legado": "V2.57.45",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "funcionalidade",
      "titulo": "Editor de Estrutura: botões \"💾 Backup\" e \"📤 Restaurar\" — salva um snapshot local da estrutura (nome/nível/ordem/código/predecessora) antes de mexer, pra restaurar se algo der errado",
      "itens": [
        "💾 Backup baixa um arquivo .json no seu computador com o estado atual de todas as tarefas (nível, ordem, código, predecessora) — não fica salvo em nenhum lugar do sistema, só no seu computador.",
        "📤 Restaurar lê esse arquivo depois e devolve nível/ordem/código/predecessora pro que estava salvo, tarefa por tarefa (casando pelo ID interno — funciona mesmo se você reorganizou tudo depois, mas não funciona se a tarefa foi excluída e recriada).",
        "Recomendado: bata um backup antes de reestruturar bastante coisa de uma vez."
      ]
    },
    {
      "versao": "V3.1.32",
      "legado": "V2.57.46",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "correcao",
      "titulo": "Ctrl+Z (desfazer): escrevia todas as ~2400 tarefas uma por uma, sem timeout e sem trava contra clique duplo — podia travar no meio e restaurar só parte, ou misturar dois estados se apertado duas vezes",
      "itens": [
        "Causa: undo() gravava CADA tarefa da obra sequencialmente no Firestore, uma de cada vez, aguardando cada escrita terminar antes de ir pra próxima — se uma travasse (mesma causa de travamentos já vistos no Import), tudo depois dela na lista nunca era restaurado de verdade, mesmo a tela mostrando que sim.",
        "Sem trava alguma: apertar Ctrl+Z de novo antes do primeiro terminar disparava um SEGUNDO desfazer em paralelo, escrevendo por cima do primeiro — cada tarefa podia acabar com um valor de um snapshot, outra com valor de outro, misturando dois estados diferentes (exatamente o padrão relatado: uma tarefa some do lugar certo e os filhos de outra trocam de dono).",
        "Corrigido: desfazer agora ignora um segundo Ctrl+Z enquanto o anterior ainda está gravando, só grava as tarefas que realmente mudaram (mais rápido), em lotes com timeout de 15s, e avisa na tela se alguma não foi restaurada."
      ]
    },
    {
      "versao": "V3.1.32.1",
      "legado": "V2.57.47",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "funcionalidade",
      "titulo": "Editor de Estrutura: novo botão \"💾 Salvar e Atualizar Planejamento\" — força regravar ordem/nível de TODAS as tarefas e recarrega, sem depender do salvamento automático em segundo plano",
      "itens": [
        "Regrava ordem e nível de todas as tarefas do jeito que está na tela agora, em lotes com timeout, e recarrega o Planejamento no final — um \"tenho certeza que salvou\" manual, pra quando o salvamento automático em segundo plano não é suficiente ou o Milton quer confirmação explícita de que o Planejamento está de fato igual à árvore."
      ]
    },
    {
      "versao": "V3.1.33",
      "legado": "V2.57.48",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "correcao",
      "titulo": "Editor de Estrutura: tela de \"Carregando\" removida de criar irmã/filha (ação instantânea não precisava bloquear a tela) — e reduzida ainda mais a zona de \"virar filho\" ao arrastar",
      "itens": [
        "Criar tarefa acima/abaixo/filha/raiz é uma escrita só no Firestore, rápida — não precisava da tela de carregando bloqueando a interface a cada clique. Removida nas 4 ações de criar; a linha nova já aparece na hora.",
        "Zona de drop \"virar filho\" ao arrastar reduzida de 40% para 20% da altura da linha (bem no centro) — reordenar como irmã (antes/depois) agora domina 80% da linha. Pra aninhar de propósito, use os botões \"＋▸ Criar filho\" ou \"↗ Mover para\" em vez de mirar num alvo pequeno arrastando."
      ]
    },
    {
      "versao": "V3.1.34",
      "legado": "V2.57.49",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "correcao",
      "titulo": "Criar uma linha na árvore ficava lento quando afetava muitas predecessoras — a atualização delas gravava uma por uma (sequencial) e travava a tela esperando",
      "itens": [
        "Inserir uma tarefa desloca o número de linha de tudo depois dela, e qualquer predecessora que aponte pra um desses números precisa ser atualizada — em cronogramas grandes isso pode afetar centenas de tarefas de uma vez. A gravação dessas atualizações era sequencial (uma de cada vez, esperando terminar antes de ir pra próxima) — corrigido pra lote com timeout, igual ao resto do sistema.",
        "Além disso, criar tarefa na árvore não trava mais esperando essa atualização de predecessoras terminar — ela roda em segundo plano, e você já pode continuar mexendo."
      ]
    },
    {
      "versao": "V3.1.35",
      "legado": "V2.57.50",
      "status": "fechada",
      "data": "2026-07-28",
      "tipo": "correcao",
      "titulo": "Busca do Planejamento não encontrava tarefas escondidas dentro de uma família recolhida — parecia que tinham sido excluídas",
      "itens": [
        "Causa: a busca só olhava a lista \"filtradas\" (que já esconde os filhos de qualquer família recolhida) em vez de todas as tarefas da obra. Se o item buscado estava dentro de uma família fechada, a busca simplesmente não olhava pra ele — dava a impressão de ter sido apagado, quando só estava escondido.",
        "Agora a busca olha TODAS as tarefas, e se o resultado estiver escondido, expande automaticamente todas as famílias recolhidas no caminho até ele antes de pular pra lá."
      ]
    },
    {
      "versao": "V3.1.35.1",
      "legado": "V2.57.51",
      "status": "fechada",
      "data": "2026-07-29",
      "tipo": "funcionalidade",
      "titulo": "Nova coluna \"Sucessora\" no Planejamento — o inverso da Predecessora, calculado automaticamente",
      "itens": [
        "Mostra quais tarefas têm ESTA tarefa como predecessora (quem depende dela) — não é um campo salvo, é recalculado toda vez a partir das predecessoras de todo mundo, então nunca fica desatualizado sozinho.",
        "Somente leitura (não dá pra editar direto — a fonte da verdade continua sendo a Predecessora de cada tarefa)."
      ]
    },
    {
      "versao": "V3.1.35.2",
      "legado": "V2.57.52",
      "status": "fechada",
      "data": "2026-07-29",
      "tipo": "melhoria",
      "titulo": "Predecessora e Sucessora: passar o mouse por cima mostra o número + nome de cada uma, sem precisar clicar",
      "itens": [
        "Tooltip nativo do navegador — passa o mouse em cima da célula e mostra cada referência numérica com o nome da tarefa correspondente, uma por linha (ex: \"5TI — Serviços Iniciais\")."
      ]
    },
    {
      "versao": "V3.1.36",
      "legado": "V2.57.53",
      "status": "fechada",
      "data": "2026-07-29",
      "tipo": "correcao",
      "titulo": "Recalcular Datas dos Pais (V2.57.27) podia ZERAR o início/término de uma tarefa-folha se ela ficasse ao lado de um \"gap\" de nível — bug real de perda de dados relatado pelo Milton",
      "itens": [
        "Causa: a função considerava \"tarefa-pai\" qualquer linha em que a PRÓXIMA linha tivesse nível maior — mas isso não garante que exista um filho DIRETO (nível+1) de verdade. Se por qualquer desalinhamento momentâneo o \"filho\" aparente estivesse 2+ níveis mais profundo (um gap), a função não achava nenhum filho direto, calculava a data como vazia, e GRAVAVA essa data vazia por cima da data própria da tarefa — mesmo ela sendo uma folha comum com data certa.",
        "Corrigido: só trata como tarefa-pai (e sobrescreve a data) quem tem de fato pelo menos um filho direto (nível exatamente +1). Sem isso, a tarefa mantém a própria data intacta, nunca mais é zerada por engano.",
        "Mesma correção vale pra Início Real/Término Real, que tinham o mesmo risco."
      ]
    },
    {
      "versao": "V3.1.37",
      "legado": "V2.57.54",
      "status": "fechada",
      "data": "2026-07-29",
      "tipo": "correcao",
      "titulo": "Recalcular Datas dos Pais nunca cobria Linha de Base e Desafio — grupos ficavam sempre em branco nessas duas versões mesmo com os filhos preenchidos. Reordenados os botões: Linha de Base, Desafio, Atual (Atual sempre por último/fixo)",
      "itens": [
        "O agregador de datas dos pais (menor início/maior término dos filhos) só olhava Início/Término Planejado e Início/Término Real — Linha de Base e Desafio nunca eram calculados pros grupos, mesmo com todos os filhos tendo essas datas preenchidas na planilha importada.",
        "Agora as 4 versões (Atual, Real, Linha de Base, Desafio) são agregadas igualmente pros pais.",
        "Botões do topo reordenados pra Linha de Base | Desafio | Atual — Atual sempre por último, mais visível e é a versão padrão ao entrar no Planejamento."
      ]
    },
    {
      "versao": "V3.1.38",
      "legado": "V2.57.55",
      "status": "fechada",
      "data": "2026-07-29",
      "tipo": "correcao",
      "titulo": "Editor de Estrutura: criar tarefa (acima/abaixo/filha) e apertar Enter pra confirmar o nome pulava a tela pro topo",
      "itens": [
        "Salvar o nome digitado (Enter ou clicar fora) não preservava o scroll — mesma classe de bug já corrigida em outros lugares da árvore (seleção, drop). Agora a tela fica fixa onde você está trabalhando, tanto ao criar a tarefa quanto ao confirmar o nome dela."
      ]
    },
    {
      "versao": "V3.1.38.1",
      "legado": "V2.57.56",
      "status": "fechada",
      "data": "2026-07-29",
      "tipo": "funcionalidade",
      "titulo": "MUDANÇA DE ARQUITETURA: Predecessora agora é vinculada por ID interno da tarefa, não mais por número de linha — reordenar NUNCA MAIS quebra o vínculo",
      "itens": [
        "Causa raiz de todos os bugs de predecessora desta obra: o vínculo era guardado como TEXTO com o número da linha (ex: \"5TI\"). Qualquer inserção, exclusão ou movimentação em QUALQUER lugar da obra desloca esses números, e por mais completo que fosse o \"remapeamento\" depois de cada operação, sempre sobrava algum caso não coberto — é uma abordagem fundamentalmente frágil.",
        "Agora o vínculo é guardado pelo ID interno da tarefa (o mesmo ID que o Firestore já dá a cada tarefa, criado uma vez e nunca muda) — não existe mais \"remapear\" porque não existe mais nada para remapear: reordenar, mover, inserir, excluir, nada disso afeta o vínculo, porque ele nunca dependeu de posição.",
        "O número de linha (5, 12, etc) continua aparecendo normalmente na tela e na exportação pra Excel — só que agora é calculado ao vivo a partir do ID, sempre correto, nunca precisa ser corrigido.",
        "Migração automática: ao abrir o Planejamento, qualquer predecessora ainda no formato antigo é convertida sozinha, em segundo plano, sem precisar fazer nada. Botão manual também disponível em ⚙ Ferramentas → \"🔗 Corrigir Predecessoras (por ID)\" se quiser confirmar.",
        "Os 3 importadores (Importar, Importar Base Completa, Importar Correções) já gravam direto no novo formato — Importar Correções resolve por nome (a predecessora na planilha aponta pra outra linha da MESMA planilha, que agora é traduzida pro nome e depois pro ID da tarefa atual)."
      ]
    },
    {
      "versao": "V3.1.39",
      "legado": "V2.57.57",
      "status": "fechada",
      "data": "2026-07-29",
      "tipo": "correcao",
      "titulo": "Importar Correções: os textos ao lado dos checkboxes de campo (Início Real, % Concluído, etc) não apareciam — só os quadradinhos em branco",
      "itens": [
        "Reforçado o HTML dos checkboxes com cor explícita e o texto envolto num <span> — evita qualquer problema de herança de cor entre o texto e o fundo escuro do modal."
      ]
    },
    {
      "versao": "V3.1.40",
      "legado": "V2.57.58",
      "status": "fechada",
      "data": "2026-07-29",
      "tipo": "correcao",
      "titulo": "Predecessora agora funciona matematicamente de verdade: editar a data de uma tarefa propaga automaticamente pra quem depende dela (sucessoras), em cadeia — e a Sucessora aparece na hora, sem precisar recarregar",
      "itens": [
        "Causa raiz #1: Sucessora é calculada a partir das predecessoras de TODO MUNDO — mas editar a predecessora de uma tarefa (inline, popup ou modal) só atualizava aquela tarefa na tela, sem recalcular quem virou sucessora de quem. Corrigido: editar a predecessora agora recalcula as sucessoras de toda a obra na hora.",
        "Causa raiz #2 (a mais importante): quando você edita o início/término de uma tarefa, a data das tarefas que a têm como predecessora NUNCA era recalculada automaticamente — só era calculada uma vez, no momento em que você define a predecessora, e nunca mais. Se \"Laje\" atrasa, \"Alvenaria Estrutural\" (que depende dela) ficava com a data velha, achando que a predecessora era só um número decorativo.",
        "Agora, editar início/término de qualquer tarefa (tabela, modal ou popup de predecessora) propaga automaticamente a nova data pra todas as sucessoras, em cadeia (se a sucessora também tiver sucessoras, propaga mais adiante, e assim por diante) — exatamente como MS Project. Corte de dependência circular incluído, pra nunca entrar em loop infinito.",
        "Corrigido também: o campo Predecessora do formulário grande de editar tarefa não convertia o texto digitado pro formato novo por ID — ficava salvando/mostrando o formato interno bruto (ilegível). Agora mostra e converte certo, igual à célula da tabela."
      ]
    },
    {
      "versao": "V3.1.41",
      "legado": "V2.57.59",
      "status": "fechada",
      "data": "2026-07-29",
      "tipo": "correcao",
      "titulo": "Cascata de datas (V2.57.58) não propagava quando a mudança vinha de um FILHO cuja data recalcula o PAI — exatamente o caso relatado: editar \"Serviços Iniciais\" (filho) não afetava \"Estacas/Fundação\", que tem o grupo \"Serviços Iniciais\" (pai) como predecessora",
      "itens": [
        "A cascata da V2.57.58 só propagava a partir da tarefa que você editou DIRETAMENTE. Mas editar um filho recalcula a data do PAI (agregação automática da V2.57.27/54) — e essa mudança no pai não disparava cascata pra quem tem o PAI como predecessora.",
        "Corrigido: agora, sempre que a agregação de datas dos pais muda alguma coisa, a cascata também propaga a partir de CADA pai alterado, não só da tarefa editada originalmente."
      ]
    },
    {
      "versao": "V3.1.41.1",
      "legado": "V2.57.60",
      "status": "fechada",
      "data": "2026-07-29",
      "tipo": "melhoria",
      "titulo": "Predecessora: triplo-clique na célula abre o popup guiado (Código/Tipo/Defasagem), já preenchido com o que estiver lá",
      "itens": [
        "1 ou 2 cliques continua abrindo o editor de texto direto na célula (aceita várias predecessoras separadas por \";\"). Triplo-clique abre a telinha guiada — igual ao MS Project — já com o vínculo atual pré-carregado nos campos."
      ]
    },
    {
      "versao": "V3.1.41.2",
      "legado": "V2.57.61",
      "status": "fechada",
      "data": "2026-07-29",
      "tipo": "melhoria",
      "titulo": "Popup de Predecessora agora é uma tabela de várias linhas (igual MS Project: Nº/Código, Nome da Tarefa, Tipo, Defasagem) — antes editava só uma predecessora por vez",
      "itens": [
        "Cada predecessora já vinculada aparece numa linha própria, com o nome da tarefa mostrado automaticamente ao lado (não precisa lembrar o nome, só o número/código). Botão \"＋ Adicionar linha\" pra incluir mais, \"✕\" em cada linha pra remover.",
        "Mantida a formatação escura do sistema — mesma ideia do MS Project, com nossa cara."
      ]
    },
    {
      "versao": "V3.1.41.3",
      "legado": "V2.57.62",
      "status": "fechada",
      "data": "2026-07-29",
      "tipo": "melhoria",
      "titulo": "Popup de Predecessora: coluna Tipo mostra o nome completo (ex: \"Término-a-Início (TI)\"), colorido — antes só a sigla",
      "itens": [
        "Cores seguem o padrão MS Project: TI azul, II neutro, TT vermelho, IT verde. Coluna e popup alargados pra caber o texto completo."
      ]
    },
    {
      "versao": "V3.1.41.4",
      "legado": "V2.57.63",
      "status": "fechada",
      "data": "2026-07-29",
      "tipo": "melhoria",
      "titulo": "Importar Correções: agora mostra a LISTA exata de quais nomes não bateram ou eram ambíguos, em vez de só um número",
      "itens": [
        "Depois de aplicar, se sobrou algum \"não encontrado\" (nome da planilha não bate com nenhuma tarefa atual, ex: Cofield renomeou algo) ou \"ambíguo\" (mais de uma tarefa sua com o mesmo nome), abre um painel listando exatamente quais são — pra revisar/renomear manualmente se for o caso.",
        "Confirmado: Importar Correções nunca cria tarefa nova nem move nada — só atualiza campo por campo em tarefas já existentes, casando por Nome. O que não bate fica de fora, sem efeito nenhum na estrutura."
      ]
    },
    {
      "versao": "V3.1.42",
      "legado": "V2.57.64",
      "status": "fechada",
      "data": "2026-07-29",
      "tipo": "correcao",
      "titulo": "Editor de Estrutura: \"←\"/\"→\" (subir/descer nível) só ajustava UM bloco por vez, mesmo com vários selecionados — se tinha 9 grupos irmãos soltos no nível errado, tinha que clicar um por um",
      "itens": [
        "Clicar \"←\" numa tarefa selecionada em grupo (Ctrl+clique) só subia o nível DAQUELA tarefa e dos filhos dela — os outros itens selecionados ao lado (irmãos) ficavam intocados, mesmo estando marcados.",
        "Corrigido: agora, se houver seleção múltipla, \"←\"/\"→\" ajusta o nível de TODOS os blocos selecionados de uma vez (cada um com seus próprios filhos) — resolve de vez o caso de vários grupos soltos no nível errado por conta de um código de planilha que não corresponde à posição real que a tarefa deveria ocupar."
      ]
    },
    {
      "versao": "V3.1.43",
      "legado": "V2.57.65",
      "status": "fechada",
      "data": "2026-07-29",
      "tipo": "correcao",
      "titulo": "Achada a causa raiz do \"nível impossível\": arrastar uma tarefa na TABELA NORMAL do Planejamento (Ctrl+botão direito, fora do Editor de Estrutura) nunca ajustava o nível — só a posição",
      "itens": [
        "Diferente do arrastar no Editor de Estrutura (que já ajusta o nível pro contexto de onde solta), o arrastar-com-Ctrl+botão-direito na tabela normal do Planejamento só movia a ORDEM da tarefa — o nível ficava exatamente como estava antes, não importa onde ela caía. Se você arrastasse um bloco de nível 3 pra encostar num item de nível 1, ele ficava com nível 3 ali mesmo — um salto impossível (teria que existir um nível 2 no meio), que é exatamente o que ficava invisível no Editor de Estrutura.",
        "Corrigido: agora esse arrastar também ajusta o nível do bloco pro nível de quem está do lado, igual já acontece no Editor de Estrutura — usando a mesma lógica já testada.",
        "Também corrigido: o nível ajustado agora é de fato salvo no Firestore (antes só a ordem era gravada)."
      ]
    },
    {
      "versao": "V3.1.44",
      "legado": "V2.57.66",
      "status": "fechada",
      "data": "2026-07-29",
      "tipo": "correcao",
      "titulo": "Planejamento: tela ficava toda preta ao clicar numa célula, aleatoriamente — agora um erro numa linha/célula mostra um aviso naquela linha só, em vez de travar a tabela inteira",
      "itens": [
        "Blindagem geral: se der erro ao montar uma linha específica da tabela (dado inesperado numa tarefa) ou ao abrir a edição de uma célula, o resto do Planejamento continua funcionando — aparece um aviso \"⚠ Erro ao mostrar esta linha\" só naquela linha, e o erro detalhado vai pro console (F12), em vez de a tela inteira ficar preta."
      ]
    },
    {
      "versao": "V3.1.45",
      "legado": "V2.57.67",
      "status": "fechada",
      "data": "2026-07-30",
      "tipo": "correcao",
      "titulo": "Solo Grampeado: botões de modo recriavam o painel inteiro e perdiam a posição do mapa — agora só atualizam o mapa; adicionado pan/zoom com Ctrl",
      "itens": [
        "Levantamento e Controle: os botões (Adicionar Chumbador, Calibrar Escala, Marcar Projeção/Acabamento) chamavam um redesenho completo do painel a cada clique, o que resetava o scroll do mapa e travava a interação em desenhos compridos.",
        "Corrigido: esses botões agora só atualizam o próprio texto/classe e re-renderizam o mapa, preservando zoom e posição de scroll.",
        "Adicionado pan (Ctrl+arrastar) e zoom (Ctrl+roda do mouse) direto sobre o mapa, tanto no Levantamento quanto no Controle.",
        "Calibrar Escala: o 1º clique não tinha nenhum feedback visual (só um texto pequeno mudava) e parecia não fazer nada. Agora desenha os pontos clicados e a linha entre eles em tempo real, mostra um toast a cada ponto marcado, e destaca o mapa com uma borda quando um modo (Adicionar/Calibrar) está ativo.",
        "Removido o campo \"Profundidade\" (era redundante com o Comprimento — o chumbador tem uma única medida real).",
        "Adicionar Chumbador mudou de fluxo: antes abria um popup a cada clique (pedindo até Especificação, sem necessidade nesse momento) — agora clicar no mapa só coloca a bolinha na hora, sem popup nenhum. Barra amarela mostra Próx. Número (edita se não bater com o desenho, incrementa sozinho a cada clique), Tipo e Comprimento padrão. Clicar numa bolinha já colocada abre a edição (número, tipo, comprimento, especificação).",
        "Numeração em sequência: clicando à direita do último chumbador, o número continua incrementando sozinho (como os chumbadores reais são numerados em linha, esquerda→direita). Se o clique não for à direita do anterior (nova linha), para e pergunta o número inicial dela antes de continuar.",
        "Controle: novo painel \"Medidor Diário\" — meta por vista (chumbadores concluídos/dia e/ou m² executados/dia, cada uma opcional), comparando dia a dia o realizado contra a meta com % e cor (verde ≥100%, amarelo ≥60%, vermelho abaixo).",
        "Calibrar Escala: corrigido caso em que \"Salvar\" não fazia nada (falha silenciosa) — agora valida cada etapa (pontos perdidos, imagem sem tamanho salvo, pontos iguais) com mensagem de erro específica em vez de simplesmente não salvar. A linha de calibração agora fica salva e sempre visível no mapa (verde, com o valor em cm), pra conferir depois se ainda está correta — antes ela desaparecia depois de confirmar."
      ]
    },
    {
      "versao": "V3.1.46",
      "legado": "V2.57.68",
      "status": "fechada",
      "data": "2026-07-30",
      "tipo": "correcao",
      "titulo": "Dashboard: painel \"Contenção (Solo Grampeado)\" nunca aparecia — estava preso dentro do toggle \"Mostrar Contenção, Fundação e Estrutura\" (checkbox desligado por padrão)",
      "itens": [
        "O painel de minimapas do Solo Grampeado tinha sido colocado dentro do bloco condicionado ao checkbox \"Mostrar Contenção, Fundação e Estrutura\" — um toggle de preferência pessoal (guardado no localStorage do navegador) que vem desligado por padrão. Resultado: quem nunca marcou esse checkbox nunca via o painel, mesmo com vistas/execução cadastradas.",
        "Corrigido: \"Contenção (Solo Grampeado)\" agora é uma seção própria do Dashboard, sempre visível, independente desse toggle (que continua controlando só o gráfico de Fundação e Estrutura)."
      ]
    },
    {
      "versao": "V3.1.46.1",
      "legado": "V2.57.69",
      "status": "fechada",
      "data": "2026-07-30",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Solo Grampeado: ferramenta \"Medir Área\" — desenha o contorno real da vista e calcula o m² pela escala, em vez de só digitar o valor",
      "itens": [
        "Botão \"📐 Medir Área\" (exige escala já calibrada): clique nos vértices do contorno real da vista (segue o desenho, inclusive terreno inclinado, reentrâncias etc.) — cada clique marca um vértice, com desfazer último ponto e um botão \"Concluir Polígono\" a partir de 3 pontos.",
        "Área calculada pela fórmula de Shoelace em cima da escala calibrada (não é mais só a área do retângulo da imagem inteira) — mostra o resultado num modal de confirmação, ainda editável antes de salvar.",
        "O contorno medido fica salvo e sempre visível no mapa (azul, tracejado, com o m² escrito no meio), pra conferir depois se ainda bate com a vista — mesmo princípio já usado na linha de calibração de escala.",
        "O campo \"m² total\" com edição manual (✎) continua existindo, pra ajuste fino depois de medir."
      ]
    },
    {
      "versao": "V3.1.46.2",
      "legado": "V2.57.70",
      "status": "fechada",
      "data": "2026-07-30",
      "tipo": "melhoria",
      "titulo": "Levantamento de Solo Grampeado: cor do chumbador por comprimento e formato por tipo (bolinha = horizontal, triângulo = vertical)",
      "itens": [
        "Chumbadores Horizontais viram bolinhas; Verticais viram triângulos — dá pra diferenciar o tipo só olhando o mapa.",
        "A cor de cada chumbador agora reflete o comprimento (ml) dele, de forma determinística: o mesmo valor sempre cai na mesma cor (ex: 6ml sempre azul), independente da ordem em que foram cadastrados. Se mudar o comprimento de um chumbador, a cor muda junto.",
        "Legenda embaixo do mapa mostra a cor de cada comprimento usado na vista."
      ]
    },
    {
      "versao": "V3.1.46.3",
      "legado": "V2.57.71",
      "status": "fechada",
      "data": "2026-07-30",
      "tipo": "melhoria",
      "titulo": "Levantamento de Solo Grampeado: botão Excluir direto no popup de editar chumbador",
      "itens": [
        "Antes só dava pra excluir um chumbador pela tabela embaixo — agora tem um botão \"🗑 Excluir\" direto no popup que abre ao clicar na bolinha/triângulo, sem precisar descer até a tabela."
      ]
    },
    {
      "versao": "V3.2.0",
      "legado": "V2.58.0",
      "status": "fechada",
      "data": "2026-07-31",
      "tipo": "funcionalidade",
      "titulo": "Módulo de Usuários e Permissões — convite por e-mail + controle de acesso granular por módulo e por obra",
      "itens": [
        "Nova tela \"Permissões\": lista de usuários com convidar, editar permissões, reenviar acesso, ativar/desativar e excluir.",
        "Convite por e-mail: admin cadastra o usuário (nome, e-mail, permissões, acesso por obra) e o sistema envia um e-mail (via Firebase, sem provedor externo) para o usuário definir a própria senha em definir-senha.html — a conta só fica ativa depois disso.",
        "Permissões granulares por módulo: cada um dos módulos do sistema (Planejamento, cada Levantamento, cada Controle, Materiais, Mão de Obra, etc.) tem checks próprios (Ver/Criar/Editar/Excluir/Exportar/Importar conforme o módulo) — sem nenhuma marcada, o usuário não acessa a página.",
        "Acesso por obra: \"Todas as obras\" ou \"Restrito\" a uma lista específica — filtra tanto o seletor de obras da sidebar quanto a lista em Obras.",
        "Gate de página: toda página do sistema, ao carregar, verifica se o usuário tem permissão \"Ver\" do módulo correspondente — sem isso, é redirecionado antes de qualquer dado carregar.",
        "Mecanismo data-perm=\"modulo:acao\" nos botões (aplicado por enquanto em Obras, como padrão de referência) — próximas sessões devem estender aos demais módulos.",
        "Correção de segurança: usuário novo sem perfil carregado deixou de virar admin por padrão — agora o padrão é sem nenhum acesso até o admin configurar.",
        "Backend novo: api/usuarios.js (Firebase Admin SDK) cria/exclui usuários no Firebase Auth — exige a env var FIREBASE_SERVICE_ACCOUNT_KEY na Vercel."
      ]
    },
    {
      "versao": "V3.2.1",
      "legado": "V2.58.1",
      "status": "fechada",
      "data": "2026-07-31",
      "tipo": "correcao",
      "titulo": "Permissões: guards de acesso estendidos a todos os módulos (não só Obras)",
      "itens": [
        "Todo módulo com CRUD real agora checa a permissão do usuário antes de criar/editar/excluir/importar/exportar: Planejamento (com edição inline de célula e Editor de Estrutura), Materiais, Mão de Obra, Diário de Obra (lançamentos, avulsas, pauta rápida), Semanal, Medições, Relatórios, os 9 módulos de Levantamento, os 3 de Controle, Produção, Configuração de Obra e Backup de Planejamentos.",
        "Semanal: reaproveitado o mecanismo de somente-leitura que já existia pra semana fechada — agora também vale pra usuário sem permissão de editar, sem precisar duplicar lógica.",
        "Vários Levantamentos (Piso, Teto, Paredes, Pintura) guardam a árvore de locais num único ponto de gravação — o guard foi colocado ali, cobrindo automaticamente todas as ações do Editor de Estrutura de uma vez.",
        "Restrições, Orçamentos, Suprimentos e Histograma continuam stub — nada para travar além do gate de página que já existia.",
        "Cobertura visual (esconder o botão, não só bloquear a ação) aplicada nos módulos de CRUD simples (Materiais, Mão de Obra, Diário, Medições, Relatórios, Planejamento); os módulos de canvas/mapa (Levantamentos e Controles) por ora têm o bloqueio funcional mas o botão ainda aparece na tela — ficar de olho, é o próximo refinamento."
      ]
    },
    {
      "versao": "V3.2.1.1",
      "legado": "V2.58.2",
      "status": "fechada",
      "data": "2026-07-31",
      "tipo": "melhoria",
      "titulo": "Permissões: hubs de Levantamento e Controle já filtram os cards por permissão",
      "itens": [
        "Os cards de calculadora em Levantamentos (hub) e Controle (hub) agora somem se o usuário não tiver \"Ver\" no módulo correspondente — antes só bloqueava ao entrar na página de destino, agora nem aparece o card.",
        "Levantamento de Fachada: primeiro módulo de canvas/mapa a ganhar cobertura visual completa (+ Nova Fachada, + Balancim, excluir/duplicar em cada nível) — modelo de referência para estender aos demais Levantamentos e Controles."
      ]
    },
    {
      "versao": "V3.2.1.2",
      "legado": "V2.58.3",
      "status": "fechada",
      "data": "2026-07-31",
      "tipo": "melhoria",
      "titulo": "Permissões: cobertura visual completa em todos os Levantamentos e Controles",
      "itens": [
        "Botões de criar/excluir/importar agora somem (não só bloqueiam) quando o usuário não tem permissão, nos módulos que faltavam: Piso, Teto, Paredes, Concreto, Ar Condicionado, Pintura, Solo Grampeado e Terraplanagem (Levantamento), e Controle Concreto, Controle Solo Grampeado e Controle Terraplanagem.",
        "Com isso, todo o sistema de permissões — página, ação e visual — está com cobertura completa nos 26 módulos reais. Restrições/Orçamentos/Suprimentos/Histograma continuam stub, sem nada pra travar ainda."
      ]
    },
    {
      "versao": "V3.2.2",
      "legado": "V2.58.4",
      "status": "fechada",
      "data": "2026-07-31",
      "tipo": "correcao",
      "titulo": "Permissões: layout da lista de módulos no convite/edição de usuário estava desalinhado",
      "itens": [
        "O grid de 2 módulos por linha desalinhava tudo sempre que um módulo tinha mais ações que o vizinho (ex: Planejamento com 6 ações ao lado de um módulo com 5) — a linha de baixo quebrava e ficava torta.",
        "Trocado para lista de uma coluna, um módulo por linha, com o nome à esquerda e as ações à direita — cada linha quebra sozinha, sem empurrar a vizinha.",
        "Modal de convite/edição ficou mais largo (860px) pra acomodar melhor as linhas com mais ações."
      ]
    },
    {
      "versao": "V3.2.3",
      "legado": "V2.58.5",
      "status": "fechada",
      "data": "2026-07-31",
      "tipo": "correcao",
      "titulo": "Permissões: erro \"No document to update\" ao editar permissões de usuário antigo",
      "itens": [
        "Usuários criados antes do V2.58 (ex: as contas admin/chefe originais) não têm o documento em permissions/{uid} — só é criado agora, no momento do convite. Editar as permissões desses usuários chamava .update() nesse doc inexistente e falhava.",
        "Corrigido: agora usa set com merge (upsert) — cria o documento se não existir, atualiza se já existir."
      ]
    },
    {
      "versao": "V3.2.4",
      "legado": "V2.58.6",
      "status": "fechada",
      "data": "2026-07-31",
      "tipo": "correcao",
      "titulo": "Permissões: checklist de módulos reformulado pra bater com o padrão de referência (uma ação por linha)",
      "itens": [
        "A tentativa anterior colocava várias ações numa linha só por módulo, o que ainda desalinhava quando o texto quebrava. Agora cada ação é sua própria linha (checkbox + rótulo curto), num grid de 2 colunas por módulo — mesmo padrão do exemplo que o Milton mandou (Estoque/Pedidos/Ferramentas): cada item é auto-contido, então sempre alinha.",
        "Módulos continuam agrupados por categoria, com o nome do módulo como sub-título acima do grid de ações dele."
      ]
    },
    {
      "versao": "V3.2.5",
      "legado": "V2.58.7",
      "status": "fechada",
      "data": "2026-07-31",
      "tipo": "correcao",
      "titulo": "Permissões: 2ª coluna de checkboxes ficava muito distante da 1ª",
      "itens": [
        "grid-template-columns:1fr 1fr fazia cada coluna ocupar 50% da largura do modal — com o texto do checkbox sendo curto, a 2ª coluna acabava lá na borda direita, bem separada da 1ª.",
        "Corrigido: colunas do tamanho do próprio conteúdo (max-content), coladas uma na outra como no exemplo — modal também ficou mais estreito (620px), já que não precisa mais de tanto espaço."
      ]
    },
    {
      "versao": "V3.2.5.1",
      "legado": "V2.58.8",
      "status": "fechada",
      "data": "2026-07-31",
      "tipo": "melhoria",
      "titulo": "Permissões: lista de módulos em 2 colunas (CSS multi-column) — corta o scroll pela metade",
      "itens": [
        "A lista inteira de categorias/módulos era uma coluna só, obrigando a rolar bastante pra ver os módulos de baixo enquanto sobrava bastante espaço em branco do lado.",
        "Agora o conteúdo flui em 2 colunas (column-count), cada módulo inteiro protegido (break-inside:avoid-column) pra nunca cortar um módulo no meio — e o título da categoria fica colado ao primeiro módulo dela, nunca isolado no fim de uma coluna.",
        "Modal ficou mais largo (980px) pra caber as 2 colunas confortavelmente."
      ]
    },
    {
      "versao": "V3.2.6",
      "legado": "V2.58.9",
      "status": "fechada",
      "data": "2026-07-31",
      "tipo": "correcao",
      "titulo": "Permissões: categoria \"Produção\" estava sendo cortada e espalhada entre as duas colunas",
      "itens": [
        "A proteção break-inside:avoid-column da vez anterior estava só em cada módulo isolado — a categoria em si (Produção, com 14 módulos) não tinha proteção, então o navegador cortava ela no meio e mandava a segunda metade pra coluna seguinte, embaralhando com outra categoria.",
        "Corrigido: agora a categoria inteira (título + todos os módulos dela) é um bloco atômico só — nunca mais é cortada, sempre fica junta na mesma coluna, do início ao fim.",
        "Aumentado pra 3 colunas e reduzido o espaçamento entre elas (36px → 22px) — menos espaço em branco, mais aproveitamento da largura.",
        "Modal mais largo (1180px) pra caber as 3 colunas."
      ]
    },
    {
      "versao": "V3.2.7",
      "legado": "V2.58.10",
      "status": "fechada",
      "data": "2026-07-31",
      "tipo": "correcao",
      "titulo": "Permissões: balanceamento automático do CSS deixava as colunas com alturas muito desiguais",
      "itens": [
        "Mesmo sem cortar nenhuma categoria no meio, o algoritmo de balanço do navegador (column-count) decidia sozinho onde cortar entre colunas — e como Produção tem 14 módulos contra 2 da Principal, o resultado era uma coluna quase vazia ao lado de outra lotada.",
        "Trocado o balanceamento automático do CSS por uma distribuição manual: calculo o \"peso\" de cada categoria (baseado em quantas linhas de checkbox ela tem) e distribuo com um algoritmo guloso — cada categoria inteira sempre vai pra coluna que está mais vazia no momento. Nenhuma categoria nunca é dividida entre colunas.",
        "Produção continua sendo, de longe, a categoria maior do sistema — nenhuma distribuição vai deixar as 3 colunas com altura idêntica sem quebrar uma categoria no meio, o que foi decidido não fazer."
      ]
    },
    {
      "versao": "V3.2.7.1",
      "legado": "V2.58.11",
      "status": "fechada",
      "data": "2026-07-31",
      "tipo": "melhoria",
      "titulo": "Permissões: checklist reformulado — módulo é a célula do grid, não a categoria",
      "itens": [
        "Trocada a lógica de novo: em vez de jogar categorias inteiras em 3 colunas (o que sempre deixava alguma desbalanceada), agora cada MÓDULO é uma célula de um grid CSS de 4 colunas — dentro de \"Produção\" os módulos preenchem a linha em ordem (Planejamento, Fachada, Piso, Teto, ...), voltando pra próxima linha quando enche, exatamente como pedido.",
        "O título de cada categoria ocupa a linha inteira (grid-column:1/-1) — como isso nunca cabe numa linha que já tem módulo de outra categoria, o próprio CSS Grid empurra ele pra uma linha nova, garantindo que \"Custos\" nunca comece misturado com o fim de \"Produção\".",
        "Modal mais largo (1280px) pra acomodar as 4 colunas de módulo."
      ]
    },
    {
      "versao": "V3.2.7.2",
      "legado": "V2.58.12",
      "status": "fechada",
      "data": "2026-07-31",
      "tipo": "melhoria",
      "titulo": "Permissões: linhas claras separando cada módulo no checklist",
      "itens": [
        "Cada módulo agora tem uma borda sutil ao redor (tipo card), separando visualmente um do outro na grade — antes ficavam soltos, só o espaçamento entre eles."
      ]
    },
    {
      "versao": "V3.2.7.3",
      "legado": "V2.58.13",
      "status": "fechada",
      "data": "2026-07-31",
      "tipo": "melhoria",
      "titulo": "Permissões: título das categorias (Produção, Custos, etc.) maior e em negrito",
      "itens": [
        "Estava usando a classe de título da sidebar (pensada pra menu estreito, 0.57rem) — ficava minúsculo dentro do modal. Aumentado pra .98rem, negrito, pra separar melhor visualmente do nome dos módulos."
      ]
    },
    {
      "versao": "V3.2.8",
      "legado": "V2.58.14",
      "status": "fechada",
      "data": "2026-07-31",
      "tipo": "correcao",
      "titulo": "Permissões: convite falhava com \"Domain not allowlisted\" se o domínio não estiver nos Authorized domains do Firebase",
      "itens": [
        "O link de \"definir senha\" usa uma continue-URL customizada (nossa própria página, em vez da padrão do Firebase) — isso exige que o domínio esteja em Firebase Console > Authentication > Settings > Authorized domains. Sem isso configurado, o envio falhava por completo.",
        "Adicionado fallback: se o domínio não estiver autorizado, tenta de novo sem a URL customizada — o e-mail sai mesmo assim (só cai na página padrão do Firebase em vez da nossa própria), com um aviso claro na tela pra configurar o domínio."
      ]
    },
    {
      "versao": "V3.2.9",
      "legado": "V2.58.15",
      "status": "fechada",
      "data": "2026-07-31",
      "tipo": "correcao",
      "titulo": "definir-senha.html ficava travado pra sempre em \"Verificando convite...\"",
      "itens": [
        "Faltava carregar o SDK do Firebase Storage nessa página — initFirebase() sempre tenta iniciar firebase.storage(), isso lançava um erro silencioso, e a função de verificação do convite parava no meio sem nunca trocar de tela.",
        "Corrigido: adicionado o script que faltava, e a função agora sempre mostra a tela de \"link inválido\" em caso de qualquer falha ao iniciar o Firebase, em vez de travar sem feedback nenhum."
      ]
    },
    {
      "versao": "V3.2.10",
      "legado": "V2.58.16",
      "status": "fechada",
      "data": "2026-07-31",
      "tipo": "correcao",
      "titulo": "Conta convidada carregava e era expulsa em seguida (definir-senha.html engolia erro de ativação)",
      "itens": [
        "Depois de definir a senha, o código marcava a conta como ativa no banco (ativo:true) mas engolia qualquer erro nessa gravação e navegava pra frente mesmo assim — se a gravação falhasse, a conta ficava salva como ativo:false pra sempre, e o gate de permissões (que rejeita contas inativas) expulsava o usuário assim que a próxima página carregasse.",
        "Corrigido: troquei de .update() pra .set com merge (mais robusto) e parei de engolir o erro — se falhar, agora mostra uma mensagem clara na tela em vez de navegar e deixar o problema estourar em silêncio mais tarde.",
        "Se alguma conta já ficou travada nesse estado antes dessa correção: em Permissões, ache o usuário e clique no botão ▶️ (Ativar) na lista — resolve na hora, sem precisar reenviar convite."
      ]
    },
    {
      "versao": "V3.2.11",
      "legado": "V2.58.17",
      "status": "fechada",
      "data": "2026-07-31",
      "tipo": "correcao",
      "titulo": "Menu lateral mostrava \"Levantamentos\", \"Controle\" e categorias vazias mesmo sem permissão nenhuma",
      "itens": [
        "\"Levantamentos\" e \"Controle\" são hubs (agrupam vários módulos) e nunca tinham checagem própria — apareciam pra todo mundo, mesmo quem não tinha acesso a nenhum levantamento/controle. Corrigido: agora só aparecem se o usuário tiver \"Ver\" em pelo menos um dos módulos daquele grupo.",
        "Categorias do menu (Gestão, Custos, Análise...) ficavam com o título visível mesmo sem nenhum link embaixo, por serem apenas texto sem checagem. Agora o título da categoria some automaticamente quando nenhum item dela está visível.",
        "Um usuário com acesso só ao Dashboard agora vê exatamente isso: Obras e Dashboard — nada mais no menu."
      ]
    },
    {
      "versao": "V3.2.12",
      "legado": "V2.58.18",
      "status": "fechada",
      "data": "2026-07-31",
      "tipo": "correcao",
      "titulo": "Obras: botões de Editar/Configurar ficavam clicáveis mesmo sem permissão",
      "itens": [
        "O render dos cards de obra acontece depois do carregamento assíncrono das obras — ou seja, depois do gate inicial da página já ter rodado uma vez. Como renderizar() nunca chamava Permissions.aplicarNaTela() de novo, os botões dinâmicos (Editar, Configurar) nunca ficavam escondidos, mesmo sem a permissão marcada.",
        "Corrigido: renderizar() agora reaplica as permissões depois de montar os cards. Também adicionado guard direto nas funções (abrirFormEditar, abrirConfiguracao, abrirFormNova, salvar) — mesmo que o botão apareça por algum motivo, a ação real é recusada.",
        "Corrigido de brinde: o botão \"⚙️ Configurar Obra\" estava checando a permissão errada (obras:editar) — ele na verdade abre a página configuracao-obra.html, então agora checa o módulo certo (configuracaoObra).",
        "Auditei todos os outros módulos por esse mesmo tipo de bug (data-perm sem nenhuma chamada a aplicarNaTela) — nenhum outro caso encontrado."
      ]
    },
    {
      "versao": "V3.2.12.1",
      "legado": "V2.58.19",
      "status": "fechada",
      "data": "2026-07-31",
      "tipo": "melhoria",
      "titulo": "Solo Grampeado — Levantamento: rótulo de m² do polígono medido vira arrastável; vértices do polígono em desenho também ficam arrastáveis",
      "itens": [
        "O rótulo \"📐 X m²\" do polígono já salvo ficava sempre fixo no centroide, muitas vezes cobrindo os números dos chumbadores no desenho — agora pode ser arrastado pra qualquer posição do mapa, e a posição fica salva por vista.",
        "Ao desenhar um novo polígono (Medir Área), os vértices já marcados agora podem ser arrastados pra corrigir a posição, sem precisar desfazer e clicar de novo.",
        "O m² calculado também aparece fora da imagem, na barra de ferramentas, atualizando ao vivo enquanto os vértices são adicionados/ajustados."
      ]
    },
    {
      "versao": "V3.2.13",
      "legado": "V2.58.21",
      "status": "fechada",
      "data": "2026-07-31",
      "tipo": "correcao",
      "titulo": "Planejamento mostrava % concluído da obra diferente do Dashboard (27% vs 12,68% na mesma obra) — dois métodos de cálculo diferentes coexistindo",
      "itens": [
        "O % de uma tarefa-pai no Planejamento (e Diário/Semanal/Produção, que usam a mesma função Utils.percFamilia) era calculado de forma RECURSIVA: média dos filhos diretos ponderada pela duração de CADA FILHO — e essa duração de um filho-grupo normalmente é o intervalo de calendário dele, não a soma do trabalho real dentro dele.",
        "O Dashboard (e a listagem de Obras) usa outra fórmula, mais simples e correta: pondera TODAS as folhas (tarefas sem filhos) pela duração de CADA FOLHA, direto — sem passar por médias intermediárias de grupo.",
        "Essas duas contas divergem MUITO quando a obra tem grupos desbalanceados (ex: um grupo com pouco andamento escondendo, lá dentro, uma tarefa gigante ainda em 0% — o método recursivo \"amortece\" isso, o método direto não deixa passar).",
        "Corrigido: Utils.percFamilia agora usa a MESMA fórmula do Dashboard/Obras em todo lugar (Planejamento, Diário de Obra, Semanal, Produção) — o % da obra agora bate igual em qualquer tela."
      ]
    },
    {
      "versao": "V3.3.0",
      "legado": "V2.59.0",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "funcionalidade",
      "titulo": "Novo módulo: Controle de Estacas e Fundações",
      "itens": [
        "Importa o PDF (ou imagem) da prancha do projeto — cada obra pode ter várias pranchas.",
        "Estacas: marcador circular — clique no centro e arraste pra definir o raio, do tamanho da estaca no desenho.",
        "Fundações (blocos/sapatas/tubulões): marcador poligonal — clique ponto a ponto pra contornar a forma real da peça.",
        "Cada marcador se vincula a uma peça do Levantamento de Concreto (tipo Fundação) — Estacas só vinculam a subTipo \"Estacas\", Fundações aos outros 8 subtipos.",
        "O status pintado (🟢 concretado · 🟠 parcial · ⚪ pendente · ▢ sem vínculo) vem direto do % concretado da peça no Controle de Concreto (BTs/lançamentos) — este módulo não lança volume, só posiciona e exibe.",
        "Formas ajustáveis depois de criadas: mover/redimensionar o círculo, arrastar vértices do polígono.",
        "Dashboard: painel novo com minimapa de cada prancha (somente leitura) mostrando o mesmo status pintado."
      ]
    },
    {
      "versao": "V3.3.1",
      "legado": "V2.59.1",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "correcao",
      "titulo": "Levantamento de Concreto — Estacas: cadastro por grupos (diâmetro + comprimento + quantidade)",
      "itens": [
        "Antes: 1 peça \"Estacas\" = 1 diâmetro + 1 comprimento, salva com o nome do pilar.",
        "Agora: informa o nome do pilar 1x, e adiciona quantos grupos de diâmetro/comprimento/quantidade precisar (ex: 10 estacas de Ø40 + 2 de Ø50 no mesmo pilar).",
        "Cada estaca vira uma peça individual no levantamento, rotulada por letra: Pilar10-a, Pilar10-b... seguindo a ordem dos grupos, até o total de estacas.",
        "Ao trocar de pilar (nome), a letra reinicia em \"a\".",
        "subTipo continua \"Estacas\" — mantém o vínculo com o módulo Controle de Estacas e Fundações."
      ]
    },
    {
      "versao": "V3.3.2",
      "legado": "V2.59.2",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "correcao",
      "titulo": "Levantamento de Concreto — criar andar direto na calculadora",
      "itens": [
        "Antes: a calculadora só listava andares já existentes (de peças salvas ou da tela ⚙️ Config) — obra nova sem nenhum andar cadastrado deixava o campo \"Andar\" vazio e travava o botão de salvar.",
        "Agora: o seletor de Andar tem a opção \"+ Criar novo andar...\", que abre um campo pra digitar o nome e já salva na configuração da obra, sem precisar fechar a calculadora."
      ]
    },
    {
      "versao": "V3.3.3",
      "legado": "V2.59.3",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "correcao",
      "titulo": "Levantamento de Concreto — editar peças no Levantamento (antes de enviar pra Base) + repasse de diâmetro/comprimento",
      "itens": [
        "Botão ✎ em cada item do Levantamento (staging) — edita nome, andar e volume ali mesmo, sem precisar mandar pra Base primeiro.",
        "Peças de Estacas mostram diâmetro e comprimento editáveis + botão ↻ que recalcula o volume automaticamente a partir deles.",
        "Confirmado: cada estaca gerada (P110-a, P110-b...) já grava o volume individual dela, não o total do pilar — o número \"Volume calculado\" da calculadora é só a prévia da soma de tudo que vai ser criado.",
        "Corrigido: diâmetro/comprimento das estacas estavam se perdendo ao mandar do Levantamento pra Base (não eram repassados) — agora vão junto."
      ]
    },
    {
      "versao": "V3.3.4",
      "legado": "V2.59.4",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "correcao",
      "titulo": "Levantamento de Concreto — Estacas: editar o conjunto inteiro do pilar, não só uma letra",
      "itens": [
        "Problema: editar uma peça isolada (ex: só a \"f\") não resolvia quando a quantidade errada — não dava pra criar uma \"g\" nova.",
        "Agora as estacas de um mesmo pilar aparecem AGRUPADAS no Levantamento (\"P110 · 6 estacas\"), com um único ✎ que abre o conjunto inteiro (mesma tela de grupos diâmetro/comprimento/quantidade da calculadora).",
        "Muda a quantidade (6→7), adiciona um novo grupo de diâmetro, ou remove um grupo — ao salvar, todas as estacas do pilar são apagadas e recriadas com as letras certas (a até a nova quantidade total).",
        "Selecionar/remover também passou a ser por conjunto inteiro (marca ou apaga o pilar todo de uma vez)."
      ]
    },
    {
      "versao": "V3.3.5",
      "legado": "V2.59.5",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "correcao",
      "titulo": "Levantamento de Concreto — lista não pula mais pro topo ao editar",
      "itens": [
        "Ao clicar ✎ numa peça/conjunto lá embaixo na lista do Levantamento, a tela voltava pro topo — dava a impressão de estar editando o item errado.",
        "Corrigido: a posição do scroll agora é preservada ao abrir/fechar edição."
      ]
    },
    {
      "versao": "V3.3.5.1",
      "legado": "V2.59.6",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "funcionalidade",
      "titulo": "Controle de Estacas e Fundações ganha Planejamento e Acompanhamento, e importar prancha vira um passo só",
      "itens": [
        "Importar prancha simplificado: nome + PDF/imagem agora ficam no mesmo formulário — antes era preciso criar a prancha primeiro e só depois um segundo popup pedia o arquivo.",
        "Nova aba Planejamento: escolhe ou cria uma Concretagem (a mesma coleção do Levantamento/Controle de Concreto — nº compartilhado em todo o sistema) e marca, clicando na prancha, quais estacas/fundações (já vinculadas a uma peça) entram nela. Uma BT única é auto-gerenciada por concretagem, com volume previsto = soma do volume das peças planejadas.",
        "Nova aba Acompanhamento: escolhe uma concretagem planejada e clica na peça que foi REALMENTE concretada — isso grava um lançamento de verdade (concretoLancamentos), que também aparece no Controle de Concreto/relatórios de BT.",
        "Estacas/Fundações: seletor de estaca vs. fundação disponível também dentro do Planejamento e do Acompanhamento, não só na aba Marcadores.",
        "Planejamento (Gantt): uma tarefa pode se vincular ao % de execução de UMA peça específica ou de UMA concretagem inteira (a pessoa escolhe qual, na hora) — o % da tarefa deixa de ser digitado à mão e passa a vir automaticamente da execução real, se atualizando sempre que um real é lançado no Acompanhamento ou quando o Planejamento é reaberto. Cálculo centralizado em EstacasCalculos.sincronizarVinculosPlanejamento, pra nunca haver dois números divergentes.",
        "Controle de Estacas: modal de vincular marcador mostra um resumo da quantidade de estacas por diâmetro no levantamento (usa o campo diâmetro já salvo por peça, do Levantamento de Concreto), pra ajudar a escolher qual peça corresponde à estaca do projeto."
      ]
    },
    {
      "versao": "V3.3.6",
      "legado": "V2.59.7",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "correcao",
      "titulo": "Levantamento de Concreto — diâmetro/comprimento das estacas agora aparecem em todo lugar",
      "itens": [
        "Diâmetro/comprimento já eram gravados no banco, mas ficavam invisíveis — não apareciam em lugar nenhum da tela.",
        "Tabela de Peças (Base): nova coluna \"Ø / Comp.\" (ex: Ø40cm × 6m) para peças de Estacas.",
        "Levantamento (staging): o card do conjunto do pilar agora mostra o diâmetro/comprimento (ou \"N diâmetros diferentes\" se o pilar tiver mais de um tipo de estaca).",
        "Editar Peça (Base): formulário ganhou campos de Diâmetro e Comprimento — dá pra ver e corrigir mesmo depois de já ter ido pra base."
      ]
    },
    {
      "versao": "V3.3.6.1",
      "legado": "V2.59.8",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "melhoria",
      "titulo": "Controle de Estacas: combobox de busca pra vincular peça, e cor por diâmetro/comprimento no desenho",
      "itens": [
        "Vincular marcador: o antigo <select> (tinha que rolar a lista inteira) virou um campo de busca — digita parte do nome, andar ou diâmetro e a lista filtra na hora; clica pra selecionar.",
        "Cada combinação de diâmetro+comprimento de estaca agora ganha um anel colorido próprio ao redor do círculo no desenho, além da cor de status (verde/laranja/cinza) que já existia — dá pra ver de longe quais estacas são de qual \"tipo\" sem precisar clicar uma por uma. Legenda das cores aparece embaixo do seletor Estacas/Fundações, nas três abas (Marcadores, Planejamento, Acompanhamento) e também no minimapa do Dashboard."
      ]
    },
    {
      "versao": "V3.3.7",
      "legado": "V2.59.9",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "correcao",
      "titulo": "Levantamento de Concreto — tela de Peças não pula mais pro topo ao salvar uma edição",
      "itens": [
        "Editar uma peça (✎) e clicar Salvar recarregava a tela inteira e voltava o scroll pro topo da lista de Peças — muito ruim numa obra com centenas de peças.",
        "Corrigido: a posição do scroll da tela principal agora é preservada ao salvar/atualizar qualquer peça."
      ]
    },
    {
      "versao": "V3.3.7.1",
      "legado": "V2.59.10",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "melhoria",
      "titulo": "Levantamento de Concreto — filtro de Peças cobre qualquer coluna + filtro por status",
      "itens": [
        "A busca de texto agora casa com QUALQUER coluna da tabela: nome, tipo, andar, diâmetro, comprimento e volume — antes só buscava nome/tipo/andar.",
        "Novo select \"Status\" (Pendente/Parcial/Completo) — filtra pelo mesmo % de concretado que aparece na coluna."
      ]
    },
    {
      "versao": "V3.3.8",
      "legado": "V2.59.11",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "correcao",
      "titulo": "Levantamento de Concreto — filtro por coluna de verdade (não mais uma busca única)",
      "itens": [
        "Trocada a busca única por um filtro embaixo de CADA coluna da tabela de Peças: Nome, Tipo, Andar, Ø/Comp., Volume e Status — cada um filtra independente, do jeito que a pessoa quiser combinar.",
        "Clicar no título de qualquer coluna ordena a lista por ela (▲/▼); clica de novo inverte.",
        "Botão ✕ na linha de filtros limpa tudo de uma vez."
      ]
    },
    {
      "versao": "V3.3.9",
      "legado": "V2.59.12",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "correcao",
      "titulo": "Levantamento de Concreto — bug real: filtro perdia o foco a cada letra digitada",
      "itens": [
        "Causa: cada tecla digitada num campo de filtro (Nome, Ø/Comp., Volume) reconstruía a tabela INTEIRA — inclusive o próprio campo onde a pessoa estava digitando — então o cursor saía do campo a cada letra. Dava a impressão de \"não funcionar\".",
        "Corrigido: digitar agora só atualiza as linhas da tabela, sem tocar na linha de filtros — o campo mantém o foco, dá pra digitar a palavra inteira normalmente."
      ]
    },
    {
      "versao": "V3.3.9.1",
      "legado": "V2.59.13",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "funcionalidade",
      "titulo": "Controle de Estacas: girar o projeto, e Planejamento/Acompanhamento repensados (atribuição direta por clique)",
      "itens": [
        "Girar 90°: gira a prancha (imagem + todos os marcadores já feitos) de vez — não é um toggle de visualização, fica fixa no sentido escolhido. Disponível nas abas Marcadores e Planejamento.",
        "Planejamento: não pede mais pra criar uma Concretagem antes (nº, data, descrição) — agora é só clicar na peça já vinculada na prancha (a mesma prancha da aba Marcadores, sem seletor próprio) e dizer o número da concretagem (existente ou novo); o registro é criado na hora, sem formulário.",
        "Cada peça já atribuída mostra o número da concretagem em cima do marcador, direto na prancha.",
        "Embaixo do mapa, um card por concretagem mostra quantidade de peças, volume total e o detalhamento por diâmetro — a separação \"por dia de concretagem\" com os volumes de cada uma.",
        "Acompanhamento: escolhe a concretagem e vai marcando peça por peça (feito/pendente) — cada clique grava um lançamento de verdade (aparece no Controle de Concreto também) e atualiza o % do Planejamento (Gantt) na hora. Resumo mostra volume e quantidade por diâmetro, executado × faltando."
      ]
    },
    {
      "versao": "V3.3.9.2",
      "legado": "V2.59.14",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "funcionalidade",
      "titulo": "Controle de Estacas: tela cheia (Marcadores, Planejamento e Acompanhamento)",
      "itens": [
        "Botão \"⛶ Tela cheia\" no topo do módulo — expande a aba atual (a mesma área, com TODAS as funções: toggle estaca/fundação, seletor de prancha, adicionar, girar, zoom, legenda, clicar pra vincular/atribuir/marcar real) pra ocupar a tela inteira, sem a barra lateral no caminho.",
        "O mapa também fica bem maior dentro da tela cheia, usando quase toda a altura disponível.",
        "Sai com o botão \"✕ Fechar tela cheia\" ou apertando Esc."
      ]
    },
    {
      "versao": "V3.3.10",
      "legado": "V2.59.15",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: tela cheia mostra só o quadro do mapa, sem a faixa de cima",
      "itens": [
        "Na aba Marcadores, a tela cheia estava trazendo também os 4 cartões de resumo (estacas marcadas, vinculadas, concretadas, % médio) acima do mapa — agora só o quadro com o mapa em si aparece.",
        "Na aba Planejamento, o card \"Concretagens planejadas\" (embaixo do mapa) também some na tela cheia, pelo mesmo motivo."
      ]
    },
    {
      "versao": "V3.3.11",
      "legado": "V2.59.16",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: correção de verdade da V2.59.15 — os cartões continuavam aparecendo na tela cheia",
      "itens": [
        "A V2.59.15 escondia os cartões só na PRÓXIMA renderização — mas entrar/saír da tela cheia só atualizava o mapa, não o painel inteiro, então o HTML antigo (com os cartões) continuava ali, só realocado pra tela cheia sem re-render.",
        "Corrigido: entrar/saír da tela cheia agora reconstrói o painel da aba inteiro (não só o mapa), então o esconde/mostra dos cartões passa a valer de fato."
      ]
    },
    {
      "versao": "V3.3.11.1",
      "legado": "V2.59.17",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "melhoria",
      "titulo": "Controle de Estacas: botões Marcadores/Planejamento/Acompanhamento disponíveis dentro da tela cheia",
      "itens": [
        "A tela cheia não trazia o seletor de abas — pra trocar entre Marcadores/Planejamento/Acompanhamento era preciso saír da tela cheia primeiro.",
        "Agora o seletor de abas vai junto pra dentro da tela cheia — dá pra trocar de aba sem sair."
      ]
    },
    {
      "versao": "V3.3.12",
      "legado": "V2.59.18",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: painéis de baixo (tabela / concretagens) voltam a aparecer na tela cheia",
      "itens": [
        "Só o card de resumo (4 cartões no topo) deveria sumir na tela cheia — mas por engano a tabela \"Estacas/Fundações desta prancha\" (Marcadores) e o card \"Concretagens planejadas\" (Planejamento) também estavam sumindo.",
        "Corrigido: agora só a faixa de cartões do topo fica de fora; os painéis de baixo continuam disponíveis na tela cheia."
      ]
    },
    {
      "versao": "V3.3.13",
      "legado": "V2.59.19",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: clicar em \"Adicionar Estaca\"/\"Adicionar Fundação\" não deve mais fazer a prancha \"saltar\" pro topo",
      "itens": [
        "Clicar em Adicionar Estaca/Fundação chamava um re-render da PÁGINA INTEIRA (KPI, tabela, tudo) só pra ligar o modo de criação — isso recriava o mapa do zero e perdia a posição do scroll, dando a impressão de que a prancha \"andava\"/pulava.",
        "Isso também podia fazer o clique de criação (arrastar pra definir o raio) não terminar de registrar corretamente, dependendo do timing — daí o popup de vincular às vezes não abria.",
        "Corrigido: ligar/desligar o modo de criação agora só atualiza o mapa e o botão em si (mesmo caminho leve que \"Cancelar\" já usava) — sem recriar a página, sem perder o scroll."
      ]
    },
    {
      "versao": "V3.3.14",
      "legado": "V2.59.20",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: achada a corrida real do popup que não abria ao Adicionar Estaca",
      "itens": [
        "Quando a imagem da prancha não estava em cache (ex: logo depois de girar 90°), buscar ela no Firestore levava um instante — e nesse meio tempo o mapa em tela ainda era o ANTIGO, com os listeners do modo anterior (não do modo \"criar estaca\").",
        "Se a pessoa clicasse pra criar a estaca durante essa janela, o clique caía no listener errado (modo normal, que só reage a marcador já existente) — nada acontecia, nem erro nem popup.",
        "Isso explica por que parecia \"só funcionar\" às vezes: quanto mais devagar a conexão ou quanto mais cedo depois de girar a prancha, maior a chance de cair nessa janela.",
        "Corrigido: agora, se a imagem precisa ser buscada, a tela trava com um loading até o mapa novo (já no modo certo) estar pronto — sem essa janela de clique “no vazio”."
      ]
    },
    {
      "versao": "V3.3.14.1",
      "legado": "V2.59.21",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "funcionalidade",
      "titulo": "Controle de Estacas: achado o bug do zoom + botões de seleção rápida por tipo de estaca",
      "itens": [
        "Bug real encontrado: o tamanho mínimo do arrasto pra criar uma estaca era medido como fração da LARGURA DA IMAGEM, não em pixels de tela. Com zoom alto, um arrasto de tamanho normal na tela virava uma fração pequena da imagem (que agora é enorme) e caía por baixo do mínimo — descartado em silêncio, sem popup, sem erro. Corrigido: o mínimo agora é medido em pixels de tela (constante, não muda com o zoom).",
        "Novidade: botões de seleção rápida por tipo — em vez do botão genérico \"Adicionar Estaca\" (que exige arrastar pra definir o tamanho toda vez), agora aparece um botão pra cada diâmetro×comprimento já cadastrado no Levantamento (ex: \"⌀90cm × 23m\"). Clica no tipo, depois só clica em cada estaca daquele tipo no desenho — sai automaticamente no tamanho certo pro zoom atual, sem arrastar.",
        "O tamanho de referência é calculado pela escala já usada pelas estacas existentes no desenho (mesmo que sejam de outro diâmetro) — então funciona até no primeiro clique de um tipo novo, sem precisar cadastrar manualmente nenhuma escala.",
        "Clique rápido no modo por tipo não abre popup a cada estaca (fica sem vincular por enquanto) — assim dá pra marcar todas as de um tipo em sequência rapidamente; a vinculação com a peça é feita depois, uma a uma, na aba Marcadores normal."
      ]
    },
    {
      "versao": "V3.3.15",
      "legado": "V2.59.22",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: removidos os botões por tipo (não ficaram bons) + corrigido salto de tela ao excluir marcador",
      "itens": [
        "Removida a seleção rápida por tipo de estaca (V2.59.21) — voltou pro botão único \"Adicionar Estaca\" (arrastar pra definir o tamanho). O fix real do bug do zoom (limiar em pixels de tela, não fração da imagem) continua valendo.",
        "Excluir marcador (e outras ações que recarregam a prancha) fazia a tela \"saltar\" pro topo — mesma causa das vezes anteriores: o painel inteiro era reconstruído do zero antes do mapa novo aparecer, perdendo a posição do scroll.",
        "Corrigido de forma mais ampla: a posição do scroll agora é guardada ANTES de qualquer reconstrução do painel de Marcadores e devolvida DEPOIS que o mapa novo termina de carregar — cobre excluir, vincular e qualquer outra ação que recarregue a prancha, não só zoom/girar."
      ]
    },
    {
      "versao": "V3.3.15.1",
      "legado": "V2.59.23",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "melhoria",
      "titulo": "Controle de Estacas: arrastar estaca já existente pra reposicionar, e \"Salvar e Próximo\" no vincular",
      "itens": [
        "Segurar e arrastar uma estaca (círculo) já marcada agora move ela direto, sem precisar abrir o popup e clicar em \"Ajustar forma\" antes — clique rápido sem arrastar continua abrindo o vínculo, normal.",
        "Modal de vincular ganhou o botão \"💾 Salvar e Próximo\" — salva o vínculo, fecha o popup e já reentra no modo de adicionar (círculo ou polígono, igual ao marcador que acabou de salvar), sem precisar clicar de novo em \"Adicionar Estaca\"/\"Adicionar Fundação\"."
      ]
    },
    {
      "versao": "V3.3.15.2",
      "legado": "V2.59.24",
      "status": "fechada",
      "data": "2026-08-01",
      "tipo": "melhoria",
      "titulo": "Controle de Estacas: Planejamento e Acompanhamento ganham zoom/pan igual Marcadores, e atribuição rápida de concretagem",
      "itens": [
        "Ctrl+roda (zoom) e Ctrl+arrastar (mover o mapa) agora funcionam em Planejamento e Acompanhamento também — antes só existiam na aba Marcadores.",
        "Planejamento: agora dá pra criar a concretagem direto ali em cima (nº, data, descrição), sem precisar passar pelo popup de uma peça.",
        "Clique num card de concretagem pra selecionar (fica marcado 📌) — com uma selecionada, clicar nas peças no desenho já atribui direto, sem abrir popup a cada uma; clique de novo numa peça já atribuída à mesma concretagem remove. Clique numa peça sem nenhuma concretagem selecionada continua abrindo o popup de escolha, como antes.",
        "Confirmado: uma concretagem criada em Controle de Estacas usa exatamente os mesmos campos do Assistente de Concretagem do Levantamento de Concreto — aparece e funciona normalmente dentro do Controle de Concreto, sem nenhum ajuste extra."
      ]
    },
    {
      "versao": "V3.3.15.3",
      "legado": "V2.59.25",
      "status": "fechada",
      "data": "2026-08-03",
      "tipo": "funcionalidade",
      "titulo": "Vínculos com Levantamento: Terraplanagem entra no módulo + Concreto navega por Andar/Tipo/Concretagem",
      "itens": [
        "Terraplanagem estava de fora dos Vínculos desde que foi lançada — agora aparece com 2 métricas: Volume de Corte (banco) e Volume Solto (empolado), calculadas igual ao Levantamento (sem separação por local, é 1 volume só da obra).",
        "Concreto: antes só existia 1 número (volume total da obra). Agora dá pra navegar em pastas por Andar → Tipo (Pilar, Viga, Laje...) e vincular a quantidade exata de cada combinação a uma tarefa.",
        "Concreto também ganhou pastas por Concretagem (ex: \"Concretagem Nº5 — Pilares Térreo\") — soma o volume das peças vinculadas àquela concretagem (respeitando o % de cada peça), útil pra vincular pela etapa de execução em vez do local físico."
      ]
    },
    {
      "versao": "V3.3.15.4",
      "legado": "V2.59.26",
      "status": "fechada",
      "data": "2026-08-03",
      "tipo": "melhoria",
      "titulo": "Dashboard: gráfico \"Fundação e Estrutura\" separado em 3 (Fundação Profunda/Estacas, Fundação, Estrutura)",
      "itens": [
        "Antes era 1 gráfico só somando Fundação+Estrutura. Agora são 3 gráficos por andar, mesmo critério do Controle de Estacas: Fundação Profunda (Estacas) = peça Fundação com subtipo Estacas; Fundação = peça Fundação sem esse subtipo (rasa/superficial); Estrutura = todo o resto (Pilar/Viga/Laje/Cortina/Escada/Rampa/Caixa D'água/Outro)."
      ]
    },
    {
      "versao": "V3.3.15.5",
      "legado": "V2.59.27",
      "status": "fechada",
      "data": "2026-08-03",
      "tipo": "melhoria",
      "titulo": "Dashboard: clique na barra de Fundação Profunda/Fundação/Estrutura abre o projeto correspondente",
      "itens": [
        "Fundação Profunda (Estacas) e Fundação: clique na barra do andar abre a prancha (PDF/imagem) já cadastrada no Controle de Estacas e Fundações, com as peças daquele andar marcadas. Se houver mais de uma prancha, abre a da primeira concretagem e navega pelas demais com as setas.",
        "Estrutura: clique na barra leva direto pro Controle de Concreto, já na aba Relatórios com aquele andar aberto."
      ]
    },
    {
      "versao": "V3.3.16",
      "legado": "V2.59.28",
      "status": "fechada",
      "data": "2026-08-03",
      "tipo": "correcao",
      "titulo": "Dashboard: peça de estaca antiga sem subTipo caía em \"Fundação\" + ordem de andares travava em andar novo criado após reordenar manualmente",
      "itens": [
        "Peças de Fundação criadas antes do campo subTipo existir não tinham esse campo gravado — caíam sempre em \"Fundação\" mesmo sendo estaca de verdade. Agora, sem subTipo mas com diâmetro E comprimento preenchidos (só faz sentido em estaca), o Dashboard classifica como Fundação Profunda (Estacas).",
        "Ordenação de andares (Controle de Concreto, Dashboard, e onde mais usa CC.ordenarAndares): depois que a ordem era reorganizada manualmente uma vez, todo andar criado depois caía sempre no FINAL da lista por ordem de criação — nunca mais era posicionado pelo número (causa do \"10º, 11º, 12º... 1º, 1º Subsolo, 2º...\" fora de ordem). Corrigido: a ordem manual entre os andares já reorganizados continua 100% preservada; andares novos agora são inseridos automaticamente na posição numérica correta dentro dela."
      ]
    },
    {
      "versao": "V3.3.17",
      "legado": "V2.59.29",
      "status": "fechada",
      "data": "2026-08-03",
      "tipo": "correcao",
      "titulo": "Dashboard: clique nas barras de Fundação/Estrutura não disparava (V2.59.27 não funcionava na prática)",
      "itens": [
        "O clique era ligado direto no retângulo invisível de cada coluna (addEventListener por elemento) — trocado por delegação de evento no card inteiro (elemento pai fixo, nunca recriado), que é mais robusto contra qualquer problema de timing/anexação em nós SVG gerados dinamicamente."
      ]
    },
    {
      "versao": "V3.3.17.1",
      "legado": "V2.59.30",
      "status": "fechada",
      "data": "2026-08-03",
      "tipo": "funcionalidade",
      "titulo": "Dashboard: volta a ser 1 gráfico só (Fundação Profunda/Fundação/Estrutura em cores, não mais 3 gráficos) + ordem exata do Controle de Concreto",
      "itens": [
        "Voltou a ser um único gráfico \"Fundação e Estrutura\" — as 3 categorias (Fundação Profunda/Estacas roxo, Fundação laranja, Estrutura amarelo) aparecem como barras coloridas lado a lado dentro do mesmo andar, em vez de 3 gráficos separados.",
        "Ordem dos andares agora usa EXATAMENTE a lista configurada no Controle de Concreto (tela de arrastar) — sem recalcular ou reordenar por número; é a mesma lista, na mesma ordem."
      ]
    },
    {
      "versao": "V3.3.17.2",
      "legado": "V2.59.31",
      "status": "fechada",
      "data": "2026-08-03",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Concreto: Inserir PDF por concretagem (movido pro Controle de Concreto na V2.59.32)",
      "itens": [
        "Levantamento de Concreto → Concretagens → Editar/Excluir ganhou \"📎 Inserir PDF desta concretagem\" — guarda o PDF de verdade no Firebase Storage (não rasteriza, mantém todas as páginas e o zoom nativo do PDF)."
      ]
    },
    {
      "versao": "V3.3.18",
      "legado": "V2.59.32",
      "status": "fechada",
      "data": "2026-08-03",
      "tipo": "correcao",
      "titulo": "Dashboard: cada categoria do gráfico Fundação e Estrutura busca o PDF do lugar certo — Estaca/Fundação do Controle de Estacas, Estrutura do Controle de Concreto",
      "itens": [
        "Fundação Profunda (Estacas) e Fundação: clique na barra abre a prancha (PDF/imagem) do Controle de Estacas e Fundações vinculada às peças daquele andar — é de lá que vem o projeto dessas duas categorias.",
        "Estrutura: clique na barra abre o PDF anexado na concretagem (Controle de Concreto → Lançar BT → 📎 Inserir PDF desta concretagem, botão movido do Levantamento de Concreto pra cá, no nível certo). Um andar com várias concretagens mostra menu pra escolher.",
        "O \"Inserir PDF\" que estava no Levantamento de Concreto (V2.59.31) foi removido de lá — o lugar certo, confirmado, é dentro do Controle de Concreto/Lançar BT, selecionando a concretagem."
      ]
    },
    {
      "versao": "V3.3.18.1",
      "legado": "V2.59.33",
      "status": "fechada",
      "data": "2026-08-03",
      "tipo": "melhoria",
      "titulo": "Dashboard: clique no gráfico Fundação e Estrutura abre o projeto num popup em tela cheia, sem navegar para outra tela",
      "itens": [
        "Antes o clique navegava pro Controle de Estacas ou abria o PDF em nova aba. Agora abre direto num popup em tela cheia sobre o próprio Dashboard — Estrutura mostra o PDF de verdade (com todas as páginas e zoom nativo); Estaca/Fundação mostra a imagem da prancha na mesma qualidade que aparece no Controle de Estacas.",
        "Andar com mais de um item (várias concretagens, ou peças espalhadas em mais de uma prancha) navega entre eles com as setas dentro do próprio popup — não abre várias telas."
      ]
    },
    {
      "versao": "V3.3.19",
      "legado": "V2.59.34",
      "status": "fechada",
      "data": "2026-08-03",
      "tipo": "correcao",
      "titulo": "Dashboard: popup de Estaca/Fundação mostrava a imagem crua (sem bolinhas) e sem zoom",
      "itens": [
        "Agora desenha os marcadores (bolinhas coloridas por status) por cima da imagem da prancha, igual ao Controle de Estacas — só as peças daquele andar que já estão EM EXECUÇÃO (% concretado > 0), pra ficar limpo em vez de mostrar a prancha inteira.",
        "Zoom de verdade: botões +/− visíveis e roda do mouse (sem precisar de Ctrl, já que é uma tela dedicada) — de 30% a 400%."
      ]
    },
    {
      "versao": "V3.3.20",
      "legado": "V2.59.35",
      "status": "fechada",
      "data": "2026-08-03",
      "tipo": "correcao",
      "titulo": "Dashboard: gráfico Fundação e Estrutura saía de ordem mesmo com a lista certa configurada + visual melhorado",
      "itens": [
        "Causa real da ordem errada: pequenas diferenças de grafia entre o nome do andar salvo na peça e o nome salvo na lista configurada (ex: acento, maiúscula, espaço) faziam o andar \"não bater\" e cair fora de ordem, no final. Comparação agora usa o mesmo normalizador de nome de andar (CC.normalizarAndar) já usado no resto do sistema — tolerante a essas diferenças.",
        "Cores fortes e vivas (roxo/laranja/azul) em vez de opacidade baixa — Previsto agora é contorno colorido com fundo branco (não mais \"lavado\"), Executado é preenchimento sólido.",
        "Linha separadora vertical + faixa de fundo alternada (zebra) entre cada andar, pra ficar claro onde um grupo de barras termina e o outro começa."
      ]
    },
    {
      "versao": "V3.3.20.1",
      "legado": "V2.59.36",
      "status": "fechada",
      "data": "2026-08-03",
      "tipo": "melhoria",
      "titulo": "Dashboard: gráfico Fundação e Estrutura sem scroll horizontal, barras compactas, linha guia no rótulo, texto \"Estacas\"/\"Fundação\" na própria barra",
      "itens": [
        "Removido o scroll lateral — largura fixa e barras estreitas o suficiente pra caber TODOS os andares na mesma tela de uma vez, sem precisar arrastar.",
        "Cada andar mostra só as categorias que de fato têm peça ali (a maioria só tem Estrutura — 2 barrinhas; só Fundação/Térreo costuma ter Estaca+Fundação juntas — até 3 categorias/6 barrinhas).",
        "Linha guia vertical entre o eixo e o rótulo do andar — resolve a ambiguidade de \"essa barra é de qual andar\" quando o texto inclinado ficava entre dois nomes.",
        "Quando o andar tem mais de uma categoria (ex: Fundação com Estaca+Fundação), cada par de barras ganha um texto vertical \"Estacas\"/\"Fundação\"/\"Estrutura\" escrito dentro da própria barra, com contorno da cor da categoria — não precisa mais adivinhar pela cor sozinha."
      ]
    },
    {
      "versao": "V3.3.20.2",
      "legado": "V2.59.37",
      "status": "fechada",
      "data": "2026-08-03",
      "tipo": "melhoria",
      "titulo": "Dashboard: gráfico Fundação e Estrutura volta a usar só tons de amarelo (identidade única) em vez de roxo/laranja/azul",
      "itens": [
        "Estrutura = amarelo oficial da empresa (#F5C800); Fundação e Estacas = tons de amarelo mais escuros — as 3 categorias ficam na mesma família de cor, sem parecer \"gráfico colorido\".",
        "Executado agora é sempre preto/cinza escuro nas 3 categorias — a cor (tom de amarelo) identifica a CATEGORIA, o preto identifica que aquele volume já foi executado. Previsto continua como contorno no tom da categoria, com fundo branco."
      ]
    },
    {
      "versao": "V3.3.21",
      "legado": "V2.59.38",
      "status": "fechada",
      "data": "2026-08-03",
      "tipo": "correcao",
      "titulo": "Dashboard: gráfico Fundação e Estrutura parou de carregar (\"Erro ao carregar dados do Controle de Concreto\")",
      "itens": [
        "Bug introduzido numa limpeza de código anterior: a variável CC (ConcretoCalculos) usada pra ordenar os andares por nome normalizado tinha sido removida sem querer, causando erro em toda tentativa de carregar o gráfico. Restaurada."
      ]
    },
    {
      "versao": "V3.3.22",
      "legado": "V2.59.39",
      "status": "fechada",
      "data": "2026-08-03",
      "tipo": "correcao",
      "titulo": "Dashboard: andar com peça de Fundação de verdade (volume > 0 confirmado no Levantamento) não aparecia no gráfico",
      "itens": [
        "O cálculo do gráfico usava Number(p.volume) puro, que retorna NaN se o volume estiver salvo em formato de vírgula decimal (\"150,5\") — e NaN||0 some silenciosamente como zero, fazendo o andar inteiro desaparecer do gráfico mesmo com peça e volume reais. Trocado por CC.num(), a mesma função (tolerante a vírgula) já usada em todo o resto do sistema.",
        "Sem acesso ao dado real da obra pra confirmar 100% que essa era a causa exata — é a explicação técnica mais sólida encontrada; se o problema persistir, precisa de acesso ao Firestore ou ao DevTools do navegador pra investigar a fundo."
      ]
    },
    {
      "versao": "V3.3.23",
      "legado": "V2.59.40",
      "status": "fechada",
      "data": "2026-08-03",
      "tipo": "correcao",
      "titulo": "Dashboard: erro no gráfico Fundação e Estrutura continuava mesmo depois do fix da V2.59.39 — mensagem de erro real agora aparece na tela",
      "itens": [
        "Não foi possível confirmar/reproduzir a causa exata sem acesso ao Firestore ou ao console do navegador. A tela de erro agora mostra o texto técnico exato da exceção (não só \"Erro ao carregar...\"), pra dar o próximo passo real do diagnóstico direto pela tela, sem precisar abrir o DevTools."
      ]
    },
    {
      "versao": "V3.3.24",
      "legado": "V2.59.41",
      "status": "fechada",
      "data": "2026-08-03",
      "tipo": "correcao",
      "titulo": "Dashboard: erro real identificado — \"Cannot read properties of undefined (reading 'num')\" — CC (ConcretoCalculos) indisponível no momento do cálculo",
      "itens": [
        "O gráfico dependia de window.ConcretoCalculos estar carregado no exato momento do cálculo — se por qualquer motivo (cache de CDN desalinhado entre deploys, timing) isso não estivesse disponível, a leitura de CC.num() quebrava o gráfico inteiro.",
        "Criada uma função de conversão numérica local, com o mesmo comportamento (tolera vírgula decimal), que NUNCA depende de CC estar disponível — o gráfico não quebra mais por esse motivo, independente da causa raiz de CC ter ficado indisponível."
      ]
    },
    {
      "versao": "V3.3.24.1",
      "legado": "V2.60.0",
      "status": "fechada",
      "data": "2026-08-05",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Fachada — Visão Geral: zoom/pan no mapa e filtro Externa/Interna nas caixas",
      "itens": [
        "Zoom e movimentação (pan) no mapa da Visão Geral — igual aos outros módulos: roda do mouse para zoom (centrado no cursor), arrastar para mover, botões ➖/100%/➕.",
        "Novo seletor \"Vista: Externa / Interna\" — cada botão liga/desliga independente. Os dois ativos = total combinado (comportamento de antes). Só um ativo = caixas e Total Geral mostram só aquela vista."
      ]
    },
    {
      "versao": "V3.3.24.2",
      "legado": "V2.60.1",
      "status": "fechada",
      "data": "2026-08-05",
      "tipo": "melhoria",
      "titulo": "Levantamento de Fachada — Visão Geral: botão para travar o zoom/movimentação do mapa",
      "itens": [
        "🔓 Travar Zoom / 🔒 Travado na barra do mapa: enquanto travado, roda do mouse e arrastar não alteram mais o zoom/posição — evita mexer sem querer depois de ajustar do jeito que quer."
      ]
    },
    {
      "versao": "V3.3.24.3",
      "legado": "V2.60.3",
      "status": "fechada",
      "data": "2026-08-05",
      "tipo": "funcionalidade",
      "titulo": "Planejamento: novo botão \"🔒 Liberar Edição de Real\" — permite editar Início Real e Término Real direto na tabela, quando liberado",
      "itens": [
        "Início Real/Término Real são normalmente só leitura no Planejamento (a fonte de verdade é Diário de Obra, Medições ou Semanal) — travado assim de propósito, pra não editar por engano.",
        "Pra correções em massa pontuais (ex: atualizar a base sem gerar relatório/lançamento), clique em \"🔒 Liberar Edição de Real\" — as duas colunas ficam editáveis direto na célula, igual Início/Término Planejado. Clique de novo pra travar."
      ]
    },
    {
      "versao": "V3.3.24.4",
      "legado": "V2.60.4",
      "status": "fechada",
      "data": "2026-08-05",
      "tipo": "melhoria",
      "titulo": "Planejamento: botão \"Liberar Edição de Real\" movido pra dentro do menu ⚙ Ferramentas — estava solto na barra principal",
      "itens": [
        "Menos um botão poluindo a barra de cima; mesma função, agora dentro do menu Ferramentas."
      ]
    },
    {
      "versao": "V3.3.25",
      "legado": "V2.60.5",
      "status": "fechada",
      "data": "2026-08-05",
      "tipo": "correcao",
      "titulo": "BUG CRÍTICO: salvar o % de um grupo com valor desatualizado sobrescrevia o % de TODOS os descendentes em silêncio — provável causa de \"todas as tarefas com 27%\"",
      "itens": [
        "Editar o % Concluído de uma tarefa-pai (via célula ou modal) distribui esse valor pra todos os descendentes — funcionalidade existente, correta quando intencional. O problema: isso rodava sem nenhum aviso, e se o valor no formulário/célula estivesse desatualizado (ex: formulário aberto antes de um recálculo de %), salvar sobrescrevia silenciosamente o % de centenas de tarefas de uma vez, apagando progresso real de todo mundo.",
        "Corrigido: agora, se a tarefa tiver mais de 3 descendentes, pede confirmação explícita ANTES de aplicar qualquer coisa — mostra quantas tarefas serão afetadas e o valor que vai ser aplicado. Cancelar não salva nada, nem localmente.",
        "Vale tanto pra edição na célula da tabela quanto pelo formulário grande de editar tarefa."
      ]
    },
    {
      "versao": "V3.3.26",
      "legado": "V2.60.6",
      "status": "fechada",
      "data": "2026-08-05",
      "tipo": "correcao",
      "titulo": "CORREÇÃO DE RUMO: % das tarefas-pai voltou a ser RECURSIVO nível por nível (média dos filhos DIRETOS), igual MS Project — a V2.58.21/V2.60.2 tinha trocado pro método errado",
      "itens": [
        "O Milton mostrou o comportamento correto do MS Project com um exemplo real: cada pai é a média ponderada (por duração) só dos filhos DIRETOS dele — e cada filho, recursivamente, é a média dos PRÓPRIOS filhos diretos, nível por nível. Isso é o padrão profissional de gestão de projetos.",
        "A V2.58.21 tinha trocado isso por um cálculo \"achatado\" (ponderar direto por todas as folhas, ignorando os níveis intermediários) achando que estava corrigindo uma divergência com o Dashboard — só que essa mudança estava errada. Revertido pro método recursivo, confirmado batendo exatamente com o exemplo do Milton (níveis 3→2→1→0: 100%+50%→75%; 75%+100%→87,5%; 87,5%+100%→93,75%).",
        "O mais importante: agora, TODA vez que a estrutura muda no Editor de Estrutura (mover, inserir, excluir tarefa, subir/descer nível, importar) o % de TODOS os pais afetados é recalculado automaticamente e salvo — antes, mover uma tarefa entre níveis não atualizava o % de ninguém, ficava desatualizado até alguém editar manualmente.",
        "Novo botão ⚙ Ferramentas → \"📊 Recalcular % dos Pais\" pra rodar manualmente em qualquer obra que ainda esteja com % desatualizado por esses bugs."
      ]
    },
    {
      "versao": "V3.3.26.1",
      "legado": "V2.60.7",
      "status": "fechada",
      "data": "2026-08-06",
      "tipo": "melhoria",
      "titulo": "Importar Correções: quando o Nome é ambíguo (duplicado), tenta desambiguar automaticamente pelo Código antes de desistir",
      "itens": [
        "Antes, qualquer nome duplicado na obra (ex: mesma tarefa repetida em dois ramos, tipo \"Hall\" com códigos 1.3.6.x e 1.3.4.x) caía direto em \"ambígua\" e ficava fora do import — mesmo quando o Código bastava pra saber exatamente qual era qual.",
        "Agora, se o nome bate em mais de uma tarefa, verifica se o Código da linha da planilha bate com o Código de exatamente uma delas — só cai em \"ambígua\" de verdade se nem o código resolver (ex: grupos criados manualmente sem código). Testado numa obra real: resolveu 61 de 70 casos que antes ficavam de fora."
      ]
    },
    {
      "versao": "V3.3.27",
      "legado": "V2.60.8",
      "status": "fechada",
      "data": "2026-08-06",
      "tipo": "correcao",
      "titulo": "CORREÇÃO IMPORTANTE: % geral da obra vinha inflado — o peso de um grupo na média do pai usava a duração PRÓPRIA dele, que fica vazia/0 em grupos criados manualmente no Editor de Estrutura",
      "itens": [
        "Achado com um caso real: o Milton criou grupos organizacionais (ex: \"Concretagens\", \"Hall\", \"Gesso e Forro\", \"Pintura\") pra agrupar tarefas já existentes, sem mudar nenhum trabalho real. Só que o % da obra subiu de ~16% (base oficial da Cofield) pra 39% na nossa — mesma obra, mesmo trabalho, só a estrutura organizada diferente.",
        "Causa: um grupo criado assim fica com \"Duração\" própria vazia (0) — e a fórmula de % usava exatamente essa duração como peso do grupo na média do PAI dele. Um grupo com 500+ dias de trabalho real lá dentro contava como peso 1 (quase zero) — o efeito prático é que trabalho ainda não iniciado, quando \"escondido\" dentro de um grupo assim, quase não pesava na conta, inflando o % geral pra cima.",
        "Corrigido: o peso de qualquer tarefa na média agora é sempre a SOMA REAL da duração de tudo que tem dentro dela (calculado recursivamente, folha por folha) — nunca mais a duração própria de um grupo, que pode estar errada/vazia sem afetar o resultado. Testado com os dados reais da obra: o % da raiz caiu de 39,3% pra 14,64%, muito mais alinhado com os 16% da Cofield.",
        "Rode ⚙ Ferramentas → \"📊 Recalcular % dos Pais\" pra aplicar a correção na obra atual."
      ]
    },
    {
      "versao": "V3.3.27.1",
      "legado": "V2.60.9",
      "status": "fechada",
      "data": "2026-08-06",
      "tipo": "melhoria",
      "titulo": "Duração das tarefas-pai também passou a ser calculada automaticamente — não fica mais vazia/0",
      "itens": [
        "Igual início/término, a Duração de uma tarefa-pai agora é calculada automaticamente (dias corridos entre o início e o término agregados dos filhos) sempre que a estrutura muda — mesmo gatilho do \"📐 Recalcular Datas dos Pais\".",
        "Grupos criados manualmente no Editor de Estrutura (que antes ficavam com Duração vazia pra sempre) passam a ter um valor real, condizente com o que tem dentro deles."
      ]
    },
    {
      "versao": "V3.3.28",
      "legado": "V2.60.10",
      "status": "fechada",
      "data": "2026-08-06",
      "tipo": "correcao",
      "titulo": "Removido da coluna % Concluído o ícone de vincular a Estacas/Fundações — não deveria estar ali (pedido do Milton)",
      "itens": [
        "Aparecia em TODA tarefa, mesmo sem nenhuma relação com fundação/estaca (ex: \"Prumadas Esgoto\") — voltou a ser uma célula de % simples, editável normalmente. O vínculo de tarefas já existentes com Estacas/Fundações continua salvo no banco, só não aparece mais aqui."
      ]
    },
    {
      "versao": "V3.4.0",
      "legado": "V2.60.11",
      "status": "fechada",
      "data": "2026-08-06",
      "tipo": "funcionalidade",
      "titulo": "Novo: Estrutura da Obra (Torre → Pavimento → Apto) + vínculo por tarefa — independente dos módulos de Levantamento",
      "itens": [
        "Botão \"🏢 Estrutura da Obra\" na toolbar do Planejamento: cadastra Torres, Pavimentos e Apartamentos/Unidades (nome + ordem, editável, com exclusão avisando se alguma tarefa já está vinculada).",
        "Nova coluna \"Local (Pav/Apto)\" na tabela — clicável, abre um picker pra marcar um pavimento inteiro (vale pra todos os aptos dele) ou apto(s) específico(s). Mostra resumo curto na célula (ex: \"1º Pav (todos)\" ou \"1º Pav: 101, 102\").",
        "Guardado em obras/{obra}/config/estruturaObra (nova, isolada) e no campo vinculoEstrutura de cada tarefa — não migra nem toca em pisoArvore/tetoArvore/paredesArvore, que continuam servindo só os módulos de Levantamento.",
        "Vínculo \"órfão\" (referenciando um pavimento/apto que foi excluído depois) aparece com aviso visual em vermelho na célula, em vez de quebrar silenciosamente."
      ]
    },
    {
      "versao": "V3.4.1",
      "legado": "V2.60.12",
      "status": "fechada",
      "data": "2026-08-06",
      "tipo": "correcao",
      "titulo": "Dashboard: volume de Fundação aparecia menor do que o real em obras com grafia inconsistente do nome do andar (° em vez de º)",
      "itens": [
        "Peças com \"2° Subsolo\" (símbolo de grau) e \"2º Subsolo\" (ordinal correto) eram tratadas como DOIS andares diferentes em qualquer soma — cada grafia virava uma barra própria, com só parte do volume real. CC.normalizarAndar (usado em todo o sistema) agora unifica esse caso.",
        "Gráfico Fundação e Estrutura: soma por andar agora agrupa por nome NORMALIZADO, deduplicando grafias equivalentes antes de montar as barras — não só na ordenação (como já era desde a V2.59.35), também no cálculo do valor.",
        "Visual: Previsto virou preenchimento sólido no tom claro da categoria (não mais contorno vazio) — pedido explícito de \"quero colorido forte, não branco com borda\"."
      ]
    },
    {
      "versao": "V3.4.1.1",
      "legado": "V2.60.13",
      "status": "fechada",
      "data": "2026-08-06",
      "tipo": "funcionalidade",
      "titulo": "Novo: Painel de Andamento no Dashboard (tarefas-mãe × Pavimento/Apartamento)",
      "itens": [
        "Nova tabela no Dashboard: cada linha é uma tarefa-mãe (grupo) escolhida pelo usuário em \"⚙️ Configurar\", cada coluna é um Pavimento ou Apartamento (toggle no topo) — usa a Estrutura da Obra (Torre/Pavimento/Apto) e o vínculo por tarefa já publicados no Planejamento.",
        "Célula mostra % agregado (peso por duração, mesma regra do resto do sistema) com cor de fundo por faixa de progresso (vermelho até 30%, amarelo até 70%, verde daí — ajustável no código) e borda por status (azul em andamento, verde sólida finalizada, cinza tracejada pausada).",
        "Pavimento vinculado \"inteiro\" (sem apto específico) conta em TODAS as colunas de apartamento daquele pavimento no modo Por Apartamento, além de na própria coluna do pavimento no modo Por Pavimento.",
        "Clique na célula abre o detalhamento: quais tarefas específicas compõem aquele número, com % individual e duração (peso) de cada uma.",
        "Configuração (quais tarefas-mãe aparecem) salva em config/dashboardPainel — lista qualquer grupo de qualquer nível do Planejamento, não só o nível mais alto."
      ]
    },
    {
      "versao": "V3.4.1.2",
      "legado": "V2.60.15",
      "status": "fechada",
      "data": "2026-08-06",
      "tipo": "funcionalidade",
      "titulo": "Novo: Atualização Rápida de Predecessora/% com log obrigatório de motivo — histórico de alterações consultável",
      "itens": [
        "Ícone \"🔗\" na coluna de ações de cada tarefa: abre modal pra trocar predecessora e/ou % concluído sem editar direto na grid, exigindo o MOTIVO da mudança (info que hoje só existe verbalmente, na conversa com o encarregado).",
        "Predecessora nova é validada com o mesmo parser já usado na célula — formato inválido não deixa salvar.",
        "Salvar dispara o MESMO recálculo automático de datas/sucessoras/% dos pais que já existe hoje (nada de novo ali) — só acrescenta o registro do motivo.",
        "Novo botão ⚙ Ferramentas → \"📋 Histórico de Alterações\": lista todos os registros da obra (mais recente primeiro), com filtro por tarefa e por usuário. Somente leitura.",
        "Guardado em obras/{obra}/logAlteracoes — coleção nova, isolada."
      ]
    },
    {
      "versao": "V3.4.1.3",
      "legado": "V2.60.16",
      "status": "fechada",
      "data": "2026-08-06",
      "tipo": "funcionalidade",
      "titulo": "Novo: filtro \"👷 Ver por Responsável\" no Planejamento",
      "itens": [
        "Botão na toolbar abre lista de responsáveis distintos já usados na obra (sem duplicados/vazios) — selecionar um filtra a grid instantaneamente, \"Todos\" limpa o filtro.",
        "Combina com os filtros já existentes (status, busca) — é mais uma condição, não substitui nenhum.",
        "Preferência fica só no navegador (localStorage, cache de sessão) — não grava nada novo no Firestore, nem usa campo novo (lê o \"Responsável\" que já existe em cada tarefa)."
      ]
    },
    {
      "versao": "V3.4.1.4",
      "legado": "V2.60.17",
      "status": "fechada",
      "data": "2026-08-06",
      "tipo": "melhoria",
      "titulo": "Estrutura da Obra: botão \"📋 duplicar\" em cada pavimento — copia o pavimento inteiro com os apartamentos dele",
      "itens": [
        "Útil pra torres com andares repetidos (mesmo layout de apto do 1º ao 15º, por exemplo): duplica o pavimento e todos os apartamentos dele de uma vez, com IDs novos (nunca reaproveita ID de outro nó — evitaria vínculo ambíguo entre original e cópia). Só precisa editar o nome depois."
      ]
    },
    {
      "versao": "V3.4.1.5",
      "legado": "V2.60.18",
      "status": "fechada",
      "data": "2026-08-06",
      "tipo": "melhoria",
      "titulo": "Toolbar do Planejamento organizada: \"Estrutura da Obra\" e \"Ver por Responsável\" movidos pra dentro de ⚙ Ferramentas — e o menu inteiro agora fica em ordem alfabética",
      "itens": [
        "Toolbar principal menos poluída — só ficam os botões mais usados no dia a dia. As duas funções continuam idênticas, só mudaram de lugar.",
        "Menu Ferramentas reorganizado pra ordem alfabética (Corrigir Níveis Soltos → Corrigir Ordens → Corrigir Predecessoras → Estrutura da Obra → Exportar → Histórico → Importar → Importar Base Completa → Importar Correções → Liberar Edição de Real → PNG → Recalcular % → Recalcular Datas → Ver por Responsável → Vínculos com Levantamento) — adicionar item novo no futuro entra na ordem certa automaticamente."
      ]
    },
    {
      "versao": "V3.4.1.6",
      "legado": "V2.60.19",
      "status": "fechada",
      "data": "2026-08-06",
      "tipo": "funcionalidade",
      "titulo": "Novo: Auto-vincular por Nome — detecta o pavimento/apto de cada tarefa automaticamente, sem clicar tarefa por tarefa",
      "itens": [
        "Menu ⚙ Ferramentas → \"🔗 Auto-vincular por Nome\": compara o NOME de cada tarefa-folha com os nomes já cadastrados em Estrutura da Obra (ex: tarefa \"Contrapiso: 1º Pavimento - Final 02\" casa com o pavimento \"1º Pavimento\" e o apto \"Final 02\", se ambos estiverem cadastrados lá) e propõe o vínculo automaticamente — sem precisar abrir a coluna Local tarefa por tarefa.",
        "Sempre mostra uma PRÉVIA antes de aplicar: lista cada tarefa com o local detectado, com checkbox pra desmarcar as que estiverem erradas, e aviso visual em quem já tinha vínculo manual (será sobrescrito se ficar marcado). Nada é gravado sem confirmar.",
        "Funciona com qualquer padrão de nome que a obra já usa — não é regex de formato fixo, é busca pelo nome real do pavimento/apto (já cadastrado) dentro do nome da tarefa. Pavimento sem apto correspondente no nome vincula \"o pavimento inteiro\"."
      ]
    },
    {
      "versao": "V3.4.1.7",
      "legado": "V2.60.20",
      "status": "fechada",
      "data": "2026-08-06",
      "tipo": "melhoria",
      "titulo": "Dashboard: tela \"⚙️ Configurar\" do Painel de Andamento virou árvore expansível com busca (era lista plana de todos os níveis misturados)",
      "itens": [
        "A lista antiga mostrava TODOS os grupos, de TODOS os níveis, achatados numa lista só — difícil de escanear e entender qual tarefa era filha de qual em obras com muita hierarquia.",
        "Agora é uma árvore igual ao Editor de Estrutura do Planejamento: começa fechada nas raízes, clica pra abrir/fechar cada grupo, e marca a tarefa-mãe em QUALQUER nível — nível 0, 1, 2, o que precisar em cada obra.",
        "Campo de busca por nome: com texto digitado, mostra direto os grupos que batem (sem precisar abrir a árvore manualmente até achar); campo vazio volta pra árvore normal."
      ]
    },
    {
      "versao": "V3.4.1.8",
      "legado": "V2.60.21",
      "status": "fechada",
      "data": "2026-08-06",
      "tipo": "funcionalidade",
      "titulo": "Controle de Estacas: Acompanhamento agora lança BT de verdade (igual Controle de Concreto), toque em tablet, e visual/resumo melhorados",
      "itens": [
        "Removido o sistema de \"BT única auto-gerenciada\" por concretagem — não fazia sentido (uma concretagem real pode ter várias BTs/caminhões, cada um com seu próprio volume).",
        "Novo: dentro do Acompanhamento, \"🚚 BTs desta concretagem\" — cria uma BT (número + volume previsto), e lança o % de CADA estaca/fundação da programação que aquela BT concretou (com NF, código, hora, sobra, perda, cocho — os mesmos campos do Controle de Concreto). Grava concretoLancamentos de verdade, aparece sincronizado no Controle de Concreto também.",
        "Visual: estaca 100% concretada agora fica com preenchimento sólido/opaco (antes era sempre translúcido, mesmo pronta, parecia \"fraca\"). O anel amarelo de \"planejada, pendente\" some assim que chega em 100%.",
        "Novo painel \"Estacas da obra — visão geral\" no Acompanhamento: total de estacas cadastradas, volume executado da obra inteira, % geral, e tabela por diâmetro (qtd. feita/total, volume feito/total, % de cada tipo).",
        "Zoom/pan por toque (tablet/celular): pinça com 2 dedos dá zoom, 1 dedo arrasta o mapa — antes só funcionava com mouse (Ctrl+roda/Ctrl+arrastar)."
      ]
    },
    {
      "versao": "V3.4.2",
      "legado": "V2.60.22",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "correcao",
      "titulo": "Planejamento: editar Início na tabela não recalculava o Término (deixava a Duração em branco) — a regra estava na ordem errada em relação ao MS Project",
      "itens": [
        "Causa: editar Início tentava calcular a DURAÇÃO (mantendo o Término fixo) — mas se o Término ainda estivesse vazio (comum em tarefa nova ou recém-importada), a condição falhava e nada era recalculado, deixando a Duração em \"—\".",
        "Corrigido pra bater com a convenção do MS Project: editar Início MANTÉM a Duração e recalcula o Término; editar Término MANTÉM o Início e recalcula a Duração; editar Duração MANTÉM o Início e recalcula o Término. Exatamente como pedido.",
        "Fallback mantido só pra quando a tarefa ainda não tem Duração salva (aí sim calcula a Duração a partir do Término existente, uma única vez, pra não deixar tudo em branco na primeira vez)."
      ]
    },
    {
      "versao": "V3.4.2.1",
      "legado": "V2.60.23",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "melhoria",
      "titulo": "Controle de Estacas: lançar BT vira seletor de peças (não lista fixa) + excluir BT",
      "itens": [
        "Lançar BT não mostra mais uma lista fixa com TODAS as peças da concretagem — agora é um seletor: escolhe a peça, o %, e \"+ Peça\" pra adicionar mais uma linha, se a BT concretou mais de uma. Igual ao Controle de Concreto.",
        "Botão \"🗑 Excluir BT\" — pra quando adicionar uma BT errada. Remove a BT e os lançamentos dela (confirma antes).",
        "Botão \"✓ Add. pendentes 100%\" agora adiciona uma linha nova pra cada peça pendente da concretagem (sem duplicar as que já estão nas linhas), em vez de forçar 100% numa lista fixa.",
        "Peça já lançada em outra BT desta concretagem aparece marcada no seletor, pra não escolher a mesma por engano."
      ]
    },
    {
      "versao": "V3.4.2.2",
      "legado": "V2.60.24",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "melhoria",
      "titulo": "Controle de Estacas: Acompanhamento inverte o fluxo — agora é por ESTACA (BTs que a fizeram), não por BT",
      "itens": [
        "Antes: selecionava a BT e informava o % de cada peça que ela concretou (difícil de saber em campo — o % da peça é praticamente impossível de estimar olhando pra estaca).",
        "Agora: seleciona a ESTACA/FUNDAÇÃO, e informa quais BTs contribuíram nela e quanto % de CADA BT foi usado ali (ex: 100% da BT-1, 100% da BT-2, 40% da BT-3) — muito mais fácil de responder olhando pro caminhão, não pra peça.",
        "Por trás, os dados continuam salvos e somados exatamente igual — o % e volume gravados no lançamento são calculados a partir do %-da-BT informado, então o Controle de Concreto e todo o resto do sistema batem igual, só a forma de PERGUNTAR mudou.",
        "BTs agora têm edição própria (✎) pra ajustar número, volume previsto, NF, código, sobra, perda e cocho depois de criadas — esses dados são do caminhão inteiro, então valem pra todas as peças que ele concretou."
      ]
    },
    {
      "versao": "V3.4.2.3",
      "legado": "V2.60.25",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "melhoria",
      "titulo": "Controle de Estacas: Acompanhamento em popups — menu de cima parou de tampar o mapa",
      "itens": [
        "A lista de BTs + \"Lançar por Estaca/Fundação\" ficavam sempre abertos em cima do mapa, empurrando o desenho pra baixo (pior ainda na tela cheia). Virou botão único \"🚚 N BTs nesta concretagem\", que abre um popup só pra gerenciar as BTs.",
        "Removido o seletor \"Selecione a peça\" — agora é só clicar na estaca/fundação no mapa (a mesma que já fica com o anel amarelo, planejada nesta concretagem) que abre o popup de lançar, com o nome dela já no título.",
        "O mapa agora ocupa quase toda a tela — só o essencial (seletor de concretagem + botão de BTs + legenda) fica em cima."
      ]
    },
    {
      "versao": "V3.4.2.4",
      "legado": "V2.60.26",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "melhoria",
      "titulo": "Controle de Estacas: Acompanhamento ganha volume total/executado (projeto)/executado real (BTs)/índice de perda",
      "itens": [
        "Novos 4 cartões na concretagem selecionada: Volume total (o que o projeto precisa), Executado (projeto) — capado em 100% por peça, não conta excesso —, Executado real (BTs) — soma bruta do que as BTs entregaram, sem capar, mostra se sobrou/faltou além do previsto —, e Índice de perda — (sobra + perda em obra + perda cocho) das BTs usadas, dividido pelo volume previsto delas.",
        "Índice de perda acima de 5% pinta o cartão laranja, pra chamar atenção."
      ]
    },
    {
      "versao": "V3.4.3",
      "legado": "V2.60.27",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: menos espaço vazio no topo da tela cheia",
      "itens": [
        "O botão \"Fechar tela cheia\" ocupava uma linha inteira sozinho, empurrando o resto pra baixo — agora flutua no canto superior direito (sem reservar espaço na fila normal), então as abas Marcadores/Planejamento/Acompanhamento começam bem mais perto do topo."
      ]
    },
    {
      "versao": "V3.4.3.1",
      "legado": "V2.60.28",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "melhoria",
      "titulo": "Controle de Estacas: aviso de BT já alocada + Controle de Concreto entende perda de solo das estacas",
      "itens": [
        "Popup de lançar por estaca: o seletor de BT agora mostra \"(X% em outras peças)\" quando essa BT já foi usada noutra peça, e o campo de % avisa em vermelho se o valor digitado passar de 100% da BT.",
        "Controle de Concreto: peças com subtipo Estacas que lançam mais volume real do que o projeto previa NÃO entram mais no aviso vermelho \"corrija esses lançamentos\" — é normal em estaca, o furo real costuma sair maior que o calculado (perda de solo). Agora aparece numa seção informativa separada (azul), explicando que não precisa corrigir.",
        "Volume Executado de Projeto continua igual — capado em 100% de cada peça, então esse excesso não infla o % de conclusão."
      ]
    },
    {
      "versao": "V3.4.4",
      "legado": "V2.60.29",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "correcao",
      "titulo": "Controle de Concreto: índice de perda agora conta a perda de solo das estacas — antes ficava 0% mesmo sobrando tudo no solo",
      "itens": [
        "Bug real: quando todas as BTs de uma concretagem eram 100% usadas (sem sobrar nada na betoneira), o índice de perda dava 0% mesmo se as estacas tivessem consumido bem mais concreto que o projeto — a perda \"foi\" pro solo, não pra betoneira, e o cálculo só olhava pra betoneira.",
        "Corrigido: perda de solo (peça de subtipo Estacas que lançou mais real do que o projeto) agora entra na conta do índice de perda geral, junto com sobra de caminhão e perda em obra — tanto na tela principal quanto no Relatório.",
        "Lista peça-por-peça da perda de solo agora vem recolhida por padrão (clique pra expandir) — só o resumo (quantas estacas, quantos m³) aparece direto, pra não ficar poluído quando tiver muitas estacas."
      ]
    },
    {
      "versao": "V3.4.4.1",
      "legado": "V2.60.30",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "melhoria",
      "titulo": "Controle de Estacas: botão pra minimizar o cabeçalho de controles nas 3 abas",
      "itens": [
        "Novo botão \"▲ Minimizar\" em Marcadores, Planejamento e Acompanhamento — esconde toggle Estacas/Fundações, legenda, seletores e girar/zoom, deixando só o mapa em foco. Zoom por Ctrl+roda ou pinça (toque) continua funcionando mesmo minimizado.",
        "Botão vira \"▼ Mostrar controles\" pra reabrir tudo de novo."
      ]
    },
    {
      "versao": "V3.4.5",
      "legado": "V2.60.31",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: índice de perda corrigido de novo (cálculo próprio, separado do Controle de Concreto) + Minimizar agora é bem mais agressivo",
      "itens": [
        "Achado o mesmo bug de índice de perda 0% de novo — só que numa conta DIFERENTE, a de dentro do próprio Controle de Estacas (os 4 cartões Volume total/Executado/Executado real/Índice de perda). Corrigida igual à do Controle de Concreto: a diferença entre o volume real (BTs) e o volume do projeto agora entra na conta.",
        "Botão \"Minimizar\" ficou bem mais agressivo: agora esconde TAMBÉM os cartões de resumo abaixo do mapa (Acompanhamento) e o painel de concretagens (Planejamento) — sobra só o mapa mesmo. Clicar numa estaca continua abrindo o popup de lançar normalmente.",
        "Mapa fica mais alto quando minimizado, aproveitando o espaço que sobrou — ainda mais generoso combinado com tela cheia."
      ]
    },
    {
      "versao": "V3.4.6",
      "legado": "V2.60.32",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "correcao",
      "titulo": "Dashboard: popup de Estaca/Fundação não abria mesmo com dado real cadastrado + gráfico feio com poucos andares + motor Solo Grampeado",
      "itens": [
        "Popup de Estaca/Fundação e de Estrutura (PDF de concretagem): mesmo bug de grafia (° vs º) do gráfico principal (V2.60.12) também afetava essas duas funções — corrigido; agora avisa por toast quando não encontra peça, em vez de sair em silêncio.",
        "Gráfico Fundação e Estrutura: largura agora se ajusta à quantidade real de andares em vez de fixa em 1180px — com poucos andares (ex: 1), o gráfico fica compacto em vez de uma barra isolada perdida num espaço vazio gigante.",
        "Rótulo \"Estacas\"/\"Fundação\"/\"Estrutura\" dentro da barra agora aparece SEMPRE (antes só aparecia quando havia mais de 1 categoria no mesmo andar) — nunca depende só da cor pra identificar o que é.",
        "\"Motor de cálculo de Solo Grampeado não carregado\": adicionado um pequeno retry (até 1s) antes de desistir, e mensagem mais clara sugerindo recarregar — não foi possível confirmar/reproduzir a causa raiz exata sem acesso à rede/console do navegador.",
        "Curva S mostrando só 1 mês mesmo com planejamento espalhado por vários meses: não foi possível confirmar a causa sem ver os dados reais das tarefas — pendente, precisa de mais informação pra corrigir com segurança."
      ]
    },
    {
      "versao": "V3.4.6.1",
      "legado": "V2.60.33",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "funcionalidade",
      "titulo": "Dashboard: Curva S com diagnóstico visível + novas Métricas de Estacas (obra inteira)",
      "itens": [
        "Curva S: quando aparecer com 1-2 meses só, agora mostra uma linha de diagnóstico com quantas tarefas-folha entraram no cálculo e o período de datas encontrado — ajuda a identificar se é dado real (poucas tarefas com data) ou algo que precisa ser preenchido no Planejamento (Início/Término Planejado das tarefas-folha, não só dos grupos).",
        "Novo bloco \"Métricas de Estacas (obra inteira)\" dentro do card Estacas e Fundações (mesmo checkbox \"Mostrar Contenção, Fundação e Estrutura\" de sempre): Total de estacas, Estacas feitas, Volume total (m³), Volume feito (m³), Índice de perda médio (mesma fórmula corrigida do Controle de Estacas na V2.60.31), Consumo médio por estaca.",
        "Tabela por tipo (Ø × comprimento): quantidade, feitas, volume projeto, volume real e consumo médio de cada tipo de estaca separadamente — mostra exatamente onde o consumo real está passando do previsto (ex: estaca prevista com 14m³ e consumindo 16-17m³ na prática)."
      ]
    },
    {
      "versao": "V3.4.6.2",
      "legado": "V2.60.34",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "funcionalidade",
      "titulo": "Dashboard: Painel de Andamento agora usa linhas com NOME PRÓPRIO, cada uma podendo juntar 2+ tarefas do Planejamento",
      "itens": [
        "Antes cada linha da tabela era 1 tarefa-mãe direto do Planejamento, com o nome exatamente igual ao de lá. Agora: cada linha tem um nome PRÓPRIO (fixo, editável) e uma lista de tarefas do Planejamento vinculadas a ela — útil quando o nome que se quer ver não bate com o nome da tarefa, ou quando é preciso somar 2+ tarefas numa linha só (ex: \"Instalações Hidráulicas\" = Distribuição + Prumadas).",
        "Tela de configuração reformulada: lista as linhas já criadas (nome editável + tags das tarefas vinculadas), botão \"+ Nova linha\", e um \"Vincular/Editar tarefas\" por linha que abre a mesma árvore navegável de antes, mas ligada só àquela linha.",
        "Linha sem nome ou sem nenhuma tarefa vinculada é ignorada ao salvar (não aparece vazia na tabela)."
      ]
    },
    {
      "versao": "V3.4.7",
      "legado": "V2.60.35",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "correcao",
      "titulo": "Dashboard: Curva S e Solo Grampeado sumindo sem erro — cada seção agora isolada, uma não trava mais as outras",
      "itens": [
        "Causa estrutural provável: as 9 seções do Dashboard (Hero, Atividades, Painel de Andamento, Solo Grampeado, Fundação e Estrutura, Estacas, Curva S, Resumo por Apartamento) compartilhavam um único try/catch em sequência — se qualquer uma lançasse uma exceção não tratada internamente, TODAS as seções seguintes na lista simplesmente não rodavam, sem nenhuma mensagem visível (só um toast genérico que passa rápido). Agora cada seção tem seu próprio try/catch isolado: uma falha não impede mais as outras de aparecer.",
        "Motor de cálculo de Solo Grampeado: retry aumentado (de 1s pra 2s) e, se ainda não carregar, tenta reinjetar o script automaticamente antes de desistir — cobre falha pontual de rede ao baixar o arquivo, não só timing."
      ]
    },
    {
      "versao": "V3.4.8",
      "legado": "V2.60.36",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "correcao",
      "titulo": "Dashboard: gráfico Fundação e Estrutura estava minúsculo e ilegível em obras com muitos andares",
      "itens": [
        "Erro na tentativa anterior de \"caber tudo sem scroll\": o SVG era espremido pra 100% da largura do card, então com 22 andares cada barra virava ~7px e as fontes ~5px na tela — impossível de ler.",
        "Agora cada andar tem largura FIXA de 112px e o gráfico é bem mais alto (460px): barras de 13px, valores em fonte 11px, nomes dos andares em 12px. Quando há muitos andares, o gráfico ganha scroll horizontal em vez de encolher tudo — melhor rolar do que não conseguir ler.",
        "Nome da categoria (Estacas/Fundação/Estrutura) dentro da barra só aparece quando a barra tem altura suficiente pro texto caber, evitando texto espremido/cortado nas barras pequenas."
      ]
    },
    {
      "versao": "V3.4.9",
      "legado": "V2.60.37",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "correcao",
      "titulo": "Dashboard: gráfico Fundação e Estrutura virava um bloco gigante em obra com poucos andares",
      "itens": [
        "A correção da V2.60.36 tinha uma largura mínima artificial de 700px — numa obra com 1 andar só (ex: Zenith Residence, só 2º Subsolo), a barra ficava esticada ocupando a tela inteira.",
        "Agora a largura total é proporcional ao conteúdo real (1 andar = gráfico estreito de ~190px; 22 andares = ~2.500px com scroll lateral) e a altura acompanha (300px com até 2 andares, 460px acima disso) — sem mínimo forçado nem bloco desproporcional."
      ]
    },
    {
      "versao": "V3.4.9.1",
      "legado": "V2.60.38",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "funcionalidade",
      "titulo": "Nova página de Diagnóstico — mostra na tela os dados que hoje só dava pra ver abrindo o console (F12)",
      "itens": [
        "Menu lateral → 🔍 Diagnóstico. Somente leitura, não grava nada. Mostra de uma vez: quais motores de cálculo carregaram (Solo Grampeado, Concreto, Estacas); quantas tarefas-folha têm data e qual o período real (causa da Curva S curta); quantas estacas têm lançamento vinculado e o % calculado de cada uma (causa do \"nada lançado\" ao clicar); os nomes EXATOS dos andares gravados nas peças, apontando quando o mesmo andar tem duas grafias diferentes (que dividia o volume em duas barras); e se a Estrutura da Obra e os vínculos de local estão preenchidos (causa do Painel de Andamento vazio).",
        "Feita pra resolver o problema de suporte: em vez de pedir print do console ou exportação do banco, basta abrir essa página e mandar um print — todos os dados de investigação aparecem juntos."
      ]
    },
    {
      "versao": "V3.4.10",
      "legado": "V2.60.39",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "correcao",
      "titulo": "CAUSA RAIZ encontrada: os motores de cálculo nunca ficavam disponíveis como window.X — origem de vários bugs do Dashboard de uma vez",
      "itens": [
        "O diagnóstico revelou que TODOS os motores apareciam como \"não carregado\" — inclusive Utils e Database, que obviamente estavam funcionando (a própria página leu 2.439 tarefas). O motivo: declarar \"const X = (...)()\" no topo de um script NÃO cria window.X automaticamente (só \"var\" faz isso). Como o Dashboard checava window.ConcretoCalculos / window.SoloGrampeadoCalculos / window.EstacasCalculos, ele sempre recebia undefined.",
        "Isso explica de uma só vez: o \"Motor de cálculo de Solo Grampeado não carregado\", o erro \"Cannot read properties of undefined (reading 'num')\" e vários cálculos do Dashboard silenciosamente zerados. Corrigido na origem: cada módulo agora se expõe explicitamente em window ao final do arquivo.",
        "Diagnóstico ganhou os botões \"📋 Copiar como texto\" e \"⬇️ Baixar .txt\" (texto puro, sem perder formatação ao colar), e passou a mostrar a distribuição real dos valores do campo \"tipo\" das peças — investigando por que Estacas e Fundação aparecem como 0 mesmo havendo 108 peças no andar \"Fundação\"."
      ]
    },
    {
      "versao": "V3.4.11",
      "legado": "V2.60.40",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "correcao",
      "titulo": "Curva S: executado saltava para 100% num único mês e não batia com o % real da obra",
      "itens": [
        "Bug principal: a reconstrução pelo histórico semeava TODAS as tarefas com o percentual de HOJE e depois reaplicava os poucos snapshots existentes. Numa obra com histórico recente (8 registros, todos de julho/26), isso jogava o progresso atual da obra inteira retroativamente naquele mês — daí o salto vertical de ~5% para 100% e o \"94,43% executado no mês\". Agora o estado começa zerado e só considera o que o histórico de fato registrou.",
        "A estimativa dos meses anteriores ao histórico distribuía o progresso de cada tarefa do início dela até HOJE, empurrando tudo pro presente e achatando a curva no passado. Agora distribui pelo período planejado real da tarefa (limitado a hoje).",
        "A transição estimativa → histórico criava um degrau vertical: o histórico recomeçava do zero em vez de continuar do patamar já atingido. Corrigido — o histórico soma a partir de onde a estimativa parou.",
        "Ancoragem final: a curva executada agora é ajustada pra terminar exatamente no percentual real da obra (a mesma soma ponderada por duração que aparece no Hero). Antes podia terminar em 100% com a obra em 12%.",
        "A linha do Executado para no mês atual — antes seguia reta até o fim do gráfico, dando a impressão de que a obra já estava executada nos meses futuros."
      ]
    },
    {
      "versao": "V3.4.12",
      "legado": "V2.60.41",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "correcao",
      "titulo": "Diagnóstico: erro \"Cannot access norm before initialization\" + nova seção que mostra por que o Auto-vincular não casa todas as tarefas",
      "itens": [
        "A página parava na seção 2 por um erro de ordem de declaração no próprio código do diagnóstico (uma função auxiliar era usada antes de ser criada). Corrigido.",
        "Confirmado que a correção da V2.60.39 funcionou: todos os motores de cálculo agora aparecem como OK (antes, todos apareciam como \"não carregou\").",
        "Nova tabela na seção 5: lista cada Pavimento e Apartamento cadastrado na Estrutura da Obra e mostra quantas tarefas do Planejamento contêm aquele texto no nome — que é exatamente o critério do Auto-vincular. Quem aparecer com \"0 — não casa\" está com o nome escrito diferente do que aparece nas tarefas (ex: \"1° Pavimento\" com símbolo de grau vs \"1º Pavimento\" com ordinal). Junto vem uma amostra dos nomes reais das tarefas pra comparação direta."
      ]
    },
    {
      "versao": "V3.4.12.1",
      "legado": "V2.61.0",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "funcionalidade",
      "titulo": "Curva S removida do Dashboard",
      "itens": [
        "A Curva S foi removida permanentemente a pedido: o cálculo dependia de um histórico diário que só passou a ser gravado recentemente, e as tentativas de reconstruir o passado a partir de dados incompletos produziam valores que não refletiam a realidade da obra (executado saltando pra 100%, meses anteriores zerados). Dava mais trabalho de manter do que valor entregava.",
        "Removidos junto: o gráfico de Índice de Desempenho de Prazo (IDP), que dependia dela e já não era exibido, e o seletor Mensal/Semanal. Ao todo, 405 linhas de código a menos no Dashboard.",
        "O histórico de execução (obras/{obra}/historicoExecucao) continua sendo gravado normalmente a cada atualização de tarefa — nada foi perdido no banco, caso no futuro se queira retomar algum gráfico de evolução com base histórica já consolidada."
      ]
    },
    {
      "versao": "V3.4.12.2",
      "legado": "V2.62.0",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "funcionalidade",
      "titulo": "Dashboard renovado: frentes de trabalho automáticas e visual novo",
      "itens": [
        "O Dashboard foi dividido internamente em seções independentes (Frentes, Suprimentos, Contenção, Fundação/Estrutura, Estacas, Resumo por Apartamento) — cada uma no seu próprio arquivo. Mexer numa não afeta as outras, e um erro em uma seção não derruba mais a página inteira.",
        "Nova visão central: \"Andamento por Frente de Trabalho\". Linha = frente/serviço com nome amigável, coluna = pavimento (ou apartamento), célula = % com micro-barra de progresso e ✓ quando concluída. Cabeçalho e primeira coluna ficam fixos ao rolar; clique numa célula abre as tarefas daquele cruzamento.",
        "Auto-configuração: as frentes agora se montam SOZINHAS a partir do Planejamento — cada grupo pai de tarefas vinculadas a um local vira uma frente, na ordem da EAP, mesclando grupos de mesmo nome entre torres. Configurou a Estrutura da Obra e vinculou as tarefas uma vez, o Dashboard se atualiza pra sempre. Edição manual continua possível em ⚙️ Configurar (desliga o automático), com botões \"Regerar do Planejamento\" e \"Voltar ao automático\".",
        "Removida a antiga seção \"Atividades\" (listas de Em Execução/Próximas com as linhas cruas do planejamento) — substituída pela visão de frentes.",
        "Hero da obra redesenhado: barra de progresso executado (amarelo) com marcador branco do previsto, % grande, badges de prazo (No prazo / X meses atrasado) e seletor de obra integrado.",
        "Suprimentos, minimapas de Contenção e Estacas e Resumo por Apartamento ganharam o mesmo padrão visual (chips, estados vazios amigáveis, tabelas limpas). Seções de Contenção e Estacas agora somem sozinhas quando a obra não tem essas disciplinas.",
        "Limpeza: removidos códigos mortos (PPC semanal, Motivos de Atraso, Pacotes) que não eram exibidos desde versões anteriores."
      ]
    },
    {
      "versao": "V3.4.13",
      "legado": "V2.62.1",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "correcao",
      "titulo": "Popup do projeto: pan por arrasto + zoom com Ctrl+scroll",
      "itens": [
        "No popup que abre ao clicar numa barra de Fundação/Estrutura, agora dá pra ARRASTAR a prancha segurando o botão esquerdo (ou do meio) do mouse — cursor vira mãozinha.",
        "Zoom passou a ser Ctrl+scroll (ou pinça do touchpad); o scroll normal volta a rolar a prancha (pan vertical, Shift+scroll horizontal), como em softwares de CAD/mapas. Antes o scroll dava zoom e não havia como navegar arrastando."
      ]
    },
    {
      "versao": "V3.4.14",
      "legado": "V2.62.2",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "correcao",
      "titulo": "Estacas no Dashboard: índice de perda corrigido e minimapa limpo",
      "itens": [
        "Índice de perda médio estava sempre 0,0%: a \"perda de solo\" comparava o volume real das BTs com o volume de projeto da OBRA INTEIRA — com a obra em andamento, o real é sempre menor que o total e a conta zerava. Agora compara com o volume de projeto das peças JÁ EXECUTADAS (mesma metodologia do Controle de Estacas). Ex: 69,0 m³ reais sobre 58,5 m³ de projeto executado passam a acusar a perda corretamente.",
        "Minimapa da prancha agora aparece \"zerado\": mostra APENAS as estacas com execução iniciada, sem a nuvem de círculos de todas as estacas configuradas nem os anéis coloridos por tipo — a prancha vai sendo pintada conforme a obra avança. No popup em tela cheia (clique na barra de Fundação/Estrutura) os anéis por tipo continuam, pois lá servem de leitura do projeto."
      ]
    },
    {
      "versao": "V3.4.15",
      "legado": "V2.62.3",
      "status": "fechada",
      "data": "2026-08-13",
      "tipo": "correcao",
      "titulo": "Seção Atividades de volta no Dashboard",
      "itens": [
        "A seção \"Atividades\" (Em Execução + Próximas), removida por engano no redesign V2.62.0, voltou — agora como módulo próprio (js/dashboard-atividades.js) e no padrão visual novo: pills de nível, árvore expansível com resumo agregado, % colorido por faixa e horizonte de tempo nas Próximas.",
        "As preferências de nível/horizonte salvas por usuário antes da V2.62.0 continuam valendo (mesmas chaves em users/{uid}.dashboardArvorePrefs)."
      ]
    },
    {
      "versao": "V3.4.16",
      "legado": "V2.62.4",
      "status": "fechada",
      "data": "2026-08-14",
      "tipo": "correcao",
      "titulo": "Horizonte de 2 meses + alerta de início vencido nas Próximas",
      "itens": [
        "Opção \"2 meses\" adicionada no filtro de horizonte de Atividades (Próximas) e Suprimentos.",
        "Nas Próximas, tarefas com início planejado já vencido e 0% ganham o selo vermelho \"deveria ter iniciado\" — lembra de atualizar o % no Planejamento (a coluna Em Execução só considera tarefas com progresso entre 1% e 99%)."
      ]
    },
    {
      "versao": "V3.4.16.1",
      "legado": "V2.62.5",
      "status": "fechada",
      "data": "2026-08-14",
      "tipo": "funcionalidade",
      "titulo": "Novos exports no Planejamento: Excel FORMATADO (bonito), MS Project (.xml) e Imprimir/PDF — o export cru continua disponível como \"Excel (simples)\"",
      "itens": [
        "🎨 Exportar Excel (formatado): planilha estilizada pronta pra apresentar — cabeçalho escuro fixo com filtro, grupos coloridos por nível (dourado → tons mais claros), indentação por hierarquia, bordas, % concluído verde quando 100%. O export antigo (cru, com todas as colunas, bom pra reimportar) continua como \"Exportar Excel (simples)\".",
        "📊 Exportar MS Project (.xml): gera XML no formato nativo de troca do Project (MSPDI) — abre direto no MS Project (Arquivo → Abrir) com hierarquia, datas, duração, % concluído e predecessoras completas (tipo TI/II/TT/IT + defasagem), calendário padrão seg-sex 8h.",
        "🖨 Imprimir / PDF: abre a visão hierárquica bonita numa página branca limpa e chama a impressão do navegador — dá pra imprimir direto ou salvar em PDF. Cabeçalho da tabela repete em toda página, formato paisagem A4, linhas não quebram no meio.",
        "Os três estão no menu ⚙ Ferramentas (ordem alfabética, como sempre)."
      ]
    },
    {
      "versao": "V3.4.17",
      "legado": "V2.62.6",
      "status": "fechada",
      "data": "2026-08-14",
      "tipo": "correcao",
      "titulo": "% Esperado agora é calculado AUTOMATICAMENTE pela data (nunca mais fica defasado); Término nunca mais fica antes do Início; menu Ferramentas organizado em categorias",
      "itens": [
        "% Esperado deixou de ser um número estático importado da planilha (que ficava velho no dia seguinte): agora é calculado ao vivo — posição de HOJE dentro do intervalo Início→Término planejado (mesma fórmula do \"prev.\" do Diário de Obra). Antes do início = 0%, depois do término = 100%, no meio = proporcional. Os dois módulos agora sempre batem. A coluna deixou de ser editável (não faz sentido editar algo calculado).",
        "Datas: editar o Início pra DEPOIS do Término existente (em tarefa sem duração salva) deixava a tarefa \"voltando no tempo\" (ex: 12/08→04/08). Agora o Término é arrastado junto pro mesmo dia, com aviso. E editar o Término pra antes do Início é rejeitado na hora, sem salvar nada.",
        "Menu ⚙ Ferramentas reorganizado em 3 categorias com cabeçalho — \"Importar & Exportar\", \"Correções & Recálculos\" e \"Ferramentas da Obra\" — em vez de uma lista única gigante (\"salada de frutas\"). Ordem alfabética dentro de cada grupo."
      ]
    },
    {
      "versao": "V3.4.17.1",
      "legado": "V2.62.7",
      "status": "fechada",
      "data": "2026-08-14",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Concreto — novo tipo de Fundação: Bloco Hexagonal",
      "itens": [
        "Novo tipo na calculadora de Fundação: \"Bloco Hexagonal\" (bloco de coroamento para 7 estacas, com pontas triangulares no topo e na base).",
        "Campos: A (meia largura, centro até a lateral reta), B (altura de cada ponta), C (altura da parte reta central), D (altura/espessura do bloco).",
        "Fórmula: Área da planta = 2A×(B+C) [retângulo central + duas pontas triangulares] · Volume = Área × D.",
        "Diagrama de referência desenhado na tela com os mesmos rótulos A/B/C/D do desenho técnico enviado."
      ]
    },
    {
      "versao": "V3.4.18",
      "legado": "V2.62.8",
      "status": "fechada",
      "data": "2026-08-14",
      "tipo": "correcao",
      "titulo": "Bloco Hexagonal — troca o SVG desenhado pela imagem técnica real",
      "itens": [
        "O SVG genérico (feito só a partir da descrição em texto) foi trocado pelo desenho técnico real enviado — mesma referência que os outros tipos de fundação usam (imagem, não SVG).",
        "Fórmula não mudou: a imagem real confirma D = h = altura do bloco, batendo com o que já estava implementado."
      ]
    },
    {
      "versao": "V3.4.18.1",
      "legado": "V2.62.9",
      "status": "fechada",
      "data": "2026-08-14",
      "tipo": "melhoria",
      "titulo": "Controle de Estacas: seletor de BT esconde por padrão as já 100% usadas noutras peças",
      "itens": [
        "No popup de lançar por estaca, BTs que já estão 100% alocadas em outra peça (não sobra nada pra usar ali) somem do seletor por padrão — deixa a lista bem mais curta quando tem muitas BTs.",
        "Aparece um checkbox \"Mostrar N BTs 100% usadas\" pra reexibir, se precisar reajustar algo numa BT que já foi totalmente usada."
      ]
    },
    {
      "versao": "V3.4.18.2",
      "legado": "V2.62.10",
      "status": "fechada",
      "data": "2026-08-14",
      "tipo": "melhoria",
      "titulo": "Minimapa de Estacas clicável: prancha em tela cheia",
      "itens": [
        "Clicar num minimapa de Estacas no Dashboard agora abre a prancha em POPUP DE TELA CHEIA, em qualidade máxima, mantendo a mesma visão limpa do minimapa (só as estacas executadas, sem anéis de tipo).",
        "Navegação no popup: zoom com Ctrl+scroll (ou botões −/+), arrastar com o botão esquerdo ou do meio do mouse (pan), scroll normal rola a prancha, setas ‹ › alternam entre pranchas, Esc fecha.",
        "Cards do minimapa ganharam indicação visual de clique (lupa + destaque no hover)."
      ]
    },
    {
      "versao": "V3.4.19",
      "legado": "V2.62.11",
      "status": "fechada",
      "data": "2026-08-14",
      "tipo": "correcao",
      "titulo": "Dashboard se atualiza sozinho ao voltar pra aba",
      "itens": [
        "O Dashboard carregava os dados só na abertura: quem mudava a % no Planejamento em outra aba e voltava continuava vendo o retrato antigo (parecia que a mudança \"não tinha mexido em nada\"). Agora, ao voltar pra aba do Dashboard, ele recarrega os dados automaticamente (de forma silenciosa, sem tela de loading).",
        "Botão \"↻ Atualizar\" no cabeçalho do Andamento por Frente pra forçar a recarga a qualquer momento."
      ]
    },
    {
      "versao": "V3.4.19.1",
      "legado": "V2.62.12",
      "status": "fechada",
      "data": "2026-08-14",
      "tipo": "melhoria",
      "titulo": "Planejamento: novo \"📄 Baixar PDF\" — baixa o arquivo .pdf direto, sem passar pelo diálogo de impressão",
      "itens": [
        "Mesmo visual bonito do Imprimir/PDF (A4 paisagem, cabeçalho escuro repetido em cada página, grupos coloridos por nível, indentação, % concluído verde quando 100%), só que já salva o arquivo .pdf na hora, com um clique.",
        "O \"🖨 Imprimir / PDF\" continua disponível pra quem prefere imprimir em papel ou ajustar opções no diálogo do navegador. Ambos em ⚙ Ferramentas → Importar & Exportar."
      ]
    },
    {
      "versao": "V3.4.19.2",
      "legado": "V2.62.13",
      "status": "fechada",
      "data": "2026-08-14",
      "tipo": "melhoria",
      "titulo": "Dashboard em TEMPO REAL",
      "itens": [
        "O Dashboard agora escuta o Firestore ao vivo: qualquer % ou dado alterado no Planejamento — nesta aba, em outra aba ou em outro computador — atualiza Hero, Andamento por Frente, Atividades e Suprimentos NA HORA, sem F5, sem loading e sem clicar em nada.",
        "Indicador verde ● ao lado de \"Atualizado às...\" mostra quando a tela acabou de se atualizar sozinha.",
        "As seções pesadas (Contenção, Fundação/Estrutura, Estacas, Resumo por Apartamento) continuam recarregando ao voltar pra aba ou pelo botão ↻ — evita custo desnecessário de leitura contínua onde os dados mudam pouco."
      ]
    },
    {
      "versao": "V3.4.20",
      "legado": "V2.62.14",
      "status": "fechada",
      "data": "2026-08-14",
      "tipo": "correcao",
      "titulo": "Dashboard sincroniza % de Estacas igual ao Planejamento",
      "itens": [
        "O Planejamento recalcula e grava o % das tarefas vinculadas a peças de Estacas (a partir da execução real) toda vez que abre — o Dashboard não fazia isso e podia ler o estado ANTERIOR: tarefas já iniciadas apareciam com 0% e caíam em \"Próximas\" como atrasadas. Agora o Dashboard roda a MESMA sincronização antes de carregar.",
        "Log de diagnóstico no console do navegador (F12) mostrando quantas tarefas/folhas/em execução o Dashboard leu do banco — facilita rastrear qualquer divergência que ainda apareça."
      ]
    },
    {
      "versao": "V3.4.21",
      "legado": "V2.62.15",
      "status": "fechada",
      "data": "2026-08-14",
      "tipo": "correcao",
      "titulo": "Em Execução escondia tarefas por causa de horizonte antigo",
      "itens": [
        "ACHADO: a coluna \"Em Execução\" das Atividades aplicava, por engano, um horizonte de tempo herdado das preferências antigas (pré-V2.62) — e o filtro era pela data de TÉRMINO planejado. Resultado: tarefas em execução com término distante sumiam (ex: Custos Indiretos 14%, término em 2028, e Cravação de Estacas 8% não apareciam).",
        "Corrigido: Em Execução NUNCA aplica horizonte — se a tarefa tem % entre 1 e 99, ela aparece, sempre. O horizonte continua valendo só nas Próximas e em Suprimentos, onde faz sentido."
      ]
    },
    {
      "versao": "V3.4.22",
      "legado": "V2.62.16",
      "status": "fechada",
      "data": "2026-08-14",
      "tipo": "correcao",
      "titulo": "Menu: seção \"Administração\" unificada + correção de e-mail em convite pendente",
      "itens": [
        "Sidebar: \"Permissões\" saiu de \"Análise\" (lugar errado) e entrou, junto com Relatórios, Histograma, Backup de Planejamentos e Notas de Versão, numa única seção \"Administração\".",
        "Admin > Permissões: convite pendente agora permite editar o e-mail (corrigir erro de digitação) — ao salvar, atualiza o e-mail no Firebase Auth e reenvia o convite automaticamente para o endereço corrigido."
      ]
    },
    {
      "versao": "V3.4.23",
      "legado": "V2.62.17",
      "status": "fechada",
      "data": "2026-08-14",
      "tipo": "correcao",
      "titulo": "Seletor de Nível não esconde mais tarefas (Atividades e Suprimentos)",
      "itens": [
        "O seletor \"Nível N\" filtrava a árvore pra mostrar SÓ tarefas daquele nível exato: com \"Nível 5\" marcado e as tarefas em execução nos níveis 2–3, a coluna Em Execução ficava vazia (\"Nenhuma atividade em execução\"), mesmo com Cravação 8% e Custos Indiretos 14% no banco.",
        "Agora o \"Nível N\" controla apenas a PROFUNDIDADE que a árvore vem pré-expandida — nenhuma tarefa é escondida por causa do nível. Vale pra Atividades (Em Execução e Próximas) e Suprimentos."
      ]
    },
    {
      "versao": "V3.5.0.0",
      "legado": "V2.63.0",
      "status": "fechada",
      "data": "2026-08-14",
      "tipo": "funcionalidade",
      "titulo": "Versionamento reanalisado versão a versão — nova era A.B.C.D + Notas de Versão repaginadas",
      "itens": [
        "Renumeração completa seguindo a regra A.B.C.D, analisada versão por versão desde a V1 — nenhuma versão foi juntada (as 408 continuam no histórico, cada uma com seu próprio número): A sobe em sistema novo funcional (V1 = Base · V2 = Reescrita do Planejamento · V3 = marco Suprimentos), B sobe apenas em feature/módulo GRANDE (analisado título a título — funcionalidades menores são sub-features no D), C a cada correção, D a cada melhoria/sub-feature — sempre zerando as casas abaixo.",
        "O número antigo de cada versão fica registrado no card como \"antes: V2.xx\".",
        "Status aberta/fechada aposentado — não significava nada por versão e confundia (havia 7 \"abertas\" esquecidas). Agora a mais recente ganha o selo ● Atual automaticamente.",
        "PROJETO.md atualizado com a regra oficial de versionamento A.B.C.D para todas as sessões Claude seguirem.",
        "Página redesenhada: hero escuro com a versão atual e o total de versões lançadas, cards de estatísticas (versões, features, correções, melhorias).",
        "Busca por texto (versão, título ou item) e filtro por tipo (Lançamento / Funcionalidade / Correção / Melhoria).",
        "Timeline com cards colapsáveis — clique no cabeçalho para expandir; só a versão em aberto vem expandida.",
        "Correção de bug latente: itens contendo tags HTML (ex: <select>) quebravam a renderização e escondiam mais da metade do histórico — agora tudo é escapado e as 408 versões aparecem."
      ]
    },
    {
      "versao": "V3.5.1",
      "data": "2026-08-15",
      "tipo": "correcao",
      "titulo": "Popup da prancha: pan destravado (câmera nova)",
      "itens": [
        "O arrasto (pan) dentro do popup da prancha estava TRAVADO: o modelo antigo dependia da barra de rolagem do container, mas o zoom por transform não cria rolagem de verdade — então não havia o que arrastar.",
        "Reescrito como câmera de mapa (translate + scale): arrastar com o mouse funciona sempre, em qualquer nível de zoom; Ctrl+scroll dá zoom ancorado no ponto do cursor; scroll normal desliza a prancha (Shift = horizontal); botões −/+ dão zoom no centro.",
        "A prancha abre ajustada pra caber inteira na tela, centralizada."
      ],
      "legado": "V3.5.1"
    },
    {
      "versao": "V3.5.1.1",
      "data": "2026-08-15",
      "tipo": "melhoria",
      "titulo": "Relatório de Concretagem de Estacas (com PDF e prancha preenchida)",
      "itens": [
        "Novo botão \"📄 Exportar relatório\" na seção Estacas e Fundações do Dashboard.",
        "Escolha as datas de concretagem (uma, várias, ou todas marcadas = relatório total até agora).",
        "Por dia: executado por tipo (Ø × comprimento), tabela com nº da estaca, BT que a executou (com Nota Fiscal e código quando cadastrados, senão só o número, ex: BT5), volume calculado, volume real utilizado e índice de perda daquela estaca; totais do dia em quantidade, ML e m³.",
        "Fecho do relatório: total de dias de concretagem e resumo geral consolidado (sem separar por dia), por tipo e nos números da obra.",
        "⬇ Baixar PDF: gera o arquivo direto (sem diálogo de impressão), com a prancha do projeto preenchida — só as estacas executadas, verde = concluída, amarelo = parcial — seguida do relatório dia a dia e do resumo.",
        "Estaca concretada em mais de um dia aparece em cada dia com o volume daquele dia, e no resumo total é contada uma vez só."
      ],
      "legado": "V3.5.1.1"
    },
    {
      "versao": "V3.5.1.2",
      "data": "2026-08-15",
      "tipo": "melhoria",
      "titulo": "Relatório de Estacas: modo Só Total, texto pra WhatsApp, PDF repaginado e Nº da concretagem na prancha",
      "itens": [
        "Nova opção na geração: \"Só o resumo total (sem separar por dia)\" — sai o consolidado da obra com a tabela de todas as estacas executadas (com Nº da concretagem de cada uma), sem o dia a dia.",
        "📱 Copiar p/ WhatsApp: botão que monta o relatório em texto (negritos e marcadores no formato do WhatsApp) e copia — é só colar na conversa.",
        "RESUMO TOTAL do PDF redesenhado: banner preto com período, cards de métricas (estacas, ML, m³ real, m³ calculado, índice de perda colorido), tabela por tipo agora com coluna de perda e zebra.",
        "Prancha do PDF: quando o relatório cobre MAIS DE UM DIA, cada estaca marcada mostra o Nº da concretagem dentro do círculo — dá pra saber qual concretagem executou cada estaca só de olhar."
      ],
      "legado": "V3.5.1.2"
    },
    {
      "versao": "V3.5.2",
      "data": "2026-08-15",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: índice de perda corrigido — cocho/linha estava contado em dobro",
      "itens": [
        "Bug real: a perda de cocho e linha (que acontece antes de o concreto chegar na peça, normalmente na 1ª BT) entrava DUAS vezes na conta — uma escondida (na diferença bruta entre volume real e projeto) e outra somada de novo por cima — dobrando o índice de perda.",
        "Corrigido: agora desconta o cocho/linha do volume executado real UMA vez, ANTES de comparar com o volume do projeto. Exemplo: projeto 10m³, usado 12m³, cocho 2m³ → usado real 10m³ → perda 0%. Projeto 10m³, usado 15m³, cocho 2m³ → usado real 13m³ → perda 3m³ = 30%.",
        "\"Executado real (BTs)\" agora mostra o volume previsto (nominal) das BTs usadas — igual ao \"Volume Real Concretado\" do Controle de Concreto, pros dois módulos baterem."
      ],
      "legado": "V3.5.1.3"
    },
    {
      "versao": "V3.5.2.1",
      "data": "2026-08-15",
      "tipo": "melhoria",
      "titulo": "Relatório de Estacas: ordem pelas BTs e perda na fórmula nova do Controle",
      "itens": [
        "Dentro de cada dia (e no consolidado/WhatsApp), as estacas saem na ORDEM DAS BTs (BT1,BT2,BT3 antes de BT3,BT4,BT5) — a sequência real de execução, não a ordem alfabética.",
        "Índice de perda do relatório ALINHADO à fórmula corrigida do Controle de Estacas (V3.5.1.3): cocho/linha é descontado antes de comparar com o projeto (não conta mais em dobro), perda de solo = usado − projeto, somando perda de obra e sobra de caminhão. Como essas perdas são por BT e uma BT pode servir várias estacas, o relatório RATEIA proporcionalmente ao volume que cada estaca tirou da BT — a soma bate com o índice do Controle.",
        "Perda do TOTAL DO DIA, por tipo e do resumo geral também recalculadas nessa mesma base. IMPORTANTE: o relatório não copia o número do Controle — ele aplica a mesma fórmula; se a fórmula mudar de novo no Controle, precisa ser espelhada aqui."
      ],
      "legado": "V3.5.1.4"
    },
    {
      "versao": "V3.5.2.2",
      "data": "2026-08-15",
      "tipo": "melhoria",
      "titulo": "Controle de Estacas: sobra/perda de cocho e linha direto no popup de lançar por estaca",
      "itens": [
        "Novo botão \"✎ sobra/perda\" em cada linha de BT do popup de lançar por estaca — abre um mini-formulário ali mesmo (sobra caminhão, perda em obra, cocho + linha, hora), sem precisar sair pra outro menu.",
        "Se a BT ainda não tem nenhum lançamento salvo (primeira peça dela), o valor fica guardado e entra automaticamente quando você salvar o lançamento — antes não tinha onde persistir isso.",
        "Botão fica com borda laranja quando a BT já tem alguma sobra/perda cadastrada, pra saber de relance quais já foram preenchidas."
      ],
      "legado": "V3.5.1.5"
    },
    {
      "versao": "V3.5.3",
      "data": "2026-08-15",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: cocho/linha só na primeira BT, sobra de caminhão só na última",
      "itens": [
        "Corrigido: o mini-form de sobra/perda mostrava Cocho+Linha e Sobra Caminhão em QUALQUER BT — errado, cocho/linha só acontece uma vez (na 1ª BT do dia) e sobra de caminhão só faz sentido na ÚLTIMA (se ela não foi totalmente usada).",
        "Agora: Cocho + Linha só aparece na primeira BT da concretagem (menor número), Sobra Caminhão só na última (maior número). BTs do meio só têm Perda em Obra e Hora — com um aviso explicando.",
        "Primeira/última são calculadas pelo número da BT dentro da concretagem, ordem que reflete a sequência real de chegada dos caminhões."
      ],
      "legado": "V3.5.1.6"
    },
    {
      "versao": "V3.5.4",
      "data": "2026-08-15",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: botão de sobra/perda some das BTs do meio — só aparece na 1ª e na última",
      "itens": [
        "O botão \"✎ sobra/perda\" ainda aparecia em TODAS as linhas de BT do popup de lançar por estaca, mesmo já só mostrando os campos certos dentro dele — poluía a tela com botão irrelevante em toda BT do meio.",
        "Agora o botão só aparece na linha da BT que é a primeira (mostra \"✎ cocho\") ou a última (mostra \"✎ sobra\") da concretagem inteira. BTs do meio não têm nenhum botão ali — não tem nada de cocho/sobra pra editar mesmo."
      ],
      "legado": "V3.5.1.7"
    },
    {
      "versao": "V3.5.5",
      "data": "2026-08-15",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: formatação do mini-form de sobra/perda arrumada",
      "itens": [
        "Layout do mini-formulário (dentro do popup de lançar por estaca) estava quebrado: quando só tinha 1 campo na linha (ex: só \\\"Perda em Obra\\\" numa BT do meio, ou o rótulo \\\"Cocho + Linha [m³] (primeira BT)\\\" quebrando em 2 linhas), esticava feio ou desalinhava.",
        "Agora é uma grade fixa de 3 colunas, sempre igual. O texto explicando \\\"é a primeira BT, tem cocho\\\"/\\\"é a última, tem sobra\\\" saiu do rótulo do campo e foi pro texto de cima, sem quebrar linha."
      ],
      "legado": "V3.5.1.8"
    },
    {
      "versao": "V3.5.6",
      "data": "2026-08-15",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: mapa do Acompanhamento não mostra mais concretagens futuras",
      "itens": [
        "Bug real: o mapa de qualquer concretagem selecionada mostrava TODAS as peças da prancha já concretadas, mesmo as de concretagens FUTURAS — concretagem Nº 1 e Nº 2 mostravam o mapa idêntico, confundindo o que já foi feito de fato até aquele dia.",
        "Corrigido: agora o mapa só mostra peças da concretagem selecionada + das ANTERIORES (por número) — nunca as de concretagens com número maior. Concretagem Nº 1 só mostra suas próprias peças; Nº 2 mostra as da 1 e da 2; Nº 3 mostra 1, 2 e 3.",
        "Cada peça concretada agora exibe um número em cima mostrando de QUAL concretagem ela é — pra não confundir qual estaca foi feita em qual dia."
      ],
      "legado": "V3.5.1.9"
    },
    {
      "versao": "V3.5.7",
      "data": "2026-08-15",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: BTs fora de ordem e linhas desalinhadas no popup de lançar por estaca",
      "itens": [
        "As linhas de BT apareciam na ordem em que os lançamentos foram salvos no banco (aleatória), não na ordem numérica das BTs — agora sempre ordenadas BT-1, BT-2, BT-3...",
        "A coluna do botão \\\"✎ cocho/sobra\\\" usava largura automática — quando o botão não aparecia (BT do meio), a linha toda encolhia e desalinhava com as outras. Agora a coluna tem largura fixa, alinhado sempre, com ou sem botão."
      ],
      "legado": "V3.5.1.10"
    },
    {
      "versao": "V3.5.7.1",
      "data": "2026-08-15",
      "tipo": "melhoria",
      "titulo": "Resumo Total do Relatório de Estacas completo e alinhado",
      "itens": [
        "O RESUMO TOTAL agora traz a TABELA DE CADA ESTACA (consolidado com Concretagem Nº, BTs, vol. calculado, vol. real e perda) em TODOS os modos — antes só saía no modo \"Só total\".",
        "Mais dados: cards de Perda em m³, Consumo médio por estaca e Média de estacas/dia; tabela por tipo ganhou colunas de m³ calculado, consumo médio e perda — na prévia e no PDF.",
        "Formatação corrigida no PDF: os títulos das colunas numéricas agora ficam alinhados com os números (à direita/centro) — antes o cabeçalho ficava à esquerda e o valor à direita, parecendo de outra coluna. Vale pras tabelas do dia, por tipo e consolidada."
      ],
      "legado": "V3.5.1.11"
    },
    {
      "versao": "V3.5.7.2",
      "data": "2026-08-15",
      "tipo": "melhoria",
      "titulo": "Consolidado do relatório: ordem por Concretagem e depois por BT",
      "itens": [
        "Na tabela \"Estacas executadas (consolidado)\" do Resumo Total, as estacas agora saem ordenadas primeiro pelo Nº DA CONCRETAGEM e, dentro dela, pela ordem das BTs — antes a ordem das BTs vinha misturando estacas de concretagens diferentes."
      ],
      "legado": "V3.5.1.12"
    },
    {
      "versao": "V3.5.7.3",
      "data": "2026-08-15",
      "tipo": "melhoria",
      "titulo": "Controle de Terraplanagem: N° Canhoto, importação de planilha e relatórios por dia/caminhão",
      "itens": [
        "Novo campo N° Canhoto em cada viagem/remoção — aparece no registro manual e na tabela.",
        "Botão \"📥 Importar Planilha\" no Controle de Terraplanagem: lê .xlsx/.xls/.csv com as colunas N Canhoto, Data, Material, Volume e Placa (nome das colunas flexível, ordem não importa). Placas ainda não cadastradas são criadas automaticamente em Caminhões. Linhas com N° Canhoto repetido são puladas (evita duplicar se a planilha for importada de novo).",
        "Painel \"Viagens/Remoções\" ganhou abas: Viagens (lista, como antes), Por Dia (viagens e volume por data) e Por Caminhão (viagens, volume total e média por placa)."
      ],
      "legado": "V3.5.1.13"
    },
    {
      "versao": "V3.6.0",
      "data": "2026-08-15",
      "tipo": "funcionalidade",
      "titulo": "Levantamento de Terraplanagem: novo modo \"Marcar no Projeto\" (planta + pontos + escala)",
      "itens": [
        "Cada seção agora pode ser preenchida de duas formas: ✍️ Digitar Manualmente (como antes, cotas e distâncias em texto) ou 🖼️ Marcar no Projeto — insere a planta/foto (imagem ou PDF) da seção, calibra a escala (clica em 2 pontos e informa a distância real entre eles) e depois marca os pontos direto na imagem, informando a cota de cada um.",
        "A distância entre pontos consecutivos passa a ser calculada automaticamente pela escala calibrada — não precisa mais digitar as distâncias.",
        "Cota de Referência: pode ser definida uma vez em ⚙️ Config (padrão de toda a obra) ou individualmente em cada seção (sobrepõe a padrão). A altura usada no cálculo da área é sempre cota do ponto menos cota de referência.",
        "⚙️ Config ganhou um seletor de preset de Taxa de Empolamento (Material Útil 30%, Argila 40%) — só preenche o campo, que continua editável pra qualquer outro valor.",
        "Seções já cadastradas continuam funcionando normalmente no modo manual — nada muda pra quem não usar o novo modo visual."
      ],
      "legado": "V3.6.0"
    },
    {
      "versao": "V3.6.1",
      "data": "2026-08-15",
      "tipo": "correcao",
      "titulo": "Controle de Terraplanagem: lançar viagens/planilha nunca depende de ter Levantamento cadastrado",
      "itens": [
        "Registrar viagem manual e importar planilha já funcionavam sem nenhum volume previsto cadastrado — mas o card \"Já Removido\" e o cabeçalho da tabela mostravam \"0% concluído\"/\"acumulado 0%\", como se faltasse algo, quando na verdade é só falta de Levantamento pra comparar.",
        "Agora, sem volume previsto: o card \"Volume Previsto\" mostra \"—\" com a nota \"Sem Levantamento cadastrado ainda\", e os dois \"% concluído\" somem — sem nenhum índice de erro ou percentual enganoso. Assim que o Levantamento for cadastrado, os percentuais voltam a aparecer normalmente."
      ],
      "legado": "V3.6.1"
    },
    {
      "versao": "V3.6.2",
      "data": "2026-08-15",
      "tipo": "correcao",
      "titulo": "Levantamento de Terraplanagem: projeto único compartilhado por todas as seções (não mais um por seção)",
      "itens": [
        "Correção de arquitetura do modo \"🖼️ Marcar no Projeto\": antes cada seção pedia sua própria imagem, o que não fazia sentido — a obra tem UM projeto (planta/foto) só, com todas as seções marcadas nele.",
        "Agora o projeto é inserido e calibrado uma única vez, no topo da Calculadora de Corte de Terra (antes das abas Horizontais/Verticais) — o toggle ✍️ Manual / 🖼️ Marcar no Projeto também é único pra calculadora inteira, não mais por seção.",
        "Cada seção vira uma linha de pontos marcada em cima dessa mesma imagem, com cor própria (bolinha + linha conectando os pontos) — pra marcar pontos numa seção, basta abrir ela na lista (fica destacada como \"seção ativa\") e clicar na imagem do projeto.",
        "Trocar o projeto por uma imagem nova avisa e apaga a escala + pontos de todas as seções (as posições não valem mais na imagem diferente)."
      ],
      "legado": "V3.6.2"
    },
    {
      "versao": "V3.6.3",
      "data": "2026-08-15",
      "tipo": "correcao",
      "titulo": "Importar Planilha (Controle Terraplanagem): testado com planilha real, 3 ajustes",
      "itens": [
        "Cabeçalho da planilha agora é localizado automaticamente nas primeiras linhas — antes só funcionava se a primeira linha já fosse o cabeçalho; planilhas com um título/logo acima (ex: \"PIZANI TERRAPLENAGEM, ZENITH\" na linha 1 e o cabeçalho de verdade na linha 2) agora são lidas certo.",
        "Reconhecimento de coluna ficou mais tolerante (ex: \"PLACA VEICULO\", \"DATA:\") — casa por conter o nome da coluna, não só igualdade exata.",
        "Placa deixou de ser obrigatória pra importar a linha: se a planilha tiver canhoto/data/material/volume mas a placa vier em branco, a viagem entra mesmo assim (sem descartar volume real por causa disso) — só não cadastra caminhão novo nesse caso.",
        "Planilha com mais de uma aba (uma por obra, como no arquivo de teste ZENITH+DOM): pergunta qual aba é da obra atual antes de importar, em vez de pegar a primeira aba sempre — evita importar os dados errados na obra errada. Continua sendo política do usuário separar em arquivos por obra antes de importar; isso é só uma trava de segurança a mais."
      ],
      "legado": "V3.6.3"
    },
    {
      "versao": "V3.6.3.1",
      "data": "2026-08-15",
      "tipo": "melhoria",
      "titulo": "Importar Planilha: 3 regras de tolerância a dado faltante",
      "itens": [
        "Linha com só o N° Canhoto preenchido (mais nada) é ignorada silenciosamente — não conta como erro, é tratada como se a linha nem existisse.",
        "Linha sem placa continua sendo importada normalmente (regra já existia) — provavelmente esqueceram de anotar o caminhão.",
        "Novo: linha sem volume agora é completada automaticamente, na ordem: 1) volume mais comum já visto pra aquela placa na própria planilha (um caminhão sempre carrega o mesmo volume) 2) se a placa não aparece em nenhuma outra linha com volume, usa a capacidade cadastrada do caminhão (Grande/Pequeno) em \"🚚 Caminhões\". Só fica de fora se não der pra descobrir por nenhuma das duas formas.",
        "O resultado da importação agora mostra quantas linhas tiveram o volume completado (e por qual dos dois jeitos) e quantas foram ignoradas por terem só o canhoto."
      ],
      "legado": "V3.6.4"
    },
    {
      "versao": "V3.7.0",
      "data": "2026-08-15",
      "tipo": "funcionalidade",
      "titulo": "Relatório de Período em PDF (Controle) e Visualização 3D do corte (Levantamento)",
      "itens": [
        "Controle de Terraplanagem: botão \"📄 Relatório\" — escolhe data início/fim, mostra prévia (viagens, volume total, caminhões, dias, gráfico de volume por dia) e gera um PDF bonito com capa, cards de resumo, gráfico, tabela por dia, tabela por caminhão e a lista detalhada de viagens do período.",
        "PDF pode ser baixado direto (\"💾 Baixar PDF\") ou compartilhado (\"📤 Compartilhar\") — no celular abre o menu nativo de compartilhamento com o PDF já anexado, WhatsApp incluso; no navegador sem esse suporte, baixa o arquivo pra anexar manualmente.",
        "Levantamento de Terraplanagem: botão \"🧊 Ver em 3D\" na Calculadora de Corte de Terra — monta um sólido 3D fazendo o loft entre as seções da direção atual (Horizontais ou Verticais), do jeito que elas já são calculadas (cotas + distâncias + cota de referência), funciona tanto no modo Manual quanto no modo Marcar no Projeto.",
        "O 3D colore a superfície do terreno por profundidade do corte (verde = raso, vermelho = fundo) e mostra a cota de referência como um plano laranja translúcido por baixo — arrasta pra girar, scroll pra zoom."
      ],
      "legado": "V3.7.0"
    },
    {
      "versao": "V3.7.0.1",
      "data": "2026-08-15",
      "tipo": "melhoria",
      "titulo": "Limpar Base (Terraplanagem) com permissão dedicada + auditoria de permissões",
      "itens": [
        "Novo botão \"🗑 Limpar Base\" no Controle de Terraplanagem: apaga TODAS as viagens da obra (e opcionalmente os caminhões). Proteção tripla: exige a nova permissão \"Limpar base (tudo)\" concedida na Administração, confirmação de aviso e digitação da palavra LIMPAR.",
        "Novo botão \"🗑 Limpar Base\" no Levantamento de Terraplanagem: apaga todas as seções (horizontais e verticais), o projeto inserido e a escala calibrada — mesma proteção tripla. Caminhões e configuração de empolamento/capacidades são preservados.",
        "Nova ação \"limpar\" no catálogo de permissões — aparece automaticamente na tela de Administração/Permissões pros dois módulos de Terraplanagem, desligada por padrão pra usuários não-admin.",
        "Auditoria de permissões de tudo criado nas últimas versões: Importar Planilha (controleTerra:importar), Relatório PDF (controleTerra:exportar), Limpar Base (limpar nos dois módulos) — todos com bloqueio funcional (a ação é recusada mesmo forçando pelo console) e botão escondido na tela pra quem não tem a permissão."
      ],
      "legado": "V3.7.1"
    },
    {
      "versao": "V3.7.0.2",
      "data": "2026-08-15",
      "tipo": "melhoria",
      "titulo": "Controle de Terraplanagem: TERRA separada de ENTULHO (e demais materiais)",
      "itens": [
        "Materiais agora são classificados automaticamente: TERRA = terraplanagem de verdade; ENTULHO = demolição (pago separado); qualquer outro material vira grupo próprio. A classificação lê o campo material de cada viagem (importada ou manual).",
        "Só TERRA entra no cálculo de terraplanagem: o percentual concluído, a curva de Progresso de Remoção e a comparação com o volume previsto do Levantamento consideram apenas viagens de terra — entulho não conta.",
        "Cards do topo redesenhados: Terra Prevista, Terra Removida (com % da terraplanagem), Entulho Removido (marcado como \\\"não entra na terraplanagem\\\"), Caminhões e Viagens.",
        "Nova aba \\\"Por Material\\\" nas Viagens/Remoções: volume, viagens e % de cada material, com a classificação (terraplanagem × demolição × fora da terraplanagem).",
        "Relatório PDF de período atualizado: cards separados de Terra e Entulho, % Terra × Previsto calculado só com terra, e nova tabela \\\"Volume por material\\\" com a classificação de cada um."
      ],
      "legado": "V3.7.1.1"
    },
    {
      "versao": "V3.7.1",
      "data": "2026-08-15",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: BT duplicada numa mesma peça + seletor nativo trocado por combobox controlado",
      "itens": [
        "Bug real de dados: era possível a mesma BT aparecer em 2 linhas da mesma peça (de lançamentos antigos duplicados) — ao salvar, isso geraria 2 documentos separados ou quebraria o lançamento em lote. Corrigido em 3 pontos: ao abrir a peça, lançamentos duplicados da mesma BT são mesclados (soma o volume); ao selecionar uma BT já usada noutra linha, é bloqueado com aviso; ao salvar, linhas da mesma BT são somadas antes de gravar (nunca 2 documentos pra mesma peça+BT).",
        "O seletor de BT (era um <select> nativo do navegador) foi trocado por um combobox controlado, digita e filtra — em alguns aparelhos o select nativo abria com a lista cortada/ilegível, sem dar pra ler as opções. Agora é HTML/CSS próprio, com o mesmo comportamento em qualquer tela.",
        "Adicionar uma BT nova (+ BT) já abre o combobox dela direto, sem precisar clicar de novo."
      ],
      "legado": "V3.7.1.2"
    },
    {
      "versao": "V3.7.2",
      "data": "2026-08-15",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: combobox de BT não abria — bug introduzido na versão anterior",
      "itens": [
        "O combobox novo (V3.7.1.2) tinha um bug sério: ao focar no campo, ele recriava o popup INTEIRO — o que destrói o próprio campo que acabou de receber o foco, fechando tudo na hora. Por isso não abria de jeito nenhum.",
        "Corrigido: agora abrir/fechar a lista só troca a visibilidade dela (a lista de cada linha já existe escondida no DOM) — nunca recria o campo. Testado o fluxo completo: focar abre, digitar filtra, clicar seleciona, sair sem escolher fecha e restaura o valor certo."
      ],
      "legado": "V3.7.1.3"
    },
    {
      "versao": "V3.7.3",
      "data": "2026-08-15",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: seletor de BT voltou a ser o <select> nativo",
      "itens": [
        "O combobox customizado continuou com problema mesmo após o ajuste — sem conseguir testar ao vivo em tablet, seguir tentando ajustar um componente próprio complexo é arriscado demais.",
        "Voltou pro <select> nativo do navegador — comportamento garantido pela plataforma, mesmo que a lista longa de BTs não fique tão bonita quanto um combobox customizado em alguns aparelhos.",
        "Todas as outras correções desta rodada continuam valendo: BT duplicada mesclada/bloqueada/somada, ordem por número da BT, e alinhamento fixo das colunas."
      ],
      "legado": "V3.7.1.4"
    },
    {
      "versao": "V3.7.4",
      "data": "2026-08-15",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: achado o bug real — lógica do filtro de BT já usada estava invertida",
      "itens": [
        "Bug de digitação na reversão pro select nativo: a condição que decide se uma BT aparece no seletor estava com o \\\"não\\\" faltando — em vez de esconder BTs já usadas em outra linha da mesma peça, o código fazia o oposto (só mostrava as JÁ usadas), permitindo selecionar a mesma BT duas vezes.",
        "Corrigido — 1 caractere (o `!` que faltava). Agora uma BT já escolhida numa linha desaparece do seletor das outras linhas da mesma peça (a não ser que seja a seleção daquela própria linha)."
      ],
      "legado": "V3.7.1.5"
    },
    {
      "versao": "V3.7.5",
      "data": "2026-08-15",
      "tipo": "correcao",
      "titulo": "Sistema inteiro: cache-busting em todos os arquivos .js e .css — resolve \"corrigi mas não resolveu\"",
      "itens": [
        "Achada uma causa raiz provável de vários casos de \"corrigi no código mas o usuário continua vendo o bug antigo\": os arquivos js/*.js e css/*.css eram carregados sem nenhum parâmetro de versão (ex: js/controle-estacas.js). O navegador pode cachear esse arquivo agressivamente e continuar servindo a versão ANTIGA mesmo depois do deploy novo — mesmo com o número da versão certo aparecendo na tela (esse texto vem de outro lugar, o script em si ficava desatualizado).",
        "Corrigido em TODOS os 40 arquivos HTML do sistema: agora todo <script src=\"js/...\"> e <link href=\"css/...\"> carrega com ?v=VERSAO (ex: controle-estacas.js?v=V3.7.1.6). Toda vez que a versão muda, o navegador é obrigado a buscar o arquivo de novo.",
        "Não precisa de passo manual extra daqui pra frente: o mesmo comando de bump de versão (sed trocando o número antigo pelo novo em todos os HTMLs) já atualiza o badge E o parâmetro de cache-busting ao mesmo tempo, automaticamente."
      ],
      "legado": "V3.7.1.6"
    },
    {
      "versao": "V3.7.5.1",
      "data": "2026-08-15",
      "tipo": "melhoria",
      "titulo": "Controle de Terraplanagem: custo por viagem (R$) em tudo",
      "itens": [
        "Novo botão \"💰 Valores\": define o valor padrão POR VIAGEM de Terra e de Entulho (preços diferentes). Viagens sem valor próprio usam o padrão do material — e como o valor é resolvido na leitura (não fica gravado), mudar o padrão atualiza retroativamente todas as viagens já lançadas, incluindo as importadas por planilha.",
        "Registrar Viagem ganhou o campo \"Valor da viagem (R$)\" — preenchido sobrepõe o padrão; em branco usa o padrão do material.",
        "Custo em tudo na tela: card \"Valor Gasto\" no topo, coluna Valor na lista de Viagens e coluna Custo nas abas Por Material, Por Dia e Por Caminhão.",
        "Relatório PDF: card \"VALOR GASTO\" no resumo, linha verde de custo acumulado por cima do gráfico de volume por dia (com o total em R$ na ponta), colunas Custo e R$ Acumulado na tabela por dia, Valor em cada viagem (com total no rodapé) e Custo por caminhão.",
        "Ordem das tabelas do PDF por importância: Volume por material → Volume por dia → Viagens do período → Volume por caminhão (por último).",
        "Card \"Caminhões\" (contagem de placas distintas) removido da tela, da prévia e do PDF — informação inútil, deu lugar ao Valor Gasto."
      ],
      "legado": "V3.7.1.7"
    },
    {
      "versao": "V3.7.5.2",
      "data": "2026-08-15",
      "tipo": "melhoria",
      "titulo": "Levantamento de Terraplanagem: Relatório PDF com projeto marcado e 3D dentro",
      "itens": [
        "Novos botões \"📄 Relatório PDF\" e \"📤 Compartilhar\" no Levantamento de Terraplanagem — gera um PDF com todos os dados do levantamento: cards de volume (horizontal, vertical, médio de banco, taxa de empolamento e volume a remover), o PROJETO com todas as seções desenhadas por cima (linhas coloridas, pontos numerados, rótulo S1/S2... — verticais tracejadas pra diferenciar das horizontais) e IMAGENS DO 3D do corte (uma pras seções horizontais, outra pras verticais), com a mesma coloração por profundidade da tela.",
        "O PDF fecha com as tabelas de seções das duas direções: área, comprimento, distância até a próxima e volume entre seções.",
        "\"📤 Compartilhar\" abre o menu nativo do celular com o PDF anexado (WhatsApp incluso); em navegador sem esse suporte, baixa o arquivo pra anexar manualmente."
      ],
      "legado": "V3.7.1.8"
    },
    {
      "versao": "V3.7.6",
      "data": "2026-08-15",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: achada a causa raiz do \"BT duplicada\" — 2 BTs diferentes com o mesmo número",
      "itens": [
        "Causa raiz real do bug que parecia insistir: era possível criar 2 BTs (documentos diferentes no banco) com o MESMO número — ambas apareciam como \"BT-1\" no seletor, e por serem documentos DIFERENTES, o bloqueio de duplicidade (que comparava só pelo ID interno) não pegava.",
        "Corrigido em 2 pontos: criar uma BT nova ou editar o número de uma já existente agora é bloqueado se o número já pertencer a outra BT da mesma concretagem. Além disso, o seletor de BT do popup de lançar por estaca agora compara também por NÚMERO (não só por ID) — protege contra o dado antigo que já ficou duplicado.",
        "Na tela \"Gerenciar BTs\", números repetidos entre documentos diferentes agora aparecem destacados em vermelho com um aviso — ajuda a achar e limpar manualmente o que já foi criado errado antes desta correção (os lançamentos da BT duplicada precisam ser conferidos e refeitos na BT certa antes de excluir a errada)."
      ],
      "legado": "V3.7.1.9"
    },
    {
      "versao": "V3.7.6.1",
      "data": "2026-08-15",
      "tipo": "melhoria",
      "titulo": "Relatório PDF de Terraplanagem: acumulados em todas as tabelas",
      "itens": [
        "Volume por dia: novas colunas Vol. Acumulado (m³) e % Acumulada (do total do período), mantendo Custo e R$ Acumulado — dá pra ver a evolução linha a linha.",
        "Viagens do período: novas colunas % Acumulada (do volume) e R$ Acumulado por viagem, além do valor de cada uma — a última linha fecha em 100% e no total gasto.",
        "Volume por material: além do % do volume, agora mostra também o % do custo de cada material (terra × entulho consomem fatias diferentes do dinheiro).",
        "Volume por caminhão: nova coluna % do volume total."
      ],
      "legado": "V3.7.1.10"
    },
    {
      "versao": "V3.7.6.2",
      "data": "2026-08-15",
      "tipo": "melhoria",
      "titulo": "Registrar Viagem: valor preenchido automaticamente pelo material digitado",
      "itens": [
        "Ao digitar o material no registro manual, o campo \"Valor da viagem (R$)\" já se preenche sozinho com o padrão daquele material (terra puxa o valor de terra, entulho o de entulho — definidos em 💰 Valores), com a indicação \"padrão de terra — pode alterar\".",
        "O campo continua totalmente editável: normalmente é o mesmo valor, mas cada viagem pode ter o seu — assim que você mexe no valor à mão, o preenchimento automático para de sobrescrever o que você digitou.",
        "Com o valor agora gravado explicitamente em cada viagem manual, mudar o padrão depois NÃO altera as viagens já registradas manualmente (só as importadas por planilha, que continuam usando o padrão do material)."
      ],
      "legado": "V3.7.1.11"
    },
    {
      "versao": "V3.8.0",
      "data": "2026-08-15",
      "tipo": "correcao",
      "titulo": "Levantamento de Terraplanagem: sistema de cálculo reescrito — áreas + cotas + grade automática de 1,5m",
      "itens": [
        "O modo \"🖼️ Marcar no Projeto\" estava errado (marcava ponto por ponto dentro de uma seção escolhida à mão) — reescrito do zero pro jeito certo: 1) desenha uma ou mais Áreas (polígono) no projeto e define a Cota Final de cada uma; 2) marca pontos de Cota Superior (a cota do terreno) dentro das áreas; 3) clica em \"▦ Gerar Seções\" e o sistema divide cada área numa grade de linhas horizontais e verticais de 1,5 em 1,5 metro, interpola a cota do terreno em cada linha a partir dos pontos marcados, calcula a área de cada linha (cota superior − cota final ao longo da seção) e o volume entre seções vizinhas — mesma fórmula de sempre: (área 1 + área 2)/2 × distância.",
        "Volume final = média entre a soma das seções horizontais e a soma das verticais — os dois métodos calculados de forma independente, como pedido, e não mais misturados.",
        "Pode ter mais de uma área (ex: dois blocos diferentes da obra, cada um com sua própria cota final) — cada área aparece com uma cor própria no projeto, e a lista embaixo mostra/permite editar a cota final e remover.",
        "Tipos de caminhão deixaram de ser fixos (só Grande/Pequeno) — em ⚙️ Config agora dá pra cadastrar quantos tipos precisar, cada um com nome e capacidade próprios (ex: \"Barra Azul\").",
        "Seções geradas pela grade continuam 100% editáveis como texto (cotas, distâncias, cota final) — se precisar corrigir um ponto específico depois de gerar, é só abrir a seção e ajustar direto."
      ],
      "legado": "V3.8.0"
    },
    {
      "versao": "V3.8.1",
      "data": "2026-08-16",
      "tipo": "correcao",
      "titulo": "Levantamento de Terraplanagem: corrigido bug real do 3D/volume com mais de uma área + nova tela \"Ver Seções\"",
      "itens": [
        "Causa raiz do 3D \"em outro formato\": quando havia mais de uma Área, o \"Gerar Seções\" juntava as seções de áreas DIFERENTES numa lista só ordenada por posição — a última seção de uma área virava \"vizinha\" da primeira da área seguinte, mesmo estando em lugares sem relação nenhuma. Isso inflava o volume com um vão fantasma (testei: um caso simples foi de 300m³ certo pra 7575m³ com o bug) e deformava o 3D, que tentava fazer um loft contínuo ligando as duas áreas.",
        "Corrigido: cada área agora é marcada (areaId) e só é considerada \"vizinha\" de outra seção da MESMA área — a fronteira entre áreas aparece na lista como \"· fim desta área ·\" em vez de uma distância/volume errados. O 3D também passou a desenhar cada área como um sólido independente, lado a lado, nunca conectando o loft entre áreas diferentes.",
        "3D confirmado: topo = cota superior marcada (interpolada), fundo = cota final da área — já estava assim, mas ficava distorcido pelo bug acima.",
        "Nova tela \"👁️ Ver Seções\": mostra a planta com todas as linhas de seção desenhadas (clique numa linha ou na lista pra selecionar) e, embaixo, o perfil lateral 2D da seção escolhida — terreno x cota final, com o trecho em VERDE onde o terreno está acima da referência (corte) e em VERMELHO onde está abaixo. É assim que dá pra ver na hora por que uma área específica saiu negativa: quando o vermelho (terreno abaixo da cota final ali) pesa mais que o verde na seção."
      ],
      "legado": "V3.8.1"
    },
    {
      "versao": "V3.8.1.1",
      "data": "2026-08-16",
      "tipo": "melhoria",
      "titulo": "Área: mostra a dimensão real (metros) pra diagnosticar área pequena demais ou escala calibrada errada",
      "itens": [
        "Confirmado: o número de seções geradas depende do tamanho da ÁREA que você desenha (dividida em grade de 1,5m) — se a área desenhada for menor que o prédio todo, sai menos seção mesmo, é esperado. Se o prédio é irregular (tipo um P), as seções de fato ficam mais curtas onde não tem prédio, mas continuam cobrindo toda a largura marcada.",
        "Ao concluir uma área agora aparece um aviso com a dimensão REAL dela (largura × altura em metros, calculada pela escala) — compare com uma medida que você já sabe (ex: a cota impressa na própria planta) pra confirmar se a área ficou do tamanho certo ou se a escala foi calibrada errada.",
        "A tabela de áreas (dentro do painel do projeto) também ganhou a coluna \"Dimensões (m)\" com a mesma informação, sempre visível."
      ],
      "legado": "V3.8.1.1"
    },
    {
      "versao": "V3.8.2",
      "data": "2026-08-16",
      "tipo": "correcao",
      "titulo": "3D: corrigido o formato errado em áreas irregulares (T virando L) + Ver Seções reformulado",
      "itens": [
        "Causa raiz do 3D com formato errado (\"T\" saindo como \"L\"): pra montar o 3D, cada linha de seção era esticada pra caber num intervalo padronizado de 0 a 1, sem guardar a posição/largura REAL dela dentro da área — então uma linha estreita (numa parte fina do prédio) virava do mesmo tamanho que uma linha larga (na parte cheia), distorcendo todo o formato. Corrigido: cada linha agora guarda o deslocamento real (metros) desde o início da área, e o 3D usa essa posição de verdade — larguras e deslocamentos diferentes aparecem exatamente onde são no prédio.",
        "\"👁️ Ver Seções\" reformulado: em vez de mostrar as 30+ linhas juntas (impossível de ler), agora só a seção SELECIONADA aparece riscada (em vermelho) na planta — as outras ficam apagadas.",
        "Mapa da planta bem maior (quase a tela toda) e com zoom/pan: botões ➕/➖/🔄 Resetar, além de dar scroll pra zoom e arrastar pra mover (quando tem zoom aplicado).",
        "Se a seção não tiver posição salva (foi gerada antes desta função existir), agora avisa pra gerar de novo em vez de simplesmente não mostrar nada."
      ],
      "legado": "V3.8.1.2"
    },
    {
      "versao": "V3.8.3",
      "data": "2026-08-16",
      "tipo": "correcao",
      "titulo": "Nova opção por área: Elevação x Profundidade — resolve as áreas saindo negativas",
      "itens": [
        "Causa raiz do \"área negativa\": o sistema sempre assumiu ELEVAÇÃO (nº maior = mais alto, cota do terreno maior que a cota final — padrão topografia). Só que em obra medida por PROFUNDIDADE a partir de uma referência (ex: térreo = cota 0, e o número CRESCE conforme desce), é o contrário: a cota final (mais funda) tem número MAIOR que a cota do terreno marcada (mais rasa, mais perto do térreo) — com a fórmula antiga isso sempre dava negativo.",
        "Ao concluir uma área agora pergunta a convenção: Profundidade (nº maior = mais embaixo) ou Elevação (nº maior = mais alto, padrão). Dá pra trocar depois também, direto na tabela de áreas (botão ⬇️ Profundidade / ⬆️ Elevação).",
        "A escolha afeta tudo: cálculo de área/volume da seção, cores do 3D (verde=raso/vermelho=fundo) e do perfil lateral em \"Ver Seções\", e a posição visual — sempre respeitando o que você digitou (os números mostrados na tela continuam exatamente os que você marcou, só a lógica interna de qual é \"mais alto\"/\"mais baixo\" muda).",
        "Testado com o exemplo real (cota final 7,18 profundidade, terreno marcado 4,9): sem a correção dava -9,12 m², com \"Profundidade\" marcado dá +9,12 m² — confere com o esperado (2,28m de altura de escavação × 4m de largura)."
      ],
      "legado": "V3.8.2"
    },
    {
      "versao": "V3.8.3.1",
      "data": "2026-08-16",
      "tipo": "melhoria",
      "titulo": "Área: separa \"Caixa\" (bounding box) de \"Área Real\" — deixa claro que não é a mesma coisa",
      "itens": [
        "A coluna \"Dimensões (m)\" mostrava largura × altura da CAIXA que envolve o polígono da área — não o formato real dela. Se a área desenhada é irregular (L, T, etc.), a caixa sempre parece maior do que a área de verdade, o que confundia (ex: área com formato de L pequeno mostrando uma caixa de 52m).",
        "Agora a tabela mostra as duas coisas separadas: \"Caixa (m)\" (só referência, largura × altura do retângulo envolvente) e \"Área Real (m²)\" (o tamanho de verdade do polígono desenhado, calculado certo mesmo pra formatos irregulares)."
      ],
      "legado": "V3.8.2.1"
    },
    {
      "versao": "V3.8.3.2",
      "data": "2026-08-17",
      "tipo": "melhoria",
      "titulo": "Dashboard: seletor Extras + gráfico de Terraplanagem",
      "itens": [
        "O checkbox \"Mostrar Fundação e Estrutura\" do topo virou o seletor \"➕ Extras\": um menu com as seções extras do Dashboard pra ligar/desligar — Fundação e Estrutura, e agora Terraplanagem.",
        "Nova seção 🚜 Terraplanagem (ao lado de Fundação e Estrutura): infos rápidas em cards — volume previsto (m³ empolado, das seções do Levantamento), volume removido, terra × entulho, % concluído, saldo restante, nº de viagens (caminhões), média m³/dia e custo total.",
        "Gráfico por dia: barras empilhadas de volume (🟤 terra + 🧱 entulho) com o nº de caminhões do dia em cima e o custo do dia embaixo — mesma pegada visual do gráfico de Fundação e Estrutura.",
        "A seção some sozinha quando a obra não tem terraplanagem lançada, e os dados vêm direto do Controle de Terraplanagem (link no rodapé da seção)."
      ],
      "legado": "V3.8.2.2"
    },
    {
      "versao": "V3.8.4",
      "data": "2026-08-16",
      "tipo": "correcao",
      "titulo": "Causa raiz de vez do 3D errado: prédio com reentrância cruzava a grade em pedaços separados, e o sistema colava um no outro",
      "itens": [
        "Prédio com formato L/T/U (não-convexo) faz uma linha da grade (1,5m) cruzar o polígono em MAIS DE UM pedaço separado (ex: um braço de cada lado de um pátio/reentrância). O sistema tratava tudo como um pedaço só, \"colando\" o lado esquerdo ao direito por cima do vazio — aí sim o 3D saía deformado e o volume incluía área que não existe.",
        "Corrigido: cada linha da grade agora é dividida nos pedaços contínuos de verdade, e os pedaços são agrupados em CADEIAS (cada \"braço\" do prédio rastreado de linha em linha, por sobreposição de posição) — cada cadeia vira seu próprio sólido independente no 3D, lado a lado, nunca ligando partes sem relação.",
        "No caminho, achei e corrigi um bug na própria implementação dessa correção (a distância entre linhas da mesma cadeia estava sendo calculada errado depois de juntar tudo num array só, e isso zerava o volume). Testado num prédio simulado em U com pátio no meio: reconhece as 2 cadeias certas e o volume bate com a área real × altura (dentro da margem normal de discretização da grade)."
      ],
      "legado": "V3.8.4"
    },
    {
      "versao": "V3.8.5",
      "data": "2026-08-17",
      "tipo": "correcao",
      "titulo": "Menu Extras não fica mais escondido atrás do conteúdo",
      "itens": [
        "O menu do seletor ➕ Extras abria por trás do hero do Dashboard: o cabeçalho da página tinha overflow escondido (cortava o dropdown) e ficava abaixo do conteúdo na pilha. Cabeçalho agora fica acima do conteúdo e o corte de título longo passou pro elemento do título — o menu abre por cima de tudo."
      ],
      "legado": "V3.8.5"
    },
    {
      "versao": "V3.8.5.1",
      "data": "2026-08-17",
      "tipo": "melhoria",
      "titulo": "Controle de Estacas: agora dá pra editar número/data/descrição de uma concretagem já criada",
      "itens": [
        "Achada a causa raiz do relatório de concretagem mostrando menos dias do que deveria: o fluxo rápido de criar concretagem (digitar um número novo direto no popup de atribuir peça) sempre criava com a DATA DE HOJE, sem perguntar nada — e não existia nenhuma forma de corrigir isso depois. Concretagens criadas em dias diferentes de planejamento, mas com a mesma data de criação, ficavam todas com a mesma data errada, e o relatório (que agrupa por data) mostrava menos dias distintos do que o real.",
        "Cada card de concretagem no Planejamento ganhou um botão \\\"✎\\\" — abre um mini-formulário pra corrigir número, data e descrição. Bloqueia se o número escolhido já for de outra concretagem.",
        "O fluxo rápido de criar concretagem pelo popup agora avisa claramente que a data virou \\\"hoje\\\" e que pode ser corrigida pelo ✎ do card, em vez de deixar passar em silêncio.",
        "Concretagem sem data cadastrada aparece com aviso em vermelho \\\"sem data\\\" no card, pra achar fácil as que precisam de correção."
      ],
      "legado": "V3.8.6"
    },
    {
      "versao": "V3.8.6",
      "data": "2026-08-17",
      "tipo": "correcao",
      "titulo": "Terraplanagem do Dashboard voltou a funcionar",
      "itens": [
        "Marcar 🚜 Terraplanagem no menu Extras não fazia nada e a marcação se perdia ao recarregar: uma atualização paralela dos scripts do dashboard.html derrubou o arquivo da seção (dashboard-terraplanagem.js) e o motor de cálculo (terraplanagem-calculos.js). Os dois voltaram pra página.",
        "Com a seção ligada e a obra ainda sem viagens/seções lançadas, agora aparece um aviso orientando onde lançar — antes o card sumia em silêncio e parecia que o botão não funcionava."
      ],
      "legado": "V3.8.7"
    },
    {
      "versao": "V3.8.6.1",
      "data": "2026-08-17",
      "tipo": "melhoria",
      "titulo": "Controle de Estacas: campo de data direto no popup de atribuir à concretagem",
      "itens": [
        "Popup \"Atribuir à Concretagem\" ganhou um campo de data ao lado do número, na seção \"criar/atribuir um número novo\" — se o número digitado for novo, a concretagem já nasce com essa data (em vez de sempre hoje, precisando editar depois pelo ✎ do card).",
        "A data só é usada quando cria uma concretagem nova; atribuindo a um número já existente, a data dela não muda."
      ],
      "legado": "V3.8.8"
    },
    {
      "versao": "V3.8.7",
      "data": "2026-08-16",
      "tipo": "correcao",
      "titulo": "3D: causa raiz de vez — agora a vista de cima bate exatamente com a planta",
      "itens": [
        "Achada a causa raiz definitiva do 3D com formato errado: a posição de cada linha no eixo de profundidade era um ACÚMULO artificial de distâncias entre seções (com gaps inventados nas fronteiras entre cadeias/áreas) — não a posição real dela na planta. Isso desconectava totalmente o 3D da planta.",
        "Corrigido: agora usa a posição REAL (a mesma coordenada da grade de 1,5m) em vez do acúmulo. Testado com um prédio em T simulado: a reconstrução por posição real bate exatamente com o formato esperado (barra larga de um lado, perna estreita do outro, no lugar certo) — visto de cima, o 3D agora é o mesmo formato da planta.",
        "Perfil lateral (\"Ver Seções\") ganhou um resumo numérico embaixo do gráfico: 🟩 Corte (soma só da parte positiva, acima da cota final) · 🟥 Aterro (soma só da parte negativa, abaixo) · Líquido (o resultado final, que pode ser negativo se o aterro pesar mais que o corte naquela seção específica — a área total nunca é \"impossível\", é a soma normal dessas duas partes). Vermelho também ficou bem mais forte no desenho pra não passar batido."
      ],
      "legado": "V3.8.9"
    },
    {
      "versao": "V3.8.8",
      "data": "2026-08-16",
      "tipo": "correcao",
      "titulo": "\"Ver Seções\": a linha riscada aparecia fora da planta (desalinhada)",
      "itens": [
        "A imagem da planta em \"Ver Seções\" usava um encaixe que deixa barra preta nas laterais quando a proporção da planta não é igual à da caixa (comum, já que cada projeto tem um formato diferente) — só que o desenho da linha por cima (a seção selecionada, em vermelho) sempre cobria a caixa inteira, incluindo essas barras pretas, então a posição da linha saía toda desalinhada, podendo aparecer fora da planta de verdade.",
        "Corrigido: a caixa agora respeita a proporção real da imagem (sem sobra nem corte), então a linha vermelha sempre cai em cima da planta, na posição certa. O painel \"Marcar no Projeto\" (onde você desenha áreas e marca cotas) não tinha esse problema — lá a imagem sempre ocupava a largura toda sem barra, então clique e desenho já batiam certo."
      ],
      "legado": "V3.8.10"
    },
    {
      "versao": "V3.8.8.1",
      "data": "2026-08-17",
      "tipo": "melhoria",
      "titulo": "Gráfico de Terraplanagem com unidade m³ nos rótulos",
      "itens": [
        "O número em cima de cada barra do gráfico de Terraplanagem agora mostra a unidade: \"416 m³\" em vez de só \"416\"."
      ],
      "legado": "V3.8.10.1"
    },
    {
      "versao": "V3.8.8.2",
      "data": "2026-08-17",
      "tipo": "melhoria",
      "titulo": "Botão Gerar Relatório de Terraplanagem direto do Dashboard",
      "itens": [
        "A seção 🚜 Terraplanagem do Dashboard ganhou o botão \"📊 Gerar relatório\" em cima do gráfico: um clique abre o relatório de período do Controle de Terraplanagem já com o modal aberto e as datas preenchidas — sem precisar navegar e procurar o botão lá dentro.",
        "É o MESMO relatório do Controle (uma fonte única de cálculo): prévia com KPIs e gráfico, PDF pra baixar e compartilhar."
      ],
      "legado": "V3.8.10.2"
    },
    {
      "versao": "V3.8.8.3",
      "data": "2026-08-17",
      "tipo": "melhoria",
      "titulo": "Relatório de Terraplanagem gerado DENTRO do Dashboard",
      "itens": [
        "O botão 📊 Gerar relatório da seção Terraplanagem agora abre o relatório ali mesmo, num painel sobre o Dashboard — sem navegar pro Controle. Já abre com o período completo calculado; é ajustar as datas se quiser, baixar o PDF ou compartilhar.",
        "Por baixo, o relatório virou um módulo compartilhado (js/terraplanagem-relatorio.js) usado pelas duas telas — Controle e Dashboard geram exatamente o mesmo PDF, sem risco de divergência de cálculo.",
        "O botão 📄 Relatório do Controle de Terraplanagem continua funcionando igual, agora apontando pra essa fonte única."
      ],
      "legado": "V3.8.10.3"
    },
    {
      "versao": "V3.8.9",
      "data": "2026-08-16",
      "tipo": "correcao",
      "titulo": "3D achatado corrigido (escala vertical separada) + removida a coluna \"Caixa\" que confundia",
      "itens": [
        "O 3D usava a MESMA escala pra planta (X/Z, geralmente dezenas de metros) e pra profundidade do corte (Y, geralmente só alguns metros) — como a profundidade é sempre muito menor que o tamanho do prédio, o resultado saía achatado (ex: num prédio de 52m com corte de 3m, a altura na cena ficava com menos de 7 unidades, quase imperceptível).",
        "Agora a escala vertical (profundidade) é calculada separada da horizontal, com exagero visual pra ficar sempre bem visível (30 unidades de cena, independente do tamanho da planta) — a vista de cima continua 100% fiel à planta, só a altura fica exagerada de propósito pra dar pra ver o corte.",
        "Removida a coluna \"Caixa (m)\" da tabela de áreas — só confundia (parecia que a área tinha formato de retângulo). Ficou só \"Área Real (m²)\", que é o que importa."
      ],
      "legado": "V3.8.10.4"
    },
    {
      "versao": "V3.8.10",
      "data": "2026-08-16",
      "tipo": "correcao",
      "titulo": "Causa raiz REAL da área negativa: recalcArea sobrescrevia o valor certo com o sinal errado a cada render",
      "itens": [
        "Achado o bug de verdade: \"Gerar Seções\" calculava a área CERTA (respeitando elevação/profundidade), mas toda vez que a tela renderizava de novo — o que acontece o tempo todo, incluindo só de abrir \"Ver Seções\" — uma função interna (recalcArea) recalculava a área SEM aplicar o sinal da convenção, sobrescrevendo o valor certo com a fórmula de elevação sempre. Por isso a área do resumo Corte/Aterro (que tinha sua própria conta, correta) batia positiva, mas o número \"Área\" mostrado em cima saía negativo — os dois deveriam ser iguais e não eram.",
        "Corrigido — recalcArea agora aplica o mesmo sinal de elevação/profundidade que o \"Gerar Seções\" usa. Testado com os números reais (cota final 7,18 profundidade, terreno raso ~4,9): área agora sai positiva e igual ao \"Líquido\" mostrado no resumo Corte/Aterro.",
        "Comprimento da seção também corrigido: a seção sempre parava no último ponto da GRADE de amostragem (de 0,5 em 0,5m), nunca exatamente no limite real da área desenhada — por isso um prédio de 52,04m aparecia com ~51m. Agora a borda de cada seção é ajustada por bisseção até bater com o limite verdadeiro do polígono. Testado: comprimento sai 52,040 exato."
      ],
      "legado": "V3.8.11"
    },
    {
      "versao": "V3.8.11",
      "data": "2026-08-17",
      "tipo": "correcao",
      "titulo": "Gerar Relatório de Terraplanagem não respondia ao clique",
      "itens": [
        "O motor de cálculo (terraplanagem-calculos.js) era declarado como const de topo — que NÃO vira window.TerraplanagemCalculos — e o relatório compartilhado buscava por window.*: o clique em Gerar Relatório quebrava em silêncio. O motor agora é exposto explicitamente no window (com fallback duplo no relatório).",
        "De quebra, o card \"Volume previsto\" do gráfico de Terraplanagem do Dashboard, que dependia do mesmo motor, volta a aparecer quando há Levantamento.",
        "O botão Gerar agora tem tratamento de erro visível: se algo falhar, aparece um aviso em vez de nada acontecer."
      ],
      "legado": "V3.8.12"
    },
    {
      "versao": "V3.8.12",
      "data": "2026-08-16",
      "tipo": "correcao",
      "titulo": "3D deformado (\"caixa com torre\") corrigido + comprimento visível em \"Ver Seções\"",
      "itens": [
        "O exagero vertical do 3D (adicionado pra corrigir o achatamento) não tinha limite — em seções com corte bem menor que o tamanho do prédio, o exagero ficava tão grande que virava uma distorção tipo \"caixa com torre\" em vez de um terreno. Agora tem um teto: no máximo 4x a escala horizontal, suficiente pra ver o corte sem virar uma caricatura.",
        "Ângulo inicial da câmera também mudou: antes começava quase de lado (~28° de elevação, mostrando principalmente a parede da ponta) — agora começa numa vista aérea 3/4 (~53°), mais parecida com a vista de cima. Continua podendo girar livre com o mouse.",
        "\"Ver Seções\" agora mostra o Comprimento da seção junto com a Área no cabeçalho — pra conferir direto se bate com a medida esperada, sem precisar abrir a seção na lista embaixo."
      ],
      "legado": "V3.8.13"
    },
    {
      "versao": "V3.8.12.1",
      "data": "2026-08-17",
      "tipo": "melhoria",
      "titulo": "Relatório de Terraplanagem blindado contra cache antigo",
      "itens": [
        "O módulo do relatório agora acessa o motor de cálculo por referência direta (com fallback via window) — o erro \"Cannot read properties of undefined (reading 'num')\", que acontecia em páginas servidas do cache anterior à V3.8.12, não tem mais como ocorrer.",
        "Se o Gerar Relatório não abrir a prévia, faça um hard refresh (Ctrl+Shift+R): o navegador pode estar segurando o dashboard.html antigo."
      ],
      "legado": "V3.8.13.1"
    },
    {
      "versao": "V3.8.13",
      "data": "2026-08-16",
      "tipo": "correcao",
      "titulo": "Zoom/pan no painel do projeto (pra calibrar com precisão) + 3D simplificado (removidas as paredes que pareciam caixa)",
      "itens": [
        "Painel \"Marcar no Projeto\" (onde calibra a escala, desenha áreas e marca cotas) ganhou os mesmos controles de zoom/pan do \"Ver Seções\" — dá pra ampliar bem de perto pra calibrar com precisão, clicando exatamente nos dois pontos certos de uma medida conhecida na planta. Arrastar com zoom aplicado dá pan; clique sem arrastar continua marcando o ponto normalmente (as duas ações não se confundem mais).",
        "3D: removidas as \"paredes\" sólidas nas pontas de cada seção — eram elas que, junto com o exagero vertical, davam a impressão de uma caixa/torre em vez de um terreno. Ficou só a superfície do terreno (colorida por profundidade) e o plano de referência translúcido embaixo.",
        "Exagero vertical também reduzido (teto de 2x a escala horizontal, era 4x) — mais conservador, prioriza não distorcer sobre ficar bem alto."
      ],
      "legado": "V3.8.14"
    },
    {
      "versao": "V3.8.14",
      "data": "2026-08-16",
      "tipo": "correcao",
      "titulo": "Zoom/pan \"correndo pra longe\" durante arrasto — causa era a transição CSS suave",
      "itens": [
        "O zoom/pan (tanto no \"Marcar no Projeto\" quanto no \"Ver Seções\") tinha uma transição suave (0,05s) pra deixar o clique nos botões ➕➖ mais bonito. Só que durante um ARRASTO ou SCROLL contínuo, os eventos chegam mais rápido que essa animação — a tela fica tentando alcançar cada posição nova e nunca chega, dando a impressão de que a imagem \"corre pra longe\" a cada movimento.",
        "Removida a transição — agora o zoom/pan responde 1:1 com o dedo/mouse, sem atraso nem efeito elástico.",
        "De quebra, o arrasto agora captura o ponteiro (setPointerCapture) — continua funcionando direto mesmo se o mouse sair rápido da área da imagem no meio do movimento."
      ],
      "legado": "V3.8.14.1"
    },
    {
      "versao": "V3.8.15",
      "data": "2026-08-16",
      "tipo": "correcao",
      "titulo": "Zoom no scroll agora segue o cursor (antes sempre ampliava a partir do centro)",
      "itens": [
        "Causa raiz de \"a imagem corre e fica tudo preto\" ao dar zoom com o scroll: o zoom sempre ampliava a partir do CENTRO da imagem, nunca de onde o mouse estava. Se você rolava o scroll olhando pra um canto, o que você queria ver se afastava cada vez mais do centro a cada tick de zoom, até sair da área visível — sobrando só o fundo preto do painel.",
        "Corrigido nos dois lugares (\\\"Marcar no Projeto\\\" e \\\"Ver Seções\\\"): o zoom no scroll agora mantém o ponto exatamente sob o cursor fixo na tela, como no Google Maps — dá pra ficar olhando pra qualquer canto e ir ampliando ali direto, sem sair correndo.",
        "Testado com simulação: 6 zooms consecutivos num ponto bem excêntrico (canto), o ponto ficou travado sob o cursor em todos eles."
      ],
      "legado": "V3.8.14.2"
    },
    {
      "versao": "V3.8.16",
      "data": "2026-08-16",
      "tipo": "correcao",
      "titulo": "Causa raiz de vez: clicar pra marcar um ponto deixava a imagem \"presa\" no mouse depois",
      "itens": [
        "Achado o bug real do \"clico e a imagem fica travada no mouse, persegue qualquer movimento\": marcar um ponto (cota, canto de área, calibração) recria o painel do projeto do zero — e o código novo de arrastar/zoom não tinha nenhuma trava contra isso. No PRIMEIRO movimento do mouse depois de marcar um ponto (mesmo sem clicar de novo, só passar o mouse), a distância era calculada a partir de um valor zerado por padrão em vez da posição real — dava um número gigante, ativava o \"modo arrastar\" na hora, e a partir daí qualquer movimento (com ou sem o botão apertado) arrastava a planta.",
        "Corrigido: agora só entra em modo de arrastar depois de um clique de verdade NESTA versão do painel (nunca herda estado de antes de marcar um ponto). Também tratado o cancelamento do ponteiro (ex: perder o toque na tela) pra nunca deixar o arrasto \"travado\" ligado."
      ],
      "legado": "V3.8.14.3"
    },
    {
      "versao": "V3.8.17",
      "data": "2026-08-16",
      "tipo": "correcao",
      "titulo": "Marcadores (calibração, área, cota) não crescem mais junto com o zoom",
      "itens": [
        "Os pontinhos marcados na planta (ponto de calibração, cantos de área, pontos de cota) tinham tamanho fixo em pixels — como eles ficam DENTRO da imagem que é ampliada pelo zoom, na prática cresciam junto: com bastante zoom, um marcador de 14px virava uma bola gigante, cobrindo exatamente o ponto que você precisava enxergar pra calibrar com precisão.",
        "Corrigido: os marcadores agora contra-escalam com o zoom (ficam menores dentro da imagem na mesma proporção que ela é ampliada), então o tamanho deles na TELA fica sempre igual, não importa o quanto você tenha ampliado — dá pra ver exatamente onde o ponto caiu."
      ],
      "legado": "V3.8.14.4"
    },
    {
      "versao": "V3.8.17.1",
      "data": "2026-08-16",
      "tipo": "melhoria",
      "titulo": "Diagnóstico de ponto de cota errado (achar o \"espinho\" isolado no 3D)",
      "itens": [
        "O \"prédio com pico\" que aparecia no 3D em meio a um terreno raso normalmente não é bug de renderização — é um ponto de cota digitado errado (ex: 78 em vez de 7,8), que faz a interpolação criar um espinho isolado bem ali, mesmo o resto do terreno estando consistente.",
        "Clique no número de \"Pontos de Cota\" de uma área (na tabela do painel do projeto) agora abre a lista de todos os pontos dela, ordenados por valor, com a mediana calculada — pontos bem diferentes da mediana aparecem destacados em vermelho com ⚠️, prontos pra editar (✎) ou remover (✕) ali mesmo.",
        "Testado com um terreno raso simulado (10 pontos entre 4,4 e 4,9) e um ponto digitado errado (78) — o sistema achou e marcou certinho."
      ],
      "legado": "V3.8.15"
    },
    {
      "versao": "V3.8.18",
      "data": "2026-08-16",
      "tipo": "correcao",
      "titulo": "3D agora compõe TODAS as áreas juntas na posição real da planta (não mais cada uma isolada)",
      "itens": [
        "Causa raiz de mais uma versão do \\\"formato errado\\\": quando havia mais de uma área, o 3D desenhava cada uma separada, lado a lado, com um respiro artificial de 3m entre elas — em vez de posicionar cada uma no lugar REAL da planta. Isso desconectava totalmente a composição do terreno verdadeiro.",
        "Corrigido: agora toda seção (de qualquer área) usa a posição REAL dela na planta (mesma escala/calibração) — sem nenhum deslocamento artificial. Se duas áreas são vizinhas de verdade, aparecem vizinhas no 3D; se estão longe uma da outra, aparecem exatamente na distância real. Testado com 2 áreas simuladas adjacentes (1,5m de diferença real) — ficaram nas posições certas, sem gap inventado.",
        "Continua separando em sólidos diferentes só quando NÃO há conexão de verdade (cadeias diferentes, tipo braços separados por uma reentrância) — isso nunca foi o problema, o problema era o respiro artificial entre áreas inteiras."
      ],
      "legado": "V3.8.16"
    },
    {
      "versao": "V3.9.0",
      "data": "2026-08-16",
      "tipo": "funcionalidade",
      "titulo": "3D reescrito do zero: malha de grade 2D real (X e Y juntos) em vez de esticar seções de uma direção só",
      "itens": [
        "Causa raiz de verdade de todos os formatos estranhos do 3D até aqui: a malha era construída ESTICANDO as seções de UMA direção só (horizontal OU vertical, o que estivesse selecionado) — dava detalhe fino só numa direção e achatado/reto na outra, virando uma \\\"fita\\\" que de certos ângulos parecia 2D (uma linha).",
        "Reescrito: agora o 3D gera uma GRADE 2D de verdade (X e Y juntos, de 1,5 em 1,5m) direto dos pontos de cota marcados, igual pra qualquer área — a mesma interpolação usada no cálculo de área/volume, só que aplicada em toda a superfície, não só ao longo de linhas. Isso dá volume genuíno nas duas direções, não depende mais de qual direção (Horizontal/Vertical) está selecionada na tela — é uma cena só, sempre.",
        "Testado com um \\\"morro\\\" simulado (base 3m + pico 10m no centro, 20x20m): a grade capturou a variação certa nos dois eixos e o volume aproximado bateu bem maior que o de um terreno plano de mesma base, como esperado.",
        "Bônus: botão \\\"🔄 Resetar Câmera\\\" dentro do próprio 3D — se girar demais e a vista ficar confusa (de perfil, por exemplo), um clique volta pro ângulo padrão sem precisar fechar e abrir de novo.",
        "PDF do relatório agora traz só 1 snapshot 3D (a grade completa), não mais um por direção."
      ],
      "legado": "V3.9.0"
    },
    {
      "versao": "V3.9.0.1",
      "data": "2026-08-16",
      "tipo": "melhoria",
      "titulo": "Paredes sólidas no 3D (fecha o vão entre topo e fundo) + câmera com bem mais liberdade de giro",
      "itens": [
        "O 3D tinha um vão vazio entre a superfície do terreno (topo) e o plano de referência (fundo) — agora tem paredes sólidas fechando esse espaço, seguindo o CONTORNO REAL de cada área (inclusive em reentrâncias tipo L/T, não só um retângulo). Testado com um formato em U (pátio no meio): as paredes cobriram tanto a borda externa quanto a borda do pátio.",
        "Confirmado: cada área já usa a cota final DELA MESMA no fundo — se duas áreas têm referências diferentes, cada uma aparece na profundidade certa (isso já funcionava, sem bug).",
        "Câmera: giro vertical tinha um limite curto (~74°) que travava antes de chegar perto de olhar de cima — aumentado pra quase 90° nos dois sentidos.",
        "Novo botão \\\"⬇️ Ver de Cima\\\" ao lado do \\\"🔄 Resetar Câmera\\\" — um clique já posiciona a câmera quase direto de cima, pra comparar o formato do 3D com a planta sem precisar arrastar tentando acertar o ângulo."
      ],
      "legado": "V3.9.1"
    },
    {
      "versao": "V3.9.1",
      "data": "2026-08-16",
      "tipo": "correcao",
      "titulo": "\"Ver Seções\": lista voltava pro topo a cada clique",
      "itens": [
        "Clicar numa seção da lista reconstrói a tela (pra mostrar a seção selecionada) — e isso resetava o scroll da lista pro topo toda vez, obrigando rolar de novo até a seção seguinte quando navegando por várias seções em sequência.",
        "Corrigido: a posição do scroll agora é guardada antes e restaurada depois do clique — a lista fica parada onde estava."
      ],
      "legado": "V3.9.1.1"
    },
    {
      "versao": "V3.9.2",
      "data": "2026-08-16",
      "tipo": "correcao",
      "titulo": "3D: fecha o \"buraco\" na costura entre áreas vizinhas + área pequena (ex: reservatório) não some mais",
      "itens": [
        "Causa raiz do buraco entre áreas: cada área esticava a parede só até a PRÓPRIA cota final — se duas áreas vizinhas têm cota final diferente, ou a borda de uma não encosta 100% na da outra (imprecisão normal de clique ao desenhar), sobrava um vão vazio bem na costura. Corrigido: agora as paredes esticam até um piso global (bem abaixo da cota mais funda de TODAS as áreas), garantindo que duas paredes vizinhas sempre se sobrepõem por baixo, sem vão — o fundo (plano de referência) de cada área continua mostrando a profundidade certa dela, só a parede que estica mais.",
        "Causa raiz de área pequena (tipo reservatório) sumindo do 3D: o sistema exigia pelo menos 3 pontos de cota marcados numa área pra gerar qualquer coisa nela — áreas pequenas com só 1 ou 2 pontos marcados ficavam de fora inteiras, aparecendo como um buraco na posição delas. Corrigido: agora 1 ponto já basta (a interpolação funciona matematicamente com qualquer quantidade ≥1)."
      ],
      "legado": "V3.9.2"
    },
    {
      "versao": "V3.9.3",
      "data": "2026-08-16",
      "tipo": "correcao",
      "titulo": "3D: tampa sólida embaixo — o volume tava fechado nas laterais mas oco por baixo",
      "itens": [
        "Confirmado: as paredes laterais fechavam até o piso global, mas não tinha nenhuma tampa NAQUELE piso — o objeto ficava como uma caixa sem fundo, oca por dentro.",
        "Adicionada a tampa: mesma forma/contorno do topo (mesmo formato do prédio, inclusive reentrâncias), só achatada lá embaixo no piso global. Agora o volume é sólido de verdade — topo, quatro/mais lados e fundo, todos fechados."
      ],
      "legado": "V3.9.3"
    },
    {
      "versao": "V3.9.3.1",
      "data": "2026-08-16",
      "tipo": "funcionalidade",
      "titulo": "Nova convenção de cota: Relativa ao R.N. (o sinal digitado já é a altura, positivo=acima/negativo=abaixo)",
      "itens": [
        "Causa raiz de uma conta errada de verdade: o sistema só tinha \\\"Elevação\\\" e \\\"Profundidade\\\", mas tem projeto que mede diferente — o valor digitado JÁ É a altura com sinal em relação a uma referência (R.N.): positivo quando o ponto está ACIMA da referência (é corte), negativo quando está ABAIXO (é aterro), sempre, não importa o valor da própria referência. Nenhuma das duas opções antigas cobria isso.",
        "Nova convenção \\\"↕️ Relativa ao R.N.\\\": ao concluir uma área, agora pergunta as 3 opções (Profundidade / Relativa / Elevação). Pra áreas já criadas, clicar no botão de convenção na tabela agora CICLA entre as 3.",
        "Testado matematicamente: com a mesma dupla de pontos (+3 e -2, distância 10m), o resultado da área deu EXATAMENTE igual usando R.N.=0 ou R.N.=779,84 como referência — confirma que só o sinal digitado importa, como esperado."
      ],
      "legado": "V3.9.4"
    },
    {
      "versao": "V3.9.4",
      "data": "2026-08-16",
      "tipo": "correcao",
      "titulo": "3D: revertido o \"piso global\" — cada área volta a ter o fundo dela mesma (degrau real entre profundidades diferentes)",
      "itens": [
        "A correção anterior (piso único bem lá embaixo, pra fechar um vão entre áreas vizinhas) tinha um efeito colateral errado: nivelava TODAS as áreas na mesma profundidade lá embaixo, mesmo quando cada uma tem sua própria cota final. Se uma área é mais funda que a outra, o fundo TEM que formar um degrau real ali — não faz sentido físico ficar tudo liso.",
        "Revertido: paredes e o fundo (agora sólido, não mais translúcido) voltam a usar a cota final da PRÓPRIA área — cada área com sua profundidade certa, degrau de verdade onde uma é diferente da outra."
      ],
      "legado": "V3.9.5"
    },
    {
      "versao": "V3.9.5",
      "data": "2026-08-16",
      "tipo": "correcao",
      "titulo": "Removida a confusão de 3 convenções — só existe UM jeito, sempre: sinal relativo ao zero",
      "itens": [
        "As 3 opções (Elevação/Profundidade/Relativa) eram complexidade desnecessária — na prática o lançamento é sempre o mesmo: cota final é a profundidade de referência (zero), e cada cota do terreno é digitada com sinal em relação a esse zero — positivo = acima (corte), negativo = abaixo (aterro). Sempre assim, sem escolher nada.",
        "Removida a pergunta de convenção ao criar área, removido o botão de trocar na tabela — só sobrou o campo Cota Final, direto. Testado matematicamente: com cotas +2, -1 e +3 (cota final -5), a área bate exatamente com os trapézios calculados a partir dos valores digitados, sem depender do valor da cota final."
      ],
      "legado": "V3.9.6"
    },
    {
      "versao": "V3.9.6",
      "data": "2026-08-16",
      "tipo": "correcao",
      "titulo": "Corrigido de vez o cálculo: a versão anterior (V3.9.6) tinha um erro sério — cancelava a cota final da conta",
      "itens": [
        "A simplificação da V3.9.6 tentava fazer a cota digitada já ser a altura direta, mas a fórmula usada CANCELAVA a cota final da conta por engano — o resultado saía sempre igual ao valor bruto do terreno, ignorando totalmente a cota final. Num terreno com valores negativos (comum quando tudo é medido abaixo de uma referência zero), isso fazia TUDO sair aterro (negativo), mesmo terreno claramente mais alto que a cota final.",
        "Corrigido: a altura volta a ser a subtração padrão (cota do terreno MENOS cota final) — que já funciona certo com valores negativos dos dois lados, sem precisar de nenhum ajuste especial. Testado com os números reais (terreno -4,5/-4,9, cota final -7,18): deu +24,80 m² positivo (corte, correto). Testado também o caso inverso (terreno já mais fundo que a cota final): deu negativo (aterro), como devia."
      ],
      "legado": "V3.9.7"
    },
    {
      "versao": "V3.9.6.1",
      "data": "2026-08-16",
      "tipo": "melhoria",
      "titulo": "Perfil lateral (\"Ver Seções\") ganhou a linha de referência Cota 0",
      "itens": [
        "O gráfico só mostrava a linha da Cota Final (laranja) — agora mostra também uma linha pontilhada cinza marcando a Cota 0 (o zero de referência), separada da cota final. O gráfico se ajusta pra sempre incluir o zero na área visível, mesmo se ele estiver bem longe do terreno ou da cota final."
      ],
      "legado": "V3.9.8"
    },
    {
      "versao": "V3.10.0",
      "data": "2026-08-16",
      "tipo": "funcionalidade",
      "titulo": "Seção atravessa direto de uma área pra outra — a cota final agora varia ponto a ponto, sem quebrar a seção",
      "itens": [
        "Causa raiz de vez do \\\"a seção para no meio\\\": cada seção era gerada dentro de UMA área só — ao cruzar pra uma área vizinha (mesmo sendo fisicamente o mesmo corte contínuo, só com uma cota final diferente), a seção quebrava em duas, porque cada área só conhecia o próprio polígono. Isso está errado pra o caso real: duas áreas vizinhas com cotas finais diferentes formam UM corte só, com um degrau na referência no meio — não duas seções separadas.",
        "Reescrita a geração: agora todas as áreas são consideradas JUNTAS numa passada só. Uma linha de grade atravessa direto de uma área pra outra vizinha — só a cota final usada muda no meio (criando o degrau real na conta), a seção continua sendo UMA coisa só, com um comprimento só. A seção só quebra em duas de verdade quando não há NENHUMA área cobrindo aquele trecho (vazio de verdade) ou numa reentrância/pátio.",
        "O gráfico do perfil lateral (\\\"Ver Seções\\\") agora desenha a linha da Cota Final em DEGRAU (não mais uma reta única) — mostra o salto de verdade onde a seção passa de uma área pra outra, e avisa no rótulo quando isso acontece.",
        "Testado com o cenário exato do exemplo (2 áreas adjacentes, cotas finais -7,8 e -10,8): a seção saiu como UMA peça só, cobrindo os ~40m completos sem quebra, com a área já considerando o degrau certo em cada trecho."
      ],
      "legado": "V3.10.0"
    },
    {
      "versao": "V3.10.1",
      "data": "2026-08-16",
      "tipo": "correcao",
      "titulo": "3D também unificado (mesma correção da V3.10.0) — sem buraco/vão entre áreas vizinhas",
      "itens": [
        "A V3.10.0 unificou as SEÇÕES (área/volume), mas o 3D continuava construindo a malha por área SEPARADA — duas áreas vizinhas viravam dois sólidos distintos, com parede nos dois lados da fronteira, aparecendo como um vão/buraco ali mesmo sem ter buraco nenhum no projeto.",
        "Aplicada a mesma correção no 3D: agora gera UMA grade de alturas cobrindo todas as áreas juntas — cada célula sabe a qual área pertence (cota final própria, criando o degrau real onde muda), mas a malha é uma peça sólida só. Parede só aparece na borda de verdade (perímetro externo ou reentrância), nunca entre duas áreas que se tocam.",
        "No caminho, achado e corrigido outro bug: os pontos da grade nas bordas EXATAS caíam bem em cima da linha do polígono, onde o teste \\\"dentro ou fora\\\" fica ambíguo — isso sumia a borda inteira (não só a costura entre áreas). Corrigido encolhendo a amostragem por uma margem mínima. Testado: malha 100% completa, 0 células faltando, na simulação das 2 áreas adjacentes."
      ],
      "legado": "V3.10.1"
    },
    {
      "versao": "V3.10.2",
      "data": "2026-08-16",
      "tipo": "correcao",
      "titulo": "Tolerância de 30cm na costura entre áreas — corrige junção INCONSISTENTE (algumas seções juntavam, outras não)",
      "itens": [
        "Achada a causa do padrão inconsistente reportado (seções vizinhas, uma junta certo e outra não): se a borda de duas áreas vizinhas não encosta 100% perfeita (poucos centímetros de desvio ao clicar, invisível no zoom normal — quase impossível desenhar pixel-perfeito), o sistema tratava esse vão minúsculo como vazio de verdade — mas só em ALGUMAS posições da grade (as que calhavam de cair bem no vão), enquanto posições vizinhas passavam direto por sorte. Testado com uma simulação de borda levemente torta: reproduziu exatamente esse padrão (uma posição juntando, a próxima não).",
        "Corrigido com uma tolerância de 30cm: se um ponto da grade não cai dentro de nenhuma área, o sistema testa uma pequena vizinhança antes de considerar vazio de verdade — pequenos desvios de clique não quebram mais a seção. Aplicado tanto nas seções quanto no 3D. Testado com a mesma simulação: todas as posições passaram a dar o mesmo resultado (uma peça só, 40m completos)."
      ],
      "legado": "V3.10.2"
    },
    {
      "versao": "V3.10.2.1",
      "data": "2026-08-16",
      "tipo": "melhoria",
      "titulo": "Clicar num ponto de cota já marcado agora edita ele (em vez de criar um novo por cima)",
      "itens": [
        "No modo \"📍 Marcar Cota\", clicar perto de um ponto que já existe (dentro de 1m de tolerância) abre a edição do valor dele — apagar o texto e confirmar remove o ponto. Clicar num lugar vazio continua criando um ponto novo normalmente."
      ],
      "legado": "V3.10.3"
    },
    {
      "versao": "V3.10.3",
      "data": "2026-08-17",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: toque no mobile não seleciona mais a imagem inteira",
      "itens": [
        "No celular/tablet, tocar numa estaca às vezes acionava o menu nativo de \\\"selecionar/salvar imagem\\\" do navegador (comum no Safari/iOS) em vez de abrir o marcador — faltava a propriedade -webkit-touch-callout:none, que é a que desliga esse menu de toque prolongado (user-select:none sozinho não resolve isso no iOS).",
        "Adicionado -webkit-touch-callout:none e reforçado user-select:none na imagem da prancha e no mapa inteiro (herda pros marcadores) nas 3 abas."
      ],
      "legado": "V3.10.4"
    },
    {
      "versao": "V3.10.3.1",
      "data": "2026-08-17",
      "tipo": "funcionalidade",
      "titulo": "Levantamento: terreno interpola global (corrige salto na fronteira entre áreas) + volume das Estacas somado no total + giro do 3D no touch corrigido",
      "itens": [
        "Causa raiz do \"corte reto\" onde muda a área: o TERRENO era interpolado usando só os pontos de cota da própria área — na fronteira, o perfil pulava de um conjunto de pontos pro outro, dando um salto artificial mesmo sem cliff nenhum de verdade no solo. Corrigido: o terreno agora interpola com os pontos de TODAS as áreas juntos (é uma superfície física contínua, sem cliff nenhum só por causa de um limite administrativo) — só a Cota Final (o alvo/referência de projeto) continua variando por área, formando o degrau real só ali onde é pra formar.",
        "Novo: o Volume de Estacas (somado automaticamente do Controle de Estacas — campo Volume de todas as peças Fundação → Estacas) agora aparece separado (banco e com empolamento) e soma no VOLUME TOTAL DA OBRA, junto com o corte de terra. Aparece na tela e no relatório PDF.",
        "3D: no touch (celular/tablet), girar a câmera às vezes movia o fundo da página em vez de girar o 3D — faltava travar o toque (touch-action:none) no container e capturar o ponteiro. Corrigido."
      ],
      "legado": "V3.10.5"
    },
    {
      "versao": "V3.10.4",
      "data": "2026-08-17",
      "tipo": "correcao",
      "titulo": "Clicar num ponto de cota já marcado não abria o editor (só funcionava com \"Marcar Cota\" ativo)",
      "itens": [
        "A lógica de \"clicar num ponto existente edita/remove ele\" só rodava quando a ferramenta \\\"📍 Marcar Cota\\\" estava ativa — clicando sem nenhuma ferramenta selecionada (o normal ao só querer corrigir um valor), o clique não fazia nada.",
        "Corrigido: agora funciona igual COM ou SEM ferramenta ativa — clique num ponto marcado sempre abre o editor (apagar o valor e confirmar remove o ponto)."
      ],
      "legado": "V3.10.6"
    },
    {
      "versao": "V3.10.4.1",
      "data": "2026-08-17",
      "tipo": "melhoria",
      "titulo": "Editor de ponto de cota: popup de verdade (nada de prompt() do navegador) com Salvar/Mover/Excluir",
      "itens": [
        "Trocado o feio prompt() nativo do navegador por um popup próprio, com campo de cota, e três botões: 💾 Salvar, 📍 Mover e 🗑️ Excluir.",
        "\\\"Mover\\\": clica no botão, o popup fecha e o cursor vira mira — o próximo clique no mapa reposiciona esse ponto pra lá (sem precisar apagar e marcar de novo)."
      ],
      "legado": "V3.10.7"
    },
    {
      "versao": "V3.11.0",
      "data": "2026-08-17",
      "tipo": "funcionalidade",
      "titulo": "Controle de Terraplanagem: Viagens Atual/Total, Volume Total a Retirar (terra+estacas+fundação), Executado, Faltando e Valor Faltando",
      "itens": [
        "Novos KPIs na tela e no relatório PDF (Controle de Terraplanagem e botão do Dashboard, mesma fonte pros dois): \"Viagens Atual/Total\" (total estimado pelo volume total ÷ capacidade média dos caminhões cadastrados), \"Volume Total a Retirar\" (terra prevista + estacas do Controle de Estacas + fundação superficial, todos empolados), \"Volume Executado\", \"Volume Faltando\", \"Valor Faltando\" (viagens que faltam × custo médio já pago por viagem).",
        "\"Volume Fundação Superficial\" já aparece no esquema (card mostrando \"—\" por enquanto) — quando esse módulo existir, só precisa plugar a fonte de dados, a conta e a tela já estão prontas.",
        "Relatório de período agora mostra dois blocos: \"Resumo geral da obra\" (esses novos KPIs, sempre em relação a TUDO, não só o período escolhido) e depois os dados do período em si (como já era).",
        "Testado com números simulados: volume total 4.160 m³ (3.000 terra + 200 estacas, empolados 30%), 250 viagens já feitas — bateu 325 viagens totais estimadas, 75 faltando, R$ 26.250 faltando (pela média já paga de R$ 350/viagem)."
      ],
      "legado": "V3.11.0"
    },
    {
      "versao": "V3.11.1",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Controle de Estacas e Fundações: clicar em Fundações abria o mesmo projeto (prancha) das Estacas",
      "itens": [
        "Estacas e Fundações compartilhavam a mesma prancha ativa — trocar de aba não trocava de projeto, só filtrava os marcadores por cima da mesma imagem.",
        "Agora cada uma tem seu próprio projeto: a prancha ativa é lembrada separadamente por view, e a lista/criação de pranchas (📄 Pranchas) também é filtrada pela view atual.",
        "Pranchas já existentes continuam valendo como Estacas (comportamento de antes) — pra ter uma prancha de Fundações, é só trocar pra aba Fundações e importar uma nova."
      ],
      "legado": "V3.11.1"
    },
    {
      "versao": "V3.11.1.1",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Levantamento Piso: impermeabilização agora considera o rodapé separadamente da área",
      "itens": [
        "Ao marcar \\\"Considerar impermeabilização nesta área\\\", o popup ganhou dois novos controles: \\\"Considerar a área toda como impermeabilizada\\\" (m² da área) e \\\"Considerar o rodapé como impermeabilizado\\\" (ml × altura).",
        "Altura do rodapé impermeabilizado com presets rápidos (Box 1,20m · Padrão 0,40m · Baixo 0,20m) e campo numérico livre pra digitar qualquer valor.",
        "O m² de rodapé impermeabilizado (ml do rodapé selecionado × altura informada) agora soma no total de M² de Impermeabilização em todos os lugares: painel do workspace, Visão Geral e breakdown por tipo.",
        "Compatibilidade com áreas já lançadas antes desta versão: continuam contando a área toda como impermeabilizada (comportamento antigo), sem precisar re-editar nada."
      ],
      "legado": "V3.11.1.1"
    },
    {
      "versao": "V3.11.2",
      "data": "2026-08-17",
      "tipo": "correcao",
      "titulo": "Volume Fundação Superficial: dado real (Controle de Estacas e Fundações), não mais placeholder",
      "itens": [
        "A sessão paralela criou a view real de \"Fundações\" no Controle de Estacas e Fundações (peças tipo Fundação com subtipo diferente de Estacas — blocos, baldrames, etc.). O card \"Vol. Fundação Superficial\" (Levantamento, Controle de Terraplanagem e relatório PDF), que antes mostrava sempre \"—\" como placeholder, agora soma esse volume de verdade automaticamente.",
        "Testado: peças de Fundação com subtipo Estacas somam separado das com outros subtipos (Bloco, Baldrame, etc.) — confirmado que a separação bate certo e não mistura com peças de Estrutura."
      ],
      "legado": "V3.11.2"
    },
    {
      "versao": "V3.11.3",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: mapa utilizável no celular e no tablet",
      "itens": [
        "A tela não fica mais azul ao tocar numa estaca. A V3.10.4 já tinha tratado a seleção de texto e o menu do iOS, mas faltava o realce de toque do Android (-webkit-tap-highlight-color): tocar num elemento com clique faz o navegador pintar um retângulo azul do TAMANHO DO ELEMENTO, e o elemento clicável ali é o mapa inteiro. Faltava também proteger o container que rola o mapa, e não só a imagem. Vale nas 3 abas: Marcadores, Planejamento e Acompanhamento.",
        "O zoom de dois dedos agora cresce NO PONTO onde você pinçou. Antes o mapa era redesenhado com a posição de rolagem antiga, que aponta pra outro lugar da planta depois que ela muda de tamanho, e a vista fugia pro canto superior esquerdo. Vale também pro Ctrl+roda (ancora no cursor) e pros botões + e − (ancoram no centro do que está na tela).",
        "O pinch não trava mais no primeiro movimento. Ele redesenhava o mapa a cada quadro, e trocar o desenho no meio do gesto desliga os eventos de toque — o gesto morria. Agora o mapa só é redesenhado quando você tira os dedos.",
        "Dá pra criar estaca, mover estaca e ajustar forma no toque. Esses gestos só escutavam mouse, e no celular o navegador não emite o movimento do meio — o arrasto sempre saía com tamanho zero e era descartado calado.",
        "Não precisa mais acertar o pixel exato da estaca: o toque procura a estaca mais próxima num raio de 22px. Estaca desenhada tem 6 a 20px na tela contra cerca de 40px de área do dedo. Estaca sempre ganha do bloco desenhado embaixo dela.",
        "Terminar de arrastar o mapa não marca mais estaca sem querer, e o número do zoom (%) agora atualiza também no Planejamento e no Acompanhamento — antes só no Marcadores."
      ],
      "legado": "V3.11.3"
    },
    {
      "versao": "V3.11.3.1",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Levantamento Piso: seleção de quais paredes recebem impermeabilização do rodapé",
      "itens": [
        "Novo botão \\\"🧱 Selecionar Paredes\\\" dentro do bloco de impermeabilização do rodapé — abre um popup com um desenho simplificado da área e uma lista numerada das paredes (arestas), pra marcar só as que realmente recebem o tratamento (ex: banheiro com só 2 das 4 paredes impermeabilizadas).",
        "Cada parede marcada tem o comprimento pré-preenchido com o tamanho real da parede, mas editável pra um trecho parcial (quando não é a parede inteira que recebe o tratamento).",
        "O total (soma dos comprimentos das paredes marcadas × altura) substitui o cálculo pelo rodapé inteiro da área nos m² de impermeabilização, em todos os lugares (painel do workspace, Visão Geral e breakdown por tipo).",
        "Compatibilidade: áreas que nunca abriram esse popup continuam usando o rodapé inteiro da área (comportamento da V3.11.1.1), sem precisar re-editar nada.",
        "Corrigido de passagem: o badge de versão do link \\\"Notas de Versão\\\" na sidebar estava parado em V3.11.2 em todas as páginas — sincronizado com a versão atual."
      ],
      "legado": "V3.11.3.1"
    },
    {
      "versao": "V3.11.3.2",
      "data": "2026-08-17",
      "tipo": "melhoria",
      "titulo": "Menos cards de volume: só o valor final (com empolamento), taxa em texto pequeno embaixo",
      "itens": [
        "Levantamento de Terraplanagem, Controle de Terraplanagem e relatório PDF (todos) — tirados os cards separados de \"volume banco\" e \"volume com empolamento\" pra terra, estacas e fundação superficial. Agora cada um vira UM card só: o valor final (já empolado) em destaque, e a taxa aplicada (ex: \"+30% empolamento\") em texto pequeno embaixo.",
        "Menos cards na tela, mesma informação — só o banco (base de cálculo) deixou de ter card próprio, mas continua calculado por dentro."
      ],
      "legado": "V3.11.4"
    },
    {
      "versao": "V3.11.3.3",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Levantamento Piso: popup \\\"Selecionar Paredes\\\" ganhou o desenho real da planta de fundo",
      "itens": [
        "O desenho esquemático do popup de \\\"🧱 Selecionar Paredes\\\" (impermeabilização do rodapé) agora mostra atrás um recorte de verdade da planta baixa daquela região — não é mais só o contorno genérico, é a página do PDF ampliada e cortada em torno da área.",
        "As paredes numeradas ficam desenhadas por cima do recorte real, alinhadas com as paredes de verdade do projeto — muito mais fácil de reconhecer qual é qual num banheiro com 4+ paredes parecidas.",
        "Enquanto a planta carrega, o popup mostra o desenho esquemático como estava antes; ela troca pro fundo real assim que termina de carregar, sem travar a tela."
      ],
      "legado": "V3.11.4.1"
    },
    {
      "versao": "V3.11.4",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Terraplanagem do Dashboard alinhada aos números do Controle",
      "itens": [
        "Volume removido estava errado: viagens de \"outros materiais\" ou sem material preenchido eram classificadas como TERRA — inflando a terra e o % concluído — e ao mesmo tempo ficavam de fora do total. Agora a classificação é IDÊNTICA à do Controle (terra, entulho, outros/sem material) e o Volume Removido soma tudo o que saiu de caminhão.",
        "Custo agora usa a mesma regra do Controle: valor digitado na viagem OU o valor padrão por viagem do config (antes viagem sem valor contava R$ 0).",
        "KPIs novos do Controle incorporados: Retirada Total Prevista (terra prevista + estacas + fundação superficial, tudo empolado), Faltando (m³), Viagens atual/estimado com quanto falta, Valor gasto × Valor faltando (estimado pela média por viagem).",
        "Gráfico por dia ganhou a série \"Outros/sem material\" (cinza-escuro) — a soma das barras volta a bater com o Volume Removido."
      ],
      "legado": "V3.11.4.2"
    },
    {
      "versao": "V3.11.4.1",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Cards de Terraplanagem do Dashboard na MESMA ordem do Controle",
      "itens": [
        "Os cards agora seguem exatamente a organização do Controle de Terraplanagem — linha principal: 🚚 Viagens atual/total, Volume total a retirar, Volume executado (com % da terraplanagem), ⏳ Volume faltando, 💰 Valor gasto e Valor faltando (estimado).",
        "Linha \"COMPOSIÇÃO\" separada embaixo: Volume de terra (previsto, com % de empolamento), 🧱 Volume de entulho (não entra na terraplanagem), Volume fundação profunda e Volume fundação superficial — com as mesmas legendas explicativas do Controle."
      ],
      "legado": "V3.11.4.3"
    },
    {
      "versao": "V3.11.4.2",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Controle de Fundações: painel de visão geral corrigido (estava sempre mostrando Estacas) + novo fluxo \"Lançar BT\" no Acompanhamento",
      "itens": [
        "Correção: o painel \"visão geral da obra\" no fim do Acompanhamento (total, volume executado, % da obra, tabela por grupo) ficava sempre travado nos números de Estacas, mesmo com a aba Fundações aberta. Agora acompanha a view atual — título, ícone e agrupamento (por diâmetro nas Estacas, por tipo de fundação nas Fundações) mudam junto.",
        "Mesma correção nos blocos \"Executado/Faltando\" de cada concretagem: fundação sem diâmetro não cai mais tudo junto em \"sem diâmetro\" — agrupa por tipo (Bloco, Sapata, Radier etc.).",
        "Novo, só na aba Fundações: dentro de \"🚚 BTs nesta concretagem\", cada BT ganhou um botão \"🧱 Lançar\" — abre a lista de fundações planejadas pra dizer quanto (%) cada uma recebeu DAQUELA BT (fluxo BT→peças, igual ao Controle de Concreto), em vez do fluxo peça→BTs usado nas Estacas. Grava nos mesmos lançamentos — o mapa continua colorindo verde/parcial normalmente. Estacas não muda nada."
      ],
      "legado": "V3.11.4.4"
    },
    {
      "versao": "V3.11.4.3",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Controle de Estacas e Fundações: listas de concretagem não misturam mais os números das duas views",
      "itens": [
        "O número da concretagem continua sendo um sequencial ÚNICO pra obra inteira (igual sempre foi no Controle de Concreto) — isso não muda. O que mudou foi só a EXIBIÇÃO: o seletor de concretagem do Acompanhamento e os cards de \"Concretagens planejadas\" do Planejamento agora só mostram as que têm ao menos 1 peça da view aberta (Estacas OU Fundações) — uma concretagem 100% de Estacas não aparece mais enquanto se está na aba Fundações, e vice-versa.",
        "Concretagem recém-criada (ainda sem nenhuma peça) continua aparecendo nos dois — só passa a sumir de uma view se ficar cheia só de peças da OUTRA.",
        "Trocar de view (Estacas ⇄ Fundações) solta a concretagem selecionada no Acompanhamento se ela não pertencer mais à lista filtrada, e sempre solta o foco de atribuição rápida do Planejamento — evita ficar preso num estado de uma concretagem que não aparece mais na tela."
      ],
      "legado": "V3.11.4.5"
    },
    {
      "versao": "V3.11.4.4",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Levantamento Piso: dividir a parede em trechos e usar mais de uma altura na impermeabilização",
      "itens": [
        "Popup \"Selecionar Paredes\": botão \"🔀 Dividir\" em cada parede — separa a parede em vários trechos (ex: box de 0,75m recebe impermeabilização, o resto não, ou recebe outra altura). Cada trecho tem seu próprio comprimento (editável) e pode ser incluído ou não individualmente.",
        "Alturas múltiplas: agora dá pra configurar mais de uma altura de rodapé impermeabilizado (ex: 1,20m no box + 0,40m no resto do banheiro) com o botão \"+ Altura\", e cada trecho de cada parede escolhe qual altura usar num seletor próprio.",
        "O total de m² soma cada trecho pelo seu comprimento × a altura escolhida pra ele — não é mais uma altura única pra tudo.",
        "Compatibilidade: áreas configuradas nas versões anteriores (uma altura só, sem trechos) continuam calculando igual; ao abrir \"Selecionar Paredes\" nelas, a configuração antiga é convertida automaticamente pra uma altura única editável, sem perder nada."
      ],
      "legado": "V3.11.4.6"
    },
    {
      "versao": "V3.11.4.5",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Levantamento Piso: aviso quando a divisão da parede não fecha o total",
      "itens": [
        "Popup \"Selecionar Paredes\": ao dividir uma parede em trechos, se a soma dos comprimentos não bater com o total da parede, aparece um aviso vermelho na hora (ex: \"Faltam 0,43 m pra completar a parede\") — sem esperar salvar pra descobrir que a conta não fechou.",
        "O card da parede fica destacado (borda e fundo avermelhados) enquanto a divisão estiver incorreta.",
        "Ao confirmar com alguma parede ainda divergente, um aviso avisa quais paredes precisam de atenção — a seleção é salva mesmo assim, o aviso é só pra não passar batido."
      ],
      "legado": "V3.11.4.7"
    },
    {
      "versao": "V3.11.4.6",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Levantamento Piso: simplificado o jeito de adicionar novas alturas de impermeabilização",
      "itens": [
        "Popup \"Selecionar Paredes\": o seletor \"Personalizado\" (dropdown) que ficava em cima, perto dos seletores de altura de cada parede, foi trocado por 3 botões diretos — \"+ Box (1,20 m)\", \"+ Padrão (0,40 m)\" e \"+ Baixo (0,20 m)\" — clicou, já adicionou à lista de alturas.",
        "Campo numérico continua disponível pra alturas fora desses 3 valores comuns (botão \"+ Altura\" ao lado).",
        "Evita duplicar: tentar adicionar uma altura que já está configurada avisa em vez de criar uma repetida."
      ],
      "legado": "V3.11.4.8"
    },
    {
      "versao": "V3.11.4.7",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Levantamento Piso: desenho da parede dividida agora mostra a cor de cada trecho",
      "itens": [
        "Popup \"Selecionar Paredes\": o desenho no topo agora pinta cada trecho da parede dividida na proporção do seu comprimento, com a cor da altura escolhida pra ele — dá pra ver de relance onde é box (1,20m) e onde é o resto (0,40m), por exemplo.",
        "Se a soma dos trechos não cobre a parede inteira, o pedaço que falta aparece em cinza no desenho — a mesma divergência já avisada em texto agora também aparece visualmente."
      ],
      "legado": "V3.11.4.9"
    },
    {
      "versao": "V3.11.4.8",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Levantamento Piso: zoom e arrastar no desenho do popup Selecionar Paredes",
      "itens": [
        "O desenho no topo do popup \"Selecionar Paredes\" agora tem zoom (roda do mouse ou botões ➖/➕) e pan (clique e arraste) — útil quando a área é pequena ou tem muitas paredes próximas.",
        "Botão do meio mostra o % atual e clica pra voltar a 100% e centralizar de novo."
      ],
      "legado": "V3.11.4.10"
    },
    {
      "versao": "V3.11.5",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Levantamento Piso: dava pra incluir uma parede mas não pra remover ela de volta",
      "itens": [
        "Popup \"Selecionar Paredes\": o botão 🗑 só aparecia quando a parede tinha mais de 1 trecho (dividida). Uma parede incluída como trecho único não tinha jeito de voltar ao estado \"não incluída\" além de desmarcar o checkbox (que deixa os campos desabilitados mas ainda ocupando espaço na tela).",
        "Agora o 🗑 aparece em qualquer parede incluída, com trecho único ou dividida — remove e volta pro botão \"+ Incluir esta parede\"."
      ],
      "legado": "V3.11.4.11"
    },
    {
      "versao": "V3.11.6",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Levantamento Piso: números do desenho ficavam gigantes no zoom + limite de zoom aumentado",
      "itens": [
        "Popup \"Selecionar Paredes\": os círculos numerados das paredes cresciam junto com o zoom (viravam bolas enormes e sobrepostas em 400%). Agora o tamanho deles é recalculado a cada zoom pra ficar sempre do mesmo tamanho na tela, só a parede/planta de fundo amplia mesmo.",
        "Limite de zoom subiu de 400% pra 1000% — útil pra paredes bem pequenas.",
        "Zoom por clique/roda do mouse agora anda em passos de 50% em vez de 25% (menos cliques pra chegar no nível que precisa)."
      ],
      "legado": "V3.11.4.12"
    },
    {
      "versao": "V3.11.6.1",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Levantamento Piso: removido o cadastro separado de alturas — agora é direto em cada trecho",
      "itens": [
        "Popup \"Selecionar Paredes\": tirada a seção \"Alturas configuradas\" (que exigia cadastrar a altura antes de poder usá-la). Cada trecho de parede agora tem seu próprio campo de altura, com sugestões (Box 1,20m, Padrão 0,40m, Baixo 0,20m + qualquer valor já digitado em outro trecho) e também aceita digitar qualquer valor direto.",
        "Sem etapa extra: divide a parede, escolhe/digita a altura de cada trecho, e já era — sem precisar \"registrar\" a altura antes.",
        "Compatibilidade: áreas configuradas nas versões anteriores (V3.11.4.6 a V3.11.4.12, com o cadastro de alturas) continuam calculando certinho, e a conversão pro novo formato acontece sozinha ao reabrir \"Selecionar Paredes\" nelas."
      ],
      "legado": "V3.11.4.13"
    },
    {
      "versao": "V3.11.7",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Levantamento Piso: aviso de divergência não atualizava ao digitar + seletor de altura sem opções visíveis",
      "itens": [
        "Corrigido: o aviso \"soma dos trechos não bate com o total\" só era calculado no momento em que a parede era dividida — editar o comprimento de um trecho depois disso não recalculava nada, então o aviso ficava desatualizado ou nem aparecia. Agora atualiza em tempo real, a cada dígito, sem perder o foco do campo — e quando bate certinho, mostra confirmação verde (✅) também, não só o erro.",
        "O campo de altura era um datalist (input com sugestões) — o dropdown de opções abre de forma inconsistente entre navegadores, difícil de descobrir. Trocado por um seletor de verdade: 1,20m (Box), 0,40m (Padrão), 0,20m (Baixo) e qualquer valor já usado em outro trecho, todos visíveis na hora que abre.",
        "Botão ✏️ ao lado do seletor troca pra um campo numérico livre, pra digitar qualquer altura fora da lista."
      ],
      "legado": "V3.11.4.14"
    },
    {
      "versao": "V3.11.8",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Levantamento Piso: parede ficava grossa demais no zoom e tampava o número",
      "itens": [
        "Popup \"Selecionar Paredes\": a V3.11.4.12 corrigiu o tamanho dos números pra não crescer com o zoom, mas a linha da própria parede continuava engordando — em zoom alto (700%+) virava uma barra enorme que cobria o número por cima. Agora a espessura da linha também é recalculada a cada zoom pra ficar constante na tela, igual já acontecia com os números."
      ],
      "legado": "V3.11.4.15"
    },
    {
      "versao": "V3.11.9",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Levantamento Piso: zoom da roda do mouse não ancorava no cursor (a tela \"fugia\")",
      "itens": [
        "Popup \"Selecionar Paredes\": o zoom pela roda do mouse sempre ampliava a partir do CENTRO do desenho, não de onde o mouse estava — então dar zoom num canto fazia o conteúdo \"escapar\" pro lado errado, precisando reajustar o pan toda hora atrás do que se queria ver.",
        "Corrigido: agora o zoom ancora exatamente no ponto onde o mouse está — o que estava embaixo do cursor continua embaixo do cursor depois do zoom, igual o Google Maps/Figma. Os botões ➖/➕ continuam ancorando no centro (não tem cursor pra seguir nesse caso)."
      ],
      "legado": "V3.11.4.16"
    },
    {
      "versao": "V3.12.0",
      "data": "2026-08-18",
      "tipo": "funcionalidade",
      "titulo": "Novo campo Frente de Serviço no Planejamento + filtro de equipe em Medições",
      "itens": [
        "Planejamento: nova coluna \"Frente\" — classifica cada tarefa por equipe/disciplina (Estrutura, Pedreiros, Engenharia, Hidráulica, Elétrica, Gesso, Pintura, Azulejistas). Edição por dropdown direto na grade. Campo novo (frenteServico) — não confundir com a coluna \"Nº Equipe\" já existente (nº de pessoas alocadas, usada no Produção).",
        "Ferramentas → \"Classificar Frentes automaticamente\": sugere a Frente pelo nome da tarefa e preenche só quem está em branco (nunca sobrescreve o que já foi definido na mão).",
        "Medições: filtro por Frente na árvore de lançamento — mostra só as tarefas da equipe selecionada, mantendo os grupos-pai pra dar contexto (mesma visão em árvore de sempre).",
        "Medições: \"Fim Real\" agora só pode ser preenchido com a tarefa em 100% de progresso — evita registrar término de algo que ainda não acabou.",
        "Medições: ao lançar Início Real ou Término Real (com 100%), o cronograma ATUAL (Início/Término Planejado) é atualizado junto pra refletir a realidade. A Linha de Base nunca é tocada."
      ],
      "legado": "V3.12.0"
    },
    {
      "versao": "V3.12.0.1",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Frente de Serviço: completa cobertura em formulário, exportações e importações",
      "itens": [
        "Modal \"Nova/Editar Tarefa\": campo Frente de Serviço agora também disponível ali (antes só dava pra editar direto na grade do Planejamento).",
        "Exportar Excel (simples e formatado): coluna Frente incluída.",
        "Importar / Importar Base Completa: reconhece coluna \"Frente\" (ou \"Equipe\") na planilha.",
        "Importar Correções: Frente de Serviço adicionada como campo que pode ser corrigido em massa por Nome, junto com os demais."
      ],
      "legado": "V3.12.0.1"
    },
    {
      "versao": "V3.12.1",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Medições: árvore não ocupava a tela toda + Frente automática não subia pro grupo-pai",
      "itens": [
        "Medições: a árvore de lançamento tinha uma altura fixa que deixava área cinza vazia embaixo em telas maiores — agora ocupa exatamente o espaço disponível, igual ao Planejamento.",
        "Medições: botões \"Expandir tudo\" / \"Recolher tudo\" na tela de nova medição (o padrão já era abrir tudo de início — os botões só facilitam recolher/abrir em massa quando quiser).",
        "Planejamento: \"Classificar Frentes automaticamente\" agora também preenche o GRUPO-PAI quando todos os filhos concordam numa única Frente (antes só classificava a folha — ex: \"Concretagem\" ficava em branco mesmo com todos os pavimentos dentro já em ESTRUTURA).",
        "Planejamento: novo botão \"Exportar Frentes (revisão)\" — planilha simples com só Código, Atividade, Pai e Frente, pra revisar/corrigir fora do sistema e reimportar depois em \"Importar Correções\" (marcando só \"Frente de Serviço\")."
      ],
      "legado": "V3.12.0.2"
    },
    {
      "versao": "V3.12.1.1",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Medições: ícones maiores/mais visíveis, começa tudo recolhido e busca mantém a árvore",
      "itens": [
        "Ícone de abrir/fechar grupo (e o lápis de lançar medição) estava pequeno e apagado — agora é um botão quadrado maior, com fundo e contraste melhor. Ajuda também no toque em celular.",
        "Nova Medição agora começa com tudo RECOLHIDO (só os grupos de topo) — antes começava tudo aberto, o que virava uma rolagem enorme em obras grandes. Os botões \"Expandir tudo\"/\"Recolher tudo\" continuam disponíveis.",
        "Busca por Nome: antes escondia todos os grupos e mostrava só as folhas batendo o texto (perdia o contexto de onde a tarefa estava). Agora mantém a árvore, abre automaticamente os grupos-pai até o resultado, destaca e rola até a tarefa mais próxima do que foi digitado.",
        "Corrigido também: o campo de busca perdia o foco a cada letra digitada (só dava pra digitar 1 caractere por vez) — agora mantém o foco e a posição do cursor entre as digitações.",
        "Telas estreitas (celular): filtro de Frente e busca ocupam a largura toda em vez de ficarem espremidos, e os botões de toque ficam um pouco maiores."
      ],
      "legado": "V3.12.0.3"
    },
    {
      "versao": "V3.12.1.2",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Medições: fim do popup — Início/Término Real e % direto na linha",
      "itens": [
        "Removido o modal \"Lançar Medição\" (lápis → popup → editar). Agora Início Real, Término Real e % ficam direto na linha, editáveis na hora — sem clique extra, sem popup.",
        "Botão rápido \"✓100%\" pra marcar conclusão com um toque.",
        "% validado: se digitar mais de 100, avisa e ajusta pra 100. Término Real só aceita com a tarefa em 100% (senão avisa e não salva).",
        "Fotos da medição continuam disponíveis (ícone 📷 na própria linha), sem precisar do popup.",
        "Corrigido: cada edição (%, data, foto) disparava um re-render que jogava a lista de volta pro topo — agora mantém a posição de rolagem."
      ],
      "legado": "V3.12.0.4"
    },
    {
      "versao": "V3.12.2",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Medições: mobile de verdade agora — fontes e toques bem maiores, botão de descartar que nunca tinha estilo",
      "itens": [
        "Achado o motivo de tudo parecer pequeno: o botão \"✕\" de descartar alteração NUNCA teve estilo em nenhum lugar do sistema — era um botão cru do navegador. Agora tem visual e tamanho de botão de verdade.",
        "Em telas de celular (até 640px): fonte de nome/badge/esperado maior, chips do topo maiores, os campos de Início/Término/% e os botões (✓100%, 📷, ✕, abrir/fechar grupo) todos com altura por volta de 40px — bem mais fácil de tocar.",
        "Botões da barra (Voltar, Salvar, Expandir/Recolher tudo) também maiores no celular."
      ],
      "legado": "V3.12.0.5"
    },
    {
      "versao": "V3.12.2.1",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Levantamento Piso: botão para exportar planilha (Excel) com todas as áreas",
      "itens": [
        "Novo \"📊 Exportar Planilha\" no topo do módulo (visível em qualquer local) — gera um .xlsx com uma linha por área medida em toda a obra: Apartamento, Local, Local (Nº Parede ou Piso), Tipo de Piso, Dimensões do Piso, M² e M² com perda.",
        "\"Apartamento\" vem do nome do local direto onde a área está guardada na árvore. \"Local (Nº Parede ou Piso)\" vem fixo como \"Piso\" neste módulo — pensado pra combinar com uma futura planilha de Paredes/Azulejo usando \"Parede N\" no mesmo formato de chave.",
        "Tipo de Piso e Dimensões são separados automaticamente do campo \"Tipo de Piso\" seguindo o padrão \"Nome - AxB\" (ex: \"Porcelanato Alta Mountain - 90x90\" vira Tipo=\"Porcelanato Alta Mountain\" e Dimensão=\"90x90\"). Registros antigos sem esse padrão (ex: só \"Porcelanato 1\") saem com a dimensão em branco.",
        "Novo \"⚙️ Config\" no topo do módulo — define o % de perda usado na coluna \"M² com perda\" da planilha (padrão 30%, editável por obra)."
      ],
      "legado": "V3.12.0.6"
    },
    {
      "versao": "V3.12.3",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Medições: breakpoint mobile estava estreito demais e nunca disparava no celular real",
      "itens": [
        "O ajuste mobile só entrava em ≤640px, mas o celular testado cai numa faixa maior (a mesma em que o sistema já troca a sidebar pelo menu ☰, ≤1024px) — por isso nada parecia ter mudado. Alinhado o breakpoint da Medições com esse mesmo limite (≤1024px) usado no resto do sistema."
      ],
      "legado": "V3.12.0.7"
    },
    {
      "versao": "V3.12.3.1",
      "data": "2026-08-18",
      "tipo": "funcionalidade",
      "titulo": "Novo módulo: Controle de Porcelanatos (base) — exportador de planilha movido pra lá",
      "itens": [
        "Novo em 🏗️ Controle: \"🧱 Controle de Porcelanatos\" — hoje traz o Levantamento de Piso (áreas, tipo, dimensões, m²); a ideia é juntar Piso + Paredes (azulejo) num controle só, com a mesma planilha de exportação. Marcado como \"Em desenvolvimento\".",
        "O botão \"📊 Exportar Planilha\" (Apartamento/Local/Tipo/Dimensões/M²/M² com perda) saiu do Levantamento de Piso e agora mora só no Controle de Porcelanatos.",
        "Corrigido de raiz um bug que fazia a planilha sair incompleta (só um apartamento, faltando o resto): o app usa cache offline do Firestore, e o export podia pegar dados velhos do navegador em vez do servidor. Agora essa página sempre busca do SERVIDOR antes de exportar — e tem um botão \"🔄 Recarregar\" pra forçar isso manualmente também.",
        "O % de perda configurável (padrão 30%) ganhou uma configuração própria deste módulo — herda automaticamente o valor que já estava configurado no Piso, se houver, na primeira vez que abrir."
      ],
      "legado": "V3.12.0.8"
    },
    {
      "versao": "V3.12.3.2",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Medições: distribuição do mobile ajustada — menos espaço perdido, Início/Término lado a lado",
      "itens": [
        "Achado o motivo dos campos de Início/Término Real ficarem cada um numa linha inteira sozinho: o input de data tem uma largura mínima própria que não encolhia com o ajuste anterior. Agora usa um grid de 2 colunas garantindo Início+Término numa linha e %+✓100% na outra.",
        "Barra de cima mais compacta: \"Expandir tudo\"/\"Recolher tudo\" virou só \"Expandir\"/\"Recolher\", os 3 chips (Total/Medição/Esperado) ficam lado a lado numa linha só, e o filtro de Frente + busca compartilham uma linha em vez de uma embaixo da outra — bem menos espaço vazio no topo."
      ],
      "legado": "V3.12.0.9"
    },
    {
      "versao": "V3.12.3.3",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Medições: cartão de cada tarefa mais compacto no mobile — menos linhas, menos espaço perdido",
      "itens": [
        "📷 (foto) e ✕ (descartar) saíram da grade de campos e subiram pra junto do nome da tarefa — sobrava uma linha inteira só pra esses dois ícones. Agora a grade fica só com Início+Término (linha 1) e %+✓100% (linha 2), 2 linhas em vez de 3.",
        "Espaçamento entre os campos e o padding de cada linha reduzidos — cabe mais tarefa por tela, menos rolagem."
      ],
      "legado": "V3.12.0.10"
    },
    {
      "versao": "V3.12.4",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Medições: foto/descartar ficaram sozinhos numa linha vazia — corrigido de vez",
      "itens": [
        "A tentativa anterior de subir 📷/✕ pra junto do nome não funcionou: o bloco do nome crescia e empurrava os ícones pra uma linha nova, sozinha e praticamente vazia — pior que antes. Causa: nome e ícones eram itens soltos no mesmo flex container, sem nada garantindo que ficassem na mesma linha.",
        "Corrigido de raiz: nome+badge e os ícones (📷/✕) agora vivem dentro do mesmo bloco dedicado (linha do cabeçalho) — ficam sempre um do lado do outro, o texto do nome quebra por dentro sem empurrar os ícones pra lugar nenhum."
      ],
      "legado": "V3.12.0.11"
    },
    {
      "versao": "V3.13.0",
      "data": "2026-08-18",
      "tipo": "funcionalidade",
      "titulo": "Controle de Porcelanatos: junta Piso + Paredes, agrupa por Torre/Andar/Apto e ganha controle de execução",
      "itens": [
        "Agora traz também o Levantamento de Paredes — só a fatia de \"Revestimento de Parede\" (porcelanato/cerâmica) de cada face, no mesmo m² equivalente já usado lá (respeitando desconto de vãos e Metro Linear). Gesso, reboco e pintura continuam de fora — não são porcelanato.",
        "Tudo agrupado visualmente por Torre → Andar → Apartamento (colapsável por torre), com filtros de Torre, Andar, Status e busca. Como Piso e Paredes têm árvores de local separadas, o cruzamento é feito pelo nome do caminho — se o mesmo apto estiver escrito diferente nos dois levantamentos, aparece em dois grupos.",
        "Novo controle de execução: apontamento diário de m² aplicado por item (data, m², observação), com histórico completo e exclusão de lançamentos. Status automático — Pendente / Em andamento / Concluído — com aviso quando o executado passa do planejado.",
        "Novos KPIs no topo: m² planejado (Piso, Parede e Total), m² executado, % de avanço geral e itens concluídos.",
        "Exportar Planilha ganhou uma segunda aba \"Resumo por Local\" (totais de Piso/Parede/Executado por Torre-Andar-Apto), além da aba Detalhado — que agora também traz Torre, Andar, M² Executado, % Executado e Status.",
        "Nova coleção no Firestore: `porcelanatosExecucoes` (apontamentos). Guard de permissão: apontar execução usa `controlePorcelanatos:criar`, excluir apontamento usa `controlePorcelanatos:excluir` (catálogo já existia)."
      ],
      "legado": "V3.13.0"
    },
    {
      "versao": "V3.13.1",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Controle de Porcelanatos: Torre/Apto duplicado quando Paredes tinha um nível extra (Cômodo) que o Piso não tem",
      "itens": [
        "A árvore de Paredes costuma ter um nível de Cômodo dentro do Apto (ex: Torre → Andar → Apto → Banheiro de Serviço) que a árvore de Piso não tem (a área já fica direto no Apto). O agrupamento antigo pegava \"os 2 últimos níveis\" como Andar+Apto — então em Paredes o Apto caía num nível errado, criando um grupo de Torre paralelo que nunca batia com o do Piso: tudo aparecia duplicado e fora de ordem.",
        "Corrigido: agora Torre/Andar/Apto são sempre os 3 primeiros níveis da árvore, fixos, não importa quão mais profundo ela vá depois disso. Qualquer nível extra (o Cômodo) não vira mais um agrupamento por conta própria — passa a aparecer junto do nome do Local (ex: \"Banheiro de Serviço · Face C\")."
      ],
      "legado": "V3.13.1"
    },
    {
      "versao": "V3.13.1.1",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Medições: card da tarefa no mobile cortado pro essencial — nome, Início, Término e %, só isso",
      "itens": [
        "Tirado (só no mobile) o badge de Frente e o texto \"Esperado: X%\" do card de cada tarefa — informação redundante com o filtro já selecionado no topo, e o pedido original era só nome + Início + Término + % pra preencher rápido, sem mais nada. No desktop continuam aparecendo."
      ],
      "legado": "V3.13.1.1"
    },
    {
      "versao": "V3.13.2",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Controle de Porcelanatos: Torre/Andar/Apto ainda duplicava quando o nome vinha escrito diferente em Piso e Paredes",
      "itens": [
        "A correção anterior (profundidade fixa) resolveu o caso de a árvore de Paredes ter um nível de Cômodo extra, mas não resolvia se o mesmo local estivesse escrito com maiúscula/minúscula ou espaço diferente nas duas árvores (ex: \"Torre\" no Piso vs \"torre \" nas Paredes) — o agrupamento comparava o texto cru, então continuava tratando como dois locais diferentes.",
        "Corrigido: agora Torre, Andar e Apto passam por uma normalização (ignora maiúscula/minúscula e espaços) antes de agrupar — o primeiro nome visto em cada combinação \"vence\" e todo item equivalente passa a usar esse mesmo texto. Continua sem solução automática só se o nome for genuinamente diferente por escrito (ex: \"AP 1\" numa árvore e \"Apto 01\" na outra) — nesse caso o texto precisa ficar igual em ambos os levantamentos."
      ],
      "legado": "V3.13.1.2"
    },
    {
      "versao": "V3.13.3",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Medições: achado o motivo real do card mobile parecer sempre igual — recuo de hierarquia comendo a tela",
      "itens": [
        "O padding-left que empurra a linha pra direita conforme a profundidade na árvore (nível×16px) foi pensado pra desktop — no celular, uma tarefa em nível 4-5 perdia 70-90px de tela só de recuo vazio à esquerda, sobrando pouca largura pros campos, que ficavam espremidos à direita. Isso é o que causava a sensação de \"nada mudou\": a poda de badge/esperado ajudou um pouco, mas o recuo continuava comendo a maior parte da tela.",
        "Corrigido: no mobile, o recuo trava no máximo em 2 níveis (16px), não importa quão mais profunda a tarefa esteja na árvore — sobra muito mais largura pra Início/Término/%."
      ],
      "legado": "V3.13.1.3"
    },
    {
      "versao": "V3.13.3.1",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Medições: campos com legenda visível + % Executado ao lado do % Previsto",
      "itens": [
        "Cada campo agora tem uma legenda em cima (Início Real / Término Real / % Executado / % Previsto) — antes só tinha o placeholder cinza (\"dd/mm/aaaa\"), que sozinho não dizia qual data era qual.",
        "% Previsto (o antigo \"Esperado\") voltou, mas lado a lado com % Executado — compara na hora se tá atrasado ou adiantado sem precisar abrir mais nada. Botão de marcar 100% ficou um ✓ pequeno colado no campo de % Executado."
      ],
      "legado": "V3.13.1.4"
    },
    {
      "versao": "V3.13.3.2",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Medições: botão \"Ocultar 100%\" — esconde quem já está concluído",
      "itens": [
        "Novo botão na barra de cima, junto com o filtro de Frente e a busca — liga/desliga (fica marcado ☑ quando ativo, lembra a escolha entre sessões). Some com toda tarefa já em 100% (considerando também o que ainda não foi salvo) e some com o grupo-pai se não sobrar nenhum filho visível — foco só no que falta preencher."
      ],
      "legado": "V3.13.1.5"
    },
    {
      "versao": "V3.13.4",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Controle de Porcelanatos: KPIs sem número e tudo sobreposto em obras com muitos itens",
      "itens": [
        "Causa raiz (achada reproduzindo a tela localmente, não só pelo print): `#cp-content` é filho de `.content`, que no layout geral é flex-column com uma regra global `.content > div { min-height: 0 }` (feita pro Gantt do Planejamento). Como cada seção do módulo (KPIs, filtros, cada Torre) virava um `<div>` solto direto ali, em obras com muitos itens (aqui, 117) o flexbox espremia CADA seção pra caber no espaço visível — o texto não encolhe junto, então tudo passava a se sobrepor: números dos KPIs cortados, blocos de Torre embaralhados.",
        "Corrigido: todo o conteúdo do módulo agora vive dentro de um único `<div class=\"cc-view\">` (mesmo padrão já usado no Controle de Concreto) — só esse wrapper único fica sujeito à regra do `.content`, e por dentro dele nada mais compete por espaço. Testado renderizando a página real localmente com 117 itens antes e depois da correção."
      ],
      "legado": "V3.13.1.6"
    },
    {
      "versao": "V3.13.5",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Importar Correções: casa pelo CÓDIGO da tarefa, não mais pelo nome",
      "itens": [
        "O importador procurava a tarefa pelo NOME e só usava o Código como desempate quando o nome estava duplicado. Invertido: agora o Código é a chave principal — ele não muda quando alguém renomeia a tarefa e é único mesmo quando o nome se repete em ramos diferentes da obra. Era o que fazia 16 linhas caírem em \"ambígua\" num import de 2423 tarefas.",
        "Ganho colateral: tarefa RENOMEADA na obra depois da planilha ter sido gerada agora continua sendo encontrada. Antes ela caía em \"não encontrada\" e ficava de fora silenciosamente.",
        "Reserva pelo Nome mantida para os casos legítimos: linha sem código na planilha, ou código que ainda não existe na obra (tarefa criada à mão depois). Só cai em \"ambígua\" quando nem o código nem o nome apontam pra uma única tarefa.",
        "A resolução de PREDECESSORA seguia a mesma regra antiga (só nome) — agora também tenta o Código primeiro, então predecessora que aponta pra tarefa de nome repetido deixa de virar \"não resolvida\".",
        "O resumo antes de confirmar agora separa quantas casaram pelo Código e quantas pelo Nome, e as listas de revisão mostram o código junto do nome — fica claro o que revisar.",
        "Segurança preservada: quando há dúvida real (código duplicado na obra com o mesmo nome, ou nome repetido sem código), a linha continua sendo pulada em vez de atualizar a tarefa errada."
      ],
      "legado": "V3.13.2"
    },
    {
      "versao": "V3.13.6",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Planilhas exportadas ganham a coluna Chave — identificador que nunca muda",
      "itens": [
        "Motivo: nenhuma coluna da planilha servia como identidade fixa. A coluna \"ID\" era só a POSIÇÃO na lista (1, 2, 3...), recalculada a cada exportação — some uma tarefa e tudo renumera. E o \"Código\" (1.3.6) muda quando a estrutura muda, além de 39 tarefas da obra simplesmente não terem código nenhum.",
        "Agora as exportações (Cronograma e Frentes) trazem a coluna Chave, que é o identificador real da tarefa: nasce com ela, nunca muda, não depende do nome nem da posição, e não é reaproveitado quando outra tarefa é excluída. NÃO apague nem edite essa coluna na planilha.",
        "O importador passa a casar pela Chave antes de tudo. Com ela presente não há mais o que adivinhar: mesmo tarefa renomeada, movida de lugar ou sem código é encontrada na hora.",
        "Também corrigido o caso que ainda sobrava: grupos como \"Apartamentos\", \"Hall\" e \"Escadaria\" se repetem sob pais diferentes (Hidráulica, Elétrica, Gesso, Contrapiso, Pintura) e não têm código — o código nunca ia desempatar. Agora o Pai desempata, e o importador finalmente lê a coluna \"Pai\" (antes só reconhecia o cabeçalho \"Tarefa Pai\", então a coluna era ignorada em silêncio).",
        "Ordem de busca completa: Chave → Código → Nome → Nome + Pai. Planilha antiga sem a coluna Chave continua funcionando normalmente pela cascata.",
        "A resolução de predecessora segue a mesma cascata, incluindo o desempate pelo Pai.",
        "O resumo antes de confirmar mostra quantas casaram por cada critério, e as ambíguas que sobrarem dizem o motivo (sem chave, sem código, sem pai) pra saber o que corrigir."
      ],
      "legado": "V3.13.3"
    },
    {
      "versao": "V3.13.7",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Coluna ID da planilha exportada grudava na LINHA, não na tarefa",
      "itens": [
        "Bug real, reproduzido: exportar o cronograma, mover uma tarefa no Editor de Estrutura e exportar de novo dava um ID DIFERENTE pra mesma tarefa — e o ID antigo passava a apontar pra outra. A coluna \"ID\" era `i+1`, a posição na lista, então o número grudava na linha em vez de acompanhar a tarefa.",
        "Agora a coluna ID traz o identificador real da tarefa: nasce com ela, nunca muda, acompanha ela pra onde for movida e não é reaproveitado quando outra tarefa é excluída. É a coluna que o importador usa pra casar.",
        "A posição virou uma coluna separada chamada \"Linha\", que existe por um motivo só: a coluna Prececessora referencia esse número. Ela é recalculada a cada exportação de propósito — não use como identificador.",
        "Isso substitui a coluna \"Chave\" que tinha sido criada na V3.13.3 pro mesmo fim: em vez de duas colunas de identidade, o \"ID\" passou a ser o que o nome sempre prometeu.",
        "Importante: por dentro o sistema já estava certo. As predecessoras sempre foram gravadas por ID de tarefa (formato `id|tipo|lag`), então mover linha no editor nunca quebrou vínculo nenhum — o número que aparece na tela é só exibição, convertido na hora. O problema era exclusivamente da planilha exportada.",
        "Planilha antiga (com ID posicional) continua sendo importada normalmente: os números não batem com nenhum ID de tarefa, então a busca cai pra Código → Nome → Nome+Pai como antes, sem risco de casar errado."
      ],
      "legado": "V3.13.4"
    },
    {
      "versao": "V3.13.8",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Permissões: Suprimentos sem NENHUMA checagem, e Diagnóstico fora do catálogo",
      "itens": [
        "Auditoria completa do sistema de permissões pedida pelo Milton — revisão de cabo a rabo pra achar módulos novos que ficaram sem integrar.",
        "Suprimentos (725 linhas, o maior módulo criado desde a última auditoria) não tinha absolutamente nenhuma checagem de permissão — nem no catálogo, nem guard nas funções, nem data-perm nos botões. Qualquer usuário ativo conseguia configurar seleção, editar prazos e status de qualquer etapa. Corrigido: módulo adicionado ao catálogo (ver/editar), guard em todas as funções de mutação (seleção, config, edição inline de data/status, overrides), inputs inline desabilitados sem permissão.",
        "Diagnóstico (ferramenta técnica de debug do sistema) também não estava no catálogo — criado módulo próprio na categoria Sistema, sem nenhuma permissão padrão (precisa ser liberado manualmente, é uma ferramenta sensível).",
        "Controle — Estacas e Controle — Porcelanatos já estavam com enforcement completo (aplicado corretamente em sessão anterior) — confirmado na auditoria, sem necessidade de correção."
      ],
      "legado": "V3.13.5"
    },
    {
      "versao": "V3.14.0",
      "data": "2026-08-18",
      "tipo": "funcionalidade",
      "titulo": "Permissões por obra: cada obra da lista \"Restrito\" pode ter um conjunto de acessos diferente",
      "itens": [
        "Motivo: até aqui, um usuário com acesso restrito a algumas obras tinha UM conjunto de permissões só, valendo igual em todas elas — pedido do Milton foi separar \"pode entrar na obra\" de \"pode fazer o quê dentro dela\", já que uma pessoa pode editar Planejamento na Obra A e só poder ver na Obra B.",
        "Na tela de Permissões, quando o acesso é \"Restrito\", aparece uma aba pra cada obra marcada — trocar de aba salva o que estava sendo configurado e mostra a config da obra seguinte (começa com tudo desmarcado, exceto Dashboard). Botão \"📋 Copiar pra todas\" aplica a config da aba atual em todas as obras da lista de uma vez, pra não ter que repetir manualmente.",
        "Módulos que não pertencem a uma obra específica (Obras, Administração/Permissões) ganharam seção própria \"Permissões gerais\", sempre visível e sempre um conjunto único — não faz sentido ter \"pode criar obra\" diferente por obra.",
        "Quando o acesso é \"Todas as obras\", nada muda: um checklist só, igual sempre foi.",
        "Por dentro: Permissions.pode(modulo,acao) agora consulta a obra ATIVA (a que está selecionada no momento, via Router) pra decidir qual conjunto de permissões usar — funciona automaticamente ao trocar de obra pelo seletor da sidebar, sem precisar recarregar a página, porque a maioria dos módulos já troca de obra sem reload (onObraChanged) e pode() lê a obra ativa em tempo real a cada chamada.",
        "Retrocompatível: usuários restritos configurados antes desta versão continuam funcionando exatamente como antes (a config antiga vira o \"padrão\" que qualquer obra sem configuração própria usa), até o admin entrar e configurar cada obra individualmente se quiser.",
        "Aproveitando a rodada, o backend do convite (api/usuarios.js) e o gate de página também foram atualizados pra esse novo formato."
      ],
      "legado": "V3.14.0.0"
    },
    {
      "versao": "V3.14.0.1",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Permissões granulares: \"editar\" deixou de ser uma caixinha só — agora dá pra liberar botão por botão",
      "itens": [
        "Motivo (Milton): um módulo grande tem 20-30 coisas diferentes que dá pra fazer, então \"editar\" não é UMA permissão — é um conjunto de edições diferentes. Pode ser que a pessoa possa editar uma coisa e outra não.",
        "Agora cada ação grossa (Ver/Criar/Editar/Excluir/Importar/Exportar) tem um botão \"▸ detalhar\" que abre os itens individuais dentro dela. Dá pra marcar a caixinha do grupo (libera tudo de uma vez) OU abrir e liberar item por item. Ao lado do grupo aparece um resumo (\"tudo\" ou \"3/8\") pra saber de relance o que está liberado sem precisar abrir.",
        "Marcar o grupo desabilita os itens individuais (não faz sentido escolher um por um se o grupo inteiro já está liberado) — desmarcar devolve o controle fino, sem perder o que já estava configurado.",
        "60 sub-permissões mapeadas direto do código nesta primeira rodada, nos módulos com mais ações: Planejamento (24 — inserir tarefa, duplicar, editar célula, mover estrutura, predecessoras, vínculos, recálculos, datas reais, frentes, 3 tipos de importação, 5 de exportação, 3 de exclusão), Diário de Obra, Materiais, Mão de Obra, Medições, Semanal (progresso/datas/responsável/omitir/fechamento), Suprimentos (seleção/prazos/data-status/override), Relatórios e Configuração de Obra (etapas/pacotes/locais/equipes separados).",
        "Os guards no código foram migrados junto — não é só visual: o botão de exportar PNG agora checa \"exportar:png\" de verdade, e não mais \"exportar\" genérico.",
        "Compatibilidade: módulo/ação ainda sem sub-itens mapeados continua funcionando exatamente como antes (uma caixinha só). Quem já tinha \"editar\" marcado continua com tudo liberado — o grupo marcado sempre libera tudo abaixo dele.",
        "Próxima rodada: mapear as sub-ações dos 9 Levantamentos e dos 5 Controles, que hoje ainda usam as ações grossas."
      ],
      "legado": "V3.14.0.1"
    },
    {
      "versao": "V3.14.0.2",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Sub-permissões: mapeamento concluído — 207 permissões individuais em 24 módulos",
      "itens": [
        "Completado o que faltava da rodada anterior: os 9 Levantamentos, os 5 Controles e Produção agora também têm granularidade por botão, saindo de 60 pra 207 sub-permissões no total.",
        "Levantamento Fachada (20): criar fachada/balancim/peça separados, duplicar, copiar de outra vista, conferir peça, mover entre balancins, editar mapa e caixas, vãos e frisos, config de cálculo, exportar CSV e vista.",
        "Levantamento Piso (17) e Teto (11): criar local/área/planta, editar área, rodapé, tabica, impermeabilização, calibrar escala, reorganizar árvore, mover/copiar áreas, excluir área/local/planta separados.",
        "Levantamento Paredes (16): alvenaria e acabamento como itens distintos, vãos, pintura, conferir, mover peça, estrutura, config.",
        "Levantamento Concreto (17): peça, importação em lote, concretagem, itens do levantamento, ordenação, config, e \"limpar base de peças\" isolado (ação destrutiva que merece caixinha própria).",
        "Levantamento Ar Condicionado (13), Pintura (8), Solo Grampeado (13, incluindo calibração de mapa e medição de área separadas), Terraplanagem (13, com seções, projeto/calibração e PDF).",
        "Controles: Estacas (14 — BT, BT de fundação, concretagem, pranchas, marcadores, metas, vínculo), Concreto (4), Solo (4), Terraplanagem (4, com valores/custos isolado), Porcelanatos (5). Produção (2).",
        "Todos os guards do código e os data-perm dos botões foram migrados junto — validado por script que confere se cada chave usada existe de fato no catálogo (zero inconsistências).",
        "Ações destrutivas ou sensíveis ficaram deliberadamente isoladas em caixinhas próprias, pra dar pra liberar o trabalho do dia a dia sem liberar \"limpar base\" ou \"editar valores/custos\"."
      ],
      "legado": "V3.14.0.2"
    },
    {
      "versao": "V3.15.0",
      "data": "2026-08-19",
      "tipo": "funcionalidade",
      "titulo": "Compartilhar PDF do Samsung Notes agora pode virar Tarefa, não só Relatório",
      "itens": [
        "Motivo (Milton): o compartilhamento de PDF (Samsung Notes → Absoluta) só tinha um destino, Relatório de Obra. Agora, ao compartilhar, aparece uma tela de escolha: \"📄 É um Relatório de Obra\" ou \"✅ São Tarefa(s) — To Do List\".",
        "Escolhendo Tarefa: uma nova IA (api/extrair-tarefas, mesmo fallback Gemini → Anthropic do Relatório) lê a nota e identifica cada item como uma tarefa separada, já reescrita de forma curta e objetiva, com projeto quando ficar claro na nota. Cada uma entra direto na coleção tarefasSistema (módulo Tarefas do Sistema/To Do List).",
        "Se a nota tiver várias tarefas escritas juntas, todas são criadas de uma vez, em sequência, na ordem em que aparecem.",
        "Fluxo de Relatório continua idêntico a antes — só ganhou uma tela de escolha na frente."
      ],
      "legado": "V3.15.0.0"
    },
    {
      "versao": "V3.16.0",
      "data": "2026-08-19",
      "tipo": "funcionalidade",
      "titulo": "Tarefas do Sistema: botão Agendar — grade do dia com horários de 30min",
      "itens": [
        "Motivo (Milton): faltava um jeito de organizar o dia, tipo agenda de caderno — que horário vai fazer o quê.",
        "Novo botão \"🗓️ Agendar\" no topo do módulo abre a grade do dia atual, com blocos de 30 minutos das 7h às 18h.",
        "Clicar num horário vazio abre a lista de tarefas pendentes pra escolher qual alocar ali. Horário ocupado mostra a tarefa com check (concluir direto dali) e um × pra remover do horário.",
        "Navegação entre dias (‹ Hoje ›) — cada tarefa é salva com dataAgendada e horarioAgendado, então a grade de qualquer dia (passado ou futuro) sempre mostra o que foi alocado nele.",
        "Uma tarefa só pode estar em um horário por vez — escolher ela em outro horário move a alocação."
      ],
      "legado": "V3.16.0.0"
    },
    {
      "versao": "V3.16.0.1",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Tarefas do Sistema: adicionar tarefa por voz",
      "itens": [
        "Botão de microfone 🎤 ao lado do campo \"O que precisa ser feito?\". Clica, fala, o texto reconhecido entra no campo — só falta escolher projeto/categoria/importância e Adicionar (ou já mandar direto, se preferir).",
        "Usa o reconhecimento de voz nativo do navegador (Web Speech API), em português do Brasil. Qualidade depende do microfone/Android do aparelho, não é algo que o sistema controla.",
        "Se o navegador não suportar reconhecimento de voz, avisa por um toast em vez de travar."
      ],
      "legado": "V3.16.0.1"
    },
    {
      "versao": "V3.16.0.2",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Tarefas do Sistema: redesign — menos poluído, categoria multi-select, cor livre",
      "itens": [
        "Motivo (Milton): a tela estava \"muito cheia de informação\" — card de progresso gigante, filtros de projeto e categoria sempre abertos e espalhados, cor de categoria muito limitada.",
        "Card de progresso ficou compacto (uma faixa fina, não mais um bloco preto grande).",
        "Filtros de projeto/categoria/dependência saíram do topo fixo e foram pra um painel \"🔍 Filtros\" que abre/fecha, com contador de quantos filtros estão ativos e botão \"Limpar filtros\".",
        "Categoria virou multi-select no filtro — dá pra marcar mais de uma categoria ao mesmo tempo pra ver as tarefas que batem com qualquer uma delas (antes só dava pra escolher uma).",
        "Botão \"+ Nova categoria\" ficou visível direto dentro do painel de Filtros, não só escondido dentro do Gerenciar.",
        "Paleta de cor de categoria saiu de ~12 opções fixas pra 36 cores curadas + um seletor de cor livre (🎨, ilimitado) — vale pra criar categoria rápida, editar categoria e pro Gerenciar, nos mesmos lugares de sempre."
      ],
      "legado": "V3.16.0.2"
    },
    {
      "versao": "V3.16.0.3",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Planejamento: Visão Organizacional (Gantt filtrado por linhas escolhidas) + Setas de Predecessora no Gantt (estilo MS Project)",
      "itens": [
        "🗂 Visão Organizacional (botão ao lado do Editor de Estrutura): ferramenta de máscara — você marca quais linhas do Planejamento quer ver (com busca; marcar um grupo marca o bloco inteiro dele) e a tela mostra SÓ elas, com tabela + Gantt idênticos e tudo funcionando igual (edição, predecessoras, filtros combinam). Botão fica dourado com a contagem quando ativa; \"Limpar\" volta a mostrar tudo. A máscara fica salva por obra no navegador — primeira visão de uma família que vai crescer.",
        "☑ Setas de Predecessora (botão na toolbar, só com o Gantt visível): desenha no Gantt o caminho de cada predecessora até a tarefa dela — sai do fim da barra da predecessora, desce/sobe e entra com uma setinha no início da tarefa, igual MS Project.",
        "Interação das setas: passar o mouse escurece/destaca a seta; clicar deixa ela marcada em dourado e mostra o número + nome da predecessora. Clicar de novo desmarca.",
        "Predecessora fora da visão atual (filtrada pela Visão Organizacional, busca ou outro filtro) simplesmente não desenha seta — sem erro, sem seta apontando pro nada.",
        "Desempenho cuidado: as setas são desenhadas só perto da janela visível (mesma lógica do virtual scroll da tabela) — obra com 2.400 tarefas não pesa."
      ],
      "legado": "V3.16.0.3"
    },
    {
      "versao": "V3.16.1",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Tarefas do Sistema: Agenda corrigida (mesma tarefa em vários horários) + visual de caderno de verdade + voz com permissão explícita",
      "itens": [
        "Bug real (Milton reportou): a Agenda não deixava colocar a MESMA tarefa em mais de um horário — porque o horário ficava salvo dentro da própria tarefa (um único campo), então escolher ela de novo só movia a alocação, nunca duplicava.",
        "Corrigido pela raiz: criada a coleção tarefasAgenda, separada da tarefa — cada alocação é seu próprio registro (tarefaId + data + horário). Agora a mesma tarefa pode estar em quantos horários você quiser, no mesmo dia ou em dias diferentes. Cada horário tem seu próprio campo \"+ escolher/adicionar outra\".",
        "Agenda com visual novo de caderno de planejamento: fundo cor de papel, linha vermelha de margem, linhas pontilhadas separando os horários, fonte cursiva na data — saiu do estilo \"sistema\" chapado de antes.",
        "Página do módulo desinchada mais um passo: o card preto de progresso saiu de cena — virou uma linha de texto discreta embaixo do título + uma barrinha fina, sem caixa separada tomando espaço.",
        "Botão de voz: agora pede a permissão do microfone explicitamente antes de gravar (em alguns Android com o app instalado como PWA, o navegador não mostra esse prompt sozinho) e cada erro (permissão negada, sem microfone, sem rede, silêncio) aparece com uma mensagem específica em vez de simplesmente não fazer nada."
      ],
      "legado": "V3.16.0.4"
    },
    {
      "versao": "V3.16.1.1",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Visão Organizacional virou menu de visões (+ Só os Pais por nível); setas de predecessora não cortam mais as barras; recolher grupo na visão filtrada não some mais com tudo",
      "itens": [
        "O botão 🗂 Visão Organizacional agora abre um MENU de visões (é uma família que vai crescer): \"📊 Gantt Filtrado\" (escolher linha a linha, como já era) e \"👪 Só os Pais — até nível N\" (mostra a estrutura até o nível escolhido e esconde os filhos — visão executiva rápida). \"✕ Limpar visão\" volta ao normal.",
        "BUG corrigido: com a visão filtrada ativa, clicar na setinha de recolher dos grupos fazia TUDO sumir (0 tarefas) sem ter como reabrir. Causa: a máscara podia não incluir os pais das linhas escolhidas — recolher um pai invisível escondia os filhos e não sobrava linha nenhuma. Agora a máscara SEMPRE inclui automaticamente os ancestrais das linhas escolhidas: o caminho hierárquico aparece, e recolher/expandir funciona normal.",
        "Setas de predecessora redesenhadas pra não passar por cima das barras: agora saem do fim da predecessora, correm pelo VÃO entre as linhas (na divisória, onde não tem barra) e só descem na coluna estreita logo antes do início da tarefa — Gantt limpo, igual MS Project.",
        "Segurança na visão filtrada: arrastar pra reordenar fica bloqueado (com aviso) enquanto a máscara está ativa — as linhas vizinhas na tela não são as vizinhas reais da estrutura, mover ali bagunçaria a base original. Edição de células, %, datas e predecessoras continuam liberadas (gravam por ID, sem risco).",
        "Sobre as cores no Gantt: a cor da barra é o STATUS da tarefa (azul = no prazo ainda não concluída, amarelo = em andamento, verde = concluída, vermelho = atrasada) — se tudo aparece azul na visão filtrada é porque todas aquelas tarefas estão no mesmo status, não é defeito da visão."
      ],
      "legado": "V3.16.0.5"
    },
    {
      "versao": "V3.16.1.2",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Toolbar do Planejamento reorganizada — trocar entre Linha de Base/Desafio/Atual não bagunça mais os botões",
      "itens": [
        "Antes, trocar a versão de datas fazia aparecer/sumir o botão \"Copiar datas\" NO MEIO da fila — tudo depois dele pulava de lugar, botões quebravam pra segunda linha de forma diferente a cada clique, sobrava espaço em branco. Uma bagunça.",
        "Agora são duas linhas com papel fixo: em cima as AÇÕES (⚙ Ferramentas · 🌳 Editor de Estrutura · 🗂 Visão Organizacional · ＋ Tarefa — sempre os mesmos, sempre no mesmo lugar) e embaixo a VISUALIZAÇÃO (versão de datas · zoom Dia→Ano · Gantt · Setas de Predecessora).",
        "Os botões que aparecem só às vezes (📋 Copiar datas, ＋ Colunas) agora entram sempre no FIM da linha de visualização — quando aparecem, nada existente muda de lugar.",
        "\"Setas de Predecessora\" ficou sempre visível (esmaecido quando o Gantt está escondido, com dica) — antes sumia e voltava junto com o Gantt, deslocando os vizinhos."
      ],
      "legado": "V3.16.0.6"
    },
    {
      "versao": "V3.16.2",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Agenda: o seletor de horário virou dropdown nativo feio — trocado por um seletor próprio, no estilo caderno",
      "itens": [
        "Bug real (Milton reportou com print): o campo \"+ escolher tarefa\" de cada horário era um <select> nativo do navegador — que abre como uma lista genérica cinza/azul do sistema, sem estilo nenhum, cobrindo a tela e destoando completamente do visual de caderno.",
        "Trocado por um seletor construído do zero: clicar em \"+ escolher tarefa\" abre, no próprio lugar, uma caixa com busca e a lista de tarefas pendentes já no estilo papel do módulo — sem nada nativo do navegador.",
        "Dá pra digitar pra filtrar a lista (por texto da tarefa ou nome do projeto) quando tiver muita tarefa pendente.",
        "Continua permitindo a mesma tarefa em vários horários (corrigido na V3.16.0.4) — isso não mudou, só a caixa de escolha ficou decente."
      ],
      "legado": "V3.16.0.7"
    },
    {
      "versao": "V3.16.3",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Toolbar do Planejamento: a reorganização da V3.16.0.6 deixou tudo torto (ação jogada pra direita, visualização pra esquerda) — refeita como um bloco único",
      "itens": [
        "A tentativa anterior separava os botões em duas linhas com alinhamentos diferentes (uma \"space-between\" empurrando pra ponta direita, outra à esquerda) — resultado: visual desalinhado, gente de um lado, coisa do outro, sem nexo.",
        "Refeito do zero como UMA linha só de toolbar, tudo alinhado à esquerda, na ordem: versão de datas → zoom → Gantt/Setas → Ferramentas/Editor/Visão Organizacional → ＋ Tarefa → botões que só aparecem às vezes. Quebra pra segunda linha naturalmente quando não cabe, sem nenhum bloco \"flutuando\" separado."
      ],
      "legado": "V3.16.0.8"
    },
    {
      "versao": "V3.16.4",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Voz no Tarefas do Sistema: erro real agora aparece na tela (fixo, não some) em vez de simplesmente \"não funcionar\"",
      "itens": [
        "Sem acesso a um celular real pra reproduzir o problema, e sem log nenhum aparecendo, ficou impossível saber POR ONDE a voz estava falhando (permissão? navegador sem suporte? erro de rede do Google?).",
        "Criada uma caixa de erro vermelha fixa embaixo do campo de texto — não é mais um toast que passa rápido, ela fica na tela até a próxima tentativa. Mostra a causa técnica exata: falta de HTTPS, SpeechRecognition ausente (com o user-agent do navegador), permissão negada, sem microfone, sem internet, ou o erro puro que o navegador devolveu.",
        "Também cobre o caso de o próprio navigator.mediaDevices não existir (comum em WebView antigo/app instalado) — nesse caso avisa pra tentar abrir o site direto no Chrome, fora do atalho instalado, pra isolar se o problema é do PWA.",
        "Com essa mensagem na tela, a próxima tentativa vai mostrar exatamente qual é o problema real — o que faltava pra corrigir de vez em vez de ficar tentando adivinhar."
      ],
      "legado": "V3.16.0.9"
    },
    {
      "versao": "V3.16.5",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Toolbar do Planejamento: botão \"Copiar Datas\" que sobrava sozinho numa linha à parte foi tirado da barra e movido pra dentro de ⚙ Ferramentas",
      "itens": [
        "Esse botão só aparece quando a versão de datas não é \"Atual\" — e quando aparecia, ficava sobrando na quebra de linha, sozinho, deslocado do resto (a causa do visual torto reclamado). Removido da barra principal.",
        "Agora fica dentro de ⚙ Ferramentas → Correções & Recálculos, com o mesmo nome e função — só aparece no menu quando faz sentido (fora da versão Atual), sem nunca mais deslocar nada na toolbar."
      ],
      "legado": "V3.16.0.10"
    },
    {
      "versao": "V3.16.6",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Tarefas do Sistema: tema \"caderno\" removido, pop-up maior, título+descrição, intervalo de horário e seletor de tarefa hierárquico",
      "itens": [
        "Motivo (Milton, bem direto): o tema de caderno ficou feio e mal executado — removido por completo. Agenda agora usa a mesma linguagem visual do resto do sistema (branco/cinza/amarelo, Inter), sem tema temático nenhum.",
        "Pop-up da Agenda aumentado de 480px pra 680px de largura — item apontado como \"minúsculo\".",
        "Tarefa agora tem Título (curto) e Descrição (opcional, texto livre) separados, em vez de tudo num campo só que deixava o card da tarefa enorme. Na barra de criação, a descrição fica atrás de um \"+ adicionar descrição\" pra não poluir quando não precisa. No editar, os dois campos aparecem sempre.",
        "Na lista principal e na Agenda, o título agora corta em 1 linha (…) em vez de estourar o card. Clicar na tarefa abre um pop-up de detalhe (título grande + descrição formatada), com botão Editar dentro.",
        "Coluna de horário da Agenda agora mostra o intervalo completo (\"07:00 a 07:30\"), não só o horário de início.",
        "Seletor de tarefa da Agenda refeito: busca sempre no topo (pula direto pra qualquer tarefa por nome/sistema/categoria) e, sem buscar nada, navegação em 3 níveis — Sistema → Categoria → Tarefa — com contador em cada nível e breadcrumb pra voltar.",
        "Pra adicionar mais de uma tarefa no mesmo horário: um \"+\" pequeno e discreto ao lado das já alocadas, em vez do formulário ficar sempre aberto ocupando espaço.",
        "Corrigido de raiz, na mesma rodada: \"Sem projeto\" e \"Sem categoria\" quebravam a navegação hierárquica (string vazia sendo confundida com \"nada selecionado ainda\") — resolvido com marcadores internos próprios em vez de string vazia."
      ],
      "legado": "V3.16.0.11"
    },
    {
      "versao": "V3.16.7",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Agenda: \"+\" foi pra baixo em vez da direita, categorias sem cor e lista com cara de lista antiga — três acertos",
      "itens": [
        "O botão \"+\" de adicionar outra tarefa no horário estava aparecendo ABAIXO das tarefas já alocadas, alinhado à esquerda — o pedido era na DIREITA, na mesma linha. Corrigido: o \"+\" agora é um elemento da própria linha do horário (não fica mais dentro do bloco de tarefas), sempre no canto direito.",
        "Categorias e sistemas no seletor agora mostram a bolinha de cor (igual usada no resto do sistema) — cada nível (projeto, categoria, tarefa) tem sua cor visível, não só texto puro.",
        "Visual \"lista antiga\" dos níveis do seletor (Sistema/Categoria) e da lista de tarefas: virou cartão — fundo branco, borda, espaçamento entre itens, sombra leve no hover — em vez de linhas coladas que só mudavam de cor ao passar o mouse."
      ],
      "legado": "V3.16.0.12"
    },
    {
      "versao": "V3.16.8",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Título/Descrição: tarefas antigas migradas automaticamente (V3.16.0.11 só valia pra tarefa nova)",
      "itens": [
        "Motivo (Milton): o campo Descrição só existia pra tarefa criada dali pra frente — as que já estavam cadastradas continuaram com tudo junto no título, do jeito que sempre foi.",
        "Adicionada uma migração automática que roda ao abrir o módulo: toda tarefa sem descrição, com texto longo (>40 caracteres) e que segue o padrão \"Ação: detalhes\" ou \"Ação — detalhes\" (é como quase toda tarefa já foi escrita), divide sozinha — título fica com a ação, descrição fica com o resto.",
        "Guarda de segurança: se o que sobra depois do separador for muito curto (uma palavra só, tipo \"Esgoto\" em \"Levantamento de material hidráulico por apartamento: Esgoto\"), NÃO divide — mantém tudo junto no título, porque nesse caso a palavra depois dos dois pontos é o identificador da tarefa, não uma descrição de verdade.",
        "Roda direto no Firestore (não é só efeito visual) — migra pra todo mundo que usa o sistema, não só em quem abriu primeiro."
      ],
      "legado": "V3.16.0.13"
    },
    {
      "versao": "V3.16.8.1",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Pop-ups do Tarefas do Sistema bem maiores",
      "itens": [
        "Agenda: de 680px pra até 960px de largura (quase a tela toda em monitor comum) e mais altura de sobra pra lista de horários.",
        "Detalhe/Editar tarefa e Nova/Editar categoria: de 480px pra 640px."
      ],
      "legado": "V3.16.0.14"
    },
    {
      "versao": "V3.16.8.2",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Descrição virou obrigatória e a voz agora dita a descrição, não o título",
      "itens": [
        "Motivo (Milton): a descrição não devia ser opcional (\"+ adicionar descrição\") — tirado o botão de mostrar/escoltar, o campo Descrição agora aparece sempre, tanto pra criar quanto pra editar, e é obrigatório em ambos (não salva sem preencher).",
        "O microfone 🎤 mudou de lugar: antes ficava ao lado do Título e ditava nele; agora fica ao lado da Descrição e dita nela — combina mais com o uso real (título é curto e digitado rápido, descrição é o texto mais longo que vale a pena falar)."
      ],
      "legado": "V3.16.0.15"
    },
    {
      "versao": "V3.17.0",
      "data": "2026-08-19",
      "tipo": "funcionalidade",
      "titulo": "PDF → Tarefa: a IA agora gera Título, Descrição e Categoria (não só título solto)",
      "itens": [
        "Motivo (Milton): compartilhar o PDF escrito à mão só criava o título — faltava a IA já organizar em Título + Descrição (agora obrigatória em todo lugar) e, quando fizer sentido, uma Categoria.",
        "Categoria: antes de chamar a IA, o sistema busca as categorias já cadastradas em Tarefas do Sistema e manda a lista pra IA — ela é instruída a REAPROVEITAR uma existente sempre que se encaixar, e só criar uma nova (curta, 1 a 3 palavras) se nenhuma servir. Categoria nova vem com cor automática, igual as criadas manualmente.",
        "Se a tarefa não tiver uma categoria clara, a IA deixa em branco — não força uma categoria genérica só pra preencher o campo.",
        "Descrição nunca vem vazia (a IA foi instruída a nunca deixar em branco, mesmo que a nota não tenha detalhe extra) — consistente com a regra de descrição obrigatória da V3.16.0.15."
      ],
      "legado": "V3.17.0.0"
    },
    {
      "versao": "V3.17.0.1",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Voz: caixa de status agora mostra CADA passo (não só erro final) — pra achar onde trava quando \"não aparece nada\"",
      "itens": [
        "Milton reportou que a voz \"não funciona e não aparece nada\" — ou seja, nem o erro que a versão anterior mostrava. Isso indica que o processo trava ANTES de qualquer erro acontecer (provavelmente esperando a permissão do microfone).",
        "A caixa embaixo da Descrição agora mostra o passo atual em azul (Passo 1: pedindo permissão → Passo 2: permissão OK, iniciando → Passo 3: gravando, fale agora → Passo 4: texto reconhecido), e só fica vermelha quando um erro de fato acontece.",
        "Adicionado um \"vigia\" de 12 segundos: se a permissão do microfone não for respondida (nem liberada nem negada) nesse tempo, aparece um aviso específico dizendo que o prompt de permissão do navegador provavelmente não apareceu ou não foi notado — em vez de ficar parado pra sempre sem nada na tela.",
        "Com isso, na próxima tentativa a caixa vai mostrar em qual passo exatamente trava — essa informação (print da caixa, mesmo que ainda seja só \"Passo 1\" parado) é o que falta pra eu conseguir corrigir a causa raiz de vez."
      ],
      "legado": "V3.17.0.1"
    },
    {
      "versao": "V3.18.0",
      "data": "2026-08-19",
      "tipo": "funcionalidade",
      "titulo": "Voz removida (era instável) — substituída por fila de tarefas via chat; Checklist dentro da tarefa; esconder horários passados na Agenda",
      "itens": [
        "Voz removida do sistema: depois de várias tentativas de correção sem sucesso reproduzível, Milton decidiu tirar o botão de microfone do Tarefas do Sistema — botão, caixa de erro/status e toda a lógica de reconhecimento de voz foram removidos.",
        "Fila de tarefas via chat (substituindo a voz): Milton pode pedir pro Claude, direto na conversa, pra criar uma tarefa — o Claude escreve num arquivo (chat-fila-tarefas.json) com título, descrição, categoria e checklist, e publica. Na próxima vez que o Tarefas do Sistema abrir, cada item da fila entra automaticamente no Firestore — sem duplicar mesmo se a página for recarregada várias vezes (cada item tem um ID próprio; se já existe, é ignorado).",
        "Checklist dentro da tarefa: cada tarefa pode ter uma lista de itens marcáveis (opcional, mas sempre disponível na criação e edição). Lista principal mostra o progresso (\"☑ 2/5\"), o pop-up de detalhe mostra os itens com checkbox clicável, e cada item do checklist pode ser agendado num horário PRÓPRIO na Agenda, separado do horário da tarefa principal.",
        "Agenda: novo botão pra esconder os horários que já passaram no dia de hoje (mostra só o que falta), com opção de reverter e ver tudo — preferência salva no navegador.",
        "Voltar pro topo: depois de adicionar ou editar uma tarefa, a tela rola de volta pro topo automaticamente, pra sempre ver o resultado sem precisar procurar na lista."
      ],
      "legado": "V3.18.0.0"
    },
    {
      "versao": "V3.19.0",
      "data": "2026-08-19",
      "tipo": "funcionalidade",
      "titulo": "Categoria/Subcategoria no Planejamento: importação via planilha + nova visão Agrupador de Categoria",
      "itens": [
        "Importar Correções (Planejamento) agora também aceita Categoria e Subcategoria — casa por ID igual aos outros campos, permitindo trazer a classificação feita fora do sistema (ex: planilha categorizada) direto pras tarefas, sem tocar em ordem, código ou estrutura.",
        "Nova visão \"🏷 Agrupador de Categoria\" no menu Visão Organizacional: reorganiza a exibição das tarefas por Categoria > Subcategoria (ex: Alvenaria > Vedação, Gesso > Forro) em vez da estrutura do cronograma — é só uma máscara de visão, não altera dados reais. Clique numa tarefa abre a edição normal.",
        "Tarefa sem Categoria aparece agrupada em \"⚠ Sem Categoria\" dentro dessa visão — nunca some, sempre visível pra revisão.",
        "Removidos os botões \"Só os Pais — até nível N\" do menu Visão Organizacional (substituídos pelo Agrupador de Categoria, mais útil no dia a dia)."
      ],
      "legado": "V3.19.0.0"
    },
    {
      "versao": "V3.19.0.1",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Barra do Gantt: passar o mouse mostra a data de início/término",
      "itens": [
        "Tooltip (passar o mouse) nas barras do Gantt agora mostra nome + início + término da tarefa, além do %. Antes só mostrava nome e %.",
        "Corrigido de brinde: as barras desenhadas durante a repintura rápida (edição de célula/scroll) não tinham tooltip nenhum — agora têm, igual às barras do desenho completo."
      ],
      "legado": "V3.19.0.1"
    },
    {
      "versao": "V3.19.1",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Gantt (barra, setas de predecessora e PNG) estava sempre na versão \"Atual\" mesmo com Base/Desafio selecionado na tabela",
      "itens": [
        "Bug real: a coluna Início/Término da tabela respeita o seletor Atual/Linha de Base/Desafio, mas a BARRA do Gantt ficava hardcoded em Atual (inicioPlanejado/terminoPlanejado) sempre — resultado: tabela mostrando uma data (ex: Desafio, 02/06) e a barra desenhada em outra (Atual, pode ter sido lá pra setembro). Parecia \"data errada\", mas eram duas versões diferentes sendo misturadas na mesma tela.",
        "Corrigido: barra do Gantt, setas de predecessora, limites do zoom (dMin/dMax) e exportação PNG agora seguem a mesma versão selecionada no seletor Atual/Base/Desafio — sempre a mesma data que a tabela mostra.",
        "Agrupador de Categoria também corrigido (tinha o mesmo hardcode)."
      ],
      "legado": "V3.19.1"
    },
    {
      "versao": "V3.19.1.1",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Agenda: criar tarefa nova direto de dentro do seletor de horário (sem precisar voltar pro formulário principal)",
      "itens": [
        "Motivo (Milton): quando ele queria agendar uma tarefa que ainda não existia na lista, tinha que fechar a Agenda, ir criar a tarefa no formulário principal, voltar pra Agenda e só então agendar — três passos pra uma coisa só.",
        "Agora, dentro do seletor de tarefa (o mesmo que abre ao clicar no \"+\" de um horário), tem um link \"+ Não existe ainda? Criar tarefa nova\". Clicar nele abre um mini formulário ali mesmo (Título + Descrição, ambos obrigatórios) — ao criar, a tarefa já nasce E fica agendada naquele horário, sem sair da Agenda."
      ],
      "legado": "V3.19.2"
    },
    {
      "versao": "V3.19.2",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Categoria/Subcategoria: faltava aparecer na tabela e na Exportação Excel (só existiam na importação e no Agrupador)",
      "itens": [
        "Gap real: quando criamos Categoria/Subcategoria, só entraram no Importar Correções e no Agrupador de Categoria — não tinham coluna na tabela do Planejamento nem na Exportação Excel (simples). Resultado: mesmo importando certo, não tinha como VER nem RE-EXPORTAR o dado em nenhum outro lugar do sistema.",
        "Categoria e Subcategoria agora são colunas normais da tabela (clique pra editar direto, igual Grupo/Local) — aparecem por padrão, pode escondê-las como qualquer coluna.",
        "Exportação Excel (simples) agora inclui Categoria e Subcategoria.",
        "Se a importação da planilha categorizada nunca foi feita, isso ainda precisa ser feito uma vez em Importar Correções (marcando Categoria e Subcategoria) — usando a planilha que já tem essas duas colunas preenchidas, não qualquer exportação nova do sistema (essas saem em branco até a importação ser feita)."
      ],
      "legado": "V3.19.3"
    },
    {
      "versao": "V3.19.2.1",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Controle de Estacas: Planejamento e Acompanhamento voltam a mostrar só as estacas da concretagem selecionada (isolado)",
      "itens": [
        "Acompanhamento voltou a mostrar só as peças marcadas/atribuídas à concretagem selecionada — removida a lógica de mostrar também as concretagens anteriores (número menor) que tinha entrado numa rodada passada.",
        "Planejamento ganhou o mesmo comportamento: com uma concretagem em foco (📌), o mapa mostra só as peças ainda sem concretagem + as já atribuídas a ELA — escondendo as que já pertencem a outras concretagens. Sem nenhuma foco, continua mostrando tudo com o número de cada uma."
      ],
      "legado": "V3.19.4"
    },
    {
      "versao": "V3.19.3",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: entendi errado — mapa volta a mostrar TUDO, número da concretagem vira botão opcional",
      "itens": [
        "A versão anterior escondia peças de outras concretagens — não era isso. O mapa (Planejamento e Acompanhamento) volta a mostrar TODAS as peças, de qualquer concretagem, com a cor real de cada uma (verde/parcial/pendente).",
        "O que muda por padrão agora é só o NÚMERO no marcador: mostra o número só das peças da concretagem que você tem selecionada/em foco no momento — sem misturar 1, 2, 3, 4 todos juntos e confundir qual é qual.",
        "Novo botão \\\"🔢 Mostrar números de todas\\\" — clique pra ligar/desligar, exatamente como pedido: opcional, não travado."
      ],
      "legado": "V3.19.5"
    },
    {
      "versao": "V3.19.4",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: botão de números não fazia sentido no Planejamento — removido de lá",
      "itens": [
        "No Planejamento, o botão \\\"Mostrar números de todas\\\" não tinha efeito na maior parte do tempo: sem nenhuma concretagem em foco (📌), o mapa já mostrava todos os números de qualquer forma — o botão parecia travado/inútil.",
        "Removido o botão do Planejamento. Agora o próprio foco (clicar num card de concretagem pra selecioná-la) já funciona como o seletor: sem foco, mostra o número de todas; com uma concretagem em foco, mostra só o número dela. Sem clique extra, sem botão redundante.",
        "O botão \\\"🔢 Mostrar números de todas\\\" continua igual no Acompanhamento, onde faz sentido — ali sempre tem uma concretagem selecionada (é obrigatório), então o botão é o jeito de escolher entre ver só a dela ou ver todas juntas."
      ],
      "legado": "V3.19.6"
    },
    {
      "versao": "V3.19.4.1",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Planejamento: nova coluna Subgrupo (combina Andar + Final num código único)",
      "itens": [
        "Nova coluna \"Subgrupo\", ao lado de \"Grupo\": quando a tarefa tem um andar (Grupo = \"N° Pavimento\") E faz parte de uma frente paralela (\"- Final NN\" no nome), Subgrupo = andar×10 + número do Final. Ex: 1° Pavimento Final 01 → 11 · 1° Pavimento Final 02 → 12 · 7° Pavimento Final 02 → 72.",
        "Fica em branco quando não há esse cruzamento: Térreo/SS1/SS2/Ático e áreas comuns (não têm Final), e andares sem separação por Final.",
        "Objetivo: cruzar Categoria/Subcategoria (o quê) com Grupo/Subgrupo (onde/qual frente) — base pra uma futura visão de atividade por andar.",
        "Editável na tabela igual Grupo, entra no Importar Correções e na Exportação Excel (simples)."
      ],
      "legado": "V3.19.6.1"
    },
    {
      "versao": "V3.19.4.2",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Estrutura da Obra: novo botão \"⚡ Gerar Grupos\" — preenche Grupo/Subgrupo de toda a obra automaticamente",
      "itens": [
        "Motivo (Milton): Grupo/Subgrupo estavam sendo preenchidos manualmente (planilha) sem uma lista oficial de pavimentos por trás — risco de inconsistência. A Estrutura da Obra (Torre > Pavimento > Apartamento) já existia pra outra finalidade (vincular Local/Pav/Apto) — passou a servir de fonte única também pra Grupo/Subgrupo.",
        "Cadastra-se os pavimentos uma vez em 🏢 Estrutura da Obra (ex: 2º Subsolo, 1º Subsolo, Térreo, 1º...16º Pavimento, Ático, Reservatório, Fachada) e clica em \"⚡ Gerar Grupos\": o sistema compara o nome de cada pavimento com o nome de cada tarefa (mesmo mecanismo do Auto-vincular por Nome) e propõe Grupo = pavimento reconhecido.",
        "Subgrupo é calculado automaticamente só quando o pavimento é do tipo \"Nº Pavimento\" E a tarefa tem \"- Final NN\" no nome: Subgrupo = andar×10 + número do Final (1º Pavimento Final 02 = 12, 16º Pavimento Final 01 = 161). Fora disso fica em branco.",
        "Sempre mostra prévia (o que muda de X para Y) antes de aplicar — nunca escreve direto, e só lista o que realmente vai mudar."
      ],
      "legado": "V3.19.6.2"
    },
    {
      "versao": "V3.19.5",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Importar Correções/Base Completa agora avisa se a planilha é de outra obra (causou 0 casadas pelo ID hoje)",
      "itens": [
        "Causa raiz de um erro real: Milton importou uma planilha certa numa obra errada (selecionada por engano) — 0 tarefas casaram pelo ID porque os IDs pertencem a outra obra, e o import tentou casar só por Código/Nome (arriscado, muita coisa não achada).",
        "Exportar Excel (simples) e Exportar Frentes agora gravam a obra de origem dentro do próprio arquivo (aba oculta \"_obra\", ID + nome).",
        "Importar Correções mostra logo no topo do modal de qual obra a planilha saiu (verde se é a mesma de agora, vermelho se é outra).",
        "Se for de outra obra, tanto Importar Correções quanto Importar Base Completa avisam com os nomes das duas obras ANTES de deixar continuar — dá pra cancelar e trocar de obra primeiro.",
        "Planilhas exportadas antes dessa versão não têm esse metadado — continuam funcionando igual, sem aviso (não tem como saber a origem delas)."
      ],
      "legado": "V3.19.7"
    },
    {
      "versao": "V3.19.5.1",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Gerar Grupos: valor proposto agora é editável na prévia, e edita em lote",
      "itens": [
        "Motivo (Milton): o match automático por nome às vezes escolhe o pavimento errado quando duas palavras aparecem juntas no nome da tarefa (ex: \"Reservatório - SS2\" — o sistema pegava \"Reservatório\" por ser a palavra mais longa, mas a tarefa é do SS2 mesmo).",
        "Na prévia do \"⚡ Gerar Grupos\", o valor proposto (antes só texto) agora é um campo editável. Mudar um já aplica a MESMA mudança em todas as outras linhas que tinham a mesma proposta — não precisa corrigir uma por uma quando o mesmo engano se repete.",
        "Subgrupo recalcula automaticamente ao editar: se o novo valor não for do tipo \"Nº Pavimento\", o subgrupo daquela linha some (não tem como calcular andar×Final sem um andar)."
      ],
      "legado": "V3.19.7.1"
    },
    {
      "versao": "V3.19.6",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Gerar Grupos: linha da prévia num flex-row só não cabia em tela de celular — input de editar ficava difícil de acertar",
      "itens": [
        "Cada linha tinha checkbox + nome + valor antigo + seta + input de editar (150px fixo) + subgrupo tudo numa linha só, sem quebra — numa tela estreita isso espreme tudo e o toque fica ambíguo (difícil saber se vai marcar o checkbox ou editar o valor).",
        "Reorganizado em 2 linhas por tarefa: checkbox+nome numa (clicar em qualquer parte do nome já marca/desmarca — não precisa mais acertar o quadradinho pequeno), e \"de → para\" numa linha própria embaixo, com o campo de editar podendo crescer/quebrar à vontade."
      ],
      "legado": "V3.19.7.2"
    },
    {
      "versao": "V3.19.7",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Gerar Grupos: volta pro layout de 1 linha (Milton preferiu) + valor proposto agora é lista fechada, não texto livre",
      "itens": [
        "Layout de 2 linhas da versão anterior piorou a leitura (o problema não era falta de espaço — Milton usa desktop). Voltou pro layout compacto de 1 linha por tarefa.",
        "Mudança de verdade: o campo de corrigir o valor proposto era um texto livre — dava pra digitar qualquer coisa (typo, acento diferente, maiúscula/minúscula) e criar um Grupo parecido mas diferente do pavimento que já existe na Estrutura da Obra, em vez de casar com ele. Agora é uma lista (dropdown) com só os pavimentos já cadastrados — só dá pra escolher um que já existe, nunca inventar um novo ali."
      ],
      "legado": "V3.19.7.3"
    },
    {
      "versao": "V3.19.8",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Gerar Grupos: dropdown de pavimentos estava fora de ordem (10º antes de 1º)",
      "itens": [
        "Bug: a lista era ordenada por texto (localeCompare), e string compara caractere por caractere — \"1\" < \"1º\" < \"10º\", então 10º a 16º Pavimento apareciam ANTES de 1º Pavimento.",
        "Corrigido pra usar a mesma ordem que já existe na Estrutura da Obra (campo interno \"ordem\" de cada pavimento, a ordem que Milton arruma lá) — nunca mais re-ordenar por texto."
      ],
      "legado": "V3.19.7.4"
    },
    {
      "versao": "V3.19.9",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Gerar Grupos: corrigir uma proposta errada arrastava OUTRO grupo diferente que caiu na mesma proposta por coincidência",
      "itens": [
        "Bug real (Milton pegou): \"Reservatório - SS2\" e \"Reservatório Superior\" são locais DIFERENTES, mas os dois bateram na mesma proposta errada \"RESERVATÓRIO\". A propagação olhava só a proposta — corrigir um pra SS2 ia arrastar o outro (Reservatório Superior) pra SS2 também, que está errado.",
        "Agora a propagação exige bater o valor ANTERIOR também, não só a proposta — só muda junto quem tinha exatamente o mesmo \"de\" E o mesmo \"para\" errado. Grupos diferentes que colidiram na mesma proposta por coincidência não se misturam mais."
      ],
      "legado": "V3.19.7.5"
    },
    {
      "versao": "V3.19.10",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Gerar Grupos reconhecia só 185 de 2198 tarefas — dois bugs de digitação/nomenclatura corrigidos",
      "itens": [
        "Bug 1 (o principal): \"º\" (indicador ordinal) e \"°\" (símbolo de grau) são visualmente idênticos mas são caracteres Unicode DIFERENTES. Se a Estrutura da Obra foi digitada com um e as tarefas usam o outro, \"1º Pavimento\" nunca casava com \"1° Pavimento\" — isso sozinho explica a maior parte dos 2013 não-reconhecidos (1 a 16 Pavimento são a maioria das tarefas). Corrigido: os dois agora são tratados como iguais.",
        "Bug 2: pavimentos como \"1º Subsolo\"/\"2º Subsolo\" não têm esse texto literal dentro do nome das tarefas — a Cofield usa a sigla \"SS1\"/\"SS2\". Sem apelido cadastrado, nunca ia casar (não é erro de digitação, é nomenclatura diferente mesmo).",
        "Novo campo \"apelidos\" em cada pavimento da Estrutura da Obra (embaixo do nome, ex: digitar \"SS1\" no pavimento \"1º Subsolo\") — o reconhecimento passa a testar o nome oficial E os apelidos, mas o Grupo gerado sempre grava o nome oficial (o apelido só ajuda a achar, nunca aparece como valor final).",
        "Ação necessária: abre a Estrutura da Obra e cadastra o apelido de cada pavimento que usa sigla diferente do nome (SS1, SS2 pelo menos) — depois disso o Gerar Grupos deve reconhecer bem mais que 185."
      ],
      "legado": "V3.19.8"
    },
    {
      "versao": "V3.19.11",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Gerar Grupos: removido campo de apelidos (feio/manual) — reconhecimento agora entende as abreviações direto, sem cadastrar nada",
      "itens": [
        "Removido o campo \"apelidos\" da Estrutura da Obra (Milton achou feio e não precisa).",
        "No lugar: reconhecimento por PADRÃO — entende \"1SS\", \"1ºSS\", \"1º SUB\", \"1ºSUBSOLO\", \"1º SUBSOLO\", \"SS1\" (e o formato real dos dados, sigla antes do número tipo \"SS2\") como a MESMA coisa (Subsolo). E \"1º ANDAR\", \"1º PAVIMENTO\", \"1º AND\", \"1º PAV\" como a mesma coisa (Pavimento). Não precisa cadastrar nenhuma dessas variações — o sistema já entende.",
        "Funciona comparando SIGNIFICADO (número + se é subsolo ou pavimento) em vez de comparar texto — por isso cobre qualquer abreviação nova que apareça, não só as que alguém lembrou de cadastrar."
      ],
      "legado": "V3.19.9"
    },
    {
      "versao": "V3.19.12",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Gerar Grupos: mais dois padrões reconhecidos (T° Int/Ext = Térreo, Reserv. = Reservatório) — 1871 → 2156 de 2198",
      "itens": [
        "Testado com os nomes reais das 2198 tarefas antes de publicar (não só os exemplos passados): \"T° Int.\"/\"T° Ext.\" é a abreviação de Térreo usada em toda tarefa de área comum (Festas/Copa, Academia, Brinquedoteca etc.) — sem isso nenhuma delas casava com o pavimento Térreo cadastrado. \"Reserv.\" é Reservatório truncado.",
        "Resultado no teste: reconhecimento subiu de 1871 para 2156 de 2198 (98%).",
        "Os 42 que ainda ficam de fora não são bug — são tarefas de zonas que a Estrutura da Obra não tem cadastrada ainda: Muro Divisa (Frontal/Fundos/LD/LE), Cobertura (Tampa) e itens de logística/equipamento sem andar (Mini Grua, Cremalheira, Elevadores, Entrada de Energia Definitiva) — cadastrando essas zonas como pavimento/local também cobre."
      ],
      "legado": "V3.19.10"
    },
    {
      "versao": "V3.19.12.1",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Gerar Grupos: Muro Divisa e Cobertura resolvidos, tarefa sem vínculo aparece marcada (não desaparece), lista ordenada pelo pavimento",
      "itens": [
        "Regra do Milton: Muro Divisa é sempre Térreo, e Cobertura (Tampa) é sempre Reservatório — cadastrado direto no reconhecimento (2177 de 2198 casam com um pavimento real agora).",
        "As tarefas que realmente não têm andar (Mini Grua, Cremalheira, Elevadores, Entrada de Energia Definitiva, Vistoria Cliente, Fundação...) agora aparecem na prévia também — marcadas como \"— Sem Vínculo —\" em vez de simplesmente desaparecer da lista sem explicação. Pode confirmar assim ou trocar pra um pavimento real se achar que deveria ter um.",
        "Lista da prévia agora vem ordenada pela ordem dos pavimentos na Estrutura da Obra (tudo do 1º Pavimento junto, depois 2º, etc.) em vez da ordem solta da tarefa — mais fácil de revisar bloco por bloco."
      ],
      "legado": "V3.19.11"
    },
    {
      "versao": "V3.19.13",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Gerar Grupos não reconhecia pavimento novo cadastrado no plural quando a tarefa usa singular (ex: \"Elevadores\" x \"Elevador 01\")",
      "itens": [
        "Bug real (Milton pegou): cadastrou o pavimento \"Elevadores\" (plural) na Estrutura da Obra, mas as tarefas dizem \"Elevador 01\", \"Elevador 1\" etc (singular) — palavra maior (plural) nunca é substring da menor (singular), então nunca batia. Cadastrar não bastava, o Gerar Grupos continuava sem achar.",
        "Corrigido: ao comparar, agora também testa o pavimento sem o \"s\" ou \"es\" do final (regra comum de plural em PT-BR) — \"Elevadores\" passa a reconhecer \"Elevador\" dentro do nome da tarefa. Vale pra qualquer pavimento novo cadastrado, não só Elevadores."
      ],
      "legado": "V3.19.12"
    },
    {
      "versao": "V3.19.13.1",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Subgrupo passa a entender \"ap. NN\" como a mesma coisa que \"Final NN\" (regra do Milton)",
      "itens": [
        "Confirmado com dados reais: \"Concretagem Laje Piso: 5° Pavimento - ap. 01\" e \"Rede Frigorígena: 5° Pavimento - Final 01\" são a mesma unidade/torre — só trades diferentes descrevendo do jeito próprio deles (\"ap.\" vs \"Final\").",
        "Subgrupo agora reconhece Final NN, ap. NN, apto NN e apartamento NN como equivalentes — todas geram o mesmo cálculo (andar×10+NN). Não muda nada em quem já tinha \"Final\", só passa a calcular pra quem tinha \"ap.\" e antes ficava sem Subgrupo."
      ],
      "legado": "V3.19.13"
    },
    {
      "versao": "V3.19.13.2",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Andamento por Frente REESCRITO: matriz Categoria × Grupo do Planejamento",
      "itens": [
        "O sistema antigo (vínculo por local/pavimento + configuração de frentes) foi APOSENTADO. A visão agora nasce direto dos campos do Planejamento, sem configurar nada: linhas = Categoria › Subcategoria, colunas = Grupo › Subgrupo.",
        "Cada célula cruza a categoria com o grupo e mostra a % executada dali (média ponderada pela duração quando há mais de uma tarefa). Verde/amarelo/vermelho por faixa, ✓ quando 100%.",
        "Filtros em cima da tabela: Categoria, Subcategoria, Grupo, Subgrupo, Nº Equipe e busca livre — escolher um grupo/categoria filtra também as opções dependentes.",
        "Clique no quadradinho: lista das tarefas daquele cruzamento com data de início, fim e % de cada uma, e o TOTAL embaixo — quantidade, período (início mais cedo → fim mais tardio) e % média do conjunto.",
        "Coluna \"Geral\" no fim de cada linha com o consolidado da categoria/subcategoria em todos os grupos."
      ],
      "legado": "V3.19.13.1"
    },
    {
      "versao": "V3.19.13.3",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Gerar Grupos: cabeçalho de seção por pavimento, filtro de busca e Subgrupo sempre visível na prévia",
      "itens": [
        "A lista já vinha ordenada por pavimento, mas sem separação visual — agora cada bloco tem um cabeçalho \"▸ NOME DO PAVIMENTO (Nº tarefas)\", então dá pra ver de cara onde um grupo termina e o outro começa, em vez de vasculhar linha por linha.",
        "Novo campo de busca no topo da prévia — filtra por pavimento proposto ou por nome da tarefa (ex: digitar \"2 subsolo\" mostra só esse bloco).",
        "Subgrupo agora aparece sempre como uma coluna própria (mostra o número ou \"—\"), não só quando existe — fica fácil auditar se calculou certo em vez de precisar adivinhar pela ausência."
      ],
      "legado": "V3.19.13.2"
    },
    {
      "versao": "V3.19.13.4",
      "data": "2026-08-18",
      "tipo": "melhoria",
      "titulo": "Frentes: ordem por data de execução, mobile arrumado e filtro de equipe sempre à mão",
      "itens": [
        "As linhas (categorias e subcategorias) agora saem ORDENADAS PELA DATA DE EXECUÇÃO — o conjunto que começa antes no cronograma aparece primeiro, em vez de ordem alfabética.",
        "Cabeçalho bugado corrigido: a linha dos grupos tem altura travada, então a segunda linha (subgrupos) não sobrepõe mais ao rolar — era o que quebrava principalmente no celular.",
        "Mobile: filtros ocupam a largura da tela (busca em linha própria), células e cabeçalhos compactos, nome da categoria quebra linha e a tabela rola com o dedo com altura limitada.",
        "O seletor de Nº Equipe agora aparece SEMPRE — se nenhuma tarefa tem equipe preenchida no Planejamento, ele mostra o aviso em vez de sumir (a busca 🔎 continua sempre visível ao lado)."
      ],
      "legado": "V3.19.13.3"
    },
    {
      "versao": "V3.19.13.5",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Gerar Grupos: dropdown \"ir direto pro grupo\" além da busca por texto",
      "itens": [
        "Novo seletor ao lado da busca — lista todos os pavimentos que aparecem nessa prévia (na ordem da Estrutura da Obra, com a contagem de cada um) e ao escolher um filtra a lista só pra aquele grupo, sem precisar digitar nada.",
        "Os dois filtros (busca por texto + esse seletor) funcionam juntos — pode combinar."
      ],
      "legado": "V3.19.13.4"
    },
    {
      "versao": "V3.19.14",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Matriz de Frentes: rolagem lateral sem atravessar coluna nem sumir título",
      "itens": [
        "Ao arrastar a tabela pro lado, a linha do cabeçalho não \"atravessa\" mais a primeira coluna: o canto (cabeçalho + coluna de categorias) agora fica acima de tudo na pilha.",
        "As linhas escuras de agrupamento (título da categoria) não somem mais na rolagem horizontal: o título fica grudado na esquerda visível e acompanha o arrasto — principal incômodo no celular."
      ],
      "legado": "V3.19.13.5"
    },
    {
      "versao": "V3.19.15",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Matriz de Frentes: filtros refeitos, divisórias visíveis e canto corrigido de vez",
      "itens": [
        "Filtros REFEITOS — agora são 4, cada um com rótulo em cima dizendo o que faz: COLUNAS (Grupos resumido ↔ Subgrupos detalhado, num seletor só), CATEGORIA, EQUIPE e BUSCAR. Os seletores confusos de grupo/subgrupo/subcategoria foram removidos.",
        "No modo \"Grupos (resumido)\" cada grupo vira UMA coluna (os subgrupos são somados) — dá pra ver vários grupos/apartamentos de uma vez; \"Subgrupos (detalhado)\" abre coluna por coluna.",
        "Divisórias verticais agora aparecem entre as células, com uma linha FORTE separando um grupo do outro (inclusive no cabeçalho, em amarelo).",
        "Linha preta do cabeçalho invadindo a 1ª coluna no scroll lateral: corrigido de verdade — a regra anterior perdia na prioridade do CSS e o canto ficava no mesmo nível dos títulos; agora o canto vence sempre.",
        "Colunas mais compactas: cabem mais grupos na tela de uma vez."
      ],
      "legado": "V3.19.13.6"
    },
    {
      "versao": "V3.19.16",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Filtros clicáveis no celular, busca sem acento e mobile de Atividades/Suprimentos repaginado",
      "itens": [
        "Categoria e Equipe não abriam no toque: os seletores estavam embrulhados numa <label>, e o clique sintético dela abria e fechava o menu na mesma hora no celular. Trocado o embrulho — os três seletores clicam normalmente.",
        "A BUSCA agora ignora acentos nos dois lados: digitar \"gas\" acha \"Gás\", \"eletrica\" acha \"Elétrica\" — vale pra nome da tarefa, grupo, subgrupo, categoria e subcategoria.",
        "Mobile de Atividades e Suprimentos repaginado: a régua de níveis não estoura mais o card (vira um trilho com rolagem própria, sem \"atravessar até o infinito\"), a toolbar empilha (título em cima, níveis e horizonte embaixo ocupando a largura), nomes quebram linha e os cards ficaram mais compactos."
      ],
      "legado": "V3.19.13.7"
    },
    {
      "versao": "V3.19.17",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Seletores de Categoria/Equipe corrigidos (causa real) e minimapas domados no mobile",
      "itens": [
        "CAUSA REAL dos seletores que \"não abriam\": o Dashboard se re-renderiza em TEMPO REAL a cada gravação no Firestore — com a obra ativa, o menu do seletor era destruído no instante em que abria. Agora, enquanto um filtro está em uso (aberto/focado), o re-render automático espera o foco sair; as suas escolhas continuam aplicando na hora.",
        "Minimapas de Estacas, Contenção e Fundação no celular: não estouram mais a caixa pela direita (largura contida à tela) e passar o dedo por cima do mapa VOLTA a rolar a página — o mapa não captura mais o gesto vertical."
      ],
      "legado": "V3.19.13.8"
    },
    {
      "versao": "V3.19.18",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Filtros em DOM fixo (agora abrem SEMPRE) + toque de verdade nos mapas",
      "itens": [
        "Seletores de Colunas/Categoria/Equipe: mudança estrutural — os filtros agora vivem num pedaço FIXO da tela que nunca é recriado pelas atualizações em tempo real; só a matriz se redesenha. Não existe mais a corrida entre o toque e o re-render que impedia o menu de abrir. A busca também não perde mais o foco/teclado enquanto digita.",
        "Minimapas (Estacas/Contenção): o motor do mapa marca o palco com touch-action:none direto no elemento — regra com !important devolve o gesto pro navegador; passar o dedo em cima volta a rolar a página normalmente (o minimapa é só clique pra ampliar).",
        "Popup da prancha no celular: agora entende toque — 1 dedo ARRASTA O MAPA, pinça com 2 dedos dá ZOOM no ponto, e a página de trás fica travada enquanto o popup está aberto (não rola mais por baixo)."
      ],
      "legado": "V3.19.13.9"
    },
    {
      "versao": "V3.19.19",
      "data": "2026-08-18",
      "tipo": "correcao",
      "titulo": "Filtros da matriz sem select nativo — botão + painel de opções",
      "itens": [
        "Depois de várias tentativas em cima do <select> nativo, ele foi ELIMINADO dos filtros: Colunas, Categoria e Equipe agora são botões que abrem um painel de opções em tela — exatamente o mesmo mecanismo do detalhe da célula e do menu Extras, que funcionam em qualquer aparelho.",
        "O botão mostra a escolha atual (ex: \"Categoria: Alvenaria\"), o painel marca a opção ativa com ✓ e rola quando a lista é grande. A busca segue como campo de texto ao lado."
      ],
      "legado": "V3.19.13.10"
    },
    {
      "versao": "V3.19.20",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Agenda: tarefa já escolhida some do seletor sozinha, e dá pra escolher várias sem reabrir tudo de novo",
      "itens": [
        "Bug real (Milton reportou): depois de escolher uma tarefa pra um horário, ela continuava aparecendo no seletor pra escolher de novo — tanto no mesmo horário quanto em outros horários do mesmo dia.",
        "Corrigido: tarefa (ou item de checklist) já agendado NAQUELE DIA some sozinho do seletor. Tem um link \"👁 mostrar já escolhidas\" pra trazer de volta, pros casos em que a intenção é mesmo repetir a tarefa em outro horário.",
        "Escolher uma tarefa não fecha mais o seletor — ele continua aberto, do jeito que estava (mesma busca, mesmo lugar na navegação), pra escolher a próxima direto, sem ter que reabrir e renavegar tudo de novo. Um botão \"Fechar\" no final encerra quando terminar."
      ],
      "legado": "V3.19.13.11"
    },
    {
      "versao": "V3.19.20.1",
      "data": "2026-08-19",
      "tipo": "funcionalidade",
      "titulo": "Agenda: clique direito mostra descrição, marcar concluído direto no seletor, copiar/colar entre horários, trazer pendências de ontem",
      "itens": [
        "Clique com o botão direito numa tarefa do seletor (busca/navegação) abre o detalhe dela (título + descrição), sem precisar escolher/agendar nada — só pra conferir.",
        "Cada tarefa (e item de checklist) do seletor agora tem um checkbox — dá pra marcar como concluída direto ali, sem precisar fechar o seletor pra ir até a lista principal.",
        "Copiar entre horários: cada tarefa já agendada tem um botão ⧉ — clicar copia ela; abrir o \"+\" de outro horário mostra um botão \"📌 Colar aqui\" que agenda a mesma tarefa (ou item) ali, sem precisar buscar de novo. Trava simples: não deixa colar duplicado no mesmo horário onde já está.",
        "Trazer pendências do dia anterior: quando o dia anterior tem alocações cuja tarefa (ou item) ainda não foi concluída, aparece um botão \"↩️ Trazer N pendências do dia anterior\" — um clique replica todas elas pro dia atual, nos mesmos horários, pulando o que já foi trazido antes (sem duplicar)."
      ],
      "legado": "V3.19.13.12"
    },
    {
      "versao": "V3.19.21",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Gerar Grupos: era pra ser ordenar a lista, não filtrar pra um grupo só — trocado o dropdown por toggle Tarefa/Alfabética",
      "itens": [
        "Entendi errado antes: Milton não queria um seletor pra 'pular' pra um grupo específico — queria poder REORDENAR a lista inteira, ou pela ordem de tarefa (como já vem) ou em ordem alfabética de verdade pelo pavimento proposto.",
        "Removido o dropdown \"ir direto pro grupo\". No lugar, dois botões (Tarefa / Alfabética) ao lado da busca — trocam a ordem da lista toda instantaneamente, sem perder marcações nem edições feitas.",
        "Cabeçalho de seção (▸ NOME DO PAVIMENTO) só aparece em modo Alfabética, onde faz sentido (mesmo grupo fica junto) — em ordem de Tarefa ele sumiria e voltaria toda hora, então fica desligado nesse modo."
      ],
      "legado": "V3.19.13.13"
    },
    {
      "versao": "V3.19.22",
      "data": "2026-08-21",
      "tipo": "correcao",
      "titulo": "Filtros da matriz: clique por delegação, camada elevada e auto-diagnóstico",
      "itens": [
        "Clique dos filtros reescrito por DELEGAÇÃO na área dos filtros (fase de captura) — funciona mesmo que o conteúdo seja recriado e não depende do onclick de cada botão.",
        "A faixa dos filtros subiu de camada (z-index) — se algum elemento transparente estava por cima roubando o clique, ele não alcança mais.",
        "AUTO-DIAGNÓSTICO embutido: ao abrir o Dashboard, o sistema verifica se existe QUALQUER elemento sobreposto ao botão de Categoria; se houver, mostra um aviso amarelo na tela dizendo o nome exato do invasor (e no console). Se o aviso aparecer, mande o print — é o culpado definitivo."
      ],
      "legado": "V3.19.13.14"
    },
    {
      "versao": "V3.19.22.1",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Gerar Grupos: destrave manual — pergunta antes de propagar quando pode não ser sempre a mesma correção",
      "itens": [
        "Situação real (Milton pegou): 3 tarefas com \"Cobertura (Tampa)\" propunham todas \"ÁTICO\" — mas na real só a Platibanda é Ático, as outras duas (Instalações Elétricas/SPDA e Impermeabilização Laje) são Reservatório. Corrigir uma arrastava as outras duas por engano, porque o \"antes→depois\" era idêntico nas 3.",
        "Agora, ao trocar um valor que afeta mais de 1 linha, pergunta: OK = muda todas; Cancelar = muda só essa linha, isolando ela sem tocar nas outras. Continua sem perguntar quando só tem 1 linha afetada (não muda o fluxo de quando já funcionava certo)."
      ],
      "legado": "V3.19.13.15"
    },
    {
      "versao": "V3.19.23",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Gerar Grupos: \"Aplicar Selecionados\" travava sem feedback quando o Firestore não conseguia sincronizar",
      "itens": [
        "Causa (Milton pegou pelo console): \"Failed to obtain primary lease\" — erro do Firestore quando tem mais de uma aba/janela do sistema aberta ao mesmo tempo brigando por qual é a \"principal\". A escrita ficava pendurada pra sempre, sem erro nem sucesso, e a tela só girava.",
        "Corrigido: cada escrita agora tem um limite de 8s — se travar, conta como falha e SEGUE pras próximas em vez de parar tudo. Barra de progresso mostra quantas já foram (\"124/2198...\"). No fim, mensagem específica: quantas salvaram, quantas falharam, e se travou tudo por causa de aba duplicada, avisa isso na cara.",
        "Ação se acontecer de novo: fechar as outras abas/janelas do sistema, deixar só uma aberta, e rodar Gerar Grupos de novo — ele já vai pegar só quem ainda não foi salvo (não duplica o que já deu certo)."
      ],
      "legado": "V3.19.13.16"
    },
    {
      "versao": "V3.19.24",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Achada a causa real de \"Aplicar Selecionados parece travado\": spinner de carregamento escondido atrás da Estrutura da Obra",
      "itens": [
        "Bug de verdade: o modal \"Estrutura da Obra\" tem z-index 2000, mas o spinner global de carregamento (usado em toda a aplicação) tinha z-index 999 — menor. Enquanto a Estrutura da Obra ficava aberta por cima, o \"Gerando grupos: X/2198...\" rodava escondido atrás dela, invisível — parecia que travou, mas estava rodando normal.",
        "Corrigido em dois pontos: (1) z-index do spinner global subiu pra 9999 (sempre por cima de qualquer modal, não só esse caso), e (2) a Estrutura da Obra agora fecha imediatamente ao clicar Aplicar Selecionados, então o progresso fica visível desde o primeiro instante."
      ],
      "legado": "V3.19.13.17"
    },
    {
      "versao": "V3.19.24.1",
      "data": "2026-08-21",
      "tipo": "melhoria",
      "titulo": "Matriz de Frentes: arrastar com o mouse (desktop)",
      "itens": [
        "Dentro da tabela do Andamento por Frente, agora dá pra SEGURAR E ARRASTAR com o mouse pra navegar em qualquer direção (cursor vira mãozinha) — como num mapa.",
        "O clique nas células continua normal: movimento menor que 6px conta como clique e abre o detalhe; arrastou de verdade, as células não disparam."
      ],
      "legado": "V3.19.13.18"
    },
    {
      "versao": "V3.19.24.2",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Subgrupo agora é VALIDADO contra os apartamentos cadastrados na Estrutura da Obra (não é mais só a fórmula cega)",
      "itens": [
        "Pergunta do Milton: \"como vou saber se o subgrupo calculado está certo?\" — resposta: agora cruza com os apartamentos que ele já cadastrou em cada pavimento (ex: \"1º Pavimento\" com AP11/AP12 → só 11 e 12 são válidos ali).",
        "Número em vermelho com ⚠ = a fórmula calculou um valor que NÃO existe como apartamento cadastrado naquele pavimento — sinal de que algo pode estar errado (piso errado, digitação no nome da tarefa). Número na cor normal = bateu certinho com um apartamento cadastrado.",
        "Pavimento que ainda não tem NENHUM apartamento cadastrado não gera aviso nenhum (não dá pra confirmar nem desmentir sem cadastro — fica neutro, não assusta à toa)."
      ],
      "legado": "V3.19.13.19"
    },
    {
      "versao": "V3.19.25",
      "data": "2026-08-21",
      "tipo": "correcao",
      "titulo": "CULPADO ENCONTRADO: header roubava os cliques dos filtros + ordem pela Estrutura",
      "itens": [
        "O auto-diagnóstico apontou o invasor: o CABEÇALHO da página (barra preta do topo) estava com camada altíssima desde a V3.8.5 (pro menu Extras) e interceptava os cliques do conteúdo — por isso os filtros nunca abriam, em qualquer aparelho. O header voltou pra camada baixa e o menu Extras ganhou camada fixa própria. FILTROS (Colunas, Categoria, Equipe) CLICÁVEIS.",
        "Grupos e subgrupos agora seguem a ORDEM DA ESTRUTURA DA OBRA (pavimentos e apartamentos na ordem cadastrada, ex: 2º Subsolo → 1º Subsolo → Térreo → 1º Pavimento...), não mais alfabética.",
        "As colunas se alimentam de TODO o Planejamento: todo grupo/subgrupo que existir lá aparece na matriz (nada de lista fixa de nomes ou quantidade), mesmo que a tarefa ainda não tenha categoria.",
        "Filtro de Equipe passou a enxergar as equipes de todas as tarefas do Planejamento."
      ],
      "legado": "V3.19.13.20"
    },
    {
      "versao": "V3.19.25.1",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Subgrupo agora vem DIRETO do apartamento cadastrado na Estrutura da Obra, não mais de uma fórmula conferida depois",
      "itens": [
        "Reforço do Milton: a Estrutura da Obra (Torre > Pavimento > Apartamento) é ONDE ele define Grupo e Subgrupo — o gerador tem que usar ela como fonte, não uma conta em paralelo.",
        "Mudança de arquitetura: antes calculava andar×10+Final e DEPOIS conferia se batia com algum apartamento cadastrado. Agora faz o inverso — pega o 1º apartamento cadastrado naquele pavimento pra \"Final/ap. 01\", o 2º pra \"Final/ap. 02\" etc, e usa o NÚMERO DELE, direto. Testado com os dados reais da tela (AP11/AP12 no 1º Pavimento): bate certinho.",
        "Continua com aviso ⚠ quando o pavimento tem apartamentos cadastrados mas não um pra aquele índice (aí sim usa a fórmula como último recurso, avisando), e fica neutro quando o pavimento ainda não tem nenhum apartamento cadastrado."
      ],
      "legado": "V3.19.13.21"
    },
    {
      "versao": "V3.19.25.2",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Estrutura da Obra: arrastar-e-soltar pra reordenar Torres e Pavimentos",
      "itens": [
        "Ícone ⠿ do lado esquerdo de cada torre e cada pavimento — arrasta pra cima/baixo pra reordenar, solta na posição desejada.",
        "Reordena só dentro do mesmo nível (torre com torre; pavimento com pavimento da MESMA torre) — não move pavimento de uma torre pra outra arrastando.",
        "Salva automático a cada solta, igual as outras edições da Estrutura da Obra."
      ],
      "legado": "V3.19.13.22"
    },
    {
      "versao": "V3.19.26",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Estrutura da Obra: campo de nome do apartamento/unidade tinha largura fixa de 50px — cortava nomes maiores tipo \"AL DIREITA\"",
      "itens": [
        "Bug real: o Milton passou a usar nomes descritivos maiores (\"FACHADA I\", \"AL DIREITA\") em vez de só \"AP11\" — mas o campo tinha 50px fixos, cortando o texto e deixando impossível ver o que estava sendo digitado.",
        "Corrigido: o campo agora cresce sozinho conforme o texto (baseado no tamanho do valor, ajusta a cada tecla digitada)."
      ],
      "legado": "V3.19.13.23"
    },
    {
      "versao": "V3.19.27",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Gerar Grupos não reconhecia \"Fundações\" ↔ \"Fundação\" — plural irregular do português (-ão vira -ões, não só +s)",
      "itens": [
        "Bug pego pelo Milton: cadastrou \"FUNDAÇÕES\" na Estrutura da Obra, mas \"Estacas / Blocos / Baldrames - Fundação\" continuava propondo Sem Vínculo. Causa: plural de palavra terminada em \"-ão\" troca a vogal (fundação→fundações, comunicação→comunicações) — minha regra de plural só cobria tirar \"s\"/\"es\" do final, que não serve pra esse caso.",
        "Adicionada a regra específica \"-ões\" → \"-ão\" (geral, vale pra qualquer palavra assim, não só Fundação) — testado contra Fundações, Comunicações e Instalações sem quebrar os casos que já funcionavam (Elevadores, Subsolo etc.)."
      ],
      "legado": "V3.19.13.24"
    },
    {
      "versao": "V3.19.27.1",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Gerar Grupos ganha modo \"Todas (auditar)\" — ver o que já está correto, não só o que vai mudar",
      "itens": [
        "Pedido do Milton: ele quer verificar/auditar Subgrupos que JÁ foram aplicados antes, mas a prévia só mostrava o que ia MUDAR — se o valor salvo já batia com a detecção (mesmo que por uma execução anterior), a linha nem aparecia, impossível conferir.",
        "Novo toggle \"Só as que vão mudar\" / \"Todas (auditar)\" no topo da prévia. Em \"Todas\", mostra toda tarefa reconhecida, com ✓ verde e opacidade reduzida nas que já estão certas (não vão ser alteradas) — mas o aviso ⚠ de Subgrupo inválido continua aparecendo mesmo nelas, então dá pra achar um Subgrupo errado que ficou salvo por engano numa rodada anterior.",
        "Trocar de modo preserva as edições já feitas na sessão (não perde o que você já corrigiu na tela)."
      ],
      "legado": "V3.19.13.25"
    },
    {
      "versao": "V3.19.28",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Editor de Estrutura: não dava pra selecionar texto ao renomear uma tarefa — o \"arrastar linha\" tomava conta do clique",
      "itens": [
        "Bug real: a linha inteira é arrastável (pra reordenar tarefas), e o campo de edição do nome (aberto com clique duplo) ficava DENTRO dela — arrastar o mouse pra selecionar texto era interpretado como arrastar a linha inteira pra reordenar.",
        "Corrigido: o campo de edição agora tem draggable=\"false\" e cancela a propagação do clique — arrastar dentro dele volta a ser seleção de texto normal, arrastar fora dele continua reordenando a tarefa.",
        "Mesmo ajuste aplicado de brinde na Estrutura da Obra (Torre/Pavimento/Apartamento), que tinha exatamente o mesmo problema depois do drag-and-drop adicionado ali."
      ],
      "legado": "V3.19.13.26"
    },
    {
      "versao": "V3.19.28.1",
      "data": "2026-08-19",
      "tipo": "funcionalidade",
      "titulo": "Agenda: puxar tarefa não concluída de horário anterior do mesmo dia pro horário atual",
      "itens": [
        "Motivo (Milton): usando o filtro de esconder horários passados, se sobrou uma tarefa não executada num horário anterior, faltava um jeito rápido de trazer ela pro horário de agora sem procurar tudo de novo na busca normal.",
        "Quando o horário aberto tem alguma tarefa (ou item de checklist) não concluída em horário anterior do mesmo dia, aparece um botão \"⏪ Puxar N não concluída(s) de horário anterior\" dentro do seletor. Clicando, mostra só essas pendências (com o horário original de cada uma) — escolher uma MOVE ela pro horário atual (sai de onde estava, não duplica)."
      ],
      "legado": "V3.19.13.27"
    },
    {
      "versao": "V3.19.29",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Reforço: draggable=\"false\" no campo sozinho não bastava em todos os navegadores — a linha inteira trava o arrasto durante a edição",
      "itens": [
        "A correção anterior (V3.19.13.26) marcava só o CAMPO como não-arrastável, mas o navegador ainda podia iniciar o arrasto da LINHA a partir de dentro dele (Milton viu o \"fantasma\" do arrasto no print, prova de que ainda disparava).",
        "Corrigido de vez: no Editor de Estrutura, a linha inteira fica draggable=false enquanto está em modo de edição (some quando salva/cancela). Na Estrutura da Obra (Torre/Pavimento/Apartamento), o campo trava o arrasto da linha ao ganhar foco e destrava ao perder — funciona em qualquer navegador porque mexe na propriedade da linha diretamente, não só do campo."
      ],
      "legado": "V3.19.13.28"
    },
    {
      "versao": "V3.19.30",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Achado o bug de verdade: clicar DENTRO do campo de editar nome também fechava a edição, porque o clique subia pra linha e disparava um re-render completo",
      "itens": [
        "A linha da árvore tem um onclick que seleciona a tarefa e chama _render() (reconstrói a tela toda) — clicar dentro do campo de texto pra só posicionar o cursor também disparava esse onclick (cliques sobem/\"bubble\" por padrão), destruindo e recriando o campo do zero e perdendo o foco/cursor. Por fora parecia que a edição \"fechava\" sozinha.",
        "Corrigido: o campo agora segura o clique também (não só o mousedown), então interagir dentro dele nunca mais chega na linha."
      ],
      "legado": "V3.19.13.29"
    },
    {
      "versao": "V3.19.30.1",
      "legado": "V3.19.30.1",
      "status": "fechada",
      "data": "2026-08-21",
      "tipo": "melhoria",
      "titulo": "Painel de pendências agora conta O QUE falta e leva pro histórico do assunto",
      "itens": [
        "Cada pendência lista exatamente o que ficou por fazer (campo falta) — memória externa: dá pra retomar o trabalho sem depender de lembrar.",
        "Clicar num card de pendência preenche a busca com o assunto e rola pra timeline — mostra todas as versões que alimentaram aquele trabalho.",
        "PROJETO.md: toda sessão é obrigada a registrar a pendência (com o que falta) antes de parar um trabalho no meio, e a remover o item quando concluir (conclusão = frente nova, B+1)."
      ]
    },
    {
      "versao": "V3.19.30.2",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Importar Correções ganha o campo Nome — faltava opção pra corrigir nome de tarefa direto pela planilha",
      "itens": [
        "Motivo (Milton): editar nome de tarefa é mais rápido no Excel do que um por um no sistema, mas a lista de campos do Importar Correções não tinha \"Nome\" como opção.",
        "Adicionado. Casa pelo ID igual todo o resto (nunca pelo nome que está mudando, então não tem risco de confundir a correção com a busca) — nunca aplica nome vazio por engano."
      ]
    },
    {
      "versao": "V3.19.30.3",
      "legado": "V3.19.30.3",
      "status": "fechada",
      "data": "2026-08-21",
      "tipo": "melhoria",
      "titulo": "Painel de pendências removido das Notas de Versão",
      "itens": [
        "O painel 'O que ainda NÃO está pronto' listava tarefas que não refletiam a realidade (anotação manual desatualizada) e o clique trazia versões sem relação com o assunto — removido por decisão do Milton.",
        "O acompanhamento do que falta continua na seção 8 do PROJETO.md, mantida pelas sessões de trabalho."
      ]
    },
    {
      "versao": "V3.19.30.4",
      "data": "2026-08-19",
      "tipo": "correcao",
      "titulo": "Gerar Grupos não reconhecia Subgrupo com nome descritivo (ex: apartamento \"Fachada Frontal\", \"Lateral Esquerda\") — só entendia número",
      "itens": [
        "Bug real (Milton pegou): Subgrupo só era detectado se a tarefa tivesse \"Final NN\"/\"ap. NN\" — um NÚMERO. Ele criou apartamentos com nome descritivo pra Fachada (Frontal, Frontal Esquerda, Lateral Direita...) e nada era reconhecido, porque nunca existe número nesses nomes de tarefa.",
        "Corrigido: agora testa primeiro se o NOME de algum apartamento cadastrado aparece dentro do nome da tarefa (mesmo mecanismo de match do Grupo, incluindo singular/plural) — pega o mais específico (\"Frontal Esquerda\" não confunde com \"Frontal\"). Só cai pro esquema numérico (Final/ap./Etapa NN + posição) se não achar por nome.",
        "Subgrupo deixou de ser só número — quando o apartamento tem nome descritivo, o Subgrupo agora é esse nome (\"Frontal\", \"Lateral Esquerda\"...), não precisa mais forçar um número. Testado com os 6 apartamentos de Fachada + todas as variações do exemplo do Milton antes de publicar.",
        "Isso vale pra QUALQUER apartamento novo criado dali pra frente, em qualquer pavimento/zona — não precisa mais pedir ajuste de código toda vez que cadastrar um subgrupo novo."
      ]
    },
    {
      "versao": "V3.19.30.5",
      "data": "2026-08-19",
      "tipo": "melhoria",
      "titulo": "Estrutura da Obra: \"Apartamento\" virou \"Subgrupo\" em todo texto visível — o nome estava errado",
      "itens": [
        "Motivo (Milton): \"Apartamento\" só faz sentido pro caso de andar residencial — pra Fachada (Frontal, Lateral Esquerda...) ou qualquer outra divisão, o nome certo é Subgrupo. Um subgrupo PODE ser um apartamento, mas nem todo subgrupo é apartamento.",
        "Trocado em todo lugar visível: botão \"+apto\" → \"+subgrupo\", avisos, tooltips e a coluna \"Local (Pav/Apto)\" → \"Local (Pav/Sub)\". Por baixo dos panos o dado continua no mesmo lugar (sem risco de perder o que já foi cadastrado) — só o nome mostrado na tela mudou."
      ]
    },
    {
      "versao": "V3.19.30.6",
      "data": "2026-08-21",
      "tipo": "melhoria",
      "titulo": "Visão por Grupos em Atividades/Suprimentos + filtro de Equipe herdando da família",
      "itens": [
        "Em Execução, Próximas e Suprimentos ganharam o seletor de visão EAP × GRUPOS: a visão Grupos organiza por Grupo › Subgrupo (mesmos campos e mesma ordem da Estrutura usada na matriz de frentes), expansível, mostrando as datas de cada tarefa e o resumo (quantidade + data mais próxima) em cada grupo. Se alimenta sozinha do Planejamento.",
        "FILTRO DE EQUIPE consertado (fui olhar como o Planejamento grava): a equipe costuma ser preenchida na tarefa-MÃE, e a matriz só olha as folhas — que ficavam sem equipe, deixando o filtro vazio/sem efeito. Agora as folhas HERDAM a equipe do ancestral mais próximo (a própria vence se preenchida) — o filtro lista e filtra de verdade, e o detalhe da célula mostra a equipe herdada."
      ]
    },
    {
      "versao": "V3.19.30.7",
      "data": "2026-08-21",
      "tipo": "correcao",
      "titulo": "Auto-diagnóstico dos filtros sem falso alarme",
      "itens": [
        "O aviso amarelo acusou o overlay de \"Carregando...\" — falso alarme: o teste rodava cedo demais, enquanto a página ainda carregava (o loading fica por cima de propósito nesse momento e some sozinho). Os filtros continuam clicáveis.",
        "O diagnóstico ficou esperto: espera o carregamento terminar, ignora loading/toasts/painéis legítimos e só acusa se o MESMO elemento estiver por cima em duas medições com 3 segundos de intervalo (invasor persistente de verdade)."
      ]
    },
    {
      "versao": "V3.19.30.8",
      "data": "2026-08-21",
      "tipo": "melhoria",
      "titulo": "Equipe destravada (lê a Frente), selo 👷 nas tarefas e visão Grupos aberta",
      "itens": [
        "MOTIVO do filtro de Equipe bloqueado: nenhuma tarefa tinha o Nº Equipe preenchido — no seu Planejamento a equipe vive no campo FRENTE (o importador de Excel manda a coluna \"equipe\" pra lá). O filtro agora lê Nº Equipe OU Frente, com herança da tarefa-mãe pras filhas — destravou.",
        "Selo 👷 de equipe na frente de cada tarefa em Atividades e Suprimentos — colorido, com cor estável por equipe.",
        "Filtro \"👷 Equipe\" também nas listas: Em Execução, Próximas e Suprimentos ganharam o seletor de equipe na barra de cada bloco.",
        "Visão GRUPOS repaginada: tudo ABERTO, sem escadinha — faixa amarela do grupo, subtítulo do subgrupo e as tarefas na sequência ordenadas por data."
      ]
    },
    {
      "versao": "V3.19.30.9",
      "data": "2026-08-21",
      "tipo": "correcao",
      "titulo": "Equipe AGORA de verdade: o campo certo é frenteServico",
      "itens": [
        "Correção honesta: a versão anterior prometeu ler a Frente mas usou o nome de campo errado (t.frente, que não existe) — por isso NADA mudou. A coluna \"Frente\" do Planejamento grava em frenteServico; agora o filtro de equipe, o selo 👷 e a herança mãe→filhas leem esse campo de verdade.",
        "Vale pra matriz de frentes e pros filtros/selos de Em Execução, Próximas e Suprimentos."
      ]
    },
    {
      "versao": "V3.19.30.10",
      "data": "2026-08-21",
      "tipo": "melhoria",
      "titulo": "Selo de equipe: cor sólida e firme, sem emoji",
      "itens": [
        "O selo da equipe agora é SÓ O NOME, em caixa alta, fundo de cor sólida e forte com texto branco, bem espaçado do nome da tarefa — sem capacete, sem tom transparente.",
        "Paleta evita vermelho, verde, azul e amarelo (cores que já significam status no sistema): roxo, magenta, laranja queimado, marrom, chumbo, violeta e afins — cor estável por equipe."
      ]
    },
    {
      "versao": "V3.19.30.11",
      "data": "2026-08-21",
      "tipo": "melhoria",
      "titulo": "Selo de equipe DEPOIS do nome, com respiro, e sem tom avermelhado",
      "itens": [
        "O selo da equipe foi pro lugar certo: DEPOIS do nome da tarefa, com espaçamento decente (aproveitando o espaço livre da linha).",
        "Paleta sem QUALQUER tom de vermelho ou laranja (o \"laranja queimado\" lia como vermelho): roxo, fúcsia, rosa, marrom, chumbo, violeta e grafite — todas sólidas, texto branco."
      ]
    },
    {
      "versao": "V3.19.30.12",
      "data": "2026-08-21",
      "tipo": "melhoria",
      "titulo": "Relatório de Concretagem de Estacas ganha comparação com a obra inteira + % executado por estaca",
      "itens": [
        "Achado o problema real: o \\\"resumo total\\\" do relatório mostrava números (estacas executadas, m³ real, m³ calculado) só das datas escolhidas no relatório — mas os rótulos não deixavam isso claro, parecendo ser da obra toda. Agora o título e os rótulos deixam explícito: \\\"RESUMO DESTE RELATÓRIO\\\", com aviso de que não é a obra completa.",
        "Nova seção \\\"📊 COMPARAÇÃO COM A OBRA INTEIRA\\\" (na tela, no PDF e no texto de WhatsApp) — usa TODAS as estacas do projeto e TODOS os lançamentos já feitos até hoje, independente de quais datas foram escolhidas: total de estacas, quantas 100% feitas, m³ executado vs m³ total da obra, % geral executada, e a mesma comparação por tipo (Ø × comprimento).",
        "Tabela consolidada (estacas do relatório) ganhou a coluna \\\"% Executado\\\" — percentual individual de cada estaca, calculado por volume real ÷ volume calculado dela."
      ]
    },
    {
      "versao": "V3.19.30.13",
      "data": "2026-08-21",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: seletor de BT ilegível no celular — reorganizado em 2 linhas",
      "itens": [
        "No popup de lançar por estaca, a linha de cada BT era um grid de 5 colunas lado a lado (seletor + % + volume + botão + botão) — no celular, os campos fixos já ocupavam quase toda a largura, sobrando quase nada pro nome da BT selecionada, ficando ilegível.",
        "Reorganizado em 2 linhas: o seletor de BT agora ocupa a largura toda sozinho (sempre legível, em qualquer tela), e o % + volume + botões ficam numa segunda linha embaixo, com mais espaço cada um.",
        "Campo de % ganhou uma largura fixa mais compacta (era desproporcionalmente grande) — só precisa caber um número de 1 a 3 dígitos."
      ]
    },
    {
      "versao": "V3.19.30.14",
      "data": "2026-08-21",
      "tipo": "melhoria",
      "titulo": "Dashboard: painel Estacas e Fundações ganha % executado e toggle Estacas/Fundação",
      "itens": [
        "As duas prancha (Estacas Hélice + Fundação Zenith Teste) continuam lado a lado como antes. A tabela de métricas de baixo, que só mostrava Estacas, agora tem um toggle \\\"⚫ Estacas / ⬛ Fundação\\\" pra alternar entre as duas — sem misturar os números das duas disciplinas na mesma tabela.",
        "Nova métrica \\\"% executado\\\" explícita nos dois (Estacas e Fundação): volume feito ÷ volume total do projeto daquela disciplina.",
        "Fundação (peças que não são estaca — sapatas, blocos, vigas baldrame etc.) ganhou a mesma tabela por tipo que Estacas já tinha, agrupando pelo subtipo da peça em vez de Ø × comprimento (que só faz sentido pra estaca)."
      ]
    },
    {
      "versao": "V3.19.30.15",
      "data": "2026-08-21",
      "tipo": "melhoria",
      "titulo": "Clique na tarefa do Dashboard abre ela no Planejamento",
      "itens": [
        "Nas listas de Em Execução, Próximas e Suprimentos (e também na lista do detalhe da célula da matriz de frentes), CLICAR NA TAREFA leva direto pra ela no Planejamento.",
        "O Planejamento abre com a linha selecionada e centralizada na tela — e se a tarefa estiver dentro de uma família recolhida, os níveis são expandidos automaticamente pra ela aparecer."
      ]
    },
    {
      "versao": "V3.19.30.16",
      "data": "2026-08-21",
      "tipo": "correcao",
      "titulo": "Estacas e Fundações de volta ao Dashboard",
      "itens": [
        "A seção ⚓ Estacas e Fundações tinha sumido: o bloco novo de \"Métricas da obra inteira\" (V3.19.30.14) referenciava o motor de cálculo por um nome que não existia dentro daquela função — erro em tempo de execução que derrubava a seção inteira antes de desenhar. Referência corrigida e comportamento validado em teste simulado com dados de estacas + fundação."
      ]
    },
    {
      "versao": "V3.19.30.17",
      "data": "2026-08-22",
      "tipo": "correcao",
      "titulo": "Medições: não dava pra preencher a data direito (ano virava \"0002\")",
      "itens": [
        "Digitar a data dígito por dígito no campo nativo é fácil de errar — cada tecla empurra os dígitos do ano, então parar no meio da digitação deixava algo como \"12/08/0002\" em vez do ano certo.",
        "Agora tocar/clicar no campo abre direto o calendário nativo pra escolher a data (em vez de digitar), e se mesmo assim entrar um ano fora de uma faixa plausível (2015 até 3 anos à frente), o sistema avisa e não salva."
      ]
    },
    {
      "versao": "V3.19.30.18",
      "data": "2026-08-22",
      "tipo": "correcao",
      "titulo": "Medições: delay ao digitar na busca",
      "itens": [
        "Cada tecla digitada reconstruía a árvore inteira na hora, travando a digitação em obras com muita tarefa. Agora espera uma pausa curta (250ms) depois da última tecla antes de filtrar de verdade — o campo continua respondendo normal enquanto digita."
      ]
    },
    {
      "versao": "V3.19.30.19",
      "data": "2026-08-22",
      "tipo": "correcao",
      "titulo": "Medições: travada bem na hora de escolher a data/marcar %",
      "itens": [
        "Toda vez que uma data era escolhida no calendário ou o % era alterado, a árvore inteira era reconstruída na mesma hora — em obras com muita tarefa, isso rodava junto com o fechamento do calendário e dava a sensação de travamento bem no meio da ação.",
        "Agora a reconstrução espera o navegador terminar de desenhar a ação atual (fechar o calendário, mostrar o valor digitado) antes de rodar — mesmo resultado final, sem o soluço no meio."
      ]
    },
    {
      "versao": "V3.19.30.20",
      "data": "2026-08-22",
      "tipo": "correcao",
      "titulo": "Medições: achado o gargalo de verdade (parse de data repetido em obra grande) + calendário forçado tirado",
      "itens": [
        "O % Esperado de cada tarefa é calculado a partir das datas planejadas (parseando string de data, fazendo conta de dias) — e isso rodava DE NOVO pra cada tarefa em TODO render (a cada tecla na busca, cada % editado, cada data escolhida), inclusive repetido várias vezes pra tarefas dentro de grupos aninhados. Numa obra com milhares de tarefas, isso sozinho já segurava a tela por um bom tempo a cada ação.",
        "Corrigido: esse cálculo agora roda uma vez só, quando a obra carrega (a \"data de hoje\" não muda durante a sessão) — os renders seguintes só leem o valor já pronto.",
        "Tirado o clique que forçava abrir o calendário no campo de data — quem preferia digitar direto pelo teclado numérico não conseguia mais. Volta a ser um campo de data normal: digita ou clica no ícone do calendário, como preferir."
      ]
    },
    {
      "versao": "V3.19.30.21",
      "data": "2026-08-22",
      "tipo": "correcao",
      "titulo": "Medições: validação de data disparava no MEIO da digitação do ano",
      "itens": [
        "O navegador considera a data \"completa\" assim que qualquer dígito é digitado no ano (preenche o resto com zero por dentro, ex: \"2\" vira \"0002\") — a validação de ano reagia na hora e mostrava erro antes da pessoa terminar de escrever o ano todo, travando a digitação.",
        "Corrigido: agora espera uma pausa de 700ms sem mexer no campo antes de checar de verdade — só reage quando a digitação realmente parou, não a cada dígito."
      ]
    },
    {
      "versao": "V3.19.30.22",
      "data": "2026-08-22",
      "tipo": "melhoria",
      "titulo": "Relatório de Concretagem de Estacas reorganizado: resumo X/de X no topo, ordem revista",
      "itens": [
        "Nova ordem (tela, PDF e WhatsApp): RESUMO DESTE RELATÓRIO (agora em formato X / DE X, comparando com a obra inteira) → Consumo médio por tipo de estaca → Executado por tipo → prancha preenchida (só no PDF) → o que já tinha (dia a dia, consolidado, comparação com a obra).",
        "Cards do resumo: Estacas (feitas / de total da obra), ML executado (X / de X), m³ calculado (X / de X), Índice de perda — removida a duplicação que existia antes (esses números apareciam soltos aqui e de novo lá embaixo em Comparação com a Obra).",
        "Novo campo mlTotal no resumo da obra inteira, usado pro ML executado ficar em X/DE X igual aos outros."
      ]
    },
    {
      "versao": "V3.19.30.23",
      "data": "2026-08-22",
      "tipo": "melhoria",
      "titulo": "Dashboard: % médio confuso vira % por quantidade + % por m³, e novos indicadores de ritmo",
      "itens": [
        "Removido o \\\"% médio concretado\\\" da linha de resumo — não deixava claro o que representava (era uma média simples do % de cada marcador).",
        "Métricas de Estacas/Fundação (obra inteira) agora mostram DOIS percentuais separados e explicados: \\\"% executado (por quantidade)\\\" (peças 100% feitas ÷ total) e \\\"% executado (por m³)\\\" (volume feito ÷ volume total) — são diferentes de propósito (uma peça grande pesa mais no volume do que na contagem).",
        "Novos cartões: Dias trabalhados (dias distintos com concretagem lançada), m³/dia (ritmo médio nesses dias) e Previsão de fim (hoje + dias restantes no ritmo atual, ou \\\"Concluído\\\" se já bateu 100%)."
      ]
    },
    {
      "versao": "V3.19.30.24",
      "data": "2026-08-22",
      "tipo": "correcao",
      "titulo": "Achado o card certo: \"% Médio Concretado\" era no Controle de Estacas, não no Dashboard",
      "itens": [
        "A correção anterior mexeu no card certo só que no lugar errado (Dashboard) — o \\\"% MÉDIO CONCRETADO\\\" que o Milton via era o do KPI grid da aba Marcadores dentro do próprio Controle de Estacas, um arquivo e um card totalmente diferentes.",
        "Agora sim, corrigido no lugar certo: virou \\\"% Executado (por quantidade)\\\" e \\\"% Executado (por m³)\\\" — separados e explicados, igual ao que já tinha sido feito no Dashboard.",
        "Adicionados também Dias trabalhados, m³/dia (ritmo médio) e Previsão de fim, calculados a partir dos marcadores/peças/lançamentos da view atual (Estacas ou Fundações)."
      ]
    },
    {
      "versao": "V3.19.30.25",
      "data": "2026-08-22",
      "tipo": "correcao",
      "titulo": "Medições: tarefa desaparecia na hora de completar 100%, sem chance de revisar",
      "itens": [
        "Com \"Ocultar 100%\" ligado, a tarefa sumia da lista assim que o % chegava em 100 — inclusive a que a pessoa estava editando NA HORA, sem chance de revisar/corrigir antes de salvar. Corrigido: agora só some quem NÃO tem edição pendente nesta sessão — a que você está mexendo fica visível até você salvar ou descartar.",
        "Novo botão \"🗑 Descartar tudo\" na barra (aparece quando há algo pendente) — descarta todas as alterações não salvas da medição atual sem precisar sair da tela.",
        "Término Real desabilitado (tarefa ainda não em 100%) agora mostra um aviso vermelho \"(só com 100%)\" direto no rótulo do campo — antes só dava pra saber isso passando o mouse em cima (não funciona no celular)."
      ]
    },
    {
      "versao": "V3.19.30.26",
      "data": "2026-08-22",
      "tipo": "correcao",
      "titulo": "Medições: achado o gargalo GRANDE de verdade — cada grupo aberto reescaneava a árvore inteira, a cada render",
      "itens": [
        "O % de cada grupo (Esperado/Real mostrado no cabeçalho) era calculado escaneando toda a subárvore dele TODA VEZ que a tela era redesenhada — e o grupo raiz da obra escaneava a obra INTEIRA. Numa obra grande, com vários grupos abertos ao mesmo tempo, isso multiplicava o escaneamento completo várias vezes A CADA tecla digitada, cada % alterado, cada data escolhida — daí a trava de vários segundos (chegando a parecer travado por minutos) mesmo depois das correções anteriores.",
        "Corrigido: agora é um único passe por toda a árvore que calcula o total geral E o agregado de cada grupo ao mesmo tempo (a mesma técnica já usada no filtro de Frente/busca) — não importa quantos grupos estejam abertos, o custo não multiplica mais."
      ]
    },
    {
      "versao": "V3.19.30.27",
      "data": "2026-08-22",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: indicadores de execução voltam pra Acompanhamento (onde a execução acontece de fato)",
      "itens": [
        "Os novos indicadores (% executado, dias trabalhados, m³/dia, previsão de fim) tinham entrado na aba Marcadores — mas Marcadores é só desenho/vínculo, quem registra a execução de verdade é a aba Acompanhamento. Movidos pra lá, dentro do painel \\\"Estacas/Fundações da obra — visão geral\\\", que já existia.",
        "Marcadores voltou aos 3 KPIs simples de sempre (marcadas, vinculadas, concretadas).",
        "Corrigido texto pequeno e com pouco contraste no relatório de concretagem (tela e PDF) — o \\\"/ de X\\\" embaixo dos números do resumo estava com fonte minúscula e cor clara demais pra ler bem em tela clara; aumentado e escurecido."
      ]
    },
    {
      "versao": "V3.19.30.28",
      "data": "2026-08-22",
      "tipo": "correcao",
      "titulo": "Agenda: fechar mais fácil (X vermelho no topo), descrição com um toque (ⓘ), colar com botão direito no \"+\"",
      "itens": [
        "O \"×\" de remover tarefa do horário estava sendo confundido com \"fechar o seletor\" — e fechar de verdade exigia rolar até o fim e clicar em \"Fechar\". Agora tem um X vermelho fixo no canto do seletor, visível assim que ele abre, só pra fechar.",
        "Cada tarefa do seletor (e cada item de checklist) ganhou um botão ⓘ — toque nele mostra a descrição na hora, sem precisar de clique direito (que não existe em tablet/touch).",
        "Colar ficou direto: com uma tarefa copiada (⧉), o \"+\" do horário de destino fica destacado — clique direito nele cola ali na hora, sem precisar abrir o seletor inteiro pra achar o botão \"Colar aqui\"."
      ]
    },
    {
      "versao": "V3.19.30.29",
      "data": "2026-08-22",
      "tipo": "correcao",
      "titulo": "Agenda: rolagem não volta mais pro topo sozinha, clicar no horário abre o seletor, ícone de copiar corrigido",
      "itens": [
        "Bug real: toda vez que algo mudava na Agenda (fechar seletor, escolher tarefa, marcar concluído), a lista inteira voltava pro topo, perdendo o lugar onde a pessoa estava rolando. Corrigido: a posição de rolagem agora é preservada entre atualizações (só volta ao topo de propósito, ao trocar de dia).",
        "Clicar em cima do horário (\"14:00 a 14:30\") agora abre o seletor de tarefa, igual clicar no \"+\" — não precisa mais acertar o botãozinho pequeno na ponta.",
        "O ícone de copiar (⧉) não tinha suporte em todo navegador/fonte e aparecia como uma caixinha vazia, sem funcionar de fato — trocado por 📋, que renderiza em qualquer lugar. Também virou possível copiar com clique direito na linha inteira da tarefa (não só no ícone)."
      ]
    },
    {
      "versao": "V3.19.30.30",
      "data": "2026-08-22",
      "tipo": "correcao",
      "titulo": "Agenda: clique direito em cima da tarefa/horário cola de verdade, em vez de abrir o menu do navegador",
      "itens": [
        "Milton reportou que ainda estava mostrando o menu padrão do navegador (Opera) ao clicar com o botão direito na tarefa ou no horário — o clique direito só tinha sido ligado no botão \"+\" e no rótulo do horário, mas não em cima de uma tarefa já alocada, que ficou sem handler nenhum.",
        "Unificado num lugar só: clique direito em QUALQUER ponto da linha do horário (no rótulo do horário, na área vazia, ou em cima de uma tarefa já lá) cola a tarefa copiada ali — sem precisar acertar um botão pequeno específico."
      ]
    },
    {
      "versao": "V3.19.30.31",
      "data": "2026-08-22",
      "tipo": "correcao",
      "titulo": "Agenda: tirado o checkbox de \"concluído\" do seletor de tarefa — não faz sentido antes de agendar",
      "itens": [
        "Bug de lógica pego pelo Milton: o seletor (busca/navegação pra escolher tarefa) tinha um checkbox de marcar como concluída — mas marcar concluído ali, antes de a tarefa nem ter sido agendada num horário, não fazia sentido nenhum.",
        "Removido do seletor. O checkbox de concluir continua existindo normalmente nas tarefas que JÁ estão alocadas num horário (onde faz sentido)."
      ]
    },
    {
      "versao": "V3.19.30.32",
      "data": "2026-08-22",
      "tipo": "funcionalidade",
      "titulo": "Agenda: arrastar tarefa entre horários (clicar e segurar)",
      "itens": [
        "Cada tarefa já alocada num horário ganhou uma alcinha (⠿) — clicar e segurar nela (ou tocar e segurar, no tablet) e arrastar solta a tarefa em outro horário, movendo ela de vez.",
        "Feito com Pointer Events (não o drag-and-drop nativo do HTML5, que funciona mal em touch) — o mesmo código atende mouse, toque e caneta. Enquanto arrasta, mostra um \"balão\" seguindo o dedo/cursor e destaca o horário que vai receber a tarefa.",
        "Trava de segurança: soltar em cima de um horário que já tem essa mesma tarefa (ou item) não duplica, só avisa."
      ]
    },
    {
      "versao": "V3.19.30.33",
      "data": "2026-08-22",
      "tipo": "melhoria",
      "titulo": "Planejamento: toque-e-segure na célula Predecessora mostra o tooltip (número + nome), pra mobile/tablet",
      "itens": [
        "Em touch não existe \"passar o mouse por cima\" pra ver a dica (title) — um toque na célula já contava como clique e abria a edição direto, sem dar pra só CONSULTAR qual é a predecessora.",
        "Agora: segurar o dedo ~meio segundo sem soltar/arrastar mostra um balão com o mesmo texto do tooltip do desktop (número + nome da tarefa predecessora). Um toque rápido continua funcionando normal (abre edição, conta pro triplo-toque que abre o popup guiado)."
      ]
    },
    {
      "versao": "V3.19.30.34",
      "data": "2026-08-22",
      "tipo": "melhoria",
      "titulo": "Medições: modos de visão por Categoria e por Grupo (além da Estrutura)",
      "itens": [
        "Novo seletor \"👁\" na barra de cima da Medição — reorganiza as MESMAS tarefas (já filtradas por Frente/busca/Ocultar 100%) de formas diferentes, sem alterar nada no Planejamento: Estrutura do Planejamento (como já era), Categoria/Subcategoria, Grupo/Subgrupo, Grupo/Subgrupo→Categoria e Categoria/Subcategoria→Grupo.",
        "Usa os campos Categoria, Subcategoria, Grupo e Subgrupo que já existem no Planejamento (preenchidos por lá — Importar Correções, Agrupador de Categoria, etc.). Tarefa sem valor em algum desses campos cai num grupo \"Sem Categoria\"/\"Sem Grupo\" — não some, só fica separada.",
        "Todos os modos respeitam o filtro de Frente igual — o pedido era exatamente esse, poder olhar a mesma coisa de ângulos diferentes sem perder o filtro de equipe."
      ]
    },
    {
      "versao": "V3.19.30.35",
      "data": "2026-08-22",
      "tipo": "funcionalidade",
      "titulo": "Novo: Classificar Equipes automaticamente — igual o gerador de Frentes, mas pro Responsável/Equipe, com dicionário bem mais completo",
      "itens": [
        "⚙ Ferramentas → \"👷‍♂️ Classificar Equipes automaticamente\": sugere o Responsável pelo NOME da tarefa (Estrutura, Pedreiros, Elétrica, Hidráulica, Gesso/Drywall, Pintura, Azulejistas, Impermeabilização, Ar Condicionado, Fundação/Estacas, Solo Grampeado, Terraplanagem, Marcenaria, Esquadrias, Vidraçaria, Louças e Metais, Paisagismo, Engenharia, Entrega, e mais) — Utils.classificarEquipe, um dicionário de palavras-chave bem mais abrangente que o de Frente de Serviço.",
        "Mesmo mecanismo do gerador de Frentes/Grupos pra revisar antes: mostra um resumo (quantas tarefas em cada equipe sugerida) e pede confirmação antes de aplicar qualquer coisa.",
        "Só preenche quem está com Responsável em branco — nunca sobrescreve o que já foi definido manualmente. Uma obra como a RD06 Essence, que já tem o filtro de equipe rodando bem na mão, fica 100% intocada.",
        "Grupo herda a equipe automaticamente quando TODOS os filhos dele (folhas descendentes, calculado na hora) concordam na mesma equipe — mesma lógica do gerador de Frentes."
      ]
    },
    {
      "versao": "V3.19.30.36",
      "data": "2026-08-22",
      "tipo": "melhoria",
      "titulo": "Medições: grupo com um só filho funde com a linha de edição (menos repetição visual)",
      "itens": [
        "Quando um grupo (em qualquer modo de visão, inclusive Categoria/Grupo) tem só UMA tarefa dentro e nada mais, mostrar a linha do grupo E a linha de edição da tarefa embaixo virava repetição — o nome da tarefa já é basicamente o que os agrupamentos acima disseram, só com mais palavras.",
        "Agora esse caso funde numa linha só: usa o nome do GRUPO como título e já mostra direto os campos de edição (Início/Término/%) ali — preenche a mesma tarefa de sempre por trás, só não repete o nome dela por cima do que já foi dito."
      ]
    },
    {
      "versao": "V3.19.30.37",
      "data": "2026-08-24",
      "tipo": "funcionalidade",
      "titulo": "Planejamento: coluna Frente ganhou seletor de verdade (lista colorida clicável + criar frente nova) — antes só abria um campo de texto solto",
      "itens": [
        "Clicar na célula Frente abre um seletor: mostra TODAS as frentes já em uso na obra (não só as 8 padrão do sistema — pega qualquer valor digitado antes, ex: Limpeza, Serralheria) como selos coloridos clicáveis, igual já aparecia na coluna.",
        "Campo pra digitar e CRIAR uma frente nova na hora (Enter ou botão Criar) — antes não tinha como adicionar uma categoria fora das 8 fixas por esse caminho.",
        "\"— remover\" limpa a frente da tarefa. A frente atual da tarefa vem destacada (contorno branco) na lista."
      ]
    },
    {
      "versao": "V3.19.30.38",
      "data": "2026-08-24",
      "tipo": "correcao",
      "titulo": "Toque-e-segure agora também na coluna Sucessora (só tinha na Predecessora) + corrigido o menu nativo de seleção de texto do Android aparecendo por cima",
      "itens": [
        "Sucessora ganhou o mesmo toque-e-segure da Predecessora: segurar o dedo ~meio segundo mostra o balão com número + nome de quem depende desta tarefa, sem abrir nada, sem menu de sistema.",
        "Corrigido: segurar o dedo nessas duas colunas (Predecessora e Sucessora) no Android disparava a seleção de texto NATIVA do navegador (aquela caixinha de \"copiar/selecionar\" por cima) além do balão do sistema — travado com user-select:none nas duas células, então agora só aparece o balão do Planejamento, igual no iOS/desktop."
      ]
    },
    {
      "versao": "V3.19.30.39",
      "data": "2026-08-24",
      "tipo": "correcao",
      "titulo": "Planejamento: recolher/expandir uma família jogava o scroll HORIZONTAL da tabela de volta pro início — se você estava vendo colunas mais à direita (Duração, %, Predecessora...), perdia a posição",
      "itens": [
        "O scroll vertical já era preservado ao recolher um grupo; o horizontal não — cada recolhida/expandida te devolvia pro começo da tabela (colunas Início/Nível), obrigando rolar de novo pra onde estava.",
        "Corrigido: agora o scroll horizontal também é guardado antes de recolher e restaurado depois, cabeçalho da tabela incluso — fica exatamente onde você estava."
      ]
    },
    {
      "versao": "V3.19.30.40",
      "data": "2026-08-24",
      "tipo": "correcao",
      "titulo": "Medições: tarefa sem Subgrupo/Categoria não cai mais num grupo genérico \"Sem X\"",
      "itens": [
        "Nos modos de visão por Categoria/Grupo, tarefa sem valor preenchido numa dimensão (ex: sem Subgrupo) caía todo mundo junto num grupo \"Sem Subgrupo\" — um monte de tarefa sem relação nenhuma entre si, agrupada só por não terem preenchido o mesmo campo em branco.",
        "Corrigido: agora essa tarefa para naquele nível e aparece direto com o PRÓPRIO nome, sem o grupo genérico no meio. Some \"Sem Subgrupo\"/\"Sem Categoria\" — quem não tem o campo aparece igual a antes de existir esse agrupamento."
      ]
    },
    {
      "versao": "V3.19.30.41",
      "data": "2026-08-24",
      "tipo": "correcao",
      "titulo": "Estrutura da Obra: arrastar pra selecionar texto dentro do nome de Torre/Pavimento estava puxando a linha inteira",
      "itens": [
        "O mecanismo antigo desligava o arrastar da linha só quando o campo de texto ganhava foco (onfocus/onblur) — tinha uma corrida entre esse evento e o gesto de clicar-e-arrastar pra selecionar texto, então às vezes o navegador entendia como \"arrastar a linha\" em vez de \"selecionar o texto\".",
        "Trocado por um jeito mais direto: a linha começa sempre travada (não arrastável) e SÓ destrava enquanto o dedo/mouse está apertando o ícone \"⠿\" — soltar sem arrastar trava de novo na hora. Selecionar texto dentro do campo nunca mais aciona o arrastar, não importa a velocidade do gesto."
      ]
    },
    {
      "versao": "V3.19.30.42",
      "data": "2026-08-24",
      "tipo": "correcao",
      "titulo": "Gerador de Grupos: obra com mais de uma Torre (cada uma com o próprio \"Térreo\"/\"Ático\"/nome repetido) sempre casava com o pavimento da PRIMEIRA torre, errando a torre da tarefa",
      "itens": [
        "Causa: o gerador buscava o pavimento pelo NOME em TODOS os pavimentos de TODAS as torres misturados — se duas torres têm pavimento com o mesmo nome (comum: cada prédio tem seu \"Térreo\"), ele sempre achava o da primeira torre da lista, não importa de qual prédio a tarefa realmente fosse.",
        "Corrigido: agora ele olha os PAIS da tarefa no Planejamento (a hierarquia real — Torre X > ... > tarefa) pra descobrir de qual torre ela é, e busca o pavimento só dentro dela. Não depende de nenhuma lista fixa nem precisa que a tarefa mencione o nome da torre — funciona com qualquer nome de torre/pavimento/subgrupo que você cadastrar, se adaptando à estrutura de cada obra.",
        "Obra com uma torre só continua funcionando exatamente como antes (não muda nada nesse caso, que é o mais comum)."
      ]
    },
    {
      "versao": "V3.19.30.43",
      "data": "2026-08-24",
      "tipo": "correcao",
      "titulo": "Gerador de Grupos: pavimento/subgrupo com nome COMPOSTO (ex: \"Mini Grua e Cremalheira\") nunca casava com nenhuma tarefa",
      "itens": [
        "Caso real: Milton cadastrou o pavimento \"Mini Grua e Cremalheira\" pra agrupar tarefas de equipamento (Montagem Mini Grua, Montagem/Desmontagem Cremalheira Externa/Interna) — e nenhuma delas casava, todas caíam em \"Sem Vínculo\".",
        "Causa: o match exigia a FRASE INTEIRA do pavimento aparecer dentro do nome da tarefa — mas nenhuma tarefa fala \"Mini Grua e Cremalheira\" junto, cada uma menciona só uma parte (\"Mini Grua\" OU \"Cremalheira Externa\").",
        "Corrigido: nome composto com \" e \"/\",\"/\"/\" agora é dividido em partes (\"Mini Grua\", \"Cremalheira\") — cada parte sozinha já casa. Testado com as 6 tarefas reais do caso: todas casaram certo.",
        "Vale tanto pra pavimento quanto pra apartamento/subgrupo — qualquer nome composto que você criar, em qualquer obra, sem precisar de nenhuma lista fixa."
      ]
    },
    {
      "versao": "V3.19.30.44",
      "data": "2026-08-24",
      "tipo": "correcao",
      "titulo": "Gerador de Grupos: \"Cobertura\" sempre virava Reservatório mesmo em obra que cadastrou um pavimento \"Cobertura\" de verdade",
      "itens": [
        "Existe uma regra fixa antiga (\"Cobertura\" = sinônimo de Reservatório) — feita numa obra que não tinha um pavimento \"Cobertura\" próprio, só \"Reservatório\". Ela estava rodando pra TODAS as obras, sem checar se a obra atual tinha um \"Cobertura\" cadastrado de verdade.",
        "Corrigido: agora o nome LITERAL da tarefa é testado primeiro contra os pavimentos cadastrados — se você tem um pavimento \"Cobertura\", ele ganha. A regra antiga (Cobertura→Reservatório) só entra como último recurso, pra obra que realmente não tem \"Cobertura\" cadastrado."
      ]
    },
    {
      "versao": "V3.19.30.45",
      "data": "2026-08-24",
      "tipo": "correcao",
      "titulo": "Medições: filtrar por Frente (sem digitar busca) não abria os grupos até o resultado",
      "itens": [
        "O auto-abrir dos grupos até o resultado só disparava quando tinha TEXTO na busca — filtrar só por Frente (ex: HIDRAULICA) ou só \"Ocultar 100%\" deixava tudo do jeito que já estava (geralmente tudo fechado), obrigando abrir pavimento por pavimento na mão pra achar o que já tinha sido filtrado.",
        "Corrigido: agora qualquer filtro ativo (Frente, Ocultar 100% ou busca por texto) abre automaticamente o caminho até cada resultado — em qualquer modo de visão (Estrutura, Categoria, Grupo)."
      ]
    },
    {
      "versao": "V3.19.30.46",
      "data": "2026-08-24",
      "tipo": "correcao",
      "titulo": "⚠️ Medições: preencher Término Real recalculava a Duração da tarefa, distorcendo o peso do % no grupo/pavimento",
      "itens": [
        "Bug sério: ao preencher Término Real, o sistema recalculava a Duração da tarefa com base na diferença entre Início Real e Término Real — só que Duração é o PESO oficial do cálculo de % (regra do sistema, nunca deveria mudar por isso). Preencher datas reais do mesmo dia (comum quando lançado depois, tudo de uma vez) zerava a duração da tarefa, fazendo ela quase sumir do peso da média do grupo/pavimento e puxando o % geral pra um valor errado.",
        "Corrigido: Início/Término Real continuam atualizando o cronograma Atual (como já era), mas a Duração NUNCA é mais tocada por isso.",
        "IMPORTANTE — dado que já pode ter sido afetado: qualquer tarefa em que você preencheu Término Real pela Medição enquanto esse bug estava no ar pode ter a Duração errada agora (geralmente menor do que deveria). Vale conferir a coluna Duração no Planejamento das tarefas já medidas e corrigir na mão quem estiver com número estranho — o valor original não tem como ser recuperado automaticamente, já foi sobrescrito."
      ]
    },
    {
      "versao": "V3.19.30.47",
      "data": "2026-08-24",
      "tipo": "correcao",
      "titulo": "Medições: \"começar recolhido\" só funcionava na Estrutura — nos modos de Categoria/Grupo abria tudo aberto",
      "itens": [
        "Os modos de visão por Categoria/Grupo usam ids sintéticos pros grupos (não são tarefas de verdade) — o \"começar recolhido\" e o botão \"Recolher\" só sabiam recolher pelos ids das tarefas da Estrutura, então nesses modos tudo continuava aberto direto.",
        "Corrigido: \"Nova Medição\", \"Recolher\" e trocar de modo de visão agora recolhem certo em qualquer modo (Estrutura, Categoria, Grupo e as combinações)."
      ]
    },
    {
      "versao": "V3.19.30.48",
      "data": "2026-08-24",
      "tipo": "correcao",
      "titulo": "Medições: filtro de Frente (lembrado de sessão anterior) forçava abrir tudo, brigando com \"começar recolhido\"",
      "itens": [
        "O filtro de Frente fica marcado entre sessões (ex: GESSO já vem selecionado ao abrir de novo) — e o ajuste anterior abria automaticamente TODOS os grupos sempre que tinha Frente ativo, o que na prática é quase sempre. Resultado: a tela nunca começava recolhida de verdade.",
        "Corrigido: agora só o TEXTO da busca abre automaticamente (é uma ação que você acabou de fazer, faz sentido mostrar o resultado na hora). Frente e Ocultar 100% continuam escondendo quem não interessa, mas não forçam mais abrir nada — o \"começar recolhido\" agora vale de verdade, mesmo com Frente marcada."
      ]
    },
    {
      "versao": "V3.19.30.49",
      "data": "2026-08-24",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: reatribuir uma peça pra outra concretagem deixava a execução presa na concretagem antiga",
      "itens": [
        "Bug real reportado: o relatório mostrava uma estaca no dia/concretagem errado — o planejamento dizia \\\"Concretagem Nº 6\\\", mas o lançamento (BT) dela continuava registrado na concretagem antiga, de outra data.",
        "Causa: reatribuir uma peça pra outra concretagem (pelo popup \\\"Atribuir à Concretagem\\\" ou pelo clique rápido com concretagem em foco) só trocava o PLANEJAMENTO — os lançamentos (execução) já feitos pra aquela peça ficavam esquecidos, ainda apontando pra concretagem de origem.",
        "Corrigido nos 2 fluxos: reatribuir agora move os lançamentos existentes junto, pra concretagem nova — planejamento e execução ficam sempre alinhados.",
        "\\\"Remover desta concretagem\\\" agora avisa se a peça já tem lançamento registrado antes de remover — o lançamento continua salvo, mas fica sem concretagem vinculada."
      ]
    },
    {
      "versao": "V3.19.30.50",
      "data": "2026-08-24",
      "tipo": "melhoria",
      "titulo": "Controle de Estacas: botão \"🔧 Corrigir desalinhados\" — conserta em massa dados que já ficaram errados antes do fix",
      "itens": [
        "O fix anterior (V3.19.30.49) só vale pra reatribuições NOVAS, dali pra frente — peças que já tinham ficado com o lançamento preso na concretagem antiga continuam erradas até alguém corrigir.",
        "Novo botão \\\"🔧 Corrigir desalinhados\\\" no painel de Concretagens planejadas: varre TODAS as peças, compara o planejamento atual de cada uma com os lançamentos dela, e corrige em lote quem estiver apontando pra concretagem diferente — sem precisar reatribuir peça por peça na mão.",
        "Mostra quais peças serão corrigidas antes de confirmar, e avisa se não encontrar nenhuma desalinhada."
      ]
    },
    {
      "versao": "V3.19.30.51",
      "data": "2026-08-24",
      "tipo": "correcao",
      "titulo": "Controle de Estacas: achada a causa real — planejamento DUPLICADO pra mesma peça (aparecia em 2 dias)",
      "itens": [
        "Causa real de aparecer em 2 dias no relatório: a peça tinha DOIS registros de planejamento ao mesmo tempo (provavelmente clique duplo numa reatribuição antiga criou 2 em vez de trocar 1) — um preso na concretagem antiga, outro na nova. O \\\"Corrigir desalinhados\\\" anterior só olhava lançamento vs. planejamento, não pegava planejamento duplicado.",
        "\\\"🔧 Corrigir desalinhados\\\" agora faz 2 passadas: primeiro detecta peça com mais de 1 planejamento e mantém só o de concretagem mais recente (número mais alto), apagando o(s) duplicado(s); depois corrige os lançamentos pra bater com o planejamento que sobrou.",
        "Prevenção: reatribuir concretagem (pelo popup ou pelo clique rápido) agora trava contra clique duplo/corrida — não deixa criar planejamento duplicado de novo."
      ]
    },
    {
      "versao": "V3.19.30.52",
      "data": "2026-08-24",
      "tipo": "melhoria",
      "titulo": "Controle de Estacas: \"Corrigir desalinhados\" agora mostra o \"de → para\" antes de aplicar",
      "itens": [
        "Antes: o botão só avisava quantos itens tinha errado e pedia confirmação sem mostrar detalhe — não dava pra saber qual concretagem seria escolhida como \\\"certa\\\" pra cada peça.",
        "Agora abre um popup listando peça por peça: pra planejamento duplicado, mostra qual concretagem fica (número + data) e qual é removida; pra lançamento fora do lugar, mostra \\\"De: Nº X → Para: Nº Y\\\" claramente. Nada é alterado até clicar em \\\"Aplicar correção\\\"."
      ]
    },
    {
      "versao": "V3.20.0",
      "data": "2026-08-26",
      "tipo": "funcionalidade",
      "titulo": "Novo módulo: Calendário de Obra — o motor de datas passa a contar dias úteis",
      "itens": [
        "PROBLEMA QUE ISSO RESOLVE: o motor de datas somava dias CORRIDOS. Uma tarefa de 20 dias úteis (4 semanas de obra) era agendada como 20 dias de folhinha — quase 28% mais curta — e uma tarefa que terminava na sexta jogava a sucessora pro sábado. Numa cadeia de 10 tarefas encadeadas o erro acumulado passava de dois meses.",
        "Nova aba Calendário em Configuração da Obra, por obra: jornada semanal (quais dias da semana a obra trabalha, sábado incluído), \\\"a obra trabalha em feriado\\\" liga/desliga, feriados nacionais gerados automaticamente, feriados municipais/estaduais cadastrados na mão, paralisações por faixa de datas (recesso, chuva) e exceções por data.",
        "As exceções funcionam nos DOIS sentidos: um domingo específico que a obra vai trabalhar, ou uma terça específica que ela não vai. Exceção pontual vence tudo — feriado, paralisação e jornada.",
        "Feriados nacionais são CALCULADOS, não baixados de API: os fixos por data e os móveis derivados da Páscoa por fórmula fechada (Carnaval, Sexta-feira Santa, Corpus Christi). Sem dependência de rede dentro do cálculo de data, e sem tabela pra ficar desatualizada. Carnaval e Corpus Christi entram como ponto facultativo (não são feriado nacional por lei) e podem ser desmarcados. 20/11 só entra como feriado nacional a partir de 2024, respeitando a Lei 14.759/2023.",
        "Prévia visual do ano inteiro na tela de configuração: os 12 meses pintados, dia útil em destaque e dia parado em cinza com o motivo no passar do mouse, mais a contagem de dias úteis por mês.",
        "CORREÇÃO NO MOTOR: tarefa com predecessora Término-Início e Término-Término ao mesmo tempo tinha o início vindo de uma e o término da outra — a barra saía com duração DIFERENTE da declarada, sem avisar ninguém. Agora as duas restrições viram um piso de início comum e a duração é sempre preservada, como manda o CPM.",
        "CORREÇÃO NO MOTOR: dependência circular (tarefa A depende de B que depende de A) era cortada em silêncio na propagação — a cadeia não travava, mas ninguém nunca soube que existia. Agora fica registrada e é relatada.",
        "Convenção de duração alinhada ao MS Project quando o calendário está ligado: duração conta o dia de início (5 dias começando segunda termina na sexta). Antes dava sábado, e toda planilha que entrava ou saía do Project desalinhava um dia por tarefa.",
        "NADA MUDA SOZINHO: o calendário nasce DESLIGADO em toda obra, e com ele desligado o sistema conta dias corridos exatamente como antes. Ligar o calendário também não mexe em data nenhuma — o recálculo é um passo separado, no botão \\\"Aplicar Calendário às Datas\\\" do menu de Ferramentas do Planejamento.",
        "Esse botão SIMULA antes de aplicar: mostra quantas tarefas mudam de data, o de → para de cada uma, e quantos dias o término da obra estica ou encurta. Só aplica depois de confirmar, grava em lote e dá pra desfazer com Ctrl+Z. Enquanto o calendário estiver ligado mas as datas ainda na régua antiga, um aviso verde aparece no topo do Planejamento.",
        "Mudar qualquer coisa no calendário depois (jornada, feriado, exceção) marca as datas como desatualizadas de novo e o aviso volta — não fica cronograma incoerente em silêncio.",
        "A conta de dia útil mora num módulo só (js/calendario.js) pra Medições, Semanal, Histograma e Curva S usarem a MESMA régua. Dois caminhos de cálculo que divergem já quebrou este sistema antes."
      ]
    },
    {
      "versao": "V3.20.1",
      "data": "2026-08-26",
      "tipo": "correcao",
      "titulo": "Calendário de Obra: aba ficava com texto preto no fundo preto",
      "itens": [
        "A tela nova do Calendário foi escrita com cores fixas de tema escuro (fundo #181818, textos em cinza) enquanto o sistema usa tema CLARO. Resultado: os títulos dos blocos, os nomes dos feriados e os rótulos das caixas de seleção herdavam a cor de texto padrão (quase preta) sobre fundo preto — invisíveis.",
        "Reescrita usando os componentes e as variáveis do próprio sistema: blocos viraram card/card-header/card-body, tabelas viraram tabela + tabela-compacta dentro de tabela-container, caixas de seleção viraram form-check, e tipo de feriado e efeito da exceção viraram badge colorido.",
        "Mesma correção no popup de \\\"Aplicar Calendário às Datas\\\" (os três indicadores do topo, a tabela de de → para e os avisos) e no aviso do topo do Planejamento, que estava em verde escuro e agora usa o amarelo de alerta do sistema.",
        "Prévia dos 12 meses: dia útil no amarelo Absoluta, dia parado no cinza neutro do tema, ambos com contraste de texto correto."
      ]
    },
    {
      "versao": "V3.20.1.1",
      "data": "2026-08-26",
      "tipo": "melhoria",
      "titulo": "Calendário de Obra: prévia dos meses virou calendário de verdade, com Dom a Sáb no cabeçalho",
      "itens": [
        "Antes os dias vinham enfileirados um atrás do outro, sem coluna: dava pra ver quais dias estavam parados, mas não em que dia da semana cada número caía — justamente o que interessa pra conferir a jornada.",
        "Agora cada mês é uma grade de 7 colunas com as siglas DOM SEG TER QUA QUI SEX SÁB no cabeçalho, e o dia 1 cai na coluna certa (com as células vazias antes dele).",
        "As siglas dos dias fora da jornada aparecem em tom mais fraco, então bate o olho e já vê a coluna que a obra não trabalha.",
        "O passar do mouse em cada dia agora diz também o dia da semana por extenso, além da data e do motivo de estar parado."
      ]
    },
    {
      "versao": "V3.21.0",
      "data": "2026-08-26",
      "tipo": "funcionalidade",
      "titulo": "Novo módulo: Verificar Planejamento — caminho crítico, auditoria da rede e crítica de sequência",
      "itens": [
        "O QUE ISSO SUBSTITUI: a conferência manual do cronograma, linha por linha, predecessora por predecessora. Um clique analisa a rede inteira e devolve o que não faz sentido, com o motivo técnico de cada apontamento.",
        "CAMINHO CRÍTICO (o que nunca existiu): o sistema só empurrava data pra frente. Agora tem o caminho de volta — late start, late finish, folga total e folga livre. Botão \\\"Caminho Crítico\\\" na barra do Planejamento marca em vermelho as tarefas que seguram a data final e liga a coluna Folga. Folga 0 = atrasar ali atrasa a obra. Folga negativa = o cronograma já não fecha como está.",
        "AUDITORIA DA REDE, na linha das 14 checagens do DCMA: tarefa sem predecessora, tarefa sem sucessora, defasagem negativa, defasagem longa demais (espera que na verdade é uma tarefa faltando), duração acima de 44 dias, folga negativa, folga absurdamente alta (sinal de lógica faltando), dependência circular, predecessora apontando pra tarefa excluída, excesso de vínculos que não são Término-Início, e incoerência entre avanço e datas reais.",
        "ORDEM DE EXECUÇÃO DOS SERVIÇOS: 18 regras de precedência tecnológica de obra, cada uma com o motivo e o risco escritos. Ele reconhece o serviço pelo nome da tarefa e avisa, por exemplo, que porcelanato antes de forro de gesso é retrabalho — porque serviço que fica acima derruba massa, poeira e água, e piso pronto embaixo vira proteção física e limpeza pesada que ninguém orçou. Também avisa quando dois grupos de serviço estão na ordem errada na obra inteira e não existe vínculo nenhum entre eles.",
        "CRÍTICA DE DURAÇÃO: usa a quantidade vinculada ao levantamento e o número de equipe pra calcular se a duração cabe. \\\"5 dias pra 620 m² de porcelanato com 4 oficiais\\\" vira \\\"o necessário fica em torno de 14 dias\\\". A faixa TCPO/SINAPI entra como referência e a fonte é sempre declarada no apontamento; quando houver histórico de produtividade da própria equipe, ele usa o histórico e diz isso.",
        "AÇÕES: cada apontamento traz \\\"Inverter o vínculo\\\" (o sistema aplica e recalcula a rede, com Ctrl+Z), \\\"Ver a tarefa\\\" (vai direto pra linha) e \\\"É assim de propósito\\\".",
        "MEMÓRIA DE DECISÃO: ao responder \\\"é assim de propósito\\\" você escreve o motivo (ex: ordem da diretoria) e aquilo fica gravado na obra. O ponto para de aparecer nas análises seguintes — sem isso o painel repetiria o mesmo alerta pra sempre, viraria ruído e ninguém mais olharia. Se o que gerou o apontamento mudar (data, duração, tipo de vínculo), a decisão antiga deixa de valer e o ponto é reaberto: decidir não é apagar, é decidir aquilo.",
        "RODA OFFLINE E SEM IA. Motor de datas, CPM, auditoria e as 18 regras são cálculo determinístico dentro do navegador: dá o mesmo resultado toda vez e continua funcionando se a internet cair. Quem quiser discutir em linguagem livre tem o botão \\\"Copiar dossiê\\\", que copia um resumo compacto (poucos kB, nunca a planilha inteira) pra colar num chat.",
        "Nada é alterado sem aprovação. Nenhum apontamento mexe no cronograma sozinho.",
        "Nova sub-permissão configuracaoObra:editar:calendario, e o Verificador respeita planejamento:editar pra oferecer as ações que gravam.",
        "SÁBADO DE MEIO PERÍODO (pedido): a jornada semanal passa a ter três estados por dia — não trabalha, dia inteiro, meio período. Cada clique no dia cicla. O motor passou a medir duração em JORNADA acumulada e não em caixinhas do calendário, que é como o MS Project faz: uma tarefa de 6 dias que atravessa um sábado de meio período termina um dia depois do que terminaria numa semana de 6 dias cheios.",
        "CLIQUE NO DIA DA PRÉVIA (pedido): clicar num dia do calendário cria a exceção que inverte aquele dia, e clicar de novo volta ao padrão. Era formulário, virou um clique. Dia com exceção ganha anel azul, meio período ganha meio amarelo meio cinza, e a prévia ganhou legenda.",
        "Verificação: 90 testes automatizados nos módulos de cálculo, incluindo prova empírica do backward pass (uma tarefa com folga N aceita N dias a mais sem mover o término da obra, e com N+1 move) e regressão confirmando que sem meio período e com o calendário desligado o comportamento anterior é idêntico."
      ]
    },
    {
      "versao": "V3.21.1",
      "data": "2026-08-26",
      "tipo": "correcao",
      "titulo": "Verificar Planejamento: inversão de vínculo agora entende a EAP inteira, não um vínculo só",
      "itens": [
        "PROBLEMA: a EAP é hierárquica — Gesso tem Final 01 e Final 02, e dentro de cada final os pavimentos; Contrapiso e Porcelanato na mesma estrutura. A ordem errada entre dois serviços não aparece num vínculo: aparece em dezenas, um por local. O Verificador gerava um alerta por vínculo (repetindo a mesma coisa 8, 20, 40 vezes) e o botão invertia UM. Invertendo um só, o cronograma da obra não mudava nada — os outros continuavam mandando.",
        "Agora o apontamento é UM por par de serviços, carregando todos os vínculos daquele par em toda a EAP. O título diz quantos são, e o texto avisa que inverter só um não resolve.",
        "A inversão é em massa, cada vínculo no seu lugar. O pareamento por final e pavimento sai de graça: cada vínculo já liga o par certo (Final 01/3º andar com Final 01/3º andar), e inverter cada um onde está preserva isso. O sistema não tenta adivinhar pareamento — usa o que já existe.",
        "LÊ O CAMINHO CRÍTICO: o apontamento informa quantos daqueles vínculos envolvem tarefa crítica, ou seja se a inversão mexe na data final ou só reorganiza folga.",
        "SIMULA ANTES DE APLICAR: quantos vínculos, quantas tarefas mudam de data, término da obra de → para com quantos dias atrasa ou adianta, e quantas tarefas entram e saem do caminho crítico (com a lista). Se a inversão criar dependência circular, avisa antes — sinal de que já existe outro vínculo puxando no sentido contrário.",
        "As datas são gravadas em lote a partir do CPM já simulado, em vez de propagação tarefa por tarefa, que numa EAP grande seriam centenas de escritas em sequência.",
        "NOVA FERRAMENTA — \\\"Inverter Vínculos entre Grupos\\\" no menu de Ferramentas: escolha dois grupos da EAP e o sistema acha todos os vínculos entre eles, mostra a lista, simula e inverte de uma vez. Serve pro caso em que a decisão de ordem é sua e não existe regra: gesso depois do contrapiso, por exemplo, é prática legítima (o gesseiro usa o contrapiso como piso de trabalho e referência de nível), então o sistema não afirma ordem ali — mas te dá a ferramenta pra trocar quando você decidir.",
        "Quando não existe vínculo nenhum entre os dois grupos, a ferramenta diz isso em vez de fingir que fez algo: sem vínculo não há o que inverter, e o que falta é criar os vínculos.",
        "Verificação: 12 testes sobre uma EAP hierárquica de 2 finais × 4 pavimentos, incluindo a prova de que invertendo um vínculo só o problema continua e sobram os outros 7, e que nenhum vínculo cruza final ou pavimento na inversão em massa."
      ]
    },
    {
      "versao": "V3.22.0",
      "data": "2026-08-26",
      "tipo": "funcionalidade",
      "titulo": "Verificador passa a aprender o padrão da própria obra, em vez de aplicar regra genérica",
      "itens": [
        "O QUE ESTAVA ERRADO: o Verificador comparava o cronograma com 18 regras de precedência genéricas escritas sem nunca ter olhado um cronograma desta empresa. Rodando no RD06 ESSENCE RESIDENCE (2.439 linhas) o problema apareceu na hora: a regra \\\"impermeabilização antes do contrapiso\\\" contrariava o cronograma real 42 vezes — e o cronograma estava certo. O contrapiso dá o caimento, a impermeabilização vem sobre ele, o teste de lâmina d'água valida, e só então o revestimento. A regra teria gerado 42 alertas falsos.",
        "NOVO MOTOR: o sistema lê o cronograma e conta, par por par, quantas vezes cada serviço precede cada outro. Num prédio o mesmo conjunto se repete por pavimento, então o padrão emerge por contagem, e o apontamento passa a ser o DESVIO do padrão da própria obra, com número: \\\"42 vezes assim, 2 vezes ao contrário, aqui estão as 2\\\". Zero chute. No RD06 isso rendeu 253 pares de precedência aprendidos — 14× mais conhecimento de execução que as 18 regras, e conhecimento da própria empresa.",
        "USA A SUA CLASSIFICAÇÃO: em vez de adivinhar o serviço pelo nome da tarefa, o motor usa a Subcategoria que você já preenche (\\\"Forro de Gesso (teto)\\\", \\\"Emboço (reboco interno de regularização)\\\", \\\"Teste de Impermeabilização\\\"). Sua taxonomia é mais precisa que qualquer dicionário que eu montasse.",
        "ACHADO NOVO E O MAIS PERIGOSO — VÍNCULO FALTANDO: se o padrão liga dois serviços em 12 pavimentos e num não liga, aquele local tem lógica furada. Vínculo ausente é o erro mais silencioso que existe: nada reclama, a data parece certa, mas quando a antecessora atrasa a tarefa não anda junto. No RD06 encontrou 25 padrões com furo em 109 locais — com concentração clara do 12º ao 16º pavimento, assinatura de pavimento duplicado sem levar os vínculos.",
        "DESAMBIGUAÇÃO DE ETAPA: a subcategoria \\\"Demão de Pintura\\\" cobre 1ª e 2ª demão, e o par com \\\"Instalação de Luminárias\\\" aparecia 20× em cada sentido. Não era contradição: a sequência real é 1ª demão → luminárias → 2ª demão. O motor agora separa as etapas pelo ordinal do nome, e os 20 falsos positivos desapareceram.",
        "SUPRESSÃO POR AMBIENTE: \\\"1ª Demão Pintura Final 01 → Massa Corrida Hall\\\" aparecia 16× contra o padrão e está correto — a equipe pinta os apartamentos e depois o hall. Vínculo entre ambientes diferentes é sequência de frente de serviço, não ordem tecnológica invertida, e não é mais apontado.",
        "AGREGAÇÃO: a primeira rodada no RD06 devolveu 4.401 pendências, sendo 2.180 de \\\"data divergente\\\". Painel com 4.401 itens é o mesmo que painel nenhum. E o número mentia: 2.180 datas divergentes não são 2.180 problemas, são UM (o cronograma nunca foi recalculado pela própria rede) com 2.180 sintomas. Agora sai agregado, com a contagem, exemplos e a ação que resolve o conjunto. Resultado: 44 pendências, 19 graves.",
        "REGRAS GENÉRICAS REBAIXADAS: deixam de ser autoridade e viram referência, sempre atrás do padrão observado. Quando o padrão da obra já falou sobre um par, a regra genérica se cala. E quando o cronograma faz algo de forma consistente em 5+ lugares, a regra não tem autoridade para contrariar repetição deliberada.",
        "DUAS REGRAS MINHAS FORAM CORRIGIDAS PELOS SEUS DADOS. (1) \\\"impermeabilização antes de contrapiso\\\" passou a afirmar só o que é inequívoco: impermeabilização e teste antes do REVESTIMENTO que os cobre. (2) alvenaria de vedação e alvenaria estrutural viraram serviços distintos, porque a ordem em relação à laje é invertida entre elas — e entre alvenaria estrutural e laje o sistema agora NÃO afirma ordem nenhuma, porque ela alterna por pavimento (laje do 5º → alvenaria do 6º → laje do 6º). Tentar afirmar gerou 17 alertas falsos no RD06 e a regra foi removida.",
        "CHECAGEM REMOVIDA: \\\"ordem global entre serviços\\\" comparava o primeiro início de um serviço com o último término de outro na obra inteira. Num prédio isso está sempre \\\"invertido\\\" e não é erro — a elétrica do 1º pavimento começa antes da alvenaria do 16º terminar, porque é obra em linha de balanço. Gerava apontamento sem sentido só pela existência de 16 pavimentos.",
        "RECORTE DO BLOCO REPETITIVO: o sistema identifica que 16 pavimentos do RD06 são idênticos e extrai o pavimento-tipo — 60 serviços em ordem cronológica real, pela data média. É o recorte que torna a análise em linguagem natural viável: 16 kB em vez da planilha de 2.439 linhas, 56× menor, e vai junto no \\\"Copiar dossiê\\\". A sequência é ordenada por data e não por ordenação topológica de propósito: entre dois serviços sem vínculo a topológica devolve ordem arbitrária, e é justamente essa ausência de vínculo que interessa auditar.",
        "O que continua igual: calendário, CPM, folga e caminho crítico. Aquilo é matemática, está provado por teste, e não dependia de opinião nenhuma sobre sequência de obra."
      ]
    },
    {
      "versao": "V3.22.1",
      "data": "2026-08-26",
      "tipo": "correcao",
      "titulo": "Recálculo de datas mexia em tarefa já 100% concluída",
      "itens": [
        "BUG GRAVE: \\\"Aplicar Calendário às Datas\\\" e o CPM recalculavam a data de tarefas já executadas. No RD06 o popup propunha alterar 2.438 tarefas — incluindo 317 que estão 100% concluídas e foram executadas naquelas datas. Recalcular isso é reescrever a história da obra, e pior: empurra todas as sucessoras a partir de uma data que nunca existiu.",
        "Implementada a DATA DE CORTE, que é como planejamento de obra funciona: o que já aconteceu é FATO, só o futuro se replaneja.",
        "Tarefa 100% concluída (ou com Término Real lançado) fica INTOCADA: início e término congelados, e a data real vence a planejada. Ela também sai do caminho crítico — não faz sentido dizer que tarefa pronta segura a data final — e a folga dela é zero por definição.",
        "Tarefa já iniciada (avanço > 0 ou com Início Real) mantém o INÍCIO como fato; só o término é recalculado pela duração. Foi o serviço que começou naquele dia, e isso não se apaga.",
        "Tarefa não iniciada: recalcula normal. É o único caso em que faz sentido.",
        "Tarefa concluída que esteja em dependência circular também mantém a data: o ciclo impede calcular previsão, mas não impede saber quando o serviço foi feito — isso é registro, não cálculo.",
        "O popup de simulação agora mostra quantas executadas foram preservadas e quantas iniciadas mantiveram o início, e avisa isso em destaque antes de você aplicar.",
        "Efeito colateral revelado e correto: apareceram 202 tarefas com folga negativa no RD06. Não é bug novo — é a verdade que estava escondida. Com as datas executadas congeladas, fica visível onde o cronograma não fecha mais: serviço que começou antes da antecessora terminar, ou tarefa concluída com atraso que nunca foi replanejada adiante. Enquanto isso não for resolvido, a data final que o sistema mostra é otimista. Sai agregado num apontamento só, com a causa e a ação.",
        "Verificação: 14 testes da data de corte, incluindo regressão que confirma comportamento idêntico quando não há avanço lançado; e no cronograma real do RD06, ZERO das 317 tarefas executadas é movida pelo motor."
      ]
    },
    {
      "versao": "V3.22.2",
      "data": "2026-08-26",
      "tipo": "correcao",
      "titulo": "Verificador dava diagnóstico invertido em vínculo, e não mostrava a causa dos apontamentos",
      "itens": [
        "DIAGNÓSTICO INVERTIDO (o pior tipo de erro, porque manda fazer a coisa errada): o apontamento \\\"vínculo faltando\\\" só exigia que o vínculo existisse em 4 locais pra considerar aquilo padrão da obra. No RD06 isso mandava criar \\\"Distribuição Elétrica → Distribuição de Gás\\\" em 12 pavimentos porque existia em 4. Mas 4 de 16 não é padrão: é o contrário — em 12 locais NÃO existe, então o padrão da obra é não ter esse vínculo, e os 4 é que estão errados. Gás não depende de elétrica; depende da alvenaria de vedação e do gás do pavimento anterior.",
        "Agora o vínculo só é considerado padrão se estiver presente na MAIORIA dos locais onde os dois serviços coexistem (60%). No RD06 os apontamentos de vínculo faltando caíram de 25 padrões / 109 locais para 20 / 52 — os que sobraram têm cobertura de 63% a 79%, aí sim é falha de montagem.",
        "ACHADO NOVO, o espelho do anterior: VÍNCULO SOBRANDO. Se dois serviços coexistem em 20 locais e estão ligados em 1, esse vínculo é que está fora do padrão. Encontrou 26 casos no RD06, com 92 vínculos — coisas como \\\"Concretagem de Laje → Instalação de Luminárias\\\" ligado em 1 de 20 locais. Vínculo assim prende tarefa sem necessidade, come folga e pode jogar coisa pro caminho crítico que não deveria estar lá.",
        "AÇÕES QUE FALTAVAM: os apontamentos de vínculo agora têm botão pra CRIAR nos locais que estão sem, REMOVER os que sobram, e INVERTER — todos em massa, com simulação do impacto na data final e no caminho crítico antes de aplicar. Antes o sistema achava o problema e mandava resolver na mão, tarefa por tarefa.",
        "A criação é pareada POR LOCAL: cada tarefa é ligada à do mesmo pavimento e, dentro dele, ao mesmo ambiente (Final 01 com Final 01, Hall com Hall). Nunca cruza pavimento. Onde o ambiente não casa, liga em todas as origens daquele local — conservador de propósito, em vez de escolher um palpite.",
        "CAUSA DA FOLGA NEGATIVA: antes dizia só \\\"a rede exige que esta tarefa termine 146 dias antes do que ela consegue\\\" — número sem endereço, impossível de julgar. Agora diz quem aperta: \\\"Concretagem Laje Piso: Cobertura precisa começar em 09/07 (vínculo TI), então esta teria que terminar até 08/07, mas só consegue em 25/08\\\".",
        "O LAÇO DA DEPENDÊNCIA CIRCULAR: antes dizia \\\"A espera B, que espera A\\\" sem dizer quem é A e quem é B. Agora mostra o caminho fechado inteiro — no RD06, Fechamento Shaft do 7º depende do 8º, que depende do 9º Final 01, que depende do 9º Final 02, que depende do 10º Final 02, e volta. Com o caminho na mão dá pra escolher qual vínculo remover.",
        "AGREGADO MOSTRA O PRIMEIRO CASO COMPLETO: em achado repetitivo o diagnóstico inteiro de um caso explica todos, e cortar na primeira linha era exatamente o que impedia entender o problema."
      ]
    },
    {
      "versao": "V3.23.0",
      "data": "2026-08-26",
      "tipo": "funcionalidade",
      "titulo": "Novo: opinião técnica sobre o cronograma, e Editor de Predecessoras",
      "itens": [
        "PROBLEMA: até aqui o Verificador só sabia falar de VÍNCULO — predecessora faltando, folga, ciclo, caminho crítico. Isso é matemática de rede, é necessário, mas não é planejamento. Faltava o que mais importa: a ordem faz sentido, a equipe cabe nos locais, o ritmo entre pavimentos fecha, as frentes vão se atropelar, o que dá pra antecipar. E faltava poder CORRIGIR sem depender da grade.",
        "O Verificador agora tem DUAS ABAS, porque são duas perguntas diferentes: \\\"Rede e vínculos\\\" (o que já existia) e \\\"Cronograma\\\" (a opinião de planejamento). Misturar as duas numa lista só era o que fazia o painel parecer que só sabia falar de vínculo.",
        "CARGA DE FRENTE — o achado mais forte: equipe é recurso finito e o cronograma não sabe disso. No RD06 o sistema encontrou PEDREIROS em 26 locais simultâneos em 24/08/2026, ELÉTRICA em 17 e HIDRÁULICA em 12. É o erro mais comum de cronograma montado serviço por serviço: cada um parece razoável isolado, e o conjunto exige um efetivo que a obra não tem. Na prática a equipe atende um local por vez, os outros esperam, e o atraso aparece sem causa aparente. A tela mostra a tabela de carga de todas as frentes com o pico e a data.",
        "RITMO DE LINHA DE BALANÇO: obra de edifício é trem de serviços subindo pavimento a pavimento, e o que importa não é a duração de cada tarefa, é o INTERVALO entre pavimentos — o takt. O sistema mede o takt de cada serviço, calcula o desvio, e aponta ritmo irregular. Ritmo aos trancos significa equipe parando e voltando: desmobiliza, perde produtividade no reaquecimento, e o encarregado não consegue programar a semana. No RD06 o takt médio é de 8,5 dias em 44 serviços medíveis.",
        "ESPERA ENTRE PAVIMENTOS: quando o takt é muito maior que a duração, a equipe termina e só volta semanas depois. É onde o prazo se estica sem ninguém decidir esticar. O sistema calcula a ociosidade por ciclo e propõe as duas saídas honestas — puxar o passo e encurtar a obra, ou reduzir a equipe e assumir o ritmo com custo menor.",
        "COLISÃO DE RITMO: dois serviços encadeados precisam subir no mesmo passo. Se o de trás sobe mais rápido, ele ALCANÇA o da frente e para; se sobe mais devagar, abre buraco de pavimento pronto esperando serviço. Nos dois casos o efetivo planejado deixa de valer no meio da obra. Nenhuma checagem de vínculo enxerga isso.",
        "CONFLITO NO MESMO AMBIENTE: duas frentes diferentes no mesmo ambiente ao mesmo tempo é atrito físico — disputa de espaço, de andaime, de ponto de energia, e serviço pronto de uma sendo danificado pela outra. No RD06 encontrou GESSO × AZULEJISTAS, GESSO × SERRALHERIA e GESSO × MARMORARIA com 32 sobreposições cada.",
        "OPORTUNIDADE DE ANTECIPAÇÃO: tarefa com folga livre alta pode antecipar sem empurrar ninguém. É a decisão de planejamento mais barata que existe — não custa nada e compra prazo, além de tirar risco de cima do caminho crítico.",
        "NOVO: EDITOR DE PREDECESSORAS. Corrigir vínculo pela grade era digitar número de linha sem ver o nome e sem saber qual escolher — impraticável em 2.400 linhas, e um sistema que aponta 50 problemas e não deixa consertar nenhum é pior que um que não aponta nada.",
        "O editor mostra o pai, os irmãos, e a predecessora atual POR NOME, com botão de remover em cada uma. As candidatas vêm ordenadas por probabilidade real, não alfabética: o que o padrão da obra usa para aquele serviço vem primeiro (com a contagem), depois mesmo pavimento, mesmo ambiente, termina antes, e mesmo serviço no pavimento anterior. Candidata que criaria ciclo aparece em vermelho — marcada, nunca escondida.",
        "COPIAR PARA AS OUTRAS: põe a mesma predecessora nos irmãos. Serve quando o vínculo aponta pra algo que não varia por andar (um marco, uma liberação única).",
        "COPIAR A SEQUÊNCIA — a operação que faltava: cada tarefa recebe a predecessora EQUIVALENTE no seu próprio pavimento. O 2º aponta pro 2º, o 3º pro 3º. Em EAP repetitiva o vínculo certo nunca é o mesmo objeto: o gás do 5º depende do gás do 4º, o do 6º do 5º. Copiar o mesmo id criaria 15 tarefas dependendo da mesma.",
        "O casamento entre andares resolve o subgrupo que embute o pavimento: no RD06 o apartamento 1 do 5º é \\\"51\\\" e o do 4º é \\\"41\\\". Comparar o subgrupo cru nunca casava — o editor compara o ambiente RELATIVO ao andar, então \\\"51\\\" e \\\"41\\\" viram \\\"1\\\" e casam, e \\\"Hall\\\" continua \\\"Hall\\\".",
        "Onde não existe equivalente, aquela tarefa é DEVOLVIDA como pendência com o motivo, em vez de receber vínculo errado em silêncio. Testado no RD06: dos 16 andares do gás, 11 já estavam corretos, 3 mudaram e 1 ficou pendente (o 1º pavimento não tem anterior) — e depois de aplicar, todos os 15 apontam para o andar imediatamente anterior.",
        "Antes de gravar, o editor SIMULA: quantas tarefas mudam de data, o término da obra de → para, o caminho crítico antes e depois, e avisa se a mudança cria dependência circular. Grava em lote, recalcula as datas e desfaz com Ctrl+Z.",
        "Acesso: botão \\\"Editar vínculo\\\" em cada apontamento do Verificador, e Ferramentas › Editor de Predecessoras com uma tarefa selecionada na grade.",
        "Análise completa das 2.439 linhas do RD06 nas duas abas em menos de 1 segundo, offline."
      ]
    },
    {
      "versao": "V3.24.0",
      "data": "2026-08-26",
      "tipo": "funcionalidade",
      "titulo": "Novo: PARECER do cronograma — o planejador que pensa, não o conferente que aponta",
      "itens": [
        "PROBLEMA: mesmo depois da aba Cronograma, tudo que o sistema entregava era CONFERÊNCIA — acha defeito e aponta. Planejador não entrega lista de defeito. Ele responde: onde está o prazo, o que muda a data, onde a obra vai travar, o que fazer nas próximas semanas, e onde tem prazo sobrando.",
        "Nova aba PARECER, que abre por padrão. As outras duas (Rede e Cronograma) passam a ser a evidência por trás dela.",
        "1. ONDE ESTÁ O PRAZO: o caminho crítico agrupado por SERVIÇO, com quantos dias e que percentual cada um pesa. Saber que 432 tarefas são críticas não ajuda; saber quais serviços definem a data, sim. E a frase que fecha: tudo que não está nessa lista pode atrasar sem mexer na entrega.",
        "2. O QUE MUDA A DATA — medido, não opinado: o sistema SIMULA acelerar cada equipe em 25% e recalcula a obra inteira para medir o ganho real em dias. Por EQUIPE e não por serviço, porque equipe é a unidade de decisão de verdade (contratar mais pedreiro acelera tudo que pedreiro faz).",
        "O TETO DO EFETIVO — o número mais importante do parecer: quanto a obra antecipa se TODAS as equipes críticas acelerarem juntas. No RD06 são 47 dias. Isso responde a pergunta que ninguém consegue responder no olho: contratar gente resolve? Se o teto for baixo ou zero, o sistema diz na cara que o problema não é produção, é a lógica da rede — e que o caminho é paralelizar, não contratar.",
        "E avisa quando os ganhos não se somam: no RD06 acelerar uma frente por vez rende 21 dias somados, mas todas juntas rendem 47. Isso é sinal de caminho crítico distribuído — assim que uma frente acelera, a próxima assume o gargalo, e reforço isolado quase não muda a entrega.",
        "3. ONDE A OBRA VAI TRAVAR: cruza o que já está atrasado no crítico, as frentes sem efetivo para o que o cronograma pede, e as tarefas críticas longas demais para serem controladas. No RD06: 28 tarefas críticas já vencidas, e PEDREIROS precisando estar em 26 locais ao mesmo tempo — sendo frente crítica.",
        "4. FOCO DAS PRÓXIMAS SEMANAS: as tarefas do caminho crítico na janela de 4 semanas, com o que está em curso e não pode escorregar. É a lista que se leva para a reunião de segunda. 54 tarefas no RD06.",
        "5. PRAZO SOBRANDO: o que pode antecipar sem empurrar ninguém, e os serviços com equipe parada entre pavimentos — cada um apresentado como a escolha que é: puxar o passo e encurtar a obra, ou reduzir a equipe e assumir o ritmo com custo menor.",
        "RESSALVAS: o parecer diz o quanto confiar nele. Avisa se o calendário está desligado, se há tarefas sem classificação, se há ciclo fora do cálculo, e se as datas salvas divergem da rede.",
        "Botão \\\"Copiar parecer\\\" leva tudo em texto corrido, na ordem em que um planejador falaria.",
        "DESEMPENHO — 27× mais rápido: o motor de datas ganhou cache de capacidade por dia e índice de dias úteis com soma acumulada, então somar dias úteis e contar jornadas viraram busca binária em vez de caminhada dia a dia. O CPM do RD06 caiu de 2.300ms para 86ms, e o parecer inteiro (19 simulações de rede completa) de 23 segundos para 2,4. Verificado contra o caminho antigo em 3 calendários × 400 datas: resultado idêntico, incluindo meio período e exceções.",
        "Funciona em qualquer obra sem configuração: o parecer descobre sozinho os serviços, as frentes e os locais a partir dos campos que a obra já preenche. Sem classificação, ele avisa que a leitura é mais grossa em vez de fingir precisão."
      ]
    },
    {
      "versao": "V3.25.0",
      "data": "2026-08-26",
      "tipo": "funcionalidade",
      "titulo": "Nova aba VIABILIDADE: dá pra fazer isso nesta ordem? — conferência linha por linha",
      "itens": [
        "A PERGUNTA QUE FALTAVA, e que nenhuma análise anterior fazia. O auditor pergunta se a REDE está bem montada. O padrão aprendido pergunta se aquilo é DIFERENTE do que a obra faz em outros lugares. A análise de cronograma pergunta se a EQUIPE cabe. Nenhuma perguntava a mais básica: como se faz o gesso do 1º andar sem a laje do 1º andar existir?",
        "Isso não é estatística nem boa prática — é impossibilidade física. Um serviço precisa que exista o suporte onde ele vai ser feito, e se o cronograma diz que sim, aquela data é ficção e tudo que depende dela herda a ficção.",
        "AS CAMADAS FÍSICAS, que é a ordem em que um prédio sobe e não é opinável: 1 SUPORTE (estrutura, laje, alvenaria estrutural, e a infraestrutura enterrada — drenagem, regularização de solo, escavação) · 2 VEDAÇÃO · 3 EMBUTIDO (elétrica, hidráulica, gás, contramarco) · 4 FECHAMENTO (reboco, contrapiso, gesso, forro) · 5 ACABAMENTO · 6 ENTREGA. Uma tarefa da camada N no local L exige que as camadas anteriores DAQUELE MESMO LOCAL existam.",
        "DUAS CHECAGENS EM CADA UMA DAS TAREFAS, uma por uma. (A) DATA IMPOSSÍVEL: a tarefa começa antes de a camada anterior do mesmo local terminar. Não olha vínculo, olha data — é a checagem mais forte, porque independe de o cronograma estar amarrado. (B) SEM AMARRA NO SUPORTE: a tarefa não tem caminho de dependência, nem indireto, até a estrutura do próprio local.",
        "RESULTADO NO RD06: 2.133 tarefas conferidas uma a uma. ZERO impossibilidades de data — nas datas, a ordem física do cronograma está coerente, não há serviço marcado onde ainda não há estrutura. Mas 905 tarefas sem amarra no suporte do próprio local.",
        "O CASO EXATO QUE MOTIVOU ISTO: o Gesso Liso do 10º pavimento depende SÓ do gesso do 9º, que depende do 8º, que depende do 7º — uma corrente vertical de gesso em que nenhum elo está preso à estrutura do próprio pavimento. Hoje a data está certa (gesso em 26/08, laje pronta em 15/04), mas por coincidência: nada obriga. Quando a laje atrasar, o gesso não anda junto, e o cronograma passa a marcar serviço num pavimento que ainda não foi concretado, sem que nada reclame.",
        "AÇÃO EM MASSA: botão \\\"Amarrar na estrutura\\\" cria o vínculo faltante em todas as tarefas do grupo, pareado por local — cada tarefa ligada à estrutura do SEU pavimento, nunca de outro. Com a mesma simulação de impacto na data final e no caminho crítico antes de aplicar.",
        "Os achados vêm AGRUPADOS POR PADRÃO: 404 acabamentos sem amarra são um problema com 404 ocorrências e uma ação que resolve o conjunto, não 404 problemas.",
        "ONDE O SISTEMA FICA CALADO, DE PROPÓSITO: serviço cujo nome não é reconhecido pelo vocabulário de construção fica de fora (65 no RD06), e atividades de canteiro, projeto e mobilização são ignoradas por não dependerem do local estar construído. Dizer que algo é impossível sem ter certeza é pior que não dizer nada.",
        "Dois erros meus corrigidos durante a construção, ambos revelados pelo cronograma real: drenagem e regularização de solo estavam classificadas como instalação embutida, e o sistema dizia que a drenagem do subsolo era impossível por começar antes da estrutura do subsolo — quando é exatamente assim que se constrói. E a comparação usava o ÚLTIMO término da estrutura do local: num local grande como o Térreo, uma única estrutura tardia jogava o limite pra frente e transformava serviço legítimo em impossível. Passou a usar o PRIMEIRO — a pergunta certa é \"já existe alguma parte pronta aqui?\", não \"está tudo pronto?\"."
      ]
    },
    {
      "versao": "V3.26.0",
      "data": "2026-08-29",
      "tipo": "funcionalidade",
      "titulo": "Novo: Concretagens agora se montam no Controle de Concreto, não no Levantamento",
      "itens": [
        "PROBLEMA: montar/editar/excluir uma Concretagem (vínculo de peças + configuração de BTs) morava no Levantamento de Concreto. Errado — Levantamento é a base de peças do projeto; quem controla e executa a concretagem é o Controle de Concreto.",
        "Botão \\\"◈ Concretagens\\\" e todo o wizard (Dados → Peças → BTs → Resumo) saíram do Levantamento e foram para o Controle de Concreto, ao lado das abas Operacional/Relatórios.",
        "Permissões: as ações \\\"Criar/Editar/Excluir concretagem\\\" agora pertencem ao módulo Controle — Concreto (antes estavam, por engano, dentro de Levantamento — Concreto).",
        "Levantamento de Concreto ficou só com o que é dele: base de peças, calculadora de volumes, importação em lote e configuração de andares."
      ]
    },
    {
      "versao": "V3.26.0.1",
      "data": "2026-08-29",
      "tipo": "melhoria",
      "titulo": "Controle de Concreto V2.0 (parte 1): Planta do Projeto com detecção automática de áreas",
      "itens": [
        "Novo: aba \"Planta\" no Controle de Concreto — importa o PDF/imagem do projeto (mesmo pipeline do Controle de Estacas) e detecta sozinho, por geometria, cada área colorida da planta (pilar/viga/laje) como um polígono já pronto pra clicar.",
        "A detecção NÃO reconhece qual peça é (o rótulo no PDF, tipo \"P25\" ou \"V308\", é desenho vetorial, não texto — não dá pra ler direto). Ela só isola ONDE cada peça está: segmentação por cor com erosão e crescimento de região, pra separar peças vizinhas que compartilham a mesma cor de nível.",
        "Clicando numa área detectada: seletor de Tipo (Pilar/Viga/Laje/...) e busca por nome, filtrando as peças já cadastradas no Levantamento — por padrão só do andar da prancha ativa, com opção de ver todos os andares.",
        "Áreas que a detecção não pegou bem: \"Desenhar Área Manual\" (clique a clique, igual Controle de Estacas) ou \"Ajustar forma\" pra arrastar os vértices de uma área já detectada.",
        "Gestão de pranchas: 1 prancha por laje/pavimento, com botão de atualizar o projeto se a planta mudar.",
        "Base pro que vem a seguir: montar Concretagem inteira desenhando livremente sobre a planta (com múltiplas áreas soltas), e \"Controlar pelo Projeto\" no lançamento de BT — ainda não iniciado."
      ]
    },
    {
      "versao": "V3.26.0.2",
      "data": "2026-08-29",
      "tipo": "melhoria",
      "titulo": "Controle de Concreto V2.0 (parte 2): montar Concretagem e BT desenhando na planta",
      "itens": [
        "Novo botão \"◈ Montar Concretagem\" na aba Planta: desenha-se livremente uma ou mais áreas soltas por cima da planta (não precisa ser uma região só) e o sistema monta a Concretagem sozinho — cruza o desenho com cada peça já vinculada e calcula o % de cada uma por sobreposição de área, sem precisar digitar peça por peça.",
        "Novo botão \"🗺️ Controlar pelo Projeto\" dentro do Lançar BT (aparece assim que a concretagem é escolhida): mesmo princípio, no nível da BT — desenha a área que aquela BT cobriu e o sistema preenche sozinho a peça e o % de cada uma no formulário de lançamento, que continua editável antes de salvar.",
        "Cálculo por amostragem geométrica (não é clipping exato de polígono) — funciona igual pra área desenhada certinha ou por cima de forma irregular à mão. Sobreposição abaixo de 2% é ignorada (ruído de traço).",
        "Fluxo manual de sempre (montar concretagem peça por peça no wizard, digitar % na BT) continua funcionando exatamente igual — isto é um caminho A MAIS, não substitui nada.",
        "V2.0 completo: os dois pedidos originais (reconhecimento automático de área na planta + montagem de concretagem/BT desenhando) estão nesta versão e na V3.26.0.1."
      ]
    },
    {
      "versao": "V3.26.0.3",
      "data": "2026-08-29",
      "tipo": "melhoria",
      "titulo": "Concretagem agora se vincula a uma Prancha + atalho \"Controlar pelo Projeto\" ao lado de Lançar BT",
      "itens": [
        "Toda Concretagem agora tem uma Prancha associada (campo novo no Passo 1 do wizard \"◈ Concretagens\"). Montada pela Planta (desenho livre): a prancha usada no desenho é gravada automaticamente. Montada manualmente: escolhe-se na tela de Dados.",
        "\"Controlar pelo Projeto\" ganhou atalho direto: novo botão roxo ao lado de \"⊕ LANÇAR BT\" — escolhe Concretagem e BT normalmente e cai direto na tela de desenho (antes só aparecia depois de entrar no formulário manual).",
        "Como a Concretagem já sabe qual é sua Prancha, o \"Controlar pelo Projeto\" abre direto nela — não depende mais de já existir peça marcada pra descobrir qual planta mostrar."
      ]
    }
  ],

  render(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    const TIPOS = {
      lancamento:     { icon:'🚀', label:'Lançamento',     cor:'#F5C800' },
      funcionalidade: { icon:'✨', label:'Funcionalidade', cor:'#4caf7d' },
      correcao:       { icon:'🔧', label:'Correção',       cor:'#e0703c' },
      melhoria:       { icon:'📈', label:'Melhoria',       cor:'#5b8dd9' }
    };
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const vs = this.versoes.slice().reverse();
    const total = vs.length;
    const nFeat = vs.filter(v=>v.tipo==='funcionalidade'||v.tipo==='lancamento').length;
    const nCorr = vs.filter(v=>v.tipo==='correcao').length;
    const nMel  = vs.filter(v=>v.tipo==='melhoria').length;
    const datas = [...new Set(vs.map(v=>v.data))].sort();
    const diasTrab = datas.length;
    const diasTot = Math.floor((Date.now() - new Date(datas[0]+'T12:00:00')) / 864e5) + 1;

    c.innerHTML = `
      <div class="nv-hero" style="background:linear-gradient(135deg,#141414 0%,#232323 60%,#2e2a12 100%);border-radius:14px;padding:26px 28px;margin-bottom:18px;position:relative;overflow:hidden;">
        <div style="position:absolute;right:-30px;top:-30px;width:180px;height:180px;border-radius:50%;background:rgba(245,200,0,.08);"></div>
        <div style="position:absolute;right:60px;bottom:-50px;width:120px;height:120px;border-radius:50%;background:rgba(245,200,0,.05);"></div>
        <div style="display:flex;align-items:flex-end;gap:18px;flex-wrap:wrap;position:relative;">
          <div style="flex:1;min-width:220px;">
            <div style="color:#999;font-size:.75rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Notas de Versão</div>
            <div style="color:#fff;font-size:2.2rem;font-weight:900;line-height:1.1;margin-top:4px;">${this.versaoAtual}
              <span style="font-size:.95rem;font-weight:700;color:var(--cor-primaria);">(${total} versões lançadas)</span>
            </div>
            <div style="color:#aaa;font-size:.8rem;margin-top:6px;">Formato <b style="color:#ddd;">A.B.C.D</b> — Sistema · Feature · Correção · Sub-feature</div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            ${[['📦',total,'versões'],['✨',nFeat,'features'],['🔧',nCorr,'correções'],['📈',nMel,'melhorias'],['📅',diasTot,'dias de projeto'],['🔨',diasTrab,'dias c/ entrega']].map(([i,n,l])=>`
              <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px 16px;text-align:center;min-width:82px;">
                <div style="font-size:1.05rem;">${i}</div>
                <div style="color:#fff;font-weight:900;font-size:1.25rem;line-height:1;">${n}</div>
                <div style="color:#999;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-top:3px;">${l}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>

      

      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
        <input id="nvBusca" type="text" placeholder="🔍 Buscar versão, título ou item..." style="flex:1;min-width:220px;padding:9px 14px;border:1.5px solid var(--cor-borda-light);border-radius:100px;font-size:.85rem;outline:none;" />
        <div id="nvFiltros" style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="nv-f ativo" data-t="todos" style="padding:7px 14px;border-radius:100px;border:1.5px solid #222;background:#222;color:#fff;font-size:.75rem;font-weight:700;cursor:pointer;">Todos</button>
          ${Object.entries(TIPOS).map(([k,t])=>`
            <button class="nv-f" data-t="${k}" style="padding:7px 14px;border-radius:100px;border:1.5px solid var(--cor-borda-light);background:#fff;color:#555;font-size:.75rem;font-weight:700;cursor:pointer;">${t.icon} ${t.label}</button>`).join('')}
        </div>
      </div>

      <div id="nvLista" style="display:flex;flex-direction:column;gap:0;position:relative;">
        <div style="position:absolute;left:19px;top:10px;bottom:10px;width:2px;background:var(--cor-borda-light);"></div>
        ${vs.map((v,i) => {
          const t = TIPOS[v.tipo]||{icon:'📌',label:v.tipo,cor:'#888'};
          const aberta = i===0; // mais recente = Atual
          const hay = esc((v.versao+' '+(v.legado||'')+' '+v.titulo+' '+v.itens.join(' ')).toLowerCase());
          return `
          <div class="nv-card" data-t="${v.tipo}" data-aberta="${aberta?1:0}" data-hay="${hay}" style="display:flex;gap:14px;position:relative;padding:6px 0;">
            <div style="width:40px;flex-shrink:0;display:flex;justify-content:center;">
              <div style="width:34px;height:34px;border-radius:50%;background:${aberta?'var(--cor-primaria)':'#fff'};border:2px solid ${aberta?'var(--cor-primaria)':t.cor};display:flex;align-items:center;justify-content:center;font-size:.95rem;z-index:1;margin-top:8px;">${t.icon}</div>
            </div>
            <div style="flex:1;background:#fff;border:1.5px solid ${aberta?'var(--cor-primaria)':'var(--cor-borda-light)'};border-radius:12px;overflow:hidden;margin-bottom:10px;${aberta?'box-shadow:0 3px 14px rgba(245,200,0,.25);':''}">
              <div class="nv-head" style="padding:12px 18px;display:flex;align-items:center;gap:12px;cursor:pointer;user-select:none;${aberta?'background:linear-gradient(90deg,rgba(245,200,0,.12),transparent);':''}">
                <div style="flex:1;min-width:0;">
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <span style="font-weight:900;font-size:.95rem;color:var(--cor-texto);">${v.versao}</span>
                    ${v.legado&&v.legado!==v.versao?`<span style="font-size:.65rem;color:#999;background:#f4f4f4;border-radius:100px;padding:2px 8px;font-weight:700;" title="Numeração antiga">antes: ${v.legado}</span>`:''}
                    <span style="font-size:.65rem;font-weight:800;color:#fff;background:${t.cor};border-radius:100px;padding:2px 9px;">${t.label}</span>
                    ${aberta?'<span style="font-size:.65rem;font-weight:800;color:#000;background:var(--cor-primaria);border-radius:100px;padding:2px 9px;">● Atual</span>':''}
                  </div>
                  <div style="font-size:.85rem;font-weight:600;color:var(--cor-texto);margin-top:4px;line-height:1.35;">${esc(v.titulo)}</div>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                  <div style="font-size:.7rem;color:#999;font-weight:700;">${new Date(v.data+'T12:00:00').toLocaleDateString('pt-BR')}</div>
                  <div class="nv-seta" style="font-size:.8rem;color:#bbb;margin-top:4px;transition:transform .2s;${i===0?'transform:rotate(180deg);':''}">▼</div>
                </div>
              </div>
              <div class="nv-body" style="display:${i===0?'block':'none'};border-top:1px solid var(--cor-borda-light);">
                <ul style="list-style:none;padding:13px 20px;display:flex;flex-direction:column;gap:6px;margin:0;">
                  ${v.itens.map(item => {
                    const sub = item.startsWith('  →');
                    const text = item.replace(/^  →\s*/,'');
                    return `<li style="display:flex;gap:8px;font-size:${sub?'.78':'.85'}rem;color:${sub?'#888':'var(--cor-texto)'};padding-left:${sub?16:0}px;line-height:1.5;">
                      <span style="margin-top:2px;color:${sub?'#ccc':t.cor};font-size:.7rem;flex-shrink:0;">${sub?'↳':'▸'}</span><span>${esc(text)}</span></li>`;
                  }).join('')}
                </ul>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div id="nvVazio" style="display:none;text-align:center;padding:50px 0;color:#999;font-size:.9rem;">Nenhuma versão encontrada 🔍</div>`;

    // interações
        c.querySelectorAll('.nv-head').forEach(h => h.addEventListener('click', () => {
      const body = h.parentElement.querySelector('.nv-body');
      const seta = h.querySelector('.nv-seta');
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      seta.style.transform = open ? '' : 'rotate(180deg)';
    }));
    const busca = c.querySelector('#nvBusca');
    let filtroTipo = 'todos';
    const aplicar = () => {
      const q = (busca.value||'').toLowerCase().trim();
      let visiveis = 0;
      c.querySelectorAll('.nv-card').forEach(card => {
        const okT = filtroTipo==='todos' || card.dataset.t===filtroTipo;
        const okQ = !q || card.dataset.hay.includes(q);
        const show = okT && okQ;
        card.style.display = show ? 'flex' : 'none';
        if (show) visiveis++;
      });
      c.querySelector('#nvVazio').style.display = visiveis ? 'none' : 'block';
    };
    busca.addEventListener('input', aplicar);
    c.querySelectorAll('.nv-f').forEach(b => b.addEventListener('click', () => {
      filtroTipo = b.dataset.t;
      c.querySelectorAll('.nv-f').forEach(x => {
        const on = x===b;
        x.style.background = on ? '#222' : '#fff';
        x.style.color = on ? '#fff' : '#555';
        x.style.borderColor = on ? '#222' : 'var(--cor-borda-light)';
      });
      aplicar();
    }));
  }
};
