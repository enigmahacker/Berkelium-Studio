# Berkelium Studio

> **Blender-Grade 3D CAD & Aerodynamics Studio with Dual-AI Closed-Loop Engineering**  
> Built with Three.js, React 19, Monaco Editor, and FastAPI.

---

## 🏎️ Overview

**Berkelium Studio** is a browser and desktop-native 3D engineering environment designed for aerodynamic simulation, parametric vehicle modeling, and automated design verification. 

Inspired by Blender's CAD workflow, it integrates real-time fluid dynamics visualization (wind tunnel particle streamlines and surface pressure heatmaps) with a **Dual-AI Architecture**:
1. **The Spatial Builder Model**: Mathematical reasoning and procedural Three.js CAD code synthesis. Ingests technical prompts, engineering blueprints, and homologation PDFs.
2. **The Neural Rendering Auditor Model**: Multi-view visual inspection (Perspective, Top, Side, Front, and Normal passes), boundary layer stall detection, and interactive 3D defect markers with 1-click autonomous closed-loop repair.

---

## ✨ Features

- **Blender 4.x/5.x Dark Theme CAD Interface**:
  - Outliner scene graph with visibility and lock toggles.
  - Properties Inspector with dynamic aerodynamic geometry sliders.
  - Left Tool Shelf with CAD transform tools (`G` Move, `R` Rotate, `S` Scale, `P` Aero Probe, `E` Streamline Emitter).
  - Workspaces: `[Modeling CAD]`, `[Aerodynamics CFD]`, `[Neural Audit]`, `[Monaco Scripting]`.
- **Real-Time Aerodynamics Simulation Engine**:
  - 3,200+ particle streamline smoke rake with velocity color gradients.
  - Custom GLSL surface pressure gradient ($C_p$) shader mapping stagnation points and suction zones.
  - Interactive Aero Pressure Probe raycasting local pressure ($Pa$) and air velocity ($m/s$).
  - Rigorous aerodynamic math: Dynamic pressure ($q$), Reynolds number ($Re$), Drag force ($F_d$), Downforce ($F_l$), and Power required ($HP$).
  - Flow separation alerts when rear wing AOA $> 14.5^\circ$ or diffuser expansion $> 12.0^\circ$.
- **Procedural 3D LMP1 / Hypercar Generator**:
  - Monocoque chassis, aerodynamic nose cone, cockpit bubble, and shark fin.
  - Front splitter with vortex canards, sidepods with cooling inlets, underfloor Venturi diffuser with strakes.
  - Dual-element rear wing with Gurney flap and aerodynamic endplates.
  - 4 detailed wheels (rims, tires, ventilated brake discs, and calipers).
- **Monaco Script Editor**:
  - Live procedural Three.js coding with presets and instant execution.
- **Dual-Brain AI Panel**:
  - **Spatial Builder**: Generates geometry based on natural language or uploaded blueprint OCR / PDF specs.
  - **Neural Auditor**: 4-angle snapshot gallery, homologation scorecard, 3D viewport defect pins, and 1-click **"Auto-Fix & Refine"**.
- **CFD Telemetry Bar**:
  - Real-time Drag Force, Downforce, Power (HP), Reynolds Number, and Aerodynamic Balance.

---

## 🛠️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        BERKELIUM STUDIO FRONTEND                        │
├───────────────────────────┬─────────────────────────────────────────────┤
│ 1. SPATIAL BUILDER MODEL  │ 2. NEURAL RENDERING AUDITOR MODEL           │
│ • Mathematical reasoning  │ • Multi-angle visual inspection             │
│ • NACA airfoil equations  │ • Boundary layer stall detection (AOA > 14.5°)│
│ • Three.js code synthesis │ • 3D defect pins & 1-click "Auto-Fix"       │
├───────────────────────────┴─────────────────────────────────────────────┤
│                       BLENDER-GRADE 3D VIEWPORT                         │
│ • Three.js WebGL CAD Engine  • Particle Streamlines & Wind Tunnel       │
│ • GLSL Pressure Heatmaps     • Surface Aero Probe & Defect Pins         │
├─────────────────────────────────────────────────────────────────────────┤
│                     MODULAR WORKSPACES & PANELS                         │
│ • Outliner   • Inspector   • Monaco Script Editor   • CFD Telemetry     │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼ HTTP
┌─────────────────────────────────────────────────────────────────────────┐
│                    FASTAPI BACKEND (Fireworks AI + OCR)                 │
│ • /health   • /chat (Fireworks AI)   • /ocr (Tesseract)   • /pdf-ocr    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ & npm
- Python 3.10+ (for the optional FastAPI backend)

### 1. Clone the Repository

```bash
git clone https://github.com/enigmahacker/Berkelium-Studio.git
cd Berkelium-Studio
```

### 2. Frontend Setup

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

Open `http://localhost:5173` in your browser.

*(Note: The frontend includes a built-in offline simulation fallback so you can explore all 3D CAD, aerodynamic, and AI features even without running the Python backend).*

### 3. Backend Setup (Optional)

```bash
# Copy example configuration
cp config.example.json config.json
# Edit config.json with your Fireworks AI key

cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs at `http://127.0.0.1:8000`.

---

## 📜 License

MIT License. Built for advanced AI-driven generative engineering.