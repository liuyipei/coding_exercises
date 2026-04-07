/**
 * Soccer ball trajectory simulator (turf) with hybrid modes:
 * FLIGHT -> IMPACT -> (FLIGHT | GROUND) -> ROLL -> STOP
 *
 * Design goals:
 * - Brief, readable model suitable for experimentation.
 * - Fail loudly on invalid inputs.
 */

export type Mode = "FLIGHT" | "IMPACT" | "GROUND" | "ROLL" | "STOP";

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface LaunchConditions {
  speedMs: number;
  elevationDeg: number;
  azimuthDeg: number;
  spinRadS: Vector3;
  startHeightM: number;
}

export interface TrajectorySample {
  t: number;
  mode: Mode;
  x: Vector3;
  v: Vector3;
}

export interface SimulationResult {
  totalDistanceM: number;
  horizontalDistanceM: number;
  rollDistanceM: number;
  bounces: number;
  timeToRestS: number;
  samples: TrajectorySample[];
}

export interface SweepCase {
  launch: LaunchConditions;
  result: SimulationResult;
}

interface State {
  x: Vector3;
  v: Vector3;
  w: Vector3;
  mode: Mode;
  t: number;
}

interface ModelParams {
  massKg: number;
  radiusM: number;
  inertiaKgM2: number;
  rhoAir: number;
  g: number;
  highDrag: number;
  lowDrag: number;
  criticalSpeedMs: number;
  kLift: number;
  maxLift: number;
  restitutionNormal: number;
  retentionTangential: number;
  rollingDeceleration: number;
  kineticFriction: number;
  spinCoupling: number;
  dt: number;
  maxTimeS: number;
  bounceThresholdMs: number;
  stopSpeedMs: number;
  slipToleranceMs: number;
}

const DEFAULTS: ModelParams = {
  massKg: 0.43,
  radiusM: 0.11,
  inertiaKgM2: (2 / 5) * 0.43 * 0.11 * 0.11,
  rhoAir: 1.2,
  g: 9.81,
  highDrag: 0.45,
  lowDrag: 0.25,
  criticalSpeedMs: 18,
  kLift: 1.2,
  maxLift: 0.35,
  restitutionNormal: 0.48,
  retentionTangential: 0.82,
  rollingDeceleration: 0.9,
  kineticFriction: 0.38,
  spinCoupling: 0.045,
  dt: 0.005,
  maxTimeS: 20,
  bounceThresholdMs: 0.8,
  stopSpeedMs: 0.05,
  slipToleranceMs: 0.08,
};

export class SoccerBallTrajectoryModel {
  private readonly p: ModelParams;

  public constructor(overrides: Partial<ModelParams> = {}) {
    this.p = { ...DEFAULTS, ...overrides };
    validateModelParams(this.p);
  }

  public simulate(launch: LaunchConditions): SimulationResult {
    validateLaunch(launch);

    let s = this.initialState(launch);
    let bounces = 0;
    let totalDistanceM = 0;
    let rollStartDistanceM: number | null =
      s.mode === "FLIGHT" ? null : horizontalNorm(s.x);
    const samples: TrajectorySample[] = [snapshot(s)];

    while (s.mode !== "STOP" && s.t < this.p.maxTimeS) {
      const prevX = s.x;

      if (s.mode === "FLIGHT") {
        s = this.stepFlight(s);
        if (s.x.y <= 0 && s.v.y < 0) {
          s.x.y = 0;
          s.mode = "IMPACT";
        }
      }

      if (s.mode === "IMPACT") {
        s = this.stepImpact(s);
        if (Math.abs(s.v.y) > this.p.bounceThresholdMs) {
          bounces += 1;
          s.mode = "FLIGHT";
        } else {
          s.v.y = 0;
          s.mode = "GROUND";
          rollStartDistanceM ??= horizontalNorm(s.x);
        }
      }

      if (s.mode === "GROUND") {
        s = this.stepGround(s);
        if (norm(this.relativeSlipVector(s)) < this.p.slipToleranceMs) {
          s.mode = "ROLL";
        }
      }

      if (s.mode === "ROLL") {
        s = this.stepRoll(s);
      }

      if (s.mode !== "FLIGHT" && horizontalNorm(s.v) < this.p.stopSpeedMs) {
        s.mode = "STOP";
      }

      totalDistanceM += horizontalNorm(sub(s.x, prevX));
      samples.push(snapshot(s));
    }

    const horizontalDistanceM = horizontalNorm(s.x);
    return {
      totalDistanceM,
      horizontalDistanceM,
      rollDistanceM: rollStartDistanceM === null ? 0 : Math.max(0, horizontalDistanceM - rollStartDistanceM),
      bounces,
      timeToRestS: s.t,
      samples,
    };
  }

