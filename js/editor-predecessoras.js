// ============================================================
// Módulo: Editor de Predecessoras
// Corrigir vínculo sem depender da grade do Planejamento.
// ============================================================
//
// POR QUE EXISTE
// O Verificador achava os problemas de vínculo e mandava resolver na grade do
// Planejamento — célula por célula, digitando número de linha, sem ver o nome da
// predecessora e sem saber qual escolher. Numa EAP de 2.400 linhas isso é
// impraticável, e um sistema que aponta 50 problemas e não deixa consertar
// nenhum é pior que um sistema que não aponta nada.
//
// O QUE ELE FAZ
//   • Lista as tarefas de um grupo com a predecessora atual POR NOME
//   • Ao editar, sugere candidatas ordenadas por probabilidade real, não
//     alfabética: o que o padrão da obra usa para aquele serviço vem primeiro
//   • Aceita mais de uma predecessora, com tipo e defasagem
//   • COPIAR PARA BAIXO: mesma predecessora nos irmãos seguintes
//   • COPIAR A SEQUÊNCIA: cada irmão recebe a predecessora EQUIVALENTE no seu
//     próprio local — o 2º pavimento aponta pro 2º, o 3º pro 3º. É a operação
//     que faltava, porque numa EAP repetitiva o vínculo certo nunca é o mesmo
//     objeto, é o correspondente de cada andar.
//
// Este módulo é só CÁLCULO E SUGESTÃO — quem grava é o Planejamento, que já tem
// undo, propagação de data e permissão. Aqui não há acesso a Firestore de
// propósito: dá pra testar tudo com node.

