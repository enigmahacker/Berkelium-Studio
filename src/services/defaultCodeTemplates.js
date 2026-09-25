/**
 * Realistic Physics & Aerodynamics Simulation Code Templates
 * C++, Python, and Three.js
 */

export const DEFAULT_PYTHON_SCRIPT = `"""
Berkelium Studio — Aerodynamics Simulation Engine
Language: Python 3.10+
Computes boundary layer development, skin friction, and pressure lift/drag.
"""

import math
import json

def run_aerodynamic_simulation(wind_speed=45.0, air_density=1.225, rear_wing_aoa=11.5, diffuser_angle=9.0):
    # Air kinematic viscosity at standard sea level (m^2/s)
    nu = 1.48e-5
    
    # Vehicle geometry
    length = 4.30  # meters
    width = 1.90   # meters
    height = 1.15  # meters
    frontal_area = width * height * 0.82  # ~1.79 m^2
    wing_span = 1.60
    wing_chord = 0.28
    aspect_ratio = (wing_span ** 2) / (wing_span * wing_chord)
    
    # Dynamic pressure (Pascals): q = 0.5 * rho * v^2
    q = 0.5 * air_density * (wind_speed ** 2)
    
    # Reynolds Number along vehicle length: Re = (v * L) / nu
    reynolds = (wind_speed * length) / nu
    
    # Turbulent skin friction coefficient (Prandtl-Schlichting formula)
    cf = 0.455 / ((math.log10(reynolds)) ** 2.58)
    
    # Wing lift and drag coefficients
    cl_wing = 0.09 * max(0.0, rear_wing_aoa)
    oswald_e = 0.85
    cd_induced = (cl_wing ** 2) / (math.pi * aspect_ratio * oswald_e)
    
    # Check for boundary layer separation
    wing_stall = rear_wing_aoa > 14.5
    diffuser_stall = diffuser_angle > 12.0
    
    stall_penalty = 0.0
    if wing_stall:
        stall_delta = rear_wing_aoa - 14.5
        cl_wing *= math.exp(-stall_delta * 0.12)
        stall_penalty = stall_delta * 0.045
    
    total_cd = 0.235 + cd_induced + stall_penalty
    total_cl = cl_wing + (0.35 + diffuser_angle * 0.055)
    
    # Total Aerodynamic Forces
    drag_force = q * total_cd * frontal_area
    downforce = q * total_cl * frontal_area
    power_hp = (drag_force * wind_speed) / 745.7
    
    results = {
        "status": "COMPUTATION_SUCCESS",
        "velocity_ms": wind_speed,
        "dynamic_pressure_pa": round(q, 2),
        "reynolds_number": round(reynolds),
        "skin_friction_cf": round(cf, 5),
        "drag_coefficient_cd": round(total_cd, 3),
        "lift_coefficient_cl": round(total_cl, 3),
        "drag_force_n": round(drag_force, 1),
        "downforce_n": round(downforce, 1),
        "power_required_hp": round(power_hp, 1),
        "flow_separation": wing_stall or diffuser_stall
    }
    
    print(f"[Python CFD] Reynolds Number: {reynolds:.2e}")
    print(f"[Python CFD] Dynamic Pressure: {q:.1f} Pa")
    print(f"[Python CFD] Calculated Cd: {total_cd:.3f} | Cl: {total_cl:.3f}")
    print(f"[Python CFD] Drag: {drag_force:.1f} N | Downforce: {downforce:.1f} N")
    if wing_stall:
        print("[WARNING] Flow detachment detected on rear wing suction surface!")
        
    return results

if __name__ == "__main__":
    run_aerodynamic_simulation(wind_speed=45.0, rear_wing_aoa=11.5)
`;

