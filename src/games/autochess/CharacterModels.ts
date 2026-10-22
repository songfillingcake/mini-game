import * as THREE from 'three';

export const detailedCharacters = ['moss', 'fox', 'cat'] as const;
export interface CharacterRig {
  root: THREE.Group; body: THREE.Group; head: THREE.Group;
  leftArm: THREE.Group; rightArm: THREE.Group; leftLeg: THREE.Group; rightLeg: THREE.Group;
  weapon: THREE.Group; halo: THREE.Group; shield: THREE.Mesh; health: THREE.Sprite; mana: THREE.Sprite;
  kind: string; detailed: boolean;
}

/** Original articulated low-poly figures. Shared geometry/materials keep rerolls bounded. */
export class CharacterModels {
  private geometries = new Map<string, THREE.BufferGeometry>();
  private materials = new Map<string, THREE.Material>();

  material(color: string, glow = false): THREE.MeshStandardMaterial {
    const key = color + ':' + glow;
    if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshStandardMaterial({
      color, roughness: 0.83, metalness: 0.08, flatShading: true,
      emissive: glow ? color : '#000000', emissiveIntensity: glow ? 0.55 : 0,
    }));
    return this.materials.get(key) as THREE.MeshStandardMaterial;
  }

  geometry(kind: 'box' | 'sphere' | 'ico' | 'cylinder' | 'cone' | 'ring'): THREE.BufferGeometry {
    if (!this.geometries.has(kind)) {
      const geometry = kind === 'box' ? new THREE.BoxGeometry(1, 1, 1)
        : kind === 'sphere' ? new THREE.SphereGeometry(1, 8, 6)
        : kind === 'ico' ? new THREE.IcosahedronGeometry(1, 0)
        : kind === 'cylinder' ? new THREE.CylinderGeometry(1, 1, 1, 8)
        : kind === 'cone' ? new THREE.ConeGeometry(1, 1, 6)
        : new THREE.TorusGeometry(1, 0.09, 6, 20);
      this.geometries.set(kind, geometry);
    }
    return this.geometries.get(kind)!;
  }

  mesh(parent: THREE.Object3D, kind: Parameters<CharacterModels['geometry']>[0], color: string,
    position: [number, number, number], scale: [number, number, number], glow = false): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry(kind), this.material(color, glow));
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private sprite(color: string): THREE.Sprite {
    const key = 'sprite:' + color;
    if (!this.materials.has(key)) this.materials.set(key, new THREE.SpriteMaterial({ color, depthTest: false }));
    const sprite = new THREE.Sprite(this.materials.get(key) as THREE.SpriteMaterial);
    sprite.renderOrder = 8;
    return sprite;
  }

  create(kind: string, team: 'ally' | 'enemy', factionColor: string, star: number): CharacterRig {
    const root = new THREE.Group();
    const body = new THREE.Group(), head = new THREE.Group(), weapon = new THREE.Group();
    const leftArm = new THREE.Group(), rightArm = new THREE.Group(), leftLeg = new THREE.Group(), rightLeg = new THREE.Group();
    root.add(body);
    body.add(head, leftArm, rightArm, leftLeg, rightLeg);
    head.position.y = 1.08;
    leftArm.position.set(-0.28, 0.86, 0);
    rightArm.position.set(0.28, 0.86, 0);
    leftLeg.position.set(-0.115, 0.43, 0);
    rightLeg.position.set(0.115, 0.43, 0);
    rightArm.add(weapon);
    const detailed = (detailedCharacters as readonly string[]).includes(kind);
    const primary = kind === 'moss' ? '#638465' : kind === 'fox' ? '#568575' : kind === 'cat' ? '#8872a9' : factionColor;
    const dark = '#35424c', gold = '#d8b875', skin = '#efd4ae';
    this.mesh(root, 'cylinder', team === 'ally' ? '#5caa91' : '#c67e7e', [0, 0.035, 0], [0.34, 0.065, 0.34]);

    if (detailed) {
      // A jointed humanoid silhouette, rather than a flat emoji or billboard.
      this.mesh(body, 'cylinder', primary, [0, 0.68, 0], [0.235, 0.43, 0.17]);
      this.mesh(body, 'cylinder', gold, [0, 0.51, 0], [0.248, 0.055, 0.18]);
      this.mesh(body, 'box', gold, [0, 0.52, 0.18], [0.09, 0.08, 0.035]);
      for (const leg of [leftLeg, rightLeg]) {
        this.mesh(leg, 'box', dark, [0, -0.13, 0], [0.145, 0.28, 0.15]);
        this.mesh(leg, 'box', '#6e5c50', [0, -0.3, 0.055], [0.17, 0.13, 0.25]);
      }
      for (const arm of [leftArm, rightArm]) {
        this.mesh(arm, 'sphere', primary, [0, -0.04, 0], [0.105, 0.12, 0.12]);
        this.mesh(arm, 'cylinder', primary, [0, -0.19, 0], [0.071, 0.24, 0.071]);
        this.mesh(arm, 'sphere', skin, [0, -0.34, 0], [0.075, 0.078, 0.075]);
      }
      this.mesh(head, 'sphere', skin, [0, 0, 0], [0.22, 0.235, 0.205]);
      for (const x of [-0.075, 0.075]) {
        this.mesh(head, 'sphere', '#fff8e9', [x, 0.025, 0.172], [0.047, 0.052, 0.03]);
        this.mesh(head, 'sphere', '#27333c', [x, 0.02, 0.199], [0.022, 0.032, 0.012]);
      }
      this.mesh(head, 'box', '#c9947c', [0, -0.07, 0.193], [0.04, 0.026, 0.022]);
    } else {
      // Other roster members remain honest, simple stand-in chess pieces for this slice.
      this.mesh(body, 'cone', primary, [0, 0.42, 0], [0.27, 0.66, 0.27]);
      this.mesh(body, 'sphere', primary, [0, 0.86, 0], [0.19, 0.19, 0.19]);
      const crown = this.mesh(body, 'ring', gold, [0, 0.72, 0], [0.21, 0.21, 0.21]);
      crown.rotation.x = Math.PI / 2;
      if (kind === 'guardian') {
        for (let index = 0; index < 5; index++) {
          const angle = index / 5 * Math.PI * 2;
          this.mesh(body, 'cone', gold, [Math.cos(angle) * 0.16, 1.12, Math.sin(angle) * 0.16], [0.06, 0.22, 0.06]);
        }
      }
    }

    if (kind === 'moss') {
      // Turtle-shell plate armour, crest, a hexagonal shield, and a stone mace.
      this.mesh(body, 'ico', '#425e50', [0, 0.72, -0.17], [0.31, 0.34, 0.19]);
      this.mesh(body, 'ico', '#90a16c', [0, 0.73, -0.32], [0.15, 0.19, 0.05]);
      this.mesh(head, 'cylinder', '#537665', [0, 0.125, -0.01], [0.245, 0.15, 0.225]);
      this.mesh(head, 'box', gold, [0, 0.12, 0.207], [0.065, 0.18, 0.05]);
      this.mesh(head, 'cone', '#d8c28a', [0, 0.29, -0.02], [0.09, 0.24, 0.09]);
      const shield = this.mesh(leftArm, 'cylinder', '#425f56', [0, -0.21, 0.14], [0.25, 0.075, 0.28]);
      shield.rotation.x = Math.PI / 2;
      const emblem = this.mesh(leftArm, 'ico', '#c4bd7b', [0, -0.21, 0.195], [0.15, 0.17, 0.045]);
      emblem.rotation.z = Math.PI / 6;
      this.mesh(weapon, 'cylinder', '#806b50', [0, -0.2, 0.08], [0.035, 0.48, 0.035]);
      this.mesh(weapon, 'ico', '#b2b9a3', [0, 0.05, 0.08], [0.12, 0.14, 0.12]);
    } else if (kind === 'fox') {
      const cloak = this.mesh(body, 'cone', '#345d52', [0, 0.68, -0.11], [0.31, 0.6, 0.2]);
      cloak.rotation.x = -0.12;
      this.mesh(head, 'sphere', '#b86e40', [0, 0.1, -0.015], [0.235, 0.19, 0.21]);
      for (const x of [-0.15, 0.15]) {
        const ear = this.mesh(head, 'cone', '#c9854a', [x, 0.29, 0], [0.09, 0.25, 0.09]);
        ear.rotation.z = -Math.sign(x) * 0.2;
        this.mesh(head, 'cone', '#ead1a4', [x, 0.28, 0.055], [0.046, 0.14, 0.028]);
      }
      this.mesh(body, 'cylinder', '#805f42', [0.14, 0.73, -0.23], [0.085, 0.45, 0.085]).rotation.z = -0.25;
      this.mesh(body, 'cone', '#e8d3a0', [0.2, 0.99, -0.23], [0.05, 0.19, 0.05]);
      const tail = this.mesh(body, 'cone', '#bd804b', [0.08, 0.43, -0.28], [0.11, 0.4, 0.11]);
      tail.rotation.x = -0.7;
      const bowKey = 'bow';
      if (!this.geometries.has(bowKey)) this.geometries.set(bowKey, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.28, 0), new THREE.Vector3(0, 0, 0.15), new THREE.Vector3(0, 0.28, 0),
      ]), 10, 0.025, 5, false));
      const bow = new THREE.Mesh(this.geometries.get(bowKey), this.material('#ba9863'));
      bow.position.set(0, -0.19, 0.14);
      leftArm.add(bow);
      this.mesh(leftArm, 'cylinder', '#ece2bc', [0, -0.19, 0.14], [0.009, 0.56, 0.009]);
      this.mesh(weapon, 'cylinder', '#bda575', [0, -0.3, 0.2], [0.013, 0.46, 0.013]).rotation.x = Math.PI / 2;
    } else if (kind === 'cat') {
      this.mesh(body, 'cone', '#78629a', [0, 0.45, 0], [0.29, 0.55, 0.23]);
      this.mesh(head, 'cylinder', '#665382', [0, 0.16, 0], [0.275, 0.045, 0.26]);
      this.mesh(head, 'cone', '#8e79b0', [0, 0.34, -0.04], [0.205, 0.38, 0.2]);
      for (const x of [-0.19, 0.19]) this.mesh(head, 'cone', '#d9b5b8', [x, 0.22, 0.04], [0.07, 0.17, 0.07]);
      this.mesh(weapon, 'cylinder', '#a68b62', [0, -0.12, 0.08], [0.032, 0.88, 0.032]);
      this.mesh(weapon, 'ico', '#c9b0ee', [0, 0.36, 0.08], [0.13, 0.13, 0.13], true);
      const ring = this.mesh(weapon, 'ring', gold, [0, 0.36, 0.08], [0.18, 0.18, 0.18]);
      ring.rotation.x = 0.4;
      ring.rotation.y = 0.7;
      this.mesh(body, 'ico', '#e9cf8b', [0, 0.81, 0.175], [0.05, 0.065, 0.025], true);
    }

    const halo = new THREE.Group();
    root.add(halo);
    for (let index = 1; index < star; index++) {
      const ring = this.mesh(halo, 'ring', '#e9c674', [0, 0.08 + index * 0.04, 0], [0.31 + index * 0.06, 0.31 + index * 0.06, 0.31 + index * 0.06], true);
      ring.rotation.x = Math.PI / 2;
      ring.castShadow = false;
    }
    const shieldKey = 'shield-material';
    if (!this.materials.has(shieldKey)) this.materials.set(shieldKey, new THREE.MeshBasicMaterial({ color: '#9ed7ee', transparent: true, opacity: 0.2, wireframe: true }));
    const shield = new THREE.Mesh(this.geometry('sphere'), this.materials.get(shieldKey));
    shield.position.y = 0.73;
    shield.scale.set(0.48, 0.79, 0.45);
    shield.visible = false;
    root.add(shield);
    const healthBackground = this.sprite('#263643');
    healthBackground.position.y = detailed ? 1.8 : 1.45;
    healthBackground.scale.set(0.75, 0.09, 1);
    root.add(healthBackground);
    const health = this.sprite(team === 'ally' ? '#8de0b2' : '#f29e9b');
    health.position.y = healthBackground.position.y;
    health.position.z = 0.01;
    health.scale.set(0.72, 0.065, 1);
    health.renderOrder = 9;
    const mana = this.sprite('#9cc8f2');
    mana.position.y = healthBackground.position.y - 0.09;
    mana.scale.set(0.001, 0.025, 1);
    mana.renderOrder = 9;
    root.add(health, mana);
    root.scale.setScalar(0.88 + (star - 1) * 0.1);
    root.userData.kind = kind;
    return { root, body, head, leftArm, rightArm, leftLeg, rightLeg, weapon, halo, shield, health, mana, kind, detailed };
  }

  dispose(): void {
    for (const geometry of this.geometries.values()) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.geometries.clear();
    this.materials.clear();
  }
}
