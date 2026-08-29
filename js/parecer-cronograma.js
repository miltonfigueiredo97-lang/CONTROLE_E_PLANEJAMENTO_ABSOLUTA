// ============================================================
// Módulo: Parecer do Cronograma
// O planejador que pensa — não o conferente que aponta.
// ============================================================
//
// POR QUE ESTE MÓDULO EXISTE
// O auditor e a análise de cronograma acham DEFEITO: vínculo faltando, folga
// negativa, equipe em 26 locais. Isso é conferência. Um planejador não entrega
// lista de defeito — ele responde:
//
//   1. Onde está o prazo desta obra e QUEM o define
//   2. O que muda a data final, e quanto cada coisa muda
//   3. Onde a obra vai travar antes disso acontecer
//   4. O que fazer nas próximas semanas
//   5. Onde tem prazo sobrando de graça
//
// Isso não é opinião solta: cada resposta é medida. A pergunta "o que ganho se
// acelerar o gesso?" se responde simulando o CPM com o gesso mais rápido e
// comparando a data final. É caro, então roda só nos serviços que realmente
// dominam o caminho crítico — os outros, por definição, não mudam nada.
//
// COMO ISSO FUNCIONA EM QUALQUER OBRA
// Nada aqui é específico do RD06. O módulo descobre sozinho quem são os serviços,
// as frentes e os locais a partir dos campos que a obra já preenche, e mede. Se
// a obra não tiver classificação, ele cai no nome da tarefa e avisa que a leitura
// é mais grossa — em vez de fingir precisão que não tem.

