import * as THREE from 'three';

/**
 * Creates custom aerodynamic pressure shader material or modifies existing standard material.
 * Colormap: Cool-to-Warm (Blue/Cyan = Suction/High speed, Green = Freestream, Orange/Red = Stagnation)
 */
export function createAeroMaterial(options = {}) {
  const {
    baseColor = 0x242831,
    roughness = 0.32,
    metalness = 0.70,
    wireframe = false,
    shadingMode = 'aero_pressure'
  } = options;

  if (shadingMode === 'audit_normals') {
    return new THREE.MeshNormalMaterial({ wireframe });
  }

  if (shadingMode === 'wireframe') {
    return new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true });
  }

  const mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness,
    metalness,
    wireframe: shadingMode === 'wireframe'
  });

  let initialModeVal = 1.0;
  if (shadingMode === 'solid') initialModeVal = 0.0;
  else if (shadingMode === 'audit_normals') initialModeVal = 2.0;

  mat.userData = {
    shadingMode: { value: initialModeVal },
    windSpeed: { value: 45.0 },
    flowDir: { value: new THREE.Vector3(0, 0, -1) }
  };

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uShadingMode = mat.userData.shadingMode;
    shader.uniforms.uWindSpeed = mat.userData.windSpeed;
    shader.uniforms.uFlowDir = mat.userData.flowDir;

    shader.vertexShader = `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      ${shader.vertexShader}
    `.replace(
      '#include <worldpos_vertex>',
      `
      #include <worldpos_vertex>
      vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      `
    );

    shader.fragmentShader = `
      uniform float uShadingMode;
      uniform float uWindSpeed;
      uniform vec3 uFlowDir;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      vec3 getAeroPressureColor(float cp) {
        float t = clamp((cp + 1.2) / 2.2, 0.0, 1.0);
        vec3 c0 = vec3(0.05, 0.22, 0.90);  // Suction blue
        vec3 c1 = vec3(0.0, 0.75, 0.95);   // Cyan
        vec3 c2 = vec3(0.1, 0.85, 0.25);   // Attached green
        vec3 c3 = vec3(0.98, 0.75, 0.05);  // Dynamic pressure yellow
        vec3 c4 = vec3(0.92, 0.15, 0.10);  // Stagnation red

        if (t < 0.25) return mix(c0, c1, t / 0.25);
        if (t < 0.50) return mix(c1, c2, (t - 0.25) / 0.25);
        if (t < 0.75) return mix(c2, c3, (t - 0.50) / 0.25);
        return mix(c3, c4, (t - 0.75) / 0.25);
      }

      ${shader.fragmentShader}
    `.replace(
      '#include <dithering_fragment>',
      `
      #include <dithering_fragment>
      if (uShadingMode > 1.5) {
        vec3 normalColor = normalize(vWorldNormal) * 0.5 + 0.5;
        gl_FragColor = vec4(normalColor, gl_FragColor.a);
      } else if (uShadingMode > 0.5) {
        float alignment = dot(vWorldNormal, normalize(-uFlowDir));
        float suctionFactor = 0.0;
        
        // Roof leading edge & hood cowl suction
        if (vWorldPos.y > 1.35 && vWorldNormal.y > 0.4) {
          suctionFactor = -0.55 * vWorldNormal.y;
        }
        // Rear wing underside suction
        if (vWorldPos.z < -1.35 && vWorldNormal.y < -0.3) {
          suctionFactor = -1.15;
        }

        float cp = alignment + suctionFactor;
        vec3 aeroColor = getAeroPressureColor(cp);
        gl_FragColor = vec4(mix(gl_FragColor.rgb, aeroColor * (0.8 + 0.3 * gl_FragColor.rgb), 0.88), gl_FragColor.a);
      }
      `
    );
  };

  return mat;
}

/**
 * Creates warning red material used when an aerodynamic component is STALLED or SEPARATED.
 */
function createStallWarningMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0x991b1b,
    emissiveIntensity: 0.65,
    roughness: 0.3,
    metalness: 0.4
  });
}

