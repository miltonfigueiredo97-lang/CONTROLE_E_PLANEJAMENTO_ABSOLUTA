// ============================================
// Módulo de Permissões
// Controle de acesso por módulo, obra e ação
// ============================================

const Permissions = (() => {
  let permissoes = {};

  async function carregar(uid, obraId) {
    if (!uid || !obraId) return;

    // Admin tem acesso total
    if (Auth.isAdmin()) {
      permissoes = _fullAccess();
      return;
    }

    try {
      // Buscar permissões específicas do usuário para esta obra
      const snap = await db.collection('permissions')
        .where('uid', '==', uid)
        .where('obraId', '==', obraId)
        .limit(1)
        .get();

      if (!snap.empty) {
        permissoes = snap.docs[0].data().modulos || {};
      } else {
        // Permissões padrão para user sem configuração
        permissoes = _defaultUserAccess();
      }
    } catch (e) {
      console.error('Erro ao carregar permissões:', e);
      permissoes = _defaultUserAccess();
    }
  }

  // Verificar permissão
  function pode(modulo, acao = 'ver') {
    if (Auth.isAdmin()) return true;
    if (!permissoes[modulo]) return false;
    return permissoes[modulo][acao] === true;
  }

  // Permissões completas (admin)
  function _fullAccess() {
    const modulos = [
      'planejamento', 'levantamento', 'controle', 'relatorios',
      'restricoes', 'semanal', 'medicoes', 'orcamentos',
      'suprimentos', 'materiais', 'histograma', 'dashboard',
      'configuracao', 'permissoes'
    ];
    const access = {};
    modulos.forEach(m => {
      access[m] = { ver: true, editar: true, excluir: true, exportar: true, importar: true, aprovar: true };
    });
    return access;
  }

  // Permissões padrão (user sem config)
  function _defaultUserAccess() {
    return {
      planejamento: { ver: true, editar: false },
      levantamento: { ver: true, editar: true },
      controle: { ver: true, editar: true },
      relatorios: { ver: true, editar: false },
      restricoes: { ver: true, editar: true },
      semanal: { ver: true, editar: true },
      medicoes: { ver: true, editar: false },
      orcamentos: { ver: false, editar: false },
      suprimentos: { ver: true, editar: false },
      materiais: { ver: true, editar: false },
      histograma: { ver: true, editar: false },
      dashboard: { ver: true, editar: false },
      configuracao: { ver: false, editar: false },
      permissoes: { ver: false, editar: false }
    };
  }

  // Salvar permissões de um usuário
  async function salvar(uid, obraId, modulos) {
    const data = {
      uid,
      obraId,
      modulos,
      updatedBy: Auth.getUid(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const snap = await db.collection('permissions')
      .where('uid', '==', uid)
      .where('obraId', '==', obraId)
      .limit(1)
      .get();

    if (!snap.empty) {
      await db.collection('permissions').doc(snap.docs[0].id).update(data);
    } else {
      data.createdBy = Auth.getUid();
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('permissions').add(data);
    }
  }

  return { carregar, pode, salvar };
})();
