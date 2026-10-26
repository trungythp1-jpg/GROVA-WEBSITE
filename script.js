(() => {
  const button = document.getElementById("menu");
  const nav = document.getElementById("nav");

  if (button && nav) {
    button.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      button.setAttribute("aria-expanded", String(open));
      button.setAttribute("aria-label", open ? "Đóng menu" : "Mở menu");
    });
    nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
      nav.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "Mở menu");
    }));
  }

  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  if (!window.gsap || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const gsap = window.gsap;
  if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

  const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
  intro
    .from(".hero .eyebrow", { y: 18, autoAlpha: 0, duration: 0.55 })
    .from(".hero h1", { y: 34, autoAlpha: 0, duration: 0.8 }, "-=0.25")
    .from(".hero .lead", { y: 20, autoAlpha: 0, duration: 0.65 }, "-=0.45")
    .from(".hero .actions .btn", { y: 14, autoAlpha: 0, duration: 0.5, stagger: 0.12 }, "-=0.35")
    .from(".hero .stats > div", { y: 14, autoAlpha: 0, duration: 0.45, stagger: 0.1 }, "-=0.25")
    .from(".orb", { scale: 0.88, autoAlpha: 0, duration: 1 }, "-=0.85");

  if (window.ScrollTrigger) {
    gsap.utils.toArray(".about > div, .values article, .section-head, .capability > div, .contact-inner > div").forEach((element) => {
      gsap.from(element, {
        y: 28,
        autoAlpha: 0,
        duration: 0.7,
        ease: "power2.out",
        scrollTrigger: {
          trigger: element,
          start: "top 88%",
          once: true
        }
      });
    });

    gsap.from(".architecture div", {
      scaleY: 0.2,
      transformOrigin: "bottom",
      duration: 0.8,
      stagger: 0.09,
      ease: "power3.out",
      scrollTrigger: {
        trigger: ".architecture",
        start: "top 82%",
        once: true
      }
    });
  }

  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.querySelectorAll(".cards article").forEach((card) => {
      card.addEventListener("mouseenter", () => gsap.to(card, { y: -5, duration: 0.22, overwrite: true }));
      card.addEventListener("mouseleave", () => gsap.to(card, { y: 0, duration: 0.28, overwrite: true }));
    });
  }
})();
