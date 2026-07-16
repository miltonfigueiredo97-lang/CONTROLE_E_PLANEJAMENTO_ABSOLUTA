// ============================================
// Planejamento V2.0
// Todas as features solicitadas implementadas
// ============================================
const Planejamento = (() => {
  let obraId=null, tarefas=[], filtradas=[];
  let zoomGantt='mes', editandoId=null, selectedIdx=-1;
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
  // Busca de tarefa no Gantt
  let _buscaTexto='', _buscaResultados=[], _buscaCursor=-1;
  // Undo stack: últimas 30 snapshots do array tarefas (cópia plana antes de cada ação)
  const _undoStack=[];
  function _undoPush(){
    _undoStack.push(tarefas.map(t=>({...t})));
    if(_undoStack.length>30)_undoStack.shift();
  }
  async function undo(){
    if(!_undoStack.length){Utils.toast('Nada para desfazer.','alerta');return;}
    const snap=_undoStack.pop();
    tarefas=snap;
    _buildFiltradas();_render();requestAnimationFrame(()=>_paintRows());
    Utils.toast('Ação desfeita.','sucesso');
    for(const t of snap){
      await Database.atualizar(obraId,COL,t.id,{
        nome:t.nome,codigo:t.codigo,nivel:t.nivel,ordem:t.ordem,
        inicioPlanejado:t.inicioPlanejado,terminoPlanejado:t.terminoPlanejado,
        duracao:t.duracao,percentualEsperado:t.percentualEsperado,
        percentualConcluido:t.percentualConcluido,predecessora:t.predecessora,
        responsavel:t.responsavel,local:t.local,grupo:t.grupo,
      }).catch(()=>{});
    }
  }

  // Colunas: ordem editável, largura editável
  let colOrdem=['sel','num','status','nivel','codigo','nome','inicio','termino','duracao','percEsp','percConc','predecessora','responsavel','local','grupo','quantidade','custoMaterial','custoMaoObra','acoes'];
  let colLarguras={sel:28,num:36,status:34,nivel:42,codigo:70,nome:250,inicio:88,termino:88,duracao:60,percEsp:72,percConc:78,predecessora:80,responsavel:100,local:80,grupo:80,quantidade:110,custoMaterial:100,custoMaoObra:100,acoes:64};
  let colsHidden=new Set();

  const COL_LABELS={sel:'',num:'#',status:'',nivel:'Nível',codigo:'Código',nome:'Tarefa',inicio:'Início',termino:'Término',duracao:'Duração',percEsp:'% Esperado',percConc:'% Concluído',predecessora:'Predecessora',responsavel:'Responsável',local:'Local',grupo:'Grupo',quantidade:'Quantidade',custoMaterial:'Custo Material',custoMaoObra:'Custo M.Obra',acoes:''};
  const COL_FIXED=new Set(['sel','num','status','nome','acoes']);
  const COL_EDITABLE=new Set(['codigo','nome','inicio','termino','duracao','percEsp','percConc','predecessora','responsavel','local','grupo','nivel']);

  // ===================== VÍNCULOS COM LEVANTAMENTO =====================
  // Tela separada (não é a visão de Gantt) onde cada tarefa do Planejamento
  // pode ter sua quantidade vinda de um Levantamento (em vez de manual) —
  // assim, várias tarefas (ex: chapisco, reboco, limpeza de fachada) usam
  // o MESMO m² real, e o custo (Material/Mão de Obra) que já lê a
  // quantidade da tarefa funciona automaticamente, sem precisar vincular
  // Materiais/Mão de Obra direto ao levantamento.
  let modoView='gantt'; // 'gantt' | 'vinculos'
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
  // Seleção granular da árvore do levantamento (Fachada → Balancim → Vista) que
  // serve de fonte pro valor — vazio/null = nível inteiro (ex: sem balancim
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
      label:'Fachada', colecao:'levantamentosFachada',
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
      label:'Piso / Contrapiso / Impermeabilização', colecao:'pisoAreas',
      configDoc:'pisoArvore',
      metricas:[
        {id:'areaM2',         label:'Área total de piso (m²)', unidade:'m²'},
        {id:'areaContrapiso', label:'Contrapiso (m²)',         unidade:'m²'},
        {id:'areaImperm',     label:'Impermeabilização (m²)',  unidade:'m²'},
        {id:'mlRodape',       label:'Rodapé (ML)',             unidade:'ml'},
      ],
    },
    paredes:{
      label:'Paredes (Alvenaria / Acabamento)', colecao:'paredesAlvenariaPecas',
      colecaoExtra:'paredesAcabamentoPecas',
      configDoc:'paredesArvore',
      metricas:[
        {id:'areaLiquida',    label:'Área líquida total (m²)',   unidade:'m²'},
        {id:'m2comPuro',      label:'m² com ML equiv.',          unidade:'m²'},
        {id:'ml',             label:'Metro Linear (ML)',         unidade:'ml'},
        {id:'vedacao',        label:'Alvenaria de Vedação (m²)', unidade:'m²'},
        {id:'estrutural',     label:'Alvenaria Estrutural (m²)', unidade:'m²'},
        {id:'pintura',        label:'Pintura de parede (m²)',    unidade:'m²'},
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
        {id:'areaPintura',    label:'Pintura de teto (m²)',      unidade:'m²'},
      ],
    },
    concreto:{
      label:'Concreto', colecao:'concretoPecas',
      metricas:[
        {id:'volume',         label:'Volume total (m³)', unidade:'m³'},
      ],
    },
    arCondicionado:{
      label:'Ar-Condicionado', colecao:'levantamentoAr',
      metricas:[
        {id:'qtdEquipamentos',label:'Qtd de equipamentos', unidade:'un'},
        {id:'btus',           label:'BTUs total',          unidade:'BTU'},
      ],
    },
    pintura:{
      label:'Pintura (em desenvolvimento)', colecao:'pinturaAreas',
      metricas:[
        {id:'areaM2',         label:'Área de pintura (m²)', unidade:'m²'},
        {id:'demao1',         label:'1ª demão (m²)',        unidade:'m²'},
        {id:'demao2',         label:'2ª demão (m²)',        unidade:'m²'},
        {id:'demao3',         label:'3ª demão (m²)',        unidade:'m²'},
      ],
    },
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
    await carregar();
  }
  function _el(){return document.getElementById('planejamento-content')||document.body;}

  async function carregar(){
    try{
      Utils.mostrarLoading('Carregando...');
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

  function _buildFiltradas(){
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    // numLinha é FIXO pela posição na ordem geral (não muda com filtro/recolhimento)
    // É esse número que é exibido na coluna # e usado nas predecessoras
    sorted.forEach((t,i)=>{t._numLinha=i+1;});
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
    filtradas=result;
  }

  // ===================== RENDER =====================
  function _render(){
    if(modoView==='vinculos'){_renderVinculosView();return;}
    const c=_el();
    const visCols=colOrdem.filter(id=>!colsHidden.has(id));

    c.style.cssText='display:flex;flex-direction:column;min-height:0;height:100%;';
    c.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
        <div style="display:flex;gap:6px;align-items:center;">
          <h2 style="margin:0;font-size:1.1rem;color:var(--cor-primaria);">📊 Planejamento</h2>
          <span style="font-size:.75rem;color:#555;">${filtradas.length} tarefas</span>
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;">
          ${['dia','semana','mes','trimestre','ano'].map(z=>`<button class="btn btn-sm ${zoomGantt===z?'btn-primario':'btn-secundario'}" onclick="Planejamento.setZoom('${z}')" style="font-size:.7rem;padding:2px 8px;">${z.charAt(0).toUpperCase()+z.slice(1)}</button>`).join('')}
          <span style="color:#333;margin:0 4px;">|</span>
          <label class="btn btn-secundario btn-sm" style="cursor:pointer;font-size:.72rem;">📥 Importar<input type="file" accept=".xlsx,.xls" style="display:none" onchange="Planejamento.importarExcel(event)"></label>
          <button class="btn btn-secundario btn-sm" onclick="Planejamento.exportar()" style="font-size:.72rem;">📤 Exportar</button>
          <button class="btn btn-secundario btn-sm" onclick="Planejamento.exportarPNG()" style="font-size:.72rem;">🖼 PNG</button>
          <button class="btn btn-secundario btn-sm" onclick="Planejamento.toggleGantt()" id="btn-tg" style="font-size:.72rem;">${ganttVisible?'◀ Esconder Gantt':'▶ Mostrar Gantt'}</button>
          ${colsHidden.size?`<button class="btn btn-secundario btn-sm" onclick="Planejamento.showColsMenu()" style="font-size:.72rem;">＋ Colunas (${colsHidden.size})</button>`:''}
          <span style="color:#333;margin:0 4px;">|</span>
          <button class="btn btn-secundario btn-sm" onclick="Planejamento.abrirVinculosView()" style="font-size:.72rem;">🔗 Vínculos com Levantamento</button>
          <button class="btn btn-primario btn-sm" onclick="Planejamento.inserirTarefa()" style="font-size:.72rem;">＋ Tarefa</button>
        </div>
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
    modoView='vinculos';_vincNavModulo=null;_vincNavMetrica=null;_vincNavPath=[];_vincTipo='geral';_render();
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
      const [dados,extra,cfg]=await Promise.all([
        Database.listar(obraId,mod.colecao,null).catch(()=>[]),
        mod.colecaoExtra?Database.listar(obraId,mod.colecaoExtra,null).catch(()=>[]):Promise.resolve([]),
        mod.configDoc?Database.obter(obraId,'config',mod.configDoc).catch(()=>null):Promise.resolve(null),
      ]);
      // arvore: array plano de nós com filhos recursivos, ou [] se não existir
      const arvore=cfg?.arvore||[];
      // Para fachada: também carrega a cfg do Firestore (evita usar localStorage)
      let cfgDoc=null;
      if(modulo==='fachada'){
        try{const cs=await db.collection('obras').doc(obraId).collection('config').doc('fachadaCfg').get();cfgDoc=cs.exists?cs.data():null;}catch(e){}
      }
      _levCache[modulo]={dados,extra,arvore,cfg:cfgDoc};
    }catch(e){
      console.error('Erro ao carregar levantamento',modulo,e);
      Utils.toast(`Erro ao carregar dados de ${LEVANTAMENTO_MODULOS[modulo]?.label||modulo}. Verifique sua conexão.`,'erro');
    }
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
    if(mod.configDoc){
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
      if(metrica==='areaPintura')     return areas.filter(a=>a.temPintura===true||a.temPintura==='true').reduce((s,a)=>s+(Number(a.areaM2)||0),0);
      return 0;
    }

    if(modulo==='paredes'){
      // Paredes salva campos BRUTOS (comprimento/altura em cm, vaos[], tipoAlvenaria).
      // areaLiquida/ml NÃO são gravados — recalculamos com _calcParedeBruta/_calcAcabBruta.
      let alv=dados,acab=extra;
      if(nodeId){const ids=_idsDescendentes(_levCache[modulo]?.arvore||[],nodeId);alv=alv.filter(p=>ids.includes(p.nodeId));acab=acab.filter(p=>ids.includes(p.nodeId));}
      const calcsAlv=alv.map(_calcParedeBruta);
      const calcsAcab=acab.map(_calcAcabBruta);
      const todas=[...calcsAlv,...calcsAcab];
      if(metrica==='areaLiquida')  return todas.reduce((s,c)=>s+c.areaLiquida,0);
      if(metrica==='ml')           return todas.reduce((s,c)=>s+c.ml,0);
      if(metrica==='m2comPuro')    return todas.filter(c=>!c.podeML).reduce((s,c)=>s+c.areaLiquida,0);
      if(metrica==='vedacao')      return calcsAlv.filter(c=>c.tipoAlvenaria==='vedacao').reduce((s,c)=>s+c.areaLiquida,0);
      if(metrica==='estrutural')   return calcsAlv.filter(c=>c.tipoAlvenaria==='estrutural').reduce((s,c)=>s+c.areaLiquida,0);
      if(metrica==='pintura')      return todas.reduce((s,c)=>s+c.pinturaM2,0);
      return 0;
    }


    if(modulo==='concreto'){
      if(metrica==='volume') return dados.reduce((s,p)=>s+(p.volume||0),0);
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
    if(mod?.configDoc){
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
    else if(_vincNavMetrica){_vincNavMetrica=null;}
    else if(_vincNavModulo){_vincNavModulo=null;}
    _renderVinculosView();
  }

  function _renderVinculosView(){
    const c=_el();
    c.style.cssText='display:flex;flex-direction:column;min-height:0;height:100%;overflow-y:auto;';

    const crumbs=[`<span class="vinc-crumb" onclick="Planejamento.onVincNavBreadcrumb(-2)">🔗 Vínculos</span>`];
    if(_vincNavModulo){
      const mod=LEVANTAMENTO_MODULOS[_vincNavModulo];
      crumbs.push(`<span class="vinc-crumb ${_vincNavMetrica?'':'atual'}" onclick="Planejamento.onVincNavBreadcrumb(-1)">${mod.label}</span>`);
    }
    if(_vincNavMetrica){
      const metricaLabel=LEVANTAMENTO_MODULOS[_vincNavModulo].metricas.find(m=>m.id===_vincNavMetrica)?.label||_vincNavMetrica;
      crumbs.push(`<span class="vinc-crumb ${_vincNavPath.length?'':'atual'}" onclick="Planejamento.onVincNavBreadcrumb(-1)">${metricaLabel}</span>`);
      _vincNavPath.forEach((p,i)=>{
        const ultimo=i===_vincNavPath.length-1;
        crumbs.push(`<span class="vinc-crumb ${ultimo?'atual':''}" onclick="${ultimo?'':`Planejamento.onVincNavBreadcrumb(${i})`}">${p.nome}</span>`);
      });
    }
    const breadcrumbHTML=`<div class="vinc-breadcrumb">${crumbs.join('<span class="vinc-sep">›</span>')}</div>`;

    let corpoHTML='';
    if(!_vincNavModulo){
      // Grade de módulos de levantamento — some sozinha se um módulo não tiver dados carregados
      corpoHTML=`<div class="vinc-grid">
        ${Object.entries(LEVANTAMENTO_MODULOS).map(([id,m])=>`
          <div class="vinc-card" onclick="Planejamento.onVincNavModulo('${id}')">
            <div class="vinc-card-titulo">${m.label}</div>
            <div class="vinc-card-sub">${m.metricas.length} métrica(s)</div>
          </div>`).join('')}
      </div>`;
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
        <div class="vinc-resumo">
          <div>
            <div class="vinc-resumo-valor">${_fQtd(valor)} ${unidade}</div>
            <div class="vinc-resumo-status ${existente?'tem-vinculo':''}">${existente?`🔗 já vinculado a ${_qtdTarefasNoGrupo(existente[_campo('levantamentoOrigemId',_vincTipo)]||existente.id,_vincTipo)} tarefa(s)`:'ainda sem vínculo'}</div>
          </div>
          <button class="btn ${existente?'btn-secundario':'btn-primario'} btn-sm" onclick="Planejamento.abrirVincularAqui()">${existente?'✎ Editar vínculo':'🔗 Vincular aqui'}</button>
        </div>
        ${filhos.length?`<div class="vinc-grid">
          ${filhos.map(f=>`<div class="vinc-card vinc-pasta" onclick="Planejamento.onVincNavEntrar('${f.id}','${f.nome.replace(/'/g,"\\'")}')">
            <span class="vinc-pasta-icone">📁</span>
            <span class="vinc-pasta-nome">${f.nome}</span>
            ${f.temFilhos?'<span class="vinc-pasta-seta">›</span>':''}
          </div>`).join('')}
        </div>`:(mod.configDoc?'<div class="vinc-vazio">Nenhum local mais específico aqui — este é o nível final.</div>':'')}
      `;
    }

    const tipoSeletorHTML=`<div class="plan-abas" style="width:fit-content;margin-bottom:16px;">
      <button class="plan-aba ${_vincTipo==='geral'?'ativo':''}" onclick="Planejamento.onVincTipoChange('geral')">Geral</button>
      <button class="plan-aba ${_vincTipo==='maoObra'?'ativo':''}" onclick="Planejamento.onVincTipoChange('maoObra')">Mão de Obra</button>
      <button class="plan-aba ${_vincTipo==='material'?'ativo':''}" onclick="Planejamento.onVincTipoChange('material')">Materiais</button>
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
    return {areaLiquida,ml,pinturaM2};
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
      if(metrica==='areaPintura')     return areas.filter(a=>a.temPintura===true||a.temPintura==='true').reduce((s,a)=>s+(Number(a.areaM2)||0),0);
      return 0;
    }

    if(modulo==='paredes'){
      // IMPORTANTE: campos brutos (comprimento/altura em cm, vaos[], tipoAlvenaria,
      // acabamentos[], pintura[]) — areaLiquida/ml/pintura NÃO são gravados.
      // Recalculamos localmente com _calcParedeBruta / _calcAcabBruta.
      const alv=filtrar(dados);
      const acab=filtrar(extra);
      const calcsAlv=alv.map(_calcParedeBruta);
      const calcsAcab=acab.map(_calcAcabBruta);
      const todas=[...calcsAlv,...calcsAcab];
      if(metrica==='areaLiquida')  return todas.reduce((s,c)=>s+c.areaLiquida,0);
      if(metrica==='ml')           return todas.reduce((s,c)=>s+c.ml,0);
      if(metrica==='m2comPuro')    return todas.filter(c=>!c.podeML).reduce((s,c)=>s+c.areaLiquida,0);
      if(metrica==='vedacao')      return calcsAlv.filter(c=>c.tipoAlvenaria==='vedacao').reduce((s,c)=>s+c.areaLiquida,0);
      if(metrica==='estrutural')   return calcsAlv.filter(c=>c.tipoAlvenaria==='estrutural').reduce((s,c)=>s+c.areaLiquida,0);
      if(metrica==='pintura')      return todas.reduce((s,c)=>s+c.pinturaM2,0);
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
    const datas=tf.flatMap(t=>[t.inicioPlanejado,t.terminoPlanejado].filter(Boolean).map(d=>new Date(d)));
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
    const datas=filtradas.flatMap(t=>[t.inicioPlanejado,t.terminoPlanejado].filter(Boolean).map(d=>new Date(d)));
    const dMin=datas.length?new Date(Math.min(...datas)):new Date(hoje.getTime()-30*864e5);
    dMin.setDate(dMin.getDate()-5);
    const lpd={dia:32,semana:8,mes:3,trimestre:1.2,ano:0.4}[zoomGantt]||3;

    let rH='', bH='';
    for(let i=s;i<e;i++){
      const t=filtradas[i], y=i*ROW_H;
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
          cells+=`<div style="${base}color:#666;font-size:.7rem;justify-content:center;cursor:pointer;" ${clickEdit}>${_fd(t.inicioPlanejado)}</div>`;
        } else if(cid==='termino'){
          cells+=`<div style="${base}color:#666;font-size:.7rem;justify-content:center;cursor:pointer;" ${clickEdit}>${_fd(t.terminoPlanejado)}</div>`;
        } else if(cid==='duracao'){
          cells+=`<div style="${base}color:#666;font-size:.7rem;justify-content:center;cursor:pointer;" ${clickEdit}>${t.duracao||'—'}</div>`;
        } else if(cid==='percEsp'){
          cells+=`<div style="${base}color:#555;font-size:.7rem;justify-content:center;cursor:pointer;" ${clickEdit}>${t.percentualEsperado||0}%</div>`;
        } else if(cid==='percConc'){
          cells+=`<div style="${base}font-size:.7rem;justify-content:center;color:${perc>=100?'#16a34a':perc>0?'#2563eb':'#555'};cursor:pointer;" ${clickEdit}>${perc}%</div>`;
        } else if(cid==='predecessora'){
          cells+=`<div style="${base}color:#555;font-size:.7rem;justify-content:center;cursor:pointer;" ${clickEdit}>${t.predecessora||'—'}</div>`;
        } else if(cid==='responsavel'){
          cells+=`<div style="${base}color:#555;font-size:.7rem;cursor:pointer;" ${clickEdit}>${t.responsavel||'—'}</div>`;
        } else if(cid==='local'){
          cells+=`<div style="${base}color:#555;font-size:.7rem;cursor:pointer;" ${clickEdit}>${t.local||'—'}</div>`;
        } else if(cid==='grupo'){
          cells+=`<div style="${base}color:#555;font-size:.7rem;cursor:pointer;" ${clickEdit}>${t.grupo||'—'}</div>`;
        } else if(cid==='quantidade'){
          const vinc=t.fonteQuantidade==='levantamento';
          cells+=`<div style="${base}color:${vinc?'var(--cor-primaria)':'#555'};font-size:.7rem;justify-content:flex-end;font-family:var(--font-mono);gap:3px;"
            title="${vinc?'Vinculado a '+(LEVANTAMENTO_MODULOS[t.levantamentoModulo]?.label||t.levantamentoModulo):'Manual'}">
            ${vinc?'🔗 ':''}${t.quantidade?_fQtd(t.quantidade)+' '+(t.unidade||''):'—'}</div>`;
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
      if(ganttVisible&&t.inicioPlanejado&&t.terminoPlanejado){
        const bx=Math.round((new Date(t.inicioPlanejado)-dMin)/864e5*lpd);
        const bw=Math.max(4,Math.round((new Date(t.terminoPlanejado)-new Date(t.inicioPlanejado))/864e5*lpd));
        const by=y+5, bh=20;
        const cor={em_dia:'#2563eb',em_andamento:'#ca8a04',concluido:'#15803d',alerta:'#c2410c',atrasado:'#dc2626'}[st2]||'#333';
        if(isG){
          bH+=`<div style="position:absolute;left:${bx}px;top:${by+8}px;width:${bw}px;height:5px;background:var(--cor-primaria);border-radius:1px;"></div>`;
        } else {
          bH+=`<div style="position:absolute;left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px;background:${cor};border-radius:3px;overflow:hidden;" title="${t.nome} ${perc}%">
            <div style="height:100%;width:${perc}%;background:rgba(255,255,255,.25);"></div>
            ${bw>50?`<span style="position:absolute;left:4px;top:4px;font-size:.58rem;color:rgba(255,255,255,.85);white-space:nowrap;overflow:hidden;max-width:${bw-8}px;">${t.nome}</span>`:''}
          </div>`;
        }
      }
      bH+=`<div style="position:absolute;left:0;top:${y}px;width:100%;height:${ROW_H}px;border-bottom:1px solid #1a1a1a;background:${sel?'rgba(245,200,0,.06)':''};pointer-events:none;"></div>`;
    }

    const ev=document.getElementById('g-esq-v');if(ev)ev.innerHTML=rH;
    if(ganttVisible){
      const dv=document.getElementById('g-dir-v');
      if(dv){
        const hojeEl=document.getElementById('gantt-hoje');
        const hojeHTML=hojeEl?hojeEl.outerHTML:'';
        dv.innerHTML=bH+hojeHTML;
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
    const datas=filtradas.flatMap(t=>[t.inicioPlanejado,t.terminoPlanejado].filter(Boolean).map(d=>new Date(d)));
    const dMin=datas.length?new Date(Math.min(...datas)):new Date(hoje.getTime()-30*864e5);
    dMin.setDate(dMin.getDate()-5);
    const lpd={dia:32,semana:8,mes:3,trimestre:1.2,ano:0.4}[zoomGantt]||3;
    let bH='';
    for(let i=s;i<e;i++){
      const t=filtradas[i], y=i*ROW_H;
      const perc=_perc(t), isG=t.tipo==='grupo', st2=_status(t);
      bH+=`<div style="position:absolute;left:0;top:${y}px;width:100%;height:${ROW_H}px;border-bottom:1px solid #1a1a1a;"></div>`;
      if(ganttVisible&&t.inicioPlanejado&&t.terminoPlanejado){
        const ini=new Date(t.inicioPlanejado),fim=new Date(t.terminoPlanejado);
        const bx=Math.round((ini-dMin)/864e5*lpd);
        const bw=Math.max(4,Math.round((fim-ini)/864e5*lpd));
        const by=y+5,bh=20;
        const cor={em_dia:'#2563eb',em_andamento:'#ca8a04',concluido:'#15803d',alerta:'#c2410c',atrasado:'#dc2626'}[st2]||'#333';
        if(isG){bH+=`<div style="position:absolute;left:${bx}px;top:${by+8}px;width:${bw}px;height:5px;background:var(--cor-primaria);border-radius:1px;"></div>`;}
        else{bH+=`<div style="position:absolute;left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px;background:${cor};border-radius:3px;overflow:hidden;"><div style="height:100%;width:${perc}%;background:rgba(255,255,255,.25);"></div></div>`;}
      }
    }
    const ev=document.getElementById('g-dir-v');if(ev)ev.innerHTML=bH;
  }

  function _editCell(e, idx, colId){
    e.stopPropagation();
    if(_esqDragMoved)return;
    const t=filtradas[idx]; if(!t)return;
    selectedIdx=idx;
    const cell=e.currentTarget;
    const map={codigo:'codigo',nome:'nome',inicio:'inicioPlanejado',termino:'terminoPlanejado',
      duracao:'duracao',percEsp:'percentualEsperado',percConc:'percentualConcluido',
      predecessora:'predecessora',responsavel:'responsavel',local:'local',grupo:'grupo',nivel:'nivel'};
    const field=map[colId]; if(!field)return;
    const val=t[field]||'';
    const isDate=colId==='inicio'||colId==='termino';
    const isNum=colId==='duracao'||colId==='percEsp'||colId==='percConc'||colId==='nivel';

    const input=document.createElement('input');
    input.type=isDate?'date':isNum?'number':'text';
    input.value=val;
    input.style.cssText='width:100%;height:100%;border:2px solid var(--cor-primaria);background:#1a1a1a;color:#fff;padding:0 4px;font-size:.78rem;font-family:inherit;outline:none;box-sizing:border-box;border-radius:3px;';
    if(isNum){input.min='0';if(colId==='percEsp'||colId==='percConc')input.max='100';}
    cell.innerHTML='';
    cell.appendChild(input);
    input.focus();
    if(!isDate)input.select();

    _editandoCelula=true; // bloqueia _paintRows de destruir o input
    let saved=false;
    const save=async()=>{
      if(saved)return; saved=true;
      _editandoCelula=false;
      let v=input.value.trim();
      if(isNum)v=parseFloat(v)||0;
      if(field==='duracao')v=parseInt(v)||0;
      
      // Lógica de datas automática
      const updates={[field]:v};
      if(field==='inicioPlanejado'&&v&&t.terminoPlanejado){
        // Início + Fim → calcula Duração
        updates.duracao=Math.max(0,Math.ceil((new Date(t.terminoPlanejado)-new Date(v))/864e5));
      } else if(field==='terminoPlanejado'&&v&&t.inicioPlanejado){
        // Fim + Início → calcula Duração
        updates.duracao=Math.max(0,Math.ceil((new Date(v)-new Date(t.inicioPlanejado))/864e5));
      } else if(field==='duracao'&&v>0&&t.inicioPlanejado){
        // Duração + Início → calcula Fim
        const fim=new Date(t.inicioPlanejado);fim.setDate(fim.getDate()+v);
        updates.terminoPlanejado=fim.toISOString().split('T')[0];
      } else if(field==='predecessora'&&v){
        // Predecessora: "3TI" = após tarefa com código 3 (TI = término-início)
        _calcPredecessora(t, v, updates);
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
      // Atualiza local
      Object.assign(t, updates);

      // ===== % EM FAMÍLIA (mão dupla) =====
      // Editou % de um PAI → distribui para todos os descendentes.
      // Editou % de uma FOLHA → recalcula os ancestrais (média ponderada
      // pela quantidade dos filhos; sem quantidade em todos, média simples).
      let famUps=[];
      if(field==='percentualConcluido'){
        const fam=Utils.percFamilia(tarefas);
        const ehPai=fam.filhosDiretos(t).length>0;
        if(ehPai){
          famUps=Utils.distribuirPercDescendentes(tarefas,t.id,v);
          // Depois de nivelar os descendentes, ancestrais do pai também mudam
          famUps=famUps.concat(Utils.recalcularPercAncestrais(tarefas,t.id));
          if(famUps.length)Utils.toast(`% aplicado a ${famUps.length} tarefa(s) da família.`,'sucesso');
        } else {
          famUps=Utils.recalcularPercAncestrais(tarefas,t.id);
        }
      }
      _paintRows();

      // Save in background
      try{
        await Database.atualizar(obraId,COL,t.id,updates);
        for(const u of famUps){
          await Database.atualizar(obraId,COL,u.id,{percentualConcluido:u.percentualConcluido});
        }
      }
      catch(er){console.error(er);Utils.toast('Erro ao salvar.','erro');}
    };
    
    input.addEventListener('blur',save);
    input.addEventListener('keydown',ev=>{
      if(ev.key==='Enter'){ev.preventDefault();input.blur();}
      if(ev.key==='Escape'){saved=true;_editandoCelula=false;_paintRows();}
    });
    // Para spinners de number: salva ao mudar valor
    if(isNum){
      input.addEventListener('change',()=>{input.blur();});
    }
  }
  
  // Calcula datas baseado na predecessora (tipo MS Project)
  function _calcPredecessora(t, predStr, updates){
    // Formato: "3TI" ou "1.2TI" ou "5" (default TI)
    // TI = Término-Início (mais comum)
    // II = Início-Início, TT = Término-Término, IT = Início-Término
    const match=predStr.match(/^([\d.]+)\s*(TI|II|TT|IT)?\s*([+-]?\d+)?$/i);
    if(!match)return;
    const codPred=match[1];
    const tipo=(match[2]||'TI').toUpperCase();
    const defasagem=parseInt(match[3])||0;
    
    // Busca pelo número de linha (coluna #) — igual ao MS Project
    // _numLinha é atribuído em _buildFiltradas() pela ordem real
    const numBusca=parseInt(codPred);
    const pred=isNaN(numBusca)
      ? tarefas.find(x=>x.codigo===codPred)    // fallback: busca por código
      : tarefas.find(x=>x._numLinha===numBusca);
    if(!pred)return;
    
    let dataRef;
    if(tipo==='TI') dataRef=pred.terminoPlanejado; // Após término da pred
    else if(tipo==='II') dataRef=pred.inicioPlanejado; // Junto com início da pred
    else if(tipo==='TT') dataRef=pred.terminoPlanejado; // Término junto com término da pred
    else if(tipo==='IT') dataRef=pred.inicioPlanejado; // Término junto com início da pred
    
    if(!dataRef)return;
    
    const dt=new Date(dataRef);
    dt.setDate(dt.getDate()+defasagem+(tipo==='TI'?1:0)); // TI: começa no dia seguinte
    
    if(tipo==='TI'||tipo==='II'){
      updates.inicioPlanejado=dt.toISOString().split('T')[0];
      // Se tem duração, calcula fim
      if(t.duracao){
        const fim=new Date(dt);fim.setDate(fim.getDate()+t.duracao);
        updates.terminoPlanejado=fim.toISOString().split('T')[0];
      }
    } else {
      updates.terminoPlanejado=dt.toISOString().split('T')[0];
      // Se tem duração, calcula início
      if(t.duracao){
        const ini=new Date(dt);ini.setDate(ini.getDate()-t.duracao);
        updates.inicioPlanejado=ini.toISOString().split('T')[0];
      }
    }
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
      <button class="btn btn-perigo btn-sm" onclick="Planejamento._bulkExcluir()" title="Excluir selecionadas">✕ Excluir</button>
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
    }catch(e){console.error(e);Utils.toast('Erro ao duplicar.','erro');}
    finally{Utils.esconderLoading();}
  }

  async function _bulkExcluir(){
    const ids=[...selecionados];
    if(!confirm(`Excluir ${ids.length} tarefa(s) selecionada(s)? Esta ação não pode ser desfeita.`))return;
    Utils.mostrarLoading('Excluindo...');
    try{
      await Promise.all(ids.map(id=>Database.deletar(obraId,COL,id).catch(console.error)));
      selecionados.clear();
      Utils.toast('Tarefas excluídas!','sucesso');
      await carregar();
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

    let insertAt=pos==='before'?targetIdxAtual:targetIdxAtual+1;
    sorted.splice(insertAt,0,...bloco);

    // Recalcula ordem sequencial e detecta o que mudou
    const updates=[];
    sorted.forEach((t,i)=>{
      const novaOrdem=i+1;
      if((t.ordem||0)!==novaOrdem){
        t.ordem=novaOrdem;
        updates.push({id:t.id,ordem:novaOrdem});
      }
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
      await Promise.all(updates.slice(i,i+LOTE).map(u=>
        Database.atualizar(obraId,COL,u.id,{ordem:u.ordem}).catch(e=>console.error('Erro reordenar:',u.id,e))
      ));
    }
  }

  // ===================== TOGGLE GANTT =====================
  function toggleGantt(){
    ganttVisible=!ganttVisible;
    _render(); // re-render completely since DOM structure changes
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

  async function recuarNivel(id){await _moverNivel(id,-1);}
  async function avancarNivel(id){await _moverNivel(id,1);}
  async function _moverNivel(id,diff){
    const t=tarefas.find(x=>x.id===id);
    if(!t){console.error('Tarefa não encontrada:',id);return;}
    if(diff<0&&(t.nivel||0)<=0){Utils.toast('Já está no nível mínimo.','alerta');return;}
    
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const idx=sorted.findIndex(x=>x.id===id);
    if(idx<0){console.error('Índice não encontrado');return;}
    
    // Coleta tarefa + filhos (tudo abaixo com nível maior)
    const updates=[{id:t.id,nivel:Math.max(0,(t.nivel||0)+diff)}];
    for(let i=idx+1;i<sorted.length;i++){
      if((sorted[i].nivel||0)>(t.nivel||0)){
        updates.push({id:sorted[i].id,nivel:Math.max(0,(sorted[i].nivel||0)+diff)});
      } else break;
    }
    
    console.log('Movendo nível:',diff,'para',updates.length,'tarefas');
    
    // Atualiza localmente PRIMEIRO (responsividade)
    updates.forEach(u=>{
      const tt=tarefas.find(x=>x.id===u.id);
      if(tt)tt.nivel=u.nivel;
    });
    _buildFiltradas();
    _render();
    requestAnimationFrame(()=>_paintRows());
    
    // Salva no Firestore em background (lotes de 20)
    const LOTE=20;
    for(let i=0;i<updates.length;i+=LOTE){
      const batch=updates.slice(i,i+LOTE);
      await Promise.all(batch.map(u=>
        Database.atualizar(obraId,COL,u.id,{nivel:u.nivel}).catch(e=>console.error('Erro update:',u.id,e))
      ));
    }
  }

  // ===================== CRUD =====================
  function selectIdx(i){if(_esqDragMoved)return;selectedIdx=i;_paintRows();}

  function inserirTarefa(){
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
      f.querySelector('[name="ordem"]').value=(sel.ordem||0)+1;
    } else {
      document.querySelector('#form-tarefa [name="ordem"]').value=tarefas.length+1;
    }
    Utils.abrirModal('modal-tarefa');
  }

  function editarTarefa(id){
    const t=tarefas.find(x=>x.id===id);if(!t)return;
    editandoId=id;
    document.getElementById('modal-tarefa-titulo').textContent='Editar Tarefa';
    const f=document.getElementById('form-tarefa');f.reset();
    ['codigo','nome','tipo','nivel','ordem','inicioPlanejado','terminoPlanejado','duracao',
      'percentualEsperado','percentualConcluido','predecessora','tarefaPai','grupo','local',
      'custo','receita','responsavel','inicioPlanejadoBase','terminoPlanejadoBase',
      'inicioDesafio','terminoDesafio','observacoes','quantidade','unidade'].forEach(k=>{
      const el=f.querySelector(`[name="${k}"]`);if(el&&t[k]!=null)el.value=t[k];
    });
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
    const f=document.getElementById('form-tarefa');
    const g=n=>f.querySelector(`[name="${n}"]`)?.value;
    const nome=g('nome')?.trim();if(!nome){Utils.toast('Nome obrigatório.','alerta');return;}
    const ini=g('inicioPlanejado'),ter=g('terminoPlanejado');
    let dur=parseInt(g('duracao'))||0;
    if(ini&&ter&&!dur)dur=Math.max(0,Math.ceil((new Date(ter)-new Date(ini))/864e5));
    const data={tipo:g('tipo')||'tarefa',codigo:g('codigo')||'',nome,nivel:parseInt(g('nivel'))||0,
      ordem:parseFloat(g('ordem'))||tarefas.length+1,inicioPlanejado:ini||'',terminoPlanejado:ter||'',duracao:dur,
      percentualEsperado:parseFloat(g('percentualEsperado'))||0,percentualConcluido:parseFloat(g('percentualConcluido'))||0,
      predecessora:g('predecessora')||'',tarefaPai:g('tarefaPai')||'',grupo:g('grupo')||'',local:g('local')||'',
      custo:parseFloat(g('custo'))||0,receita:parseFloat(g('receita'))||0,responsavel:g('responsavel')||'',
      quantidade:parseFloat(g('quantidade'))||0,unidade:g('unidade')||'',
      inicioPlanejadoBase:g('inicioPlanejadoBase')||'',terminoPlanejadoBase:g('terminoPlanejadoBase')||'',
      inicioDesafio:g('inicioDesafio')||'',terminoDesafio:g('terminoDesafio')||'',observacoes:g('observacoes')||'',obraId};
    try{
      if(editandoId){
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
    }catch(e){console.error(e);Utils.toast('Erro.','erro');}
  }

  async function excluirTarefa(id){
    const t=tarefas.find(x=>x.id===id);if(!confirm(`Excluir "${t?.nome}"?`))return;
    try{await Database.deletar(obraId,COL,id);Utils.toast('Excluído.','sucesso');selectedIdx=-1;await carregar();}
    catch(e){Utils.toast('Erro.','erro');}
  }

  // ===================== IMPORTAR =====================
  async function importarExcel(event){
    const file=event.target.files[0];if(!file)return;event.target.value='';
    if(!confirm(`Importar substituirá as ${tarefas.length} tarefas atuais. Confirmar?`))return;
    try{
      Utils.mostrarLoading('Lendo...');
      if(typeof XLSX==='undefined')await _ls('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
      const ab=await file.arrayBuffer();
      const wb=XLSX.read(ab,{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
      if(rows.length<2){Utils.toast('Planilha vazia.','alerta');return;}
      const hdrs=rows[0].map(h=>String(h||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' '));
      const ci=n=>{const a={id:['id'],codigo:['codigo','code'],nome:['nome','name','tarefa'],duracao:['duracao','duration'],
        inicio:['inicio','start','inicio planejado'],termino:['termino','finish','fim','termino planejado'],
        percEsp:['esperado','% esperado'],percConc:['concluido','% concluido','% complete'],
        pred:['predecessora','predecessor','prececessora'],pai:['tarefa pai','parent'],grupo:['grupo','group'],
        local:['local','location'],custo:['custo','cost'],receita:['receita','revenue'],
        resp:['responsavel','responsible','resource'],iniB:['inicio linha de base'],terB:['termino linha de base'],
        iniD:['inicio desafio'],terD:['termino desafio']};
        for(const al of(a[n]||[])){const i=hdrs.indexOf(al);if(i>=0)return i;}return-1;};
      const iN=ci('nome');if(iN<0){Utils.toast('Coluna Nome não encontrada.','erro');return;}
      Utils.mostrarLoading('Limpando...');
      const L=200;
      for(let i=0;i<tarefas.length;i+=L)await Promise.all(tarefas.slice(i,i+L).map(t=>Database.deletar(obraId,COL,t.id).catch(()=>{})));
      const regs=[];
      for(let r=1;r<rows.length;r++){
        const row=rows[r],nR=String(row[iN]||''),nm=nR.trim();if(!nm)continue;
        const cd=String(row[ci('codigo')]||'').trim();
        // Nível: pelo código (1=0, 1.1=1, 1.1.1=2) OU pelo recuo de espaços
        const pts=(cd.match(/\./g)||[]).length;
        const nivelByCod=pts; // 0 pontos = nível 0, 1 ponto = nível 1, etc.
        const nivelBySpace=Math.floor((nR.length-nR.trimStart().length)/2);
        const niv=cd?nivelByCod:nivelBySpace; // prioriza código se existir
        const tipo=pts<=1&&cd?'grupo':'tarefa';
        regs.push({tipo,codigo:cd,nome:nm,nivel:niv,ordem:regs.length+1,
          inicioPlanejado:_pd(row[ci('inicio')]),terminoPlanejado:_pd(row[ci('termino')]),
          duracao:_pDur(row[ci('duracao')]),percentualEsperado:_pN(row[ci('percEsp')]),
          percentualConcluido:_pN(row[ci('percConc')]),predecessora:String(row[ci('pred')]||'').trim(),
          tarefaPai:String(row[ci('pai')]||'').trim(),grupo:String(row[ci('grupo')]||'').trim(),
          local:String(row[ci('local')]||'').trim(),custo:_pN(row[ci('custo')]),receita:_pN(row[ci('receita')]),
          responsavel:String(row[ci('resp')]||'').trim(),inicioPlanejadoBase:_pd(row[ci('iniB')]),
          terminoPlanejadoBase:_pd(row[ci('terB')]),inicioDesafio:_pd(row[ci('iniD')]),
          terminoDesafio:_pd(row[ci('terD')]),obraId});
      }
      let imp=0;
      for(let i=0;i<regs.length;i+=L){
        Utils.mostrarLoading(`Importando ${Math.min(i+L,regs.length)}/${regs.length}...`);
        await Promise.all(regs.slice(i,i+L).map(d=>Database.criar(obraId,COL,d).then(()=>imp++).catch(console.error)));
      }
      Utils.toast(`✅ ${imp} tarefas importadas!`,'sucesso');await carregar();
    }catch(e){console.error(e);Utils.toast('Erro: '+e.message,'erro');}finally{Utils.esconderLoading();}
  }

  // ===================== EXPORTAR =====================
  async function exportar(){
    try{Utils.mostrarLoading('Gerando...');
      if(typeof XLSX==='undefined')await _ls('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
      const H=['ID','Código','Nome','Duração','Início','Término','% Esperado','% Concluído',
        'Prececessora','Tarefa Pai','Grupo','Local','Custo','Receita','Responsável',
        'Inicio Linha de Base','Termino Linha de Base','Inicio Desafio','Termino Desafio'];
      const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
      const rows=sorted.map((t,i)=>[i+1,t.codigo||'','  '.repeat(t.nivel||0)+(t.nome||''),
        t.duracao?t.duracao+'d':'',_fBR(t.inicioPlanejado),_fBR(t.terminoPlanejado),
        t.percentualEsperado||0,t.percentualConcluido||0,t.predecessora||'',t.tarefaPai||'',
        t.grupo||'',t.local||'',t.custo||0,t.receita||0,t.responsavel||'',
        _fBR(t.inicioPlanejadoBase),_fBR(t.terminoPlanejadoBase),_fBR(t.inicioDesafio),_fBR(t.terminoDesafio)]);
      const ws=XLSX.utils.aoa_to_sheet([H,...rows]);
      ws['!cols']=[{wch:6},{wch:10},{wch:45},{wch:8},{wch:13},{wch:13},{wch:11},{wch:11},
        {wch:13},{wch:20},{wch:18},{wch:15},{wch:10},{wch:10},{wch:18},{wch:22},{wch:22},{wch:15},{wch:15}];
      const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Cronograma');
      const obra=Router.getObra();
      XLSX.writeFile(wb,`cronograma_${(obra?.nome||'obra').replace(/[^a-z0-9]/gi,'_')}.xlsx`);
      Utils.toast('Exportado!','sucesso');
    }catch(e){Utils.toast('Erro: '+e.message,'erro');}finally{Utils.esconderLoading();}
  }

  // ===================== EXPORTAR PNG =====================
  function exportarPNG(){
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
            else if(cid==='inicio')cells+=`<div style="${base}color:#666;font-size:.7rem;justify-content:center;">${_fd(t.inicioPlanejado)}</div>`;
            else if(cid==='termino')cells+=`<div style="${base}color:#666;font-size:.7rem;justify-content:center;">${_fd(t.terminoPlanejado)}</div>`;
            else if(cid==='duracao')cells+=`<div style="${base}color:#666;font-size:.7rem;justify-content:center;">${t.duracao||'—'}</div>`;
            else if(cid==='percEsp')cells+=`<div style="${base}color:#555;font-size:.7rem;justify-content:center;">${t.percentualEsperado||0}%</div>`;
            else if(cid==='percConc')cells+=`<div style="${base}font-size:.7rem;justify-content:center;color:${perc>=100?'#16a34a':perc>0?'#2563eb':'#555'};">${perc}%</div>`;
            else if(cid==='predecessora')cells+=`<div style="${base}color:#555;font-size:.7rem;justify-content:center;">${t.predecessora||'—'}</div>`;
            else if(cid==='responsavel')cells+=`<div style="${base}color:#555;font-size:.7rem;">${t.responsavel||'—'}</div>`;
            else if(cid==='local')cells+=`<div style="${base}color:#555;font-size:.7rem;">${t.local||'—'}</div>`;
            else if(cid==='grupo')cells+=`<div style="${base}color:#555;font-size:.7rem;">${t.grupo||'—'}</div>`;
            else if(cid==='quantidade'){const vinc=t.fonteQuantidade==='levantamento';cells+=`<div style="${base}color:${vinc?'var(--cor-primaria)':'#555'};font-size:.7rem;justify-content:flex-end;">${vinc?'🔗 ':''}${t.quantidade?_fQtd(t.quantidade)+' '+(t.unidade||''):'—'}</div>`;}
            else if(cid==='custoMaterial'){const cm=custoMaterialPorTarefa.get(t.id)||0;cells+=`<div style="${base}color:#8a8;font-size:.68rem;justify-content:flex-end;">${cm?'R$ '+_fMoeda(cm):'—'}</div>`;}
            else if(cid==='custoMaoObra'){const cmo=custoMaoObraPorTarefa.get(t.id)||0;cells+=`<div style="${base}color:#8a8;font-size:.68rem;justify-content:flex-end;">${cmo?'R$ '+_fMoeda(cmo):'—'}</div>`;}
            else if(cid==='acoes')cells+=`<div style="${base}"></div>`;
          }
          rowsHtml+=`<div style="position:absolute;top:${yLocal}px;left:0;right:0;height:${ROW_H}px;display:flex;align-items:center;border-bottom:1px solid #1a1a1a;background:${i%2?'rgba(255,255,255,.015)':''};">${cells}</div>`;

          barsHtml+=`<div style="position:absolute;left:0;top:${yLocal}px;width:100%;height:${ROW_H}px;border-bottom:1px solid #1a1a1a;background:${i%2?'rgba(255,255,255,.015)':''};"></div>`;
          if(t.inicioPlanejado&&t.terminoPlanejado){
            const ti=new Date(t.inicioPlanejado), tf2=new Date(t.terminoPlanejado);
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
  function setZoom(z){zoomGantt=z;_render();}

  // Popup de predecessora
  function _predPopup(idx){
    console.log('_predPopup chamado, idx=',idx);
    const t=filtradas[idx];if(!t)return;
    let pop=document.getElementById('pred-pop');if(pop)pop.remove();
    pop=document.createElement('div');pop.id='pred-pop';
    pop.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a1a;border:2px solid var(--cor-primaria);border-radius:10px;padding:20px;z-index:2000;min-width:360px;box-shadow:0 12px 40px rgba(0,0,0,.6);';
    
    const predAtual=t.predecessora||'';
    const match=predAtual.match(/^([\d.]+)\s*(TI|II|TT|IT)?\s*([+-]?\d+)?$/i);
    const codAtual=match?match[1]:'';
    const tipoAtual=match?(match[2]||'TI').toUpperCase():'TI';
    const defAtual=match?parseInt(match[3])||0:0;
    
    pop.innerHTML=`
      <div style="font-weight:700;color:var(--cor-primaria);margin-bottom:14px;font-size:.9rem;">Predecessora de: ${t.nome}</div>
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <div style="flex:1;">
          <label style="font-size:.7rem;color:#888;display:block;margin-bottom:4px;">Código da tarefa</label>
          <input id="pred-cod" type="text" value="${codAtual}" class="form-control" placeholder="Ex: 1.2" oninput="Planejamento._predPreview()" style="font-size:.9rem;">
        </div>
        <div style="width:80px;">
          <label style="font-size:.7rem;color:#888;display:block;margin-bottom:4px;">Tipo</label>
          <select id="pred-tipo" class="form-control" onchange="Planejamento._predPreview()">
            <option value="TI" ${tipoAtual==='TI'?'selected':''}>TI</option>
            <option value="II" ${tipoAtual==='II'?'selected':''}>II</option>
            <option value="TT" ${tipoAtual==='TT'?'selected':''}>TT</option>
            <option value="IT" ${tipoAtual==='IT'?'selected':''}>IT</option>
          </select>
        </div>
        <div style="width:70px;">
          <label style="font-size:.7rem;color:#888;display:block;margin-bottom:4px;">Defasagem</label>
          <input id="pred-def" type="number" value="${defAtual}" class="form-control" oninput="Planejamento._predPreview()">
        </div>
      </div>
      <div id="pred-info" style="background:#111;border-radius:6px;padding:10px;margin-bottom:14px;min-height:40px;font-size:.82rem;color:#aaa;"></div>
      <div style="font-size:.68rem;color:#555;margin-bottom:12px;">
        TI = Término→Início (após terminar) · II = Início→Início (começa junto)<br>
        TT = Término→Término (termina junto) · IT = Início→Término
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-secundario btn-sm" onclick="document.getElementById('pred-pop').remove()">Cancelar</button>
        <button class="btn btn-perigo btn-sm" onclick="Planejamento._predSalvar(${idx},'')">Limpar</button>
        <button class="btn btn-primario btn-sm" onclick="Planejamento._predSalvar(${idx})">Salvar</button>
      </div>`;
    document.body.appendChild(pop);
    document.getElementById('pred-cod').focus();
    _predPreview();
    // Close on escape
    const onKey=e=>{if(e.key==='Escape'){pop.remove();document.removeEventListener('keydown',onKey);}};
    document.addEventListener('keydown',onKey);
  }
  
  function _predPreview(){
    const cod=document.getElementById('pred-cod')?.value?.trim();
    const tipo=document.getElementById('pred-tipo')?.value||'TI';
    const def=parseInt(document.getElementById('pred-def')?.value)||0;
    const info=document.getElementById('pred-info');
    if(!info)return;
    if(!cod){info.innerHTML='<span style="color:#555;">Digite o código da tarefa predecessora</span>';return;}
    const numBusca2=parseInt(cod);const pred=isNaN(numBusca2)?tarefas.find(x=>x.codigo===cod):tarefas.find(x=>x._numLinha===numBusca2);
    if(!pred){info.innerHTML='<span style="color:#dc2626;">Tarefa com código "'+cod+'" não encontrada</span>';return;}
    const descTipo={TI:'Inicia após término de',II:'Inicia junto com',TT:'Termina junto com',IT:'Termina junto com início de'}[tipo];
    info.innerHTML=`<div style="color:var(--cor-primaria);font-weight:700;margin-bottom:4px;">${pred.codigo} — ${pred.nome}</div>
      <div style="color:#aaa;font-size:.78rem;">${descTipo}: <strong>${pred.nome}</strong>${def?` (${def>0?'+':''}${def} dias)`:''}</div>
      ${pred.inicioPlanejado?`<div style="color:#666;font-size:.72rem;margin-top:4px;">Início: ${_fd(pred.inicioPlanejado)} · Fim: ${_fd(pred.terminoPlanejado)}</div>`:''}`;
  }
  
  async function _predSalvar(idx, forceVal){
    const t=filtradas[idx];if(!t)return;
    let valor;
    if(forceVal!==undefined){valor=forceVal;}
    else{
      const cod=document.getElementById('pred-cod')?.value?.trim()||'';
      const tipo=document.getElementById('pred-tipo')?.value||'TI';
      const def=parseInt(document.getElementById('pred-def')?.value)||0;
      valor=cod?(cod+tipo+(def?((def>0?'+':'')+def):'')):'' ;
    }
    const updates={predecessora:valor};
    if(valor)_calcPredecessora(t,valor,updates);
    Object.assign(t,updates);
    _paintRows();
    const pop=document.getElementById('pred-pop');if(pop)pop.remove();
    try{await Database.atualizar(obraId,COL,t.id,updates);}
    catch(e){console.error(e);Utils.toast('Erro.','erro');}
  }

  function _hideCol(id){colsHidden.add(id);_render();requestAnimationFrame(()=>_paintRows());}


  // Remapeia referências numéricas de predecessoras após reordenação.
  // oldToNew: Map<id_tarefa, novo_numLinha> — gerado depois de _buildFiltradas().
  // Só toca tarefas cujo número de predecessora mudou; salva no Firestore em background.
  async function _remapearPredecessoras(oldNumMap){
    // oldNumMap: Map<tarefaId, {antes:numLinha, depois:numLinha}>
    // Monta um lookup: numAntes → numDepois
    const lookup=new Map();
    for(const [,v] of oldNumMap){
      if(v.antes!==v.depois) lookup.set(v.antes, v.depois);
    }
    if(!lookup.size)return; // nada mudou de número

    const atualizacoes=[];
    for(const t of tarefas){
      if(!t.predecessora)continue;
      // Formato: "3TI+2" ou "3" ou "3TI"
      const novo=t.predecessora.replace(/^(\d+)/,(match,num)=>{
        const n=parseInt(num);
        return lookup.has(n)?String(lookup.get(n)):match;
      });
      if(novo!==t.predecessora){
        t.predecessora=novo;
        atualizacoes.push({id:t.id,predecessora:novo});
      }
    }
    if(atualizacoes.length){
      Utils.toast(`Predecessoras atualizadas (${atualizacoes.length} tarefa${atualizacoes.length>1?'s':''}).`,'sucesso');
      for(const u of atualizacoes){
        await Database.atualizar(obraId,COL,u.id,{predecessora:u.predecessora}).catch(console.error);
      }
    }
  }

  // Move a tarefa selecionada (se houver exatamente 1) uma posição acima ou abaixo
  async function _moverSel(dir){
    if(!selecionados.size){Utils.toast('Selecione pelo menos 1 tarefa para mover.','alerta');return;}
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
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

    // Salva só as que mudaram de ordem
    const updates=sorted.filter(t=>{
      const orig=tarefas.find(x=>x.id===t.id);
      return orig&&orig.ordem!==t.ordem;
    });
    await Promise.all(sorted.map(t=>
      Database.atualizar(obraId,COL,t.id,{ordem:t.ordem}).catch(console.error)
    ));
  }

  // ===================== BUSCA NO GANTT =====================
  function onBusca(texto){
    _buscaTexto=texto.trim();
    _buscaCursor=-1;
    if(!_buscaTexto){
      _buscaResultados=[];
      // Atualiza apenas o destaque visual sem recriar o DOM do input
      requestAnimationFrame(()=>_paintRows());
      // Atualiza o contador (acima do gantt) sem destruir o input
      _atualizarBuscaInfo();
      return;
    }
    const q=_buscaTexto.toLowerCase();
    _buscaResultados=filtradas
      .map((t,i)=>({t,i}))
      .filter(({t})=>
        (t.nome||'').toLowerCase().includes(q)||
        (t.codigo||'').toLowerCase().includes(q)||
        (t.responsavel||'').toLowerCase().includes(q)||
        (t.local||'').toLowerCase().includes(q)||
        (t.grupo||'').toLowerCase().includes(q)||
        String(t._numLinha||'').includes(q)
      );
    _atualizarBuscaInfo();
    if(_buscaResultados.length){
      _buscaCursor=0;
      _pularParaResultado(0);
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

  return{init,carregar,setZoom,inserirTarefa,editarTarefa,salvarTarefa,excluirTarefa,
    selectIdx,toggleRecolher,recuarNivel,avancarNivel,
    toggleGantt,hideCol,showColsMenu,_showCol,_showAll,
    _colResizeStart,moveColLeft,moveColRight,_hideCol,_divStart,_sync,_editCell,_esqDragStart,
    _rowDragStart,toggleSel,_limparSelecao,_moverSel,_bulkNivel,_bulkDuplicar,_bulkExcluir,
    toggleStatusFiltro,_aplicarStatusFiltro,undo,
    onBusca,limparBusca,_buscaKey,
    importarExcel,exportar,exportarPNG,_gerarPNG,_predPopup,_predPreview,_predSalvar,
    abrirVinculosView,fecharVinculosView,abrirVincularTarefa,abrirVincularAqui,onVincTipoChange,
    onVincNavModulo,onVincNavMetrica,onVincNavEntrar,onVincNavBreadcrumb,onVincNavVoltar,
    onBuscaEscolhaAlvoVinc,onEscolherAlvoVinc,onTrocarAlvoVinc,
    onToggleIncluirVinc,onFatorVincChange,marcarTodosVinc,dividirIrmaosVinc,
    salvarVinculoLevantamento,removerVinculoLevantamento,recalcularVinculosLevantamento};
})();
function onObraChanged(){Planejamento.init();}
