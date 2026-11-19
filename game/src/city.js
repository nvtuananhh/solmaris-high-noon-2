// city.js — Solmaris itself: sun-soaked Mediterranean coastal city.
// Grid of streets, whitewashed old town, marina, beachfront boulevard,
// cliffside coast highway, hillside villas, glass downtown, lighthouse.
// Layout is built ONCE from the world RNG stream at init, so the same seed
// always builds the same city. No clocks, no unseeded randomness.
import { range, rangeInt, pick } from './random.js';

const WALL_COLORS = [0xf7f2e7, 0xfff6e0, 0xf2e3c9, 0xe8dcc8, 0xfdfaf2, 0xead9b8];
const ROOF_COLORS = [0xc96f4a, 0xb85c38, 0xd98a5f, 0x7a9e7e, 0x4a7fa5];
const PASTEL = [0xf2c14e, 0xe88ca0, 0x7fb5d5, 0x9ec98f, 0xe0a458];

export class City {
  constructor(scene, rngWorld) {
    this.scene = scene;
    this.rng = rngWorld;
    this.buildings = [];
    this.trees = [];
    this.tokens = [];
    this.roadLines = [];
    this._buildGround(scene);
    this._buildRoads(scene);
    this._buildBlocks(scene);
    this._buildMarina(scene);
    this._buildLighthouse(scene);
    this._buildTokens(scene);
    this._buildProps(scene);
  }
  _mat(color) { return new THREE.MeshLambertMaterial({ color }); }
  _box(w, h, d, color, x, y, z, shadow = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this._mat(color));
    m.position.set(x, y, z);
    m.castShadow = shadow; m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }
  _buildGround(scene) {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), this._mat(0xe6d9b8));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    scene.add(ground);
    // Deep-blue sea west of the coast highway (x < -210), beach strip beside it.
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(160, 560), this._mat(0x1e6fa8));
    sea.rotation.x = -Math.PI / 2; sea.position.set(-300, 0.05, 0);
    scene.add(sea);
    const beach = new THREE.Mesh(new THREE.PlaneGeometry(14, 560), this._mat(0xf2e2b8));
    beach.rotation.x = -Math.PI / 2; beach.position.set(-205, 0.06, 0);
    scene.add(beach);
    // Grass hills east / north-east.
    const hill = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), this._mat(0x9ec98f));
    hill.rotation.x = -Math.PI / 2; hill.position.set(180, 0.04, -180);
    scene.add(hill);
  }
  _buildRoads(scene) {
    // Road network: verticals x = -198 (coast highway), -120, -60, 0, 60, 120, 180;
    // horizontals z = -180, -120, -60, 0, 60, 120, 180 (boulevard).
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x3c3f45 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf2e14e });
    const mkRoad = (w, d, x, z) => {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
      r.rotation.x = -Math.PI / 2; r.position.set(x, 0.08, z); r.receiveShadow = true;
      scene.add(r);
    };
    for (const x of [-198, -120, -60, 0, 60, 120, 180]) mkRoad(10, 480, x, 0);
    for (const z of [-180, -120, -60, 0, 60, 120, 180]) mkRoad(480, 10, 0, z);
    // Centre dashes along the two showcase roads.
    for (let z = -230; z <= 230; z += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4), lineMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(-198, 0.1, z);
      scene.add(dash);
    }
    for (let x = -230; x <= 230; x += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), lineMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(x, 0.1, 180);
      scene.add(dash);
    }
    this.roadXs = [-198, -120, -60, 0, 60, 120, 180];
    this.roadZs = [-180, -120, -60, 0, 60, 120, 180];
  }
  _buildBlocks(scene) {
    const rng = this.rng;
    // Old town: dense low whitewashed blocks around the square (0,0).
    // Blocks sit at cell centres (roads run on multiples of 60), so no
    // building ever stands on a road; the four cells around the square
    // stay open as the plaza.
    for (let gx = -2; gx <= 2; gx++) {
      for (let gz = -2; gz <= 2; gz++) {
        const cx = gx * 60 + (gx >= 0 ? 30 : -30) + range(rng, -4, 4);
        const cz = gz * 60 + (gz >= 0 ? 30 : -30) + range(rng, -4, 4);
        if (Math.abs(cx) < 38 && Math.abs(cz) < 38) continue; // the square
        const h = range(rng, 7, 15);
        const color = pick(rng, WALL_COLORS);
        const b = this._box(range(rng, 18, 30), h, range(rng, 18, 30), color, cx, h / 2, cz);
        const roof = this._box(b.geometry.parameters.width + 1, 0.8, b.geometry.parameters.depth + 1,
          pick(rng, ROOF_COLORS), cx, h + 0.4, cz);
        this.buildings.push(b, roof);
        if (rng() < 0.5) {
          const awning = this._box(8, 0.4, 4, pick(rng, PASTEL), cx + 8, 3.2, cz + 10, false);
          this.buildings.push(awning);
        }
      }
    }
    // Downtown glass towers east.
    for (let i = 0; i < 7; i++) {
      const x = 120 + range(rng, -14, 34);
      const z = -150 + i * 34 + range(rng, -6, 6);
      const h = range(rng, 34, 62);
      const glass = new THREE.MeshLambertMaterial({ color: 0x7fb5d5, transparent: true, opacity: 0.85 });
      const t = new THREE.Mesh(new THREE.BoxGeometry(20, h, 20), glass);
      t.position.set(x, h / 2, z); t.castShadow = true;
      scene.add(t);
      this.buildings.push(t);
    }
    // Hillside villas north-east.
    for (let i = 0; i < 9; i++) {
      const x = range(rng, 90, 210);
      const z = range(rng, -230, -150);
      const h = range(rng, 6, 10);
      const v = this._box(range(rng, 12, 18), h, range(rng, 12, 18), pick(rng, WALL_COLORS), x, h / 2, z);
      this.buildings.push(v);
    }
    // Old Town square fountain + market stalls.
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.4, 1, 20), this._mat(0xd8cfc0));
    basin.position.set(0, 0.5, 0); basin.castShadow = true; scene.add(basin);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 0.4, 20), this._mat(0x3fa7d6));
    water.position.set(0, 1.0, 0); scene.add(water);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 3.4, 10), this._mat(0xf7f2e7));
    pillar.position.set(0, 2.4, 0); scene.add(pillar);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const sx = Math.cos(a) * 14, sz = Math.sin(a) * 14;
      this._box(5, 2.6, 4, pick(rng, PASTEL), sx, 1.3, sz);
      this._box(5.6, 0.3, 4.6, 0xd94f3d, sx, 2.9, sz, false);
    }
  }
  _buildMarina(scene) {
    // Marina piers + yachts east-south (150, 150).
    for (let i = 0; i < 3; i++) {
      const pier = this._box(4, 0.6, 60, 0x8a6f4d, 120 + i * 30, 0.3, 150);
      this.buildings.push(pier);
      for (let j = 0; j < 3; j++) {
        const y = this._box(4, 2.2, 12, 0xffffff, 112 + i * 30, 1.1, 132 + j * 18);
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 9, 6), this._mat(0x888888));
        mast.position.set(112 + i * 30, 6, 132 + j * 18);
        scene.add(mast);
        this.buildings.push(y);
      }
    }
    const water = new THREE.Mesh(new THREE.PlaneGeometry(120, 90), this._mat(0x2a7fc2));
    water.rotation.x = -Math.PI / 2; water.position.set(150, 0.07, 150);
    scene.add(water);
  }
  _buildLighthouse(scene) {
    // Lighthouse at the north end of the coast highway — the finale destination.
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(4, 5.5, 34, 14), this._mat(0xf7f2e7));
    tower.position.set(-198, 17, -228); tower.castShadow = true; scene.add(tower);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, 3, 14), this._mat(0xd94f3d));
    band.position.set(-198, 26, -228); scene.add(band);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 4, 14),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    lamp.position.set(-198, 35.5, -228); scene.add(lamp);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(3.6, 3.4, 14), this._mat(0x2e4a6a));
    cap.position.set(-198, 39, -228); scene.add(cap);
    this.lighthouse = { x: -198, z: -228 };
  }
  _buildTokens(scene) {
    // 12 sun tokens at seeded spots near landmarks.
    const spots = [
      [10, 8], [-30, -30], [60, 60], [-120, 120], [150, 120], [-198, -120],
      [0, -180], [180, 0], [-60, 180], [120, -60], [-150, -60], [30, -120],
    ];
    for (let i = 0; i < spots.length; i++) {
      const geo = new THREE.TorusGeometry(0.9, 0.22, 8, 20);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffd23f }));
      mesh.position.set(spots[i][0], 1.6, spots[i][1]);
      scene.add(mesh);
      this.tokens.push({ id: i, x: spots[i][0], z: spots[i][1], mesh, taken: false });
    }
  }
  _buildProps(scene) {
    const rng = this.rng;
    // Palm trees along the boulevard + beach.
    for (let i = 0; i < 26; i++) {
      const x = range(rng, -200, 210);
      const z = rng() < 0.5 ? 190 + range(rng, -4, 4) : -196 + range(rng, -2, 2);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 5, 7), this._mat(0x8a6f4d));
      trunk.position.set(x, 2.5, z); trunk.castShadow = true; scene.add(trunk);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.4, 8), this._mat(0x3f8f4f));
      crown.position.set(x, 6, z); scene.add(crown);
      this.trees.push(trunk);
    }
    // Stunt ramp on the boulevard (for jumps).
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 10), this._mat(0xe88ca0));
    ramp.position.set(40, 0.55, 180); ramp.rotation.x = -0.22; ramp.castShadow = true;
    scene.add(ramp);
    this.ramp = { x: 40, z: 180 };
    // Respray garage ("Fresh Coat") at (60, -120): drive in to cool wanted heat.
    const garage = this._box(16, 7, 14, 0x3a6ea8, 60, 3.5, -120);
    this.garage = { x: 60, z: -120, mesh: garage };
    const sign = this._box(14, 1.6, 0.5, 0xf2c14e, 60, 7.6, -112.5, false);
    this.buildings.push(garage, sign);
  }
  isOnRoad(x, z) {
    for (const rx of this.roadXs) if (Math.abs(x - rx) < 6) return true;
    for (const rz of this.roadZs) if (Math.abs(z - rz) < 6) return true;
    return false;
  }
  randomRoadPoint(rng) {
    if (rng() < 0.5) return { x: pick(rng, this.roadXs), z: range(rng, -220, 220) };
    return { x: range(rng, -220, 220), z: pick(rng, this.roadZs) };
  }
}
