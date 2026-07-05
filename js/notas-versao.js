// ============================================
// Notas de Versão — Histórico do Sistema
// REGRA: atualizar a cada commit
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
      titulo: 'Lançamento Oficial da Base',
      itens: [
        'Sistema publicado em produção (Vercel)',
        'Firebase Authentication + Firestore + Storage configurados',
        'Identidade visual Absoluta: preto + amarelo #F5C800',
        'Logo oficial Absoluta integrado em todas as páginas',
        'Sidebar escura com navegação completa',
        'Header com borda amarela inferior',
        'Card especial da obra Essence/Zenith com foto',
        'Módulo Obras: criar, listar, editar, excluir',
        'Módulo Configuração da Obra: etapas, pacotes, locais, equipes',
        'Módulo Levantamentos (hub): acesso às calculadoras',
        'Módulo Levantamento de Fachada — calculadora completa',
        '  → Hierarquia: Fachada → Balancim → Vista → Peça',
        '  → Medidas em CM, convertidas automaticamente para m²',
        '  → m² sem ML (tudo como área)',
        '  → m² com ML (peças ML saem do m², viram metro linear)',
        '  → Equivalente: m² + ML/2 = total',
        '  → Vão fechado por Vista (campo no balancim)',
        '  → Checkbox "Pode ser Metro Linear" no modal de peça',
        '  → ⚙️ Configurações de cálculo: 4 modos de janela, regra ML',
        '  → Visão Geral: mapa importável com caixas posicionáveis',
        '  → Excluir fachada/balancim com ✕ na árvore',
        '  → Exportação CSV',
        'Módulo Planejamento V1: Gantt, Linha de Balanço, Escadinha, Tabela',
        'Auditoria automática em todas as operações',
        'Permissões por módulo (Admin / Usuário)',
      ]
    },
    {
      versao: 'V1.0.1',
      status: 'aberta',
      data: '2025-07-04',
      tipo: 'correcao',
      titulo: 'Correções críticas de autenticação e dados',
      itens: [
        'CRÍTICO: firebase-config.js reutiliza app existente (não chama initializeApp 2x)',
        '  → Era o bug raiz que causava logout ao navegar entre páginas',
        '  → firebase.apps.length verifica antes de inicializar',
        'Auth: init() é singleton — mesma promise reutilizada na sessão',
        'Auth: _loadProfile com timeout 5s e fallback local (nunca derruba sessão)',
        'Auth: logout sempre redireciona mesmo se signOut falhar',
        'Utils: initPagina com timeout 8s, erros Firestore não redirecionam',
        'Utils: renderiza nome do usuário com fallback no email',
        'Fachada: carregar() com fallback duplo (sem orderBy → com createdAt)',
        'Fachada: init() sem requireObra — não redireciona se sem obra',
        'Obras: editar obra existente funcionando (botão ✎ na tabela)',
        'Router: troca de obra recarrega módulo automaticamente',
        'Fachada: múltiplas fachadas abertas simultaneamente na árvore',
        'Fachada: ✎ inline para renomear fachada/balancim',
        'Fachada: Visão Geral antes do Resumo Geral',
        'Fachada: canvas branco com padding, caixa com modal de edição',
        'Fachada: 🔓/🔒 alterna ao travar caixa',
        'Fachada: card total geral na Visão Geral',
        'Notas de Versão: criadas e acessíveis na sidebar de todas as páginas',
        'Notas de Versão: atualizadas a cada commit automaticamente',
        'CRÍTICO auth: onAuthStateChanged ignora null inicial (false null do Firebase)',
        '  → Aguarda até 6s pelo usuário real antes de considerar deslogado',
        '  → Resolve o bug de usuário sumindo ao entrar em levantamento-fachada',
      ]
    }
  ],

  render(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;

    const tipoIcon = { lancamento: '🚀', correcao: '🔧', funcionalidade: '✨', melhoria: '📈' };
    const statusLabel = { aberta: 'Em aberto', fechada: 'Fechada' };

    c.innerHTML = `
      <div class="page-header">
        <div>
          <h2>📋 Notas de Versão</h2>
          <span class="subtitulo">Histórico de atualizações · Versão atual: <strong>${this.versaoAtual}</strong></span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px;">
        ${this.versoes.slice().reverse().map(v => `
          <div style="background:#fff;border-radius:10px;border:1.5px solid ${v.status === 'aberta' ? 'var(--cor-primaria)' : 'var(--cor-borda-light)'};overflow:hidden;">
            <div style="background:${v.status === 'aberta' ? 'var(--cor-primaria)' : 'var(--cor-dark-800)'};padding:14px 20px;display:flex;align-items:center;gap:12px;">
              <span style="font-size:1.3rem;">${tipoIcon[v.tipo] || '📌'}</span>
              <div style="flex:1;">
                <div style="font-size:1rem;font-weight:800;color:${v.status === 'aberta' ? '#000' : '#fff'};">${v.versao} — ${v.titulo}</div>
                <div style="font-size:0.75rem;color:${v.status === 'aberta' ? 'rgba(0,0,0,0.55)' : '#777'};margin-top:2px;">${new Date(v.data).toLocaleDateString('pt-BR')}</div>
              </div>
              <span style="padding:3px 12px;border-radius:100px;font-size:0.72rem;font-weight:700;background:${v.status === 'aberta' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)'};color:${v.status === 'aberta' ? '#000' : '#aaa'};">${statusLabel[v.status]}</span>
            </div>
            <div style="padding:16px 20px;">
              <ul style="list-style:none;display:flex;flex-direction:column;gap:5px;">
                ${v.itens.map(item => {
                  const isChild = item.startsWith('  →');
                  const text = item.replace(/^  →\s*/, '');
                  return `<li style="display:flex;align-items:flex-start;gap:8px;font-size:${isChild ? '0.8' : '0.855'}rem;color:${isChild ? '#888' : 'var(--cor-texto)'};padding-left:${isChild ? '16' : '0'}px;">
                    <span style="margin-top:3px;color:${isChild ? '#ccc' : 'var(--cor-primaria-dark)'};font-size:0.65rem;flex-shrink:0;">${isChild ? '↳' : '▸'}</span>
                    ${text}
                  </li>`;
                }).join('')}
              </ul>
            </div>
          </div>
        `).join('')}
      </div>`;
  }
};
