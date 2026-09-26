import { useState, useRef } from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import { loadMeshFromFile } from '../../services/meshLoader';
import {
  FolderOpen,
  Box,
  Compass,
  ArrowRight,
  X,
  Sparkles,
  AlertTriangle
} from 'lucide-react';

export default function ProjectLauncherModal() {
  const {
    isProjectLauncherOpen,
    closeProjectLauncher,
    scanAndValidateProject,
    loadRealBerkeliumStudioProject,
    setCustomMeshModel,
    setCarParams,
    shadingMode
  } = useStudioStore();

  const [skipStartup, setSkipStartup] = useState(
    !!localStorage.getItem('berkelium_skip_launcher')
  );
  const [loadingMsg, setLoadingMsg] = useState('');
  const [validationError, setValidationError] = useState(null);
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
    setValidationError(null);
    try {
      // Check if running in Electron desktop app
      if (typeof window !== 'undefined' && window.require) {
        try {
          const { ipcRenderer } = window.require('electron');
          const res = await ipcRenderer.invoke('dialog:openDirectory');
          if (res) {
            const actualFiles = res.files || [];
            const valRes = scanAndValidateProject({
              name: res.name,
              path: res.path,
              files: actualFiles
            });

            if (!valRes.valid) {
              setValidationError({
                title: valRes.reason === 'EMPTY_DIRECTORY' ? 'NO SIMULATION PROJECT DETECTED' : 'INVALID PROJECT STRUCTURE',
                message: valRes.reason === 'EMPTY_DIRECTORY'
                  ? 'The selected folder contains no recognized simulation project.\nSelect the actual Berkelium Studio project directory.'
                  : `The selected folder '${res.name}' contains no recognized simulation files (simulation.py, package.json, etc.).`
              });
              return;
            }
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
          mode: 'read'
        });

        const files = [];
        for await (const entry of dirHandle.values()) {
          files.push({
            name: entry.name,
            kind: entry.kind,
            type: entry.name.endsWith('.py')
              ? 'python'
              : entry.name.endsWith('.cpp') || entry.name.endsWith('.h')
              ? 'cpp'
              : entry.name.endsWith('.js')
              ? 'javascript'
              : entry.kind === 'directory'
              ? 'directory'
              : 'file'
          });
        }

        setLoadingMsg('');
        const valRes = scanAndValidateProject({
          name: dirHandle.name,
          path: dirHandle.name,
          files
        });

        if (!valRes.valid) {
          setValidationError({
            title: valRes.reason === 'EMPTY_DIRECTORY' ? 'NO SIMULATION PROJECT DETECTED' : 'INVALID PROJECT STRUCTURE',
            message: valRes.reason === 'EMPTY_DIRECTORY'
              ? 'The selected folder contains no recognized simulation project.\nSelect the actual Berkelium Studio project directory.'
              : `The selected folder '${dirHandle.name}' contains no recognized simulation files.`
          });
          return;
        }

        closeProjectLauncher();
      } else {
        folderInputRef.current?.click();
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Directory selection error:', err);
      }
      setLoadingMsg('');
    }
  };

  // Fallback webkitdirectory handler
  const handleFallbackFolderSelect = (e) => {
    setValidationError(null);
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) {
      scanAndValidateProject({
        name: 'Empty Folder',
        path: '',
        files: []
      });
      setValidationError({
        title: 'NO SIMULATION PROJECT DETECTED',
        message: 'The selected folder contains no recognized simulation project.\nSelect the actual Berkelium Studio project directory.'
      });
      return;
    }

    const files = Array.from(fileList).map((f) => ({
      name: f.name,
      type: f.name.endsWith('.py') ? 'python' : f.name.endsWith('.cpp') ? 'cpp' : 'file'
    }));
    const folderName = fileList[0].webkitRelativePath?.split('/')[0] || 'Selected Folder';

    const valRes = scanAndValidateProject({
      name: folderName,
      path: `/local/${folderName}`,
      files
    });

    if (!valRes.valid) {
      setValidationError({
        title: valRes.reason === 'EMPTY_DIRECTORY' ? 'NO SIMULATION PROJECT DETECTED' : 'INVALID PROJECT STRUCTURE',
        message: valRes.reason === 'EMPTY_DIRECTORY'
          ? 'The selected folder contains no recognized simulation project.\nSelect the actual Berkelium Studio project directory.'
          : `The selected folder '${folderName}' contains no recognized simulation files.`
      });
      return;
    }

    closeProjectLauncher();
  };

  // 2. Real 3D Mesh Upload (.OBJ, .STL, .GLTF)
  const handleMeshUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoadingMsg(`Importing real 3D mesh: ${file.name}...`);
      const { group, stats } = await loadMeshFromFile(file, shadingMode);
      setCustomMeshModel(group);
      scanAndValidateProject({
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

  // 3. Load Real Homologated Geometry Setup
  const handleLoadPreset = (key) => {
    if (key === 'suv') {
      setCarParams({
        wheelbase: 2.85,
        width: 1.98,
        height: 1.65,
        splitterLength: 0.20,
        rearWingAOA: 11.5,
        rearWingSpan: 1.70,
        diffuserAngle: 9.0,
        groundClearance: 0.18
      });
    } else if (key === 'hypercar') {
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
    } else if (key === 'monza') {
      setCarParams({
        wheelbase: 2.8,
        width: 1.95,
        height: 1.12,
        splitterLength: 0.18,
        rearWingAOA: 6.8,
        rearWingSpan: 1.5,
        diffuserAngle: 7.5,
        groundClearance: 0.075
      });
    }
    // Load the real workspace root so project is valid
    loadRealBerkeliumStudioProject();
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
                      Reduced-Order Aerodynamics
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
          {/* Validation Error Alert Banner */}
          {validationError && (
            <div className="p-4 rounded-xl bg-red-950/80 border border-red-500 text-red-200 text-xs flex items-start gap-3 animate-in fade-in duration-150 shadow-lg">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold font-mono tracking-wide text-red-300 text-sm">
                  {validationError.title}
                </div>
                <p className="text-zinc-300 whitespace-pre-line leading-relaxed font-sans">
                  {validationError.message}
                </p>
              </div>
            </div>
          )}

          {/* Primary Recommended Action: Load Berkelium Studio Project Root */}
          <button
            type="button"
            onClick={() => {
              loadRealBerkeliumStudioProject();
              closeProjectLauncher();
            }}
            className="w-full p-4 rounded-xl bg-gradient-to-r from-orange-600/25 via-amber-600/15 to-transparent border-2 border-orange-500/80 hover:border-orange-400 text-left transition-all group shadow-lg hover:shadow-orange-500/20"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-orange-600 flex items-center justify-center text-white font-bold text-sm shadow">
                  Bk
                </div>
                <div>
                  <div className="font-bold text-zinc-100 flex items-center gap-2">
                    <span>Open Berkelium Studio Project</span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-orange-500/20 text-orange-300 border border-orange-500/40 uppercase font-semibold">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Loads real project root: <span className="font-mono text-zinc-300">/Users/prithviaryam/Downloads/berkelium-web</span>
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-orange-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

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
                  Validate and open a project containing simulation.py or package.json.
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
                Aerodynamic Configuration Presets
              </label>
              <span className="text-[11px] text-zinc-500">Loads vehicle geometry parameters</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Preset 0: Performance SUV */}
              <div
                onClick={() => handleLoadPreset('suv')}
                className="p-3.5 rounded-xl border border-zinc-800 hover:border-orange-500/80 bg-[#18181b] hover:bg-zinc-900 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-600/30 text-orange-400 flex items-center justify-center font-bold text-xs">
                    01
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-100 group-hover:text-orange-300 transition-colors">
                      Performance SUV (4.8m Bluff Body)
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      Aerodynamic SUV bodywork, 18cm ride height, roof spoiler, Venturi underbody ramp.
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-orange-400 group-hover:translate-x-0.5 transition-all" />
              </div>

              {/* Preset 1: Hypercar */}
              <div
                onClick={() => handleLoadPreset('hypercar')}
                className="p-3.5 rounded-xl border border-zinc-800 hover:border-blue-500/80 bg-[#18181b] hover:bg-zinc-900 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold text-xs">
                    02
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-100 group-hover:text-blue-300 transition-colors">
                      Le Mans Prototype Hypercar (LMP1)
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      High-downforce prototype car, 8cm ground clearance, aggressive dual-element wing.
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
              </div>

              {/* Preset 2: Low-Drag Monza */}
              <div
                onClick={() => handleLoadPreset('monza')}
                className="p-3.5 rounded-xl border border-zinc-800 hover:border-emerald-500/80 bg-[#18181b] hover:bg-zinc-900 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/30 text-emerald-400 flex items-center justify-center font-bold text-xs">
                    03
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-100 group-hover:text-emerald-300 transition-colors">
                      Monza Low-Drag Speed Record Setup
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      Minimal trim downforce, reduced frontal wake for top-speed straight-line efficiency.
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          </div>

          {loadingMsg && (
            <div className="text-xs text-orange-400 font-mono animate-pulse text-center">
              {loadingMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-[#090d16] border-t border-[#1e293b] flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-zinc-400 hover:text-zinc-200">
            <input
              type="checkbox"
              checked={skipStartup}
              onChange={(e) => handleSkipChange(e.target.checked)}
              className="rounded bg-zinc-800 border-zinc-700 text-orange-600 focus:ring-0"
            />
            <span>Don't show this launcher at startup</span>
          </label>

          <button
            onClick={closeProjectLauncher}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
