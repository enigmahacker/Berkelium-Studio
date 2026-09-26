/**
 * Aerodynamic Math Utilities & CFD Physics Engine for Berkelium Studio
 */

// Air dynamic viscosity at standard sea level (15°C / 288.15 K): kg / (m * s) or Pa * s
export const AIR_DYNAMIC_VISCOSITY = 1.81e-5;

/**
 * Calculates dynamic pressure: q = 0.5 * rho * v^2 (Pascals)
 * Derived directly from Bernoulli's equation for incompressible fluid flow.
 */
export function calculateDynamicPressure(rho, velocity) {
  return 0.5 * rho * Math.pow(velocity, 2);
}

/**
 * Calculates Reynolds number: Re = (rho * v * L) / mu
 * Characteristic length L is total vehicle aerodynamic length.
 */
export function calculateReynoldsNumber(rho, velocity, length, mu = AIR_DYNAMIC_VISCOSITY) {
  if (mu <= 0) return 0;
  return (rho * velocity * length) / mu;
}

/**
 * Calculates Drag Force: Fd = 0.5 * rho * v^2 * Cd * A = q * Cd * A (Newtons)
 */
export function calculateDragForce(rho, velocity, cd, frontalArea) {
  const q = calculateDynamicPressure(rho, velocity);
  return q * cd * frontalArea;
}

/**
 * Calculates Downforce (Negative Lift): Fl = 0.5 * rho * v^2 * Cl * A = q * Cl * A (Newtons)
 */
export function calculateDownforce(rho, velocity, cl, frontalArea) {
  const q = calculateDynamicPressure(rho, velocity);
  return q * cl * frontalArea;
}

/**
 * Calculates induced drag coefficient for finite 3D wings:
 * Cdi = (Cl_wing^2) / (pi * AR * e)
 * Where AR is aspect ratio (b^2 / S) and e is Oswald efficiency factor.
 */
export function calculateInducedDrag(clWing, wingSpan, chord = 0.28, oswaldEfficiency = 0.85) {
  if (wingSpan <= 0 || chord <= 0) return 0;
  const wingAspect = (wingSpan * wingSpan) / (wingSpan * chord);
  const factor = 1 / (Math.PI * wingAspect * oswaldEfficiency);
  return factor * Math.pow(clWing, 2);
}

/**
 * Calculates required aerodynamic propulsion power: P = Fd * v (Watts)
 * Returns { watts, kw, hp } where 1 HP = 745.69987 Watts (exact mechanical horsepower)
 */
export function calculatePowerRequired(dragForce, velocity) {
  const watts = Math.max(0, dragForce * velocity);
  const kw = watts / 1000;
  const hp = watts / 745.7;
  return { watts, kw, hp };
}

/**
 * Checks for flow boundary layer separation:
 * - Wing stall if AOA > 14.5° (adverse pressure gradient triggers separation)
 * - Diffuser separation if diffuserAngle > 12.0° (turbulent vortex breakdown)
 * - Floor choking if groundClearance < 0.05m (5 cm minimum ride height limit)
 */
export function checkFlowSeparation(rearWingAOA, diffuserAngle, groundClearance = 0.08) {
  const wingSeparated = rearWingAOA > 14.5;
  const diffuserSeparated = diffuserAngle > 12.0;
  const floorChoked = groundClearance < 0.05;

  let stallSeverity = 'optimal';
  if (wingSeparated && diffuserSeparated) {
    stallSeverity = 'critical';
  } else if (wingSeparated || diffuserSeparated || floorChoked) {
    stallSeverity = 'warning';
  }

  return {
    flowSeparationDetected: wingSeparated || diffuserSeparated || floorChoked,
    wingSeparated,
    diffuserSeparated,
    floorChoked,
    stallSeverity
  };
}

/**
 * Computes aerodynamic homologation compliance score (0 - 100%)
 */
export function calculateHomologationScore(carParams) {
  let score = 96;
  const {
    rearWingAOA = 11.5,
    diffuserAngle = 9.0,
    groundClearance = 0.08,
    splitterLength = 0.25
  } = carParams;

  if (rearWingAOA > 14.5) {
    score -= Math.min(30, Math.round(15 + (rearWingAOA - 14.5) * 3));
  } else if (rearWingAOA > 13.5) {
    score -= 4;
  }

  if (diffuserAngle > 12.0) {
    score -= Math.min(25, Math.round(12 + (diffuserAngle - 12.0) * 2.5));
  }

  if (groundClearance < 0.05) {
    score -= Math.min(20, Math.round(10 + (0.05 - groundClearance) * 200));
  }

  if (splitterLength > 0.38) {
    score -= 6;
  }

  return Math.max(35, Math.min(100, score));
}

