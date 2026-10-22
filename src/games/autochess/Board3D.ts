import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CharacterModels } from './CharacterModels';
import type { CharacterRig } from './CharacterModels';
import type { Fighter } from './Combat';
import type { Phase } from './AutoChessModel';
import { factions, guardian, unitById } from './Units';
import type { Piece } from './Units';

export interface Board3DState {
  phase: Phase; allies: Piece[]; enemies: Piece[]; fighters: readonly Fighter[] | null; selected: string | null;
}
interface SceneUnit {
  uid: string; type: string; team: 'ally' | 'enemy'; star: number; cell: number;
  hp: number; maxHp: number; mana: number; shield: number; stunned: boolean;
  attackSerial: number; castSerial: number; targetCell: number | null;
}
interface Actor {
  rig: CharacterRig; unit: SceneUnit; position: THREE.Vector3;
  lastAttack: number; lastCast: number; attackAge: number; castAge: number; deathAge: number; dead: boolean;
}
interface Effect {
  mesh: THREE.Mesh; age: number; duration: number; from: THREE.Vector3; to: THREE.Vector3;
  kind: 'arrow' | 'orb' | 'ring' | 'spark';
}
const Y = new THREE.Vector3(0, 1, 0);
const cellPoint = (cell: number, y = 0): THREE.Vector3 => new THREE.Vector3((cell % 6 - 2.5) * 1.2, y, (Math.floor(cell / 6) - 2.5) * 1.2);

