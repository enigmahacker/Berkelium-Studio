import * as THREE from 'three';

/**
 * Creates custom aerodynamic pressure shader material or modifies existing standard material.
 * Colormap: Cool-to-Warm (Blue/Cyan = Suction/High speed, Green = Freestream, Orange/Red = Stagnation)
 */
export function createAeroMaterial(options = {}) {
  const {
    baseColor = 0x22262e,
    roughness = 0.35,
    metalness = 0.65,
    wireframe = false,
    shadingMode = 'aero_pressure'
  } = options;

  if (shadingMode === 'audit_normals') {
    return new THREE.MeshNormalMaterial({ wireframe });
  }

  if (shadingMode === 'wireframe') {
    return new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true });
  }

  // Create standard PBR material with custom aerodynamic pressure shader injection
  const mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness,
    metalness,
    wireframe: shadingMode === 'wireframe'
  });

  // Attach aerodynamic uniforms
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

    // Inject varying normal in world space (handles non-uniform scaling cleanly)
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

    // Inject scientific aerodynamic pressure gradient & normal auditor passes
    shader.fragmentShader = `
      uniform float uShadingMode;
      uniform float uWindSpeed;
      uniform vec3 uFlowDir;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      // Scientific colormap: Cool (blue) -> Cyan -> Green -> Yellow -> Warm (red)
      vec3 getAeroPressureColor(float cp) {
        // cp ranges from approx -1.5 (suction) to +1.0 (stagnation)
        float t = clamp((cp + 1.2) / 2.2, 0.0, 1.0);
        
        vec3 c0 = vec3(0.05, 0.2, 0.85);  // Deep suction blue
        vec3 c1 = vec3(0.0, 0.75, 0.95);  // Cyan
        vec3 c2 = vec3(0.1, 0.85, 0.25);  // Attached green
        vec3 c3 = vec3(0.98, 0.75, 0.05); // High dynamic pressure yellow
        vec3 c4 = vec3(0.92, 0.15, 0.1);  // Stagnation red

        if (t < 0.25) {
          return mix(c0, c1, t / 0.25);
        } else if (t < 0.5) {
          return mix(c1, c2, (t - 0.25) / 0.25);
        } else if (t < 0.75) {
          return mix(c2, c3, (t - 0.5) / 0.25);
        } else {
          return mix(c3, c4, (t - 0.75) / 0.25);
        }
      }

      ${shader.fragmentShader}
    `.replace(
      '#include <dithering_fragment>',
      `
      #include <dithering_fragment>
      if (uShadingMode > 1.5) {
        // Audit surface normal pass: maps normal [-1, 1] to RGB [0, 1]
        vec3 normalColor = normalize(vWorldNormal) * 0.5 + 0.5;
        gl_FragColor = vec4(normalColor, gl_FragColor.a);
      } else if (uShadingMode > 0.5) {
        // Calculate stagnation alignment: normal dot flow direction
        // Flow moves along -Z: dot(vWorldNormal, vec3(0,0,1))
        float alignment = dot(vWorldNormal, normalize(-uFlowDir));
        
        // Elevation suction effect (curved cockpit, wing underside)
        float suctionFactor = 0.0;
        if (vWorldPos.y > 0.6 && abs(vWorldNormal.y) > 0.5) {
          suctionFactor = -0.5 * abs(vWorldNormal.y);
        }
        // Wing suction on lower surface
        if (vWorldPos.z < -1.1 && vWorldNormal.y < -0.3) {
          suctionFactor = -1.1;
        }

        // Pressure coefficient Cp approximation
        float cp = alignment + suctionFactor;
        vec3 aeroColor = getAeroPressureColor(cp);

        // Blend pressure colormap with PBR lighting for depth
        gl_FragColor = vec4(mix(gl_FragColor.rgb, aeroColor * (0.8 + 0.3 * gl_FragColor.rgb), 0.85), gl_FragColor.a);
      }
      `
    );
  };

  return mat;
}

/**
 * Builds the complete procedural sports / LMP1 hypercar
 */
