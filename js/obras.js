// ============================================
// Módulo: Obras
// Visão geral e CRUD de obras
// ============================================

const Obras = (() => {
  let obras = [];

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
      console.error('Erro ao carregar obras:', e);
      Utils.toast('Erro ao carregar obras.', 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function renderizar() {
    const container = document.getElementById('lista-obras');
    if (!container) return;

    if (obras.length === 0) {
      container.innerHTML = `
        <div class="estado-vazio">
          <div class="icone">🏗️</div>
          <p>Nenhuma obra cadastrada.</p>
          <button class="btn btn-primario" onclick="Obras.abrirFormNova()">+ Nova Obra</button>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'cards-grid';

    obras.forEach(obra => {
      const card = document.createElement('div');
      card.className = 'card obra-card';
      card.onclick = () => selecionarObra(obra);
      card.innerHTML = `
        <div class="card-body">
          <div class="obra-nome">${obra.nome || 'Sem nome'}</div>
          <div class="obra-info">${obra.endereco || ''}</div>
          <div class="obra-info text-sm text-muted">${obra.cliente || ''}</div>
          <div class="obra-status mt-1">
            <span class="badge ${obra.ativa !== false ? 'badge-sucesso' : 'badge-neutro'}">
              ${obra.ativa !== false ? 'Ativa' : 'Inativa'}
            </span>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  function selecionarObra(obra) {
    Router.setObra(obra);
    Router.navegar('dashboard.html');
  }

  function abrirFormNova() {
    Utils.limparForm('form-obra');
    document.getElementById('form-obra-id').value = '';
    document.getElementById('modal-obra-titulo').textContent = 'Nova Obra';
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

    if (!data.nome) {
      Utils.toast('Informe o nome da obra.', 'alerta');
      return;
    }

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
      console.error('Erro ao salvar obra:', e);
      Utils.toast('Erro ao salvar obra.', 'erro');
    }
  }

  async function excluir(obraId) {
    const obra = obras.find(o => o.id === obraId);
    if (!Utils.confirmar(`Excluir obra "${obra?.nome}"? Esta ação não pode ser desfeita.`)) return;

    try {
      await Database.deletarObra(obraId);
      await Audit.excluir(obraId, 'obras', 'obra', obraId, `Excluiu obra: ${obra?.nome}`);
      Utils.toast('Obra excluída.', 'sucesso');
      await carregar();
      await Router.popularSeletorObras();
    } catch (e) {
      Utils.toast('Erro ao excluir obra.', 'erro');
    }
  }

  return { init, carregar, renderizar, abrirFormNova, abrirFormEditar, salvar, excluir };
})();
