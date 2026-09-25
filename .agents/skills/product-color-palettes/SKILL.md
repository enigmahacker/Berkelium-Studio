---
name: product-color-palettes
description: |
  Curated design system color palettes and theme generator across 96 specialized product categories and industries (e.g. SaaS, E-Commerce, Cyber, Fintech, Healthcare, Developer Tools, Aerospace, Spatial OS, AI/Chatbots, Quantum Computing).
  Use whenever:
    1. The user asks to style, theme, or pick colors for a web app, dashboard, landing page, or mobile app.
    2. Generating Tailwind CSS color configurations or CSS root variables.
    3. Designing brand aesthetics, dark/light modes, CTA buttons, card backgrounds, or UI borders based on industry best practices.
license: MIT
metadata:
  version: v1
  author: community
---

# Product Color Palettes & Design System Generator

This skill provides an authoritative, curated design system mapping of **96 product types and industries** to precise, production-tested Hex color palettes (Primary, Secondary, CTA, Background, Text, and Border), along with psychological design notes and Tailwind/CSS tokens.

---

## 1. Quick Lookup Utility

You can query the curated dataset using the bundled CLI script:

```bash
# Query by keyword or category name
python3 ~/.gemini/config/skills/product-color-palettes/scripts/lookup_palette.py aerospace
python3 ~/.gemini/config/skills/product-color-palettes/scripts/lookup_palette.py saas --tailwind
python3 ~/.gemini/config/skills/product-color-palettes/scripts/lookup_palette.py cybersecurity --css

# List all 96 product archetypes
python3 ~/.gemini/config/skills/product-color-palettes/scripts/lookup_palette.py --list
```

---

## 2. Core Color Roles & Token Architecture

Each product archetype in this system defines 6 essential functional tokens:

| Token | Role | Usage Guidelines |
| :--- | :--- | :--- |
| **`Primary`** | Brand identity & primary interactive elements | Main headers, active nav items, key logos, primary icons. |
| **`Secondary`** | Supporting elements & subtle accents | Hover fills, secondary badges, active pill backgrounds, tabs. |
| **`CTA`** | Conversion driver & high-contrast action | "Get Started", "Submit", "Run Simulation", purchase buttons. |
| **`Background`** | Viewport & container surface | Canvas body, section backgrounds, card surface tints. |
| **`Text`** | Typography & legible content | Headings, body copy, descriptions (verified for contrast). |
| **`Border`** | Structural division & card outlines | Panel dividers, input borders, card frames, separators. |

---

## 3. Top Industry Archetype Matrix (Reference Sample)

Below is an extract of high-frequency archetypes from the 96 categories in `resources/palettes.csv`:

| ID | Product Type | Primary | Secondary | CTA | Background | Text | Border | Aesthetics / Notes |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | **SaaS (General)** | `#2563EB` | `#3B82F6` | `#F97316` | `#F8FAFC` | `#1E293B` | `#E2E8F0` | Trust blue + high-contrast orange CTA |
| **4** | **E-commerce Luxury** | `#1C1917` | `#44403C` | `#CA8A04` | `#FAFAF9` | `#0C0A09` | `#D6D3D1` | Premium slate/black + gold accent |
| **7** | **Financial Dashboard** | `#3B82F6` | `#60A5FA` | `#F97316` | `#F8FAFC` | `#1E293B` | `#E2E8F0` | Trust blue + status alerts |
| **9** | **Healthcare App** | `#0891B2` | `#22D3EE` | `#059669` | `#ECFEFF` | `#164E63` | `#A5F3FC` | Calm cyan + health emerald |
| **13** | **Gaming** | `#7C3AED` | `#A78BFA` | `#F43F5E` | `#0F0F23` | `#E2E8F0` | `#4C1D95` | Cyber purple + neon rose + dark abyss |
| **15** | **Fintech / Crypto** | `#F59E0B` | `#FBBF24` | `#8B5CF6` | `#0F172A` | `#F8FAFC` | `#334155` | Gold + crypto violet + midnight |
| **19** | **AI / Chatbot Platform** | `#7C3AED` | `#A78BFA` | `#06B6D4` | `#FAF5FF` | `#1E1B4B` | `#DDD6FE` | Neural violet + cyan electric spark |
| **86** | **Cybersecurity** | `#00FF41` | `#0D0D0D` | `#00FF41` | `#000000` | `#E0E0E0` | `#1F1F1F` | Matrix hacker green + deep terminal |
| **87** | **Developer Tool / IDE** | `#3B82F6` | `#1E293B` | `#2563EB` | `#0F172A` | `#F1F5F9` | `#334155` | Syntax blue + VS dark slate |
| **88** | **Biotech / Life Sciences** | `#0EA5E9` | `#0284C7` | `#10B981` | `#F8FAFC` | `#0F172A` | `#E2E8F0` | Sterile blue + DNA green |
| **89** | **Space Tech / Aerospace** | `#FFFFFF` | `#94A3B8` | `#3B82F6` | `#0B0B10` | `#F8FAFC` | `#1E293B` | Deep cosmic black + star white + cobalt |
| **91** | **Quantum Computing** | `#00FFFF` | `#7B61FF` | `#FF00FF` | `#050510` | `#E0E0FF` | `#333344` | Cyan + ultraviolet + magenta neon |
| **95** | **Spatial / Vision OS** | `#FFFFFF` | `#E5E5E5` | `#007AFF` | `#888888` | `#000000` | `#FFFFFF` | 20% glass frost + Apple system blue |
| **96** | **Climate Tech** | `#2E8B57` | `#87CEEB` | `#FFD700` | `#F0FFF4` | `#1A3320` | `#C6E6C6` | Sea green + sky blue + solar yellow |

*The complete 96-category table is persisted in [`resources/palettes.csv`](./resources/palettes.csv).*

---

## 4. Implementation Patterns

### Pattern A: CSS Root Variables
When generating or styling vanilla CSS, React, or standard web components:

```css
:root {
  --color-primary: #3B82F6;
  --color-secondary: #60A5FA;
  --color-cta: #F97316;
  --color-bg: #F8FAFC;
  --color-text: #1E293B;
  --color-border: #E2E8F0;
}

body {
  background-color: var(--color-bg);
  color: var(--color-text);
}

.btn-cta {
  background-color: var(--color-cta);
  color: #ffffff;
  border-radius: 0.375rem;
  padding: 0.5rem 1rem;
}
```

### Pattern B: Tailwind CSS Configuration
When configuring `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3B82F6',
          hover: '#2563EB',
        },
        secondary: '#60A5FA',
        cta: {
          DEFAULT: '#F97316',
          hover: '#EA580C',
        },
        surface: '#F8FAFC',
        content: '#1E293B',
        separator: '#E2E8F0',
      }
    }
  }
}
```

---

## 5. Workflow for the Agent

When a user asks to design, style, or generate a frontend:
1. **Identify the Domain / Category**: Match user prompt keywords against the 96 product archetypes (e.g. "Dev tools", "Fintech", "Aerospace").
2. **Apply Exact Palette**: Extract the exact hex values from `resources/palettes.csv` or by calling `scripts/lookup_palette.py <keyword>`.
3. **Ensure WCAG Contrast**:
   - Verify text-to-background contrast $\ge 4.5:1$ (normal text) and $\ge 3:1$ (large headings).
   - Ensure CTA buttons have distinct visual pop relative to both background and primary surfaces.
4. **Enforce Cohesion**: Keep icons, borders, active focus rings, and accents aligned with the chosen archetype tokens.