/**
 * Builds the complete 3D SUV CAD model with proper vehicle dimensions:
 * Length: ~4.8m | Width: ~1.98m | Height: ~1.65m
 * Components:
 * - Comp_Front (Splitter, air dam, radiator intake)
 * - Comp_Hood (Contoured hood with aero ridges)
 * - Comp_Windshield (Raked aerodynamic glass & A-pillars)
 * - Comp_Roof (High roofline with roof rails)
 * - Comp_Body (Cabin doors, side sills, wheel arches, greenhouse)
 * - Comp_RearHatch (Blunt/angled SUV fastback tailgate)
 * - Comp_RearWing (Roof spoiler with adjustable AoA and endplates)
 * - Comp_Underbody (Flat ground effect floor)
 * - Comp_Diffuser (Upswept rear diffuser ramp with strakes)
 * - Comp_Wheels (4 detailed SUV wheels with rims, tires, brakes)
 */
export function buildProceduralSUV(carParams = {}, shadingMode = 'aero_pressure') {
  const suvGroup = new THREE.Group();
  suvGroup.name = 'SUVAssembly';

  // Base materials
  const bodyMaterial = createAeroMaterial({ baseColor: 0x1e232a, roughness: 0.28, metalness: 0.80, shadingMode });
  const trimMaterial = createAeroMaterial({ baseColor: 0x0f1115, roughness: 0.50, metalness: 0.30, shadingMode });
  const carbonMaterial = createAeroMaterial({ baseColor: 0x14161a, roughness: 0.38, metalness: 0.60, shadingMode });
  
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x07111e,
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.85,
    thickness: 0.4,
    transparent: true,
    opacity: 0.82
  });

  const tireMaterial = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.88, metalness: 0.05 });
  const rimMaterial = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.18, metalness: 0.95 });
  const brakeMaterial = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3, metalness: 0.7 });

  const halfWidth = 0.98; // Total width = 1.96m
  const baseHeight = 1.62;

  // =========================================================
  // 1. FRONT SPLITTER & BUMPER INTAKE (Comp_Front)
  // =========================================================
  const frontGroup = new THREE.Group();
  frontGroup.name = 'Comp_Front';

  const splitterLength = carParams.splitterLength || 0.25;
  // Lower front aerodynamic splitter blade
  const splitterGeo = new THREE.BoxGeometry(1.92, 0.04, 0.65 + splitterLength);
  const splitterMesh = new THREE.Mesh(splitterGeo, carbonMaterial);
  splitterMesh.position.set(0, 0.18, 1.95 + splitterLength * 0.4);
  splitterMesh.castShadow = true;
  splitterMesh.name = 'FrontSplitter';
  frontGroup.add(splitterMesh);

  // Front bumper lower radiator intake air dam
  const damGeo = new THREE.BoxGeometry(1.84, 0.45, 0.75);
  const damMesh = new THREE.Mesh(damGeo, bodyMaterial);
  damMesh.position.set(0, 0.42, 1.90);
  damMesh.castShadow = true;
  damMesh.name = 'FrontAirDam';
  frontGroup.add(damMesh);

  // Grill texture / mesh
  const grillGeo = new THREE.BoxGeometry(1.45, 0.26, 0.04);
  const grillMesh = new THREE.Mesh(grillGeo, trimMaterial);
  grillMesh.position.set(0, 0.44, 2.28);
  grillMesh.name = 'FrontGrill';
  frontGroup.add(grillMesh);

  // Left & right dive canards
  const canardGeo = new THREE.BoxGeometry(0.24, 0.018, 0.26);
  canardGeo.rotateX(Math.PI / 10);
  canardGeo.rotateZ(Math.PI / 12);
  const leftCanard = new THREE.Mesh(canardGeo, carbonMaterial);
  leftCanard.position.set(-0.92, 0.38, 2.05);
  leftCanard.name = 'Canard_L';
  frontGroup.add(leftCanard);

  const rightCanard = leftCanard.clone();
  rightCanard.rotation.z = -Math.PI / 12;
  rightCanard.position.x = 0.92;
  rightCanard.name = 'Canard_R';
  frontGroup.add(rightCanard);

  suvGroup.add(frontGroup);

  // =========================================================
  // 2. SCULPTED SUV HOOD (Comp_Hood)
  // =========================================================
  const hoodGroup = new THREE.Group();
  hoodGroup.name = 'Comp_Hood';

  // Hood surface tapering forward
  const hoodGeo = new THREE.BoxGeometry(1.72, 0.14, 1.25, 4, 2, 6);
  const hoodPos = hoodGeo.attributes.position;
  for (let i = 0; i < hoodPos.count; i++) {
    const z = hoodPos.getZ(i);
    // Slope down towards front
    if (z > 0) {
      hoodPos.setY(i, hoodPos.getY(i) - (z / 0.62) * 0.12);
    }
  }
  hoodGeo.computeVertexNormals();

  const hoodMesh = new THREE.Mesh(hoodGeo, bodyMaterial);
  hoodMesh.position.set(0, 0.95, 1.25);
  hoodMesh.castShadow = true;
  hoodMesh.name = 'HoodSurface';
  hoodGroup.add(hoodMesh);

  // Hood power bulge / aero heat extractor ducts
  const extractorGeo = new THREE.BoxGeometry(0.35, 0.02, 0.45);
  const leftExtractor = new THREE.Mesh(extractorGeo, carbonMaterial);
  leftExtractor.position.set(-0.45, 1.02, 1.20);
  leftExtractor.name = 'HoodVent_L';
  hoodGroup.add(leftExtractor);

  const rightExtractor = leftExtractor.clone();
  rightExtractor.position.x = 0.45;
  rightExtractor.name = 'HoodVent_R';
  hoodGroup.add(rightExtractor);

  suvGroup.add(hoodGroup);

  // =========================================================
  // 3. RAKED SUV WINDSHIELD (Comp_Windshield)
  // =========================================================
  const windshieldGroup = new THREE.Group();
  windshieldGroup.name = 'Comp_Windshield';

  // Windshield glass inclined at ~34 deg
  const wsGeo = new THREE.BoxGeometry(1.58, 0.035, 0.95);
  wsGeo.rotateX(-Math.PI * 0.22); // raked angle
  const wsMesh = new THREE.Mesh(wsGeo, shadingMode === 'aero_pressure' ? bodyMaterial : glassMaterial);
  wsMesh.position.set(0, 1.34, 0.45);
  wsMesh.castShadow = true;
  wsMesh.name = 'WindshieldGlass';
  windshieldGroup.add(wsMesh);

  // A-Pillars
  const pillarGeo = new THREE.BoxGeometry(0.08, 0.08, 1.05);
  pillarGeo.rotateX(-Math.PI * 0.22);
  const leftPillar = new THREE.Mesh(pillarGeo, bodyMaterial);
  leftPillar.position.set(-0.80, 1.34, 0.45);
  leftPillar.name = 'APillar_L';
  windshieldGroup.add(leftPillar);

  const rightPillar = leftPillar.clone();
  rightPillar.position.x = 0.80;
  rightPillar.name = 'APillar_R';
  windshieldGroup.add(rightPillar);

  suvGroup.add(windshieldGroup);

  // =========================================================
  // 4. SUV ROOF & ROOF RAILS (Comp_Roof)
  // =========================================================
  const roofGroup = new THREE.Group();
  roofGroup.name = 'Comp_Roof';

  // High roofline panel
  const roofGeo = new THREE.BoxGeometry(1.56, 0.05, 1.85, 4, 1, 6);
  const roofMesh = new THREE.Mesh(roofGeo, bodyMaterial);
  roofMesh.position.set(0, baseHeight + 0.02, -0.65);
  roofMesh.castShadow = true;
  roofMesh.name = 'RoofPanel';
  roofGroup.add(roofMesh);

  // Aerodynamic flush roof rails
  const railGeo = new THREE.BoxGeometry(0.04, 0.045, 1.70);
  const leftRail = new THREE.Mesh(railGeo, trimMaterial);
  leftRail.position.set(-0.72, baseHeight + 0.065, -0.65);
  leftRail.name = 'RoofRail_L';
  roofGroup.add(leftRail);

  const rightRail = leftRail.clone();
  rightRail.position.x = 0.72;
  rightRail.name = 'RoofRail_R';
  roofGroup.add(rightRail);

  suvGroup.add(roofGroup);

  // =========================================================
  // 5. MAIN CABIN, DOORS & WHEEL ARCHES (Comp_Body)
  // =========================================================
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'Comp_Body';

  // Lower main tub (sills, doors, floor sides)
  const tubGeo = new THREE.BoxGeometry(1.92, 0.65, 3.85);
  const tubMesh = new THREE.Mesh(tubGeo, bodyMaterial);
  tubMesh.position.set(0, 0.62, -0.15);
  tubMesh.castShadow = true;
  tubMesh.name = 'MainBodyTub';
  bodyGroup.add(tubMesh);

  // Upper greenhouse cabin sides
  const cabinGeo = new THREE.BoxGeometry(1.60, 0.52, 2.05);
  const cabinMesh = new THREE.Mesh(cabinGeo, bodyMaterial);
  cabinMesh.position.set(0, 1.25, -0.65);
  cabinMesh.castShadow = true;
  cabinMesh.name = 'UpperCabin';
  bodyGroup.add(cabinMesh);

  // Side windows (glass)
  const sideWindowGeo = new THREE.BoxGeometry(1.64, 0.38, 1.95);
  const sideWindowMesh = new THREE.Mesh(sideWindowGeo, shadingMode === 'aero_pressure' ? bodyMaterial : glassMaterial);
  sideWindowMesh.position.set(0, 1.26, -0.65);
  sideWindowMesh.name = 'SideWindows';
  bodyGroup.add(sideWindowMesh);

  // 4 Flared wheel arches with protective trim
  const archGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.08, 18, 1, false, 0, Math.PI);
  archGeo.rotateZ(Math.PI / 2);

  [
    { name: 'WheelArch_FL', x: -halfWidth - 0.02, y: 0.46, z: 1.40 },
    { name: 'WheelArch_FR', x: halfWidth + 0.02, y: 0.46, z: 1.40 },
    { name: 'WheelArch_RL', x: -halfWidth - 0.02, y: 0.46, z: -1.45 },
    { name: 'WheelArch_RR', x: halfWidth + 0.02, y: 0.46, z: -1.45 }
  ].forEach((arch) => {
    const archMesh = new THREE.Mesh(archGeo, trimMaterial);
    archMesh.position.set(arch.x, arch.y, arch.z);
    archMesh.name = arch.name;
    bodyGroup.add(archMesh);
  });

  // Aerodynamic side mirrors
  const mirrorGeo = new THREE.BoxGeometry(0.24, 0.12, 0.15);
  const leftMirror = new THREE.Mesh(mirrorGeo, carbonMaterial);
  leftMirror.position.set(-1.08, 1.15, 0.65);
  leftMirror.name = 'SideMirror_L';
  bodyGroup.add(leftMirror);

  const rightMirror = leftMirror.clone();
  rightMirror.position.x = 1.08;
  rightMirror.name = 'SideMirror_R';
  bodyGroup.add(rightMirror);

  suvGroup.add(bodyGroup);

  // =========================================================
  // 6. BLUNT / ANGLED SUV REAR HATCH (Comp_RearHatch)
  // =========================================================
  const hatchGroup = new THREE.Group();
  hatchGroup.name = 'Comp_RearHatch';

  // Fastback liftgate sloping from roof down to rear bumper
  const hatchGeo = new THREE.BoxGeometry(1.58, 0.05, 1.15);
  hatchGeo.rotateX(Math.PI * 0.28); // SUV hatch slope
  const hatchMesh = new THREE.Mesh(hatchGeo, bodyMaterial);
  hatchMesh.position.set(0, 1.25, -1.82);
  hatchMesh.castShadow = true;
  hatchMesh.name = 'RearHatchDoor';
  hatchGroup.add(hatchMesh);

  // Rear windshield glass
  const rearGlassGeo = new THREE.BoxGeometry(1.42, 0.04, 0.65);
  rearGlassGeo.rotateX(Math.PI * 0.28);
  const rearGlass = new THREE.Mesh(rearGlassGeo, shadingMode === 'aero_pressure' ? bodyMaterial : glassMaterial);
  rearGlass.position.set(0, 1.38, -1.72);
  rearGlass.name = 'RearGlass';
  hatchGroup.add(rearGlass);

  // Rear bumper bluff body block
  const rearBumperGeo = new THREE.BoxGeometry(1.90, 0.45, 0.45);
  const rearBumper = new THREE.Mesh(rearBumperGeo, bodyMaterial);
  rearBumper.position.set(0, 0.46, -2.15);
  rearBumper.castShadow = true;
  rearBumper.name = 'RearBumper';
  hatchGroup.add(rearBumper);

  suvGroup.add(hatchGroup);

  // =========================================================
  // 7. ROOF-MOUNTED REAR WING / SPOILER (Comp_RearWing)
  // =========================================================
  const rearWingGroup = new THREE.Group();
  rearWingGroup.name = 'Comp_RearWing';

  const wingSpan = carParams.rearWingSpan || 1.65;
  const wingAOA = carParams.rearWingAOA || 11.5;

  // Main airfoil wing element
  const mainWingGeo = new THREE.BoxGeometry(wingSpan, 0.038, 0.38);
  // Shape camber
  const wingPos = mainWingGeo.attributes.position;
  for (let i = 0; i < wingPos.count; i++) {
    const z = wingPos.getZ(i);
    if (z > 0.05) {
      wingPos.setY(i, wingPos.getY(i) - 0.016);
    }
  }
  mainWingGeo.computeVertexNormals();

  const mainWing = new THREE.Mesh(mainWingGeo, carbonMaterial);
  mainWing.position.set(0, baseHeight + 0.08, -1.68);
  mainWing.rotation.x = (wingAOA * Math.PI) / 180;
  mainWing.castShadow = true;
  mainWing.name = 'MainWingElement';
  rearWingGroup.add(mainWing);

  // Secondary high-downforce Gurney flap
  const flapGeo = new THREE.BoxGeometry(wingSpan * 0.96, 0.022, 0.14);
  const flapMesh = new THREE.Mesh(flapGeo, carbonMaterial);
  flapMesh.position.set(0, baseHeight + 0.12, -1.82);
  flapMesh.rotation.x = ((wingAOA + 4.0) * Math.PI) / 180;
  flapMesh.castShadow = true;
  flapMesh.name = 'SecondaryWingFlap';
  rearWingGroup.add(flapMesh);

  // Endplates
  const endplateGeo = new THREE.BoxGeometry(0.025, 0.32, 0.52);
  const leftEndplate = new THREE.Mesh(endplateGeo, carbonMaterial);
  leftEndplate.position.set(-wingSpan * 0.5, baseHeight + 0.08, -1.70);
  leftEndplate.name = 'WingEndplate_L';
  rearWingGroup.add(leftEndplate);

  const rightEndplate = leftEndplate.clone();
  rightEndplate.position.x = wingSpan * 0.5;
  rightEndplate.name = 'WingEndplate_R';
  rearWingGroup.add(rightEndplate);

  // Stanchions / pylons
  const pylonGeo = new THREE.BoxGeometry(0.03, 0.22, 0.10);
  const leftPylon = new THREE.Mesh(pylonGeo, carbonMaterial);
  leftPylon.position.set(-0.45, baseHeight + 0.02, -1.60);
  leftPylon.name = 'WingPylon_L';
  rearWingGroup.add(leftPylon);

  const rightPylon = leftPylon.clone();
  rightPylon.position.x = 0.45;
  rightPylon.name = 'WingPylon_R';
  rearWingGroup.add(rightPylon);

  suvGroup.add(rearWingGroup);

  // =========================================================
  // 8. UNDERBODY GROUND-EFFECT FLOOR (Comp_Underbody)
  // =========================================================
  const underbodyGroup = new THREE.Group();
  underbodyGroup.name = 'Comp_Underbody';

  const floorGeo = new THREE.BoxGeometry(1.82, 0.035, 3.65);
  const floorMesh = new THREE.Mesh(floorGeo, carbonMaterial);
  floorMesh.position.set(0, 0.18, 0.0);
  floorMesh.receiveShadow = true;
  floorMesh.name = 'UnderbodyFloor';
  underbodyGroup.add(floorMesh);

  suvGroup.add(underbodyGroup);

  // =========================================================
  // 9. VENTURI DIFFUSER & STRAKES (Comp_Diffuser)
  // =========================================================
  const diffuserGroup = new THREE.Group();
  diffuserGroup.name = 'Comp_Diffuser';

  const diffuserAngle = carParams.diffuserAngle || 9.0;
  // Upswept ramp
  const rampGeo = new THREE.BoxGeometry(1.68, 0.032, 0.95);
  const rampMesh = new THREE.Mesh(rampGeo, carbonMaterial);
  rampMesh.position.set(0, 0.22, -1.85);
  rampMesh.rotation.x = (diffuserAngle * Math.PI) / 180;
  rampMesh.name = 'DiffuserRamp';
  diffuserGroup.add(rampMesh);

  // 4 Channeling strakes
  [-0.55, -0.18, 0.18, 0.55].forEach((xPos, idx) => {
    const strakeGeo = new THREE.BoxGeometry(0.02, 0.14, 0.92);
    const strake = new THREE.Mesh(strakeGeo, carbonMaterial);
    strake.position.set(xPos, 0.24, -1.85);
    strake.rotation.x = (diffuserAngle * Math.PI) / 180;
    strake.name = `DiffuserStrake_${idx + 1}`;
    diffuserGroup.add(strake);
  });

  suvGroup.add(diffuserGroup);

  // =========================================================
  // 10. FOUR SUV WHEELS (Comp_Wheels)
  // =========================================================
  const wheelsGroup = new THREE.Group();
  wheelsGroup.name = 'Comp_Wheels';

  const wheelPositions = [
    { name: 'Wheel_FL', pos: [-halfWidth, 0.38, 1.40] },
    { name: 'Wheel_FR', pos: [halfWidth, 0.38, 1.40] },
    { name: 'Wheel_RL', pos: [-halfWidth, 0.38, -1.45] },
    { name: 'Wheel_RR', pos: [halfWidth, 0.38, -1.45] }
  ];

  wheelPositions.forEach(({ name, pos }) => {
    const singleWheel = new THREE.Group();
    singleWheel.name = name;
    singleWheel.position.set(...pos);

    // Chunky SUV performance tire (Radius 0.38m, Width 0.28m)
    const tireGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 24);
    tireGeo.rotateZ(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, tireMaterial);
    tire.castShadow = true;
    tire.name = `${name}_Tire`;
    singleWheel.add(tire);

    // Alloy Rim
    const rimGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.285, 18);
    rimGeo.rotateZ(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, rimMaterial);
    rim.name = `${name}_Rim`;
    singleWheel.add(rim);

    // Brake Disc & Caliper
    const discGeo = new THREE.CylinderGeometry(0.20, 0.20, 0.04, 16);
    discGeo.rotateZ(Math.PI / 2);
    const disc = new THREE.Mesh(discGeo, carbonMaterial);
    disc.name = `${name}_Disc`;
    singleWheel.add(disc);

    const caliperGeo = new THREE.BoxGeometry(0.07, 0.12, 0.14);
    const caliper = new THREE.Mesh(caliperGeo, brakeMaterial);
    caliper.position.set(0, 0.14, 0.09);
    caliper.name = `${name}_Caliper`;
    singleWheel.add(caliper);

    wheelsGroup.add(singleWheel);
  });

  suvGroup.add(wheelsGroup);

  // Cache base materials for restoring when stall/separation clears
  suvGroup.userData = {
    baseBodyMaterial: bodyMaterial,
    baseCarbonMaterial: carbonMaterial,
    stallWarningMaterial: createStallWarningMaterial(),
    componentMeshes: {
      front: frontGroup,
      roof: roofGroup,
      underbody: underbodyGroup,
      diffuser: diffuserGroup,
      rearWing: rearWingGroup,
      body: bodyGroup,
      rearHatch: hatchGroup,
      wheels: wheelsGroup
    }
  };

  return suvGroup;
}

