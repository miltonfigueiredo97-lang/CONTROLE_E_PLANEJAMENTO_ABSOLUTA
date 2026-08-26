// ============================================================
// Módulo: Padrão Aprendido
// O cronograma da obra auditando ele mesmo.
// ============================================================
//
// POR QUE ESTE MÓDULO SUBSTITUIU AS REGRAS FIXAS
//
// A primeira versão do auditor comparava o cronograma com uma lista de 18 regras
// de precedência que EU escrevi, genéricas, sem nunca ter olhado um cronograma
// desta empresa. Ao rodar no RD06 ESSENCE RESIDENCE (2.439 linhas) o erro ficou
// evidente: a regra "impermeabilização antes do contrapiso" contrariava o
// cronograma real 42 vezes — e o cronograma estava certo. O contrapiso dá o
// caimento, a impermeabilização vem sobre ele, depois o teste de lâmina d'água,
// depois o revestimento. A regra genérica produziria 42 alertas falsos, e alerta
// falso nessa quantidade faz o usuário abandonar a tela.
//
// A virada: o conhecimento de execução já está no cronograma. O RD06 tem 253
// pares de precedência distintos entre subcategorias — 14× mais que as 18 regras,
// e é conhecimento da própria empresa, não chute de fora.
//
// COMO FUNCIONA
// 1. Cada tarefa recebe uma CHAVE DE SERVIÇO, tirada da Subcategoria que o
//    usuário já preenche (com Categoria como reserva).
// 2. Conta-se quantas vezes cada par (serviço A -> serviço B) aparece como
//    vínculo. Numa obra de edifício isso se repete por pavimento, então o padrão
//    emerge por contagem: 42 vezes num sentido é padrão, 2 no outro é exceção.
// 3. O achado é o DESVIO do padrão da própria obra, com os números na mão:
//    "42 vezes assim, 2 vezes ao contrário, aqui estão as 2". Zero chute.
// 4. Também acha VÍNCULO FALTANDO: se o padrão liga dois serviços em 16
//    pavimentos e num não liga, aquele pavimento tem lógica furada.
//
// DESAMBIGUAÇÃO DE ETAPA — por que existe
// A subcategoria "Demão de Pintura" cobre 1ª e 2ª demão. No RD06 o par
// "Demão de Pintura" × "Instalação de Luminárias" aparece 20× em cada sentido, e
// NÃO é contradição: a sequência real é 1ª demão -> luminárias -> 2ª demão. Sem
// separar as etapas, o motor apontaria 20 erros inexistentes. A etapa é extraída
// do nome quando o ordinal precede uma palavra que também está na subcategoria
// ("1ª Demão Pintura" + subcategoria "Demão de Pintura" => etapa 1). Ordinal de
// pavimento não confunde, porque "Pavimento" não está na subcategoria.
//
// LIMITE HONESTO
// Este módulo detecta INCONSISTÊNCIA INTERNA, não erro absoluto. Se a obra inteira
// fizer algo errado de forma consistente, ele não acusa — não há com o que
// comparar. Para esse caso existem as regras de referência (rebaixadas a semente)
// e a análise por IA sobre o bloco repetitivo. E o inverso também vale: um desvio
// pode ser exceção legítima de local (no RD06, "Concretagem de Laje ->
// Alvenaria Estrutural" 1× contra 27× é o Reservatório, e provavelmente está
// correto). Por isso todo desvio é APONTAMENTO, nunca correção automática.

