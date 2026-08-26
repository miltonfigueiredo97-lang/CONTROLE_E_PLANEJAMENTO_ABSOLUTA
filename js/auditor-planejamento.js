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

    // ---------- 2a. PADRÃO DA PRÓPRIA OBRA (tem prioridade) ----------
    //
    // Antes de comparar com qualquer regra de fora, compara o cronograma COM ELE
    // MESMO. Num edifício o mesmo conjunto de serviços se repete por pavimento,
    // então o padrão emerge por contagem — e o desvio dele é erro apontado com
    // número, sem chute: "42 vezes assim, 2 vezes ao contrário, aqui estão as 2".
    //
    // Isso tem prioridade sobre as regras genéricas por um motivo prático: no
    // RD06 a regra "impermeabilização antes do contrapiso" contrariava o
    // cronograma 42 vezes, e o cronograma estava certo. Conhecimento da própria
    // empresa vence conhecimento de fora.
    const parAprendido = new Set();
    let aprendido = null;
    if (typeof PadraoAprendido !== 'undefined') {
      aprendido = PadraoAprendido.aprender(sorted);

      for (const d of aprendido.desvios) {
        // Marca o par como "já coberto pelo padrão observado" pra a regra
        // genérica não falar sobre ele de novo, possivelmente ao contrário.
        parAprendido.add([d.servicoAntes, d.servicoDepois].sort().join('~'));
        const V = d.vinculos;
        const noCritico = V.filter(v => {
          const a = rede.nos.get(v.de), b = rede.nos.get(v.para);
          return (a && a.critico) || (b && b.critico);
        }).length;
        const amostra = V.slice(0, 6).map(v => `• ${(v.nomeDe || '').trim()}  →  ${(v.nomePara || '').trim()}${v.grupo ? `   [${v.grupo}]` : ''}`).join('\n');
        add({ chave: `padrao:${d.servicoAntes}>${d.servicoDepois}`,
          ctx: _assinatura([d.n, d.m, V.map(v => `${v.de}>${v.para}`).sort().join(',')]),
          tipo: 'desvio_padrao_obra', severidade: d.m <= 2 ? 'alta' : 'media',
          tarefaId: V[0].para, tarefaNome: V[0].nomePara, tarefaCodigo: V[0].codPara,
          tarefaId2: V[0].de, tarefaNome2: V[0].nomeDe,
          titulo: `${d.m} vínculo(s) contra o padrão da própria obra: ${d.rotuloDepois} antes de ${d.rotuloAntes}`,
          detalhe: `Nesta obra, ${d.rotuloAntes} vem antes de ${d.rotuloDepois} em ${d.n} lugares (${Math.round(d.confianca * 100)}% dos casos). Em ${d.m} lugar(es) está invertido.`
            + (noCritico ? `\n${noCritico} desses vínculos toca o caminho crítico.` : `\nNenhum toca o caminho crítico.`)
            + `\n\n${amostra}${V.length > 6 ? `\n… e outros ${V.length - 6}` : ''}`,
          motivo: `Este apontamento não vem de regra externa: vem do seu próprio cronograma. O padrão foi contado nas ${d.n + d.m} ocorrências do par, e ${d.n} delas seguem um sentido. Onde a obra faz diferente do que ela mesma faz em toda parte, ou é erro de montagem ou é exceção que merece estar registrada.`,
          risco: 'Sequência diferente no mesmo serviço entre pavimentos costuma ser vínculo montado à mão fora do padrão, e vira retrabalho ou espera de equipe naquele local.',
          sugestao: `Inverter os ${d.m} vínculo(s) para o padrão da obra, ou registrar por que ali é diferente.`,
          acoes: ['inverter', 'manter', 'ir'],
          dados: { de: V[0].de, para: V[0].para, vinculos: V, noCritico,
            labelAntes: d.rotuloDepois, labelDepois: d.rotuloAntes,
            padraoN: d.n, padraoM: d.m, confianca: d.confianca } });
      }

      // Vínculo que o padrão manda existir e não existe naquele local. É o erro
      // mais perigoso da lista: vínculo ausente não aparece em lugar nenhum, o
      // Gantt fica bonito e a tarefa flutua solta.
      for (const f of aprendido.faltando) {
        const locais = f.buracos.map(b => b.grupo);
        add({ chave: `falta_vinculo:${f.servicoAntes}>${f.servicoDepois}`,
          ctx: _assinatura([f.n, locais.sort().join(',')]),
          tipo: 'vinculo_faltando_padrao', severidade: f.buracos.length <= 2 ? 'media' : 'alta',
          tarefaId: (f.buracos[0].alvos[0] || {}).id || '',
          tarefaNome: (f.buracos[0].alvos[0] || {}).nome || '',
          tarefaCodigo: (f.buracos[0].alvos[0] || {}).codigo || '',
          titulo: `Vínculo faltando em ${f.buracos.length} local(is): ${f.rotuloAntes} → ${f.rotuloDepois}`,
          detalhe: `Esta obra liga ${f.rotuloAntes} a ${f.rotuloDepois} em ${f.locaisComVinculo} local(is), mas em ${f.buracos.length} os dois serviços existem e não estão ligados:\n`
            + locais.slice(0, 12).join(', ') + (locais.length > 12 ? `, … e outros ${locais.length - 12}` : '')
            + `\n\nExemplo: "${(f.buracos[0].origens[0] || {}).nome || ''}" deveria preceder "${(f.buracos[0].alvos[0] || {}).nome || ''}".`,
          motivo: 'Vínculo ausente é o erro mais silencioso que existe num cronograma: nada reclama. A tarefa parece amarrada porque a data está no lugar certo, mas quando a antecessora atrasa ela não anda junto — e o cronograma passa a mentir sem ninguém notar. Como o mesmo par está ligado nos outros locais, aqui é falha de montagem, não decisão.',
          sugestao: `Criar o vínculo ${f.rotuloAntes} → ${f.rotuloDepois} nos ${f.buracos.length} local(is) que estão sem.`,
          acoes: ['ir', 'manter', 'ignorar'],
          dados: { servicoAntes: f.servicoAntes, servicoDepois: f.servicoDepois,
            buracos: f.buracos, locais, padraoN: f.n } });
      }
    }

    // ---------- 2b. PRECEDÊNCIA TECNOLÓGICA (referência genérica) ----------
    //
    // AGREGADO POR PAR DE SERVIÇOS, não por par de tarefas. Motivo: a EAP é
    // hierárquica — Gesso > Final 01 > 1º ao 20º pavimento, Gesso > Final 02 >
    // idem, e Contrapiso na mesma estrutura. A ordem errada entre gesso e
    // contrapiso não aparece num vínculo: aparece em dezenas deles, um por
    // pavimento e por final.
    //
    // Um achado por vínculo geraria 40 alertas dizendo a mesma coisa, e inverter
    // um só não muda o cronograma da obra — os outros 39 continuariam mandando.
    // Então o achado é UM, do par de serviços, carregando a lista completa de
    // vínculos pra inversão em massa. O pareamento por local sai de graça: cada
    // vínculo já liga o par certo (Final 01/3º andar com Final 01/3º andar), e
    // inverter cada um no lugar preserva isso.
    const paresPrec = new Map();
    for (const t of folhas) {
      const servT = RegrasPrecedencia.classificar(t.nome);
      if (!servT.length) continue;
      if (!rede.nos.get(t.id)) continue;

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
          const k = `${r.regra.antes}>${r.regra.depois}`;
          if (!paresPrec.has(k)) paresPrec.set(k, { regra: r.regra, vinculos: [] });
          paresPrec.get(k).vinculos.push({
            de: p.id, para: t.id, tipo: p.tipo, lag: p.lag,
            nomeDe: alvo.nome || '', nomePara: t.nome || '',
            codDe: alvo.codigo || '', codPara: t.codigo || '',
          });
        }
      }
    }

    for (const [k, grupo] of paresPrec) {
      const r = grupo.regra;
      const V = grupo.vinculos;
      // Se o padrão da própria obra já falou sobre este par, a regra genérica
      // cala a boca. Foi exatamente aqui que a regra errada de impermeabilização
      // teria gerado 42 alertas falsos no RD06.
      const svcA = aprendido ? PadraoAprendido.chaveServico(porId.get(V[0].de) || {}) : '';
      const svcB = aprendido ? PadraoAprendido.chaveServico(porId.get(V[0].para) || {}) : '';
      if (svcA && svcB && parAprendido.has([svcA, svcB].sort().join('~'))) continue;
      // E se o cronograma faz isso de forma CONSISTENTE em muitos lugares, é
      // padrão da empresa, não erro: a regra genérica não tem autoridade pra
      // contrariar dezenas de repetições deliberadas.
      if (aprendido && V.length >= 5) {
        const parObs = aprendido.pares.get(svcA + '>' + svcB);
        const inv = aprendido.pares.get(svcB + '>' + svcA);
        if (parObs && parObs.n >= 5 && (!inv || inv.n === 0)) continue;
      }
      // Quantos desses vínculos tocam o caminho crítico. É o que diz se a
      // inversão muda a data da obra ou só reorganiza folga.
      const noCritico = V.filter(v => {
        const a = rede.nos.get(v.de), b = rede.nos.get(v.para);
        return (a && a.critico) || (b && b.critico);
      }).length;

      const amostra = V.slice(0, 6).map(v => `• ${v.codDe ? v.codDe + ' ' : ''}${v.nomeDe}  →  ${v.codPara ? v.codPara + ' ' : ''}${v.nomePara}`).join('\n');
      add({ chave: `precedencia:${k}`,
        ctx: _assinatura([V.length, V.map(v => `${v.de}>${v.para}:${v.tipo}${v.lag}`).sort().join(',')]),
        // Rebaixada em relação à versão anterior: regra genérica agora é
        // REFERÊNCIA, nunca 'alta'. Ela não conhece a obra; o padrão observado
        // conhece. Só sobe de tom quando o padrão não tem o que dizer.
        tipo: 'precedencia_invertida', severidade: r.severidade === 'alta' ? 'media' : 'baixa',
        tarefaId: V[0].para, tarefaNome: V[0].nomePara, tarefaCodigo: V[0].codPara,
        tarefaId2: V[0].de, tarefaNome2: V[0].nomeDe,
        titulo: V.length === 1
          ? `${RegrasPrecedencia.label(r.depois)} antes de ${RegrasPrecedencia.label(r.antes)}`
          : `${V.length} vínculos põem ${RegrasPrecedencia.label(r.depois)} antes de ${RegrasPrecedencia.label(r.antes)}`,
        detalhe: (V.length === 1
          ? `O cronograma põe "${V[0].nomeDe}" antes de "${V[0].nomePara}". Na execução a ordem costuma ser a inversa.`
          : `${V.length} vínculos em toda a EAP põem ${RegrasPrecedencia.label(r.depois)} antes de ${RegrasPrecedencia.label(r.antes)} — um por local (pavimento, final, torre). Inverter só um não muda o cronograma da obra: todos precisam virar juntos.`)
          + (noCritico ? `\n${noCritico} deles envolvem tarefa no caminho crítico, então a inversão mexe na data final.` : `\nNenhum deles está no caminho crítico: a inversão reorganiza folga, sem mudar a data final.`)
          + (V.length > 1 ? `\n\nPrimeiros:\n${amostra}${V.length > 6 ? `\n… e outros ${V.length - 6}` : ''}` : ''),
        motivo: r.motivo + '\n(Referência genérica de execução, não o padrão desta obra — se aqui é diferente de propósito, registre e ele para de perguntar.)',
        risco: r.risco,
        sugestao: V.length === 1
          ? `Inverter o vínculo: "${V[0].nomePara}" passa a ser predecessora de "${V[0].nomeDe}".`
          : `Inverter os ${V.length} vínculos de uma vez, cada um no seu local. O sistema simula o efeito na data final e no caminho crítico antes de aplicar.`,
        acoes: ['inverter', 'manter', 'ir'],
        dados: { de: V[0].de, para: V[0].para, vinculos: V, noCritico,
          regraAntes: r.antes, regraDepois: r.depois,
          labelAntes: RegrasPrecedencia.label(r.antes), labelDepois: RegrasPrecedencia.label(r.depois) } });
    }

    // REMOVIDA a checagem de "ordem global entre serviços".
    //
    // Ela comparava o PRIMEIRO início do serviço B com o ÚLTIMO término do
    // serviço A na obra inteira, e acusava inversão. Num prédio isso está sempre
    // "invertido" e não é erro: a elétrica do 1º pavimento começa muito antes da
    // alvenaria do 16º terminar — é obra em linha de balanço, andar por andar.
    // No RD06 gerou apontamentos sem sentido ("louças e metais começa antes de
    // instalação hidráulica terminar") pela simples existência de 16 pavimentos.
    //
    // O que ela tentava achar — vínculo faltando entre dois serviços — é feito
    // muito melhor pelo `vinculo_faltando_padrao`, que compara LOCAL POR LOCAL
    // usando o padrão da própria obra, em vez de somar a obra inteira num número.

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

    // ---------- AGREGAÇÃO ----------
    // Rodar isto cru no RD06 (2.439 linhas) devolveu 4.401 pendências, sendo
    // 2.180 de "data divergente" e 1.501 de "folga alta". Painel com 4.401 itens
    // é o mesmo que painel nenhum: ninguém lê, e o que importa afunda no meio.
    //
    // E o número é enganoso: 2.180 datas divergentes NÃO são 2.180 problemas —
    // são UM problema (o cronograma nunca foi recalculado pela própria rede) com
    // 2.180 sintomas. Agregar não é esconder: é dizer a verdade sobre a causa,
    // com a contagem e os exemplos na mão, e uma ação que resolve o conjunto.
    const AGREGAR = {
      data_divergente: { titulo: (n) => `${n} tarefas com data que não bate com a rede`,
        motivo: 'Isto é um problema só: o cronograma não está recalculado pelos próprios vínculos. Enquanto a data gravada não é a que a rede produz, o Gantt mostra uma coisa e a lógica diz outra — e não se sabe qual das duas usar pra cobrar a equipe. Recalcular resolve o conjunto.',
        sugestao: 'Ferramentas › Aplicar Calendário às Datas recalcula a obra inteira e mostra o de/para antes de aplicar.' },
      folga_negativa: { titulo: (n) => `${n} tarefas com folga negativa`,
        motivo: 'Folga negativa quer dizer que o cronograma já é impossível como está: a tarefa teria que terminar antes do que consegue. Em obra com avanço lançado isso costuma ter uma causa só — serviço que começou antes da antecessora terminar, ou tarefa concluída com atraso que não foi replanejada adiante. Enquanto não for resolvido, a data final da obra que o sistema mostra é otimista.',
        sugestao: 'Recalcular as datas (Ferramentas › Aplicar Calendário às Datas) e aceitar a nova data final, ou rever duração e vínculo das tarefas listadas.' },
      folga_alta: { titulo: (n) => `${n} tarefas com folga alta`,
        motivo: 'Folga alta em massa não é conforto: é falta de amarração. Tarefa que pode atrasar meses sem afetar o fim da obra quase sempre não está ligada em quem de fato depende dela — e por isso nunca entra no caminho crítico, escondendo risco real.',
        sugestao: 'Ver os vínculos faltando apontados nesta mesma análise: costumam ser a mesma causa.' },
      sem_sucessora: { titulo: (n) => `${n} tarefas sem sucessora`,
        motivo: 'Sem sucessora a tarefa não empurra nada: atrasar ela não aparece em lugar nenhum, e ela nunca entra no caminho crítico mesmo que na obra real trave a frente seguinte.',
        sugestao: 'Ligar no serviço que vem depois, ou num marco de encerramento da etapa.' },
      sem_predecessora: { titulo: (n) => `${n} tarefas sem predecessora`,
        motivo: 'Data fixa no meio do cronograma: quando a obra atrasa antes dela, ela não anda junto e o cronograma passa a mentir sem ninguém notar.',
        sugestao: 'Amarrar no serviço que precisa terminar antes.' },
      vencida_sem_conclusao: { titulo: (n) => `${n} tarefas com prazo vencido e não concluídas`,
        motivo: 'Tarefa vencida e aberta empurra tudo que depende dela, mas enquanto a data não é revista o cronograma continua mostrando a obra no prazo.',
        sugestao: 'Atualizar o avanço, ou reprogramar e deixar a rede propagar.' },
      lag_alto: { titulo: (n) => `${n} vínculos com defasagem longa`,
        motivo: 'Espera longa embutida em defasagem quase sempre é uma tarefa que existe na obra e não está no cronograma — cura, teste, entrega de material, aprovação. Como defasagem não aparece no Gantt nem no histograma, esse tempo fica invisível.',
        sugestao: 'Onde for cura, teste ou prazo de entrega, criar a tarefa com esse nome e essa duração.' },
      duracao_longa: { titulo: (n) => `${n} tarefas com duração muito longa`,
        motivo: 'Tarefa longa não é medível: o avanço vira chute e o atraso só aparece tarde.',
        sugestao: 'Quebrar por local (pavimento, torre) ou por etapa.' },
      ciclo: { titulo: (n) => `${n} tarefas em dependência circular`,
        motivo: 'Rede de precedência não admite ciclo: não existe ordem possível, então estas tarefas ficam sem data e sem folga calculáveis e saem do caminho crítico sem motivo. É o erro mais grave da lista.',
        sugestao: 'Abrir a coluna Predecessora das tarefas listadas e remover o vínculo que fecha o laço.' },
      perc_sem_inicio_real: { titulo: (n) => `${n} tarefas com avanço lançado e sem início real`,
        motivo: 'Sem início real não há como medir produtividade nem projetar término — o avanço fica sem âncora no tempo e o histórico da equipe não se forma.',
        sugestao: 'Lançar a data em que o serviço começou de verdade.' },
      data_real_futura: { titulo: (n) => `${n} tarefas com data real no futuro`,
        motivo: 'Data real é registro do que aconteceu. No futuro é erro de digitação, e contamina medição, curva S e qualquer projeção.',
        sugestao: 'Corrigir as datas.' },
    };
    const LIMITE_AGREGA = 8;

    const porTipoBruto = new Map();
    for (const a of achados) {
      if (!AGREGAR[a.tipo]) continue;
      if (!porTipoBruto.has(a.tipo)) porTipoBruto.set(a.tipo, []);
      porTipoBruto.get(a.tipo).push(a);
    }
    let finais = achados.filter(a => !AGREGAR[a.tipo] || (porTipoBruto.get(a.tipo) || []).length <= LIMITE_AGREGA);
    for (const [tipo, grupo] of porTipoBruto) {
      if (grupo.length <= LIMITE_AGREGA) continue;
      const cfg = AGREGAR[tipo];
      const sev = grupo.some(a => a.severidade === 'alta') ? 'alta'
        : grupo.filter(a => a.severidade === 'media').length ? 'media' : 'baixa';
      const decididos = grupo.filter(a => a.decidido).length;
      const abertosG = grupo.filter(a => !a.decidido);
      if (!abertosG.length) continue; // tudo já decidido: não reabre agregado
      const amostra = abertosG.slice(0, 10).map(a =>
        `• ${a.tarefaCodigo ? a.tarefaCodigo + ' ' : ''}${a.tarefaNome}${a.detalhe ? ' — ' + a.detalhe.split('\n')[0] : ''}`).join('\n');
      finais.push(_achado({
        chave: `agregado:${tipo}`,
        ctx: _assinatura([abertosG.length]),
        tipo, severidade: sev,
        titulo: cfg.titulo(abertosG.length),
        detalhe: `${abertosG.length} ocorrência(s)${decididos ? `, além de ${decididos} já decidida(s)` : ''}.\n\n${amostra}`
          + (abertosG.length > 10 ? `\n… e outras ${abertosG.length - 10}` : ''),
        motivo: cfg.motivo, sugestao: cfg.sugestao,
        acoes: ['ignorar'],
        dados: { agregado: true, quantidade: abertosG.length,
          itens: abertosG.map(a => ({ id: a.tarefaId, nome: a.tarefaNome, codigo: a.tarefaCodigo, detalhe: a.detalhe })) },
      }));
    }
    achados.length = 0;
    for (const a of finais) achados.push(a);

    const ORDEM_SEV = { alta: 0, media: 1, baixa: 2 };
    achados.sort((x, y) => (ORDEM_SEV[x.severidade] - ORDEM_SEV[y.severidade]) || x.tipo.localeCompare(y.tipo));

    const abertos = achados.filter(a => !a.decidido);
    const porTipo = {};
    for (const a of abertos) porTipo[a.tipo] = (porTipo[a.tipo] || 0) + 1;

    return {
      achados, abertos, rede, aprendido,
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
  function dossie(resultado, limite, tarefas) {
    const lim = limite || 60;
    // O bloco repetitivo é o que torna a conversa em linguagem natural viável.
    // O RD06 tem 2.439 linhas, mas 16 pavimentos são idênticos: o pavimento-tipo
    // são ~60 serviços em ordem cronológica, que cabem numa leitura linha por
    // linha. Vai junto no dossiê pra quem for julgar a sequência ter o recorte
    // certo em vez da planilha inteira.
    let blocoTipo = null;
    const ap = resultado.aprendido;
    if (ap && ap.blocos && ap.blocos.length && typeof PadraoAprendido !== 'undefined') {
      const b = ap.blocos[0];
      if (b.repeticoes >= 3 && tarefas) {
        try { blocoTipo = PadraoAprendido.dossieDoBloco(ap, b, tarefas); } catch (e) { blocoTipo = null; }
      }
    }
    return {
      resumo: resultado.resumo,
      blocoRepetitivo: blocoTipo,
      padraoDaObra: ap ? {
        servicos: ap.resumo.servicos, paresDistintos: ap.resumo.paresDistintos,
        vinculos: ap.resumo.vinculos,
        observacao: 'Estes pares foram CONTADOS no próprio cronograma, não vieram de regra externa.',
      } : null,
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
