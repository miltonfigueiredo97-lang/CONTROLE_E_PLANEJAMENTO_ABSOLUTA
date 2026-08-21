// ============================================
// Dashboard — Núcleo compartilhado (DashCore)
// Helpers puros usados por todas as seções do Dashboard.
// Cada seção vive no seu próprio arquivo (dashboard-*.js) e recebe um
// contexto { obraId, obra, tarefas, suprimentos } do orquestrador
// (js/dashboard.js) — pra poder mexer numa seção sem tocar nas outras.
// ============================================
const DashCore = (() => {

  // Tarefa-folha pela MESMA lógica já usada (e comprovada) em obras.js e
  // semanal.js: uma tarefa é folha se a próxima na ORDEM tem nível igual ou
  // menor (ninguém "entra" dentro dela). Mais confiável que tipo==='grupo'.
  function folhas(tf) {
    const sorted = [...tf].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const out = [];
    sorted.forEach((t, i) => {
      const nxt = sorted[i + 1];
      if (!nxt || (nxt.nivel || 0) <= (t.nivel || 0)) out.push(t);
    });
    return out;
  }

  // Filhos DIRETOS de um nó, por posição+nível (não existe parentId nos
  // dados) — mesma lógica do Editor de Estrutura do Planejamento.
  function filhosDiretos(pai, sorted) {
    const pn = pai.nivel || 0;
    const pi = sorted.findIndex(t => t.id === pai.id);
    const out = [];
    for (let i = pi + 1; i < sorted.length; i++) {
      const t = sorted[i];
      if ((t.nivel || 0) <= pn) break;
      if ((t.nivel || 0) === pn + 1) out.push(t);
    }
    return out;
  }
  function temFilhos(t, sorted) { return filhosDiretos(t, sorted).length > 0; }

  // Todas as folhas (recursivo) descendentes de um nó.
  function folhasDescendentes(no, sorted) {
    const filhos = filhosDiretos(no, sorted);
    if (!filhos.length) return [no];
    let out = [];
    filhos.forEach(f => { out = out.concat(folhasDescendentes(f, sorted)); });
    return out;
  }

  // Pai direto de um nó (por posição+nível) — usado na auto-configuração
  // das Frentes de Trabalho.
  function paiDireto(t, sorted) {
    const idx = sorted.findIndex(x => x.id === t.id);
    const n = t.nivel || 0;
    for (let i = idx - 1; i >= 0; i--) {
      if ((sorted[i].nivel || 0) < n) return sorted[i];
    }
    return null;
  }

  // Peso de cada tarefa nos cálculos agregados — SEMPRE por duração, nunca
  // por quantidade (regra 5.1 do projeto: por quantidade distorce).
  function peso(t) { return Math.max(1, Number(t.duracao) || 1); }

  // % concluído/esperado + datas agregadas de um conjunto de tarefas.
  function calcProgresso(tf) {
    const leaves = folhas(tf);
    if (!leaves.length) return { percConcluido: 0, percEsperado: 0, inicioReal: null, terminoAtual: null, terminoBase: null };
    let somaPeso = 0, somaConc = 0, somaEsp = 0;
    let terminoAtual = null, terminoBase = null, inicioReal = null;
    leaves.forEach(t => {
      const p = peso(t);
      somaPeso += p;
      somaConc += Math.min(100, Number(t.percentualConcluido) || 0) * p;
      somaEsp += Math.min(100, Number(t.percentualEsperado) || 0) * p;
      const fimA = t.terminoPlanejado ? new Date(t.terminoPlanejado) : null;
      const fimB = (t.terminoPlanejadoBase || t.terminoPlanejado) ? new Date(t.terminoPlanejadoBase || t.terminoPlanejado) : null;
      if (fimA && (!terminoAtual || fimA > terminoAtual)) terminoAtual = fimA;
      if (fimB && (!terminoBase || fimB > terminoBase)) terminoBase = fimB;
      if (t.inicioReal) { const d = new Date(t.inicioReal); if (!inicioReal || d < inicioReal) inicioReal = d; }
    });
    return {
      percConcluido: somaPeso ? somaConc / somaPeso : 0,
      percEsperado: somaPeso ? somaEsp / somaPeso : 0,
      inicioReal, terminoAtual, terminoBase,
    };
  }

  function esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // Remove acentos, símbolo de grau/ordinal (° º) e normaliza espaços e
  // maiúsculas — usado como CHAVE de agrupamento entre módulos diferentes.
  function normalizarChave(s) {
    return String(s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[°º]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Equipe EFETIVA de cada tarefa: considera o Nº Equipe (equipeAlocada) OU
  // a FRENTE DE SERVIÇO — que o Planejamento grava no campo frenteServico
  // (t.frente NÃO existe; esse foi o erro da 1ª tentativa). Preenchida na
  // tarefa-MÃE, as folhas herdam do ancestral mais próximo (a própria
  // vence). Retorna número (Nº Equipe) ou texto (frente).
  function equipesEfetivas(tarefas) {
    const sorted = [...tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const mapa = new Map();
    const pilha = []; // [{nivel, equipe}]
    sorted.forEach(t => {
      const n = t.nivel || 0;
      while (pilha.length && pilha[pilha.length - 1].nivel >= n) pilha.pop();
      const propria = (parseInt(t.equipeAlocada) || 0) || String(t.frenteServico || '').trim() || null;
      const herdada = pilha.length ? pilha[pilha.length - 1].equipe : null;
      const efetiva = propria || herdada;
      mapa.set(t.id, efetiva || null);
      pilha.push({ nivel: n, equipe: efetiva });
    });
    return mapa;
  }

  // Rótulo e selo (badge) de equipe — cor estável por equipe.
  function eqLabel(v) { return typeof v === 'number' ? 'Equipe ' + v : String(v); }
  // Cores SÓLIDAS e firmes, texto branco — evitando vermelho, verde, azul e
  // amarelo (cores de status no sistema). Cor estável por equipe.
  const _EQ_CORES = ['#7c3aed', '#db2777', '#ea580c', '#8b5e34', '#475569', '#a21caf', '#0f172a', '#c2410c'];
  function eqBadge(v) {
    if (!v) return '';
    const s = eqLabel(v);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    const bg = _EQ_CORES[h % _EQ_CORES.length];
    return `<span class="db-eq-badge" style="background:${bg};color:#fff;" title="${esc(s)}">${esc(typeof v === 'number' ? 'EQ ' + v : s)}</span>`;
  }

  return { folhas, filhosDiretos, temFilhos, folhasDescendentes, paiDireto, peso, calcProgresso, esc, normalizarChave, equipesEfetivas, eqLabel, eqBadge };
})();
window.DashCore = DashCore;
