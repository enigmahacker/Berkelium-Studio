import { useState, useRef } from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import { loadMeshFromFile } from '../../services/meshLoader';
import {
  FolderOpen,
  Box,
  Compass,
  ArrowRight,
  X,
  HardDrive,
  Sparkles
} from 'lucide-react';

export default function ProjectLauncherModal() {
  const {
    isProjectLauncherOpen,
    closeProjectLauncher,
    currentProject,
    setProject,
    setCustomMeshModel,
    setCarParams,
    shadingMode
  } = useStudioStore();

  const [skipStartup, setSkipStartup] = useState(
    !!localStorage.getItem('berkelium_skip_launcher')
  );
  const [selectedPreset, setSelectedPreset] = useState('hypercar');
  const [customPath, setCustomPath] = useState(currentProject?.path || '/projects/aerodynamics_study');
  const [loadingMsg, setLoadingMsg] = useState('');
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  if (!isProjectLauncherOpen) return null;

  const handleSkipChange = (checked) => {
    setSkipStartup(checked);
    if (checked) {
      localStorage.setItem('berkelium_skip_launcher', 'true');
    } else {
      localStorage.removeItem('berkelium_skip_launcher');
    }
  };

  // 1. Native Folder Selection (Electron Native IPC or HTML5 File System Access API)
  const handleOpenLocalDirectory = async () => {
    try {
      // Check if running in Electron desktop app
      if (typeof window !== 'undefined' && window.require) {
        try {
          const { ipcRenderer } = window.require('electron');
          const res = await ipcRenderer.invoke('dialog:openDirectory');
          if (res && res.path) {
            setProject({
              name: res.name,
              path: res.path,
              files: res.files && res.files.length > 0 ? res.files : currentProject.files
            });
            closeProjectLauncher();
            return;
          }
        } catch (_ipcErr) {
          // Fall through to browser API
        }
      }

      if ('showDirectoryPicker' in window) {
        setLoadingMsg('Scanning selected working directory...');
        const dirHandle = await window.showDirectoryPicker({
          mode: 'readwrite'
        });

        const files = [];
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file') {
            files.push({
              name: entry.name,
              type: entry.name.endsWith('.py')
                ? 'python'
                : entry.name.endsWith('.cpp') || entry.name.endsWith('.h')
                ? 'cpp'
                : entry.name.endsWith('.js')
                ? 'javascript'
                : 'file'
            });
          }
        }

        setProject({
          name: dirHandle.name,
          path: `file:///${dirHandle.name}`,
          handle: dirHandle,
          files: files.length > 0 ? files : currentProject.files
        });
        setLoadingMsg('');
        closeProjectLauncher();
      } else {
        // Fallback for browsers without showDirectoryPicker
        folderInputRef.current?.click();
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Directory selection fallback:', err);
      }
      setLoadingMsg('');
    }
  };

  // Fallback webkitdirectory handler
  const handleFallbackFolderSelect = (e) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      const files = Array.from(fileList).slice(0, 20).map((f) => ({
        name: f.name,
        type: f.name.endsWith('.py') ? 'python' : f.name.endsWith('.cpp') ? 'cpp' : 'file'
      }));
      const folderName = fileList[0].webkitRelativePath?.split('/')[0] || 'Custom Project';
      setProject({
        name: folderName,
        path: `/local/${folderName}`,
        files
      });
      closeProjectLauncher();
    }
  };

  // 2. Real 3D Mesh Upload (.OBJ, .STL, .GLTF)
  const handleMeshUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoadingMsg(`Importing real 3D mesh: ${file.name}...`);
      const { group, stats } = await loadMeshFromFile(file, shadingMode);
      setCustomMeshModel(group);
      setProject({
        name: file.name.replace(/\.[^/.]+$/, ''),
        path: `/models/${file.name}`,
        files: [
          { name: file.name, type: '3d-mesh', stats },
          { name: 'simulation.py', type: 'python' }
        ]
      });
      setLoadingMsg('');
      closeProjectLauncher();
    } catch (err) {
      alert(`Error loading 3D file: ${err.message}`);
      setLoadingMsg('');
    }
  };

  // 3. Load Realistic Engineering Project Preset
  const handleLoadPreset = (key) => {
    if (key === 'hypercar') {
      setCarParams({
        wheelbase: 2.7,
        width: 1.9,
        height: 1.15,
        splitterLength: 0.25,
        rearWingAOA: 11.5,
        rearWingSpan: 1.6,
        diffuserAngle: 9.0,
        groundClearance: 0.08
      });
      setProject({
        name: 'Le Mans Prototype Hypercar (LMP1)',
        path: customPath || '/projects/hypercar_aerodynamics',
        files: [
          { name: 'simulation.py', language: 'python', type: 'script' },
          { name: 'aerodynamics_solver.cpp', language: 'cpp', type: 'kernel' },
          { name: 'generate_car.js', language: 'javascript', type: 'cad' }
        ]
      });
    } else if (key === 'wing') {
      setCarParams({
        wheelbase: 2.5,
        width: 1.8,
        height: 1.1,
        splitterLength: 0.15,
        rearWingAOA: 13.8, // High downforce
        rearWingSpan: 1.8,
        diffuserAngle: 11.0,
        groundClearance: 0.065
      });
      setProject({
        name: 'NACA 6409 Airfoil & Dual-Element Wing Package',
        path: '/projects/naca_wing_cfd',
        files: [
          { name: 'simulation.py', language: 'python', type: 'script' },
          { name: 'aerodynamics_solver.cpp', language: 'cpp', type: 'kernel' },
          { name: 'naca_profile.dat', language: 'text', type: 'coordinates' }
        ]
      });
    } else if (key === 'monza') {
      setCarParams({
        wheelbase: 2.8,
        width: 1.95,
        height: 1.12,
        splitterLength: 0.18,
        rearWingAOA: 6.8, // Ultra-low drag
        rearWingSpan: 1.5,
        diffuserAngle: 7.5,
        groundClearance: 0.075
      });
      setProject({
        name: 'Monza Low-Drag Speed Record Setup',
        path: '/projects/monza_low_drag',
        files: [
          { name: 'simulation.py', language: 'python', type: 'script' },
          { name: 'aerodynamics_solver.cpp', language: 'cpp', type: 'kernel' }
        ]
      });
    }
    closeProjectLauncher();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0f172a] border border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Splash Header */}
        <div className="relative px-8 pt-8 pb-6 border-b border-[#1e293b] bg-gradient-to-r from-[#0b0b10] via-[#0f172a] to-[#1e1b4b]">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                    Berkelium Studio
                    <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      v1.1.0 • C++ & Python CFD
                    </span>
                  </h1>
                  <p className="text-xs text-zinc-400">
                    Cross-platform 3D CAD & Aerodynamics Simulation Environment
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={closeProjectLauncher}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/80 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Action Row: Open Local Directory & Import 3D Mesh */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Open Folder */}
            <button
              type="button"
              onClick={handleOpenLocalDirectory}
              className="flex items-start gap-4 p-4 rounded-xl bg-[#1e293b]/70 hover:bg-[#1e293b] border border-[#334155] hover:border-blue-500/60 transition-all text-left group shadow-sm"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <span className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors flex items-center gap-1.5">
                  Select Working Directory
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </span>
                <p className="text-xs text-zinc-400">
                  Open a local project folder containing Python, C++, or 3D files.
                </p>
              </div>
            </button>

            {/* Import Real 3D CAD File */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-start gap-4 p-4 rounded-xl bg-[#1e293b]/70 hover:bg-[#1e293b] border border-[#334155] hover:border-orange-500/60 transition-all text-left group shadow-sm"
            >
              <div className="w-10 h-10 rounded-lg bg-orange-600/20 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Box className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <span className="text-sm font-semibold text-white group-hover:text-orange-300 transition-colors flex items-center gap-1.5">
                  Import 3D CAD Mesh
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </span>
                <p className="text-xs text-zinc-400">
                  Load real geometry from .OBJ, .STL, or .GLTF files into wind tunnel.
                </p>
              </div>
            </button>
          </div>

          {/* Hidden inputs */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleMeshUpload}
            accept=".obj,.stl,.gltf,.glb"
            className="hidden"
          />
          <input
            type="file"
            ref={folderInputRef}
            onChange={handleFallbackFolderSelect}
            webkitdirectory=""
            directory=""
            className="hidden"
          />

          {/* Realistic Engineering Project Presets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                Real Engineering Project Presets
              </label>
              <span className="text-[11px] text-zinc-500">Includes real C++ & Python CFD code</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Preset 1 */}
              <div
                onClick={() => setSelectedPreset('hypercar')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  selectedPreset === 'hypercar'
                    ? 'bg-blue-950/40 border-blue-500 text-white shadow-lg'
                    : 'bg-[#18181b] border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold text-xs">
                    01
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold">Le Mans Prototype Hypercar (LMP1)</h4>
                    <p className="text-[11px] text-zinc-400">
                      High-downforce prototype car, Venturi ground-effect floor, dual-element wing.
                    </p>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-zinc-400">
                  Cd: 0.278 • Cl: 1.15
                </div>
              </div>

              {/* Preset 2 */}
              <div
                onClick={() => setSelectedPreset('wing')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  selectedPreset === 'wing'
                    ? 'bg-blue-950/40 border-blue-500 text-white shadow-lg'
                    : 'bg-[#18181b] border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/30 text-emerald-400 flex items-center justify-center font-bold text-xs">
                    02
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold">NACA 6409 Airfoil & High-Lift Wing Package</h4>
                    <p className="text-[11px] text-zinc-400">
                      Slotted flap aerodynamic wing, boundary layer stall threshold analysis.
                    </p>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-zinc-400">
                  Cd: 0.320 • Cl: 1.48
                </div>
              </div>

              {/* Preset 3 */}
              <div
                onClick={() => setSelectedPreset('monza')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  selectedPreset === 'monza'
                    ? 'bg-blue-950/40 border-blue-500 text-white shadow-lg'
                    : 'bg-[#18181b] border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-600/30 text-orange-400 flex items-center justify-center font-bold text-xs">
                    03
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold">Monza Low-Drag Speed Record Setup</h4>
                    <p className="text-[11px] text-zinc-400">
                      Trimmed rear wing AOA (6.8°), reduced frontal parasitic drag, high-velocity flow.
                    </p>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-zinc-400">
                  Cd: 0.235 • Cl: 0.72
                </div>
              </div>
            </div>
          </div>

          {/* Working directory path display */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-zinc-400">
              Active Project Working Path
            </label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0b0b10] border border-zinc-800 text-xs font-mono text-zinc-300">
              <HardDrive className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <input
                type="text"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                className="bg-transparent border-none outline-none flex-1 text-xs text-zinc-200"
              />
            </div>
          </div>

          {loadingMsg && (
            <div className="flex items-center gap-2 p-3 text-xs text-blue-300 bg-blue-950/40 border border-blue-800/60 rounded-lg">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <span>{loadingMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-[#0b0b10] border-t border-[#1e293b] flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={skipStartup}
              onChange={(e) => handleSkipChange(e.target.checked)}
              className="rounded bg-zinc-800 border-zinc-700 text-orange-500 focus:ring-0"
            />
            Don't show on startup
          </label>

          <button
            type="button"
            onClick={() => handleLoadPreset(selectedPreset)}
            className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-md flex items-center gap-2 transition-all"
          >
            <span>Launch Project Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
