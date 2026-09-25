import React, { useState } from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import { 
  Sliders, 
  Move3d, 
  Wind, 
  Palette, 
  Layers, 
  Gauge, 
  AlertTriangle, 
  CheckCircle,
  HelpCircle
} from 'lucide-react';

export default function Inspector() {
  const {
    activeWorkspace,
    shadingMode,
    setShadingMode,
    carParams,
    setCarParams,
    windTunnelParams,
    setWindTunnelParams,
    telemetry
  } = useStudioStore();

  const [activeTab, setActiveTab] = useState('aero'); // 'transform' | 'aero' | 'tunnel' | 'shading'

  // Dummy transform state for selected object (Blender style)
  const [transform, setTransform] = useState({
    posX: 0.0,
    posY: carParams.groundClearance || 0.08,
    posZ: 0.0,
    rotX: 0.0,
    rotY: 0.0,
    rotZ: 0.0,
    scaleX: 1.0,
    scaleY: 1.0,
    scaleZ: 1.0
  });

  return (
    <div className="h-full flex flex-col bg-zinc-950 border-l border-zinc-800 text-xs select-none">
      {/* Inspector Tabs Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 p-1">
        <button
          onClick={() => setActiveTab('aero')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all ${
            activeTab === 'aero' ? 'bg-orange-500 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title="Aerodynamics CFD Tuning"
        >
          <Gauge size={13} />
          <span>Aero</span>
        </button>

        <button
          onClick={() => setActiveTab('tunnel')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all ${
            activeTab === 'tunnel' ? 'bg-orange-500 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title="Wind Tunnel Boundary Conditions"
        >
          <Wind size={13} />
          <span>Tunnel</span>
        </button>

        <button
          onClick={() => setActiveTab('shading')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all ${
            activeTab === 'shading' ? 'bg-orange-500 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title="Shading & Materials"
        >
          <Palette size={13} />
          <span>Shading</span>
        </button>

        <button
          onClick={() => setActiveTab('transform')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all ${
            activeTab === 'transform' ? 'bg-orange-500 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title="3D Transform Matrices"
        >
          <Move3d size={13} />
          <span>Object</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
        {/* ================= AERO TAB ================= */}
        {activeTab === 'aero' && (
          <div className="space-y-4">
            {/* Quick Health Status */}
            <div className={`p-2.5 rounded border text-[11px] ${
              telemetry.flowSeparationDetected 
                ? 'bg-red-950/40 border-red-500/50 text-red-200'
                : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
            }`}>
              <div className="flex items-center gap-1.5 font-bold mb-1">
                {telemetry.flowSeparationDetected ? (
                  <>
                    <AlertTriangle size={14} className="text-red-400 shrink-0" />
                    <span>Boundary Layer Stall Detected</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                    <span>Laminar Flow Adherence Nominal</span>
                  </>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                {telemetry.flowSeparationDetected 
                  ? 'High adverse pressure gradient detected on aero surfaces. Decrease Wing AOA (<14.5°) or Diffuser angle (<12°).' 
                  : 'Flow vectors cleanly conform across monocoque contours and underfloor ground effect.'}
              </p>
            </div>

            {/* Aerodynamic Coefficients Card */}
            <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800 space-y-2">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block border-b border-zinc-800 pb-1">
                Aero Performance Figures
              </span>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-zinc-950 p-2 rounded border border-zinc-800/80">
                  <div className="text-[10px] text-zinc-500 font-mono">Cd (Drag)</div>
                  <div className="text-base font-bold text-amber-400 font-mono">{telemetry.cd}</div>
                </div>
                <div className="bg-zinc-950 p-2 rounded border border-zinc-800/80">
                  <div className="text-[10px] text-zinc-500 font-mono">Cl (Downforce)</div>
                  <div className="text-base font-bold text-cyan-400 font-mono">{telemetry.cl}</div>
                </div>
                <div className="bg-zinc-950 p-2 rounded border border-zinc-800/80">
                  <div className="text-[10px] text-zinc-500 font-mono">L/D Efficiency</div>
                  <div className="text-base font-bold text-emerald-400 font-mono">{telemetry.liftToDragRatio}</div>
                </div>
                <div className="bg-zinc-950 p-2 rounded border border-zinc-800/80">
                  <div className="text-[10px] text-zinc-500 font-mono">Frontal Area</div>
                  <div className="text-base font-bold text-zinc-200 font-mono">{telemetry.frontalArea} m²</div>
                </div>
              </div>
            </div>

            {/* Aerodynamic Sliders */}
            <div className="space-y-3">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                Geometry Control Sliders
              </span>

              {/* Rear Wing AOA Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-zinc-300 font-medium">
                  <span>Rear Wing AOA:</span>
                  <span className={`font-mono font-bold ${carParams.rearWingAOA > 14.5 ? 'text-red-400' : 'text-orange-400'}`}>
                    {carParams.rearWingAOA.toFixed(1)}°
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="20.0"
                  step="0.5"
                  value={carParams.rearWingAOA}
                  onChange={(e) => setCarParams({ rearWingAOA: parseFloat(e.target.value) })}
                  className="w-full accent-orange-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>0° (Low Drag)</span>
                  <span className="text-red-500">14.5° Stall</span>
                  <span>20° (Extreme)</span>
                </div>
              </div>

              {/* Diffuser Angle Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-zinc-300 font-medium">
                  <span>Diffuser Expansion Angle:</span>
                  <span className={`font-mono font-bold ${carParams.diffuserAngle > 12.0 ? 'text-red-400' : 'text-orange-400'}`}>
                    {carParams.diffuserAngle.toFixed(1)}°
                  </span>
                </div>
                <input
                  type="range"
                  min="2.0"
                  max="18.0"
                  step="0.5"
                  value={carParams.diffuserAngle}
                  onChange={(e) => setCarParams({ diffuserAngle: parseFloat(e.target.value) })}
                  className="w-full accent-orange-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>2°</span>
                  <span className="text-red-500">12° Detachment</span>
                  <span>18°</span>
                </div>
              </div>

              {/* Splitter Length Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-zinc-300 font-medium">
                  <span>Front Splitter Extension:</span>
                  <span className="font-mono font-bold text-orange-400">
                    {(carParams.splitterLength * 100).toFixed(0)} cm
                  </span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.45"
                  step="0.01"
                  value={carParams.splitterLength}
                  onChange={(e) => setCarParams({ splitterLength: parseFloat(e.target.value) })}
                  className="w-full accent-orange-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>10 cm</span>
                  <span>25 cm (FIA Standard)</span>
                  <span>45 cm</span>
                </div>
              </div>

              {/* Ground Clearance Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-zinc-300 font-medium">
                  <span>Ride Height / Ground Clearance:</span>
                  <span className="font-mono font-bold text-orange-400">
                    {(carParams.groundClearance * 100).toFixed(1)} cm
                  </span>
                </div>
                <input
                  type="range"
                  min="0.04"
                  max="0.15"
                  step="0.005"
                  value={carParams.groundClearance}
                  onChange={(e) => setCarParams({ groundClearance: parseFloat(e.target.value) })}
                  className="w-full accent-orange-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>4 cm (Low)</span>
                  <span>8 cm (Optimum)</span>
                  <span>15 cm (Street)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TUNNEL TAB ================= */}
        {activeTab === 'tunnel' && (
          <div className="space-y-4">
            <div className="space-y-3">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                Boundary Conditions
              </span>

              {/* Wind Speed Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-zinc-300 font-medium">
                  <span>Freestream Wind Speed:</span>
                  <span className="font-mono font-bold text-cyan-400">
                    {windTunnelParams.windSpeed.toFixed(1)} m/s ({(windTunnelParams.windSpeed * 3.6).toFixed(0)} km/h)
                  </span>
                </div>
                <input
                  type="range"
                  min="10.0"
                  max="90.0"
                  step="1.0"
                  value={windTunnelParams.windSpeed}
                  onChange={(e) => setWindTunnelParams({ windSpeed: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>10 m/s</span>
                  <span>45 m/s (Test)</span>
                  <span>90 m/s (324 km/h)</span>
                </div>
              </div>

              {/* Air Density */}
              <div className="space-y-1">
                <div className="flex justify-between text-zinc-300 font-medium">
                  <span>Air Density (ρ):</span>
                  <span className="font-mono text-zinc-400">
                    {windTunnelParams.airDensity} kg/m³
                  </span>
                </div>
                <input
                  type="range"
                  min="1.000"
                  max="1.300"
                  step="0.005"
                  value={windTunnelParams.airDensity}
                  onChange={(e) => setWindTunnelParams({ airDensity: parseFloat(e.target.value) })}
                  className="w-full accent-zinc-500 cursor-pointer"
                />
              </div>

              {/* Turbulence Intensity */}
              <div className="space-y-1">
                <div className="flex justify-between text-zinc-300 font-medium">
                  <span>Turbulence Intensity:</span>
                  <span className="font-mono text-zinc-400">
                    {(windTunnelParams.turbulence * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="0.25"
                  step="0.01"
                  value={windTunnelParams.turbulence}
                  onChange={(e) => setWindTunnelParams({ turbulence: parseFloat(e.target.value) })}
                  className="w-full accent-zinc-500 cursor-pointer"
                />
              </div>

              {/* Streamline Smoke Toggle */}
              <div className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800">
                <span className="text-zinc-300">Active Smoke Rake</span>
                <input
                  type="checkbox"
                  checked={windTunnelParams.smokeRake}
                  onChange={(e) => setWindTunnelParams({ smokeRake: e.target.checked })}
                  className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= SHADING TAB ================= */}
        {activeTab === 'shading' && (
          <div className="space-y-4">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
              Viewport Shading Mode
            </span>

            <div className="grid grid-cols-1 gap-1.5 font-medium">
              {[
                { id: 'aero_pressure', label: 'Aerodynamic Pressure (Cp)', desc: 'Scientific Cool-to-Warm Colormap' },
                { id: 'solid', label: 'Solid PBR Studio', desc: 'Blender Graphite & Carbon Fiber PBR' },
                { id: 'wireframe', label: 'Wireframe Mesh', desc: 'Topology & Polycount Inspection' },
                { id: 'streamlines', label: 'Streamline Vectors Only', desc: 'Smoke Particle Velocity Traces' },
                { id: 'audit_normals', label: 'Audit Surface Normals', desc: 'Watertight & Curvature Vector Normal' }
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setShadingMode(mode.id)}
                  className={`text-left p-2 rounded border transition-all ${
                    shadingMode === mode.id
                      ? 'bg-orange-500/20 border-orange-500/70 text-orange-300 shadow'
                      : 'bg-zinc-900/70 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <div className="font-semibold text-xs text-zinc-200">{mode.label}</div>
                  <div className="text-[10px] text-zinc-500">{mode.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ================= TRANSFORM TAB ================= */}
        {activeTab === 'transform' && (
          <div className="space-y-3 font-mono text-[11px]">
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
              Transform Coordinates
            </span>

            <div className="space-y-2">
              {/* Position */}
              <div className="bg-zinc-900/60 p-2 rounded border border-zinc-800 space-y-1">
                <span className="text-zinc-500 text-[10px] block">Location</span>
                <div className="grid grid-cols-3 gap-1">
                  <div className="flex items-center gap-1 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                    <span className="text-red-500 font-bold">X</span>
                    <input
                      type="number"
                      step="0.1"
                      value={transform.posX}
                      onChange={(e) => setTransform({ ...transform, posX: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent text-right focus:outline-none text-zinc-200"
                    />
                  </div>
                  <div className="flex items-center gap-1 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                    <span className="text-emerald-500 font-bold">Y</span>
                    <input
                      type="number"
                      step="0.01"
                      value={transform.posY}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setTransform({ ...transform, posY: val });
                        setCarParams({ groundClearance: val });
                      }}
                      className="w-full bg-transparent text-right focus:outline-none text-zinc-200"
                    />
                  </div>
                  <div className="flex items-center gap-1 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                    <span className="text-blue-500 font-bold">Z</span>
                    <input
                      type="number"
                      step="0.1"
                      value={transform.posZ}
                      onChange={(e) => setTransform({ ...transform, posZ: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent text-right focus:outline-none text-zinc-200"
                    />
                  </div>
                </div>
              </div>

              {/* Rotation */}
              <div className="bg-zinc-900/60 p-2 rounded border border-zinc-800 space-y-1">
                <span className="text-zinc-500 text-[10px] block">Rotation (Degrees)</span>
                <div className="grid grid-cols-3 gap-1">
                  <div className="flex items-center gap-1 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                    <span className="text-red-500 font-bold">X</span>
                    <input
                      type="number"
                      value={transform.rotX}
                      onChange={(e) => setTransform({ ...transform, rotX: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent text-right focus:outline-none text-zinc-200"
                    />
                  </div>
                  <div className="flex items-center gap-1 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                    <span className="text-emerald-500 font-bold">Y</span>
                    <input
                      type="number"
                      value={transform.rotY}
                      onChange={(e) => setTransform({ ...transform, rotY: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent text-right focus:outline-none text-zinc-200"
                    />
                  </div>
                  <div className="flex items-center gap-1 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                    <span className="text-blue-500 font-bold">Z</span>
                    <input
                      type="number"
                      value={transform.rotZ}
                      onChange={(e) => setTransform({ ...transform, rotZ: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent text-right focus:outline-none text-zinc-200"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
