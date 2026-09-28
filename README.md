# 🕸️ Personal Graph CRM (Experimental Project)

Welcome to **Graph CRM**, an open-source experiment born because I know way too many people and have a terrible memory. 

Traditional address books force us to think in flat, isolated lists. But in real life, people are interconnected. This project models contacts as a **Graph**: people are *Nodes* and their relationships (who knows who) are *Edges*. 

## 🎯 The Goal
The core idea is to create a personal CRM that is:
1. **Local-first & Privacy-focused:** Your contacts are yours. No weird clouds, no third-party APIs. Everything lives and breathes locally on your computer, safely stored in a solid JSON file (`data/rubrica.json`).
2. **Extremely Performant:** Under the hood, there are no heavy frameworks or slow databases. The engine relies solely on the native power of Node.js (using `Map` and `Set` in RAM) to guarantee search, merge, and computation times in **$O(1)$**. It can handle thousands of nodes and tens of thousands of edges in mere milliseconds.
3. **Smart:** It includes a heuristic engine (*Fuzzy Matching*) to automatically detect duplicates and namesakes before they are even saved.

## 🎨 The UI (Vibecoding Edition ✨)
Let's be honest: my field is the backend, data architecture, and complex logic. The frontend... is not. 

The mobile-first UI you'll see (written strictly in Vanilla JS and pure CSS, zero libraries) was literally **vibecoded**. I followed my intuition, good vibes, and the energy of the universe to place divs, buttons, and modals. 
Does it work? Surprisingly, yes.
Is it written following the sacred scriptures of frontend developers? Probably not.

## 🤝 Want to Contribute? You're Welcome!
This is an **experimental, 100% open-source project**, and the intention is to keep it that way and let it grow driven by curiosity.

Anyone who wants to get their hands dirty is welcome:
* Are you a **Frontend Wizard** and your eyes bleed reading my vibecoded CSS? Please, open a Pull Request and save the project.
* Do you have crazy ideas (e.g., an interactive 3D view of the graph in Three.js, an export/reporting system, etc.)? The backend core is already set up to accommodate them.
* Found a bug? Open an Issue!

Every contribution, idea, or constructive criticism is gold.

## 🚀 How to try it in 30 seconds

Since it is completely *zero-dependency*, you don't even have to wait for an endless download of `node_modules`.

1. Clone this repository:
   ```bash
   git clone <repo-url>
   cd <folder-name>
