# Berkelium Studio

> **Blender-Grade 3D CAD & Aerodynamics CFD Studio with Dual-AI Closed-Loop Engineering**  
> Built with Three.js, React 19, Monaco Editor, Electron, and FastAPI.

---

## 🏎️ Overview

**Berkelium Studio** is a cross-platform, desktop and browser-native 3D engineering environment designed for aerodynamic simulation, parametric vehicle modeling, and automated design verification. 

Inspired by Blender's CAD workflow, it integrates real-time fluid dynamics visualization (wind tunnel particle streamlines and surface pressure heatmaps) with a **Dual-AI Architecture**:
1. **The Spatial Builder Model**: Mathematical reasoning and procedural CAD code synthesis. Ingests technical prompts, engineering blueprints, and homologation PDFs.
2. **The Neural Rendering Auditor Model**: Multi-view visual inspection (Perspective, Top, Side, Front, and Normal passes), boundary layer stall detection, and interactive 3D defect markers with 1-click autonomous closed-loop repair.

---

## ✨ Features

- **Startup Project & Working Directory Launcher**:
  - Native filesystem access (`showDirectoryPicker` and Electron IPC) to open any local folder as a workspace.
  - Built-in engineering presets: *Le Mans Hypercar Prototype (LMP1)*, *Formula 1 Ground-Effect Chassis*, and *GT3 Endurance Aero*.
  - Real 3D CAD mesh file import (`.stl`, `.obj`, `.gltf`, `.glb`) with automatic wind tunnel scaling and floor alignment.
- **Blender 4.x/5.x Dark Theme CAD Interface**:
  - Outliner scene graph with visibility and lock toggles.
  - Properties Inspector with dynamic aerodynamic geometry sliders.
  - Left Tool Shelf with CAD transform tools (`G` Move, `R` Rotate, `S` Scale, `P` Aero Probe, `E` Streamline Emitter).
  - Workspaces: `[Modeling CAD]`, `[Aerodynamics CFD]`, `[Neural Audit]`, `[Scripting Editor]`.
- **Real-Time Aerodynamics Simulation Engine**:
  - 3,200+ particle streamline smoke rake with velocity color gradients.
  - Custom GLSL surface pressure gradient ($C_p$) shader mapping stagnation points and suction zones.
  - Interactive Aero Pressure Probe raycasting local pressure ($Pa$) and air velocity ($m/s$).
  - Rigorous aerodynamic physics: Dynamic pressure ($q = \frac{1}{2}\rho v^2$), Reynolds number ($Re$), Drag force ($F_d$), Downforce ($F_l$), and Power required ($HP$).
  - Flow separation alerts when rear wing AOA $> 14.5^\circ$ or diffuser expansion $> 12.0^\circ$.
- **Procedural 3D LMP1 / Hypercar Generator & Mesh Importer**:
  - Monocoque chassis, aerodynamic nose cone, cockpit bubble, and shark fin.
  - Front splitter with vortex canards, sidepods with cooling inlets, underfloor Venturi diffuser with strakes.
  - Dual-element rear wing with Gurney flap and aerodynamic endplates.
  - 4 detailed wheels (rims, tires, ventilated brake discs, and calipers).
  - Direct import and rendering of external `.stl`, `.obj`, and `.gltf` meshes inside the wind tunnel.
- **Multi-Language Code Editor (Python 3.10, C++17, Three.js)**:
  - Monaco editor with syntax highlighting, line numbers, and dark graphite aesthetic.
  - **Python 3.10**: Compiles and runs aerodynamic formulas and prints telemetry.
  - **C++17**: Compiles with `g++`/`clang++` via backend `/run/cpp` or native Electron runners with RK4 Navier-Stokes integration.
  - **Three.js CAD**: Injects dynamic procedural geometry elements directly into the live WebGL viewport.
- **Uncluttered, Minimalist Dual-AI Assistant**:
  - **Spatial Builder**: Clean chat interface with direct parameter parsing and 1-click **Apply to Viewport**.
  - **Neural Auditor**: 4-angle snapshot gallery, homologation scorecard, 3D viewport defect pins, and 1-click **Auto-Fix & Refine**.
- **Zero-Bloat Authentication (OAuth 2.0 & Email)**:
  - Google Identity Services OAuth 2.0 without heavy npm client libraries.
  - Email/Password registration and login with local and backend verification.
- **Cross-Platform**:
  - Runs in any modern web browser.
  - Runs natively on **macOS**, **Linux**, and **Windows** via Electron with native file dialogs and local compilers.

---

## 🛠️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        BERKELIUM STUDIO FRONTEND                        │
├───────────────────────────┬─────────────────────────────────────────────┤
│ 1. SPATIAL BUILDER MODEL  │ 2. NEURAL RENDERING AUDITOR MODEL           │
│ • Mathematical reasoning  │ • Multi-angle visual inspection             │
│ • NACA airfoil equations  │ • Boundary layer stall detection (AOA > 14.5°)│
│ • Code synthesis (Py/C++) │ • 3D defect pins & 1-click "Auto-Fix"       │
├───────────────────────────┴─────────────────────────────────────────────┤
│                       BLENDER-GRADE 3D VIEWPORT                         │
│ • Three.js WebGL CAD Engine  • Particle Streamlines & Wind Tunnel       │
│ • GLSL Pressure Heatmaps     • Surface Aero Probe & Defect Pins         │
│ • Real STL/OBJ/GLTF Loader   • Auto-scaling & ground alignment          │
├─────────────────────────────────────────────────────────────────────────┤
│                     MODULAR WORKSPACES & PANELS                         │
│ • Outliner   • Inspector   • Monaco Script Editor   • CFD Telemetry     │
│ • Startup Project Selector • Zero-Bloat Google & Email OAuth 2.0        │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼ HTTP
┌─────────────────────────────────────────────────────────────────────────┐
│                    FASTAPI BACKEND & CODE RUNNERS                       │
│ • /health            • /chat (Fireworks AI)       • /ocr /pdf-ocr       │
│ • /run/python        • /run/cpp (g++/clang++)     • /auth (OAuth/Email) │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ & npm
- Python 3.10+ (for backend and Python solver)
- `g++` or `clang++` (optional, for native C++ compilation)

### 1. Clone the Repository

```bash
git clone https://github.com/enigmahacker/Berkelium-Studio.git
cd Berkelium-Studio
```

### 2. Run in Browser

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

Open `http://localhost:5173` in your browser.

### 3. Run Native Desktop App (macOS, Windows, Linux)

```bash
# Run Electron native desktop version
npm run electron
# Or build and launch desktop
npm run desktop
```

### 4. Run Backend & Execution Engine (Optional)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

*(Note: The frontend includes full client-side fallbacks so you can explore all 3D CAD, aerodynamic simulations, C++/Python solvers, and AI features even without running the Python backend).*

---

## 📜 License

MIT License. Built for advanced AI-driven generative engineering.