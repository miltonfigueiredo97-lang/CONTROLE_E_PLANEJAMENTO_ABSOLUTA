// ============================================
// Módulo: TerraplanagemCalculos
// Funções puras de cálculo de corte/aterro de terra
// Port fiel de "Calculadora de Corte de Terra" e
// "Dados dos Caminhões" do Obra Essence V9.6.6
// ============================================

const TerraplanagemCalculos = (() => {
  const fmt2 = v => (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt1 = v => (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const num = v => parseFloat(String(v ?? '').replace(',', '.')) || 0;
  const genId = p => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // Converte string "99.72, 99.31 99 98.65" em array de números (aceita vírgula, espaço ou quebra de linha)
  function parseLista(str) {
    return String(str ?? '').split(/[,\s;]+/).map(s => s.trim()).filter(Boolean).map(s => parseFloat(s.replace(',', '.'))).filter(n => !isNaN(n));
  }

  // ── Área de uma seção via método da profundidade média (cotas + cota final) ──
  // area = Σ [((cota_i - cotaFinal) + (cota_i+1 - cotaFinal)) * distancia_i] / 2
  function calcAreaSecao(cotas, cotaFinal, distancias) {
    const cf = num(cotaFinal);
    let area = 0;
    for (let i = 0; i < cotas.length - 1; i++) {
      const d = distancias[i] ?? 0;
      area += (((cotas[i] - cf) + (cotas[i + 1] - cf)) * d) / 2;
    }
    return area;
  }
  function calcComprimentoSecao(distancias) {
    return distancias.reduce((s, d) => s + (d || 0), 0);
  }

  // ── Volume entre duas seções consecutivas (método das áreas médias) ──
  function calcVolumeEntreSecoes(areaA, areaB, distancia) {
    return ((num(areaA) + num(areaB)) / 2) * num(distancia);
  }

  // ── Volume total de uma lista de seções [{area, distanciaProxima}] ──
  function calcVolumeTotalSecoes(secoes) {
    let total = 0;
    for (let i = 0; i < secoes.length - 1; i++) {
      total += calcVolumeEntreSecoes(secoes[i].area, secoes[i + 1].area, secoes[i].distanciaProxima);
    }
    return total;
  }

  // ── Volume médio entre a análise Horizontal e Vertical (dupla checagem) ──
  function calcVolumeMedio(volHorizontal, volVertical) {
    const vh = num(volHorizontal), vv = num(volVertical);
    if (!vv) return vh;
    return (vh + vv) / 2;
  }

  // ── Empolamento ──
  // Volume solto (para transporte) = Volume médio (banco) × (1 + taxa)
  function calcVolumeComEmpolamento(volumeMedio, taxaEmpolamento) {
    return num(volumeMedio) * (1 + num(taxaEmpolamento));
  }
  // Capacidade efetiva do caminhão em volume de banco (equivalente compactado)
  function calcCapacidadeAjustada(capacidade, taxaEmpolamento) {
    const t = num(taxaEmpolamento);
    return t > 0 ? num(capacidade) / (1 + t) : num(capacidade);
  }
  function calcViagensNecessarias(volume, capacidadeCaminhao) {
    const cap = num(capacidadeCaminhao);
    return cap > 0 ? Math.ceil(num(volume) / cap) : 0;
  }

  const TAMANHOS_CAMINHAO = ['Grande', 'Pequeno'];

  return {
    fmt2, fmt1, num, genId, parseLista,
    calcAreaSecao, calcComprimentoSecao,
    calcVolumeEntreSecoes, calcVolumeTotalSecoes, calcVolumeMedio,
    calcVolumeComEmpolamento, calcCapacidadeAjustada, calcViagensNecessarias,
    TAMANHOS_CAMINHAO,
  };
})();
