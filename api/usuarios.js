// ============================================
// Vercel Function: usuarios
// Gerencia criação/exclusão de usuários no Firebase Auth via Admin SDK.
// Precisa da env var FIREBASE_SERVICE_ACCOUNT_KEY (JSON da service
// account, gerado em Firebase Console > Configurações do projeto >
// Contas de serviço > Gerar nova chave privada) configurada na Vercel.
//
// Toda chamada exige um ID token (Authorization: Bearer <token>) de um
// usuário com perfil 'admin' no Firestore — verificado aqui no servidor,
// nunca confiando no que o front-end diz.
// ============================================

const admin = require('firebase-admin');

function _initAdmin() {
  if (admin.apps.length) return admin.app();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY não configurada na Vercel.');
  const credentials = JSON.parse(raw);
  return admin.initializeApp({ credential: admin.credential.cert(credentials) });
}

async function _exigirAdmin(req) {
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) throw { status: 401, message: 'Token de autenticação ausente.' };

  const decoded = await admin.auth().verifyIdToken(idToken);
  const doc = await admin.firestore().collection('users').doc(decoded.uid).get();
  const perfil = doc.exists ? doc.data().perfil : null;
  if (perfil !== 'admin') throw { status: 403, message: 'Apenas administradores podem gerenciar usuários.' };
  return decoded.uid;
}

function _senhaTemporaria() {
  return 'Tmp' + Math.random().toString(36).slice(2, 10) + '!' + Date.now().toString(36).slice(-4);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  try {
    _initAdmin();
    const adminUid = await _exigirAdmin(req);
    const { action } = req.body || {};

    if (action === 'convidar') {
      const { nome, email, perfil = 'usuario', acessoObras = 'todas', global = {}, modulos = {}, porObra = {} } = req.body;
      if (!nome || !email) {
        res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' });
        return;
      }

      const userRecord = await admin.auth().createUser({
        email,
        password: _senhaTemporaria(),
        displayName: nome,
        disabled: false,
      });

      const now = admin.firestore.FieldValue.serverTimestamp();
      await admin.firestore().collection('users').doc(userRecord.uid).set({
        nome, email, perfil, acessoObras,
        ativo: false,
        status: 'convidado',
        criadoPor: adminUid,
        criadoEm: now,
      });
      await admin.firestore().collection('permissions').doc(userRecord.uid).set({
        global, modulos, porObra,
        atualizadoPor: adminUid,
        atualizadoEm: now,
      });

      res.status(200).json({ uid: userRecord.uid });
      return;
    }

    if (action === 'editarEmail') {
      const { uid, novoEmail } = req.body;
      if (!uid || !novoEmail) { res.status(400).json({ error: 'uid e novoEmail são obrigatórios.' }); return; }

      const doc = await admin.firestore().collection('users').doc(uid).get();
      if (!doc.exists) { res.status(404).json({ error: 'Usuário não encontrado.' }); return; }
      if (doc.data().status !== 'convidado') {
        res.status(400).json({ error: 'Só é possível editar o e-mail de um convite pendente.' });
        return;
      }

      await admin.auth().updateUser(uid, { email: novoEmail });
      await admin.firestore().collection('users').doc(uid).update({ email: novoEmail });

      res.status(200).json({ ok: true });
      return;
    }

    if (action === 'excluir') {
      const { uid } = req.body;
      if (!uid) { res.status(400).json({ error: 'uid é obrigatório.' }); return; }

      await admin.auth().deleteUser(uid).catch((e) => {
        // Se o usuário já não existir no Auth, segue para limpar o Firestore mesmo assim.
        if (e.code !== 'auth/user-not-found') throw e;
      });
      await admin.firestore().collection('users').doc(uid).delete();
      await admin.firestore().collection('permissions').doc(uid).delete();

      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: 'Ação inválida.' });
  } catch (e) {
    console.error('Erro em /api/usuarios:', e);
    res.status(e.status || 500).json({ error: e.message || 'Erro interno no servidor.' });
  }
};
