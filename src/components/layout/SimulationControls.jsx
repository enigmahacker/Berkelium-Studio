import { useStudioStore } from '../../store/useStudioStore';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Wind, 
  Sliders, 
  Bug, 
  Gauge, 
  Layers,
  FolderOpen,
  Cpu,
  AlertTriangle,
  Activity
} from 'lucide-react';

export default function SimulationControls() {
  const {
    windTunnelParams,
    setWindTunnelParams,
    carParams,
    setCarParams,
    simulationState,
    toggleSimulationState,
    runSimulation,
    visualizationMode,
    setVisualizationMode,
    debugMode,
    toggleDebugMode,
    shadingMode,
    setShadingMode,
    resetSimulation,
    project,
    flowFieldAvailable,
    toggleFlowFieldSolver,
    openProjectLauncher
  } = useStudioStore();

  const isNoProject = simulationState === 'NO_PROJECT' || !project?.valid;
  const isRunning = simulationState === 'RUNNING';
  const isComplete = simulationState === 'COMPLETE';

  const vizModes = [
    { id: 'Velocity', label: 'Velocity', desc: '|V| / V_inf speed field' },
    { id: 'Pressure', label: 'Pressure', desc: 'Cp Bernoulli field' },
    { id: 'Streamlines', label: 'Streamlines', desc: 'Continuous tracer paths' },
    { id: 'Separation', label: 'Separation', desc: 'Stall & wake detection' },
    { id: 'Surface', label: 'Surface Cp', desc: 'Bodywork pressure colormap' },
    { id: 'Combined', label: 'Combined', desc: 'Streamlines + stall alerts' }
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
            ? 'bg-emerald-950/90 text-emerald-400 border border-emerald-500/50 animate-pulse' 
            : simulationState === 'PROJECT_READY' || simulationState === 'COMPLETE'
            ? 'bg-blue-950/90 text-blue-400 border border-blue-500/50'
            : 'bg-red-950/90 text-red-400 border border-red-500/50'
        }`}>
          {simulationState}
        </span>
      </div>

      {/* 2. Scrollable Controls Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 custom-scrollbar">
        {/* Project Information Card (Sections 2 & 3) */}
        <div className="p-2.5 rounded bg-zinc-900/90 border border-zinc-800 space-y-1.5 font-mono text-[10px]">
          <div className="flex items-center justify-between text-zinc-400 border-b border-zinc-800 pb-1">
            <span className="font-semibold text-zinc-300 uppercase flex items-center gap-1.5">
              <Cpu size={12} className="text-cyan-400" />
              <span>Project & Engine</span>
            </span>
            <button
              onClick={openProjectLauncher}
              className="text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer transition-colors"
              title="Open Project Launcher"
            >
              <FolderOpen size={11} />
              <span>Change</span>
            </button>
          </div>

          <div className="text-zinc-300 truncate" title={project?.path || 'Not detected'}>
            <span className="text-zinc-500">PROJECT: </span>
            <span className={project?.valid ? 'text-zinc-200 font-semibold' : 'text-amber-400 font-semibold'}>
              {project?.valid ? project.path : 'Not detected'}
            </span>
          </div>

          <div className="text-zinc-300 truncate" title={project?.engine || 'Not detected'}>
            <span className="text-zinc-500">Simulation Engine: </span>
            <span className={project?.valid ? 'text-cyan-300' : 'text-zinc-500'}>
              {project?.valid ? (project.engine || 'Reduced-Order Aerodynamic Model (Python)') : 'Not detected'}
            </span>
          </div>

          <div className="text-zinc-300 truncate" title={project?.sourceFile || 'None'}>
            <span className="text-zinc-500">Source: </span>
            <span className={project?.valid ? 'text-orange-300' : 'text-zinc-500'}>
              {project?.valid ? (project.sourceFile || 'simulation.py') : 'None'}
            </span>
          </div>
        </div>

        {/* Primary Action Buttons (Disabled when NO_PROJECT) */}
        <div className="space-y-2">
          {isNoProject ? (
            <div className="space-y-2">
              <div className="p-2.5 rounded bg-amber-950/40 border border-amber-500/40 text-amber-300 text-[11px] flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold">No Valid Simulation Project</div>
                  <p className="text-zinc-400 text-[10px] leading-relaxed">
                    Select a recognized Berkelium Studio directory to enable simulation actions.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded bg-zinc-900 border border-zinc-800 text-zinc-600 font-semibold text-xs cursor-not-allowed"
                  title="Start Simulation is disabled until a project is loaded"
                >
                  <Play size={13} />
                  <span>Start Sim</span>
                </button>
                <button
                  disabled
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded bg-zinc-900 border border-zinc-800 text-zinc-600 font-semibold text-xs cursor-not-allowed"
                  title="Run is disabled until a project is loaded"
                >
                  <span>Run</span>
                </button>
              </div>

              <button
                onClick={openProjectLauncher}
                className="w-full py-2 px-3 rounded bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs transition-all shadow flex items-center justify-center gap-2 cursor-pointer"
              >
                <FolderOpen size={13} />
                <span>Select Project Directory...</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Ready / Complete / Running Trigger */}
              <button
                onClick={runSimulation}
                disabled={isRunning}
                className={`w-full py-2.5 px-3 rounded font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98 ${
                  isRunning
                    ? 'bg-amber-600 text-zinc-950 animate-pulse'
                    : isComplete
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-orange-600 hover:bg-orange-500 text-white'
                }`}
              >
                <Play size={14} className="fill-current" />
                <span>
                  {isRunning 
                    ? 'Executing Simulation Model...' 
                    : isComplete 
                    ? 'Re-run Simulation' 
                    : 'Run Aerodynamic Simulation'}
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={toggleSimulationState}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded font-semibold text-xs transition-all active:scale-98 cursor-pointer ${
                    simulationState === 'RUNNING'
                      ? 'bg-amber-950/80 hover:bg-amber-900 border border-amber-500 text-amber-300'
                      : 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300'
                  }`}
                >
                  {simulationState === 'RUNNING' ? <Pause size={13} /> : <Play size={13} />}
                  <span>{simulationState === 'RUNNING' ? 'Pause' : 'Live Flow'}</span>
                </button>

                <button
                  onClick={resetSimulation}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-semibold text-xs transition-all active:scale-98 cursor-pointer"
                  title="Reset to baseline parameters"
                >
                  <RotateCcw size={13} className="text-orange-400" />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3D Flow Field Visualizer Connection (Sections 5 & 7) */}
        <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase text-zinc-400 font-semibold">
            <span className="flex items-center gap-1.5">
              <Activity size={12} className={flowFieldAvailable ? 'text-cyan-400' : 'text-zinc-500'} />
              <span>3D Flow Field Solver</span>
            </span>
            <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase ${
              flowFieldAvailable ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50' : 'bg-zinc-800 text-zinc-400'
            }`}>
              {flowFieldAvailable ? 'Connected' : 'Unavailable'}
            </span>
          </div>

          <p className="text-[10px] text-zinc-400 leading-snug">
            {flowFieldAvailable
              ? 'RK4 3D potential flow field generator is active. Streamlines render around vehicle contour.'
              : 'FLOW VISUALIZATION: Velocity field unavailable. Connect the 3D solver to render physical streamlines.'}
          </p>

          <button
            onClick={toggleFlowFieldSolver}
            disabled={isNoProject}
            className={`w-full py-1.5 px-3 rounded font-semibold text-xs transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
              isNoProject
                ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
                : flowFieldAvailable
                ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300'
                : 'bg-cyan-600/20 hover:bg-cyan-600/30 border-cyan-500/60 text-cyan-300'
            }`}
          >
            <Wind size={13} />
            <span>{flowFieldAvailable ? 'Disconnect 3D Flow Field' : 'Connect 3D Velocity Field Solver'}</span>
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
                disabled={isNoProject}
                className={`py-1.5 px-2 rounded text-[11px] font-medium border text-center transition-all ${
                  isNoProject
                    ? 'bg-zinc-900/40 border-zinc-850 text-zinc-700 cursor-not-allowed'
                    : visualizationMode === mode.id
                    ? 'bg-orange-500/15 border-orange-500/80 text-orange-400 font-bold shadow-sm cursor-pointer'
                    : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 cursor-pointer'
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
              disabled={isNoProject}
              value={windTunnelParams.windSpeed}
              onChange={(e) => setWindTunnelParams({ windSpeed: parseFloat(e.target.value) })}
              className="w-full accent-cyan-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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

        {/* SUV Aerodynamic Geometry Sliders */}
        <div className="space-y-3 pt-2 border-t border-zinc-800/80">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase text-zinc-400 font-semibold">
            <span className="flex items-center gap-1.5">
              <Sliders size={13} className="text-orange-400" />
              <span>SUV Aero Geometry</span>
            </span>
          </div>

          {/* 1. Rear Wing AoA */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-400">Rear Wing AOA:</span>
              <span className={`font-mono font-bold ${
                carParams.rearWingAOA > 14.5 ? 'text-red-400' : 'text-zinc-200'
              }`}>
                {carParams.rearWingAOA.toFixed(1)}°
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="24"
              step="0.5"
              disabled={isNoProject}
              value={carParams.rearWingAOA}
              onChange={(e) => setCarParams({ rearWingAOA: parseFloat(e.target.value) })}
              className="w-full accent-orange-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>0° (Min Drag)</span>
              <span className="text-amber-500/80">14.5° Stall Limit</span>
              <span>24° (Max Downforce)</span>
            </div>
          </div>

          {/* 2. Diffuser Ramp Angle */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-400">Diffuser Expansion:</span>
              <span className={`font-mono font-bold ${
                carParams.diffuserAngle > 12.0 ? 'text-red-400' : 'text-zinc-200'
              }`}>
                {carParams.diffuserAngle.toFixed(1)}°
              </span>
            </div>
            <input
              type="range"
              min="2"
              max="20"
              step="0.5"
              disabled={isNoProject}
              value={carParams.diffuserAngle}
              onChange={(e) => setCarParams({ diffuserAngle: parseFloat(e.target.value) })}
              className="w-full accent-orange-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>2°</span>
              <span className="text-amber-500/80">12° Detachment Limit</span>
              <span>20°</span>
            </div>
          </div>

          {/* 3. Ground Clearance / Ride Height */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-400">Ground Clearance:</span>
              <span className={`font-mono font-bold ${
                carParams.groundClearance < 0.06 ? 'text-red-400' : 'text-zinc-200'
              }`}>
                {(carParams.groundClearance * 100).toFixed(0)} cm
              </span>
            </div>
            <input
              type="range"
              min="0.04"
              max="0.25"
              step="0.01"
              disabled={isNoProject}
              value={carParams.groundClearance}
              onChange={(e) => setCarParams({ groundClearance: parseFloat(e.target.value) })}
              className="w-full accent-orange-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span className="text-amber-500/80">4cm (Choking)</span>
              <span>18cm (Stock SUV)</span>
              <span>25cm</span>
            </div>
          </div>

          {/* 4. Front Splitter Length */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-400">Splitter Extension:</span>
              <span className="font-mono text-zinc-200">
                {(carParams.splitterLength * 100).toFixed(0)} cm
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.45"
              step="0.02"
              disabled={isNoProject}
              value={carParams.splitterLength}
              onChange={(e) => setCarParams({ splitterLength: parseFloat(e.target.value) })}
              className="w-full accent-orange-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>5 cm</span>
              <span>20 cm</span>
              <span>45 cm</span>
            </div>
          </div>
        </div>

        {/* Shading Mode Selector */}
        <div className="space-y-2 pt-2 border-t border-zinc-800/80">
          <label className="text-[11px] font-mono uppercase text-zinc-400 font-semibold flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Layers size={13} className="text-orange-400" />
              <span>Surface Shading Mode</span>
            </span>
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: 'aero_pressure', label: 'Pressure Cp' },
              { id: 'solid', label: 'Matte Solid' },
              { id: 'wireframe', label: 'Wireframe' },
              { id: 'audit_normals', label: 'Normals' }
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setShadingMode(m.id)}
                disabled={isNoProject}
                className={`py-1.5 px-2 rounded text-[11px] font-medium border text-center transition-all ${
                  isNoProject
                    ? 'bg-zinc-900/40 border-zinc-850 text-zinc-700 cursor-not-allowed'
                    : shadingMode === m.id
                    ? 'bg-orange-500/20 border-orange-500 text-orange-300 font-bold cursor-pointer'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Debug Boundary Overlays */}
        <div className="pt-2 border-t border-zinc-800/80">
          <button
            onClick={toggleDebugMode}
            disabled={isNoProject}
            className={`w-full py-1.5 px-3 rounded text-[11px] font-mono font-semibold flex items-center justify-between border transition-all ${
              isNoProject
                ? 'bg-zinc-900/40 border-zinc-850 text-zinc-700 cursor-not-allowed'
                : debugMode
                ? 'bg-yellow-950/80 border-yellow-500 text-yellow-300 cursor-pointer'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-300 cursor-pointer'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Bug size={13} className={debugMode ? 'text-yellow-400' : 'text-zinc-500'} />
              <span>Inlet / Body / Wake Wireframes</span>
            </span>
            <span className="text-[10px] font-bold">{debugMode ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
