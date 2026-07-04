// ============================================
// Firebase Configuration
// Projeto: controle-absoluta
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyBNe23p9ymuHPV7DWsWJ0pSjcAZWfC2OIo",
  authDomain: "controle-absoluta.firebaseapp.com",
  projectId: "controle-absoluta",
  storageBucket: "controle-absoluta.firebasestorage.app",
  messagingSenderId: "933834682296",
  appId: "1:933834682296:web:b28bd8cd624fe19006294d"
};

let app, auth, db, storage;

function initFirebase() {
  // Se já foi inicializado nesta aba, reutiliza
  if (app && auth && db) {
    return true;
  }

  try {
    // Verificar se já existe app inicializado (navegação entre páginas)
    if (firebase.apps.length > 0) {
      app = firebase.apps[0];
    } else {
      app = firebase.initializeApp(firebaseConfig);
    }

    auth    = firebase.auth();
    db      = firebase.firestore();
    storage = firebase.storage();

    // Persistência offline (ignora erros silenciosamente)
    db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

    return true;
  } catch (e) {
    console.error('Erro ao inicializar Firebase:', e);
    return false;
  }
}
