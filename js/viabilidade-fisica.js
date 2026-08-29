// ============================================================
// Módulo: Viabilidade Física
// "Isso é possível de executar?" — linha por linha.
// ============================================================
//
// A PERGUNTA QUE ESTE MÓDULO RESPONDE, E QUE NENHUM OUTRO RESPONDIA
//
// O auditor pergunta se a REDE está bem montada. O padrão aprendido pergunta se
// aquilo é DIFERENTE do que a obra faz em outros lugares. A análise de cronograma
// pergunta se a EQUIPE cabe. Nenhuma delas pergunta a mais básica de todas:
//
//     dá pra fazer isso, na ordem em que está escrito?
//
// Como se faz o gesso do 1º andar sem a laje do 1º andar existir? Não se faz —
// não é ruim, não é fora do padrão, é IMPOSSÍVEL. E se o cronograma diz que sim,
// aquela data é ficção, e tudo que depende dela também.
//
// Isso não é estatística nem boa prática: é a ordem em que um prédio é
// construído. Um serviço precisa que exista o suporte onde ele vai ser feito.
//
// AS CAMADAS FÍSICAS
// Toda obra de edifício sobe nesta ordem, e ela não é opinável:
//
//   1 SUPORTE     estrutura, laje, alvenaria estrutural — o local passa a existir
//   2 VEDAÇÃO     alvenaria, encunhamento, shaft — o ambiente ganha parede
//   3 EMBUTIDO    elétrica, hidráulica, gás, contramarco — vai DENTRO da parede
//   4 FECHAMENTO  reboco, contrapiso, gesso, forro — cobre o embutido
//   5 ACABAMENTO  revestimento, piso, pintura, louça, luminária, bancada
//   6 ENTREGA     limpeza fina, vistoria
//
// Uma tarefa da camada N no local L exige que as camadas anteriores DAQUELE MESMO
// LOCAL já existam. Camada 1 é a mais forte: sem ela o local não existe, e
// qualquer coisa marcada ali é impossível, não apenas apressada.
//
// DUAS CHECAGENS, LINHA POR LINHA, EM TODAS AS TAREFAS
//
//   A) DATA IMPOSSÍVEL — a tarefa começa antes de a camada anterior do mesmo
//      local terminar. Não olha vínculo: olha data. É a checagem mais forte,
//      porque independe de o cronograma estar amarrado ou não.
//
//   B) SEM AMARRA NO SUPORTE — a tarefa não tem caminho de dependência, nem
//      indireto, até a estrutura do próprio local. A data pode estar certa hoje
//      por coincidência; quando a estrutura atrasar, esta tarefa não anda junto e
//      passa a estar marcada onde ainda não existe piso.
//
// NADA AQUI É ESPECÍFICO DE UMA OBRA. As camadas são reconhecidas por vocabulário
// de construção, e onde o serviço não é reconhecido o módulo fica CALADO em vez
// de chutar — dizer que algo é impossível sem ter certeza é pior que não dizer.

