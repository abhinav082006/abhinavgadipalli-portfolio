# Gadipalli Abhinav — Portfolio

Personal portfolio site for **Gadipalli Abhinav**, Computer Science student at IIIT Kottayam. Built as a clean, editorial-style single-page site — separated into HTML, CSS, and JS instead of one combined file.

**Live site:** [abhinavgadipalli.vercel.app](https://abhinavgadipalli.vercel.app/)

---

## ✨ Features

- **Editorial, warm color palette** — espresso, mahogany, clay, stone, and sand tones instead of a generic dark/neon theme
- **Custom typography** — [Fraunces](https://fonts.google.com/specimen/Fraunces) (display serif, used in headings and accents) paired with [Inter](https://fonts.google.com/specimen/Inter) (body/UI text)
- **Tilted "postcard" hero photo frame** with floating location/degree badges
- **Signature oval badge** used consistently across nav, hero, and section labels
- **Row-based skills layout** grouped by category instead of a plain tag grid
- **Editorial project list** — full-width rows with hover accent bars, icon markers, and pill-style GitHub/Live Demo buttons
- **Vertical timeline** for education & experience
- **Dark "certificate" style education card** instead of a plain white box
- **Resume buttons** — view (opens in new tab) and download, in the nav, hero, and footer
- **Scroll-reveal animations** on section entry, smooth hover transitions throughout
- **Fully responsive** — adapted layouts for tablet and mobile
- **Respects `prefers-reduced-motion`** for accessibility

---

## 🗂️ Project Structure

```
├── index.html      # Page structure/content
├── style.css        # All styling — colors, typography, layout, animations
├── script.js         # Scroll-reveal + nav active-link highlighting
├── myphoto.png       # Profile photo (add your own — see below)
├── resume.pdf         # Resume file (add your own — see below)
└── README.md
```

Previously the site had HTML and CSS combined in a single file — this version keeps them fully separated for easier maintenance.

---

## 🔧 Setup

This is a static site — no build step or dependencies required.

1. Clone the repo
2. Add your own **`myphoto.png`** and **`resume.pdf`** to the project root (exact filenames, case-sensitive — this matters on Linux-based hosts like Vercel)
3. Open `index.html` directly, or use a local dev server (e.g. VS Code's **Live Server** extension) to preview
4. Deploy anywhere that serves static files (Vercel, Netlify, GitHub Pages, etc.)

> If `myphoto.png` is missing, the hero frame gracefully falls back to a gradient placeholder icon instead of breaking the layout.

---

## 🛠️ Built With

- HTML5 & CSS3 (custom properties / CSS variables for theming)
- Vanilla JavaScript (`IntersectionObserver` for scroll reveals)
- [Font Awesome](https://fontawesome.com/) for icons
- [Google Fonts](https://fonts.google.com/) — Fraunces & Inter

---

## 📬 Contact

- **Email:** abhinavgadipelli0806@gmail.com
- **GitHub:** [github.com/abhinav082006](https://github.com/abhinav082006)
- **LinkedIn:** [linkedin.com/in/abhinav-gadipalli](https://linkedin.com/in/abhinav-gadipalli/)