  public parameterSweep(speeds: number[], anglesDeg: number[], spinRatesRadS: number[], azimuthDeg = 0): SweepCase[] {
    assert(speeds.length > 0, "speeds must be non-empty");
    assert(anglesDeg.length > 0, "anglesDeg must be non-empty");
    assert(spinRatesRadS.length > 0, "spinRatesRadS must be non-empty");

    return speeds.flatMap((speedMs) =>
      anglesDeg.flatMap((elevationDeg) =>
        spinRatesRadS.map((spinY) => {
          const launch: LaunchConditions = {
            speedMs,
            elevationDeg,
            azimuthDeg,
            spinRadS: { x: 0, y: spinY, z: 0 },
            startHeightM: 0.2,
          };
          return { launch, result: this.simulate(launch) };
        }),
      ),
    );
  }

  private initialState(launch: LaunchConditions): State {
    const elev = degToRad(launch.elevationDeg);
    const az = degToRad(launch.azimuthDeg);
    const vh = launch.speedMs * Math.cos(elev);
    const v: Vector3 = { x: vh * Math.cos(az), y: launch.speedMs * Math.sin(elev), z: vh * Math.sin(az) };
    const airborne = launch.startHeightM > 0 || v.y > 0;

    const state: State = {
      x: { x: 0, y: launch.startHeightM, z: 0 },
      v,
      w: launch.spinRadS,
      mode: airborne ? "FLIGHT" : "GROUND",
      t: 0,
    };

    if (airborne) return state;

    state.x.y = 0;
    state.v.y = 0;

    if (horizontalNorm(state.v) < this.p.stopSpeedMs) {
      return { ...state, mode: "STOP" };
    }

    if (norm(this.relativeSlipVector(state)) < this.p.slipToleranceMs) {
      return { ...state, mode: "ROLL" };
    }

    return state;
  }

  private stepFlight(s: State): State {
    const speed = norm(s.v);
    const area = Math.PI * this.p.radiusM * this.p.radiusM;
    const cd = speed < this.p.criticalSpeedMs ? this.p.highDrag : this.p.lowDrag;
    const spinParam = (this.p.radiusM * norm(s.w)) / Math.max(speed, 1e-9);
    const cl = Math.min(this.p.maxLift, this.p.kLift * spinParam);

    const dragAcc = scale(normalizeOrZero(s.v), (-0.5 * this.p.rhoAir * area * cd * speed * speed) / this.p.massKg);
    const magnusDir = normalizeOrZero(cross(s.w, s.v));
    const liftAcc = scale(magnusDir, (0.5 * this.p.rhoAir * area * cl * speed * speed) / this.p.massKg);

    const acc = add({ x: 0, y: -this.p.g, z: 0 }, add(dragAcc, liftAcc));
    const nextV = add(s.v, scale(acc, this.p.dt));

    return {
      ...s,
      x: add(s.x, scale(nextV, this.p.dt)),
      v: nextV,
      t: s.t + this.p.dt,
    };
  }

  private stepImpact(s: State): State {
    const n = UP;
    const vN = scale(n, dot(s.v, n));
    const vT = sub(s.v, vN);

    const vNPlus = scale(vN, -this.p.restitutionNormal);
    const vTPlus = scale(vT, this.p.retentionTangential);

    const slip = sub(vT, scale(cross(s.w, n), this.p.radiusM));
    const nextW = add(s.w, scale(slip, this.p.spinCoupling));

    return { ...s, v: add(vNPlus, vTPlus), w: nextW };
  }

  private stepGround(s: State): State {
    const rel = this.relativeSlipVector(s);
    const relMag = norm(rel);
    if (relMag < 1e-9) return { ...s, t: s.t + this.p.dt };

    const friction = scale(normalize(rel), -this.p.kineticFriction * this.p.massKg * this.p.g);
    const linearAcc = scale(friction, 1 / this.p.massKg);
    const contactOffset = scale(UP, -this.p.radiusM);
    const angularAcc = scale(cross(contactOffset, friction), 1 / this.p.inertiaKgM2);

    const nextV = add(s.v, scale(linearAcc, this.p.dt));
    return {
      ...s,
      x: { ...add(s.x, scale(nextV, this.p.dt)), y: 0 },
      v: { ...nextV, y: 0 },
      w: add(s.w, scale(angularAcc, this.p.dt)),
      t: s.t + this.p.dt,
    };
  }