const EditorPredecessoras = (() => {

  const _norm = (s) => String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[°ºª]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  function _parse(canon) {
    if (!canon) return [];
    return String(canon).split(';').map(p => p.trim()).filter(Boolean).map(p => {
      const q = p.split('|');
      return { id: q[0] || '', tipo: (q[1] || 'TI').toUpperCase(), lag: q[2] || '' };
    }).filter(x => x.id);
  }
  function _format(arr) {
    return (arr || []).filter(x => x && x.id).map(x => `${x.id}|${x.tipo || 'TI'}|${x.lag || ''}`).join(';');
  }

  // Número do local, pra casar o equivalente entre pavimentos.
  // "13º PAVIMENTO" -> 13 · "2º SUBSOLO" -> -2 · Térreo -> 0
  function nivelLocal(grupo) {
    const g = _norm(grupo);
    if (!g) return null;
    if (/terreo/.test(g)) return 0;
    let m = g.match(/(\d+)\s*subsolo/); if (m) return -parseInt(m[1]);
    m = g.match(/(\d+)\s*pav/); if (m) return parseInt(m[1]);
    m = g.match(/^(\d+)/); if (m) return parseInt(m[1]);
    return null;
  }

  const servicoDe = (t) => _norm(t.subcategoria) || _norm(t.categoria);

  // Ambiente RELATIVO ao andar. Necessário porque o subgrupo costuma embutir o
  // pavimento: no RD06 o apartamento 1 do 5º pavimento é "51" e o do 4º é "41".
  // Comparar o subgrupo cru nunca casa entre andares, e foi o que impediu o
  // "copiar a sequência" de achar o equivalente. Tirando o prefixo do andar,
  // "51" e "41" viram "1" e casam; "Hall" continua "Hall".
  function ambienteRelativo(t) {
    const amb = _norm(t.subgrupo);
    if (!amb) return '';
    const niv = nivelLocal(t.grupo);
    if (niv === null || niv <= 0) return amb;
    const pref = String(niv);
    if (amb.length > pref.length && amb.startsWith(pref)) return amb.slice(pref.length);
    return amb;
  }

  // ---- Sugestão de candidatas ----
  //
  // A ordem é o que faz a ferramenta útil. Pontuação, do mais forte pro mais fraco:
  //   +100  o padrão da obra liga esse serviço ao serviço da tarefa (aprendido)
  //   + 60  mesmo local (pavimento) — vínculo cruzando andar é raro e suspeito
  //   + 25  mesmo ambiente (Final 01 com Final 01, Hall com Hall)
  //   + 20  termina antes do início atual da tarefa (é cronologicamente possível)
  //   + 15  é o mesmo serviço no local anterior (o trem subindo: gás do 5º depois
  //         do gás do 4º) — padrão altíssimo em obra de edifício
  //   -200  criaria ciclo (a candidata já depende da tarefa, direta ou
  //         indiretamente): fica no fim e marcada, nunca escondida
  function sugerir(tarefas, alvoId, aprendido, limite) {
    const porId = new Map(tarefas.map(t => [t.id, t]));
    const alvo = porId.get(alvoId);
    if (!alvo) return [];
    const sorted = [...tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    for (let i = 0; i < sorted.length; i++) {
      sorted[i]._pai = !!(sorted[i + 1] && (sorted[i + 1].nivel || 0) > (sorted[i].nivel || 0));
    }
    const jaPred = new Set(_parse(alvo.predecessora).map(p => p.id));

    // Quem depende do alvo (direta ou indiretamente) — candidata assim faria ciclo.
    const dependemDoAlvo = new Set();
    const filhosDe = new Map();
    for (const t of sorted) {
      for (const p of _parse(t.predecessora)) {
        if (!filhosDe.has(p.id)) filhosDe.set(p.id, []);
        filhosDe.get(p.id).push(t.id);
      }
    }
    (function marcar(id) {
      for (const f of (filhosDe.get(id) || [])) {
        if (dependemDoAlvo.has(f)) continue;
        dependemDoAlvo.add(f); marcar(f);
      }
    })(alvoId);

    const servAlvo = servicoDe(alvo);
    const nivAlvo = nivelLocal(alvo.grupo);
    const ambAlvo = _norm(alvo.subgrupo);

    // Serviços que o padrão da obra usa como predecessora deste serviço.
    const servPadrao = new Map();
    if (aprendido && aprendido.pares) {
      const kAlvo = aprendido.servicoDe.get(alvoId);
      if (kAlvo) for (const [k, e] of aprendido.pares) if (e.b === kAlvo) servPadrao.set(e.a, e.n);
    }

    const out = [];
    for (const t of sorted) {
      if (t.id === alvoId || t._pai || jaPred.has(t.id)) continue;
      let score = 0; const porques = [];
      const kt = aprendido ? aprendido.servicoDe.get(t.id) : null;
      if (kt && servPadrao.has(kt)) { score += 100; porques.push(`padrão da obra (${servPadrao.get(kt)}×)`); }
      const nivT = nivelLocal(t.grupo);
      if (nivAlvo !== null && nivT === nivAlvo) { score += 60; porques.push('mesmo pavimento'); }
      if (ambAlvo && _norm(t.subgrupo) === ambAlvo) { score += 25; porques.push('mesmo ambiente'); }
      if (t.terminoPlanejado && alvo.inicioPlanejado && t.terminoPlanejado <= alvo.inicioPlanejado) { score += 20; porques.push('termina antes'); }
      if (servAlvo && servicoDe(t) === servAlvo && nivAlvo !== null && nivT === nivAlvo - 1) {
        score += 15; porques.push('mesmo serviço no pavimento anterior');
      }
      const faria = dependemDoAlvo.has(t.id);
      if (faria) { score -= 200; porques.push('ATENÇÃO: criaria dependência circular'); }
      if (score <= 0 && !faria) continue;
      out.push({ id: t.id, nome: t.nome || '', codigo: t.codigo || '', grupo: t.grupo || '',
        subgrupo: t.subgrupo || '', servico: t.subcategoria || t.categoria || '',
        inicio: t.inicioPlanejado || '', termino: t.terminoPlanejado || '',
        score, porque: porques.join(' · '), fariaCiclo: faria });
    }
    out.sort((a, b) => b.score - a.score || (a.codigo || '').localeCompare(b.codigo || ''));
    return out.slice(0, limite || 40);
  }

  // ---- Copiar para baixo: MESMA predecessora nos irmãos seguintes ----
  // Serve quando o vínculo aponta pra algo que não varia por andar (um marco, uma
  // liberação única). Devolve mapa id -> nova predecessora canônica.
  function copiarParaBaixo(tarefas, origemId, alvosIds) {
    const porId = new Map(tarefas.map(t => [t.id, t]));
    const origem = porId.get(origemId);
    if (!origem) return new Map();
    const partes = _parse(origem.predecessora);
    const out = new Map();
    for (const id of alvosIds) {
      const t = porId.get(id);
      if (!t || id === origemId) continue;
      const filtradas = partes.filter(p => p.id !== id);   // nunca se auto-referencia
      const nova = _format(filtradas);
      if (nova !== (t.predecessora || '')) out.set(id, nova);
    }
    return out;
  }

  // ---- Copiar a SEQUÊNCIA ----
  //
  // A operação que faltava. Em EAP repetitiva o vínculo certo não é o mesmo
  // objeto em todos os andares: o gás do 5º depende do gás do 4º, o do 6º depende
  // do 5º. Copiar o mesmo id pra todos criaria 15 tarefas dependendo da mesma.
  //
  // Como funciona: mede o DESLOCAMENTO de local entre a tarefa origem e cada
  // predecessora dela (ex: -1 pavimento, ou 0 = mesmo andar). Em cada tarefa
  // alvo, procura a tarefa do MESMO serviço no local deslocado do mesmo tanto, e
  // usa essa. Se não achar equivalente, aquele alvo é DEVOLVIDO como pendência em
  // vez de receber vínculo errado.
  function copiarSequencia(tarefas, origemId, alvosIds) {
    const porId = new Map(tarefas.map(t => [t.id, t]));
    const origem = porId.get(origemId);
    if (!origem) return { mudancas: new Map(), pendentes: [] };
    const partes = _parse(origem.predecessora);
    const nivOrigem = nivelLocal(origem.grupo);

    // Índice: serviço + ambiente + nível de local -> tarefa
    const sorted = [...tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    for (let i = 0; i < sorted.length; i++) {
      sorted[i]._pai = !!(sorted[i + 1] && (sorted[i + 1].nivel || 0) > (sorted[i].nivel || 0));
    }
    const idx = new Map();
    for (const t of sorted) {
      if (t._pai) continue;
      const n = nivelLocal(t.grupo);
      if (n === null) continue;
      const k = `${servicoDe(t)}|${ambienteRelativo(t)}|${n}`;
      if (!idx.has(k)) idx.set(k, t);
    }

    const mudancas = new Map(), pendentes = [];
    for (const id of alvosIds) {
      const alvo = porId.get(id);
      if (!alvo || id === origemId) continue;
      const nivAlvo = nivelLocal(alvo.grupo);
      if (nivAlvo === null) { pendentes.push({ id, nome: alvo.nome, motivo: 'local sem número de pavimento' }); continue; }

      const novas = [];
      let falhou = null;
      for (const p of partes) {
        const pred = porId.get(p.id);
        if (!pred) continue;
        const nivPred = nivelLocal(pred.grupo);
        if (nivOrigem === null || nivPred === null) {
          // Predecessora fora do trem (marco, serviço único): mantém a mesma.
          novas.push({ id: p.id, tipo: p.tipo, lag: p.lag });
          continue;
        }
        const desloc = nivPred - nivOrigem;
        // O ambiente relativo da predecessora precisa acompanhar o do ALVO, não
        // o da origem: se o gás do apto 1 do 5º depende do gás do apto 1 do 4º,
        // então o gás do apto 2 do 9º depende do gás do apto 2 do 8º.
        const ambRelPred = ambienteRelativo(pred);
        const ambRelOrig = ambienteRelativo(origem);
        const ambBusca = (ambRelPred === ambRelOrig) ? ambienteRelativo(alvo) : ambRelPred;
        const k = `${servicoDe(pred)}|${ambBusca}|${nivAlvo + desloc}`;
        const equiv = idx.get(k);
        if (!equiv) { falhou = `não existe "${pred.subcategoria || pred.categoria || pred.nome}" no ${nivAlvo + desloc}º`; break; }
        if (equiv.id === id) { falhou = 'o equivalente seria a própria tarefa'; break; }
        novas.push({ id: equiv.id, tipo: p.tipo, lag: p.lag });
      }
      if (falhou) { pendentes.push({ id, nome: alvo.nome, motivo: falhou }); continue; }
      if (!novas.length) { pendentes.push({ id, nome: alvo.nome, motivo: 'nenhuma predecessora equivalente encontrada' }); continue; }
      const nova = _format(novas);
      if (nova !== (alvo.predecessora || '')) mudancas.set(id, nova);
    }
    return { mudancas, pendentes };
  }

  // Irmãos: tarefas do mesmo pai, na ordem. É o conjunto sobre o qual as duas
  // operações de cópia agem.
  function irmaosDe(tarefas, alvoId) {
    const sorted = [...tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const i = sorted.findIndex(t => t.id === alvoId);
    if (i < 0) return [];
    const nivel = sorted[i].nivel || 0;
    const out = [];
    for (let j = i; j < sorted.length; j++) {
      const n = sorted[j].nivel || 0;
      if (n < nivel) break;
      if (n === nivel) out.push(sorted[j]);
    }
    for (let j = i - 1; j >= 0; j--) {
      const n = sorted[j].nivel || 0;
      if (n < nivel) break;
      if (n === nivel) out.unshift(sorted[j]);
    }
    return out;
  }

  function paiDe(tarefas, alvoId) {
    const sorted = [...tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const i = sorted.findIndex(t => t.id === alvoId);
    if (i < 0) return null;
    const nivel = sorted[i].nivel || 0;
    for (let j = i - 1; j >= 0; j--) if ((sorted[j].nivel || 0) < nivel) return sorted[j];
    return null;
  }

  return { sugerir, copiarParaBaixo, copiarSequencia, irmaosDe, paiDe, nivelLocal, parse: _parse, format: _format };
})();
