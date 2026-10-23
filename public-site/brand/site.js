(function () {
  var menu = document.querySelector('.menu-toggle'), nav = document.querySelector('#site-nav');
  menu.addEventListener('click', function () {
    var open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open)); nav.classList.toggle('is-open', open);
  });
  function closeMenu() { menu.setAttribute('aria-expanded','false'); nav.classList.remove('is-open'); }
  nav.querySelectorAll('a').forEach(function (link) { link.addEventListener('click',closeMenu); });
  document.addEventListener('keydown',function(event){if(event.key==='Escape'){closeMenu();}});
  var tabs = Array.from(document.querySelectorAll('[role=tab]'));
  function select(tab) {
    tabs.forEach(function(t){var active=t===tab;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;document.getElementById(t.getAttribute('aria-controls')).hidden=!active;});
  }
  tabs.forEach(function(tab,index){
    tab.addEventListener('click',function(){select(tab);});
    tab.addEventListener('keydown',function(event){var i=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:-1;if(i>=0){event.preventDefault();select(tabs[i]);tabs[i].focus();}});
  });
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!reduced.matches && 'IntersectionObserver' in window) {
    var observer=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){e.target.classList.add('is-visible');observer.unobserve(e.target);}});},{threshold:0.08});
    document.querySelectorAll('[data-reveal]').forEach(function(el){el.classList.add('will-reveal');observer.observe(el);});
  }
  var stage=document.querySelector('.product-stage'), preview=document.querySelector('.product-window');
  if (window.matchMedia('(pointer: fine)').matches) {
    stage.addEventListener('pointermove',function(event){if(reduced.matches)return;var r=stage.getBoundingClientRect();preview.style.setProperty('--tilt-x',((event.clientY-r.top)/r.height-.5)*-6+'deg');preview.style.setProperty('--tilt-y',((event.clientX-r.left)/r.width-.5)*8+'deg');});
    stage.addEventListener('pointerleave',function(){preview.style.removeProperty('--tilt-x');preview.style.removeProperty('--tilt-y');});
  }
  document.querySelector('#year').textContent=String(new Date().getFullYear());
})();
