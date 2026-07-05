// ============================================
// Auth — Controle e Planejamento Absoluta
// ============================================
const Auth = (() => {
  let currentUser = null;
  let userProfile  = null;
  let initPromise  = null;

  // init() — aguarda a sessão do Firebase ser restaurada.
  // onAuthStateChanged SEMPRE dispara ao menos uma vez:
  //   - null  → sessão não existe (ou ainda carregando)
  //   - user  → sessão restaurada com sucesso
  // Estratégia: aguardar até 6s pela primeira chamada não-nula.
  // Se não vier nenhum usuário em 6s → considerar deslogado.
  function init() {
    if (initPromise) return initPromise;

    initPromise = new Promise((resolve) => {
      const TIMEOUT_MS = 6000;
      let settled = false;
      let timer = null;

      const settle = async (user) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsub();

        currentUser = user;
        if (user) {
          userProfile = await _loadProfile(user.uid).catch(() => _fallbackProfile(user));
        } else {
          userProfile = null;
        }
        resolve(user);
      };

      // Timeout de segurança — só resolve null se NUNCA vier usuário
      timer = setTimeout(() => settle(null), TIMEOUT_MS);

      const unsub = auth.onAuthStateChanged((user) => {
        if (user) {
          // Usuário real — resolve imediatamente
          settle(user);
        }
        // Se null: ignora e deixa o timeout correr.
        // Isso evita o "false null" que o Firebase emite durante restauração.
      });
    });

    return initPromise;
  }

  function _fallbackProfile(user) {
    return {
      uid: user.uid,
      email: user.email,
      nome: user.displayName || user.email.split('@')[0],
      perfil: 'admin',
      ativo: true,
    };
  }

  async function _loadProfile(uid) {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists) return { uid, ...doc.data() };

    // Primeira vez — cria perfil
    const profile = {
      uid,
      email: currentUser.email,
      nome: currentUser.displayName || currentUser.email.split('@')[0],
      perfil: 'admin',
      ativo: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    db.collection('users').doc(uid).set(profile).catch(() => {});
    return profile;
  }

  async function login(email, password) {
    initPromise = null;
    try {
      const result = await auth.signInWithEmailAndPassword(email, password);
      return { success: true, user: result.user };
    } catch (e) {
      return { success: false, error: _parseError(e.code) };
    }
  }

  async function logout() {
    initPromise = null;
    try { await auth.signOut(); } catch (e) { console.warn('signOut error:', e); }
    localStorage.removeItem('obra_selecionada');
    window.location.href = 'login.html';
  }

  function getUser()    { return currentUser; }
  function getProfile() { return userProfile; }
  function getUid()     { return currentUser?.uid || null; }
  function isAdmin()    { return !userProfile || userProfile.perfil === 'admin'; }
  function isLoggedIn() { return !!currentUser; }

  function _parseError(code) {
    const m = {
      'auth/user-not-found':    'Usuário não encontrado.',
      'auth/wrong-password':    'Senha incorreta.',
      'auth/invalid-email':     'E-mail inválido.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde.',
      'auth/invalid-credential':'E-mail ou senha inválidos.',
      'auth/network-request-failed': 'Sem conexão. Verifique a internet.',
    };
    return m[code] || 'Erro de autenticação.';
  }

  return { init, login, logout, getUser, getProfile, getUid, isAdmin, isLoggedIn };
})();
