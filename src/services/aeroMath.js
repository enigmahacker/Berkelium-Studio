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
 * Procedurally estimates sports/LMP1 car aerodynamic coefficients (Cd, Cl, Frontal Area)
 * based on body geometry and wing attack angles.
 */
export function estimateAeroCoefficients(carParams) {
  const {
    wheelbase: _wheelbase = 2.7,
    width = 1.9,
    height = 1.15,
    splitterLength = 0.25,
    rearWingAOA = 11.5,
    rearWingSpan = 1.6,
    diffuserAngle = 9.0,
    groundClearance = 0.08
  } = carParams;

  // Frontal Area estimation: A ≈ width * height * 0.82 (aerodynamic tuck factor)
  const frontalArea = Number((width * height * 0.82 + (splitterLength * 0.15)).toFixed(2));

  // Base streamlined monocoque parasite drag
  let baseCd = 0.235;

  // Splitter influence: lowers base Cd slightly by guiding air, increases front downforce
  baseCd -= splitterLength * 0.02;

  // Rear wing aerodynamics:
  // Base zero-lift profile drag Cd0
  const wingCd0 = 0.02;
  let wingCl = 0.09 * Math.max(0, rearWingAOA);

  // Induced drag from finite span vortex generation: Cdi = Cl^2 / (pi * AR * e)
  let wingCdi = calculateInducedDrag(wingCl, rearWingSpan, 0.28, 0.85);

  // Boundary layer stall dynamics: if AOA > 14.5°, lift collapses exponentially and pressure form drag spikes
  let wingStallCd = 0;
  if (rearWingAOA > 14.5) {
    const stallDelta = rearWingAOA - 14.5;
    wingCl = wingCl * Math.exp(-stallDelta * 0.12);
    wingStallCd = stallDelta * 0.045; // Massive separated wake pressure penalty
  }

  const wingCd = wingCd0 + wingCdi + wingStallCd;

  // Front splitter downforce:
  const splitterCl = 0.18 + splitterLength * 0.85;

  // Underbody Venturi diffuser downforce:
  // Optimum ground effect between 6° and 11°. Above 12°, flow detaches into turbulent separation
  let diffuserCl = 0.35 + (diffuserAngle * 0.055);
  let diffuserCd = 0.015 + (diffuserAngle * 0.003);

  if (diffuserAngle > 12.0) {
    const diffStall = diffuserAngle - 12.0;
    diffuserCl -= diffStall * 0.09;
    diffuserCd += diffStall * 0.025;
  }

  // Ground clearance factor (Venturi suction increases as clearance drops, until seal chokes)
  let groundEffectMultiplier = 1.0;
  if (groundClearance < 0.12 && groundClearance >= 0.05) {
    groundEffectMultiplier = 1.0 + (0.12 - groundClearance) * 4.0;
  } else if (groundClearance < 0.05) {
    // Choked ground effect: boundary layer collapse, porpoising drag spike
    groundEffectMultiplier = 0.88;
    baseCd += 0.045;
  }

  const totalCd = Number(Math.max(0.18, baseCd + wingCd + diffuserCd).toFixed(3));
  const totalCl = Number(Math.max(0.1, (wingCl + splitterCl + diffuserCl) * groundEffectMultiplier).toFixed(3));

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
export function calculateAerodynamics(carParams, windTunnelParams) {
  const { windSpeed = 45.0, airDensity = 1.225 } = windTunnelParams;
  const separation = checkFlowSeparation(
    carParams.rearWingAOA,
    carParams.diffuserAngle,
    carParams.groundClearance
  );
  const aeroCoeffs = estimateAeroCoefficients(carParams);
  const homologationScore = calculateHomologationScore(carParams);

  const dragForce = Math.round(
    calculateDragForce(airDensity, windSpeed, aeroCoeffs.cd, aeroCoeffs.frontalArea)
  );

  const downforce = Math.round(
    calculateDownforce(airDensity, windSpeed, aeroCoeffs.cl, aeroCoeffs.frontalArea)
  );

  const carLength = (carParams.wheelbase || 2.7) + 1.6;
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
    homologationScore
  };
}
