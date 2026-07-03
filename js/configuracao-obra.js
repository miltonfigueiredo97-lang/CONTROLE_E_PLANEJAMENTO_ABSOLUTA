// ============================================
// Módulo: Configuração da Obra
// CRUD de etapas, pacotes, locais, equipes, funcionários
// ============================================

const ConfiguracaoObra = (() => {
  let obraId = null;
  let etapas = [];
  let pacotes = [];
  let locais = [];
  let equipes = [];
  let tabAtiva = 'etapas';

  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    
    obraId = Router.getObraId();
    if (!obraId) {
      document.getElementById('config-content').innerHTML = `
        <div class="estado-vazio">
          <div class="icone">🏗️</div>
          <p>Selecione uma obra na barra lateral para configurá-la.</p>
        </div>`;
      return;
    }

    _bindTabs();
    await carregar();
  }

  function _bindTabs() {
    document.querySelectorAll('.tab[data-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        tabAtiva = tab.dataset.tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('ativo'));
        tab.classList.add('ativo');
        renderizar();
      });
    });
  }

  async function carregar() {
    if (!obraId) return;
    try {
      Utils.mostrarLoading();
      [etapas, pacotes, locais, equipes] = await Promise.all([
        Database.listar(obraId, 'etapas', 'nome'),
        Database.listar(obraId, 'pacotes', 'nome'),
        Database.listar(obraId, 'locais', 'ordem'),
        Database.listar(obraId, 'equipes', 'nome')
      ]);
      renderizar();
    } catch (e) {
      console.error('Erro:', e);
      Utils.toast('Erro ao carregar configuração.', 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function renderizar() {
    const container = document.getElementById('config-content');
    if (!container) return;

    const renderFns = {
      etapas: () => _renderLista('etapas', etapas, 'Etapa'),
      pacotes: () => _renderLista('pacotes', pacotes, 'Pacote'),
      locais: () => _renderLista('locais', locais, 'Local'),
      equipes: () => _renderLista('equipes', equipes, 'Equipe')
    };

    const fn = renderFns[tabAtiva];
    container.innerHTML = fn ? fn() : '';
  }

  function _renderLista(tipo, items, label) {
    const btns = `<div class="toolbar">
      <span class="text-sm text-muted">${items.length} ${items.length === 1 ? label.toLowerCase() : label.toLowerCase() + 's'}</span>
      <button class="btn btn-primario btn-sm" onclick="ConfiguracaoObra.abrirForm('${tipo}')">+ ${label}</button>
    </div>`;

    if (items.length === 0) {
      return btns + `<div class="estado-vazio"><p>Nenhum(a) ${label.toLowerCase()} cadastrado(a).</p></div>`;
    }

    const rows = items.map(item => `
      <tr>
        <td>${item.codigo || ''}</td>
        <td>${item.nome}</td>
        <td class="text-muted text-sm">${item.descricao || ''}</td>
        <td class="col-acoes">
          <button class="btn btn-secundario btn-sm" onclick="ConfiguracaoObra.editarItem('${tipo}','${item.id}')">✎</button>
          <button class="btn btn-perigo btn-sm btn-icon" onclick="ConfiguracaoObra.excluirItem('${tipo}','${item.id}','${item.nome}')">✕</button>
        </td>
      </tr>
    `).join('');

    return btns + `<div class="tabela-container"><table class="tabela tabela-compacta">
      <thead><tr><th>Código</th><th>Nome</th><th>Descrição</th><th class="col-acoes">Ações</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

  function abrirForm(tipo, item = null) {
    const label = { etapas: 'Etapa', pacotes: 'Pacote', locais: 'Local', equipes: 'Equipe' }[tipo];
    document.getElementById('modal-config-titulo').textContent = item ? `Editar ${label}` : `Nova ${label}`;
    document.getElementById('form-config-tipo').value = tipo;
    document.getElementById('form-config-id').value = item ? item.id : '';
    
    const campoOrdem = document.getElementById('campo-ordem');
    if (tipo === 'locais') {
      campoOrdem.classList.remove('hidden');
    } else {
      campoOrdem.classList.add('hidden');
    }

    if (item) {
      Utils.setFormData('form-config', item);
    } else {
      Utils.limparForm('form-config');
    }
    
    Utils.abrirModal('modal-config');
  }

  async function editarItem(tipo, id) {
    const listas = { etapas, pacotes, locais, equipes };
    const item = listas[tipo]?.find(i => i.id === id);
    if (item) abrirForm(tipo, item);
  }

  async function salvarItem() {
    const tipo = document.getElementById('form-config-tipo').value;
    const id = document.getElementById('form-config-id').value;
    const data = Utils.getFormData('form-config');
    delete data[''];

    if (!data.nome) {
      Utils.toast('Informe o nome.', 'alerta');
      return;
    }

    try {
      if (id) {
        await Database.atualizar(obraId, tipo, id, data);
        Utils.toast('Atualizado!', 'sucesso');
      } else {
        await Database.criar(obraId, tipo, data);
        Utils.toast('Criado!', 'sucesso');
      }
      Utils.fecharModal('modal-config');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao salvar.', 'erro');
    }
  }

  async function excluirItem(tipo, id, nome) {
    if (!Utils.confirmar(`Excluir "${nome}"?`)) return;
    try {
      await Database.deletar(obraId, tipo, id);
      Utils.toast('Excluído.', 'sucesso');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao excluir.', 'erro');
    }
  }

  return { init, carregar, renderizar, abrirForm, editarItem, salvarItem, excluirItem };
})();

// Callback quando muda obra na sidebar
function onObraChanged() {
  ConfiguracaoObra.init();
}