/**
/**
 * Derives discrete physical flow states for key vehicle components:
 * - 'ATTACHED': Stable boundary layer, optimal aerodynamic performance
 * - 'HIGH_LOAD': Near-critical adverse pressure gradient, high lift/downforce
 * - 'SEPARATED': Turbulent detachment, vortex breakdown, or ground choking
 * - 'STALLED': Complete boundary layer collapse on aerodynamic wing/element
 */
export function deriveComponentStates(carParams = {}, windTunnelParams = {}) {
  const rearWingAOA = carParams.rearWingAOA ?? 11.5;
  const diffuserAngle = carParams.diffuserAngle ?? 9.0;
  const groundClearance = carParams.groundClearance ?? 0.18;
  const splitterLength = carParams.splitterLength ?? 0.20;
  const windSpeed = windTunnelParams.windSpeed ?? 45.0;

  // 1. Rear Wing Aerodynamic State (Critical stall AoA = 14.5°)
  let rearWing = 'ATTACHED';
  if (rearWingAOA > 14.5) {
    rearWing = 'STALLED';
  } else if (rearWingAOA >= 10.0) {
    rearWing = 'HIGH_LOAD';
  }

  // 2. Diffuser Expansion State (Detachment threshold = 12.0°)
  let diffuser = 'ATTACHED';
  if (diffuserAngle > 12.0) {
    diffuser = 'SEPARATED';
  } else if (diffuserAngle >= 8.5) {
    diffuser = 'HIGH_LOAD';
  }

  // 3. Underbody Ground Effect Channel (Choking limit < 0.06m)
  let underbody = 'ATTACHED';
  if (groundClearance < 0.06) {
    underbody = 'SEPARATED';
  } else if (groundClearance < 0.10) {
    underbody = 'HIGH_LOAD';
  }

  // 4. Front Splitter / Nose Air Dam
  let front = 'ATTACHED';
  if (splitterLength > 0.40) {
    front = 'SEPARATED';
  }

  // 5. SUV Roof & Windshield Boundary Layer
  let roof = 'ATTACHED';
  if (windSpeed > 55.0) {
    roof = 'HIGH_LOAD';
  }

  // 6. Recirculating Bluff-Body Wake
  let wake = 'TURBULENT_BLUFF_BODY';
  if (rearWing === 'STALLED' || diffuser === 'SEPARATED') {
    wake = 'EXPANDED_SEPARATED_WAKE';
  }

  return {
    front,
    roof,
    underbody,
    diffuser,
    rearWing,
    wake
  };
}

/**
 * Returns a structured engineering matrix for telemetry inspection,
 * detailing component health, exact aerodynamic deltas, and physical descriptions.
 */