export function buildProceduralCar(carParams, shadingMode = 'aero_pressure') {
  const carGroup = new THREE.Group();
  carGroup.name = 'CarAssembly';

  // Common materials
  const bodyMaterial = createAeroMaterial({
    baseColor: 0x1f242d,
    roughness: 0.25,
    metalness: 0.85,
    shadingMode
  });

  const carbonMaterial = createAeroMaterial({
    baseColor: 0x121417,
    roughness: 0.4,
    metalness: 0.6,
    shadingMode
  });

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x050c18,
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.85,
    thickness: 0.4,
    transparent: true,
    opacity: 0.85,
    wireframe: shadingMode === 'wireframe'
  });

  const tireMaterial = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.85,
    metalness: 0.1,
    wireframe: shadingMode === 'wireframe'
  });

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    roughness: 0.2,
    metalness: 0.95,
    wireframe: shadingMode === 'wireframe'
  });

  const brakeMaterial = new THREE.MeshStandardMaterial({
    color: 0xdc2626, // Red brake caliper
    roughness: 0.3,
    metalness: 0.7
  });

  // 1. Sleek Aerodynamic Monocoque Chassis
  const chassisGroup = new THREE.Group();
  chassisGroup.name = 'Chassis';

  // Main central body tub
  const tubGeo = new THREE.BoxGeometry(1.3, 0.42, 3.4, 6, 4, 12);
  // Aerodynamically shape the vertices
  const pos = tubGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // Taper nose forward (positive Z)
    if (z > 0.5) {
      const taper = (z - 0.5) / 1.2;
      pos.setX(i, x * (1.0 - taper * 0.45));
      pos.setY(i, y * (1.0 - taper * 0.35) - taper * 0.06);
    }
    // Taper rear deck (negative Z)
    if (z < -0.6) {
      const rearTaper = (-z - 0.6) / 1.1;
      pos.setX(i, x * (1.0 - rearTaper * 0.2));
      pos.setY(i, y * (1.0 - rearTaper * 0.25));
    }
  }
  tubGeo.computeVertexNormals();

  const mainTub = new THREE.Mesh(tubGeo, bodyMaterial);
  mainTub.position.set(0, 0.34, 0);
  mainTub.castShadow = true;
  mainTub.receiveShadow = true;
  mainTub.name = 'MonocoqueTub';
  chassisGroup.add(mainTub);

  // Aerodynamic nose cone
  const noseGeo = new THREE.ConeGeometry(0.55, 0.95, 16);
  noseGeo.rotateX(Math.PI / 2);
  noseGeo.scale(1.2, 0.45, 1.0);
  const noseMesh = new THREE.Mesh(noseGeo, bodyMaterial);
  noseMesh.position.set(0, 0.24, 1.95);
  noseMesh.castShadow = true;
  noseMesh.name = 'NoseCone';
  chassisGroup.add(noseMesh);

  // 2. Cockpit Canopy with aero bubble
  const cockpitGroup = new THREE.Group();
  cockpitGroup.name = 'Cockpit';

  const canopyGeo = new THREE.SphereGeometry(0.55, 24, 16);
  canopyGeo.scale(1.0, 0.8, 1.8);
  const canopyMesh = new THREE.Mesh(
    canopyGeo,
    shadingMode === 'aero_pressure' ? bodyMaterial : glassMaterial
  );
  canopyMesh.position.set(0, 0.62, 0.15);
  canopyMesh.castShadow = true;
  canopyMesh.name = 'CanopyBubble';
  cockpitGroup.add(canopyMesh);

  // Dorsal Shark Fin (LMP1 aerodynamic stabilizer)
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.03, 0);
  finShape.lineTo(0.01, 0.55);
  finShape.lineTo(-1.25, 0.05);
  finShape.lineTo(-1.25, 0);
  finShape.closePath();

  const finExtrudeSettings = { depth: 0.02, bevelEnabled: false };
  const finGeo = new THREE.ExtrudeGeometry(finShape, finExtrudeSettings);
  finGeo.rotateY(Math.PI / 2);
  const finMesh = new THREE.Mesh(finGeo, carbonMaterial);
  finMesh.position.set(0.01, 0.55, -0.1);
  finMesh.name = 'SharkFin';
  cockpitGroup.add(finMesh);

  // 3. Sidepods & Cooling Inlets
  const sidepodGroup = new THREE.Group();
  sidepodGroup.name = 'Sidepods';

  const podGeo = new THREE.BoxGeometry(0.38, 0.35, 1.9, 4, 3, 6);
  // Sculpt sidepod undercut
  const podPos = podGeo.attributes.position;
  for (let i = 0; i < podPos.count; i++) {
    const x = podPos.getX(i);
    const y = podPos.getY(i);
    const z = podPos.getZ(i);
    if (y < 0 && z > 0) {
      podPos.setX(i, x * 0.75); // undercut channel for air
    }
  }
  podGeo.computeVertexNormals();

  const leftPod = new THREE.Mesh(podGeo, bodyMaterial);
  leftPod.position.set(-0.84, 0.3, 0.1);
  leftPod.castShadow = true;
  leftPod.name = 'Sidepod_Left';
  sidepodGroup.add(leftPod);

  const rightPod = leftPod.clone();
  rightPod.position.x = 0.84;
  rightPod.name = 'Sidepod_Right';
  sidepodGroup.add(rightPod);

  // Side skirts
  const skirtGeo = new THREE.BoxGeometry(0.05, 0.08, 2.2);
  const leftSkirt = new THREE.Mesh(skirtGeo, carbonMaterial);
  leftSkirt.position.set(-1.02, 0.12, 0.05);
  leftSkirt.name = 'SideSkirt_Left';
  sidepodGroup.add(leftSkirt);

  const rightSkirt = leftSkirt.clone();
  rightSkirt.position.x = 1.02;
  rightSkirt.name = 'SideSkirt_Right';
  sidepodGroup.add(rightSkirt);

  // 4. Front Aerodynamic Splitter & Vortex Generators
  const splitterGroup = new THREE.Group();
  splitterGroup.name = 'Splitter';

  const splitterLength = carParams.splitterLength || 0.25;
  const splitterGeo = new THREE.BoxGeometry(1.95, 0.035, 0.7 + splitterLength);
  const splitterMesh = new THREE.Mesh(splitterGeo, carbonMaterial);
  splitterMesh.position.set(0, 0.1, 1.7 + splitterLength * 0.4);
  splitterMesh.castShadow = true;
  splitterMesh.name = 'SplitterBlade';
  splitterGroup.add(splitterMesh);

  // Front Dive Planes / Canards (vortex generators)
  const canardGeo = new THREE.BoxGeometry(0.3, 0.015, 0.22);
  canardGeo.rotateX(Math.PI / 10);
  canardGeo.rotateZ(Math.PI / 12);
  const leftCanard = new THREE.Mesh(canardGeo, carbonMaterial);
  leftCanard.position.set(-0.92, 0.28, 1.85);
  leftCanard.name = 'Canard_Left';
  splitterGroup.add(leftCanard);

  const rightCanard = leftCanard.clone();
  rightCanard.rotation.z = -Math.PI / 12;
  rightCanard.position.x = 0.92;
  rightCanard.name = 'Canard_Right';
  splitterGroup.add(rightCanard);

  // 5. Underbody Floor & Venturi Diffuser
  const diffuserGroup = new THREE.Group();
  diffuserGroup.name = 'Diffuser';

  // Flat bottom floor
  const floorGeo = new THREE.BoxGeometry(1.7, 0.03, 3.2);
  const floorMesh = new THREE.Mesh(floorGeo, carbonMaterial);
  floorMesh.position.set(0, 0.09, 0.1);
  floorMesh.receiveShadow = true;
  floorMesh.name = 'UnderbodyFloor';
  diffuserGroup.add(floorMesh);

  // Diffuser Ramp (upswept angle dynamically controlled)
  const diffuserAngle = carParams.diffuserAngle || 9.0;
  const diffuserRampGeo = new THREE.BoxGeometry(1.5, 0.025, 0.95);
  const diffuserMesh = new THREE.Mesh(diffuserRampGeo, carbonMaterial);
  diffuserMesh.position.set(0, 0.12, -1.8);
  diffuserMesh.rotation.x = (diffuserAngle * Math.PI) / 180;
  diffuserMesh.name = 'DiffuserRamp';
  diffuserGroup.add(diffuserMesh);

  // Vertical Diffuser Strakes (keep vortices channeled)
  [-0.45, -0.15, 0.15, 0.45].forEach((xPos, idx) => {
    const strakeGeo = new THREE.BoxGeometry(0.018, 0.14, 0.9);
    const strake = new THREE.Mesh(strakeGeo, carbonMaterial);
    strake.position.set(xPos, 0.14, -1.8);
    strake.rotation.x = (diffuserAngle * Math.PI) / 180;
    strake.name = `DiffuserStrake_${idx + 1}`;
    diffuserGroup.add(strake);
  });

  // 6. Multi-Element Rear Wing Assembly
  const rearWingGroup = new THREE.Group();
  rearWingGroup.name = 'RearWing';

  const wingSpan = carParams.rearWingSpan || 1.6;
  const wingAOA = carParams.rearWingAOA || 11.5;

  // Main Wing Element (cambered airfoil simulation)
  const mainWingGeo = new THREE.BoxGeometry(wingSpan, 0.035, 0.38);
  // Airfoil curve
  const wingPos = mainWingGeo.attributes.position;
  for (let i = 0; i < wingPos.count; i++) {
    const z = wingPos.getZ(i);
    if (z > 0.05) {
      wingPos.setY(i, wingPos.getY(i) - 0.015);
    }
  }
  mainWingGeo.computeVertexNormals();

  const mainWing = new THREE.Mesh(mainWingGeo, carbonMaterial);
  mainWing.position.set(0, 0.95, -1.65);
  mainWing.rotation.x = (wingAOA * Math.PI) / 180;
  mainWing.castShadow = true;
  mainWing.name = 'MainWingElement';
  rearWingGroup.add(mainWing);

  // Secondary Flap (Gurney flap / high-lift element)
  const flapGeo = new THREE.BoxGeometry(wingSpan * 0.95, 0.02, 0.16);
  const flapMesh = new THREE.Mesh(flapGeo, carbonMaterial);
  flapMesh.position.set(0, 1.01, -1.8);
  flapMesh.rotation.x = ((wingAOA + 4.0) * Math.PI) / 180;
  flapMesh.castShadow = true;
  flapMesh.name = 'SecondaryWingFlap';
  rearWingGroup.add(flapMesh);

  // Aerodynamic Endplates
  const endplateGeo = new THREE.BoxGeometry(0.02, 0.42, 0.65);
  const leftEndplate = new THREE.Mesh(endplateGeo, carbonMaterial);
  leftEndplate.position.set(-wingSpan / 2, 0.94, -1.68);
  leftEndplate.name = 'WingEndplate_Left';
  rearWingGroup.add(leftEndplate);

  const rightEndplate = leftEndplate.clone();
  rightEndplate.position.x = wingSpan / 2;
  rightEndplate.name = 'WingEndplate_Right';
  rearWingGroup.add(rightEndplate);

  // Swan-neck Wing Pylons / Mounts
  const pylonGeo = new THREE.BoxGeometry(0.025, 0.52, 0.09);
  pylonGeo.rotateX(-Math.PI / 12);
  const leftPylon = new THREE.Mesh(pylonGeo, carbonMaterial);
  leftPylon.position.set(-0.35, 0.72, -1.55);
  leftPylon.name = 'WingPylon_Left';
  rearWingGroup.add(leftPylon);

  const rightPylon = leftPylon.clone();
  rightPylon.position.x = 0.35;
  rightPylon.name = 'WingPylon_Right';
  rearWingGroup.add(rightPylon);

  // 7. Four Detailed Wheels (Rims, Tires, Brake Calipers)
  const wheelsGroup = new THREE.Group();
  wheelsGroup.name = 'Wheels';

  const wheelPositions = [
    { name: 'Wheel_FL', pos: [-0.94, 0.32, 1.25] },
    { name: 'Wheel_FR', pos: [0.94, 0.32, 1.25] },
    { name: 'Wheel_RL', pos: [-0.94, 0.34, -1.35] },
    { name: 'Wheel_RR', pos: [0.94, 0.34, -1.35] }
  ];

  wheelPositions.forEach(({ name, pos }) => {
    const singleWheelGroup = new THREE.Group();
    singleWheelGroup.name = name;
    singleWheelGroup.position.set(...pos);

    // Tire
    const tireGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.28, 24);
    tireGeo.rotateZ(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, tireMaterial);
    tire.castShadow = true;
    tire.name = `${name}_Tire`;
    singleWheelGroup.add(tire);

    // Rim
    const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.285, 18);
    rimGeo.rotateZ(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, rimMaterial);
    rim.name = `${name}_Rim`;
    singleWheelGroup.add(rim);

    // Brake Disc
    const brakeGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.04, 16);
    brakeGeo.rotateZ(Math.PI / 2);
    const brakeDisc = new THREE.Mesh(brakeGeo, carbonMaterial);
    brakeDisc.name = `${name}_BrakeDisc`;
    singleWheelGroup.add(brakeDisc);

    // Caliper
    const caliperGeo = new THREE.BoxGeometry(0.06, 0.1, 0.12);
    const caliper = new THREE.Mesh(caliperGeo, brakeMaterial);
    caliper.position.set(0, 0.12, 0.08);
    caliper.name = `${name}_Caliper`;
    singleWheelGroup.add(caliper);

    wheelsGroup.add(singleWheelGroup);
  });

  // 8. NACA Ducts on Hood & Roof
  const nacaGroup = new THREE.Group();
  nacaGroup.name = 'NACADucts';

  const nacaGeo = new THREE.BoxGeometry(0.12, 0.02, 0.26);
  nacaGeo.rotateX(Math.PI / 8);
  const leftNaca = new THREE.Mesh(nacaGeo, carbonMaterial);
  leftNaca.position.set(-0.25, 0.44, 1.1);
  leftNaca.name = 'NACADuct_Left';
  nacaGroup.add(leftNaca);

  const rightNaca = leftNaca.clone();
  rightNaca.position.x = 0.25;
  rightNaca.name = 'NACADuct_Right';
  nacaGroup.add(rightNaca);

  // Assemble full hierarchy
  carGroup.add(chassisGroup);
  carGroup.add(cockpitGroup);
  carGroup.add(sidepodGroup);
  carGroup.add(splitterGroup);
  carGroup.add(diffuserGroup);
  carGroup.add(rearWingGroup);
  carGroup.add(wheelsGroup);
  carGroup.add(nacaGroup);

  return carGroup;
}

