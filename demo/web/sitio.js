(function(){
  var html=document.documentElement,banda=document.querySelector('.banda');
  // Cabecera: transparente sobre la banda, sólida al bajar
  if(banda&&'IntersectionObserver' in window){
    new IntersectionObserver(function(e){html.classList.toggle('solida',!e[0].isIntersecting);},{rootMargin:'-70px 0px 0px 0px'}).observe(banda);
  }else{html.classList.add('solida');}

  // Vídeo de fondo: se reproduce siempre al abrir la página; solo se detiene si el visitante pulsa pausa
  var v=document.querySelector('.fondo-fijo video');
  var btns=[].slice.call(document.querySelectorAll('.control-video'));
  if(!v)return;
  var pausado=false;
  function arrancar(){var p=v.play();if(p&&p.catch)p.catch(function(){});}
  function pintar(){btns.forEach(function(b){b.setAttribute('aria-pressed',String(pausado));b.setAttribute('aria-label',pausado?'Reanudar el vídeo de fondo':'Pausar el vídeo de fondo');});}
  arrancar();
  // Si el navegador bloquea la reproducción automática (p. ej. modo ahorro de batería), arranca al primer gesto
  ['pointerdown','touchstart','scroll','keydown'].forEach(function(t){addEventListener(t,function(){if(!pausado&&v.paused)arrancar();},{once:true,passive:true});});
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&!pausado)arrancar();});
  pintar();
  btns.forEach(function(b){b.addEventListener('click',function(){
    pausado=!pausado;
    if(pausado)v.pause();else arrancar();
    pintar();
  });});
})();
