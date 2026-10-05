# Ace Fitness Club — Website

Futuristic, performance-first website for **Ace Fitness Club, Ambegaon Budruk (Katraj–Ambegaon), Pune**.

Static site: plain HTML, CSS and JavaScript. No frameworks, no build step, no third-party scripts. Upload the folder to any host and it runs.

| Lighthouse (production-like hosting) | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| Mobile | 97 | 100 | 100 | 100 |
| Desktop | 99 | 100 | 100 | 100 |

Mobile: Total Blocking Time 20 ms, CLS 0. The hero holds 60 fps under a 4× CPU throttle.

---

## What's on the page

| Section | What it does |
| --- | --- |
| **Intro** | A barbell gets loaded plate by plate (≈1.2 s, once per visit; skipped for reduced-motion users). |
| **Hero** | "Outside the comfort zone." A live point-cloud "forge" morphs between the ACE wordmark, a dumbbell, a kettlebell and a 20 kg Olympic plate. It reacts to the mouse, explodes into dust as you scroll, and shows a live Pune clock and open/closed status. |
| **Ticker** | Discipline marquee that skews with scroll speed. |
| **01 Club** | Manifesto that lights up word by word as you read, plus odometer stats (10+ years, 4.2★ Justdial, 16 h/day, 7 days). |
| **02 Training** | Ten discipline cards on a pinned horizontal rack (swipe on mobile). Each card has its own looping gym animation. |
| **03 Floor** | Amenities with self-drawing line icons and a member quote. |
| **04 Rep Lab** | 1RM estimator with a **live plate loader** (color-coded IWF plates per side) and a **BMI gauge**. |
| **05 Plans** | Day / Monthly / Half-Yearly / Annual pricing with per-day cost and savings. |
| **06 Members** | Real member reviews in an auto-advancing carousel. |
| **07 Visit** | 24-hour "day cycle" dial with a live needle, address, three phone lines, directions, and a Google Map that lazy-loads. |
| **08 FAQ** | Common questions (also published as FAQ structured data for Google). |
| **Join** | Enquiry form that opens **WhatsApp** pre-filled with name, number, goal and preferred time. |
| **Mobile dock** | Call / WhatsApp / Directions bar on phones. |

---

## Content sources

All facts come from Ace's public listings for the **Ambegaon Budruk** branch:

- Justdial listing: address, landmarks, 4.2★ / 340+ ratings, "10 years in business", hours 6 AM–10 PM (7 days), prices (Day ₹200 · Month ₹2,500 · 6 Months ₹8,000 · Year ₹10,000), lockers, showers, Zumba, nutrition consultation, unisex.
- Instagram [@acefitnessclub_](https://www.instagram.com/acefitnessclub_/): "Biggest Gym In Katraj-Ambegaon Area", motto *"All progress takes place outside the comfort zone"*, phones 82372 71555 / 99707 78888.
- Google rating 4.3 (277 reviews) and the member reviews from Kartik, P. M. and Sushrut Patil (CrossFit, yoga, Zumba, kickboxing, twice-weekly abs batches, parking, cleanliness).
- Joonsquare: map coordinates 18.454810, 73.834785; Facebook page [Acefitnessclub2](https://www.facebook.com/Acefitnessclub2/).

**Deliberately excluded:** `acefitnessclub.in` / `acefitnessclub.com` (and the e-mail `info@acefitnessclub.com`) belong to a **different Ace Fitness Club in Bikaner, Rajasthan** (director Abhishek K. Gaur, Reformer Pilates). None of that content is used here.

### Confirm with the gym before launch

1. **WhatsApp number.** All WhatsApp buttons and the form go to **+91 83808 81555**. If they use a different WhatsApp number, change `GYM.whatsapp` in `assets/js/main.js` and every `wa.me/918380881555` link in `index.html`.
2. **Prices.** Listed prices are from Justdial. Update them in the Plans section and in the FAQ (both in `index.html`).
3. **Logo.** The "A with a barbell crossbar" mark is a placeholder brand mark. Swap in the official logo if they have one (`.logo__mark` SVGs and `assets/img/favicon.svg`).
4. **Photos.** No gym photos are bundled (the visuals are code-generated). Real photos of the floor would make a strong gallery addition.
5. **Batch timings / trainer names.** These aren't published anywhere, so the site points visitors to the front desk.

---

## Editing

Everything editable lives in **`index.html`**, one commented block per section (`<!-- ============ 05 PLANS ============ -->` and so on).

| Change | Where |
| --- | --- |
| Phone numbers | Search `tel:+91` in `index.html` |
| Opening hours (live status + dial) | `GYM.openMin` / `GYM.closeMin` in `assets/js/main.js`, plus the text in `index.html` |
| Prices | `.plan__price` blocks in `index.html` |
| Colors | CSS variables at the top of `assets/css/main.css` (`--volt` is the signature lime) |
| Hero specimens | `SHAPES` in `assets/js/forge.js` |

---

## Deploying

No build step. Pick one:

- **Netlify:** drag the folder onto [app.netlify.com/drop](https://app.netlify.com/drop). `netlify.toml` sets cache headers.
- **Vercel:** import the repo and deploy as a static site. `vercel.json` sets cache headers.
- **cPanel / Hostinger / GoDaddy:** upload everything to `public_html/`. `.htaccess` enables gzip and caching.

After deploying, set `og:image` in `index.html` to the full URL (e.g. `https://yourdomain.in/assets/img/og.png`) so WhatsApp and Instagram link previews show the share card.

---

## Performance & accessibility notes

- Animations touch only `transform` and `opacity`. One shared, rAF-throttled scroll loop with cached layout reads, so scrolling never forces a reflow.
- The hero canvas pauses when off-screen or when the tab is hidden, and scales its point count to the device.
- Looping card animations run only for cards that are actually on screen.
- Fonts (Archivo variable + JetBrains Mono, SIL Open Font License) are self-hosted and preloaded. No layout overflow even if they fail to load.
- `prefers-reduced-motion` gets a calm, static version: no intro, no loops, the hero shows a still frame.
- Semantic landmarks, skip link, keyboard-operable tabs/menu/carousel, visible focus, WCAG AA contrast.
- Structured data: `ExerciseGym` (address, geo, hours, price range, socials) and `FAQPage`.

## Structure

```
index.html
assets/
  css/main.css      design system + all section styles
  js/main.js        interactions (scroll loop, rack, Rep Lab, dial, form…)
  js/forge.js       hero point-cloud engine
  fonts/            self-hosted woff2
  img/              favicon, app icons, social share image
site.webmanifest  robots.txt  .htaccess  netlify.toml  vercel.json
```
