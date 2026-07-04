// ============================================
// Módulo: Obras
// CRUD completo — criar, listar, editar, excluir
// Suporte a card com imagem para obras especiais
// ============================================
const Obras = (() => {
  let obras = [];

  // Obras com imagem especial (por nome parcial)
  const OBRAS_IMAGEM = {
    'essence': 'assets/images/essence-obra.png',
    'zenith':  'assets/images/essence-obra.png',
  };

  function _getImagem(nome) {
    const n = (nome||'').toLowerCase();
    for (const [key, img] of Object.entries(OBRAS_IMAGEM)) {
      if (n.includes(key)) return img;
    }
    return null;
  }

  async function init() {
    const ok = await Utils.initPagina();
    if (!ok) return;
    await carregar();
  }

  async function carregar() {
    try {
      Utils.mostrarLoading('Carregando obras...');
      obras = await Database.getObras();
      renderizar();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao carregar obras.', 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function renderizar() {
    const container = document.getElementById('lista-obras');
    if (!container) return;

    if (obras.length === 0) {
      container.innerHTML = `<div class="estado-vazio">
        <div class="icone">🏗️</div><p>Nenhuma obra cadastrada.</p>
        <button class="btn btn-primario" onclick="Obras.abrirFormNova()">+ Nova Obra</button></div>`;
      return;
    }

    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'cards-grid';

    obras.forEach(obra => {
      const img = _getImagem(obra.nome);
      const card = document.createElement('div');

      if (img) {
        // Card com imagem especial
        card.className = 'card obra-card obra-card-img';
        card.innerHTML = `
          <div class="obra-img-bg" style="background-image:url('${img}')"></div>
          <div class="obra-img-overlay"></div>
          <div class="obra-img-content">
            <div class="obra-nome">${obra.nome}</div>
            <div class="obra-info">${obra.endereco||''}</div>
            <div class="obra-info">${obra.cliente||''}</div>
            <div class="obra-status mt-1">
              <span class="badge badge-amarelo">${obra.ativa!==false?'Ativa':'Inativa'}</span>
            </div>
          </div>`;
      } else {
        card.className = 'card obra-card';
        card.innerHTML = `<div class="card-body">
          <div class="obra-nome">${obra.nome||'Sem nome'}</div>
          <div class="obra-info">${obra.endereco||''}</div>
          <div class="obra-info text-sm text-muted">${obra.cliente||''}</div>
          <div class="obra-status mt-1">
            <span class="badge ${obra.ativa!==false?'badge-sucesso':'badge-neutro'}">
              ${obra.ativa!==false?'Ativa':'Inativa'}
            </span>
          </div>
        </div>`;
      }

      // Click vai para dashboard, botões de ação ficam em cima
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.obra-acoes')) selecionarObra(obra);
      });
      grid.appendChild(card);
    });

    container.appendChild(grid);
    _renderTabela();
  }

  function _renderTabela() {
    const tabContainer = document.getElementById('tabela-obras');
    if (!tabContainer) return;
    if (obras.length === 0) { tabContainer.innerHTML = ''; return; }

    let rows = obras.map(o => `<tr>
      <td><strong>${o.nome}</strong></td>
      <td>${o.cliente||'—'}</td>
      <td>${o.cidade||'—'}</td>
      <td>${o.endereco||'—'}</td>
      <td class="col-centro"><span class="badge ${o.ativa!==false?'badge-sucesso':'badge-neutro'}">${o.ativa!==false?'Ativa':'Inativa'}</span></td>
      <td class="col-acoes">
        <button class="btn btn-secundario btn-sm" onclick="Obras.abrirFormEditar('${o.id}')">✎ Editar</button>
        <button class="btn btn-perigo btn-sm btn-icon" onclick="Obras.excluir('${o.id}')">✕</button>
      </td>
    </tr>`).join('');

    tabContainer.innerHTML = `<div class="tabela-container mt-3">
      <table class="tabela">
        <thead><tr><th>Nome</th><th>Cliente</th><th>Cidade</th><th>Endereço</th><th class="col-centro">Status</th><th class="col-acoes">Ações</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  function selecionarObra(obra) {
    Router.setObra(obra);
    Router.navegar('dashboard.html');
  }

  function abrirFormNova() {
    Utils.limparForm('form-obra');
    document.getElementById('form-obra-id').value = '';
    document.getElementById('modal-obra-titulo').textContent = 'Nova Obra';
    document.querySelector('#form-obra [name="ativa"]').checked = true;
    Utils.abrirModal('modal-obra');
  }

  function abrirFormEditar(obraId) {
    const obra = obras.find(o => o.id === obraId);
    if (!obra) return;
    document.getElementById('form-obra-id').value = obraId;
    document.getElementById('modal-obra-titulo').textContent = 'Editar Obra';
    Utils.setFormData('form-obra', obra);
    Utils.abrirModal('modal-obra');
  }

  async function salvar() {
    const id = document.getElementById('form-obra-id').value;
    const data = Utils.getFormData('form-obra');
    if (!data.nome) { Utils.toast('Informe o nome da obra.', 'alerta'); return; }
    try {
      if (id) {
        await Database.atualizarObra(id, data);
        await Audit.editar(id, 'obras', 'obra', id, `Editou obra: ${data.nome}`);
        Utils.toast('Obra atualizada!', 'sucesso');
      } else {
        const novoId = await Database.criarObra(data);
        await Audit.criar(novoId, 'obras', 'obra', novoId, `Criou obra: ${data.nome}`);
        Utils.toast('Obra criada!', 'sucesso');
      }
      Utils.fecharModal('modal-obra');
      await carregar();
      await Router.popularSeletorObras();
    } catch (e) {
      console.error(e); Utils.toast('Erro ao salvar.', 'erro');
    }
  }

  async function excluir(obraId) {
    const obra = obras.find(o => o.id === obraId);
    if (!Utils.confirmar(`Excluir obra "${obra?.nome}"?`)) return;
    try {
      await Database.deletarObra(obraId);
      Utils.toast('Obra excluída.', 'sucesso');
      await carregar();
      await Router.popularSeletorObras();
    } catch (e) { Utils.toast('Erro ao excluir.', 'erro'); }
  }

  return { init, carregar, renderizar, abrirFormNova, abrirFormEditar, salvar, excluir };
})();
