// ============================================
// Planejamento V2.0
// Todas as features solicitadas implementadas
// ============================================
const Planejamento = (() => {
  let obraId=null, tarefas=[], filtradas=[];
  let zoomGantt='mes', editandoId=null, selectedIdx=-1;
  // Versão de datas visualizada/editada: 'atual'|'base'|'desafio'.
  // Atual = inicioPlanejado/terminoPlanejado (o cronograma de trabalho).
  // Base = inicioPlanejadoBase/terminoPlanejadoBase (Linha de Base — imutável por design).
  // Desafio = inicioDesafio/terminoDesafio (meta otimista).
  // Editar em qualquer versão só grava nos campos DAQUELA versão — nunca mistura.
  // _versaoData controla qual versão de datas é exibida nas colunas Início/Término:
  // 'atual' = inicioPlanejado/terminoPlanejado (padrão — o que todo mundo usa)
  // 'base'  = inicioPlanejadoBase/terminoPlanejadoBase
  // 'desafio' = inicioDesafio/terminoDesafio
  // IMPORTANTE: se o valor salvo não for reconhecido, volta para 'atual'
  let _versaoData=(()=>{
    try{const v=localStorage.getItem('planej_versaoData');return ['atual','base','desafio'].includes(v)?v:'atual';}
    catch(e){return 'atual';}
  })();
  const VERSAO_CAMPOS={atual:{ini:'inicioPlanejado',fim:'terminoPlanejado'},
    base:{ini:'inicioPlanejadoBase',fim:'terminoPlanejadoBase'},
    desafio:{ini:'inicioDesafio',fim:'terminoDesafio'}};
  const VERSAO_LABEL={atual:'Atual',base:'Linha de Base',desafio:'Desafio'};
  // Datas na versão ATUALMENTE selecionada (_versaoData) — usar SEMPRE que for
  // posicionar algo no Gantt (barra, seta de predecessora, limites de zoom).
  // Antes o Gantt ficava hardcoded em inicioPlanejado/terminoPlanejado (só a
  // versão "Atual") mesmo quando a tabela estava mostrando Base ou Desafio —
  // a barra aparecia numa data diferente da que a própria linha exibia.
  const _vIni=t=>t[VERSAO_CAMPOS[_versaoData].ini];
  const _vFim=t=>t[VERSAO_CAMPOS[_versaoData].fim];
  // Início Real / Término Real são preenchidos normalmente por Diário de
  // Obra/Medições/Semanal — travados aqui por padrão pra não editar por
  // engano. Liberar aqui é só pra correção em massa pontual (ex: atualizar
  // a base sem gerar lançamento/relatório).
  let _liberarEdicaoReal=false;
  // ===== M1: Estrutura da Obra (Torre>Pavimento>Apto) + Vínculo por tarefa =====
  // Independente de pisoArvore/tetoArvore/paredesArvore (que servem só os
  // módulos de levantamento correspondentes) — não migra nem toca lá.
  let _estruturaObraCache=null;
  function setVersaoData(v){
    if(!VERSAO_CAMPOS[v])return;
    _versaoData=v;
    try{localStorage.setItem('planej_versaoData',v);}catch(e){}
    _render();
  }
  let splitX=440, ganttVisible=true;
  let _dragTaskId=null, _dropTargetId=null, _dropPos='before';
  let colsRecolhidas=new Set();
  const COL='tarefas';
  const ROW_H=30;
  let _rafId=null;
  let _editandoCelula=false; // true enquanto há um input aberto em uma célula

  // Seleção múltipla (checkbox) e filtro por status
  let selecionados=new Set();
  let statusFiltro=new Set(); // vazio = mostra tudo
  // M4: filtro por responsável — cache de sessão (localStorage), não é dado
  // de negócio, não vai pro Firestore. Combina com os demais filtros (AND).
  let _filtroResponsavel=(()=>{try{return localStorage.getItem('planej_filtroResponsavel')||'';}catch(e){return'';}})();
  // Visão Organizacional: máscara de linhas — quando ativa, a grid+Gantt
  // mostram SÓ as tarefas escolhidas (mesma tela, mesmo comportamento, só
  // filtrado). null = desligada. Persistida por obra (cache de sessão de UI).
  let _visaoOrgIds=null;
  let _visaoOrgAncOk=false; // ancestrais já incluídos na máscara?
  // Setas de predecessora no Gantt (estilo MS Project) — liga/desliga.
  let _setasPred=(()=>{try{return localStorage.getItem('planej_setasPred')==='1';}catch(e){return false;}})();
  let _setaSelecionada=null; // chave "predId>tarefaId" da seta clicada (fica marcada)
  // Busca de tarefa no Gantt
  let _buscaTexto='', _buscaResultados=[], _buscaCursor=-1;
  // Undo stack: últimas 30 snapshots do array tarefas (cópia plana antes de cada ação)
  const _undoStack=[];
  function _undoPush(){
    _undoStack.push(tarefas.map(t=>({...t})));
    if(_undoStack.length>30)_undoStack.shift();
  }
  let _undoEmAndamento=false;
  async function undo(){
    if(!_undoStack.length){Utils.toast('Nada para desfazer.','alerta');return;}
    // Trava contra Ctrl+Z repetido enquanto o anterior ainda está gravando —
    // sem isso, dois undos rodando ao mesmo tempo escrevem por cima um do
    // outro e misturam dois estados diferentes (bug real encontrado).
    if(_undoEmAndamento){Utils.toast('Aguarde o desfazer anterior terminar...','alerta');return;}
    _undoEmAndamento=true;
    try{
      const snap=_undoStack.pop();
      const antes=new Map(tarefas.map(t=>[t.id,t]));
      tarefas=snap;
      _buildFiltradas();_render();requestAnimationFrame(()=>_paintRows());
      Utils.toast('Ação desfeita.','sucesso');
      // Só grava tarefas cujo estado realmente difere do snapshot restaurado —
      // e em lote com timeout, não uma por uma sem fim (podia travar no meio
      // e deixar o resto sem restaurar de verdade).
      const CAMPOS=['nome','codigo','nivel','ordem','inicioPlanejado','terminoPlanejado','duracao',
        'percentualEsperado','percentualConcluido','predecessora','responsavel','local','grupo','frenteServico'];
      const mudou=[];
      for(const t of snap){
        const ant=antes.get(t.id);
        const upd={};
        for(const c of CAMPOS){if((ant?.[c]??'')!==(t[c]??''))upd[c]=t[c]??'';}
        if(Object.keys(upd).length)mudou.push({id:t.id,...upd});
      }
      const L=20,TIMEOUT_MS=15000;
      const comTimeout=p=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),TIMEOUT_MS))]);
      let falhas=0;
      for(let i=0;i<mudou.length;i+=L){
        await Promise.all(mudou.slice(i,i+L).map(({id,...upd})=>
          comTimeout(Database.atualizar(obraId,COL,id,upd)).catch(e=>{falhas++;console.error('Erro desfazer:',id,e);})
        ));
      }
      if(falhas)Utils.toast(`⚠ ${mudou.length-falhas} de ${mudou.length} restauradas — ${falhas} falharam, tente Ctrl+Z de novo.`,'alerta');
    } finally{_undoEmAndamento=false;}
  }

  // Colunas: ordem editável, largura editável
  let colOrdem=['sel','num','status','nivel','codigo','nome','inicio','termino','inicioReal','terminoReal','duracao','percEsp','percConc','predecessora','sucessora','responsavel','local','vinculoEstrutura','grupo','subgrupo','frente','categoria','subcategoria','quantidade','equipe','custoMaterial','custoMaoObra','acoes'];
  let colLarguras={sel:28,num:36,status:34,nivel:42,codigo:70,nome:250,inicio:88,termino:88,duracao:60,percEsp:72,percConc:78,predecessora:80,responsavel:100,local:80,grupo:80,frente:100,quantidade:110,equipe:60,custoMaterial:100,custoMaoObra:100,acoes:64};
  let colsHidden=new Set();

  // Frente de Serviço: disciplina/equipe responsável pela tarefa (Hidráulica,
  // Elétrica, Estrutura...) — não confundir com a coluna "Equipe" (nº de
  // pessoas alocadas, usada no módulo Produção). Lista fixa em Utils.
  const FRENTES=Utils.FRENTES_SERVICO;

  const COL_LABELS={sel:'',num:'#',status:'',nivel:'Nível',codigo:'Código',nome:'Tarefa',inicio:'Início',termino:'Término',inicioReal:'Início Real',terminoReal:'Término Real',duracao:'Duração',percEsp:'% Esperado',percConc:'% Concluído',predecessora:'Predecessora',sucessora:'Sucessora',responsavel:'Responsável',local:'Local',vinculoEstrutura:'Local (Pav/Apto)',grupo:'Grupo',subgrupo:'Subgrupo',frente:'Frente',categoria:'Categoria',subcategoria:'Subcategoria',quantidade:'Quantidade',equipe:'Nº Equipe',custoMaterial:'Custo Material',custoMaoObra:'Custo M.Obra',acoes:''};
  const COL_FIXED=new Set(['sel','num','status','nome','acoes']);
  const COL_EDITABLE=new Set(['codigo','nome','inicio','termino','duracao','percConc','predecessora','responsavel','local','grupo','frente','nivel','equipe','inicioReal','terminoReal']); // percEsp saiu: agora é calculado ao vivo pela data (não editável)

  // ===================== VÍNCULOS COM LEVANTAMENTO =====================
  // Tela separada (não é a visão de Gantt) onde cada tarefa do Planejamento
  // pode ter sua quantidade vinda de um Levantamento (em vez de manual) —
  // assim, várias tarefas (ex: chapisco, reboco, limpeza de fachada) usam
  // o MESMO m² real, e o custo (Material/Mão de Obra) que já lê a
  // quantidade da tarefa funciona automaticamente, sem precisar vincular
  // Materiais/Mão de Obra direto ao levantamento.
  let modoView='gantt'; // 'gantt' | 'vinculos' | 'arvore' | 'categoria'
  let levFachadas=[];
  let _vincAlvoId=null, _vincModulo='fachada', _vincMetrica='m2semML';
  // _vincNodeId: nó selecionado na árvore do levantamento (para piso/teto/paredes/etc.)
  // Substitui os antigos _vincFachadaId/_vincBalancimId/_vincVistaId para módulos com árvore.
  let _vincNodeId=null;

  // Flatten da árvore hierárquica [{id,nome,filhos:[...]}] para lista plana com nível
  function _flattenArvore(nodes,nivel=0,out=[]){
    for(const n of (nodes||[])){
      out.push({id:n.id,nome:n.nome,nivel,temFilhos:!!(n.filhos&&n.filhos.length)});
      _flattenArvore(n.filhos||[],nivel+1,out);
    }
    return out;
  }

  // Todos os IDs de um nó e seus descendentes (para filtrar áreas por "toda essa sub-árvore")
  function _idsDescendentes(nodes,rootId){
    const result=[];
    function buscar(ns){
      for(const n of (ns||[])){
        if(n.id===rootId||result.includes(n.id)){result.push(n.id);buscar(n.filhos||[]);}
        else buscar(n.filhos||[]);
      }
    }
    // Primeiro encontra o root, depois coleta tudo abaixo
    function coletarAPartirDe(ns,encontrado=false){
      for(const n of (ns||[])){
        if(n.id===rootId||encontrado){
          result.push(n.id);
          _coletarTodos(n.filhos||[],result);
          if(!encontrado)return true;
        } else {
          if(coletarAPartirDe(n.filhos||[],false))return true;
        }
      }
      return false;
    }
    function _coletarTodos(ns,out){for(const n of (ns||[])){out.push(n.id);_coletarTodos(n.filhos||[],out);}}
    coletarAPartirDe(nodes);
    return result;
  }

  // Caminho (breadcrumb) da raiz até o nó targetId: [{id,nome},...]. null se não achar.
  // Usado pro rótulo "Torre A › Pav 3 › Apto 301 › Sala" e pra auto-expandir a
  // árvore até o nó já selecionado quando o modal de vínculo é reaberto.
  function _caminhoNode(nodes,targetId,caminho=[]){
    for(const n of (nodes||[])){
      const novo=[...caminho,{id:n.id,nome:n.nome}];
      if(n.id===targetId)return novo;
      if(n.filhos&&n.filhos.length){
        const r=_caminhoNode(n.filhos,targetId,novo);
        if(r)return r;
      }
    }
    return null;
  }
  // selecionado = soma todos os balancins da fachada escolhida).
  let _vincFachadaId=null, _vincBalancimId=null, _vincVistaId=null;
  // Navegação em pastas da tela principal de Vínculos: Módulo > Métrica > Local > Local...
  // _vincNavPath é uma lista de {id,nome} — o último item é onde o usuário está agora.
  let _vincNavModulo=null, _vincNavMetrica=null, _vincNavPath=[];
  // Tipo de vínculo: mesma tarefa pode precisar de quantidades DIFERENTES pra Mão
  // de Obra e pra Materiais (ex: Chapisco pode ser pago por m² aplicado na mão de
  // obra mas o material calculado por outro critério). 'geral' = campos antigos
  // (quantidade/unidade/levantamento*), compatível com tudo que já existia.
  let _vincTipo='geral'; // 'geral' | 'maoObra' | 'material'
  let _vincEscolhaBusca=''; // filtro ao escolher a tarefa "pai" dentro do modal
  let _vincIncluidos=new Set(); // ids marcados p/ incluir no vínculo (dentro do modal)
  let _vincFatores={}; // id -> fração em texto ("1", "1/8", "0.5"...)
  const LEVANTAMENTO_MODULOS={
    // configDoc: documento em obras/{id}/config/{configDoc} que guarda a árvore hierárquica
    // A árvore tem formato [{id,nome,filhos:[...]}] — cada área/peça tem nodeId apontando pro nó
    fachada:{
      label:'Fachadas', colecao:'levantamentosFachada',
      // Fachada usa tipos em vez de árvore config: tipo='fachada'|'balancim'|'vista'|'peca'
      usaTipos:true,
      metricas:[
        {id:'m2semML',        label:'m² líquido (sem ML)', unidade:'m²'},
        {id:'m2comML_equiv',  label:'m² + ML equivalente', unidade:'m²'},
        {id:'ml',             label:'Metro Linear (ML)',   unidade:'ml'},
        {id:'vao',            label:'Vão Fechado (m²)',    unidade:'m²'},
      ],
    },
    piso:{
      label:'Pisos', colecao:'pisoAreas',
      configDoc:'pisoArvore',
      // Área de piso e Rodapé são as duas faces do mesmo revestimento de piso —
      // agrupadas sob "Revestimento" em vez de aparecerem soltas.
      cardsPorMetrica:true,
      metricas:[
        {id:'areaContrapiso', label:'Contrapiso',                     unidade:'m²'},
        {id:'areaImperm',     label:'Impermeabilização',              unidade:'m²'},
        {id:'areaM2',         label:'Revestimento',                   unidade:'m²'},
        {id:'mlRodape',       label:'Revestimento — Rodapé',          unidade:'ml'},
      ],
    },
    paredes:{
      label:'Paredes', colecao:'paredesAlvenariaPecas',
      colecaoExtra:'paredesAcabamentoPecas',
      configDoc:'paredesArvore',
      // Cada tipo é fisicamente diferente (alvenaria x acabamento) — mostra um
      // card por tipo direto na tela inicial de Vínculos, em vez de agrupar tudo
      // sob "Paredes" e obrigar a passar por uma tela extra de métrica.
      cardsPorMetrica:true,
      metricas:[
        {id:'vedacao',        label:'Alvenaria de Vedação', unidade:'m²'},
        {id:'estrutural',     label:'Alvenaria Estrutural', unidade:'m²'},
        {id:'gesso',          label:'Gesso Liso',           unidade:'m²'},
        {id:'reboco',         label:'Reboco',               unidade:'m²'},
        {id:'revestimento',   label:'Revestimento de Parede',unidade:'m²'},
        {id:'pinturaParede',  label:'Pintura de Parede',    unidade:'m²'},
      ],
    },
    teto:{
      label:'Teto / Forro (Drywall, Gesso, Tabica)', colecao:'tetoAreas',
      configDoc:'tetoArvore',
      metricas:[
        {id:'areaM2',         label:'Área total de teto (m²)',   unidade:'m²'},
        {id:'areaDrywall',    label:'Forro de Drywall (m²)',     unidade:'m²'},
        {id:'areaGesso',      label:'Placa de Gesso (m²)',       unidade:'m²'},
        {id:'mlTabica',       label:'Tabica (ML)',               unidade:'ml'},
        {id:'pinturaTeto',    label:'Pintura de Teto',            unidade:'m²'},
      ],
    },
    concreto:{
      label:'Concreto', colecao:'concretoPecas', colecaoExtra:'concretoConcretagens',
      // Sem árvore configDoc real — a "árvore" é montada em memória a partir dos
      // próprios dados (andar/tipo de cada peça + concretagens cadastradas). Ver
      // _buildArvoreConcreto. arvoreVirtual avisa o resto do código pra tratar
      // igual a um módulo com configDoc (mesma navegação em pastas / filtro por nó).
      arvoreVirtual:true,
      metricas:[
        {id:'volume',         label:'Volume total (m³)', unidade:'m³'},
      ],
    },
    terraplanagem:{
      label:'Terraplanagem', colecao:null,
      // Sem coleção de peças e sem local — é 1 volume calculado pra obra inteira
      // (método das seções transversais). Carregado à parte em _carregarLevSeNecessario.
      metricas:[
        {id:'volumeBanco',    label:'Volume de Corte (banco)',       unidade:'m³'},
        {id:'volumeEmpolado', label:'Volume Solto (empolado/transportado)', unidade:'m³'},
      ],
    },
    soloGrampeado:{
      label:'Solo Grampeado', colecao:'sgChumbadores', colecaoExtra:'sgVistas',
      metricas:[
        {id:'ml',  label:'Metro Linear de Chumbadores', unidade:'ml'},
        {id:'qtd', label:'Quantidade de Chumbadores',    unidade:'un'},
        {id:'m2',  label:'Área de Solo Grampeado',       unidade:'m²'},
      ],
    },
    arCondicionado:{
      label:'Ar-Condicionado', colecao:'levantamentoAr',
      metricas:[
        {id:'qtdEquipamentos',label:'Qtd de equipamentos', unidade:'un'},
        {id:'btus',           label:'BTUs total',          unidade:'BTU'},
      ],
    },
    // Pintura não é mais um módulo à parte — "Pintura de Parede" mora dentro de
    // Paredes e "Pintura de Teto" mora dentro de Teto, porque é isso que ela
    // fisicamente é. Ter um módulo "Pintura" isolado misturava as duas coisas.
  };

  // Metadados de status: cor + rótulo, usado no badge da coluna e no filtro
  const STATUS_INFO={
    atrasado:    {cor:'#ef4444', label:'Atrasado'},
    alerta:      {cor:'#fb923c', label:'Alerta'},
    em_andamento:{cor:'#facc15', label:'Em Andamento'},
    em_dia:      {cor:'#60a5fa', label:'Em Dia'},
    concluido:   {cor:'#4ade80', label:'Concluído'},
  };

  // Custo Material / Custo Mão de Obra por tarefa (calculado a partir dos
  // vínculos de Materiais e Mão de Obra, com distribuição hierárquica —
  // ver _calcularCustos). Preenchido em carregar(), lido em _paintRows.
  let custoMaterialPorTarefa=new Map();
  let custoMaoObraPorTarefa=new Map();

  async function init(){
    const ok=await Utils.initPagina({requireObra:true});if(!ok)return;
    obraId=Router.getObraId();
    if(!obraId){_el().innerHTML='<div class="estado-vazio"><div class="icone">📅</div><p>Selecione uma obra.</p></div>';return;}
    document.addEventListener('keydown',_onKey);
    _visaoOrgCarregarSalva(); // restaura a máscara da Visão Organizacional salva pra esta obra
    _carregarEstruturaObra().then(()=>_paintRows()); // segundo plano — atualiza resumos quando chegar
    await carregar();
  }
  function _el(){return document.getElementById('planejamento-content')||document.body;}

  async function carregar(){
    try{
      Utils.mostrarLoading('Carregando...');
      // Tarefas vinculadas a uma peça/concretagem de Estacas e Fundações têm
      // seu % recalculado a partir da execução real ANTES de carregar —
      // mesma função usada pelo Controle de Estacas ao marcar um real.
      if(typeof EstacasCalculos!=='undefined'){
        await EstacasCalculos.sincronizarVinculosPlanejamento(obraId).catch(e=>console.error('Sync vínculos Estacas:',e));
      }
      const [tf,materiaisBib,materiaisVinc,maoDeObraVinc]=await Promise.all([
        Database.listar(obraId,COL,'ordem').catch(()=>[]),
        Database.listar(obraId,'materiais','nome').catch(()=>[]),
        Database.listar(obraId,'materiais_vinculos','createdAt').catch(()=>[]),
        Database.listar(obraId,'maoDeObra_vinculos','createdAt').catch(()=>[]),
      ]);
      tarefas=tf;
      _calcularCustos(materiaisBib,materiaisVinc,maoDeObraVinc);
      _buildFiltradas();
      _render();
      _migrarPredecessorasParaId(true); // segundo plano — auto-cura predecessoras antigas, se houver
    }catch(e){console.error(e);Utils.toast('Erro.','erro');}
    finally{Utils.esconderLoading();}
  }

  // ===================== CUSTOS (Material / Mão de Obra) =====================
  // Regra de distribuição hierárquica pedida por Milton:
  // - O custo direto vinculado a uma tarefa de nível N é dividido IGUALMENTE
  //   entre os filhos diretos dessa tarefa (nível N+1), que por sua vez
  //   redistribuem à própria vez para os seus filhos, e assim por diante.
  // - Ao final, o custo EXIBIDO em qualquer tarefa = soma do custo de
  //   todos os níveis abaixo dela (uma folha mostra o que recebeu por
  //   herança + o que foi vinculado direto a ela; um pai mostra a soma
  //   de tudo que está por baixo).
  function _calcularCustos(materiaisBib,materiaisVinc,maoDeObraVinc){
    custoMaterialPorTarefa=new Map();
    custoMaoObraPorTarefa=new Map();
    if(!tarefas.length)return;

    // ---- 1. Custo DIRETO por tarefa (o que foi vinculado especificamente a ela) ----
    // Um vínculo pode estar ligado a mais de uma tarefa (tarefaIds); docs
    // antigos têm apenas tarefaId (singular) — suporta os dois formatos.
    // Cada tarefa recebe valor×sua própria quantidade (não dividido entre elas).
    const diretoMaterial=new Map();
    const bibPorId=new Map(materiaisBib.map(m=>[m.id,m]));
    for(const v of materiaisVinc){
      const ids=v.tarefaIds||(v.tarefaId?[v.tarefaId]:[]);
      for(const tarefaId of ids){
        if(!tarefaId||tarefaId==='__fachada__')continue; // não pertence à árvore do Planejamento
        const t=tarefas.find(x=>x.id===tarefaId);
        const mat=bibPorId.get(v.materialId);
        if(!t||!mat||!mat.preco)continue;
        const cons=parseFloat(v.consumoPrevisto)||0;
        const qtdBase=(t.quantidade||0)*cons;
        const custo=qtdBase*parseFloat(mat.preco);
        diretoMaterial.set(tarefaId,(diretoMaterial.get(tarefaId)||0)+custo);
      }
    }

    const diretoMaoObra=new Map();
    for(const v of maoDeObraVinc){
      const ids=v.tarefaIds||(v.tarefaId?[v.tarefaId]:[]);
      for(const tarefaId of ids){
        if(!tarefaId)continue;
        const t=tarefas.find(x=>x.id===tarefaId);
        if(!t)continue;
        const valor=parseFloat(v.valor)||0;
        const custo=t.quantidade?valor*t.quantidade:valor;
        diretoMaoObra.set(tarefaId,(diretoMaoObra.get(tarefaId)||0)+custo);
      }
    }

    custoMaterialPorTarefa=_distribuirEAgregar(diretoMaterial);
    custoMaoObraPorTarefa=_distribuirEAgregar(diretoMaoObra);
  }

  // Recebe Map(tarefaId -> custo direto) e devolve Map(tarefaId -> custo
  // exibido), aplicando a distribuição igualitária pai→filhos e depois a
  // soma filhos→pai, usando a mesma ordem/nível já usado no resto do módulo.
  function _distribuirEAgregar(diretoPorId){
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));

    // Monta lista de filhos diretos de cada tarefa (próximas na ordem com
    // nível = nivel+1, até achar uma de nível <= o da tarefa atual) —
    // mesma convenção usada em recuarNivel/avancarNivel e _buildFiltradas.
    const filhosDe=new Map();
    for(let i=0;i<sorted.length;i++){
      const t=sorted[i], niv=t.nivel||0, filhos=[];
      for(let j=i+1;j<sorted.length;j++){
        const s=sorted[j];
        if((s.nivel||0)>niv){ if((s.nivel||0)===niv+1) filhos.push(s); }
        else break;
      }
      filhosDe.set(t.id,filhos);
    }

    // Passo 1 (topo→baixo): distribui direto+herdado igualmente entre filhos
    const herdado=new Map();
    const custoProprioFinal=new Map(); // só preenchido para folhas
    for(const t of sorted){
      const proprio=(diretoPorId.get(t.id)||0)+(herdado.get(t.id)||0);
      const filhos=filhosDe.get(t.id)||[];
      if(filhos.length){
        const parte=proprio/filhos.length;
        for(const f of filhos) herdado.set(f.id,(herdado.get(f.id)||0)+parte);
      } else {
        custoProprioFinal.set(t.id,proprio);
      }
    }

    // Passo 2 (baixo→topo): soma dos filhos vira o valor exibido do pai
    const exibido=new Map();
    for(let i=sorted.length-1;i>=0;i--){
      const t=sorted[i], filhos=filhosDe.get(t.id)||[];
      if(filhos.length){
        let soma=0; for(const f of filhos) soma+=exibido.get(f.id)||0;
        exibido.set(t.id,soma);
      } else {
        exibido.set(t.id,custoProprioFinal.get(t.id)||0);
      }
    }
    return exibido;
  }

  function _onKey(e){
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT')return;
    if((e.ctrlKey||e.metaKey)&&(e.key==='+'||e.key==='=')){e.preventDefault();inserirTarefa();}
    if((e.ctrlKey||e.metaKey)&&e.key==='-'){e.preventDefault();if(selectedIdx>=0&&filtradas[selectedIdx])excluirTarefa(filtradas[selectedIdx].id);}
    if((e.ctrlKey||e.metaKey)&&(e.key==='z'||e.key==='Z')){e.preventDefault();undo();}
  }

  let _numLinhaMap=new Map(); // numLinha -> tarefa, montado em _buildFiltradas(), usado pra tooltip
  let _idParaNumLinha=new Map(); // id -> numLinha, pra exibir predecessora canônica como número
  let _porId=new Map(); // id -> tarefa, lookup rápido

  // ===================== PREDECESSORA POR ID (imune a reordenação) =====================
  // Antes a predecessora era guardada como TEXTO com número de linha (ex: "5TI+3").
  // Qualquer inserção/exclusão/movimentação em QUALQUER lugar da obra desloca esses
  // números, e por mais que a gente remapeasse depois de cada operação, sempre
  // sobrava algum caso não coberto (ordens de execução diferentes, imports, etc) —
  // é fundamentalmente frágil.
  // Agora a predecessora é guardada CANONICAMENTE por ID da tarefa (nunca muda,
  // seja lá o que aconteça com a posição): "idDaTarefa|TIPO|defasagem;outroId|TIPO|defasagem".
  // O número de linha só existe na hora de EXIBIR (convertido ao vivo, sempre
  // correto) e na hora de DIGITAR (convertido pro ID no momento de salvar).
  // Reordenar nunca quebra mais nada — não precisa remapear coisa alguma.
  function _predParse(canon){
    if(!canon)return[];
    return String(canon).split(';').map(p=>p.trim()).filter(Boolean).map(p=>{
      const partes=p.split('|');
      return {id:partes[0]||'',tipo:partes[1]||'TI',lag:partes[2]||''};
    }).filter(x=>x.id);
  }
  function _predFormat(arr){
    return arr.map(x=>`${x.id}|${x.tipo||'TI'}|${x.lag||''}`).join(';');
  }
  // Texto digitado pelo usuário (número de linha, ex: "5TI+3; 12II") -> canônico (ID)
  function _predTextoParaCanon(texto){
    if(!texto)return'';
    const out=[];
    for(const parteRaw of String(texto).split(';')){
      const p=parteRaw.trim();if(!p)continue;
      const m=p.match(/^(\d+)\s*(TI|II|TT|IT)?\s*([+-]?\d+)?\s*d{0,2}$/i);
      if(!m)continue;
      const alvo=_numLinhaMap.get(parseInt(m[1]));
      if(alvo)out.push({id:alvo.id,tipo:(m[2]||'TI').toUpperCase(),lag:m[3]||''});
    }
    return _predFormat(out);
  }
  // Canônico (ID) -> texto de exibição (número de linha atual, sempre correto)
  function _predCanonParaTexto(canon){
    return _predParse(canon).map(x=>{
      const num=_idParaNumLinha.get(x.id);
      if(!num)return null; // tarefa referenciada foi excluída
      return `${num}${x.tipo}${x.lag}`;
    }).filter(Boolean).join('; ');
  }

  // Monta o texto do tooltip: "5: Nome da tarefa\n12TI+3d: Outro nome"
  function _tooltipPred(t){
    const arr=_predParse(t?.predecessora);
    if(!arr.length)return'';
    return arr.map(x=>{
      const alvo=_porId.get(x.id);
      const num=_idParaNumLinha.get(x.id);
      if(!alvo)return `(tarefa excluída)`;
      return `${num||'?'}${x.tipo}${x.lag} — ${alvo.nome||'(sem nome)'}`;
    }).join('\n');
  }
  function _tooltipSuc(numsArr){
    if(!numsArr||!numsArr.length)return'';
    return numsArr.map(n=>{
      const alvo=_numLinhaMap.get(n);
      return alvo?`${n} — ${alvo.nome||'(sem nome)'}`:`${n} — (linha não encontrada)`;
    }).join('\n');
  }

  function _buildFiltradas(){
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    // numLinha é FIXO pela posição na ordem geral (não muda com filtro/recolhimento)
    // É esse número que é exibido na coluna # e usado só na EXIBIÇÃO da predecessora
    sorted.forEach((t,i)=>{t._numLinha=i+1;});
    const porNumLinha=new Map(sorted.map(t=>[t._numLinha,t]));
    _numLinhaMap=porNumLinha; // acessível no render, pra montar tooltip e converter texto digitado
    _idParaNumLinha=new Map(sorted.map(t=>[t.id,t._numLinha]));
    _porId=new Map(sorted.map(t=>[t.id,t]));
    // Sucessoras: campo calculado, o INVERSO da predecessora — quem tem essa
    // tarefa como predecessora. Não é salvo no Firestore, é recalculado toda
    // vez a partir das predecessoras de todo mundo (sempre reflete a realidade,
    // nunca fica desatualizado sozinho). Resolve direto por ID — não depende
    // de número de linha, então nunca quebra com reordenação.
    sorted.forEach(t=>{t._sucessoras=[];t._predDisplay=_predCanonParaTexto(t.predecessora);});
    for(const t of sorted){
      for(const {id} of _predParse(t.predecessora)){
        const pred=_porId.get(id);
        if(pred)pred._sucessoras.push(t._numLinha);
      }
    }
    let result;
    if(!colsRecolhidas.size){result=sorted;}
    else{
      result=[];
      let skipLevel=-1; // se >= 0, pula tudo com nível > skipLevel

      for(const t of sorted){
        const niv=t.nivel||0;
        // Se estamos pulando e este item tem nível > o grupo recolhido, pula
        if(skipLevel>=0){
          if(niv>skipLevel){continue;} // filho do recolhido — esconde
          else skipLevel=-1; // chegou em item do mesmo nível ou acima — para de pular
        }
        result.push(t);
        // Se este item está recolhido, começa a pular filhos
        if(colsRecolhidas.has(t.id)){skipLevel=niv;}
      }
    }
    if(statusFiltro.size){
      result=result.filter(t=>statusFiltro.has(_status(t)));
    }
    if(_filtroResponsavel){
      result=result.filter(t=>(t.responsavel||'').trim()===_filtroResponsavel);
    }
    if(_visaoOrgIds){
      // A máscara SEMPRE inclui os ancestrais das linhas escolhidas — sem
      // isso, recolher um grupo que não estava na máscara escondia os filhos
      // e não sobrava nenhuma linha pra clicar e reabrir ("sumiu tudo").
      // Feito aqui (lazy, uma vez) porque no init a máscara salva é carregada
      // antes das tarefas existirem.
      if(!_visaoOrgAncOk){
        const pilha=[]; // cadeia de ancestrais correntes por nível
        for(const t of sorted){
          const niv=t.nivel||0;
          pilha.length=niv; // corta a pilha pro nível atual
          if(_visaoOrgIds.has(t.id))for(const a of pilha)_visaoOrgIds.add(a);
          pilha[niv]=t.id;
        }
        _visaoOrgAncOk=true;
      }
      result=result.filter(t=>_visaoOrgIds.has(t.id));
    }
    filtradas=result;
  }

  // ===================== RENDER =====================
  function _render(){
    _renderConteudo();
    Permissions.aplicarNaTela();
  }
  function _renderConteudo(){
    if(modoView==='vinculos'){_renderVinculosView();return;}
    if(modoView==='arvore'){_renderArvoreEditor();return;}
    if(modoView==='categoria'){_renderCategoriaView();return;}
    const c=_el();
    const visCols=colOrdem.filter(id=>!colsHidden.has(id));

    c.style.cssText='display:flex;flex-direction:column;min-height:0;height:100%;';
    c.innerHTML=`
      <div style="display:flex;gap:8px;align-items:baseline;margin-bottom:8px;">
        <h2 style="margin:0;font-size:1.1rem;color:var(--cor-primaria);">📊 Planejamento</h2>
        <span style="font-size:.75rem;color:#555;">${filtradas.length} tarefas</span>
      </div>
      <!-- Toolbar única, tudo alinhado à esquerda, quebra linha naturalmente
      quando não cabe (sem dividir em blocos jogados pra lados diferentes). -->
      <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-bottom:6px;">
        <span style="display:inline-flex;flex-shrink:0;border:1.5px solid #333;border-radius:8px;overflow:hidden;font-size:.7rem;font-weight:700;" title="Qual versão de datas ver/editar nas colunas Início e Término">
          ${['base','desafio','atual'].map(v=>`<button onclick="Planejamento.setVersaoData('${v}')" style="border:none;padding:4px 10px;cursor:pointer;${_versaoData===v?'background:var(--cor-primaria);color:#000;':'background:#111;color:#888;'}">${VERSAO_LABEL[v]}</button>`).join('')}
        </span>
        <span style="color:#333;">|</span>
        ${['dia','semana','mes','trimestre','ano'].map(z=>`<button class="btn btn-sm ${zoomGantt===z?'btn-primario':'btn-secundario'}" onclick="Planejamento.setZoom('${z}')" style="font-size:.7rem;padding:2px 8px;">${z.charAt(0).toUpperCase()+z.slice(1)}</button>`).join('')}
        <span style="color:#333;">|</span>
        <button class="btn btn-secundario btn-sm" onclick="Planejamento.toggleGantt()" id="btn-tg" style="font-size:.72rem;">${ganttVisible?'◀ Esconder Gantt':'▶ Mostrar Gantt'}</button>
        <button class="btn btn-sm ${_setasPred&&ganttVisible?'btn-primario':'btn-secundario'}" onclick="Planejamento.toggleSetasPred()" style="font-size:.72rem;${ganttVisible?'':'opacity:.45;'}" title="${ganttVisible?'Desenha no Gantt a seta da predecessora até cada tarefa (estilo MS Project) — passe o mouse pra destacar, clique pra marcar e ver o nome':'Mostre o Gantt pra usar as setas'}">${_setasPred?'☑':'☐'} Setas de Predecessora</button>
        <span style="color:#333;">|</span>
        <button class="btn btn-secundario btn-sm" onclick="Planejamento._toggleMenuFerramentas()" style="font-size:.72rem;">⚙ Ferramentas</button>
        <button class="btn ${modoView==='arvore'?'btn-primario':'btn-secundario'} btn-sm" data-perm="planejamento:editar:estrutura" onclick="Planejamento.toggleArvoreEditor()" style="font-size:.72rem;">🌳 Editor de Estrutura</button>
        <button class="btn btn-sm ${_visaoOrgIds?'btn-primario':'btn-secundario'}" onclick="event.stopPropagation();Planejamento._menuVisaoOrg()" style="font-size:.72rem;" title="Família de visões-máscara: Gantt filtrado por linhas, só os pais por nível, e mais no futuro">🗂 Visão Organizacional${_visaoOrgIds?` (${_visaoOrgIds.size})`:''}</button>
        <span style="color:#333;">|</span>
        <button class="btn btn-primario btn-sm" data-perm="planejamento:criar:tarefa" onclick="Planejamento.inserirTarefa()" style="font-size:.72rem;">＋ Tarefa</button>
        ${colsHidden.size?`<button class="btn btn-secundario btn-sm" onclick="Planejamento.showColsMenu()" style="font-size:.72rem;">＋ Colunas (${colsHidden.size})</button>`:''}
      </div>
      <div style="font-size:.68rem;color:#444;margin-bottom:4px;">Ctrl++ inserir · Ctrl+- excluir · clique na célula para editar · clique direito no header para esconder coluna · Ctrl+botão direito+arrastar para reordenar</div>
      <div style="position:relative;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
        <div style="position:relative;flex:1;max-width:360px;">
          <input id="gantt-busca" type="text" value="${_buscaTexto}" placeholder="🔍 Buscar por nome, código, responsável..." autocomplete="off"
            oninput="Planejamento.onBusca(this.value)"
            onkeydown="Planejamento._buscaKey(event)"
            style="width:100%;padding:6px 28px 6px 9px;border:1px solid #333;border-radius:7px;font-size:.8rem;box-sizing:border-box;background:#111;color:#ddd;">
          <button id="gantt-busca-clear" onclick="Planejamento.limparBusca()" title="Limpar"
            style="display:${_buscaTexto?'block':'none'};position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#666;font-size:.9rem;padding:0;">✕</button>
        </div>
        <span id="gantt-busca-info" style="font-size:.75rem;color:#888;display:${_buscaTexto?'':'none'};">${_buscaTexto?(_buscaResultados.length?`${_buscaCursor>=0?(_buscaCursor+1)+'/':''}${_buscaResultados.length} resultado${_buscaResultados.length!==1?'s':''}`:' Nenhum resultado'):''}</span>
        <span style="font-size:.7rem;color:#555;">↑↓ navegar · Enter pular · Esc limpar</span>
      </div>
      </div>
      ${_renderGantt(visCols)}
      ${_renderBarraSelecao()}`;
    requestAnimationFrame(()=>_paintRows());
  }

  // ===================== VÍNCULOS COM LEVANTAMENTO — TELA =====================
  async function abrirVinculosView(){
    modoView='vinculos';_vincNavModulo=null;_vincNavMetrica=null;_vincNavPath=[];_vincTipo='maoObra';_render();
    // Recarrega TODOS os levantamentos do zero (não usa cache velho) em background,
    // pra tela mostrar quantidade/local sempre atualizados ao entrar.
    await _invalidarLevCache();
    if(modoView==='vinculos')_renderVinculosView();
  }
  function fecharVinculosView(){modoView='gantt';_render();}

  // Cache de dados dos levantamentos (cada módulo carrega uma vez por sessão)
  const _levCache={};

  async function _carregarLevSeNecessario(modulo){
    if(_levCache[modulo])return;
    const mod=LEVANTAMENTO_MODULOS[modulo];if(!mod)return;
    try{
      // Terraplanagem não tem coleção de peças — é 1 volume calculado a partir
      // de obras/{id}/config/terraplanagemSecoes (+ terraplanagem p/ empolamento).
      if(modulo==='terraplanagem'){
        const [dSec,dCfg]=await Promise.all([
          db.collection('obras').doc(obraId).collection('config').doc('terraplanagemSecoes').get().catch(()=>null),
          db.collection('obras').doc(obraId).collection('config').doc('terraplanagem').get().catch(()=>null),
        ]);
        const secoesTerra=(dSec&&dSec.exists)?{horizontal:dSec.data().horizontal||[],vertical:dSec.data().vertical||[]}:{horizontal:[],vertical:[]};
        const cfgTerra=(dCfg&&dCfg.exists)?dCfg.data():{taxaEmpolamento:0.3};
        _levCache[modulo]={dados:[],extra:[],arvore:[],secoesTerra,cfgTerra};
        return;
      }
      const [dados,extra,cfg]=await Promise.all([
        Database.listar(obraId,mod.colecao,null).catch(()=>[]),
        mod.colecaoExtra?Database.listar(obraId,mod.colecaoExtra,null).catch(()=>[]):Promise.resolve([]),
        mod.configDoc?Database.obter(obraId,'config',mod.configDoc).catch(()=>null):Promise.resolve(null),
      ]);
      // arvore: array plano de nós com filhos recursivos, ou [] se não existir
      let arvore=cfg?.arvore||[];
      // Para fachada: também carrega a cfg do Firestore (evita usar localStorage)
      let cfgDoc=null;
      if(modulo==='fachada'){
        try{const cs=await db.collection('obras').doc(obraId).collection('config').doc('fachadaCfg').get();cfgDoc=cs.exists?cs.data():null;}catch(e){}
      }
      // Concreto: árvore virtual montada em memória (Andar › Tipo + Concretagens
      // como pastas soltas na raiz) — ver _buildArvoreConcreto. Precisa também de
      // concretoPecaConc (peça↔concretagem, com % de cada peça em cada concretagem).
      let pecaConc=[];
      if(modulo==='concreto'){
        try{pecaConc=await Database.listar(obraId,'concretoPecaConc',null);}catch(e){pecaConc=[];}
        arvore=_buildArvoreConcreto(dados,extra);
      }
      _levCache[modulo]={dados,extra,arvore,cfg:cfgDoc,pecaConc};
    }catch(e){
      console.error('Erro ao carregar levantamento',modulo,e);
      Utils.toast(`Erro ao carregar dados de ${LEVANTAMENTO_MODULOS[modulo]?.label||modulo}. Verifique sua conexão.`,'erro');
    }
  }

  // Monta a árvore virtual do Concreto a partir dos dados brutos (não vem de
  // configDoc porque não existe árvore cadastrada — as peças só têm andar/tipo
  // como campos soltos). Raiz mistura duas coisas, lado a lado:
  //  - um nó por Andar (id 'andar:X'), com um filho por Tipo presente naquele
  //    andar (id 'andar:X|tipo:Y') — pra vincular por local físico.
  //  - um nó por Concretagem cadastrada (id 'conc:ID'), sem filhos — pra
  //    vincular pela concretagem/etapa de execução, que pode misturar peças de
  //    vários andares/tipos numa porcentagem cada (ver concretoPecaConc).
  function _buildArvoreConcreto(pecas,concretagens){
    const andares=[...new Set((pecas||[]).map(p=>p.andar||'(sem andar)'))];
    let ordemAndares=andares;
    try{if(typeof ConcretoCalculos!=='undefined')ordemAndares=ConcretoCalculos.ordenarAndares(andares,[]);}catch(e){}
    const nodesAndar=ordemAndares.map(andar=>{
      const tipos=[...new Set(pecas.filter(p=>(p.andar||'(sem andar)')===andar).map(p=>p.tipo||'(sem tipo)'))];
      let ordemTipos=tipos;
      try{
        const ordemRef=typeof ConcretoCalculos!=='undefined'?ConcretoCalculos.TIPO_ORDEM:null;
        if(ordemRef)ordemTipos=[...tipos].sort((a,b)=>{const ia=ordemRef.indexOf(a),ib=ordemRef.indexOf(b);return (ia<0?999:ia)-(ib<0?999:ib);});
      }catch(e){}
      return {id:'andar:'+andar,nome:andar,filhos:ordemTipos.map(tipo=>({id:'andar:'+andar+'|tipo:'+tipo,nome:tipo,filhos:[]}))};
    });
    const nodesConc=[...(concretagens||[])]
      .sort((a,b)=>(Number(b.numero)||0)-(Number(a.numero)||0))
      .map(c=>({id:'conc:'+c.id,nome:'◈ Concretagem Nº'+(c.numero||'?')+(c.desc?' — '+c.desc:'')+(c.data?' ('+c.data+')':''),filhos:[]}));
    return [...nodesAndar,...nodesConc];
  }

  // Força reler do Firestore (BUG histórico: o cache nunca era invalidado,
  // então editar um Levantamento e voltar pro Planejamento sem F5 mostrava
  // árvore/valores velhos). Chamar sempre que o usuário for TOMAR UMA DECISÃO
  // com base nesses dados: abrir a tela de Vínculos, abrir o modal de vincular,
  // ou recalcular. Sem modulo = recarrega todos.
  async function _invalidarLevCache(modulo){
    if(modulo){
      delete _levCache[modulo];
      await _carregarLevSeNecessario(modulo);
    } else {
      Object.keys(_levCache).forEach(k=>delete _levCache[k]);
      await Promise.all(Object.keys(LEVANTAMENTO_MODULOS).map(m=>_carregarLevSeNecessario(m)));
    }
    if(_levCache['fachada'])levFachadas=_levCache['fachada'].dados;
  }

  // ===================== VÍNCULO DE % A ESTACAS/FUNDAÇÕES =====================
  // Uma tarefa (folha) pode se vincular a UMA PEÇA específica (estaca/fundação)
  // ou a UMA CONCRETAGEM inteira — o % dela deixa de ser editável manualmente e
  // passa a vir direto da execução real (Controle de Concreto/Controle de
  // Estacas). O cálculo mora em EstacasCalculos.sincronizarVinculosPlanejamento
  // (mesma função chamada pelo Controle de Estacas ao marcar um real), pra
  // nunca existir dois caminhos de cálculo que divergem.
  let _estVincCache=null; // {pecas, concretagens}
  let _estVincTarefaId=null;

  async function _carregarEstVincCacheSeNecessario(){
    if(_estVincCache)return;
    try{
      const [pecas,concretagens]=await Promise.all([
        Database.listar(obraId,'concretoPecas',null).catch(()=>[]),
        Database.listar(obraId,'concretoConcretagens',null).catch(()=>[]),
      ]);
      _estVincCache={pecas:pecas.filter(p=>p.tipo==='Fundação'),concretagens};
    }catch(e){console.error(e);}
  }

  async function abrirVinculoEstacas(tarefaId){
    _estVincTarefaId=tarefaId;
    await _carregarEstVincCacheSeNecessario();
    _renderVinculoEstacasBody();
    Utils.abrirModal('modal-planej-vinculo-estacas');
  }

  function _renderVinculoEstacasBody(){
    const el=document.getElementById('planej-vinculo-estacas-body');if(!el)return;
    const t=tarefas.find(x=>x.id===_estVincTarefaId);if(!t){el.innerHTML='';return;}
    const tipo=t._estVincTipoTemp||t.estacasVinculoTipo||'peca';
    el.innerHTML=`
      <div class="form-grupo">
        <label>Vincular a</label>
        <div class="aba-toggle">
          <button class="aba-btn ${tipo==='peca'?'ativo':''}" onclick="Planejamento._estVincSetTipo('peca')">Uma peça (estaca/fundação)</button>
          <button class="aba-btn ${tipo==='concretagem'?'ativo':''}" onclick="Planejamento._estVincSetTipo('concretagem')">Uma concretagem inteira</button>
        </div>
      </div>
      <div class="form-grupo" id="planej-vinculo-estacas-select"></div>
      ${t.estacasVinculoTipo?`<button class="btn btn-secundario btn-sm" style="color:var(--cv-red,#ef4444);" onclick="Planejamento.removerVinculoEstacas()">🗑 Remover vínculo</button>`:''}
    `;
    _renderEstVincSelect();
  }

  function _estVincSetTipo(tipo){
    const t=tarefas.find(x=>x.id===_estVincTarefaId);if(!t)return;
    t._estVincTipoTemp=tipo;
    _renderVinculoEstacasBody();
  }

  function _renderEstVincSelect(){
    const el=document.getElementById('planej-vinculo-estacas-select');if(!el)return;
    const t=tarefas.find(x=>x.id===_estVincTarefaId);if(!t)return;
    const cache=_estVincCache||{pecas:[],concretagens:[]};
    const tipo=t._estVincTipoTemp||t.estacasVinculoTipo||'peca';
    if(tipo==='peca'){
      el.innerHTML=`
        <label>Peça</label>
        <select class="form-control" id="planej-vinculo-estacas-id">
          <option value="">— Selecione —</option>
          ${cache.pecas.map(p=>`<option value="${p.id}" ${p.id===t.estacasVinculoId?'selected':''}>${_esc(p.nome)} · ${_esc(p.andar)}${p.subTipo?' · '+_esc(p.subTipo):''}${p.diametro?' · ⌀'+p.diametro+'cm':''}</option>`).join('')}
        </select>`;
    }else{
      el.innerHTML=`
        <label>Concretagem</label>
        <select class="form-control" id="planej-vinculo-estacas-id">
          <option value="">— Selecione —</option>
          ${[...cache.concretagens].sort((a,b)=>(a.numero||0)-(b.numero||0)).map(c=>`<option value="${c.id}" ${c.id===t.estacasVinculoId?'selected':''}>Nº ${c.numero} — ${c.data||''}${c.descricao?' | '+_esc(c.descricao):''}</option>`).join('')}
        </select>`;
    }
  }

  async function salvarVinculoEstacas(){
    const t=tarefas.find(x=>x.id===_estVincTarefaId);if(!t)return;
    const tipo=t._estVincTipoTemp||t.estacasVinculoTipo||'peca';
    const id=document.getElementById('planej-vinculo-estacas-id')?.value||'';
    if(!id){Utils.toast('Selecione uma opção.','alerta');return;}
    const cache=_estVincCache||{pecas:[],concretagens:[]};
    const label=tipo==='peca'
      ?(cache.pecas.find(p=>p.id===id)?.nome||'')
      :(()=>{const c=cache.concretagens.find(x=>x.id===id);return c?`Concretagem Nº ${c.numero}`:'';})();
    Utils.mostrarLoading();
    try{
      await Database.atualizar(obraId,COL,t.id,{estacasVinculoTipo:tipo,estacasVinculoId:id,estacasVinculoLabel:label});
      delete t._estVincTipoTemp;
      Utils.fecharModal('modal-planej-vinculo-estacas');
      await EstacasCalculos.sincronizarVinculosPlanejamento(obraId).catch(()=>{});
      await carregar();
      Utils.toast('✓ Vínculo salvo!','sucesso');
    }catch(e){Utils.toast('Erro ao salvar: '+e.message,'erro');}
    finally{Utils.esconderLoading();}
  }

  async function removerVinculoEstacas(){
    const t=tarefas.find(x=>x.id===_estVincTarefaId);if(!t)return;
    Utils.mostrarLoading();
    try{
      await Database.atualizar(obraId,COL,t.id,{estacasVinculoTipo:'',estacasVinculoId:'',estacasVinculoLabel:''});
      Utils.fecharModal('modal-planej-vinculo-estacas');
      await carregar();
      Utils.toast('Vínculo removido.','sucesso');
    }catch(e){Utils.toast('Erro ao remover: '+e.message,'erro');}
    finally{Utils.esconderLoading();}
  }

  // Único ponto de cálculo do valor-base de um vínculo (obra inteira ou filtrado
  // por local). Usado tanto ao salvar quanto ao recalcular — antes existiam dois
  // caminhos que divergiam: "Recalcular" esquecia de filtrar por nó (Piso/Teto/
  // Paredes) e devolvia o total da obra inteira em vez do valor do local vinculado.
  function _calcularBaseValor(modulo,metrica,ctx){
    const mod=LEVANTAMENTO_MODULOS[modulo];if(!mod)return 0;
    ctx=ctx||{};
    if(modulo==='fachada'){
      return _calcularMetrica(modulo,metrica,ctx.fachadaId||null,ctx.balancimId||null,ctx.vistaId||null,null);
    }
    if(mod.configDoc||mod.arvoreVirtual){
      const cache=_levCache[modulo]||{arvore:[]};
      const nodeIds=ctx.nodeId?_idsDescendentes(cache.arvore,ctx.nodeId):null;
      return _calcularMetricaComNodeIds(modulo,metrica,nodeIds);
    }
    return _calcularMetrica(modulo,metrica,null,null,null,null);
  }
  function _unidadeDaMetrica(modulo,metrica){
    return LEVANTAMENTO_MODULOS[modulo]?.metricas.find(m=>m.id===metrica)?.unidade||'';
  }

  // ---- Nomes de campo na tarefa, por tipo de vínculo ----
  // 'geral' usa os campos originais (quantidade, unidade, fonteQuantidade...) —
  // 100% compatível com todos os vínculos que já existiam antes desta função
  // existir. 'maoObra'/'material' usam campos NOVOS e independentes, pra uma
  // mesma tarefa poder ter uma quantidade pra Mão de Obra e outra pra Materiais.
  function _sufTipo(tipo){return tipo==='maoObra'?'MaoObra':tipo==='material'?'Material':'';}
  function _campo(base,tipo){return base+_sufTipo(tipo);}

  // Função principal: calcula a métrica solicitada a partir dos dados brutos do levantamento.
  // fachadaId/balancimId/vistaId filtram hierarquia da Fachada.
  // nodeId filtra por nó da árvore Torre→Andar→Apto→Cômodo (Piso/Teto).
  function _calcularMetrica(modulo,metrica,fachadaId,balancimId,vistaId,nodeId){
    const cache=_levCache[modulo];
    if(!cache)return 0;
    const {dados,extra}=cache;

    if(modulo==='fachada'){
      let pecas=dados.filter(x=>x.tipo==='peca');
      if(vistaId)pecas=pecas.filter(p=>p.vistaId===vistaId);
      else if(balancimId)pecas=pecas.filter(p=>p.balancimId===balancimId);
      else if(fachadaId)pecas=pecas.filter(p=>p.fachadaId===fachadaId);
      const fCfg=_levCache['fachada']?.cfg||null;
      const r=Utils.calcularFachadaM2(pecas,obraId,fCfg);
      return r[metrica]||0;
    }

    if(modulo==='piso'){
      let areas=dados;
      if(nodeId){const ids=_idsDescendentes(_levCache[modulo]?.arvore||[],nodeId);areas=areas.filter(a=>ids.includes(a.nodeId));}
      if(metrica==='areaM2')         return areas.reduce((s,a)=>s+(Number(a.areaM2)||0),0);
      if(metrica==='mlRodape')        return areas.reduce((s,a)=>s+(Number(a.mlRodape)||0),0);
      if(metrica==='areaContrapiso')  return areas.filter(a=>a.tipoContrapiso&&a.tipoContrapiso!=='').reduce((s,a)=>s+(Number(a.areaM2)||0),0);
      if(metrica==='areaImperm')      return areas.filter(a=>a.impermeabilizacao===true||a.impermeabilizacao==='true').reduce((s,a)=>s+(Number(a.areaM2)||0),0);
      return 0;
    }

    if(modulo==='teto'){
      let areas=dados;
      if(nodeId){const ids=_idsDescendentes(_levCache[modulo]?.arvore||[],nodeId);areas=areas.filter(a=>ids.includes(a.nodeId));}
      if(metrica==='areaM2')         return areas.reduce((s,a)=>s+(Number(a.areaM2)||0),0);
      if(metrica==='mlTabica')        return areas.reduce((s,a)=>s+(Number(a.mlTabica)||0),0);
      if(metrica==='areaDrywall')     return areas.filter(a=>a.tipoDryWall&&a.tipoDryWall!=='').reduce((s,a)=>s+(Number(a.areaM2)||0),0);
      if(metrica==='areaGesso')       return areas.filter(a=>a.tipoPlacaGesso&&a.tipoPlacaGesso!=='').reduce((s,a)=>s+(Number(a.areaM2)||0),0);
      if(metrica==='pinturaTeto')     return areas.reduce((s,a)=>s+_pinturaM2Teto(a),0);
      return 0;
    }

    if(modulo==='paredes'){
      // Paredes salva campos BRUTOS (comprimento/altura em cm, vaos[], tipoAlvenaria,
      // acabamentos[] com tipo+pct). areaLiquida/gesso/reboco/revestimento NÃO são
      // gravados — recalculamos com _calcParedeBruta/_calcAcabBruta.
      let alv=dados,acab=extra;
      if(nodeId){const ids=_idsDescendentes(_levCache[modulo]?.arvore||[],nodeId);alv=alv.filter(p=>ids.includes(p.nodeId));acab=acab.filter(p=>ids.includes(p.nodeId));}
      const calcsAlv=alv.map(_calcParedeBruta);
      const calcsAcab=acab.map(_calcAcabBruta);
      if(metrica==='vedacao')      return calcsAlv.filter(c=>c.tipoAlvenaria==='vedacao').reduce((s,c)=>s+c.areaLiquida,0);
      if(metrica==='estrutural')   return calcsAlv.filter(c=>c.tipoAlvenaria==='estrutural').reduce((s,c)=>s+c.areaLiquida,0);
      if(metrica==='gesso')        return calcsAcab.reduce((s,c)=>s+c.gesso,0);
      if(metrica==='reboco')       return calcsAcab.reduce((s,c)=>s+c.reboco,0);
      if(metrica==='revestimento') return calcsAcab.reduce((s,c)=>s+c.revestimento,0);
      if(metrica==='pinturaParede')return calcsAcab.reduce((s,c)=>s+c.pinturaM2,0);
      return 0;
    }


    if(modulo==='concreto'){
      if(metrica==='volume') return dados.reduce((s,p)=>s+(p.volume||0),0);
      return 0;
    }

    if(modulo==='terraplanagem'){
      if(typeof TerraplanagemCalculos==='undefined')return 0;
      const TCcalc=TerraplanagemCalculos;
      const secoes=cache.secoesTerra||{horizontal:[],vertical:[]};
      const cfgTerra=cache.cfgTerra||{taxaEmpolamento:0.3};
      const volH=TCcalc.calcVolumeTotalSecoes(secoes.horizontal||[]);
      const volV=TCcalc.calcVolumeTotalSecoes(secoes.vertical||[]);
      const volMedio=TCcalc.calcVolumeMedio(volH,volV);
      if(metrica==='volumeBanco')    return volMedio;
      if(metrica==='volumeEmpolado') return TCcalc.calcVolumeComEmpolamento(volMedio,cfgTerra.taxaEmpolamento);
      return 0;
    }

    if(modulo==='soloGrampeado'){
      // dados=sgChumbadores (colecao), extra=sgVistas (colecaoExtra)
      if(metrica==='ml')  return dados.reduce((s,c)=>s+(Number(c.comprimento)||0),0);
      if(metrica==='qtd') return dados.length;
      if(metrica==='m2')  return (extra||[]).reduce((s,v)=>s+(Number(v.m2Total)||0),0);
      return 0;
    }

    if(modulo==='arCondicionado'){
      const subareas=dados.flatMap(a=>a.subareas||[]);
      if(metrica==='qtdEquipamentos') return subareas.reduce((s,sa)=>s+(sa.qtd||0),0);
      if(metrica==='btus')            return subareas.reduce((s,sa)=>s+(sa.btus||0),0);
      return 0;
    }

    return 0;
  }

  // Rótulo legível da fonte estrutural escolhida (fachada/balancim/vista),
  // usado tanto no modal quanto na lista de vínculos.
  function _fonteEstruturalLabel(fachadaId,balancimId,vistaId){
    if(!fachadaId)return 'Toda a obra';
    const f=levFachadas.find(x=>x.tipo==='fachada'&&x.id===fachadaId);
    let txt=f?f.nome:'Fachada removida';
    if(balancimId){
      const b=levFachadas.find(x=>x.tipo==='balancim'&&x.id===balancimId);
      txt+=' › '+(b?(b.nome||b.codigo):'Balancim removido');
      if(vistaId){
        const v=levFachadas.find(x=>x.tipo==='vista'&&x.id===vistaId);
        txt+=' › '+(v?(v.tipoVista==='externa'?'Vista Externa':'Vista Interna'):'Vista removida');
      }
    }
    return txt;
  }

  // Aceita "1", "0.5" ou frações "1/8" — como as pessoas de obra pensam em partes.
  function _parseFracao(s){
    s=String(s==null?'1':s).trim();
    if(s.includes('/')){const [a,b]=s.split('/').map(Number);return b?a/b:1;}
    const n=parseFloat(s.replace(',','.'));
    return isNaN(n)?1:n;
  }
  // Representa um fator numérico como fração simples (1/2, 1/8...) quando possível,
  // pra ficar legível no campo — senão mostra o número.
  function _fracaoDeFator(f){
    if(f==null)return '1';
    if(Math.abs(f-1)<1e-9)return '1';
    for(let n=2;n<=20;n++){if(Math.abs(f-1/n)<1e-9)return '1/'+n;}
    return String(f);
  }

  function onBuscaEscolhaAlvoVinc(v){_vincEscolhaBusca=v;_renderVinculoModalBody();}

  // Acha um grupo de tarefas já vinculado exatamente a esta fonte (módulo+métrica+local),
  // pra "Vincular aqui" abrir editando o que já existe em vez de criar duplicado.
  function _grupoExistente(modulo,metrica,ctx,tipo){
    const cFonte=_campo('fonteQuantidade',tipo),cMod=_campo('levantamentoModulo',tipo),cMet=_campo('levantamentoMetrica',tipo);
    const cFach=_campo('levantamentoFachadaId',tipo),cBal=_campo('levantamentoBalancimId',tipo),cVis=_campo('levantamentoVistaId',tipo),cNode=_campo('levantamentoNodeId',tipo);
    return tarefas.find(t=>t[cFonte]==='levantamento'&&t[cMod]===modulo&&t[cMet]===metrica&&(
      modulo==='fachada'
        ?(t[cFach]||'')===(ctx.fachadaId||'')&&(t[cBal]||'')===(ctx.balancimId||'')&&(t[cVis]||'')===(ctx.vistaId||'')
        :(t[cNode]||'')===(ctx.nodeId||'')
    ));
  }
  function _qtdTarefasNoGrupo(origemId,tipo){
    const cOrigem=_campo('levantamentoOrigemId',tipo);
    return tarefas.filter(t=>t.id===origemId||t[cOrigem]===origemId).length;
  }
  function onVincTipoChange(tipo){_vincTipo=tipo;_renderVinculosView();}

  // Filhos (pastas) do nível atual de navegação — Fachada usa fachada/balancim/vista,
  // Piso/Teto/Paredes usam a árvore real (Torre › Pavimento › Apto › Cômodo).
  function _vincNavFilhos(){
    const modulo=_vincNavModulo,mod=LEVANTAMENTO_MODULOS[modulo];
    const cache=_levCache[modulo]||{dados:[],arvore:[]};
    const path=_vincNavPath;
    if(modulo==='fachada'){
      if(path.length===0)return cache.dados.filter(x=>x.tipo==='fachada').map(f=>({id:f.id,nome:f.nome,temFilhos:true}));
      if(path.length===1)return cache.dados.filter(x=>x.tipo==='balancim'&&x.fachadaId===path[0].id).map(b=>({id:b.id,nome:b.nome||b.codigo,temFilhos:true}));
      if(path.length===2)return cache.dados.filter(x=>x.tipo==='vista'&&x.balancimId===path[1].id).sort((a,b)=>a.tipoVista==='externa'?-1:1).map(v=>({id:v.id,nome:v.tipoVista==='externa'?'Vista Externa':'Vista Interna',temFilhos:false}));
      return [];
    }
    if(mod?.configDoc||mod?.arvoreVirtual){
      let nivel=cache.arvore;
      for(const p of path){
        const n=(nivel||[]).find(x=>x.id===p.id);
        if(!n)return [];
        nivel=n.filhos||[];
      }
      return (nivel||[]).map(n=>({id:n.id,nome:n.nome,temFilhos:!!(n.filhos&&n.filhos.length)}));
    }
    return []; // sem hierarquia (Concreto, Ar-Condicionado, Pintura)
  }
  function _vincNavCtx(){
    if(_vincNavModulo==='fachada')return {fachadaId:_vincNavPath[0]?.id||null,balancimId:_vincNavPath[1]?.id||null,vistaId:_vincNavPath[2]?.id||null};
    return {nodeId:_vincNavPath.length?_vincNavPath[_vincNavPath.length-1].id:null};
  }

  function onVincNavModulo(modulo){_vincNavModulo=modulo;_vincNavMetrica=null;_vincNavPath=[];_renderVinculosView();}
  function onVincNavModuloMetrica(modulo,metrica){_vincNavModulo=modulo;_vincNavMetrica=metrica;_vincNavPath=[];_renderVinculosView();}
  function onVincNavMetrica(metrica){_vincNavMetrica=metrica;_vincNavPath=[];_renderVinculosView();}
  function onVincNavEntrar(id,nome){_vincNavPath=[..._vincNavPath,{id,nome}];_renderVinculosView();}
  function onVincNavBreadcrumb(nivel){
    // nivel: -2 = grade de módulos, -1 = grade de métricas, 0..N = trunca o caminho até ali
    if(nivel===-2){_vincNavModulo=null;_vincNavMetrica=null;_vincNavPath=[];}
    else if(nivel===-1){_vincNavMetrica=null;_vincNavPath=[];}
    else{_vincNavPath=_vincNavPath.slice(0,nivel+1);}
    _renderVinculosView();
  }
  function onVincNavVoltar(){
    if(_vincNavPath.length){_vincNavPath=_vincNavPath.slice(0,-1);}
    else if(_vincNavMetrica){
      // Módulos "cardsPorMetrica" (ex: Paredes) não têm tela de métrica própria
      // — o card já escolhe módulo+métrica juntos, então "voltar" pula direto
      // pra grade de módulos em vez de uma tela de métrica que não existe.
      const mod=LEVANTAMENTO_MODULOS[_vincNavModulo];
      _vincNavMetrica=null;
      if(mod?.cardsPorMetrica)_vincNavModulo=null;
    }
    else if(_vincNavModulo){_vincNavModulo=null;}
    _renderVinculosView();
  }

  function _renderVinculosView(){
    const c=_el();
    c.style.cssText='display:flex;flex-direction:column;min-height:0;height:100%;overflow-y:auto;';

    const crumbs=[`<span class="vinc-crumb" onclick="Planejamento.onVincNavBreadcrumb(-2)">🔗 Vínculos</span>`];
    const modAtualCrumb=_vincNavModulo?LEVANTAMENTO_MODULOS[_vincNavModulo]:null;
    if(modAtualCrumb?.cardsPorMetrica&&_vincNavMetrica){
      // Card já escolhe módulo+métrica juntos (ex: "Gesso Liso") — um crumb só.
      const metricaLabel=modAtualCrumb.metricas.find(m=>m.id===_vincNavMetrica)?.label||_vincNavMetrica;
      crumbs.push(`<span class="vinc-crumb ${_vincNavPath.length?'':'atual'}" onclick="Planejamento.onVincNavBreadcrumb(-2)">${metricaLabel}</span>`);
      _vincNavPath.forEach((p,i)=>{
        const ultimo=i===_vincNavPath.length-1;
        crumbs.push(`<span class="vinc-crumb ${ultimo?'atual':''}" onclick="${ultimo?'':`Planejamento.onVincNavBreadcrumb(${i})`}">${p.nome}</span>`);
      });
    } else {
      if(_vincNavModulo){
        crumbs.push(`<span class="vinc-crumb ${_vincNavMetrica?'':'atual'}" onclick="Planejamento.onVincNavBreadcrumb(-1)">${modAtualCrumb.label}</span>`);
      }
      if(_vincNavMetrica){
        const metricaLabel=LEVANTAMENTO_MODULOS[_vincNavModulo].metricas.find(m=>m.id===_vincNavMetrica)?.label||_vincNavMetrica;
        crumbs.push(`<span class="vinc-crumb ${_vincNavPath.length?'':'atual'}" onclick="Planejamento.onVincNavBreadcrumb(-1)">${metricaLabel}</span>`);
        _vincNavPath.forEach((p,i)=>{
          const ultimo=i===_vincNavPath.length-1;
          crumbs.push(`<span class="vinc-crumb ${ultimo?'atual':''}" onclick="${ultimo?'':`Planejamento.onVincNavBreadcrumb(${i})`}">${p.nome}</span>`);
        });
      }
    }
    const breadcrumbHTML=`<div class="vinc-breadcrumb">${crumbs.join('<span class="vinc-sep">›</span>')}</div>`;

    let corpoHTML='';
    if(!_vincNavModulo){
      // Grade de módulos de levantamento. Módulos "cardsPorMetrica" (ex: Paredes)
      // aparecem já abertos por tipo — Alvenaria de Vedação, Gesso Liso etc,
      // cada um seu próprio card — em vez de um card "Paredes" genérico.
      const cards=[];
      Object.entries(LEVANTAMENTO_MODULOS).forEach(([id,m])=>{
        if(m.cardsPorMetrica){
          m.metricas.forEach(met=>cards.push(`
            <div class="vinc-card" onclick="Planejamento.onVincNavModuloMetrica('${id}','${met.id}')">
              <div class="vinc-card-titulo">${met.label}</div>
              <div class="vinc-card-sub">${m.label} · ${met.unidade}</div>
            </div>`));
        } else {
          cards.push(`
            <div class="vinc-card" onclick="Planejamento.onVincNavModulo('${id}')">
              <div class="vinc-card-titulo">${m.label}</div>
              <div class="vinc-card-sub">${m.metricas.length} métrica(s)</div>
            </div>`);
        }
      });
      corpoHTML=`<div class="vinc-grid">${cards.join('')}</div>`;
    } else if(!_vincNavMetrica){
      const mod=LEVANTAMENTO_MODULOS[_vincNavModulo];
      corpoHTML=`<div class="vinc-grid">
        ${mod.metricas.map(m=>`
          <div class="vinc-card" onclick="Planejamento.onVincNavMetrica('${m.id}')">
            <div class="vinc-card-titulo">${m.label}</div>
            <div class="vinc-card-sub">unidade: ${m.unidade}</div>
          </div>`).join('')}
      </div>`;
    } else {
      const modulo=_vincNavModulo,metrica=_vincNavMetrica,mod=LEVANTAMENTO_MODULOS[modulo];
      const ctx=_vincNavCtx();
      const valor=_calcularBaseValor(modulo,metrica,ctx);
      const unidade=_unidadeDaMetrica(modulo,metrica);
      const existente=_grupoExistente(modulo,metrica,modulo==='fachada'?ctx:{nodeId:ctx.nodeId},_vincTipo);
      const filhos=_vincNavFilhos();
      corpoHTML=`
        <div class="vinc-lista">
          <div class="vinc-linha vinc-linha-resumo">
            <div style="flex:1;min-width:180px;">
              <div class="vinc-resumo-valor" style="font-size:1.3rem;">${_fQtd(valor)} ${unidade}</div>
              <div class="vinc-resumo-status ${existente?'tem-vinculo':''}">${existente?`🔗 já vinculado a ${_qtdTarefasNoGrupo(existente[_campo('levantamentoOrigemId',_vincTipo)]||existente.id,_vincTipo)} tarefa(s)`:'ainda sem vínculo'}</div>
            </div>
            <button class="btn ${existente?'btn-secundario':'btn-primario'} btn-sm" onclick="Planejamento.abrirVincularAqui()">${existente?'✎ Editar vínculo':'🔗 Vincular aqui'}</button>
          </div>
          ${filhos.length?filhos.map(f=>`<div class="vinc-linha vinc-linha-pasta" onclick="Planejamento.onVincNavEntrar('${f.id}','${f.nome.replace(/'/g,"\\'")}')">
            <span class="vinc-pasta-icone">📁</span>
            <span class="vinc-pasta-nome" style="flex:1;">${f.nome}</span>
            ${f.temFilhos?'<span class="vinc-pasta-seta">›</span>':''}
          </div>`).join(''):((mod.configDoc||mod.arvoreVirtual)?'<div class="vinc-linha vinc-vazio">Nenhum local mais específico aqui — este é o nível final.</div>':'')}
        </div>
      `;
    }

    const tipoSeletorHTML=`<div style="margin-bottom:16px;">
      <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;color:#666;margin-bottom:6px;">Tipo de vínculo — o que este vínculo vai alimentar</div>
      <div class="plan-abas" style="width:fit-content;">
        <button class="plan-aba ${_vincTipo==='maoObra'?'ativo':''}" onclick="Planejamento.onVincTipoChange('maoObra')">Mão de Obra</button>
        <button class="plan-aba ${_vincTipo==='material'?'ativo':''}" onclick="Planejamento.onVincTipoChange('material')">Materiais</button>
      </div>
    </div>`;

    c.innerHTML=`
      <div class="page-header">
        <div><h2>🔗 Vínculos com Levantamento</h2>
          <span class="subtitulo">Navegue pelo levantamento (módulo → métrica → local) e vincule a quantidade exata a uma ou mais tarefas do Planejamento.</span></div>
        <div class="btn-grupo">
          <button class="btn btn-secundario btn-sm" onclick="Planejamento.recalcularVinculosLevantamento()">🔄 Recalcular todos os vínculos</button>
          <button class="btn btn-secundario btn-sm" onclick="Planejamento.fecharVinculosView()">← Voltar ao Planejamento</button>
        </div>
      </div>
      ${tipoSeletorHTML}
      ${breadcrumbHTML}
      ${_vincNavModulo?`<button class="btn btn-secundario btn-sm" style="margin-bottom:14px;width:fit-content;" onclick="Planejamento.onVincNavVoltar()">← Voltar</button>`:''}
      ${corpoHTML}`;
  }

  // ===== Modal de vínculo: seleção granular (tarefa + descendentes) =====
  // Cada tarefa pode ser incluída ou não, e ter uma fração própria (padrão "1" =
  // valor total do levantamento). Grupos de irmãos (ex: 8 "etapas") ganham um
  // botão "÷ Dividir" que marca todos e já preenche 1/N automaticamente.
  //
  // A fonte (módulo/métrica/local) NÃO é escolhida aqui dentro — ela já vem
  // travada de onde o usuário clicou "Vincular aqui" na navegação em pastas.
  // Se quiser outra fonte, fecha o modal e navega pra outra pasta.

  // Abre o modal a partir da navegação em pastas (tela principal de Vínculos).
  // Se já existe um vínculo pra essa fonte exata, abre editando o grupo existente.
  async function abrirVincularAqui(){
    const modulo=_vincNavModulo,metrica=_vincNavMetrica;
    const ctx=_vincNavCtx();
    const existente=_grupoExistente(modulo,metrica,ctx,_vincTipo);
    if(existente){await abrirVincularTarefa(existente[_campo('levantamentoOrigemId',_vincTipo)]||existente.id,_vincTipo);return;}
    _vincModulo=modulo;_vincMetrica=metrica;
    _vincFachadaId=ctx.fachadaId||null;_vincBalancimId=ctx.balancimId||null;_vincVistaId=ctx.vistaId||null;
    _vincNodeId=ctx.nodeId||null;
    _vincAlvoId=null;_vincEscolhaBusca='';
    const tipoLabel=_vincTipo==='maoObra'?' (Mão de Obra)':_vincTipo==='material'?' (Materiais)':'';
    document.getElementById('modal-planej-vinculo-titulo').textContent='Vincular: '+LEVANTAMENTO_MODULOS[modulo].label+tipoLabel;
    Utils.abrirModal('modal-planej-vinculo');
    _renderVinculoModalBody();
  }

  // Abre editando um vínculo já existente (a partir do id de qualquer tarefa do grupo).
  // tipo: 'geral'|'maoObra'|'material' — se omitido, usa o _vincTipo ativo no momento.
  async function abrirVincularTarefa(tarefaId,tipo){
    const t=tarefas.find(x=>x.id===tarefaId);if(!t)return;
    _vincTipo=tipo||_vincTipo;
    const cMod=_campo('levantamentoModulo',_vincTipo),cMet=_campo('levantamentoMetrica',_vincTipo);
    const cFach=_campo('levantamentoFachadaId',_vincTipo),cBal=_campo('levantamentoBalancimId',_vincTipo),cVis=_campo('levantamentoVistaId',_vincTipo),cNode=_campo('levantamentoNodeId',_vincTipo);
    const cOrigem=_campo('levantamentoOrigemId',_vincTipo),cFator=_campo('levantamentoFator',_vincTipo);
    _vincAlvoId=tarefaId;
    _vincModulo=t[cMod]||'fachada';
    _vincMetrica=t[cMet]||LEVANTAMENTO_MODULOS[_vincModulo].metricas[0].id;
    _vincFachadaId=t[cFach]||null;
    _vincBalancimId=t[cBal]||null;
    _vincVistaId=t[cVis]||null;
    _vincNodeId=t[cNode]||null;
    const grupoAtual=tarefas.filter(x=>x[cOrigem]===tarefaId);
    _vincIncluidos=new Set(grupoAtual.length?grupoAtual.map(x=>x.id):[tarefaId]);
    _vincFatores={};
    grupoAtual.forEach(x=>{_vincFatores[x.id]=_fracaoDeFator(x[cFator]);});
    if(!_vincFatores[tarefaId])_vincFatores[tarefaId]='1';
    document.getElementById('modal-planej-vinculo-titulo').textContent='Vincular quantidade: '+t.nome;
    Utils.abrirModal('modal-planej-vinculo');
    document.getElementById('planej-vinculo-body').innerHTML='<div class="text-sm text-muted">Carregando levantamentos...</div>';
    // Sempre lê do zero (não usa cache velho) — é aqui que o usuário decide o
    // valor do vínculo, não pode estar olhando pra dado desatualizado.
    await _invalidarLevCache();
    _renderVinculoModalBody();
  }

  function onEscolherAlvoVinc(id){
    _vincAlvoId=id;
    _vincIncluidos=new Set([id]);
    _vincFatores={[id]:'1'};
    _renderVinculoModalBody();
  }
  function onTrocarAlvoVinc(){_vincAlvoId=null;_vincEscolhaBusca='';_renderVinculoModalBody();}

  function _renderEscolhaAlvo(){
    const q=_vincEscolhaBusca.trim().toLowerCase();
    const lista=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0)).filter(t=>!q||(t.nome||'').toLowerCase().includes(q));
    return `
      <div class="text-sm text-muted" style="margin-bottom:10px;">Escolha a tarefa "pai" do Planejamento que vai receber essa quantidade. As tarefas abaixo dela na hierarquia poderão dividir o valor entre si — igual já funciona a divisão de família hoje.</div>
      <input type="text" class="form-control" placeholder="🔎 Buscar tarefa..." value="${_vincEscolhaBusca}" oninput="Planejamento.onBuscaEscolhaAlvoVinc(this.value)" style="margin-bottom:8px;">
      <div style="border:1px solid var(--cor-borda-light);border-radius:8px;max-height:320px;overflow-y:auto;">
        ${lista.length?lista.map(t=>`<div style="padding:6px 10px;padding-left:${8+(t.nivel||0)*16}px;cursor:pointer;border-bottom:1px solid var(--cor-borda-light);font-size:.83rem;" onclick="Planejamento.onEscolherAlvoVinc('${t.id}')">${t.tipo==='grupo'?'📁 ':''}${t.nome}</div>`).join(''):'<div class="text-sm text-muted" style="padding:10px;">Nenhuma tarefa encontrada.</div>'}
      </div>`;
  }

  function _renderVinculoModalBody(){
    const body=document.getElementById('planej-vinculo-body');if(!body)return;
    const mod=LEVANTAMENTO_MODULOS[_vincModulo];if(!mod){body.innerHTML='';return;}
    const cache=_levCache[_vincModulo]||{dados:[],extra:[],arvore:[]};
    const baseValor=_calcularBaseValor(_vincModulo,_vincMetrica,{fachadaId:_vincFachadaId,balancimId:_vincBalancimId,vistaId:_vincVistaId,nodeId:_vincNodeId});
    const unidade=_unidadeDaMetrica(_vincModulo,_vincMetrica);
    const metricaLabel=mod.metricas.find(m=>m.id===_vincMetrica)?.label||_vincMetrica;
    const fonteLabel=_vincModulo==='fachada'
      ?_fonteEstruturalLabel(_vincFachadaId,_vincBalancimId,_vincVistaId)
      :(_vincNodeId?(_caminhoNode(cache.arvore,_vincNodeId)||[]).map(p=>p.nome).join(' › '):'Toda a obra');

    const resumoFonte=`<div style="background:var(--cor-fundo-alt,#f7f7f7);border-radius:8px;padding:10px 12px;margin-bottom:12px;">
      <div style="font-weight:700;font-size:.85rem;">${mod.label} — ${metricaLabel}</div>
      <div style="font-size:.78rem;color:#888;margin-top:2px;">${fonteLabel}</div>
      <div style="font-size:1.05rem;font-weight:800;margin-top:6px;font-family:var(--font-mono);">${_fQtd(baseValor)} ${unidade}</div>
    </div>`;

    if(!_vincAlvoId){body.innerHTML=resumoFonte+_renderEscolhaAlvo();return;}
    const t=tarefas.find(x=>x.id===_vincAlvoId);
    if(!t){_vincAlvoId=null;body.innerHTML=resumoFonte+_renderEscolhaAlvo();return;}

    const fam=Utils.percFamilia(tarefas);
    const arvoreAntiga=document.getElementById('planej-vinculo-arvore');
    const scrollAnterior=arvoreAntiga?arvoreAntiga.scrollTop:0;

    const linha=(node,nivelRel)=>{
      const incluso=_vincIncluidos.has(node.id);
      const fracao=_vincFatores[node.id]||'1';
      const valor=baseValor*_parseFracao(fracao);
      return `<div style="display:flex;align-items:center;gap:8px;padding:4px 4px;padding-left:${nivelRel*18+4}px;${incluso?'':'opacity:.55;'}">
        <input type="checkbox" ${incluso?'checked':''} onchange="Planejamento.onToggleIncluirVinc('${node.id}',this.checked)">
        <span style="flex:1;font-size:.83rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${node.tipo==='grupo'?'📁 ':''}${node.nome}</span>
        ${incluso?`<input type="text" value="${fracao}" title="Fração do total (ex: 1, 1/8, 0.5)" class="form-control" style="width:56px;font-size:.76rem;padding:2px 6px;text-align:center;"
          onchange="Planejamento.onFatorVincChange('${node.id}',this.value)">
          <span style="font-size:.7rem;color:#888;width:78px;text-align:right;font-family:var(--font-mono);">${_fQtd(valor)}</span>`
          :'<span style="width:142px;"></span>'}
      </div>`;
    };

    const renderNode=(node,nivelRel)=>{
      let html=linha(node,nivelRel);
      const filhos=fam.filhosDiretos(node);
      if(filhos.length>=2){
        html+=`<div style="padding-left:${(nivelRel+1)*18+28}px;margin:2px 0 6px;">
          <button class="btn btn-secundario btn-sm" style="font-size:.62rem;padding:2px 8px;" onclick="Planejamento.dividirIrmaosVinc('${node.id}')">÷ Dividir estes ${filhos.length} em partes iguais</button>
        </div>`;
      }
      filhos.forEach(f=>{html+=renderNode(f,nivelRel+1);});
      return html;
    };

    body.innerHTML=resumoFonte+
      `<div class="text-sm text-muted" style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
        <span>Tarefa "pai": <strong>${t.nome}</strong></span>
        <span style="display:flex;gap:6px;">
          <button class="btn btn-secundario btn-sm" style="padding:1px 8px;font-size:.68rem;" onclick="Planejamento.onTrocarAlvoVinc()">trocar</button>
          ${tarefas.some(x=>x[_campo('levantamentoOrigemId',_vincTipo)]===_vincAlvoId||(x.id===_vincAlvoId&&x[_campo('fonteQuantidade',_vincTipo)]==='levantamento'))?`<button class="btn btn-perigo btn-sm" style="padding:1px 8px;font-size:.68rem;" onclick="Planejamento.removerVinculoLevantamento('${_vincAlvoId}','${_vincTipo}')">excluir vínculo</button>`:''}
        </span>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:8px;">
        <button class="btn btn-secundario btn-sm" onclick="Planejamento.marcarTodosVinc(true)">Marcar todos</button>
        <button class="btn btn-secundario btn-sm" onclick="Planejamento.marcarTodosVinc(false)">Desmarcar todos</button>
      </div>
      <div id="planej-vinculo-arvore" style="border:1px solid var(--cor-borda-light);border-radius:8px;padding:8px;max-height:340px;overflow-y:auto;">
        ${renderNode(t,0)}
      </div>
      <div class="text-sm text-muted" style="margin-top:8px;">Marque as tarefas que devem receber essa quantidade. Use "÷ Dividir" para dividir igualmente entre irmãs, ou digite a fração manual (ex: <code>1/8</code>).</div>`;
    const arvoreNova=document.getElementById('planej-vinculo-arvore');
    if(arvoreNova)arvoreNova.scrollTop=scrollAnterior;
  }

  // ---- Cálculo local de peça de parede (replica a lógica do módulo Paredes)
  // O módulo Paredes salva os campos BRUTOS (comprimento, altura, vaos, tipoAlvenaria,
  // acabamentos, pintura) — areaLiquida/ml/pintura NÃO são gravados no Firestore.
  // Esta função replica o cálculo usando cfg padrão (desconto_total) como fallback
  // caso a config real do localStorage não esteja disponível no contexto do Planejamento.
  function _calcParedeBruta(p){
    const comp=Number(p.comprimento||0)/100; // campo gravado em cm
    const alt=Number(p.altura||0)/100;
    const areaBruta=comp*alt;
    // Vãos: desconto total por padrão (cfg do localStorage não está disponível aqui)
    const areaVaos=(p.vaos||[]).reduce((s,v)=>{
      const a=(Number(v.comprimento||0)/100)*(Number(v.altura||0)/100)*(Number(v.qtd)||1);
      return s+a;
    },0);
    const areaLiquida=Math.max(0,areaBruta-areaVaos);
    const podeML=!!p.podeSerML;
    const ml=podeML?Math.max(comp,alt):0;
    // Pintura: soma(areaLiquida * pct/100) para cada item de pintura
    const pinturaM2=(p.pintura||[]).reduce((s,pt)=>s+areaLiquida*(Number(pt.pct||0)/100),0);
    return {areaLiquida,ml,pinturaM2,podeML,tipoAlvenaria:p.tipoAlvenaria||''};
  }

  function _calcAcabBruta(p){
    const comp=Number(p.comprimento||0)/100;
    const alt=Number(p.altura||0)/100;
    const areaBruta=comp*alt;
    const areaVaos=(p.vaos||[]).reduce((s,v)=>{
      const a=(Number(v.comprimento||0)/100)*(Number(v.altura||0)/100)*(Number(v.qtd)||1);
      return s+a;
    },0);
    const areaLiquida=Math.max(0,areaBruta-areaVaos);
    const podeML=!!p.podeSerML;
    const ml=podeML?Math.max(comp,alt):0;
    const pinturaM2=p.temPintura?(p.pintura||[]).reduce((s,pt)=>s+areaLiquida*(Number(pt.pct||0)/100),0):0;
    // Acabamento por tipo (gesso liso / reboco-chapisco / revestimento cerâmico) —
    // peça grava um array de partes com percentual, igual à pintura por cor.
    const acab={gesso:0,reboco:0,revestimento:0};
    (p.acabamentos||[]).forEach(a=>{
      if(acab[a.tipo]!=null)acab[a.tipo]+=areaLiquida*(Number(a.pct||0)/100);
    });
    return {areaLiquida,ml,pinturaM2,gesso:acab.gesso,reboco:acab.reboco,revestimento:acab.revestimento};
  }
  // Mesma fórmula ponderada por % usada na peça de parede, só que pra área de
  // teto (campo único areaM2, sem vãos a descontar).
  function _pinturaM2Teto(a){
    if(!a.temPintura||!(a.pintura||[]).length)return 0;
    return (a.pintura||[]).reduce((s,pt)=>s+(Number(a.areaM2)||0)*(Number(pt.pct||0)/100),0);
  }

  // Versão de _calcularMetrica que já recebe a lista de nodeIds filtrados
  function _calcularMetricaComNodeIds(modulo,metrica,nodeIds){
    const cache=_levCache[modulo];
    if(!cache)return 0;
    const {dados,extra}=cache;

    const filtrar=lista=>nodeIds?lista.filter(a=>nodeIds.includes(a.nodeId)):lista;

    if(modulo==='piso'){
      // Campos gravados diretamente: areaM2, mlRodape, tipoPiso (string),
      // tipoContrapiso (string, vazio se não tem), impermeabilizacao (boolean),
      // tipoImpermeabilizacao (string)
      const areas=filtrar(dados);
      if(metrica==='areaM2')         return areas.reduce((s,a)=>s+(Number(a.areaM2)||0),0);
      if(metrica==='mlRodape')        return areas.reduce((s,a)=>s+(Number(a.mlRodape)||0),0);
      if(metrica==='areaContrapiso')  return areas.filter(a=>a.tipoContrapiso&&a.tipoContrapiso!=='').reduce((s,a)=>s+(Number(a.areaM2)||0),0);
      // impermeabilizacao é checkbox — pode vir como boolean true ou string 'true'
      if(metrica==='areaImperm')      return areas.filter(a=>a.impermeabilizacao===true||a.impermeabilizacao==='true').reduce((s,a)=>s+(Number(a.areaM2)||0),0);
      return 0;
    }

    if(modulo==='teto'){
      // Campos gravados: areaM2, mlTabica (float), tipoDryWall (string),
      // tipoPlacaGesso (string), temPintura (boolean)
      const areas=filtrar(dados);
      if(metrica==='areaM2')         return areas.reduce((s,a)=>s+(Number(a.areaM2)||0),0);
      if(metrica==='mlTabica')        return areas.reduce((s,a)=>s+(Number(a.mlTabica)||0),0);
      if(metrica==='areaDrywall')     return areas.filter(a=>a.tipoDryWall&&a.tipoDryWall!=='').reduce((s,a)=>s+(Number(a.areaM2)||0),0);
      if(metrica==='areaGesso')       return areas.filter(a=>a.tipoPlacaGesso&&a.tipoPlacaGesso!=='').reduce((s,a)=>s+(Number(a.areaM2)||0),0);
      if(metrica==='pinturaTeto')     return areas.reduce((s,a)=>s+_pinturaM2Teto(a),0);
      return 0;
    }

    if(modulo==='paredes'){
      // IMPORTANTE: campos brutos (comprimento/altura em cm, vaos[], tipoAlvenaria,
      // acabamentos[] com tipo 'gesso'|'reboco'|'revestimento' + pct) — nada disso
      // vem pronto do Firestore. Recalculamos localmente com _calcParedeBruta / _calcAcabBruta.
      const alv=filtrar(dados);
      const acab=filtrar(extra);
      const calcsAlv=alv.map(_calcParedeBruta);
      const calcsAcab=acab.map(_calcAcabBruta);
      if(metrica==='vedacao')      return calcsAlv.filter(c=>c.tipoAlvenaria==='vedacao').reduce((s,c)=>s+c.areaLiquida,0);
      if(metrica==='estrutural')   return calcsAlv.filter(c=>c.tipoAlvenaria==='estrutural').reduce((s,c)=>s+c.areaLiquida,0);
      if(metrica==='gesso')        return calcsAcab.reduce((s,c)=>s+c.gesso,0);
      if(metrica==='reboco')       return calcsAcab.reduce((s,c)=>s+c.reboco,0);
      if(metrica==='revestimento') return calcsAcab.reduce((s,c)=>s+c.revestimento,0);
      if(metrica==='pinturaParede')return calcsAcab.reduce((s,c)=>s+c.pinturaM2,0);
      return 0;
    }

    if(modulo==='concreto'){
      if(!nodeIds){
        if(metrica==='volume') return dados.reduce((s,p)=>s+(p.volume||0),0);
        return 0;
      }
      const idsSet=new Set(nodeIds);
      const concIds=nodeIds.filter(id=>id.startsWith('conc:')).map(id=>id.slice(5));
      let vol;
      if(concIds.length){
        // Concretagem: soma peça a peça o % dela alocado nesta(s) concretagem(ns)
        // — uma peça pode estar dividida entre várias concretagens.
        const pecaConc=cache.pecaConc||[];
        vol=pecaConc.filter(pc=>concIds.includes(pc.concretagemId)).reduce((s,pc)=>{
          const p=dados.find(x=>x.id===pc.pecaId);
          return s+(p?((parseFloat(pc.pctConcretagem)||0)/100)*(p.volume||0):0);
        },0);
      } else {
        // Andar (todos os tipos) ou Andar+Tipo específico
        vol=dados.filter(p=>idsSet.has('andar:'+(p.andar||''))||idsSet.has('andar:'+(p.andar||'')+'|tipo:'+(p.tipo||''))).reduce((s,p)=>s+(p.volume||0),0);
      }
      if(metrica==='volume') return vol;
      return 0;
    }

    // Outros módulos sem filtro por nodeId
    return _calcularMetrica(modulo,metrica,null,null,null,null);
  }
  function onToggleIncluirVinc(id,checked){
    if(checked){_vincIncluidos.add(id);if(!_vincFatores[id])_vincFatores[id]='1';}
    else _vincIncluidos.delete(id);
    _renderVinculoModalBody();
  }
  function onFatorVincChange(id,val){_vincFatores[id]=val;_renderVinculoModalBody();}
  function marcarTodosVinc(v){
    const t=tarefas.find(x=>x.id===_vincAlvoId);if(!t)return;
    const fam=Utils.percFamilia(tarefas);
    if(v){
      [t,...fam.descendentes(t)].forEach(x=>{_vincIncluidos.add(x.id);if(!_vincFatores[x.id])_vincFatores[x.id]='1';});
    } else {
      _vincIncluidos.clear();
    }
    _renderVinculoModalBody();
  }
  function dividirIrmaosVinc(parentId){
    const fam=Utils.percFamilia(tarefas);
    const parent=tarefas.find(x=>x.id===parentId);if(!parent)return;
    const filhos=fam.filhosDiretos(parent);
    if(filhos.length<2)return;
    // BUG corrigido: o pai ficava marcado com fração "1" (valor cheio) AO MESMO
    // TEMPO que os filhos dividiam o mesmo valor entre si — dobrava o custo em
    // Mão de Obra/Materiais. Ao dividir, o pai (e qualquer neto que já estivesse
    // marcado por engano) sai da seleção; só os filhos diretos ficam valendo.
    _vincIncluidos.delete(parentId);
    fam.descendentes(parent).forEach(d=>_vincIncluidos.delete(d.id));
    filhos.forEach(f=>{_vincIncluidos.add(f.id);_vincFatores[f.id]='1/'+filhos.length;});
    _renderVinculoModalBody();
  }

  async function salvarVinculoLevantamento(){
    const t=tarefas.find(x=>x.id===_vincAlvoId);
    if(!t){Utils.toast('Escolha a tarefa "pai" primeiro.','alerta');return;}
    if(!_vincIncluidos.size){Utils.toast('Marque ao menos uma tarefa.','alerta');return;}
    try{
      Utils.mostrarLoading('Calculando e salvando...');
      // Recarrega do zero o módulo em uso — garante que o valor gravado reflete
      // o levantamento mais recente, mesmo que o modal tenha ficado aberto um tempo.
      await _invalidarLevCache(_vincModulo);
      const ctx={fachadaId:_vincFachadaId,balancimId:_vincBalancimId,vistaId:_vincVistaId,nodeId:_vincNodeId};
      const baseValorReal=_calcularBaseValor(_vincModulo,_vincMetrica,ctx);
      const unidade=_unidadeDaMetrica(_vincModulo,_vincMetrica);
      const cFonte=_campo('fonteQuantidade',_vincTipo),cMod=_campo('levantamentoModulo',_vincTipo),cMet=_campo('levantamentoMetrica',_vincTipo);
      const cFach=_campo('levantamentoFachadaId',_vincTipo),cBal=_campo('levantamentoBalancimId',_vincTipo),cVis=_campo('levantamentoVistaId',_vincTipo);
      const cNode=_campo('levantamentoNodeId',_vincTipo),cFator=_campo('levantamentoFator',_vincTipo),cOrigem=_campo('levantamentoOrigemId',_vincTipo);
      const cQtd=_campo('quantidade',_vincTipo),cUnid=_campo('unidade',_vincTipo);

      // Desfaz vínculos deste mesmo grupo (mesmo tipo) que ficaram desmarcados agora
      // (edição declarativa: o que está marcado AGORA é o que vale).
      const antigos=tarefas.filter(x=>x[cOrigem]===_vincAlvoId);
      for(const antigo of antigos){
        if(!_vincIncluidos.has(antigo.id)){
          await Database.atualizar(obraId,COL,antigo.id,{[cFonte]:'manual',[cOrigem]:''});
          antigo[cFonte]='manual';antigo[cOrigem]='';
        }
      }
      // Grava os marcados
      for(const id of _vincIncluidos){
        const alvo=tarefas.find(x=>x.id===id);if(!alvo)continue;
        const fator=_parseFracao(_vincFatores[id]||'1');
        const data={[cFonte]:'levantamento',[cMod]:_vincModulo,[cMet]:_vincMetrica,
          [cFach]:_vincFachadaId||'',[cBal]:_vincBalancimId||'',[cVis]:_vincVistaId||'',
          [cNode]:_vincNodeId||'',
          [cFator]:fator,[cOrigem]:_vincAlvoId,[cQtd]:baseValorReal*fator,[cUnid]:unidade};
        await Database.atualizar(obraId,COL,id,data);
        Object.assign(alvo,data);
      }
      Utils.fecharModal('modal-planej-vinculo');
      Utils.toast(`Vínculo salvo em ${_vincIncluidos.size} tarefa(s)!`,'sucesso');
      _vincAlvoId=null;
      if(modoView==='vinculos')_renderVinculosView();
    }catch(e){console.error(e);Utils.toast('Erro ao salvar vínculo.','erro');}
    finally{Utils.esconderLoading();}
  }

  // Remover: cascateia para TODOS os descendentes reais (hierarquia do
  // Planejamento) que também estejam vinculados a levantamento NESSE MESMO TIPO
  // — não faz sentido o pai voltar a manual e os filhos ficarem com o valor antigo.
  // Baseado na árvore de tarefas (não depende de nenhum campo de rastreio),
  // então funciona tanto pra vínculos novos quanto pra vínculos antigos.
  async function removerVinculoLevantamento(tarefaId,tipo){
    tipo=tipo||_vincTipo;
    const cFonte=_campo('fonteQuantidade',tipo),cOrigem=_campo('levantamentoOrigemId',tipo);
    const t=tarefas.find(x=>x.id===tarefaId);if(!t)return;
    const fam=Utils.percFamilia(tarefas);
    const descVinculados=fam.descendentes(t).filter(d=>d[cFonte]==='levantamento');
    const grupo=[t,...descVinculados];
    const msg=grupo.length>1
      ?`Remover o vínculo de "${t.nome}" e das outras ${grupo.length-1} tarefa(s) vinculada(s) abaixo dela (filhos/netos)?`
      :`Remover o vínculo de "${t.nome}"?`;
    if(!Utils.confirmar(msg))return;
    try{
      for(const g of grupo){
        await Database.atualizar(obraId,COL,g.id,{[cFonte]:'manual',[cOrigem]:''});
        g[cFonte]='manual';g[cOrigem]='';
      }
      Utils.toast(`${grupo.length} vínculo(s) removido(s).`,'sucesso');
      Utils.fecharModal('modal-planej-vinculo');
      _vincAlvoId=null;
      if(modoView==='vinculos')_renderVinculosView();
    }catch(e){Utils.toast('Erro.','erro');}
  }

  async function recalcularVinculosLevantamento(){
    let totalRecalculado=0;
    try{
      Utils.mostrarLoading('Recalculando...');
      // BUG CRÍTICO corrigido: recalculava chamando _calcularMetrica sem passar o
      // nodeId — pra qualquer vínculo de Piso/Teto/Paredes filtrado por local
      // (ex: só o Apto 301), o recálculo devolvia o total da OBRA INTEIRA por
      // engano, substituindo um valor certo por um errado. Também só recarregava
      // a Fachada; Piso/Teto/Paredes/Concreto/Ar continuavam com dado velho.
      await _invalidarLevCache(); // recarrega TODOS os módulos do zero
      // Recalcula os 3 tipos de vínculo (Geral, Mão de Obra, Materiais) — cada
      // um pode ter uma fonte diferente pra mesma tarefa.
      for(const tipo of ['geral','maoObra','material']){
        const cFonte=_campo('fonteQuantidade',tipo),cMod=_campo('levantamentoModulo',tipo),cMet=_campo('levantamentoMetrica',tipo);
        const cFach=_campo('levantamentoFachadaId',tipo),cBal=_campo('levantamentoBalancimId',tipo),cVis=_campo('levantamentoVistaId',tipo);
        const cNode=_campo('levantamentoNodeId',tipo),cFator=_campo('levantamentoFator',tipo);
        const cQtd=_campo('quantidade',tipo),cUnid=_campo('unidade',tipo);
        const alvo=tarefas.filter(t=>t[cFonte]==='levantamento');
        for(const t of alvo){
          const ctx={fachadaId:t[cFach],balancimId:t[cBal],vistaId:t[cVis],nodeId:t[cNode]};
          const base=_calcularBaseValor(t[cMod],t[cMet],ctx);
          const fator=t[cFator]!=null?t[cFator]:1;
          const valor=base*fator;
          const unidade=_unidadeDaMetrica(t[cMod],t[cMet]);
          await Database.atualizar(obraId,COL,t.id,{[cQtd]:valor,[cUnid]:unidade});
          t[cQtd]=valor;t[cUnid]=unidade;
        }
        totalRecalculado+=alvo.length;
      }
      if(!totalRecalculado){Utils.toast('Nenhuma tarefa vinculada a levantamento.','alerta');return;}
      Utils.toast(`${totalRecalculado} vínculo(s) recalculado(s)!`,'sucesso');
      if(modoView==='vinculos')_renderVinculosView();
    }catch(e){console.error(e);Utils.toast('Erro ao recalcular.','erro');}
    finally{Utils.esconderLoading();}
  }

  function _renderGantt(visCols){
    const tf=filtradas;
    if(!tf.length)return`<div class="estado-vazio"><div class="icone">📅</div><p>Nenhuma tarefa.</p></div>`;

    const totalH=tf.length*ROW_H;
    const hoje=new Date();
    const datas=tf.flatMap(t=>[_vIni(t),_vFim(t)].filter(Boolean).map(d=>new Date(d)));
    const dMin=datas.length?new Date(Math.min(...datas)):new Date(hoje.getTime()-30*864e5);
    const dMax=datas.length?new Date(Math.max(...datas)):new Date(hoje.getTime()+60*864e5);
    dMin.setDate(dMin.getDate()-5);dMax.setDate(dMax.getDate()+10);
    const lpd={dia:32,semana:8,mes:3,trimestre:1.2,ano:0.4}[zoomGantt]||3;
    const W=Math.max(600,Math.round(Math.ceil((dMax-dMin)/864e5)*lpd));

    // Header colunas
    const hdr=visCols.map(id=>{
      const w=id==='nome'?(colLarguras['nome']?`width:${colLarguras['nome']}px;flex-shrink:0;`:'flex:1;min-width:150px;'):`width:${colLarguras[id]||60}px;flex-shrink:0;`;
      if(id==='status'){
        return`<div style="${w}position:relative;padding:0;display:flex;align-items:center;justify-content:center;">
          <span onclick="event.stopPropagation();Planejamento.toggleStatusFiltro()" style="cursor:pointer;font-size:.72rem;color:${statusFiltro.size?'var(--cor-primaria)':'#666'};">▼</span>
        </div>`;
      }
      // sel e acoes: sem handle, sem data-hcol
      if(id==='sel'||id==='acoes'){
        return`<div style="${w}padding:0 4px;font-size:.63rem;font-weight:700;color:#555;text-transform:uppercase;overflow:hidden;white-space:nowrap;display:flex;align-items:center;">${COL_LABELS[id]||id}</div>`;
      }
      // 'nome' e todas as colunas não-fixas: têm data-hcol + handle de resize
      const podeResize=!COL_FIXED.has(id)||id==='nome'||id==='num';
      return`<div data-hcol="${id}" style="${w}position:relative;padding:0 4px;font-size:.63rem;font-weight:700;color:#555;text-transform:uppercase;overflow:hidden;white-space:nowrap;display:flex;align-items:center;user-select:none;cursor:pointer;"
        oncontextmenu="event.preventDefault();Planejamento.hideCol('${id}')"
        title="Clique direito: mover/esconder coluna">${COL_LABELS[id]||id}${podeResize?'<div onpointerdown="Planejamento._colResizeStart(event,\''+id+'\')" style="position:absolute;right:-2px;top:0;bottom:0;width:10px;cursor:col-resize;z-index:5;" title="Arrastar para redimensionar"></div>':''}</div>`;
    }).join('');

    // Datas header gantt
    const hDatas=_buildDateHeader(dMin,dMax,lpd,W);
    const hojeX=Math.round((hoje-dMin)/864e5*lpd);

    return`<div id="gantt-c" style="display:flex;border:1px solid #222;border-radius:6px;overflow:hidden;flex:1;min-height:300px;max-height:calc(100dvh - 180px);">
      <div id="g-esq" style="width:${ganttVisible?splitX+'px':'100%'};flex-shrink:${ganttVisible?'0':'1'};background:#111;display:flex;flex-direction:column;overflow:hidden;${ganttVisible?'':'flex:1;'}">
        <div style="height:26px;background:#0d0d0d;border-bottom:1px solid #222;display:flex;align-items:center;flex-shrink:0;overflow:hidden;" id="g-esq-hdr">
          <div style="display:flex;align-items:center;min-width:${_totalColWidth(visCols)}px;height:100%;">${hdr}</div>
        </div>
        <div id="g-esq-s" style="overflow:auto;flex:1;cursor:grab;" onscroll="Planejamento._sync(this)" onpointerdown="Planejamento._esqDragStart(event)">
          <div style="height:${totalH}px;position:relative;min-width:${_totalColWidth(visCols)}px;" id="g-esq-v"></div>
        </div>
      </div>
      ${ganttVisible?`<div id="g-div" style="width:4px;background:var(--cor-primaria);cursor:col-resize;flex-shrink:0;opacity:.7;position:relative;touch-action:none;" onpointerdown="Planejamento._divStart(event)"><div style="position:absolute;top:0;bottom:0;left:-10px;right:-10px;cursor:col-resize;"></div></div>
      <div id="g-dir" style="flex:1;min-width:0;background:#0d0d0d;display:flex;flex-direction:column;overflow:hidden;">
        <div style="height:26px;background:#0a0a0a;border-bottom:1px solid #222;overflow:hidden;flex-shrink:0;" id="g-hdr-d">
          <div style="width:${W}px;height:100%;position:relative;">${hDatas}</div>
        </div>
        <div id="g-dir-s" style="overflow:auto;flex:1;" onscroll="Planejamento._sync(this)">
          <div style="width:${W}px;height:${totalH}px;position:relative;" id="g-dir-v">
            <div id="gantt-hoje" style="position:absolute;left:${hojeX}px;top:0;bottom:0;width:2px;background:var(--cor-primaria);opacity:.8;z-index:5;pointer-events:none;">
              <div style="position:absolute;top:0;left:-14px;background:var(--cor-primaria);color:#000;font-size:.5rem;font-weight:800;padding:1px 3px;border-radius:2px;">Hoje</div>
            </div>
          </div>
        </div>
      </div>`:''}
    </div>`;
  }

  // ===================== VIRTUAL ROWS =====================
  function _paintRows(){
    const esqS=document.getElementById('g-esq-s');if(!esqS)return;
    const vH=esqS.clientHeight, st=esqS.scrollTop;
    const s=Math.max(0,Math.floor(st/ROW_H)-3);
    const e=Math.min(filtradas.length,Math.ceil((st+vH)/ROW_H)+3);
    const visCols=colOrdem.filter(id=>!colsHidden.has(id));

    // Se há uma célula em edição (input aberto), não recria as linhas do DOM —
    // isso destruiria o input e apagaria o que o usuário está digitando.
    // Só recria as barras do Gantt (lado direito), que não têm inputs.
    if(_editandoCelula){
      _paintGanttOnly(s,e,visCols);
      return;
    }

    const hoje=new Date();
    const datas=filtradas.flatMap(t=>[_vIni(t),_vFim(t)].filter(Boolean).map(d=>new Date(d)));
    const dMin=datas.length?new Date(Math.min(...datas)):new Date(hoje.getTime()-30*864e5);
    dMin.setDate(dMin.getDate()-5);
    const lpd={dia:32,semana:8,mes:3,trimestre:1.2,ano:0.4}[zoomGantt]||3;

    let rH='', bH='';
    for(let i=s;i<e;i++){
      const t=filtradas[i], y=i*ROW_H;
      try{
      const sel=i===selectedIdx, isG=t.tipo==='grupo';
      const st2=_status(t), perc=_perc(t);
      const isDragged=t.id===_dragTaskId;
      const isDropAlvo=t.id===_dropTargetId;

      // Build row cells
      let cells='';
      for(const cid of visCols){
        const w=cid==='nome'?(colLarguras['nome']?`width:${colLarguras['nome']}px;flex-shrink:0;`:'flex:1;min-width:150px;'):`width:${colLarguras[cid]||60}px;flex-shrink:0;`;
        const base=`${w}overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding:0 4px;font-size:.78rem;height:100%;display:flex;align-items:center;`;
        const editable=COL_EDITABLE.has(cid);
        const clickEdit=editable?`onclick="Planejamento._editCell(event,${i},'${cid}')"`:cid==='num'?`onclick="Planejamento.selectIdx(${i})"`:''

        if(cid==='sel'){
          cells+=`<div style="${base}justify-content:center;">
            <input type="checkbox" ${selecionados.has(t.id)?'checked':''} onclick="event.stopPropagation();Planejamento.toggleSel('${t.id}')" style="cursor:pointer;width:13px;height:13px;"></div>`;
        } else if(cid==='status'){
          const stInfo=STATUS_INFO[st2]||STATUS_INFO.em_dia;
          cells+=`<div style="${base}justify-content:center;" title="${stInfo.label}">
            <span style="width:9px;height:9px;border-radius:50%;background:${stInfo.cor};display:inline-block;"></span></div>`;
        } else if(cid==='num'){
          cells+=`<div style="${base}color:#444;font-family:var(--font-mono);font-size:.65rem;justify-content:center;cursor:pointer;" ${clickEdit}>${t._numLinha||i+1}</div>`;
        } else if(cid==='nivel'){
          const cor=_corNivel(t.nivel||0);
          cells+=`<div style="${base}justify-content:center;cursor:pointer;" ${clickEdit}>
            <span style="background:${cor};color:#000;font-weight:800;font-family:var(--font-mono);font-size:.65rem;padding:1px 6px;border-radius:3px;min-width:16px;text-align:center;">${t.nivel||0}</span></div>`;
        } else if(cid==='codigo'){
          cells+=`<div style="${base}color:#555;font-family:var(--font-mono);font-size:.7rem;cursor:pointer;" ${clickEdit}>${t.codigo||''}</div>`;
        } else if(cid==='nome'){
          const ind=(t.nivel||0)*20;
          const tIdx=tarefas.sort((a,b)=>(a.ordem||0)-(b.ordem||0)).findIndex(x=>x.id===t.id);
          const temF=tIdx>=0&&tIdx<tarefas.length-1&&(tarefas[tIdx+1].nivel||0)>(t.nivel||0);
          const tog=temF?`<span onclick="event.stopPropagation();Planejamento.toggleRecolher('${t.id}')" style="cursor:pointer;color:${colsRecolhidas.has(t.id)?'#888':'#555'};font-size:.85rem;margin-right:4px;flex-shrink:0;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;border-radius:3px;background:rgba(255,255,255,.06);" title="${colsRecolhidas.has(t.id)?'Expandir família':'Recolher família'}">${colsRecolhidas.has(t.id)?'▶':'▼'}</span>`:'';
          const guia=(t.nivel||0)>0?`<span style="position:absolute;left:${ind-13}px;top:0;bottom:0;width:1px;background:rgba(255,255,255,.08);"></span>`:'';
          cells+=`<div data-col="nome" style="${base}padding-left:${ind+4}px;cursor:pointer;position:relative;" ${clickEdit} title="${t.nome}">
            ${guia}${tog}<span style="color:${isG?'var(--cor-primaria)':'#ccc'};font-weight:${isG?700:400};overflow:hidden;text-overflow:ellipsis;">${t.nome||''}</span></div>`;
        } else if(cid==='inicio'){
          const vv=t[VERSAO_CAMPOS[_versaoData].ini];
          cells+=`<div style="${base}color:${vv?'#666':'#3a3a3a'};font-size:.7rem;justify-content:center;cursor:pointer;" ${clickEdit}>${vv?_fd(vv):'—'}</div>`;
        } else if(cid==='termino'){
          const vv=t[VERSAO_CAMPOS[_versaoData].fim];
          cells+=`<div style="${base}color:${vv?'#666':'#3a3a3a'};font-size:.7rem;justify-content:center;cursor:pointer;" ${clickEdit}>${vv?_fd(vv):'—'}</div>`;
        } else if(cid==='inicioReal'){
          cells+=`<div style="${base}color:${t.inicioReal?'#888':'#3a3a3a'};font-size:.7rem;justify-content:center;${_liberarEdicaoReal?'cursor:pointer;':''}" ${_liberarEdicaoReal?clickEdit:''} title="${_liberarEdicaoReal?'Edição liberada manualmente':'Preenchido via Diário de Obra, Medições ou Semanal — clique em 🔒 Liberar Edição de Real pra editar aqui'}">${t.inicioReal?_fd(t.inicioReal):'—'}</div>`;
        } else if(cid==='terminoReal'){
          cells+=`<div style="${base}color:${t.terminoReal?'#888':'#3a3a3a'};font-size:.7rem;justify-content:center;${_liberarEdicaoReal?'cursor:pointer;':''}" ${_liberarEdicaoReal?clickEdit:''} title="${_liberarEdicaoReal?'Edição liberada manualmente':'Preenchido via Diário de Obra, Medições ou Semanal — clique em 🔒 Liberar Edição de Real pra editar aqui'}">${t.terminoReal?_fd(t.terminoReal):'—'}</div>`;
        } else if(cid==='duracao'){
          cells+=`<div style="${base}color:#666;font-size:.7rem;justify-content:center;cursor:pointer;" ${clickEdit}>${t.duracao||'—'}</div>`;
        } else if(cid==='percEsp'){
          cells+=`<div style="${base}color:#555;font-size:.7rem;justify-content:center;" title="Calculado automaticamente pela data de hoje dentro do intervalo Início→Término">${_percEsp(t)}%</div>`;
        } else if(cid==='percConc'){
          cells+=`<div style="${base}font-size:.7rem;justify-content:center;color:${perc>=100?'#16a34a':perc>0?'#2563eb':'#555'};cursor:pointer;" ${clickEdit}>${perc}%</div>`;
        } else if(cid==='predecessora'){
          cells+=`<div style="${base}color:#555;font-size:.7rem;justify-content:center;cursor:pointer;" onclick="Planejamento._predCellClick(event,${i})" title="${_esc(_tooltipPred(t))}">${t._predDisplay||'—'}</div>`;
        } else if(cid==='sucessora'){
          cells+=`<div style="${base}color:#666;font-size:.7rem;justify-content:center;" title="${_esc(_tooltipSuc(t._sucessoras))||'Calculado automaticamente — quem tem esta tarefa como predecessora'}">${(t._sucessoras&&t._sucessoras.length)?t._sucessoras.join(', '):'—'}</div>`;
        } else if(cid==='responsavel'){
          cells+=`<div style="${base}color:#555;font-size:.7rem;cursor:pointer;" ${clickEdit}>${t.responsavel||'—'}</div>`;
        } else if(cid==='local'){
          cells+=`<div style="${base}color:#555;font-size:.7rem;cursor:pointer;" ${clickEdit}>${t.local||'—'}</div>`;
        } else if(cid==='vinculoEstrutura'){
          const resumo=_resumoVinculo(t.vinculoEstrutura);
          cells+=`<div style="${base}color:${resumo?'#888':'#3a3a3a'};font-size:.7rem;cursor:pointer;${resumo&&resumo.includes('⚠')?'color:#dc2626;':''}" onclick="Planejamento._abrirVinculoPavimento(${i})" title="Clique pra vincular a um pavimento/apto">${resumo||'—'}</div>`;
        } else if(cid==='grupo'){
          cells+=`<div style="${base}color:#555;font-size:.7rem;cursor:pointer;" ${clickEdit}>${t.grupo||'—'}</div>`;
        } else if(cid==='subgrupo'){
          cells+=`<div style="${base}color:${t.subgrupo?'#ccc':'#555'};font-size:.7rem;cursor:pointer;font-family:var(--font-mono);" ${clickEdit} title="Combina andar + Final (ex: 1° Pav. Final 02 = 12) — em branco quando não há Final (térreo/subsolo/áreas comuns)">${t.subgrupo||'—'}</div>`;
        } else if(cid==='categoria'){
          cells+=`<div style="${base}color:${t.categoria?'#ccc':'#555'};font-size:.7rem;cursor:pointer;" ${clickEdit} title="Preenchido via Importar Correções (planilha categorizada) ou editado aqui">${t.categoria||'—'}</div>`;
        } else if(cid==='subcategoria'){
          cells+=`<div style="${base}color:${t.subcategoria?'#ccc':'#555'};font-size:.7rem;cursor:pointer;" ${clickEdit}>${t.subcategoria||'—'}</div>`;
        } else if(cid==='quantidade'){
          const vinc=t.fonteQuantidade==='levantamento';
          cells+=`<div style="${base}color:${vinc?'var(--cor-primaria)':'#555'};font-size:.7rem;justify-content:flex-end;font-family:var(--font-mono);gap:3px;"
            title="${vinc?'Vinculado a '+(LEVANTAMENTO_MODULOS[t.levantamentoModulo]?.label||t.levantamentoModulo):'Manual'}">
            ${vinc?'🔗 ':''}${t.quantidade?_fQtd(t.quantidade)+' '+(t.unidade||''):'—'}</div>`;
        } else if(cid==='frente'){
          cells+=`<div style="${base}justify-content:center;cursor:pointer;" ${clickEdit}>${t.frenteServico?`<span style="background:${Utils.corFrente(t.frenteServico)};color:#fff;font-size:.62rem;font-weight:700;padding:2px 7px;border-radius:8px;white-space:nowrap;">${t.frenteServico}</span>`:'<span style="color:#666;font-size:.7rem;">—</span>'}</div>`;
        } else if(cid==='equipe'){
          cells+=`<div style="${base}color:#555;font-size:.7rem;justify-content:center;cursor:pointer;" ${clickEdit}>${t.equipeAlocada?t.equipeAlocada+' 👷':'—'}</div>`;
        } else if(cid==='custoMaterial'){
          const cm=custoMaterialPorTarefa.get(t.id)||0;
          cells+=`<div style="${base}color:#8a8;font-size:.68rem;justify-content:flex-end;font-family:var(--font-mono);">${cm?'R$ '+_fMoeda(cm):'—'}</div>`;
        } else if(cid==='custoMaoObra'){
          const cmo=custoMaoObraPorTarefa.get(t.id)||0;
          cells+=`<div style="${base}color:#8a8;font-size:.68rem;justify-content:flex-end;font-family:var(--font-mono);">${cmo?'R$ '+_fMoeda(cmo):'—'}</div>`;
        } else if(cid==='acoes'){
          cells+=`<div style="${base}display:flex;gap:1px;justify-content:center;">
            <button style="background:#222;color:#888;border:1px solid #333;border-radius:3px;cursor:pointer;font-size:.58rem;padding:0 3px;line-height:1.4;" onclick="event.stopPropagation();Planejamento.recuarNivel('${t.id}')" title="Recuar nível">←</button>
            <button style="background:#222;color:#888;border:1px solid #333;border-radius:3px;cursor:pointer;font-size:.58rem;padding:0 3px;line-height:1.4;" onclick="event.stopPropagation();Planejamento.avancarNivel('${t.id}')" title="Avançar nível">→</button>
            <button style="background:#222;color:var(--cor-primaria);border:1px solid #333;border-radius:3px;cursor:pointer;font-size:.58rem;padding:0 3px;line-height:1.4;" onclick="event.stopPropagation();Planejamento._abrirAtualizarPredecessora(${i})" title="Atualizar Predecessora (com motivo)">🔗</button>
            <button style="background:#222;color:#dc2626;border:1px solid #333;border-radius:3px;cursor:pointer;font-size:.58rem;padding:0 3px;line-height:1.4;" onclick="event.stopPropagation();Planejamento.excluirTarefa('${t.id}')" title="Excluir">✕</button>
          </div>`;
        }
      }

      const bordaDrop=isDropAlvo?(_dropPos==='before'?'box-shadow:inset 0 2px 0 var(--cor-primaria);':'box-shadow:inset 0 -2px 0 var(--cor-primaria);'):'';
      // Destaque de busca: resultado atual (cursor) = amarelo vivo; outros resultados = amarelo suave
      const isBuscaCurrent=_buscaTexto&&_buscaResultados[_buscaCursor]?.i===i;
      const isBuscaMatch=_buscaTexto&&_buscaResultados.some(r=>r.i===i);
      const rowBg=isBuscaCurrent?'rgba(245,200,0,.35)':isBuscaMatch?'rgba(245,200,0,.10)':sel?'rgba(245,200,0,.12)':'';
      rH+=`<div data-rowid="${t.id}" style="position:absolute;top:${y}px;left:0;right:0;height:${ROW_H}px;display:flex;align-items:center;border-bottom:1px solid #1a1a1a;background:${rowBg};opacity:${isDragged?'.35':'1'};${bordaDrop}cursor:default;"
        onpointerdown="Planejamento._rowDragStart(event,${i})" oncontextmenu="if(event.ctrlKey)event.preventDefault();">${cells}</div>`;

      // Barra Gantt
      if(ganttVisible&&_vIni(t)&&_vFim(t)){
        const bx=Math.round((new Date(_vIni(t))-dMin)/864e5*lpd);
        const bw=Math.max(4,Math.round((new Date(_vFim(t))-new Date(_vIni(t)))/864e5*lpd));
        const by=y+5, bh=20;
        const cor={em_dia:'#2563eb',em_andamento:'#ca8a04',concluido:'#15803d',alerta:'#c2410c',atrasado:'#dc2626'}[st2]||'#333';
        if(isG){
          bH+=`<div style="position:absolute;left:${bx}px;top:${by+8}px;width:${bw}px;height:5px;background:var(--cor-primaria);border-radius:1px;" title="${t.nome} — ${_fd(_vIni(t))} a ${_fd(_vFim(t))}"></div>`;
        } else {
          bH+=`<div style="position:absolute;left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px;background:${cor};border-radius:3px;overflow:hidden;" title="${t.nome} — ${_fd(_vIni(t))} a ${_fd(_vFim(t))} — ${perc}%">
            <div style="height:100%;width:${perc}%;background:rgba(255,255,255,.25);"></div>
            ${bw>50?`<span style="position:absolute;left:4px;top:4px;font-size:.58rem;color:rgba(255,255,255,.85);white-space:nowrap;overflow:hidden;max-width:${bw-8}px;">${t.nome}</span>`:''}
          </div>`;
        }
      }
      bH+=`<div style="position:absolute;left:0;top:${y}px;width:100%;height:${ROW_H}px;border-bottom:1px solid #1a1a1a;background:${sel?'rgba(245,200,0,.06)':''};pointer-events:none;"></div>`;
      }catch(errLinha){
        console.error('Erro ao renderizar linha',i,t?.id,t?.nome,errLinha);
        rH+=`<div style="position:absolute;top:${y}px;left:0;right:0;height:${ROW_H}px;display:flex;align-items:center;padding:0 8px;background:#2a1414;color:#f87171;font-size:.72rem;border-bottom:1px solid #1a1a1a;">⚠ Erro ao mostrar esta linha (${_esc(t?.nome||t?.id||'?')}) — veja o console (F12)</div>`;
      }
    }

    const ev=document.getElementById('g-esq-v');if(ev)ev.innerHTML=rH;
    if(ganttVisible){
      const dv=document.getElementById('g-dir-v');
      if(dv){
        const hojeEl=document.getElementById('gantt-hoje');
        const hojeHTML=hojeEl?hojeEl.outerHTML:'';
        dv.innerHTML=bH+_setasSvg(s,e,dMin,lpd)+hojeHTML;
      } else {
        console.warn('g-dir-v NÃO ENCONTRADO — Gantt não renderiza barras');
      }
    }
  }

  // ===================== INLINE EDIT =====================
  // Redesenha apenas as barras do Gantt (painel direito), preservando a
  // tabela esquerda (onde pode haver um input aberto em edição).
  function _paintGanttOnly(s,e,visCols){
    const hoje=new Date();
    const datas=filtradas.flatMap(t=>[_vIni(t),_vFim(t)].filter(Boolean).map(d=>new Date(d)));
    const dMin=datas.length?new Date(Math.min(...datas)):new Date(hoje.getTime()-30*864e5);
    dMin.setDate(dMin.getDate()-5);
    const lpd={dia:32,semana:8,mes:3,trimestre:1.2,ano:0.4}[zoomGantt]||3;
    let bH='';
    for(let i=s;i<e;i++){
      const t=filtradas[i], y=i*ROW_H;
      try{
      const perc=_perc(t), isG=t.tipo==='grupo', st2=_status(t);
      bH+=`<div style="position:absolute;left:0;top:${y}px;width:100%;height:${ROW_H}px;border-bottom:1px solid #1a1a1a;"></div>`;
      if(ganttVisible&&_vIni(t)&&_vFim(t)){
        const ini=new Date(_vIni(t)),fim=new Date(_vFim(t));
        const bx=Math.round((ini-dMin)/864e5*lpd);
        const bw=Math.max(4,Math.round((fim-ini)/864e5*lpd));
        const by=y+5,bh=20;
        const cor={em_dia:'#2563eb',em_andamento:'#ca8a04',concluido:'#15803d',alerta:'#c2410c',atrasado:'#dc2626'}[st2]||'#333';
        if(isG){bH+=`<div style="position:absolute;left:${bx}px;top:${by+8}px;width:${bw}px;height:5px;background:var(--cor-primaria);border-radius:1px;" title="${t.nome} — ${_fd(_vIni(t))} a ${_fd(_vFim(t))}"></div>`;}
        else{bH+=`<div style="position:absolute;left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px;background:${cor};border-radius:3px;overflow:hidden;" title="${t.nome} — ${_fd(_vIni(t))} a ${_fd(_vFim(t))} — ${perc}%"><div style="height:100%;width:${perc}%;background:rgba(255,255,255,.25);"></div></div>`;}
      }
      }catch(errLinha){console.error('Erro ao renderizar barra Gantt',i,t?.id,errLinha);}
    }
    const ev=document.getElementById('g-dir-v');if(ev)ev.innerHTML=bH+_setasSvg(s,e,dMin,lpd);
  }

  // Triplo-clique na célula Predecessora abre o popup guiado (já preenchido
  // com o que tiver lá); 1 ou 2 cliques abre o editor de texto normal (aceita
  // várias predecessoras separadas por ";"). Precisa capturar o elemento AGORA
  // (currentTarget vira null fora do handler síncrono do evento) pra poder
  // reusar depois de um pequeno delay.
  let _predClickState={idx:null,count:0,timer:null};
  function _predCellClick(e, idx){
    e.stopPropagation();
    const cell=e.currentTarget;
    if(_predClickState.idx!==idx){
      if(_predClickState.timer)clearTimeout(_predClickState.timer);
      _predClickState={idx,count:0,timer:null};
    }
    _predClickState.count++;
    if(_predClickState.timer)clearTimeout(_predClickState.timer);
    if(_predClickState.count>=3){
      _predClickState={idx:null,count:0,timer:null};
      _predPopup(idx);
      return;
    }
    _predClickState.timer=setTimeout(()=>{
      if(_predClickState.count>0&&_predClickState.count<3&&_predClickState.idx===idx){
        _editCell({stopPropagation:()=>{},currentTarget:cell},idx,'predecessora');
      }
      _predClickState={idx:null,count:0,timer:null};
    },400);
  }

  function _editCell(e, idx, colId){
    e.stopPropagation();
    if(!Permissions.pode('planejamento','editar:celula'))return;
    if(_esqDragMoved)return;
    const t=filtradas[idx]; if(!t)return;
    selectedIdx=idx;
    const cell=e.currentTarget;
    if(!cell)return; // célula pode ter saído do DOM (re-render no meio do clique) — não quebra a tela
    try{
    if((colId==='inicioReal'||colId==='terminoReal')&&!_liberarEdicaoReal)return; // trava de segurança extra
    const map={codigo:'codigo',nome:'nome',
      inicio:VERSAO_CAMPOS[_versaoData].ini,termino:VERSAO_CAMPOS[_versaoData].fim,
      duracao:'duracao',percEsp:'percentualEsperado',percConc:'percentualConcluido',
      predecessora:'predecessora',responsavel:'responsavel',local:'local',grupo:'grupo',frente:'frenteServico',nivel:'nivel',
      categoria:'categoria',subcategoria:'subcategoria',subgrupo:'subgrupo',
      equipe:'equipeAlocada',inicioReal:'inicioReal',terminoReal:'terminoReal'};
    const field=map[colId]; if(!field)return;
    const val=field==='predecessora'?(t._predDisplay||''):(t[field]||'');
    const isDate=colId==='inicio'||colId==='termino'||colId==='inicioReal'||colId==='terminoReal';
    const isNum=colId==='duracao'||colId==='percEsp'||colId==='percConc'||colId==='nivel'||colId==='equipe';
    const isSelect=colId==='frente';

    const input=document.createElement(isSelect?'select':'input');
    if(isSelect){
      input.innerHTML=`<option value="">—</option>${FRENTES.map(f=>`<option value="${f}" ${f===val?'selected':''}>${f}</option>`).join('')}`;
    }else{
      input.type=isDate?'date':isNum?'number':'text';
      input.value=val;
    }
    input.style.cssText='width:100%;height:100%;border:2px solid var(--cor-primaria);background:#1a1a1a;color:#fff;padding:0 4px;font-size:.78rem;font-family:inherit;outline:none;box-sizing:border-box;border-radius:3px;';
    if(isNum){input.min='0';if(colId==='percEsp'||colId==='percConc')input.max='100';}
    cell.innerHTML='';
    cell.appendChild(input);
    input.focus();
    if(!isDate&&!isSelect)input.select();

    _editandoCelula=true; // bloqueia _paintRows de destruir o input
    let saved=false;
    const save=async()=>{
      if(saved)return; saved=true;
      _editandoCelula=false;
      let v=input.value.trim();
      if(isNum)v=parseFloat(v)||0;
      if(field==='duracao'||field==='equipeAlocada')v=parseInt(v)||0;
      
      // Lógica de datas automática — só recalcula Duração quando a
      // versão em edição é a Atual (o campo duracao é único, não
      // versionado; editar Base/Desafio não deve mexer nele).
      const updates={[field]:v};
      if(field==='predecessora'){
        // Usuário digita por número de linha (ex: "5TI+3") — converte pro
        // formato canônico por ID antes de gravar, pra nunca mais quebrar
        // com reordenação (o ID nunca muda, o número de linha muda sempre).
        updates.predecessora=_predTextoParaCanon(v);
      }
      if(_versaoData==='atual'&&field==='inicioPlanejado'&&v){
        // Início editado → MANTÉM a duração e recalcula o Término (igual MS
        // Project: mudar o início não deveria mudar quanto tempo a tarefa
        // dura, só joga ela pra frente/trás no tempo).
        if(t.duracao>0){
          const fim=new Date(v);fim.setDate(fim.getDate()+Number(t.duracao));
          updates.terminoPlanejado=fim.toISOString().split('T')[0];
        } else if(t.terminoPlanejado&&t.terminoPlanejado>=v){
          // Sem duração salva ainda (ex: tarefa nova) — só nesse caso cai pro
          // fallback de calcular a duração a partir do término existente,
          // pra não deixar tudo em branco na primeira vez.
          updates.duracao=Math.max(0,Math.ceil((new Date(t.terminoPlanejado)-new Date(v))/864e5));
        } else if(t.terminoPlanejado&&t.terminoPlanejado<v){
          // Término existente ficou ANTES do novo início (impossível: a tarefa
          // "voltaria no tempo") — arrasta o término junto pro mesmo dia.
          // Foi exatamente esse buraco que deixou 12/08→04/08 salvo no banco.
          updates.terminoPlanejado=v;
          updates.duracao=0;
          Utils.toast('Término ficava antes do novo início — ajustado pro mesmo dia. Defina a duração ou o término correto.','alerta');
        }
      } else if(_versaoData==='atual'&&field==='terminoPlanejado'&&v&&t.inicioPlanejado){
        if(v<t.inicioPlanejado){
          // Término antes do início não existe — rejeita sem salvar nada.
          Utils.toast(`Término (${_fd(v)}) não pode ser antes do Início (${_fd(t.inicioPlanejado)}). Nada foi salvo.`,'erro');
          _paintRows();
          return;
        }
        // Término editado → MANTÉM o início e recalcula a Duração.
        updates.duracao=Math.max(0,Math.ceil((new Date(v)-new Date(t.inicioPlanejado))/864e5));
      } else if(field==='duracao'&&v>0&&t.inicioPlanejado){
        // Duração editada → MANTÉM o início e recalcula o Término.
        const fim=new Date(t.inicioPlanejado);fim.setDate(fim.getDate()+v);
        updates.terminoPlanejado=fim.toISOString().split('T')[0];
      } else if(field==='predecessora'&&updates.predecessora){
        // Predecessora: calcula datas a partir do vínculo canônico (por ID)
        _calcPredecessora(t, updates.predecessora, updates);
      }
      
      // Se mudou nível, move filhos também
      if(field==='nivel'){
        const diff=v-(t.nivel||0);
        if(diff!==0){
          // Atualiza local
          t.nivel=v;
          // Move filhos
          const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
          const idx2=sorted.findIndex(x=>x.id===t.id);
          const childUpdates=[];
          for(let i=idx2+1;i<sorted.length;i++){
            if((sorted[i].nivel||0)>(t.nivel||0)-diff){
              sorted[i].nivel=Math.max(0,(sorted[i].nivel||0)+diff);
              childUpdates.push({id:sorted[i].id,nivel:sorted[i].nivel});
            } else break;
          }
          _buildFiltradas();_render();requestAnimationFrame(()=>_paintRows());
          // Save in background
          await Database.atualizar(obraId,COL,t.id,{nivel:v}).catch(console.error);
          for(const cu of childUpdates){
            await Database.atualizar(obraId,COL,cu.id,{nivel:cu.nivel}).catch(console.error);
          }
          return;
        }
      }
      
      // Salva estado para undo antes de qualquer mudança
      _undoPush();
      const _valAntes=t[field];
      // Atualiza local
      Object.assign(t, updates);
      if(field==='predecessora'){
        // _sucessoras é calculado em _buildFiltradas() a partir da predecessora
        // de TODO MUNDO — precisa recalcular geral, senão a tarefa que passou
        // a ser predecessora não aparece com a sucessora nova até o próximo
        // reload (bug relatado pelo Milton).
        _buildFiltradas();
      }
      Audit.campo(obraId,'Planejamento',t.id,t.nome,field,_valAntes,v).catch(()=>{});

      // ===== % EM FAMÍLIA (mão dupla) =====
      // Editou % de um PAI → distribui para todos os descendentes.
      // Editou % de uma FOLHA → recalcula os ancestrais (média ponderada
      // pela quantidade dos filhos; sem quantidade em todos, média simples).
      let famUps=[];
      if(field==='percentualConcluido'){
        const fam=Utils.percFamilia(tarefas);
        const ehPai=fam.filhosDiretos(t).length>0;
        if(ehPai){
          const descCheck=fam.descendentes(t);
          if(descCheck.length>3&&!confirm(`"${t.nome}" tem ${descCheck.length} tarefas descendentes. Salvar ${v}% vai SOBRESCREVER o % de todas elas. Confirmar?`)){
            t[field]=_valAntes; // desfaz a mudança local — nada foi salvo ainda
            _paintRows();
            return;
          }
          famUps=Utils.distribuirPercDescendentes(tarefas,t.id,v);
          // Depois de nivelar os descendentes, ancestrais do pai também mudam
          famUps=famUps.concat(Utils.recalcularPercAncestrais(tarefas,t.id));
          if(famUps.length)Utils.toast(`% aplicado a ${famUps.length} tarefa(s) da família.`,'sucesso');
        } else {
          famUps=Utils.recalcularPercAncestrais(tarefas,t.id);
        }
      }
      if(field==='predecessora')_render(); else _paintRows();

      // Save in background
      try{
        await Database.atualizar(obraId,COL,t.id,updates);
        for(const u of famUps){
          await Database.atualizar(obraId,COL,u.id,{percentualConcluido:u.percentualConcluido});
        }
        if(_versaoData==='atual'&&(field==='inicioPlanejado'||field==='terminoPlanejado'||field==='inicioReal'||field==='terminoReal')){
          const paisAlterados=await _recalcularDatasPais(true);
      await _recalcularPercTodosPais(true);
          for(const p of paisAlterados)await _propagarDataEmCascata(p.id);
        }
        if(_versaoData==='atual'&&(field==='inicioPlanejado'||field==='terminoPlanejado')){
          // A predecessora só funciona de verdade se, quando a data de uma
          // tarefa muda, a data de quem depende dela (sucessora) também
          // muda automaticamente — senão é só um número decorativo salvo,
          // sem efeito matemático real no cronograma.
          await _propagarDataEmCascata(t.id);
        }
      }
      catch(er){console.error(er);Utils.toast('Erro ao salvar.','erro');}
    };
    
    input.addEventListener('blur',save);
    input.addEventListener('keydown',ev=>{
      if(ev.key==='Enter'){ev.preventDefault();input.blur();}
      if(ev.key==='Escape'){saved=true;_editandoCelula=false;_paintRows();}
    });
    // Para spinners de number e o select de Frente: salva ao mudar valor
    if(isNum||isSelect){
      input.addEventListener('change',()=>{input.blur();});
    }
    }catch(errCel){
      console.error('Erro ao abrir edição da célula:',colId,errCel);
      Utils.toast('Erro ao editar essa célula — veja o console (F12).','erro');
      _editandoCelula=false;
    }
  }
  
  // Calcula datas baseado na predecessora (tipo MS Project)
  // Aceita uma ou várias predecessoras separadas por ";" (ex: "7TI; 98II+10d") —
  // nesse caso usa a mais restritiva (a que resulta na data mais tardia),
  // que é a regra padrão de CPM/MS Project para múltiplas dependências.
  // Aceita uma ou várias predecessoras separadas por ";" (ex: "id1|TI|;id2|II|+10") —
  // nesse caso usa a mais restritiva (a que resulta na data mais tardia),
  // que é a regra padrão de CPM/MS Project para múltiplas dependências.
  // predCanon: formato CANÔNICO por ID (não mais texto por número de linha) —
  // ver _predParse/_predTextoParaCanon.
  function _calcPredecessora(t, predCanon, updates){
    const partes=_predParse(predCanon);
    if(!partes.length)return;
    let melhorIni=null, melhorFim=null;
    for(const parte of partes){
      const r=_calcUmaPredecessora(t,parte);
      if(!r)continue;
      if(r.inicioPlanejado&&(!melhorIni||r.inicioPlanejado>melhorIni))melhorIni=r.inicioPlanejado;
      if(r.terminoPlanejado&&(!melhorFim||r.terminoPlanejado>melhorFim))melhorFim=r.terminoPlanejado;
    }
    if(melhorIni)updates.inicioPlanejado=melhorIni;
    if(melhorFim)updates.terminoPlanejado=melhorFim;
  }

  // parte: {id,tipo,lag} — resolve DIRETO por ID, nunca por posição/número de linha.
  // TI = Término-Início (mais comum) · II = Início-Início · TT = Término-Término · IT = Início-Término
  // Propaga a mudança de data em cadeia: quando a tarefa X muda de data,
  // TODAS as tarefas que têm X como predecessora precisam recalcular a
  // própria data também — e se a data delas mudar, propaga pras sucessoras
  // DELAS, e assim por diante. É isso que faz a predecessora funcionar de
  // verdade (matematicamente), não só ficar um número salvo sem efeito.
  async function _propagarDataEmCascata(tarefaId, visitados){
    visitados=visitados||new Set();
    if(visitados.has(tarefaId))return; // corta dependência circular
    visitados.add(tarefaId);
    const t=_porId.get(tarefaId);
    if(!t||!t._sucessoras||!t._sucessoras.length)return;
    for(const numLinha of t._sucessoras){
      const suc=_numLinhaMap.get(numLinha);
      if(!suc||!suc.predecessora)continue;
      const upd={};
      _calcPredecessora(suc,suc.predecessora,upd);
      const mudouIni=upd.inicioPlanejado&&upd.inicioPlanejado!==suc.inicioPlanejado;
      const mudouFim=upd.terminoPlanejado&&upd.terminoPlanejado!==suc.terminoPlanejado;
      if(mudouIni||mudouFim){
        Object.assign(suc,upd);
        await Database.atualizar(obraId,COL,suc.id,upd).catch(console.error);
        await _propagarDataEmCascata(suc.id,visitados); // propaga mais adiante na cadeia
      }
    }
  }

  function _calcUmaPredecessora(t, parte){
    const pred=_porId.get(parte.id)||tarefas.find(x=>x.id===parte.id);
    if(!pred)return null;
    const tipo=(parte.tipo||'TI').toUpperCase();
    const defasagem=parseInt(parte.lag)||0;
    
    let dataRef;
    if(tipo==='TI') dataRef=pred.terminoPlanejado; // Após término da pred
    else if(tipo==='II') dataRef=pred.inicioPlanejado; // Junto com início da pred
    else if(tipo==='TT') dataRef=pred.terminoPlanejado; // Término junto com término da pred
    else if(tipo==='IT') dataRef=pred.inicioPlanejado; // Término junto com início da pred
    
    if(!dataRef)return null;
    
    const dt=new Date(dataRef);
    dt.setDate(dt.getDate()+defasagem+(tipo==='TI'?1:0)); // TI: começa no dia seguinte
    
    const r={};
    if(tipo==='TI'||tipo==='II'){
      r.inicioPlanejado=dt.toISOString().split('T')[0];
      if(t.duracao){
        const fim=new Date(dt);fim.setDate(fim.getDate()+t.duracao);
        r.terminoPlanejado=fim.toISOString().split('T')[0];
      }
    } else {
      r.terminoPlanejado=dt.toISOString().split('T')[0];
      if(t.duracao){
        const ini=new Date(dt);ini.setDate(ini.getDate()-t.duracao);
        r.inicioPlanejado=ini.toISOString().split('T')[0];
      }
    }
    return r;
  }

  // ===================== SYNC SCROLL =====================
  function _sync(src){
    const es=document.getElementById('g-esq-s');
    const ds=document.getElementById('g-dir-s');
    const hd=document.getElementById('g-hdr-d');
    const eh=document.getElementById('g-esq-hdr');
    if(src===es){
      if(ds)ds.scrollTop=es.scrollTop;
      if(eh)eh.scrollLeft=es.scrollLeft; // cabeçalho da tabela acompanha o scroll horizontal
    }
    else if(src===ds&&es){es.scrollTop=ds.scrollTop;if(hd)hd.scrollLeft=ds.scrollLeft;}
    if(_rafId)cancelAnimationFrame(_rafId);
    _rafId=requestAnimationFrame(()=>_paintRows());
  }

  // ===================== ARRASTAR TABELA HORIZONTALMENTE =====================
  // Clique e arraste sobre a tabela (painel esquerdo) para rolar na horizontal,
  // além do scroll normal (barra/trackpad). Usa Pointer Capture para não
  // travar se o clique for solto fora da área (mesmo problema já corrigido
  // no resize de colunas e no divisor).
  let _esqDragMoved=false;
  function _esqDragStart(e){
    if(e.button!==0)return;
    const el=e.currentTarget;
    const sx=e.clientX, startScroll=el.scrollLeft;
    _esqDragMoved=false;
    let dragging=false, captured=false;

    const move=ev=>{
      const dx=ev.clientX-sx;
      if(!dragging&&Math.abs(dx)>4){
        dragging=true;_esqDragMoved=true;el.style.cursor='grabbing';
        // Só captura o ponteiro quando confirma que é arrasto de verdade —
        // capturar cedo demais (num clique normal) sequestra o clique de
        // tudo dentro da tabela (toggle ▼, edição de célula, botões ←→✕)
        if(!captured){try{el.setPointerCapture(e.pointerId);captured=true;}catch(err){}}
      }
      if(dragging){el.scrollLeft=startScroll-dx;}
    };
    const up=()=>{
      el.removeEventListener('pointermove',move);
      el.removeEventListener('pointerup',up);
      el.removeEventListener('pointercancel',up);
      if(captured){try{el.releasePointerCapture(e.pointerId);}catch(err){}}
      el.style.cursor='grab';
      // Pequeno atraso pra não disparar clique/edição de célula logo após um arrasto real
      if(dragging)setTimeout(()=>{_esqDragMoved=false;},50);
    };
    el.addEventListener('pointermove',move);
    el.addEventListener('pointerup',up);
    el.addEventListener('pointercancel',up);
  }

  // Cor cíclica por nível hierárquico — ajuda a diferenciar visualmente
  // vários grupos do mesmo nível em sequência (ex: vários níveis 3
  // seguidos, cada um com filhos nível 4 próprios).
  const _PALETA_NIVEL=['#F5C800','#60a5fa','#4ade80','#f472b6','#fb923c','#a78bfa','#2dd4bf'];
  function _corNivel(nivel){return _PALETA_NIVEL[nivel%_PALETA_NIVEL.length];}

  // ===================== SELEÇÃO MÚLTIPLA (checkbox) =====================
  function toggleSel(id){
    if(selecionados.has(id))selecionados.delete(id);else selecionados.add(id);
    _paintRows();
    _atualizarBarraSelecao();
  }
  function _limparSelecao(){selecionados.clear();_paintRows();_atualizarBarraSelecao();}

  function _renderBarraSelecao(){
    if(!selecionados.size)return'';
    return`<div id="barra-selecao" style="position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid var(--cor-primaria);border-radius:10px;padding:10px 16px;box-shadow:0 8px 32px rgba(0,0,0,.6);z-index:500;display:flex;align-items:center;gap:14px;">
      <span style="font-size:.8rem;color:#fff;font-weight:700;">${selecionados.size} tarefa${selecionados.size>1?'s':''} selecionada${selecionados.size>1?'s':''}</span>
      <button onclick="Planejamento._limparSelecao()" style="background:none;border:none;color:#888;cursor:pointer;font-size:1rem;line-height:1;">✕</button>
      <span style="width:1px;height:20px;background:#333;"></span>
      <button class="btn btn-secundario btn-sm" onclick="Planejamento._moverSel(-1)" title="Mover linha acima">↑ Acima</button>
      <button class="btn btn-secundario btn-sm" onclick="Planejamento._moverSel(1)" title="Mover linha abaixo">↓ Abaixo</button>
      <button class="btn btn-secundario btn-sm" onclick="Planejamento._bulkNivel(-1)" title="Recuar nível">← Recuar</button>
      <button class="btn btn-secundario btn-sm" onclick="Planejamento._bulkNivel(1)" title="Avançar nível">→ Avançar</button>
      <button class="btn btn-secundario btn-sm" onclick="Planejamento._bulkDuplicar()" title="Duplicar selecionadas">⧉ Duplicar</button>
      <button class="btn btn-perigo btn-sm" data-perm="planejamento:excluir:bulk" onclick="Planejamento._bulkExcluir()" title="Excluir selecionadas">✕ Excluir</button>
    </div>`;
  }
  function _atualizarBarraSelecao(){
    // Re-renderiza só a barra (sem recriar o Gantt inteiro) para performance
    const antiga=document.getElementById('barra-selecao');
    if(antiga)antiga.remove();
    const c=_el();
    if(selecionados.size){
      const div=document.createElement('div');
      div.innerHTML=_renderBarraSelecao();
      c.appendChild(div.firstElementChild);
    }
  }

  async function _bulkNivel(diff){
    const ids=[...selecionados];
    for(const id of ids){
      const t=tarefas.find(x=>x.id===id);
      if(t)t.nivel=Math.max(0,(t.nivel||0)+diff);
    }
    _buildFiltradas();_render();requestAnimationFrame(()=>_paintRows());
    for(const id of ids){
      const t=tarefas.find(x=>x.id===id);
      if(t)await Database.atualizar(obraId,COL,id,{nivel:t.nivel}).catch(console.error);
    }
  }

  async function _bulkDuplicar(){
    const ids=[...selecionados];
    if(!confirm(`Duplicar ${ids.length} tarefa(s) selecionada(s)?`))return;
    Utils.mostrarLoading('Duplicando...');
    try{
      const numAntes=_capturarNumAntes();
      for(const id of ids){
        const t=tarefas.find(x=>x.id===id);
        if(!t)continue;
        const copia={...t};
        delete copia.id;
        copia.nome=(copia.nome||'')+' (cópia)';
        copia.ordem=(copia.ordem||0)+0.5; // fica logo depois do original antes de recalcular
        await Database.criar(obraId,COL,copia);
      }
      selecionados.clear();
      Utils.toast('Tarefas duplicadas!','sucesso');
      await carregar();
      await _remapAposMudancaPosicoes(numAntes);
    }catch(e){console.error(e);Utils.toast('Erro ao duplicar.','erro');}
    finally{Utils.esconderLoading();}
  }

  async function _bulkExcluir(){
    if(!Permissions.pode('planejamento','excluir:bulk')){Utils.toast('Sem permissão para excluir em lote.','erro');return;}
    const ids=[...selecionados];
    if(!confirm(`Excluir ${ids.length} tarefa(s) selecionada(s)? Esta ação não pode ser desfeita.`))return;
    Utils.mostrarLoading('Excluindo...');
    try{
      const numAntes=_capturarNumAntes();
      await Promise.all(ids.map(id=>Database.deletar(obraId,COL,id).catch(console.error)));
      selecionados.clear();
      Utils.toast('Tarefas excluídas!','sucesso');
      await carregar();
      ids.forEach(id=>numAntes.delete(id)); // excluídas não têm "depois"
      await _remapAposMudancaPosicoes(numAntes);
    }catch(e){console.error(e);Utils.toast('Erro ao excluir.','erro');}
    finally{Utils.esconderLoading();}
  }

  // ===================== FILTRO POR STATUS =====================
  function toggleStatusFiltro(){
    let pop=document.getElementById('status-filtro-pop');
    if(pop){pop.remove();return;}
    pop=document.createElement('div');
    pop.id='status-filtro-pop';
    pop.style.cssText='position:fixed;top:120px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:12px;z-index:2000;min-width:200px;box-shadow:0 8px 32px rgba(0,0,0,.5);';
    const itens=Object.entries(STATUS_INFO).map(([key,info])=>`
      <label style="display:flex;align-items:center;gap:8px;padding:5px 2px;cursor:pointer;">
        <input type="checkbox" data-status-key="${key}" ${statusFiltro.has(key)?'checked':''} style="width:13px;height:13px;">
        <span style="width:9px;height:9px;border-radius:50%;background:${info.cor};display:inline-block;flex-shrink:0;"></span>
        <span style="font-size:.8rem;color:#ddd;">${info.label}</span>
      </label>`).join('');
    pop.innerHTML=`<div style="font-weight:700;color:var(--cor-primaria);margin-bottom:8px;font-size:.8rem;">Filtrar por status</div>
      ${itens}
      <button class="btn btn-primario btn-sm" style="width:100%;margin-top:10px;" onclick="Planejamento._aplicarStatusFiltro()">Filtrar</button>`;
    document.body.appendChild(pop);
    setTimeout(()=>document.addEventListener('click',function h(e){if(!pop.contains(e.target)){pop.remove();document.removeEventListener('click',h);}},false),50);
  }
  function _aplicarStatusFiltro(){
    const pop=document.getElementById('status-filtro-pop');if(!pop)return;
    statusFiltro=new Set([...pop.querySelectorAll('input[data-status-key]:checked')].map(i=>i.dataset.statusKey));
    pop.remove();
    _buildFiltradas();_render();requestAnimationFrame(()=>_paintRows());
  }

  // ===================== M4: VER POR RESPONSÁVEL =====================
  // Filtro simples de UI (não é dado de negócio) — não usa campo novo no
  // Firestore, só lê `responsavel` das tarefas já carregadas. Combina (AND)
  // com o filtro de status já existente. Preferência fica em localStorage,
  // mesma categoria de `obra_selecionada` (cache de sessão).
  function _listarResponsaveisDistintos(){
    const vistos=new Set();
    for(const t of tarefas){
      const r=(t.responsavel||'').trim();
      if(r)vistos.add(r);
    }
    return [...vistos].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  }
  function _abrirFiltroResponsavel(){
    let pop=document.getElementById('resp-filtro-pop');
    if(pop){pop.remove();return;}
    const lista=_listarResponsaveisDistintos();
    pop=document.createElement('div');
    pop.id='resp-filtro-pop';
    pop.style.cssText='position:fixed;top:120px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:12px;z-index:2000;min-width:220px;max-height:60vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.5);';
    pop.innerHTML=`<div style="font-weight:700;color:var(--cor-primaria);margin-bottom:8px;font-size:.8rem;">👷 Ver por Responsável</div>
      <label style="display:flex;align-items:center;gap:8px;padding:5px 2px;cursor:pointer;">
        <input type="radio" name="resp-filtro" ${!_filtroResponsavel?'checked':''} onclick="Planejamento._aplicarFiltroResponsavel(this.dataset.resp)" data-resp="">
        <span style="font-size:.8rem;color:#ddd;">Todos</span>
      </label>
      ${lista.length?lista.map(r=>`
      <label style="display:flex;align-items:center;gap:8px;padding:5px 2px;cursor:pointer;">
        <input type="radio" name="resp-filtro" ${_filtroResponsavel===r?'checked':''} onclick="Planejamento._aplicarFiltroResponsavel(this.dataset.resp)" data-resp="${_esc(r)}">
        <span style="font-size:.8rem;color:#ddd;">${_esc(r)}</span>
      </label>`).join(''):'<div style="color:#555;font-size:.78rem;padding:4px 2px;">Nenhum responsável cadastrado ainda.</div>'}`;
    document.body.appendChild(pop);
    setTimeout(()=>document.addEventListener('click',function h(e){if(!pop.contains(e.target)&&!e.target.closest('[onclick*="_abrirFiltroResponsavel"]')){pop.remove();document.removeEventListener('click',h);}},false),50);
  }
  function _aplicarFiltroResponsavel(valor){
    _filtroResponsavel=valor||'';
    try{localStorage.setItem('planej_filtroResponsavel',_filtroResponsavel);}catch(e){}
    const pop=document.getElementById('resp-filtro-pop');if(pop)pop.remove();
    _buildFiltradas();_render();requestAnimationFrame(()=>_paintRows());
  }
  function _limparFiltroResponsavel(){_aplicarFiltroResponsavel('');}

  // ===================== VISÃO ORGANIZACIONAL (máscara de linhas) =====================
  // Ferramenta de "máscara": escolhe quais linhas do Planejamento aparecem —
  // a grid e o Gantt continuam idênticos (mesma tela, mesmos recursos), só
  // que exibindo apenas as tarefas escolhidas. Primeira visão: Gantt filtrado.
  function _visaoOrgChaveLS(){return 'planej_visaoOrg_'+obraId;}
  function _visaoOrgCarregarSalva(){
    try{
      const raw=localStorage.getItem(_visaoOrgChaveLS());
      if(raw){const arr=JSON.parse(raw);if(Array.isArray(arr)&&arr.length){_visaoOrgIds=new Set(arr);_visaoOrgAncOk=false;}}
    }catch(e){}
  }
  // Menu da Visão Organizacional — família de "máscaras" de visão. Hoje:
  // (1) Gantt Filtrado (escolher linhas) e (2) Agrupador de Categoria
  // (reorganiza por Categoria > Subcategoria, sem alterar código/ordem real).
  function _menuVisaoOrg(){
    let pop=document.getElementById('visorg-menu');if(pop){pop.remove();return;}
    pop=document.createElement('div');pop.id='visorg-menu';
    pop.style.cssText='position:fixed;top:90px;right:20px;background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:8px;z-index:1000;min-width:230px;box-shadow:0 8px 32px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:4px;';
    pop.innerHTML=`
      <div style="font-size:.62rem;color:#666;text-transform:uppercase;letter-spacing:.6px;padding:4px 4px 2px;font-weight:700;">Visões</div>
      <button class="btn btn-secundario btn-sm" style="display:block;width:100%;text-align:left;font-size:.75rem;" onclick="document.getElementById('visorg-menu').remove();Planejamento._abrirVisaoOrg()" title="Escolha linha a linha o que aparece (tabela + Gantt idênticos, só filtrados)">📊 Gantt Filtrado (escolher linhas)</button>
      <button class="btn ${modoView==='categoria'?'btn-primario':'btn-secundario'} btn-sm" style="display:block;width:100%;text-align:left;font-size:.75rem;" onclick="document.getElementById('visorg-menu').remove();Planejamento.toggleCategoriaView()" title="Reorganiza as tarefas por Categoria > Subcategoria (Alvenaria, Gesso, Hidráulica...) em vez da estrutura do cronograma — não altera código, ordem nem estrutura real">🏷 Agrupador de Categoria</button>
      ${_visaoOrgIds?'<button class="btn btn-sm" style="display:block;width:100%;text-align:left;font-size:.75rem;background:#dc2626;color:#fff;" onclick="Planejamento._visaoOrgLimpar();document.getElementById(\'visorg-menu\')?.remove()">✕ Limpar visão (mostrar tudo)</button>':''}
    `;
    document.body.appendChild(pop);
    setTimeout(()=>document.addEventListener('click',function h(e){if(!pop.contains(e.target)&&!e.target.closest('[onclick*="_menuVisaoOrg"]')){pop.remove();document.removeEventListener('click',h);}},false),50);
  }

  function _abrirVisaoOrg(){
    let pop=document.getElementById('visorg-modal');if(pop)pop.remove();
    pop=document.createElement('div');pop.id='visorg-modal';
    pop.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:2000;display:flex;align-items:center;justify-content:center;';
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const marcados=_visaoOrgIds||new Set();
    pop.innerHTML=`
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:20px;width:640px;max-width:95vw;max-height:88vh;display:flex;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <div style="font-weight:700;color:var(--cor-primaria);">🗂 Visão Organizacional — Gantt Filtrado</div>
          <span style="cursor:pointer;color:#888;font-size:1.1rem;" onclick="document.getElementById('visorg-modal').remove()">✕</span>
        </div>
        <div style="font-size:.72rem;color:#888;margin-bottom:10px;">Marque as linhas que quer ver — a tela do Planejamento (tabela + Gantt) mostra só elas, com tudo funcionando igual. Clicar num grupo marca/desmarca o bloco inteiro dele.</div>
        <input id="visorg-busca" placeholder="🔍 Filtrar por nome/código..." class="form-control" style="font-size:.8rem;margin-bottom:8px;" oninput="Planejamento._visaoOrgFiltrarLista(this.value)">
        <div id="visorg-lista" style="flex:1;overflow-y:auto;border:1px solid #262626;border-radius:7px;padding:6px;">
          ${sorted.map(t=>`<label data-visorg-linha data-nome="${_esc((t.nome||'').toLowerCase())}" data-cod="${_esc((t.codigo||'').toLowerCase())}" style="display:flex;align-items:center;gap:7px;padding:2px 4px 2px ${4+(t.nivel||0)*18}px;cursor:pointer;font-size:.78rem;color:#ddd;border-bottom:1px solid #1c1c1c;">
            <input type="checkbox" data-visorg-id="${t.id}" ${marcados.has(t.id)?'checked':''} onchange="Planejamento._visaoOrgToggleBloco(this)">
            <span style="${t._numLinha?'':''}color:#666;font-size:.68rem;min-width:28px;">${t._numLinha||''}</span>
            <span style="${(t.tipo==='grupo'||true)&&sorted.some(x=>false)?'':''}${t.nivel===0?'font-weight:700;color:var(--cor-primaria);':''}">${_esc(t.nome||'')}</span>
          </label>`).join('')}
        </div>
        <div style="display:flex;gap:8px;justify-content:space-between;margin-top:12px;">
          <div style="display:flex;gap:8px;">
            <button class="btn btn-secundario btn-sm" onclick="document.querySelectorAll('#visorg-lista input').forEach(c=>c.checked=true)">Marcar tudo</button>
            <button class="btn btn-secundario btn-sm" onclick="document.querySelectorAll('#visorg-lista input').forEach(c=>c.checked=false)">Desmarcar tudo</button>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-secundario btn-sm" onclick="Planejamento._visaoOrgLimpar()">Limpar (mostrar tudo)</button>
            <button class="btn btn-primario btn-sm" onclick="Planejamento._visaoOrgAplicar()">Aplicar</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(pop);
    document.getElementById('visorg-busca')?.focus();
  }
  function _visaoOrgFiltrarLista(txt){
    const q=(txt||'').trim().toLowerCase();
    document.querySelectorAll('#visorg-lista [data-visorg-linha]').forEach(l=>{
      l.style.display=(!q||l.dataset.nome.includes(q)||l.dataset.cod.includes(q))?'flex':'none';
    });
  }
  // Marcar/desmarcar um grupo aplica ao bloco inteiro (o grupo + tudo dentro)
  function _visaoOrgToggleBloco(cb){
    const id=cb.dataset.visorgId;
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const idx=sorted.findIndex(t=>t.id===id);
    if(idx<0)return;
    const niv=sorted[idx].nivel||0;
    const idsBloco=[];
    for(let j=idx+1;j<sorted.length;j++){
      if((sorted[j].nivel||0)<=niv)break;
      idsBloco.push(sorted[j].id);
    }
    if(!idsBloco.length)return; // folha, nada a propagar
    const marcar=cb.checked;
    for(const bid of idsBloco){
      const el=document.querySelector(`#visorg-lista input[data-visorg-id="${bid}"]`);
      if(el)el.checked=marcar;
    }
  }
  function _visaoOrgAplicar(){
    const ids=[...document.querySelectorAll('#visorg-lista input:checked')].map(c=>c.dataset.visorgId);
    const pop=document.getElementById('visorg-modal');if(pop)pop.remove();
    if(!ids.length){_visaoOrgLimpar();return;}
    _visaoOrgIds=new Set(ids);
    _visaoOrgAncOk=false; // recalcula ancestrais no próximo build
    try{localStorage.setItem(_visaoOrgChaveLS(),JSON.stringify(ids));}catch(e){}
    _buildFiltradas();_render();requestAnimationFrame(()=>_paintRows());
    Utils.toast(`Visão aplicada: ${ids.length} linha(s).`,'sucesso');
  }
  function _visaoOrgLimpar(){
    _visaoOrgIds=null;_visaoOrgAncOk=false;
    try{localStorage.removeItem(_visaoOrgChaveLS());}catch(e){}
    const pop=document.getElementById('visorg-modal');if(pop)pop.remove();
    _buildFiltradas();_render();requestAnimationFrame(()=>_paintRows());
  }

  // ===================== AGRUPADOR DE CATEGORIA =====================
  // View independente (mesmo padrão do Editor de Estrutura): NÃO toca em
  // ordem/nível/código real — só reorganiza a EXIBIÇÃO em Categoria >
  // Subcategoria > Tarefas. Categoria/Subcategoria vêm do "Importar
  // Correções" (planilha categorizada, casada por ID). Tarefa sem Categoria
  // cai no grupo "Sem Categoria" — nunca some da visão.
  let _catAbertos=new Set();      // categorias expandidas
  let _subcatAbertos=new Set();   // chaves "categoria|||subcategoria" expandidas
  const SEM_CATEGORIA='Sem Categoria';

  function toggleCategoriaView(){
    modoView=modoView==='categoria'?'gantt':'categoria';
    _render();
  }
  function _catToggle(chave){
    if(_catAbertos.has(chave))_catAbertos.delete(chave);else _catAbertos.add(chave);
    _renderCategoriaView();
  }
  function _subcatToggle(chave){
    if(_subcatAbertos.has(chave))_subcatAbertos.delete(chave);else _subcatAbertos.add(chave);
    _renderCategoriaView();
  }
  function _catExpandirTudo(v){
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    if(v){
      for(const t of sorted){
        if(_arvTemFilhos(t,sorted))continue; // só folhas entram no agrupamento
        const cat=t.categoria||SEM_CATEGORIA;
        _catAbertos.add(cat);
        _subcatAbertos.add(cat+'|||'+(t.subcategoria||'—'));
      }
    } else { _catAbertos.clear(); _subcatAbertos.clear(); }
    _renderCategoriaView();
  }

  function _renderCategoriaView(){
    const c=_el();
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    // Só folhas entram no agrupamento — tarefas de estrutura/grupo (que têm
    // filhos) não são trabalho em si, não fazem sentido numa Categoria.
    const folhas=sorted.filter(t=>!_arvTemFilhos(t,sorted));

    // Monta árvore Categoria -> Subcategoria -> [tarefas]
    const porCat=new Map();
    for(const t of folhas){
      const cat=t.categoria||SEM_CATEGORIA;
      const sub=t.categoria?(t.subcategoria||'—'):SEM_CATEGORIA;
      if(!porCat.has(cat))porCat.set(cat,new Map());
      const porSub=porCat.get(cat);
      if(!porSub.has(sub))porSub.set(sub,[]);
      porSub.get(sub).push(t);
    }
    const categorias=[...porCat.keys()].sort((a,b)=>{
      if(a===SEM_CATEGORIA)return 1;if(b===SEM_CATEGORIA)return-1;
      return a.localeCompare(b,'pt-BR');
    });

    const corBadge=t=>STATUS_INFO[_status(t)]?.cor||'#666';
    const linhaTarefa=t=>`
      <div style="display:flex;align-items:center;gap:8px;padding:4px 8px 4px 54px;border-bottom:1px solid #1c1c1c;cursor:pointer;font-size:.78rem;"
        onmouseenter="this.style.background='rgba(255,255,255,.04)'" onmouseleave="this.style.background='transparent'"
        onclick="Planejamento.editarTarefa('${t.id}')" title="Clique para abrir/editar esta tarefa">
        <span style="width:7px;height:7px;border-radius:50%;background:${corBadge(t)};flex-shrink:0;"></span>
        <span style="flex:1;color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(t.nome||'')}</span>
        <span style="font-size:.68rem;color:#666;font-family:var(--font-mono);min-width:64px;text-align:right;">${_fd(_vIni(t))}</span>
        <span style="font-size:.68rem;color:#666;font-family:var(--font-mono);min-width:64px;text-align:right;">${_fd(_vFim(t))}</span>
        <span style="font-size:.7rem;font-weight:700;min-width:38px;text-align:right;color:${_perc(t)>=100?'#4ade80':'#60a5fa'};">${_perc(t)}%</span>
        <span style="font-size:.68rem;color:#555;min-width:90px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(t.responsavel||'')}</span>
      </div>`;

    const blocoSub=(cat,sub,lista)=>{
      const chaveSub=cat+'|||'+sub;
      const abertoSub=_subcatAbertos.has(chaveSub);
      const media=Math.round(lista.reduce((s,t)=>s+_perc(t),0)/lista.length);
      return `
      <div>
        <div style="display:flex;align-items:center;gap:8px;padding:5px 8px 5px 30px;cursor:pointer;background:rgba(255,255,255,.02);border-bottom:1px solid #1c1c1c;"
          onclick="Planejamento._subcatToggle('${_esc(chaveSub).replace(/'/g,"\\'")}')">
          <span style="width:14px;text-align:center;font-size:.68rem;color:#666;">${abertoSub?'▼':'▶'}</span>
          <span style="flex:1;font-size:.78rem;font-weight:600;color:#bbb;">${_esc(sub)}</span>
          <span style="font-size:.65rem;color:#555;">${lista.length} tarefa${lista.length!==1?'s':''}</span>
          <span style="font-size:.72rem;font-weight:700;min-width:38px;text-align:right;color:${media>=100?'#4ade80':'#60a5fa'};">${media}%</span>
        </div>
        ${abertoSub?lista.map(linhaTarefa).join(''):''}
      </div>`;
    };

    const blocoCat=cat=>{
      const porSub=porCat.get(cat);
      const subcats=[...porSub.keys()].sort((a,b)=>a.localeCompare(b,'pt-BR'));
      const todasTarefas=[...porSub.values()].flat();
      const aberto=_catAbertos.has(cat);
      const media=Math.round(todasTarefas.reduce((s,t)=>s+_perc(t),0)/todasTarefas.length);
      const semCat=cat===SEM_CATEGORIA;
      return `
      <div style="border:1px solid #262626;border-radius:8px;margin-bottom:8px;overflow:hidden;">
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;background:${semCat?'rgba(220,38,38,.08)':'rgba(245,200,0,.05)'};"
          onclick="Planejamento._catToggle('${_esc(cat).replace(/'/g,"\\'")}')">
          <span style="width:16px;text-align:center;font-size:.75rem;color:#888;">${aberto?'▼':'▶'}</span>
          <span style="flex:1;font-size:.88rem;font-weight:700;color:${semCat?'#f87171':'var(--cor-primaria)'};">${semCat?'⚠ ':'🏷 '}${_esc(cat)}</span>
          <span style="font-size:.68rem;color:#666;">${subcats.length} subcategoria${subcats.length!==1?'s':''} · ${todasTarefas.length} tarefa${todasTarefas.length!==1?'s':''}</span>
          <span style="font-size:.8rem;font-weight:800;min-width:42px;text-align:right;color:${media>=100?'#4ade80':'#60a5fa'};">${media}%</span>
        </div>
        ${aberto?subcats.map(sub=>blocoSub(cat,sub,porSub.get(sub))).join(''):''}
      </div>`;
    };

    c.style.cssText='display:flex;flex-direction:column;min-height:0;height:100%;';
    c.innerHTML=`
      <div style="display:flex;gap:8px;align-items:baseline;margin-bottom:8px;">
        <h2 style="margin:0;font-size:1.1rem;color:var(--cor-primaria);">🏷 Agrupador de Categoria</h2>
        <span style="font-size:.75rem;color:#555;">${folhas.length} tarefas em ${categorias.length} categoria${categorias.length!==1?'s':''}</span>
      </div>
      <div style="font-size:.72rem;color:#888;margin-bottom:10px;">Máscara de visão: mostra as mesmas tarefas do Planejamento agrupadas por Categoria/Subcategoria (preenchidas via Importar Correções). Não altera ordem, código nem estrutura real. Clique numa tarefa para abrir/editar.</div>
      <div style="display:flex;gap:6px;margin-bottom:10px;">
        <button class="btn btn-secundario btn-sm" style="font-size:.72rem;" onclick="Planejamento._catExpandirTudo(true)">Expandir tudo</button>
        <button class="btn btn-secundario btn-sm" style="font-size:.72rem;" onclick="Planejamento._catExpandirTudo(false)">Recolher tudo</button>
        <span style="flex:1;"></span>
        <button class="btn btn-secundario btn-sm" style="font-size:.72rem;" onclick="Planejamento.toggleCategoriaView()">← Voltar ao Gantt</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding-right:4px;">
        ${categorias.length?categorias.map(blocoCat).join(''):'<div style="color:#555;font-size:.82rem;padding:20px;text-align:center;">Nenhuma tarefa cadastrada ainda.</div>'}
      </div>`;
  }

  // ===================== SETAS DE PREDECESSORA NO GANTT =====================
  function toggleSetasPred(){
    _setasPred=!_setasPred;
    try{localStorage.setItem('planej_setasPred',_setasPred?'1':'0');}catch(e){}
    _setaSelecionada=null;
    _render();requestAnimationFrame(()=>_paintRows());
  }
  // Gera o SVG das setas (estilo MS Project): sai do FIM da barra da
  // predecessora, desce/sobe até a linha da tarefa e entra no INÍCIO dela
  // com uma setinha. Hover escurece; clique marca e mostra o nome da
  // predecessora num rótulo. Só desenha pares perto da janela visível
  // (virtual scroll) pra não pesar em obra grande.
  function _setasSvg(s,e,dMin,lpd){
    if(!_setasPred||!ganttVisible)return'';
    const idxDe=new Map(filtradas.map((t,i)=>[t.id,i]));
    const MARGEM=40;
    let paths='';
    for(let i=Math.max(0,s-MARGEM);i<Math.min(filtradas.length,e+MARGEM);i++){
      const t=filtradas[i];
      if(!t.predecessora||!_vIni(t))continue;
      const tx=Math.round((new Date(_vIni(t))-dMin)/864e5*lpd);
      const ty=i*ROW_H+15;
      for(const p of _predParse(t.predecessora)){
        const pi=idxDe.get(p.id);
        if(pi===undefined)continue; // predecessora fora da visão atual — sem seta
        const pred=filtradas[pi];
        if(!_vFim(pred))continue;
        const pIni=_vIni(pred)?new Date(_vIni(pred)):null;
        const pFim=new Date(_vFim(pred));
        const px0=pIni?Math.round((pIni-dMin)/864e5*lpd):0;
        const pw=Math.max(4,Math.round((pFim-(pIni||pFim))/864e5*lpd));
        const px=px0+pw; // fim da barra da predecessora
        const py=pi*ROW_H+15;
        const chave=p.id+'>'+t.id;
        const sel=_setaSelecionada===chave;
        // Roteamento limpo (não passa por cima das barras): sai do fim da
        // pred, anda um tiquinho, desce/sobe até o VÃO entre as linhas
        // (borda da linha da pred), corre na horizontal POR esse vão até a
        // coluna estreita logo antes do início da tarefa, e só então
        // desce/sobe até a linha da tarefa, entrando com a setinha.
        const descendo=ty>py;
        const gapY=descendo?(pi*ROW_H+ROW_H):(pi*ROW_H); // borda inferior/superior da linha da pred
        const dropX=Math.min(px+7,tx-8); // nunca passa do início da tarefa
        const d=`M${px},${py} L${dropX},${py} L${dropX},${gapY} L${tx-8},${gapY} L${tx-8},${ty} L${tx-4},${ty}`;
        paths+=`<g class="seta-pred${sel?' seta-sel':''}" onclick="event.stopPropagation();Planejamento._setaClicada('${chave}',${pred._numLinha||0},this)" data-nome="${_esc(pred.nome||'')}">
          <path d="${d}" fill="none"/>
          <path d="M${tx-4},${ty-4} L${tx},${ty} L${tx-4},${ty+4} Z" class="seta-ponta"/>
          <title>${pred._numLinha?pred._numLinha+' — ':''}${_esc(pred.nome||'')}</title>
        </g>`;
      }
    }
    if(!paths)return'';
    return `<svg style="position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:4;overflow:visible;">
      <style>
        .seta-pred path{stroke:#5a5a72;stroke-width:1.3;pointer-events:visibleStroke;cursor:pointer;transition:stroke .1s;}
        .seta-pred .seta-ponta{fill:#5a5a72;stroke:none;pointer-events:auto;}
        .seta-pred:hover path{stroke:#a5a5c8;stroke-width:1.8;}
        .seta-pred:hover .seta-ponta{fill:#a5a5c8;}
        .seta-sel path{stroke:var(--cor-primaria)!important;stroke-width:2!important;}
        .seta-sel .seta-ponta{fill:var(--cor-primaria)!important;}
      </style>${paths}</svg>`;
  }
  function _setaClicada(chave,numLinha,el){
    if(_setaSelecionada===chave){_setaSelecionada=null;_paintRows();return;}
    _setaSelecionada=chave;
    const nome=el?.dataset?.nome||'';
    Utils.toast(`🔗 Predecessora: ${numLinha?numLinha+' — ':''}${nome}`,'sucesso');
    _paintRows();
  }


  // ===================== ARRASTAR LINHA (REORDENAR) =====================
  // Ctrl + botão direito + arrastar move a tarefa (e seus filhos diretos,
  // se houver) para cima ou para baixo na lista, encaixando-a antes/depois
  // da linha onde o mouse for solto. Resolve o problema de vincular um
  // nível 4 ao nível 3 errado quando há vários no mesmo grupo.
  function _rowDragStart(e, idx){
    if(!e.ctrlKey||e.button!==2)return;
    e.preventDefault();e.stopPropagation();
    const t=filtradas[idx];if(!t)return;
    const el=e.currentTarget;
    const esqS=document.getElementById('g-esq-s');
    if(!esqS)return;

    _dragTaskId=t.id;
    try{el.setPointerCapture(e.pointerId);}catch(err){}

    const move=ev=>{
      const rect=esqS.getBoundingClientRect();
      const yRel=ev.clientY-rect.top+esqS.scrollTop;
      let overIdx=Math.floor(yRel/ROW_H);
      overIdx=Math.max(0,Math.min(filtradas.length-1,overIdx));
      const alvo=filtradas[overIdx];
      if(!alvo||alvo.id===_dragTaskId){ _dropTargetId=null; }
      else{
        const dentroDaLinha=yRel-overIdx*ROW_H;
        _dropTargetId=alvo.id;
        _dropPos=dentroDaLinha<ROW_H/2?'before':'after';
      }
      _paintRows();
    };
    const up=async()=>{
      el.removeEventListener('pointermove',move);
      el.removeEventListener('pointerup',up);
      el.removeEventListener('pointercancel',up);
      try{el.releasePointerCapture(e.pointerId);}catch(err){}
      const dragId=_dragTaskId, targetId=_dropTargetId, pos=_dropPos;
      _dragTaskId=null;_dropTargetId=null;
      if(dragId&&targetId&&dragId!==targetId){
        await _reordenarTarefa(dragId,targetId,pos);
      } else {
        _paintRows();
      }
    };
    el.addEventListener('pointermove',move);
    el.addEventListener('pointerup',up);
    el.addEventListener('pointercancel',up);
  }

  // Move a tarefa (+ filhos diretos contíguos, mesma convenção usada em
  // recuarNivel/avancarNivel) para antes ou depois da tarefa-alvo, e
  // recalcula 'ordem' de tudo. Local-first: atualiza a tela na hora,
  // salva no Firestore em lotes em segundo plano.
  async function _reordenarTarefa(dragId,targetId,pos){
    if(_visaoOrgIds){
      Utils.toast('Reordenar está desativado com a Visão Organizacional ativa — as linhas vizinhas na tela não são as vizinhas reais da estrutura. Limpe a visão pra mover.','alerta');
      _paintRows();
      return;
    }
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const dragIdx=sorted.findIndex(x=>x.id===dragId);
    if(dragIdx<0)return;
    const dragTask=sorted[dragIdx], dragNivel=dragTask.nivel||0;

    // Bloco = a tarefa arrastada + tudo abaixo dela com nível maior
    let fimBloco=dragIdx+1;
    while(fimBloco<sorted.length&&(sorted[fimBloco].nivel||0)>dragNivel)fimBloco++;
    const bloco=sorted.splice(dragIdx,fimBloco-dragIdx);

    // Não permite soltar dentro do próprio bloco (vira no-op)
    const targetIdxAtual=sorted.findIndex(x=>x.id===targetId);
    if(targetIdxAtual<0){_paintRows();return;}

    // Ajusta o nível do bloco pro nível do vizinho onde ele vai cair — sem
    // isso, arrastar um bloco de nível 3 pra perto de algo de nível 1
    // deixava ele com nível 3 ali (salto impossível, invisível no Editor
    // de Estrutura). Mesma lógica já usada e testada no arrastar da árvore.
    const targetNivel=sorted[targetIdxAtual].nivel||0;
    const dif=targetNivel-dragNivel;
    if(dif!==0)bloco.forEach(t=>{t.nivel=Math.max(0,(t.nivel||0)+dif);});

    let insertAt=pos==='before'?targetIdxAtual:targetIdxAtual+1;
    sorted.splice(insertAt,0,...bloco);

    // Recalcula ordem sequencial e detecta o que mudou (ordem e/ou nível)
    const idsBlocoComNivelAjustado=dif!==0?new Set(bloco.map(t=>t.id)):new Set();
    const updates=[];
    sorted.forEach((t,i)=>{
      const novaOrdem=i+1;
      const upd={};
      if((t.ordem||0)!==novaOrdem){t.ordem=novaOrdem;upd.ordem=novaOrdem;}
      if(idsBlocoComNivelAjustado.has(t.id))upd.nivel=t.nivel;
      if(Object.keys(upd).length)updates.push({id:t.id,...upd});
    });

    // Salva estado para undo antes de reordenar
    _undoPush();
    // Atualiza local imediatamente (responsividade)
    tarefas=sorted;
    // Captura numLinhas ANTES de rebuild (para saber o 'antes' de cada tarefa)
    const numAntes=new Map(tarefas.map(t=>[t.id,t._numLinha||0]));
    _buildFiltradas();_render();requestAnimationFrame(()=>_paintRows());
    // Agora cada t._numLinha tem o número DEPOIS — monta o mapa de mudanças
    const mudancasNum=new Map();
    for(const t of tarefas){
      const antes=numAntes.get(t.id)||0;
      const depois=t._numLinha||0;
      if(antes||depois) mudancasNum.set(t.id,{antes,depois});
    }
    // Atualiza predecessoras que apontavam para tarefas que mudaram de número
    await _remapearPredecessoras(mudancasNum);

    // Salva em segundo plano, em lotes
    const LOTE=30;
    for(let i=0;i<updates.length;i+=LOTE){
      await Promise.all(updates.slice(i,i+LOTE).map(({id,...upd})=>
        Database.atualizar(obraId,COL,id,upd).catch(e=>console.error('Erro reordenar:',id,e))
      ));
    }
    await _recalcularPercTodosPais(true); // pode ter mudado nível/quem é filho de quem
  }

  // ===================== TOGGLE GANTT =====================
  function toggleGantt(){
    ganttVisible=!ganttVisible;
    _render(); // re-render completely since DOM structure changes
  }

  function toggleLiberarEdicaoReal(){
    _liberarEdicaoReal=!_liberarEdicaoReal;
    if(_liberarEdicaoReal)Utils.toast('🔓 Início/Término Real liberados pra edição direta na tabela.','alerta');
    _render();
  }

  // ===================== DATE HEADERS =====================
  function _buildDateHeader(dMin,dMax,lpd,W){
    const M=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    let h='';
    if(zoomGantt==='dia'){
      let d=new Date(dMin),lm=-1;
      while(d<=dMax){
        const x=Math.round((d-dMin)/864e5*lpd);
        if(d.getMonth()!==lm){h+=`<div style="position:absolute;left:${x}px;top:1px;font-size:.5rem;color:#666;">${M[d.getMonth()]} ${d.getFullYear()}</div>`;lm=d.getMonth();}
        const we=d.getDay()===0||d.getDay()===6;
        h+=`<div style="position:absolute;left:${x}px;top:0;bottom:0;border-left:1px solid rgba(255,255,255,${we?'.07':'.03'});"></div>`;
        h+=`<div style="position:absolute;left:${x+1}px;top:13px;font-size:.5rem;color:${we?'#555':'#444'};">${d.getDate()}</div>`;
        d.setDate(d.getDate()+1);
      }
    } else if(zoomGantt==='semana'){
      let d=new Date(dMin);d.setDate(d.getDate()-(d.getDay()||7)+1);let lm=-1;
      while(d<=dMax){
        const x=Math.round((d-dMin)/864e5*lpd);
        if(d.getMonth()!==lm){h+=`<div style="position:absolute;left:${x}px;top:1px;font-size:.5rem;color:#666;">${M[d.getMonth()]} ${d.getFullYear()}</div>`;lm=d.getMonth();}
        h+=`<div style="position:absolute;left:${x}px;top:0;bottom:0;border-left:1px solid rgba(255,255,255,.05);"></div>`;
        h+=`<div style="position:absolute;left:${x+1}px;top:13px;font-size:.48rem;color:#444;">${d.getDate()}</div>`;
        d.setDate(d.getDate()+7);
      }
    } else if(zoomGantt==='mes'){
      let d=new Date(dMin.getFullYear(),dMin.getMonth(),1);
      while(d<=dMax){const x=Math.round((d-dMin)/864e5*lpd);
        h+=`<div style="position:absolute;left:${x}px;top:0;bottom:0;border-left:1px solid rgba(255,255,255,.06);"></div>`;
        h+=`<div style="position:absolute;left:${x+3}px;top:6px;font-size:.58rem;color:#555;">${M[d.getMonth()]} ${d.getFullYear()}</div>`;
        d.setMonth(d.getMonth()+1);}
    } else if(zoomGantt==='trimestre'){
      let d=new Date(dMin.getFullYear(),Math.floor(dMin.getMonth()/3)*3,1);
      while(d<=dMax){const x=Math.round((d-dMin)/864e5*lpd);
        h+=`<div style="position:absolute;left:${x}px;top:0;bottom:0;border-left:1px solid rgba(255,255,255,.06);"></div>`;
        h+=`<div style="position:absolute;left:${x+3}px;top:6px;font-size:.6rem;color:#555;">T${Math.floor(d.getMonth()/3)+1} ${d.getFullYear()}</div>`;
        d.setMonth(d.getMonth()+3);}
    } else {
      for(let y=dMin.getFullYear();y<=dMax.getFullYear()+1;y++){
        const x=Math.round((new Date(y,0,1)-dMin)/864e5*lpd);
        h+=`<div style="position:absolute;left:${x}px;top:0;bottom:0;border-left:1px solid rgba(255,255,255,.06);"></div>`;
        h+=`<div style="position:absolute;left:${x+3}px;top:6px;font-size:.65rem;color:#555;font-weight:700;">${y}</div>`;}
    }
    return h;
  }

  // ===================== COLUMN RESIZE =====================
  function _colResizeStart(e, colId){
    e.preventDefault();e.stopPropagation();
    const handle=e.currentTarget;
    const sx=e.clientX, sw=colLarguras[colId]||60;

    // Pointer Capture: garante que move/up cheguem neste elemento
    // mesmo se o mouse sair da janela do navegador (evita drag travado)
    try{handle.setPointerCapture(e.pointerId);}catch(err){}
    document.body.style.cursor='col-resize';

    // Linha guia visual (puramente visual, não captura eventos)
    const line=document.createElement('div');
    line.style.cssText='position:fixed;top:0;bottom:0;width:2px;background:var(--cor-primaria);z-index:10000;pointer-events:none;left:'+e.clientX+'px';
    document.body.appendChild(line);

    const move=ev=>{
      const newW=Math.max(30,sw+(ev.clientX-sx));
      colLarguras[colId]=newW;
      line.style.left=ev.clientX+'px';
      // Atualiza o header em tempo real
      const hdr=document.querySelector('[data-hcol="'+colId+'"]');
      if(hdr){hdr.style.width=newW+'px';hdr.style.flex='none';}
      // Atualiza todas as células da coluna (para 'nome' que usa flex:1)
      document.querySelectorAll('[data-col="'+colId+'"]').forEach(cell=>{
        cell.style.width=newW+'px';cell.style.flex='none';
      });
    };
    const up=()=>{
      handle.removeEventListener('pointermove',move);
      handle.removeEventListener('pointerup',up);
      handle.removeEventListener('pointercancel',up);
      try{handle.releasePointerCapture(e.pointerId);}catch(err){}
      document.body.style.cursor='';
      line.remove();
      _render();requestAnimationFrame(()=>_paintRows());
    };
    handle.addEventListener('pointermove',move);
    handle.addEventListener('pointerup',up);
    handle.addEventListener('pointercancel',up);
  }

  // ===================== COLUMN DRAG REORDER =====================
  // Reordenar colunas via menu de contexto (clique direito)
  // O hideCol já usa oncontextmenu — vamos usar Shift+click direito para reordenar
  function moveColLeft(colId){
    const i=colOrdem.indexOf(colId);if(i<=0)return;
    // Não mover antes de uma fixa
    if(COL_FIXED.has(colOrdem[i-1]))return;
    [colOrdem[i-1],colOrdem[i]]=[colOrdem[i],colOrdem[i-1]];
    _render();requestAnimationFrame(()=>_paintRows());
  }
  function moveColRight(colId){
    const i=colOrdem.indexOf(colId);if(i<0||i>=colOrdem.length-1)return;
    if(COL_FIXED.has(colOrdem[i+1]))return;
    [colOrdem[i],colOrdem[i+1]]=[colOrdem[i+1],colOrdem[i]];
    _render();requestAnimationFrame(()=>_paintRows());
  }

  // ===================== COLUMN HIDE/SHOW =====================
  function hideCol(id){if(COL_FIXED.has(id))return;colsHidden.add(id);_render();}
  function showColsMenu(){
    const hidden=[...colsHidden];if(!hidden.length)return;
    let pop=document.getElementById('sc-pop');if(pop){pop.remove();return;}
    pop=document.createElement('div');pop.id='sc-pop';
    pop.style.cssText='position:fixed;top:90px;right:20px;background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:12px;z-index:1000;min-width:180px;box-shadow:0 8px 32px rgba(0,0,0,.5);';
    pop.innerHTML='<div style="font-weight:700;color:var(--cor-primaria);margin-bottom:8px;font-size:.82rem;">Colunas ocultas</div>'+
      hidden.map(id=>`<button class="btn btn-secundario btn-sm" style="display:block;width:100%;margin-bottom:3px;text-align:left;font-size:.75rem;" onclick="Planejamento._showCol('${id}')">+ ${COL_LABELS[id]||id}</button>`).join('')+
      '<button class="btn btn-primario btn-sm" style="width:100%;margin-top:6px;font-size:.75rem;" onclick="Planejamento._showAll()">Mostrar todas</button>';
    document.body.appendChild(pop);
    setTimeout(()=>document.addEventListener('click',function h(e){if(!pop.contains(e.target)){pop.remove();document.removeEventListener('click',h);}},false),50);
  }
  function _showCol(id){colsHidden.delete(id);const p=document.getElementById('sc-pop');if(p)p.remove();_render();}
  function _showAll(){colsHidden.clear();const p=document.getElementById('sc-pop');if(p)p.remove();_render();}

  function _toggleMenuFerramentas(){
    let pop=document.getElementById('ft-pop');if(pop){pop.remove();return;}
    pop=document.createElement('div');pop.id='ft-pop';
    pop.style.cssText='position:fixed;top:90px;right:20px;background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:8px;z-index:1000;min-width:220px;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:4px;';
    // Itens do menu — cada um com um "rótulo" (sem emoji, usado só pra
    // ordenar alfabeticamente) e o HTML final. Adicionar item novo: só
    // colocar no array, a ordem alfabética é automática.
    const itens=[
      {rotulo:'Auto-vincular por Nome',grupo:'Ferramentas da Obra',html:'<button class="btn btn-secundario btn-sm" style="display:block;width:100%;text-align:left;font-size:.75rem;" onclick="Planejamento._abrirAutoVincular()" title="Detecta o pavimento/apto pelo NOME da tarefa e vincula tudo de uma vez, com prévia pra revisar antes de aplicar">🔗 Auto-vincular por Nome</button>'},
      {rotulo:'Classificar Frentes automaticamente',grupo:'Ferramentas da Obra',html:'<button class="btn btn-secundario btn-sm" style="display:block;width:100%;text-align:left;font-size:.75rem;" onclick="Planejamento.autoClassificarFrentes()" title="Sugere a Frente de Serviço (Hidráulica, Elétrica...) pelo nome da tarefa. Só preenche quem está em branco — nunca sobrescreve o que já foi definido manualmente.">👷 Classificar Frentes automaticamente</button>'},
      {rotulo:'Corrigir Níveis Soltos',grupo:'Correções & Recálculos',html:'<button class="btn btn-secundario btn-sm" style="display:block;width:100%;text-align:left;font-size:.75rem;" onclick="Planejamento._corrigirNiveisSoltos()" title="Corrige tarefas com nível soltos (invisíveis no Editor de Estrutura)">🌳 Corrigir Níveis Soltos</button>'},
      {rotulo:'Corrigir Ordens',grupo:'Correções & Recálculos',html:'<button class="btn btn-secundario btn-sm" style="display:block;width:100%;text-align:left;font-size:.75rem;" onclick="Planejamento.corrigirOrdensDuplicadas()" title="Corrige tarefas com número de ordem duplicado">🔧 Corrigir Ordens</button>'},
      {rotulo:'Corrigir Predecessoras (por ID)',grupo:'Correções & Recálculos',html:'<button class="btn btn-secundario btn-sm" style="display:block;width:100%;text-align:left;font-size:.75rem;" onclick="Planejamento._migrarPredecessorasParaId()" title="Converte predecessoras antigas (por número de linha) pro formato por ID — imune a reordenação. Roda sozinho ao carregar, use aqui só se quiser confirmar manualmente.">🔗 Corrigir Predecessoras (por ID)</button>'},
      {rotulo:'Estrutura da Obra',grupo:'Ferramentas da Obra',html:'<button class="btn btn-secundario btn-sm" style="display:block;width:100%;text-align:left;font-size:.75rem;" onclick="Planejamento._abrirEstruturaObra()" title="Cadastra Torre → Pavimento → Apto, pra vincular tarefas a um local">🏢 Estrutura da Obra</button>'},
      {rotulo:'Exportar Excel (simples)',grupo:'Importar & Exportar',html:'<button class="btn btn-secundario btn-sm" data-perm="planejamento:exportar:excel" style="display:block;width:100%;text-align:left;font-size:.75rem;" onclick="Planejamento.exportar()" title="Planilha crua com todas as colunas — boa pra reimportar/tratar dados">📤 Exportar Excel (simples)</button>'},
      {rotulo:'Exportar Frentes (revisão)',grupo:'Importar & Exportar',html:'<button class="btn btn-secundario btn-sm" data-perm="planejamento:exportar:frentes" style="display:block;width:100%;text-align:left;font-size:.75rem;" onclick="Planejamento.exportarFrentes()" title="Planilha simples (Código, Atividade, Pai, Frente) pra revisar/corrigir a Frente de Serviço fora do sistema e reimportar depois em Importar Correções">👷 Exportar Frentes (revisão)</button>'},
      {rotulo:'Exportar Excel (formatado)',grupo:'Importar & Exportar',html:'<button class="btn btn-secundario btn-sm" data-perm="planejamento:exportar:excel" style="display:block;width:100%;text-align:left;font-size:.75rem;" onclick="Planejamento.exportarExcelBonito()" title="Planilha estilizada: grupos coloridos por nível, indentação, cabeçalho fixo com filtro — pronta pra apresentar/imprimir">🎨 Exportar Excel (formatado)</button>'},
      {rotulo:'Exportar MS Project',grupo:'Importar & Exportar',html:'<button class="btn btn-secundario btn-sm" data-perm="planejamento:exportar:msproject" style="display:block;width:100%;text-align:left;font-size:.75rem;" onclick="Planejamento.exportarMSProject()" title="XML no formato do MS Project (hierarquia, datas, duração, % e predecessoras) — abre direto no Project">📊 Exportar MS Project (.xml)</button>'},
      {rotulo:'Baixar PDF',grupo:'Importar & Exportar',html:'<button class="btn btn-secundario btn-sm" data-perm="planejamento:exportar:pdf" style="display:block;width:100%;text-align:left;font-size:.75rem;" onclick="Planejamento.baixarPDF()" title="Baixa o arquivo .pdf direto (sem passar pela impressão) — mesmo visual bonito, A4 paisagem">📄 Baixar PDF</button>'},
      {rotulo:'Imprimir / PDF',grupo:'Importar & Exportar',html:'<button class="btn btn-secundario btn-sm" data-perm="planejamento:exportar:pdf" style="display:block;width:100%;text-align:left;font-size:.75rem;" onclick="Planejamento.abrirImpressao()" title="Abre a visão bonita em página branca pronta pra imprimir ou salvar em PDF (cabeçalho repete em cada página)">🖨 Imprimir / PDF</button>'},
      {rotulo:'Histórico de Alterações',grupo:'Ferramentas da Obra',html:'<button class="btn btn-secundario btn-sm" style="display:block;width:100%;text-align:left;font-size:.75rem;" onclick="Planejamento._abrirHistoricoAlteracoes()" title="Lista todas as trocas de predecessora/% feitas com motivo registrado">📋 Histórico de Alterações</button>'},
      {rotulo:'Importar',grupo:'Importar & Exportar',html:'<label class="btn btn-secundario btn-sm" style="cursor:pointer;font-size:.75rem;display:block;text-align:left;" title="Cria/atualiza por Código, nunca apaga (comportamento atual, mais seguro)">📥 Importar<input type="file" accept=".xlsx,.xls" style="display:none" onchange="Planejamento.importarExcel(event)"></label>'},
      {rotulo:'Importar Base Completa',grupo:'Importar & Exportar',html:'<label class="btn btn-secundario btn-sm" style="cursor:pointer;font-size:.75rem;display:block;text-align:left;color:#f87171;" title="Apaga TUDO e recria do zero — só pra substituir a base inteira">📥 Importar Base Completa (apaga tudo)<input type="file" accept=".xlsx,.xls" style="display:none" onchange="Planejamento.importarBaseCompleta(event)"></label>'},
      {rotulo:'Importar Correções',grupo:'Importar & Exportar',html:'<label class="btn btn-secundario btn-sm" style="cursor:pointer;font-size:.75rem;display:block;text-align:left;" title="Casa por Nome, atualiza só os campos escolhidos — não mexe em posição/estrutura">📥 Importar Correções (por campo)<input type="file" accept=".xlsx,.xls" style="display:none" onchange="Planejamento.importarCorrecoes(event)"></label>'},
      // "Corrigir Nível pelo Código" foi removido do menu — era um reparo de uso
      // único (histórico corrompido por bugs já corrigidos). Como ferramenta
      // recorrente é perigoso: se você aninhar uma tarefa com Código dentro de um
      // grupo novo manualmente, o Código dela fica desatualizado (não reflete a
      // nova posição), e rodar esse botão de novo reverteria o nível pro valor
      // antigo, desfazendo a reestruturação. A função continua existindo no
      // código (Planejamento._corrigirNivelPeloCodigo()) só pra emergência, mas
      // não deve ser clicada por engano no dia a dia.
      {rotulo:_liberarEdicaoReal?'Edição de Real Liberada':'Liberar Edição de Real',grupo:'Ferramentas da Obra',html:'<button class="btn btn-secundario btn-sm" style="display:block;width:100%;text-align:left;font-size:.75rem;'+(_liberarEdicaoReal?'background:#dc2626;color:#fff;':'')+'" onclick="Planejamento.toggleLiberarEdicaoReal()" title="Início/Término Real normalmente só são preenchidos via Diário/Medições/Semanal. Libere aqui só pra correção manual pontual.">'+(_liberarEdicaoReal?'🔓 Edição de Real Liberada':'🔒 Liberar Edição de Real')+'</button>'},
      {rotulo:'PNG',grupo:'Importar & Exportar',html:'<button class="btn btn-secundario btn-sm" data-perm="planejamento:exportar:png" style="display:block;width:100%;text-align:left;font-size:.75rem;" onclick="Planejamento.exportarPNG()">🖼 PNG</button>'},
      {rotulo:'Recalcular % dos Pais',grupo:'Correções & Recálculos',html:'<button class="btn btn-secundario btn-sm" style="display:block;width:100%;text-align:left;font-size:.75rem;" onclick="Planejamento._recalcularPercTodosPais()" title="Recalcula o % de toda tarefa-pai a partir dos filhos diretos (nível por nível, igual MS Project)">📊 Recalcular % dos Pais</button>'},
      {rotulo:'Recalcular Datas dos Pais',grupo:'Correções & Recálculos',html:'<button class="btn btn-secundario btn-sm" style="display:block;width:100%;text-align:left;font-size:.75rem;" onclick="Planejamento._recalcularDatasPais()" title="Recalcula início/término das tarefas-pai a partir dos filhos">📐 Recalcular Datas dos Pais</button>'},
      ...(_versaoData!=='atual'?[{rotulo:'Copiar Datas de Atual',grupo:'Correções & Recálculos',html:'<button class="btn btn-secundario btn-sm" style="display:block;width:100%;text-align:left;font-size:.75rem;" onclick="Planejamento.copiarDatasDeAtual()" title="Preenche as datas de '+VERSAO_LABEL[_versaoData]+' copiando de Atual em todas as tarefas que ainda não têm valor">📋 Copiar Datas de Atual → '+VERSAO_LABEL[_versaoData]+'</button>'}]:[]),
      {rotulo:'Ver por Responsável',grupo:'Ferramentas da Obra',html:'<button class="btn btn-secundario btn-sm" style="display:block;width:100%;text-align:left;font-size:.75rem;'+(_filtroResponsavel?'background:var(--cor-primaria);color:#000;':'')+'" onclick="Planejamento._abrirFiltroResponsavel()" title="Filtra a grid por responsável/especialidade">👷 '+(_filtroResponsavel?_esc(_filtroResponsavel):'Ver por Responsável')+'</button>'},
      {rotulo:'Vínculos com Levantamento',grupo:'Ferramentas da Obra',html:'<button class="btn btn-secundario btn-sm" style="display:block;width:100%;text-align:left;font-size:.75rem;" onclick="Planejamento.abrirVinculosView()">🔗 Vínculos com Levantamento</button>'},
    ];
    // Agrupa por categoria (com cabeçalho visual) e ordena alfabeticamente
    // DENTRO de cada grupo — menu deixou de ser uma lista única gigante.
    const GRUPOS=['Importar & Exportar','Correções & Recálculos','Ferramentas da Obra'];
    itens.sort((a,b)=>a.rotulo.localeCompare(b.rotulo,'pt-BR'));
    pop.innerHTML=GRUPOS.map(g=>{
      const doGrupo=itens.filter(i=>i.grupo===g);
      if(!doGrupo.length)return'';
      return `<div style="font-size:.62rem;color:#666;text-transform:uppercase;letter-spacing:.6px;padding:6px 4px 2px;font-weight:700;">${g}</div>`+doGrupo.map(i=>i.html).join('');
    }).join('');
    document.body.appendChild(pop);
    setTimeout(()=>document.addEventListener('click',function h(e){if(!pop.contains(e.target)&&!e.target.closest('[onclick*="_toggleMenuFerramentas"]')){pop.remove();document.removeEventListener('click',h);}},false),50);
  }

  // ===================== DIVIDER =====================
  function _divStart(e){
    e.preventDefault();
    const handle=e.currentTarget;
    const sx=e.clientX,sw=splitX;
    const container=document.getElementById('gantt-c');
    const maxW=container?container.clientWidth-80:1600;
    try{handle.setPointerCapture(e.pointerId);}catch(err){}
    const move=ev=>{
      splitX=Math.max(60,Math.min(maxW,sw+(ev.clientX-sx)));
      const el=document.getElementById('g-esq');if(el)el.style.width=splitX+'px';
    };
    const up=()=>{
      handle.removeEventListener('pointermove',move);
      handle.removeEventListener('pointerup',up);
      handle.removeEventListener('pointercancel',up);
      try{handle.releasePointerCapture(e.pointerId);}catch(err){}
    };
    handle.addEventListener('pointermove',move);
    handle.addEventListener('pointerup',up);
    handle.addEventListener('pointercancel',up);
  }

  // ===================== HIERARCHY =====================
  function toggleRecolher(id){
    const esqS=document.getElementById('g-esq-s');
    const dirS=document.getElementById('g-dir-s');
    const stE=esqS?esqS.scrollTop:0;
    const stD=dirS?dirS.scrollTop:0;
    if(colsRecolhidas.has(id))colsRecolhidas.delete(id);else colsRecolhidas.add(id);
    _buildFiltradas();_render();
    // Restaura a posição de scroll — o _render() reseta para 0
    requestAnimationFrame(()=>{
      const e2=document.getElementById('g-esq-s');const d2=document.getElementById('g-dir-s');
      if(e2)e2.scrollTop=stE;if(d2)d2.scrollTop=stD;
    });
  }

  async function recuarNivel(id){
    const ids=(_arvSel.has(id)&&_arvSel.size>1)?[..._arvSel]:[id];
    await _moverNivelMultiplas(ids,-1);
  }
  async function avancarNivel(id){
    const ids=(_arvSel.has(id)&&_arvSel.size>1)?[..._arvSel]:[id];
    await _moverNivelMultiplas(ids,1);
  }
  // Sobe/desce o nível de 1+ tarefas de uma vez (cada uma com os próprios
  // filhos). Se vários dos selecionados forem irmãos (ex: 9 grupos soltos no
  // nível errado), sem isso seria preciso clicar "←" um por um — clicar numa
  // linha só sobe/desce ELA e os filhos DELA, nunca os irmãos ao lado.
  async function _moverNivelMultiplas(ids,diff){
    const idsSet=new Set(ids);
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const idxOf=new Map(sorted.map((t,i)=>[t.id,i]));
    const blocoRange=idx=>{
      const niv=sorted[idx].nivel||0;
      let fim=idx+1;
      while(fim<sorted.length&&(sorted[fim].nivel||0)>niv)fim++;
      return [idx,fim];
    };
    const selIdxs=[...idsSet].map(id=>idxOf.get(id)).filter(i=>i!=null);
    if(!selIdxs.length)return;
    const ranges=selIdxs.map(i=>[i,blocoRange(i)]);
    // Só os de nível mais alto (não contidos no bloco de outro selecionado)
    const topRanges=ranges.filter(([i])=>!ranges.some(([j,[s,e]])=>j!==i&&i>s&&i<e)).map(([,r])=>r);
    if(diff<0&&topRanges.some(([s])=>(sorted[s].nivel||0)<=0)){Utils.toast('Já está no nível mínimo.','alerta');return;}

    const updates=[];
    for(const [s,e] of topRanges){
      const nivBase=sorted[s].nivel||0;
      for(let i=s;i<e;i++){
        updates.push({id:sorted[i].id,nivel:Math.max(0,(sorted[i].nivel||0)+diff)});
      }
    }
    updates.forEach(u=>{
      const tt=tarefas.find(x=>x.id===u.id);
      if(tt)tt.nivel=u.nivel;
    });
    _buildFiltradas();
    _render();
    requestAnimationFrame(()=>_paintRows());

    const LOTE=20;
    for(let i=0;i<updates.length;i+=LOTE){
      const batch=updates.slice(i,i+LOTE);
      await Promise.all(batch.map(u=>
        Database.atualizar(obraId,COL,u.id,{nivel:u.nivel}).catch(e=>console.error('Erro update:',u.id,e))
      ));
    }
    await _recalcularPercTodosPais(true); // mudou nível = mudou quem é filho de quem
    if(updates.length>1)Utils.toast(`Nível ajustado em ${topRanges.length} bloco(s) (${updates.length} tarefa(s) no total).`,'sucesso');
  }

  // ===================== CRUD =====================
  function selectIdx(i){if(_esqDragMoved)return;selectedIdx=i;_paintRows();}

  function inserirTarefa(){
    if(!Permissions.pode('planejamento','criar:tarefa')){Utils.toast('Sem permissão para criar tarefas.','erro');return;}
    editandoId=null;
    document.getElementById('modal-tarefa-titulo').textContent='Nova Tarefa';
    document.getElementById('form-tarefa').reset();
    const aviso=document.getElementById('tarefa-vinculo-aviso');if(aviso)aviso.innerHTML='';
    if(selectedIdx>=0&&filtradas[selectedIdx]){
      const sel=filtradas[selectedIdx];
      const f=document.getElementById('form-tarefa');
      f.querySelector('[name="nivel"]').value=sel.nivel||0;
      f.querySelector('[name="grupo"]').value=sel.grupo||'';
      f.querySelector('[name="local"]').value=sel.local||'';
      // Ordem: precisa ficar ESTRITAMENTE entre a tarefa selecionada e a próxima.
      // Antes era sel.ordem+1, que colide com a ordem da própria próxima tarefa
      // sempre que a lista está normalizada em inteiros sequenciais (o caso comum) —
      // essa colisão é o que fazia o Firestore desempatar por ID do doc no reload
      // seguinte, mudando a posição/numLinha "sozinha".
      const sortedIns=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
      const idxIns=sortedIns.findIndex(t=>t.id===sel.id);
      const proxIns=idxIns>=0?sortedIns[idxIns+1]:null;
      const baseIns=sel.ordem||0;
      const novaOrdemIns=proxIns?baseIns+(((proxIns.ordem||(baseIns+2))-baseIns)/2):baseIns+1;
      f.querySelector('[name="ordem"]').value=novaOrdemIns;
    } else {
      const maxOrdemIns=tarefas.length?Math.max(...tarefas.map(t=>t.ordem||0)):0;
      document.querySelector('#form-tarefa [name="ordem"]').value=maxOrdemIns+1;
    }
    Utils.abrirModal('modal-tarefa');
  }

  function editarTarefa(id){
    if(!Permissions.pode('planejamento','editar:celula')){Utils.toast('Sem permissão para editar tarefas.','erro');return;}
    const t=tarefas.find(x=>x.id===id);if(!t)return;
    editandoId=id;
    document.getElementById('modal-tarefa-titulo').textContent='Editar Tarefa';
    const f=document.getElementById('form-tarefa');f.reset();
    ['codigo','nome','tipo','nivel','ordem','inicioPlanejado','terminoPlanejado','duracao',
      'percentualEsperado','percentualConcluido','tarefaPai','grupo','local','frenteServico',
      'custo','receita','responsavel','inicioPlanejadoBase','terminoPlanejadoBase',
      'inicioDesafio','terminoDesafio','observacoes','quantidade','unidade'].forEach(k=>{
      const el=f.querySelector(`[name="${k}"]`);if(el&&t[k]!=null)el.value=t[k];
    });
    // Predecessora é guardada por ID internamente — mostra no formato legível
    // (número de linha) no formulário; a conversão de volta acontece ao salvar.
    const elPred=f.querySelector('[name="predecessora"]');
    if(elPred)elPred.value=t._predDisplay||'';
    const aviso=document.getElementById('tarefa-vinculo-aviso');
    if(aviso){
      const mod=LEVANTAMENTO_MODULOS[t.levantamentoModulo];
      aviso.innerHTML=t.fonteQuantidade==='levantamento'
        ?`<div class="text-sm" style="color:var(--cor-primaria);margin:-8px 0 10px;">🔗 Quantidade vinculada a ${mod?.label||t.levantamentoModulo} — editar aqui só vale até o próximo recálculo. Para mudar o vínculo, use "Vínculos com Levantamento".</div>`
        :'';
    }
    Utils.abrirModal('modal-tarefa');
  }

  async function salvarTarefa(){
    if(!Permissions.pode('planejamento',editandoId?'editar:celula':'criar:tarefa')){Utils.toast('Sem permissão.','erro');return;}
    const f=document.getElementById('form-tarefa');
    const g=n=>f.querySelector(`[name="${n}"]`)?.value;
    const nome=g('nome')?.trim();if(!nome){Utils.toast('Nome obrigatório.','alerta');return;}
    const ini=g('inicioPlanejado'),ter=g('terminoPlanejado');
    let dur=parseInt(g('duracao'))||0;
    if(ini&&ter&&!dur)dur=Math.max(0,Math.ceil((new Date(ter)-new Date(ini))/864e5));
    // Guard anti-colisão: 'ordem' nunca pode ser igual à de outra tarefa já
    // existente — um empate é resolvido pelo Firestore por ID do documento
    // (não pela ordem que a gente quer), e é isso que causava tarefas
    // "pulando" de posição sozinhas no reload seguinte (carregar() roda a
    // cada Salvar). Se colidir, empurra em micro-incrementos até achar um
    // valor livre — não afeta a ordem visual, só desempata de forma estável.
    let ordemCandidata=parseFloat(g('ordem'));
    if(isNaN(ordemCandidata))ordemCandidata=tarefas.length+1;
    const ordensUsadas=new Set(tarefas.filter(t=>t.id!==editandoId).map(t=>t.ordem));
    while(ordensUsadas.has(ordemCandidata))ordemCandidata+=0.0001;
    const data={tipo:g('tipo')||'tarefa',codigo:g('codigo')||'',nome,nivel:parseInt(g('nivel'))||0,
      ordem:ordemCandidata,inicioPlanejado:ini||'',terminoPlanejado:ter||'',duracao:dur,
      percentualEsperado:parseFloat(g('percentualEsperado'))||0,percentualConcluido:parseFloat(g('percentualConcluido'))||0,
      predecessora:_predTextoParaCanon(g('predecessora')||''),tarefaPai:g('tarefaPai')||'',grupo:g('grupo')||'',local:g('local')||'',
      frenteServico:g('frenteServico')||'',
      custo:parseFloat(g('custo'))||0,receita:parseFloat(g('receita'))||0,responsavel:g('responsavel')||'',
      quantidade:parseFloat(g('quantidade'))||0,unidade:g('unidade')||'',
      inicioPlanejadoBase:g('inicioPlanejadoBase')||'',terminoPlanejadoBase:g('terminoPlanejadoBase')||'',
      inicioDesafio:g('inicioDesafio')||'',terminoDesafio:g('terminoDesafio')||'',observacoes:g('observacoes')||'',obraId};
    try{
      const numAntes=_capturarNumAntes();
      const editandoIdAntes=editandoId;
      if(editandoId){
        // Checagem ANTES de salvar qualquer coisa: se essa tarefa tem muitos
        // descendentes, salvar um % diferente do atual sobrescreve o % de
        // TODOS eles de uma vez — sem essa confirmação, um valor desatualizado
        // no formulário (ex: aberto antes de um recálculo) podia sobrescrever
        // o % de centenas de tarefas silenciosamente (bug real já visto).
        const tAntes=tarefas.find(x=>x.id===editandoId);
        const percAntesCheck=tAntes?(parseFloat(tAntes.percentualConcluido)||0):0;
        const novoPercCheck=data.percentualConcluido;
        if(tAntes&&Math.abs(novoPercCheck-percAntesCheck)>0.05){
          const famCheck=Utils.percFamilia(tarefas);
          const descCheck=famCheck.descendentes(tAntes);
          if(descCheck.length>3){
            if(!confirm(`"${tAntes.nome}" tem ${descCheck.length} tarefas descendentes. Salvar o % como ${novoPercCheck}% vai SOBRESCREVER o % de todas elas (era ${percAntesCheck}%). Confirmar?`)){
              return;
            }
          }
        }
        await Database.atualizar(obraId,COL,editandoId,data);
        // ===== % EM FAMÍLIA (mesma regra da edição inline) =====
        const tLocal=tarefas.find(x=>x.id===editandoId);
        const percAntes=tLocal?(parseFloat(tLocal.percentualConcluido)||0):0;
        if(tLocal&&Math.abs(data.percentualConcluido-percAntes)>0.05){
          Object.assign(tLocal,data);
          const fam=Utils.percFamilia(tarefas);
          let famUps=[];
          if(fam.filhosDiretos(tLocal).length>0){
            famUps=Utils.distribuirPercDescendentes(tarefas,tLocal.id,data.percentualConcluido)
              .concat(Utils.recalcularPercAncestrais(tarefas,tLocal.id));
          } else {
            famUps=Utils.recalcularPercAncestrais(tarefas,tLocal.id);
          }
          for(const u of famUps){
            await Database.atualizar(obraId,COL,u.id,{percentualConcluido:u.percentualConcluido});
          }
        }
      }
      else await Database.criar(obraId,COL,data);
      Utils.fecharModal('modal-tarefa');Utils.toast('Salvo!','sucesso');editandoId=null;await carregar();
      const paisAlterados=await _recalcularDatasPais(true);
      await _recalcularPercTodosPais(true);
      // Predecessora funciona de verdade: se início/término mudou, propaga
      // automaticamente pras tarefas que dependem desta (sucessoras em cadeia)
      // — e também pros pais cuja data agregada mudou por causa disso.
      if(editandoIdAntes)await _propagarDataEmCascata(editandoIdAntes);
      for(const p of paisAlterados)await _propagarDataEmCascata(p.id);
    }catch(e){console.error(e);Utils.toast('Erro.','erro');}
  }

  async function excluirTarefa(id){
    if(!Permissions.pode('planejamento','excluir:tarefa')){Utils.toast('Sem permissão para excluir tarefas.','erro');return;}
    const t=tarefas.find(x=>x.id===id);if(!confirm(`Excluir "${t?.nome}"?`))return;
    try{
      const numAntes=_capturarNumAntes();
      await Database.deletar(obraId,COL,id);Utils.toast('Excluído.','sucesso');selectedIdx=-1;await carregar();
      numAntes.delete(id); // a excluída não tem "depois", não entra no remap
      await _remapAposMudancaPosicoes(numAntes);
    }
    catch(e){Utils.toast('Erro.','erro');}
  }

  // Helper compartilhado: lê e mapeia colunas do Excel (mesmo parser do importarExcel)
  async function _lerPlanilhaImport(file){
    if(typeof XLSX==='undefined')await _ls('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    const ab=await file.arrayBuffer();
    const wb=XLSX.read(ab,{type:'array'});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
    if(rows.length<2)throw new Error('Planilha vazia.');
    // Metadados de origem (aba oculta "_obra", gravada por exportar()) — usados
    // pra avisar ANTES de importar se a planilha é de uma obra diferente da
    // selecionada agora. Planilhas exportadas antes dessa versão não têm essa
    // aba — nesse caso obraArquivo fica null e não bloqueia nada (comportamento
    // antigo preservado).
    let obraArquivoId=null,obraArquivoNome=null;
    if(wb.Sheets['_obra']){
      const infoRows=XLSX.utils.sheet_to_json(wb.Sheets['_obra'],{header:1,defval:''});
      for(const linha of infoRows){
        if(linha[0]==='obraId')obraArquivoId=String(linha[1]||'')||null;
        if(linha[0]==='obraNome')obraArquivoNome=String(linha[1]||'')||null;
      }
    }
    const hdrs=rows[0].map(h=>String(h||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' '));
    const ci=n=>{const a={chave:['id','chave','id fixo','uid'],linha:['linha'],codigo:['codigo','code'],nivel:['nivel','nível','level'],nome:['nome','name','tarefa','atividade'],duracao:['duracao','duration'],
      inicio:['inicio','start','inicio planejado'],termino:['termino','finish','fim','termino planejado'],
      percEsp:['esperado','% esperado'],percConc:['concluido','% concluido','% complete'],
      pred:['predecessora','predecessor','prececessora'],pai:['pai','tarefa pai','parent'],grupo:['grupo','group'],
      local:['local','location'],custo:['custo','cost'],receita:['receita','revenue'],
      resp:['responsavel','responsible','resource'],frente:['frente','frente de servico','equipe'],iniB:['inicio linha de base'],terB:['termino linha de base'],
      iniD:['inicio desafio'],terD:['termino desafio'],iniReal:['inicio real'],terReal:['termino real'],
      categoria:['categoria'],subcategoria:['subcategoria'],subgrupo:['subgrupo']};
      for(const al of(a[n]||[])){const i=hdrs.indexOf(al);if(i>=0)return i;}return-1;};
    const iN=ci('nome');
    if(iN<0)throw new Error('Coluna Nome não encontrada.');
    return {rows,ci,iN,obraArquivoId,obraArquivoNome};
  }

  // Compara a obra gravada no arquivo (se houver) com a obra selecionada
  // agora. Retorna true = pode continuar, false = usuário cancelou. Sem
  // metadado no arquivo (planilha antiga) sempre deixa passar, sem perguntar.
  function _confirmarObraArquivo(ctx){
    if(!ctx.obraArquivoId)return true; // planilha sem metadado — comportamento de sempre
    if(ctx.obraArquivoId===obraId)return true; // mesma obra, tudo certo
    const obraAtual=Router.getObra();
    return confirm(`⚠ ATENÇÃO — planilha de outra obra!\n\nEssa planilha foi exportada da obra "${ctx.obraArquivoNome||ctx.obraArquivoId}".\nA obra selecionada agora é "${obraAtual?.nome||obraId}".\n\nOs IDs não vão bater com nada aqui (0 casadas pelo ID) e o import vai tentar casar só por Código/Nome — arriscado.\n\nTem certeza que quer continuar mesmo assim?`);
  }

  // ===================== IMPORTAR BASE COMPLETA (substitui tudo) =====================
  // Diferente do "Importar" normal (upsert por Código, nunca apaga) — este apaga
  // TODAS as tarefas da obra e recria do zero a partir da planilha. Só pra quem
  // realmente quer substituir a base inteira (ex: primeira carga de uma obra nova,
  // ou reconciliar de vez com um cronograma totalmente reestruturado).
  async function importarBaseCompleta(event){
    const file=event.target.files[0];if(!file)return;event.target.value='';
    if(!Permissions.pode('planejamento','importar:baseCompleta')){Utils.toast('Sem permissão para importar base completa.','erro');return;}
    const qtdAtual=tarefas.length;
    if(!confirm(`⚠️ ATENÇÃO: isso vai APAGAR TODAS as ${qtdAtual} tarefas atuais desta obra e criar tudo do zero a partir da planilha. NÃO pode ser desfeito.\n\nSó use isso se quer substituir a base inteira. Pra atualizar campos específicos sem mexer na estrutura, use "Importar Correções".\n\nTem certeza?`))return;
    if(!confirm(`Confirme de novo: apagar ${qtdAtual} tarefas e substituir por uma base nova a partir de "${file.name}"?`))return;
    try{
      Utils.mostrarLoading('Lendo...');
      const ctxBase=await _lerPlanilhaImport(file);
      Utils.esconderLoading();
      if(!_confirmarObraArquivo(ctxBase))return; // planilha de outra obra — cancela ANTES de apagar qualquer coisa
      const {rows,ci,iN}=ctxBase;
      Utils.mostrarLoading('Apagando...');
      const L=20,TIMEOUT_MS=15000;
      const comTimeout=p=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),TIMEOUT_MS))]);
      const idsAntigos=tarefas.map(t=>t.id);
      for(let i=0;i<idsAntigos.length;i+=L){
        Utils.mostrarLoading(`Apagando tarefas atuais... ${Math.min(i+L,idsAntigos.length)}/${idsAntigos.length}`);
        await Promise.all(idsAntigos.slice(i,i+L).map(id=>comTimeout(Database.deletar(obraId,COL,id)).catch(console.error)));
      }
      const regs=[];
      for(let r=1;r<rows.length;r++){
        const row=rows[r],nR=String(row[iN]||''),nm=nR.trim();if(!nm)continue;
        const cd=String(row[ci('codigo')]||'').trim();
        const iNiv=ci('nivel');
        const nivColuna=iNiv>=0?parseInt(row[iNiv]):NaN;
        const pts=(cd.match(/\./g)||[]).length;
        const nivelBySpace=Math.floor((nR.length-nR.trimStart().length)/2);
        const niv=!isNaN(nivColuna)?nivColuna:(cd?pts:nivelBySpace);
        const tipo=niv<=1&&cd?'grupo':'tarefa';
        regs.push({_predRaw:String(row[ci('pred')]||'').trim(),tipo,codigo:cd,nome:nm,nivel:niv,ordem:regs.length+1,
          inicioPlanejado:_pd(row[ci('inicio')]),terminoPlanejado:_pd(row[ci('termino')]),
          duracao:_pDur(row[ci('duracao')]),percentualEsperado:_pN(row[ci('percEsp')]),
          percentualConcluido:_pN(row[ci('percConc')]),
          tarefaPai:String(row[ci('pai')]||'').trim(),grupo:String(row[ci('grupo')]||'').trim(),
          local:String(row[ci('local')]||'').trim(),custo:_pN(row[ci('custo')]),receita:_pN(row[ci('receita')]),
          responsavel:String(row[ci('resp')]||'').trim(),frenteServico:String(row[ci('frente')]||'').trim().toUpperCase(),inicioPlanejadoBase:_pd(row[ci('iniB')]),
          terminoPlanejadoBase:_pd(row[ci('terB')]),inicioDesafio:_pd(row[ci('iniD')]),
          terminoDesafio:_pd(row[ci('terD')]),obraId});
      }
      let imp=0,falhas=0;
      for(let i=0;i<regs.length;i+=L){
        Utils.mostrarLoading(`Criando ${Math.min(i+L,regs.length)}/${regs.length}...`);
        await Promise.all(regs.slice(i,i+L).map(d=>{
          const {_predRaw,...dados}=d;
          return comTimeout(Database.criar(obraId,COL,dados,null,true)).then(id=>{d._idFinal=id;imp++;}).catch(e=>{falhas++;console.error('Falha:',d.nome,e);});
        }));
      }
      // 2ª passada: resolve predecessora (número da linha na planilha) pro ID
      // real da tarefa criada — grava direto no formato canônico por ID.
      const predUpdates=[];
      for(const d of regs){
        if(!d._predRaw||!d._idFinal)continue;
        const partes=[];
        for(const parteRaw of d._predRaw.split(';')){
          const p=parteRaw.trim();if(!p)continue;
          const m=p.match(/^(\d+)\s*(TI|II|TT|IT)?\s*([+-]?\d+)?\s*d{0,2}$/i);
          if(!m)continue;
          const alvo=regs[parseInt(m[1])-1];
          if(alvo&&alvo._idFinal)partes.push({id:alvo._idFinal,tipo:(m[2]||'TI').toUpperCase(),lag:m[3]||''});
        }
        if(partes.length)predUpdates.push({id:d._idFinal,predecessora:_predFormat(partes)});
      }
      for(let i=0;i<predUpdates.length;i+=L){
        Utils.mostrarLoading(`Vinculando predecessoras... ${Math.min(i+L,predUpdates.length)}/${predUpdates.length}`);
        await Promise.all(predUpdates.slice(i,i+L).map(({id,...upd})=>comTimeout(Database.atualizar(obraId,COL,id,upd)).catch(console.error)));
      }
      Utils.toast(falhas?`⚠ ${imp} criadas, ${falhas} falharam — importe de novo pra completar.`:`✅ Base substituída: ${imp} tarefas.`,falhas?'alerta':'sucesso');
      await carregar();
      await _corrigirNiveisSoltos(true);
      await _recalcularDatasPais(true);
      await _recalcularPercTodosPais(true);
    }catch(e){console.error(e);Utils.toast('Erro: '+e.message,'erro');}
    finally{Utils.esconderLoading();}
  }

  // ===================== IMPORTAR CORREÇÕES (patch por campo, casa por Nome) =====================
  // Não mexe em posição/nível/estrutura/código — só atualiza os campos escolhidos
  // das tarefas cujo NOME bate exatamente com uma tarefa já existente na obra.
  // Pensado pro caso: "só quero trazer as datas reais que preenchi numa planilha
  // separada" sem arriscar bagunçar a árvore.
  const CAMPOS_CORRECAO=[
    {id:'inicioReal',label:'Início Real',col:'iniReal'},
    {id:'terminoReal',label:'Término Real',col:'terReal'},
    {id:'percentualConcluido',label:'% Concluído',col:'percConc'},
    {id:'percentualEsperado',label:'% Esperado',col:'percEsp'},
    {id:'inicioPlanejado',label:'Início Planejado',col:'inicio'},
    {id:'terminoPlanejado',label:'Término Planejado',col:'termino'},
    {id:'duracao',label:'Duração',col:'duracao'},
    {id:'responsavel',label:'Responsável',col:'resp'},
    {id:'frenteServico',label:'Frente de Serviço',col:'frente'},
    {id:'predecessora',label:'Predecessora',col:'pred'},
    {id:'custo',label:'Custo',col:'custo'},
    {id:'receita',label:'Receita',col:'receita'},
    {id:'categoria',label:'Categoria',col:'categoria'},
    {id:'subcategoria',label:'Subcategoria',col:'subcategoria'},
    {id:'subgrupo',label:'Subgrupo',col:'subgrupo'},
  ];
  let _correcoesContexto=null;
  async function importarCorrecoes(event){
    const file=event.target.files[0];if(!file)return;event.target.value='';
    if(!Permissions.pode('planejamento','importar:correcoes')){Utils.toast('Sem permissão para importar correções.','erro');return;}
    try{
      Utils.mostrarLoading('Lendo...');
      const ctx=await _lerPlanilhaImport(file);
      Utils.esconderLoading();
      if(!_confirmarObraArquivo(ctx))return; // usuário cancelou — planilha de outra obra
      _correcoesContexto=ctx;
      let modal=document.getElementById('correcoes-modal');if(modal)modal.remove();
      modal=document.createElement('div');modal.id='correcoes-modal';
      modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:2000;display:flex;align-items:center;justify-content:center;';
      modal.innerHTML=`
        <div style="background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:20px;width:480px;max-width:95vw;max-height:85vh;overflow-y:auto;display:flex;flex-direction:column;gap:10px;">
          <div style="font-weight:700;color:var(--cor-primaria);">📥 Importar Correções</div>
          ${ctx.obraArquivoNome?`<div style="font-size:.7rem;color:${ctx.obraArquivoId===obraId?'#4ade80':'#f87171'};">📄 Planilha exportada da obra: <b>${_esc(ctx.obraArquivoNome)}</b>${ctx.obraArquivoId===obraId?' ✓ (mesma obra atual)':' ⚠ (DIFERENTE da obra atual!)'}</div>`:''}
          <div style="font-size:.78rem;color:#888;">Casa cada linha pela coluna <b>ID</b> — o identificador fixo da tarefa: nunca muda, acompanha ela se for movida e não é reaproveitado se outra for excluída. Sem ID, tenta Código, depois Nome, depois Nome+Pai. Posição, nível, estrutura e código NÃO são tocados — só os campos marcados abaixo:</div>
          <div id="correcoes-campos" style="display:flex;flex-direction:column;gap:6px;">
            ${CAMPOS_CORRECAO.map(c=>`<label style="display:flex;align-items:center;gap:8px;font-size:.82rem;cursor:pointer;color:#ddd;">
              <input type="checkbox" value="${c.id}" style="width:16px;height:16px;flex-shrink:0;accent-color:var(--cor-primaria);">
              <span style="color:#ddd;">${c.label}</span>
            </label>`).join('')}
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;">
            <button class="btn btn-secundario btn-sm" onclick="document.getElementById('correcoes-modal').remove()">Cancelar</button>
            <button class="btn btn-primario btn-sm" onclick="Planejamento._executarCorrecoes()">Continuar →</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }catch(e){console.error(e);Utils.toast('Erro: '+e.message,'erro');Utils.esconderLoading();}
  }
  async function _executarCorrecoes(){
    if(!_correcoesContexto)return;
    const {rows,ci,iN}=_correcoesContexto;
    const camposMarcados=[...document.querySelectorAll('#correcoes-campos input:checked')].map(cb=>cb.value);
    if(!camposMarcados.length){Utils.toast('Marque ao menos 1 campo.','alerta');return;}
    const modal=document.getElementById('correcoes-modal');if(modal)modal.remove();

    // CÓDIGO -> lista de tarefas. O código é a chave de verdade: ele não muda
    // quando alguém renomeia a tarefa, e é único mesmo quando o nome se repete
    // em ramos diferentes da obra ("Hall" em 1.3.4.x e em 1.3.6.x). Casar por
    // nome primeiro fazia dezenas de linhas caírem em "ambígua" à toa.
    const porCodigo=new Map();
    for(const t of tarefas){
      const cod=(t.codigo||'').trim();
      if(!cod)continue;
      if(!porCodigo.has(cod))porCodigo.set(cod,[]);
      porCodigo.get(cod).push(t);
    }
    // Nome -> lista de tarefas. Só entra como RESERVA, pra linha sem código na
    // planilha ou cujo código não existe na obra (tarefa criada à mão depois).
    const porNome=new Map();
    for(const t of tarefas){
      const chave=(t.nome||'').trim().toLowerCase();
      if(!chave)continue;
      if(!porNome.has(chave))porNome.set(chave,[]);
      porNome.get(chave).push(t);
    }
    // Nome do PAI de cada tarefa. A hierarquia aqui é implícita: ordena por
    // 'ordem' e o pai é a tarefa anterior mais próxima com nível 1 acima —
    // mesmo critério que o editor de árvore usa (_arvFilhos).
    // Serve pra desempatar grupos que se repetem sob pais diferentes e que
    // NÃO têm código na planilha: "Apartamentos", "Hall" e "Escadaria"
    // aparecem sob Hidráulica, Elétrica, Gesso, Contrapiso, Pintura... e sem
    // isso ficavam todas de fora do import como "ambíguas".
    const paiNomeDe=new Map();
    {
      const ordenadas=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
      const pilha=[];
      for(const t of ordenadas){
        const n=t.nivel||0;
        while(pilha.length&&(pilha[pilha.length-1].nivel||0)>=n)pilha.pop();
        paiNomeDe.set(t.id,pilha.length?(pilha[pilha.length-1].nome||'').trim().toLowerCase():'');
        pilha.push(t);
      }
    }
    const COL_MAP={inicioReal:'iniReal',terminoReal:'terReal',percentualConcluido:'percConc',percentualEsperado:'percEsp',
      inicioPlanejado:'inicio',terminoPlanejado:'termino',duracao:'duracao',responsavel:'resp',frenteServico:'frente',predecessora:'pred',
      custo:'custo',receita:'receita',categoria:'categoria',subcategoria:'subcategoria',subgrupo:'subgrupo'};
    const DATE_FIELDS=new Set(['inicioReal','terminoReal','inicioPlanejado','terminoPlanejado']);
    const NUM_FIELDS=new Set(['percentualConcluido','percentualEsperado','custo','receita','duracao']);
    const idxCodigo=ci('codigo');

    const idxPai=ci('pai'),idxChave=ci('chave');
    const porId=new Map(tarefas.map(t=>[t.id,t]));
    let predNaoResolvidas=0,casadasPorChave=0,casadasPorCodigo=0,casadasPorNome=0,casadasPorPai=0;
    const naoEncontradasNomes=[],ambiguasNomes=[];
    const updates=[];
    for(let r=1;r<rows.length;r++){
      const row=rows[r];
      const nome=String(row[iN]||'').trim();
      if(!nome)continue;
      const codigoLinha=idxCodigo>=0?String(row[idxCodigo]||'').trim():'';
      let t;
      // 0º) pela CHAVE — o id da tarefa. É o único identificador que nunca
      // muda: não depende do nome, nem da posição, nem da estrutura, e não é
      // reaproveitado quando outra tarefa é excluída. Toda linha exportada
      // tem uma. Quando ela está presente, acabou — não precisa adivinhar.
      const chaveLinha=idxChave>=0?String(row[idxChave]||'').trim():'';
      if(chaveLinha&&porId.has(chaveLinha)){
        t=porId.get(chaveLinha);casadasPorChave++;
      } else {
      // 1º) pelo CÓDIGO — chave estável, não depende do nome estar igual
      const porCod=codigoLinha?(porCodigo.get(codigoLinha)||[]):[];
      if(porCod.length===1){
        t=porCod[0];casadasPorCodigo++;
      } else if(porCod.length>1){
        // Código repetido na obra (não deveria) — desempata pelo nome
        const mesmoNome=porCod.filter(c=>(c.nome||'').trim().toLowerCase()===nome.toLowerCase());
        if(mesmoNome.length===1){t=mesmoNome[0];casadasPorCodigo++;}
        else{ambiguasNomes.push(`${nome} (código ${codigoLinha} repetido na obra)`);continue;}
      } else {
        // 2º) RESERVA pelo nome — linha sem código, ou código que não existe
        // na obra (tarefa criada à mão depois da planilha original).
        const candidatos=porNome.get(nome.toLowerCase());
        if(!candidatos||!candidatos.length){
          naoEncontradasNomes.push(codigoLinha?`${nome} (código ${codigoLinha})`:nome);continue;
        }
        if(candidatos.length===1){t=candidatos[0];casadasPorNome++;}
        else{
          // 3º) o PAI desempata. Grupos como "Apartamentos"/"Hall"/"Escadaria"
          // se repetem sob pais diferentes e vêm SEM código na planilha — o
          // código nunca ia resolver, e todas caíam fora do import.
          const paiLinha=idxPai>=0?String(row[idxPai]||'').trim().toLowerCase():'';
          const porPai=paiLinha?candidatos.filter(c=>(paiNomeDe.get(c.id)||'')===paiLinha):[];
          if(porPai.length===1){t=porPai[0];casadasPorPai++;}
          else{ambiguasNomes.push(`${nome}${codigoLinha?` (código ${codigoLinha} não existe na obra)`:''}${paiLinha?` [pai: ${row[idxPai]}]`:' [sem ID, sem código e sem pai na planilha]'}`);continue;}
        }
      }
      }
      const upd={};
      for(const campo of camposMarcados){
        if(campo==='predecessora'){
          // A predecessora na planilha referencia NÚMERO DA LINHA DA PLANILHA
          // (não da obra atual). Resolve: número → nome nessa MESMA planilha
          // → tarefa atual com esse nome → ID. Grava já no formato canônico
          // por ID, nunca mais quebra reordenando.
          const idxPred=ci('pred');
          const raw=idxPred>=0?String(row[idxPred]||'').trim():'';
          if(!raw)continue;
          const partes=[];
          for(const parteRaw of raw.split(';')){
            const p=parteRaw.trim();if(!p)continue;
            const m=p.match(/^(\d+)\s*(TI|II|TT|IT)?\s*([+-]?\d+)?\s*d{0,2}$/i);
            if(!m)continue;
            const linhaAlvo=rows[parseInt(m[1])]; // rows[0]=cabeçalho, rows[N] = linha de ID/nº N
            // Mesma regra do casamento principal: CÓDIGO primeiro (estável),
            // nome só de reserva. Antes só olhava o nome, e toda predecessora
            // que apontava pra uma tarefa de nome repetido virava "não resolvida".
            const chvAlvo=(linhaAlvo&&idxChave>=0)?String(linhaAlvo[idxChave]||'').trim():'';
            const codAlvo=(linhaAlvo&&idxCodigo>=0)?String(linhaAlvo[idxCodigo]||'').trim():'';
            const nomeAlvo=linhaAlvo?String(linhaAlvo[iN]||'').trim():'';
            let alvo=null;
            if(chvAlvo&&porId.has(chvAlvo))alvo=porId.get(chvAlvo);
            else{
            const cAlvo=codAlvo?(porCodigo.get(codAlvo)||[]):[];
            if(cAlvo.length===1)alvo=cAlvo[0];
            else if(cAlvo.length>1){
              const mn=cAlvo.filter(c=>(c.nome||'').trim().toLowerCase()===nomeAlvo.toLowerCase());
              if(mn.length===1)alvo=mn[0];
            } else {
              const candAlvo=nomeAlvo?porNome.get(nomeAlvo.toLowerCase()):null;
              if(candAlvo&&candAlvo.length===1)alvo=candAlvo[0];
              else if(candAlvo&&candAlvo.length>1&&idxPai>=0){
                const paiAlvo=String(linhaAlvo[idxPai]||'').trim().toLowerCase();
                const pp=paiAlvo?candAlvo.filter(c=>(paiNomeDe.get(c.id)||'')===paiAlvo):[];
                if(pp.length===1)alvo=pp[0];
              }
            }
            }
            if(alvo){
              partes.push({id:alvo.id,tipo:(m[2]||'TI').toUpperCase(),lag:m[3]||''});
            } else predNaoResolvidas++;
          }
          upd.predecessora=_predFormat(partes);
          continue;
        }
        const idx=ci(COL_MAP[campo]);
        if(idx<0)continue;
        let valor=row[idx];
        if(DATE_FIELDS.has(campo))valor=_pd(valor);
        else if(campo==='duracao')valor=_pDur(valor);
        else if(NUM_FIELDS.has(campo))valor=_pN(valor);
        else valor=String(valor||'').trim();
        upd[campo]=valor;
      }
      if(Object.keys(upd).length)updates.push({id:t.id,...upd});
    }

    if(!confirm(`${updates.length} tarefa(s) serão atualizadas (${camposMarcados.length} campo(s) cada).\n  · ${casadasPorChave} casadas pelo ID (identificador fixo)\n  · ${casadasPorCodigo} casadas pelo Código\n  · ${casadasPorNome} casadas pelo Nome (linha sem ID/código)\n  · ${casadasPorPai} casadas pelo Nome + Pai (nome repetido, desempatado pela hierarquia)\n${naoEncontradasNomes.length} não encontradas (nem código nem nome batem com alguma tarefa atual).\n${ambiguasNomes.length} ambíguas (puladas por segurança).${predNaoResolvidas?`\n${predNaoResolvidas} predecessora(s) não resolvida(s) (nome ambíguo ou não encontrado).`:''}\n\nConfirmar?`)){_correcoesContexto=null;return;}

    Utils.mostrarLoading('Aplicando correções...');
    const L=20,TIMEOUT_MS=15000;
    const comTimeout=p=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),TIMEOUT_MS))]);
    let falhas=0;
    for(let i=0;i<updates.length;i+=L){
      Utils.mostrarLoading(`Aplicando... ${Math.min(i+L,updates.length)}/${updates.length}`);
      await Promise.all(updates.slice(i,i+L).map(({id,...upd})=>
        comTimeout(Database.atualizar(obraId,COL,id,upd)).catch(e=>{falhas++;console.error('Erro correcao:',id,e);})
      ));
    }
    Utils.esconderLoading();
    Utils.toast(falhas?`⚠ ${updates.length-falhas} corrigidas, ${falhas} falharam.`:`✅ ${updates.length} tarefa(s) corrigidas.`,falhas?'alerta':'sucesso');
    await carregar();
    await _recalcularDatasPais(true);
      await _recalcularPercTodosPais(true);
    _correcoesContexto=null;
    if(naoEncontradasNomes.length||ambiguasNomes.length)_mostrarRevisaoCorrecoes(naoEncontradasNomes,ambiguasNomes);
  }

  // Lista exatamente quais nomes da planilha não bateram (não encontrada) ou
  // bateram em mais de uma tarefa (ambígua) — pra revisar e corrigir o nome
  // manualmente se for o caso, em vez de só saber "23 falharam" sem saber quais.
  function _mostrarRevisaoCorrecoes(naoEncontradas,ambiguas){
    let modal=document.getElementById('revisao-correcoes-modal');if(modal)modal.remove();
    modal=document.createElement('div');modal.id='revisao-correcoes-modal';
    modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:2000;display:flex;align-items:center;justify-content:center;';
    const secao=(titulo,cor,lista,explicacao)=>!lista.length?'':`
      <div style="margin-bottom:14px;">
        <div style="font-weight:700;color:${cor};margin-bottom:4px;">${titulo} (${lista.length})</div>
        <div style="font-size:.72rem;color:#888;margin-bottom:6px;">${explicacao}</div>
        <div style="max-height:180px;overflow-y:auto;border:1px solid #222;border-radius:7px;padding:6px;">
          ${lista.map(n=>`<div style="padding:3px 4px;font-size:.78rem;color:#ccc;border-bottom:1px solid #1c1c1c;">${_esc(n)}</div>`).join('')}
        </div>
      </div>`;
    modal.innerHTML=`
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:20px;width:520px;max-width:95vw;max-height:85vh;overflow-y:auto;display:flex;flex-direction:column;">
        <div style="font-weight:700;color:var(--cor-primaria);margin-bottom:12px;">⚠ Itens não aplicados no Importar Correções</div>
        ${secao('Não encontradas','#f59e0b',naoEncontradas,'O nome na planilha não bate com nenhuma tarefa atual — a Cofield deve ter renomeado, ou é uma tarefa que só existe lá. Nada foi alterado nem criado.')}
        ${secao('Ambíguas','#dc2626',ambiguas,'Nem o Código nem o Nome apontaram pra uma única tarefa — puladas por segurança, pra nunca atualizar a errada. Preencher o Código na planilha resolve.')}
        <button class="btn btn-secundario btn-sm" style="align-self:flex-end;margin-top:8px;" onclick="document.getElementById('revisao-correcoes-modal').remove()">Fechar</button>
      </div>`;
    document.body.appendChild(modal);
  }

  // ===================== IMPORTAR =====================
  async function importarExcel(event){
    const file=event.target.files[0];if(!file)return;event.target.value='';
    if(!Permissions.pode('planejamento','importar:excel')){Utils.toast('Sem permissão para importar Excel.','erro');return;}
    if(!confirm(`Importar vai criar tarefas novas e ATUALIZAR as que já existem com o mesmo Código (tarefas antigas que não estão mais na planilha NÃO são apagadas). Confirmar?`))return;
    try{
      Utils.mostrarLoading('Lendo...');
      if(typeof XLSX==='undefined')await _ls('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
      const ab=await file.arrayBuffer();
      const wb=XLSX.read(ab,{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
      if(rows.length<2){Utils.toast('Planilha vazia.','alerta');return;}
      const hdrs=rows[0].map(h=>String(h||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' '));
      const ci=n=>{const a={chave:['id','chave','id fixo','uid'],linha:['linha'],codigo:['codigo','code'],nivel:['nivel','nível','level'],nome:['nome','name','tarefa','atividade'],duracao:['duracao','duration'],
        inicio:['inicio','start','inicio planejado'],termino:['termino','finish','fim','termino planejado'],
        percEsp:['esperado','% esperado'],percConc:['concluido','% concluido','% complete'],
        pred:['predecessora','predecessor','prececessora'],pai:['pai','tarefa pai','parent'],grupo:['grupo','group'],
        local:['local','location'],custo:['custo','cost'],receita:['receita','revenue'],
        resp:['responsavel','responsible','resource'],frente:['frente','frente de servico','equipe'],iniB:['inicio linha de base'],terB:['termino linha de base'],
        iniD:['inicio desafio'],terD:['termino desafio']};
        for(const al of(a[n]||[])){const i=hdrs.indexOf(al);if(i>=0)return i;}return-1;};
      const iN=ci('nome');if(iN<0){Utils.toast('Coluna Nome não encontrada.','erro');return;}
      // Mapa das tarefas JÁ EXISTENTES por Código — permite reconhecer o que já foi
      // importado numa tentativa anterior (mesmo que ela tenha parado no meio) e só
      // atualizar/criar o que falta, em vez de apagar tudo e recomeçar do zero.
      const existentesPorCod=new Map(tarefas.filter(t=>t.codigo).map(t=>[t.codigo,t]));
      const regs=[];
      for(let r=1;r<rows.length;r++){
        const row=rows[r],nR=String(row[iN]||''),nm=nR.trim();if(!nm)continue;
        const cd=String(row[ci('codigo')]||'').trim();
        // Nível: prioriza a coluna "Nível" explícita (exportada por este sistema e sempre
        // fiel à árvore atual). Código/indentação só entram como fallback para planilhas
        // externas sem essa coluna — código fica desatualizado quando a árvore é
        // reestruturada no Editor de Estrutura (agrupar/mover não recalcula o código),
        // e usá-lo como prioridade era o que achatava a hierarquia num reimport.
        const iNiv=ci('nivel');
        const nivColuna=iNiv>=0?parseInt(row[iNiv]):NaN;
        const pts=(cd.match(/\./g)||[]).length;
        const nivelByCod=pts; // 0 pontos = nível 0, 1 ponto = nível 1, etc.
        const nivelBySpace=Math.floor((nR.length-nR.trimStart().length)/2);
        const niv=!isNaN(nivColuna)?nivColuna:(cd?nivelByCod:nivelBySpace);
        const tipo=niv<=1&&cd?'grupo':'tarefa';
        const existente=cd?existentesPorCod.get(cd):null;
        regs.push({_idExistente:existente?.id||null,_predRaw:String(row[ci('pred')]||'').trim(),tipo,codigo:cd,nome:nm,nivel:niv,ordem:regs.length+1,
          inicioPlanejado:_pd(row[ci('inicio')]),terminoPlanejado:_pd(row[ci('termino')]),
          duracao:_pDur(row[ci('duracao')]),percentualEsperado:_pN(row[ci('percEsp')]),
          percentualConcluido:_pN(row[ci('percConc')]),
          tarefaPai:String(row[ci('pai')]||'').trim(),grupo:String(row[ci('grupo')]||'').trim(),
          local:String(row[ci('local')]||'').trim(),custo:_pN(row[ci('custo')]),receita:_pN(row[ci('receita')]),
          responsavel:String(row[ci('resp')]||'').trim(),frenteServico:String(row[ci('frente')]||'').trim().toUpperCase(),inicioPlanejadoBase:_pd(row[ci('iniB')]),
          terminoPlanejadoBase:_pd(row[ci('terB')]),inicioDesafio:_pd(row[ci('iniD')]),
          terminoDesafio:_pd(row[ci('terD')]),obraId});
      }
      // Lote pequeno (20) e sequencial + timeout por escrita: lotes grandes (200) em
      // paralelo já travaram silenciosamente na mesma linha em planilhas grandes —
      // sinal de que o SDK do Firestore engasga com muita escrita simultânea
      // (agravado pelo cache offline habilitado). Timeout garante que uma escrita
      // travada vira FALHA reportada, em vez de travar o import inteiro pra sempre.
      const L=20, TIMEOUT_MS=15000;
      const comTimeout=p=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),TIMEOUT_MS))]);
      let imp=0,falhas=0;
      for(let i=0;i<regs.length;i+=L){
        Utils.mostrarLoading(`Importando ${Math.min(i+L,regs.length)}/${regs.length}...`);
        await Promise.all(regs.slice(i,i+L).map(d=>{
          const {_idExistente,_predRaw,...dados}=d;
          const op=_idExistente
            ?comTimeout(Database.atualizar(obraId,COL,_idExistente,dados)).then(()=>{d._idFinal=_idExistente;})
            :comTimeout(Database.criar(obraId,COL,dados,null,true)).then(id=>{d._idFinal=id;});
          return op.then(()=>imp++).catch(e=>{falhas++;console.error('Falha ao importar:',d.nome,e);});
        }));
      }
      // 2ª passada: resolve cada predecessora (número da LINHA NA PLANILHA) pro ID
      // real da tarefa correspondente, já criada/atualizada acima — grava direto
      // no formato canônico por ID. Nunca mais quebra reordenando depois, porque
      // não depende de posição, só do vínculo direto entre as tarefas.
      const predUpdates=[];
      for(const d of regs){
        if(!d._predRaw||!d._idFinal)continue;
        const partes=[];
        for(const parteRaw of d._predRaw.split(';')){
          const p=parteRaw.trim();if(!p)continue;
          const m=p.match(/^(\d+)\s*(TI|II|TT|IT)?\s*([+-]?\d+)?\s*d{0,2}$/i);
          if(!m)continue;
          const alvo=regs[parseInt(m[1])-1];
          if(alvo&&alvo._idFinal)partes.push({id:alvo._idFinal,tipo:(m[2]||'TI').toUpperCase(),lag:m[3]||''});
        }
        if(partes.length)predUpdates.push({id:d._idFinal,predecessora:_predFormat(partes)});
      }
      for(let i=0;i<predUpdates.length;i+=L){
        Utils.mostrarLoading(`Vinculando predecessoras... ${Math.min(i+L,predUpdates.length)}/${predUpdates.length}`);
        await Promise.all(predUpdates.slice(i,i+L).map(({id,...upd})=>comTimeout(Database.atualizar(obraId,COL,id,upd)).catch(console.error)));
      }
      // Órfãs: tarefas que JÁ EXISTIAM (com Código) e não vieram nesta planilha —
      // não apaga sozinho (pode ser intencional manter, ou pode ter sido removida
      // de propósito na revisão do CSO). Mostra pra decisão manual.
      const codigosDaPlanilha=new Set(regs.map(r=>r.codigo).filter(Boolean));
      const orfas=tarefas.filter(t=>t.codigo&&!codigosDaPlanilha.has(t.codigo));

      Utils.toast(falhas?`⚠ ${imp} ok, ${falhas} falharam — importe de novo pra completar (retoma de onde parou).`:`✅ ${imp} tarefas importadas/atualizadas!`,falhas?'alerta':'sucesso');await carregar();
      await _corrigirNiveisSoltos(true);
      await _recalcularDatasPais(true);
      await _recalcularPercTodosPais(true);
      if(orfas.length)_mostrarOrfasImport(orfas);
    }catch(e){console.error(e);Utils.toast('Erro: '+e.message,'erro');}finally{Utils.esconderLoading();}
  }

  // Painel de revisão pós-import: lista tarefas que existiam antes e não vieram
  // na planilha importada, com checkbox pra escolher quais excluir. Nada é
  // apagado sozinho — decisão manual, uma a uma ou em bloco.
  let _orfasAtuais=[];
  function _mostrarOrfasImport(orfas){
    _orfasAtuais=orfas;
    let modal=document.getElementById('orfas-modal');
    if(modal)modal.remove();
    modal=document.createElement('div');
    modal.id='orfas-modal';
    modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:2000;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML=`
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:20px;width:560px;max-width:95vw;max-height:80vh;display:flex;flex-direction:column;gap:10px;">
        <div style="font-weight:700;color:var(--cor-primaria);">⚠ ${orfas.length} tarefa(s) não vieram nesta planilha</div>
        <div style="font-size:.78rem;color:#888;">Já existiam na obra e têm Código, mas esse Código não apareceu no arquivo importado — pode ser algo removido de propósito na revisão, ou apenas um código que mudou. Marque as que quer excluir; o resto fica como está.</div>
        <div style="display:flex;gap:8px;font-size:.75rem;">
          <span style="cursor:pointer;color:var(--cor-primaria);text-decoration:underline;" onclick="Planejamento._orfasMarcarTodas(true)">Marcar todas</span>
          <span style="cursor:pointer;color:#888;text-decoration:underline;" onclick="Planejamento._orfasMarcarTodas(false)">Desmarcar todas</span>
        </div>
        <div id="orfas-lista" style="flex:1;overflow-y:auto;border:1px solid #222;border-radius:7px;padding:6px;">
          ${orfas.map(t=>`<label style="display:flex;align-items:center;gap:8px;padding:5px 4px;font-size:.8rem;border-bottom:1px solid #222;cursor:pointer;">
            <input type="checkbox" data-orfa-id="${t.id}">
            <span style="color:#666;font-family:var(--font-mono);font-size:.68rem;">${t.codigo||''}</span>
            <span style="flex:1;color:#ddd;">${_esc(t.nome||'')}</span>
          </label>`).join('')}
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn btn-secundario btn-sm" onclick="document.getElementById('orfas-modal').remove()">Manter tudo / Fechar</button>
          <button class="btn btn-primario btn-sm" style="background:#c0392b;border-color:#c0392b;" onclick="Planejamento._orfasExcluirMarcadas()">🗑 Excluir marcadas</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  function _orfasMarcarTodas(v){
    document.querySelectorAll('#orfas-lista input[data-orfa-id]').forEach(cb=>cb.checked=v);
  }
  async function _orfasExcluirMarcadas(){
    if(!Permissions.pode('planejamento','excluir:orfas')){Utils.toast('Sem permissão para excluir órfãs.','erro');return;}
    const ids=[...document.querySelectorAll('#orfas-lista input[data-orfa-id]:checked')].map(cb=>cb.dataset.orfaId);
    if(!ids.length){Utils.toast('Nada marcado.','alerta');return;}
    if(!confirm(`Excluir ${ids.length} tarefa(s)? Não pode ser desfeito.`))return;
    Utils.mostrarLoading('Excluindo...');
    try{
      const numAntes=_capturarNumAntes();
      await Promise.all(ids.map(id=>Database.deletar(obraId,COL,id).catch(console.error)));
      const modal=document.getElementById('orfas-modal');if(modal)modal.remove();
      Utils.toast(`${ids.length} tarefa(s) excluída(s).`,'sucesso');
      await carregar();
      ids.forEach(id=>numAntes.delete(id));
      await _remapAposMudancaPosicoes(numAntes);
    }catch(e){console.error(e);Utils.toast('Erro ao excluir.','erro');}
    finally{Utils.esconderLoading();}
  }

  // ===================== M1-A: ESTRUTURA DA OBRA (Torre>Pavimento>Apto) =====================
  const _EST_OBRA_DOC='estruturaObra';
  function _novoIdEst(){return 'e'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}

  async function _carregarEstruturaObra(forcar){
    if(_estruturaObraCache&&!forcar)return _estruturaObraCache;
    try{
      const snap=await db.collection('obras').doc(obraId).collection('config').doc(_EST_OBRA_DOC).get();
      _estruturaObraCache=snap.exists?(snap.data()||{torres:[]}):{torres:[]};
    }catch(e){console.error('Erro ao carregar estrutura da obra:',e);_estruturaObraCache={torres:[]};}
    if(!_estruturaObraCache.torres)_estruturaObraCache.torres=[];
    return _estruturaObraCache;
  }
  async function _salvarEstruturaObra(estrutura){
    _estruturaObraCache=estrutura;
    try{await db.collection('obras').doc(obraId).collection('config').doc(_EST_OBRA_DOC).set(estrutura,{merge:false});}
    catch(e){console.error('Erro ao salvar estrutura da obra:',e);Utils.toast('Erro ao salvar.','erro');}
  }

  // ══════════════════════════════════════════
  // AUTO-VINCULAR POR NOME — detecta o pavimento/apto de cada tarefa-folha
  // comparando o NOME DELA com os nomes já cadastrados na Estrutura da Obra
  // (M1), em vez de exigir clique manual tarefa por tarefa. Usa os próprios
  // dados da obra como "dicionário" de busca — não depende de regex de
  // formato de texto fixo, então funciona com qualquer padrão de nomenclatura
  // que a obra já usa, desde que o nome do pavimento/apto apareça dentro do
  // nome da tarefa (ex: "Contrapiso: 1º Pavimento - Final 02" casa com o
  // pavimento "1º Pavimento" e — se existir um apto "Final 02" dentro dele —
  // com esse apto também). SEMPRE mostra prévia pra revisão antes de gravar
  // — nunca aplica direto, pra não sobrescrever vínculo errado em massa.
  // ══════════════════════════════════════════
  // "º" (indicador ordinal, U+00BA) e "°" (símbolo de grau, U+00B0) são visualmente
  // idênticos mas são caracteres DIFERENTES — Cofield/tarefas usam um, Estrutura
  // da Obra pode ter o outro (depende de como foi digitado). Sem tratar os dois
  // como iguais aqui, "1º Pavimento" cadastrado nunca casava com "1° Pavimento"
  // no nome da tarefa — foi isso que fez o reconhecimento ficar baixo (185/2198).
  function _normTexto(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[°º]/g,'o').trim();}

  function _detectarVinculoPorNome(nomeTarefa,estrutura){
    const nome=_normTexto(nomeTarefa);
    let melhor=null,melhorLen=0; // prioriza o match MAIS LONGO (mais específico) entre todos os candidatos
    (estrutura.torres||[]).forEach(torre=>{
      (torre.pavimentos||[]).forEach(pav=>{
        const nPav=_normTexto(pav.nome);
        if(nPav.length>=3&&nome.includes(nPav)&&nPav.length>melhorLen){melhor={torreId:torre.id,pavimentoId:pav.id,apartamentoId:null,pavNome:pav.nome,aptoNome:null};melhorLen=nPav.length;}
        (pav.apartamentos||[]).forEach(apto=>{
          const nApto=_normTexto(apto.nome);
          if(nApto.length>=1&&nome.includes(nApto)&&nome.includes(nPav)&&(nPav.length+nApto.length)>melhorLen){
            melhor={torreId:torre.id,pavimentoId:pav.id,apartamentoId:apto.id,pavNome:pav.nome,aptoNome:apto.nome};
            melhorLen=nPav.length+nApto.length;
          }
        });
      });
    });
    return melhor;
  }

  async function _abrirAutoVincular(){
    await _carregarEstruturaObra();
    const est=_estruturaObraCache;
    if(!est.torres||!est.torres.length){
      Utils.toast('Cadastre a Estrutura da Obra (Torre/Pavimento/Apto) primeiro.','alerta');
      return;
    }
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const folhas=sorted.filter(t=>!_arvFilhos(t,sorted).length);
    const propostas=folhas.map(t=>({tarefa:t,match:_detectarVinculoPorNome(t.nome,est)})).filter(p=>p.match);
    if(!propostas.length){
      Utils.toast('Nenhuma tarefa teve o nome do pavimento/apto reconhecido. Confira se os nomes cadastrados em Estrutura da Obra aparecem dentro do nome das tarefas.','alerta');
      return;
    }
    let pop=document.getElementById('autovinc-modal');if(pop)pop.remove();
    pop=document.createElement('div');pop.id='autovinc-modal';
    pop.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:2000;display:flex;align-items:center;justify-content:center;';
    pop.innerHTML=`
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:20px;width:640px;max-width:95vw;max-height:85vh;overflow-y:auto;display:flex;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="font-weight:700;color:var(--cor-primaria);">🔗 Auto-vincular por Nome — Prévia</div>
          <span style="cursor:pointer;color:#888;font-size:1.1rem;" onclick="document.getElementById('autovinc-modal').remove()">✕</span>
        </div>
        <div style="font-size:.72rem;color:#888;margin-bottom:10px;">${propostas.length} de ${folhas.length} tarefas tiveram o local reconhecido pelo nome. Desmarque as que estiverem erradas antes de aplicar — tarefa que já tinha vínculo manual será SOBRESCRITA se ficar marcada.</div>
        <div id="autovinc-lista" style="display:flex;flex-direction:column;gap:2px;max-height:50vh;overflow-y:auto;border:1px solid #292929;border-radius:6px;padding:6px;">
          ${propostas.map((p,i)=>`
            <label style="display:flex;align-items:center;gap:8px;font-size:.76rem;padding:4px 4px;border-bottom:1px solid #232323;cursor:pointer;">
              <input type="checkbox" data-idx="${i}" checked>
              <span style="flex:1;color:#ddd;">${_esc(p.tarefa.nome)}</span>
              <span style="color:var(--cor-primaria);white-space:nowrap;">${_esc(p.match.pavNome)}${p.match.aptoNome?': '+_esc(p.match.aptoNome):' (todos)'}</span>
              ${(p.tarefa.vinculoEstrutura||[]).length?'<span style="color:#eab308;font-size:.68rem;" title="Já tinha vínculo manual — será sobrescrito">⚠já tinha</span>':''}
            </label>`).join('')}
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
          <button class="btn btn-secundario btn-sm" onclick="document.getElementById('autovinc-modal').remove()">Cancelar</button>
          <button class="btn btn-primario btn-sm" onclick="Planejamento._aplicarAutoVincular()">Aplicar Selecionados</button>
        </div>
      </div>`;
    document.body.appendChild(pop);
    pop.dataset.propostas=JSON.stringify(propostas.map(p=>({tarefaId:p.tarefa.id,match:p.match})));
  }

  async function _aplicarAutoVincular(){
    const pop=document.getElementById('autovinc-modal');if(!pop)return;
    const propostas=JSON.parse(pop.dataset.propostas||'[]');
    const marcados=[...pop.querySelectorAll('input[type="checkbox"]:checked')].map(cb=>parseInt(cb.dataset.idx));
    const selecionadas=propostas.filter((_,i)=>marcados.includes(i));
    if(!selecionadas.length){pop.remove();return;}
    Utils.mostrarLoading(`Vinculando ${selecionadas.length} tarefa(s)...`);
    try{
      for(const p of selecionadas){
        const vinculo=[{torreId:p.match.torreId,pavimentoId:p.match.pavimentoId,apartamentoId:p.match.apartamentoId}];
        await Database.atualizar(obraId,COL,p.tarefaId,{vinculoEstrutura:vinculo});
        const t=tarefas.find(x=>x.id===p.tarefaId);if(t)t.vinculoEstrutura=vinculo;
      }
      pop.remove();
      Utils.toast(`${selecionadas.length} tarefa(s) vinculada(s) automaticamente.`,'sucesso');
      _paintRows();
    }catch(e){console.error(e);Utils.toast('Erro ao aplicar vínculos.','erro');}
    finally{Utils.esconderLoading();}
  }

  async function _abrirEstruturaObra(){
    await _carregarEstruturaObra();
    let pop=document.getElementById('estobra-modal');if(pop)pop.remove();
    pop=document.createElement('div');pop.id='estobra-modal';
    pop.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:2000;display:flex;align-items:center;justify-content:center;';
    pop.innerHTML=`
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:20px;width:560px;max-width:95vw;max-height:85vh;overflow-y:auto;display:flex;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="font-weight:700;color:var(--cor-primaria);">🏢 Estrutura da Obra</div>
          <span style="cursor:pointer;color:#888;font-size:1.1rem;" onclick="document.getElementById('estobra-modal').remove()">✕</span>
        </div>
        <div style="font-size:.72rem;color:#888;margin-bottom:12px;">Torre → Pavimento → Apartamento/Unidade. Usado pra vincular tarefas a um local (coluna "Local (Pav/Apto)") e, com o botão abaixo, pra preencher automaticamente as colunas Grupo/Subgrupo de toda a obra — não afeta os módulos de Levantamento.</div>
        <div id="estobra-body"></div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn btn-primario btn-sm" onclick="Planejamento._addTorre()">＋ Nova Torre</button>
          <button class="btn btn-secundario btn-sm" onclick="Planejamento._abrirGerarGrupos()" title="Preenche Grupo/Subgrupo de todas as tarefas comparando o nome delas com os pavimentos cadastrados aqui — mostra prévia antes de aplicar">⚡ Gerar Grupos</button>
        </div>
      </div>`;
    document.body.appendChild(pop);
    _renderEstruturaObraBody();
  }

  function _renderEstruturaObraBody(){
    const el=document.getElementById('estobra-body');if(!el)return;
    const est=_estruturaObraCache||{torres:[]};
    const torres=[...est.torres].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    if(!torres.length){el.innerHTML='<div style="color:#555;font-size:.8rem;padding:10px 0;">Nenhuma torre cadastrada ainda.</div>';return;}
    el.innerHTML=torres.map(t=>{
      const pavs=[...(t.pavimentos||[])].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
      return `<div style="border:1px solid #292929;border-radius:7px;padding:8px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
          <input value="${_esc(t.nome||'')}" onchange="Planejamento._editarNomeEst('torre','${t.id}',this.value)" style="flex:1;background:#111;border:1px solid #333;border-radius:4px;color:#fff;padding:4px 6px;font-size:.82rem;font-weight:600;">
          <span style="cursor:pointer;color:#dc2626;font-size:.85rem;" onclick="Planejamento._removerNoEst('torre','${t.id}')" title="Excluir torre">✕</span>
        </div>
        <div style="margin-left:14px;">
          ${pavs.map(p=>{
            const aptos=[...(p.apartamentos||[])].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
            return `<div style="border-left:2px solid #333;padding:4px 0 4px 10px;margin-bottom:4px;">
              <div style="display:flex;align-items:center;gap:6px;">
                <input value="${_esc(p.nome||'')}" onchange="Planejamento._editarNomeEst('pavimento','${p.id}',this.value)" style="flex:1;background:#111;border:1px solid #333;border-radius:4px;color:#ddd;padding:3px 6px;font-size:.78rem;">
                <span style="cursor:pointer;color:var(--cor-primaria);font-size:.72rem;" onclick="Planejamento._addApartamento('${p.id}')" title="Adicionar apto">＋apto</span>
                <span style="cursor:pointer;color:var(--cor-primaria);font-size:.72rem;" onclick="Planejamento._duplicarPavimento('${p.id}')" title="Duplicar este pavimento (com os aptos dele)">📋 duplicar</span>
                <span style="cursor:pointer;color:#dc2626;font-size:.8rem;" onclick="Planejamento._removerNoEst('pavimento','${p.id}')" title="Excluir pavimento">✕</span>
              </div>
              ${aptos.length?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 0 10px;">
                ${aptos.map(a=>`<span style="display:inline-flex;align-items:center;gap:3px;background:#111;border:1px solid #333;border-radius:100px;padding:2px 4px 2px 8px;font-size:.7rem;color:#ccc;">
                  <input value="${_esc(a.nome||'')}" onchange="Planejamento._editarNomeEst('apartamento','${a.id}',this.value)" style="width:50px;background:transparent;border:none;color:#ccc;font-size:.7rem;padding:0;">
                  <span style="cursor:pointer;color:#dc2626;" onclick="Planejamento._removerNoEst('apartamento','${a.id}')">✕</span>
                </span>`).join('')}
              </div>`:''}
            </div>`;
          }).join('')}
          <span style="cursor:pointer;color:var(--cor-primaria);font-size:.75rem;display:inline-block;margin-top:2px;" onclick="Planejamento._addPavimento('${t.id}')">＋ pavimento</span>
        </div>
      </div>`;
    }).join('');
  }

  function _acharNoEst(tipo,id){
    const est=_estruturaObraCache;if(!est)return null;
    if(tipo==='torre')return est.torres.find(t=>t.id===id);
    if(tipo==='pavimento'){for(const t of est.torres){const p=(t.pavimentos||[]).find(x=>x.id===id);if(p)return p;}return null;}
    if(tipo==='apartamento'){for(const t of est.torres)for(const p of(t.pavimentos||[])){const a=(p.apartamentos||[]).find(x=>x.id===id);if(a)return a;}return null;}
    return null;
  }
  async function _editarNomeEst(tipo,id,valor){
    const no=_acharNoEst(tipo,id);if(!no)return;
    no.nome=valor.trim();
    await _salvarEstruturaObra(_estruturaObraCache);
  }
  async function _addTorre(){
    const est=_estruturaObraCache||{torres:[]};
    est.torres.push({id:_novoIdEst(),nome:'Nova Torre',ordem:est.torres.length+1,pavimentos:[]});
    await _salvarEstruturaObra(est);
    _renderEstruturaObraBody();
  }
  async function _addPavimento(torreId){
    const t=_acharNoEst('torre',torreId);if(!t)return;
    if(!t.pavimentos)t.pavimentos=[];
    t.pavimentos.push({id:_novoIdEst(),nome:'Novo Pavimento',ordem:t.pavimentos.length+1,apartamentos:[]});
    await _salvarEstruturaObra(_estruturaObraCache);
    _renderEstruturaObraBody();
  }
  async function _addApartamento(pavimentoId){
    const p=_acharNoEst('pavimento',pavimentoId);if(!p)return;
    if(!p.apartamentos)p.apartamentos=[];
    p.apartamentos.push({id:_novoIdEst(),nome:String(p.apartamentos.length+1),ordem:p.apartamentos.length+1});
    await _salvarEstruturaObra(_estruturaObraCache);
    _renderEstruturaObraBody();
  }
  // Duplica um pavimento inteiro (com os apartamentos dele) — útil pra torres
  // com vários andares repetidos (ex: 1º ao 15º Pavimento com o mesmo layout
  // de apto). IDs sempre novos (nunca reaproveita id de outro nó, senão os
  // vínculos das tarefas ficariam ambíguos entre original e cópia).
  async function _duplicarPavimento(pavimentoId){
    const est=_estruturaObraCache;if(!est)return;
    let torreDono=null,pOriginal=null,idx=-1;
    for(const t of est.torres){
      const i=(t.pavimentos||[]).findIndex(p=>p.id===pavimentoId);
      if(i>=0){torreDono=t;pOriginal=t.pavimentos[i];idx=i;break;}
    }
    if(!torreDono||!pOriginal)return;
    const copia={
      id:_novoIdEst(),
      nome:pOriginal.nome+' (cópia)',
      ordem:0, // recalculado abaixo
      apartamentos:(pOriginal.apartamentos||[]).map(a=>({id:_novoIdEst(),nome:a.nome,ordem:a.ordem}))
    };
    torreDono.pavimentos.splice(idx+1,0,copia);
    torreDono.pavimentos.forEach((p,i)=>{p.ordem=i+1;});
    await _salvarEstruturaObra(est);
    _renderEstruturaObraBody();
    Utils.toast(`Pavimento duplicado (${copia.apartamentos.length} apto(s) copiado(s)) — edite o nome.`,'sucesso');
  }

  // ══════════════════════════════════════════
  // GERAR GRUPOS — usa a Estrutura da Obra (os pavimentos cadastrados: 2º
  // Subsolo, 1º Subsolo, Térreo, 1º...16º Pavimento, Ático, Reservatório,
  // Fachada etc.) como dicionário pra preencher Grupo e Subgrupo de toda
  // tarefa automaticamente, comparando o NOME do pavimento com o NOME da
  // tarefa — mesmo mecanismo de match do Auto-vincular por Nome (M1).
  // Subgrupo só é calculado quando o pavimento bate no padrão "Nº Pavimento"
  // E a tarefa tem "- Final NN" no nome: Subgrupo = andar×10 + nº do Final
  // (ex: 1º Pavimento + Final 02 = 12). Fora disso, Subgrupo fica em branco
  // (Térreo/Subsolo/Ático/Reservatório/Fachada não têm essa combinação).
  // SEMPRE mostra prévia antes de gravar — nunca aplica direto.
  // ══════════════════════════════════════════
  // Reconhece "Nº Pavimento/Subsolo" dentro de um texto já normalizado (ver
  // _normTexto), aceitando as abreviações comuns — cobre isso tudo como a
  // MESMA coisa: 1SS · 1ºSS · 1º SUB · 1ºSUBSOLO · 1º SUBSOLO (subsolo) e
  // 1º ANDAR · 1º PAVIMENTO · 1º AND · 1º PAV (pavimento). Devolve
  // {tipo,num} ou null — nunca o texto batido, só o significado (número +
  // se é subsolo ou pavimento), pra comparar estrutura com estrutura em vez
  // de depender de bater a mesma abreviação nos dois lados.
  function _parsePavCanonico(textoNorm){
    let m=textoNorm.match(/(\d+)\s*o?\s*(subsolo|sub|ss)\b/);
    if(m)return{tipo:'subsolo',num:parseInt(m[1])};
    m=textoNorm.match(/\b(subsolo|sub|ss)\s*-?\s*(\d+)\b/);
    if(m)return{tipo:'subsolo',num:parseInt(m[2])};
    m=textoNorm.match(/(\d+)\s*o?\s*(pavimento|pav|andar|and)\b/);
    if(m)return{tipo:'pavimento',num:parseInt(m[1])};
    m=textoNorm.match(/\b(pavimento|pav|andar|and)\s*-?\s*(\d+)\b/);
    if(m)return{tipo:'pavimento',num:parseInt(m[2])};
    return null;
  }
  function _finalizarMatchGrupo(grupoNome,nomeTarefa){
    const mPav=grupoNome.match(/^(\d+)[°º]\s*Pavimento$/i);
    const mFinal=String(nomeTarefa).match(/Final\s*0*(\d+)\s*$/i);
    const subgrupo=(mPav&&mFinal)?(parseInt(mPav[1])*10+parseInt(mFinal[1])):null;
    return{grupo:grupoNome,subgrupo};
  }
  // Expande abreviações que só fazem sentido dentro de nome de tarefa (não
  // são "número+tipo" como Pavimento/Subsolo, são casos isolados de sigla):
  // "T° Int."/"T° Ext." = Térreo (Interno/Externo) — usado em toda tarefa de
  // área comum. "Reserv." = Reservatório truncado. Sem isso, nenhuma tarefa
  // de área comum casava com o pavimento "Térreo" cadastrado.
  function _expandirAbreviacoes(textoNorm){
    return textoNorm
      .replace(/(?:^|[\s-])t\s*o?\s*(int|ext)\b/g,' terreo ')
      .replace(/\breserv\.?\b/g,'reservatorio');
  }
  function _detectarGrupoPorNome(nomeTarefa,estrutura){
    const nome=_expandirAbreviacoes(_normTexto(nomeTarefa));
    const pavimentos=[];
    (estrutura.torres||[]).forEach(torre=>(torre.pavimentos||[]).forEach(pav=>pavimentos.push(pav)));
    // 1º) match ESTRUTURAL por número+tipo — cobre qualquer jeito de
    // escrever o mesmo andar/subsolo, sem precisar cadastrar variação nenhuma.
    const canonTarefa=_parsePavCanonico(nome);
    if(canonTarefa){
      for(const pav of pavimentos){
        const canonPav=_parsePavCanonico(_normTexto(pav.nome));
        if(canonPav&&canonPav.tipo===canonTarefa.tipo&&canonPav.num===canonTarefa.num){
          return _finalizarMatchGrupo(pav.nome,nomeTarefa);
        }
      }
    }
    // 2º) sem número (Térreo, Ático, Reservatório, Fachada etc.) — o nome
    // do pavimento cadastrado precisa aparecer dentro do nome da tarefa,
    // igual antes. Pega o match mais longo (mais específico).
    let melhor=null,melhorLen=0;
    for(const pav of pavimentos){
      const nPav=_normTexto(pav.nome);
      if(nPav.length>=3&&nome.includes(nPav)&&nPav.length>melhorLen){melhor=pav.nome;melhorLen=nPav.length;}
    }
    if(!melhor)return null;
    return _finalizarMatchGrupo(melhor,nomeTarefa);
  }


  let _gerarGruposLista=null; // estado vivo da prévia (permite editar e propagar)
  let _gerarGruposPavimentos=null; // lista fechada de nomes de pavimento (Estrutura da Obra) — só se escolhe daqui, nunca digita livre

  async function _abrirGerarGrupos(){
    await _carregarEstruturaObra();
    const est=_estruturaObraCache;
    const totalPav=(est.torres||[]).reduce((s,t)=>s+(t.pavimentos||[]).length,0);
    if(!totalPav){
      Utils.toast('Cadastre os pavimentos na Estrutura da Obra primeiro (2º Subsolo, Térreo, 1º...16º Pavimento, Ático, Reservatório, Fachada etc.).','alerta');
      return;
    }
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const folhas=sorted.filter(t=>!_arvFilhos(t,sorted).length);
    const propostas=folhas.map(t=>({tarefa:t,match:_detectarGrupoPorNome(t.nome,est)})).filter(p=>p.match);
    if(!propostas.length){
      Utils.toast('Nenhuma tarefa teve o nome de um pavimento cadastrado reconhecido dentro do próprio nome.','alerta');
      return;
    }
    const mudam=propostas.filter(p=>p.tarefa.grupo!==p.match.grupo||(p.tarefa.subgrupo||null)!==(p.match.subgrupo||null));
    // Lista fechada de pavimentos cadastrados — o valor proposto só pode ser
    // TROCADO por um desses, nunca digitado livre. Texto livre geraria grupo
    // parecido mas diferente (typo, acento, maiúscula) e criaria "mais um"
    // em vez de casar com o que já existe na Estrutura da Obra.
    // Ordem = a mesma que já está na Estrutura da Obra (campo "ordem" de cada
    // pavimento, arrumado por Milton lá) — NUNCA re-ordenar por texto: string
    // sort põe "10º Pavimento" antes de "1º Pavimento" (compara caractere por
    // caractere, "1" < "10"), o que fica fora de ordem construtiva.
    const torresOrdenadas=[...(est.torres||[])].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const vistoPav=new Set();
    _gerarGruposPavimentos=[];
    for(const t of torresOrdenadas){
      const pavsOrdenados=[...(t.pavimentos||[])].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
      for(const p of pavsOrdenados){
        if(p.nome&&!vistoPav.has(p.nome)){vistoPav.add(p.nome);_gerarGruposPavimentos.push(p.nome);}
      }
    }
    _gerarGruposLista=mudam.map(p=>({
      tarefaId:p.tarefa.id,nome:p.tarefa.nome,
      grupoAntigo:p.tarefa.grupo||'',subgrupoAntigo:p.tarefa.subgrupo||null,
      grupoProposto:p.match.grupo,subgrupoProposto:p.match.subgrupo||null,
      marcado:true
    }));
    let pop=document.getElementById('gerargrupos-modal');if(pop)pop.remove();
    pop=document.createElement('div');pop.id='gerargrupos-modal';
    pop.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:2000;display:flex;align-items:center;justify-content:center;';
    pop.innerHTML=`
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:20px;width:720px;max-width:95vw;max-height:85vh;overflow-y:auto;display:flex;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="font-weight:700;color:var(--cor-primaria);">⚡ Gerar Grupos — Prévia</div>
          <span style="cursor:pointer;color:#888;font-size:1.1rem;" onclick="document.getElementById('gerargrupos-modal').remove()">✕</span>
        </div>
        <div style="font-size:.72rem;color:#888;margin-bottom:10px;">${propostas.length} de ${folhas.length} tarefas reconhecidas pelos pavimentos cadastrados na Estrutura da Obra. <b>${mudam.length}</b> vão realmente mudar Grupo (as demais já estão iguais). Pra corrigir, escolhe outro pavimento já cadastrado na lista (coluna da direita) — muda esse E todos os outros que tinham a mesma proposta.</div>
        <div id="gerargrupos-lista" style="display:flex;flex-direction:column;gap:2px;max-height:50vh;overflow-y:auto;border:1px solid #292929;border-radius:6px;padding:6px;"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
          <button class="btn btn-secundario btn-sm" onclick="document.getElementById('gerargrupos-modal').remove()">Cancelar</button>
          <button class="btn btn-primario btn-sm" onclick="Planejamento._aplicarGerarGrupos()">Aplicar Selecionados</button>
        </div>
      </div>`;
    document.body.appendChild(pop);
    _renderGerarGruposLista();
  }

  function _renderGerarGruposLista(){
    const el=document.getElementById('gerargrupos-lista');if(!el)return;
    const opcoes=_gerarGruposPavimentos||[];
    el.innerHTML=_gerarGruposLista.map((p,i)=>{
      // Se o valor atual (por algum motivo) não estiver na lista cadastrada,
      // inclui ele mesmo como opção extra — nunca perde o que já tinha.
      const lista=opcoes.includes(p.grupoProposto)?opcoes:[p.grupoProposto,...opcoes];
      return `
      <div style="display:flex;align-items:center;gap:8px;font-size:.76rem;padding:4px 4px;border-bottom:1px solid #232323;">
        <input type="checkbox" data-idx="${i}" ${p.marcado?'checked':''} onchange="Planejamento._gerarGruposToggle(${i},this.checked)">
        <span style="flex:1;color:#ddd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(p.nome)}</span>
        <span style="color:#666;white-space:nowrap;">${_esc(p.grupoAntigo||'—')}${p.subgrupoAntigo?' / '+p.subgrupoAntigo:''}</span>
        <span style="color:#555;">→</span>
        <select onchange="Planejamento._gerarGruposEditarValor(${i},this.value)"
          style="width:150px;background:#111;border:1px solid #333;border-radius:4px;color:var(--cor-primaria);font-weight:600;font-size:.76rem;padding:3px 4px;">
          ${lista.map(nomePav=>`<option value="${_esc(nomePav)}" ${nomePav===p.grupoProposto?'selected':''}>${_esc(nomePav)}</option>`).join('')}
        </select>
        ${p.subgrupoProposto?`<span style="color:var(--cor-primaria);font-size:.72rem;">/ ${p.subgrupoProposto}</span>`:''}
      </div>`;
    }).join('');
  }

  function _gerarGruposToggle(idx,checked){
    if(_gerarGruposLista&&_gerarGruposLista[idx])_gerarGruposLista[idx].marcado=checked;
  }

  // Escolher outro pavimento (dropdown) numa linha propaga pra outras linhas
  // que tinham o MESMO ANTES *e* a MESMA proposta errada — as duas coisas
  // juntas, não só a proposta. Só a proposta não bastava: "Reservatório -
  // SS2" e "Reservatório Superior" são coisas DIFERENTES (uma é SS2, a
  // outra é o reservatório de cima) mas as duas bateram na mesma proposta
  // errada "RESERVATÓRIO" — corrigir uma arrastava a outra por engano,
  // porque só olhava a proposta. Agora só propaga pra quem tinha o MESMO
  // valor anterior também, então grupos diferentes nunca se misturam.
  function _gerarGruposEditarValor(idx,novoValor){
    if(!_gerarGruposLista||!_gerarGruposLista[idx])return;
    const alvo=_gerarGruposLista[idx];
    const antigoRef=alvo.grupoAntigo,propostaRef=alvo.grupoProposto;
    if(!novoValor||novoValor===propostaRef)return;
    let n=0;
    for(const p of _gerarGruposLista){
      if(p.grupoAntigo===antigoRef&&p.grupoProposto===propostaRef){
        p.grupoProposto=novoValor;
        // Subgrupo só faz sentido pra pavimento numerado ("Nº Pavimento") —
        // se o novo valor não bate esse padrão, não tem como recalcular,
        // então some (mais seguro que manter um número que não corresponde
        // mais ao grupo escolhido).
        const mPav=novoValor.match(/^(\d+)[°º]\s*Pavimento$/i);
        const mFinal=String(p.nome).match(/Final\s*0*(\d+)\s*$/i);
        p.subgrupoProposto=(mPav&&mFinal)?(parseInt(mPav[1])*10+parseInt(mFinal[1])):null;
        n++;
      }
    }
    _renderGerarGruposLista();
    if(n>1)Utils.toast(`Aplicado a ${n} linha(s) que tinham "${antigoRef||'(vazio)'}" → "${propostaRef}".`,'sucesso');
  }

  async function _aplicarGerarGrupos(){
    const pop=document.getElementById('gerargrupos-modal');if(!pop||!_gerarGruposLista)return;
    const selecionadas=_gerarGruposLista.filter(p=>p.marcado);
    if(!selecionadas.length){pop.remove();return;}
    Utils.mostrarLoading(`Gerando grupos em ${selecionadas.length} tarefa(s)...`);
    try{
      const L=30;
      for(let i=0;i<selecionadas.length;i+=L){
        await Promise.all(selecionadas.slice(i,i+L).map(async p=>{
          const upd={grupo:p.grupoProposto};
          if(p.subgrupoProposto)upd.subgrupo=p.subgrupoProposto;
          await Database.atualizar(obraId,COL,p.tarefaId,upd).catch(e=>console.error('Erro gerar grupo:',p.tarefaId,e));
          const t=tarefas.find(x=>x.id===p.tarefaId);
          if(t){t.grupo=upd.grupo;if(upd.subgrupo)t.subgrupo=upd.subgrupo;}
        }));
      }
      pop.remove();
      _gerarGruposLista=null;
      Utils.toast(`${selecionadas.length} tarefa(s) com Grupo/Subgrupo atualizado(s).`,'sucesso');
      _buildFiltradas();_render();
    }catch(e){console.error(e);Utils.toast('Erro ao gerar grupos.','erro');}
    finally{Utils.esconderLoading();}
  }

  // Verifica se algum id (torre/pavimento/apto) ainda está referenciado por
  // alguma tarefa antes de excluir — não apaga silenciosamente vínculo.
  function _contarTarefasVinculadas(tipo,id){
    let n=0;
    for(const t of tarefas){
      for(const v of(t.vinculoEstrutura||[])){
        if((tipo==='torre'&&v.torreId===id)||(tipo==='pavimento'&&v.pavimentoId===id)||(tipo==='apartamento'&&v.apartamentoId===id))n++;
      }
    }
    return n;
  }
  async function _removerNoEst(tipo,id){
    const qtd=_contarTarefasVinculadas(tipo,id);
    const rotulo={torre:'torre',pavimento:'pavimento',apartamento:'apartamento/unidade'}[tipo];
    if(!confirm(qtd?`${qtd} tarefa(s) estão vinculadas a esse ${rotulo}. Excluir mesmo assim? O vínculo delas fica "órfão" (não quebra, mas mostra aviso).`:`Excluir esse ${rotulo}?`))return;
    const est=_estruturaObraCache;
    if(tipo==='torre'){est.torres=est.torres.filter(t=>t.id!==id);}
    else if(tipo==='pavimento'){for(const t of est.torres){t.pavimentos=(t.pavimentos||[]).filter(p=>p.id!==id);}}
    else if(tipo==='apartamento'){for(const t of est.torres)for(const p of(t.pavimentos||[])){p.apartamentos=(p.apartamentos||[]).filter(a=>a.id!==id);}}
    await _salvarEstruturaObra(est);
    _renderEstruturaObraBody();
  }

  // ===================== M1-B: VÍNCULO DA TAREFA COM PAVIMENTO/APTO =====================
  function _resumoVinculo(vinculos){
    if(!vinculos||!vinculos.length)return'';
    const est=_estruturaObraCache;
    if(!est)return `${vinculos.length} vínculo(s)`;
    const partes=vinculos.map(v=>{
      const p=_acharNoEst('pavimento',v.pavimentoId);
      if(!p)return '⚠ órfão';
      if(!v.apartamentoId)return `${p.nome} (todos)`;
      const a=_acharNoEst('apartamento',v.apartamentoId);
      return a?`${p.nome}: ${a.nome}`:'⚠ órfão';
    });
    if(partes.length===1)return partes[0];
    if(partes.every(p=>!p.includes(':')&&!p.includes('⚠')))return `${partes.length} pavimentos`;
    return partes.join(', ');
  }

  async function _abrirVinculoPavimento(idx){
    const t=filtradas[idx];if(!t)return;
    await _carregarEstruturaObra();
    const est=_estruturaObraCache;
    let pop=document.getElementById('vincloc-modal');if(pop)pop.remove();
    pop=document.createElement('div');pop.id='vincloc-modal';
    pop.dataset.tarefaId=t.id;
    pop.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:2000;display:flex;align-items:center;justify-content:center;';
    const vAtual=t.vinculoEstrutura||[];
    const marcado=(pavId,aptoId)=>vAtual.some(v=>v.pavimentoId===pavId&&(aptoId?v.apartamentoId===aptoId:!v.apartamentoId));
    const torres=[...(est.torres||[])].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    pop.innerHTML=`
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:20px;width:460px;max-width:95vw;max-height:85vh;overflow-y:auto;display:flex;flex-direction:column;">
        <div style="font-weight:700;color:var(--cor-primaria);margin-bottom:4px;">📍 Local de: ${_esc(t.nome)}</div>
        <div style="font-size:.7rem;color:#888;margin-bottom:12px;">Marque o pavimento inteiro, ou expanda pra marcar apto(s) específico(s).</div>
        ${!torres.length?`<div style="color:#888;font-size:.82rem;">Nenhuma estrutura cadastrada ainda. <span style="color:var(--cor-primaria);cursor:pointer;text-decoration:underline;" onclick="document.getElementById('vincloc-modal').remove();Planejamento._abrirEstruturaObra()">Cadastrar Torre/Pavimento/Apto</span></div>`:''}
        <div id="vincloc-body" style="display:flex;flex-direction:column;gap:8px;">
        ${torres.map(tr=>`<div>
          <div style="font-weight:600;color:#ccc;font-size:.82rem;margin-bottom:4px;">${_esc(tr.nome)}</div>
          ${[...(tr.pavimentos||[])].sort((a,b)=>(a.ordem||0)-(b.ordem||0)).map(p=>`
            <div style="margin-left:10px;margin-bottom:2px;">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.78rem;color:#ddd;">
                <input type="checkbox" data-pav="${p.id}" ${marcado(p.id,null)?'checked':''} onchange="Planejamento._vinclocTogglePav(this)"> ${_esc(p.nome)} (todos)
                ${(p.apartamentos||[]).length?`<span style="cursor:pointer;color:#666;margin-left:auto;" onclick="event.preventDefault();this.closest('label').nextElementSibling.style.display=this.closest('label').nextElementSibling.style.display==='none'?'flex':'none';">▾ aptos</span>`:''}
              </label>
              ${(p.apartamentos||[]).length?`<div style="display:none;flex-wrap:wrap;gap:6px;margin:4px 0 4px 22px;">
                ${[...p.apartamentos].sort((a,b)=>(a.ordem||0)-(b.ordem||0)).map(a=>`<label style="display:flex;align-items:center;gap:3px;font-size:.72rem;color:#aaa;cursor:pointer;">
                  <input type="checkbox" data-pav="${p.id}" data-apto="${a.id}" ${marcado(p.id,a.id)?'checked':''} onchange="Planejamento._vinclocToggleApto(this)"> ${_esc(a.nome)}
                </label>`).join('')}
              </div>`:''}
            </div>`).join('')}
        </div>`).join('')}
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
          <button class="btn btn-secundario btn-sm" onclick="document.getElementById('vincloc-modal').remove()">Cancelar</button>
          <button class="btn btn-primario btn-sm" onclick="Planejamento._salvarVinculoPavimento(${idx})">Salvar</button>
        </div>
      </div>`;
    document.body.appendChild(pop);
  }
  // Marcar pavimento inteiro desmarca os aptos individuais dele (redundante); marcar
  // um apto específico desmarca o "pavimento inteiro" (senão os dois convivem sem sentido).
  function _vinclocTogglePav(cb){
    const pavId=cb.dataset.pav;
    const body=document.getElementById('vincloc-body');
    body.querySelectorAll(`input[data-apto][data-pav="${pavId}"]`).forEach(a=>{if(cb.checked)a.checked=false;});
  }
  function _vinclocToggleApto(cb){
    if(!cb.checked)return;
    const pavId=cb.dataset.pav;
    const body=document.getElementById('vincloc-body');
    const pavCb=body.querySelector(`input[data-pav="${pavId}"]:not([data-apto])`);
    if(pavCb)pavCb.checked=false;
  }
  async function _salvarVinculoPavimento(idx){
    const t=filtradas[idx];if(!t)return;
    const body=document.getElementById('vincloc-body');
    const vinculos=[];
    body.querySelectorAll('input[type="checkbox"]:checked').forEach(cb=>{
      vinculos.push({torreId:null,pavimentoId:cb.dataset.pav,apartamentoId:cb.dataset.apto||null});
    });
    t.vinculoEstrutura=vinculos;
    const pop=document.getElementById('vincloc-modal');if(pop)pop.remove();
    _paintRows();
    try{await Database.atualizar(obraId,COL,t.id,{vinculoEstrutura:vinculos});Utils.toast('Local salvo.','sucesso');}
    catch(e){console.error(e);Utils.toast('Erro ao salvar.','erro');}
  }

  // ===================== M3: ATUALIZAÇÃO RÁPIDA DE PREDECESSORA + LOG =====================
  // Deixa trocar predecessora/% sem editar direto na grid, guardando o MOTIVO
  // da mudança (info que hoje só existe verbalmente, na conversa com o
  // encarregado). Não muda a lógica de recálculo automático já existente —
  // só chama as mesmas funções (_calcPredecessora/_propagarDataEmCascata/
  // _recalcularDatasPais/_recalcularPercTodosPais) depois de salvar.
  function _abrirAtualizarPredecessora(idx){
    const t=filtradas[idx];if(!t)return;
    let pop=document.getElementById('predlog-modal');if(pop)pop.remove();
    pop=document.createElement('div');pop.id='predlog-modal';
    pop.dataset.tarefaId=t.id;pop.dataset.idx=idx;
    pop.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:2000;display:flex;align-items:center;justify-content:center;';
    pop.innerHTML=`
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:20px;width:440px;max-width:95vw;max-height:85vh;overflow-y:auto;display:flex;flex-direction:column;gap:10px;">
        <div style="font-weight:700;color:var(--cor-primaria);">🔗 Atualizar Predecessora: ${_esc(t.nome)}</div>
        <div style="font-size:.72rem;color:#888;">Predecessora atual: <strong style="color:#ccc;">${t._predDisplay||'—'}</strong> · % atual: <strong style="color:#ccc;">${t.percentualConcluido||0}%</strong></div>
        <div>
          <label style="font-size:.72rem;color:#888;display:block;margin-bottom:4px;">Nova predecessora (deixe em branco pra não mudar)</label>
          <input id="predlog-pred" type="text" placeholder="ex: 5TI+3" class="form-control" oninput="Planejamento._predlogAtualizarBotao()">
        </div>
        <div>
          <label style="font-size:.72rem;color:#888;display:block;margin-bottom:4px;">Novo % concluído (deixe em branco pra não mudar)</label>
          <input id="predlog-perc" type="number" min="0" max="100" placeholder="ex: 90" class="form-control" oninput="Planejamento._predlogAtualizarBotao()">
        </div>
        <div>
          <label style="font-size:.72rem;color:#888;display:block;margin-bottom:4px;">Motivo da alteração <span style="color:#dc2626;">*obrigatório</span></label>
          <textarea id="predlog-motivo" rows="3" class="form-control" placeholder="Ex: Predecessora atrasou por conta de entrega de material" oninput="Planejamento._predlogAtualizarBotao()"></textarea>
        </div>
        <div id="predlog-erro" style="color:#dc2626;font-size:.72rem;display:none;"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn btn-secundario btn-sm" onclick="document.getElementById('predlog-modal').remove()">Cancelar</button>
          <button id="predlog-btn-salvar" class="btn btn-primario btn-sm" disabled onclick="Planejamento._salvarAtualizacaoPredecessora(${idx})">Salvar</button>
        </div>
      </div>`;
    document.body.appendChild(pop);
    document.getElementById('predlog-pred').focus();
  }
  // Habilita "Salvar" só se: motivo preenchido E (predecessora OU % preenchidos)
  function _predlogAtualizarBotao(){
    const pred=document.getElementById('predlog-pred')?.value?.trim();
    const perc=document.getElementById('predlog-perc')?.value?.trim();
    const motivo=document.getElementById('predlog-motivo')?.value?.trim();
    const btn=document.getElementById('predlog-btn-salvar');
    if(!btn)return;
    btn.disabled=!(motivo&&(pred||perc));
  }
  async function _salvarAtualizacaoPredecessora(idx){
    const t=filtradas[idx];if(!t)return;
    const predRaw=document.getElementById('predlog-pred')?.value?.trim();
    const percRaw=document.getElementById('predlog-perc')?.value?.trim();
    const motivo=document.getElementById('predlog-motivo')?.value?.trim();
    const erroEl=document.getElementById('predlog-erro');
    if(!motivo||(!predRaw&&!percRaw)){if(erroEl){erroEl.textContent='Preencha o motivo e pelo menos um campo (predecessora ou %).';erroEl.style.display='block';}return;}

    const alteracoes=[];
    const updates={};
    if(predRaw){
      // Reaproveita o mesmo parser/validador de predecessora já usado na célula.
      const canon=_predTextoParaCanon(predRaw);
      if(!canon){if(erroEl){erroEl.textContent=`Predecessora "${predRaw}" não reconhecida — verifique o número da linha e o formato (ex: 5TI+3).`;erroEl.style.display='block';}return;}
      alteracoes.push({campo:'predecessora',valorAntigo:t._predDisplay||'',valorNovo:predRaw});
      updates.predecessora=canon;
      _calcPredecessora(t,canon,updates); // mesmo recálculo automático já existente
    }
    if(percRaw){
      const novoPerc=Math.min(100,Math.max(0,parseFloat(percRaw)||0));
      alteracoes.push({campo:'percentual',valorAntigo:parseFloat(t.percentualConcluido)||0,valorNovo:novoPerc});
      updates.percentualConcluido=novoPerc;
    }
    if(!alteracoes.length)return;

    Object.assign(t,updates);
    if(updates.predecessora!==undefined)t._predDisplay=_predCanonParaTexto(t.predecessora);
    _buildFiltradas();_render();
    const pop=document.getElementById('predlog-modal');if(pop)pop.remove();

    try{
      await Database.atualizar(obraId,COL,t.id,updates);
      await _registrarLog(t.id,t.nome,alteracoes,motivo);
      // Mesma cadeia de recálculo que já existe pra qualquer edição de data/predecessora
      if(updates.inicioPlanejado||updates.terminoPlanejado)await _propagarDataEmCascata(t.id);
      const paisAlterados=await _recalcularDatasPais(true);
      for(const p of paisAlterados)await _propagarDataEmCascata(p.id);
      await _recalcularPercTodosPais(true);
      Utils.toast('Atualizado e registrado no histórico.','sucesso');
    }catch(e){console.error(e);Utils.toast('Erro ao salvar.','erro');}
  }
  async function _registrarLog(tarefaId,tarefaNome,alteracoes,motivo){
    try{
      await db.collection('obras').doc(obraId).collection('logAlteracoes').add({
        tarefaId,tarefaNome,
        usuario:Auth.getUser()?.email||'',
        timestamp:firebase.firestore.FieldValue.serverTimestamp(),
        motivo,alteracoes,
      });
    }catch(e){console.error('Erro ao registrar log:',e);}
  }

  // ---- Histórico de Alterações (visão) ----
  let _historicoCache=[];
  async function _abrirHistoricoAlteracoes(){
    let pop=document.getElementById('historico-modal');if(pop)pop.remove();
    pop=document.createElement('div');pop.id='historico-modal';
    pop.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:2000;display:flex;align-items:center;justify-content:center;';
    pop.innerHTML=`
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:20px;width:720px;max-width:95vw;max-height:85vh;overflow-y:auto;display:flex;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-weight:700;color:var(--cor-primaria);">📋 Histórico de Alterações</div>
          <span style="cursor:pointer;color:#888;font-size:1.1rem;" onclick="document.getElementById('historico-modal').remove()">✕</span>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:10px;">
          <input id="hist-filtro-tarefa" placeholder="Filtrar por tarefa..." class="form-control" style="flex:1;font-size:.78rem;" oninput="Planejamento._filtrarHistorico()">
          <input id="hist-filtro-usuario" placeholder="Filtrar por usuário..." class="form-control" style="flex:1;font-size:.78rem;" oninput="Planejamento._filtrarHistorico()">
        </div>
        <div id="historico-lista" style="font-size:.78rem;"></div>
      </div>`;
    document.body.appendChild(pop);
    document.getElementById('historico-lista').innerHTML='<div style="color:#666;padding:10px 0;">Carregando...</div>';
    try{
      const snap=await db.collection('obras').doc(obraId).collection('logAlteracoes').orderBy('timestamp','desc').limit(300).get();
      _historicoCache=snap.docs.map(d=>({id:d.id,...d.data()}));
    }catch(e){console.error('Erro ao carregar histórico:',e);_historicoCache=[];}
    _filtrarHistorico();
  }
  function _filtrarHistorico(){
    const el=document.getElementById('historico-lista');if(!el)return;
    const fTarefa=(document.getElementById('hist-filtro-tarefa')?.value||'').trim().toLowerCase();
    const fUsuario=(document.getElementById('hist-filtro-usuario')?.value||'').trim().toLowerCase();
    const filtrados=_historicoCache.filter(l=>
      (!fTarefa||(l.tarefaNome||'').toLowerCase().includes(fTarefa))&&
      (!fUsuario||(l.usuario||'').toLowerCase().includes(fUsuario))
    );
    if(!filtrados.length){el.innerHTML='<div style="color:#666;padding:10px 0;">Nenhum registro encontrado.</div>';return;}
    el.innerHTML=filtrados.map(l=>{
      const data=l.timestamp?.toDate?l.timestamp.toDate().toLocaleString('pt-BR'):'—';
      const camposHtml=(l.alteracoes||[]).map(a=>`<div style="color:#aaa;">${_esc(a.campo)}: <span style="color:#f87171;">${_esc(String(a.valorAntigo??''))}</span> → <span style="color:#4ade80;">${_esc(String(a.valorNovo??''))}</span></div>`).join('');
      return `<div style="border-bottom:1px solid #222;padding:8px 0;">
        <div style="display:flex;justify-content:space-between;color:#888;font-size:.7rem;margin-bottom:3px;">
          <span>${_esc(data)} · ${_esc(l.usuario||'?')}</span>
        </div>
        <div style="color:#fff;font-weight:600;margin-bottom:3px;">${_esc(l.tarefaNome||'(tarefa)')}</div>
        ${camposHtml}
        <div style="color:#888;font-size:.72rem;margin-top:3px;font-style:italic;">"${_esc(l.motivo||'')}"</div>
      </div>`;
    }).join('');
  }

  // ===================== MIGRAÇÃO: PREDECESSORA POR ID =====================
  // Reparo de UMA VEZ: converte predecessoras já salvas no formato antigo
  // (texto por número de linha, ex: "5TI+3") pro novo formato canônico por ID
  // (ver bloco no topo do arquivo). Depois de rodar isso, reordenar tarefas
  // nunca mais quebra o vínculo — não precisa rodar de novo, a não ser que
  // ainda existam tarefas no formato antigo (o formato novo sempre tem "|").
  async function _migrarPredecessorasParaId(silencioso){
    const pendentes=tarefas.filter(t=>t.predecessora&&!String(t.predecessora).includes('|'));
    if(!pendentes.length){if(!silencioso)Utils.toast('Nenhuma predecessora no formato antigo — já está tudo por ID.','sucesso');return 0;}
    if(!silencioso&&!confirm(`${pendentes.length} predecessora(s) ainda estão no formato antigo (número de linha, que quebra ao reordenar). Converter agora pro formato por ID (permanente, não quebra mais nunca)?`))return 0;
    Utils.mostrarLoading('Convertendo predecessoras...');
    const mudou=[];
    for(const t of pendentes){
      const canon=_predTextoParaCanon(t.predecessora);
      t.predecessora=canon;
      mudou.push({id:t.id,predecessora:canon});
    }
    const L=20,TIMEOUT_MS=15000;
    const comTimeout=p=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),TIMEOUT_MS))]);
    let falhas=0;
    for(let i=0;i<mudou.length;i+=L){
      Utils.mostrarLoading(`Convertendo... ${Math.min(i+L,mudou.length)}/${mudou.length}`);
      await Promise.all(mudou.slice(i,i+L).map(({id,...upd})=>
        comTimeout(Database.atualizar(obraId,COL,id,upd)).catch(e=>{falhas++;console.error('Erro migrar pred:',id,e);})
      ));
    }
    Utils.esconderLoading();
    _buildFiltradas();_render();
    Utils.toast(falhas?`⚠ ${mudou.length-falhas} convertidas, ${falhas} falharam — rode de novo.`:`🔗 ${mudou.length} predecessora(s) convertida(s) pro formato por ID.`,falhas?'alerta':'sucesso');
    return mudou.length;
  }

  // ===================== NÍVEL PELO CÓDIGO (reparo definitivo) =====================
  // O campo Código (ex: "1.3.6.20.2") nunca é escrito automaticamente pelo sistema —
  // só existe se veio de import ou foi digitado manualmente — então é a fonte mais
  // confiável de hierarquia que existe. O campo Nível (numérico), por outro lado, já
  // foi corrompido por vários bugs de drag&drop/import ao longo do tempo. Sempre que
  // uma tarefa tem Código, o Nível dela DEVE ser exatamente a contagem de pontos do
  // Código (1.3.6.20 → nível 3; 1.3.6.20.2 → nível 4). Esse reparo corrige qualquer
  // tarefa com Código onde isso não bate — é o jeito de "consertar de vez" tarefas
  // que aparecem aninhadas no lugar errado por causa de um Nível salvo errado.
  // Tarefas SEM Código não são tocadas (não tem como derivar, ficam como estão).
  async function _corrigirNivelPeloCodigo(silencioso){
    const comCodigo=tarefas.filter(t=>t.codigo&&String(t.codigo).trim());
    const mudou=[];
    for(const t of comCodigo){
      const esperado=(String(t.codigo).match(/\./g)||[]).length;
      if((t.nivel||0)!==esperado){t.nivel=esperado;mudou.push({id:t.id,nivel:esperado});}
    }
    if(mudou.length){
      if(!silencioso&&!confirm(`${mudou.length} tarefa(s) com Nível divergente do Código serão corrigidas (Código é a fonte confiável, nunca é mexido pelo sistema). Confirmar?`))return 0;
      const L=20,TIMEOUT_MS=15000;
      const comTimeout=p=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),TIMEOUT_MS))]);
      let falhas=0;
      Utils.mostrarLoading(`Corrigindo níveis... 0/${mudou.length}`);
      for(let i=0;i<mudou.length;i+=L){
        Utils.mostrarLoading(`Corrigindo níveis... ${Math.min(i+L,mudou.length)}/${mudou.length}`);
        await Promise.all(mudou.slice(i,i+L).map(({id,nivel})=>
          comTimeout(Database.atualizar(obraId,COL,id,{nivel})).catch(e=>{falhas++;console.error('Erro corrigir nivel:',id,e);})
        ));
      }
      Utils.esconderLoading();
      _buildFiltradas();_render();
      if(!silencioso)Utils.toast(falhas?`⚠ ${mudou.length-falhas} corrigidas, ${falhas} falharam.`:`🌳 ${mudou.length} tarefa(s) com nível corrigido pelo Código.`,falhas?'alerta':'sucesso');
    } else if(!silencioso){
      Utils.toast('Nenhuma divergência entre Nível e Código encontrada.','sucesso');
    }
    return mudou.length;
  }

  // ===================== NÍVEIS "SOLTOS" DA ÁRVORE (gaps) =====================
  // O Editor de Estrutura só reconhece uma tarefa como raiz se nivel===0, e só como
  // filha de X se nivel===X.nivel+1 (ver _arvFilhos/raizes). Se uma tarefa tem nível
  // 4 mas a anterior tem nível 2 (faltando o 3), ela não é filha de ninguém nem raiz
  // — fica invisível na árvore, mesmo continuando a aparecer normalmente na tabela
  // do Planejamento (que só usa nivel pra indentar, sem exigir essa cadeia). Isso é
  // o que faz os dois "divergirem". Aqui garantimos que nenhuma tarefa pule mais de
  // 1 nível de profundidade em relação à tarefa imediatamente anterior — mesma regra
  // de qualquer outline (Word/PowerPoint/MS Project): não dá pra ir de nível 2 direto
  // pro 4 sem passar pelo 3.
  async function _corrigirNiveisSoltos(silencioso){
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    let maxPermitido=0;
    const mudou=[];
    for(const t of sorted){
      const niv=t.nivel||0;
      const permitido=Math.min(niv,maxPermitido);
      if(permitido!==niv){t.nivel=permitido;mudou.push({id:t.id,nivel:permitido});}
      maxPermitido=(t.nivel||0)+1;
    }
    if(mudou.length){
      const L=20,TIMEOUT_MS=15000;
      const comTimeout=p=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),TIMEOUT_MS))]);
      for(let i=0;i<mudou.length;i+=L){
        await Promise.all(mudou.slice(i,i+L).map(({id,nivel})=>comTimeout(Database.atualizar(obraId,COL,id,{nivel})).catch(console.error)));
      }
      tarefas=sorted;_buildFiltradas();_render();
    }
    if(!silencioso)Utils.toast(mudou.length?`🌳 ${mudou.length} tarefa(s) tinham nível "solto" (invisíveis na árvore) e foram corrigidas.`:'Nenhum nível solto encontrado — árvore e tabela batem.','sucesso');
    return mudou.length;
  }

  // ===================== % DE TAREFAS-PAI (agregação recursiva nível por nível) =====================
  // O % de um pai é a MÉDIA PONDERADA (por duração) dos filhos DIRETOS —
  // recursivo, nível por nível, igual MS Project (confirmado com exemplo real
  // do Milton). Roda de baixo pra cima (bottom-up, uma passada só) e persiste
  // no Firestore o % recalculado de toda tarefa que tem filho direto.
  // Precisa rodar sempre que a estrutura muda (mover/inserir/excluir tarefa,
  // qualquer coisa que muda quem é filho de quem ou quantos filhos alguém
  // tem) — senão o % de um pai fica desatualizado depois de reorganizar.
  async function _recalcularPercTodosPais(silencioso){
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const n=sorted.length;
    for(let i=n-1;i>=0;i--){
      const t=sorted[i],niv=t.nivel||0;
      let j=i+1,sp=0,sw=0,achouFilho=false;
      while(j<n&&(sorted[j].nivel||0)>niv){
        if((sorted[j].nivel||0)===niv+1){
          achouFilho=true;
          const f=sorted[j];
          // Peso REAL = _pesoCalc do filho (soma de tudo dentro dele,
          // calculado na iteração dele mais abaixo) — nunca a duração
          // PRÓPRIA do filho, que fica vazia em grupos criados manualmente
          // e distorcia a média (ver nota em Utils.percFamilia.pesoReal).
          sp+=(f._percCalc||0)*(f._pesoCalc||1);sw+=(f._pesoCalc||1);
        }
        j++;
      }
      t._temFilhoPerc=achouFilho;
      t._pesoCalc=achouFilho?(sw||1):Math.max(1,parseFloat(t.duracao)||1);
      t._percCalc=achouFilho?(sw?sp/sw:0):Math.min(100,Math.max(0,parseFloat(t.percentualConcluido)||0));
    }
    const mudou=[];
    for(const t of sorted){
      if(!t._temFilhoPerc)continue; // só sobrescreve quem TEM filho direto de verdade
      const novo=Math.round(t._percCalc*10)/10;
      const atual=Math.round((parseFloat(t.percentualConcluido)||0)*10)/10;
      if(Math.abs(novo-atual)>0.05){
        t.percentualConcluido=novo;
        mudou.push({id:t.id,percentualConcluido:novo});
      }
    }
    if(mudou.length){
      const L=20,TIMEOUT_MS=15000;
      const comTimeout=p=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),TIMEOUT_MS))]);
      let falhas=0;
      for(let i=0;i<mudou.length;i+=L){
        await Promise.all(mudou.slice(i,i+L).map(({id,...upd})=>
          comTimeout(Database.atualizar(obraId,COL,id,upd)).catch(e=>{falhas++;console.error('Erro recalc %:',id,e);})
        ));
      }
      _buildFiltradas();_render();
      if(falhas&&!silencioso)Utils.toast(`⚠ ${falhas} falharam ao salvar.`,'alerta');
    }
    if(!silencioso)Utils.toast(mudou.length?`📊 ${mudou.length} tarefa(s)-pai com % recalculado.`:'% dos pais já estava correto.','sucesso');
    return mudou;
  }

  // ===================== DATAS DE TAREFAS-PAI (agregação automática) =====================
  // Tarefa-pai (tem filhos) não tem data própria de verdade — a dela É o intervalo
  // dos filhos: início = o menor início entre os filhos diretos, término = o maior
  // término. Roda de baixo pra cima (folha primeiro) pra pais aninhados herdarem
  // certo dos avós. Sempre recalcula e GRAVA no Firestore pros pais (Suprimentos e
  // outros módulos leem inicioPlanejado/terminoPlanejado direto do documento, não
  // fazem essa conta sozinhos) — nunca mexe em tarefa-folha (essas são editáveis
  // manualmente e são a fonte da verdade).
  // Pares de campos [início,término] agregados pra tarefas-pai. Cobre as 4
  // "versões" de data do sistema — antes só Atual/Real eram cobertos, e
  // Linha de Base/Desafio de grupos ficavam sempre em branco mesmo com os
  // filhos preenchidos (bug relatado pelo Milton).
  const _PARES_DATA=[['inicioPlanejado','terminoPlanejado'],['inicioReal','terminoReal'],
    ['inicioPlanejadoBase','terminoPlanejadoBase'],['inicioDesafio','terminoDesafio']];
  async function _recalcularDatasPais(silencioso){
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const n=sorted.length;
    for(let i=n-1;i>=0;i--){
      const t=sorted[i],niv=t.nivel||0;
      const podeExpandir=i+1<n&&(sorted[i+1].nivel||0)>niv;
      const agr={}; // agr['inicioPlanejado']=data agregada, etc
      let achouFilhoDireto=false;
      if(podeExpandir){
        let j=i+1;
        while(j<n&&(sorted[j].nivel||0)>niv){
          if((sorted[j].nivel||0)===niv+1){
            achouFilhoDireto=true;
            const c=sorted[j];
            for(const[fIni,fFim]of _PARES_DATA){
              const ci=c['_agr_'+fIni],cf=c['_agr_'+fFim];
              if(ci&&(!agr[fIni]||ci<agr[fIni]))agr[fIni]=ci;
              if(cf&&(!agr[fFim]||cf>agr[fFim]))agr[fFim]=cf;
            }
          }
          j++;
        }
      }
      t._temFilhoDireto=achouFilhoDireto;
      for(const[fIni,fFim]of _PARES_DATA){
        if(achouFilhoDireto){
          t['_agr_'+fIni]=agr[fIni]||null;t['_agr_'+fFim]=agr[fFim]||null;
        } else {
          // Folha de verdade — ou "pai" sem filho direto real (nível com gap,
          // caso raro/transitório). Nunca zera a data própria nesse caso: é
          // exatamente esse descuido que zerava datas de tarefas-folha por
          // engano quando a árvore tinha desalinhamento momentâneo de nível.
          t['_agr_'+fIni]=t[fIni]||null;t['_agr_'+fFim]=t[fFim]||null;
        }
      }
      // Duração do pai = dias corridos entre início e término agregados
      // (Atual) — igual MS Project. Sem isso, um grupo criado manualmente
      // ficava com Duração vazia/0, o que também distorcia o peso dele nas
      // médias de % (ver V2.60.8) — agora nunca fica em branco.
      if(achouFilhoDireto&&t._agr_inicioPlanejado&&t._agr_terminoPlanejado){
        const dias=Math.round((new Date(t._agr_terminoPlanejado)-new Date(t._agr_inicioPlanejado))/864e5);
        t._agr_duracao=Math.max(1,dias);
      } else {
        t._agr_duracao=t.duracao||null;
      }
    }
    const mudou=[];
    for(let i=0;i<n;i++){
      const t=sorted[i];
      if(!t._temFilhoDireto)continue; // só sobrescreve quem TEM filho direto de verdade
      const upd={};
      for(const[fIni,fFim]of _PARES_DATA){
        if((t['_agr_'+fIni]||'')!==(t[fIni]||''))upd[fIni]=t['_agr_'+fIni]||'';
        if((t['_agr_'+fFim]||'')!==(t[fFim]||''))upd[fFim]=t['_agr_'+fFim]||'';
      }
      if(t._agr_duracao&&Number(t._agr_duracao)!==Number(t.duracao||0))upd.duracao=t._agr_duracao;
      if(Object.keys(upd).length){Object.assign(t,upd);mudou.push({id:t.id,...upd});}
    }
    if(mudou.length){
      const L=20,TIMEOUT_MS=15000;
      const comTimeout=p=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),TIMEOUT_MS))]);
      let falhas=0;
      for(let i=0;i<mudou.length;i+=L){
        await Promise.all(mudou.slice(i,i+L).map(({id,...upd})=>
          comTimeout(Database.atualizar(obraId,COL,id,upd)).catch(e=>{falhas++;console.error('Erro recalc datas:',id,e);})
        ));
      }
      tarefas=sorted;_buildFiltradas();_render();
      if(falhas&&!silencioso)Utils.toast(`⚠ ${falhas} falharam ao salvar.`,'alerta');
    }
    if(!silencioso)Utils.toast(mudou.length?`📐 ${mudou.length} tarefa(s)-pai com datas recalculadas.`:'Datas dos pais já estavam corretas.','sucesso');
    return mudou; // array de {id,...campos alterados} — quem usa isso propaga cascata pros pais também
  }

  // ===================== REPARO: ORDENS DUPLICADAS =====================
  // Corrige o estrago já feito em produção pelo bug de 'ordem' colidindo
  // (inserirTarefa() usava sel.ordem+1, que empatava com a próxima tarefa).
  // Renormaliza TODAS as tarefas para ordem inteira sequencial única,
  // baseada na ordem atualmente exibida em tela (que reflete o que já foi
  // organizado manualmente), e persiste TODAS no Firestore — não só as que
  // mudaram localmente, para eliminar de vez qualquer duplicata antiga.
  async function corrigirOrdensDuplicadas(){
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const usados=new Map();
    let duplicatas=0;
    for(const t of sorted){
      const chave=t.ordem||0;
      if(usados.has(chave))duplicatas++;
      usados.set(chave,(usados.get(chave)||0)+1);
    }
    if(!duplicatas){Utils.toast('Nenhuma ordem duplicada encontrada.','sucesso');return;}
    if(!confirm(`Encontradas ${duplicatas} tarefa(s) com 'ordem' duplicada (causa das mudanças de posição sozinhas). Corrigir agora? A ordem visual atual será preservada, só os números internos serão renumerados.`))return;
    Utils.mostrarLoading('Corrigindo ordens...');
    try{
      sorted.forEach((t,i)=>{t.ordem=i+1;});
      tarefas=sorted;
      const LOTE=30;
      for(let i=0;i<sorted.length;i+=LOTE){
        await Promise.all(sorted.slice(i,i+LOTE).map(t=>
          Database.atualizar(obraId,COL,t.id,{ordem:t.ordem}).catch(e=>console.error('Erro corrigir ordem:',t.id,e))
        ));
      }
      _buildFiltradas();_render();
      Utils.toast(`✅ ${duplicatas} duplicata(s) corrigida(s).`,'sucesso');
    }catch(e){console.error(e);Utils.toast('Erro ao corrigir.','erro');}
    finally{Utils.esconderLoading();}
  }

  // ===================== FRENTE DE SERVIÇO (auto-classificação) =====================
  // Só preenche tarefas SEM frenteServico ainda — nunca sobrescreve o que já
  // foi definido manualmente (na dúvida, a função de classificação retorna
  // '' e a tarefa fica de fora da lista pra preencher na mão).
  // Grupos (pais) não têm nome classificável por palavra-chave — em vez
  // disso, herdam a Frente das folhas descendentes QUANDO TODAS concordam
  // numa só (senão fica em branco, pra não chutar errado num grupo misto).
  async function autoClassificarFrentes(){
    if(!Permissions.pode('planejamento','editar')){Utils.toast('Sem permissão para editar.','erro');return;}
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const alvoLeaf=[];
    const freqPorGrupo=new Map(); // id do grupo -> {FRENTE:contagem} das folhas descendentes (qualquer nível)
    const pilha=[];                // freq object de cada grupo aberto, indexado por nível
    for(let i=0;i<sorted.length;i++){
      const t=sorted[i],niv=t.nivel||0;
      pilha.length=niv;
      const nxt=sorted[i+1];
      const isLeaf=!nxt||(nxt.nivel||0)<=niv;
      if(!isLeaf){
        const freq={};
        freqPorGrupo.set(t.id,freq);
        pilha[niv]=freq;
        continue;
      }
      let efetiva=t.frenteServico||'';
      if(!efetiva){
        const sug=Utils.classificarFrente(t.nome);
        if(sug){efetiva=sug;alvoLeaf.push({t,sugestao:sug});}
      }
      if(efetiva){for(const freq of pilha){if(freq)freq[efetiva]=(freq[efetiva]||0)+1;}}
    }
    const alvoGrupo=[];
    for(const t of sorted){
      if(t.frenteServico||!freqPorGrupo.has(t.id))continue;
      const chaves=Object.keys(freqPorGrupo.get(t.id));
      if(chaves.length===1)alvoGrupo.push({t,sugestao:chaves[0]});
    }
    const alvo=[...alvoLeaf,...alvoGrupo];
    if(!alvo.length){Utils.toast('Nenhuma tarefa nova pra classificar (todas já têm Frente ou não deu pra identificar).','alerta');return;}
    const porFrente={};
    for(const {sugestao} of alvo)porFrente[sugestao]=(porFrente[sugestao]||0)+1;
    const resumo=Object.entries(porFrente).map(([f,n])=>`${f}: ${n}`).join('\n');
    if(!confirm(`Sugestão automática pra ${alvo.length} tarefa(s) sem Frente definida (${alvoLeaf.length} folha(s) pelo nome + ${alvoGrupo.length} grupo(s) que herdam dos filhos):\n\n${resumo}\n\nAplicar? (só preenche quem está em branco — o que já tinha Frente não muda)`))return;
    Utils.mostrarLoading('Classificando frentes...');
    try{
      _undoPush();
      const LOTE=30;
      for(let i=0;i<alvo.length;i+=LOTE){
        await Promise.all(alvo.slice(i,i+LOTE).map(({t,sugestao})=>{
          t.frenteServico=sugestao;
          return Database.atualizar(obraId,COL,t.id,{frenteServico:sugestao}).catch(e=>console.error('Erro classificar frente:',t.id,e));
        }));
      }
      _buildFiltradas();_render();
      Utils.toast(`✅ ${alvo.length} tarefa(s) classificada(s) (${alvoGrupo.length} grupo(s) herdaram dos filhos). Revise a coluna "Frente" e ajuste manualmente o que precisar.`,'sucesso');
    }catch(e){console.error(e);Utils.toast('Erro ao classificar.','erro');}
    finally{Utils.esconderLoading();}
  }

  // ===================== EXPORTAR FRENTES (planilha lean pra revisão manual) =====================
  // Só 4 colunas — Código, Atividade, Pai e Frente — pensada pra mandar
  // pra fora do sistema, revisar/corrigir a Frente numa planilha simples
  // (sem se afogar nas outras 20 colunas do Exportar normal) e reimportar
  // depois em "Importar Correções" marcando só "Frente de Serviço".
  async function exportarFrentes(){
    if(!Permissions.pode('planejamento','exportar:frentes')){Utils.toast('Sem permissão para exportar.','erro');return;}
    try{Utils.mostrarLoading('Gerando...');
      if(typeof XLSX==='undefined')await _ls('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
      const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
      // "ID" é o id real da tarefa: nasce com ela, nunca muda, não é
      // reaproveitado e acompanha a tarefa se ela for movida de lugar.
      // É por ele que o import casa. O "Código" (WBS 1.3.6) muda quando a
      // estrutura muda, e 39 tarefas nem têm código — não serve de chave.
      // NÃO APAGUE nem edite essa coluna na planilha.
      const H=['ID','Código','Atividade','Pai','Frente'];
      const pilhaNomes=[];
      const rows=sorted.map(t=>{
        const niv=t.nivel||0;
        pilhaNomes.length=niv;
        const pai=niv>0?(pilhaNomes[niv-1]||''):'';
        pilhaNomes[niv]=t.nome||'';
        return [t.id||'',t.codigo||'','  '.repeat(niv)+(t.nome||''),pai,t.frenteServico||''];
      });
      const ws=XLSX.utils.aoa_to_sheet([H,...rows]);
      ws['!cols']=[{wch:24},{wch:12},{wch:55},{wch:40},{wch:14}];
      const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Frentes');
      const obra=Router.getObra();
      const wsObra=XLSX.utils.aoa_to_sheet([['obraId',obraId],['obraNome',obra?.nome||'']]);
      XLSX.utils.book_append_sheet(wb,wsObra,'_obra');
      XLSX.writeFile(wb,`frentes_${(obra?.nome||'obra').replace(/[^a-z0-9]/gi,'_')}.xlsx`);
      Utils.toast('Exportado! Depois de corrigir a coluna Frente, reimporte em "Importar Correções" marcando só "Frente de Serviço".','sucesso',6000);
    }catch(e){Utils.toast('Erro: '+e.message,'erro');}finally{Utils.esconderLoading();}
  }

  // ===================== EXPORTAR =====================
  async function exportar(){
    if(!Permissions.pode('planejamento','exportar:excel')){Utils.toast('Sem permissão para exportar.','erro');return;}
    try{Utils.mostrarLoading('Gerando...');
      if(typeof XLSX==='undefined')await _ls('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
      // "ID" é o identificador REAL da tarefa: nasce com ela, nunca muda, não
      // é reaproveitado e acompanha a tarefa pra onde ela for movida. Até a
      // V3.13.3 essa coluna trazia i+1 (a POSIÇÃO), então exportar → mover uma
      // linha → exportar de novo dava IDs diferentes pra mesma tarefa: o
      // número grudava na linha, não na tarefa.
      // "Linha" é a posição (1..N) e existe por um motivo só: a coluna
      // Prececessora referencia esse número. Ela é recalculada a cada
      // exportação de propósito — NÃO use como identificador.
      const H=['ID','Linha','Código','Nível','Nome','Duração','Início','Término','% Esperado','% Concluído',
        'Prececessora','Tarefa Pai','Grupo','Subgrupo','Local','Frente','Categoria','Subcategoria','Custo','Receita','Responsável',
        'Inicio Linha de Base','Termino Linha de Base','Inicio Desafio','Termino Desafio'];
      const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
      const rows=sorted.map((t,i)=>[t.id||'',i+1,t.codigo||'',t.nivel||0,'  '.repeat(t.nivel||0)+(t.nome||''),
        t.duracao?t.duracao+'d':'',_fBR(t.inicioPlanejado),_fBR(t.terminoPlanejado),
        _percEsp(t),t.percentualConcluido||0,t._predDisplay||'',t.tarefaPai||'',
        t.grupo||'',t.subgrupo||'',t.local||'',t.frenteServico||'',t.categoria||'',t.subcategoria||'',t.custo||0,t.receita||0,t.responsavel||'',
        _fBR(t.inicioPlanejadoBase),_fBR(t.terminoPlanejadoBase),_fBR(t.inicioDesafio),_fBR(t.terminoDesafio)]);
      const ws=XLSX.utils.aoa_to_sheet([H,...rows]);
      ws['!cols']=[{wch:24},{wch:6},{wch:10},{wch:7},{wch:45},{wch:8},{wch:13},{wch:13},{wch:11},{wch:11},
        {wch:13},{wch:20},{wch:18},{wch:10},{wch:15},{wch:12},{wch:18},{wch:22},{wch:10},{wch:10},{wch:18},{wch:22},{wch:22},{wch:15},{wch:15}];
      const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Cronograma');
      const obra=Router.getObra();
      // Aba oculta com a obra de origem — o Importar Correções/Base Completa
      // lê isso e avisa ANTES de aplicar se a planilha for de outra obra
      // (esse mesmo erro já aconteceu: 0 casadas pelo ID porque a obra
      // selecionada no momento do import era outra).
      const wsObra=XLSX.utils.aoa_to_sheet([['obraId',obraId],['obraNome',obra?.nome||'']]);
      XLSX.utils.book_append_sheet(wb,wsObra,'_obra');
      XLSX.writeFile(wb,`cronograma_${(obra?.nome||'obra').replace(/[^a-z0-9]/gi,'_')}.xlsx`);
      Utils.toast('Exportado!','sucesso');
    }catch(e){Utils.toast('Erro: '+e.message,'erro');}finally{Utils.esconderLoading();}
  }

  // ===================== EXPORTAR PNG =====================
  function exportarPNG(){
    if(!Permissions.pode('planejamento','exportar:png')){Utils.toast('Sem permissão para exportar.','erro');return;}
    // Popup para selecionar intervalo
    let pop=document.getElementById('png-pop');if(pop){pop.remove();return;}
    // Datas do projeto
    const datas=tarefas.flatMap(t=>[t.inicioPlanejado,t.terminoPlanejado].filter(Boolean)).sort();
    const minDate=datas[0]||new Date().toISOString().split('T')[0];
    const maxDate=datas[datas.length-1]||minDate;
    
    pop=document.createElement('div');pop.id='png-pop';
    pop.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a1a;border:2px solid var(--cor-primaria);border-radius:10px;padding:20px;z-index:2000;min-width:340px;box-shadow:0 12px 40px rgba(0,0,0,.6);';
    pop.innerHTML=`
      <div style="font-weight:700;color:var(--cor-primaria);margin-bottom:14px;">🖼 Exportar Gantt como PNG</div>
      <div class="form-row" style="gap:10px;margin-bottom:14px;">
        <div class="form-grupo" style="margin:0;"><label style="font-size:.72rem;color:#888;">Início</label>
          <input type="date" id="png-ini" value="${minDate}" class="form-control"></div>
        <div class="form-grupo" style="margin:0;"><label style="font-size:.72rem;color:#888;">Fim</label>
          <input type="date" id="png-fim" value="${maxDate}" class="form-control"></div>
      </div>
      <div style="font-size:.72rem;color:#555;margin-bottom:6px;">Período do projeto: ${_fd(minDate)} a ${_fd(maxDate)}</div>
      <div style="font-size:.68rem;color:#444;margin-bottom:14px;">A escala se ajusta ao tamanho do período automaticamente. Se houver muitas tarefas, o sistema gera várias imagens (páginas) para garantir que todas apareçam.</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-secundario btn-sm" onclick="document.getElementById('png-pop').remove()">Cancelar</button>
        <button class="btn btn-primario btn-sm" onclick="Planejamento._gerarPNG()">Gerar PNG</button>
      </div>`;
    document.body.appendChild(pop);
  }
  
  async function _gerarPNG(){
    // IMPORTANTE: ler os valores ANTES de remover o popup — os inputs
    // são filhos dele, então remover primeiro apaga os valores.
    const iniStr=document.getElementById('png-ini')?.value;
    const fimStr=document.getElementById('png-fim')?.value;
    const pop=document.getElementById('png-pop');if(pop)pop.remove();
    if(!iniStr||!fimStr){Utils.toast('Selecione o intervalo de datas.','alerta');return;}
    const dMin=new Date(iniStr+'T00:00:00');
    const dMax=new Date(fimStr+'T00:00:00');
    if(dMax<dMin){Utils.toast('Data final antes da inicial.','alerta');return;}
    if(!filtradas.length){Utils.toast('Nenhuma tarefa para exportar.','alerta');return;}

    const totalDias=Math.max(1,Math.ceil((dMax-dMin)/864e5));

    // Escala do PNG é escolhida AUTOMATICAMENTE pelo tamanho do intervalo,
    // independente do zoom da tela (a tela pode estar em "Dia" mas pedir
    // 3 anos — usar 32px/dia geraria uma imagem gigante sem necessidade).
    const ESCALAS=[
      {nome:'dia',       lpd:32,  maxDias:60},
      {nome:'semana',    lpd:8,   maxDias:240},
      {nome:'mes',       lpd:3,   maxDias:900},
      {nome:'trimestre', lpd:1.2, maxDias:2500},
      {nome:'ano',       lpd:0.4, maxDias:Infinity},
    ];
    const escolhida=ESCALAS.find(e=>totalDias<=e.maxDias)||ESCALAS[ESCALAS.length-1];
    const lpd=escolhida.lpd;
    const W=Math.max(200,Math.round(totalDias*lpd));
    const tf=filtradas; // todas as linhas visíveis (respeita famílias recolhidas)
    const visCols=colOrdem.filter(id=>!colsHidden.has(id));
    const larguraEsq=_totalColWidth(visCols);
    const larguraTotal=larguraEsq+W;

    // Escala de captura (scale do html2canvas): reduz automaticamente
    // se a LARGURA final ficaria grande demais para o navegador aguentar.
    let scaleCaptura=2;
    if(larguraTotal*scaleCaptura>16000)scaleCaptura=1;

    // PAGINAÇÃO: com muitas tarefas (ex: 2500 linhas), uma imagem só
    // ficaria alta demais e travaria/corromperia no navegador. Em vez
    // de bloquear, dividimos em várias páginas — cada uma com o MESMO
    // cabeçalho e período, cobrindo TODAS as linhas ao final.
    const ALTURA_MAX_POR_PAGINA=8000; // px antes da escala, valor seguro universal
    const linhasPorPagina=Math.max(30,Math.floor(ALTURA_MAX_POR_PAGINA/ROW_H));
    const totalPaginas=Math.max(1,Math.ceil(tf.length/linhasPorPagina));

    try{
      if(typeof html2canvas==='undefined'){
        Utils.mostrarLoading('Carregando biblioteca...');
        await _ls('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      }

      // ---- Partes que são IGUAIS em todas as páginas ----
      const hdrHtml=visCols.map(id=>{
        const w=id==='nome'?(colLarguras['nome']?`width:${colLarguras['nome']}px;flex-shrink:0;`:'flex:1;min-width:150px;'):`width:${colLarguras[id]||60}px;flex-shrink:0;`;
        return`<div style="${w}padding:0 4px;font-size:.63rem;font-weight:700;color:#555;text-transform:uppercase;overflow:hidden;white-space:nowrap;display:flex;align-items:center;">${COL_LABELS[id]||id}</div>`;
      }).join('');
      // _buildDateHeader decide a granularidade dos labels pela variável
      // global zoomGantt — trocamos temporariamente pela escala escolhida
      // para o PNG e restauramos logo em seguida (não afeta a tela).
      const zoomOriginal=zoomGantt;
      zoomGantt=escolhida.nome;
      const hDatas=_buildDateHeader(dMin,dMax,lpd,W);
      zoomGantt=zoomOriginal;
      const hoje=new Date();
      const hojeX=Math.round((hoje-dMin)/864e5*lpd);
      const mostrarHoje=hoje>=dMin&&hoje<=dMax;

      // ---- Gera e baixa uma página (fatia de linhas) ----
      async function gerarPagina(inicioIdx, fimIdx, numPagina){
        const alturaPagina=(fimIdx-inicioIdx)*ROW_H;
        let rowsHtml='', barsHtml='';
        for(let i=inicioIdx;i<fimIdx;i++){
          const t=tf[i], yLocal=(i-inicioIdx)*ROW_H, isG=t.tipo==='grupo', st2=_status(t), perc=_perc(t);
          let cells='';
          for(const cid of visCols){
            const w=cid==='nome'?(colLarguras['nome']?`width:${colLarguras['nome']}px;flex-shrink:0;`:'flex:1;min-width:150px;'):`width:${colLarguras[cid]||60}px;flex-shrink:0;`;
            const base=`${w}overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding:0 4px;font-size:.78rem;height:100%;display:flex;align-items:center;`;
            if(cid==='sel')cells+=`<div style="${base}"></div>`;
            else if(cid==='status'){const stInfo=STATUS_INFO[st2]||STATUS_INFO.em_dia;cells+=`<div style="${base}justify-content:center;"><span style="width:9px;height:9px;border-radius:50%;background:${stInfo.cor};display:inline-block;"></span></div>`;}
            else if(cid==='num')cells+=`<div style="${base}color:#444;font-family:var(--font-mono);font-size:.65rem;justify-content:center;">${t._numLinha||i+1}</div>`;
            else if(cid==='nivel')cells+=`<div style="${base}color:#666;font-family:var(--font-mono);font-size:.68rem;justify-content:center;">${t.nivel||0}</div>`;
            else if(cid==='codigo')cells+=`<div style="${base}color:#555;font-family:var(--font-mono);font-size:.7rem;">${t.codigo||''}</div>`;
            else if(cid==='nome'){
              const ind=(t.nivel||0)*14;
              cells+=`<div style="${base}padding-left:${ind+4}px;"><span style="color:${isG?'var(--cor-primaria)':'#ccc'};font-weight:${isG?700:400};overflow:hidden;text-overflow:ellipsis;">${t.nome||''}</span></div>`;
            }
            else if(cid==='inicio')cells+=`<div style="${base}color:#666;font-size:.7rem;justify-content:center;">${_fd(_vIni(t))}</div>`;
            else if(cid==='termino')cells+=`<div style="${base}color:#666;font-size:.7rem;justify-content:center;">${_fd(_vFim(t))}</div>`;
            else if(cid==='inicioReal')cells+=`<div style="${base}color:#888;font-size:.7rem;justify-content:center;" title="Preenchido via Diário de Obra, Medições ou Semanal">${_fd(t.inicioReal)}</div>`;
            else if(cid==='terminoReal')cells+=`<div style="${base}color:#888;font-size:.7rem;justify-content:center;" title="Preenchido via Diário de Obra, Medições ou Semanal">${_fd(t.terminoReal)}</div>`;
            else if(cid==='duracao')cells+=`<div style="${base}color:#666;font-size:.7rem;justify-content:center;">${t.duracao||'—'}</div>`;
            else if(cid==='percEsp')cells+=`<div style="${base}color:#555;font-size:.7rem;justify-content:center;">${_percEsp(t)}%</div>`;
            else if(cid==='percConc')cells+=`<div style="${base}font-size:.7rem;justify-content:center;color:${perc>=100?'#16a34a':perc>0?'#2563eb':'#555'};">${perc}%</div>`;
            else if(cid==='predecessora')cells+=`<div style="${base}color:#555;font-size:.7rem;justify-content:center;" title="${_esc(_tooltipPred(t))}">${t._predDisplay||'—'}</div>`;
            else if(cid==='sucessora')cells+=`<div style="${base}color:#666;font-size:.7rem;justify-content:center;" title="${_esc(_tooltipSuc(t._sucessoras))||'Calculado automaticamente'}">${(t._sucessoras&&t._sucessoras.length)?t._sucessoras.join(', '):'—'}</div>`;
            else if(cid==='responsavel')cells+=`<div style="${base}color:#555;font-size:.7rem;">${t.responsavel||'—'}</div>`;
            else if(cid==='local')cells+=`<div style="${base}color:#555;font-size:.7rem;">${t.local||'—'}</div>`;
            else if(cid==='vinculoEstrutura')cells+=`<div style="${base}color:#888;font-size:.7rem;">${_resumoVinculo(t.vinculoEstrutura)||'—'}</div>`;
            else if(cid==='grupo')cells+=`<div style="${base}color:#555;font-size:.7rem;">${t.grupo||'—'}</div>`;
            else if(cid==='subgrupo')cells+=`<div style="${base}color:#555;font-size:.7rem;">${t.subgrupo||'—'}</div>`;
            else if(cid==='categoria')cells+=`<div style="${base}color:#555;font-size:.7rem;">${t.categoria||'—'}</div>`;
            else if(cid==='subcategoria')cells+=`<div style="${base}color:#555;font-size:.7rem;">${t.subcategoria||'—'}</div>`;
            else if(cid==='quantidade'){const vinc=t.fonteQuantidade==='levantamento';cells+=`<div style="${base}color:${vinc?'var(--cor-primaria)':'#555'};font-size:.7rem;justify-content:flex-end;">${vinc?'🔗 ':''}${t.quantidade?_fQtd(t.quantidade)+' '+(t.unidade||''):'—'}</div>`;}
            else if(cid==='custoMaterial'){const cm=custoMaterialPorTarefa.get(t.id)||0;cells+=`<div style="${base}color:#8a8;font-size:.68rem;justify-content:flex-end;">${cm?'R$ '+_fMoeda(cm):'—'}</div>`;}
            else if(cid==='custoMaoObra'){const cmo=custoMaoObraPorTarefa.get(t.id)||0;cells+=`<div style="${base}color:#8a8;font-size:.68rem;justify-content:flex-end;">${cmo?'R$ '+_fMoeda(cmo):'—'}</div>`;}
            else if(cid==='acoes')cells+=`<div style="${base}"></div>`;
          }
          rowsHtml+=`<div style="position:absolute;top:${yLocal}px;left:0;right:0;height:${ROW_H}px;display:flex;align-items:center;border-bottom:1px solid #1a1a1a;background:${i%2?'rgba(255,255,255,.015)':''};">${cells}</div>`;

          barsHtml+=`<div style="position:absolute;left:0;top:${yLocal}px;width:100%;height:${ROW_H}px;border-bottom:1px solid #1a1a1a;background:${i%2?'rgba(255,255,255,.015)':''};"></div>`;
          if(_vIni(t)&&_vFim(t)){
            const ti=new Date(_vIni(t)), tf2=new Date(_vFim(t));
            if(tf2>=dMin&&ti<=dMax){
              const bx=Math.round((ti-dMin)/864e5*lpd);
              const bw=Math.max(4,Math.round((tf2-ti)/864e5*lpd));
              const by=yLocal+5,bh=20;
              const cor={em_dia:'#2563eb',em_andamento:'#ca8a04',concluido:'#15803d',alerta:'#c2410c',atrasado:'#dc2626'}[st2]||'#333';
              if(isG){
                barsHtml+=`<div style="position:absolute;left:${bx}px;top:${by+8}px;width:${bw}px;height:5px;background:var(--cor-primaria);border-radius:1px;"></div>`;
              } else {
                barsHtml+=`<div style="position:absolute;left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px;background:${cor};border-radius:3px;overflow:hidden;">
                  <div style="height:100%;width:${perc}%;background:rgba(255,255,255,.25);"></div>
                  ${bw>50?`<span style="position:absolute;left:4px;top:4px;font-size:.58rem;color:rgba(255,255,255,.85);white-space:nowrap;overflow:hidden;max-width:${bw-8}px;">${t.nome}</span>`:''}
                </div>`;
              }
            }
          }
        }

        const legendaPagina=totalPaginas>1?`<div style="position:absolute;top:2px;right:6px;font-size:.6rem;color:#666;z-index:20;">Página ${numPagina} de ${totalPaginas} — linhas ${inicioIdx+1}–${fimIdx}</div>`:'';

        const offscreen=document.createElement('div');
        offscreen.style.cssText='position:fixed;left:-999999px;top:0;background:#0d0d0d;';
        offscreen.innerHTML=`<div style="position:relative;display:flex;border:1px solid #222;border-radius:6px;overflow:hidden;width:${larguraEsq+W}px;">
          ${legendaPagina}
          <div style="width:${larguraEsq}px;flex-shrink:0;background:#111;">
            <div style="height:26px;background:#0d0d0d;border-bottom:1px solid #222;display:flex;align-items:center;">${hdrHtml}</div>
            <div style="height:${alturaPagina}px;position:relative;">${rowsHtml}</div>
          </div>
          <div style="width:${W}px;flex-shrink:0;background:#0d0d0d;">
            <div style="height:26px;background:#0a0a0a;border-bottom:1px solid #222;position:relative;">${hDatas}</div>
            <div style="width:${W}px;height:${alturaPagina}px;position:relative;">
              ${barsHtml}
              ${mostrarHoje?`<div style="position:absolute;left:${hojeX}px;top:0;bottom:0;width:2px;background:var(--cor-primaria);opacity:.8;z-index:5;"></div>`:''}
            </div>
          </div>
        </div>`;
        document.body.appendChild(offscreen);

        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

        const canvas=await html2canvas(offscreen.firstElementChild,{
          backgroundColor:'#0d0d0d',
          scale:scaleCaptura,
          logging:false,
          useCORS:true,
          allowTaint:true,
        });
        offscreen.remove();

        await new Promise(resolve=>{
          canvas.toBlob(blob=>{
            if(!blob){resolve();return;}
            const url=URL.createObjectURL(blob);
            const link=document.createElement('a');
            const sufixoPagina=totalPaginas>1?`_pagina_${String(numPagina).padStart(2,'0')}_de_${totalPaginas}`:'';
            link.download=`gantt_${iniStr}_a_${fimStr}${sufixoPagina}.png`;
            link.href=url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            resolve();
          },'image/png');
        });
      }

      // ---- Gera todas as páginas necessárias, uma de cada vez ----
      for(let p=0;p<totalPaginas;p++){
        const inicioIdx=p*linhasPorPagina;
        const fimIdx=Math.min(tf.length,inicioIdx+linhasPorPagina);
        Utils.mostrarLoading(totalPaginas>1
          ?`Gerando página ${p+1} de ${totalPaginas} (${escolhida.nome})...`
          :`Renderizando Gantt completo (${escolhida.nome})...`);
        await gerarPagina(inicioIdx,fimIdx,p+1);
        if(p<totalPaginas-1)await new Promise(r=>setTimeout(r,350)); // evita bloqueio de downloads simultâneos
      }

      Utils.toast(totalPaginas>1
        ?`✅ ${totalPaginas} páginas geradas — ${tf.length} tarefas no total!`
        :'PNG do Gantt exportado!','sucesso');
    }catch(e){
      console.error('Erro PNG:',e);
      Utils.toast('Erro ao gerar: '+e.message,'erro');
      const off=document.querySelector('div[style*="left:-999999px"]');if(off)off.remove();
    }finally{Utils.esconderLoading();}
  }

  function _totalColWidth(visCols){
    return visCols.reduce((s,id)=>{
      if(id==='nome')return s+250;
      return s+(colLarguras[id]||60);
    },0);
  }

  // ===================== HELPERS =====================
  // 5 estados (igual à legenda pedida): Atrasado, Alerta, Em Andamento, Em Dia, Concluído
  function _status(t){
    if(_perc(t)>=100)return'concluido';
    const hoje=new Date();
    const fim=t.terminoPlanejado?new Date(t.terminoPlanejado):null;
    if(fim&&hoje>fim)return'atrasado';
    if(fim){
      const diasRestantes=Math.ceil((fim-hoje)/864e5);
      if(diasRestantes<=7)return'alerta';
    }
    if(_perc(t)>0)return'em_andamento';
    return'em_dia';
  }
  function _perc(t){return Math.round(t.percentualConcluido||0);}
  // % Esperado calculado AO VIVO pela data de hoje dentro do intervalo
  // início→término planejado (mesma fórmula do Diário de Obra) — o campo
  // percentualEsperado salvo no banco (importado da Cofield) fica defasado
  // no dia seguinte ao import; esse cálculo nunca fica.
  function _percEsp(t){
    const i=t.inicioPlanejado,f=t.terminoPlanejado;
    if(!i||!f)return t.percentualEsperado||0; // sem datas: mostra o salvo (melhor que nada)
    const hoje=new Date().toISOString().split('T')[0];
    if(hoje<i)return 0;
    if(hoje>=f)return 100;
    const total=(new Date(f)-new Date(i))/864e5+1;
    const dec=(new Date(hoje)-new Date(i))/864e5+1;
    return Math.round(dec/total*100);
  }
  function _fd(d){if(!d)return'—';try{return new Date(d+'T12:00:00').toLocaleDateString('pt-BR');}catch(e){return d;}}
  function _fBR(d){if(!d)return'';try{return new Date(d+'T12:00:00').toLocaleDateString('pt-BR');}catch(e){return'';}}
  function _fMoeda(n){return Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function _fQtd(n){return Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function _pd(v){if(!v)return'';if(v instanceof Date)return v.toISOString().split('T')[0];
    if(typeof v==='number')return new Date((v-25569)*864e5).toISOString().split('T')[0];
    const s=String(v).trim(),m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(m)return`${m[3]}-${m[2]}-${m[1]}`;if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.split('T')[0];return'';}
  function _pDur(v){return parseInt(String(v||'').replace(/\D/g,''))||0;}
  function _pN(v){return parseFloat(String(v||'').replace(',','.'))||0;}
  function _ls(src){return new Promise((r,j)=>{const s=document.createElement('script');s.src=src;s.onload=r;s.onerror=j;document.head.appendChild(s);});}

  // ===================== EXPORTAR EXCEL BONITO (com estilos) =====================
  // Usa xlsx-js-style (drop-in do SheetJS com suporte a estilo de célula):
  // cabeçalho escuro, grupos com cor por nível, indentação, bordas, filtro e
  // linha de cabeçalho congelada — pronto pra ler e imprimir direto do Excel.
  async function exportarExcelBonito(){
    if(!Permissions.pode('planejamento','exportar:excel')){Utils.toast('Sem permissão para exportar.','erro');return;}
    try{Utils.mostrarLoading('Gerando Excel formatado...');
      if(typeof XLSXStyle==='undefined'&&!window._xlsxStyleLoaded){
        await _ls('https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js');
        window._xlsxStyleLoaded=true;
      }
      const X=window.XLSX; // xlsx-js-style substitui o global com API compatível
      const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
      const H=['#','Nome','Duração','Início','Término','% Esp.','% Conc.','Predecessora','Responsável','Frente','Início Real','Término Real'];
      const rows=sorted.map((t,i)=>[i+1,'    '.repeat(t.nivel||0)+(t.nome||''),
        t.duracao?t.duracao+'d':'',_fBR(t.inicioPlanejado),_fBR(t.terminoPlanejado),
        _percEsp(t)+'%',(t.percentualConcluido||0)+'%',t._predDisplay||'',
        t.responsavel||'',t.frenteServico||'',_fBR(t.inicioReal),_fBR(t.terminoReal)]);
      const ws=X.utils.aoa_to_sheet([H,...rows]);
      ws['!cols']=[{wch:5},{wch:55},{wch:8},{wch:11},{wch:11},{wch:8},{wch:8},{wch:14},{wch:16},{wch:12},{wch:11},{wch:11}];
      ws['!freeze']={xSplit:0,ySplit:1};
      ws['!autofilter']={ref:X.utils.encode_range({s:{r:0,c:0},e:{r:rows.length,c:H.length-1}})};

      // Quem tem filho direto (grupo de verdade), pra dar negrito/cor por nível
      const temFilho=sorted.map((t,i)=>i+1<sorted.length&&(sorted[i+1].nivel||0)>(t.nivel||0));
      const bordas={top:{style:'thin',color:{rgb:'D1D5DB'}},bottom:{style:'thin',color:{rgb:'D1D5DB'}},left:{style:'thin',color:{rgb:'D1D5DB'}},right:{style:'thin',color:{rgb:'D1D5DB'}}};
      const CORES_NIVEL=['F5C800','FDE68A','FEF3C7','F3F4F6']; // nível 0,1,2,3+ (grupos)
      for(let c=0;c<H.length;c++){
        const ref=X.utils.encode_cell({r:0,c});
        if(ws[ref])ws[ref].s={font:{bold:true,color:{rgb:'FFFFFF'},sz:11},fill:{fgColor:{rgb:'111827'}},alignment:{horizontal:'center',vertical:'center'},border:bordas};
      }
      for(let r=0;r<sorted.length;r++){
        const t=sorted[r],niv=t.nivel||0,grupo=temFilho[r];
        const fill=grupo?{fgColor:{rgb:CORES_NIVEL[Math.min(niv,CORES_NIVEL.length-1)]}}:(r%2?{fgColor:{rgb:'FAFAFA'}}:null);
        for(let c=0;c<H.length;c++){
          const ref=X.utils.encode_cell({r:r+1,c});
          if(!ws[ref])continue;
          const s={font:{bold:!!grupo,sz:10},border:bordas,alignment:{horizontal:c===1?'left':'center',vertical:'center'}};
          if(fill)s.fill=fill;
          if(c===6&&(t.percentualConcluido||0)>=100)s.font.color={rgb:'15803D'};
          ws[ref].s=s;
        }
      }
      const wb=X.utils.book_new();X.utils.book_append_sheet(wb,ws,'Cronograma');
      const obra=Router.getObra();
      X.writeFile(wb,`cronograma_${(obra?.nome||'obra').replace(/[^a-z0-9]/gi,'_')}_formatado.xlsx`);
      Utils.toast('Excel formatado exportado!','sucesso');
    }catch(e){console.error(e);Utils.toast('Erro: '+e.message,'erro');}finally{Utils.esconderLoading();}
  }

  // ===================== EXPORTAR MS PROJECT (.xml MSPDI) =====================
  // Gera XML no formato nativo de troca do MS Project (MSPDI) — abre direto no
  // Project (Arquivo > Abrir), com hierarquia (OutlineLevel), datas, duração,
  // % e predecessoras (tipo TI/II/TT/IT + defasagem).
  function exportarMSProject(){
    if(!Permissions.pode('planejamento','exportar:msproject')){Utils.toast('Sem permissão para exportar.','erro');return;}
    try{Utils.mostrarLoading('Gerando XML do MS Project...');
      const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
      const idNum=new Map(sorted.map((t,i)=>[t.id,i+1]));
      const escXml=s=>String(s??'').replace(/[<>&'"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
      // Tipo nosso -> código MSPDI: FF=0(TT) FS=1(TI) SF=2(IT) SS=3(II)
      const TIPO_MS={TT:0,TI:1,IT:2,II:3};
      const temFilho=sorted.map((t,i)=>i+1<sorted.length&&(sorted[i+1].nivel||0)>(t.nivel||0));
      const obra=Router.getObra();
      let tasksXml='';
      sorted.forEach((t,i)=>{
        const uid=i+1;
        const dur=Number(t.duracao)||0;
        const ini=t.inicioPlanejado?`${t.inicioPlanejado}T08:00:00`:'';
        const fim=t.terminoPlanejado?`${t.terminoPlanejado}T17:00:00`:'';
        let preds='';
        for(const p of _predParse(t.predecessora)){
          const pUid=idNum.get(p.id);
          if(!pUid)continue;
          const lagDias=parseInt(p.lag)||0;
          preds+=`<PredecessorLink><PredecessorUID>${pUid}</PredecessorUID><Type>${TIPO_MS[p.tipo]??1}</Type><CrossProject>0</CrossProject><LinkLag>${lagDias*4800}</LinkLag><LagFormat>7</LagFormat></PredecessorLink>`;
        }
        tasksXml+=`<Task><UID>${uid}</UID><ID>${uid}</ID><Name>${escXml(t.nome)}</Name><Active>1</Active><Type>0</Type><OutlineLevel>${(t.nivel||0)+1}</OutlineLevel><Summary>${temFilho[i]?1:0}</Summary>`+
          (ini?`<Start>${ini}</Start>`:'')+(fim?`<Finish>${fim}</Finish>`:'')+
          `<Duration>PT${dur*8}H0M0S</Duration><DurationFormat>7</DurationFormat><PercentComplete>${Math.round(t.percentualConcluido||0)}</PercentComplete>${preds}</Task>`;
      });
      const xml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Project xmlns="http://schemas.microsoft.com/project"><Name>${escXml(obra?.nome||'Obra')}</Name><Title>${escXml(obra?.nome||'Obra')}</Title><ScheduleFromStart>1</ScheduleFromStart><CalendarUID>1</CalendarUID><Calendars><Calendar><UID>1</UID><Name>Padrão</Name><IsBaseCalendar>1</IsBaseCalendar><WeekDays><WeekDay><DayType>1</DayType><DayWorking>0</DayWorking></WeekDay><WeekDay><DayType>2</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTimes></WeekDay><WeekDay><DayType>3</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTimes></WeekDay><WeekDay><DayType>4</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTimes></WeekDay><WeekDay><DayType>5</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTimes></WeekDay><WeekDay><DayType>6</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTimes></WeekDay><WeekDay><DayType>7</DayType><DayWorking>0</DayWorking></WeekDay></WeekDays></Calendar></Calendars><Tasks>${tasksXml}</Tasks></Project>`;
      const blob=new Blob([xml],{type:'application/xml'});
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download=`cronograma_${(obra?.nome||'obra').replace(/[^a-z0-9]/gi,'_')}_msproject.xml`;
      a.click();URL.revokeObjectURL(a.href);
      Utils.toast('XML do MS Project exportado! No Project: Arquivo → Abrir.','sucesso');
    }catch(e){console.error(e);Utils.toast('Erro: '+e.message,'erro');}finally{Utils.esconderLoading();}
  }

  // ===================== IMPRIMIR / PDF (visão bonita) =====================
  // Abre uma janela limpa, fundo branco, com a MESMA visão hierárquica bonita
  // da tela (indentação, grupos coloridos por nível, status) — o diálogo de
  // impressão do navegador imprime ou salva em PDF direto.
  // ===================== BAIXAR PDF DIRETO =====================
  // Gera e baixa o arquivo .pdf na hora (sem passar pelo diálogo de
  // impressão) — mesmo visual da impressão: A4 paisagem, cabeçalho escuro
  // repetido em cada página, grupos coloridos por nível, indentação.
  async function baixarPDF(){
    if(!Permissions.pode('planejamento','exportar:pdf')){Utils.toast('Sem permissão para exportar.','erro');return;}
    try{Utils.mostrarLoading('Gerando PDF...');
      if(!window.jspdf){
        await _ls('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        await _ls('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
      }
      const {jsPDF}=window.jspdf;
      const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
      const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
      const temFilho=sorted.map((t,i)=>i+1<sorted.length&&(sorted[i+1].nivel||0)>(t.nivel||0));
      const CORES_NIVEL=[[245,200,0],[253,230,138],[254,243,199],[243,244,246]];
      const obra=Router.getObra();
      const body=sorted.map((t,i)=>[i+1,'   '.repeat(t.nivel||0)+(t.nome||''),
        t.duracao?t.duracao+'d':'',_fBR(t.inicioPlanejado),_fBR(t.terminoPlanejado),
        _percEsp(t)+'%',(t.percentualConcluido||0)+'%',t._predDisplay||'',t.responsavel||'']);
      doc.setFontSize(13);doc.text(`Cronograma — ${obra?.nome||'Obra'}`,14,12);
      doc.setFontSize(8);doc.setTextColor(107,114,128);
      doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} · ${sorted.length} tarefas · Absoluta Engenharia`,14,17);
      doc.autoTable({
        head:[['#','Tarefa','Dur.','Início','Término','% Esp.','% Conc.','Predecessora','Responsável']],
        body,startY:21,
        styles:{fontSize:6.8,cellPadding:1.2,lineColor:[209,213,219],lineWidth:0.1,textColor:[17,17,17]},
        headStyles:{fillColor:[17,24,39],textColor:[255,255,255],fontStyle:'bold',halign:'center',fontSize:6.8},
        columnStyles:{0:{halign:'center',cellWidth:9},1:{cellWidth:100},2:{halign:'center',cellWidth:12},3:{halign:'center',cellWidth:19},4:{halign:'center',cellWidth:19},5:{halign:'center',cellWidth:13},6:{halign:'center',cellWidth:13},7:{halign:'center',cellWidth:32},8:{cellWidth:'auto'}},
        didParseCell:d=>{
          if(d.section!=='body')return;
          const i=d.row.index,t=sorted[i];
          if(!t)return;
          if(temFilho[i]){
            d.cell.styles.fontStyle='bold';
            d.cell.styles.fillColor=CORES_NIVEL[Math.min(t.nivel||0,CORES_NIVEL.length-1)];
          } else if(i%2){d.cell.styles.fillColor=[250,250,250];}
          if(d.column.index===6&&(t.percentualConcluido||0)>=100)d.cell.styles.textColor=[21,128,61];
        },
      });
      doc.save(`cronograma_${(obra?.nome||'obra').replace(/[^a-z0-9]/gi,'_')}.pdf`);
      Utils.toast('PDF baixado!','sucesso');
    }catch(e){console.error(e);Utils.toast('Erro: '+e.message,'erro');}finally{Utils.esconderLoading();}
  }

  function abrirImpressao(){
    if(!Permissions.pode('planejamento','exportar:pdf')){Utils.toast('Sem permissão para exportar.','erro');return;}
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const temFilho=sorted.map((t,i)=>i+1<sorted.length&&(sorted[i+1].nivel||0)>(t.nivel||0));
    const CORES_NIVEL=['#F5C800','#FDE68A','#FEF3C7','#F3F4F6'];
    const obra=Router.getObra();
    const linhas=sorted.map((t,i)=>{
      const niv=t.nivel||0,grupo=temFilho[i];
      const bg=grupo?CORES_NIVEL[Math.min(niv,CORES_NIVEL.length-1)]:(i%2?'#FAFAFA':'#FFF');
      const perc=t.percentualConcluido||0;
      return `<tr style="background:${bg};${grupo?'font-weight:700;':''}">
        <td style="text-align:center;">${i+1}</td>
        <td style="padding-left:${8+niv*16}px;">${_esc(t.nome||'')}</td>
        <td style="text-align:center;">${t.duracao?t.duracao+'d':''}</td>
        <td style="text-align:center;">${_fBR(t.inicioPlanejado)}</td>
        <td style="text-align:center;">${_fBR(t.terminoPlanejado)}</td>
        <td style="text-align:center;">${_percEsp(t)}%</td>
        <td style="text-align:center;color:${perc>=100?'#15803D':perc>0?'#2563EB':'#6B7280'};font-weight:600;">${perc}%</td>
        <td style="text-align:center;">${_esc(t._predDisplay||'')}</td>
        <td>${_esc(t.responsavel||'')}</td>
      </tr>`;
    }).join('');
    const w=window.open('','_blank');
    if(!w){Utils.toast('Popup bloqueado — libere popups pra imprimir.','alerta');return;}
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cronograma — ${_esc(obra?.nome||'Obra')}</title>
      <style>
        body{font-family:'Segoe UI',Arial,sans-serif;margin:20px;color:#111;}
        h1{font-size:18px;margin:0 0 2px;}
        .sub{font-size:11px;color:#6B7280;margin-bottom:14px;}
        table{border-collapse:collapse;width:100%;font-size:10.5px;}
        th{background:#111827;color:#FFF;padding:6px 8px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:.3px;}
        td{border:1px solid #D1D5DB;padding:4px 8px;}
        thead{display:table-header-group;} /* repete cabeçalho em cada página impressa */
        tr{page-break-inside:avoid;}
        @media print{body{margin:8mm;} @page{size:A4 landscape;margin:8mm;}}
      </style></head><body>
      <h1>Cronograma — ${_esc(obra?.nome||'Obra')}</h1>
      <div class="sub">Gerado em ${new Date().toLocaleString('pt-BR')} · ${sorted.length} tarefas · Absoluta Engenharia</div>
      <table><thead><tr><th>#</th><th style="text-align:left;">Tarefa</th><th>Dur.</th><th>Início</th><th>Término</th><th>% Esp.</th><th>% Conc.</th><th>Predecessora</th><th>Responsável</th></tr></thead>
      <tbody>${linhas}</tbody></table>
      <script>window.onload=()=>setTimeout(()=>window.print(),300);<\/script>
      </body></html>`);
    w.document.close();
  }

  function setZoom(z){zoomGantt=z;_render();}

  // Popup de predecessora
  // Monta o HTML de UMA linha da tabela de predecessoras (estilo MS Project,
  // com nossa formatação escura). num/tipo/lag pré-carregados se houver.
  function _predLinhaHtml(num,tipo,lag){
    num=num||'';tipo=tipo||'TI';lag=lag||'';
    const pred=num?(isNaN(parseInt(num))?tarefas.find(x=>x.codigo===num):_numLinhaMap.get(parseInt(num))):null;
    const nomeAlvo=num?(pred?pred.nome:'<span style="color:#dc2626;">não encontrada</span>'):'';
    return `<tr data-pred-linha>
      <td style="padding:4px;border-bottom:1px solid #292929;width:90px;">
        <input type="text" value="${_esc(num)}" placeholder="Nº/código" oninput="Planejamento._predLinhaAtualizar(this)"
          style="width:100%;background:#111;border:1px solid #333;border-radius:4px;color:#fff;padding:4px 6px;font-size:.8rem;">
      </td>
      <td style="padding:4px;border-bottom:1px solid #292929;color:#aaa;font-size:.78rem;" data-pred-nome>${nomeAlvo}</td>
      <td style="padding:4px;border-bottom:1px solid #292929;width:170px;">
        <select style="width:100%;background:#111;border:1px solid #333;border-radius:4px;color:#fff;padding:4px 2px;font-size:.78rem;">
          <option value="TI" style="color:#3b82f6;" ${tipo==='TI'?'selected':''}>Término-a-Início (TI)</option>
          <option value="II" style="color:#ddd;" ${tipo==='II'?'selected':''}>Início-a-Início (II)</option>
          <option value="TT" style="color:#ef4444;" ${tipo==='TT'?'selected':''}>Término-a-Término (TT)</option>
          <option value="IT" style="color:#22c55e;" ${tipo==='IT'?'selected':''}>Início-a-Término (IT)</option>
        </select>
      </td>
      <td style="padding:4px;border-bottom:1px solid #292929;width:60px;">
        <input type="number" value="${lag}" placeholder="0"
          style="width:100%;background:#111;border:1px solid #333;border-radius:4px;color:#fff;padding:4px 6px;font-size:.8rem;">
      </td>
      <td style="padding:4px;border-bottom:1px solid #292929;width:26px;text-align:center;">
        <span style="cursor:pointer;color:#666;font-size:.85rem;" onclick="this.closest('tr').remove()" title="Remover linha">✕</span>
      </td>
    </tr>`;
  }
  function _predLinhaAtualizar(input){
    const num=input.value.trim();
    const td=input.closest('tr').querySelector('[data-pred-nome]');
    if(!td)return;
    if(!num){td.innerHTML='';return;}
    const pred=isNaN(parseInt(num))?tarefas.find(x=>x.codigo===num):_numLinhaMap.get(parseInt(num));
    td.innerHTML=pred?_esc(pred.nome):'<span style="color:#dc2626;">não encontrada</span>';
  }
  function _predAddLinha(){
    const tbody=document.getElementById('pred-tabela-body');
    if(!tbody)return;
    tbody.insertAdjacentHTML('beforeend',_predLinhaHtml('','TI',''));
  }

  function _predPopup(idx){
    const t=filtradas[idx];if(!t)return;
    let pop=document.getElementById('pred-pop');if(pop)pop.remove();
    pop=document.createElement('div');pop.id='pred-pop';
    pop.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a1a;border:2px solid var(--cor-primaria);border-radius:10px;padding:20px;z-index:2000;min-width:640px;max-width:95vw;max-height:85vh;overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,.6);';

    // Uma linha por predecessora já existente + 1 linha vazia extra pra
    // adicionar — igual ao MS Project (tabela de Predecessoras), com nossa
    // formatação escura.
    const arr=_predParse(t.predecessora);
    const linhasExistentes=arr.map(p=>_predLinhaHtml(_idParaNumLinha.get(p.id)||'',p.tipo,p.lag)).join('');

    pop.innerHTML=`
      <div style="font-weight:700;color:var(--cor-primaria);margin-bottom:4px;font-size:.95rem;">Predecessora de: ${_esc(t.nome)}</div>
      <div style="font-size:.68rem;color:#555;margin-bottom:14px;">
        TI = Término→Início (após terminar) · II = Início→Início (começa junto) · TT = Término→Término (termina junto) · IT = Início→Término
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
        <thead>
          <tr style="text-align:left;font-size:.68rem;color:#888;text-transform:uppercase;letter-spacing:.3px;">
            <th style="padding:4px 4px 8px;">Nº/Código</th>
            <th style="padding:4px 4px 8px;">Nome da Tarefa</th>
            <th style="padding:4px 4px 8px;">Tipo</th>
            <th style="padding:4px 4px 8px;">Defasagem</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="pred-tabela-body">${linhasExistentes}${_predLinhaHtml('','TI','')}</tbody>
      </table>
      <div style="margin-bottom:16px;">
        <span style="cursor:pointer;color:var(--cor-primaria);font-size:.78rem;font-weight:600;" onclick="Planejamento._predAddLinha()">＋ Adicionar linha</span>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-secundario btn-sm" onclick="document.getElementById('pred-pop').remove()">Cancelar</button>
        <button class="btn btn-perigo btn-sm" onclick="Planejamento._predSalvar(${idx},'')">Limpar tudo</button>
        <button class="btn btn-primario btn-sm" onclick="Planejamento._predSalvar(${idx})">Salvar</button>
      </div>`;
    document.body.appendChild(pop);
    pop.querySelector('input')?.focus();
    // Close on escape
    const onKey=e=>{if(e.key==='Escape'){pop.remove();document.removeEventListener('keydown',onKey);}};
    document.addEventListener('keydown',onKey);
  }

  async function _predSalvar(idx, forceVal){
    const t=filtradas[idx];if(!t)return;
    let canon;
    if(forceVal!==undefined){canon=forceVal;}
    else{
      const partes=[];
      document.querySelectorAll('#pred-tabela-body [data-pred-linha]').forEach(tr=>{
        const num=tr.querySelector('input[type="text"]')?.value?.trim();
        if(!num)return;
        const tipo=tr.querySelector('select')?.value||'TI';
        const lagRaw=tr.querySelector('input[type="number"]')?.value;
        const lag=lagRaw?((parseInt(lagRaw)>0?'+':'')+parseInt(lagRaw)):'';
        const numBusca=parseInt(num);
        const pred=isNaN(numBusca)?tarefas.find(x=>x.codigo===num):_numLinhaMap.get(numBusca);
        if(pred)partes.push({id:pred.id,tipo,lag});
      });
      canon=_predFormat(partes);
    }
    const updates={predecessora:canon};
    if(canon)_calcPredecessora(t,canon,updates);
    Object.assign(t,updates);
    _buildFiltradas(); // recalcula _sucessoras de quem passou a ser/deixou de ser predecessora
    _render();
    const pop=document.getElementById('pred-pop');if(pop)pop.remove();
    try{
      await Database.atualizar(obraId,COL,t.id,updates);
      if(updates.inicioPlanejado||updates.terminoPlanejado){
        await _propagarDataEmCascata(t.id);
        const paisAlterados=await _recalcularDatasPais(true);
      await _recalcularPercTodosPais(true);
        for(const p of paisAlterados)await _propagarDataEmCascata(p.id);
      }
    }
    catch(e){console.error(e);Utils.toast('Erro.','erro');}
  }

  function _hideCol(id){colsHidden.add(id);_render();requestAnimationFrame(()=>_paintRows());}


  // ===== SISTEMA ANTIGO DE REMAP (obsoleto) =====
  // Antes a predecessora era guardada por número de linha, e qualquer
  // inserção/exclusão/movimentação precisava "remapear" quem mudou de posição.
  // Isso sempre sobrava algum caso não coberto (daí o histórico de bugs).
  // Agora a predecessora é guardada por ID da tarefa (ver _predParse/_predFormat/
  // _predTextoParaCanon/_predCanonParaTexto acima) — o vínculo nunca quebra com
  // reordenação, então remapear não é mais necessário. Mantidas como no-ops
  // seguros só pra não precisar tocar em todo call-site espalhado pelo arquivo.
  function _capturarNumAntes(){return new Map();}
  async function _remapAposMudancaPosicoes(){/* obsoleto — predecessora agora é por ID */}
  async function _remapearPredecessoras(){/* obsoleto — predecessora agora é por ID */}

  // Move a tarefa selecionada (se houver exatamente 1) uma posição acima ou abaixo
  async function _moverSel(dir){
    if(!selecionados.size){Utils.toast('Selecione pelo menos 1 tarefa para mover.','alerta');return;}
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const ordemAntesMover=new Map(sorted.map(t=>[t.id,t.ordem||0]));
    const ids=new Set(selecionados);

    // Índices selecionados na ordem atual
    const selIdxs=sorted.map((t,i)=>ids.has(t.id)?i:-1).filter(i=>i>=0);
    if(!selIdxs.length)return;

    if(dir===-1){
      // Mover para cima: processar do primeiro para o último
      // Cada linha selecionada troca com a linha imediatamente acima (se não selecionada)
      for(const idx of selIdxs){
        const alvo=idx-1;
        if(alvo<0)break; // chegou no topo, para
        if(ids.has(sorted[alvo].id))continue; // linha acima também selecionada, pula
        const tmp=sorted[alvo].ordem;
        sorted[alvo].ordem=sorted[idx].ordem;
        sorted[idx].ordem=tmp;
        // Troca fisicamente no array para manter posições relativas consistentes
        [sorted[alvo],sorted[idx]]=[sorted[idx],sorted[alvo]];
      }
    } else {
      // Mover para baixo: processar do último para o primeiro
      for(let k=selIdxs.length-1;k>=0;k--){
        const idx=selIdxs[k];
        const alvo=idx+1;
        if(alvo>=sorted.length)break; // chegou no fim, para
        if(ids.has(sorted[alvo].id))continue; // linha abaixo também selecionada, pula
        const tmp=sorted[alvo].ordem;
        sorted[alvo].ordem=sorted[idx].ordem;
        sorted[idx].ordem=tmp;
        [sorted[alvo],sorted[idx]]=[sorted[idx],sorted[alvo]];
      }
    }

    // Normaliza ordens sequenciais (1, 2, 3...)
    sorted.forEach((t,i)=>{t.ordem=i+1;});

    const numAntes2=new Map(tarefas.map(t=>[t.id,t._numLinha||0]));
    tarefas=sorted;
    _buildFiltradas();_render();requestAnimationFrame(()=>_paintRows());

    const mudancasNum2=new Map();
    for(const t of tarefas){
      const antes=numAntes2.get(t.id)||0;
      const depois=t._numLinha||0;
      if(antes!==depois)mudancasNum2.set(t.id,{antes,depois});
    }
    await _remapearPredecessoras(mudancasNum2);

    // Salva só as que mudaram de ordem (antes salvava TODAS as tarefas da obra
    // a cada clique — desnecessário e arriscava a mesma sobrecarga de escrita
    // já vista em import/árvore)
    const mudaram=sorted.filter(t=>{
      const ant=ordemAntesMover.get(t.id);
      return ant===undefined||(t.ordem||0)!==ant;
    });
    const L=20,TIMEOUT_MS=15000;
    const comTimeout=p=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),TIMEOUT_MS))]);
    let falhasMover=0;
    for(let i=0;i<mudaram.length;i+=L){
      await Promise.all(mudaram.slice(i,i+L).map(t=>
        comTimeout(Database.atualizar(obraId,COL,t.id,{ordem:t.ordem})).catch(e=>{falhasMover++;console.error('Erro mover:',t.id,e);})
      ));
    }
    if(falhasMover)Utils.toast(`⚠ ${falhasMover} tarefa(s) não foram salvas — tente mover de novo.`,'alerta');
  }

  // ===================== BUSCA NO GANTT =====================
  function onBusca(texto){
    _buscaTexto=texto.trim();
    _buscaCursor=-1;
    if(!_buscaTexto){
      _buscaResultados=[];
      requestAnimationFrame(()=>_paintRows());
      _atualizarBuscaInfo();
      return;
    }
    const q=_buscaTexto.toLowerCase();
    // Busca em TODAS as tarefas, não só nas visíveis (filtradas já esconde filhos
    // de famílias recolhidas) — buscar algo escondido dentro de uma família
    // recolhida e não encontrar nada era o bug reportado (parecia "sumido").
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const achados=sorted.filter(t=>
      (t.nome||'').toLowerCase().includes(q)||
      (t.codigo||'').toLowerCase().includes(q)||
      (t.responsavel||'').toLowerCase().includes(q)||
      (t.local||'').toLowerCase().includes(q)||
      (t.grupo||'').toLowerCase().includes(q)||
      String(t._numLinha||'').includes(q)
    );
    let precisaRerender=false;
    if(achados.length){
      // Expande automaticamente todos os ancestrais de cada resultado, garantindo
      // que fiquem visíveis mesmo se estavam dentro de uma família recolhida.
      for(const t of achados){
        const idx=sorted.indexOf(t);
        let niv=t.nivel||0;
        for(let i=idx-1;i>=0&&niv>0;i--){
          const anc=sorted[i];
          if((anc.nivel||0)<niv){
            if(colsRecolhidas.has(anc.id)){colsRecolhidas.delete(anc.id);precisaRerender=true;}
            niv=anc.nivel||0;
          }
        }
      }
      if(precisaRerender)_buildFiltradas();
    }
    _buscaResultados=filtradas
      .map((t,i)=>({t,i}))
      .filter(({t})=>achados.includes(t));
    _atualizarBuscaInfo();
    if(_buscaResultados.length){
      _buscaCursor=0;
      if(precisaRerender){
        // Precisa recriar o DOM (famílias foram expandidas) — preserva o foco
        // e a posição do cursor no campo de busca, senão perde o que já digitou.
        const inp=document.getElementById('gantt-busca');
        const cursorPos=inp?inp.selectionStart:null;
        _render();
        requestAnimationFrame(()=>{
          const inp2=document.getElementById('gantt-busca');
          if(inp2){inp2.focus();if(cursorPos!=null)inp2.setSelectionRange(cursorPos,cursorPos);}
          _pularParaResultado(0);
        });
      } else {
        _pularParaResultado(0);
      }
    } else {
      requestAnimationFrame(()=>_paintRows());
    }
  }

  function _atualizarBuscaInfo(){
    // Atualiza só o span de contagem, sem recriar o input
    const info=document.getElementById('gantt-busca-info');
    if(!info)return;
    if(_buscaTexto&&_buscaResultados.length){
      info.textContent=`${_buscaCursor>=0?(_buscaCursor+1)+'/':''}${_buscaResultados.length} resultado${_buscaResultados.length!==1?'s':''}`;
      info.style.display='';
    } else if(_buscaTexto&&!_buscaResultados.length){
      info.textContent='Nenhum resultado';
      info.style.display='';
    } else {
      info.style.display='none';
    }
    const btn=document.getElementById('gantt-busca-clear');
    if(btn)btn.style.display=_buscaTexto?'':'none';
  }

  function limparBusca(){
    _buscaTexto='';_buscaResultados=[];_buscaCursor=-1;
    const inp=document.getElementById('gantt-busca');
    if(inp){inp.value='';inp.focus();}
    _atualizarBuscaInfo();
    requestAnimationFrame(()=>_paintRows());
  }

  function _buscaKey(e){
    if(!_buscaResultados.length)return;
    if(e.key==='Enter'||e.key==='ArrowDown'){
      e.preventDefault();
      _buscaCursor=(_buscaCursor+1)%_buscaResultados.length;
      _pularParaResultado(_buscaCursor);
    } else if(e.key==='ArrowUp'){
      e.preventDefault();
      _buscaCursor=(_buscaCursor-1+_buscaResultados.length)%_buscaResultados.length;
      _pularParaResultado(_buscaCursor);
    } else if(e.key==='Escape'){
      limparBusca();
    }
  }

  function _pularParaResultado(cursor){
    const res=_buscaResultados[cursor];if(!res)return;
    selectedIdx=res.i;
    const esqS=document.getElementById('g-esq-s');
    if(esqS){
      const y=res.i*ROW_H;
      const visH=esqS.clientHeight;
      if(y<esqS.scrollTop||y+ROW_H>esqS.scrollTop+visH){
        esqS.scrollTop=Math.max(0,y-visH/2+ROW_H/2);
        const dirS=document.getElementById('g-dir-s');
        if(dirS)dirS.scrollTop=esqS.scrollTop;
      }
    }
    _atualizarBuscaInfo();
    // Só repinta as linhas — NÃO chama _render() para não destruir o input
    requestAnimationFrame(()=>_paintRows());
  }

  // ===================================================================
  // EDITOR DE ESTRUTURA (Árvore Hierárquica)
  // ===================================================================
  const _esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // - Ver a árvore completa de famílias colapsáveis
  // - Criar novas tarefas num clique dentro de qualquer família
  // - Arrastar para mover uma tarefa (e seus filhos) para outro pai
  // - Mudar o pai via seletor ("Mover para...")
  // - Renomear inline
  // Tudo preservando: duração, %, predecessoras (remapeadas), vínculos
  // ===================================================================
  let _arvAbertos=new Set();    // nós expandidos
  let _arvDragId=null;          // id da tarefa sendo arrastada
  let _arvDragSel=null;         // Set de ids sendo arrastados juntos (seleção múltipla), ou null = só _arvDragId
  let _arvDropId=null;          // id do alvo de drop
  let _arvDropPos='inside';     // 'before'|'inside'|'after'
  let _arvEditId=null;          // id em edição inline de nome
  let _arvMoverModalId=null;    // id da tarefa no modal "Mover para"
  let _arvSel=new Set();        // seleção múltipla: clique=1, Shift+clique=intervalo, Ctrl/Cmd+clique=alterna
  let _arvSelAnchor=null;       // âncora do Shift+clique

  function toggleArvoreEditor(){
    if(modoView!=='arvore'&&!Permissions.pode('planejamento','editar:estrutura')){Utils.toast('Sem permissão para editar a estrutura.','erro');return;}
    modoView=modoView==='arvore'?'gantt':'arvore';
    if(modoView==='arvore'){
      // Expandir raiz por padrão
      const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
      sorted.filter(t=>(t.nivel||0)===0).forEach(t=>_arvAbertos.add(t.id));
    }
    _render();
  }

  function _arvFilhos(pai,sorted){
    const pn=pai.nivel||0;
    const pi=sorted.findIndex(t=>t.id===pai.id);
    const filhos=[];
    for(let i=pi+1;i<sorted.length;i++){
      const t=sorted[i];
      if((t.nivel||0)<=pn)break;
      if((t.nivel||0)===pn+1)filhos.push(t);
    }
    return filhos;
  }

  function _arvTemFilhos(t,sorted){return _arvFilhos(t,sorted).length>0;}

  function _renderArvoreEditor(){
    const c=_el();
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const raizes=sorted.filter(t=>(t.nivel||0)===0);

    const renderNo=(t,sorted)=>{
      const filhos=_arvFilhos(t,sorted);
      const temF=filhos.length>0;
      const aberto=_arvAbertos.has(t.id);
      const nv=t.nivel||0;
      const cor=['#F5C800','#60a5fa','#4ade80','#f472b6','#fb923c','#a78bfa','#2dd4bf'][nv%7];

      let html=`<div data-arvid="${t.id}" style="position:relative;">`;

      // Linha do nó — indicadores de drag aplicados via DOM em _arvDragOver
      html+=`<div draggable="true"
        data-arvrow="1"
        onclick="Planejamento._arvRowClick(event,'${t.id}')"
        ondragstart="Planejamento._arvDragStart(event,'${t.id}')"
        ondragover="Planejamento._arvDragOver(event,'${t.id}')"
        ondrop="Planejamento._arvDrop(event,'${t.id}')"
        ondragend="Planejamento._arvDragEnd()"
        style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:6px;cursor:grab;
          background:${_arvSel.has(t.id)?'rgba(245,200,0,.14)':'rgba(255,255,255,.02)'};border:1px solid ${_arvSel.has(t.id)?'var(--cor-primaria)':'transparent'};
          margin:1px 0;user-select:none;"
        onmouseenter="if(!Planejamento._arvSelTem('${t.id}'))this.style.background='rgba(255,255,255,.06)'"
        onmouseleave="if(!Planejamento._arvSelTem('${t.id}'))this.style.background='rgba(255,255,255,.02)'">

        <!-- Indentação -->
        <span style="display:inline-block;width:${nv*18}px;flex-shrink:0;"></span>

        <!-- Toggle expand -->
        <span style="width:18px;flex-shrink:0;text-align:center;cursor:pointer;font-size:.75rem;color:#666;"
          onclick="event.stopPropagation();Planejamento._arvToggle('${t.id}')">
          ${temF?(aberto?'▼':'▶'):'·'}
        </span>

        <!-- Badge de nível -->
        <span style="background:${cor};color:#000;font-weight:800;font-size:.6rem;padding:1px 5px;border-radius:3px;flex-shrink:0;">${nv}</span>

        <!-- Nome (clique duplo para editar inline) -->
        ${_arvEditId===t.id
          ? `<input id="arv-edit-input" type="text" value="${_esc(t.nome||'')}"
              style="flex:1;background:#1a1a1a;border:1px solid var(--cor-primaria);color:#fff;border-radius:4px;padding:2px 6px;font-size:.82rem;"
              onblur="Planejamento._arvSalvarNome('${t.id}',this.value)"
              onkeydown="if(event.key==='Enter')this.blur();if(event.key==='Escape'){Planejamento._arvCancelarEdit();}">`
          : `<span style="flex:1;font-size:.82rem;font-weight:${nv===0?700:nv===1?600:400};
              color:${nv===0?'var(--cor-primaria)':nv===1?'#ddd':'#bbb'};
              overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
              ondblclick="event.stopPropagation();Planejamento._arvIniciarEdit('${t.id}')"
              title="Clique duplo para renomear">${_esc(t.nome||'(sem nome)')}</span>`}

        <!-- Info rápida -->
        <span style="font-size:.68rem;color:#555;flex-shrink:0;font-family:var(--font-mono);">${t.codigo||''}</span>
        ${t.duracao?`<span style="font-size:.65rem;color:#444;flex-shrink:0;">${t.duracao}d</span>`:''}
        ${(t.percentualConcluido||0)>0?`<span style="font-size:.65rem;color:${(t.percentualConcluido||0)>=100?'#4ade80':'#60a5fa'};flex-shrink:0;">${t.percentualConcluido||0}%</span>`:''}

        <!-- Ações -->
        <div style="display:flex;gap:3px;flex-shrink:0;margin-left:4px;" onclick="event.stopPropagation()">
          <button title="Inserir acima (irmão, mesmo nível)" onclick="Planejamento._arvInserirAcima('${t.id}')"
            style="background:#1a2a1a;color:#86efac;border:1px solid #2a4a2a;border-radius:4px;cursor:pointer;font-size:.65rem;padding:1px 5px;line-height:1.4;" >↑＋</button>
          <button title="Inserir abaixo (irmão, mesmo nível)" onclick="Planejamento._arvInserirAbaixo('${t.id}')"
            style="background:#1a2a1a;color:#86efac;border:1px solid #2a4a2a;border-radius:4px;cursor:pointer;font-size:.65rem;padding:1px 5px;line-height:1.4;">↓＋</button>
          <button title="Criar filho (nível abaixo)" onclick="Planejamento._arvCriarFilho('${t.id}')"
            style="background:#1a3a1a;color:#4ade80;border:1px solid #2a5a2a;border-radius:4px;cursor:pointer;font-size:.65rem;padding:1px 5px;line-height:1.4;">＋▸</button>
          <button title="Mover para outro pai" onclick="Planejamento._arvAbrirMover('${t.id}')"
            style="background:#1a2a3a;color:#60a5fa;border:1px solid #2a4a6a;border-radius:4px;cursor:pointer;font-size:.65rem;padding:1px 5px;line-height:1.4;">↗</button>
          <!-- Nível editável inline: clica no número e digita o nível desejado -->
          <span style="display:flex;align-items:center;gap:2px;background:#1a1a2a;border:1px solid #333;border-radius:4px;padding:0 4px;">
            <span style="font-size:.58rem;color:#666;">nv</span>
            <input type="number" min="0" max="10" value="${nv}"
              style="width:28px;background:transparent;border:none;color:#aaa;font-size:.72rem;font-weight:700;text-align:center;padding:0;"
              onclick="event.stopPropagation()"
              onchange="event.stopPropagation();Planejamento._arvMudarNivel('${t.id}',parseInt(this.value))"
              onkeydown="event.stopPropagation();if(event.key==='Enter')this.blur()"
              title="Nível hierárquico — edite diretamente">
          </span>
          <button title="Excluir" onclick="Planejamento.excluirTarefa('${t.id}')"
            style="background:#3a1a1a;color:#f87171;border:1px solid #5a2a2a;border-radius:4px;cursor:pointer;font-size:.65rem;padding:1px 5px;line-height:1.4;">✕</button>
        </div>
      </div>`;

      // Filhos (se expandido)
      if(temF&&aberto){
        html+=`<div style="border-left:1px solid #222;margin-left:${nv*18+9}px;padding-left:0;">`;
        filhos.forEach(f=>{html+=renderNo(f,sorted);});
        html+=`</div>`;
      }

      html+=`</div>`;
      return html;
    };

    c.style.cssText='display:flex;flex-direction:column;min-height:0;height:100%;';
    c.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
        <div style="display:flex;gap:8px;align-items:center;">
          <h2 style="margin:0;font-size:1.1rem;color:var(--cor-primaria);">🌳 Editor de Estrutura</h2>
          <span style="font-size:.75rem;color:#555;">${tarefas.length} tarefas</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="btn btn-secundario btn-sm" onclick="Planejamento._arvExpandirTudo(true)" style="font-size:.72rem;">▼ Expandir tudo</button>
          <button class="btn btn-secundario btn-sm" onclick="Planejamento._arvExpandirTudo(false)" style="font-size:.72rem;">▶ Recolher tudo</button>
          <button class="btn btn-secundario btn-sm" onclick="Planejamento._arvCriarRaiz()" style="font-size:.72rem;">＋ Nova raiz</button>
          <button class="btn btn-secundario btn-sm" onclick="Planejamento._arvBackupEstrutura()" style="font-size:.72rem;" title="Salva um arquivo com nome/nível/ordem/código/predecessora de cada tarefa — pra restaurar se algo der errado">💾 Backup</button>
          <button class="btn btn-primario btn-sm" onclick="Planejamento._arvSalvarTudo()" style="font-size:.72rem;" title="Regrava a ordem/nível de TODAS as tarefas no Firestore, garantindo que o Planejamento fique igual ao que está aqui na tela">💾 Salvar e Atualizar Planejamento</button>
          <label class="btn btn-secundario btn-sm" style="cursor:pointer;font-size:.72rem;" title="Restaura um backup salvo anteriormente">📤 Restaurar<input type="file" accept=".json" style="display:none" onchange="Planejamento._arvRestaurarEstrutura(event)"></label>
          <button class="btn btn-primario btn-sm" onclick="Planejamento.toggleArvoreEditor()" style="font-size:.72rem;">← Voltar ao Gantt</button>
        </div>
      </div>
      <div style="font-size:.7rem;color:#555;margin-bottom:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <span>Arraste para reorganizar · Clique duplo no nome para renomear · ＋ cria filho · ↗ muda o pai · ← sobe um nível · Clique+Shift seleciona intervalo, Clique+Ctrl seleciona avulsas — depois arraste juntas</span>
        ${_arvSel.size>1?`<span style="background:var(--cor-primaria);color:#000;font-weight:700;padding:2px 8px;border-radius:100px;">${_arvSel.size} selecionadas <span style="cursor:pointer;text-decoration:underline;" onclick="Planejamento._arvLimparSel()">limpar</span></span>`:''}
      </div>
      <div id="arv-corpo" style="flex:1;overflow-y:auto;overflow-x:hidden;"
        ondragover="Planejamento._arvDragOver(event,null)"
        ondrop="Planejamento._arvDrop(event,null)">
        ${raizes.length
          ? raizes.map(t=>renderNo(t,sorted)).join('')
          : '<div style="text-align:center;color:#555;padding:40px;font-size:.9rem;">Nenhuma tarefa. Clique em "＋ Nova raiz" para começar.</div>'}
      </div>

      <!-- Modal: Mover para -->
      <div id="arv-mover-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:500;align-items:center;justify-content:center;">
        <div style="background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:20px;width:420px;max-width:95vw;max-height:80vh;display:flex;flex-direction:column;gap:10px;">
          <div style="font-weight:700;color:var(--cor-primaria);">↗ Mover para...</div>
          <div style="font-size:.78rem;color:#888;" id="arv-mover-desc"></div>
          <input type="text" id="arv-mover-busca" placeholder="🔍 Buscar tarefa pai..." autocomplete="off"
            oninput="Planejamento._arvFiltrarMover(this.value)"
            style="padding:7px 9px;border:1px solid #333;border-radius:7px;font-size:.82rem;background:#111;color:#ddd;">
          <div id="arv-mover-lista" style="flex:1;overflow-y:auto;max-height:320px;border:1px solid #222;border-radius:7px;"></div>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button class="btn btn-secundario btn-sm" onclick="Planejamento._arvFecharMover()">Cancelar</button>
          </div>
        </div>
      </div>`;

    // Focar o input de edição se houver
    if(_arvEditId){
      requestAnimationFrame(()=>{
        const inp=document.getElementById('arv-edit-input');
        if(inp){inp.focus();inp.select();}
      });
    }
  }

  // Insere irmão imediatamente ACIMA da tarefa (mesmo nível, mesma família)
  async function _arvInserirAcima(refId){
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const refIdx=sorted.findIndex(t=>t.id===refId);
    if(refIdx<0)return;
    const ref=sorted[refIdx];
    const nv=ref.nivel||0;
    const ordemAnterior=refIdx>0?sorted[refIdx-1].ordem||refIdx-1:0;
    const novaOrdem=ordemAnterior+(ref.ordem-ordemAnterior)/2;
    const nova={nome:'Nova Tarefa',nivel:nv,ordem:novaOrdem,tipo:'tarefa',
      duracao:'',percentualEsperado:0,percentualConcluido:0,codigo:'',predecessora:'',responsavel:'',local:'',grupo:''};
    const corpoIns1=document.getElementById('arv-corpo');
    const stIns1=corpoIns1?corpoIns1.scrollTop:0;
    try{
      const numAntes=_capturarNumAntes();
      const id=await Database.criar(obraId,COL,nova);
      nova.id=id;tarefas.push(nova);
      // NÃO renormalizar ordem de todas as tarefas aqui — a ordem fracionária
      // já posiciona a nova tarefa corretamente entre as vizinhas. Renormalizar
      // localmente sem persistir no Firestore (como era antes) deixava as
      // outras tarefas com 'ordem' desatualizada lá, causando desalinhamento
      // no reload seguinte. Use "🔧 Corrigir Ordens" se quiser números limpos.
      _buildFiltradas();_arvEditId=id;_render(); // já mostra a linha nova na hora, sem tela de carregando
      requestAnimationFrame(()=>{const c=document.getElementById('arv-corpo');if(c)c.scrollTop=stIns1;});
      _remapAposMudancaPosicoes(numAntes); // roda em segundo plano — não trava a tela pra 2000 tarefas
    }catch(e){console.error(e);Utils.toast('Erro.','erro');}
  }
  // Insere irmão imediatamente ABAIXO da tarefa (depois do bloco de filhos)
  async function _arvInserirAbaixo(refId){
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const refIdx=sorted.findIndex(t=>t.id===refId);
    if(refIdx<0)return;
    const ref=sorted[refIdx];
    const nv=ref.nivel||0;
    // Pular filhos: encontrar o fim do bloco
    let fimBloco=refIdx+1;
    while(fimBloco<sorted.length&&(sorted[fimBloco].nivel||0)>nv)fimBloco++;
    const ordemAnterior=sorted[fimBloco-1].ordem||fimBloco-1;
    const ordemProxima=fimBloco<sorted.length?sorted[fimBloco].ordem||fimBloco+1:ordemAnterior+2;
    const novaOrdem=ordemAnterior+(ordemProxima-ordemAnterior)/2;
    const nova={nome:'Nova Tarefa',nivel:nv,ordem:novaOrdem,tipo:'tarefa',
      duracao:'',percentualEsperado:0,percentualConcluido:0,codigo:'',predecessora:'',responsavel:'',local:'',grupo:''};
    const corpoIns2=document.getElementById('arv-corpo');
    const stIns2=corpoIns2?corpoIns2.scrollTop:0;
    try{
      const numAntes=_capturarNumAntes();
      const id=await Database.criar(obraId,COL,nova);
      nova.id=id;tarefas.push(nova);
      // Idem _arvInserirAcima: sem renormalização local não-persistida.
      _buildFiltradas();_arvEditId=id;_render();
      requestAnimationFrame(()=>{const c=document.getElementById('arv-corpo');if(c)c.scrollTop=stIns2;});
      _remapAposMudancaPosicoes(numAntes); // segundo plano
    }catch(e){console.error(e);Utils.toast('Erro.','erro');}
  }

  // Muda o nível de uma tarefa diretamente para o valor digitado
  // Não move filhos — apenas altera o nível desta tarefa
  async function _arvMudarNivel(id,novoNivel){
    if(isNaN(novoNivel)||novoNivel<0||novoNivel>10)return;
    const t=tarefas.find(x=>x.id===id);
    if(!t||(t.nivel||0)===novoNivel)return;
    _undoPush();
    t.nivel=novoNivel;
    _buildFiltradas();_render();
    Database.atualizar(obraId,COL,id,{nivel:novoNivel}).catch(console.error);
  }
  function _arvToggle(id){
    if(_arvAbertos.has(id))_arvAbertos.delete(id);else _arvAbertos.add(id);
    const corpo=document.getElementById('arv-corpo');
    const st=corpo?corpo.scrollTop:0;
    _render();
    requestAnimationFrame(()=>{const c=document.getElementById('arv-corpo');if(c)c.scrollTop=st;});
  }
  function _arvExpandirTudo(abrir){
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    if(abrir)sorted.forEach(t=>{if(_arvTemFilhos(t,sorted))_arvAbertos.add(t.id);});
    else _arvAbertos.clear();
    _render();
  }

  // ---- Edição inline de nome ----
  function _arvIniciarEdit(id){_arvEditId=id;_render();}
  function _arvCancelarEdit(){_arvEditId=null;_render();}
  async function _arvSalvarNome(id,nome){
    _arvEditId=null;
    const t=tarefas.find(x=>x.id===id);
    const corpo=document.getElementById('arv-corpo');
    const st=corpo?corpo.scrollTop:0;
    if(!t||nome.trim()===t.nome){_render();requestAnimationFrame(()=>{const c=document.getElementById('arv-corpo');if(c)c.scrollTop=st;});return;}
    _undoPush();
    t.nome=nome.trim();
    _buildFiltradas();_render();
    requestAnimationFrame(()=>{const c=document.getElementById('arv-corpo');if(c)c.scrollTop=st;});
    await Database.atualizar(obraId,COL,id,{nome:t.nome}).catch(console.error);
  }

  // ---- Criar filho ----
  async function _arvCriarFilho(paiId){
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const pai=sorted.find(t=>t.id===paiId);if(!pai)return;
    // Inserir depois do último descendente do pai
    let fimBloco=sorted.findIndex(t=>t.id===paiId)+1;
    while(fimBloco<sorted.length&&(sorted[fimBloco].nivel||0)>(pai.nivel||0))fimBloco++;
    const ordemAnterior=fimBloco>0?sorted[fimBloco-1].ordem||fimBloco-1:pai.ordem||0;
    const ordemAntes=fimBloco<sorted.length?sorted[fimBloco].ordem||fimBloco:ordemAnterior+2;
    const novaOrdem=ordemAnterior+(ordemAntes-ordemAnterior)/2;
    const novaTarefa={nome:'Nova Tarefa',nivel:(pai.nivel||0)+1,ordem:novaOrdem,duracao:'',percentualEsperado:0,percentualConcluido:0,codigo:'',predecessora:'',responsavel:'',local:'',grupo:'',tipo:'tarefa'};
    const corpoCF=document.getElementById('arv-corpo');
    const stCF=corpoCF?corpoCF.scrollTop:0;
    try{
      const numAntes=_capturarNumAntes();
      const id=await Database.criar(obraId,COL,novaTarefa);
      novaTarefa.id=id;
      tarefas.push(novaTarefa);
      _arvAbertos.add(paiId); // expande o pai
      // Sem renormalização local não-persistida — ver nota em _arvInserirAcima.
      _buildFiltradas();_render();
      _remapAposMudancaPosicoes(numAntes); // segundo plano
      // Inicia edição do nome imediatamente
      _arvEditId=id;_render();
      requestAnimationFrame(()=>{const c=document.getElementById('arv-corpo');if(c)c.scrollTop=stCF;});
      Utils.toast('Tarefa criada!','sucesso');
    }catch(e){console.error(e);Utils.toast('Erro ao criar.','erro');}
  }

  async function _arvCriarRaiz(){
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const ultimaOrdem=sorted.length?sorted[sorted.length-1].ordem||sorted.length:0;
    const novaTarefa={nome:'Novo Grupo',nivel:0,ordem:ultimaOrdem+1,duracao:'',percentualEsperado:0,percentualConcluido:0,codigo:'',predecessora:'',responsavel:'',local:'',grupo:'',tipo:'grupo'};
    try{
      const id=await Database.criar(obraId,COL,novaTarefa);
      novaTarefa.id=id;
      tarefas.push(novaTarefa);
      _buildFiltradas();
      _arvEditId=id;_render();
      Utils.toast('Grupo raiz criado!','sucesso');
    }catch(e){console.error(e);Utils.toast('Erro ao criar.','erro');}
  }

  // ---- Backup/Restaurar estrutura (nome, nível, ordem, código, predecessora) ----
  // Salva um snapshot LOCAL (arquivo .json baixado no computador, não fica em
  // lugar nenhum do sistema) que pode ser restaurado depois se uma reorganização
  // der errado. Casa por ID do Firestore — só funciona se as tarefas não forem
  // excluídas/recriadas entre o backup e a restauração (mudar nível/ordem/nome
  // não afeta, só excluir e recriar quebra o casamento por ID).
  // Força regravar ordem/nível de TODAS as tarefas no Firestore, do jeito que
  // está na tela agora, e recarrega — um "tenho certeza que salvou" manual,
  // sem depender do salvamento automático em segundo plano (que já falhou
  // silenciosamente outras vezes nesta obra).
  async function _arvSalvarTudo(){
    if(!confirm(`Isso vai regravar ordem e nível de todas as ${tarefas.length} tarefas no Firestore, garantindo que o Planejamento fique exatamente igual ao que está aqui na árvore. Pode demorar um pouco. Confirmar?`))return;
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    Utils.mostrarLoading('Salvando tudo...');
    const L=20,TIMEOUT_MS=15000;
    const comTimeout=p=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),TIMEOUT_MS))]);
    let falhas=0,ok=0;
    for(let i=0;i<sorted.length;i+=L){
      Utils.mostrarLoading(`Salvando... ${Math.min(i+L,sorted.length)}/${sorted.length}`);
      await Promise.all(sorted.slice(i,i+L).map(t=>
        comTimeout(Database.atualizar(obraId,COL,t.id,{ordem:t.ordem||0,nivel:t.nivel||0})).then(()=>ok++).catch(e=>{falhas++;console.error('Erro salvar tudo:',t.id,e);})
      ));
    }
    Utils.esconderLoading();
    if(falhas){Utils.toast(`⚠ ${ok} salvas, ${falhas} falharam — clique de novo pra tentar as que faltaram.`,'alerta');}
    else{Utils.toast(`✅ ${ok} tarefas salvas. Recarregando o Planejamento...`,'sucesso');await carregar();}
  }

  function _arvBackupEstrutura(){
    const dados=tarefas.map(t=>({id:t.id,nome:t.nome,nivel:t.nivel||0,ordem:t.ordem||0,codigo:t.codigo||'',predecessora:t.predecessora||''}));
    const payload={obraId,data:new Date().toISOString(),tarefas:dados};
    const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`backup-estrutura-${(obra?.nome||'obra').replace(/[^a-z0-9]/gi,'_')}-${new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')}.json`;
    document.body.appendChild(a);a.click();a.remove();
    URL.revokeObjectURL(url);
    Utils.toast(`💾 Backup salvo (${dados.length} tarefas).`,'sucesso');
  }

  async function _arvRestaurarEstrutura(event){
    const file=event.target.files[0];if(!file)return;event.target.value='';
    try{
      const texto=await file.text();
      const payload=JSON.parse(texto);
      if(!payload?.tarefas?.length){Utils.toast('Arquivo de backup inválido.','erro');return;}
      if(payload.obraId&&payload.obraId!==obraId){
        if(!confirm('Este backup foi salvo de OUTRA obra. Restaurar mesmo assim?'))return;
      }
      const porId=new Map(tarefas.map(t=>[t.id,t]));
      const mudou=[];
      let naoEncontradas=0;
      for(const bkp of payload.tarefas){
        const t=porId.get(bkp.id);
        if(!t){naoEncontradas++;continue;}
        const upd={};
        if((t.nivel||0)!==(bkp.nivel||0))upd.nivel=bkp.nivel||0;
        if((t.ordem||0)!==(bkp.ordem||0))upd.ordem=bkp.ordem||0;
        if((t.codigo||'')!==(bkp.codigo||''))upd.codigo=bkp.codigo||'';
        if((t.predecessora||'')!==(bkp.predecessora||''))upd.predecessora=bkp.predecessora||'';
        if(Object.keys(upd).length){Object.assign(t,upd);mudou.push({id:t.id,...upd});}
      }
      if(!mudou.length){Utils.toast(naoEncontradas?`Nada pra restaurar. ${naoEncontradas} tarefa(s) do backup não existem mais (foram excluídas/recriadas).`:'Estrutura já bate com o backup.','sucesso');return;}
      if(!confirm(`Restaurar vai alterar nível/ordem/código/predecessora de ${mudou.length} tarefa(s) pro estado salvo em ${payload.data?new Date(payload.data).toLocaleString('pt-BR'):'backup'}.${naoEncontradas?` (${naoEncontradas} tarefa(s) do backup não existem mais e serão ignoradas.)`:''} Confirmar?`))return;
      Utils.mostrarLoading('Restaurando...');
      const L=20,TIMEOUT_MS=15000;
      const comTimeout=p=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),TIMEOUT_MS))]);
      let falhas=0;
      for(let i=0;i<mudou.length;i+=L){
        Utils.mostrarLoading(`Restaurando... ${Math.min(i+L,mudou.length)}/${mudou.length}`);
        await Promise.all(mudou.slice(i,i+L).map(({id,...upd})=>
          comTimeout(Database.atualizar(obraId,COL,id,upd)).catch(e=>{falhas++;console.error('Erro restaurar:',id,e);})
        ));
      }
      Utils.esconderLoading();
      _buildFiltradas();_render();
      Utils.toast(falhas?`⚠ ${mudou.length-falhas} restauradas, ${falhas} falharam.`:`✅ Estrutura restaurada (${mudou.length} tarefa(s)).`,falhas?'alerta':'sucesso');
    }catch(e){console.error(e);Utils.toast('Erro ao ler o backup: '+e.message,'erro');}
    finally{Utils.esconderLoading();}
  }

  // ---- Drag & Drop ----
  function _arvDragStart(e,id){
    _arvDragId=id;
    // Se o item arrastado faz parte de uma seleção múltipla, arrasta o conjunto todo junto
    _arvDragSel=(_arvSel.has(id)&&_arvSel.size>1)?new Set(_arvSel):null;
    e.dataTransfer.effectAllowed='move';
    e.dataTransfer.setData('text/plain',id);
    // Não chama _render() — reconstruir o DOM cancela o drag nativo do HTML5
    // Marca o(s) elemento(s) visualmente via DOM direto
    requestAnimationFrame(()=>{
      const ids=_arvDragSel?[..._arvDragSel]:[id];
      ids.forEach(i=>{
        const el=document.querySelector(`[data-arvid="${i}"] [data-arvrow]`);
        if(el)el.style.opacity='.35';
      });
    });
  }
  // Seleção de linhas: clique=só esta; Shift+clique=intervalo (pela ordem atual);
  // Ctrl/Cmd+clique=alterna esta na seleção sem mexer nas outras.
  function _arvRowClick(e,id){
    if(e.shiftKey&&_arvSelAnchor){
      const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
      const ids=sorted.map(t=>t.id);
      const i1=ids.indexOf(_arvSelAnchor),i2=ids.indexOf(id);
      if(i1>=0&&i2>=0){
        const [lo,hi]=i1<i2?[i1,i2]:[i2,i1];
        _arvSel=new Set(ids.slice(lo,hi+1));
      }
    } else if(e.ctrlKey||e.metaKey){
      if(_arvSel.has(id))_arvSel.delete(id);else _arvSel.add(id);
      _arvSelAnchor=id;
    } else {
      _arvSel=(_arvSel.size===1&&_arvSel.has(id))?new Set():new Set([id]);
      _arvSelAnchor=id;
    }
    const corpo=document.getElementById('arv-corpo');
    const st=corpo?corpo.scrollTop:0;
    _render();
    requestAnimationFrame(()=>{const c=document.getElementById('arv-corpo');if(c)c.scrollTop=st;});
  }
  function _arvSelTem(id){return _arvSel.has(id);}
  function _arvLimparSel(){_arvSel=new Set();_arvSelAnchor=null;_render();}
  function _arvDragOver(e,targetId){
    e.preventDefault();
    e.stopPropagation(); // impede o container (#arv-corpo) de interceptar
    e.dataTransfer.dropEffect='move';
    if(!_arvDragId||_arvDragId===targetId)return;

    // Zona de drop: 40% topo = before, 20% meio = inside (filho), 40% base = after
    // Virar filho por engano era o problema mais reclamado — reduzida a zona de
    // "inside" ao mínimo central; reordenar como irmã (antes/depois) domina a
    // linha inteira. Pra aninhar de propósito, use "＋▸ Criar filho" ou "↗ Mover para".
    const rect=e.currentTarget?.getBoundingClientRect();
    let pos='inside';
    if(rect){
      const relY=(e.clientY-rect.top)/rect.height;
      if(relY<0.40)pos='before';
      else if(relY>0.60)pos='after';
    }
    if(_arvDropId===targetId&&_arvDropPos===pos)return;

    // Remove indicadores anteriores sem recriar o DOM inteiro
    document.querySelectorAll('[data-arvid]').forEach(el=>{
      el.style.borderTop='';el.style.borderBottom='';
      const row=el.querySelector('[data-arvrow]');
      if(row){row.style.background='';row.style.border='1px solid transparent';}
    });

    _arvDropId=targetId;_arvDropPos=pos;

    if(targetId){
      const el=document.querySelector(`[data-arvid="${targetId}"]`);
      if(el){
        if(pos==='before')el.style.borderTop='2px solid var(--cor-primaria)';
        else if(pos==='after')el.style.borderBottom='2px solid var(--cor-primaria)';
        else {
          const row=el.querySelector('[data-arvrow]');
          if(row){row.style.background='rgba(245,200,0,.15)';row.style.border='1px dashed var(--cor-primaria)';}
        }
      }
    }
  }
  function _arvDragEnd(){
    _arvDragId=null;_arvDragSel=null;_arvDropId=null;_arvDropPos='inside';
    // Limpa todos os indicadores visuais e restaura opacidade
    document.querySelectorAll('[data-arvid]').forEach(el=>{
      el.style.borderTop='';el.style.borderBottom='';
      const row=el.querySelector('[data-arvrow]');
      if(row){row.style.opacity='1';row.style.background='';row.style.border='1px solid transparent';}
    });
  }

  async function _arvDrop(e,targetId){
    e.preventDefault();
    e.stopPropagation();
    if(!Permissions.pode('planejamento','editar:estrutura'))return;
    const dragId=_arvDragId, dragSel=_arvDragSel, dropId=_arvDropId, dropPos=_arvDropPos;
    _arvDragId=null;_arvDragSel=null;_arvDropId=null;_arvDropPos='inside';
    if(!dragId||dragId===dropId){_render();return;}
    const corpo=document.getElementById('arv-corpo');
    const st=corpo?corpo.scrollTop:0;
    await _arvMoverMultiplas(dragSel||new Set([dragId]),dropId,dropPos);
    requestAnimationFrame(()=>{const c=document.getElementById('arv-corpo');if(c)c.scrollTop=st;});
  }

  // Move 1+ tarefas (cada uma + seus filhos contíguos) para um novo pai/posição.
  // dragIds pode ser um único id (Set ou array com 1 item) ou uma seleção múltipla —
  // nesse caso cada item de nível mais alto (que não seja filho de outro selecionado)
  // vira um bloco próprio, e todos os blocos são movidos juntos, na mesma ordem visual,
  // para o mesmo destino. pos='inside' → filho do target; 'before'/'after' → irmão do target.
  let _arvSaveQueue=Promise.resolve(); // serializa saves — evita concorrência

  async function _arvMoverTarefa(dragId,targetId,pos){
    return _arvMoverMultiplas(new Set([dragId]),targetId,pos);
  }

  async function _arvMoverMultiplas(dragIds,targetId,pos){
    const idsSet=dragIds instanceof Set?dragIds:new Set(dragIds);
    idsSet.delete(null);idsSet.delete(undefined);
    if(!idsSet.size)return;

    // Soltar em qualquer espaço vazio da árvore (fora de uma linha) cai aqui
    // com targetId=null → "mover para raiz". Isso zera o nível do(s) galho(s)
    // inteiro(s) e é fácil de disparar sem querer arrastando perto da borda
    // de uma linha. Por ser destrutivo e difícil de notar na hora, exige
    // confirmação — mover para raiz de propósito continua disponível pelo
    // botão ↗ "Mover para".
    if(!targetId){
      const nomes=[...idsSet].map(id=>tarefas.find(x=>x.id===id)?.nome||'tarefa').slice(0,3).join(', ');
      const extra=idsSet.size>3?` e mais ${idsSet.size-3}`:'';
      if(!confirm(`Mover ${idsSet.size>1?`${idsSet.size} tarefas (${nomes}${extra})`:`"${nomes}"`} (e filhos) para a RAIZ da árvore, nível 0? Isso costuma ser acidental — solte exatamente sobre outra linha se a intenção era reordenar.`))return;
    }
    if(idsSet.has(targetId)){Utils.toast('Não é possível soltar dentro do próprio grupo selecionado.','alerta');return;}

    let sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));

    // Captura estado ANTES de qualquer modificação
    const ordemAntes=new Map(sorted.map(t=>[t.id,{ordem:t.ordem||0,nivel:t.nivel||0}]));
    const numAntes=new Map(tarefas.map(t=>[t.id,t._numLinha||0]));

    const idxOf=new Map(sorted.map((t,i)=>[t.id,i]));
    const blocoRange=idx=>{
      const niv=sorted[idx].nivel||0;
      let fim=idx+1;
      while(fim<sorted.length&&(sorted[fim].nivel||0)>niv)fim++;
      return [idx,fim];
    };
    const selIdxs=[...idsSet].map(id=>idxOf.get(id)).filter(i=>i!=null).sort((a,b)=>a-b);
    if(!selIdxs.length)return;
    const ranges=selIdxs.map(i=>[i,blocoRange(i)]);
    // Só os "de nível mais alto" viram bloco próprio — os que já estão contidos
    // no bloco de outro selecionado (ex: selecionou pai e filho junto) são
    // ignorados aqui, pois já vão junto dentro do bloco do pai.
    const topRanges=ranges.filter(([i])=>!ranges.some(([j,[s,e]])=>j!==i&&i>s&&i<e)).map(([,r])=>r);
    // Extrai do array (de trás pra frente, pra não bagunçar os índices dos que faltam)
    const extraidosDesc=[...topRanges].sort((a,b)=>b[0]-a[0]);
    const blocos=[]; // vai ficar na ordem visual original após os unshifts
    for(const [s,e] of extraidosDesc) blocos.unshift(sorted.splice(s,e-s));

    if(!targetId){
      for(const bloco of blocos){
        const dif=-(bloco[0].nivel||0);
        bloco.forEach(t=>{t.nivel=Math.max(0,(t.nivel||0)+dif);});
      }
      blocos.forEach(bloco=>sorted.push(...bloco));
    } else {
      const targetIdx=sorted.findIndex(t=>t.id===targetId);
      if(targetIdx<0){ // alvo sumiu (era um dos extraídos por engano) — desfaz a extração
        let ins=selIdxs[0];
        blocos.forEach(bloco=>{sorted.splice(ins,0,...bloco);ins+=bloco.length;});
        tarefas=sorted;_buildFiltradas();_render();return;
      }
      const targetNivel=sorted[targetIdx].nivel||0;
      let insertAt;
      if(pos==='inside'){
        for(const bloco of blocos){
          const dif=(targetNivel+1)-(bloco[0].nivel||0);
          bloco.forEach(t=>{t.nivel=Math.max(0,(t.nivel||0)+dif);});
        }
        insertAt=targetIdx+1;
        _arvAbertos.add(targetId);
      } else {
        for(const bloco of blocos){
          const dif=targetNivel-(bloco[0].nivel||0);
          bloco.forEach(t=>{t.nivel=Math.max(0,(t.nivel||0)+dif);});
        }
        if(pos==='before'){
          insertAt=targetIdx;
        } else {
          // 'after': pula o bloco INTEIRO do alvo (ele + os próprios filhos contíguos).
          // Inserir logo após a linha do alvo (targetIdx+1) entra NO MEIO do alvo com
          // os filhos dele — quebra a contiguidade nivel>own que define quem são os
          // filhos de quem, e os filhos verdadeiros do alvo passam a "pertencer" à
          // tarefa recém-inserida por engano (mesmo sintoma relatado: item logo acima
          // perde a setinha de expandir e vira um pontinho).
          let fimBlocoAlvo=targetIdx+1;
          while(fimBlocoAlvo<sorted.length&&(sorted[fimBlocoAlvo].nivel||0)>targetNivel)fimBlocoAlvo++;
          insertAt=fimBlocoAlvo;
        }
      }
      blocos.forEach(bloco=>{sorted.splice(insertAt,0,...bloco);insertAt+=bloco.length;});
    }

    _undoPush(); // snapshot ANTES de sobrescrever tarefas[]
    sorted.forEach((t,i)=>{t.ordem=i+1;});
    tarefas=sorted;
    _arvSel=new Set();_arvSelAnchor=null; // limpa seleção após mover
    _buildFiltradas();_render();

    const changed=sorted.filter(t=>{
      const ant=ordemAntes.get(t.id);
      return !ant||(t.ordem||0)!==ant.ordem||(t.nivel||0)!==ant.nivel;
    });

    const mudancasNum=new Map();
    for(const t of tarefas){
      const antes=numAntes.get(t.id)||0;
      const depois=t._numLinha||0;
      if(antes!==depois)mudancasNum.set(t.id,{antes,depois});
    }

    // Serializa saves — não permite concorrência entre movimentos rápidos
    _arvSaveQueue=_arvSaveQueue.then(async()=>{
      try{
        if(mudancasNum.size)await _remapearPredecessoras(mudancasNum);
        const LOTE=20,TIMEOUT_MS=15000;
        const comTimeout=p=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),TIMEOUT_MS))]);
        let falhas=0;
        for(let i=0;i<changed.length;i+=LOTE){
          await Promise.all(changed.slice(i,i+LOTE).map(t=>
            comTimeout(Database.atualizar(obraId,COL,t.id,{ordem:t.ordem,nivel:t.nivel})).catch(e=>{falhas++;console.error('Erro ao salvar tarefa na arvore:',t.id,t.nome,e);})
          ));
        }
        // Antes essa falha era só console.error — o usuário via a árvore "certa" na
        // tela (mudança local otimista) mas nada ia pro Firestore, e um reload
        // trazia de volta o estado antigo, parecendo que a ação "desfez sozinha".
        if(falhas)Utils.toast(`⚠ ${falhas} tarefa(s) não foram salvas (erro de conexão) — a árvore pode voltar ao estado anterior se você recarregar a página. Tente mover de novo.`,'alerta');
        // Mover tarefa entre níveis muda quem é filho de quem — o % dos pais
        // (média ponderada dos filhos diretos) precisa ser recalculado, senão
        // fica desatualizado depois de qualquer reorganização na árvore.
        await _recalcularPercTodosPais(true);
      }catch(e){console.error('Erro save arvore:',e);Utils.toast('⚠ Erro ao salvar a árvore — tente de novo.','alerta');}
    });
  }

  // ---- Modal "Mover para" (mudar pai via seletor) ----
  function _arvAbrirMover(id){
    _arvMoverModalId=id;
    const t=tarefas.find(x=>x.id===id);
    const modal=document.getElementById('arv-mover-modal');
    if(!modal)return;
    modal.style.display='flex';
    const desc=document.getElementById('arv-mover-desc');
    if(desc)desc.textContent=`Tarefa: "${t?.nome||''}" → selecione o novo pai (ou raiz)`;
    const busca=document.getElementById('arv-mover-busca');
    if(busca){busca.value='';busca.focus();}
    _arvFiltrarMover('');
  }
  function _arvFecharMover(){
    _arvMoverModalId=null;
    const modal=document.getElementById('arv-mover-modal');
    if(modal)modal.style.display='none';
  }
  function _arvFiltrarMover(q){
    const lista=document.getElementById('arv-mover-lista');if(!lista)return;
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const norm=s=>(s||'').toLowerCase();
    const opts=sorted.filter(t=>t.id!==_arvMoverModalId&&(
      !q||norm(t.nome).includes(norm(q))||norm(t.codigo).includes(norm(q))
    ));
    lista.innerHTML=`
      <div style="padding:8px;border-bottom:1px solid #222;cursor:pointer;font-size:.8rem;color:#facc15;"
        onclick="Planejamento._arvConfirmarMover(null)">
        📁 Raiz (nível 0, sem pai)
      </div>
      ${opts.map(t=>`
        <div style="padding:7px 10px 7px ${(t.nivel||0)*14+10}px;border-bottom:1px solid #1a1a1a;cursor:pointer;font-size:.8rem;color:#ccc;"
          onclick="Planejamento._arvConfirmarMover('${t.id}')"
          onmouseenter="this.style.background='rgba(255,255,255,.06)'"
          onmouseleave="this.style.background=''">
          ${'–'.repeat(t.nivel||0)} ${_esc(t.nome||'')}
          <span style="color:#555;font-size:.72rem;margin-left:6px;">${t.codigo||''}</span>
        </div>`).join('')}`;
  }
  async function _arvConfirmarMover(novoPaiId){
    const id=_arvMoverModalId;
    _arvFecharMover();
    if(!id)return;
    if(novoPaiId===null){
      // Mover para raiz: sem pai, nível 0
      await _arvMoverTarefa(id,null,null);
    } else {
      await _arvMoverTarefa(id,novoPaiId,'inside');
    }
  }

  async function copiarDatasDeAtual(){
    const v=_versaoData;
    if(v==='atual')return;
    const campos=VERSAO_CAMPOS[v];
    // Só copia tarefas que NÃO têm valor na versão de destino
    const semDatas=tarefas.filter(t=>!t[campos.ini]&&!t[campos.fim]&&(t.inicioPlanejado||t.terminoPlanejado));
    if(!semDatas.length){Utils.toast('Todas as tarefas já têm datas na versão '+VERSAO_LABEL[v]+'.','alerta');return;}
    if(!confirm(`Copiar datas de Atual para ${VERSAO_LABEL[v]} em ${semDatas.length} tarefa(s) que ainda não têm valor? Tarefas que já têm datas em ${VERSAO_LABEL[v]} não serão afetadas.`))return;
    Utils.mostrarLoading(`Copiando datas para ${VERSAO_LABEL[v]}...`);
    try{
      const LOTE=50;
      for(let i=0;i<semDatas.length;i+=LOTE){
        await Promise.all(semDatas.slice(i,i+LOTE).map(t=>{
          const upd={[campos.ini]:t.inicioPlanejado||'',[campos.fim]:t.terminoPlanejado||''};
          t[campos.ini]=upd[campos.ini];t[campos.fim]=upd[campos.fim];
          return Database.atualizar(obraId,COL,t.id,upd).catch(console.error);
        }));
      }
      _buildFiltradas();_render();
      Utils.toast(`${semDatas.length} tarefas atualizadas em ${VERSAO_LABEL[v]}.`,'sucesso');
    }catch(e){console.error(e);Utils.toast('Erro ao copiar datas.','erro');}
    finally{Utils.esconderLoading();}
  }

  return{init,carregar,setZoom,setVersaoData,copiarDatasDeAtual,inserirTarefa,editarTarefa,salvarTarefa,excluirTarefa,
    selectIdx,toggleRecolher,recuarNivel,avancarNivel,
    toggleGantt,toggleLiberarEdicaoReal,hideCol,showColsMenu,_showCol,_showAll,_toggleMenuFerramentas,
    _abrirEstruturaObra,_addTorre,_addPavimento,_addApartamento,_duplicarPavimento,_editarNomeEst,_removerNoEst,
    _abrirAutoVincular,_aplicarAutoVincular,_abrirGerarGrupos,_aplicarGerarGrupos,_gerarGruposToggle,_gerarGruposEditarValor,
    _abrirVinculoPavimento,_salvarVinculoPavimento,_vinclocTogglePav,_vinclocToggleApto,
    _abrirAtualizarPredecessora,_predlogAtualizarBotao,_salvarAtualizacaoPredecessora,_abrirHistoricoAlteracoes,_filtrarHistorico,
    toggleArvoreEditor,_arvToggle,_arvExpandirTudo,_arvIniciarEdit,_arvCancelarEdit,_arvSalvarNome,
    _arvInserirAcima,_arvInserirAbaixo,_arvMudarNivel,
    _arvCriarFilho,_arvCriarRaiz,_arvBackupEstrutura,_arvRestaurarEstrutura,_arvSalvarTudo,_arvDragStart,_arvDragOver,_arvDragEnd,_arvDrop,
    _arvRowClick,_arvSelTem,_arvLimparSel,_arvMoverMultiplas,
    _arvAbrirMover,_arvFecharMover,_arvFiltrarMover,_arvConfirmarMover,
    _colResizeStart,moveColLeft,moveColRight,_hideCol,_divStart,_sync,_editCell,_esqDragStart,
    _rowDragStart,toggleSel,_limparSelecao,_moverSel,_bulkNivel,_bulkDuplicar,_bulkExcluir,
    toggleStatusFiltro,_aplicarStatusFiltro,_abrirFiltroResponsavel,_aplicarFiltroResponsavel,_limparFiltroResponsavel,
    _abrirVisaoOrg,_menuVisaoOrg,_visaoOrgFiltrarLista,_visaoOrgToggleBloco,_visaoOrgAplicar,_visaoOrgLimpar,toggleSetasPred,_setaClicada,undo,
    toggleCategoriaView,_catToggle,_subcatToggle,_catExpandirTudo,
    onBusca,limparBusca,_buscaKey,
    importarExcel,importarBaseCompleta,importarCorrecoes,_executarCorrecoes,_mostrarRevisaoCorrecoes,exportar,exportarFrentes,exportarExcelBonito,exportarMSProject,abrirImpressao,baixarPDF,exportarPNG,corrigirOrdensDuplicadas,_corrigirNiveisSoltos,_corrigirNivelPeloCodigo,_migrarPredecessorasParaId,_recalcularDatasPais,_recalcularPercTodosPais,_orfasMarcarTodas,_orfasExcluirMarcadas,_gerarPNG,_predPopup,_predSalvar,_predCellClick,_predAddLinha,_predLinhaAtualizar,autoClassificarFrentes,
    abrirVinculosView,fecharVinculosView,abrirVincularTarefa,abrirVincularAqui,onVincTipoChange,
    onVincNavModulo,onVincNavModuloMetrica,onVincNavMetrica,onVincNavEntrar,onVincNavBreadcrumb,onVincNavVoltar,
    onBuscaEscolhaAlvoVinc,onEscolherAlvoVinc,onTrocarAlvoVinc,
    onToggleIncluirVinc,onFatorVincChange,marcarTodosVinc,dividirIrmaosVinc,
    salvarVinculoLevantamento,removerVinculoLevantamento,recalcularVinculosLevantamento,
    abrirVinculoEstacas,_estVincSetTipo,salvarVinculoEstacas,removerVinculoEstacas};
})();
function onObraChanged(){Planejamento.init();}
