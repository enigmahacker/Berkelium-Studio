import { useStudioStore } from '../../store/useStudioStore';
import { getComponentStatusMatrix } from '../../services/aeroMath';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  Flame, 
  Zap, 
  Terminal,
  Gauge
} from 'lucide-react';

export default function EngineeringDiagnostics() {
  const {
    telemetry,
    carParams,
    windTunnelParams,
    eventLog,
    clearEventLog
  } = useStudioStore();

  const compMatrix = telemetry?.componentStatusMatrix || getComponentStatusMatrix(carParams, windTunnelParams);

  const getStatusBadge = (status) => {
    if (status === 'STALLED' || status === 'SEPARATED' || status === 'EXPANDED_SEPARATED_WAKE') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-950/90 text-red-300 border border-red-500/70 animate-pulse">
          <AlertTriangle size={11} className="text-red-400" />
          <span>{status}</span>
        </span>
      );
    }
    if (status === 'HIGH_LOAD') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-950/80 text-amber-300 border border-amber-500/60">
          <Flame size={11} className="text-amber-400" />
          <span>HIGH LOAD</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-500/50">
        <CheckCircle2 size={11} className="text-emerald-400" />
        <span>ATTACHED</span>
      </span>
    );
  };

  const getLogBadge = (type) => {
    if (type === 'CRIT') {
      return <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-red-900/80 text-red-200 border border-red-500/60">CRIT</span>;
    }
    if (type === 'WARN') {
      return <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-900/80 text-amber-200 border border-amber-500/60">WARN</span>;
    }
    return <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-emerald-900/60 text-emerald-300 border border-emerald-500/40">INFO</span>;
  };

  return (
    <div className="w-full h-full flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden text-xs select-none">
      {/* 1. Sub-Header */}
      <div className="h-9 px-3.5 border-b border-zinc-800 bg-zinc-900/90 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-cyan-400" />
          <span className="font-bold text-zinc-100 tracking-wide text-xs">DIAGNOSTICS & TELEMETRY</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-400">Homologation:</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
            (telemetry?.homologationScore || 90) >= 80 ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-red-950 text-red-400 border border-red-500/40'
          }`}>
            {telemetry?.homologationScore || 90}%
          </span>
        </div>
      </div>

      {/* 2. Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 custom-scrollbar">
        {/* Aerodynamic Telemetry Cards Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Drag Force */}
          <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 text-[10px] font-mono">
              <span>DRAG FORCE (Fd)</span>
              <span className="text-orange-400 font-bold">Cd {telemetry?.cd?.toFixed(3) || '0.345'}</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-zinc-100">{telemetry?.dragForce?.toLocaleString() || '0'}</span>
              <span className="text-[10px] text-zinc-500 font-mono">N</span>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
              Area: {telemetry?.frontalArea || 2.75} m²
            </div>
          </div>

          {/* Downforce */}
          <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 text-[10px] font-mono">
              <span>DOWNFORCE (Fl)</span>
              <span className="text-cyan-400 font-bold">Cl {telemetry?.cl?.toFixed(3) || '0.220'}</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-zinc-100">{telemetry?.downforce?.toLocaleString() || '0'}</span>
              <span className="text-[10px] text-zinc-500 font-mono">N</span>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
              L/D Ratio: {telemetry?.liftToDragRatio || '0.64'}
            </div>
          </div>

          {/* Propulsion Power Required */}
          <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 text-[10px] font-mono">
              <span>AERO POWER (P)</span>
              <Zap size={12} className="text-yellow-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-zinc-100">{telemetry?.powerRequiredKw || '0'}</span>
              <span className="text-[10px] text-zinc-500 font-mono">kW</span>
            </div>
            <div className="text-[10px] text-yellow-500/90 font-mono mt-0.5">
              {telemetry?.powerRequiredHp || '0'} Mechanical HP
            </div>
          </div>

          {/* Dynamic Pressure & Reynolds */}
          <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 text-[10px] font-mono">
              <span>DYNAMIC PRESSURE (q)</span>
              <Gauge size={12} className="text-emerald-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-zinc-100">{telemetry?.dynamicPressure?.toLocaleString() || '0'}</span>
              <span className="text-[10px] text-zinc-500 font-mono">Pa</span>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
              Re: {(telemetry?.reynoldsNo ? (telemetry.reynoldsNo / 1e6).toFixed(2) : '14.5')} × 10⁶
            </div>
          </div>
        </div>

        {/* Component Health & Status Matrix */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase text-zinc-400 font-semibold border-b border-zinc-800 pb-1">
            <span>Component Aero Health Matrix</span>
            <span className="text-zinc-500 text-[10px]">{compMatrix.length} parts</span>
          </div>

          <div className="space-y-1.5">
            {compMatrix.map((item) => {
              const isAlert = item.severity === 'critical';
              const isWarning = item.severity === 'warning';

              return (
                <div
                  key={item.id}
                  className={`p-2.5 rounded border transition-all ${
                    isAlert
                      ? 'bg-red-950/40 border-red-500/80 shadow-md ring-1 ring-red-500/40'
                      : isWarning
                      ? 'bg-amber-950/25 border-amber-500/60'
                      : 'bg-zinc-900/50 border-zinc-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-zinc-200 text-xs">{item.name}</span>
                    {getStatusBadge(item.status, item.severity)}
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-1">
                    <span>{item.location}</span>
                    <div className="flex items-center gap-2">
                      <span className={item.deltaCl.startsWith('-') ? 'text-red-400' : 'text-emerald-400'}>
                        ΔCl: {item.deltaCl}
                      </span>
                      <span className={item.deltaCd.startsWith('+') ? 'text-red-400' : 'text-emerald-400'}>
                        ΔCd: {item.deltaCd}
                      </span>
                    </div>
                  </div>

                  <p className={`text-[10px] leading-tight ${
                    isAlert ? 'text-red-300 font-medium' : isWarning ? 'text-amber-300' : 'text-zinc-500'
                  }`}>
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Engineering Event Console */}
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase text-zinc-400 font-semibold">
            <span className="flex items-center gap-1.5">
              <Terminal size={13} className="text-orange-400" />
              <span>Simulation Event Console</span>
            </span>
            <button
              onClick={clearEventLog}
              className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-800 transition-colors"
              title="Clear Console Logs"
            >
              <Trash2 size={12} />
            </button>
          </div>

          <div className="h-44 overflow-y-auto bg-zinc-950 rounded border border-zinc-800 p-2 font-mono text-[10px] space-y-1.5 custom-scrollbar">
            {eventLog && eventLog.length > 0 ? (
              eventLog.map((log) => (
                <div key={log.id} className="flex items-start gap-1.5 leading-snug">
                  <span className="text-zinc-600 shrink-0">{log.timestamp}</span>
                  {getLogBadge(log.type)}
                  <span className="text-zinc-400 font-semibold shrink-0">[{log.component}]</span>
                  <span className={log.type === 'CRIT' ? 'text-red-300 font-medium' : log.type === 'WARN' ? 'text-amber-300' : 'text-zinc-300'}>
                    {log.message}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-zinc-600 italic py-2 text-center">Console ready. No active events.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
