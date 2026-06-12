# snapmcp Brand Guidelines

> **Version 1.0** — *Precision captures for AI agents.*

---

## Identity Overview

**snapmcp** is a developer tool. It captures visual output — terminals, code, browsers, markdown, diffs, HTML, and PDFs — through a single MCP server.

The brand communicates:
- **Precision** — every capture is pixel-perfect
- **Speed** — instant results, no friction
- **Developer-first** — made for AI agents and the people who build them
- **Glass aesthetics** — premium, modern, lightweight

---

## Brand Strategy

| Element | Direction |
|---------|-----------|
| **Category** | Developer tool / MCP infrastructure |
| **Audience** | AI engineers, developer tool builders, agent operators |
| **Personality** | Precise, fast, minimalist, technical, premium |
| **Core metaphor** | "Frame" + "Lens" — the act of capturing what's on screen |
| **Emotional promise** | Clarity through precision |
| **Cultural position** | Builder-native, open, trustworthy |

---

## Logo

### Primary Mark
The logo combines a **frame** (the capture viewport) with **connection nodes** (MCP touchpoints) and a **center lens** (the focus point).

[View full logo →](./logo/snapmcp-logo.svg)

### Logo Variations

| Variant | File | Usage |
|---------|------|-------|
| Full badge | `logo/snapmcp-logo.svg` | Hero, about, docs header |
| Horizontal | `logo/snapmcp-logo-horizontal.svg` | README, website, social cards |
| Icon only | `logo/snapmcp-icon.svg` | Favicon, app icon, toolbar |
| Monochrome | `logo/snapmcp-logo-mono.svg` | Print, grayscale, dark backgrounds |

### Clear Space
Minimum clear space: **16px** around the logo (1× the icon width).

### Minimum Size
- Full logo: **32px** height minimum
- Icon only: **24px** minimum

---

## Color Palette

### Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Primary Teal | `#00d4aa` | Primary accent, links, highlights |
| Secondary Blue | `#0099ff` | Secondary accent, info |
| Tertiary Purple | `#7c4dff` | Debug mode, experimental features |
| Gradient | `#00d4aa → #0099ff → #7c4dff` | Hero backgrounds, badges, glow effects |

### Neutrals

| Color | Hex | Usage |
|-------|-----|-------|
| Near Black | `#0d0d12` | Background (default dark) |
| Dark | `#1a1a2e` | Surface panels, cards |
| Medium | `#2a2a3e` | Elevated surfaces, hover states |
| Gray | `#6b6b80` | Secondary text, metadata |
| Light | `#a0a0b8` | Body text (dark bg) |
| White | `#e8e8f0` | Primary text (dark bg), headings |

### Semantic Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Green | `#28c93f` | Success, diff additions |
| Yellow | `#ffbd2e` | Warning, traffic light |
| Red | `#ff5f57` | Error, diff deletions |
| Blue | `#0099ff` | Info, links |

---

## Typography

### Primary Font (Monospace)

**JetBrains Mono** / **Fira Code** / **Cascadia Code**

Used for: code, terminal output, commands, technical documentation, UI labels.

```css
font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Ubuntu Mono', 'Consolas', monospace;
```

### UI Font (System)

**-apple-system / Segoe UI / system-ui**

Used for: body text, markdown rendering, documentation prose.

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
```

### Type Scale

| Size | Usage |
|------|-------|
| 11px | Badge text, footnotes |
| 12px | Metadata, file paths |
| 13px | Small labels, secondary UI |
| 14px | Terminal/code body (default) |
| 16px | Body text, markdown content |
| 20px | Section headings |
| 28px | Page headings |
| 36px | Hero, display |

---

## Visual Language

### Glass Aesthetic

snapmcp uses a **glassmorphism** design language:

- Translucent backgrounds with blur
- Clean, thin borders (`1px` at `rgba(255,255,255,.06)`)
- Gradient overlays for depth
- macOS-style traffic light controls
- Configurable drop-shadow levels (none / soft / medium / strong)
- Rounded corners (8px default, configurable 0–32px)

### Dark Mode Default

The brand lives primarily in **dark mode**:
- Background: `#0d0d12`
- Surfaces: layered from `#14141e` to `#2a2a3e`
- Text: `#d0d0e0` on dark
- Accents: brand gradient for emphasis

### Light Mode Compatibility

All colors have sufficient contrast ratio (≥4.5:1) for light backgrounds.
Default light capture themes invert gracefully.

---

## Gradients

The brand gradient is a signature element:

```
Gradient: 135° from #00d4aa → #0099ff → #7c4dff
```

Used sparingly on:
- Logo mark
- Interactive elements (hover states)
- Hero banners
- Glow effects

---

## Capture Window Design

Every snapmcp capture follows a consistent layout:

```
┌──────────────────────────────────┐
│  ● ● ●  window-title            │  ← Glass title bar
├──────────────────────────────────┤
│                                  │
│          content area            │  ← Configurable padding
│                                  │
├──────────────────────────────────┤
│              snapmcp             │  ← Optional badge footer
└──────────────────────────────────┘
```

- **Title bar**: macOS traffic lights + title (configurable on/off)
- **Body**: Syntax-highlighted content in a framed window
- **Badge**: Optional "snapmcp" footer (off by default)
- **Shadow**: Configurable 4 levels
- **Border radius**: Configurable 0–32px

---

## Tone of Voice

| Context | Tone |
|---------|------|
| CLI output | Terse, precise |
| Documentation | Clear, helpful, technical |
| Error messages | Direct, actionable |
| Marketing | Confident, builder-native |

### Tagline

> **All-in-one visual captures for AI agents.**
> *Terminal · Code · Browser · Markdown · Diff · HTML · PDF*

---

## Brand Applications

### Badge (capture watermark)

The "snapmcp" badge appears in the bottom-right of captures when `SNAPMCP_BADGE=true`:

```css
font-size: 11px;
opacity: 0.35;
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### CLI Banner

The startup banner displays the brand in ASCII:

```
  ┌────────────────────────────────┬
  │  snapmcp v2.1  —  8 tools     │
  │  27 themes · GLASS terminal   │
  │  PNG / JPEG / PDF             │
  └────────────────────────────────┘
```

### Env Var Prefix

All environment variables use the `SNAPMCP_` prefix:
- `SNAPMCP_DIR`
- `SNAPMCP_THEME`
- `SNAPMCP_FORMAT`
- etc.

---

## File & Asset Structure

```
brand/
├── guidelines/
│   └── BRAND.md                 ← This file
├── logo/
│   ├── snapmcp-logo.svg          ← Full badge
│   ├── snapmcp-logo-horizontal.svg ← Horizontal wordmark
│   ├── snapmcp-logo-mono.svg     ← Monochrome version
│   └── snapmcp-icon.svg          ← Icon only
├── tokens/
│   ├── snapmcp-tokens.json       ← Design tokens (JSON)
│   └── snapmcp-variables.css     ← Design tokens (CSS)
└── assets/
    └── (generated captures, social cards, etc.)
```

---

## Design Principles

1. **Precision over decoration** — every visual element earns its place
2. **Developer-native** — tool as craft, not corporate
3. **Glass, not plastic** — translucent, layered, depth-aware
4. **Configurable by design** — users own their visual experience
5. **Dark by default** — light as the exception, not the rule
6. **One gradient, many uses** — the brand gradient is the only gradient

---

*For questions or brand asset requests, refer to the repository: github.com/reeinharddd/snapmcp*
