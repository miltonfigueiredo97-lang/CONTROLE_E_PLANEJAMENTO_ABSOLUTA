// ============================================================
// Módulo: CPM — Caminho Crítico
// Forward pass, backward pass, folga total, folga livre.
// ============================================================
//
// POR QUE ESTE MÓDULO EXISTE
// O Planejamento propagava data pra frente (mudou a predecessora, empurra a
// sucessora) mas nunca fazia o caminho de volta. Sem backward pass não existe
// late start, não existe folga e portanto NÃO EXISTE CAMINHO CRÍTICO — o
// sistema não sabia dizer quais tarefas seguram a data final da obra.
//
// Este módulo é JS puro, sem DOM e sem Firestore: recebe a lista de tarefas e o
// calendário, devolve os números. Isso é de propósito — dá pra testar com node,
// e o auditor de planejamento consome o resultado sem depender de tela.
//
// TUDO EM DIAS ÚTEIS, pela régua do Calendario da obra. Com o calendário
// desligado cai em dias corridos, igual ao resto do sistema.
//
// DECISÕES QUE VALEM REGISTRO
//
// 1. Tarefa-pai (resumo) não entra na rede. Data de pai vem do rollup dos
//    filhos; deixar o pai ser empurrado por vínculo brigaria com esse rollup.
//    O pai recebe ES/EF/LS/LF agregados dos descendentes, no fim.
//
// 2. Vínculo que aponta pra um PAI é expandido pros descendentes folha dele:
//    - TI/TT (âncora no término): liga em TODAS as folhas. "Só depois que o
//      grupo inteiro terminar" — e como ES é o máximo dos candidatos, sai certo.
//    - II/IT (âncora no início): liga só na PRIMEIRA folha do grupo (a de menor
//      ordem). "Junto com o começo do grupo" é o começo do primeiro, não do
//      último. Aproximação consciente: se a primeira folha na ordem não for a
//      que começa mais cedo, o vínculo fica ancorado na errada.
//
// 3. Dependência circular não tem solução matemática (nenhuma das duas tarefas
//    pode começar antes da outra). Os nós do ciclo são detectados pela ordenação
//    topológica, marcados e EXCLUÍDOS do cálculo — em vez de travar ou devolver
//    número inventado. Quem chama recebe a lista e reporta.
//
// 4. Folga livre é calculada só sobre vínculos TI (Término-Início), que é a
//    esmagadora maioria. Em tarefa cuja única saída é II/TT/IT, a folga livre
//    devolvida é a folga total — documentado, não silencioso.
//
// 5. Com dia de MEIO PERÍODO na jornada, a folga sai fracionária (0,5) e o
//    caminho crítico fica mais curto do que a intuição sugere: numa cadeia
//    linear aparecem tarefas com folga de meia ou uma jornada. Isso NÃO é erro
//    de arredondamento — é folga real. A granularidade da data é o dia inteiro,
//    a da jornada é meio dia, então um deslize de um dia de calendário que cai
//    num sábado de meio período consome só meia jornada e o sábado "absorve" o
//    atraso. Conferido empiricamente: numa cadeia com sábado meio, aumentar em
//    1 dia a duração de uma tarefa com folga 1 não move o término da obra;
//    aumentar em 2 move. Se algum dia essa folga precisar sumir, o caminho é
//    trabalhar num eixo contínuo de jornadas acumuladas em vez de datas
//    discretas — não é arredondar o resultado.

