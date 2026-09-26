import * as THREE from 'three';

/**
 * Aerodynamic 3D Flow Field and Solid Domain Masking Engine for Berkelium Studio
 * Simulates virtual wind-tunnel freestream, bluff-body vehicle displacement,
 * boundary-layer acceleration, roof suction peaks, rear hatch separation wake,
 * underbody Venturi channel, and component stall/detachment dynamics.
 */

// Global scratch vectors to prevent GC allocations during high-frequency integration
const _vTemp = new THREE.Vector3();
const _k1 = new THREE.Vector3();
const _k2 = new THREE.Vector3();
const _k3 = new THREE.Vector3();
const _k4 = new THREE.Vector3();
const _pTemp = new THREE.Vector3();

/**
 * Analytical Solid Geometry Boundary Check for the SUV
 * Returns true if point (x, y, z) is inside any solid vehicle component or below ground.
 */
export function isPointInsideVehicle(p, carParams) {
  const clearance = carParams.groundClearance || 0.18;
  const halfWidth = (carParams.width || 1.98) * 0.5;
  const height = carParams.height || 1.65;

  // 1. Ground Plane Collision (y < 0 is solid ground)
  if (p.y <= 0.02) {
    return true;
  }

  // 2. SUV Main Chassis / Body Longitudinal Span (Z from -2.35m to +2.35m)
  if (p.z > 2.35 || p.z < -2.35 || Math.abs(p.x) > halfWidth + 0.08) {
    return false;
  }

  // 3. Front Splitter / Lower Lip (Z in [1.9, 2.35], Y in [clearance - 0.04, clearance + 0.12])
  if (p.z >= 1.9 && p.z <= 2.35) {
    if (Math.abs(p.x) <= halfWidth + 0.02 && p.y >= clearance - 0.04 && p.y <= clearance + 0.14) {
      return true;
    }
  }

  // 4. Front Bumper & Radiator Nose (Z in [1.7, 2.25], Y in [clearance, 0.85])
  if (p.z >= 1.7 && p.z <= 2.25) {
    const noseWidth = halfWidth * (0.85 + (2.25 - p.z) * 0.15);
    if (Math.abs(p.x) <= noseWidth && p.y >= clearance && p.y <= 0.85) {
      return true;
    }
  }

  // 5. Hood & Front Fenders (Z in [0.75, 1.75])
  if (p.z >= 0.75 && p.z < 1.7) {
    // Hood slopes up from Y=0.85 at front to Y=1.05 at cowl
    const hoodProgress = (1.7 - p.z) / 0.95;
    const hoodHeight = 0.85 + hoodProgress * 0.20;
    if (Math.abs(p.x) <= halfWidth && p.y >= clearance && p.y <= hoodHeight) {
      return true;
    }
  }

  // 6. Raked Windshield and A-Pillars (Z in [0.15, 0.75])
  if (p.z >= 0.15 && p.z < 0.75) {
    const wsProgress = (0.75 - p.z) / 0.60;
    const wsHeight = 1.05 + wsProgress * 0.55; // from 1.05m to 1.60m
    const cabinWidth = halfWidth * (1.0 - wsProgress * 0.10);
    if (Math.abs(p.x) <= cabinWidth && p.y >= clearance && p.y <= wsHeight) {
      return true;
    }
  }

  // 7. SUV Roof & Cabin Greenhouse (Z in [-1.45, 0.15])
  if (p.z >= -1.45 && p.z < 0.15) {
    const roofHeight = height; // ~1.65m
    const cabinWidth = halfWidth * 0.92;
    if (Math.abs(p.x) <= cabinWidth && p.y >= clearance && p.y <= roofHeight) {
      return true;
    }
  }

  // 8. Angled SUV Rear Hatch / Tailgate (Z in [-2.25, -1.45])
  if (p.z >= -2.25 && p.z < -1.45) {
    const hatchProgress = (-1.45 - p.z) / 0.80; // 0 at roof trailing edge, 1 at bumper
    const hatchHeight = height - hatchProgress * 0.80; // slopes from 1.65m down to 0.85m
    const hatchWidth = halfWidth * (0.92 - hatchProgress * 0.05);
    if (Math.abs(p.x) <= hatchWidth && p.y >= clearance && p.y <= hatchHeight) {
      return true;
    }
  }

  // 9. Rear Bumper & Diffuser Section (Z in [-2.35, -1.5], Y in [clearance, 0.85])
  if (p.z >= -2.35 && p.z <= -1.5) {
    const diffuserAngleRad = ((carParams.diffuserAngle || 9.0) * Math.PI) / 180;
    const rampSlope = Math.tan(diffuserAngleRad);
    const underFloorY = clearance + Math.max(0, (-1.5 - p.z) * rampSlope);
    if (Math.abs(p.x) <= halfWidth * 0.88 && p.y >= underFloorY && p.y <= 0.85) {
      return true;
    }
  }

  // 10. Roof Spoiler / Rear Wing (Z in [-1.90, -1.40], Y in [height - 0.04, height + 0.22])
  if (p.z >= -1.90 && p.z <= -1.40) {
    const wingSpan = carParams.rearWingSpan || 1.65;
    if (Math.abs(p.x) <= wingSpan * 0.5) {
      const wingAOA = ((carParams.rearWingAOA || 11.5) * Math.PI) / 180;
      const wingMidZ = -1.65;
      const wingY = height + 0.06 - Math.tan(wingAOA) * (p.z - wingMidZ);
      if (Math.abs(p.y - wingY) < 0.045) {
        return true;
      }
    }
  }

  // 11. Wheels (4 Cylinders/Boxes)
  const wheelX = halfWidth - 0.05;
  const wheelR = 0.38;
  const wheelW = 0.28;
  const frontZ = 1.40;
  const rearZ = -1.45;
  const wheelY = 0.38;

  const inWheelFL = Math.abs(p.x - -wheelX) < wheelW && Math.hypot(p.z - frontZ, p.y - wheelY) < wheelR;
  const inWheelFR = Math.abs(p.x - wheelX) < wheelW && Math.hypot(p.z - frontZ, p.y - wheelY) < wheelR;
  const inWheelRL = Math.abs(p.x - -wheelX) < wheelW && Math.hypot(p.z - rearZ, p.y - wheelY) < wheelR;
  const inWheelRR = Math.abs(p.x - wheelX) < wheelW && Math.hypot(p.z - rearZ, p.y - wheelY) < wheelR;

  if (inWheelFL || inWheelFR || inWheelRL || inWheelRR) {
    return true;
  }

  return false;
}

