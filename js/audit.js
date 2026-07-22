// ============================================
// Módulo de Auditoria
// Registra todas as ações no sistema
// ============================================

const Audit = (() => {

  async function registrar(obraId, acao, detalhes = {}) {
    try {
      const entry = {
        obraId: obraId,
        uid: Auth.getUid(),
        email: Auth.getUser()?.email || '',
        acao: acao,
        modulo: detalhes.modulo || '',
        entidade: detalhes.entidade || '',
        entidadeId: detalhes.entidadeId || '',
        descricao: detalhes.descricao || '',
        dados: detalhes.dados || null,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        pagina: window.location.pathname.split('/').pop()
      };

      if (obraId) {
        await db.collection('obras').doc(obraId).collection('auditoria').add(entry);
      } else {
        // Auditoria global (ex: criação de obra)
        await db.collection('auditoria').add(entry);
      }
    } catch (e) {
      console.error('Erro ao registrar auditoria:', e);
    }
  }

  // Atalhos
  function criar(obraId, modulo, entidade, entidadeId, descricao) {
    return registrar(obraId, 'criar', { modulo, entidade, entidadeId, descricao });
  }

  function editar(obraId, modulo, entidade, entidadeId, descricao, dados) {
    return registrar(obraId, 'editar', { modulo, entidade, entidadeId, descricao, dados });
  }

  function excluir(obraId, modulo, entidade, entidadeId, descricao) {
    return registrar(obraId, 'excluir', { modulo, entidade, entidadeId, descricao });
  }

  // Atalho para edição de UM campo, com valor antes/depois — é o que
  // alimenta o "Desfazer" da tela de Backup de Planejamentos.
  function campo(obraId, modulo, entidadeId, entidadeLabel, campo, antes, depois){
    return registrar(obraId, 'editar', {
      modulo, entidade:'tarefa', entidadeId,
      descricao: `${entidadeLabel||entidadeId} — ${campo}: ${antes??'—'} → ${depois??'—'}`,
      dados: {campo, antes: antes??null, depois: depois??null},
    });
  }

  return { registrar, criar, editar, excluir, campo };
})();
