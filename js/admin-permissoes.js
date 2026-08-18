// ============================================
// Módulo: Admin de Permissões
// Convite de usuários + controle de acesso por módulo/obra
// Desde V3.14: quando o acesso é "Restrito", cada obra da lista pode ter
// um conjunto de permissões próprio (abas dentro do modal).
// ============================================

const AdminPermissoes = (() => {
  let usuarios = [];
  let obras = [];
  let permissoesPorUid = {}; // cache uid -> {global, modulos, porObra} (doc completo)

  // Estado do modal em edição (transitório — só existe com o modal aberto)
  let _modalPorObra = {};          // {obraId: modulos} das abas já visitadas nesta sessão de edição
  let _modalModulosFallback = {};  // "modulos" legado — usado quando Todas, e mantido como
                                    // fallback (sem tocar) quando Restrito
  let _modalObraAtiva = null;      // obraId da aba visível agora (null = modo "Todas")

  async function init() {
    const ok = await Utils.initPagina();
    if (!ok) return;
    await carregar();
  }

  async function carregar() {
    try {
      Utils.mostrarLoading('Carregando usuários...');
      [usuarios, obras] = await Promise.all([Database.getUsers(), Database.getObras()]);
      renderizar();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao carregar usuários.', 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function renderizar() {
    const container = document.getElementById('modulo-content');
    if (!container) return;

    container.innerHTML = `
      <div class="page-header">
        <div><h2>Usuários e Permissões</h2><span class="subtitulo">${usuarios.length} usuário(s) cadastrado(s)</span></div>
        <button class="btn btn-primario" onclick="AdminPermissoes.abrirConvite()">+ Convidar usuário</button>
      </div>
      <table class="tabela">
        <thead><tr>
          <th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Acesso</th><th style="width:220px;">Ações</th>
        </tr></thead>
        <tbody>
          ${usuarios.map(_linhaUsuario).join('') || '<tr><td colspan="6" class="text-muted text-center">Nenhum usuário ainda.</td></tr>'}
        </tbody>
      </table>`;
  }

  function _linhaUsuario(u) {
    const perfilBadge = u.perfil === 'admin'
      ? '<span class="badge badge-amarelo">Administrador</span>'
      : '<span class="badge badge-neutro">Usuário</span>';
    const status = u.ativo === false
      ? (u.status === 'convidado' ? '<span class="badge badge-alerta">Convite pendente</span>' : '<span class="badge badge-perigo">Desativado</span>')
      : '<span class="badge badge-sucesso">Ativo</span>';
    const acesso = (!u.acessoObras || u.acessoObras === 'todas')
      ? 'Todas as obras'
      : `Restrito (${(u.acessoObras||[]).length})`;

    const reenviar = (u.perfil !== 'admin')
      ? `<button class="btn btn-secundario btn-sm btn-icon" title="Reenviar e-mail de acesso" onclick="AdminPermissoes.reenviarAcesso('${u.email}')">✉️</button>`
      : '';
    const toggleAtivo = (u.perfil !== 'admin')
      ? `<button class="btn btn-secundario btn-sm btn-icon" title="${u.ativo === false ? 'Ativar' : 'Desativar'}" onclick="AdminPermissoes.alternarAtivo('${u.id}', ${u.ativo === false})">${u.ativo === false ? '▶️' : '⏸️'}</button>`
      : '';
    const excluir = (u.perfil !== 'admin')
      ? `<button class="btn btn-secundario btn-sm btn-icon" title="Excluir usuário" onclick="AdminPermissoes.excluirUsuario('${u.id}','${(u.nome||u.email||'').replace(/'/g,"")}')">🗑️</button>`
      : '';

    return `<tr>
      <td>${u.nome || '—'}</td>
      <td>${u.email || '—'}</td>
      <td>${perfilBadge}</td>
      <td>${status}</td>
      <td>${acesso}</td>
      <td style="display:flex;gap:6px;">
        <button class="btn btn-secundario btn-sm" onclick="AdminPermissoes.abrirEdicao('${u.id}')">Permissões</button>
        ${reenviar}${toggleAtivo}${excluir}
      </td>
    </tr>`;
  }

  // ---- Modal: checklist de módulos (obra-escopados) ----

  function _htmlModulo(m) {
    return `
      <div style="border:1px solid var(--cor-borda-light);border-radius:6px;padding:9px 12px;">
        <div style="font-weight:700;font-size:.82rem;margin-bottom:6px;color:var(--cor-texto);">${m.label}</div>
        <div style="display:grid;grid-template-columns:max-content max-content;gap:7px 20px;justify-content:start;">
          ${m.acoes.map(a => `
            <label class="form-check" style="font-size:.8rem;white-space:nowrap;">
              <input type="checkbox" data-modulo="${m.key}" data-acao="${a}"
                ${m._sel?.[m.key]?.[a] ? 'checked' : ''}>
              ${Permissions.ACAO_LABEL[a] || a}
            </label>`).join('')}
        </div>
      </div>`;
  }

  function _renderChecklist(modulosSelecionados) {
    const cont = document.getElementById('permissoes-categorias');
    const categorias = {};
    Object.entries(Permissions.MODULOS).forEach(([key, mod]) => {
      if (Permissions.GLOBAL_MODULOS.includes(key)) return; // globais têm seção própria
      (categorias[mod.categoria] = categorias[mod.categoria] || []).push({ key, ...mod, _sel: modulosSelecionados });
    });

    const NUM_COLUNAS = 4;

    // Um grid único pra tudo: cada módulo é uma célula normal (flui em ordem,
    // esquerda->direita, quebrando linha automaticamente). O título de cada
    // categoria ocupa a linha inteira (grid-column:1/-1) — como isso nunca
    // cabe numa linha já ocupada por células de módulo, o grid empurra ele
    // sozinho pra uma linha nova, o que força a categoria seguinte a nunca
    // se misturar com o fim da anterior.
    cont.innerHTML = `<div style="display:grid;grid-template-columns:repeat(${NUM_COLUNAS},1fr);gap:18px 24px;">
      ${Object.entries(categorias).map(([categoria, mods]) => `
        <div style="grid-column:1/-1;padding:${categoria === Object.keys(categorias)[0] ? '0' : '14px'} 0 2px;font-size:.98rem;font-weight:800;color:var(--cor-texto);text-transform:uppercase;letter-spacing:.5px;">${categoria}</div>
        ${mods.map(m => _htmlModulo(m)).join('')}
      `).join('')}
    </div>`;
  }

  // ---- Modal: checklist de módulos GLOBAIS (Obras, Admin — não dependem de obra) ----

  function _renderGlobais(globalSelecionado) {
    const cont = document.getElementById('permissoes-globais');
    const mods = Permissions.GLOBAL_MODULOS.map(key => ({ key, ...Permissions.MODULOS[key] }));
    cont.innerHTML = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px 24px;">
      ${mods.map(m => `
        <div style="border:1px solid var(--cor-borda-light);border-radius:6px;padding:9px 12px;">
          <div style="font-weight:700;font-size:.82rem;margin-bottom:6px;color:var(--cor-texto);">${m.label}</div>
          <div style="display:grid;grid-template-columns:max-content max-content;gap:7px 20px;justify-content:start;">
            ${m.acoes.map(a => `
              <label class="form-check" style="font-size:.8rem;white-space:nowrap;">
                <input type="checkbox" data-global-modulo="${m.key}" data-global-acao="${a}"
                  ${globalSelecionado?.[m.key]?.[a] ? 'checked' : ''}>
                ${Permissions.ACAO_LABEL[a] || a}
              </label>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;
  }

  function _coletarModulosGlobaisDoForm() {
    const modulos = {};
    document.querySelectorAll('#permissoes-globais input[type="checkbox"]').forEach(chk => {
      const modulo = chk.dataset.globalModulo, acao = chk.dataset.globalAcao;
      modulos[modulo] = modulos[modulo] || {};
      modulos[modulo][acao] = chk.checked;
    });
    return modulos;
  }

  // ---- Modal: acesso por obra + abas de permissão por obra (Restrito) ----

  function _renderObrasRestrito(selecionadas) {
    const cont = document.getElementById('lista-obras-restrito');
    const sel = Array.isArray(selecionadas) ? selecionadas : [];
    cont.innerHTML = obras.map(o => `
      <label class="form-check">
        <input type="checkbox" class="chk-obra-restrita" value="${o.id}" ${sel.includes(o.id) ? 'checked' : ''}
          onchange="AdminPermissoes._onObraRestritaMudou()">
        ${o.nome}
      </label>`).join('') || '<span class="text-muted text-sm">Nenhuma obra cadastrada.</span>';
  }

  function _obraNome(obraId) {
    return obras.find(o => o.id === obraId)?.nome || '(obra removida)';
  }

  function _onObraRestritaMudou() {
    // Comita a aba visível antes de recalcular a lista de abas (senão perde
    // o que estava sendo editado quando uma obra é marcada/desmarcada).
    if (_modalObraAtiva) _modalPorObra[_modalObraAtiva] = _coletarModulosDoForm();
    _renderAbasObra();
  }

  function _renderAbasObra() {
    const idsSelecionados = Array.from(document.querySelectorAll('.chk-obra-restrita:checked')).map(c => c.value);
    const cont = document.getElementById('abas-obra-restrito');

    if (!idsSelecionados.length) {
      cont.innerHTML = '<span class="text-sm text-muted">Marque ao menos uma obra acima pra configurar as permissões dela.</span>';
      _modalObraAtiva = null;
      _renderChecklist({});
      return;
    }

    // Se a aba ativa saiu da lista (obra desmarcada), ou nunca foi definida,
    // cai pra primeira obra da lista.
    if (!_modalObraAtiva || !idsSelecionados.includes(_modalObraAtiva)) {
      _modalObraAtiva = idsSelecionados[0];
    }

    cont.innerHTML = idsSelecionados.map(id => `
      <button type="button" class="btn btn-sm ${id === _modalObraAtiva ? 'btn-primario' : 'btn-secundario'}"
        onclick="AdminPermissoes._trocarAbaObra('${id}')">${_obraNome(id)}</button>
    `).join('') + `
      <button type="button" class="btn btn-sm btn-secundario btn-icon" title="Copiar a configuração desta obra pra todas as outras da lista"
        onclick="AdminPermissoes._copiarAbaParaTodas()" style="margin-left:6px;">📋 Copiar pra todas</button>`;

    _renderChecklist(_modalPorObra[_modalObraAtiva] || Permissions.templateVazio());
  }

  function _trocarAbaObra(obraId) {
    if (obraId === _modalObraAtiva) return;
    if (_modalObraAtiva) _modalPorObra[_modalObraAtiva] = _coletarModulosDoForm();
    _modalObraAtiva = obraId;
    _renderAbasObra();
  }

  function _copiarAbaParaTodas() {
    if (!_modalObraAtiva) return;
    const idsSelecionados = Array.from(document.querySelectorAll('.chk-obra-restrita:checked')).map(c => c.value);
    const atual = _coletarModulosDoForm();
    _modalPorObra[_modalObraAtiva] = atual;
    idsSelecionados.forEach(id => { _modalPorObra[id] = JSON.parse(JSON.stringify(atual)); });
    Utils.toast(`Configuração copiada pra ${idsSelecionados.length} obra(s).`, 'sucesso');
    _renderAbasObra();
  }

  function _toggleObraTipo() {
    const restrito = document.querySelector('input[name="acesso-obra-tipo"]:checked').value === 'restrito';
    document.getElementById('lista-obras-restrito').classList.toggle('hidden', !restrito);
    document.getElementById('abas-obra-restrito').classList.toggle('hidden', !restrito);

    if (restrito) {
      _renderAbasObra();
    } else {
      // Comita a aba visível (se vinha de Restrito) antes de voltar pro
      // checklist único — mantém o trabalho já feito na obra ativa como
      // ponto de partida do conjunto "Todas".
      if (_modalObraAtiva) {
        _modalModulosFallback = _coletarModulosDoForm();
        _modalObraAtiva = null;
      }
      _renderChecklist(_modalModulosFallback);
    }
  }

  function abrirConvite() {
    document.getElementById('modal-usuario-titulo').textContent = 'Convidar usuário';
    document.getElementById('form-usuario-uid').value = '';
    document.getElementById('form-usuario-nome').value = '';
    document.getElementById('form-usuario-nome').disabled = false;
    document.getElementById('form-usuario-email').value = '';
    document.getElementById('form-usuario-email').disabled = false;
    document.getElementById('form-usuario-perfil').value = 'usuario';
    document.querySelector('input[name="acesso-obra-tipo"][value="todas"]').checked = true;
    document.getElementById('btn-salvar-usuario').textContent = 'Enviar convite';

    _modalPorObra = {};
    _modalModulosFallback = Permissions.templateVazio();
    _modalObraAtiva = null;

    _renderObrasRestrito([]);
    _renderGlobais(Permissions.templateVazioGlobal());
    _toggleObraTipo();
    _bindEventosModal();
    Utils.abrirModal('modal-usuario');
  }

  async function abrirEdicao(uid) {
    const u = usuarios.find(x => x.id === uid);
    if (!u) return;

    document.getElementById('modal-usuario-titulo').textContent = 'Editar permissões';
    document.getElementById('form-usuario-uid').value = uid;
    const pendente = u.status === 'convidado';
    document.getElementById('form-usuario-nome').value = u.nome || '';
    document.getElementById('form-usuario-nome').disabled = true;
    document.getElementById('form-usuario-email').value = u.email || '';
    document.getElementById('form-usuario-email').disabled = !pendente;
    document.getElementById('form-usuario-email').title = pendente ? 'Convite pendente: pode corrigir o e-mail.' : '';
    document.getElementById('form-usuario-perfil').value = u.perfil || 'usuario';
    document.getElementById('btn-salvar-usuario').textContent = 'Salvar alterações';

    let doc = permissoesPorUid[uid];
    if (!doc) {
      doc = await Database.obterRaiz('permissions', uid) || {};
      permissoesPorUid[uid] = doc;
    }
    _modalModulosFallback = doc.modulos || Permissions.templateVazio();
    _modalPorObra = JSON.parse(JSON.stringify(doc.porObra || {}));
    _modalObraAtiva = null;

    const restrito = Array.isArray(u.acessoObras);
    document.querySelector(`input[name="acesso-obra-tipo"][value="${restrito ? 'restrito' : 'todas'}"]`).checked = true;
    _renderObrasRestrito(restrito ? u.acessoObras : []);
    _renderGlobais(doc.global || Permissions.templateVazioGlobal());
    _toggleObraTipo();
    _bindEventosModal();
    Utils.abrirModal('modal-usuario');
  }

  function _bindEventosModal() {
    document.querySelectorAll('input[name="acesso-obra-tipo"]').forEach(r => {
      r.onchange = _toggleObraTipo;
    });
  }

  function _coletarModulosDoForm() {
    const modulos = {};
    document.querySelectorAll('#permissoes-categorias input[type="checkbox"]').forEach(chk => {
      const { modulo, acao } = chk.dataset;
      modulos[modulo] = modulos[modulo] || {};
      modulos[modulo][acao] = chk.checked;
    });
    return modulos;
  }

  function _coletarAcessoObras() {
    const restrito = document.querySelector('input[name="acesso-obra-tipo"]:checked').value === 'restrito';
    if (!restrito) return 'todas';
    return Array.from(document.querySelectorAll('.chk-obra-restrita:checked')).map(c => c.value);
  }

  async function salvarUsuario() {
    const uid = document.getElementById('form-usuario-uid').value;
    const nome = document.getElementById('form-usuario-nome').value.trim();
    const email = document.getElementById('form-usuario-email').value.trim();
    const perfil = document.getElementById('form-usuario-perfil').value;
    const global = _coletarModulosGlobaisDoForm();
    const acessoObras = _coletarAcessoObras();

    // Monta modulos/porObra a partir do estado atual (comitando a aba
    // visível agora, se estiver em modo Restrito).
    let modulos, porObra;
    if (Array.isArray(acessoObras)) {
      if (_modalObraAtiva) _modalPorObra[_modalObraAtiva] = _coletarModulosDoForm();
      porObra = {};
      acessoObras.forEach(id => { porObra[id] = _modalPorObra[id] || Permissions.templateVazio(); });
      modulos = _modalModulosFallback; // mantém o fallback antigo intacto
    } else {
      modulos = _coletarModulosDoForm();
      porObra = {};
    }

    const btn = document.getElementById('btn-salvar-usuario');
    btn.disabled = true;

    try {
      if (uid) {
        // Edição de usuário existente
        const usuarioAtual = usuarios.find(u => u.id === uid);
        const emailEditavel = !document.getElementById('form-usuario-email').disabled;
        const emailMudou = emailEditavel && email && email !== usuarioAtual?.email;

        if (emailMudou) {
          await _editarEmail(uid, email);
          await _dispararEmailSenha(email);
        }

        await Permissions.salvarPermissoesUsuario(uid, { global, modulos, porObra }, acessoObras);
        if (perfil !== usuarioAtual?.perfil) {
          await Database.atualizarRaiz('users', uid, { perfil });
        }
        permissoesPorUid[uid] = { global, modulos, porObra };
        Utils.toast(emailMudou ? 'E-mail corrigido e convite reenviado!' : 'Permissões atualizadas!', 'sucesso');
      } else {
        // Convite de usuário novo
        if (!nome || !email) { Utils.toast('Informe nome e e-mail.', 'alerta'); btn.disabled = false; return; }
        await _enviarConvite({ nome, email, perfil, acessoObras, global, modulos, porObra });
        Utils.toast('Convite enviado! O usuário vai receber um e-mail para definir a senha.', 'sucesso');
      }
      Utils.fecharModal('modal-usuario');
      await carregar();
    } catch (e) {
      console.error(e);
      Utils.toast(e.message || 'Erro ao salvar.', 'erro');
    } finally {
      btn.disabled = false;
    }
  }

  // Dispara o e-mail de "definir senha" (enviado pelo próprio Firebase, sem
  // precisar de provedor externo). Se o domínio da continue-URL não estiver
  // na lista de "Authorized domains" do Firebase Auth (Console > Authentication
  // > Settings), cai pro link padrão do Firebase — o e-mail ainda sai, só não
  // leva pra nossa tela própria (o usuário define a senha na página padrão
  // do Firebase e depois loga normalmente pelo login.html).
  async function _dispararEmailSenha(email) {
    const url = window.location.origin + '/definir-senha.html';
    try {
      await auth.sendPasswordResetEmail(email, { url });
    } catch (e) {
      if (e.code === 'auth/unauthorized-continue-uri') {
        await auth.sendPasswordResetEmail(email); // sem actionCodeSettings = link padrão do Firebase
        Utils.toast(
          `E-mail enviado, mas o domínio "${window.location.hostname}" ainda não está autorizado no Firebase ` +
          `(Console > Authentication > Settings > Authorized domains) — o link caiu na página padrão do Firebase, ` +
          `não na nossa. Avise o Milton pra configurar isso.`,
          'alerta', 8000
        );
        return;
      }
      throw e;
    }
  }

  async function _enviarConvite({ nome, email, perfil, acessoObras, global, modulos, porObra }) {
    const idToken = await Auth.getUser().getIdToken();
    const resp = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
      body: JSON.stringify({ action: 'convidar', nome, email, perfil, acessoObras, global, modulos, porObra })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Erro ao criar usuário.');

    await _dispararEmailSenha(email);
    return data;
  }

  async function _editarEmail(uid, novoEmail) {
    const idToken = await Auth.getUser().getIdToken();
    const resp = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
      body: JSON.stringify({ action: 'editarEmail', uid, novoEmail })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Erro ao editar e-mail.');
    return data;
  }

  async function reenviarAcesso(email) {
    try {
      await _dispararEmailSenha(email);
      Utils.toast('E-mail de acesso reenviado.', 'sucesso');
    } catch (e) {
      Utils.toast('Erro ao reenviar: ' + (e.message || ''), 'erro');
    }
  }

  async function alternarAtivo(uid, novoAtivo) {
    try {
      await Database.atualizarRaiz('users', uid, { ativo: novoAtivo, status: novoAtivo ? 'ativo' : 'desativado' });
      Utils.toast(novoAtivo ? 'Usuário ativado.' : 'Usuário desativado.', 'sucesso');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao alterar status.', 'erro');
    }
  }

  async function excluirUsuario(uid, nome) {
    if (!Utils.confirmar(`Excluir o usuário "${nome}"? Essa ação não pode ser desfeita.`)) return;
    try {
      const idToken = await Auth.getUser().getIdToken();
      const resp = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
        body: JSON.stringify({ action: 'excluir', uid })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erro ao excluir.');
      Utils.toast('Usuário excluído.', 'sucesso');
      await carregar();
    } catch (e) {
      console.error(e);
      Utils.toast(e.message || 'Erro ao excluir usuário.', 'erro');
    }
  }

  return {
    init, carregar, abrirConvite, abrirEdicao, salvarUsuario,
    _onObraRestritaMudou, _trocarAbaObra, _copiarAbaParaTodas,
    reenviarAcesso, alternarAtivo, excluirUsuario
  };
})();