const PadraoAprendido = (() => {

  const MIN_PADRAO = 3;      // repetições para o sentido majoritário virar "padrão da obra"
  const CONF_MIN = 0.70;     // fração mínima do sentido majoritário
  const MIN_COBERTURA = 4;   // locais com o vínculo para começar a considerar padrão
  // FRAÇÃO mínima de locais que precisam ter o vínculo pra ele ser "o padrão".
  //
  // Bug corrigido: a versão anterior só exigia MIN_COBERTURA=4 locais. No RD06
  // isso apontou "Distribuição Elétrica -> Distribuição de Gás faltando em 12
  // locais" porque o vínculo existia em 4. Mas 4 de 16 não é padrão — é o
  // contrário: em 12 locais NÃO existe, então o padrão da obra é NÃO ter esse
  // vínculo, e os 4 são que estão errados. O gás não depende da elétrica; depende
  // da alvenaria de vedação e do gás do pavimento anterior.
  // Apontar o inverso é pior que ficar calado: manda criar 12 vínculos errados.
  const FRACAO_COBERTURA = 0.6;

  function _norm(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[°ºª]/g, '')
      .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function _predParse(canon) {
    if (!canon) return [];
    return String(canon).split(';').map(p => p.trim()).filter(Boolean).map(p => {
      const q = p.split('|');
      return { id: q[0] || '', tipo: (q[1] || 'TI').toUpperCase(), lag: parseInt(q[2]) || 0 };
    }).filter(x => x.id);
  }

  // Etapa dentro de uma mesma subcategoria: só conta quando o ordinal do nome
  // precede uma palavra que também aparece na subcategoria. Ver comentário no topo.
  function _etapa(nome, subcat) {
    const sc = ' ' + _norm(subcat) + ' ';
    const n = _norm(nome);
    const re = /(\d+)\s+([a-z]+)/g;
    let m;
    while ((m = re.exec(n))) {
      const palavra = m[2];
      if (palavra.length >= 4 && sc.includes(' ' + palavra)) return parseInt(m[1]);
    }
    return 0;
  }

  // Chave de serviço da tarefa. Prefere Subcategoria (a taxonomia que o usuário
  // já mantém), cai em Categoria, e só em último caso no nome.
  function chaveServico(t) {
    const sub = (t.subcategoria || '').trim();
    const cat = (t.categoria || '').trim();
    const base = sub || cat;
    if (!base) return '';
    const e = sub ? _etapa(t.nome, sub) : 0;
    return _norm(base) + (e ? ' #' + e : '');
  }

  function rotuloServico(t) {
    const sub = (t.subcategoria || '').trim();
    const cat = (t.categoria || '').trim();
    const base = sub || cat;
    if (!base) return '';
    const e = sub ? _etapa(t.nome, sub) : 0;
    return base + (e ? ` (${e}ª etapa)` : '');
  }

  // ============================================================
  function aprender(tarefas) {
    const sorted = [...(tarefas || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    for (let i = 0; i < sorted.length; i++) {
      sorted[i]._pai = !!(sorted[i + 1] && (sorted[i + 1].nivel || 0) > (sorted[i].nivel || 0));
    }
    const porId = new Map(sorted.map(t => [t.id, t]));
    const folhas = sorted.filter(t => !t._pai && chaveServico(t));

    const svc = new Map();     // id -> chave de serviço
    const rot = new Map();     // chave -> rótulo legível
    for (const t of folhas) {
      const k = chaveServico(t);
      svc.set(t.id, k);
      if (!rot.has(k)) rot.set(k, rotuloServico(t));
    }

    // ---- Contagem dos pares ----
    const pares = new Map();   // "A>B" -> {a,b,n,vinculos:[]}
    for (const t of folhas) {
      const kb = svc.get(t.id);
      for (const p of _predParse(t.predecessora)) {
        const alvo = porId.get(p.id);
        if (!alvo || alvo._pai) continue;
        const ka = svc.get(alvo.id);
        if (!ka || ka === kb) continue;
        const key = ka + '>' + kb;
        if (!pares.has(key)) pares.set(key, { a: ka, b: kb, n: 0, vinculos: [] });
        const e = pares.get(key);
        e.n++;
        e.vinculos.push({ de: alvo.id, para: t.id, tipo: p.tipo, lag: p.lag,
          nomeDe: alvo.nome || '', nomePara: t.nome || '',
          codDe: alvo.codigo || '', codPara: t.codigo || '',
          grupo: t.grupo || alvo.grupo || '',
          // Vínculo entre ambientes diferentes (Hall x Final 01, por exemplo) é
          // sequenciamento de FRENTE, não ordem tecnológica. Ver a supressão
          // logo abaixo, no cálculo dos desvios.
          mesmoAmbiente: _norm(t.subgrupo) === _norm(alvo.subgrupo) });
      }
    }

    // ---- Desvios do sentido dominante ----
    const desvios = [];
    const visto = new Set();
    for (const [key, e] of pares) {
      const inv = pares.get(e.b + '>' + e.a);
      if (!inv) continue;
      const par = [e.a, e.b].sort().join('~');
      if (visto.has(par)) continue;
      visto.add(par);
      const [forte, fraco] = e.n >= inv.n ? [e, inv] : [inv, e];
      if (forte.n < MIN_PADRAO) continue;                       // padrão fraco: não opina
      const conf = forte.n / (forte.n + fraco.n);
      if (conf < CONF_MIN) continue;                            // empate: não é desvio, são etapas diferentes

      // SUPRESSÃO: se o sentido minoritário liga AMBIENTES DIFERENTES e o
      // majoritário liga o mesmo ambiente, não é ordem tecnológica invertida —
      // é sequência de frente de serviço. No RD06, "1ª Demão Pintura Final 01 ->
      // Massa Corrida Hall" apareceu 16× contra 63× do padrão, e está certo: a
      // equipe pinta os apartamentos e depois o hall daquele pavimento. Apontar
      // isso como erro 16 vezes seria ruído puro.
      const fracoEntreAmbientes = fraco.vinculos.every(v => !v.mesmoAmbiente);
      const forteMesmoAmbiente = forte.vinculos.filter(v => v.mesmoAmbiente).length >= forte.n * 0.6;
      if (fracoEntreAmbientes && forteMesmoAmbiente) continue;
      desvios.push({
        tipo: 'contradicao',
        servicoAntes: forte.a, servicoDepois: forte.b,
        rotuloAntes: rot.get(forte.a) || forte.a, rotuloDepois: rot.get(forte.b) || forte.b,
        n: forte.n, m: fraco.n, confianca: conf,
        vinculos: fraco.vinculos.slice(),
      });
    }

    // ---- Vínculo faltando onde o padrão manda ter ----
    // Se o padrão liga A->B em N locais e existe um local onde os dois serviços
    // aparecem mas não estão ligados, aquele local tem lógica furada. É o erro
    // mais perigoso: nada no sistema reclama de vínculo que não existe.
    const porGrupoServico = new Map();  // grupo -> Map(servico -> [tarefas])
    for (const t of folhas) {
      const g = (t.grupo || '').trim();
      if (!g) continue;
      if (!porGrupoServico.has(g)) porGrupoServico.set(g, new Map());
      const m = porGrupoServico.get(g);
      const k = svc.get(t.id);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(t);
    }
    const faltando = [];
    for (const [key, e] of pares) {
      const inv = pares.get(e.b + '>' + e.a);
      if (inv && inv.n >= e.n) continue;                        // sentido minoritário: já tratado como desvio
      const gruposComVinculo = new Set(e.vinculos.map(v => v.grupo).filter(Boolean));
      if (gruposComVinculo.size < MIN_COBERTURA) continue;      // padrão sem repetição por local: não opina
      const buracos = [];
      for (const [g, m] of porGrupoServico) {
        if (gruposComVinculo.has(g)) continue;
        if (!m.has(e.a) || !m.has(e.b)) continue;               // os dois serviços têm que existir no local
        const alvos = m.get(e.b), origens = m.get(e.a);
        const idsOrigem = new Set(origens.map(x => x.id));
        const ligado = alvos.some(t => _predParse(t.predecessora).some(p => idsOrigem.has(p.id)));
        if (ligado) continue;
        buracos.push({ grupo: g,
          origens: origens.map(x => ({ id: x.id, nome: x.nome, codigo: x.codigo })),
          alvos: alvos.map(x => ({ id: x.id, nome: x.nome, codigo: x.codigo })) });
      }
      if (!buracos.length) continue;
      // O vínculo tem que ser MAIORIA nos locais onde os dois serviços coexistem.
      // Presente em 4 e ausente em 12 significa que o padrão da obra é não ter —
      // e mandar criar os 12 seria propagar o erro. Ver FRACAO_COBERTURA no topo.
      const locaisTotal = gruposComVinculo.size + buracos.length;
      const cobertura = gruposComVinculo.size / locaisTotal;
      if (cobertura < FRACAO_COBERTURA) continue;
      faltando.push({
        tipo: 'faltando',
        servicoAntes: e.a, servicoDepois: e.b,
        rotuloAntes: rot.get(e.a) || e.a, rotuloDepois: rot.get(e.b) || e.b,
        n: e.n, locaisComVinculo: gruposComVinculo.size, locaisTotal, cobertura, buracos,
      });
    }

    // ---- Blocos repetitivos ----
    // Cronograma de edifício é repetitivo: o mesmo conjunto de serviços por
    // pavimento. Identificar o bloco-tipo permite mandar ~100 linhas pra análise
    // em linguagem natural em vez de 2.400 — e o resto é o mesmo padrão.
    const assinaturas = new Map();
    for (const [g, m] of porGrupoServico) {
      const chave = [...m.keys()].sort().join('|');
      if (!assinaturas.has(chave)) assinaturas.set(chave, { servicos: [...m.keys()], grupos: [], tarefas: 0 });
      const a = assinaturas.get(chave);
      a.grupos.push(g);
      for (const arr of m.values()) a.tarefas += arr.length;
    }
    const blocos = [...assinaturas.values()]
      .map(a => ({ grupos: a.grupos, repeticoes: a.grupos.length, servicos: a.servicos.length,
        tarefasPorGrupo: Math.round(a.tarefas / a.grupos.length), tarefasTotal: a.tarefas }))
      .sort((x, y) => y.repeticoes - x.repeticoes || y.tarefasTotal - x.tarefasTotal);

    // ---- Vínculo SOBRANDO: existe na minoria dos locais ----
    // O espelho do "faltando", e o achado que estava saindo invertido. Se dois
    // serviços coexistem em 16 locais e estão ligados em só 4, o padrão da obra é
    // NÃO ligar — então são esses 4 vínculos que estão fora do padrão, não os 12
    // que faltam. No RD06 é o caso de "Distribuição Elétrica -> Distribuição de
    // Gás": gás não depende de elétrica, e os 4 vínculos existentes é que sobram.
    const sobrando = [];
    for (const [key, e] of pares) {
      const inv = pares.get(e.b + '>' + e.a);
      if (inv && inv.n >= e.n) continue;
      const gruposComVinculo = new Set(e.vinculos.map(v => v.grupo).filter(Boolean));
      let coexistem = 0;
      for (const [g, m] of porGrupoServico) if (m.has(e.a) && m.has(e.b)) coexistem++;
      if (coexistem < MIN_COBERTURA + 2) continue;              // poucos locais: não dá base estatística
      const cobertura = gruposComVinculo.size / coexistem;
      if (cobertura >= FRACAO_COBERTURA) continue;              // é padrão, não sobra
      if (gruposComVinculo.size > coexistem * 0.4) continue;    // zona cinzenta: não opina
      sobrando.push({
        tipo: 'sobrando',
        servicoAntes: e.a, servicoDepois: e.b,
        rotuloAntes: rot.get(e.a) || e.a, rotuloDepois: rot.get(e.b) || e.b,
        n: e.n, locaisComVinculo: gruposComVinculo.size, locaisTotal: coexistem, cobertura,
        vinculos: e.vinculos.slice(),
      });
    }

    desvios.sort((x, y) => (y.n + y.m) - (x.n + x.m));
    faltando.sort((x, y) => y.buracos.length - x.buracos.length || y.n - x.n);
    sobrando.sort((x, y) => x.cobertura - y.cobertura || y.n - x.n);

    return {
      pares, servicoDe: svc, rotulos: rot, desvios, faltando, sobrando, blocos,
      resumo: {
        folhas: folhas.length,
        semClassificacao: sorted.filter(t => !t._pai && !chaveServico(t)).length,
        servicos: rot.size,
        paresDistintos: pares.size,
        vinculos: [...pares.values()].reduce((s, e) => s + e.n, 0),
        desvios: desvios.length,
        vinculosSuspeitos: desvios.reduce((s, d) => s + d.m, 0),
        faltando: faltando.length,
        buracos: faltando.reduce((s, f) => s + f.buracos.length, 0),
        sobrando: sobrando.length,
        vinculosSobrando: sobrando.reduce((s, f) => s + f.n, 0),
        blocoMaior: blocos.length ? blocos[0].repeticoes : 0,
      },
    };
  }

  // Sequência de serviços de um bloco (o "pavimento-tipo"), em ordem CRONOLÓGICA
  // real — pela data média de início das tarefas de cada serviço no bloco.
  //
  // Por que não ordenação topológica: ela só respeita as arestas que existem, e
  // entre dois serviços sem vínculo a ordem sai arbitrária. No RD06 isso colocou
  // "Demão de Pintura (1ª etapa)" antes de "Gesso Liso" e "Contrapiso", o que não
  // é a ordem da obra — é só a ausência de aresta entre eles. E é justamente
  // essa ausência que interessa auditar, então a sequência tem que mostrar a
  // realidade das datas, não uma ordem que o grafo tolera.
  //
  // A topológica entra apenas como desempate quando as datas médias empatam.
  function sequenciaDoBloco(aprendido, grupos, tarefas) {
    const alvo = new Set(grupos);
    const acc = new Map(); // servico -> {soma, n, dur, tarefas}
    for (const t of (tarefas || [])) {
      if (!alvo.has((t.grupo || '').trim())) continue;
      const k = aprendido.servicoDe.get(t.id);
      if (!k) continue;
      if (!acc.has(k)) acc.set(k, { soma: 0, n: 0, dur: 0, qtd: 0 });
      const a = acc.get(k);
      a.qtd++;
      a.dur += parseInt(t.duracao) || 0;
      const d = t.inicioPlanejado;
      if (d) { a.soma += Date.parse(d + 'T12:00:00') || 0; a.n++; }
    }
    const lista = [...acc.entries()].map(([servico, a]) => ({
      servico, rotulo: aprendido.rotulos.get(servico) || servico,
      inicioMedio: a.n ? new Date(a.soma / a.n).toISOString().slice(0, 10) : '',
      duracaoMedia: a.qtd ? Math.round(a.dur / a.qtd) : 0,
      tarefas: a.qtd,
    }));
    lista.sort((x, y) => (x.inicioMedio || '9999').localeCompare(y.inicioMedio || '9999') || x.rotulo.localeCompare(y.rotulo));
    return lista;
  }

  // Dossiê de um bloco pra análise em linguagem natural. É o recorte que torna a
  // conversa viável: o RD06 tem 2.439 linhas, mas 16 pavimentos são idênticos —
  // o pavimento-tipo são ~60 serviços, que cabem numa análise linha por linha.
  // O resto da obra é o mesmo padrão replicado, mais os blocos próprios
  // (Térreo, Subsolos, Fachada, Ático), cada um também analisável inteiro.
  function dossieDoBloco(aprendido, bloco, tarefas) {
    const seq = sequenciaDoBloco(aprendido, bloco.grupos, tarefas);
    const alvo = new Set(bloco.grupos);
    const vinculos = [];
    for (const [k, e] of aprendido.pares) {
      const nesse = e.vinculos.filter(v => alvo.has((v.grupo || '').trim()));
      if (!nesse.length) continue;
      vinculos.push({ de: aprendido.rotulos.get(e.a) || e.a, para: aprendido.rotulos.get(e.b) || e.b,
        vezes: nesse.length, tipo: nesse[0].tipo, lag: nesse[0].lag });
    }
    vinculos.sort((a, b) => b.vezes - a.vezes);
    return {
      bloco: { locais: bloco.grupos, repeticoes: bloco.repeticoes, tarefasPorLocal: bloco.tarefasPorGrupo },
      sequencia: seq.map((s, i) => ({ ordem: i + 1, servico: s.rotulo, inicioMedio: s.inicioMedio,
        duracaoMedia: s.duracaoMedia, tarefas: s.tarefas })),
      vinculos,
    };
  }
  return { aprender, sequenciaDoBloco, dossieDoBloco, chaveServico, rotuloServico };
})();