/**
 * Dynamically updates SUV geometry transforms, angles, and component highlight states.
 * When a component enters STALLED or SEPARATED state, highlights that exact component in red!
 */
export function updateSUVGeometry(suvGroup, carParams = {}, shadingMode = 'aero_pressure', componentStates = {}) {
  if (!suvGroup) return;

  const _baseHeight = 1.62;

  // 1. Update Rear Wing AOA & Span
  const mainWing = suvGroup.getObjectByName('MainWingElement');
  const secondaryWing = suvGroup.getObjectByName('SecondaryWingFlap');
  if (mainWing && carParams.rearWingAOA !== undefined) {
    mainWing.rotation.x = (carParams.rearWingAOA * Math.PI) / 180;
  }
  if (secondaryWing && carParams.rearWingAOA !== undefined) {
    secondaryWing.rotation.x = ((carParams.rearWingAOA + 4.0) * Math.PI) / 180;
  }
  if (carParams.rearWingSpan !== undefined) {
    const spanScale = carParams.rearWingSpan / 1.65;
    if (mainWing) mainWing.scale.x = spanScale;
    if (secondaryWing) secondaryWing.scale.x = spanScale;
    const leftEndplate = suvGroup.getObjectByName('WingEndplate_L');
    const rightEndplate = suvGroup.getObjectByName('WingEndplate_R');
    if (leftEndplate) leftEndplate.position.x = -carParams.rearWingSpan * 0.5;
    if (rightEndplate) rightEndplate.position.x = carParams.rearWingSpan * 0.5;
  }

  // 2. Update Front Splitter
  const splitter = suvGroup.getObjectByName('FrontSplitter');
  if (splitter && carParams.splitterLength !== undefined) {
    splitter.scale.z = 1.0 + (carParams.splitterLength - 0.25) * 1.5;
    splitter.position.z = 1.95 + carParams.splitterLength * 0.4;
  }

  // 3. Update Diffuser Ramp & Strakes Angle
  const diffuserRamp = suvGroup.getObjectByName('DiffuserRamp');
  if (diffuserRamp && carParams.diffuserAngle !== undefined) {
    diffuserRamp.rotation.x = (carParams.diffuserAngle * Math.PI) / 180;
  }
  for (let i = 1; i <= 4; i++) {
    const strake = suvGroup.getObjectByName(`DiffuserStrake_${i}`);
    if (strake && carParams.diffuserAngle !== undefined) {
      strake.rotation.x = (carParams.diffuserAngle * Math.PI) / 180;
    }
  }

  // 4. Update Ground Clearance
  if (carParams.groundClearance !== undefined) {
    // Elevate SUV chassis group based on ground clearance relative to 0.18m baseline
    suvGroup.position.y = carParams.groundClearance - 0.18;
  }

  // 5. Update Shading Mode Uniforms
  let targetMode = 0.0;
  if (shadingMode === 'aero_pressure') targetMode = 1.0;
  else if (shadingMode === 'audit_normals') targetMode = 2.0;

  const warningMat = suvGroup.userData?.stallWarningMaterial || createStallWarningMaterial();
  const baseCarbon = suvGroup.userData?.baseCarbonMaterial;
  const _baseBody = suvGroup.userData?.baseBodyMaterial;

  suvGroup.traverse((child) => {
    if (child.isMesh && child.material) {
      if (child.material.userData?.shadingMode) {
        child.material.userData.shadingMode.value = targetMode;
      }
      child.material.wireframe = shadingMode === 'wireframe';
    }
  });

  // 6. Component-Level Real Warning Red Highlighting (Requirements 4, 5, 6, 22)
  const compMeshes = suvGroup.userData?.componentMeshes;
  if (compMeshes) {
    // A. Rear Wing Highlight (STALLED)
    const isWingStalled = componentStates?.rearWing === 'STALLED';
    compMeshes.rearWing.traverse((child) => {
      if (child.isMesh) {
        child.material = isWingStalled ? warningMat : baseCarbon;
      }
    });

    // B. Diffuser Highlight (SEPARATED)
    const isDiffuserSeparated = componentStates?.diffuser === 'SEPARATED';
    compMeshes.diffuser.traverse((child) => {
      if (child.isMesh) {
        child.material = isDiffuserSeparated ? warningMat : baseCarbon;
      }
    });

    // C. Underbody Highlight (SEPARATED ground choking)
    const isFloorSeparated = componentStates?.underbody === 'SEPARATED';
    compMeshes.underbody.traverse((child) => {
      if (child.isMesh) {
        child.material = isFloorSeparated ? warningMat : baseCarbon;
      }
    });

    // D. Front Splitter Highlight (SEPARATED)
    const isFrontSeparated = componentStates?.front === 'SEPARATED';
    const splitterBlade = suvGroup.getObjectByName('FrontSplitter');
    if (splitterBlade) {
      splitterBlade.material = isFrontSeparated ? warningMat : baseCarbon;
    }
  }
}

/**
 * Safely disposes car group geometries and materials to prevent WebGL memory leaks
 */
export function disposeCarAssembly(carGroup) {
  if (!carGroup) return;
  carGroup.traverse((child) => {
    if (child.isMesh) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  });
}

// Backward-compatible aliases for existing studio references
export const buildProceduralCar = buildProceduralSUV;
export const updateCarGeometry = updateSUVGeometry;
