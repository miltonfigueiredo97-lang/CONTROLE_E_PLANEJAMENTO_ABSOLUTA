// Módulo: Obras
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
      console.error(e);
      Utils.toast('Erro ao carregar obras.', 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function renderizar() {
    const container = document.getElementById('lista-obras');
    if (!container) return;

    if (!obras.length) {
      container.innerHTML = `<div class="estado-vazio">
        <div class="icone">🏗️</div><p>Nenhuma obra cadastrada.</p>
        <button class="btn btn-primario" onclick="Obras.abrirFormNova()">+ Nova Obra</button>
      </div>`;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'cards-grid';

    obras.forEach(obra => {
      const card = document.createElement('div');
      card.className = 'card obra-card';

      if (obra.imagemUrl) {
        // Card com imagem enviada pelo usuário
        card.innerHTML = `
          <div style="position:relative;height:160px;overflow:hidden;border-radius:8px 8px 0 0;">
            <img src="${obra.imagemUrl}" style="width:100%;height:100%;object-fit:cover;">
            <div style="position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.7) 0%,transparent 60%)"></div>
            <div style="position:absolute;bottom:10px;left:14px;right:14px;">
              <div class="obra-nome" style="color:#fff">${obra.nome}</div>
              <div class="obra-info" style="color:rgba(255,255,255,.75)">${obra.cliente||''}</div>
            </div>
          </div>
          <div class="card-body" style="padding:10px 14px;display:flex;align-items:center;justify-content:space-between;">
            <span class="badge ${obra.ativa!==false?'badge-sucesso':'badge-neutro'}">${obra.ativa!==false?'Ativa':'Inativa'}</span>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-secundario btn-sm" onclick="event.stopPropagation();Obras.abrirFormEditar('${obra.id}')">✎ Editar</button>
            </div>
          </div>`;
      } else {
        card.innerHTML = `
          <div class="card-body">
            <div class="obra-nome">${obra.nome||'Sem nome'}</div>
            <div class="obra-info text-sm">${obra.cliente||''}</div>
            <div class="obra-info text-sm text-muted">${obra.endereco||''}</div>
            <div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;">
              <span class="badge ${obra.ativa!==false?'badge-sucesso':'badge-neutro'}">${obra.ativa!==false?'Ativa':'Inativa'}</span>
              <button class="btn btn-secundario btn-sm" onclick="event.stopPropagation();Obras.abrirFormEditar('${obra.id}')">✎ Editar</button>
            </div>
          </div>`;
      }

      card.addEventListener('click', (e) => {
        if (!e.target.closest('button')) selecionarObra(obra);
      });
      grid.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(grid);
  }

  function selecionarObra(obra) {
    Router.setObra(obra);
    Router.navegar('dashboard.html');
  }

  function abrirFormNova() {
    document.getElementById('form-obra-id').value = '';
    document.getElementById('modal-obra-titulo').textContent = 'Nova Obra';
    document.getElementById('preview-imagem-obra').style.display = 'none';
    Utils.limparForm('form-obra');
    document.querySelector('#form-obra [name="ativa"]').checked = true;
    Utils.abrirModal('modal-obra');
  }

  function abrirFormEditar(obraId) {
    const obra = obras.find(o => o.id === obraId);
    if (!obra) return;
    document.getElementById('form-obra-id').value = obraId;
    document.getElementById('modal-obra-titulo').textContent = 'Editar Obra';
    Utils.setFormData('form-obra', obra);
    // Mostrar preview se tiver imagem
    const prev = document.getElementById('preview-imagem-obra');
    if (obra.imagemUrl) {
      prev.src = obra.imagemUrl;
      prev.style.display = 'block';
    } else {
      prev.style.display = 'none';
    }
    Utils.abrirModal('modal-obra');
  }

  function onImagemSelecionada(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const prev = document.getElementById('preview-imagem-obra');
      prev.src = e.target.result;
      prev.style.display = 'block';
      document.getElementById('imagem-obra-b64').value = e.target.result;
      document.getElementById('imagem-obra-file-name').value = file.name;
    };
    reader.readAsDataURL(file);
  }

  async function salvar() {
    const id = document.getElementById('form-obra-id').value;
    const data = Utils.getFormData('form-obra');
    if (!data.nome) { Utils.toast('Informe o nome da obra.', 'alerta'); return; }

    // Imagem: faz upload para Firebase Storage se houver nova
    const b64 = document.getElementById('imagem-obra-b64').value;
    if (b64) {
      try {
        Utils.mostrarLoading('Enviando imagem...');
        const obraIdTemp = id || ('new_' + Date.now());
        const path = 'obras/' + obraIdTemp + '/capa.jpg';
        data.imagemUrl = await uploadImagem(path, b64);
      } catch(e) {
        console.error('Erro upload imagem obra:', e);
        // Fallback: salva base64 (funciona mas é maior)
        data.imagemUrl = b64;
      } finally {
        Utils.esconderLoading();
      }
    }

    try {
      if (id) {
        await Database.atualizarObra(id, data);
        Utils.toast('Obra atualizada!', 'sucesso');
      } else {
        await Database.criarObra(data);
        Utils.toast('Obra criada!', 'sucesso');
      }
      Utils.fecharModal('modal-obra');
      document.getElementById('imagem-obra-b64').value = '';
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

  return { init, carregar, renderizar, abrirFormNova, abrirFormEditar, salvar, excluir, onImagemSelecionada };
})();