export function getComponentStatusMatrix(carParams = {}, windTunnelParams = {}, componentStates = null) {
  const states = componentStates || deriveComponentStates(carParams, windTunnelParams);

  return [
    {
      id: 'rearWing',
      name: 'Rear Wing Spoiler',
      location: 'Roof Trailing Flap (Z=-2.15m)',
      status: states.rearWing,
      deltaCl: states.rearWing === 'STALLED' ? '-35%' : (states.rearWing === 'HIGH_LOAD' ? '+18%' : '+0%'),
      deltaCd: states.rearWing === 'STALLED' ? '+45%' : (states.rearWing === 'HIGH_LOAD' ? '+8%' : '+0%'),
      severity: states.rearWing === 'STALLED' ? 'critical' : (states.rearWing === 'HIGH_LOAD' ? 'warning' : 'normal'),
      description: states.rearWing === 'STALLED'
        ? 'Adverse pressure gradient triggered stall; boundary layer detached on suction side'
        : (states.rearWing === 'HIGH_LOAD' ? 'High downforce generation with near-critical pressure gradient' : 'Boundary layer attached with smooth circulation downwash')
    },
    {
      id: 'diffuser',
      name: 'Venturi Rear Diffuser',
      location: 'Underbody Exit (Z=-1.85m)',
      status: states.diffuser,
      deltaCl: states.diffuser === 'SEPARATED' ? '-28%' : (states.diffuser === 'HIGH_LOAD' ? '+15%' : '+0%'),
      deltaCd: states.diffuser === 'SEPARATED' ? '+30%' : (states.diffuser === 'HIGH_LOAD' ? '+5%' : '+0%'),
      severity: states.diffuser === 'SEPARATED' ? 'critical' : (states.diffuser === 'HIGH_LOAD' ? 'warning' : 'normal'),
      description: states.diffuser === 'SEPARATED'
        ? 'Diffuser ramp expansion angle exceeded 12.0°; vortex breakdown and underbody stall'
        : (states.diffuser === 'HIGH_LOAD' ? 'Aggressive expansion slope; high underfloor suction' : 'Smooth boundary layer diffusion without separation')
    },
    {
      id: 'underbody',
      name: 'Underbody Floor Channel',
      location: 'Ground Effect Floor (Y=Clearance)',
      status: states.underbody,
      deltaCl: states.underbody === 'SEPARATED' ? '-20%' : (states.underbody === 'HIGH_LOAD' ? '+12%' : '+0%'),
      deltaCd: states.underbody === 'SEPARATED' ? '+25%' : (states.underbody === 'HIGH_LOAD' ? '+4%' : '+0%'),
      severity: states.underbody === 'SEPARATED' ? 'critical' : (states.underbody === 'HIGH_LOAD' ? 'warning' : 'normal'),
      description: states.underbody === 'SEPARATED'
        ? 'Ride height choked (< 0.06m); boundary layer stagnation and porpoising drag spike'
        : (states.underbody === 'HIGH_LOAD' ? 'Low ground clearance creating strong Venturi suction' : 'Optimal ground clearance channel with uninhibited mass flux')
    },
    {
      id: 'front',
      name: 'Front Splitter & Lip',
      location: 'Front Bumper Air Dam (Z=+2.10m)',
      status: states.front,
      deltaCl: states.front === 'SEPARATED' ? '-10%' : '+0%',
      deltaCd: states.front === 'SEPARATED' ? '+12%' : '+0%',
      severity: states.front === 'SEPARATED' ? 'warning' : 'normal',
      description: states.front === 'SEPARATED'
        ? 'Excessive splitter overhang causing leading edge boundary layer detachment'
        : 'Stagnation flow bifurcation correctly dividing overbody and underbody air'
    },
    {
      id: 'roof',
      name: 'SUV Roof & Windshield',
      location: 'Windshield Cowl to Roof Rails',
      status: states.roof,
      deltaCl: states.roof === 'HIGH_LOAD' ? '-5%' : '+0%',
      deltaCd: states.roof === 'HIGH_LOAD' ? '+6%' : '+0%',
      severity: states.roof === 'HIGH_LOAD' ? 'warning' : 'normal',
      description: states.roof === 'HIGH_LOAD'
        ? 'High dynamic pressure over raked windshield header'
        : 'Streamlined curvature contouring air to roof trailing spoiler'
    },
    {
      id: 'wake',
      name: 'Bluff-Body Base Wake',
      location: 'Rear Hatch / Tailgate (Z < -2.3m)',
      status: states.wake,
      deltaCl: states.wake === 'EXPANDED_SEPARATED_WAKE' ? '-12%' : '+0%',
      deltaCd: states.wake === 'EXPANDED_SEPARATED_WAKE' ? '+38%' : '+0%',
      severity: states.wake === 'EXPANDED_SEPARATED_WAKE' ? 'critical' : 'normal',
      description: states.wake === 'EXPANDED_SEPARATED_WAKE'
        ? 'Stalled wing and separated diffuser greatly expand recirculating low-pressure wake volume'
        : 'Standard SUV squareback toroidal vortex recirculation zone'
    }
  ];
}

/**
 * Procedurally estimates SUV aerodynamic coefficients (Cd, Cl, Frontal Area)
 * based on body geometry, wing attack angles, and ground proximity.
 */