/**
 * Projects a penetrating particle back outside to the nearest valid fluid domain point.
 */
export function projectOutOfSolid(p, carParams) {
  const clearance = carParams.groundClearance || 0.18;
  const halfWidth = (carParams.width || 1.98) * 0.5;
  const height = carParams.height || 1.65;

  // Ground plane clamp
  if (p.y < 0.025) {
    p.y = 0.03;
    return p;
  }

  // Calculate local upper surface envelope at longitudinal position z
  let topY = height;
  if (p.z > 1.7) {
    topY = 0.86; // front nose & grill
  } else if (p.z > 0.75) {
    topY = 0.86 + ((1.7 - p.z) / 0.95) * 0.22; // hood
  } else if (p.z > 0.15) {
    topY = 1.08 + ((0.75 - p.z) / 0.60) * 0.55; // windshield
  } else if (p.z < -1.45) {
    topY = height - ((-1.45 - p.z) / 0.85) * 0.78; // rear hatch
  }

  if (isPointInsideVehicle(p, carParams)) {
    if (p.z > 1.6) {
      // Front zone: deflect forward in front of grill or over hood/sides
      const dTop = Math.abs(topY - p.y);
      const dFront = Math.abs(2.38 - p.z);
      const dSide = Math.abs(halfWidth + 0.08 - Math.abs(p.x));
      if (dTop <= dFront && dTop <= dSide) {
        p.y = topY + 0.05;
      } else if (dFront <= dSide) {
        p.z = 2.38;
      } else {
        p.x = Math.sign(p.x || 1) * (halfWidth + 0.09);
      }
    } else {
      const dTop = Math.abs(topY - p.y);
      const dFloor = Math.abs(p.y - clearance);
      const dSide = Math.abs(halfWidth + 0.08 - Math.abs(p.x));
      const dFront = Math.abs(2.38 - p.z);
      const dRear = Math.abs(p.z - (-2.38));

      const minD = Math.min(dTop, dFloor, dSide, dFront, dRear);
      if (minD === dTop) {
        p.y = topY + 0.05;
      } else if (minD === dSide) {
        p.x = Math.sign(p.x || 1) * (halfWidth + 0.09);
      } else if (minD === dFront) {
        p.z = 2.38;
      } else if (minD === dRear) {
        p.z = -2.38;
      } else {
        p.y = Math.max(0.03, clearance - 0.06);
      }
    }
  }

  // Double check ground floor
  if (p.y < 0.025) p.y = 0.03;

  return p;
}

