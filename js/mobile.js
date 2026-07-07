// ============================================
// MOBILE — Menu hambúrguer + gaveta lateral
// Auto-inicializa em todas as páginas.
// No desktop não interfere em nada (botão oculto via CSS).
// ============================================
const Mobile = (function(){

  function _abrir(){
    const sb = document.querySelector('.sidebar');
    const ov = document.querySelector('.sidebar-overlay');
    if(sb) sb.classList.add('mobile-aberta');
    if(ov) ov.classList.add('ativo');
  }

  function _fechar(){
    const sb = document.querySelector('.sidebar');
    const ov = document.querySelector('.sidebar-overlay');
    if(sb) sb.classList.remove('mobile-aberta');
    if(ov) ov.classList.remove('ativo');
  }

  function _toggle(){
    const sb = document.querySelector('.sidebar');
    if(!sb) return;
    if(sb.classList.contains('mobile-aberta')) _fechar(); else _abrir();
  }

  function init(){
    const header = document.querySelector('.header');
    const app = document.querySelector('.app-container');
    if(!header || !app) return;

    // Botão hambúrguer no início do header (só aparece no mobile via CSS)
    if(!header.querySelector('.btn-menu-mobile')){
      const btn = document.createElement('button');
      btn.className = 'btn-menu-mobile';
      btn.setAttribute('aria-label', 'Abrir menu');
      btn.innerHTML = '☰';
      btn.addEventListener('click', _toggle);
      header.insertBefore(btn, header.firstChild);
    }

    // Overlay para fechar tocando fora
    if(!document.querySelector('.sidebar-overlay')){
      const ov = document.createElement('div');
      ov.className = 'sidebar-overlay';
      ov.addEventListener('click', _fechar);
      app.appendChild(ov);
    }

    // Fecha a gaveta ao tocar em qualquer link da nav
    document.querySelectorAll('.sidebar-nav a').forEach(a => {
      a.addEventListener('click', _fechar);
    });

    // Fecha com a tecla/gesto de voltar (ESC em teclados)
    document.addEventListener('keydown', e => {
      if(e.key === 'Escape') _fechar();
    });

    // Ao girar para paisagem/voltar ao desktop, garante estado limpo
    window.addEventListener('resize', () => {
      if(window.innerWidth > 900) _fechar();
    });
  }

  // Auto-init: funciona mesmo se a página não chamar Mobile.init()
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init, abrir: _abrir, fechar: _fechar, toggle: _toggle };
})();