export function estimateAeroCoefficients(carParams = {}) {
  const {
    wheelbase: _wheelbase = 2.85,
    width = 1.98,
    height = 1.65,
    splitterLength = 0.20,
    rearWingAOA = 11.5,
    rearWingSpan = 1.70,
    diffuserAngle = 9.0,
    groundClearance = 0.18
  } = carParams;

  // Frontal Area estimation for modern performance SUV: A ≈ width * height * 0.84
  const frontalArea = Number((width * height * 0.84 + (splitterLength * 0.12)).toFixed(2));

  // Base bluff-body SUV parasite drag (typical modern aero SUV is 0.32 - 0.36)
  let baseCd = 0.325;

  // Splitter influence: smooths front stagnation bifurcation, increases front downforce
  baseCd -= splitterLength * 0.02;

  // Rear wing aerodynamics:
  const wingCd0 = 0.025;
  let wingCl = 0.08 * Math.max(0, rearWingAOA);

  // Induced drag from finite span vortex generation: Cdi = Cl^2 / (pi * AR * e)
  let wingCdi = calculateInducedDrag(wingCl, rearWingSpan, 0.30, 0.85);

  // Boundary layer stall dynamics: if AOA > 14.5°, lift collapses and pressure drag spikes
  let wingStallCd = 0;
  if (rearWingAOA > 14.5) {
    const stallDelta = rearWingAOA - 14.5;
    wingCl = wingCl * Math.exp(-stallDelta * 0.15); // Suction loss
    wingStallCd = 0.05 + stallDelta * 0.04; // Massive separated wake penalty
  }

  const wingCd = wingCd0 + wingCdi + wingStallCd;

  // Front splitter downforce:
  const splitterCl = 0.12 + splitterLength * 0.65;

  // Underbody Venturi diffuser downforce:
  let diffuserCl = 0.22 + (diffuserAngle * 0.035);
  let diffuserCd = 0.012 + (diffuserAngle * 0.0025);

  if (diffuserAngle > 12.0) {
    const diffStall = diffuserAngle - 12.0;
    diffuserCl -= diffStall * 0.06;
    diffuserCd += diffStall * 0.035;
  }

  // Ground clearance factor (Venturi suction increases as clearance drops, until seal chokes)
  let groundEffectMultiplier = 1.0;
  if (groundClearance < 0.15 && groundClearance >= 0.06) {
    groundEffectMultiplier = 1.0 + (0.15 - groundClearance) * 2.5;
  } else if (groundClearance < 0.06) {
    // Choked ground effect: boundary layer collapse, viscous choking drag spike
    groundEffectMultiplier = 0.75;
    baseCd += 0.065;
  }

  const totalCd = Number(Math.max(0.25, baseCd + wingCd + diffuserCd).toFixed(3));
  const totalCl = Number(Math.max(0.05, (wingCl + splitterCl + diffuserCl) * groundEffectMultiplier).toFixed(3));

  return {
    cd: totalCd,
    cl: totalCl,
    frontalArea,
    liftToDragRatio: Number((totalCl / totalCd).toFixed(2))
  };
}

/**
 * Comprehensive aerodynamic calculation function
 */
export function calculateAerodynamics(carParams = {}, windTunnelParams = {}) {
  const { windSpeed = 45.0, airDensity = 1.225 } = windTunnelParams;
  const separation = checkFlowSeparation(
    carParams.rearWingAOA ?? 11.5,
    carParams.diffuserAngle ?? 9.0,
    carParams.groundClearance ?? 0.18
  );
  const compStates = deriveComponentStates(carParams, windTunnelParams);
  const compMatrix = getComponentStatusMatrix(carParams, windTunnelParams, compStates);
  const aeroCoeffs = estimateAeroCoefficients(carParams);
  const homologationScore = calculateHomologationScore(carParams);

  const dragForce = Math.round(
    calculateDragForce(airDensity, windSpeed, aeroCoeffs.cd, aeroCoeffs.frontalArea)
  );

  const downforce = Math.round(
    calculateDownforce(airDensity, windSpeed, aeroCoeffs.cl, aeroCoeffs.frontalArea)
  );

  const carLength = (carParams.wheelbase || 2.85) + 1.95; // ~4.8m length
  const reynoldsNo = Math.round(
    calculateReynoldsNumber(airDensity, windSpeed, carLength)
  );

  const dynamicPressure = Math.round(
    calculateDynamicPressure(airDensity, windSpeed)
  );

  const power = calculatePowerRequired(dragForce, windSpeed);

  return {
    dragForce,
    downforce,
    cd: aeroCoeffs.cd,
    cl: aeroCoeffs.cl,
    liftToDragRatio: aeroCoeffs.liftToDragRatio,
    frontalArea: aeroCoeffs.frontalArea,
    reynoldsNo,
    dynamicPressure,
    powerRequiredWatts: Math.round(power.watts),
    powerRequiredKw: Number(power.kw.toFixed(1)),
    powerRequiredHp: Number(power.hp.toFixed(1)),
    flowSeparationDetected: separation.flowSeparationDetected,
    separationDetails: separation,
    homologationScore,
    componentStates: compStates,
    componentStatusMatrix: compMatrix
  };
}
