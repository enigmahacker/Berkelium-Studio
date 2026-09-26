"""
Berkelium Studio — Aerodynamics Simulation Engine
Language: Python 3.10+
Reduced-Order Aerodynamic Model (Analytical Momentum & Boundary Layer Solver)
Computes dynamic pressure, Reynolds number, skin friction, and lift/drag forces.
"""

import math
import json
import sys

def run_aerodynamic_simulation(
    wind_speed=45.0,
    air_density=1.225,
    rear_wing_aoa=11.5,
    diffuser_angle=9.0,
    wheelbase=2.85,
    width=1.98,
    height=1.65,
    ground_clearance=0.18
):
    """
    Executes reduced-order aerodynamic analysis for performance vehicles.
    
    Inputs:
        wind_speed: Freestream velocity V_inf (m/s)
        air_density: Ambient air density rho (kg/m^3)
        rear_wing_aoa: Rear wing angle of attack (degrees)
        diffuser_angle: Rear diffuser expansion ramp angle (degrees)
        wheelbase: Vehicle wheelbase (m)
        width: Vehicle width (m)
        height: Vehicle height (m)
        ground_clearance: Ride height (m)
        
    Outputs:
        Scalar telemetry dictionary including Cd, Cl, Drag force, Downforce, Power.
        NOTE: This analytical model calculates scalar parameters, NOT a 3D velocity field.
    """
    # Air kinematic viscosity at standard sea level (m^2/s)
    nu = 1.48e-5
    
    # Vehicle geometry
    length = 4.80  # Full length (m)
    frontal_area = width * height * 0.84  # Frontal area ~2.75 m^2 for performance SUV
    wing_span = 1.70
    wing_chord = 0.32
    aspect_ratio = (wing_span ** 2) / (wing_span * wing_chord)
    
    # 1. Dynamic pressure (Pascals): q = 0.5 * rho * v^2
    q = 0.5 * air_density * (wind_speed ** 2)
    
    # 2. Reynolds Number along vehicle length: Re = (v * L) / nu
    reynolds = (wind_speed * length) / nu
    
    # 3. Turbulent skin friction coefficient (Prandtl-Schlichting formula)
    cf = 0.455 / ((math.log10(reynolds)) ** 2.58)
    
    # 4. Wing lift and drag coefficients
    cl_wing = 0.085 * max(0.0, rear_wing_aoa)
    oswald_e = 0.82
    cd_induced = (cl_wing ** 2) / (math.pi * aspect_ratio * oswald_e)
    
    # 5. Boundary layer separation checks
    wing_stall = rear_wing_aoa > 14.5
    diffuser_stall = diffuser_angle > 12.0
    floor_choke = ground_clearance < 0.06
    
    stall_penalty = 0.0
    if wing_stall:
        stall_delta = rear_wing_aoa - 14.5
        cl_wing *= math.exp(-stall_delta * 0.14)
        stall_penalty += stall_delta * 0.048
    
    if diffuser_stall:
        diffuser_delta = diffuser_angle - 12.0
        stall_penalty += diffuser_delta * 0.035
        
    if floor_choke:
        stall_penalty += 0.08
    
    # Base SUV Bluff Body Drag
    base_cd = 0.320
    total_cd = base_cd + cd_induced + stall_penalty
    
    # Lift / Downforce calculation (positive Cl = downforce in race aero convention)
    diffuser_downforce = max(0.0, diffuser_angle * 0.042)
    if diffuser_stall:
        diffuser_downforce *= 0.65
        
    underbody_downforce = 0.12 if not floor_choke else -0.05
    total_cl = cl_wing + diffuser_downforce + underbody_downforce
    
    # Total Aerodynamic Forces
    drag_force = q * total_cd * frontal_area
    downforce = q * total_cl * frontal_area
    power_hp = (drag_force * wind_speed) / 745.7
    power_kw = (drag_force * wind_speed) / 1000.0
    
    flow_separation = wing_stall or diffuser_stall or floor_choke
    
    results = {
        "status": "COMPUTATION_SUCCESS",
        "engine": "Reduced-Order Aerodynamic Model (Python)",
        "source": "simulation.py",
        "velocity_ms": float(wind_speed),
        "air_density": float(air_density),
        "frontal_area_m2": round(frontal_area, 3),
        "dynamic_pressure_pa": round(q, 2),
        "reynolds_number": round(reynolds),
        "skin_friction_cf": round(cf, 5),
        "drag_coefficient_cd": round(total_cd, 3),
        "lift_coefficient_cl": round(total_cl, 3),
        "drag_force_n": round(drag_force, 1),
        "downforce_n": round(downforce, 1),
        "power_required_hp": round(power_hp, 1),
        "power_required_kw": round(power_kw, 1),
        "flow_separation": bool(flow_separation),
        "wing_stall": bool(wing_stall),
        "diffuser_stall": bool(diffuser_stall),
        "floor_choke": bool(floor_choke)
    }
    
    return results

if __name__ == "__main__":
    speed = float(sys.argv[1]) if len(sys.argv) > 1 else 45.0
    wing = float(sys.argv[2]) if len(sys.argv) > 2 else 11.5
    diffuser = float(sys.argv[3]) if len(sys.argv) > 3 else 9.0
    res = run_aerodynamic_simulation(wind_speed=speed, rear_wing_aoa=wing, diffuser_angle=diffuser)
    print(json.dumps(res, indent=2))
