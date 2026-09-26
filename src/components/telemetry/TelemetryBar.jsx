import { useState } from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import { 
  Activity, 
  Wind, 
  Zap, 
  ChevronUp, 
  ChevronDown, 
  AlertTriangle, 
  CheckCircle2, 
  Gauge
} from 'lucide-react';

export default function TelemetryBar() {
  const { telemetry, windTunnelParams, carParams, project, simulationState, openProjectLauncher } = useStudioStore();
  const [expanded, setExpanded] = useState(false);

  const isNoProject = simulationState === 'NO_PROJECT' || !project?.valid;
  const speedKmh = (windTunnelParams.windSpeed * 3.6).toFixed(1);
  const speedMph = (windTunnelParams.windSpeed * 2.23694).toFixed(1);

  // Aerodynamic balance estimation: front vs rear downforce percentage
  const frontDownforceRatio = Math.round(
    38 + (carParams.splitterLength - 0.25) * 40 - (carParams.rearWingAOA - 11.5) * 1.5
  );
  const rearDownforceRatio = 100 - frontDownforceRatio;

  if (isNoProject || !telemetry) {
    return (
      <footer className="bg-zinc-950 border-t border-zinc-800 text-xs text-zinc-400 select-none z-30 flex items-center justify-between h-9 px-4">
        <div className="flex items-center gap-3">
          <Activity size={13} className="text-zinc-500" />
          <span className="font-mono text-zinc-500 uppercase">Reduced-Order Aerodynamic Model:</span>
          <span className="text-zinc-400 font-mono">
            {isNoProject ? 'NO SIMULATION PROJECT LOADED' : 'READY — Click [Run Aerodynamic Simulation] to calculate'}
          </span>
        </div>
        {isNoProject && (
          <button
            onClick={openProjectLauncher}
            className="text-[11px] text-orange-400 hover:text-orange-300 font-semibold cursor-pointer"
          >
            Select Project...
          </button>
        )}
      </footer>
    );
  }

  const isStalled = !!telemetry.flow_separation;

  return (
    <footer className="bg-zinc-950 border-t border-zinc-800 text-xs text-zinc-300 select-none z-30 flex flex-col transition-all duration-300">
      {/* Primary Strip */}
      <div className="h-10 px-4 flex items-center justify-between">
        {/* Left: Live Force Telemetry */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 font-semibold text-zinc-200">
            <Activity size={14} className="text-cyan-400" />
            <span className="font-mono text-zinc-400">AERO TELEMETRY</span>
          </div>

          {/* Drag Force */}
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-zinc-500">Drag (Fd):</span>
            <span className="text-amber-400 font-bold text-sm">
              {telemetry.dragForce?.toLocaleString() || '0'} N
            </span>
            <span className="text-[10px] text-zinc-500">
              (Cd: {telemetry.cd?.toFixed(3) || '0.320'})
            </span>
          </div>

          {/* Downforce */}
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-zinc-500">Downforce (-Fl):</span>
            <span className="text-cyan-400 font-bold text-sm">
              {telemetry.downforce?.toLocaleString() || '0'} N
            </span>
            <span className="text-[10px] text-zinc-500">
              (Cl: {telemetry.cl?.toFixed(3) || '0.200'})
            </span>
          </div>

          {/* Power Required */}
          <div className="hidden sm:flex items-center gap-1.5 font-mono">
            <span className="text-zinc-500">Power Loss:</span>
            <span className="text-emerald-400 font-bold">
              {telemetry.powerRequiredKw || '0'} kW
            </span>
            <span className="text-[10px] text-zinc-500">
              ({telemetry.powerRequiredHp || '0'} HP)
            </span>
          </div>
        </div>

        {/* Right: Flow Status Pill & Drawer Expand Button */}
        <div className="flex items-center gap-4 font-mono">
          {/* Velocity Badge */}
          <div className="hidden md:flex items-center gap-1.5 text-zinc-400">
            <Wind size={13} className="text-cyan-400" />
            <span>{windTunnelParams.windSpeed} m/s</span>
            <span className="text-zinc-600">({speedKmh} km/h | {speedMph} mph)</span>
          </div>

          {/* Dynamic Flow Status - Red warnings strictly driven by solver flow_separation */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
              isStalled
                ? 'bg-red-950/60 border-red-500/60 text-red-300 animate-pulse'
                : 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300'
            }`}
          >
            {isStalled ? (
              <>
                <AlertTriangle size={12} className="text-red-400 shrink-0" />
                <span>Boundary Layer Separation</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                <span>Boundary Layer Attached</span>
              </>
            )}
          </div>

          {/* Expand Drawer Button */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            title="Toggle Detailed Aero Telemetry Drawer"
          >
            <span className="text-[10px]">Details</span>
            {expanded ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
        </div>
      </div>

      {/* Expanded Detailed CFD Breakdown Drawer */}
      {expanded && (
        <div className="p-4 bg-zinc-900/90 border-t border-zinc-800 grid grid-cols-2 md:grid-cols-4 gap-4 animate-in slide-in-from-bottom-2 duration-200 font-mono text-[11px]">
          {/* Card 1: Aero Balance */}
          <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800 space-y-1.5">
            <div className="text-zinc-400 flex items-center justify-between">
              <span>Aero Balance (Front / Rear)</span>
              <Gauge size={13} className="text-cyan-400" />
            </div>
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-cyan-400">Front: {frontDownforceRatio}%</span>
              <span className="text-orange-400">Rear: {rearDownforceRatio}%</span>
            </div>
            {/* Balance Bar */}
            <div className="w-full h-1.5 bg-zinc-800 rounded-full flex overflow-hidden">
              <div style={{ width: `${frontDownforceRatio}%` }} className="bg-cyan-500" />
              <div style={{ width: `${rearDownforceRatio}%` }} className="bg-orange-500" />
            </div>
          </div>

          {/* Card 2: Reynolds Number */}
          <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800 space-y-1">
            <div className="text-zinc-400 flex items-center justify-between">
              <span>Reynolds Number (Re)</span>
              <Activity size={13} className="text-emerald-400" />
            </div>
            <div className="text-base font-bold text-zinc-100">
              {telemetry.reynoldsNo ? (telemetry.reynoldsNo / 1e6).toFixed(2) : '14.59'} × 10⁶
            </div>
            <div className="text-[10px] text-zinc-500">
              Length: 4.80m | Turbulent Boundary Layer
            </div>
          </div>

          {/* Card 3: Dynamic Pressure q */}
          <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800 space-y-1">
            <div className="text-zinc-400 flex items-center justify-between">
              <span>Dynamic Pressure (q)</span>
              <Wind size={13} className="text-amber-400" />
            </div>
            <div className="text-base font-bold text-amber-400">
              {telemetry.dynamicPressure?.toLocaleString() || '1,240'} Pa
            </div>
            <div className="text-[10px] text-zinc-500">
              At ρ = {windTunnelParams.airDensity} kg/m³
            </div>
          </div>

          {/* Card 4: Top Speed Power Equivalent */}
          <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800 space-y-1">
            <div className="text-zinc-400 flex items-center justify-between">
              <span>Aero Drag Power Loss</span>
              <Zap size={12} className="text-red-400" />
            </div>
            <div className="text-base font-bold text-zinc-100">
              {telemetry.powerRequiredHp || '0'} HP
            </div>
            <div className="text-[10px] text-zinc-500">
              ({telemetry.powerRequiredKw || '0'} kW)
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
