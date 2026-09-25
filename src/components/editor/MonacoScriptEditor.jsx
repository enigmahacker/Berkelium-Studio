import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { useStudioStore } from '../../store/useStudioStore';
import { 
  Play, 
  RotateCcw, 
  Terminal, 
  Code2, 
  Trash2, 
  CheckCircle, 
  AlertCircle 
} from 'lucide-react';

const SCRIPT_PRESETS = [
  {
    name: 'Add Carbon Vortex Generator Array',
    code: `// Custom Aerodynamic Procedural Script: Vortex Generator Array
console.log("Injecting Roof Vortex Generators...");

const vgGroup = new THREE.Group();
vgGroup.name = "Custom_Vortex_Array";

const vgGeo = new THREE.ConeGeometry(0.035, 0.1, 4);
const vgMat = new THREE.MeshStandardMaterial({
  color: 0xf97316,
  metalness: 0.85,
  roughness: 0.2
});

// Place 6 vortex generators along roof trailing edge
for (let i = -3; i <= 3; i++) {
  if (i === 0) continue;
  const vg = new THREE.Mesh(vgGeo, vgMat);
  vg.position.set(i * 0.12, 0.88, -0.42);
  vg.rotation.x = -Math.PI / 8;
  vg.rotation.z = (i % 2 === 0 ? 1 : -1) * (Math.PI / 10);
  vgGroup.add(vg);
}

carGroup.add(vgGroup);
console.log("6 Vortex Generators attached to cockpit trailing edge!");
`
  },
  {
    name: 'Add NACA 2412 Dual Gurney Flap',
    code: `// Custom Aerodynamic Procedural Script: Dual Gurney Flap
console.log("Attaching Gurney high-pressure flap to rear wing...");

const flapGeo = new THREE.BoxGeometry(1.62, 0.04, 0.015);
const flapMat = new THREE.MeshStandardMaterial({
  color: 0xef4444, // Red aerodynamic highlight
  roughness: 0.3,
  metalness: 0.7
});

const flap = new THREE.Mesh(flapGeo, flapMat);
flap.position.set(0, 1.05, -1.84);
flap.name = "Custom_GurneyFlap";
carGroup.add(flap);

console.log("High-pressure Gurney Flap deployed at rear wing trailing edge.");
`
  },
  {
    name: 'Add Front Venturi Canards',
    code: `// Custom Aerodynamic Procedural Script: Aggressive Front Dive Canards
console.log("Synthesizing front dive canards for extra front axle downforce...");

const canardGroup = new THREE.Group();
canardGroup.name = "Custom_FrontCanards";

const canardShape = new THREE.Shape();
canardShape.moveTo(0, 0);
canardShape.lineTo(0.35, 0.05);
canardShape.lineTo(0.25, 0.22);
canardShape.closePath();

const extrudeSettings = { depth: 0.012, bevelEnabled: false };
const canardGeo = new THREE.ExtrudeGeometry(canardShape, extrudeSettings);
const canardMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.9, roughness: 0.2 });

const leftCanard = new THREE.Mesh(canardGeo, canardMat);
leftCanard.position.set(-0.95, 0.38, 1.6);
leftCanard.rotation.x = Math.PI / 6;
leftCanard.rotation.z = Math.PI / 10;
canardGroup.add(leftCanard);

const rightCanard = leftCanard.clone();
rightCanard.position.x = 0.95;
rightCanard.rotation.z = -Math.PI / 10;
canardGroup.add(rightCanard);

carGroup.add(canardGroup);
console.log("Dual dive canards synthesized!");
`
  }
];

export default function MonacoScriptEditor() {
  const {
    aiState,
    setAiState,
    runScriptTrigger,
    scriptOutputLog,
    clearScriptLogs,
    addScriptLog
  } = useStudioStore();

  const [selectedPreset, setSelectedPreset] = useState('');

  const handleRunScript = () => {
    runScriptTrigger();
  };

  const handlePresetChange = (e) => {
    const presetName = e.target.value;
    setSelectedPreset(presetName);
    const found = SCRIPT_PRESETS.find((p) => p.name === presetName);
    if (found) {
      setAiState({ activeScript: found.code });
      addScriptLog(`[Preset Loaded] ${presetName}`);
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-xs">
      {/* Script Editor Toolbar */}
      <div className="h-10 px-3 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-zinc-200 font-semibold">
            <Code2 size={15} className="text-emerald-400" />
            <span>Procedural Three.js Scripting</span>
          </div>

          {/* Preset Selector */}
          <select
            value={selectedPreset}
            onChange={handlePresetChange}
            className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-[11px] text-zinc-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="">Load Preset Geometry...</option>
            {SCRIPT_PRESETS.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunScript}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold text-xs shadow-md transition-all active:scale-95"
            title="Execute procedural 3D code (Ctrl+Enter)"
          >
            <Play size={13} fill="currentColor" />
            <span>Execute Script</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 min-h-[300px] relative">
        <Editor
          height="100%"
          theme="vs-dark"
          language="javascript"
          value={aiState.activeScript}
          onChange={(val) => setAiState({ activeScript: val || '' })}
          options={{
            fontSize: 12,
            fontFamily: 'JetBrains Mono, Menlo, monospace',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            lineNumbers: 'on',
            lineDecorationsWidth: 6,
            tabSize: 2,
            automaticLayout: true
          }}
        />
      </div>

      {/* Script Console Output Panel */}
      <div className="h-40 border-t border-zinc-800 bg-zinc-950 flex flex-col">
        <div className="h-7 px-3 bg-zinc-900/60 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[11px]">
            <Terminal size={12} className="text-zinc-500" />
            <span>Console Execution Output</span>
          </div>
          <button
            onClick={clearScriptLogs}
            className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded"
            title="Clear Console"
          >
            <Trash2 size={12} />
          </button>
        </div>

        <div className="flex-1 p-2 overflow-y-auto font-mono text-[11px] space-y-1 custom-scrollbar">
          {scriptOutputLog.length === 0 ? (
            <div className="text-zinc-600 italic">No output. Press "Execute Script" to inject procedural 3D geometry into the viewport.</div>
          ) : (
            scriptOutputLog.map((log, idx) => (
              <div
                key={idx}
                className={
                  log.includes('ERROR')
                    ? 'text-red-400 flex items-center gap-1.5'
                    : log.includes('successful')
                    ? 'text-emerald-400 flex items-center gap-1.5'
                    : 'text-zinc-300'
                }
              >
                {log.includes('ERROR') && <AlertCircle size={11} className="shrink-0" />}
                {log.includes('successful') && <CheckCircle size={11} className="shrink-0" />}
                <span>{log}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
