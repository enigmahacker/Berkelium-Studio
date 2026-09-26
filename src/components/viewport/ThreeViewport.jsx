import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { useStudioStore } from '../../store/useStudioStore';
import { buildProceduralCar, updateCarGeometry, disposeCarAssembly } from '../../services/proceduralCar';
import { 
  rk4Integrate, 
  isPointInsideVehicle, 
  projectOutOfSolid, 
  getVelocityField 
} from '../../services/flowField';
import { deriveComponentStates } from '../../services/aeroMath';
import { 
  Activity, 
  AlertTriangle,
  FolderX,
  FolderOpen,
  Compass
} from 'lucide-react';

export default function ThreeViewport() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Store state
  const {
    activeTool,
    cameraView,
    setCameraView,
    shadingMode,
    windTunnelParams,
    carParams,
    sceneVisibility,
    snapshotTriggerTime,
    setCapturedSnapshots,
    scriptExecutionVersion,
    addScriptLog,
    customMeshModel,
    simulationState,
    visualizationMode,
    particleDensity,
    debugMode,
    telemetry,
    project,
    flowFieldAvailable,
    toggleFlowFieldSolver,
    openProjectLauncher,
    loadRealBerkeliumStudioProject
  } = useStudioStore();

  // Internal viewport telemetry HUD
  const [fps, setFps] = useState(60);
  const [triangles, setTriangles] = useState(0);
  const [camCoords, setCamCoords] = useState({ x: 0, y: 0, z: 0 });
  const [hoveredPin, setHoveredPin] = useState(null);
  const [projectedPins, setProjectedPins] = useState([]);
  const [probeTooltip, setProbeTooltip] = useState(null);

  // Three.js instances ref
  const threeRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    transformControls: null,
    carGroup: null,
    customMeshInstance: null,
    tunnelGroup: null,
    streamlinesMesh: null,
    streamlineData: null,
    gridHelper: null,
    animFrameId: null,
    lastTime: 0,
    frameCount: 0
  });

  // 1. Initialize Viewport Three.js Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // SCENE
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x18181b); // Blender viewport dark graphite
    scene.fog = new THREE.FogExp2(0x18181b, 0.025);

    // CAMERA
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 150);
    camera.position.set(3.8, 2.2, 4.2);

    // RENDERER
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true // Required for snapshot captures
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    // CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0.4, 0);
    controls.maxPolarAngle = Math.PI / 2 + 0.02; // prevent going below ground
    controls.minDistance = 1.0;
    controls.maxDistance = 35.0;

    // TRANSFORM CONTROLS (for move, rotate, scale tools)
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.size = 0.75;
    transformControls.addEventListener('dragging-changed', (event) => {
      controls.enabled = !event.value;
    });
    scene.add(transformControls.getHelper());

    // STUDIO LIGHTING
    const lightGroup = new THREE.Group();
    lightGroup.name = 'Lighting';

    // Key Light (warm high-angle key)
    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 25;
    keyLight.shadow.camera.left = -4;
    keyLight.shadow.camera.right = 4;
    keyLight.shadow.camera.top = 4;
    keyLight.shadow.camera.bottom = -4;
    keyLight.shadow.bias = -0.0005;
    lightGroup.add(keyLight);

    // Fill Light (cool soft fill)
    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.9);
    fillLight.position.set(-6, 4, -3);
    lightGroup.add(fillLight);

    // Rim Light (back-edge highlight)
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    rimLight.position.set(0, 5, -6);
    lightGroup.add(rimLight);

    // Ambient / Environment light
    const ambientLight = new THREE.AmbientLight(0x27272a, 0.85);
    lightGroup.add(ambientLight);

    // Ground bounce
    const groundBounce = new THREE.HemisphereLight(0x38bdf8, 0x18181b, 0.6);
    lightGroup.add(groundBounce);

    scene.add(lightGroup);

    // BLENDER GRID FLOOR
    const gridHelper = new THREE.GridHelper(24, 48, 0xf97316, 0x27272a);
    gridHelper.position.y = 0.001;
    scene.add(gridHelper);

    // Axes helper (Blender style)
    const axesHelper = new THREE.AxesHelper(1.2);
    axesHelper.position.set(0, 0.002, 0);
    scene.add(axesHelper);

    // WIND TUNNEL CHAMBER
    const tunnelGroup = new THREE.Group();
    tunnelGroup.name = 'WindTunnel';

    // Transparent wind tunnel aerodynamic test section walls
    const tunnelWidth = 5.2;
    const tunnelHeight = 3.2;
    const tunnelLength = 11.0;

    const chamberGeo = new THREE.BoxGeometry(tunnelWidth, tunnelHeight, tunnelLength);
    const chamberMat = new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      transmission: 0.96,
      opacity: 0.08,
      transparent: true,
      roughness: 0.1,
      metalness: 0.1,
      side: THREE.BackSide,
      depthWrite: false
    });
    const chamberMesh = new THREE.Mesh(chamberGeo, chamberMat);
    chamberMesh.position.set(0, tunnelHeight / 2, 0);
    tunnelGroup.add(chamberMesh);

    // Aerodynamic tunnel frame trusses / edges
    const chamberEdges = new THREE.EdgesGeometry(chamberGeo);
    const chamberLines = new THREE.LineSegments(
      chamberEdges,
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.25 })
    );
    chamberLines.position.set(0, tunnelHeight / 2, 0);
    tunnelGroup.add(chamberLines);

    // Aerodynamic Flow Contraction Nozzle (Inlet at +Z)
    const inletRingGeo = new THREE.RingGeometry(1.6, 2.2, 32);
    const inletRingMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35
    });
    const inletRing = new THREE.Mesh(inletRingGeo, inletRingMat);
    inletRing.position.set(0, 1.2, 5.48);
    tunnelGroup.add(inletRing);

    // Diffuser Exhaust (Outlet at -Z)
    const outletRing = inletRing.clone();
    outletRing.position.z = -5.48;
    outletRing.material = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25
    });
    tunnelGroup.add(outletRing);

    scene.add(tunnelGroup);

    // PROCEDURAL CAR (Performance SUV)
    const carGroup = buildProceduralCar(carParams, shadingMode);
    scene.add(carGroup);

    // DEBUG OVERLAY WIREFRAME GROUP (Inlet/Outlet, Obstacle Envelope, Wake Volume)
    const debugGroup = new THREE.Group();
    debugGroup.name = 'DebugOverlayGroup';

    // 1. Upstream Inlet Plane wireframe (Z = +5.4m)
    const inletPlaneGeo = new THREE.PlaneGeometry(3.6, 2.6);
    const inletPlaneMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      wireframe: true,
      transparent: true,
      opacity: 0.6
    });
    const inletPlaneMesh = new THREE.Mesh(inletPlaneGeo, inletPlaneMat);
    inletPlaneMesh.position.set(0, 1.3, 5.4);
    debugGroup.add(inletPlaneMesh);

    // 2. Downstream Outlet Plane wireframe (Z = -5.3m)
    const outletPlaneGeo = new THREE.PlaneGeometry(3.6, 2.6);
    const outletPlaneMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      wireframe: true,
      transparent: true,
      opacity: 0.6
    });
    const outletPlaneMesh = new THREE.Mesh(outletPlaneGeo, outletPlaneMat);
    outletPlaneMesh.position.set(0, 1.3, -5.3);
    debugGroup.add(outletPlaneMesh);

    // 3. Vehicle Solid Obstacle Bounding Volume
    const carBoundsGeo = new THREE.BoxGeometry(2.05, 1.70, 4.8);
    const carBoundsMat = new THREE.MeshBasicMaterial({
      color: 0xeab308,
      wireframe: true,
      transparent: true,
      opacity: 0.65
    });
    const carBoundsMesh = new THREE.Mesh(carBoundsGeo, carBoundsMat);
    carBoundsMesh.position.set(0, 0.95, 0.0);
    debugGroup.add(carBoundsMesh);

    // 4. Bluff-Body Wake Recirculation Envelope
    const wakeGeo = new THREE.BoxGeometry(2.2, 1.75, 2.8);
    const wakeMat = new THREE.MeshBasicMaterial({
      color: 0xec4899,
      wireframe: true,
      transparent: true,
      opacity: 0.5
    });
    const wakeMesh = new THREE.Mesh(wakeGeo, wakeMat);
    wakeMesh.position.set(0, 0.95, -3.8);
    debugGroup.add(wakeMesh);

    debugGroup.visible = false;
    scene.add(debugGroup);

    // STREAMLINE PARTICLE SYSTEM (RK4 Numerical Integration Engine)
    const maxParticles = 12000;
    const streamGeo = new THREE.BufferGeometry();
    const streamPositions = new Float32Array(maxParticles * 3);
    const streamColors = new Float32Array(maxParticles * 3);
    const particles = [];

    // Circular particle sprite texture
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.25)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    const particleTexture = new THREE.CanvasTexture(canvas);

    for (let i = 0; i < maxParticles; i++) {
      // Wind tunnel nozzle rake inlet plane
      const seedX = (Math.random() - 0.5) * 2.8;
      const seedY = 0.04 + Math.random() * 2.2;
      const seedZ = 5.2 + Math.random() * 0.4;
      const maxLife = 3.2 + Math.random() * 1.8;
      const initAge = Math.random() * maxLife;

      const pPos = new THREE.Vector3(seedX, seedY, seedZ);

      // Pre-integrate forward so wind tunnel is immediately full of continuous streamlines
      const initSteps = Math.floor(initAge / 0.035);
      for (let s = 0; s < initSteps; s++) {
        const next = rk4Integrate(pPos, 0.035, carParams, windTunnelParams, null);
        pPos.copy(next);
        if (pPos.z <= -5.3) {
          pPos.set(seedX, seedY, 5.4 + Math.random() * 0.3);
        }
      }

      particles.push({
        pos: pPos,
        seedX,
        seedY,
        age: initAge,
        maxLife
      });

      streamPositions[i * 3] = pPos.x;
      streamPositions[i * 3 + 1] = pPos.y;
      streamPositions[i * 3 + 2] = pPos.z;

      streamColors[i * 3] = 0.05;
      streamColors[i * 3 + 1] = 0.80;
      streamColors[i * 3 + 2] = 0.85;
    }

    streamGeo.setAttribute('position', new THREE.BufferAttribute(streamPositions, 3));
    streamGeo.setAttribute('color', new THREE.BufferAttribute(streamColors, 3));
    streamGeo.setDrawRange(0, 3000); // initial default density

    const streamMat = new THREE.PointsMaterial({
      size: 0.048,
      map: particleTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const streamlinesMesh = new THREE.Points(streamGeo, streamMat);
    scene.add(streamlinesMesh);

    // STORE IN REF
    threeRef.current = {
      scene,
      camera,
      renderer,
      controls,
      transformControls,
      carGroup,
      tunnelGroup,
      debugGroup,
      streamlinesMesh,
      streamlineData: { positions: streamPositions, colors: streamColors, particles, geo: streamGeo },
      gridHelper,
      animFrameId: null,
      lastTime: performance.now(),
      frameCount: 0
    };

    // Calculate initial triangle count
    let triCount = 0;
    scene.traverse((obj) => {
      if (obj.isMesh && obj.geometry) {
        if (obj.geometry.index) {
          triCount += obj.geometry.index.count / 3;
        } else if (obj.geometry.attributes.position) {
          triCount += obj.geometry.attributes.position.count / 3;
        }
      }
    });
    setTriangles(Math.round(triCount));

    // Handle Resize
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // ANIMATION RENDER LOOP
    let lastFpsUpdate = performance.now();
    let frames = 0;
    let lastTimeMark = performance.now();

    const animate = (currentTime) => {
      threeRef.current.animFrameId = requestAnimationFrame(animate);

      frames++;
      if (currentTime - lastFpsUpdate >= 500) {
        setFps(Math.round((frames * 1000) / (currentTime - lastFpsUpdate)));
        frames = 0;
        lastFpsUpdate = currentTime;

        // Update camera position HUD
        setCamCoords({
          x: camera.position.x.toFixed(2),
          y: camera.position.y.toFixed(2),
          z: camera.position.z.toFixed(2)
        });

        // Update triangle count dynamically in HUD
        let triCount = 0;
        scene.traverse((obj) => {
          if (obj.isMesh && obj.visible && obj.geometry) {
            if (obj.geometry.index) {
              triCount += obj.geometry.index.count / 3;
            } else if (obj.geometry.attributes.position) {
              triCount += obj.geometry.attributes.position.count / 3;
            }
          }
        });
        setTriangles(Math.round(triCount));
      }

      controls.update();

      // UPDATE STREAMLINES VIA RK4 INTEGRATION
      const storeState = useStudioStore.getState();
      const currentWind = storeState.windTunnelParams;
      const currentCar = storeState.carParams;
      const currentCompStates = storeState.telemetry?.componentStates || deriveComponentStates(currentCar, currentWind);
      const isProjectValid = storeState.project?.valid === true;
      const isNoProject = storeState.simulationState === 'NO_PROJECT';
      const isFlowFieldAvailable = storeState.flowFieldAvailable === true;
      const isRunning = storeState.simulationState === 'RUNNING';
      const vizMode = storeState.visualizationMode || 'Velocity';
      const density = storeState.particleDensity || 3000;
      const activeCount = Math.min(maxParticles, density);

      // Hide or show car assembly and tunnel depending on project validity
      if (carGroup) {
        carGroup.visible = isProjectValid && !isNoProject && sceneVisibility.carAssembly !== false;
      }
      if (tunnelGroup) {
        tunnelGroup.visible = isProjectValid && !isNoProject && sceneVisibility.windTunnel !== false;
      }

      const deltaSec = isRunning ? Math.min(0.035, (currentTime - lastTimeMark) / 1000) : 0;
      lastTimeMark = currentTime;

      // Particle system strictly gated:
      // NEVER run unless project.valid === true && simulation.running === true && flowField.available === true
      if (!isProjectValid || isNoProject || !isFlowFieldAvailable || !currentWind.enabled) {
        if (streamlinesMesh) {
          streamlinesMesh.visible = false;
          streamGeo.setDrawRange(0, 0);
        }
      } else if (streamlinesMesh) {
        streamlinesMesh.visible = sceneVisibility.streamlines !== false;
        streamGeo.setDrawRange(0, activeCount);

        const positions = threeRef.current.streamlineData.positions;
        const colors = threeRef.current.streamlineData.colors;
        const pList = threeRef.current.streamlineData.particles;
        const vInf = Math.max(1.0, currentWind.windSpeed || 45.0);

        for (let i = 0; i < activeCount; i++) {
          const p = pList[i];

          if (isRunning && deltaSec > 0) {
            p.age += deltaSec;
            // 4th-Order Runge-Kutta numerical integration
            const nextPos = rk4Integrate(p.pos, deltaSec, currentCar, currentWind, currentCompStates);
            p.pos.copy(nextPos);

            // Recycle at outlet boundary, floor, or lifetime expiry
            if (p.pos.z <= -5.3 || p.pos.y <= 0.025 || p.age >= p.maxLife) {
              p.age = 0;
              p.pos.set(p.seedX, p.seedY, 5.4 + Math.random() * 0.3);
            }
          }

          // Solid collision boundary safety
          if (isPointInsideVehicle(p.pos, currentCar)) {
            projectOutOfSolid(p.pos, currentCar);
          }

          positions[i * 3] = p.pos.x;
          positions[i * 3 + 1] = p.pos.y;
          positions[i * 3 + 2] = p.pos.z;

          // Color calculation based on selected visualization mode
          const vel = getVelocityField(p.pos, currentCar, currentWind, currentCompStates);
          const speed = vel.length();
          const speedRatio = speed / vInf;

          let r = 0.1, g = 0.8, b = 0.9;

          if (vizMode === 'Velocity') {
            if (speedRatio < 0.65) {
              // Stagnation / deceleration: Deep blue
              r = 0.08; g = 0.35; b = 0.95;
            } else if (speedRatio < 0.95) {
              // Sub-freestream: Cyan
              r = 0.05; g = 0.80; b = 0.85;
            } else if (speedRatio < 1.15) {
              // Freestream: Emerald green
              r = 0.15; g = 0.85; b = 0.30;
            } else if (speedRatio < 1.35) {
              // Accelerated flow over roof/hood: Yellow
              r = 0.95; g = 0.80; b = 0.10;
            } else {
              // Suction acceleration peak: Red
              r = 0.95; g = 0.20; b = 0.10;
            }
          } else if (vizMode === 'Pressure') {
            // Cp = 1 - (V/V_inf)^2
            const cp = 1.0 - speedRatio * speedRatio;
            if (cp > 0.35) {
              // High stagnation pressure
              r = 0.92; g = 0.18; b = 0.10;
            } else if (cp > 0.0) {
              // Moderate positive pressure
              r = 0.95; g = 0.75; b = 0.10;
            } else if (cp > -0.6) {
              // Attached negative pressure
              r = 0.10; g = 0.85; b = 0.40;
            } else {
              // High suction
              r = 0.08; g = 0.35; b = 0.95;
            }
          } else if (vizMode === 'Streamlines') {
            // Pure aerodynamic streamline electric teal
            r = 0.05; g = 0.92; b = 0.88;
          } else if (vizMode === 'Separation') {
            // Separation mode: Highlight detached flow in bright warning red
            const isSeparatedWake = p.pos.z < -2.35 && vel.z > -vInf * 0.4;
            const isWingSeparated = currentCompStates.rearWing === 'STALLED' && p.pos.z < -1.8 && p.pos.z > -3.5 && p.pos.y > 1.2 && p.pos.y < 1.9;
            const isDiffuserSeparated = currentCompStates.diffuser === 'SEPARATED' && p.pos.z < -1.7 && p.pos.z > -3.2 && p.pos.y < 0.55;

            if (isSeparatedWake || isWingSeparated || isDiffuserSeparated) {
              r = 0.98; g = 0.15; b = 0.15; // Warning red
            } else {
              r = 0.20; g = 0.55; b = 0.70; // Neutral slate
            }
          } else if (vizMode === 'Surface') {
            // Subtle dimmed tracers to focus on car body
            r = 0.25; g = 0.45; b = 0.65;
          } else if (vizMode === 'Combined') {
            // Combined: Velocity color + highlight separation wake in red
            if (p.pos.z < -2.35 && vel.z > -vInf * 0.3) {
              r = 0.95; g = 0.18; b = 0.18;
            } else if (speedRatio < 0.7) {
              r = 0.08; g = 0.35; b = 0.95;
            } else if (speedRatio < 1.15) {
              r = 0.15; g = 0.85; b = 0.30;
            } else {
              r = 0.95; g = 0.75; b = 0.10;
            }
          }

          colors[i * 3] = r;
          colors[i * 3 + 1] = g;
          colors[i * 3 + 2] = b;
        }

        streamGeo.attributes.position.needsUpdate = true;
        streamGeo.attributes.color.needsUpdate = true;
      }

      // UPDATE DEFECT PIN PROJECTIONS ON SCREEN
      const defectPins = useStudioStore.getState().aiState.defectPins;
      if (defectPins && defectPins.length > 0 && containerRef.current) {
        const cWidth = containerRef.current.clientWidth;
        const cHeight = containerRef.current.clientHeight;
        const proj = defectPins.map((pin) => {
          const vec = new THREE.Vector3(...pin.position);
          vec.project(camera);
          const isBehind = vec.z > 1;
          const screenX = (vec.x * 0.5 + 0.5) * cWidth;
          const screenY = (-(vec.y * 0.5) + 0.5) * cHeight;
          return {
            ...pin,
            screenX,
            screenY,
            visible: !isBehind && screenX >= 0 && screenX <= cWidth && screenY >= 0 && screenY <= cHeight
          };
        });
        setProjectedPins(proj);
      } else {
        setProjectedPins([]);
      }

      renderer.render(scene, camera);
    };

    threeRef.current.animFrameId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (threeRef.current.animFrameId) {
        cancelAnimationFrame(threeRef.current.animFrameId);
      }
      controls.dispose();
      transformControls.dispose();
      if (threeRef.current.customMeshInstance && threeRef.current.scene) {
        threeRef.current.scene.remove(threeRef.current.customMeshInstance);
      }
      if (threeRef.current.carGroup) {
        disposeCarAssembly(threeRef.current.carGroup);
      }
      if (threeRef.current.streamlinesMesh) {
        threeRef.current.streamlinesMesh.geometry.dispose();
        threeRef.current.streamlinesMesh.material.dispose();
      }
      renderer.dispose();
    };
  }, []);

  // 2. Handle Camera View Angle Preset Switches
  useEffect(() => {
    const { camera, controls } = threeRef.current;
    if (!camera || !controls) return;

    if (cameraView === 'top') {
      camera.position.set(0, 7.5, 0.001);
      camera.up.set(0, 0, -1);
      controls.target.set(0, 0.3, 0);
    } else {
      camera.up.set(0, 1, 0);
      if (cameraView === 'side') {
        camera.position.set(-6.5, 0.6, 0);
        controls.target.set(0, 0.4, 0);
      } else if (cameraView === 'front') {
        camera.position.set(0, 0.65, 6.2);
        controls.target.set(0, 0.35, 0);
      } else if (cameraView === 'persp') {
        camera.position.set(3.8, 2.2, 4.2);
        controls.target.set(0, 0.4, 0);
      }
    }
    controls.update();
  }, [cameraView]);

  // 3. Handle Custom 3D Mesh Model Import (.obj, .stl, .gltf)
  useEffect(() => {
    const { scene, transformControls, carGroup } = threeRef.current;
    if (!scene) return;

    if (customMeshModel) {
      // Hide default procedural car assembly
      if (carGroup) {
        carGroup.visible = false;
      }

      // Remove existing custom mesh instance if it changed
      if (threeRef.current.customMeshInstance && threeRef.current.customMeshInstance !== customMeshModel) {
        scene.remove(threeRef.current.customMeshInstance);
      }

      scene.add(customMeshModel);
      threeRef.current.customMeshInstance = customMeshModel;

      // Attach transform controls if transform tool is active
      if (['translate', 'rotate', 'scale'].includes(activeTool) && transformControls) {
        transformControls.attach(customMeshModel);
      }
    } else {
      if (threeRef.current.customMeshInstance) {
        scene.remove(threeRef.current.customMeshInstance);
        threeRef.current.customMeshInstance = null;
      }
      if (carGroup) {
        carGroup.visible = sceneVisibility.carAssembly !== false;
      }
    }
  }, [customMeshModel, activeTool, sceneVisibility.carAssembly]);

  // 4. Handle Active Tool Mode in TransformControls
  useEffect(() => {
    const { transformControls, carGroup, customMeshInstance } = threeRef.current;
    if (!transformControls) return;

    const target = customMeshInstance || carGroup;
    if (['translate', 'rotate', 'scale'].includes(activeTool) && target) {
      transformControls.setMode(activeTool);
      transformControls.attach(target);
      transformControls.enabled = true;
    } else {
      transformControls.detach();
      transformControls.enabled = false;
    }
  }, [activeTool]);

  // 5. Update Car Geometry Dynamically when carParams, shadingMode, or componentStates Change
  useEffect(() => {
    const { carGroup, customMeshInstance } = threeRef.current;
    if (carGroup && !customMeshInstance) {
      const compStates = telemetry?.componentStates || deriveComponentStates(carParams, windTunnelParams);
      updateCarGeometry(carGroup, carParams, shadingMode, compStates);
    }
  }, [carParams, shadingMode, telemetry?.componentStates, windTunnelParams]);

  // Handle Debug Mode Wireframe Overlays
  useEffect(() => {
    if (threeRef.current.debugGroup) {
      threeRef.current.debugGroup.visible = debugMode;
    }
  }, [debugMode]);

  // Handle Particle Density changes
  useEffect(() => {
    if (threeRef.current.streamlinesMesh) {
      threeRef.current.streamlinesMesh.geometry.setDrawRange(0, Math.min(12000, particleDensity || 3000));
    }
  }, [particleDensity]);

  // 6. Update Visibility of Scene Objects
  useEffect(() => {
    const { scene, carGroup, customMeshInstance, tunnelGroup, streamlinesMesh } = threeRef.current;
    if (!scene) return;

    if (customMeshInstance) {
      customMeshInstance.visible = sceneVisibility.carAssembly !== false;
    }

    if (carGroup && !customMeshInstance) {
      carGroup.visible = sceneVisibility.carAssembly !== false;
      const front = carGroup.getObjectByName('Comp_Front') || carGroup.getObjectByName('FrontSplitter') || carGroup.getObjectByName('Splitter');
      if (front) front.visible = sceneVisibility.splitter !== false;
      const hood = carGroup.getObjectByName('Comp_Hood') || carGroup.getObjectByName('Chassis');
      if (hood) hood.visible = sceneVisibility.chassis !== false;
      const body = carGroup.getObjectByName('Comp_Body');
      if (body) body.visible = sceneVisibility.chassis !== false;
      const cockpit = carGroup.getObjectByName('Comp_Windshield') || carGroup.getObjectByName('Comp_Roof') || carGroup.getObjectByName('Cockpit');
      if (cockpit) cockpit.visible = sceneVisibility.cockpit !== false;
      const rearWing = carGroup.getObjectByName('Comp_RearWing') || carGroup.getObjectByName('RearWing');
      if (rearWing) rearWing.visible = sceneVisibility.rearWing !== false;
      const diffuser = carGroup.getObjectByName('Comp_Diffuser') || carGroup.getObjectByName('Diffuser');
      if (diffuser) diffuser.visible = sceneVisibility.diffuser !== false;
      const wheels = carGroup.getObjectByName('Comp_Wheels') || carGroup.getObjectByName('Wheels');
      if (wheels) wheels.visible = sceneVisibility.wheels !== false;
    }

    if (tunnelGroup) {
      tunnelGroup.visible = sceneVisibility.windTunnel !== false;
    }
    if (streamlinesMesh) {
      streamlinesMesh.visible = sceneVisibility.streamlines !== false;
    }
  }, [sceneVisibility]);

  // 6. Multi-angle Snapshot Capture Generator for Neural Auditor
  useEffect(() => {
    if (!snapshotTriggerTime) return;
    const { scene, camera, renderer, controls } = threeRef.current;
    if (!scene || !camera || !renderer || !controls) return;

    // Save current camera state
    const originalPos = camera.position.clone();
    const originalTarget = controls.target.clone();
    const originalUp = camera.up.clone();

    const angles = [
      { name: 'persp', pos: [3.8, 2.2, 4.2], target: [0, 0.4, 0], up: [0, 1, 0] },
      { name: 'top', pos: [0, 7.2, 0.001], target: [0, 0.3, 0], up: [0, 0, -1] },
      { name: 'side', pos: [-6.2, 0.6, 0], target: [0, 0.4, 0], up: [0, 1, 0] },
      { name: 'front', pos: [0, 0.6, 6.0], target: [0, 0.35, 0], up: [0, 1, 0] }
    ];

    const results = {};
    angles.forEach(({ name, pos, target, up }) => {
      camera.position.set(...pos);
      controls.target.set(...target);
      camera.up.set(...up);
      camera.lookAt(...target);
      camera.updateMatrixWorld();
      renderer.render(scene, camera);
      results[name] = renderer.domElement.toDataURL('image/png');
    });

    // Restore camera
    camera.position.copy(originalPos);
    camera.up.copy(originalUp);
    controls.target.copy(originalTarget);
    camera.lookAt(originalTarget);
    controls.update();
    renderer.render(scene, camera);

    setCapturedSnapshots(results);
    addScriptLog(`[Neural Auditor] Captured 4-angle visual snapshots (Persp, Top, Side, Front)`);
  }, [snapshotTriggerTime, setCapturedSnapshots, addScriptLog]);

  // 7. Monaco Procedural Script Dynamic Execution Engine
  useEffect(() => {
    if (scriptExecutionVersion === 0) return;
    const { scene, carGroup } = threeRef.current;
    const script = useStudioStore.getState().aiState.activeScript;
    if (!script || !scene || !carGroup) return;

    try {
      addScriptLog(`[Script Runner] Executing procedural Three.js script...`);
      // Dynamic evaluation with sandbox scope
      const scriptFunc = new Function('scene', 'carGroup', 'THREE', 'aeroParams', script);
      scriptFunc(scene, carGroup, THREE, carParams);
      addScriptLog(`[Script Runner] Execution successful: scene updated.`);
    } catch (err) {
      console.error('Procedural script execution error:', err);
      addScriptLog(`[Script Runner ERROR] ${err.message}`);
    }
  }, [scriptExecutionVersion]);

  // Handle Raycasting for Aero Pressure Probe Tool
  const handleCanvasClick = (e) => {
    if (activeTool !== 'probe') return;
    const { camera, carGroup, customMeshInstance } = threeRef.current;
    if (!camera || !containerRef.current) return;
    const targetGroup = customMeshInstance || carGroup;
    if (!targetGroup) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(targetGroup.children, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const point = hit.point;
      const normal = hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0);

      // Local pressure estimate
      const windSpeed = windTunnelParams.windSpeed;
      const q = 0.5 * windTunnelParams.airDensity * windSpeed * windSpeed;
      // Normal alignment with incoming flow (-Z direction, normal.z > 0 faces flow -> stagnation)
      const cp = normal.z + (point.y > 0.6 ? -0.4 : 0);
      const localPressure = (cp * q).toFixed(1);
      const localVelocity = Math.max(0, (windSpeed * Math.sqrt(Math.max(0, 1 - cp)))).toFixed(1);

      setProbeTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        part: hit.object.name || 'Bodywork',
        pressure: localPressure,
        velocity: localVelocity,
        coords: `(${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(2)})`
      });
    } else {
      setProbeTooltip(null);
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full overflow-hidden select-none bg-zinc-900"
      onClick={handleCanvasClick}
    >
      {/* Three.js Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />

      {/* Top Left Blender Viewport Stats HUD */}
      <div className="absolute top-3 left-3 pointer-events-none flex flex-col gap-1 text-[11px] font-mono text-zinc-300 bg-zinc-950/85 p-2.5 rounded border border-zinc-800/90 backdrop-blur-md shadow-2xl z-20">
        <div className="flex items-center justify-between gap-3 text-orange-400 font-semibold text-xs border-b border-zinc-800 pb-1.5">
          <div className="flex items-center gap-1.5">
            <Activity size={13} />
            <span>SUV AERO VIEWPORT 3D</span>
          </div>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
            simulationState === 'RUNNING' ? 'bg-emerald-950/90 text-emerald-400 border border-emerald-500/50' : 'bg-amber-950/90 text-amber-400 border border-amber-500/50'
          }`}>
            {simulationState}
          </span>
        </div>
        <div className="flex justify-between gap-4 mt-1">
          <span className="text-zinc-500">FPS:</span>
          <span className={fps > 45 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>{fps}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Triangles:</span>
          <span className="text-zinc-200">{triangles.toLocaleString()}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Cam Pos:</span>
          <span className="text-zinc-300">[{camCoords.x}, {camCoords.y}, {camCoords.z}]</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Inlet Wind Speed:</span>
          <span className="text-cyan-400 font-bold">{windTunnelParams.windSpeed} m/s</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Tracer Density:</span>
          <span className="text-zinc-300">{particleDensity || 3000} RK4 streamlines</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Viz Mode:</span>
          <span className="text-orange-400 font-bold">{visualizationMode}</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-zinc-800/80 pt-1 mt-0.5">
          <span className="text-zinc-500">Debug Overlays:</span>
          <span className={debugMode ? 'text-yellow-400 font-bold' : 'text-zinc-500'}>
            {debugMode ? 'ENABLED (Boundaries)' : 'DISABLED'}
          </span>
        </div>
      </div>

      {/* Active Component Aerodynamic Warnings Banner - STRICTLY driven by solver flow_separation flag */}
      {telemetry?.flow_separation && telemetry?.componentStates && (
        (telemetry.componentStates.rearWing === 'STALLED' ||
         telemetry.componentStates.diffuser === 'SEPARATED' ||
         telemetry.componentStates.underbody === 'SEPARATED') && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2.5 bg-red-950/95 border border-red-500/80 text-red-200 px-4 py-1.5 rounded-full shadow-2xl backdrop-blur-md text-xs font-mono font-semibold animate-pulse z-20">
            <AlertTriangle size={15} className="text-red-400 shrink-0" />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-red-300 font-bold">AERO STALL WARNING:</span>
              {telemetry.componentStates.rearWing === 'STALLED' && (
                <span className="bg-red-900/90 text-white px-2 py-0.5 rounded text-[11px] border border-red-500/60 font-bold">
                  REAR WING STALLED ({carParams.rearWingAOA?.toFixed(1)}° &gt; 14.5°)
                </span>
              )}
              {telemetry.componentStates.diffuser === 'SEPARATED' && (
                <span className="bg-red-900/90 text-white px-2 py-0.5 rounded text-[11px] border border-red-500/60 font-bold">
                  DIFFUSER SEPARATED ({carParams.diffuserAngle?.toFixed(1)}° &gt; 12.0°)
                </span>
              )}
              {telemetry.componentStates.underbody === 'SEPARATED' && (
                <span className="bg-red-900/90 text-white px-2 py-0.5 rounded text-[11px] border border-red-500/60 font-bold">
                  GROUND CHOKING ({(carParams.groundClearance * 100)?.toFixed(0)}cm &lt; 6cm)
                </span>
              )}
            </div>
          </div>
        )
      )}

      {/* Clean Empty Project UI Overlay when NO_PROJECT or invalid */}
      {(!project?.valid || simulationState === 'NO_PROJECT') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/95 z-40 p-6 text-center select-none backdrop-blur-md">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-4 shadow-2xl">
            <FolderX className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-100 mb-2 font-mono">
            NO SIMULATION PROJECT DETECTED
          </h2>
          <p className="text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
            The selected folder contains no recognized simulation project.<br />
            Select the actual Berkelium Studio project directory.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={openProjectLauncher}
              className="px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs transition-all shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              <FolderOpen size={15} />
              <span>Select Project Directory</span>
            </button>
            <button
              onClick={loadRealBerkeliumStudioProject}
              className="px-4 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Compass size={15} className="text-orange-400" />
              <span>Load Berkelium Studio Root (/Users/.../berkelium-web)</span>
            </button>
          </div>
        </div>
      )}

      {/* Flow Visualization Status Banner: Distinguishes Reduced-Order Model from 3D Flow Field */}
      {project?.valid && simulationState !== 'NO_PROJECT' && !flowFieldAvailable && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-zinc-950/90 border border-amber-500/70 text-amber-300 px-4 py-2 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono z-20">
          <AlertTriangle size={15} className="text-amber-400 shrink-0" />
          <div>
            <span className="font-bold">FLOW VISUALIZATION:</span> Velocity field unavailable
            <span className="text-zinc-400 ml-2">(Streamlines: Requires Flow Field Solver)</span>
          </div>
          <button
            onClick={toggleFlowFieldSolver}
            className="ml-2 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 font-sans text-xs font-semibold transition-colors cursor-pointer"
          >
            Connect 3D Flow Solver
          </button>
        </div>
      )}

      {project?.valid && simulationState !== 'NO_PROJECT' && flowFieldAvailable && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-zinc-950/90 border border-cyan-500/70 text-cyan-300 px-4 py-2 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono z-20">
          <Activity size={15} className="text-cyan-400 shrink-0" />
          <div>
            <span className="font-bold">3D Flow Field Visualizer:</span> Connected (RK4 Streamlines)
          </div>
          <button
            onClick={toggleFlowFieldSolver}
            className="ml-2 px-2.5 py-0.5 rounded bg-zinc-850 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-sans text-[11px] transition-colors cursor-pointer"
          >
            Disconnect
          </button>
        </div>
      )}

      {/* Top Right Blender ViewCube / Orientation Gizmo */}
      <div className="absolute top-3 right-3 flex items-center gap-1 bg-zinc-950/80 p-1 rounded-md border border-zinc-800 backdrop-blur-sm shadow-lg text-xs font-mono z-20">
        <button
          onClick={() => setCameraView('persp')}
          className={`px-2 py-1 rounded transition-all ${
            cameraView === 'persp' ? 'bg-orange-500 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title="Perspective View"
        >
          Persp
        </button>
        <button
          onClick={() => setCameraView('top')}
          className={`px-2 py-1 rounded transition-all ${
            cameraView === 'top' ? 'bg-orange-500 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title="Top Ortho View"
        >
          Top
        </button>
        <button
          onClick={() => setCameraView('side')}
          className={`px-2 py-1 rounded transition-all ${
            cameraView === 'side' ? 'bg-orange-500 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title="Side Ortho View"
        >
          Side
        </button>
        <button
          onClick={() => setCameraView('front')}
          className={`px-2 py-1 rounded transition-all ${
            cameraView === 'front' ? 'bg-orange-500 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title="Front Ortho View"
        >
          Front
        </button>
      </div>

      {/* Aerodynamic Colormap Legends */}
      {visualizationMode === 'Velocity' && (
        <div className="absolute bottom-4 left-3 bg-zinc-950/85 px-3 py-2 rounded border border-zinc-800 text-[10px] font-mono text-zinc-300 backdrop-blur-sm pointer-events-none z-20">
          <div className="font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Airflow Velocity Field |V| / V_inf
          </div>
          <div className="w-44 h-2 rounded-sm bg-gradient-to-r from-blue-600 via-cyan-400 via-green-500 via-yellow-400 to-red-500 mb-1" />
          <div className="flex justify-between text-zinc-400 font-bold">
            <span className="text-blue-400">&lt; 0.6 (Stag)</span>
            <span className="text-emerald-400">1.0 (V_inf)</span>
            <span className="text-red-400">&gt; 1.4 (Suction)</span>
          </div>
        </div>
      )}

      {visualizationMode === 'Separation' && (
        <div className="absolute bottom-4 left-3 bg-zinc-950/85 px-3 py-2 rounded border border-zinc-800 text-[10px] font-mono text-zinc-300 backdrop-blur-sm pointer-events-none z-20">
          <div className="font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Boundary Layer Separation
          </div>
          <div className="flex items-center gap-4 mt-1">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-sm bg-cyan-700" />
              <span className="text-cyan-300">Attached Flow</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-sm bg-red-500" />
              <span className="text-red-400 font-bold">Detached / Stall Wake</span>
            </div>
          </div>
        </div>
      )}

      {(visualizationMode === 'Pressure' || (visualizationMode === 'Surface' && shadingMode === 'aero_pressure')) && (
        <div className="absolute bottom-4 left-3 bg-zinc-950/85 px-3 py-2 rounded border border-zinc-800 text-[10px] font-mono text-zinc-300 backdrop-blur-sm pointer-events-none z-20">
          <div className="font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Surface Cp Pressure Coefficient
          </div>
          <div className="w-44 h-2 rounded-sm bg-gradient-to-r from-blue-600 via-green-500 to-red-500 mb-1" />
          <div className="flex justify-between text-zinc-400 font-bold">
            <span className="text-blue-400">-1.5 (Suction)</span>
            <span className="text-emerald-400">0.0 (Ambient)</span>
            <span className="text-red-400">+1.0 (Stagnation)</span>
          </div>
        </div>
      )}

      {/* 3D Interactive Defect Pins placed by Neural Auditor */}
      {sceneVisibility.auditPins !== false &&
        projectedPins.map(
          (pin) =>
            pin.visible && (
              <div
                key={pin.id}
                style={{
                  position: 'absolute',
                  left: `${pin.screenX}px`,
                  top: `${pin.screenY}px`,
                  transform: 'translate(-50%, -100%)'
                }}
                className="pointer-events-auto cursor-pointer group z-20"
                onMouseEnter={() => setHoveredPin(pin)}
                onMouseLeave={() => setHoveredPin(null)}
              >
                <div className="relative flex items-center justify-center">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg animate-bounce ${
                      pin.severity === 'critical' ? 'bg-red-500 ring-4 ring-red-500/30' : 'bg-amber-500 ring-4 ring-amber-500/30'
                    }`}
                  >
                    !
                  </span>
                  <div className="w-1.5 h-3 bg-zinc-700 mx-auto -mt-0.5 rounded-b" />
                </div>

                {/* Hover Tooltip in 3D Space */}
                {hoveredPin?.id === pin.id && (
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-8 w-60 p-2.5 bg-zinc-950/95 border border-red-500/60 rounded shadow-2xl backdrop-blur-md text-left z-30">
                    <div className="flex items-center gap-1.5 text-red-400 text-xs font-bold mb-1">
                      <AlertTriangle size={13} />
                      <span>{pin.title}</span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-snug">{pin.description}</p>
                    <div className="mt-1.5 pt-1 border-t border-zinc-800 text-[10px] text-zinc-500 font-mono">
                      Location: [{pin.position.join(', ')}]
                    </div>
                  </div>
                )}
              </div>
            )
        )}

      {/* Probe Tooltip popup */}
      {probeTooltip && (
        <div
          style={{
            position: 'absolute',
            left: `${probeTooltip.x + 12}px`,
            top: `${probeTooltip.y - 12}px`
          }}
          className="bg-zinc-950/95 border border-cyan-500/70 p-2.5 rounded shadow-2xl text-[11px] font-mono text-zinc-200 z-30 pointer-events-none"
        >
          <div className="text-cyan-400 font-bold mb-1 border-b border-zinc-800 pb-1">
            Probe: {probeTooltip.part}
          </div>
          <div>Pressure: <span className="text-white font-bold">{probeTooltip.pressure} Pa</span></div>
          <div>Velocity: <span className="text-amber-400 font-bold">{probeTooltip.velocity} m/s</span></div>
          <div className="text-[10px] text-zinc-500 mt-1">{probeTooltip.coords}</div>
        </div>
      )}
    </div>
  );
}
