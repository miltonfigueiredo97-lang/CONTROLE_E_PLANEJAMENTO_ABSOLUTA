// Auth — Controle e Planejamento Absoluta
const Auth = (() => {
  let currentUser = null;
  let userProfile  = null;
  let initPromise  = null;

  function init() {
    if (initPromise) return initPromise;
    initPromise = new Promise((resolve) => {
      // Firebase sempre emite null primeiro ao restaurar sessão.
      // Esperamos o usuário real. Timeout de 8s só se realmente deslogado.
      let timer = setTimeout(() => resolve(null), 8000);
      auth.onAuthStateChanged(async (user) => {
        if (!user) return; // ignora null — Firebase ainda restaurando
        clearTimeout(timer);
        currentUser = user;
        userProfile = await _loadProfile(user).catch(() => _fallback(user));
        resolve(user);
      });
    });
    return initPromise;
  }

  function _fallback(user) {
    return { uid: user.uid, email: user.email, nome: user.email.split('@')[0], perfil: 'admin', ativo: true };
  }

  async function _loadProfile(user) {
    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists) return { uid: user.uid, ...doc.data() };
    const p = { ..._fallback(user), createdAt: firebase.firestore.FieldValue.serverTimestamp() };
    db.collection('users').doc(user.uid).set(p).catch(() => {});
    return p;
  }

  async function login(email, password) {
    initPromise = null;
    try {
      const r = await auth.signInWithEmailAndPassword(email, password);
      return { success: true, user: r.user };
    } catch (e) { return { success: false, error: _err(e.code) }; }
  }

  async function logout() {
    initPromise = null;
    try { await auth.signOut(); } catch (e) {}
    localStorage.removeItem('obra_selecionada');
    window.location.href = 'login.html';
  }

  function _err(code) {
    return ({
      'auth/user-not-found':'Usuário não encontrado.',
      'auth/wrong-password':'Senha incorreta.',
      'auth/invalid-credential':'E-mail ou senha inválidos.',
      'auth/too-many-requests':'Muitas tentativas. Aguarde.',
      'auth/network-request-failed':'Sem conexão.',
    })[code] || 'Erro de autenticação.';
  }

  return {
    init,
    login,
    logout,
    getUser:    () => currentUser,
    getProfile: () => userProfile,
    getUid:     () => currentUser?.uid || null,
    isAdmin:    () => !userProfile || userProfile.perfil === 'admin',
    isLoggedIn: () => !!currentUser,
  };
})();
