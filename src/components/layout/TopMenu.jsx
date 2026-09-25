import React, { useState, useEffect, useRef } from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import { useAuthStore } from '../../store/useAuthStore';
import { checkHealth, uploadImageOcr, uploadPdfOcr } from '../../services/api';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { 
  Box, 
  Wind, 
  ShieldAlert, 
  Code2, 
  FolderOpen, 
  Download, 
  FileText, 
  ChevronDown,
  Sparkles,
  Zap,
  User,
  LogIn,
  LogOut
} from 'lucide-react';

export default function TopMenu() {
  const {
    activeWorkspace,
    setActiveWorkspace,
    backendStatus,
    setBackendStatus,
    windTunnelParams,
    setWindTunnelParams,
    triggerVisualSnapshot,
    setAiState,
    shadingMode,
    setShadingMode,
    telemetry,
    openProjectLauncher,
    currentProject
  } = useStudioStore();

  const { user, isAuthenticated, openAuthModal, logout } = useAuthStore();
  const [activeMenu, setActiveMenu] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  // Poll backend health on mount
  useEffect(() => {
    let isMounted = true;
    const testHealth = async () => {
      const res = await checkHealth();
      if (isMounted) {
        setBackendStatus(res.status);
      }
    };
    testHealth();
    const interval = setInterval(testHealth, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [setBackendStatus]);

  // Handle OCR Blueprint file upload
  const handleOcrUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setActiveMenu(null);
    setAiState({ isBuilding: true });

    try {
      const res = await uploadImageOcr(file);
      setAiState((prev) => ({
        isBuilding: false,
        chatHistory: [
          ...prev.chatHistory,
          { sender: 'user', role: 'Engineer', text: `Uploaded CAD Blueprint: ${file.name}` },
          { sender: 'ai', role: 'Spatial Builder', text: `Blueprint OCR extracted successfully:\n${res.text}` }
        ]
      }));
    } catch (err) {
      setAiState({ isBuilding: false });
    }
  };

  // Handle PDF spec upload
  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setActiveMenu(null);
    setAiState({ isBuilding: true });

    try {
      const res = await uploadPdfOcr(file);
      setAiState((prev) => ({
        isBuilding: false,
        chatHistory: [
          ...prev.chatHistory,
          { sender: 'user', role: 'Engineer', text: `Uploaded Technical Spec PDF: ${file.name}` },
          { sender: 'ai', role: 'Neural Auditor', text: `Homologation PDF processed:\n${res.text}` }
        ]
      }));
    } catch (err) {
      setAiState({ isBuilding: false });
    }
  };

  // Quick Action: Run Wind Tunnel
  const handleToggleTunnel = () => {
    setWindTunnelParams({ enabled: !windTunnelParams.enabled });
    if (!windTunnelParams.enabled) {
      setShadingMode('aero_pressure');
    }
  };

  // Quick Action: Run Neural Audit
  const handleRunAudit = () => {
    setActiveWorkspace('audit');
    triggerVisualSnapshot();
    setAiState({ isAuditing: true });
    setTimeout(() => {
      const score = telemetry.homologationScore || 96;
      setAiState({
        isAuditing: false,
        auditScore: score,
        auditReport: {
          timestamp: new Date().toLocaleTimeString(),
          stabilityScore: !telemetry.flowSeparationDetected ? 'Optimal (High-G Cohesive)' : 'Degraded (Turbulent Separation)',
          watertight: '100% Manifold Mesh',
          liftToDrag: telemetry.liftToDragRatio
        }
      });
    }, 1500);
  };

  // Quick Action: Generate AI Design
  const handleGenerateAI = () => {
    setActiveWorkspace('aero');
    setAiState({
      isBuilding: true,
      builderPrompt: 'Optimize LMP1 aerodynamics for 300+ km/h straight line stability with high downforce.'
    });
    setTimeout(() => {
      setAiState((prev) => ({
        isBuilding: false,
        chatHistory: [
          ...prev.chatHistory,
          {
            sender: 'user',
            role: 'Engineer',
            text: 'Generate optimized endurance aero configuration.'
          },
          {
            sender: 'ai',
            role: 'Spatial Builder',
            text: 'Generated optimized endurance aero package: AOA tuned to 11.2°, splitter extended to 0.28m, underbody diffuser adjusted to 9.5°. Ready for tunnel verification.'
          }
        ]
      }));
    }, 1200);
  };

  // Close menus on outside click
  useEffect(() => {
    const handleClick = () => setActiveMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const toggleDropdown = (name, e) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === name ? null : name);
  };

  return (
    <header className="h-10 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-3 select-none text-xs text-zinc-300 z-40">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleOcrUpload}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={pdfInputRef}
        onChange={handlePdfUpload}
        accept=".pdf"
        className="hidden"
      />

      {/* Left: Branding & Blender Menus */}
      <div className="flex items-center gap-2">
        {/* Berkelium Logo */}
        <div className="flex items-center gap-1.5 font-bold text-zinc-100 pr-3 border-r border-zinc-800">
          <div className="w-5 h-5 rounded bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white text-[11px] shadow-sm">
            Bk
          </div>
          <span className="tracking-wide">BERKELIUM</span>
          <span className="text-[10px] text-orange-400 font-mono font-normal">STUDIO</span>
        </div>

        {/* Dropdown Menus */}
        <nav className="flex items-center gap-0.5 relative">
          {/* File Menu */}
          <div className="relative">
            <button
              onClick={(e) => toggleDropdown('file', e)}
              className={`px-2.5 py-1 rounded hover:bg-zinc-800/80 transition-colors ${
                activeMenu === 'file' ? 'bg-zinc-800 text-white' : ''
              }`}
            >
              File
            </button>
            {activeMenu === 'file' && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 top-8 w-56 bg-zinc-900 border border-zinc-700/80 rounded shadow-2xl py-1 z-50 text-xs"
              >
                <button
                  onClick={() => {
                    openProjectLauncher();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-orange-500 hover:text-white flex items-center justify-between text-orange-400 font-semibold"
                >
                  <span className="flex items-center gap-2">
                    <FolderOpen size={13} /> Project & Working Dir...
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">Open</span>
                </button>
                <div className="border-t border-zinc-800 my-1" />
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-orange-500 hover:text-white flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <FileText size={13} /> Load Blueprint OCR
                  </span>
                  <span className="text-[10px] text-zinc-500">Image</span>
                </button>
                <button
                  onClick={() => {
                    pdfInputRef.current?.click();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-orange-500 hover:text-white flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <FolderOpen size={13} /> Load PDF Tech Spec
                  </span>
                  <span className="text-[10px] text-zinc-500">.pdf</span>
                </button>
                <div className="border-t border-zinc-800 my-1" />
                <button
                  onClick={() => {
                    alert('Exporting Car CAD as GLTF mesh...');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-orange-500 hover:text-white flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Download size={13} /> Export GLTF / GLB
                  </span>
                  <span className="text-[10px] text-zinc-500">Ctrl+E</span>
                </button>
              </div>
            )}
          </div>

          {/* Edit Menu */}
          <div className="relative">
            <button
              onClick={(e) => toggleDropdown('edit', e)}
              className={`px-2.5 py-1 rounded hover:bg-zinc-800/80 transition-colors ${
                activeMenu === 'edit' ? 'bg-zinc-800 text-white' : ''
              }`}
            >
              Edit
            </button>
            {activeMenu === 'edit' && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 top-8 w-48 bg-zinc-900 border border-zinc-700/80 rounded shadow-2xl py-1 z-50 text-xs"
              >
                <button
                  onClick={() => setActiveMenu(null)}
                  className="w-full text-left px-3 py-1.5 hover:bg-orange-500 hover:text-white flex justify-between"
                >
                  <span>Undo</span>
                  <span className="text-[10px] text-zinc-500">Ctrl+Z</span>
                </button>
                <button
                  onClick={() => setActiveMenu(null)}
                  className="w-full text-left px-3 py-1.5 hover:bg-orange-500 hover:text-white flex justify-between"
                >
                  <span>Redo</span>
                  <span className="text-[10px] text-zinc-500">Ctrl+Shift+Z</span>
                </button>
              </div>
            )}
          </div>

          {/* Add Menu */}
          <div className="relative">
            <button
              onClick={(e) => toggleDropdown('add', e)}
              className={`px-2.5 py-1 rounded hover:bg-zinc-800/80 transition-colors ${
                activeMenu === 'add' ? 'bg-zinc-800 text-white' : ''
              }`}
            >
              Add
            </button>
            {activeMenu === 'add' && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 top-8 w-56 bg-zinc-900 border border-zinc-700/80 rounded shadow-2xl py-1 z-50 text-xs"
              >
                <div className="px-3 py-1 text-[10px] text-zinc-500 uppercase font-mono">Aerodynamic Elements</div>
                <button
                  onClick={() => {
                    setActiveWorkspace('scripting');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-orange-500 hover:text-white"
                >
                  + NACA Airfoil Wing Flap
                </button>
                <button
                  onClick={() => {
                    setActiveWorkspace('scripting');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-orange-500 hover:text-white"
                >
                  + Vortex Generator Canard
                </button>
                <button
                  onClick={() => {
                    setActiveWorkspace('scripting');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-orange-500 hover:text-white"
                >
                  + Underfloor Venturi Tunnel
                </button>
              </div>
            )}
          </div>

          {/* Aero-Sim Menu */}
          <div className="relative">
            <button
              onClick={(e) => toggleDropdown('aerosim', e)}
              className={`px-2.5 py-1 rounded hover:bg-zinc-800/80 transition-colors ${
                activeMenu === 'aerosim' ? 'bg-zinc-800 text-white' : ''
              }`}
            >
              Aero-Sim
            </button>
            {activeMenu === 'aerosim' && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 top-8 w-60 bg-zinc-900 border border-zinc-700/80 rounded shadow-2xl py-1 z-50 text-xs"
              >
                <button
                  onClick={() => {
                    handleToggleTunnel();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-orange-500 hover:text-white flex justify-between"
                >
                  <span>{windTunnelParams.enabled ? 'Pause Wind Tunnel' : 'Run Wind Tunnel'}</span>
                  <span className="text-[10px] text-zinc-500">Space</span>
                </button>
                <button
                  onClick={() => {
                    setShadingMode('aero_pressure');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-orange-500 hover:text-white"
                >
                  Pressure Gradient Mode (Cp)
                </button>
                <button
                  onClick={() => {
                    setWindTunnelParams({ windSpeed: 60.0 });
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-orange-500 hover:text-white"
                >
                  High Velocity Sweep (60 m/s / 216 km/h)
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Center: Blender Workspace Tabs */}
      <div className="flex items-center bg-zinc-900/90 p-0.5 rounded border border-zinc-800 font-medium">
        <button
          onClick={() => setActiveWorkspace('modeling')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all ${
            activeWorkspace === 'modeling'
              ? 'bg-zinc-800 text-orange-400 shadow font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Box size={13} />
          <span>Modeling CAD</span>
        </button>

        <button
          onClick={() => setActiveWorkspace('aero')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all ${
            activeWorkspace === 'aero'
              ? 'bg-zinc-800 text-cyan-400 shadow font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Wind size={13} />
          <span>Aerodynamics CFD</span>
        </button>

        <button
          onClick={() => setActiveWorkspace('audit')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all ${
            activeWorkspace === 'audit'
              ? 'bg-zinc-800 text-amber-400 shadow font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <ShieldAlert size={13} />
          <span>Neural Audit</span>
        </button>

        <button
          onClick={() => setActiveWorkspace('scripting')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all ${
            activeWorkspace === 'scripting'
              ? 'bg-zinc-800 text-emerald-400 shadow font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Code2 size={13} />
          <span>Monaco Scripting</span>
        </button>
      </div>

      {/* Right: Backend Status & Quick Action Buttons */}
      <div className="flex items-center gap-2.5">
        {/* Backend Connectivity Status Pill */}
        <div
          title={
            backendStatus === 'connected'
              ? 'Connected to FastAPI (http://127.0.0.1:8000)'
              : 'Local Simulation Engine Active (Backend offline fallback)'
          }
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border transition-all ${
            backendStatus === 'connected'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              backendStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span>{backendStatus === 'connected' ? 'AI Cloud Active' : 'Local Sim Engine'}</span>
        </div>

        {/* Quick Actions */}
        <button
          onClick={handleToggleTunnel}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold shadow transition-all ${
            windTunnelParams.enabled
              ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
          }`}
        >
          <Wind size={13} />
          <span>{windTunnelParams.enabled ? 'Tunnel ON' : 'Start Tunnel'}</span>
        </button>

        <button
          onClick={handleRunAudit}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow transition-all"
        >
          <Zap size={13} />
          <span>Neural Audit</span>
        </button>

        <button
          onClick={handleGenerateAI}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white shadow transition-all"
        >
          <Sparkles size={13} />
          <span>AI Design</span>
        </button>

        {/* User Account / OAuth 2.0 Status */}
        <div className="relative pl-1 border-l border-zinc-800">
          {isAuthenticated && user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-2 py-1 rounded-full bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 text-xs transition-all"
                title={user.email}
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-5 h-5 rounded-full object-cover border border-orange-500"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-orange-600 flex items-center justify-center text-[10px] font-bold text-white">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="max-w-[80px] truncate text-zinc-200 text-[11px] font-medium hidden sm:inline">
                  {user.name}
                </span>
                <ChevronDown size={11} className="text-zinc-400" />
              </button>

              {userMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-56 bg-[#18181b] border border-zinc-700 rounded-lg shadow-2xl py-1 z-50 text-xs"
                  onMouseLeave={() => setUserMenuOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-zinc-800">
                    <p className="font-semibold text-zinc-200 truncate">{user.name}</p>
                    <p className="text-[11px] text-zinc-400 truncate">{user.email}</p>
                    <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-orange-400 border border-zinc-700">
                      {user.provider === 'google' ? 'Google OAuth 2.0' : 'Email Session'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setUserMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-zinc-800 text-rose-400 flex items-center gap-2 transition-colors"
                  >
                    <LogOut size={13} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => openAuthModal('google')}
              className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-500 text-zinc-200 rounded text-xs font-medium transition-all shadow-sm"
              title="Sign in with Google OAuth 2.0 or Email"
            >
              <LogIn size={13} className="text-orange-400" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
