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

    const NUM_COLUNAS = 4;

    const _htmlModulo = (m) => `
      <div style="border:1px solid var(--cor-borda-light);border-radius:6px;padding:9px 12px;">
        <div style="font-weight:700;font-size:.82rem;margin-bottom:6px;color:var(--cor-texto);">${m.label}</div>
        <div style="display:grid;grid-template-columns:max-content max-content;gap:7px 20px;justify-content:start;">
          ${m.acoes.map(a => `
            <label class="form-check" style="font-size:.8rem;white-space:nowrap;">
              <input type="checkbox" data-modulo="${m.key}" data-acao="${a}"
                ${modulosSelecionados?.[m.key]?.[a] ? 'checked' : ''}>
              ${Permissions.ACAO_LABEL[a] || a}
            </label>`).join('')}
        </div>
      </div>`;

    // Um grid único pra tudo: cada módulo é uma célula normal (flui em ordem,
    // esquerda->direita, quebrando linha automaticamente). O título de cada
    // categoria ocupa a linha inteira (grid-column:1/-1) — como isso nunca
    // cabe numa linha já ocupada por células de módulo, o grid empurra ele
    // sozinho pra uma linha nova, o que força a categoria seguinte a nunca
    // se misturar com o fim da anterior.
    cont.innerHTML = `<div style="display:grid;grid-template-columns:repeat(${NUM_COLUNAS},1fr);gap:18px 24px;">
      ${Object.entries(categorias).map(([categoria, mods]) => `
        <div style="grid-column:1/-1;padding:${categoria === Object.keys(categorias)[0] ? '0' : '14px'} 0 2px;font-size:.98rem;font-weight:800;color:var(--cor-texto);text-transform:uppercase;letter-spacing:.5px;">${categoria}</div>
        ${mods.map(_htmlModulo).join('')}
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
    const pendente = u.status === 'convidado';
    document.getElementById('form-usuario-nome').value = u.nome || '';
    document.getElementById('form-usuario-nome').disabled = true;
    document.getElementById('form-usuario-email').value = u.email || '';
    document.getElementById('form-usuario-email').disabled = !pendente;
    document.getElementById('form-usuario-email').title = pendente ? 'Convite pendente: pode corrigir o e-mail.' : '';
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
        const usuarioAtual = usuarios.find(u => u.id === uid);
        const emailEditavel = !document.getElementById('form-usuario-email').disabled;
        const emailMudou = emailEditavel && email && email !== usuarioAtual?.email;

        if (emailMudou) {
          await _editarEmail(uid, email);
          await _dispararEmailSenha(email);
        }

        await Permissions.salvarPermissoesUsuario(uid, modulos, acessoObras);
        if (perfil !== usuarioAtual?.perfil) {
          await Database.atualizarRaiz('users', uid, { perfil });
        }
        permissoesPorUid[uid] = modulos;
        Utils.toast(emailMudou ? 'E-mail corrigido e convite reenviado!' : 'Permissões atualizadas!', 'sucesso');
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

  async function _enviarConvite({ nome, email, perfil, acessoObras, modulos }) {
    const idToken = await Auth.getUser().getIdToken();
    const resp = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
      body: JSON.stringify({ action: 'convidar', nome, email, perfil, acessoObras, modulos })
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
    reenviarAcesso, alternarAtivo, excluirUsuario
  };
})();
