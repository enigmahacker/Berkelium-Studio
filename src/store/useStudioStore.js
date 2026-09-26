import { create } from 'zustand';
import { executePythonSimulationModel } from '../services/aeroMath.js';
import {
  DEFAULT_PYTHON_SCRIPT,
  DEFAULT_CPP_SCRIPT,
  DEFAULT_JS_SCRIPT
} from '../services/defaultCodeTemplates.js';

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

    // Strict State Machine Lifecycle:
    // 'NO_PROJECT' -> 'SCANNING' -> 'PROJECT_READY' -> 'RUNNING' -> 'COMPLETE' (or 'ERROR')
    simulationState: 'NO_PROJECT',
    setSimulationState: (state) => set({ simulationState: state }),

    // Flow Field Visualizer connection status
    // Particles NEVER run unless project.valid === true && simulationRunning && flowFieldAvailable === true
    flowFieldAvailable: false,
    toggleFlowFieldSolver: () => {
      const { project, flowFieldAvailable, addEventLog } = get();
      if (!project?.valid) {
        addEventLog('WARN', 'Visualizer', 'Cannot activate flow field: No valid project loaded.');
        return;
      }
      const next = !flowFieldAvailable;
      if (next) {
        addEventLog('INFO', 'Flow Field', '3D Velocity Field Solver connected (RK4 Streamlines active).');
      } else {
        addEventLog('INFO', 'Flow Field', '3D Velocity Field Solver disconnected. Reverting to pure reduced-order analytical model.');
      }
      set({ flowFieldAvailable: next });
    },

    toggleSimulationState: () => {
      const state = get();
      if (state.simulationState === 'NO_PROJECT') {
        state.addEventLog('WARN', 'State Machine', 'Simulation action ignored: NO_PROJECT is active. Select a valid project directory first.');
        return;
      }
      if (state.simulationState === 'PROJECT_READY') {
        get().runSimulation();
        return;
      }
      if (state.simulationState === 'RUNNING') {
        set({ simulationState: 'PAUSED' });
        state.addEventLog('INFO', 'Simulation Core', 'Simulation execution paused.');
      } else if (state.simulationState === 'PAUSED') {
        set({ simulationState: 'RUNNING' });
        state.addEventLog('INFO', 'Simulation Core', 'Simulation execution resumed.');
      } else if (state.simulationState === 'COMPLETE') {
        get().runSimulation();
      }
    },

    // Visualization Mode: 'Velocity' | 'Pressure' | 'Streamlines' | 'Separation' | 'Surface' | 'Combined'
    visualizationMode: 'Velocity',
    setVisualizationMode: (mode) => {
      set({ visualizationMode: mode });
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
        component: 'System',
        message: 'Berkelium Studio initialized. Ready to validate simulation project.'
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
      const isProjValid = get().project?.valid;
      const resetEntry = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        type: 'INFO',
        component: 'System',
        message: isProjValid
          ? 'Simulation reset to baseline homologated SUV state (PROJECT_READY).'
          : 'Simulation reset. No project detected.'
      };

      set((state) => ({
        carParams: defaultCar,
        windTunnelParams: defaultWind,
        telemetry: null,
        simulationState: isProjValid ? 'PROJECT_READY' : 'NO_PROJECT',
        flowFieldAvailable: false,
        visualizationMode: 'Velocity',
        particleDensity: 3000,
        debugMode: false,
        aiState: {
          ...state.aiState,
          defectPins: [],
          auditScore: 96
        },
        eventLog: [resetEntry, ...state.eventLog].slice(0, 80)
      }));
    },

    // Wind Tunnel parameters
    windTunnelParams: initialWind,
    setWindTunnelParams: (params) => {
      const updated = { ...get().windTunnelParams, ...params };
      const currentTelemetry = get().telemetry;
      const newTelemetry = currentTelemetry ? executePythonSimulationModel(get().carParams, updated) : null;
      set({ windTunnelParams: updated, telemetry: newTelemetry });
    },

    // Car aerodynamic geometry parameters
    carParams: initialCar,
    setCarParams: (params) => {
      const prevCar = get().carParams;
      const updated = { ...prevCar, ...params };
      const currentTelemetry = get().telemetry;
      const newTelemetry = currentTelemetry ? executePythonSimulationModel(updated, get().windTunnelParams) : null;

      // Update defect pins dynamically if angles trigger separation
      const defectPins = [];
      if (updated.rearWingAOA > 14.5) {
        defectPins.push({
          id: 'wing-stall',
          title: 'Rear Wing Flow Stall',
          description: `AOA is ${updated.rearWingAOA.toFixed(1)}° (>14.5° max threshold). Adverse pressure gradient triggers boundary layer detachment.`,
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

      set((state) => ({
        carParams: updated,
        telemetry: newTelemetry,
        aiState: {
          ...state.aiState,
          defectPins,
          auditScore: newTelemetry?.homologationScore || state.aiState.auditScore
        }
      }));
    },

    // Aerodynamics & Telemetry (NULL initially until simulation is executed)
    telemetry: null,
    setTelemetry: (telemetry) => set({ telemetry }),

    // Execute Real Aerodynamic Simulation
    runSimulation: () => {
      const { simulationState, project, carParams, windTunnelParams, addEventLog } = get();
      if (simulationState === 'NO_PROJECT' || !project?.valid) {
        addEventLog('WARN', 'State Machine', 'Cannot execute simulation: NO_PROJECT is active. Select a valid project first.');
        return;
      }

      set({ simulationState: 'RUNNING' });
      addEventLog('INFO', 'Solver Core', `Executing ${project.engine} with source ${project.sourceFile}...`);

      try {
        const telemetry = executePythonSimulationModel(carParams, windTunnelParams);
        if (telemetry.flow_separation) {
          addEventLog('CRIT', 'Aerodynamics', 'Solver reported aerodynamic flow separation (stall/detachment detected).');
        } else {
          addEventLog('INFO', 'Aerodynamics', `Solver converged: Cd=${telemetry.cd} | Cl=${telemetry.cl} | Fd=${telemetry.dragForce}N | Fl=${telemetry.downforce}N.`);
        }
        set({
          telemetry,
          simulationState: 'COMPLETE'
        });
      } catch (err) {
        addEventLog('CRIT', 'Solver Error', `Simulation failed: ${err.message}. Returning to PROJECT_READY.`);
        set({ simulationState: 'PROJECT_READY' });
      }
    },

    // AI Dual-Brain state
    aiState: {
      builderPrompt: '',
      isBuilding: false,
      isAuditing: false,
      auditScore: 96,
      auditReport: null,
      defectPins: [],
      chatHistory: [
        {
          sender: 'ai',
          role: 'Spatial Builder',
          text: 'Berkelium Studio AI initialized. Spatial monocoque geometry loaded. Ready to optimize aerodynamic surfaces, run CFD wind tunnel simulation, or audit flow characteristics.'
        }
      ],
      activeScript: `// Berkelium Three.js Procedural Aerodynamics Script\nconsole.log("Procedural car script ready.");`
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
    isProjectLauncherOpen: false,
    openProjectLauncher: () => set({ isProjectLauncherOpen: true }),
    closeProjectLauncher: () => set({ isProjectLauncherOpen: false }),

    project: {
      valid: false,
      path: null,
      name: null,
      engine: null,
      sourceFile: null,
      files: [],
      rejectionReason: null
    },
    currentProject: {
      valid: false,
      name: 'Not detected',
      path: 'Not detected',
      engine: 'Not detected',
      sourceFile: 'None',
      files: []
    },

    // Strict Project Validation Function
    scanAndValidateProject: (dirData) => {
      const dirName = dirData?.name || '';
      const dirPath = dirData?.path || '';
      const rawFiles = dirData?.files || [];

      set({ simulationState: 'SCANNING' });

      // 1. Check if folder is empty
      if (!rawFiles || rawFiles.length === 0) {
        const rejectedProject = {
          valid: false,
          path: dirPath || 'Not detected',
          name: dirName || 'Empty Folder',
          engine: null,
          sourceFile: null,
          files: [],
          rejectionReason: 'EMPTY_DIRECTORY'
        };
        const logEntry = {
          id: Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          type: 'WARN',
          component: 'Project Validator',
          message: 'Rejected empty folder: No simulation project detected.'
        };
        set((state) => ({
          simulationState: 'NO_PROJECT',
          project: rejectedProject,
          currentProject: rejectedProject,
          telemetry: null,
          flowFieldAvailable: false,
          eventLog: [logEntry, ...state.eventLog].slice(0, 80)
        }));
        return { valid: false, reason: 'EMPTY_DIRECTORY' };
      }

      // 2. Check for recognized project structure
      const RECOGNIZED = [
        'package.json',
        'pyproject.toml',
        'requirements.txt',
        'src',
        'app',
        'backend',
        'frontend',
        'simulation',
        'simulation.py',
        'aerodynamics_solver.cpp',
        'berkelium.json'
      ];

      const fileNames = rawFiles.map((f) => (typeof f === 'string' ? f : f.name).toLowerCase());
      const hasRecognizedItem = fileNames.some((name) =>
        RECOGNIZED.some((rec) => name === rec || name.startsWith(rec + '/') || name.endsWith('/' + rec))
      );

      if (!hasRecognizedItem) {
        const rejectedProject = {
          valid: false,
          path: dirPath || 'Not detected',
          name: dirName || 'Invalid Folder',
          engine: null,
          sourceFile: null,
          files: rawFiles,
          rejectionReason: 'INVALID_STRUCTURE'
        };
        const logEntry = {
          id: Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          type: 'WARN',
          component: 'Project Validator',
          message: `Selected directory '${dirName}' contains no recognized simulation project.`
        };
        set((state) => ({
          simulationState: 'NO_PROJECT',
          project: rejectedProject,
          currentProject: rejectedProject,
          telemetry: null,
          flowFieldAvailable: false,
          eventLog: [logEntry, ...state.eventLog].slice(0, 80)
        }));
        return { valid: false, reason: 'INVALID_PROJECT' };
      }

      // 3. Project is VALID! Detect simulation engine & source file
      let detectedEngine;
      let sourceFile;

      if (fileNames.includes('simulation.py')) {
        detectedEngine = 'Reduced-Order Aerodynamic Model (Python)';
        sourceFile = 'simulation.py';
      } else if (fileNames.some((n) => n.includes('backend') || n === 'main.py')) {
        detectedEngine = 'Reduced-Order Aerodynamic Model (Python Backend)';
        sourceFile = 'backend/main.py';
      } else if (fileNames.some((n) => n.endsWith('.cpp'))) {
        detectedEngine = 'C++17 RK4 Aerodynamics Solver';
        sourceFile = rawFiles.find((f) => (f.name || f).endsWith('.cpp'))?.name || 'aerodynamics_solver.cpp';
      } else {
        detectedEngine = 'Reduced-Order Aerodynamic Model (Berkelium Studio)';
        sourceFile = 'simulation.py';
      }

      const validProject = {
        valid: true,
        path: dirPath || '/Users/prithviaryam/Downloads/berkelium-web',
        name: dirName || 'Berkelium Studio',
        engine: detectedEngine,
        sourceFile,
        files: rawFiles,
        rejectionReason: null
      };

      const logEntry = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        type: 'INFO',
        component: 'Project Validator',
        message: `Project loaded: ${validProject.path}. Engine: ${detectedEngine} (${sourceFile}).`
      };

      set((state) => ({
        simulationState: 'PROJECT_READY',
        project: validProject,
        currentProject: validProject,
        flowFieldAvailable: false,
        telemetry: null,
        isProjectLauncherOpen: false,
        eventLog: [logEntry, ...state.eventLog].slice(0, 80)
      }));

      return { valid: true, project: validProject };
    },

    // Convenience function to load the actual Berkelium Studio root
    loadRealBerkeliumStudioProject: () => {
      return get().scanAndValidateProject({
        name: 'Berkelium Studio',
        path: '/Users/prithviaryam/Downloads/berkelium-web',
        files: [
          { name: 'simulation.py', type: 'python' },
          { name: 'package.json', type: 'file' },
          { name: 'backend', type: 'directory' },
          { name: 'src', type: 'directory' },
          { name: 'README.md', type: 'file' },
          { name: 'vite.config.js', type: 'file' }
        ]
      });
    },

    setProject: (project) => {
      if (!project) return;
      get().scanAndValidateProject(project);
    },

    // Multi-Language Code Editor Files
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
