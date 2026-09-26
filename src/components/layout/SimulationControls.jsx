import { useStudioStore } from '../../store/useStudioStore';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Wind, 
  Sliders, 
  Bug, 
  Gauge, 
  Layers
} from 'lucide-react';

export default function SimulationControls() {
  const {
    windTunnelParams,
    setWindTunnelParams,
    carParams,
    setCarParams,
    simulationState,
    toggleSimulationState,
    visualizationMode,
    setVisualizationMode,
    particleDensity,
    setParticleDensity,
    debugMode,
    toggleDebugMode,
    shadingMode,
    setShadingMode,
    resetSimulation,
    telemetry
  } = useStudioStore();

  const compStates = telemetry?.componentStates || {
    rearWing: carParams.rearWingAOA > 14.5 ? 'STALLED' : 'ATTACHED',
    diffuser: carParams.diffuserAngle > 12.0 ? 'SEPARATED' : 'ATTACHED',
    underbody: carParams.groundClearance < 0.06 ? 'SEPARATED' : 'ATTACHED'
  };

  const isWingStalled = compStates.rearWing === 'STALLED';
  const isDiffuserSeparated = compStates.diffuser === 'SEPARATED';
  const isFloorChoked = compStates.underbody === 'SEPARATED';

  const vizModes = [
    { id: 'Velocity', label: 'Velocity', desc: '|V| / V_inf speed field' },
    { id: 'Pressure', label: 'Pressure', desc: 'Cp Bernoulli field' },
    { id: 'Streamlines', label: 'Streamlines', desc: 'Continuous tracer paths' },
    { id: 'Separation', label: 'Separation', desc: 'Stall & wake detection' },
    { id: 'Surface', label: 'Surface Cp', desc: 'Bodywork pressure colormap' },
    { id: 'Combined', label: 'Combined', desc: 'Streamlines + stall alerts' }
  ];

  const densities = [
    { value: 1000, label: '1k', desc: 'Fast' },
    { value: 3000, label: '3k', desc: 'Normal' },
    { value: 6000, label: '6k', desc: 'High' },
    { value: 12000, label: '12k', desc: 'Ultra' }
  ];

  return (
    <aside className="w-80 md:w-84 h-full bg-zinc-950 border-r border-zinc-800/80 flex flex-col select-none overflow-hidden z-10 text-xs">
      {/* 1. Header */}
      <div className="h-10 px-3.5 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Wind size={15} className="text-orange-400" />
          <span className="font-bold text-zinc-100 tracking-wide">SIMULATION CONTROLS</span>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-colors ${
          simulationState === 'RUNNING' 
            ? 'bg-emerald-950/90 text-emerald-400 border border-emerald-500/50' 
            : 'bg-amber-950/90 text-amber-400 border border-amber-500/50'
        }`}>
          {simulationState}
        </span>
      </div>

      {/* 2. Scrollable Controls Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 custom-scrollbar">
        {/* Play/Pause & Reset Row */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={toggleSimulationState}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded font-semibold text-xs transition-all shadow-md active:scale-98 ${
              simulationState === 'RUNNING'
                ? 'bg-amber-600/90 hover:bg-amber-500 text-zinc-950'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {simulationState === 'RUNNING' ? (
              <>
                <Pause size={14} className="fill-current" />
                <span>Pause Flow</span>
              </>
            ) : (
              <>
                <Play size={14} className="fill-current" />
                <span>Resume Flow</span>
              </>
            )}
          </button>

          <button
            onClick={resetSimulation}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 font-semibold text-xs transition-all active:scale-98"
            title="Deterministic reset: restores baseline homologated parameters, components, and clears warnings"
          >
            <RotateCcw size={13} className="text-orange-400" />
            <span>Reset Baseline</span>
          </button>
        </div>

        {/* Visualization Modes */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono uppercase text-zinc-400 font-semibold flex items-center justify-between">
            <span>Visualization Mode</span>
            <span className="text-zinc-500 text-[10px]">{visualizationMode}</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {vizModes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setVisualizationMode(mode.id)}
                className={`py-1.5 px-2 rounded text-[11px] font-medium border text-center transition-all ${
                  visualizationMode === mode.id
                    ? 'bg-orange-500/15 border-orange-500/80 text-orange-400 font-bold shadow-sm'
                    : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
                title={mode.desc}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Wind Tunnel Flow Parameters */}
        <div className="space-y-3 pt-2 border-t border-zinc-800/80">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase text-zinc-400 font-semibold">
            <span className="flex items-center gap-1.5">
              <Gauge size={13} className="text-cyan-400" />
              <span>Inlet Freestream Flow</span>
            </span>
            <span className="text-cyan-400 font-bold">{windTunnelParams.windSpeed} m/s</span>
          </div>

          {/* Wind Speed Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>Velocity (10 - 80 m/s)</span>
              <span>{(windTunnelParams.windSpeed * 3.6).toFixed(0)} km/h</span>
            </div>
            <input
              type="range"
              min="10"
              max="80"
              step="1"
              value={windTunnelParams.windSpeed}
              onChange={(e) => setWindTunnelParams({ windSpeed: parseFloat(e.target.value) })}
              className="w-full accent-cyan-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Air Density */}
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="text-zinc-400">Air Density (ρ):</span>
            <span className="font-mono text-zinc-200 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
              {windTunnelParams.airDensity} kg/m³
            </span>
          </div>
        </div>

        {/* SUV Aerodynamic Geometry Sliders with Real-Time Component Warnings */}
        <div className="space-y-3 pt-2 border-t border-zinc-800/80">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase text-zinc-400 font-semibold">
            <span className="flex items-center gap-1.5">
              <Sliders size={13} className="text-orange-400" />
              <span>SUV Aero Geometry</span>
            </span>
          </div>

          {/* 1. Rear Wing AoA */}
          <div className={`p-2.5 rounded border transition-all ${
            isWingStalled 
              ? 'bg-red-950/30 border-red-500/60 ring-1 ring-red-500/30' 
              : 'bg-zinc-900/40 border-zinc-800/80'
          }`}>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-medium text-zinc-300">Rear Wing AoA:</span>
              <div className="flex items-center gap-1.5">
                {isWingStalled && (
                  <span className="px-1.5 py-0.2 rounded bg-red-900/80 text-red-200 text-[10px] font-mono font-bold animate-pulse">
                    STALLED
                  </span>
                )}
                <span className={`font-mono font-bold ${isWingStalled ? 'text-red-400' : 'text-zinc-200'}`}>
                  {carParams.rearWingAOA?.toFixed(1)}°
                </span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="24"
              step="0.5"
              value={carParams.rearWingAOA || 11.5}
              onChange={(e) => setCarParams({ rearWingAOA: parseFloat(e.target.value) })}
              className={`w-full h-1.5 rounded-lg cursor-pointer ${
                isWingStalled ? 'accent-red-500 bg-red-950' : 'accent-orange-500 bg-zinc-800'
              }`}
            />
            <div className="flex justify-between text-[10px] text-zinc-500 mt-1 font-mono">
              <span>0° (Attached)</span>
              <span className="text-red-400">Limit: 14.5°</span>
              <span>24° (Full Stall)</span>
            </div>
          </div>

          {/* 2. Diffuser Expansion Angle */}
          <div className={`p-2.5 rounded border transition-all ${
            isDiffuserSeparated 
              ? 'bg-red-950/30 border-red-500/60 ring-1 ring-red-500/30' 
              : 'bg-zinc-900/40 border-zinc-800/80'
          }`}>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-medium text-zinc-300">Diffuser Expansion:</span>
              <div className="flex items-center gap-1.5">
                {isDiffuserSeparated && (
                  <span className="px-1.5 py-0.2 rounded bg-red-900/80 text-red-200 text-[10px] font-mono font-bold animate-pulse">
                    SEPARATED
                  </span>
                )}
                <span className={`font-mono font-bold ${isDiffuserSeparated ? 'text-red-400' : 'text-zinc-200'}`}>
                  {carParams.diffuserAngle?.toFixed(1)}°
                </span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              step="0.5"
              value={carParams.diffuserAngle || 9.0}
              onChange={(e) => setCarParams({ diffuserAngle: parseFloat(e.target.value) })}
              className={`w-full h-1.5 rounded-lg cursor-pointer ${
                isDiffuserSeparated ? 'accent-red-500 bg-red-950' : 'accent-orange-500 bg-zinc-800'
              }`}
            />
            <div className="flex justify-between text-[10px] text-zinc-500 mt-1 font-mono">
              <span>0° (Flat)</span>
              <span className="text-red-400">Limit: 12.0°</span>
              <span>20° (Detached)</span>
            </div>
          </div>

          {/* 3. Ground Clearance / Ride Height */}
          <div className={`p-2.5 rounded border transition-all ${
            isFloorChoked 
              ? 'bg-red-950/30 border-red-500/60 ring-1 ring-red-500/30' 
              : 'bg-zinc-900/40 border-zinc-800/80'
          }`}>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-medium text-zinc-300">Ground Ride Height:</span>
              <div className="flex items-center gap-1.5">
                {isFloorChoked && (
                  <span className="px-1.5 py-0.2 rounded bg-red-900/80 text-red-200 text-[10px] font-mono font-bold animate-pulse">
                    CHOKED
                  </span>
                )}
                <span className={`font-mono font-bold ${isFloorChoked ? 'text-red-400' : 'text-zinc-200'}`}>
                  {((carParams.groundClearance || 0.18) * 100).toFixed(0)} cm
                </span>
              </div>
            </div>
            <input
              type="range"
              min="0.04"
              max="0.28"
              step="0.01"
              value={carParams.groundClearance || 0.18}
              onChange={(e) => setCarParams({ groundClearance: parseFloat(e.target.value) })}
              className={`w-full h-1.5 rounded-lg cursor-pointer ${
                isFloorChoked ? 'accent-red-500 bg-red-950' : 'accent-cyan-500 bg-zinc-800'
              }`}
            />
            <div className="flex justify-between text-[10px] text-zinc-500 mt-1 font-mono">
              <span className="text-red-400">4cm (Choking)</span>
              <span className="text-emerald-400">18cm (SUV Std)</span>
              <span>28cm (High)</span>
            </div>
          </div>

          {/* 4. Front Splitter Length */}
          <div className="p-2.5 rounded border bg-zinc-900/40 border-zinc-800/80">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-medium text-zinc-300">Front Splitter Extension:</span>
              <span className="font-mono font-bold text-zinc-200">
                {((carParams.splitterLength || 0.20) * 100).toFixed(0)} cm
              </span>
            </div>
            <input
              type="range"
              min="0.10"
              max="0.45"
              step="0.01"
              value={carParams.splitterLength || 0.20}
              onChange={(e) => setCarParams({ splitterLength: parseFloat(e.target.value) })}
              className="w-full h-1.5 rounded-lg cursor-pointer accent-orange-500 bg-zinc-800"
            />
          </div>
        </div>

        {/* Streamline Tracer Particle Density */}
        <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
          <label className="text-[11px] font-mono uppercase text-zinc-400 font-semibold flex items-center justify-between">
            <span>Tracer Density</span>
            <span className="text-cyan-400 font-bold">{particleDensity || 3000} lines</span>
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {densities.map((d) => (
              <button
                key={d.value}
                onClick={() => setParticleDensity(d.value)}
                className={`py-1 px-1.5 rounded text-[11px] font-mono border text-center transition-all ${
                  (particleDensity || 3000) === d.value
                    ? 'bg-cyan-500/20 border-cyan-500/80 text-cyan-300 font-bold shadow-sm'
                    : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <div>{d.label}</div>
                <div className="text-[9px] text-zinc-500">{d.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Shading & Surface Shaders */}
        <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
          <label className="text-[11px] font-mono uppercase text-zinc-400 font-semibold flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Layers size={13} className="text-orange-400" />
              <span>SUV Surface Shading</span>
            </span>
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setShadingMode('aero_pressure')}
              className={`py-1.5 px-2 rounded text-[11px] border text-center transition-all ${
                shadingMode === 'aero_pressure'
                  ? 'bg-orange-500/15 border-orange-500/80 text-orange-400 font-bold'
                  : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Cp Pressure Shader
            </button>
            <button
              onClick={() => setShadingMode('solid')}
              className={`py-1.5 px-2 rounded text-[11px] border text-center transition-all ${
                shadingMode === 'solid'
                  ? 'bg-orange-500/15 border-orange-500/80 text-orange-400 font-bold'
                  : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Solid PBR Paint
            </button>
            <button
              onClick={() => setShadingMode('wireframe')}
              className={`py-1.5 px-2 rounded text-[11px] border text-center transition-all ${
                shadingMode === 'wireframe'
                  ? 'bg-orange-500/15 border-orange-500/80 text-orange-400 font-bold'
                  : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              CAD Wireframe
            </button>
            <button
              onClick={() => setShadingMode('audit_normals')}
              className={`py-1.5 px-2 rounded text-[11px] border text-center transition-all ${
                shadingMode === 'audit_normals'
                  ? 'bg-orange-500/15 border-orange-500/80 text-orange-400 font-bold'
                  : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Surface Normals
            </button>
          </div>
        </div>

        {/* Debug Wireframe Overlays */}
        <div className="pt-2 border-t border-zinc-800/80">
          <button
            onClick={toggleDebugMode}
            className={`w-full flex items-center justify-between p-2.5 rounded border transition-all text-xs ${
              debugMode
                ? 'bg-yellow-950/40 border-yellow-500/80 text-yellow-300'
                : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <Bug size={14} className={debugMode ? 'text-yellow-400' : 'text-zinc-500'} />
              <span className="font-semibold">Debug Flow Overlays</span>
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
              debugMode ? 'bg-yellow-900/80 text-yellow-200' : 'bg-zinc-800 text-zinc-400'
            }`}>
              {debugMode ? 'ON' : 'OFF'}
            </span>
          </button>
          <div className="text-[10px] text-zinc-500 mt-1 px-1">
            Visualizes inlet (cyan), outlet (orange), solid envelope (yellow), and wake volume (pink).
          </div>
        </div>
      </div>
    </aside>
  );
}
