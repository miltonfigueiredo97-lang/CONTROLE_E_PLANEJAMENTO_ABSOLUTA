// ============================================================
// Módulo: Análise de Cronograma
// A opinião técnica de planejamento — não a matemática da rede.
// ============================================================
//
// POR QUE ESTE MÓDULO EXISTE
// O auditor e o CPM olham a REDE: falta predecessora, folga negativa, ciclo,
// caminho crítico. Tudo isso é matemática de vínculo, e é necessário — mas não é
// planejamento. Planejar é responder outra classe de pergunta:
//
//   • a equipe consegue estar em todos esses lugares ao mesmo tempo?
//   • o serviço sobe os pavimentos num ritmo constante, ou aos trancos?
//   • duas frentes vão se atropelar no mesmo ambiente?
//   • tem serviço esperando sem motivo, que poderia antecipar?
//   • o ritmo de um serviço é compatível com o do serviço que vem atrás?
//
// Nenhuma dessas perguntas se responde olhando predecessora. Todas se respondem
// olhando DATA, LOCAL e FRENTE juntos — que é o que este módulo faz.
//
// TUDO DETERMINÍSTICO E OFFLINE. Os números saem do cronograma; o julgamento sai
// de regras de planejamento explicadas em cada achado.
//
// VOCABULÁRIO DO SISTEMA QUE ISTO USA
//   frenteServico -> a equipe (PEDREIROS, GESSO, HIDRAULICA…)
//   grupo         -> o local macro (pavimento, subsolo, fachada)
//   subgrupo      -> o ambiente dentro do local (Hall, Final 01, Academia)
//   subcategoria  -> o serviço (Contrapiso, Forro de Gesso (teto)…)

