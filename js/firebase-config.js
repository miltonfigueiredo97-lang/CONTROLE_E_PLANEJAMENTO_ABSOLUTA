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

// Importa Firebase via CDN (compat mode para funcionar com <script>)
// Os scripts são carregados no HTML antes deste arquivo

let app, auth, db, storage;

function initFirebase() {
  if (!firebaseConfig.apiKey) {
    console.warn('Firebase não configurado.');
    return false;
  }

  try {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    storage = firebase.storage();
    
    // Habilitar persistência offline
    db.enablePersistence({ synchronizeTabs: true }).catch(err => {
      if (err.code === 'failed-precondition') {
        console.warn('Persistência offline: múltiplas abas abertas.');
      } else if (err.code === 'unimplemented') {
        console.warn('Persistência offline: navegador não suportado.');
      }
    });

    console.log('✅ Firebase inicializado com sucesso.');
    return true;
  } catch (e) {
    console.error('❌ Erro ao inicializar Firebase:', e);
    return false;
  }
}
