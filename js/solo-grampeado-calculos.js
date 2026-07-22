// ============================================
// Módulo: SoloGrampeadoCalculos
// Funções puras de cálculo do controle de solo grampeado
// Port fiel das abas S.GRAMPEADO* do Obra Essence V9.6.6
// ============================================

const SoloGrampeadoCalculos = (() => {
  const fmt2 = v => (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt1 = v => (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const num = v => parseFloat(String(v ?? '').replace(',', '.')) || 0;
  const genId = p => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const TIPOS_CHUMBADOR = ['Vertical', 'Horizontal'];
  // Etapas do chumbador, na ordem — o status é derivado de quais datas estão preenchidas
  const ETAPAS = [
    { key: 'dataFuro', label: 'Furo' },
    { key: 'dataInjecao1', label: 'Injeção 1ª Parte' },
    { key: 'dataInjecao2', label: 'Injeção 2ª Parte' },
    { key: 'dataConclusao', label: 'Concluído' },
  ];

  // Status derivado: última etapa com data preenchida
  function statusChumbador(c) {
    if (c.dataConclusao) return 'Concluído';
    if (c.dataInjecao2) return 'Injeção 2ª Parte';
    if (c.dataInjecao1) return 'Injeção 1ª Parte';
    if (c.dataFuro) return 'Furo feito';
    return 'Pendente';
  }
  function pctChumbador(c) {
    if (c.dataConclusao) return 100;
    if (c.dataInjecao2) return 75;
    if (c.dataInjecao1) return 50;
    if (c.dataFuro) return 25;
    return 0;
  }

  // ml total de um dia de produção (Grampos + Extras + Estacas), port de "ml DIA"
  function mlDiaProducao(p) {
    return (num(p.grampos) * num(p.tamanhoGrampos)) + (num(p.extras) * num(p.tamanhoExtras)) + (num(p.estacas) * num(p.tamanhoEstacas));
  }

  // KPIs agregados dos chumbadores
  function calcKPIsChumbadores(chumbadores) {
    const total = chumbadores.length;
    const concluidos = chumbadores.filter(c => c.dataConclusao).length;
    const mlTotal = chumbadores.reduce((s, c) => s + num(c.comprimento), 0);
    const mlFeito = chumbadores.filter(c => c.dataConclusao).reduce((s, c) => s + num(c.comprimento), 0);
    const verticais = chumbadores.filter(c => c.tipo === 'Vertical').length;
    const horizontais = chumbadores.filter(c => c.tipo === 'Horizontal').length;
    const pct = total > 0 ? (concluidos / total) * 100 : 0;
    return { total, concluidos, mlTotal, mlFeito, verticais, horizontais, pct };
  }

  // Curva de progresso: acumulado de chumbadores concluídos por data de conclusão
  function calcCurvaProgresso(chumbadores) {
    const porData = {};
    chumbadores.forEach(c => {
      if (!c.dataConclusao) return;
      const d = c.dataConclusao;
      porData[d] = (porData[d] || 0) + 1;
    });
    const datas = Object.keys(porData).sort();
    let acumulado = 0;
    const total = chumbadores.length || 1;
    return datas.map(d => {
      acumulado += porData[d];
      return { data: d, feitoNoDia: porData[d], acumulado, pctAcumulado: (acumulado / total) * 100 };
    });
  }

  return {
    fmt2, fmt1, num, genId,
    TIPOS_CHUMBADOR, ETAPAS,
    statusChumbador, pctChumbador, mlDiaProducao,
    calcKPIsChumbadores, calcCurvaProgresso,
  };
})();
