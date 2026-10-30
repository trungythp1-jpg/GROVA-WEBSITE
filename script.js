(() => {
  const button=document.getElementById("menu");
  const nav=document.getElementById("nav");
  if(button&&nav){
    button.addEventListener("click",()=>{
      const open=nav.classList.toggle("open");
      button.setAttribute("aria-expanded",String(open));
      button.setAttribute("aria-label",open?"Đóng menu":"Mở menu");
    });
    nav.querySelectorAll("a").forEach(link=>link.addEventListener("click",()=>{
      nav.classList.remove("open");
      button.setAttribute("aria-expanded","false");
      button.setAttribute("aria-label","Mở menu");
    }));
    document.addEventListener("keydown",event=>{
      if(event.key==="Escape"&&nav.classList.contains("open")){
        nav.classList.remove("open");
        button.setAttribute("aria-expanded","false");
        button.setAttribute("aria-label","Mở menu");
        button.focus();
      }
    });
  }
  const year=document.getElementById("year");
  if(year)year.textContent=new Date().getFullYear();
  if(!window.gsap||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const gsap=window.gsap;
  if(window.ScrollTrigger)gsap.registerPlugin(window.ScrollTrigger);
  gsap.timeline({defaults:{ease:"power3.out"}})
    .from(".premium-kicker",{y:16,autoAlpha:0,duration:.5})
    .from(".premium-hero h1",{y:28,autoAlpha:0,duration:.75},"-=.2")
    .from(".premium-hero-lead",{y:18,autoAlpha:0,duration:.6},"-=.4")
    .from(".premium-actions > *",{y:12,autoAlpha:0,duration:.45,stagger:.1},"-=.3")
    .from(".hero-index",{y:10,autoAlpha:0,duration:.4},"-=.2")
    .from(".hero-visual",{scale:.94,autoAlpha:0,duration:1},"-=.8");
  if(window.ScrollTrigger){
    const revealSelectors=[
      ".intro-heading",".intro-copy",".principle-grid article",
      ".ecosystem-heading",".ecosystem-card",".approach-art",
      ".approach-copy",".contact-intro",".premium-lead-form"
    ];
    revealSelectors.forEach(selector=>{
      gsap.utils.toArray(selector).forEach((element,index)=>{
        gsap.from(element,{
          y:26,autoAlpha:0,duration:.7,delay:selector===".principle-grid article"?index*.07:0,
          ease:"power2.out",
          scrollTrigger:{trigger:element,start:"top 88%",once:true}
        });
      });
    });
    gsap.from(".visual-building",{y:24,autoAlpha:0,duration:.9,stagger:.12,ease:"power3.out",delay:.15});
    gsap.from(".approach-bar",{scaleY:.15,transformOrigin:"bottom",duration:.8,stagger:.1,ease:"power3.out",scrollTrigger:{trigger:".approach-art",start:"top 80%",once:true}});
  }
  if(window.matchMedia("(hover: hover) and (pointer: fine)").matches){
    document.querySelectorAll(".ecosystem-card,.premium-button,.site-nav-cta").forEach(element=>{
      element.addEventListener("mouseenter",()=>gsap.to(element,{y:-3,duration:.2,overwrite:true}));
      element.addEventListener("mouseleave",()=>gsap.to(element,{y:0,duration:.25,overwrite:true}));
    });
  }
})();