/** One renderer per open game; reattaching it never recreates the WebGL context. */
export class Board3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 70);
  readonly controls: OrbitControls;
  readonly actors = new Map<string, Actor>();
  readonly stats = { frames: 0, attacks: 0, casts: 0, deaths: 0, moves: 0 };
  private readonly models = new CharacterModels();
  private readonly tiles: THREE.Mesh[] = [];
  private readonly effects: Effect[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly mouse = new THREE.Vector2();
  private readonly abort = new AbortController();
  private readonly resizeObserver: ResizeObserver;
  private readonly visibilityObserver: IntersectionObserver;
  private board: HTMLElement | null = null;
  private hovered = -1;
  private active = false;
  private enabled = true;
  private visible = true;
  private disposed = false;
  private clock = 0;
  private frameClock = 0;
  private previousPhase: Phase | null = null;
  private gesture: { x: number; y: number; moved: boolean } | null = null;
  private pointers = new Set<number>();
  private multiTouch = false;

  constructor(private readonly state: () => Board3DState, private readonly pick: (cell: number) => void, private readonly unavailable: () => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    const canvas = this.renderer.domElement;
    canvas.className = 'ac-3d-canvas';
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', '3D 战场。点击己方棋子布阵，拖动旋转，滚轮或双指缩放。也可切换二维布阵。');
    canvas.dataset.renderer = 'three-webgl';
    this.scene.background = new THREE.Color('#dce7da');
    this.scene.fog = new THREE.Fog('#dce7da', 24, 46);
    this.camera.position.set(7.6, 10.8, 10.5);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 0.35, 0);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.13;
    this.controls.minDistance = 11;
    this.controls.maxDistance = 22;
    this.controls.minPolarAngle = 0.3;
    this.controls.maxPolarAngle = 1.12;
    this.controls.rotateSpeed = 0.65;
    this.controls.zoomSpeed = 0.8;
    this.controls.update();
    this.controls.saveState();
    this.environment();
    this.bindPointer();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.visibilityObserver = new IntersectionObserver((entries) => { this.visible = entries.some((entry) => entry.isIntersecting); });
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      if (!this.disposed) this.unavailable();
    }, { signal: this.abort.signal });
  }

  private environment(): void {
    this.scene.add(new THREE.HemisphereLight('#fff5df', '#6c8d82', 2.1));
    const sun = new THREE.DirectionalLight('#fff2d5', 3.3);
    sun.position.set(-5, 11, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.5, far: 30 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = 0.045;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight('#c9d8ff', 0.9);
    fill.position.set(6, 5, -5);
    this.scene.add(fill);
    this.models.mesh(this.scene, 'box', '#566e64', [0, -0.4, 0], [7.85, 0.6, 7.85]);
    this.models.mesh(this.scene, 'box', '#9ba47e', [0, -0.13, 0], [7.75, 0.14, 7.75]);
    for (let cell = 0; cell < 36; cell++) {
      const tile = this.models.mesh(this.scene, 'box', this.tileColor(cell), [cellPoint(cell).x, -0.015, cellPoint(cell).z], [1.13, 0.14, 1.13]);
      tile.userData.cell = cell;
      this.tiles.push(tile);
    }
    for (let index = 0; index < 10; index++) {
      const angle = index / 10 * Math.PI * 2;
      this.models.mesh(this.scene, 'ico', index % 2 ? '#677e71' : '#87947b', [Math.cos(angle) * 3.3, -0.83, Math.sin(angle) * 3.3], [0.9, 0.65, 0.9]);
    }
    for (const x of [-3.86, 3.86]) for (const z of [-3.86, 3.86]) {
      this.models.mesh(this.scene, 'cylinder', '#697d71', [x, 0.12, z], [0.17, 0.6, 0.17]);
      this.models.mesh(this.scene, 'ico', z > 0 ? '#a8d5b9' : '#d6b1bb', [x, 0.55, z], [0.17, 0.23, 0.17], true);
    }
    for (const [x, z] of [[-3.85, -1.4], [3.85, 1.6], [-3.85, 2.8], [3.85, -2.8]]) {
      this.models.mesh(this.scene, 'cone', '#63816a', [x, 0.15, z], [0.14, 0.48, 0.14]);
      this.models.mesh(this.scene, 'cone', '#88a17b', [x + 0.08, 0.1, z + 0.15], [0.09, 0.35, 0.09]);
    }
    const floor = this.models.mesh(this.scene, 'cylinder', '#cad5bf', [0, -1.32, 0], [7.5, 0.12, 7.5]);
    floor.castShadow = false;
    this.models.mesh(this.scene, 'box', '#c1ad79', [0, 0.07, 0], [7.25, 0.012, 0.035]).castShadow = false;
  }

  private tileColor(cell: number): string {
    const alternate = (cell % 6 + Math.floor(cell / 6)) % 2;
    return cell >= 18 ? (alternate ? '#92ad98' : '#9ab59f') : alternate ? '#a9aaa0' : '#b4b3a6';
  }

  attach(board: HTMLElement): void {
    if (this.disposed) return;
    this.board = board;
    board.classList.add('is-3d');
    board.append(this.renderer.domElement);
    this.resizeObserver.disconnect();
    this.visibilityObserver.disconnect();
    this.resizeObserver.observe(board);
    this.visibilityObserver.observe(board);
    this.resize();
    this.update(0, true);
  }

  setActive(active: boolean): void { this.active = active; this.controls.enabled = active && this.enabled; }
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.controls.enabled = enabled && this.active;
    if (!enabled) this.renderer.domElement.remove();
  }
  private resize(): void {
    if (!this.board || !this.enabled || this.disposed) return;
    const rect = this.board.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.renderer.setSize(Math.round(rect.width), Math.round(rect.height), false);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.update(0, true);
  }

  turn(direction: number): void {
    this.camera.position.sub(this.controls.target).applyAxisAngle(Y, direction * Math.PI / 6).add(this.controls.target);
    this.controls.update();
    this.update(0, true);
  }
  zoom(direction: number): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() * (direction > 0 ? 0.87 : 1.15), 11, 22));
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
    this.update(0, true);
  }
  resetCamera(): void {
    // OrbitControls.reset() retains angular damping; flush it before restoring the saved view.
    const damping = this.controls.enableDamping;
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.reset();
    this.controls.enableDamping = damping;
    this.update(0, true);
  }

  private bindPointer(): void {
    const canvas = this.renderer.domElement;
    const options = { signal: this.abort.signal };
    canvas.addEventListener('pointerdown', (event) => {
      this.pointers.add(event.pointerId);
      if (this.pointers.size > 1) this.multiTouch = true;
      this.gesture = { x: event.clientX, y: event.clientY, moved: false };
    }, options);
    canvas.addEventListener('pointermove', (event) => {
      if (this.gesture && Math.hypot(event.clientX - this.gesture.x, event.clientY - this.gesture.y) > 6) this.gesture.moved = true;
      if (this.active && !this.gesture) this.hovered = this.hit(event.clientX, event.clientY) ?? -1;
    }, options);
    canvas.addEventListener('pointerup', (event) => {
      const gesture = this.gesture;
      if (this.active && this.enabled && gesture && !gesture.moved && !this.multiTouch && event.button === 0) {
        const cell = this.hit(event.clientX, event.clientY);
        if (cell !== null) this.pick(cell);
      }
      this.pointers.delete(event.pointerId);
      if (!this.pointers.size) { this.gesture = null; this.multiTouch = false; }
    }, options);
    canvas.addEventListener('pointercancel', (event) => {
      this.pointers.delete(event.pointerId);
      this.gesture = null;
      if (!this.pointers.size) this.multiTouch = false;
    }, options);
    canvas.addEventListener('pointerleave', () => { this.hovered = -1; }, options);
  }

  private hit(clientX: number, clientY: number): number | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    this.camera.updateMatrixWorld();
    this.scene.updateMatrixWorld();
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const objects: THREE.Object3D[] = [...this.tiles, ...[...this.actors.values()].filter((actor) => actor.rig.root.visible && !actor.dead).map((actor) => actor.rig.root)];
    for (const hit of this.raycaster.intersectObjects(objects, true)) {
      let object: THREE.Object3D | null = hit.object;
      while (object) {
        if (typeof object.userData.cell === 'number') return object.userData.cell;
        const actor = this.actors.get(object.userData.actorUid);
        if (actor) return actor.unit.cell;
        object = object.parent;
      }
    }
    return null;
  }

  private sceneUnits(state: Board3DState): SceneUnit[] {
    if (state.phase !== 'prep' && state.fighters) return state.fighters.map((fighter) => ({
      uid: fighter.uid, type: fighter.definition.id, team: fighter.team, star: fighter.star, cell: fighter.cell,
      hp: fighter.hp, maxHp: fighter.maxHp, mana: fighter.mana, shield: fighter.shield, stunned: fighter.stunned > 0,
      attackSerial: fighter.attackSerial, castSerial: fighter.castSerial, targetCell: fighter.targetCell,
    }));
    return [...state.allies.map((unit) => ({ ...unit, team: 'ally' as const })), ...state.enemies.map((unit) => ({ ...unit, team: 'enemy' as const }))]
      .filter((unit) => unit.cell !== null).map((unit) => ({ ...unit, cell: unit.cell!, hp: 1, maxHp: 1, mana: 0, shield: 0, stunned: false, attackSerial: 0, castSerial: 0, targetCell: null }));
  }

  update(dt: number, force = false, wallDt = dt): void {
    if (this.disposed || !this.enabled || (!this.active && !force)) return;
    const state = this.state();
    const units = this.sceneUnits(state);
    const phaseChanged = this.previousPhase !== state.phase;
    this.clock += dt;
    const present = new Set(units.map((unit) => unit.uid));
    for (const [uid, actor] of this.actors) if (!present.has(uid)) { this.scene.remove(actor.rig.root); this.actors.delete(uid); }
    for (const unit of units) {
      let actor = this.actors.get(unit.uid);
      if (actor && (actor.unit.type !== unit.type || actor.unit.star !== unit.star)) {
        this.scene.remove(actor.rig.root);
        this.actors.delete(unit.uid);
        actor = undefined;
      }
      if (!actor) {
        const definition = unitById[unit.type] || guardian;
        const rig = this.models.create(unit.type, unit.team, factions[definition.faction].color, unit.star);
        rig.root.userData.actorUid = unit.uid;
        rig.root.rotation.y = unit.team === 'ally' ? Math.PI : 0;
        actor = { rig, unit, position: cellPoint(unit.cell), lastAttack: 0, lastCast: 0, attackAge: 0, castAge: 0, deathAge: 0, dead: false };
        this.actors.set(unit.uid, actor);
        this.scene.add(rig.root);
      }
      if (phaseChanged) {
        actor.lastAttack = unit.attackSerial;
        actor.lastCast = unit.castSerial;
        actor.attackAge = actor.castAge = 0;
        if (state.phase === 'prep') { actor.dead = false; actor.deathAge = 0; }
      }
      if (actor.unit.cell !== unit.cell) this.stats.moves += 1;
      actor.unit = unit;
      if (unit.attackSerial > actor.lastAttack) {
        actor.attackAge = 0.4;
        this.stats.attacks += unit.attackSerial - actor.lastAttack;
        this.attackEffect(actor);
      }
      if (unit.castSerial > actor.lastCast) {
        actor.castAge = 0.75;
        this.stats.casts += unit.castSerial - actor.lastCast;
        const definition = unitById[unit.type] || guardian;
        this.effect('ring', cellPoint(unit.cell, 0.13), cellPoint(unit.cell), definition.skill === 'heal' ? '#91ddb1' : definition.skill === 'shield' ? '#9bc9e9' : '#c7a8ef', 0.75);
        if (definition.skill === 'nova' && unit.targetCell !== null) this.effect('ring', cellPoint(unit.targetCell, 0.15), cellPoint(unit.targetCell), '#d0a6e7', 0.7);
      }
      actor.lastAttack = unit.attackSerial;
      actor.lastCast = unit.castSerial;
      this.animate(actor, dt, state.phase === 'prep');
    }
    const selectedCell = units.find((unit) => unit.uid === state.selected)?.cell;
    this.tiles.forEach((tile, cell) => {
      tile.material = this.models.material(cell === selectedCell ? '#dfc783' : cell === this.hovered && cell >= 18 && state.phase === 'prep' ? '#b5cfad' : this.tileColor(cell));
    });
    this.previousPhase = state.phase;
    this.updateEffects(dt);
    this.controls.update();
    this.frameClock += wallDt;
    if (force || (this.visible && this.frameClock >= 1 / 30)) {
      this.frameClock = 0;
      this.renderer.render(this.scene, this.camera);
      this.stats.frames += 1;
    }
  }

  private animate(actor: Actor, dt: number, prep: boolean): void {
    const { rig, unit } = actor;
    const destination = cellPoint(unit.cell);
    const moving = actor.position.distanceTo(destination) > 0.02;
    actor.position.lerp(destination, prep ? 1 : 1 - Math.exp(-13 * dt));
    actor.attackAge = Math.max(0, actor.attackAge - dt);
    actor.castAge = Math.max(0, actor.castAge - dt);
    if (unit.hp <= 0 && !actor.dead) { actor.dead = true; actor.deathAge = 0; this.stats.deaths += 1; }
    if (unit.hp > 0 && actor.dead) { actor.dead = false; actor.deathAge = 0; }
    const attack = actor.attackAge > 0 ? Math.sin((1 - actor.attackAge / 0.4) * Math.PI) : 0;
    const cast = actor.castAge > 0 ? Math.sin((1 - actor.castAge / 0.75) * Math.PI) : 0;
    const stride = moving ? Math.sin(this.clock * 13) * 0.65 : Math.sin(this.clock * 2 + Number(unit.uid.slice(-1)) || 0) * 0.025;
    rig.leftLeg.rotation.x = stride;
    rig.rightLeg.rotation.x = -stride;
    rig.leftArm.rotation.x = -stride * 0.5 - (rig.kind === 'fox' ? attack * 1.2 : cast * 0.6);
    rig.rightArm.rotation.x = stride * 0.5 - attack * (rig.kind === 'moss' ? 1.65 : 1.1) - cast * 2.0;
    rig.head.rotation.x = cast * -0.1;
    rig.body.position.y = Math.sin(this.clock * 2.8) * 0.015 + (moving ? Math.abs(stride) * 0.035 : 0) + cast * 0.045;
    rig.body.rotation.z = attack * -0.12;
    rig.root.visible = !actor.dead || actor.deathAge < 0.9;
    if (actor.dead) {
      actor.deathAge += dt;
      const fall = Math.min(1, actor.deathAge / 0.6);
      rig.body.rotation.z = -Math.PI / 2 * fall;
      rig.body.position.y = -0.18 * fall;
    }
    let facing = unit.team === 'ally' ? Math.PI : 0;
    if (unit.targetCell !== null) {
      const target = cellPoint(unit.targetCell);
      facing = Math.atan2(target.x - actor.position.x, target.z - actor.position.z);
    } else if (moving) facing = Math.atan2(destination.x - actor.position.x, destination.z - actor.position.z);
    const turn = THREE.MathUtils.euclideanModulo(facing - rig.root.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
    rig.root.rotation.y += turn * (1 - Math.exp(-12 * dt));
    rig.root.position.copy(actor.position);
    if (attack > 0 && !actor.dead) {
      rig.root.position.x += Math.sin(facing) * attack * 0.12;
      rig.root.position.z += Math.cos(facing) * attack * 0.12;
    }
    rig.halo.rotation.y += dt * 0.7;
    rig.shield.visible = unit.shield > 0 && !actor.dead;
    rig.shield.rotation.y += dt;
    rig.health.visible = rig.mana.visible = !actor.dead;
    rig.health.scale.x = 0.72 * Math.max(0, unit.hp / unit.maxHp);
    rig.mana.scale.x = Math.max(0.001, unit.mana / 4 * 0.72);
  }

  private attackEffect(actor: Actor): void {
    if (actor.unit.targetCell === null) return;
    const definition = unitById[actor.unit.type] || guardian;
    if (definition.range <= 1) {
      this.effect('spark', cellPoint(actor.unit.targetCell, 0.8), cellPoint(actor.unit.targetCell, 1.05), '#f8d58e', 0.22);
    } else this.effect(actor.unit.type === 'fox' || definition.skill === 'snipe' ? 'arrow' : 'orb', actor.position.clone().setY(0.95), cellPoint(actor.unit.targetCell, 0.85), actor.unit.type === 'cat' ? '#ce9be8' : '#e7d39c', 0.28);
  }

  private effect(kind: Effect['kind'], from: THREE.Vector3, to: THREE.Vector3, color: string, duration: number): void {
    if (this.effects.length >= 28) this.removeEffect(this.effects.shift()!);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false });
    const mesh = new THREE.Mesh(this.models.geometry(kind === 'ring' ? 'ring' : kind === 'arrow' ? 'cone' : 'ico'), material);
    mesh.position.copy(from);
    if (kind === 'ring') mesh.rotation.x = Math.PI / 2;
    else if (kind === 'arrow') mesh.quaternion.setFromUnitVectors(Y, to.clone().sub(from).normalize());
    this.scene.add(mesh);
    this.effects.push({ mesh, kind, age: 0, duration, from, to });
  }

  private updateEffects(dt: number): void {
    for (let index = this.effects.length - 1; index >= 0; index--) {
      const effect = this.effects[index];
      effect.age += dt;
      const progress = Math.min(1, effect.age / effect.duration);
      (effect.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - progress;
      if (effect.kind === 'ring') effect.mesh.scale.setScalar(0.18 + progress * 0.75);
      else if (effect.kind === 'arrow') { effect.mesh.scale.set(0.035, 0.3, 0.035); effect.mesh.position.lerpVectors(effect.from, effect.to, progress); }
      else { effect.mesh.scale.setScalar(effect.kind === 'spark' ? 0.16 * (1 - progress) : 0.075); effect.mesh.position.lerpVectors(effect.from, effect.to, progress); }
      if (progress >= 1) { this.removeEffect(effect); this.effects.splice(index, 1); }
    }
  }
  private removeEffect(effect: Effect): void { this.scene.remove(effect.mesh); (effect.mesh.material as THREE.Material).dispose(); }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    this.resizeObserver.disconnect();
    this.visibilityObserver.disconnect();
    this.controls.dispose();
    this.effects.forEach((effect) => this.removeEffect(effect));
    this.effects.length = 0;
    this.actors.clear();
    this.scene.clear();
    this.models.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.board = null;
  }
}
