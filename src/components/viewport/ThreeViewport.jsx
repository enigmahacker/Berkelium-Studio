import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { useStudioStore } from '../../store/useStudioStore';
import { buildProceduralCar, updateCarGeometry, disposeCarAssembly } from '../../services/proceduralCar';
import { 
  Activity, 
  AlertTriangle
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
    customMeshModel
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

    // PROCEDURAL CAR
    const carGroup = buildProceduralCar(carParams, shadingMode);
    scene.add(carGroup);

    // STREAMLINE PARTICLE SYSTEM
    const maxParticles = 3200;
    const streamGeo = new THREE.BufferGeometry();
    const streamPositions = new Float32Array(maxParticles * 3);
    const streamColors = new Float32Array(maxParticles * 3);
    const particleMetadata = []; // velocity, original offset, age, life

    const colorBlue = new THREE.Color(0x0ea5e9);
    const colorGreen = new THREE.Color(0x22c55e);
    const colorYellow = new THREE.Color(0xeab308);
    const colorRed = new THREE.Color(0xef4444);

    for (let i = 0; i < maxParticles; i++) {
      // Streamline rake spread (grid at nozzle inlet)
      const rakeX = (Math.random() - 0.5) * 2.8;
      const rakeY = 0.05 + Math.random() * 1.5;
      const rakeZ = 5.2 - Math.random() * 0.4;

      streamPositions[i * 3] = rakeX;
      streamPositions[i * 3 + 1] = rakeY;
      streamPositions[i * 3 + 2] = rakeZ;

      streamColors[i * 3] = colorBlue.r;
      streamColors[i * 3 + 1] = colorBlue.g;
      streamColors[i * 3 + 2] = colorBlue.b;

      particleMetadata.push({
        baseX: rakeX,
        baseY: rakeY,
        progress: Math.random() * 10.5,
        speedFactor: 0.85 + Math.random() * 0.3
      });
    }

    streamGeo.setAttribute('position', new THREE.BufferAttribute(streamPositions, 3));
    streamGeo.setAttribute('color', new THREE.BufferAttribute(streamColors, 3));

    const streamMat = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
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
      streamlinesMesh,
      streamlineData: { positions: streamPositions, colors: streamColors, metadata: particleMetadata, geo: streamGeo },
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

      // UPDATE STREAMLINES
      const currentWind = useStudioStore.getState().windTunnelParams;
      const currentCar = useStudioStore.getState().carParams;
      const isTunnelEnabled = currentWind.enabled;
      const windSpeed = currentWind.windSpeed;
      const turbulence = currentWind.turbulence || 0.05;

      if (streamlinesMesh && isTunnelEnabled) {
        streamlinesMesh.visible = sceneVisibility.streamlines !== false;
        const positions = threeRef.current.streamlineData.positions;
        const colors = threeRef.current.streamlineData.colors;
        const meta = threeRef.current.streamlineData.metadata;
        const step = (windSpeed * 0.016) / 2.2;

        for (let i = 0; i < maxParticles; i++) {
          const m = meta[i];
          m.progress += step * m.speedFactor;
          if (m.progress > 10.6) {
            m.progress = 0;
          }

          // Compute Z from progress (travel from +5.3 to -5.3)
          let currentZ = 5.3 - m.progress;
          let currentX = m.baseX;
          let currentY = m.baseY;

          // AERODYNAMIC DEFLECTION OVER CAR BODY
          // Car bounds approx: X [-1.0, 1.0], Y [0.08, 1.2], Z [-2.0, 2.2]

          // 1. Nose deflection (Z around 1.8 to 2.4)
          if (currentZ > 1.2 && currentZ < 2.5) {
            const noseDist = Math.hypot(currentX, currentY - 0.25);
            if (noseDist < 0.65) {
              const push = (0.65 - noseDist) * 0.6;
              currentX += Math.sign(currentX || 1) * push;
              currentY += push * 0.7;
            }
          }

          // 2. Cockpit canopy deflection (Z around -0.6 to 0.8)
          if (currentZ > -0.6 && currentZ < 0.8) {
            if (Math.abs(currentX) < 0.75 && currentY < 1.15) {
              const liftRatio = (1.15 - currentY) * 0.45;
              currentY += liftRatio;
            }
          }

          // 3. Rear Wing downwash deflection (Z around -1.2 to -2.0)
          if (currentZ < -1.1 && currentZ > -2.1 && Math.abs(currentX) < currentCar.rearWingSpan * 0.55) {
            const wingAOA = currentCar.rearWingAOA || 11.5;
            // Negative deflection downward
            const downwash = Math.sin((wingAOA * Math.PI) / 180) * 0.28;
            currentY -= downwash * ((-1.1 - currentZ) / 0.9);
          }

          // Turbulence jitter
          currentX += (Math.random() - 0.5) * turbulence * 0.04;
          currentY += (Math.random() - 0.5) * turbulence * 0.04;

          positions[i * 3] = currentX;
          positions[i * 3 + 1] = Math.max(0.04, currentY);
          positions[i * 3 + 2] = currentZ;

          // Color calculation based on local flow velocity
          // Acceleration over canopy and wing underside: yellow/red
          // Stagnation at nose: blue
          let localSpeed = 1.0;
          if (currentZ > 1.6 && currentZ < 2.2 && Math.abs(currentX) < 0.5) {
            localSpeed = 0.45; // Stagnation
          } else if (currentZ > -0.4 && currentZ < 0.6 && currentY > 0.8) {
            localSpeed = 1.45; // Canopy suction acceleration
          } else if (currentZ < -1.2 && currentZ > -1.8 && currentY > 0.85) {
            localSpeed = 1.35; // Wing flow
          }

          let pColor;
          if (localSpeed < 0.8) {
            pColor = colorBlue;
          } else if (localSpeed < 1.15) {
            pColor = colorGreen;
          } else if (localSpeed < 1.35) {
            pColor = colorYellow;
          } else {
            pColor = colorRed;
          }

          colors[i * 3] = pColor.r;
          colors[i * 3 + 1] = pColor.g;
          colors[i * 3 + 2] = pColor.b;
        }

        threeRef.current.streamlineData.geo.attributes.position.needsUpdate = true;
        threeRef.current.streamlineData.geo.attributes.color.needsUpdate = true;
      } else if (streamlinesMesh) {
        streamlinesMesh.visible = false;
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

  // 5. Update Car Geometry Dynamically when carParams or shadingMode Change
  useEffect(() => {
    const { carGroup, customMeshInstance } = threeRef.current;
    if (carGroup && !customMeshInstance) {
      updateCarGeometry(carGroup, carParams, shadingMode);
    }
  }, [carParams, shadingMode]);

  // 6. Update Visibility of Scene Objects
  useEffect(() => {
    const { scene, carGroup, customMeshInstance, tunnelGroup, streamlinesMesh } = threeRef.current;
    if (!scene) return;

    if (customMeshInstance) {
      customMeshInstance.visible = sceneVisibility.carAssembly !== false;
    }

    if (carGroup && !customMeshInstance) {
      carGroup.visible = sceneVisibility.carAssembly !== false;
      const chassis = carGroup.getObjectByName('Chassis');
      if (chassis) chassis.visible = sceneVisibility.chassis !== false;
      const splitter = carGroup.getObjectByName('Splitter');
      if (splitter) splitter.visible = sceneVisibility.splitter !== false;
      const cockpit = carGroup.getObjectByName('Cockpit');
      if (cockpit) cockpit.visible = sceneVisibility.cockpit !== false;
      const rearWing = carGroup.getObjectByName('RearWing');
      if (rearWing) rearWing.visible = sceneVisibility.rearWing !== false;
      const diffuser = carGroup.getObjectByName('Diffuser');
      if (diffuser) diffuser.visible = sceneVisibility.diffuser !== false;
      const wheels = carGroup.getObjectByName('Wheels');
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
      <div className="absolute top-3 left-3 pointer-events-none flex flex-col gap-1 text-[11px] font-mono text-zinc-300 bg-zinc-950/80 p-2.5 rounded border border-zinc-800/80 backdrop-blur-sm shadow-xl">
        <div className="flex items-center gap-2 text-orange-400 font-semibold text-xs border-b border-zinc-800 pb-1">
          <Activity size={13} />
          <span>BERKELIUM VIEWPORT 3D</span>
        </div>
        <div className="flex justify-between gap-4 mt-1">
          <span className="text-zinc-500">FPS:</span>
          <span className={fps > 45 ? 'text-emerald-400' : 'text-amber-400'}>{fps}</span>
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
          <span className="text-zinc-500">Air Velocity:</span>
          <span className="text-cyan-400 font-bold">{windTunnelParams.windSpeed} m/s</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Shading Mode:</span>
          <span className="text-orange-400 capitalize">{shadingMode.replace('_', ' ')}</span>
        </div>
      </div>

      {/* Top Right Blender ViewCube / Orientation Gizmo */}
      <div className="absolute top-3 right-3 flex items-center gap-1 bg-zinc-950/80 p-1 rounded-md border border-zinc-800 backdrop-blur-sm shadow-lg text-xs font-mono">
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

      {/* Aerodynamic Colormap Legend (visible in aero_pressure mode) */}
      {shadingMode === 'aero_pressure' && (
        <div className="absolute bottom-4 left-3 bg-zinc-950/85 px-3 py-2 rounded border border-zinc-800 text-[10px] font-mono text-zinc-300 backdrop-blur-sm pointer-events-none">
          <div className="font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Cp Surface Pressure
          </div>
          <div className="w-36 h-2 rounded-sm bg-gradient-to-r from-blue-600 via-green-500 to-red-500 mb-1" />
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
