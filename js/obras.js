// Módulo: Obras
const Obras = (() => {
  let obras = [];
  const _progressoCache = new Map(); // obraId -> {percConcluido, inicioReal, fimProvavel}

  async function init() {
    const ok = await Utils.initPagina();
    if (!ok) return;
    await carregar();
    if (typeof Tutorial !== 'undefined') Tutorial.iniciarSeNecessario();
  }

  async function carregar() {
    try {
      Utils.mostrarLoading('Carregando obras...');
      obras = await Database.getObras();
      renderizar();
      await _carregarProgressoObras();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao carregar obras.', 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // Carrega o progresso (Planejamento) de cada obra em paralelo e
  // re-renderiza os cards conforme os dados chegam, sem travar a tela.
  async function _carregarProgressoObras() {
    await Promise.all(obras.map(async (obra) => {
      try {
        const tarefas = await Database.listar(obra.id, 'tarefas', 'ordem');
        _progressoCache.set(obra.id, _calcularProgresso(tarefas));
      } catch (e) {
        console.warn('Erro ao calcular progresso da obra', obra.id, e);
        _progressoCache.set(obra.id, null);
      }
      _atualizarCardProgresso(obra.id);
    }));
  }

  // Mesma lógica de "% em família" ponderada por duração usada no Semanal:
  // só tarefas-folha entram na conta (evita contar grupo + filhos em dobro).
  function _calcularProgresso(tarefas) {
    if (!tarefas || !tarefas.length) return { percConcluido: null, inicioReal: null, fimProvavel: null };

    const sorted = [...tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    let somaPeso = 0, somaConcluido = 0;
    let inicioReal = null, fimProvavel = null;

    sorted.forEach((t, i) => {
      const nxt = sorted[i + 1];
      const isFolha = !nxt || (nxt.nivel || 0) <= (t.nivel || 0);

      if (isFolha) {
        const peso = Math.max(1, t.duracao || 1);
        somaPeso += peso;
        somaConcluido += Math.min(100, t.percentualConcluido || 0) * peso;
      }

      if (t.inicioReal) {
        const d = new Date(t.inicioReal);
        if (!inicioReal || d < inicioReal) inicioReal = d;
      }
      if (t.terminoPlanejado) {
        const d = new Date(t.terminoPlanejado);
        if (!fimProvavel || d > fimProvavel) fimProvavel = d;
      }
    });

    return {
      percConcluido: somaPeso ? somaConcluido / somaPeso : 0,
      inicioReal,
      fimProvavel
    };
  }

  function _atualizarCardProgresso(obraId) {
    const el = document.getElementById(`obra-progresso-${obraId}`);
    if (!el) return;
    const prog = _progressoCache.get(obraId);

    if (!prog || prog.percConcluido === null) {
      el.innerHTML = `<div class="text-sm text-muted">Sem dados de planejamento.</div>`;
      return;
    }

    const perc = Math.round(prog.percConcluido);
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;">
        <span class="text-sm" style="font-weight:600;">${perc}% executado</span>
      </div>
      <div class="barra-progresso"><div class="barra-progresso-fill" style="width:${perc}%;"></div></div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;" class="text-sm text-muted">
        <span>Início real: ${prog.inicioReal ? Utils.formatarData(prog.inicioReal) : '—'}</span>
        <span>Fim provável: ${prog.fimProvavel ? Utils.formatarData(prog.fimProvavel) : '—'}</span>
      </div>`;
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

      const acoes = `
        <button class="btn btn-secundario btn-sm btn-icon" title="Configurar Obra" onclick="event.stopPropagation();Obras.abrirConfiguracao('${obra.id}')">⚙️</button>
        <button class="btn btn-secundario btn-sm" onclick="event.stopPropagation();Obras.abrirFormEditar('${obra.id}')">✎ Editar</button>`;
      const progresso = `<div id="obra-progresso-${obra.id}" style="margin-top:10px;"><div class="text-sm text-muted">Carregando progresso...</div></div>`;

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
          <div class="card-body" style="padding:10px 14px;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <span class="badge ${obra.ativa!==false?'badge-sucesso':'badge-neutro'}">${obra.ativa!==false?'Ativa':'Inativa'}</span>
              <div style="display:flex;gap:6px;">${acoes}</div>
            </div>
            ${progresso}
          </div>`;
      } else {
        card.innerHTML = `
          <div class="card-body">
            <div class="obra-nome">${obra.nome||'Sem nome'}</div>
            <div class="obra-info text-sm">${obra.cliente||''}</div>
            <div class="obra-info text-sm text-muted">${obra.endereco||''}</div>
            <div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;">
              <span class="badge ${obra.ativa!==false?'badge-sucesso':'badge-neutro'}">${obra.ativa!==false?'Ativa':'Inativa'}</span>
              <div style="display:flex;gap:6px;">${acoes}</div>
            </div>
            ${progresso}
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

  function abrirConfiguracao(obraId) {
    const obra = obras.find(o => o.id === obraId);
    if (!obra) return;
    Router.setObra(obra);
    Router.navegar('configuracao-obra.html');
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

  return { init, carregar, renderizar, abrirFormNova, abrirFormEditar, abrirConfiguracao, salvar, excluir, onImagemSelecionada };
})();