const AnaliseCronograma = (() => {

  const PICO_FRENTES = 6;        // locais simultâneos por frente acima disso é suspeito
  const RITMO_CV_ALTO = 0.5;     // coeficiente de variação do intervalo entre pavimentos
  const MIN_PAVIMENTOS = 5;      // repetições mínimas pra falar de ritmo
  const ESPERA_ALTA = 15;        // dias úteis de espera entre pavimentos consecutivos

  const _norm = (s) => String(s || '').trim();
  const _dias = (a, b, cal) => (!a || !b) ? 0 : (a <= b
    ? Calendario.jornadasEntre(a, b, cal) - 1
    : -(Calendario.jornadasEntre(b, a, cal) - 1));

  function _achado(o) {
    return { chave: o.chave, ctx: o.ctx || '', tipo: o.tipo, severidade: o.severidade,
      titulo: o.titulo, detalhe: o.detalhe || '', motivo: o.motivo || '',
      sugestao: o.sugestao || '', acoes: o.acoes || ['ir', 'manter', 'ignorar'],
      tarefaId: o.tarefaId || '', tarefaNome: o.tarefaNome || '', tarefaCodigo: o.tarefaCodigo || '',
      dados: o.dados || {}, decidido: false, decisao: null };
  }

  // Extrai o número do pavimento do nome do local, pra poder ordenar e medir
  // ritmo. "1º PAVIMENTO" -> 1. Térreo, subsolo e ático não são numerados e
  // ficam fora da análise de ritmo de propósito: não fazem parte do trem.
  function _numPavimento(grupo) {
    const m = _norm(grupo).match(/(\d+)\s*[ºo°]?\s*PAV/i);
    return m ? parseInt(m[1]) : null;
  }

  // ============================================================
  function analisar(tarefas, opcoes) {
    const op = opcoes || {};
    const cal = Calendario.normalizar(op.cal);
    const hoje = op.hoje || Calendario.iso(new Date());
    const decisoes = op.decisoes || new Map();

    const sorted = [...(tarefas || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    for (let i = 0; i < sorted.length; i++) {
      sorted[i]._pai = !!(sorted[i + 1] && (sorted[i + 1].nivel || 0) > (sorted[i].nivel || 0));
    }
    const folhas = sorted.filter(t => !t._pai && t.inicioPlanejado && t.terminoPlanejado);
    const achados = [];
    const add = (o) => achados.push(_achado(o));

    // ---------- 1. CARGA DE FRENTE ----------
    // A equipe é finita. Se a mesma frente aparece em 12 locais no mesmo dia, ou
    // a equipe é enorme, ou o cronograma está mentindo sobre o efetivo. Isto é o
    // erro de planejamento mais comum em cronograma montado por serviço em vez de
    // por equipe: cada serviço parece razoável isolado, e o conjunto é impossível.
    const porFrente = new Map();
    for (const t of folhas) {
      const f = _norm(t.frenteServico);
      if (!f) continue;
      if (!porFrente.has(f)) porFrente.set(f, []);
      porFrente.get(f).push(t);
    }
    const cargas = [];
    for (const [frente, lista] of porFrente) {
      // Varredura por evento: conta locais distintos ativos em cada início.
      const marcos = [...new Set(lista.map(t => t.inicioPlanejado))].sort();
      let pico = 0, dataPico = '', locaisPico = [], tarefasPico = [];
      for (const d of marcos) {
        const ativas = lista.filter(t => t.inicioPlanejado <= d && t.terminoPlanejado >= d);
        const locais = new Set(ativas.map(t => _norm(t.grupo) + '|' + _norm(t.subgrupo)));
        if (locais.size > pico) { pico = locais.size; dataPico = d; locaisPico = [...locais]; tarefasPico = ativas; }
      }
      cargas.push({ frente, pico, dataPico, locais: locaisPico, tarefas: tarefasPico, total: lista.length });
      if (pico <= PICO_FRENTES) continue;
      add({ chave: `carga_frente:${frente}`, ctx: `${pico}|${dataPico}`,
        tipo: 'carga_frente', severidade: pico >= PICO_FRENTES * 2 ? 'alta' : 'media',
        titulo: `${frente}: ${pico} locais ao mesmo tempo em ${dataPico}`,
        detalhe: `No dia ${dataPico} o cronograma coloca a frente ${frente} trabalhando em ${pico} locais simultaneamente:\n`
          + locaisPico.slice(0, 10).map(l => '• ' + l.replace('|', ' — ')).join('\n')
          + (locaisPico.length > 10 ? `\n… e outros ${locaisPico.length - 10}` : '')
          + `\n\nTarefas envolvidas: ${tarefasPico.length}.`,
        motivo: 'Equipe é recurso finito e o cronograma não sabe disso — ele deixa o mesmo pessoal em quantos lugares você mandar. É o erro mais comum de cronograma montado serviço por serviço: cada um parece razoável isolado, e o conjunto exige um efetivo que a obra não tem. Na prática a equipe atende um local por vez, os outros esperam, e o atraso aparece sem causa aparente.',
        sugestao: `Conferir o efetivo real de ${frente}. Se não dá pra dividir em ${pico} locais, escalonar os inícios (linha de balanço) ou aumentar a equipe no orçamento.`,
        acoes: ['manter', 'ignorar'],
        dados: { frente, pico, dataPico, locais: locaisPico,
          tarefas: tarefasPico.slice(0, 40).map(t => ({ id: t.id, nome: t.nome, codigo: t.codigo, grupo: t.grupo })) } });
    }

    // ---------- 2. RITMO DE LINHA DE BALANÇO ----------
    // Obra de edifício é trem de serviços subindo pavimento a pavimento. O que
    // importa não é a duração de cada tarefa, é o INTERVALO entre pavimentos
    // consecutivos — o takt. Ritmo irregular significa equipe parando e voltando,
    // que é desperdício puro e a principal fonte de atraso que ninguém explica.
    const porServico = new Map();
    for (const t of folhas) {
      const s = _norm(t.subcategoria) || _norm(t.categoria);
      const p = _numPavimento(t.grupo);
      if (!s || p === null) continue;
      const amb = _norm(t.subgrupo);
      const k = s + '||' + amb;
      if (!porServico.has(k)) porServico.set(k, { servico: s, ambiente: amb, itens: [] });
      porServico.get(k).itens.push({ pav: p, t });
    }
    const ritmos = [];
    for (const [k, g] of porServico) {
      // Um registro por pavimento (o mais cedo, se houver vários)
      const porPav = new Map();
      for (const it of g.itens) {
        const cur = porPav.get(it.pav);
        if (!cur || it.t.inicioPlanejado < cur.inicioPlanejado) porPav.set(it.pav, it.t);
      }
      if (porPav.size < MIN_PAVIMENTOS) continue;
      const seq = [...porPav.entries()].sort((a, b) => a[0] - b[0]);
      const intervalos = [];
      for (let i = 1; i < seq.length; i++) {
        intervalos.push({ de: seq[i - 1][0], para: seq[i][0],
          dias: _dias(seq[i - 1][1].inicioPlanejado, seq[i][1].inicioPlanejado, cal),
          tarefa: seq[i][1] });
      }
      if (!intervalos.length) continue;
      const vals = intervalos.map(x => x.dias);
      const media = vals.reduce((s, v) => s + v, 0) / vals.length;
      const desvio = Math.sqrt(vals.reduce((s, v) => s + (v - media) ** 2, 0) / vals.length);
      const cv = media !== 0 ? Math.abs(desvio / media) : 0;
      const durMedia = seq.reduce((s, x) => s + (parseInt(x[1].duracao) || 0), 0) / seq.length;
      ritmos.push({ servico: g.servico, ambiente: g.ambiente, pavimentos: porPav.size,
        takt: media, desvio, cv, duracaoMedia: durMedia, intervalos });

      const rot = g.servico + (g.ambiente ? ` — ${g.ambiente}` : '');

      // Ritmo irregular
      if (cv > RITMO_CV_ALTO && porPav.size >= MIN_PAVIMENTOS) {
        const piores = [...intervalos].sort((a, b) => Math.abs(b.dias - media) - Math.abs(a.dias - media)).slice(0, 5);
        add({ chave: `ritmo:${k}`, ctx: `${Math.round(media)}|${Math.round(desvio)}`,
          tipo: 'ritmo_irregular', severidade: cv > 1 ? 'alta' : 'media',
          tarefaId: piores[0].tarefa.id, tarefaNome: piores[0].tarefa.nome, tarefaCodigo: piores[0].tarefa.codigo,
          titulo: `${rot}: ritmo irregular entre pavimentos`,
          detalhe: `Sobe em média a cada ${media.toFixed(1)} dias úteis, mas o intervalo varia muito (desvio de ${desvio.toFixed(1)} dias).\n\nMaiores fora da média:\n`
            + piores.map(i => `• ${i.de}º → ${i.para}º pavimento: ${i.dias} dias`).join('\n'),
          motivo: 'Serviço repetitivo em prédio funciona como trem: a equipe sobe de pavimento em pavimento num passo constante. Intervalo irregular significa equipe parando e voltando — desmobiliza, perde produtividade no reaquecimento, e o encarregado não consegue programar o efetivo da semana. É desperdício que não aparece em nenhum indicador, e é a origem mais comum de atraso sem causa aparente.',
          sugestao: `Nivelar o passo em torno de ${Math.round(media)} dias, ou entender o que trava os pavimentos fora da média (material, liberação, frente ocupada).`,
          acoes: ['manter', 'ignorar'],
          dados: { servico: g.servico, ambiente: g.ambiente, takt: media, desvio, cv,
            intervalos: intervalos.map(i => ({ de: i.de, para: i.para, dias: i.dias, id: i.tarefa.id })) } });
      }

      // Espera longa entre pavimentos: takt muito maior que a duração significa
      // equipe ociosa entre um pavimento e o próximo.
      if (media > durMedia + ESPERA_ALTA && durMedia > 0) {
        add({ chave: `espera:${k}`, ctx: `${Math.round(media)}|${Math.round(durMedia)}`,
          tipo: 'espera_entre_pavimentos', severidade: 'media',
          tarefaId: seq[0][1].id, tarefaNome: seq[0][1].nome, tarefaCodigo: seq[0][1].codigo,
          titulo: `${rot}: ${Math.round(media - durMedia)} dias de espera entre pavimentos`,
          detalhe: `A tarefa dura ${durMedia.toFixed(0)} dias, mas o serviço só volta ao pavimento seguinte ${media.toFixed(0)} dias depois. Sobram ${Math.round(media - durMedia)} dias de intervalo em cada ciclo, ao longo de ${porPav.size} pavimentos.`,
          motivo: 'Se a equipe termina em 4 dias e só recomeça 20 dias depois, ela não está na obra nesse meio — ou está, e é custo sem produção. Esse intervalo repetido por pavimento é onde o prazo se estica sem ninguém decidir esticar. Em linha de balanço o objetivo é o takt colar na duração, com um pulmão pequeno e proposital.',
          sugestao: `Ou puxar os pavimentos pra um passo de ~${Math.round(durMedia)} dias e encurtar a obra, ou reduzir a equipe e assumir o ritmo atual com custo menor.`,
          acoes: ['manter', 'ignorar'],
          dados: { servico: g.servico, ambiente: g.ambiente, takt: media, duracaoMedia: durMedia,
            ociosidade: media - durMedia, pavimentos: porPav.size } });
      }
    }

    // ---------- 3. COLISÃO DE RITMO ----------
    // Dois serviços em sequência precisam subir no MESMO passo. Se o de baixo
    // sobe mais rápido que o de cima, ele alcança — e para. Se sobe mais devagar,
    // abre buraco. Isto não aparece em nenhuma checagem de vínculo.
    const porServicoSimples = new Map();
    for (const r of ritmos) {
      if (!porServicoSimples.has(r.servico)) porServicoSimples.set(r.servico, r);
      else if (r.pavimentos > porServicoSimples.get(r.servico).pavimentos) porServicoSimples.set(r.servico, r);
    }
    if (typeof PadraoAprendido !== 'undefined' && op.aprendido) {
      const vistos = new Set();
      for (const [key, e] of op.aprendido.pares) {
        if (e.n < MIN_PAVIMENTOS) continue;
        const rotA = op.aprendido.rotulos.get(e.a) || '', rotB = op.aprendido.rotulos.get(e.b) || '';
        const rA = porServicoSimples.get(rotA.replace(/ \(\d+ª etapa\)$/, '')), rB = porServicoSimples.get(rotB.replace(/ \(\d+ª etapa\)$/, ''));
        if (!rA || !rB) continue;
        const k2 = [rotA, rotB].join('>');
        if (vistos.has(k2)) continue;
        vistos.add(k2);
        const dif = rB.takt - rA.takt;
        if (Math.abs(dif) < 3) continue;                 // passos compatíveis
        if (rA.takt <= 0 || rB.takt <= 0) continue;
        const alcanca = dif < 0;                          // o de trás sobe mais rápido
        add({ chave: `colisao_ritmo:${k2}`, ctx: `${Math.round(rA.takt)}|${Math.round(rB.takt)}`,
          tipo: 'colisao_ritmo', severidade: Math.abs(dif) > 10 ? 'media' : 'baixa',
          titulo: `Ritmo incompatível: ${rotA} sobe a cada ${rA.takt.toFixed(0)}d, ${rotB} a cada ${rB.takt.toFixed(0)}d`,
          detalhe: alcanca
            ? `${rotB} sobe ${Math.abs(dif).toFixed(0)} dias mais rápido por pavimento que ${rotA}, que vem antes dele. Ao longo dos pavimentos ele ALCANÇA o serviço da frente e passa a esperar.`
            : `${rotB} sobe ${dif.toFixed(0)} dias mais devagar por pavimento que ${rotA}. A distância entre os dois só aumenta, abrindo buraco de frente livre sem produção.`,
          motivo: 'Em linha de balanço dois serviços encadeados têm que subir no mesmo passo. Passo diferente significa que a folga entre eles muda a cada pavimento: ou fecha até o de trás bater no da frente e parar, ou abre até virar pavimento pronto esperando serviço. Nos dois casos o efetivo planejado deixa de valer no meio da obra.',
          sugestao: alcanca
            ? `Igualar o passo dos dois em torno de ${Math.max(rA.takt, rB.takt).toFixed(0)} dias, ou reduzir a equipe de ${rotB} — ela vai parar de qualquer jeito.`
            : `Igualar o passo, ou reforçar a equipe de ${rotB} pra acompanhar ${rotA}.`,
          acoes: ['manter', 'ignorar'],
          dados: { servicoA: rotA, servicoB: rotB, taktA: rA.takt, taktB: rB.takt, diferenca: dif } });
      }
    }

    // ---------- 4. CONFLITO NO MESMO AMBIENTE ----------
    // Duas frentes diferentes no MESMO ambiente ao mesmo tempo. Em ambiente
    // pequeno (banheiro, cozinha, hall) isso é atrito garantido: uma atrapalha a
    // outra, e a segunda costuma estragar o serviço da primeira.
    const porAmbiente = new Map();
    for (const t of folhas) {
      const g = _norm(t.grupo), a = _norm(t.subgrupo);
      if (!g || !a) continue;
      const k = g + '||' + a;
      if (!porAmbiente.has(k)) porAmbiente.set(k, []);
      porAmbiente.get(k).push(t);
    }
    const conflitos = [];
    for (const [k, lista] of porAmbiente) {
      for (let i = 0; i < lista.length; i++) {
        for (let j = i + 1; j < lista.length; j++) {
          const a = lista[i], b = lista[j];
          const fa = _norm(a.frenteServico), fb = _norm(b.frenteServico);
          if (!fa || !fb || fa === fb) continue;
          // sobreposição de datas
          if (a.terminoPlanejado < b.inicioPlanejado || b.terminoPlanejado < a.inicioPlanejado) continue;
          const ini = a.inicioPlanejado > b.inicioPlanejado ? a.inicioPlanejado : b.inicioPlanejado;
          const fim = a.terminoPlanejado < b.terminoPlanejado ? a.terminoPlanejado : b.terminoPlanejado;
          const dias = Calendario.jornadasEntre(ini, fim, cal);
          if (dias < 2) continue;                    // encosta um dia: não é conflito
          conflitos.push({ local: k, a, b, fa, fb, ini, fim, dias });
        }
      }
    }
    // Agrupa por par de frentes: o padrão importa mais que o caso isolado.
    const porPar = new Map();
    for (const c of conflitos) {
      const k = [c.fa, c.fb].sort().join(' × ');
      if (!porPar.has(k)) porPar.set(k, []);
      porPar.get(k).push(c);
    }
    for (const [par, lista] of porPar) {
      if (lista.length < 3) continue;
      const totalDias = lista.reduce((s, c) => s + c.dias, 0);
      add({ chave: `conflito_ambiente:${par}`, ctx: `${lista.length}`,
        tipo: 'conflito_ambiente', severidade: lista.length >= 10 ? 'media' : 'baixa',
        tarefaId: lista[0].a.id, tarefaNome: lista[0].a.nome, tarefaCodigo: lista[0].a.codigo,
        titulo: `${par}: ${lista.length} sobreposições no mesmo ambiente`,
        detalhe: `As duas frentes estão no mesmo ambiente ao mesmo tempo em ${lista.length} situações, somando ${totalDias} dias de sobreposição.\n\n`
          + lista.slice(0, 6).map(c => `• ${c.local.replace('||', ' — ')}: "${(c.a.nome || '').trim()}" e "${(c.b.nome || '').trim()}" de ${c.ini} a ${c.fim} (${c.dias}d)`).join('\n')
          + (lista.length > 6 ? `\n… e outras ${lista.length - 6}` : ''),
        motivo: 'Duas equipes no mesmo ambiente ao mesmo tempo é atrito físico: disputa de espaço, de andaime, de ponto de energia, e serviço pronto de uma sendo danificado pela outra. Em ambiente pequeno — banheiro, cozinha, hall — é onde nasce a maior parte do retrabalho que ninguém consegue explicar depois.',
        sugestao: 'Escalonar as duas frentes no mesmo ambiente, ou confirmar que cabem juntas ali de fato.',
        acoes: ['manter', 'ignorar'],
        dados: { par, ocorrencias: lista.length, dias: totalDias,
          exemplos: lista.slice(0, 20).map(c => ({ local: c.local, a: c.a.id, b: c.b.id, ini: c.ini, fim: c.fim, dias: c.dias })) } });
    }

    // ---------- 5. OPORTUNIDADE DE ANTECIPAÇÃO ----------
    // Serviço que não depende de nada pendente e está agendado muito depois do
    // que poderia. Não é erro: é prazo em cima da mesa.
    if (op.rede) {
      const cands = [];
      for (const no of op.rede.nos.values()) {
        if (no.emCiclo || no.executado || no.iniciado) continue;
        if (no.folgaLivre < 20) continue;
        if (!no.inicioAtual || no.inicioAtual <= hoje) continue;
        cands.push(no);
      }
      cands.sort((a, b) => b.folgaLivre - a.folgaLivre);
      if (cands.length >= 3) {
        add({ chave: 'antecipacao', ctx: `${cands.length}`,
          tipo: 'oportunidade_antecipacao', severidade: 'baixa',
          titulo: `${cands.length} tarefas poderiam começar mais cedo`,
          detalhe: `Estas tarefas têm folga livre alta — podem antecipar sem empurrar nenhuma sucessora:\n\n`
            + cands.slice(0, 10).map(n => `• ${n.codigo ? n.codigo + ' ' : ''}${(n.nome || '').trim()} — agendada ${n.inicioAtual}, poderia antecipar até ${Math.round(n.folgaLivre)} dias`).join('\n')
            + (cands.length > 10 ? `\n… e outras ${cands.length - 10}` : ''),
          motivo: 'Folga livre é a quantidade que a tarefa pode antecipar sem mexer em ninguém. Antecipar serviço que não depende de nada libera frente mais cedo, dá pulmão pro que vem depois e reduz o risco de o imprevisto cair justamente no caminho crítico. É a decisão de planejamento mais barata que existe: não custa nada e compra prazo.',
          sugestao: 'Puxar o que fizer sentido, priorizando quem libera frente pra serviço crítico.',
          acoes: ['manter', 'ignorar'],
          dados: { quantidade: cands.length,
            itens: cands.slice(0, 40).map(n => ({ id: n.id, nome: n.nome, codigo: n.codigo, folgaLivre: n.folgaLivre, inicioAtual: n.inicioAtual })) } });
      }
    }

    // ---------- Memória de decisão ----------
    for (const a of achados) {
      const d = decisoes.get ? decisoes.get(a.chave) : decisoes[a.chave];
      if (!d) continue;
      if ((d.ctx || '') !== (a.ctx || '')) continue;
      a.decidido = true; a.decisao = d;
    }

    const ORDEM = { alta: 0, media: 1, baixa: 2 };
    achados.sort((x, y) => ORDEM[x.severidade] - ORDEM[y.severidade]);
    const abertos = achados.filter(a => !a.decidido);

    return {
      achados, abertos, cargas, ritmos,
      resumo: {
        analisadas: folhas.length,
        frentes: porFrente.size,
        servicosComRitmo: ritmos.length,
        taktMedio: ritmos.length ? ritmos.reduce((s, r) => s + r.takt, 0) / ritmos.length : 0,
        conflitos: conflitos.length,
        total: achados.length,
        alta: abertos.filter(a => a.severidade === 'alta').length,
        media: abertos.filter(a => a.severidade === 'media').length,
        baixa: abertos.filter(a => a.severidade === 'baixa').length,
      },
    };
  }

  return { analisar };
})();
