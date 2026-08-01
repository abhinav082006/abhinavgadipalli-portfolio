// ---------- Scroll reveal ----------
const obs = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), i * 90);
      obs.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });

document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

// ---------- Nav active-link highlight + scrolled shadow ----------
const nav = document.getElementById('nav');
const sections = document.querySelectorAll('[id]');
const links = document.querySelectorAll('.nav-links a');

window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 20);

  let current = '';
  sections.forEach(section => {
    if (window.scrollY >= section.offsetTop - 220) current = section.id;
  });
  links.forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === '#' + current);
  });
});