const ViabilidadeFisica = (() => {

  const _norm = (s) => String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[°ºª]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  // A ordem física. `exige` diz de quais camadas anteriores esta depende no
  // mesmo local — nem toda camada depende de todas, e afirmar demais gera falso
  // positivo (foi o erro das regras genéricas da primeira versão).
  const CAMADAS = [
    // Inclui a INFRAESTRUTURA ENTERRADA (drenagem, regularização de solo, aterro,
    // impermeabilização de fundação): esses serviços vêm ANTES da laje, não
    // depois. Classificá-los como embutido fazia o módulo dizer que a drenagem do
    // subsolo era impossível por começar antes da estrutura do subsolo — quando é
    // exatamente assim que se constrói.
    { n: 1, id: 'suporte', nome: 'estrutura do local', exige: [],
      termos: ['estrutura', 'laje', 'concretagem', 'alvenaria estrutural', 'pilar', 'viga',
               'forma', 'armacao', 'escoramento', 'fundacao', 'estaca', 'sapata', 'baldrame', 'radier',
               'drenagem', 'regularizacao solo', 'regularizacao de solo', 'aterro', 'compactacao',
               'escavacao', 'reaterro', 'infra drenagem', 'solo grampeado', 'contencao'] },
    { n: 2, id: 'vedacao', nome: 'vedação', exige: [1],
      termos: ['alvenaria de vedacao', 'alvenaria vedacao', 'vedacao', 'encunhamento',
               'fechamento de shaft', 'shaft', 'churrasqueira', 'divisoria'] },
    { n: 3, id: 'embutido', nome: 'instalação embutida', exige: [1],
      termos: ['eletrica', 'eletrico', 'eletroduto', 'hidraulica', 'hidraulico', 'esgoto',
               'prumada', 'tubulacao', 'gas', 'frigorigena', 'dreno', 'ar condicionado',
               'contramarco', 'batente', 'quadro eletrico', 'fiacao', 'cabeamento', 'incendio',
               'infraestrutura', 'cavalete', 'drenagem'] },
    { n: 4, id: 'fechamento', nome: 'fechamento', exige: [1],
      termos: ['reboco', 'emboco', 'emboso', 'chapisco', 'massa unica', 'contrapiso',
               'regularizacao', 'gesso', 'forro', 'drywall', 'sanca', 'impermeabilizacao'] },
    { n: 5, id: 'acabamento', nome: 'acabamento', exige: [1],
      termos: ['revestimento', 'porcelanato', 'ceramica', 'piso', 'azulejo', 'rejunte',
               'pintura', 'massa corrida', 'selador', 'latex', 'textura', 'louca', 'metais',
               'luminaria', 'rodape', 'bancada', 'granito', 'marmore', 'soleira', 'peitoril',
               'esquadria', 'vidro', 'guarda corpo', 'corrimao', 'porta', 'acabamento',
               'serralheria', 'kit porta'] },
    { n: 6, id: 'entrega', nome: 'entrega', exige: [1],
      termos: ['limpeza', 'vistoria', 'check list', 'checklist', 'entrega', 'retoque',
               'ajustes de vistoria', 'sinalizacao', 'comunicacao visual'] },
  ];

  // Serviços que NÃO pertencem a nenhuma camada e não devem ser cobrados: são
  // atividades de canteiro, administrativas ou de mobilização, que não dependem
  // do local estar construído.
  const NEUTROS = ['canteiro', 'mobilizacao', 'desmobilizacao', 'projeto', 'aprovacao',
    'licenca', 'documentacao', 'grua', 'elevador de obra', 'tapume', 'terraplanagem',
    'servicos iniciais', 'administracao', 'seguranca', 'equipamento provisorio'];

  function camadaDe(t) {
    const txt = ' ' + _norm((t.subcategoria || '') + ' ' + (t.categoria || '') + ' ' + (t.nome || '')) + ' ';
    if (NEUTROS.some(x => txt.includes(' ' + x))) return null;
    // Casa da camada mais específica pra mais genérica: "alvenaria estrutural" é
    // suporte, "alvenaria de vedação" é vedação, e ambas contêm "alvenaria".
    let achada = null;
    for (const c of CAMADAS) {
      for (const termo of c.termos) {
        if (!txt.includes(' ' + termo)) continue;
        // Quem casa com termo mais longo ganha: é o mais específico.
        if (!achada || termo.length > achada.termo.length) achada = { camada: c, termo };
      }
    }
    return achada ? achada.camada : null;
  }

  // O local físico. Sem local não há como falar de suporte: a checagem é sempre
  // "a estrutura DESTE andar", nunca "a estrutura em geral".
  function localDe(t) {
    const g = String(t.grupo || '').trim();
    return g || null;
  }

  function _predParse(canon) {
    if (!canon) return [];
    return String(canon).split(';').map(p => p.trim()).filter(Boolean)
      .map(p => (p.split('|')[0] || '')).filter(Boolean);
  }

  // ============================================================
  function analisar(tarefas, opcoes) {
    const op = opcoes || {};
    const cal = Calendario.normalizar(op.cal);
    const decisoes = op.decisoes || new Map();

    const sorted = [...(tarefas || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    for (let i = 0; i < sorted.length; i++) {
      sorted[i]._pai = !!(sorted[i + 1] && (sorted[i + 1].nivel || 0) > (sorted[i].nivel || 0));
    }
    const folhas = sorted.filter(t => !t._pai);
    const porId = new Map(folhas.map(t => [t.id, t]));

    // Classifica cada tarefa: camada física + local.
    const info = new Map();
    for (const t of folhas) {
      const c = camadaDe(t), l = localDe(t);
      info.set(t.id, { camada: c, local: l, t });
    }

    // Por local: quando cada camada começa e termina.
    const porLocal = new Map();
    for (const t of folhas) {
      const i = info.get(t.id);
      if (!i.camada || !i.local) continue;
      if (!t.inicioPlanejado || !t.terminoPlanejado) continue;
      if (!porLocal.has(i.local)) porLocal.set(i.local, new Map());
      const m = porLocal.get(i.local);
      const k = i.camada.n;
      if (!m.has(k)) m.set(k, { n: k, camada: i.camada, ini: t.inicioPlanejado,
        fim: t.terminoPlanejado, primeiroFim: t.terminoPlanejado, tarefas: [] });
      const e = m.get(k);
      if (t.inicioPlanejado < e.ini) e.ini = t.inicioPlanejado;
      if (t.terminoPlanejado > e.fim) e.fim = t.terminoPlanejado;
      // PRIMEIRO término da camada: é a referência da checagem de impossibilidade.
      // Usar o ÚLTIMO seria agressivo demais — num local grande como o Térreo, uma
      // única estrutura tardia jogava o limite pra frente e transformava serviço
      // legítimo em "impossível". A pergunta certa é "já existe ALGUMA parte
      // pronta aqui quando isto começa?", não "está tudo pronto?".
      if (t.terminoPlanejado < e.primeiroFim) e.primeiroFim = t.terminoPlanejado;
      e.tarefas.push(t);
    }

    // ---- Alcance do suporte, por propagação na ordem da rede ----
    // Uma tarefa "alcança o suporte do local L" se ela é suporte de L, ou se
    // alguma predecessora dela alcança. Propaga em ordem topológica, então uma
    // passada resolve a transitividade inteira.
    const grau = new Map(), saidas = new Map();
    for (const t of folhas) { grau.set(t.id, 0); saidas.set(t.id, []); }
    for (const t of folhas) {
      for (const p of _predParse(t.predecessora)) {
        if (!porId.has(p)) continue;
        saidas.get(p).push(t.id);
        grau.set(t.id, grau.get(t.id) + 1);
      }
    }
    const fila = [...grau.keys()].filter(id => !grau.get(id));
    const alcanca = new Map();  // id -> Set de locais cujo SUPORTE ele alcança
    for (const t of folhas) alcanca.set(t.id, new Set());
    const ordem = [];
    while (fila.length) {
      const id = fila.shift(); ordem.push(id);
      const i = info.get(id);
      const s = alcanca.get(id);
      if (i.camada && i.camada.n === 1 && i.local) s.add(i.local);
      for (const d of saidas.get(id)) {
        const sd = alcanca.get(d);
        for (const x of s) sd.add(x);
        grau.set(d, grau.get(d) - 1);
        if (!grau.get(d)) fila.push(d);
      }
    }
    const emCiclo = new Set(folhas.map(t => t.id).filter(id => !ordem.includes(id)));

    // ---- LINHA POR LINHA ----
    const achados = [];
    const vistoria = { total: folhas.length, avaliadas: 0, semCamada: 0, semLocal: 0,
      semData: 0, emCiclo: emCiclo.size, ok: 0 };

    for (const t of folhas) {
      const i = info.get(t.id);
      if (!i.camada) { vistoria.semCamada++; continue; }
      if (!i.local) { vistoria.semLocal++; continue; }
      if (!t.inicioPlanejado) { vistoria.semData++; continue; }
      vistoria.avaliadas++;

      const camadasLocal = porLocal.get(i.local);
      let problema = false;

      // (A) DATA IMPOSSÍVEL — começa antes de a camada anterior do mesmo local
      //     terminar. Não depende de vínculo: é a data contra a realidade física.
      if (camadasLocal) {
        for (const exigeN of i.camada.exige) {
          const base = camadasLocal.get(exigeN);
          if (!base) continue;                       // aquela camada não existe neste local
          const limite = base.primeiroFim;           // ver comentário em primeiroFim
          if (t.inicioPlanejado >= limite) continue;
          const dias = Calendario.jornadasEntre(t.inicioPlanejado, limite, cal) - 1;
          if (dias <= 0) continue;
          const grave = exigeN === 1;
          problema = true;
          achados.push({
            chave: `fisica:${t.id}:${exigeN}`,
            ctx: `${t.inicioPlanejado}|${limite}`,
            tipo: grave ? 'impossivel_sem_suporte' : 'antecede_camada',
            severidade: grave ? 'alta' : 'media',
            tarefaId: t.id, tarefaNome: t.nome, tarefaCodigo: t.codigo,
            titulo: grave
              ? `Começa antes de existir ${base.camada.nome}: ${(t.nome || '').trim()}`
              : `${(t.nome || '').trim()} começa antes de terminar ${base.camada.nome} do local`,
            detalhe: `${(t.nome || '').trim()} está marcada para começar em ${t.inicioPlanejado}, `
              + `mas a primeira ${base.camada.nome} de ${i.local} só fica pronta em ${limite} — ${dias} dia(s) depois.\n`
              + `Base: ${base.tarefas.slice(0, 3).map(x => `"${(x.nome || '').trim()}"`).join(', ')}${base.tarefas.length > 3 ? ` e mais ${base.tarefas.length - 3}` : ''}.`,
            motivo: grave
              ? `Não é uma questão de ser cedo demais: é impossível. Sem ${base.camada.nome} de ${i.local} executada, não existe onde fazer este serviço. A data está marcada num lugar que ainda não existe, e tudo que depende dela herda essa ficção.`
              : `${i.camada.nome[0].toUpperCase() + i.camada.nome.slice(1)} sobre ${base.camada.nome} que ainda não terminou significa uma das duas: ou a equipe vai encontrar a frente ocupada e esperar, ou vai executar sobre base incompleta e refazer depois.`,
            sugestao: grave
              ? `Amarrar esta tarefa em ${base.camada.nome} de ${i.local} e deixar a rede recalcular a data.`
              : `Conferir se as duas frentes realmente se sobrepõem neste local, ou amarrar uma na outra.`,
            acoes: ['ir', 'manter', 'ignorar'],
            dados: { local: i.local, camada: i.camada.id, camadaBase: base.camada.id,
              inicio: t.inicioPlanejado, baseFim: limite, dias,
              candidatos: base.tarefas.slice(0, 20).map(x => ({ id: x.id, nome: x.nome, codigo: x.codigo, termino: x.terminoPlanejado })) },
          });
        }
      }

      // (B) SEM AMARRA NO SUPORTE — a data pode estar certa hoje por acaso, mas a
      //     tarefa não está presa à estrutura do próprio local. Quando a estrutura
      //     atrasar, esta não anda junto e vira data impossível sem ninguém ver.
      if (i.camada.n >= 2 && !emCiclo.has(t.id)) {
        const temSuporteNoLocal = camadasLocal && camadasLocal.has(1);
        if (temSuporteNoLocal && !alcanca.get(t.id).has(i.local)) {
          problema = true;
          const base = camadasLocal.get(1);
          achados.push({
            chave: `sem_amarra:${t.id}`,
            ctx: `${t.inicioPlanejado}`,
            tipo: 'sem_amarra_suporte', severidade: 'media',
            tarefaId: t.id, tarefaNome: t.nome, tarefaCodigo: t.codigo,
            titulo: `Não depende da estrutura do próprio local: ${(t.nome || '').trim()}`,
            detalhe: `Esta tarefa é de ${i.local} mas não tem nenhum caminho de dependência, nem indireto, até a estrutura de ${i.local}.\n`
              + `A estrutura do local está em: ${base.tarefas.slice(0, 3).map(x => `"${(x.nome || '').trim()}"`).join(', ')}${base.tarefas.length > 3 ? ` e mais ${base.tarefas.length - 3}` : ''}.`,
            motivo: 'Hoje a data pode até estar depois da estrutura, mas isso é coincidência e não regra: nada obriga. Quando a estrutura atrasar — e estrutura atrasa — esta tarefa não anda junto, e o cronograma passa a marcar serviço num pavimento que ainda não foi concretado, sem que nada reclame.',
            sugestao: `Amarrar esta tarefa, direta ou indiretamente, na estrutura de ${i.local}.`,
            acoes: ['ir', 'manter', 'ignorar'],
            dados: { local: i.local, camada: i.camada.id,
              candidatos: base.tarefas.slice(0, 20).map(x => ({ id: x.id, nome: x.nome, codigo: x.codigo, termino: x.terminoPlanejado })) },
          });
        }
      }

      if (!problema) vistoria.ok++;
    }

    // Memória de decisão
    for (const a of achados) {
      const d = decisoes.get ? decisoes.get(a.chave) : decisoes[a.chave];
      if (!d || (d.ctx || '') !== (a.ctx || '')) continue;
      a.decidido = true; a.decisao = d;
    }

    const ORDEM = { alta: 0, media: 1, baixa: 2 };
    achados.sort((x, y) => ORDEM[x.severidade] - ORDEM[y.severidade]
      || (y.dados.dias || 0) - (x.dados.dias || 0));
    const abertos = achados.filter(a => !a.decidido);

    // Agrupa por padrão pra tela: 40 gessos antes da laje são 1 problema com 40
    // ocorrências, não 40 problemas.
    const grupos = new Map();
    for (const a of abertos) {
      const k = `${a.tipo}|${a.dados.camada}|${a.dados.camadaBase || '-'}`;
      if (!grupos.has(k)) grupos.set(k, { tipo: a.tipo, severidade: a.severidade,
        camada: a.dados.camada, camadaBase: a.dados.camadaBase || '', itens: [] });
      grupos.get(k).itens.push(a);
    }

    // Buracos no formato que o Planejamento usa pra criar vínculo em massa,
    // pareado por local: origens = a estrutura daquele local, alvos = as tarefas
    // que não a alcançam. Um por grupo de problema.
    for (const [k, g] of grupos) {
      const porLoc = new Map();
      for (const a of g.itens) {
        const loc = a.dados.local;
        if (!loc) continue;
        if (!porLoc.has(loc)) porLoc.set(loc, { grupo: loc, origens: a.dados.candidatos || [], alvos: [] });
        porLoc.get(loc).alvos.push({ id: a.tarefaId, nome: a.tarefaNome, codigo: a.tarefaCodigo });
      }
      g.buracos = [...porLoc.values()].filter(b => b.origens.length && b.alvos.length);
      g.locais = g.buracos.length;
    }

    return {
      achados, abertos, vistoria,
      grupos: [...grupos.values()].sort((a, b) => ORDEM[a.severidade] - ORDEM[b.severidade] || b.itens.length - a.itens.length),
      resumo: {
        total: folhas.length, avaliadas: vistoria.avaliadas, ok: vistoria.ok,
        naoReconhecidas: vistoria.semCamada, semLocal: vistoria.semLocal, semData: vistoria.semData,
        problemas: abertos.length,
        alta: abertos.filter(a => a.severidade === 'alta').length,
        media: abertos.filter(a => a.severidade === 'media').length,
      },
    };
  }

  function camadas() { return CAMADAS.map(c => ({ n: c.n, id: c.id, nome: c.nome })); }

  return { analisar, camadaDe, localDe, camadas };
})();
