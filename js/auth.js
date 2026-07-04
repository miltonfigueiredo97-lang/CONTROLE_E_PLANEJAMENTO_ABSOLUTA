// ============================================
// Módulo de Autenticação
// Firebase Authentication - Email/Senha
// ============================================

const Auth = (() => {
  let currentUser = null;
  let userProfile = null;
  const listeners = [];

  // Observador de estado de autenticação
  function init() {
    return new Promise((resolve) => {
      auth.onAuthStateChanged(async (user) => {
        currentUser = user;
        if (user) {
          userProfile = await _loadProfile(user.uid);
          _notifyListeners(user);
          resolve(user);
        } else {
          userProfile = null;
          _notifyListeners(null);
          resolve(null);
        }
      });
    });
  }

  // Login
  async function login(email, password) {
    try {
      const result = await auth.signInWithEmailAndPassword(email, password);
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: _parseError(error.code) };
    }
  }

  // Logout — robusto mesmo se auth não inicializado
  async function logout() {
    try {
      if (typeof auth !== 'undefined' && auth) {
        await auth.signOut();
      } else if (typeof firebase !== 'undefined') {
        await firebase.auth().signOut();
      }
    } catch (error) {
      console.error('Erro ao sair:', error);
    } finally {
      // Limpar storage e redirecionar sempre
      localStorage.removeItem('obra_selecionada');
      window.location.href = 'login.html';
    }
  }

  // Criar usuário (apenas Admin)
  async function createUser(email, password, nome, perfil = 'user') {
    try {
      // Nota: em produção, use Firebase Admin SDK via Cloud Function
      // Esta abordagem simples funciona para MVP
      const result = await auth.createUserWithEmailAndPassword(email, password);
      
      await db.collection('users').doc(result.user.uid).set({
        uid: result.user.uid,
        email: email,
        nome: nome,
        perfil: perfil,
        ativo: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, uid: result.user.uid };
    } catch (error) {
      return { success: false, error: _parseError(error.code) };
    }
  }

  // Carregar perfil do Firestore
  async function _loadProfile(uid) {
    try {
      const doc = await db.collection('users').doc(uid).get();
      if (doc.exists) {
        return doc.data();
      }
      // Se não existe perfil, criar um padrão (primeiro usuário = admin)
      const usersSnap = await db.collection('users').limit(1).get();
      const isFirst = usersSnap.empty;
      
      const profile = {
        uid: uid,
        email: currentUser.email,
        nome: currentUser.email.split('@')[0],
        perfil: isFirst ? 'admin' : 'user',
        ativo: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('users').doc(uid).set(profile);
      return profile;
    } catch (e) {
      console.error('Erro ao carregar perfil:', e);
      return null;
    }
  }

  // Verificar se está logado
  function isLoggedIn() {
    return currentUser !== null;
  }

  // Pegar user atual
  function getUser() {
    return currentUser;
  }

  // Pegar perfil
  function getProfile() {
    return userProfile;
  }

  // Pegar UID
  function getUid() {
    return currentUser ? currentUser.uid : null;
  }

  // É admin?
  function isAdmin() {
    return userProfile && userProfile.perfil === 'admin';
  }

  // Listener
  function onAuthChange(callback) {
    listeners.push(callback);
  }

  function _notifyListeners(user) {
    listeners.forEach(cb => cb(user));
  }

  // Requerer login (redireciona se não logado)
  function requireAuth() {
    if (!currentUser) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }

  // Traduzir erros do Firebase
  function _parseError(code) {
    const msgs = {
      'auth/user-not-found': 'Usuário não encontrado.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/invalid-email': 'E-mail inválido.',
      'auth/email-already-in-use': 'E-mail já cadastrado.',
      'auth/weak-password': 'Senha muito fraca (mínimo 6 caracteres).',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde um momento.',
      'auth/network-request-failed': 'Erro de conexão. Verifique sua internet.',
      'auth/invalid-credential': 'E-mail ou senha inválidos.'
    };
    return msgs[code] || 'Erro de autenticação. Tente novamente.';
  }

  return {
    init,
    login,
    logout,
    createUser,
    isLoggedIn,
    getUser,
    getProfile,
    getUid,
    isAdmin,
    onAuthChange,
    requireAuth
  };
})();