  private stepRoll(s: State): State {
    const speed = horizontalNorm(s.v);
    if (speed < 1e-9) return { ...s, t: s.t + this.p.dt };

    const decel = Math.min(this.p.rollingDeceleration * this.p.dt, speed);
    const dir = normalize({ x: s.v.x, y: 0, z: s.v.z });
    const nextV: Vector3 = { x: s.v.x - dir.x * decel, y: 0, z: s.v.z - dir.z * decel };

    return {
      ...s,
      x: { ...add(s.x, scale(nextV, this.p.dt)), y: 0 },
      v: nextV,
      w: { ...s.w, y: horizontalNorm(nextV) / this.p.radiusM },
      t: s.t + this.p.dt,
    };
  }

  private relativeSlipVector(s: State): Vector3 {
    return sub(s.v, scale(cross(s.w, UP), this.p.radiusM));
  }
}

const UP: Vector3 = { x: 0, y: 1, z: 0 };

function snapshot(s: State): TrajectorySample {
  return { t: s.t, mode: s.mode, x: { ...s.x }, v: { ...s.v } };
}

function validateLaunch(launch: LaunchConditions): void {
  assertFinite(launch.speedMs, "launch.speedMs");
  assertFinite(launch.elevationDeg, "launch.elevationDeg");
  assertFinite(launch.azimuthDeg, "launch.azimuthDeg");
  assertFinite(launch.startHeightM, "launch.startHeightM");
  assertVector(launch.spinRadS, "launch.spinRadS");
  assert(launch.speedMs >= 0, "launch.speedMs must be >= 0");
  assert(launch.startHeightM >= 0, "launch.startHeightM must be >= 0");
}

function validateModelParams(p: ModelParams): void {
  const scalarChecks: Array<[number, string]> = [
    [p.massKg, "massKg"],
    [p.radiusM, "radiusM"],
    [p.inertiaKgM2, "inertiaKgM2"],
    [p.rhoAir, "rhoAir"],
    [p.g, "g"],
    [p.highDrag, "highDrag"],
    [p.lowDrag, "lowDrag"],
    [p.criticalSpeedMs, "criticalSpeedMs"],
    [p.kLift, "kLift"],
    [p.maxLift, "maxLift"],
    [p.restitutionNormal, "restitutionNormal"],
    [p.retentionTangential, "retentionTangential"],
    [p.rollingDeceleration, "rollingDeceleration"],
    [p.kineticFriction, "kineticFriction"],
    [p.spinCoupling, "spinCoupling"],
    [p.dt, "dt"],
    [p.maxTimeS, "maxTimeS"],
    [p.bounceThresholdMs, "bounceThresholdMs"],
    [p.stopSpeedMs, "stopSpeedMs"],
    [p.slipToleranceMs, "slipToleranceMs"],
  ];

  for (const [value, name] of scalarChecks) assertFinite(value, name);

  assert(p.massKg > 0, "massKg must be > 0");
  assert(p.radiusM > 0, "radiusM must be > 0");
  assert(p.inertiaKgM2 > 0, "inertiaKgM2 must be > 0");
  assert(p.dt > 0, "dt must be > 0");
  assert(p.maxTimeS > 0, "maxTimeS must be > 0");
  assert(p.restitutionNormal >= 0 && p.restitutionNormal <= 1, "restitutionNormal must be in [0, 1]");
  assert(p.retentionTangential >= 0 && p.retentionTangential <= 1, "retentionTangential must be in [0, 1]");
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`SoccerBallTrajectoryModel: ${message}`);
}

function assertFinite(value: number, name: string): void {
  assert(Number.isFinite(value), `${name} must be a finite number`);
}

function assertVector(v: Vector3, name: string): void {
  assertFinite(v.x, `${name}.x`);
  assertFinite(v.y, `${name}.y`);
  assertFinite(v.z, `${name}.z`);
}

function add(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function sub(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(v: Vector3, s: number): Vector3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function norm(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function horizontalNorm(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.z * v.z);
}

function normalize(v: Vector3): Vector3 {
  const n = norm(v);
  return scale(v, 1 / n);
}

function normalizeOrZero(v: Vector3): Vector3 {
  const n = norm(v);
  return n < 1e-9 ? { x: 0, y: 0, z: 0 } : scale(v, 1 / n);
}

function cross(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
