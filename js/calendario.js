// ============================================================
// Módulo: Calendário de Obra
// Dias úteis, feriados brasileiros e exceções — por obra.
// ============================================================
//
// POR QUE ESTE MÓDULO EXISTE SOZINHO
// Planejamento, Medições, Semanal, Histograma, Curva S e Dashboard precisam da
// MESMA conta de dia útil. "Dois caminhos de cálculo que divergem" já quebrou
// este sistema antes (ver PROJETO.md) — aqui existe um caminho só, e todo mundo
// chama ele. Nunca reimplemente conta de dia útil dentro de outro módulo.
//
// FORMATO DE DATA
// Sempre string 'YYYY-MM-DD', nunca objeto Date solto. Toda conversão passa por
// _dt(), que ancora o horário ao MEIO-DIA LOCAL. Motivo:
//   new Date('2026-09-07')  -> meia-noite UTC -> no fuso do Brasil o .getDay()
//   devolve o dia ANTERIOR (sábado 06/09 em vez de segunda 07/09).
// Meio-dia local mata essa classe de erro inteira, e também qualquer resquício
// de horário de verão. Nunca troque _dt() por new Date(string).
//
// REGRA DE PRECEDÊNCIA (do mais forte pro mais fraco) — é isto que resolve todo
// caso duvidoso de calendário:
//   1. Exceção pontual  -> manda em tudo (domingo trabalhado, terça de folga)
//   2. Paralisação      -> faixa de datas parada (exceção pontual ainda vence)
//   3. Feriado          -> salvo se trabalhaFeriado estiver ligado
//   4. Jornada semanal  -> a base
//
// TRAVA DE SEGURANÇA
// Calendário DESLIGADO (ativo:false) => todo dia é útil, e somarDiasUteis vira
// soma de dias corridos. Ou seja: comportamento IDÊNTICO ao que o sistema tinha
// antes deste módulo existir. Nenhuma obra muda de data até alguém ligar o
// calendário na mão, obra por obra.
//
// FORMA DO OBJETO SALVO (campo `calendario` no doc da obra):
//   {
//     ativo: false,
//     jornada: [1,2,3,4,5],                 // 0=dom … 6=sáb — dias trabalhados
//     trabalhaFeriado: false,
//     feriadosAuto: true,                   // gera os nacionais sozinho
//     facultativos: { carnaval:true, corpusChristi:true },  // true = NÃO trabalha
//     feriadosManuais: [{data:'2026-06-24', nome:'São João', tipo:'municipal'}],
//     paralisacoes:    [{ini:'2026-12-20', fim:'2027-01-04', motivo:'Recesso'}],
//     excecoes:        [{data:'2026-09-13', trabalha:true, motivo:'Mutirão da laje'}]
//   }

