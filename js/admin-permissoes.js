// ============================================
// Módulo: Admin de Permissões
// Convite de usuários + controle de acesso por módulo/obra
// ============================================

const AdminPermissoes = (() => {
  let usuarios = [];
  let obras = [];
  let permissoesPorUid = {}; // cache uid -> modulos

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

  // ---- Modal ----

  function _renderChecklist(modulosSelecionados) {
    const cont = document.getElementById('permissoes-categorias');
    const categorias = {};
    Object.entries(Permissions.MODULOS).forEach(([key, mod]) => {
      (categorias[mod.categoria] = categorias[mod.categoria] || []).push({ key, ...mod });
    });

    cont.innerHTML = `<div style="column-count:3;column-gap:22px;">
      ${Object.entries(categorias).map(([categoria, mods]) => `
        <div style="break-inside:avoid-column;margin-bottom:16px;">
          <div class="sidebar-section-title" style="padding:0 0 8px;">${categoria}</div>
          ${mods.map(m => `
            <div style="margin-bottom:14px;">
              <div style="font-weight:700;font-size:.82rem;margin-bottom:6px;color:var(--cor-texto);">${m.label}</div>
              <div style="display:grid;grid-template-columns:max-content max-content;gap:7px 32px;justify-content:start;">
                ${m.acoes.map(a => `
                  <label class="form-check" style="font-size:.82rem;white-space:nowrap;">
                    <input type="checkbox" data-modulo="${m.key}" data-acao="${a}"
                      ${modulosSelecionados?.[m.key]?.[a] ? 'checked' : ''}>
                    ${Permissions.ACAO_LABEL[a] || a}
                  </label>`).join('')}
              </div>
            </div>`).join('')}
        </div>
      `).join('')}
    </div>`;
  }

  function _renderObrasRestrito(selecionadas) {
    const cont = document.getElementById('lista-obras-restrito');
    const sel = Array.isArray(selecionadas) ? selecionadas : [];
    cont.innerHTML = obras.map(o => `
      <label class="form-check">
        <input type="checkbox" class="chk-obra-restrita" value="${o.id}" ${sel.includes(o.id) ? 'checked' : ''}>
        ${o.nome}
      </label>`).join('') || '<span class="text-muted text-sm">Nenhuma obra cadastrada.</span>';
  }

  function _toggleObraTipo() {
    const restrito = document.querySelector('input[name="acesso-obra-tipo"]:checked').value === 'restrito';
    document.getElementById('lista-obras-restrito').classList.toggle('hidden', !restrito);
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

    _renderObrasRestrito([]);
    _toggleObraTipo();
    _renderChecklist(Permissions.templateVazio());
    _bindEventosModal();
    Utils.abrirModal('modal-usuario');
  }

  async function abrirEdicao(uid) {
    const u = usuarios.find(x => x.id === uid);
    if (!u) return;

    document.getElementById('modal-usuario-titulo').textContent = 'Editar permissões';
    document.getElementById('form-usuario-uid').value = uid;
    document.getElementById('form-usuario-nome').value = u.nome || '';
    document.getElementById('form-usuario-nome').disabled = true;
    document.getElementById('form-usuario-email').value = u.email || '';
    document.getElementById('form-usuario-email').disabled = true;
    document.getElementById('form-usuario-perfil').value = u.perfil || 'usuario';
    document.getElementById('btn-salvar-usuario').textContent = 'Salvar alterações';

    const restrito = Array.isArray(u.acessoObras);
    document.querySelector(`input[name="acesso-obra-tipo"][value="${restrito ? 'restrito' : 'todas'}"]`).checked = true;
    _renderObrasRestrito(restrito ? u.acessoObras : []);
    _toggleObraTipo();

    let modulos = permissoesPorUid[uid];
    if (!modulos) {
      const doc = await Database.obterRaiz('permissions', uid);
      modulos = doc?.modulos || Permissions.templateVazio();
      permissoesPorUid[uid] = modulos;
    }
    _renderChecklist(modulos);
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
    const modulos = _coletarModulosDoForm();
    const acessoObras = _coletarAcessoObras();

    const btn = document.getElementById('btn-salvar-usuario');
    btn.disabled = true;

    try {
      if (uid) {
        // Edição de usuário existente
        await Permissions.salvarPermissoesUsuario(uid, modulos, acessoObras);
        if (perfil !== usuarios.find(u => u.id === uid)?.perfil) {
          await Database.atualizarRaiz('users', uid, { perfil });
        }
        permissoesPorUid[uid] = modulos;
        Utils.toast('Permissões atualizadas!', 'sucesso');
      } else {
        // Convite de usuário novo
        if (!nome || !email) { Utils.toast('Informe nome e e-mail.', 'alerta'); btn.disabled = false; return; }
        await _enviarConvite({ nome, email, perfil, acessoObras, modulos });
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

  async function _enviarConvite({ nome, email, perfil, acessoObras, modulos }) {
    const idToken = await Auth.getUser().getIdToken();
    const resp = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
      body: JSON.stringify({ action: 'convidar', nome, email, perfil, acessoObras, modulos })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Erro ao criar usuário.');

    // Dispara o e-mail de "definir senha" (enviado pelo próprio Firebase,
    // sem precisar de provedor de e-mail externo), com o link apontando
    // para a nossa própria tela em vez da página padrão do Firebase.
    await auth.sendPasswordResetEmail(email, {
      url: window.location.origin + '/definir-senha.html'
    });
    return data;
  }

  async function reenviarAcesso(email) {
    try {
      await auth.sendPasswordResetEmail(email, {
        url: window.location.origin + '/definir-senha.html'
      });
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
    reenviarAcesso, alternarAtivo, excluirUsuario
  };
})();