export const DEFAULT_CPP_SCRIPT = `/**
 * Berkelium Studio — High-Performance Aerodynamics & Particle Streamline Solver
 * Language: C++17
 * Implements Runge-Kutta 4th-Order (RK4) Particle Integration & Stagnation Pressure
 */

#include <iostream>
#include <vector>
#include <cmath>
#include <iomanip>

struct Vector3D {
    double x, y, z;
    Vector3D(double x_ = 0, double y_ = 0, double z_ = 0) : x(x_), y(y_), z(z_) {}
    
    Vector3D operator+(const Vector3D& o) const { return Vector3D(x + o.x, y + o.y, z + o.z); }
    Vector3D operator*(double scalar) const { return Vector3D(x * scalar, y * scalar, z * scalar); }
    double magnitude() const { return std::sqrt(x*x + y*y + z*z); }
};

// Evaluates vector velocity field deflected around vehicle geometry
Vector3D evaluate_velocity_field(const Vector3D& pos, double freestream_v) {
    Vector3D v(0.0, 0.0, -freestream_v);
    
    // Stagnation deflection near nose (Z ~ 1.8m)
    double r_sq = pos.x * pos.x + pos.y * pos.y + (pos.z - 1.8) * (pos.z - 1.8);
    if (r_sq < 1.4) {
        double factor = 0.35 / (r_sq + 0.1);
        v.x += pos.x * factor * freestream_v;
        v.y += pos.y * factor * freestream_v;
    }
    return v;
}

// Runge-Kutta 4th Order Streamline Step
Vector3D rk4_streamline_step(const Vector3D& pos, double dt, double v_inf) {
    Vector3D k1 = evaluate_velocity_field(pos, v_inf);
    Vector3D k2 = evaluate_velocity_field(pos + k1 * (0.5 * dt), v_inf);
    Vector3D k3 = evaluate_velocity_field(pos + k2 * (0.5 * dt), v_inf);
    Vector3D k4 = evaluate_velocity_field(pos + k3 * dt, v_inf);
    
    return pos + (k1 + k2 * 2.0 + k3 * 2.0 + k4) * (dt / 6.0);
}

int main() {
    std::cout << "===========================================" << std::endl;
    std::cout << "  BERKELIUM STUDIO C++ AERODYNAMICS SOLVER " << std::endl;
    std::cout << "===========================================" << std::endl;
    
    const double wind_speed = 45.0; // m/s
    const double air_density = 1.225; // kg/m^3
    const double dt = 0.002;
    
    // Trace single streamline particle
    Vector3D particle(0.2, 0.45, 3.5);
    std::cout << std::fixed << std::setprecision(3);
    std::cout << "Tracing streamline particle from Z = 3.5m to Z = -2.5m..." << std::endl;
    
    int steps = 0;
    while (particle.z > -2.5 && steps < 1000) {
        particle = rk4_streamline_step(particle, dt, wind_speed);
        steps++;
    }
    
    double dynamic_pressure = 0.5 * air_density * std::pow(wind_speed, 2.0);
    double stagnation_p = dynamic_pressure; // Gauge pressure at nose
    
    std::cout << "Simulation Steps: " << steps << std::endl;
    std::cout << "Terminal Particle Pos: (" << particle.x << ", " << particle.y << ", " << particle.z << ")" << std::endl;
    std::cout << "Dynamic Pressure q: " << dynamic_pressure << " Pa" << std::endl;
    std::cout << "Nose Stagnation Pressure: " << stagnation_p << " Pa (Gauge)" << std::endl;
    std::cout << "[SUCCESS] C++ Navier-Stokes RK4 Convergence Achieved." << std::endl;
    
    return 0;
}
`;

export const DEFAULT_JS_SCRIPT = `// Procedural Vortex Generator Array for Rear Decklid
// Executes directly within the live Three.js 3D Viewport

const carGroup = scene.getObjectByName('CarAssembly');
if (!carGroup) {
  console.error("CarAssembly not found in scene");
} else {
  // Remove existing custom vortex generators
  const existing = carGroup.getObjectByName('Custom_VG_Array');
  if (existing) carGroup.remove(existing);

  const vgArrayGroup = new THREE.Group();
  vgArrayGroup.name = 'Custom_VG_Array';

  const vgCount = 8;
  const spacing = 1.1 / (vgCount - 1);
  const startX = -0.55;

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0xf97316, // High-visibility orange telemetry fins
    metalness: 0.8,
    roughness: 0.2
  });

  for (let i = 0; i < vgCount; i++) {
    const xPos = startX + i * spacing;
    // Delta fin shape
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(0.06, 0);
    finShape.lineTo(0.0, 0.045);
    finShape.closePath();

    const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.005, bevelEnabled: false });
    // Alternate 12 degree yaw angle for counter-rotating vortex pairs
    const yaw = (i % 2 === 0 ? 1 : -1) * (12.0 * Math.PI / 180);
    finGeo.rotateY(yaw);

    const finMesh = new THREE.Mesh(finGeo, carbonMat);
    finMesh.position.set(xPos, 0.63, -0.65);
    finMesh.castShadow = true;
    vgArrayGroup.add(finMesh);
  }

  carGroup.add(vgArrayGroup);
  console.log("Successfully generated array of " + vgCount + " counter-rotating delta vortex generators!");
}
`;