/**
 * Calculates the 3D Fluid Velocity Vector (vx, vy, vz) at coordinate (x, y, z)
 * Driven by fluid dynamics equations, boundary layer displacement, potential flow deflection,
 * roof acceleration, diffuser expansion, rear hatch separation, and wing stall states.
 *
 * Incoming freestream moves along -Z direction (from inlet +Z towards outlet -Z).
 */
export function getVelocityField(pos, carParams, windTunnelParams, componentStates) {
  const vInf = windTunnelParams.windSpeed || 45.0;
  const x = pos.x;
  const y = pos.y;
  const z = pos.z;

  const clearance = carParams.groundClearance || 0.18;
  const halfWidth = (carParams.width || 1.98) * 0.5;
  const height = carParams.height || 1.65;
  const wingAOA = carParams.rearWingAOA || 11.5;
  const diffuserAngle = carParams.diffuserAngle || 9.0;

  // Baseline Freestream: flow moves purely in -Z direction
  let vx = 0.0;
  let vy = 0.0;
  let vz = -vInf;

  // -------------------------------------------------------------
  // 1. UPSTREAM FLOW & FRONT STAGNATION DEFLECTION (Z in [1.7, 4.0])
  // -------------------------------------------------------------
  if (z >= 1.7 && z <= 4.2) {
    const distFromNose = z - 2.25;
    const lateralDist = Math.abs(x);
    const _verticalDist = Math.abs(y - 0.55);

    // Stagnation pressure zone in front of SUV grill
    if (distFromNose >= -0.2 && distFromNose < 1.6 && lateralDist < halfWidth * 1.3 && y > clearance && y < 1.1) {
      const stagnationDecel = Math.exp(-distFromNose * 1.8) * Math.exp(-(lateralDist / halfWidth) * 2.0);
      vz *= Math.max(0.08, 1.0 - stagnationDecel * 0.92);

      // Deflect air laterally around blunt front corners
      const lateralPush = Math.exp(-distFromNose * 2.0) * 0.55 * vInf;
      vx += Math.sign(x || 1) * lateralPush;

      // Deflect air upward toward the hood
      const upwardPush = Math.exp(-distFromNose * 2.0) * 0.45 * vInf;
      vy += upwardPush;
    }
  }

  // -------------------------------------------------------------
  // 2. HOOD, WINDSHIELD & CABIN ACCELERATION (Z in [0.0, 2.0])
  // -------------------------------------------------------------
  if (z >= 0.0 && z <= 2.0 && Math.abs(x) < halfWidth * 1.4) {
    // Flow over hood: accelerates slightly
    if (z > 0.8 && y >= 0.85 && y < 1.35) {
      vz *= 1.08;
      // Slight upward ramp along hood line
      vy += 0.12 * vInf * ((z - 0.8) / 1.0);
    }

    // Raked Windshield: strong upward redirection and lateral spillage
    if (z >= 0.15 && z <= 0.85 && y >= 1.0 && y <= height + 0.3) {
      const wsDeflection = (0.85 - z) / 0.70;
      vy += wsDeflection * 0.48 * vInf;
      vz *= Math.max(0.65, 1.0 - wsDeflection * 0.25);
      // Lateral A-pillar vortex spillage
      vx += Math.sign(x || 1) * wsDeflection * 0.18 * vInf;
    }
  }

  // -------------------------------------------------------------
  // 3. ROOF ACCELERATION & LEADING EDGE SUCTION PEAK (Z in [-1.5, 0.4])
  // -------------------------------------------------------------
  if (z >= -1.5 && z <= 0.4 && Math.abs(x) < halfWidth * 1.3) {
    const distAboveRoof = y - height;
    if (distAboveRoof >= 0.0 && distAboveRoof < 0.65) {
      // Bernoulli suction acceleration over front roof curve
      const suctionFactor = Math.exp(-distAboveRoof * 3.5);
      const longitudinalProfile = Math.exp(-Math.pow((z - 0.05) / 0.6, 2));
      vz *= (1.0 + 0.28 * suctionFactor * longitudinalProfile);
      
      // Slight downward curvature following roofline taper
      if (z < -0.6) {
        vy -= 0.08 * vInf * suctionFactor;
      }
    }
  }

  // -------------------------------------------------------------
  // 4. UNDERBODY VENTURI CHANNEL & DIFFUSER EXPANSION (Z in [-2.4, 2.0], Y < clearance + 0.2)
  // -------------------------------------------------------------
  if (y <= clearance + 0.25 && Math.abs(x) < halfWidth) {
    // Underbody ground effect channel acceleration
    if (z > -1.4 && z < 1.6) {
      const groundSuctionBoost = Math.min(1.35, 1.0 + (0.18 - clearance) * 1.8);
      vz *= groundSuctionBoost;
    }

    // Diffuser section (Z from -1.4 down to -2.35)
    if (z <= -1.4 && z >= -2.35) {
      const isDiffuserSeparated = componentStates?.diffuser === 'SEPARATED';
      
      if (!isDiffuserSeparated) {
        // Attached flow: smooth expansion, flow upswept along diffuser angle
        const rampAngleRad = (diffuserAngle * Math.PI) / 180;
        const rampSlope = Math.tan(rampAngleRad);
        vy += rampSlope * Math.abs(vz) * 0.75;
        // Moderate pressure recovery deceleration
        vz *= Math.max(0.65, 1.0 - ((-1.4 - z) / 0.95) * 0.25);
      } else {
        // SEPARATED DIFFUSER: boundary layer detachment, turbulent eddy reversal!
        const sepFactor = Math.min(1.0, (diffuserAngle - 12.0) / 4.0);
        // Flow detaches from ramp: upward velocity collapses
        vy *= 0.15;
        // Strong reverse flow / recirculation eddy near floor
        if (y < clearance + 0.15) {
          vz = +vInf * 0.25 * sepFactor; // FLOW REVERSAL towards vehicle!
          // Chaotic lateral swirl
          vx += Math.sin(z * 12.0 + x * 8.0) * 0.25 * vInf * sepFactor;
        } else {
          vz *= 0.45; // sluggish detached wake
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 5. REAR ROOF WING & SPOILER AERO DYNAMICS (Z in [-2.0, -1.35], Y in [height - 0.1, height + 0.4])
  // -------------------------------------------------------------
  const isWingStalled = componentStates?.rearWing === 'STALLED';
  const wingSpan = carParams.rearWingSpan || 1.65;

  if (z <= -1.35 && z >= -2.05 && Math.abs(x) <= wingSpan * 0.58 && y >= height - 0.08 && y <= height + 0.35) {
    if (!isWingStalled) {
      // Attached flow: wing camber induces strong downwash behind the spoiler
      const wingAoaRad = (wingAOA * Math.PI) / 180;
      const downwashStrength = Math.sin(wingAoaRad) * 0.65;
      vy -= downwashStrength * vInf * ((-1.35 - z) / 0.70);
      // Wing tip vortices at outer edges
      const edgeDist = Math.abs(x) - (wingSpan * 0.5 - 0.12);
      if (edgeDist > 0) {
        vy += Math.sin(edgeDist * 20.0) * 0.20 * vInf;
      }
    } else {
      // STALLED WING: massive upper-surface flow detachment!
      const stallDelta = wingAOA - 14.5;
      const stallSeverity = Math.min(1.0, stallDelta / 5.0);

      // Downwash collapses and turns into upward separated turbulence
      vy = +vInf * 0.35 * stallSeverity;
      // Drastic velocity loss and recirculation pocket immediately behind wing
      vz = -vInf * 0.15 + (Math.cos(y * 15.0) * 0.22 * vInf * stallSeverity);
      // Unsteady lateral shedding
      vx += Math.sin(z * 14.0 + y * 10.0) * 0.30 * vInf * stallSeverity;
    }
  }

  // -------------------------------------------------------------
  // 6. SUV BLUFF-BODY RECIRCULATING WAKE (Z in [-5.5, -2.25])
  // -------------------------------------------------------------
  if (z < -2.25) {
    const distDownstream = -2.25 - z; // 0 to 3.25m
    
    // Wake expands laterally and vertically downstream
    let wakeWidth = halfWidth * (1.15 + distDownstream * 0.16);
    let wakeTop = height * (1.05 + distDownstream * 0.12);
    let wakeBottom = 0.04;

    // Wing stall expands wake ceiling dramatically upward
    if (isWingStalled) {
      wakeTop += 0.35 + distDownstream * 0.18;
    }
    // Diffuser separation expands lower wake downward and outwards
    if (componentStates?.diffuser === 'SEPARATED') {
      wakeWidth += 0.22;
      wakeBottom = 0.02;
    }

    const inWake = Math.abs(x) <= wakeWidth && y >= wakeBottom && y <= wakeTop;

    if (inWake) {
      const coreFactor = (1.0 - Math.abs(x) / wakeWidth) * (1.0 - Math.abs(y - height * 0.5) / (height * 0.65));
      const normalizedCore = Math.max(0.0, Math.min(1.0, coreFactor));

      // Near-wake recirculation bubble (within 1.4m behind the SUV hatch)
      if (distDownstream < 1.45) {
        // Toroidal reverse flow eddy circulating back towards the tailgate
        const recircMagnitude = Math.exp(-distDownstream * 1.5) * normalizedCore;
        vz = +vInf * 0.32 * recircMagnitude - vInf * 0.25 * (1.0 - recircMagnitude);
        
        // Toroidal rotation: top flows down into wake, bottom flows up
        const verticalCenter = height * 0.52;
        vy += Math.sign(verticalCenter - y) * 0.22 * vInf * normalizedCore;

        // Inward vortex roll-up from vehicle sides
        vx += -Math.sign(x || 1) * 0.18 * vInf * normalizedCore;
      } else {
        // Far wake: velocity deficit recovering slowly downstream
        const recovery = Math.min(1.0, (distDownstream - 1.45) / 2.8);
        vz = -vInf * (0.35 + recovery * 0.45);
        
        // Residual turbulence
        vx += (Math.sin(z * 6.0) * 0.08 * vInf) * normalizedCore;
        vy += (Math.cos(z * 6.0) * 0.06 * vInf) * normalizedCore;
      }

      // If either wing stalled or diffuser separated, wake turbulence is amplified
      if (isWingStalled || componentStates?.diffuser === 'SEPARATED') {
        const extraTurb = (isWingStalled ? 0.22 : 0.0) + (componentStates?.diffuser === 'SEPARATED' ? 0.18 : 0.0);
        vx += (Math.sin(x * 10.0 + z * 8.0) * extraTurb * vInf) * normalizedCore;
        vy += (Math.cos(y * 8.0 + z * 8.0) * extraTurb * vInf) * normalizedCore;
        vz *= (1.0 - extraTurb * 0.4);
      }
    }
  }

  // Clamping for numerical stability
  _vTemp.set(
    Math.max(-vInf * 1.5, Math.min(vInf * 1.5, vx)),
    Math.max(-vInf * 1.5, Math.min(vInf * 1.5, vy)),
    Math.max(-vInf * 1.8, Math.min(vInf * 0.6, vz))
  );

  return _vTemp;
}

/**
 * 4th-Order Runge-Kutta (RK4) Numerical Streamline Integrator
 * Solves: dx/dt = V(x, y, z)
 * Provides smooth, deterministic, boundary-respecting tracer trajectories.
 */
export function rk4Integrate(pos, dt, carParams, windTunnelParams, componentStates) {
  // Clamp timestep for numerical stability
  const safeDt = Math.max(0.002, Math.min(0.035, dt));

  // k1 = f(p)
  const v1 = getVelocityField(pos, carParams, windTunnelParams, componentStates);
  _k1.copy(v1);

  // k2 = f(p + 0.5 * dt * k1)
  _pTemp.copy(pos).addScaledVector(_k1, 0.5 * safeDt);
  const v2 = getVelocityField(_pTemp, carParams, windTunnelParams, componentStates);
  _k2.copy(v2);

  // k3 = f(p + 0.5 * dt * k2)
  _pTemp.copy(pos).addScaledVector(_k2, 0.5 * safeDt);
  const v3 = getVelocityField(_pTemp, carParams, windTunnelParams, componentStates);
  _k3.copy(v3);

  // k4 = f(p + dt * k3)
  _pTemp.copy(pos).addScaledVector(_k3, safeDt);
  const v4 = getVelocityField(_pTemp, carParams, windTunnelParams, componentStates);
  _k4.copy(v4);

  // next_pos = p + (dt / 6) * (k1 + 2*k2 + 2*k3 + k4)
  const nextPos = pos.clone();
  nextPos.x += (safeDt / 6.0) * (_k1.x + 2.0 * _k2.x + 2.0 * _k3.x + _k4.x);
  nextPos.y += (safeDt / 6.0) * (_k1.y + 2.0 * _k2.y + 2.0 * _k3.y + _k4.y);
  nextPos.z += (safeDt / 6.0) * (_k1.z + 2.0 * _k2.z + 2.0 * _k3.z + _k4.z);

  // Solid obstacle collision check & projection
  if (isPointInsideVehicle(nextPos, carParams)) {
    projectOutOfSolid(nextPos, carParams);
  }

  // Floor boundary check
  if (nextPos.y < 0.025) {
    nextPos.y = 0.03;
  }

  return nextPos;
}

/**
 * Calculates aerodynamic pressure coefficient Cp = (p - p_inf) / (0.5 * rho * V_inf^2)
 * Normalized Cp ranges from -1.5 (strong suction/accelerated flow) to +1.0 (stagnation point).
 */
export function calculatePressureCoefficient(pos, normal, carParams, windTunnelParams, componentStates) {
  const vInf = windTunnelParams.windSpeed || 45.0;
  const vel = getVelocityField(pos, carParams, windTunnelParams, componentStates);
  const speed = vel.length();

  // Bernoulli relation for inviscid potential core: Cp = 1 - (V / V_inf)^2
  let cp = 1.0 - Math.pow(speed / Math.max(1.0, vInf), 2);

  // Normal alignment with incoming flow (-Z direction)
  if (normal) {
    const alignment = normal.z; // faces inlet if normal.z > 0
    if (alignment > 0.4 && pos.z > 1.6) {
      // Upstream forward-facing surface -> stagnation
      cp = Math.max(cp, alignment * 0.95);
    }
  }

  // Stalled rear wing suction collapse
  if (componentStates?.rearWing === 'STALLED' && pos.z < -1.4 && pos.y > 1.5) {
    cp = Math.max(-0.15, cp * 0.35); // suction lost on upper wing
  }

  // Separated diffuser suction collapse
  if (componentStates?.diffuser === 'SEPARATED' && pos.z < -1.5 && pos.y < 0.35) {
    cp = Math.max(-0.05, cp * 0.25);
  }

  return Math.max(-1.8, Math.min(1.0, cp));
}