const Calendario = (() => {

  const MAX_ITER = 20000; // ~55 anos — backstop contra jornada vazia (loop infinito)

  const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const DIAS_LONGO = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

  // ---- Datas ----

  function _dt(s) {
    if (!s) return null;
    if (s instanceof Date) return new Date(s.getFullYear(), s.getMonth(), s.getDate(), 12);
    if (typeof s.toDate === 'function') { const d = s.toDate(); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); }
    const p = String(s).slice(0, 10).split('-').map(Number);
    if (p.length < 3 || !p[0] || !p[1] || !p[2]) return null;
    return new Date(p[0], p[1] - 1, p[2], 12);
  }

  function iso(d) {
    const dt = _dt(d);
    if (!dt) return '';
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  function addDiasCorridos(s, n) {
    const d = _dt(s);
    if (!d) return '';
    d.setDate(d.getDate() + (parseInt(n) || 0));
    return iso(d);
  }

  function nomeDiaSemana(n, longo) {
    n = parseInt(n);
    if (isNaN(n) || n < 0 || n > 6) return '';
    return longo ? DIAS_LONGO[n] : DIAS_CURTO[n];
  }

  function diaSemanaDe(data) {
    const d = _dt(data);
    return d ? d.getDay() : -1;
  }

  // ---- Feriados nacionais: CALCULADOS, nunca baixados ----
  // O sistema é HTML estático e o cálculo de data tem que ser instantâneo e
  // sempre igual. Buscar feriado em API criaria dependência de rede dentro do
  // motor de datas — se a rede cai, a obra fica sem cronograma. Feriado móvel
  // deriva da Páscoa, e a Páscoa é fórmula fechada (Meeus/Jones/Butcher,
  // calendário gregoriano) — nada de tabela pra ficar desatualizada em 2030.

  function _pascoaDt(ano) {
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
    const d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31);
    const dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(ano, mes - 1, dia, 12);
  }

  function pascoa(ano) {
    ano = parseInt(ano) || 0;
    return ano ? iso(_pascoaDt(ano)) : '';
  }

  const FIXOS = [
    ['01-01', 'Confraternização Universal'],
    ['04-21', 'Tiradentes'],
    ['05-01', 'Dia do Trabalho'],
    ['09-07', 'Independência do Brasil'],
    ['10-12', 'Nossa Senhora Aparecida'],
    ['11-02', 'Finados'],
    ['11-15', 'Proclamação da República'],
    ['12-25', 'Natal'],
  ];

  const _cacheAno = new Map();

  // Feriados de um ano.
  //   tipo 'nacional'    = feriado por lei
  //   tipo 'facultativo' = ponto facultativo
  // Carnaval e Corpus Christi NÃO são feriado nacional por lei — na prática a
  // obra para, mas cada empresa decide, então viram toggle (campo `chave`).
  // Sexta-feira Santa é feriado nacional de verdade, por isso entra como tal.
  // 20/11 (Consciência Negra) virou NACIONAL só a partir de 2024 (Lei
  // 14.759/2023) — o gerador respeita o ano, pra não inventar feriado em obra
  // antiga e desalinhar histórico.
  // Feriado estadual/municipal não tem como adivinhar: entra em feriadosManuais.
  function feriadosDoAno(ano) {
    ano = parseInt(ano) || 0;
    if (!ano) return [];
    if (_cacheAno.has(ano)) return _cacheAno.get(ano);

    const out = FIXOS.map(par => ({ data: `${ano}-${par[0]}`, nome: par[1], tipo: 'nacional' }));
    if (ano >= 2024) out.push({ data: `${ano}-11-20`, nome: 'Dia da Consciência Negra', tipo: 'nacional' });

    const pa = _pascoaDt(ano);
    const rel = (n) => { const d = new Date(pa); d.setDate(d.getDate() + n); return iso(d); };
    out.push({ data: rel(-48), nome: 'Carnaval (segunda)', tipo: 'facultativo', chave: 'carnaval' });
    out.push({ data: rel(-47), nome: 'Carnaval (terça)', tipo: 'facultativo', chave: 'carnaval' });
    out.push({ data: rel(-2), nome: 'Sexta-feira Santa', tipo: 'nacional' });
    out.push({ data: rel(60), nome: 'Corpus Christi', tipo: 'facultativo', chave: 'corpusChristi' });

    out.sort((x, y) => x.data < y.data ? -1 : x.data > y.data ? 1 : 0);
    _cacheAno.set(ano, out);
    return out;
  }

  // ---- Normalização ----
  // Qualquer objeto salvo (ou ausente, ou meio preenchido) vira um calendário
  // completo, com os mesmos defaults em todo lugar. Nenhum consumidor precisa
  // checar campo faltando — some uma classe inteira de bug.
  function normalizar(c) {
    c = c || {};
    const fac = c.facultativos || {};
    return {
      ativo: !!c.ativo,
      jornada: (Array.isArray(c.jornada) && c.jornada.length) ? c.jornada.map(Number).filter(n => n >= 0 && n <= 6) : [1, 2, 3, 4, 5],
      // Dias da semana trabalhados em MEIO PERÍODO (subconjunto de jornada).
      // Existe porque muita obra trabalha sábado até o meio-dia, e contar esse
      // sábado como dia cheio infla o cronograma inteiro.
      jornadaMeio: Array.isArray(c.jornadaMeio) ? c.jornadaMeio.map(Number).filter(n => n >= 0 && n <= 6) : [],
      trabalhaFeriado: !!c.trabalhaFeriado,
      feriadosAuto: c.feriadosAuto !== false,
      facultativos: { carnaval: fac.carnaval !== false, corpusChristi: fac.corpusChristi !== false },
      feriadosManuais: Array.isArray(c.feriadosManuais) ? c.feriadosManuais.filter(Boolean) : [],
      paralisacoes: Array.isArray(c.paralisacoes) ? c.paralisacoes.filter(Boolean) : [],
      excecoes: Array.isArray(c.excecoes) ? c.excecoes.filter(Boolean) : [],
      // `aplicado` diz se as datas SALVAS já foram recalculadas com esta régua.
      // Ligar o calendário não mexe em data nenhuma — quem aplica é o
      // Planejamento, de propósito, depois de ver a simulação. Enquanto for
      // false, o Planejamento mostra o aviso de "datas ainda em dias corridos".
      // Qualquer mudança no calendário zera isso (ver salvar()).
      aplicado: !!c.aplicado,
      aplicadoEm: c.aplicadoEm || '',
      _norm: true,
    };
  }

  function _c(c) { return (c && c._norm) ? c : normalizar(c); }

  // Mapa data -> nome do feriado que VALE pra esta obra, no ano pedido.
  // Facultativo desmarcado não entra (a obra trabalha nele).
  const _cacheObra = new Map();
  function _feriadosVigentes(c, ano) {
    const chave = `${ano}|${c.feriadosAuto ? 1 : 0}|${c.facultativos.carnaval ? 1 : 0}|${c.facultativos.corpusChristi ? 1 : 0}`;
    let mapa = _cacheObra.get(chave);
    if (!mapa) {
      mapa = new Map();
      if (c.feriadosAuto) {
        for (const f of feriadosDoAno(ano)) {
          if (f.tipo === 'facultativo' && !c.facultativos[f.chave]) continue;
          mapa.set(f.data, f.nome);
        }
      }
      _cacheObra.set(chave, mapa);
    }
    return mapa;
  }

  // O feriado manual (municipal/estadual) fica fora do cache acima porque muda
  // de obra pra obra — é lookup direto na lista da obra.
  function _nomeFeriado(c, data) {
    const ano = parseInt(String(data).slice(0, 4));
    const auto = _feriadosVigentes(c, ano).get(data);
    if (auto) return auto;
    const man = c.feriadosManuais.find(f => f.data === data);
    return man ? (man.nome || 'Feriado') : null;
  }

  // ---- Perguntas sobre um dia ----

  // Retorna '' se o dia é útil, ou o MOTIVO de não ser. O motivo é o que deixa
  // o sistema EXPLICAR a data ("terminou dia 14 porque 12 e 13 foram fim de
  // semana") em vez de só cuspir um número — e é o que o auditor de
  // planejamento vai usar pra justificar cada achado.
  function motivoNaoUtil(data, cal) {
    const c = _c(cal);
    if (!c.ativo) return '';
    const d = _dt(data);
    if (!d) return '';
    const dia = iso(d);

    const exc = c.excecoes.find(e => e.data === dia);
    if (exc) return exc.trabalha ? '' : ('Exceção: ' + (exc.motivo || 'dia não trabalhado'));

    const par = c.paralisacoes.find(p => p.ini && p.fim && dia >= p.ini && dia <= p.fim);
    if (par) return 'Paralisação: ' + (par.motivo || 'obra parada');

    if (!c.trabalhaFeriado) {
      const nome = _nomeFeriado(c, dia);
      if (nome) return 'Feriado: ' + nome;
    }

    if (!c.jornada.includes(d.getDay())) return 'Fora da jornada: ' + DIAS_LONGO[d.getDay()];

    return '';
  }

  function ehDiaUtil(data, cal) {
    const c = _c(cal);
    if (!c.ativo) return true; // calendário desligado: todo dia conta
    if (!_dt(data)) return true;
    return motivoNaoUtil(data, c) === '';
  }

  // Quanto de jornada este dia rende: 0 (parado), 0.5 (meio período) ou 1.
  //
  // É a base de toda contagem de duração. Um sábado de meio período é dia útil
  // (a obra abre) mas rende metade — então uma tarefa de 6 dias que atravessa um
  // sábado desses termina um dia depois do que terminaria numa semana de 6 dias
  // cheios. É a mesma ideia do MS Project, que mede duração em jornada e não em
  // caixinhas do calendário.
  //
  // LIMITAÇÃO CONHECIDA: exceção com trabalha:true rende dia CHEIO, mesmo que
  // caia num dia da semana marcado como meio período. Exceção é esforço extra
  // (mutirão, concretagem) — meio período excepcional não é suportado.
  function capacidade(data, cal) {
    const c = _c(cal);
    if (!c.ativo) return 1;
    const d = _dt(data);
    if (!d) return 1;
    const dia = iso(d);

    const exc = c.excecoes.find(e => e.data === dia);
    if (exc) return exc.trabalha ? 1 : 0;
    if (!ehDiaUtil(dia, c)) return 0;
    return c.jornadaMeio.includes(d.getDay()) ? 0.5 : 1;
  }

  // ---- Navegação no calendário ----

  // Primeiro dia útil em ou depois de `data`. É o que faz "término da
  // predecessora + lag" cair num dia trabalhado em vez de num domingo.
  function proximoDiaUtil(data, cal) {
    const c = _c(cal);
    let dia = iso(data);
    if (!dia) return '';
    if (!c.ativo) return dia;
    for (let i = 0; i < MAX_ITER; i++) {
      if (ehDiaUtil(dia, c)) return dia;
      dia = addDiasCorridos(dia, 1);
    }
    console.warn('[Calendario] proximoDiaUtil nao achou dia util — jornada vazia?', data);
    return dia;
  }

  function diaUtilAnterior(data, cal) {
    const c = _c(cal);
    let dia = iso(data);
    if (!dia) return '';
    if (!c.ativo) return dia;
    for (let i = 0; i < MAX_ITER; i++) {
      if (ehDiaUtil(dia, c)) return dia;
      dia = addDiasCorridos(dia, -1);
    }
    console.warn('[Calendario] diaUtilAnterior nao achou dia util — jornada vazia?', data);
    return dia;
  }

  // Avança `n` dias ÚTEIS a partir de `data`. n=0 devolve o próprio dia (ou o
  // próximo útil, se cair em folga). Usado pra fechar o término:
  //   termino = somarDiasUteis(inicio, duracao - 1)
  // porque duração conta o dia de início — convenção de obra e do MS Project.
  // n negativo anda pra trás: serve pro vínculo TT/IT, onde o término é a
  // âncora e o início é derivado.
  function somarDiasUteis(data, n, cal) {
    const c = _c(cal);
    let dia = iso(data);
    if (!dia) return '';
    n = parseInt(n) || 0;
    if (!c.ativo) return addDiasCorridos(dia, n); // dias corridos = comportamento antigo

    dia = n < 0 ? diaUtilAnterior(dia, c) : proximoDiaUtil(dia, c);
    if (n === 0) return dia;

    // Acumula CAPACIDADE, não caixinhas de calendário: o dia de partida já
    // conta, e caminha até o acumulado alcançar n+1 jornadas (n passos + o
    // próprio dia inicial). Sem meio período a capacidade é sempre 1 e isso se
    // reduz a "conte n dias úteis", igual antes.
    const passo = n < 0 ? -1 : 1;
    const alvo = Math.abs(n) + 1;
    let acum = capacidade(dia, c) || 1, guard = 0;
    while (acum < alvo && guard++ < MAX_ITER) {
      dia = addDiasCorridos(dia, passo);
      acum += capacidade(dia, c);
    }
    if (guard >= MAX_ITER) console.warn('[Calendario] somarDiasUteis estourou o limite — jornada vazia?', data, n);
    return dia;
  }

  // Jornadas acumuladas de ini até fim, INCLUSIVO nas duas pontas. Pode dar
  // fração quando há meio período (ex: seg a sáb com sábado meio = 5,5).
  function jornadasEntre(ini, fim, cal) {
    const c = _c(cal);
    let a = iso(ini);
    const b = iso(fim);
    if (!a || !b || a > b) return 0;
    if (!c.ativo) return Math.round((_dt(b) - _dt(a)) / 864e5) + 1;
    let n = 0, guard = 0;
    while (a <= b && guard++ < MAX_ITER) {
      n += capacidade(a, c);
      a = addDiasCorridos(a, 1);
    }
    return n;
  }

  // Duração em dias INTEIROS entre duas datas — é o que vai pro campo Duração da
  // tarefa, que é inteiro. Trunca a fração pra manter a ida-e-volta com
  // somarDiasUteis: contarDiasUteis(ini, somarDiasUteis(ini, d-1)) === d.
  // O piso de 1 evita que um único sábado de meio período vire duração zero.
  function contarDiasUteis(ini, fim, cal) {
    const jornadas = jornadasEntre(ini, fim, cal);
    if (!jornadas) return 0;
    return Math.max(1, Math.floor(jornadas));
  }

  // ---- Apoio pra tela ----

  // "Seg a Sex", "Seg a Sáb", "Seg, Qua, Sex" — pra mostrar a jornada sem o
  // usuário decifrar um array de números.
  function resumoJornada(cal) {
    const c = _c(cal);
    const dias = [...c.jornada].sort((a, b) => a - b);
    if (!dias.length) return 'nenhum dia trabalhado';
    const meios = dias.filter(d => c.jornadaMeio.includes(d));
    const cheios = dias.filter(d => !c.jornadaMeio.includes(d));
    const faixa = (arr) => {
      if (!arr.length) return '';
      let seq = true;
      for (let i = 1; i < arr.length; i++) if (arr[i] !== arr[i - 1] + 1) { seq = false; break; }
      if (seq && arr.length > 2) return `${DIAS_CURTO[arr[0]]} a ${DIAS_CURTO[arr[arr.length - 1]]}`;
      return arr.map(d => DIAS_CURTO[d]).join(', ');
    };
    const partes = [faixa(cheios)];
    if (meios.length) partes.push(`${faixa(meios)} ½`);
    return partes.filter(Boolean).join(' + ');
  }

  // Todos os dias não úteis de um mês, com o motivo. Alimenta a prévia visual
  // da tela de configuração — o usuário confere de olho antes de ligar.
  function naoUteisDoMes(ano, mes, cal) {
    const c = _c(cal);
    const out = [];
    if (!c.ativo) return out;
    const ultimo = new Date(ano, mes, 0).getDate();
    for (let d = 1; d <= ultimo; d++) {
      const dia = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const motivo = motivoNaoUtil(dia, c);
      if (motivo) out.push({ data: dia, motivo });
    }
    return out;
  }

  // ---- Persistência ----
  // Mora no doc da obra (obras/{obraId}.calendario), não em subcoleção: é um
  // objeto único por obra e cabe folgado no limite de 1 MB do Firestore.

  async function carregar(obraId) {
    if (!obraId) return normalizar(null);
    try {
      const obra = await Database.getObra(obraId);
      return normalizar(obra && obra.calendario);
    } catch (e) {
      console.error('[Calendario] erro ao carregar:', e);
      return normalizar(null); // falha de rede não pode travar o cronograma: cai no desligado
    }
  }

  // Assinatura da DEFINIÇÃO do calendário (o que muda a conta de dia útil).
  // `aplicado`/`aplicadoEm` ficam fora de propósito: aplicar datas não é mudar
  // a régua. Se a definição muda, as datas salvas viram régua velha de novo.
  function assinatura(cal) {
    const c = _c(cal);
    return JSON.stringify([
      c.ativo, [...c.jornada].sort((a, b) => a - b), [...c.jornadaMeio].sort((a, b) => a - b),
      c.trabalhaFeriado, c.feriadosAuto,
      c.facultativos.carnaval, c.facultativos.corpusChristi,
      c.feriadosManuais.map(f => f.data).sort(),
      c.paralisacoes.map(p => `${p.ini}~${p.fim}`).sort(),
      c.excecoes.map(e => `${e.data}:${e.trabalha ? 1 : 0}`).sort(),
    ]);
  }

  async function salvar(obraId, cal) {
    if (!obraId) throw new Error('obraId ausente');
    const c = normalizar(cal);

    // Mudou a régua => as datas salvas voltam a estar desatualizadas, mesmo que
    // já tivessem sido aplicadas antes. Sem isso, trocar a jornada em silêncio
    // deixaria o cronograma incoerente sem nenhum aviso na tela.
    try {
      const anterior = await carregar(obraId);
      if (assinatura(anterior) !== assinatura(c)) { c.aplicado = false; c.aplicadoEm = ''; }
    } catch (e) { /* sem base de comparação: mantém o que o chamador pediu */ }

    delete c._norm; // flag de runtime, não vai pro banco
    await Database.atualizarObra(obraId, { calendario: c });
    _cacheObra.clear(); // toggles podem ter mudado — invalida o cache de feriados vigentes
    return normalizar(c);
  }

  function limparCache() {
    _cacheObra.clear();
    _cacheAno.clear();
  }

  return {
    normalizar,
    feriadosDoAno,
    pascoa,
    ehDiaUtil,
    capacidade,
    jornadasEntre,
    motivoNaoUtil,
    proximoDiaUtil,
    diaUtilAnterior,
    somarDiasUteis,
    contarDiasUteis,
    iso,
    addDiasCorridos,
    nomeDiaSemana,
    diaSemanaDe,
    resumoJornada,
    naoUteisDoMes,
    assinatura,
    carregar,
    salvar,
    limparCache,
  };
})();
