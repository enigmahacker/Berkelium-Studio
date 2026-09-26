import { create } from 'zustand';
import { calculateAerodynamics } from '../services/aeroMath';
import {
  DEFAULT_PYTHON_SCRIPT,
  DEFAULT_CPP_SCRIPT,
  DEFAULT_JS_SCRIPT
} from '../services/defaultCodeTemplates';

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
    wheelbase: 2.85,
    width: 1.98,
    height: 1.65,
    splitterLength: 0.20,
    rearWingAOA: 11.5, // degrees
    rearWingSpan: 1.70,
    diffuserAngle: 9.0, // degrees
    groundClearance: 0.18 // meters (18 cm standard SUV clearance)
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

    // Simulation State: 'RUNNING' | 'PAUSED'
    simulationState: 'RUNNING',
    toggleSimulationState: () =>
      set((state) => {
        const nextState = state.simulationState === 'RUNNING' ? 'PAUSED' : 'RUNNING';
        const newEntry = {
          id: Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          type: 'INFO',
          component: 'Simulation Core',
          message: nextState === 'RUNNING' ? 'Wind tunnel flow integration resumed.' : 'Simulation execution paused.'
        };
        return {
          simulationState: nextState,
          eventLog: [newEntry, ...state.eventLog].slice(0, 80)
        };
      }),
    setSimulationState: (state) => set({ simulationState: state }),

    // Visualization Mode: 'Velocity' | 'Pressure' | 'Streamlines' | 'Separation' | 'Surface' | 'Combined'
    visualizationMode: 'Velocity',
    setVisualizationMode: (mode) => {
      set({ visualizationMode: mode });
      // Synchronize shading mode if appropriate
      if (mode === 'Surface') {
        set({ shadingMode: 'aero_pressure' });
      }
    },

    // Particle Streamline Density: 1000 | 3000 | 6000 | 12000
    particleDensity: 3000,
    setParticleDensity: (density) =>
      set((state) => ({
        particleDensity: density,
        windTunnelParams: { ...state.windTunnelParams, streamlineCount: density }
      })),

    // Debug Mode Overlay
    debugMode: false,
    toggleDebugMode: () => set((state) => ({ debugMode: !state.debugMode })),

    // Event Log Console
    eventLog: [
      {
        id: 1,
        timestamp: new Date().toLocaleTimeString(),
        type: 'INFO',
        component: 'Solver Core',
        message: 'RK4 3D flow field engine initialized for Performance SUV.'
      },
      {
        id: 2,
        timestamp: new Date().toLocaleTimeString(),
        type: 'INFO',
        component: 'Geometry Engine',
        message: 'Loaded dimensionally accurate SUV bodywork (4.8m x 1.98m x 1.65m).'
      }
    ],
    addEventLog: (type, component, message) => {
      const newEntry = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toLocaleTimeString(),
        type,
        component,
        message
      };
      set((state) => ({
        eventLog: [newEntry, ...state.eventLog].slice(0, 80)
      }));
    },
    clearEventLog: () => set({ eventLog: [] }),

    // Deterministic Simulation Reset
    resetSimulation: () => {
      const defaultWind = {
        enabled: true,
        windSpeed: 45.0,
        airDensity: 1.225,
        yawAngle: 0.0,
        streamlineCount: 3000,
        smokeRake: true,
        turbulence: 0.05
      };
      const defaultCar = {
        wheelbase: 2.85,
        width: 1.98,
        height: 1.65,
        splitterLength: 0.20,
        rearWingAOA: 11.5,
        rearWingSpan: 1.70,
        diffuserAngle: 9.0,
        groundClearance: 0.18
      };
      const telem = calculateAerodynamics(defaultCar, defaultWind);
      const resetEntry = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        type: 'INFO',
        component: 'System',
        message: 'Simulation deterministically reset to baseline homologated SUV state.'
      };
      set((state) => ({
        carParams: defaultCar,
        windTunnelParams: defaultWind,
        telemetry: telem,
        simulationState: 'RUNNING',
        visualizationMode: 'Velocity',
        particleDensity: 3000,
        debugMode: false,
        aiState: {
          ...state.aiState,
          defectPins: [],
          auditScore: telem.homologationScore
        },
        eventLog: [resetEntry, ...state.eventLog].slice(0, 80)
      }));
    },

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
      const prevCar = get().carParams;
      const updated = { ...prevCar, ...params };
      const telemetry = calculateAerodynamics(updated, get().windTunnelParams);
      
      // Update defect pins dynamically if angles trigger separation
      const defectPins = [];
      if (updated.rearWingAOA > 14.5) {
        defectPins.push({
          id: 'wing-stall',
          title: 'Rear Wing Flow Stall',
          description: `AOA is ${updated.rearWingAOA.toFixed(1)}° (>14.5° max threshold). Adverse pressure gradient triggers massive boundary layer detachment.`,
          position: [0, 1.76, -2.15],
          severity: 'critical'
        });
        if (prevCar.rearWingAOA <= 14.5) {
          get().addEventLog('CRIT', 'Rear Wing', `Flow separation and stall triggered at AoA = ${updated.rearWingAOA.toFixed(1)}°`);
        }
      } else if (prevCar.rearWingAOA > 14.5 && updated.rearWingAOA <= 14.5) {
        get().addEventLog('INFO', 'Rear Wing', `Flow re-attached at AoA = ${updated.rearWingAOA.toFixed(1)}°. Boundary layer stable.`);
      }

      if (updated.diffuserAngle > 12.0) {
        defectPins.push({
          id: 'diffuser-sep',
          title: 'Diffuser Flow Separation',
          description: `Diffuser expansion angle is ${updated.diffuserAngle.toFixed(1)}° (>12° limit). Underbody suction collapses due to turbulent eddy formation.`,
          position: [0, 0.28, -2.10],
          severity: 'critical'
        });
        if (prevCar.diffuserAngle <= 12.0) {
          get().addEventLog('CRIT', 'Diffuser', `Vortex breakdown & flow detachment at ramp angle = ${updated.diffuserAngle.toFixed(1)}°`);
        }
      } else if (prevCar.diffuserAngle > 12.0 && updated.diffuserAngle <= 12.0) {
        get().addEventLog('INFO', 'Diffuser', `Diffuser flow re-attached at ${updated.diffuserAngle.toFixed(1)}°. Ground suction restored.`);
      }

      if (updated.groundClearance < 0.06) {
        defectPins.push({
          id: 'floor-seal',
          title: 'Ground Clearance Choking',
          description: `Ride height of ${(updated.groundClearance * 100).toFixed(0)}cm risks ground choking and porpoising oscillations.`,
          position: [0, 0.12, 0],
          severity: 'critical'
        });
        if (prevCar.groundClearance >= 0.06) {
          get().addEventLog('CRIT', 'Underbody', `Ground choking (< 6cm) detected at ${(updated.groundClearance * 100).toFixed(0)}cm ride height.`);
        }
      } else if (prevCar.groundClearance < 0.06 && updated.groundClearance >= 0.06) {
        get().addEventLog('INFO', 'Underbody', `Ride height restored to ${(updated.groundClearance * 100).toFixed(0)}cm. Venturi throat unblocked.`);
      }

      if (updated.splitterLength > 0.38) {
        defectPins.push({
          id: 'splitter-scrape',
          title: 'Splitter Extension Warning',
          description: `Splitter projection of ${(updated.splitterLength * 100).toFixed(0)}cm exceeds optimal aero balance and risks bottoming out.`,
          position: [0, 0.16, 2.15 + updated.splitterLength * 0.4],
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
    clearScriptLogs: () => set({ scriptOutputLog: [] }),

    // Real Project & Working Directory state
    isProjectLauncherOpen: !localStorage.getItem('berkelium_skip_launcher'),
    openProjectLauncher: () => set({ isProjectLauncherOpen: true }),
    closeProjectLauncher: () => set({ isProjectLauncherOpen: false }),

    currentProject: {
      name: 'Performance SUV Aerodynamics Studio',
      path: '/projects/suv_aerodynamics',
      files: [
        { name: 'simulation.py', language: 'python', type: 'script' },
        { name: 'aerodynamics_solver.cpp', language: 'cpp', type: 'kernel' },
        { name: 'generate_car.js', language: 'javascript', type: 'cad' }
      ]
    },
    setProject: (project) => set({ currentProject: project, isProjectLauncherOpen: false }),

    // Multi-Language Code Editor Files (Python, C++, JavaScript)
    activeCodeFile: 'simulation.py',
    setActiveCodeFile: (fileName) => set({ activeCodeFile: fileName }),
    codeFiles: {
      'simulation.py': DEFAULT_PYTHON_SCRIPT,
      'aerodynamics_solver.cpp': DEFAULT_CPP_SCRIPT,
      'generate_car.js': DEFAULT_JS_SCRIPT
    },
    updateCodeFileContent: (fileName, content) =>
      set((state) => ({
        codeFiles: { ...state.codeFiles, [fileName]: content }
      })),

    // Real imported 3D Mesh
    customMeshModel: null,
    setCustomMeshModel: (mesh) => set({ customMeshModel: mesh })
  };
});