/**
 * Updates dynamic aerodynamic parts when store parameters or shading mode change
 */
export function updateCarGeometry(carGroup, carParams, shadingMode = 'aero_pressure') {
  if (!carGroup) return;

  // 1. Update Rear Wing AOA & Span
  const mainWing = carGroup.getObjectByName('MainWingElement');
  const secondaryWing = carGroup.getObjectByName('SecondaryWingFlap');
  if (mainWing && carParams.rearWingAOA !== undefined) {
    mainWing.rotation.x = (carParams.rearWingAOA * Math.PI) / 180;
  }
  if (secondaryWing && carParams.rearWingAOA !== undefined) {
    secondaryWing.rotation.x = ((carParams.rearWingAOA + 4.0) * Math.PI) / 180;
  }
  if (carParams.rearWingSpan !== undefined) {
    const spanScale = carParams.rearWingSpan / 1.6;
    if (mainWing) mainWing.scale.x = spanScale;
    if (secondaryWing) secondaryWing.scale.x = spanScale;
    const leftEndplate = carGroup.getObjectByName('WingEndplate_Left');
    const rightEndplate = carGroup.getObjectByName('WingEndplate_Right');
    if (leftEndplate) leftEndplate.position.x = -carParams.rearWingSpan / 2;
    if (rightEndplate) rightEndplate.position.x = carParams.rearWingSpan / 2;
  }

  // 2. Update Splitter Length
  const splitterBlade = carGroup.getObjectByName('SplitterBlade');
  if (splitterBlade && carParams.splitterLength !== undefined) {
    splitterBlade.scale.z = 1.0 + (carParams.splitterLength - 0.25) * 1.5;
    splitterBlade.position.z = 1.7 + carParams.splitterLength * 0.4;
  }

  // 3. Update Diffuser Ramp Angle
  const diffuserRamp = carGroup.getObjectByName('DiffuserRamp');
  if (diffuserRamp && carParams.diffuserAngle !== undefined) {
    diffuserRamp.rotation.x = (carParams.diffuserAngle * Math.PI) / 180;
  }

  // Update Diffuser Strakes
  for (let i = 1; i <= 4; i++) {
    const strake = carGroup.getObjectByName(`DiffuserStrake_${i}`);
    if (strake && carParams.diffuserAngle !== undefined) {
      strake.rotation.x = (carParams.diffuserAngle * Math.PI) / 180;
    }
  }

  // 4. Update Ground Clearance
  if (carParams.groundClearance !== undefined) {
    carGroup.position.y = carParams.groundClearance;
  }

  // 5. Update Materials and Pressure Uniforms
  let targetMode = 0.0;
  if (shadingMode === 'aero_pressure') targetMode = 1.0;
  else if (shadingMode === 'audit_normals') targetMode = 2.0;

  carGroup.traverse((child) => {
    if (child.isMesh && child.material) {
      if (child.material.userData?.shadingMode) {
        child.material.userData.shadingMode.value = targetMode;
      }
      child.material.wireframe = shadingMode === 'wireframe';
    }
  });
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
