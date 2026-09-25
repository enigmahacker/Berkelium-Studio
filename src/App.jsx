import React, { useState } from 'react';
import { useStudioStore } from './store/useStudioStore';
import TopMenu from './components/layout/TopMenu';
import ToolShelf from './components/layout/ToolShelf';
import ThreeViewport from './components/viewport/ThreeViewport';
import Outliner from './components/layout/Outliner';
import Inspector from './components/layout/Inspector';
import DualAIPanel from './components/ai/DualAIPanel';
import MonacoScriptEditor from './components/editor/MonacoScriptEditor';
import TelemetryBar from './components/telemetry/TelemetryBar';
import { 
  Layers, 
  Sparkles, 
  Code2, 
  SidebarClose, 
  SidebarOpen,
  PanelRightClose,
  PanelRightOpen
} from 'lucide-react';

export default function App() {
  const { activeWorkspace } = useStudioStore();
  const [rightPanelMode, setRightPanelMode] = useState('auto'); // 'auto' | 'inspector' | 'ai' | 'script'
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Determine which panel to show on the right based on active workspace or manual override
  const getActiveRightPanel = () => {
    if (rightPanelMode === 'inspector') return 'inspector';
    if (rightPanelMode === 'ai') return 'ai';
    if (rightPanelMode === 'script') return 'script';

    // Auto behavior from activeWorkspace
    if (activeWorkspace === 'audit') return 'ai';
    if (activeWorkspace === 'scripting') return 'script';
    return 'inspector';
  };

  const activePanel = getActiveRightPanel();

  return (
    <div className="w-screen h-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden font-sans select-none">
      {/* 1. Top Blender Header & Menus */}
      <TopMenu />

      {/* 2. Main Studio Work Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Vertical Blender Tool Shelf */}
        <ToolShelf />

        {/* Center Viewport Area */}
        <main className="flex-1 h-full relative overflow-hidden bg-zinc-900 flex">
          {/* Three.js 3D WebGL Viewport */}
          <div className="flex-1 h-full relative">
            <ThreeViewport />
          </div>

          {/* If in Monaco Scripting workspace and sidebar is open, show split layout */}
          {activeWorkspace === 'scripting' && activePanel === 'script' && isSidebarOpen && (
            <div className="w-1/2 h-full border-l border-zinc-800 bg-zinc-950 flex flex-col">
              <MonacoScriptEditor />
            </div>
          )}
        </main>

        {/* Right Collapsible Panel (Outliner/Inspector, Dual AI, or Monaco Editor for other workspaces) */}
        {!(activeWorkspace === 'scripting' && activePanel === 'script') && isSidebarOpen && (
          <aside className="w-80 md:w-96 h-full border-l border-zinc-800 bg-zinc-950 flex flex-col z-20 transition-all">
            {/* Right Panel Sub-Header Switcher */}
            <div className="h-8 px-2 border-b border-zinc-800 bg-zinc-900/90 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setRightPanelMode('inspector')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    activePanel === 'inspector'
                      ? 'bg-zinc-800 text-orange-400 font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="CAD Outliner & Inspector"
                >
                  <span className="flex items-center gap-1">
                    <Layers size={12} />
                    <span>CAD Scene</span>
                  </span>
                </button>

                <button
                  onClick={() => setRightPanelMode('ai')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    activePanel === 'ai'
                      ? 'bg-zinc-800 text-amber-400 font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Dual AI: Spatial Builder & Neural Auditor"
                >
                  <span className="flex items-center gap-1">
                    <Sparkles size={12} />
                    <span>AI Copilot</span>
                  </span>
                </button>

                <button
                  onClick={() => setRightPanelMode('script')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    activePanel === 'script'
                      ? 'bg-zinc-800 text-emerald-400 font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Procedural Three.js Monaco Scripting"
                >
                  <span className="flex items-center gap-1">
                    <Code2 size={12} />
                    <span>Scripts</span>
                  </span>
                </button>
              </div>

              {/* Close Sidebar button */}
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 text-zinc-500 hover:text-zinc-300 rounded"
                title="Collapse Sidebar"
              >
                <PanelRightClose size={14} />
              </button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {activePanel === 'inspector' && (
                <>
                  <div className="h-1/3 min-h-[160px] border-b border-zinc-800">
                    <Outliner />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <Inspector />
                  </div>
                </>
              )}

              {activePanel === 'ai' && <DualAIPanel />}

              {activePanel === 'script' && <MonacoScriptEditor />}
            </div>
          </aside>
        )}

        {/* Expand button when sidebar is collapsed */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-3 right-3 z-30 p-1.5 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 rounded shadow-xl"
            title="Expand Sidebar"
          >
            <PanelRightOpen size={16} />
          </button>
        )}
      </div>

      {/* 3. Bottom Live Aerodynamic CFD Telemetry Bar */}
      <TelemetryBar />
    </div>
  );
}
