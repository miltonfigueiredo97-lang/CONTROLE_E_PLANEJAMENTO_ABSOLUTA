// ============================================
// Módulo Database
// Camada de abstração para Firestore
// Todas as operações CRUD passam por aqui
// ============================================

const Database = (() => {

  // --- Helpers ---
  function _timestamp() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  function _uid() {
    return Auth.getUid();
  }

  function _addMeta(data, isNew = true) {
    const uid = _uid();
    data.updatedBy = uid;
    data.updatedAt = _timestamp();
    if (isNew) {
      data.createdBy = uid;
      data.createdAt = _timestamp();
    }
    return data;
  }

  // --- Coleções raiz ---

  // OBRAS
  async function getObras() {
    const snap = await db.collection('obras').orderBy('nome').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async function getObra(obraId) {
    const doc = await db.collection('obras').doc(obraId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async function criarObra(data) {
    _addMeta(data);
    data.ativa = true;
    const ref = await db.collection('obras').add(data);
    return ref.id;
  }

  async function atualizarObra(obraId, data) {
    _addMeta(data, false);
    await db.collection('obras').doc(obraId).update(data);
  }

  async function deletarObra(obraId) {
    await db.collection('obras').doc(obraId).delete();
  }

  // USERS
  async function getUsers() {
    const snap = await db.collection('users').orderBy('nome').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async function getUser(uid) {
    const doc = await db.collection('users').doc(uid).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  // --- Subcoleções por obra ---

  function _obraSubRef(obraId, subcollection) {
    return db.collection('obras').doc(obraId).collection(subcollection);
  }

  // Genérica: listar subcoleção
  async function listar(obraId, subcollection, orderByField = 'createdAt', direction = 'asc') {
    let query = _obraSubRef(obraId, subcollection);
    if (orderByField) {
      query = query.orderBy(orderByField, direction);
    }
    const snap = await query.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // Genérica: obter documento
  async function obter(obraId, subcollection, docId) {
    const doc = await _obraSubRef(obraId, subcollection).doc(docId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  // Genérica: criar documento
  async function criar(obraId, subcollection, data, customId = null) {
    _addMeta(data);
    data.obraId = obraId;
    
    if (customId) {
      await _obraSubRef(obraId, subcollection).doc(customId).set(data);
      return customId;
    }
    const ref = await _obraSubRef(obraId, subcollection).add(data);
    return ref.id;
  }

  // Genérica: atualizar documento
  async function atualizar(obraId, subcollection, docId, data) {
    _addMeta(data, false);
    await _obraSubRef(obraId, subcollection).doc(docId).update(data);
  }

  // Genérica: deletar documento
  async function deletar(obraId, subcollection, docId) {
    await _obraSubRef(obraId, subcollection).doc(docId).delete();
  }

  // Genérica: query com filtros
  async function query(obraId, subcollection, filters = [], orderByField = null, limit = null) {
    let ref = _obraSubRef(obraId, subcollection);
    
    filters.forEach(f => {
      ref = ref.where(f.field, f.op, f.value);
    });

    if (orderByField) {
      ref = ref.orderBy(orderByField.field || orderByField, orderByField.direction || 'asc');
    }

    if (limit) {
      ref = ref.limit(limit);
    }

    const snap = await ref.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // Batch write
  async function batchWrite(operations) {
    const batch = db.batch();
    operations.forEach(op => {
      const ref = op.ref || db.doc(op.path);
      if (op.type === 'set') {
        batch.set(ref, _addMeta(op.data, true));
      } else if (op.type === 'update') {
        batch.update(ref, _addMeta(op.data, false));
      } else if (op.type === 'delete') {
        batch.delete(ref);
      }
    });
    await batch.commit();
  }

  // Referência direta para usos avançados
  function ref(obraId, subcollection) {
    return _obraSubRef(obraId, subcollection);
  }

  // Gerar ID antes de salvar
  function novoId(obraId, subcollection) {
    return _obraSubRef(obraId, subcollection).doc().id;
  }

  // Listener em tempo real
  function onSnapshot(obraId, subcollection, callback, orderByField = 'createdAt') {
    let query = _obraSubRef(obraId, subcollection);
    if (orderByField) {
      query = query.orderBy(orderByField);
    }
    return query.onSnapshot(snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(docs);
    });
  }

  return {
    // Obras
    getObras,
    getObra,
    criarObra,
    atualizarObra,
    deletarObra,
    // Users
    getUsers,
    getUser,
    // Genéricas
    listar,
    obter,
    criar,
    atualizar,
    deletar,
    query,
    batchWrite,
    ref,
    novoId,
    onSnapshot
  };
})();

// ============================================
// Storage Helpers — upload de imagens
// ============================================
async function uploadImagem(path, base64DataUrl) {
  // Converte base64 para blob
  const res = await fetch(base64DataUrl);
  const blob = await res.blob();
  const ref = storage.ref(path);
  await ref.put(blob);
  return await ref.getDownloadURL();
}

async function deletarImagem(path) {
  try { await storage.ref(path).delete(); } catch(e) {}
}