const CPM = (() => {

  const TOL = 1e-9; // folga é fração quando há meio período; comparar com zero exige tolerância

  function _predParse(canon) {
    if (!canon) return [];
    return String(canon).split(';').map(p => p.trim()).filter(Boolean).map(p => {
      const partes = p.split('|');
      return { id: partes[0] || '', tipo: (partes[1] || 'TI').toUpperCase(), lag: parseInt(partes[2]) || 0 };
    }).filter(x => x.id);
  }

  // Folga em jornadas entre duas datas, com sinal. Positiva = b depois de a.
  // Zero quando são o mesmo dia (jornadasEntre é inclusivo nas duas pontas).
  function _folgaEntre(a, b, cal) {
    if (!a || !b) return 0;
    if (a === b) return 0;
    if (a < b) return Calendario.jornadasEntre(a, b, cal) - 1;
    return -(Calendario.jornadasEntre(b, a, cal) - 1);
  }

  // ---- Montagem da rede ----

  function _montar(tarefas, cal) {
    const sorted = [...tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const n = sorted.length;

    // Pai = tem filho direto (o próximo da lista está num nível abaixo).
    for (let i = 0; i < n; i++) {
      sorted[i]._cpmPai = !!(sorted[i + 1] && (sorted[i + 1].nivel || 0) > (sorted[i].nivel || 0));
    }

    // Descendentes folha de cada pai, na ordem — usado pra expandir vínculo em pai.
    const folhasDe = new Map();
    for (let i = 0; i < n; i++) {
      if (!sorted[i]._cpmPai) continue;
      const lista = [];
      for (let j = i + 1; j < n; j++) {
        if ((sorted[j].nivel || 0) <= (sorted[i].nivel || 0)) break;
        if (!sorted[j]._cpmPai) lista.push(sorted[j].id);
      }
      folhasDe.set(sorted[i].id, lista);
    }

    const nos = new Map();
    for (const t of sorted) {
      if (t._cpmPai) continue;
      const perc = parseFloat(String(t.percentualConcluido == null ? 0 : t.percentualConcluido).replace(',', '.')) || 0;
      // DATA DE CORTE: o que já aconteceu é FATO, não previsão.
      //   executado -> 100% ou com término real: início E término congelados
      //   iniciado   -> começou mas não terminou: início congelado, término recalcula
      //   livre      -> não começou: recalcula os dois
      // Sem isso o replanejamento reescreve a história da obra: no RD06 a
      // primeira versão mudava a data de tarefas 100% concluídas, e ainda
      // empurrava todas as sucessoras a partir de uma data que nunca existiu.
      const executado = perc >= 100 || !!t.terminoReal;
      const iniciado = !executado && (perc > 0 || !!t.inicioReal);
      nos.set(t.id, {
        id: t.id, nome: t.nome || '', codigo: t.codigo || '', nivel: t.nivel || 0,
        ordem: t.ordem || 0,
        duracao: Math.max(0, parseInt(t.duracao) || 0),
        inicioAtual: t.inicioPlanejado || '', terminoAtual: t.terminoPlanejado || '',
        inicioReal: t.inicioReal || '', terminoReal: t.terminoReal || '', perc,
        executado, iniciado,
        entradas: [], saidas: [],
        es: '', ef: '', ls: '', lf: '',
        folgaTotal: 0, folgaLivre: 0, critico: false, emCiclo: false,
      });
    }

    // Arestas. Uma predecessora que aponta pra tarefa inexistente (excluída) é
    // ignorada aqui e reportada como pendência por quem chama.
    const orfas = [];
    for (const t of sorted) {
      if (t._cpmPai) continue;
      const dest = nos.get(t.id);
      for (const p of _predParse(t.predecessora)) {
        let alvos;
        if (nos.has(p.id)) alvos = [p.id];
        else if (folhasDe.has(p.id)) {
          const grupo = folhasDe.get(p.id);
          alvos = (p.tipo === 'II' || p.tipo === 'IT') ? grupo.slice(0, 1) : grupo;
        } else { orfas.push({ id: t.id, nome: t.nome || '', predId: p.id }); continue; }

        for (const a of alvos) {
          if (a === t.id) continue; // auto-dependência: ignora, é sempre erro de digitação
          const aresta = { de: a, para: t.id, tipo: p.tipo, lag: p.lag };
          nos.get(a).saidas.push(aresta);
          dest.entradas.push(aresta);
        }
      }
    }

    return { sorted, nos, folhasDe, orfas };
  }

  // Ordenação topológica (Kahn). O que não sai da fila está em ciclo.
  function _topologica(nos) {
    const grau = new Map();
    for (const [id, no] of nos) grau.set(id, no.entradas.length);
    const fila = [];
    for (const [id, g] of grau) if (!g) fila.push(id);
    const ordem = [];
    while (fila.length) {
      const id = fila.shift();
      ordem.push(id);
      for (const a of nos.get(id).saidas) {
        const g = grau.get(a.para) - 1;
        grau.set(a.para, g);
        if (!g) fila.push(a.para);
      }
    }
    const ciclos = [];
    if (ordem.length !== nos.size) for (const [id, g] of grau) if (g > 0) ciclos.push(id);
    return { ordem, ciclos };
  }

  // O LAÇO em si: qual é o A, qual é o B, e por onde volta.
  // Dizer "esta tarefa está num ciclo" sem mostrar o caminho não permite
  // consertar nada — é preciso saber qual vínculo fechar. DFS a partir do nó
  // até reencontrá-lo, devolvendo a sequência de tarefas do laço.
  function _acharLaco(nos, idInicial) {
    const pilha = [], noPilha = new Set(), visitado = new Set();
    let achado = null;
    function dfs(id) {
      if (achado) return;
      if (noPilha.has(id)) {
        const i = pilha.indexOf(id);
        achado = pilha.slice(i).concat([id]);
        return;
      }
      if (visitado.has(id)) return;
      visitado.add(id); noPilha.add(id); pilha.push(id);
      const no = nos.get(id);
      if (no) for (const a of no.saidas) { dfs(a.para); if (achado) return; }
      pilha.pop(); noPilha.delete(id);
    }
    dfs(idInicial);
    return achado;
  }

  // ---- Cálculo ----

  function calcular(tarefas, cal) {
    const c = Calendario.normalizar(cal);
    const { sorted, nos, orfas } = _montar(tarefas || [], c);
    const { ordem, ciclos } = _topologica(nos);
    for (const id of ciclos) nos.get(id).emCiclo = true;

    // Tarefa EXECUTADA em ciclo: o ciclo impede calcular previsão, mas não
    // impede saber quando ela foi feita — isso é registro, não cálculo. Preenche
    // a data real/salva antes de qualquer coisa, pra ela nunca aparecer sem data
    // nem como candidata a ser movida por um replanejamento.
    for (const no of nos.values()) {
      if (!no.executado) continue;
      no.es = no.inicioReal || no.inicioAtual || '';
      no.ef = no.terminoReal || no.terminoAtual || '';
      no.ls = no.es; no.lf = no.ef;
    }

    // Data-base do projeto: a menor data de início que existe hoje. Serve de
    // âncora pra tarefa sem predecessora e sem data própria.
    let base = '';
    for (const no of nos.values()) if (no.inicioAtual && (!base || no.inicioAtual < base)) base = no.inicioAtual;
    if (!base) base = Calendario.iso(new Date());
    base = Calendario.proximoDiaUtil(base, c);

    // ---- FORWARD PASS: mais cedo que pode começar e terminar ----
    for (const id of ordem) {
      const no = nos.get(id);

      // EXECUTADO: aconteceu, ponto. Data real vence data planejada, e nenhum
      // vínculo pode mover o que já foi feito. As sucessoras partem daqui.
      if (no.executado) {
        no.es = no.inicioReal || no.inicioAtual || base;
        no.ef = no.terminoReal || no.terminoAtual || Calendario.fimPorDuracao(no.es, no.duracao, c);
        continue;
      }

      const cands = [];

      // INICIADO: o início é fato. Só o término se recalcula pela duração.
      if (no.iniciado) {
        no.es = no.inicioReal || no.inicioAtual || base;
        no.ef = Calendario.fimPorDuracao(no.es, no.duracao, c);
        continue;
      }

      if (!no.entradas.length) {
        cands.push(no.inicioAtual ? Calendario.proximoDiaUtil(no.inicioAtual, c) : base);
      }
      for (const a of no.entradas) {
        const pred = nos.get(a.de);
        if (pred.emCiclo || !pred.ef) continue;
        if (a.tipo === 'TI') cands.push(Calendario.somarDiasUteis(pred.ef, a.lag + 1, c));
        else if (a.tipo === 'II') cands.push(Calendario.somarDiasUteis(pred.es, a.lag, c));
        else if (a.tipo === 'TT') cands.push(Calendario.iniPorDuracao(Calendario.somarDiasUteis(pred.ef, a.lag, c), no.duracao, c));
        else if (a.tipo === 'IT') cands.push(Calendario.iniPorDuracao(Calendario.somarDiasUteis(pred.es, a.lag, c), no.duracao, c));
      }
      const validos = cands.filter(Boolean);
      no.es = validos.length ? validos.sort()[validos.length - 1] : (no.inicioAtual || base);
      no.ef = Calendario.fimPorDuracao(no.es, no.duracao, c);
    }

    // ---- BACKWARD PASS: mais tarde que pode, sem atrasar a obra ----
    let lfProjeto = '';
    for (const no of nos.values()) if (!no.emCiclo && no.ef && (!lfProjeto || no.ef > lfProjeto)) lfProjeto = no.ef;

    for (let i = ordem.length - 1; i >= 0; i--) {
      const no = nos.get(ordem[i]);

      // O que já aconteceu não tem "mais tarde que poderia": aconteceu quando
      // aconteceu. Late = early, folga zero, e fora do caminho crítico (não faz
      // sentido dizer que tarefa pronta segura a data final).
      if (no.executado) { no.lf = no.ef; no.ls = no.es; continue; }

      const cands = [];
      for (const a of no.saidas) {
        const suc = nos.get(a.para);
        if (suc.emCiclo || !suc.ls) continue;
        if (a.tipo === 'TI') cands.push(Calendario.somarDiasUteis(suc.ls, -(a.lag + 1), c));
        else if (a.tipo === 'II') cands.push(Calendario.fimPorDuracao(Calendario.somarDiasUteis(suc.ls, -a.lag, c), no.duracao, c));
        else if (a.tipo === 'TT') cands.push(Calendario.somarDiasUteis(suc.lf, -a.lag, c));
        else if (a.tipo === 'IT') cands.push(Calendario.fimPorDuracao(Calendario.somarDiasUteis(suc.lf, -a.lag, c), no.duracao, c));
      }
      const validos = cands.filter(Boolean);
      no.lf = validos.length ? validos.sort()[0] : lfProjeto;   // o mais restritivo é o MENOR
      no.ls = Calendario.iniPorDuracao(no.lf, no.duracao, c);
      // Quem aperta esta tarefa: a sucessora que produziu o LF mais restritivo.
      // Sem isso, "folga negativa de 146 dias" é um número sem endereço — e não
      // dá pra avaliar se está certo ou errado.
      if (validos.length) {
        const i = cands.findIndex(x => x === no.lf);
        const aresta = no.saidas.filter(a => { const s = nos.get(a.para); return s && !s.emCiclo && s.ls; })[i];
        if (aresta) {
          const suc = nos.get(aresta.para);
          no.apertaPor = { id: suc.id, nome: suc.nome, codigo: suc.codigo, tipo: aresta.tipo, lag: aresta.lag, ls: suc.ls };
        }
      }
    }

    // ---- FOLGAS E CAMINHO CRÍTICO ----
    for (const no of nos.values()) {
      if (no.emCiclo) continue;
      if (no.executado) { no.folgaTotal = 0; no.folgaLivre = 0; no.critico = false; continue; }
      no.folgaTotal = _folgaEntre(no.ef, no.lf, c);
      no.critico = no.folgaTotal <= TOL;

      // Folga livre: quanto essa tarefa pode atrasar sem empurrar NENHUMA
      // sucessora. Só vínculo TI entra na conta (ver decisão 4 no topo).
      const ti = no.saidas.filter(a => a.tipo === 'TI' && nos.get(a.para) && !nos.get(a.para).emCiclo);
      if (!ti.length) { no.folgaLivre = no.folgaTotal; continue; }
      let menor = null;
      for (const a of ti) {
        const suc = nos.get(a.para);
        if (!suc.es) continue;
        // O primeiro dia que a sucessora pode ocupar já está `lag+1` jornadas
        // depois do término desta — a folga é o que sobra além disso.
        const f = _folgaEntre(no.ef, suc.es, c) - (a.lag + 1);
        if (menor === null || f < menor) menor = f;
      }
      no.folgaLivre = menor === null ? no.folgaTotal : Math.max(0, menor);
    }

    // ---- ROLLUP DOS PAIS ----
    // Pai não participa da rede, mas mostrar folga e criticidade no grupo ajuda
    // a achar onde está o aperto sem abrir a árvore inteira.
    const pais = new Map();
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      if (!p._cpmPai) continue;
      const ag = { id: p.id, nome: p.nome || '', codigo: p.codigo || '', pai: true,
        es: '', ef: '', ls: '', lf: '', folgaTotal: null, critico: false, filhos: 0, criticosDentro: 0 };
      for (let j = i + 1; j < sorted.length; j++) {
        if ((sorted[j].nivel || 0) <= (p.nivel || 0)) break;
        const f = nos.get(sorted[j].id);
        if (!f || f.emCiclo) continue;
        ag.filhos++;
        if (f.critico) ag.criticosDentro++;
        if (f.es && (!ag.es || f.es < ag.es)) ag.es = f.es;
        if (f.ef && (!ag.ef || f.ef > ag.ef)) ag.ef = f.ef;
        if (f.ls && (!ag.ls || f.ls < ag.ls)) ag.ls = f.ls;
        if (f.lf && (!ag.lf || f.lf > ag.lf)) ag.lf = f.lf;
      }
      if (ag.ef && ag.lf) ag.folgaTotal = _folgaEntre(ag.ef, ag.lf, c);
      ag.critico = ag.criticosDentro > 0;
      pais.set(p.id, ag);
    }

    const lista = [...nos.values()].filter(x => !x.emCiclo);
    const criticos = lista.filter(x => x.critico).sort((a, b) => a.ordem - b.ordem);

    return {
      nos, pais, criticos,
      ciclos: ciclos.map(id => {
        const t = nos.get(id);
        const laco = _acharLaco(nos, id);
        return { id, nome: t.nome, codigo: t.codigo,
          // O caminho fechado, pra tela poder mostrar "A → B → C → A" em vez de
          // só dizer que existe um laço.
          laco: laco ? laco.map(x => { const n = nos.get(x); return { id: x, nome: n ? n.nome : x, codigo: n ? n.codigo : '' }; }) : null };
      }),
      orfas,
      iniProjeto: lista.reduce((m, x) => (x.es && (!m || x.es < m)) ? x.es : m, ''),
      fimProjeto: lfProjeto,
      totalNos: nos.size,
      executadas: lista.filter(x => x.executado).length,
      iniciadas: lista.filter(x => x.iniciado).length,
      // Quantas tarefas o cronograma salvo hoje coloca em data diferente da que
      // o CPM calcula. Zero = cronograma coerente com a própria rede.
      divergentes: lista.filter(x => (x.inicioAtual && x.inicioAtual !== x.es) || (x.terminoAtual && x.terminoAtual !== x.ef)).length,
    };
  }

  return { calcular };
})();
