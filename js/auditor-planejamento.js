// ============================================================
// Módulo: Auditor de Planejamento
// Lê o cronograma da obra e devolve o que não faz sentido.
// ============================================================
//
// O QUE ESTE MÓDULO FAZ
// Substitui a conferência linha por linha, predecessora por predecessora. Roda
// três famílias de checagem sobre a mesma rede:
//
//   1. QUALIDADE DA REDE (numérica, na linha das 14 checagens do DCMA):
//      tarefa órfã, lag negativo, folga negativa, duração fora de faixa, ciclo,
//      data salva divergente da rede, avanço incoerente com as datas reais.
//   2. PRECEDÊNCIA TECNOLÓGICA (js/regras-precedencia.js):
//      piso antes de forro, contrapiso antes de impermeabilização, e o motivo
//      técnico de cada uma.
//   3. DURAÇÃO (quantidade × produtividade ÷ equipe):
//      "5 dias pra 480 m² com 4 oficiais não fecha".
//
// TUDO OFFLINE E DETERMINÍSTICO. Nenhuma chamada de rede, nenhuma IA. Roda igual
// toda vez, e se a internet cair o diagnóstico continua na tela. Era esse o
// requisito: o Milton já teve problema com API, então o que é cálculo não podia
// depender de API.
//
// MEMÓRIA DE DECISÃO
// Cada achado tem uma `chave` estável. Quando o Milton decide algo ("é ordem da
// diretoria, o piso começa agora"), a decisão é gravada sob essa chave e o
// achado volta marcado como decidido nas próximas análises — em vez de repetir o
// mesmo alerta pra sempre, virar ruído e ser ignorado.
//
// A chave inclui uma ASSINATURA DE CONTEXTO. Se o que gerou o achado mudar
// (datas, duração, vínculo), a assinatura muda, a decisão antiga não casa mais e
// o ponto é reaberto. Decidir não é apagar: é decidir *aquilo*.