const ParecerCronograma = (() => {

  const MAX_ALAVANCAS = 10;      // simulações de aceleração: cada uma é um CPM inteiro
  const ACELERACAO = 0.75;       // simula o serviço 25% mais rápido
  const JANELA_FOCO = 28;        // dias corridos da janela "próximas semanas"

  const _num = (v) => parseInt(v) || 0;
  const _servico = (t) => String(t.subcategoria || t.categoria || '').trim();
  const _pct = (a, b) => b ? Math.round(a / b * 100) : 0;

  // ============================================================
  function gerar(tarefas, opcoes) {
    const op = opcoes || {};
    const cal = Calendario.normalizar(op.cal);
    const hoje = op.hoje || Calendario.iso(new Date());
    const rede = op.rede || CPM.calcular(tarefas, cal);
    const cron = op.cron || null;

    const sorted = [...(tarefas || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const porId = new Map(sorted.map(t => [t.id, t]));
    const criticas = rede.criticos || [];

    // ---------- 1. ONDE ESTÁ O PRAZO ----------
    // O caminho crítico agrupado por SERVIÇO, não por tarefa. Saber que 250
    // tarefas são críticas não ajuda; saber que 40% do prazo é gesso, sim.
    const pesoServico = new Map();
    for (const no of criticas) {
      const t = porId.get(no.id);
      if (!t) continue;
      const s = _servico(t) || '(sem classificação)';
      if (!pesoServico.has(s)) pesoServico.set(s, { servico: s, dias: 0, tarefas: 0, frentes: new Set() });
      const e = pesoServico.get(s);
      e.dias += _num(t.duracao);
      e.tarefas++;
      if (t.frenteServico) e.frentes.add(String(t.frenteServico).trim());
    }
    const totalDiasCriticos = [...pesoServico.values()].reduce((s, e) => s + e.dias, 0);
    const dominam = [...pesoServico.values()]
      .map(e => ({ ...e, frentes: [...e.frentes], peso: _pct(e.dias, totalDiasCriticos) }))
      .sort((a, b) => b.dias - a.dias);

    const duracaoObra = (rede.iniProjeto && rede.fimProjeto)
      ? Calendario.contarDiasUteis(rede.iniProjeto, rede.fimProjeto, cal) : 0;

    // ---------- 2. AS ALAVANCAS ----------
    // A pergunta é "onde vale a pena investir", e a única resposta honesta é
    // medir: simula a mudança e compara a data final. O resto é palpite.
    //
    // POR QUE POR FRENTE E NÃO SÓ POR SERVIÇO: a primeira versão simulava um
    // serviço por vez e no RD06 cada um ganhava 1 dia — inútil e enganoso. O
    // motivo é estrutural: com o caminho crítico distribuído em dezenas de
    // serviços de peso parecido, acelerar um não move a data, porque o próximo
    // assume o gargalo. Mas EQUIPE é a unidade de decisão real — contratar mais
    // pedreiro acelera TUDO que pedreiro faz. Simular por frente responde a
    // pergunta que o engenheiro de fato faz.
    const simular = (transform) => {
      try {
        const r = CPM.calcular(sorted.map(transform), cal);
        if (!r.fimProjeto || !rede.fimProjeto) return null;
        const ganho = r.fimProjeto < rede.fimProjeto
          ? Calendario.contarDiasUteis(r.fimProjeto, rede.fimProjeto, cal) - 1
          : -(r.fimProjeto > rede.fimProjeto ? Calendario.contarDiasUteis(rede.fimProjeto, r.fimProjeto, cal) - 1 : 0);
        return { ganho, fim: r.fimProjeto };
      } catch (e) { return null; }
    };
    const acelera = (t, aplica) => {
      const c = { ...t };
      if (aplica) { const d = _num(t.duracao); if (d > 1) c.duracao = Math.max(1, Math.round(d * ACELERACAO)); }
      return c;
    };
    const reducao = Math.round((1 - ACELERACAO) * 100);

    // Por FRENTE (a decisão de efetivo)
    const frentesCriticas = new Map();
    for (const no of criticas) {
      const t = porId.get(no.id);
      const f = t && t.frenteServico ? String(t.frenteServico).trim() : '';
      if (!f) continue;
      frentesCriticas.set(f, (frentesCriticas.get(f) || 0) + _num(t.duracao));
    }
    const alavancasFrente = [];
    for (const [frente, dias] of [...frentesCriticas.entries()].sort((a, b) => b[1] - a[1])) {
      const r = simular(t => acelera(t, String(t.frenteServico || '').trim() === frente));
      if (!r || r.ganho <= 0) continue;
      alavancasFrente.push({ tipo: 'frente', nome: frente, diasCriticos: dias, ganho: r.ganho, fimNovo: r.fim, reducao });
    }
    alavancasFrente.sort((a, b) => b.ganho - a.ganho);

    // Por SERVIÇO (a decisão de método)
    const alavancas = [];
    const candidatos = dominam.filter(d => d.dias >= 5).slice(0, MAX_ALAVANCAS);
    for (const d of candidatos) {
      const r = simular(t => acelera(t, _servico(t) === d.servico));
      if (!r || r.ganho <= 0) continue;
      alavancas.push({ tipo: 'servico', servico: d.servico, frentes: d.frentes,
        diasCriticos: d.dias, ganho: r.ganho, fimNovo: r.fim, reducao });
    }
    alavancas.sort((a, b) => b.ganho - a.ganho);

    // TETO: acelerar TODAS as frentes críticas ao mesmo tempo. Diz quanto a obra
    // comprime no melhor caso, e portanto se o problema é efetivo ou é lógica de
    // rede. Se o teto também for pequeno, contratar gente não resolve — o que
    // prende é a sequência, e aí a saída é paralelizar, não acelerar.
    const tetoR = simular(t => acelera(t, frentesCriticas.has(String(t.frenteServico || '').trim())));
    const teto = tetoR ? { ganho: tetoR.ganho, fim: tetoR.fim, reducao } : null;

    // ---------- 3. ONDE VAI TRAVAR ----------
    // Risco = o que já se sabe que vai dar errado antes de dar. Três fontes:
    // frente sem efetivo pro que o cronograma pede, serviço crítico com duração
    // longa demais pra ser controlado, e o que já está atrasado hoje.
    const riscos = [];
    if (cron && cron.cargas) {
      const frentesCriticas = new Set();
      for (const no of criticas) { const t = porId.get(no.id); if (t && t.frenteServico) frentesCriticas.add(String(t.frenteServico).trim()); }
      for (const c of cron.cargas.slice().sort((a, b) => b.pico - a.pico).slice(0, 5)) {
        if (c.pico < 6) continue;
        riscos.push({ tipo: 'efetivo', frente: c.frente, pico: c.pico, quando: c.dataPico,
          critica: frentesCriticas.has(c.frente),
          texto: `${c.frente} precisa estar em ${c.pico} locais ao mesmo tempo em ${c.dataPico}`
            + (frentesCriticas.has(c.frente) ? ' — e esta frente está no caminho crítico, então o que ela não fizer atrasa a obra inteira.' : '.') });
      }
    }
    for (const no of criticas) {
      const t = porId.get(no.id);
      if (!t || _num(t.duracao) < 30) continue;
      riscos.push({ tipo: 'tarefa_longa', id: t.id, nome: t.nome, codigo: t.codigo, dias: _num(t.duracao),
        texto: `"${(t.nome || '').trim()}" tem ${_num(t.duracao)} dias e está no caminho crítico: atraso aqui não tem para onde correr, e tarefa longa só mostra o atraso quando já é tarde.` });
    }
    const atrasadas = criticas.filter(no => {
      const t = porId.get(no.id);
      return t && t.terminoPlanejado && t.terminoPlanejado < hoje
        && (parseFloat(t.percentualConcluido) || 0) < 100;
    });
    if (atrasadas.length) {
      riscos.unshift({ tipo: 'atraso_atual', quantidade: atrasadas.length,
        texto: `${atrasadas.length} tarefa(s) do caminho crítico já passaram da data e não estão concluídas. Enquanto não forem replanejadas, a data final que o sistema mostra é otimista.` });
    }

    // ---------- 4. FOCO DAS PRÓXIMAS SEMANAS ----------
    // O que precisa acontecer pra data não escorregar. Só crítico e só na janela:
    // é a lista que o engenheiro leva pra reunião de segunda.
    const fim = Calendario.addDiasCorridos(hoje, JANELA_FOCO);
    const foco = [];
    for (const no of criticas) {
      const t = porId.get(no.id);
      if (!t) continue;
      const perc = parseFloat(t.percentualConcluido) || 0;
      if (perc >= 100) continue;
      const inicia = no.es && no.es >= hoje && no.es <= fim;
      const termina = no.ef && no.ef >= hoje && no.ef <= fim;
      const emCurso = no.es && no.ef && no.es < hoje && no.ef >= hoje;
      if (!inicia && !termina && !emCurso) continue;
      foco.push({ id: t.id, nome: t.nome, codigo: t.codigo, frente: t.frenteServico || '',
        grupo: t.grupo || '', inicio: no.es, termino: no.ef, perc,
        acao: emCurso ? 'em curso — não pode escorregar' : (inicia ? 'começa nesta janela' : 'termina nesta janela') });
    }
    foco.sort((a, b) => (a.inicio || '').localeCompare(b.inicio || ''));

    // ---------- 5. PRAZO SOBRANDO ----------
    // Onde há folga que não custa nada usar: antecipação possível e frente ociosa.
    const antecipaveis = [];
    for (const no of rede.nos.values()) {
      if (no.emCiclo || no.executado || no.iniciado || no.critico) continue;
      if (no.folgaLivre < 10) continue;
      const t = porId.get(no.id);
      if (!t) continue;
      antecipaveis.push({ id: no.id, nome: t.nome, codigo: t.codigo, folga: Math.round(no.folgaLivre), inicio: no.es });
    }
    antecipaveis.sort((a, b) => b.folga - a.folga);

    const ociosas = [];
    if (cron && cron.ritmos) {
      for (const r of cron.ritmos) {
        if (r.takt <= r.duracaoMedia + 10) continue;
        ociosas.push({ servico: r.servico, ambiente: r.ambiente, takt: r.takt,
          duracao: r.duracaoMedia, ocio: r.takt - r.duracaoMedia, pavimentos: r.pavimentos });
      }
      ociosas.sort((a, b) => (b.ocio * b.pavimentos) - (a.ocio * a.pavimentos));
    }

    // ---------- Qualidade da leitura ----------
    // Um parecer tem que dizer o quanto confiar nele.
    const semClass = sorted.filter(t => {
      const i = sorted.indexOf(t);
      const pai = !!(sorted[i + 1] && (sorted[i + 1].nivel || 0) > (t.nivel || 0));
      return !pai && !_servico(t);
    }).length;
    const folhas = sorted.filter((t, i) => !(sorted[i + 1] && (sorted[i + 1].nivel || 0) > (t.nivel || 0))).length;
    const ressalvas = [];
    if (!cal.ativo) ressalvas.push('O calendário desta obra está desligado: prazos e folgas estão em dias corridos, com fim de semana e feriado contando como dia de obra. Ligue em Configuração da Obra para os números valerem.');
    if (semClass > folhas * 0.2) ressalvas.push(`${semClass} de ${folhas} tarefas estão sem Categoria/Subcategoria, então a leitura por serviço é parcial.`);
    if (rede.ciclos && rede.ciclos.length) ressalvas.push(`${rede.ciclos.length} tarefa(s) em dependência circular ficaram fora do cálculo — o caminho crítico pode mudar depois de resolvê-las.`);
    if (rede.divergentes > folhas * 0.3) ressalvas.push(`${rede.divergentes} tarefas têm data salva diferente da que os vínculos produzem. Este parecer usa a data da REDE; recalcule para os dois baterem.`);

    return {
      prazo: { inicio: rede.iniProjeto, fim: rede.fimProjeto, duracao: duracaoObra,
        tarefasCriticas: criticas.length, diasCriticos: totalDiasCriticos, dominam },
      alavancas, alavancasFrente, teto, riscos, foco, antecipaveis, ociosas, ressalvas,
      resumo: { folhas, semClassificacao: semClass,
        simulacoes: candidatos.length + alavancasFrente.length + 1 },
    };
  }

  // Parecer em texto corrido, na ordem em que um planejador falaria. É isto que
  // vai pro "Copiar parecer" e o que a tela renderiza.
  function texto(p, nomeObra) {
    const L = [];
    const dt = (d) => { if (!d) return '—'; const x = String(d).split('-'); return `${x[2]}/${x[1]}/${x[0]}`; };
    L.push(`PARECER DO CRONOGRAMA${nomeObra ? ' — ' + nomeObra : ''}`);
    L.push('');
    L.push('1. ONDE ESTÁ O PRAZO');
    L.push(`A obra vai de ${dt(p.prazo.inicio)} a ${dt(p.prazo.fim)} — ${p.prazo.duracao} dias úteis.`);
    L.push(`${p.prazo.tarefasCriticas} tarefas estão no caminho crítico: são as que, atrasando um dia, atrasam a obra em um dia.`);
    if (p.prazo.dominam.length) {
      L.push('');
      L.push('O prazo é definido principalmente por:');
      for (const d of p.prazo.dominam.slice(0, 6)) {
        L.push(`  • ${d.servico} — ${d.dias} dias (${d.peso}% do caminho crítico, ${d.tarefas} tarefas${d.frentes.length ? ', frente ' + d.frentes.join('/') : ''})`);
      }
      L.push('');
      L.push('Tudo que não está nesta lista pode atrasar sem mexer na data final. É aqui que a atenção tem que estar.');
    }

    L.push('');
    L.push('2. O QUE MUDA A DATA');
    const red = (p.teto && p.teto.reducao) || (p.alavancasFrente[0] && p.alavancasFrente[0].reducao) || 25;
    if (p.alavancasFrente.length) {
      L.push(`Simulei acelerar em ${red}% o trabalho de cada equipe e medi o efeito na data final:`);
      for (const a of p.alavancasFrente.slice(0, 8)) {
        L.push(`  • ${a.nome}: ganha ${a.ganho} dias (término iria para ${dt(a.fimNovo)}) — ${a.diasCriticos} dias dela estão no caminho crítico`);
      }
      L.push('');
      L.push(`Reforçar ${p.alavancasFrente[0].nome} é o investimento de maior retorno: ${p.alavancasFrente[0].ganho} dias. Nas frentes que não aparecem nesta lista, o mesmo reforço não muda a entrega.`);
    } else {
      L.push('Nenhuma equipe, acelerada isoladamente, antecipa o término.');
    }
    if (p.teto) {
      L.push('');
      if (p.teto.ganho <= 0) {
        L.push(`TETO: mesmo acelerando TODAS as equipes críticas em ${red}% ao mesmo tempo, a data não anda. O que prende esta obra não é produção, é a LÓGICA DA REDE — a sequência obriga esperar. Contratar gente não resolve; o caminho é paralelizar frentes, quebrar tarefa longa e rever vínculo que não precisa existir.`);
      } else {
        L.push(`TETO: acelerando TODAS as equipes críticas em ${red}% ao mesmo tempo, a obra antecipa ${p.teto.ganho} dias (para ${dt(p.teto.fim)}). Esse é o máximo que efetivo compra. O que passar disso só vem de mudar a lógica da rede.`);
        const soma = p.alavancasFrente.reduce((s, a) => s + a.ganho, 0);
        if (soma > p.teto.ganho * 1.3) {
          L.push(`Repare que a soma dos ganhos individuais (${soma} dias) é bem maior que o teto (${p.teto.ganho}): as frentes competem pelo mesmo caminho crítico, então acelerar uma faz a próxima virar gargalo. Não some os ganhos da lista — eles não se acumulam.`);
        } else if (p.teto.ganho > soma * 1.5) {
          L.push(`Repare a diferença: acelerar uma frente por vez rende ${soma} dias somados, mas acelerar todas juntas rende ${p.teto.ganho}. Isso quer dizer que o caminho crítico está DISTRIBUÍDO — assim que uma frente acelera, a próxima assume o gargalo. Reforço isolado quase não muda a entrega; o ganho de verdade só aparece com ação conjunta nas frentes críticas, ou mexendo na lógica da rede.`);
        }
      }
    }
    if (p.alavancas.length) {
      L.push('');
      L.push('Por serviço (decisão de método, não de efetivo):');
      for (const a of p.alavancas.slice(0, 6)) {
        L.push(`  • ${a.servico}: ganha ${a.ganho} dias${a.frentes.length ? ' — frente ' + a.frentes.join('/') : ''}`);
      }
    }

    L.push('');
    L.push('3. ONDE A OBRA VAI TRAVAR');
    if (!p.riscos.length) L.push('Nenhum gargalo evidente de efetivo ou de tarefa longa no caminho crítico.');
    else for (const r of p.riscos.slice(0, 8)) L.push(`  • ${r.texto}`);

    L.push('');
    L.push('4. FOCO DAS PRÓXIMAS SEMANAS');
    if (!p.foco.length) L.push('Nenhuma tarefa crítica na janela das próximas 4 semanas.');
    else {
      L.push(`${p.foco.length} tarefa(s) críticas na janela. Se alguma escorregar, a obra escorrega junto:`);
      for (const f of p.foco.slice(0, 15)) {
        L.push(`  • ${f.codigo ? f.codigo + ' ' : ''}${(f.nome || '').trim()} — ${dt(f.inicio)} a ${dt(f.termino)}${f.frente ? ' [' + f.frente + ']' : ''} · ${f.acao}${f.perc ? ` · ${f.perc}%` : ''}`);
      }
      if (p.foco.length > 15) L.push(`  … e outras ${p.foco.length - 15}`);
    }

    L.push('');
    L.push('5. PRAZO SOBRANDO');
    if (p.antecipaveis.length) {
      L.push(`${p.antecipaveis.length} tarefas podem antecipar sem empurrar ninguém — libera frente mais cedo e tira risco de cima do crítico. As maiores:`);
      for (const a of p.antecipaveis.slice(0, 6)) L.push(`  • ${(a.nome || '').trim()} — até ${a.folga} dias`);
    }
    if (p.ociosas.length) {
      L.push('');
      L.push('Serviços com espera entre pavimentos (equipe termina e só volta depois):');
      for (const o of p.ociosas.slice(0, 6)) {
        L.push(`  • ${o.servico}${o.ambiente ? ' — ' + o.ambiente : ''}: dura ${o.duracao.toFixed(0)}d e só volta em ${o.takt.toFixed(0)}d, ${Math.round(o.ocio)}d parados por ciclo em ${o.pavimentos} pavimentos`);
      }
      L.push('');
      L.push('Cada um desses é uma escolha: puxar o passo e encurtar a obra, ou reduzir a equipe e assumir o ritmo com custo menor. Ficar como está é pagar pelas duas coisas.');
    }
    if (!p.antecipaveis.length && !p.ociosas.length) L.push('Nada de folga relevante sobrando — o cronograma está apertado em todas as frentes.');

    if (p.ressalvas.length) {
      L.push('');
      L.push('RESSALVAS SOBRE ESTE PARECER');
      for (const r of p.ressalvas) L.push(`  • ${r}`);
    }
    return L.join('\n');
  }

  return { gerar, texto };
})();
