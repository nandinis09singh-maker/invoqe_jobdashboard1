/* CareerFlow — shared premium motion for Saved Jobs, Applications & Career Resources */
(function () {
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const css = `
    html { scroll-behavior:smooth; }
    body { animation: cfPageIn .55s cubic-bezier(.2,.8,.2,1) both; }
    @keyframes cfPageIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
    @keyframes cfPageOut { to{opacity:0;transform:translateY(-8px)} }
    @keyframes cfRise { from{opacity:0;transform:translateY(24px) scale(.985)} to{opacity:1;transform:none} }
    @keyframes cfPop { 0%{transform:scale(.96);opacity:0} 100%{transform:scale(1);opacity:1} }
    @keyframes cfShimmer { 0%{background-position:120% 0} 100%{background-position:-120% 0} }
    body.cf-leave { animation:cfPageOut .22s ease both; pointer-events:none; }

    .cf-reveal { opacity:0; transform:translateY(24px); }
    .cf-reveal.cf-visible { animation:cfRise .7s cubic-bezier(.2,.8,.2,1) both; }

    .job-card, .application, article[data-guide], .stat-card {
      will-change:transform;
      transform-style:preserve-3d;
    }
    .job-card, article[data-guide], .stat-card, .application {
      transition:transform .28s cubic-bezier(.2,.8,.2,1), box-shadow .28s ease, border-color .22s ease, background-color .22s ease;
    }
    .job-card:hover, article[data-guide]:hover, .stat-card:hover {
      box-shadow:0 18px 42px rgba(31,35,70,.12);
    }
    .job-card .company-logo, article[data-guide] > *, .stat-card > * { transition:transform .3s ease; }
    .job-card:hover .company-logo { transform:translateZ(16px) scale(1.04); }
    .apply-button, .btn-primary, .btn-secondary, button { transition:transform .2s ease, box-shadow .25s ease, background-color .2s ease, color .2s ease, border-color .2s ease; }
    .apply-button:hover, .btn-primary:hover, .btn-secondary:hover { transform:translateY(-2px); box-shadow:0 10px 24px rgba(67,56,234,.22); }
    button:active, .apply-button:active, .btn-primary:active, .btn-secondary:active { transform:scale(.97); }

    .nav a, .nav-links a { transition:color .2s ease, transform .2s ease; }
    .nav a:hover, .nav-links a:hover { transform:translateY(-1px); }
    .logo, .brand { transition:transform .25s ease; }
    .logo:hover, .brand:hover { transform:translateY(-1px); }

    .bell, .profile, .profile-circle { transition:transform .25s ease, box-shadow .25s ease; }
    .bell:hover { transform:rotate(-8deg) scale(1.06); }
    .profile:hover, .profile-circle:hover { transform:scale(1.06); box-shadow:0 8px 22px rgba(17,24,39,.16); }

    #guide-modal.open { animation:cfPop .25s ease both; }
    .modal-backdrop, .modal-overlay { backdrop-filter:blur(7px); }

    .cf-filter-in { animation:cfRise .42s ease both; }
    .cf-count { display:inline-block; min-width:1ch; }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation:none !important; transition:none !important; scroll-behavior:auto !important; }
      .cf-reveal { opacity:1 !important; transform:none !important; }
    }
  `;
  const style=document.createElement('style'); style.textContent=css; document.head.appendChild(style);

  function tilt(el, strength=7) {
    if (reduce) return;
    el.addEventListener('mousemove', e => {
      const r=el.getBoundingClientRect();
      const x=(e.clientX-r.left)/r.width-.5;
      const y=(e.clientY-r.top)/r.height-.5;
      el.style.transform=`perspective(900px) rotateX(${-y*strength}deg) rotateY(${x*strength}deg) translateY(-3px)`;
    });
    el.addEventListener('mouseleave',()=>{el.style.transform='';});
  }

  document.addEventListener('DOMContentLoaded',()=>{
    const selectors=['.page-header','.heading','.stats','.jobs-list','.job-card','.application','article[data-guide]','#wordmark','main > section','main > form'];
    const targets=[...document.querySelectorAll(selectors.join(','))];
    if (!reduce && 'IntersectionObserver' in window) {
      const io=new IntersectionObserver(entries=>entries.forEach(entry=>{
        if(!entry.isIntersecting)return;
        entry.target.classList.add('cf-reveal','cf-visible');
        io.unobserve(entry.target);
      }),{threshold:.08});
      targets.forEach((el,i)=>{el.style.animationDelay=`${Math.min(i*55,450)}ms`;io.observe(el);});
    } else targets.forEach(el=>el.classList.add('cf-visible'));

    document.querySelectorAll('.job-card').forEach(c=>tilt(c,5));
    document.querySelectorAll('article[data-guide]').forEach(c=>tilt(c,4));
    document.querySelectorAll('.stat-card').forEach(c=>tilt(c,7));

    /* Animate numeric application statistics */
    if (!reduce) document.querySelectorAll('.stat-number').forEach(el=>{
      const end=parseInt(el.textContent,10); if(Number.isNaN(end)) return;
      const start=performance.now(), duration=850;
      function tick(now){
        const p=Math.min((now-start)/duration,1);
        el.textContent=Math.round(end*(1-Math.pow(1-p,3)));
        if(p<1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });

    /* Animate filter changes */
    document.querySelectorAll('select').forEach(select=>select.addEventListener('change',()=>{
      document.querySelectorAll('.application,.job-card,article[data-guide]').forEach((el,i)=>{
        if(getComputedStyle(el).display!=='none'){
          el.classList.remove('cf-filter-in'); void el.offsetWidth; el.style.animationDelay=`${Math.min(i*45,300)}ms`; el.classList.add('cf-filter-in');
        }
      });
    }));

    /* Animated page-to-page navigation */
    document.addEventListener('click',e=>{
      const a=e.target.closest('a[href]');
      if(!a || a.target || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const h=a.getAttribute('href');
      if(!h || h.startsWith('#') || /^(https?:|mailto:|tel:|javascript:)/i.test(h)) return;
      if (h.includes('.html')) {
        e.preventDefault();
        if(reduce){location.href=h;return;}
        document.body.classList.add('cf-leave');
        setTimeout(()=>location.href=h,220);
      }
    });
    window.addEventListener('pageshow',()=>document.body.classList.remove('cf-leave'));
  });
})();
