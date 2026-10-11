/* Rainbow Gardens concept: our own code. Motion runs regardless of prefers-reduced-motion;
   one Pause/Play control stops every film and the ticker (WCAG 2.2.2). */
(function(){
  var root=document.documentElement, paused=false;
  var vids=[].slice.call(document.querySelectorAll('video'));
  vids.forEach(function(v){v.muted=true;v.defaultMuted=true;v.playsInline=true;v.setAttribute('muted','');});
  function play(v){ if(paused) return; var p=v.play(); if(p&&p.catch) p.catch(function(){}); }

  /* only films on screen run */
  var seen=new Set();
  var io=new IntersectionObserver(function(es){es.forEach(function(e){
    if(e.isIntersecting){seen.add(e.target);play(e.target);} else {seen.delete(e.target);e.target.pause();}
  });},{rootMargin:'20% 0px'});
  vids.forEach(function(v){io.observe(v);});

  /* Pause / Play (now in mast chrome) */
  var btn=document.querySelector('.motion-toggle');
  btn.addEventListener('click',function(){
    paused=!paused;
    root.classList.toggle('is-paused',paused);
    btn.textContent=paused?'Play':'Pause';
    btn.setAttribute('aria-pressed',String(paused));
    if(paused){vids.forEach(function(v){v.pause();});}
    else{seen.forEach(play);}
    /* Pause freezes all motion: GSAP + smooth scroll */ if(window.gsap){gsap.globalTimeline[paused?'pause':'resume']();}if(typeof lenis!=='undefined'&&lenis){lenis.options.smoothWheel=!paused;}
  });
  document.addEventListener('visibilitychange',function(){if(!document.hidden) seen.forEach(play);});

  /* smooth scroll - stopped while loading so wheel can't reveal page under cover */
  var lenis=null;
  if(window.Lenis){
    lenis=new Lenis({lerp:0.085,wheelMultiplier:0.95,smoothWheel:true});
    root.classList.add('lenis');
    if(root.classList.contains('is-loading')) lenis.stop();
    document.querySelectorAll('a[href^="#"]').forEach(function(a){a.addEventListener('click',function(ev){
      var id=a.getAttribute('href'); var t=id==='#top'?0:document.querySelector(id); if(t===null) return;
      ev.preventDefault(); lenis.scrollTo(t,{duration:1.6,easing:function(x){return x===1?1:1-Math.pow(2,-10*x);}});
    });});
  }
  /* scroll lock while loader OR hero cinematic first playthrough */
  var heroUnlockDone=false;
  function scrollLocked(){
    return root.classList.contains('is-loading') || root.classList.contains('is-hero-lock');
  }
  /* hero lock releases on the visitor's first scroll attempt; film keeps playing,
     payoff (I DO. + cue) still waits for the film's natural end via unlockHeroOnce */
  var touchY=null, followTouch=false, followY=null;
  function releaseHeroLockEarly(e){
    root.classList.remove('is-hero-lock');
    if(lenis){ lenis.start(); try{lenis.resize();}catch(err){} }
    /* let the releasing gesture itself move the page */
    if(e && e.type==='wheel' && e.deltaY){
      if(lenis){ try{lenis.scrollTo(lenis.scroll+e.deltaY);}catch(err){} } else window.scrollBy(0,e.deltaY);
    }
    if(e && e.type==='touchmove'){ followTouch=true; followY=null; }
  }
  window.addEventListener('touchstart',function(e){ touchY=e.touches&&e.touches[0]?e.touches[0].clientY:null; },{passive:true});
  window.addEventListener('touchmove',function(e){
    var y=e.touches&&e.touches[0]?e.touches[0].clientY:null;
    if(followTouch && touchY!==null && y!==null){
      /* if the browser has started panning natively, stop following (no double scroll) */
      if(followY!==null && Math.abs((window.scrollY||0)-followY)>2){ followTouch=false; }
      else { window.scrollBy(0,touchY-y); followY=window.scrollY||0; }
    }
    touchY=y;
  },{passive:true});
  window.addEventListener('touchend',function(){ followTouch=false; followY=null; touchY=null; },{passive:true});
  function blockLockedScroll(e){
    if(!scrollLocked()) return;
    var loading=root.classList.contains('is-loading');
    if(e.type==='keydown'){
      var k=e.key;
      /* allow Space on Pause / links / fields; only block scroll keys */
      if(k===' ' && e.target && e.target.closest && e.target.closest('button,a,input,textarea,select,[contenteditable]')) return;
      if(k==='ArrowDown'||k==='ArrowUp'||k==='PageDown'||k==='PageUp'||k==='Home'||k==='End'||k===' '){
        if(loading) e.preventDefault(); else releaseHeroLockEarly(e);
      }
      return;
    }
    if(loading){ e.preventDefault(); return; }
    releaseHeroLockEarly(e);
  }
  window.addEventListener('wheel',blockLockedScroll,{passive:false});
  window.addEventListener('touchmove',blockLockedScroll,{passive:false});
  window.addEventListener('keydown',blockLockedScroll);

  var heroUnlockSafety=0;
  function unlockHeroOnce(){
    if(heroUnlockDone) return;
    heroUnlockDone=true;
    clearTimeout(heroUnlockSafety);
    if(film){
      try{
        film.removeEventListener('ended',unlockHeroOnce);
        film.removeEventListener('timeupdate',onHeroProgress);
      }catch(err){}
      film.loop=true;
      film.setAttribute('loop','');
      play(film);
    }
    root.classList.remove('is-hero-lock');
    if(lenis && !root.classList.contains('is-loading')) lenis.start();
    showScrollCue();
  }
  /* Scroll cue: static "Scroll" once after unlock; dismiss on first scroll or ~4s.
     No letter/word loop on the cue itself. */
  function showScrollCue(){
    var cue=document.querySelector('.scroll-cue');
    if(!cue || root.classList.contains('is-hero-lock') || root.classList.contains('is-loading')) return;
    cue.classList.add('is-on');
    cue.setAttribute('aria-hidden','false');
    root.classList.add('is-scroll-cue');
    /* stay visible after unlock; no dismiss */
  }
  
  function onHeroProgress(){
    if(heroUnlockDone || !root.classList.contains('is-hero-lock')) return;
    if(!film) return;
    var d=film.duration;
    if(d && isFinite(d) && d>0 && film.currentTime >= d - 0.05) unlockHeroOnce();
  }
  function armHeroUnlockSafety(){
    clearTimeout(heroUnlockSafety);
    /* film may loop without ended in some engines — force unlock after duration+buffer */
    var ms=22000;
    if(film){
      var d=film.duration;
      if(d && isFinite(d) && d>0) ms=Math.round(d*1000)+1500;
    }
    heroUnlockSafety=setTimeout(function(){
      if(!heroUnlockDone) unlockHeroOnce();
    }, ms);
  }

  /* pass 7: frosted cream mast backing whenever scrolled - page type must never show through nav */
  function syncScrolled(){
    var y = lenis ? lenis.scroll : (window.scrollY || root.scrollTop || 0);
    root.classList.toggle('is-scrolled', y > 28);
  }
  syncScrolled();
  if(lenis){lenis.on('scroll',syncScrolled);}
  else{window.addEventListener('scroll',syncScrolled,{passive:true});}

  var g=window.gsap, ST=window.ScrollTrigger;
  var film=document.querySelector('.open-film');
  /* phone: lighter hero cut (same 1080 frame, smaller file) */
  if(film && window.matchMedia('(max-width:760px)').matches){
    var sm='film/hero-cinematic-sm.mp4';
    if(film.getAttribute('src') && film.getAttribute('src').indexOf('hero-cinematic')>-1){
      film.setAttribute('src', sm);
      try{film.load();}catch(e){}
    }
  }
  if(g&&ST){
    g.registerPlugin(ST);
    if(lenis){lenis.on('scroll',ST.update);g.ticker.add(function(t){lenis.raf(t*1000);});g.ticker.lagSmoothing(0);}
    var mm=window.matchMedia('(max-width:760px)');
    var phone=mm.matches;
    /* pass 10: opening starts large, grows to full-bleed; words part outward */
    var tl=g.timeline({scrollTrigger:{trigger:'.open',start:'top top',end:'bottom bottom',scrub:0.6}});
    tl.fromTo(film,{'--ci':'0%','--cx':'0%','--cr':'0px'},{'--ci':'0%','--cx':'0%','--cr':'0px',ease:'power2.inOut'},0)
      .to('.r-top',{yPercent:-140,opacity:0,ease:'power2.in',duration:0.35},0)
      .to('.r-bot',{yPercent:140,opacity:0,ease:'power2.in',duration:0.35},0);
    /* chapters: window opens, film drifts */
    g.utils.toArray('.reveal').forEach(function(r){
      g.fromTo(r,{'--ri':phone?'6%':'8%','--rx':phone?'4%':'10%'},{'--ri':'0%','--rx':'0%',ease:'none',scrollTrigger:{trigger:r,start:'top 95%',end:'top 18%',scrub:0.6}});
      g.fromTo(r.querySelector('video'),{'--py':'-14%'},{'--py':'0%',ease:'none',scrollTrigger:{trigger:r,start:'top bottom',end:'bottom top',scrub:true}});
    });
    /* headline rows rise (not in the opening) */
    g.utils.toArray('.chapter .display, .together .display, .visit .display').forEach(function(h){
      g.from(h.querySelectorAll('.row>span'),{yPercent:110,duration:1.15,ease:'expo.out',stagger:0.08,scrollTrigger:{trigger:h,start:'top 85%'}});
    });
    g.utils.toArray('.ch-body p, .together-body, .visit-copy p, .visit-copy .acts, .inset, .dip-body').forEach(function(el){
      g.from(el,{y:40,opacity:0,duration:1,ease:'power3.out',scrollTrigger:{trigger:el,start:'top 90%'}});
    });
    /* 02 stepper: ONE capped frame, HARD CUTS via scroll progress (no seam, no blend ghost). Title slides. */
    (function(){
      var st=document.querySelector('.stepper'); if(!st) return;
      var steps=[].slice.call(st.querySelectorAll('.step'));
      if(!steps.length) return;
      function show(idx){
        steps.forEach(function(s,i){
          var on=i===idx;
          s.classList.toggle('is-on',on);
          g.killTweensOf(s);
          g.set(s,{autoAlpha:on?1:0,opacity:on?1:0,visibility:on?'inherit':'hidden',zIndex:on?2:0});
        });
      }
      show(0);
      if(!phone){
        g.fromTo('.slide',{xPercent:0},{xPercent:-50,ease:'none',scrollTrigger:{trigger:st,start:'top top',end:'bottom bottom',scrub:0.7}});
      }
      ST.create({trigger:st,start:'top top',end:'bottom bottom',scrub:true,onUpdate:function(self){
        var p=self.progress;
        var idx=0;
        if(p>=0.66) idx=2; else if(p>=0.33) idx=1;
        show(idx);
      }});
    })();
    /* 03 diptych: still drifts against the sticky film */
    g.fromTo('.dip-still img',{scale:1.15},{scale:1,ease:'none',scrollTrigger:{trigger:'.dip-still',start:'top bottom',end:'bottom top',scrub:true}});
    g.from('.dip-block .row>span',{yPercent:110,duration:1.15,ease:'expo.out',stagger:0.08,scrollTrigger:{trigger:'.dip-block',start:'top 80%'}});
    /* 04 MediaGridPush: staggered y-parallax on grid cells (Vero MediaGridPush idiom) */
    (function(){
      var cells=document.querySelectorAll('.push-grid .pg');
      if(!cells.length) return;
      var shifts=[-48,-28,-64,-36];
      cells.forEach(function(cell,i){
        g.fromTo(cell,{y:40+i*12},{y:shifts[i%shifts.length],ease:'none',scrollTrigger:{trigger:cell,start:'top bottom',end:'bottom top',scrub:true}});
        g.from(cell,{opacity:0,duration:1,ease:'power3.out',scrollTrigger:{trigger:cell,start:'top 92%'}});
      });
      g.from('.push-head .row>span',{yPercent:110,duration:1.15,ease:'expo.out',stagger:0.08,scrollTrigger:{trigger:'.push-head',start:'top 80%'}});
      g.from('.push-body',{y:28,opacity:0,duration:1,ease:'power3.out',scrollTrigger:{trigger:'.push-body',start:'top 90%'}});
    })();
    g.utils.toArray('.collage img').forEach(function(im,i){
      g.to(im,{scale:1,ease:'none',scrollTrigger:{trigger:im,start:'top bottom',end:'bottom top',scrub:true}});
      g.fromTo(im.parentNode,{y:60+i*30},{y:-(30+i*20),ease:'none',scrollTrigger:{trigger:im,start:'top bottom',end:'bottom top',scrub:true}});
    });
  }

  var fw=document.querySelector('.foot-word');
  function fitw(){if(!fw)return;fw.style.setProperty('--fw','10vw');var a=fw.parentNode.clientWidth-2*parseFloat(getComputedStyle(fw.parentNode).paddingLeft);fw.style.setProperty('--fw',(10*a/fw.scrollWidth).toFixed(3)+'vw');}
  (document.fonts?document.fonts.ready:Promise.resolve()).then(fitw);addEventListener('resize',fitw);

  /* loader: counts to 100 on fonts + first film, never longer than 2.6s
     Main hero type stays visibility:hidden via html.is-loading until dismiss. */

  /* pass 8: dropped is-at-end mast retreat (pass 6). End key jumped to footer with mast
     translated off-screen until wheel-up. Visit ROOM heading still clears under sticky mast
     via CSS top:calc(var(--mast)+12px) - no hide needed. */

  var bar=document.querySelector('.loader-bar i'), num=document.querySelector('.loader-bar b');
  var t0=performance.now(), ready=false;
  Promise.race([
    Promise.all([document.fonts?document.fonts.ready:Promise.resolve(),new Promise(function(r){ if(film&&film.readyState>=3) r(); else if(film){film.addEventListener('canplay',r,{once:true});} else r(); })]),
    new Promise(function(r){setTimeout(r,2600);})
  ]).then(function(){ready=true;});
  function step(now){
    var k=Math.min(1,(now-t0)/1500); var p=ready?Math.max(k,0)*100:Math.min(92,k*100);
    if(ready&&k>=1)p=100;
    bar.style.width=p+'%'; num.textContent=Math.round(p)+'%';
    if(p<100){requestAnimationFrame(step);}
    else{setTimeout(function(){
      try{window.scrollTo(0,0);}catch(err){}
      if(lenis){lenis.scrollTo(0,{immediate:true});}
      root.classList.remove('is-loading');root.classList.add('is-done');
      /* hold Lenis + native scroll until hero cinematic plays through once */
      if(film){
        try{
          film.loop=false;
          film.removeAttribute('loop');
          if(film.currentTime>0.05) film.currentTime=0;
        }catch(err){}
        root.classList.add('is-hero-lock');
        try{
          film.loop=false;
          film.removeAttribute('loop');
        }catch(err){}
        film.addEventListener('ended',unlockHeroOnce);
        film.addEventListener('timeupdate',onHeroProgress);
        play(film);
        armHeroUnlockSafety();
        /* already finished (cached / seek edge) */
        onHeroProgress();
        if(film.ended) unlockHeroOnce();
      } else {
        unlockHeroOnce();
      }
      (function idoFade(){
        var iEl=document.querySelector('.open-h1 .ido-i');
        var dEl=document.querySelector('.open-h1 .ido-do');
        if(!iEl||!dEl) return;
        var gen=0;
        function fadeIn(el, done){
          var dur = (el === dEl) ? 3.4 : 0.9;
          if(window.gsap){
            gsap.fromTo(el,{opacity:0,y:14},{opacity:1,y:0,duration:dur,ease:'power2.out',onComplete:done});
          } else {
            el.style.opacity='1';
            if(done) setTimeout(done, Math.round(dur*1000));
          }
        }
        function fadeOut(el, done){
          if(window.gsap){
            gsap.to(el,{opacity:0,y:-10,duration:0.7,ease:'power2.in',onComplete:done});
          } else {
            el.style.opacity='0';
            if(done) setTimeout(done,700);
          }
        }
        // Loop: wait 3s → I in → hold 7s → I out → DO. in (3.4s) → hold 0.25s → DO. out (no loop)
        function cycle(my){
          if(my!==gen || paused) return;
          setTimeout(function(){
            if(my!==gen || paused) return;
            fadeIn(iEl, function(){
              if(my!==gen || paused) return;
              setTimeout(function(){
                if(my!==gen || paused) return;
                fadeOut(iEl, function(){
                  if(my!==gen || paused) return;
                  fadeIn(dEl, function(){
                    if(my!==gen || paused) return;
                    setTimeout(function(){
                      if(my!==gen || paused) return;
                      fadeOut(dEl, function(){ /* no loop */ });
                    }, 250);
                  });
                });
              }, 7000);
            });
          }, 3000);
        }
        function startCycle(){
          gen++;
          if(window.gsap){ gsap.killTweensOf([iEl,dEl]); }
          iEl.style.opacity='0'; dEl.style.opacity='0';
          if(!paused) cycle(gen);
        }
        // Hook Pause/Play without a second listener stack
        var _btn=btn;
        if(_btn){
          _btn.addEventListener('click', function(){
            // runs after the main handler (same tick order: this may run before or after).
            // Defer so outer `paused` is updated.
            setTimeout(function(){
              if(paused){
                gen++;
                if(window.gsap){ gsap.killTweensOf([iEl,dEl]); }
                iEl.style.opacity='0'; dEl.style.opacity='0';
              } else {
                startCycle();
              }
            }, 0);
          });
        }
        startCycle();
      })();
      vids.forEach(function(v){ if(seen.has(v)) play(v); });
    },220);}
  }
  requestAnimationFrame(step);
})();