const Auditor = (() => {

  const JORNADA_H = 8.8;      // horas por dia útil — padrão de obra (44h semanais / 5)
  const DUR_LONGA = 44;       // dias úteis; acima disso o DCMA considera tarefa mal quebrada
  const FOLGA_ALTA = 44;      // dias úteis de folga total: sinal de que falta lógica de rede
  const LAG_ALTO = 20;        // dias úteis de defasagem: em geral é tarefa faltando, não espera real

  // ---- Índices de produtividade de referência ----
  // Faixa de Hh (homem-hora) por unidade, na linha do TCPO/SINAPI. É SEMENTE, não
  // verdade: a verdade é a produtividade da própria equipe, que entra por
  // `opcoes.produtividade` quando houver histórico de medição. Sem histórico, o
  // achado sai marcado como "referência" e não como "seu histórico".
  const INDICES = {
    alvenaria:  { un: 'm2', min: 0.70, max: 1.10 },
    reboco:     { un: 'm2', min: 0.50, max: 0.80 },
    contrapiso: { un: 'm2', min: 0.30, max: 0.50 },
    piso:       { un: 'm2', min: 0.80, max: 1.30 },
    forro:      { un: 'm2', min: 0.60, max: 1.00 },
    pintura:    { un: 'm2', min: 0.25, max: 0.45 },
    estrutura:  { un: 'm2', min: 0.60, max: 1.00 },
    fachada:    { un: 'm2', min: 0.90, max: 1.60 },
    impermeabilizacao: { un: 'm2', min: 0.35, max: 0.60 },
  };

  const _num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? 0 : n; };
  const _unNorm = (u) => String(u || '').toLowerCase().replace(/[²2\s]/g, '').replace('m', 'm2').replace('m22', 'm2');

  function _predParse(canon) {
    if (!canon) return [];
    return String(canon).split(';').map(p => p.trim()).filter(Boolean).map(p => {
      const partes = p.split('|');
      return { id: partes[0] || '', tipo: (partes[1] || 'TI').toUpperCase(), lag: parseInt(partes[2]) || 0 };
    }).filter(x => x.id);
  }

  // Assinatura do contexto de um achado: se isso mudar, a decisão antiga não
  // vale mais e o ponto é reaberto.
  function _assinatura(partes) { return partes.filter(x => x !== undefined && x !== null).join('~'); }

  function _achado(o) {
    return {
      chave: o.chave, ctx: o.ctx || '', tipo: o.tipo, severidade: o.severidade,
      tarefaId: o.tarefaId || '', tarefaNome: o.tarefaNome || '', tarefaCodigo: o.tarefaCodigo || '',
      tarefaId2: o.tarefaId2 || '', tarefaNome2: o.tarefaNome2 || '',
      titulo: o.titulo, detalhe: o.detalhe || '', motivo: o.motivo || '', risco: o.risco || '',
      sugestao: o.sugestao || '', acoes: o.acoes || [], dados: o.dados || {},
      decidido: false, decisao: null,
    };
  }

  // ============================================================
  // ANÁLISE
  // ============================================================
  // opcoes: { cal, hoje, decisoes: Map(chave -> {decisao, justificativa, ctx}),
  //           produtividade: { servico: unPorDiaPorOficial }, equipePadrao }
  function analisar(tarefas, opcoes) {
    const op = opcoes || {};
    const cal = Calendario.normalizar(op.cal);
    const hoje = op.hoje || Calendario.iso(new Date());
    const decisoes = op.decisoes || new Map();
    const prod = op.produtividade || {};

    const sorted = [...(tarefas || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const porId = new Map(sorted.map(t => [t.id, t]));
    for (let i = 0; i < sorted.length; i++) {
      sorted[i]._pai = !!(sorted[i + 1] && (sorted[i + 1].nivel || 0) > (sorted[i].nivel || 0));
    }
    const folhas = sorted.filter(t => !t._pai);

    const rede = CPM.calcular(sorted, cal);
    const achados = [];
    const add = (o) => achados.push(_achado(o));

    // Quem é predecessora de quem — pra achar tarefa sem sucessora.
    const temSucessora = new Set();
    for (const t of folhas) for (const p of _predParse(t.predecessora)) temSucessora.add(p.id);

    // ---------- 1. QUALIDADE DA REDE ----------

    for (const c of rede.ciclos) {
      add({ chave: `ciclo:${c.id}`, ctx: '', tipo: 'ciclo', severidade: 'alta',
        tarefaId: c.id, tarefaNome: c.nome, tarefaCodigo: c.codigo,
        titulo: 'Dependência circular',
        detalhe: 'Esta tarefa está num laço de predecessoras: A espera B, que espera A. Nenhuma das duas pode começar.',
        motivo: 'Rede de precedência não admite ciclo — não existe ordem possível, então o cálculo de data e de folga fica sem solução e a tarefa sai do caminho crítico sem motivo.',
        sugestao: 'Abra a coluna Predecessora das tarefas do laço e remova o vínculo que fecha o círculo.',
        acoes: ['ir', 'ignorar'] });
    }

    for (const o of rede.orfas) {
      const t = porId.get(o.id);
      add({ chave: `pred_orfa:${o.id}:${o.predId}`, ctx: '', tipo: 'predecessora_orfa', severidade: 'alta',
        tarefaId: o.id, tarefaNome: o.nome, tarefaCodigo: t ? (t.codigo || '') : '',
        titulo: 'Predecessora aponta pra tarefa que não existe',
        detalhe: 'O vínculo referencia uma tarefa que foi excluída da obra.',
        motivo: 'Vínculo apontando pro vazio é vínculo que não restringe nada: a tarefa parece amarrada mas na prática está solta, e a data dela não se defende.',
        sugestao: 'Reaponte pra tarefa correta ou apague o vínculo.',
        acoes: ['ir', 'ignorar'] });
    }

    for (const t of folhas) {
      const no = rede.nos.get(t.id);
      const preds = _predParse(t.predecessora);
      const dur = parseInt(t.duracao) || 0;
      const ehMarco = (t.tipo === 'marco') || dur === 0;

      if (!preds.length && t.ordem !== (folhas[0] || {}).ordem) {
        add({ chave: `sem_pred:${t.id}`, ctx: _assinatura([t.inicioPlanejado]), tipo: 'sem_predecessora', severidade: 'media',
          tarefaId: t.id, tarefaNome: t.nome, tarefaCodigo: t.codigo,
          titulo: 'Tarefa sem predecessora',
          detalhe: `A data de início (${t.inicioPlanejado || 'não definida'}) está digitada na mão, não deriva de nada.`,
          motivo: 'Tarefa sem predecessora é uma data fixa no meio do cronograma: quando a obra atrasa antes dela, ela não anda junto e o cronograma passa a mentir sem ninguém notar.',
          sugestao: 'Amarre no serviço que precisa terminar antes dela.',
          acoes: ['ir', 'ignorar'] });
      }

      if (!temSucessora.has(t.id) && !ehMarco) {
        add({ chave: `sem_suc:${t.id}`, ctx: '', tipo: 'sem_sucessora', severidade: 'baixa',
          tarefaId: t.id, tarefaNome: t.nome, tarefaCodigo: t.codigo,
          titulo: 'Tarefa sem sucessora',
          detalhe: 'Nada na obra depende desta tarefa.',
          motivo: 'Sem sucessora a tarefa não empurra nada, então atrasar ela não aparece em lugar nenhum — e ela nunca entra no caminho crítico, mesmo que na obra real trave a frente seguinte.',
          sugestao: 'Ligue no serviço que vem depois, ou num marco de encerramento da etapa.',
          acoes: ['ir', 'ignorar'] });
      }

      for (const p of preds) {
        const alvo = porId.get(p.id);
        if (!alvo) continue;
        if (p.lag < 0) {
          add({ chave: `lag_neg:${t.id}:${p.id}`, ctx: _assinatura([p.lag, p.tipo]), tipo: 'lag_negativo', severidade: 'alta',
            tarefaId: t.id, tarefaNome: t.nome, tarefaCodigo: t.codigo,
            tarefaId2: p.id, tarefaNome2: alvo.nome,
            titulo: `Defasagem negativa (${p.lag} dias)`,
            detalhe: `"${t.nome}" começa ${Math.abs(p.lag)} dias ANTES do que a predecessora permitiria.`,
            motivo: 'Lag negativo é sobreposição forçada à mão. Ele esconde a decisão real (as duas frentes trabalham juntas) num número que ninguém revisa, e no primeiro replanejamento a sobreposição vira conflito de equipe no mesmo local.',
            sugestao: 'Se as frentes de fato se sobrepõem, quebre a tarefa em partes e ligue com Início-Início. Se não, tire o lag negativo.',
            acoes: ['ir', 'ignorar'] });
        } else if (p.lag > LAG_ALTO) {
          add({ chave: `lag_alto:${t.id}:${p.id}`, ctx: _assinatura([p.lag, p.tipo]), tipo: 'lag_alto', severidade: 'baixa',
            tarefaId: t.id, tarefaNome: t.nome, tarefaCodigo: t.codigo,
            tarefaId2: p.id, tarefaNome2: alvo.nome,
            titulo: `Defasagem de ${p.lag} dias`,
            detalhe: `Entre "${alvo.nome}" e "${t.nome}" há ${p.lag} dias de espera.`,
            motivo: 'Espera longa embutida em lag normalmente é uma tarefa que existe na obra e não está no cronograma — cura, teste, entrega de material, aprovação. Como lag não aparece no Gantt nem no histograma, esse tempo fica invisível.',
            sugestao: 'Se é cura, teste ou prazo de entrega, crie a tarefa com esse nome e essa duração.',
            acoes: ['ir', 'ignorar'] });
        }
      }

      if (dur > DUR_LONGA) {
        add({ chave: `dur_longa:${t.id}`, ctx: _assinatura([dur]), tipo: 'duracao_longa', severidade: 'baixa',
          tarefaId: t.id, tarefaNome: t.nome, tarefaCodigo: t.codigo,
          titulo: `Duração de ${dur} dias`,
          detalhe: `Mais de ${DUR_LONGA} dias úteis numa tarefa só.`,
          motivo: 'Tarefa muito longa não é medível: o avanço dela vira chute, e o atraso só aparece quando já é tarde. Quebrar por pavimento, torre ou frente devolve controle semanal.',
          sugestao: 'Quebre por local (pavimento/torre) ou por etapa.',
          acoes: ['ir', 'ignorar'] });
      }

      if (!no) continue;

      if (no.folgaTotal < -1e-9) {
        add({ chave: `folga_neg:${t.id}`, ctx: _assinatura([no.es, no.ef, dur]), tipo: 'folga_negativa', severidade: 'alta',
          tarefaId: t.id, tarefaNome: t.nome, tarefaCodigo: t.codigo,
          titulo: `Folga negativa de ${Math.abs(no.folgaTotal)} dias`,
          detalhe: `A rede exige que esta tarefa termine ${Math.abs(no.folgaTotal)} dias antes do que ela consegue.`,
          motivo: 'Folga negativa quer dizer que o cronograma já é impossível como está: ou uma data foi travada à mão, ou a duração não cabe entre os vínculos. Ignorar isso é assumir um atraso que ninguém declarou.',
          sugestao: 'Reveja a duração, o vínculo, ou aceite a nova data final da obra.',
          acoes: ['ir', 'ignorar'] });
      } else if (no.folgaTotal > FOLGA_ALTA) {
        add({ chave: `folga_alta:${t.id}`, ctx: _assinatura([Math.round(no.folgaTotal)]), tipo: 'folga_alta', severidade: 'baixa',
          tarefaId: t.id, tarefaNome: t.nome, tarefaCodigo: t.codigo,
          titulo: `Folga de ${Math.round(no.folgaTotal)} dias`,
          detalhe: 'Esta tarefa pode atrasar meses sem afetar o fim da obra.',
          motivo: 'Folga alta quase sempre é lógica faltando, não conforto real: a tarefa não está ligada em quem de fato depende dela. Isso também tira ela do caminho crítico e esconde risco.',
          sugestao: 'Confira se falta uma sucessora.',
          acoes: ['ir', 'ignorar'] });
      }

      if ((t.inicioPlanejado && t.inicioPlanejado !== no.es) || (t.terminoPlanejado && t.terminoPlanejado !== no.ef)) {
        add({ chave: `divergente:${t.id}`, ctx: _assinatura([t.inicioPlanejado, t.terminoPlanejado, no.es, no.ef]), tipo: 'data_divergente', severidade: 'media',
          tarefaId: t.id, tarefaNome: t.nome, tarefaCodigo: t.codigo,
          titulo: 'Data salva não bate com a rede',
          detalhe: `Salvo: ${t.inicioPlanejado || '—'} a ${t.terminoPlanejado || '—'}. Pela rede: ${no.es} a ${no.ef}.`,
          motivo: 'Quando a data gravada não é a que os vínculos produzem, o Gantt mostra uma coisa e a lógica diz outra. Aí ninguém sabe qual das duas usar pra cobrar a equipe.',
          sugestao: 'Rode "Aplicar Calendário às Datas" no menu de Ferramentas pra alinhar tudo de uma vez.',
          acoes: ['ir', 'ignorar'], dados: { es: no.es, ef: no.ef } });
      }

      // ---------- Avanço x datas reais ----------
      const perc = _num(t.percentualConcluido);
      if (perc > 0 && !t.inicioReal) {
        add({ chave: `perc_sem_ini:${t.id}`, ctx: _assinatura([perc]), tipo: 'perc_sem_inicio_real', severidade: 'media',
          tarefaId: t.id, tarefaNome: t.nome, tarefaCodigo: t.codigo,
          titulo: `${perc}% executado sem início real`,
          detalhe: 'A tarefa tem avanço lançado mas nenhuma data de início real.',
          motivo: 'Sem início real não há como medir produtividade nem calcular a data de término projetada — o avanço fica sem âncora no tempo, e o histórico da equipe não se forma.',
          sugestao: 'Lance a data em que o serviço realmente começou.',
          acoes: ['ir', 'ignorar'] });
      }
      if (t.inicioReal && t.inicioReal > hoje) {
        add({ chave: `real_futuro:${t.id}`, ctx: _assinatura([t.inicioReal]), tipo: 'data_real_futura', severidade: 'alta',
          tarefaId: t.id, tarefaNome: t.nome, tarefaCodigo: t.codigo,
          titulo: 'Início real no futuro',
          detalhe: `Início real lançado em ${t.inicioReal}, depois de hoje (${hoje}).`,
          motivo: 'Data real é registro do que aconteceu. No futuro, é erro de digitação — e contamina medição, curva S e qualquer projeção.',
          sugestao: 'Corrija a data.',
          acoes: ['ir', 'ignorar'] });
      }
      if (t.terminoPlanejado && t.terminoPlanejado < hoje && perc < 100 && !t.terminoReal) {
        add({ chave: `vencida:${t.id}`, ctx: _assinatura([t.terminoPlanejado, perc]), tipo: 'vencida_sem_conclusao', severidade: 'media',
          tarefaId: t.id, tarefaNome: t.nome, tarefaCodigo: t.codigo,
          titulo: `Prazo vencido com ${perc}%`,
          detalhe: `Deveria ter terminado em ${t.terminoPlanejado} e está com ${perc}%.`,
          motivo: 'Tarefa vencida e aberta empurra tudo que depende dela, mas enquanto a data não é revista o cronograma continua mostrando a obra no prazo.',
          sugestao: 'Atualize o avanço, ou reprograme a data e deixe a rede propagar.',
          acoes: ['ir', 'ignorar'] });
      }
    }

    // Excesso de vínculo não-TI: informativo agregado, não alerta por tarefa.
    let totalVinc = 0, naoTI = 0;
    for (const t of folhas) for (const p of _predParse(t.predecessora)) { totalVinc++; if (p.tipo !== 'TI') naoTI++; }
    if (totalVinc >= 20 && naoTI / totalVinc > 0.2) {
      const pct = Math.round(naoTI / totalVinc * 100);
      add({ chave: 'excesso_nao_ti', ctx: _assinatura([pct]), tipo: 'excesso_vinculos_nao_ti', severidade: 'baixa',
        titulo: `${pct}% dos vínculos não são Término-Início`,
        detalhe: `${naoTI} de ${totalVinc} vínculos usam Início-Início, Término-Término ou Início-Término.`,
        motivo: 'Obra é predominantemente sequencial, então o normal é Término-Início dominar. Muito II e TT costuma ser sobreposição forçada pra caber numa data, e rede assim reage mal a replanejamento: mexer numa ponta espalha efeito onde ninguém espera.',
        sugestao: 'Confira se a sobreposição é real ou se foi jeito de encurtar prazo.',
        acoes: ['ignorar'] });
    }

    // ---------- 2. PRECEDÊNCIA TECNOLÓGICA ----------
    for (const t of folhas) {
      const servT = RegrasPrecedencia.classificar(t.nome);
      if (!servT.length) continue;
      const noT = rede.nos.get(t.id);
      if (!noT) continue;

      for (const p of _predParse(t.predecessora)) {
        const alvo = porId.get(p.id);
        if (!alvo) continue;
        const servA = RegrasPrecedencia.classificar(alvo.nome);
        if (!servA.length) continue;

        for (const sa of servA) for (const st of servT) {
          if (sa === st) continue;
          const r = RegrasPrecedencia.regraEntre(sa, st);
          // O vínculo diz "alvo antes de t". A regra está satisfeita quando
          // regra.antes === sa. `invertido` true significa que a regra manda o
          // contrário do que o cronograma faz.
          if (!r || !r.invertido) continue;
          add({ chave: `precedencia:${p.id}>${t.id}:${r.regra.antes}>${r.regra.depois}`,
            ctx: _assinatura([p.tipo, p.lag]), tipo: 'precedencia_invertida', severidade: r.regra.severidade,
            tarefaId: t.id, tarefaNome: t.nome, tarefaCodigo: t.codigo,
            tarefaId2: p.id, tarefaNome2: alvo.nome,
            titulo: `${RegrasPrecedencia.label(r.regra.depois)} antes de ${RegrasPrecedencia.label(r.regra.antes)}`,
            detalhe: `O cronograma põe "${alvo.nome}" antes de "${t.nome}". Na execução a ordem costuma ser a inversa.`,
            motivo: r.regra.motivo, risco: r.regra.risco,
            sugestao: `Inverter o vínculo: "${t.nome}" passa a ser predecessora de "${alvo.nome}".`,
            acoes: ['inverter', 'manter', 'ir'],
            dados: { de: p.id, para: t.id, tipo: p.tipo, lag: p.lag, regraAntes: r.regra.antes, regraDepois: r.regra.depois } });
        }
      }
    }

    // Serviços que existem na obra mas não estão amarrados entre si, mesmo
    // havendo regra pra eles. Não é erro de vínculo — é vínculo FALTANDO, que é
    // mais perigoso porque nada no sistema reclama.
    const porServico = new Map();
    for (const t of folhas) {
      for (const s of RegrasPrecedencia.classificar(t.nome)) {
        if (!porServico.has(s)) porServico.set(s, []);
        porServico.get(s).push(t);
      }
    }
    for (const r of RegrasPrecedencia.todasAsRegras()) {
      if (r.severidade !== 'alta') continue;
      const A = porServico.get(r.antes), B = porServico.get(r.depois);
      if (!A || !B) continue;
      // Só reclama quando o serviço "depois" começa antes do "antes" terminar em
      // TODA a obra — aí é ordem trocada de fato, não só falta de vínculo local.
      let iniB = '', fimA = '';
      for (const t of B) { const n = rede.nos.get(t.id); if (n && n.es && (!iniB || n.es < iniB)) iniB = n.es; }
      for (const t of A) { const n = rede.nos.get(t.id); if (n && n.ef && (!fimA || n.ef > fimA)) fimA = n.ef; }
      if (!iniB || !fimA || iniB >= fimA) continue;
      const jaTemVinculo = B.some(t => _predParse(t.predecessora).some(p => A.some(a => a.id === p.id)));
      if (jaTemVinculo) continue;
      add({ chave: `ordem_global:${r.antes}>${r.depois}`, ctx: _assinatura([iniB, fimA]),
        tipo: 'ordem_global_invertida', severidade: 'media',
        titulo: `${RegrasPrecedencia.label(r.depois)} começa antes de ${RegrasPrecedencia.label(r.antes)} terminar`,
        detalhe: `${RegrasPrecedencia.label(r.depois)} inicia em ${iniB}, e ${RegrasPrecedencia.label(r.antes)} só termina em ${fimA}. Não existe vínculo entre os dois grupos.`,
        motivo: r.motivo, risco: r.risco,
        sugestao: `Amarre as tarefas de ${RegrasPrecedencia.label(r.depois)} nas de ${RegrasPrecedencia.label(r.antes)} do mesmo local.`,
        acoes: ['manter', 'ignorar'],
        dados: { servicoAntes: r.antes, servicoDepois: r.depois, qtdAntes: A.length, qtdDepois: B.length } });
    }

    // ---------- 3. DURAÇÃO x QUANTIDADE ----------
    for (const t of folhas) {
      const qtd = _num(t.quantidade);
      const dur = parseInt(t.duracao) || 0;
      if (qtd <= 0 || dur <= 0) continue;
      const equipe = Math.max(1, parseInt(t.equipeAlocada) || parseInt(op.equipePadrao) || 0) || 0;
      if (!equipe) continue;

      const servs = RegrasPrecedencia.classificar(t.nome).filter(s => INDICES[s]);
      if (!servs.length) continue;
      const s = servs[0];
      const idx = INDICES[s];
      if (_unNorm(t.unidade) && _unNorm(t.unidade) !== idx.un) continue; // unidade diferente: não opina

      // Produtividade da própria equipe vence a referência, sempre.
      const own = _num(prod[s]);
      let durMin, durMax, fonte;
      if (own > 0) {
        const nec = qtd / (own * equipe);
        durMin = nec * 0.85; durMax = nec * 1.15;
        fonte = `histórico da sua equipe (${own.toFixed(1)} ${idx.un}/dia por oficial)`;
      } else {
        durMin = (qtd * idx.min) / (equipe * JORNADA_H);
        durMax = (qtd * idx.max) / (equipe * JORNADA_H);
        fonte = `faixa de referência TCPO/SINAPI (${idx.min}–${idx.max} Hh/${idx.un})`;
      }

      const apertada = dur < durMin * 0.75;
      const folgada = dur > durMax * 1.6;
      if (!apertada && !folgada) continue;

      const necessario = Math.ceil(durMin);
      const ritmoPedido = qtd / dur / equipe;
      add({ chave: `duracao_${apertada ? 'apertada' : 'folgada'}:${t.id}`, ctx: _assinatura([dur, qtd, equipe]),
        tipo: 'duracao_incoerente', severidade: apertada ? 'alta' : 'baixa',
        tarefaId: t.id, tarefaNome: t.nome, tarefaCodigo: t.codigo,
        titulo: apertada ? `${dur} dias é pouco para ${qtd} ${idx.un}` : `${dur} dias é muito para ${qtd} ${idx.un}`,
        detalhe: apertada
          ? `Com ${equipe} oficial(is), ${dur} dias exigem ${ritmoPedido.toFixed(1)} ${idx.un}/dia por oficial. O necessário fica em torno de ${necessario} dias.`
          : `Com ${equipe} oficial(is), ${qtd} ${idx.un} sairiam em cerca de ${Math.ceil(durMax)} dias, não ${dur}.`,
        motivo: apertada
          ? `Duração menor que a produção permite é data que já nasce estourada: a equipe não entrega, o atraso aparece depois e contamina tudo que vem atrás. Base do cálculo: ${fonte}.`
          : `Duração folgada esconde folga dentro da tarefa, então ela nunca aparece como crítica e o cronograma perde tensão. Base do cálculo: ${fonte}.`,
        sugestao: apertada ? `Aumente a duração para ~${necessario} dias, ou aumente a equipe.` : 'Reveja a duração ou a quantidade vinculada.',
        acoes: ['ir', 'ignorar'],
        dados: { qtd, dur, equipe, servico: s, unidade: idx.un, durSugerida: necessario, fonte } });
    }

    // ---------- Memória de decisão ----------
    for (const a of achados) {
      const d = decisoes.get ? decisoes.get(a.chave) : decisoes[a.chave];
      if (!d) continue;
      // Contexto mudou => o achado é outro, mesmo com a mesma chave: reabre.
      if ((d.ctx || '') !== (a.ctx || '')) continue;
      a.decidido = true;
      a.decisao = d;
    }

    const ORDEM_SEV = { alta: 0, media: 1, baixa: 2 };
    achados.sort((x, y) => (ORDEM_SEV[x.severidade] - ORDEM_SEV[y.severidade]) || x.tipo.localeCompare(y.tipo));

    const abertos = achados.filter(a => !a.decidido);
    const porTipo = {};
    for (const a of abertos) porTipo[a.tipo] = (porTipo[a.tipo] || 0) + 1;

    return {
      achados, abertos, rede,
      resumo: {
        tarefas: sorted.length, folhas: folhas.length,
        total: achados.length, decididos: achados.length - abertos.length,
        alta: abertos.filter(a => a.severidade === 'alta').length,
        media: abertos.filter(a => a.severidade === 'media').length,
        baixa: abertos.filter(a => a.severidade === 'baixa').length,
        porTipo,
        criticos: rede.criticos.length,
        fimProjeto: rede.fimProjeto, iniProjeto: rede.iniProjeto,
        divergentes: rede.divergentes,
        regrasAplicadas: RegrasPrecedencia.totalRegras(),
      },
    };
  }

  // Dossiê compacto pra mandar pra uma IA quando quiser a conversa em linguagem
  // livre. Só o resumo e os achados abertos — nunca a planilha inteira. Uma obra
  // de 800 tarefas vira alguns kB. Se a API cair, nada disso é necessário: o
  // painel e as decisões continuam funcionando offline.
  function dossie(resultado, limite) {
    const lim = limite || 60;
    return {
      resumo: resultado.resumo,
      achados: resultado.abertos.slice(0, lim).map(a => ({
        chave: a.chave, tipo: a.tipo, severidade: a.severidade,
        tarefa: a.tarefaCodigo ? `${a.tarefaCodigo} ${a.tarefaNome}` : a.tarefaNome,
        outra: a.tarefaNome2 || undefined,
        titulo: a.titulo, detalhe: a.detalhe, motivo: a.motivo, risco: a.risco || undefined,
        sugestao: a.sugestao,
      })),
      omitidos: Math.max(0, resultado.abertos.length - lim),
    };
  }

  // Faixa de referência de um serviço, pra tela poder mostrar de onde veio o
  // número. Exposto como função e não como objeto: a verificação de return{} do
  // projeto (ver PROJETO.md) confere se todo item do return é função.
  function indiceDe(servico) { const i = INDICES[servico]; return i ? { ...i } : null; }
  function jornadaHoras() { return JORNADA_H; }

  return { analisar, dossie, indiceDe, jornadaHoras };
})();
