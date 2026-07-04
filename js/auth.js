// ============================================
// Módulo de Autenticação
// Firebase Authentication - Email/Senha
// ============================================

const Auth = (() => {
  let currentUser = null;
  let userProfile = null;
  let initPromise = null;

  // Init robusto: aguarda Firebase restaurar sessão antes de decidir
  function init() {
    if (initPromise) return initPromise;

    initPromise = new Promise((resolve) => {
      // onAuthStateChanged pode chamar com null primeiro (sessão carregando)
      // e depois com o usuário real — usamos unsubscribe para pegar só o primeiro válido
      let resolved = false;

      const unsub = auth.onAuthStateChanged(async (user) => {
        if (resolved) return; // ignora chamadas duplicadas

        currentUser = user;

        if (user) {
          resolved = true;
          unsub(); // para de ouvir
          // Carrega perfil com fallback
          userProfile = await _loadProfile(user.uid).catch(() => ({
            uid: user.uid,
            email: user.email,
            nome: user.email.split('@')[0],
            perfil: 'admin',
            ativo: true
          }));
          resolve(user);
        } else {
          // Firebase ainda pode estar restaurando a sessão
          // Aguarda 2s antes de concluir como "não logado"
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              unsub();
              resolve(null);
            }
          }, 2000);
        }
      });
    });

    return initPromise;
  }

  async function login(email, password) {
    initPromise = null; // reset para nova sessão
    try {
      const result = await auth.signInWithEmailAndPassword(email, password);
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: _parseError(error.code) };
    }
  }

  async function logout() {
    initPromise = null;
    try {
      if (typeof auth !== 'undefined' && auth) await auth.signOut();
      else if (typeof firebase !== 'undefined') await firebase.auth().signOut();
    } catch (e) {
      console.error('Erro ao sair:', e);
    } finally {
      localStorage.removeItem('obra_selecionada');
      window.location.href = 'login.html';
    }
  }

  async function _loadProfile(uid) {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists) return doc.data();

    // Cria perfil padrão
    const profile = {
      uid, email: currentUser.email,
      nome: currentUser.email.split('@')[0],
      perfil: 'admin', ativo: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    db.collection('users').doc(uid).set(profile).catch(() => {});
    return profile;
  }

  function isLoggedIn() { return currentUser !== null; }
  function getUser() { return currentUser; }
  function getProfile() { return userProfile; }
  function getUid() { return currentUser ? currentUser.uid : null; }
  function isAdmin() { return !userProfile || userProfile.perfil === 'admin'; }

  function _parseError(code) {
    const msgs = {
      'auth/user-not-found': 'Usuário não encontrado.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/invalid-email': 'E-mail inválido.',
      'auth/email-already-in-use': 'E-mail já cadastrado.',
      'auth/weak-password': 'Senha muito fraca (mínimo 6 caracteres).',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde.',
      'auth/network-request-failed': 'Erro de conexão.',
      'auth/invalid-credential': 'E-mail ou senha inválidos.'
    };
    return msgs[code] || 'Erro de autenticação.';
  }

  return { init, login, logout, isLoggedIn, getUser, getProfile, getUid, isAdmin };
})();
