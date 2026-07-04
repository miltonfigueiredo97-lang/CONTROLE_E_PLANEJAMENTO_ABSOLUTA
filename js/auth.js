// ============================================
// Módulo de Autenticação
// Firebase Authentication - Email/Senha
// ============================================

const Auth = (() => {
  let currentUser = null;
  let userProfile = null;
  let initialized = false; // evita múltiplos onAuthStateChanged
  let initPromise = null;

  // Observador de estado — chame apenas uma vez por página
  function init() {
    // Se já tem promise em andamento, retorna ela
    if (initPromise) return initPromise;

    initPromise = new Promise((resolve) => {
      auth.onAuthStateChanged(async (user) => {
        currentUser = user;
        if (user) {
          // Tenta carregar perfil, mas NÃO bloqueia se falhar
          userProfile = await _loadProfile(user.uid).catch(e => {
            console.warn('Perfil não carregado (usando fallback):', e.message);
            return {
              uid: user.uid,
              email: user.email,
              nome: user.email.split('@')[0],
              perfil: 'admin',
              ativo: true
            };
          });
          initialized = true;
          resolve(user);
        } else {
          userProfile = null;
          initialized = true;
          resolve(null);
        }
      });
    });

    return initPromise;
  }

  // Resetar para próxima navegação
  function reset() {
    initPromise = null;
    initialized = false;
  }

  async function login(email, password) {
    try {
      reset(); // limpa state anterior
      const result = await auth.signInWithEmailAndPassword(email, password);
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: _parseError(error.code) };
    }
  }

  async function logout() {
    try {
      reset();
      if (typeof auth !== 'undefined' && auth) {
        await auth.signOut();
      } else if (typeof firebase !== 'undefined') {
        await firebase.auth().signOut();
      }
    } catch (error) {
      console.error('Erro ao sair:', error);
    } finally {
      localStorage.removeItem('obra_selecionada');
      window.location.href = 'login.html';
    }
  }

  async function _loadProfile(uid) {
    // Tenta buscar perfil no Firestore com timeout de 5s
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 5000)
    );

    const fetchProfile = async () => {
      const doc = await db.collection('users').doc(uid).get();
      if (doc.exists) return doc.data();

      // Não existe — cria perfil padrão
      const profile = {
        uid,
        email: currentUser.email,
        nome: currentUser.email.split('@')[0],
        perfil: 'admin', // primeiro usuário sempre admin
        ativo: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      // Tenta salvar mas não bloqueia se falhar
      db.collection('users').doc(uid).set(profile).catch(e =>
        console.warn('Não foi possível salvar perfil:', e.message)
      );

      return profile;
    };

    return Promise.race([fetchProfile(), timeout]);
  }

  function isLoggedIn() { return currentUser !== null; }
  function getUser() { return currentUser; }
  function getProfile() { return userProfile; }
  function getUid() { return currentUser ? currentUser.uid : null; }
  function isAdmin() { return userProfile && (userProfile.perfil === 'admin' || !userProfile.perfil); }

  function requireAuth() {
    if (!currentUser) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }

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

  return { init, reset, login, logout, isLoggedIn, getUser, getProfile, getUid, isAdmin, requireAuth };
})();