/* iOS Safari safety net: one-shot scroll reveals always end visible.
   Covers (1) Pause freezing GSAP mid-page, (2) stale trigger positions after fonts/films change layout,
   (3) momentum scroll landing at the very bottom without a trigger firing. */
(function(){
  var g=window.gsap,ST=window.ScrollTrigger;if(!g||!ST)return;
  function shots(){return ST.getAll().filter(function(s){return s.animation&&!s.vars.scrub;});}
  function sweep(){
    var vh=window.innerHeight,de=document.documentElement;
    var y=window.scrollY||de.scrollTop||0;var atEnd=y>0&&de.scrollHeight>vh*1.5&&y+vh>=de.scrollHeight-8;
    var frozen=g.globalTimeline.paused();var all=shots();if(!all.length)return;
    all.forEach(function(s){
      var a=s.animation,t=s.trigger;if(!a||a.progress()>=1)return;
      if(frozen||atEnd){a.progress(1);return;}
      if(a.isActive())return;if(y>=s.start+2||(t&&t.getBoundingClientRect().top<vh*0.5))a.play();
    });
  }
  var q=null;function later(){clearTimeout(q);q=setTimeout(sweep,180);}
  window.addEventListener('scroll',later,{passive:true});
  window.addEventListener('touchend',later,{passive:true});
  document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('.motion,.motion-toggle,#pauseBtn,.pause'))setTimeout(sweep,0);},true);
  setInterval(sweep,1200);
  function refresh(){if(ST.getAll().length){try{ST.refresh();}catch(e){}}later();}
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(refresh);
  window.addEventListener('load',function(){setTimeout(refresh,1500);});
})();
