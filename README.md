# Adiverse Align

> A premium offline-first execution operating system for structured learning, syllabus tracking, deep work planning, and progress visualization.



## Live Demo

🌐 https://align-seven-zeta.vercel.app/

---

# Overview

Adiverse Align is not just another checklist or to-do app.

It is a **hierarchical execution workspace** designed for:

- GATE / exam preparation
- college syllabus tracking
- robotics / engineering project execution
- ML / DSA learning roadmaps
- certification planning
- deep structured learning systems
- revision workflows
- productivity execution tracking

Think of it as:

**Notion + Study Tracker + AI JSON Importer + Offline Execution Dashboard + Progress Analytics**

---

# Core Philosophy

Traditional checklist apps fail because:

- flat task lists become chaotic
- no real hierarchy
- poor progress visibility
- weak offline support
- syllabus import is painful
- no revision-instance workflows
- boring UI kills motivation

Adiverse Align solves this with a structured execution architecture.

---

# Features

## Hierarchical Workspace System

Organize work with deep structured hierarchy:

```text
User
 └── Category
      └── Domain
           └── Subject
                └── Section
                     └── Subsection
                          └── Tasks
```

Example:

```text
Goals
 └── GATE DA
      └── Probability & Statistics
           └── Module 1
                └── Bayesian Concepts
                     └── Solve PYQs
```

---

## Offline-First Architecture

Everything works locally.

Your data stays on your device using IndexedDB.

No backend dependency for normal usage.

Supports:

- offline access
- instant load
- persistent local workspace
- no internet dependency

---

## Installable PWA

Install as a real app on:

- Desktop (Chrome / Edge)
- Android
- iOS (supported with Safari PWA limitations)

Native-like experience:

- standalone app window
- splash screen
- offline boot
- update prompts

---

## Subject Instances (Revision System)

Create multiple execution instances for the same subject.

Example:

```text
Probability & Statistics
 ├── Original
 ├── Revision 1
 ├── Mock Revision
 └── Final Review
```

Each instance has isolated:

- completion state
- notes
- descriptions
- metadata
- progress

Perfect for revision cycles.

---

## Structured JSON Import
## AI-assisted workflow compatible

Generate structured checklist data using AI.

Supports:

- JSON import
- text import
- AI prompt helper
- workspace merge / replace

Use ChatGPT / Gemini / Claude to convert syllabus into structured JSON.

---

## YouTube Playlist Import

Import full YouTube playlists as tasks.

Supported:

- single video
- playlist URL
- import playlist videos as tasks

Use cases:

- lecture playlists
- course tracking
- tutorial roadmaps

---

## Rich Description Editor

Notion-style rich editor.

Supports:

- headings
- bullet lists
- checklists
- code blocks
- links
- images
- media embeds
- YouTube embeds
- undo / redo
- fullscreen editing

---

## Search Engine

Global intelligent search across:

- tasks
- descriptions
- notes
- tags
- categories
- domains
- subjects
- sections
- subsections
- instance names

Search click:

- auto navigation
- expand hierarchy
- highlight target
- switch correct instance

---

## Advanced Analytics

Track execution visually.

Includes:

- daily progress
- weekly progress
- monthly progress
- contribution heatmap
- tag analytics
- progress insights
- activity logs

---

## Execution Tree Visualization

Interactive fullscreen execution tree.

Visual mapping:

```text
User → Category → Domain → Subject → Section → Subsection → Task
```

Features:

- zoom
- pan
- hover tooltips
- theme-adaptive glow
- progress-based leaf rendering
- cinematic visualization

---

## Workspace Safety Controls

Protected destructive actions.

Requires explicit confirmations:

Reset workspace:

```text
I agree to reset
```

Delete workspace:

```text
I agree to delete all
```

Instance reset:

```text
I agree to reset this instance
```

---

# Tech Stack

Frontend:

- React
- TypeScript
- Tailwind CSS
- Framer Motion

Storage:

- IndexedDB
- Dexie.js

Editor:

- Tiptap

Utilities:

- JSZip
- Fuse.js

PWA:

- Service Worker
- Web App Manifest

Deployment:

- Vercel

---

# Live Deployment

Production:

https://align-seven-zeta.vercel.app/

---

# Running Locally

## 1. Clone Repository

```bash
git clone https://github.com/ad7x/adiverse-align.git
cd adiverse-align
```

---

## 2. Install Dependencies

```bash
npm install
```

or

```bash
pnpm install
```

---

## 3. Start Development Server

```bash
npm run dev
```

or

```bash
pnpm dev
```

Then open:

```text
http://localhost:5173
```

---

# Running Offline on Your System

Since this is a PWA + IndexedDB app, there are multiple ways.

## Option 1 — Vite Local Build Preview

Build:

```bash
npm run build
```

Preview:

```bash
npm run preview
```

Then open:

```text
http://localhost:4173
```

This simulates production.

---

## Option 2 — Install From Live Vercel Deployment (Recommended)

Open:

https://align-seven-zeta.vercel.app/

### Desktop

Chrome / Edge:

- open site
- click install icon in address bar
- install app

Then app behaves like native desktop app.

---

### Android

Chrome:

- open site
- tap 3-dot menu
- Add to Home Screen / Install App

---

### iPhone

Safari:

- open site
- Share button
- Add to Home Screen

---

# Data Storage

Stored locally:

- tasks
- progress
- notes
- analytics
- editor content
- media
- settings

Storage backend:

IndexedDB

---

# Export / Backup

Supports:

Workspace:

- JSON export
- ZIP export (with media)
- merge / replace import

Subject:

- export current instance
- import JSON / ZIP
- merge / replace / create instance

---

# Project Vision

Adiverse Align is designed as a personal execution cockpit.

Goal:

Make disciplined structured execution beautiful, motivating, and scalable.

---

# Roadmap

Planned / evolving:

- smarter AI parsing
- better playlist sync
- improved analytics
- richer execution tree interactions
- collaboration layer (future)
- optional cloud sync

---

# Screenshots

```md
![Home](./screenshots/home.png)
![Subject View](./screenshots/subject.png)
![Analytics](./screenshots/analytics.png)
```

---

# Contributing

PRs welcome.

For major changes:

- open issue
- discuss architecture first

---

# License

MIT

---

# Author

Built with obsession for structured logic execution.

**Adiverse**