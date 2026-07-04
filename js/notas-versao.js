// ============================================
// Notas de Versão — Histórico do Sistema
// Versão atual: V1.0.1
// ============================================
const NotasVersao = {
  versaoAtual: 'V1.0.1',
  versoes: [
    {
      versao: 'V1.0',
      status: 'fechada',
      data: '2025-07-04',
      tipo: 'lancamento',
      titulo: 'Lançamento Oficial',
      itens: [
        'Sistema base publicado em produção (Vercel)',
        'Firebase Authentication + Firestore configurado',
        'Identidade visual Absoluta: preto + amarelo #F5C800',
        'Logo oficial integrado em todas as páginas',
        'Card especial da obra Essence com foto',
        'Módulo Obras: CRUD completo',
        'Módulo Configuração da Obra: etapas, pacotes, locais, equipes',
        'Módulo Levantamento de Fachada: calculadora completa',
        '  → Hierarquia: Fachada → Balancim → Vista → Peça',
        '  → Medidas em CM convertidas para m²',
        '  → m² sem ML, m² com ML+ML equivalente, Vão Fechado',
        '  → Checkbox "Pode ser Metro Linear" com cálculo automático',
        '  → Configurações de janela (4 modos) e ML',
        '  → Vão fechado por Vista (não por peça)',
        '  → Campo Acabamento por peça',
        '  → Visão Geral com mapa importável + caixas posicionáveis',
        '  → Exportação CSV',
        'Módulo Planejamento: Gantt, Linha de Balanço, Escadinha, Tabela',
        'Auditoria automática em todas as operações',
        'Permissões por módulo (Admin/User)',
      ]
    },
    {
      versao: 'V1.0.1',
      status: 'aberta',
      data: '2025-07-04',
      tipo: 'correcao',
      titulo: 'Correções e Ajustes',
      itens: [
        'Logout robusto — funciona mesmo com Firebase não inicializado',
        'Fachada: carregar com fallback (evita erro de índice Firestore)',
        'Fachada: múltiplas fachadas abertas simultaneamente na árvore',
        'Fachada: ✎ inline para renomear fachada/balancim direto na árvore',
        'Fachada: Visão Geral aparece antes do Resumo Geral',
        'Fachada: caixa do mapa com modal de edição (nome + vínculo)',
        'Fachada: 🔓/🔒 alterna ao travar caixa',
        'Fachada: canvas branco com padding grande para posicionamento',
        'Fachada: card de total geral com todas as fachadas somadas',
        'Fachada: excluir fachada/balancim com ✕ ao hover na árvore',
        'Obras: editar obra já criada funciona (botão ✎ na tabela)',
        'Router: troca de obra no seletor recarrega módulo automaticamente',
        'Notas de versão criadas (esta tela)',
      ]
    }
  ],

  render(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;

    const versoesPorStatus = {
      aberta: this.versoes.filter(v => v.status === 'aberta'),
      fechada: this.versoes.filter(v => v.status === 'fechada')
    };

    const tipoIcon = { lancamento: '🚀', correcao: '🔧', funcionalidade: '✨', melhoria: '📈' };
    const statusCor = { aberta: '#F5C800', fechada: '#555' };
    const statusLabel = { aberta: 'Em aberto', fechada: 'Fechada' };

    c.innerHTML = `
      <div class="page-header">
        <div>
          <h2>📋 Notas de Versão</h2>
          <span class="subtitulo">Histórico de atualizações do sistema · Versão atual: <strong>${this.versaoAtual}</strong></span>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:16px;">
        ${this.versoes.slice().reverse().map(v => `
          <div style="background:#fff;border-radius:10px;border:1.5px solid ${v.status==='aberta'?'var(--cor-primaria)':'var(--cor-borda-light)'};overflow:hidden;">
            <div style="background:${v.status==='aberta'?'var(--cor-primaria)':'var(--cor-dark-800)'};padding:14px 20px;display:flex;align-items:center;gap:12px;">
              <span style="font-size:1.3rem;">${tipoIcon[v.tipo]||'📌'}</span>
              <div style="flex:1;">
                <div style="font-size:1rem;font-weight:800;color:${v.status==='aberta'?'#000':'#fff'};">${v.versao} — ${v.titulo}</div>
                <div style="font-size:0.75rem;color:${v.status==='aberta'?'rgba(0,0,0,0.6)':'#888'};margin-top:2px;">${new Date(v.data).toLocaleDateString('pt-BR')}</div>
              </div>
              <span style="padding:3px 10px;border-radius:100px;font-size:0.72rem;font-weight:700;background:${v.status==='aberta'?'rgba(0,0,0,0.15)':'rgba(255,255,255,0.1)'};color:${v.status==='aberta'?'#000':'#aaa'};">${statusLabel[v.status]}</span>
            </div>
            <div style="padding:16px 20px;">
              <ul style="list-style:none;display:flex;flex-direction:column;gap:6px;">
                ${v.itens.map(item => `
                  <li style="display:flex;align-items:flex-start;gap:8px;font-size:0.85rem;color:${item.startsWith('  →')?'#777':'var(--cor-texto)'};">
                    <span style="margin-top:2px;color:${item.startsWith('  →')?'#aaa':'var(--cor-primaria-dark)'};font-size:0.7rem;flex-shrink:0;">${item.startsWith('  →')?'↳':'▸'}</span>
                    ${item.replace(/^  →\s*/,'')}
                  </li>
                `).join('')}
              </ul>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
};
