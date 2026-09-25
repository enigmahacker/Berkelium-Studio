import { create } from 'zustand';
import { calculateAerodynamics } from '../services/aeroMath';

export const useStudioStore = create((set, get) => {
  const initialWind = {
    enabled: true,
    windSpeed: 45.0, // m/s (~162 km/h)
    airDensity: 1.225, // kg/m^3 standard sea level
    yawAngle: 0.0, // degrees
    streamlineCount: 3000,
    smokeRake: true,
    turbulence: 0.05
  };

  const initialCar = {
    wheelbase: 2.7,
    width: 1.9,
    height: 1.15,
    splitterLength: 0.25,
    rearWingAOA: 11.5, // degrees
    rearWingSpan: 1.6,
    diffuserAngle: 9.0, // degrees
    groundClearance: 0.08 // meters
  };

  const initialTelemetry = calculateAerodynamics(initialCar, initialWind);

  return {
    // Workspaces: 'modeling' | 'aero' | 'audit' | 'scripting'
    activeWorkspace: 'aero',
    setActiveWorkspace: (ws) => set({ activeWorkspace: ws }),

    // Active tool: 'select' | 'cursor' | 'translate' | 'rotate' | 'scale' | 'probe' | 'streamline'
    activeTool: 'select',
    setActiveTool: (tool) => set({ activeTool: tool }),

    // Camera view: 'persp' | 'top' | 'side' | 'front'
    cameraView: 'persp',
    setCameraView: (view) => set({ cameraView: view }),

    // Shading mode: 'solid' | 'wireframe' | 'aero_pressure' | 'streamlines' | 'audit_normals'
    shadingMode: 'aero_pressure',
    setShadingMode: (mode) => set({ shadingMode: mode }),

    // Wind Tunnel parameters
    windTunnelParams: initialWind,
    setWindTunnelParams: (params) => {
      const updated = { ...get().windTunnelParams, ...params };
      const telemetry = calculateAerodynamics(get().carParams, updated);
      set({ windTunnelParams: updated, telemetry });
    },

    // Car aerodynamic geometry parameters
    carParams: initialCar,
    setCarParams: (params) => {
      const updated = { ...get().carParams, ...params };
      const telemetry = calculateAerodynamics(updated, get().windTunnelParams);
      
      // Update defect pins dynamically if angles trigger separation
      const defectPins = [];
      if (updated.rearWingAOA > 14.5) {
        defectPins.push({
          id: 'wing-stall',
          title: 'Rear Wing Flow Stall',
          description: `AOA is ${updated.rearWingAOA.toFixed(1)}° (>14.5° max threshold). Adverse pressure gradient triggers massive boundary layer detachment.`,
          position: [0, 1.15, -1.80], // Precise coordinates on trailing flap suction surface
          severity: 'critical'
        });
      }
      if (updated.diffuserAngle > 12.0) {
        defectPins.push({
          id: 'diffuser-sep',
          title: 'Diffuser Flow Separation',
          description: `Diffuser expansion angle is ${updated.diffuserAngle.toFixed(1)}° (>12° limit). Underbody suction collapses due to turbulent eddy formation.`,
          position: [0, 0.26, -2.10], // Precise coordinates at upswept diffuser ramp exit
          severity: 'warning'
        });
      }
      if (updated.groundClearance < 0.05) {
        defectPins.push({
          id: 'floor-seal',
          title: 'Ground Clearance Choking',
          description: `Ride height of ${(updated.groundClearance * 100).toFixed(0)}cm risks ground choking and porpoising oscillations.`,
          position: [0, 0.08, 0], // Center underfloor venturi throat
          severity: 'warning'
        });
      }
      if (updated.splitterLength > 0.38) {
        defectPins.push({
          id: 'splitter-scrape',
          title: 'Splitter Extension Warning',
          description: `Splitter projection of ${(updated.splitterLength * 100).toFixed(0)}cm exceeds optimal aero balance and risks bottoming out.`,
          position: [0, 0.12, 1.7 + updated.splitterLength * 0.4],
          severity: 'warning'
        });
      }

      set((state) => ({
        carParams: updated,
        telemetry,
        aiState: {
          ...state.aiState,
          defectPins,
          auditScore: telemetry.homologationScore
        }
      }));
    },

    // Aerodynamics & CFD Telemetry
    telemetry: initialTelemetry,
    setTelemetry: (telemetry) => set({ telemetry }),

    // AI Dual-Brain state
    aiState: {
      builderPrompt: '',
      isBuilding: false,
      isAuditing: false,
      auditScore: initialTelemetry.homologationScore || 96,
      auditReport: null,
      defectPins: [],
      chatHistory: [
        {
          sender: 'ai',
          role: 'Spatial Builder',
          text: 'Berkelium Studio AI initialized. Spatial monocoque geometry loaded. Ready to optimize aerodynamic surfaces, run CFD wind tunnel simulation, or audit flow characteristics.'
        }
      ],
      activeScript: `// Berkelium Three.js Procedural Aerodynamics Script
// Access variables: scene, carGroup, THREE, aeroParams

console.log("Procedural car script ready.");

// Example: Add an aerodynamic vortex generator flap
const vgGeo = new THREE.ConeGeometry(0.04, 0.12, 4);
const vgMat = new THREE.MeshStandardMaterial({ 
  color: 0xf97316, 
  roughness: 0.2, 
  metalness: 0.8 
});

const leftVG = new THREE.Mesh(vgGeo, vgMat);
leftVG.position.set(-0.55, 0.45, 1.4);
leftVG.rotation.z = Math.PI / 4;
leftVG.name = "Custom_VortexGenerator_L";
carGroup.add(leftVG);

const rightVG = leftVG.clone();
rightVG.position.x = 0.55;
rightVG.rotation.z = -Math.PI / 4;
rightVG.name = "Custom_VortexGenerator_R";
carGroup.add(rightVG);
`
    },
    setAiState: (patch) => {
      set((state) => ({
        aiState: { ...state.aiState, ...(typeof patch === 'function' ? patch(state.aiState) : patch) }
      }));
    },

    // Backend connectivity status: 'connected' | 'offline'
    backendStatus: 'offline',
    setBackendStatus: (status) => set({ backendStatus: status }),

    // Outliner scene management
    selectedObjectId: 'CarAssembly',
    setSelectedObjectId: (id) => set({ selectedObjectId: id }),

    sceneVisibility: {
      worldLighting: true,
      windTunnel: true,
      carAssembly: true,
      chassis: true,
      splitter: true,
      cockpit: true,
      rearWing: true,
      diffuser: true,
      wheels: true,
      streamlines: true,
      auditPins: true
    },
    toggleSceneVisibility: (key) =>
      set((state) => ({
        sceneVisibility: {
          ...state.sceneVisibility,
          [key]: !state.sceneVisibility[key]
        }
      })),

    sceneLocks: {
      carAssembly: false,
      windTunnel: true
    },
    toggleSceneLock: (key) =>
      set((state) => ({
        sceneLocks: {
          ...state.sceneLocks,
          [key]: !state.sceneLocks[key]
        }
      })),

    // Multi-angle snapshot generation request timestamp
    snapshotTriggerTime: 0,
    triggerVisualSnapshot: () => set({ snapshotTriggerTime: Date.now() }),
    capturedSnapshots: {
      persp: null,
      top: null,
      side: null,
      front: null
    },
    setCapturedSnapshots: (snapshots) =>
      set((state) => ({
        capturedSnapshots: { ...state.capturedSnapshots, ...snapshots }
      })),

    // Script execution trigger
    scriptExecutionVersion: 0,
    runScriptTrigger: () =>
      set((state) => ({ scriptExecutionVersion: state.scriptExecutionVersion + 1 })),
    scriptOutputLog: [],
    addScriptLog: (msg) =>
      set((state) => ({
        scriptOutputLog: [...state.scriptOutputLog.slice(-49), msg]
      })),
    clearScriptLogs: () => set({ scriptOutputLog: [] })
  };
});
