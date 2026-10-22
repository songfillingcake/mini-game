import { emptyRelics, guardian, starMultiplier, synergyCounts, unitById } from './Units';
import type { Piece, Relics, UnitDefinition } from './Units';

export interface Fighter {
  uid: string; definition: UnitDefinition; star: number; team: 'ally' | 'enemy'; cell: number;
  hp: number; maxHp: number; shield: number; attack: number; armor: number;
  interval: number; spell: number; regen: number; mana: number;
  attackWait: number; moveWait: number; stunned: number; flash: number; dealt: number;
}
export interface CombatEvent { cell: number; text: string; kind: 'damage' | 'heal' | 'skill' }
export type CombatResult = 'win' | 'loss';
const distance = (a: number, b: number): number => Math.abs(a % 6 - b % 6) + Math.abs(Math.floor(a / 6) - Math.floor(b / 6));
function neighbours(cell: number): number[] {
  const row = Math.floor(cell / 6), col = cell % 6;
  return [row > 0 ? cell - 6 : -1, col > 0 ? cell - 1 : -1, col < 5 ? cell + 1 : -1, row < 5 ? cell + 6 : -1].filter((value) => value >= 0);
}

export class Combat {
  readonly fighters: Fighter[];
  readonly events: CombatEvent[] = [];
  elapsed = 0;
  result: CombatResult | null = null;
  log = '双方开始交锋';
  private accumulator = 0;
  private healClock = 0;

  constructor(allies: readonly Piece[], enemies: readonly Piece[], relics = emptyRelics()) {
    this.fighters = [...this.createTeam(allies, 'ally', relics), ...this.createTeam(enemies, 'enemy', emptyRelics())];
  }

  private createTeam(pieces: readonly Piece[], team: Fighter['team'], relics: Relics): Fighter[] {
    const counts = synergyCounts(pieces);
    return pieces.map((piece, index) => {
      const definition = unitById[piece.type] || guardian;
      const count = counts[definition.faction];
      const tier = count >= 3 ? 2 : count >= 2 ? 1 : 0;
      const scale = starMultiplier(piece.star);
      const maxHp = Math.round(definition.hp * scale + relics.health * 40);
      return {
        uid: piece.uid, definition, star: piece.star, team, cell: piece.cell!, hp: maxHp, maxHp,
        shield: 0, attack: definition.attack * scale + relics.attack * 6,
        armor: definition.armor + relics.armor * 5 + (definition.faction === 'iron' ? [0, 12, 24][tier] : 0),
        interval: definition.interval / (1 + relics.speed * 0.08 + (definition.faction === 'wind' ? [0, 0.2, 0.4][tier] : 0)),
        spell: 1 + (definition.faction === 'star' ? [0, 0.3, 0.65][tier] : 0),
        regen: definition.faction === 'forest' ? [0, 0.015, 0.03][tier] : 0,
        mana: 0, attackWait: 0.35 + index * 0.07, moveWait: 0, stunned: 0, flash: 0, dealt: 0,
      };
    });
  }

  update(dt: number): void {
    if (this.result || !Number.isFinite(dt) || dt <= 0) return;
    this.accumulator += Math.min(dt, 0.25);
    while (this.accumulator >= 0.05 && !this.result) {
      this.accumulator -= 0.05;
      this.tick(0.05);
    }
  }

  private tick(dt: number): void {
    this.elapsed += dt;
    this.healClock += dt;
    if (this.healClock >= 1) {
      this.healClock -= 1;
      for (const fighter of this.fighters) if (fighter.hp > 0 && fighter.regen > 0) this.heal(fighter, fighter.maxHp * fighter.regen);
    }
    // Both teams take a turn before checking the result; movement reserves cells immediately.
    const allies = this.fighters.filter((fighter) => fighter.team === 'ally');
    const enemies = this.fighters.filter((fighter) => fighter.team === 'enemy');
    const order = Array.from({ length: Math.max(allies.length, enemies.length) }, (_, index) => [allies[index], enemies[index]]).flat().filter((fighter): fighter is Fighter => Boolean(fighter));
    for (const fighter of order) {
      fighter.flash = Math.max(0, fighter.flash - dt);
      fighter.attackWait = Math.max(0, fighter.attackWait - dt);
      fighter.moveWait = Math.max(0, fighter.moveWait - dt);
      fighter.stunned = Math.max(0, fighter.stunned - dt);
      if (fighter.hp <= 0 || fighter.stunned > 0) continue;
      const targets = this.fighters.filter((other) => other.team !== fighter.team && other.hp > 0)
        .sort((a, b) => distance(fighter.cell, a.cell) - distance(fighter.cell, b.cell) || a.hp - b.hp);
      if (!targets.length) continue;
      const target = targets[0];
      if (distance(fighter.cell, target.cell) > fighter.definition.range) {
        if (fighter.moveWait <= 0) {
          const step = this.findStep(fighter, target);
          if (step !== null) fighter.cell = step;
          fighter.moveWait = 0.3;
        }
        continue;
      }
      if (fighter.attackWait > 0) continue;
      fighter.attackWait = fighter.interval / (this.elapsed > 30 ? 1.5 : 1);
      fighter.flash = 0.18;
      this.damage(fighter, target, fighter.attack);
      fighter.mana += 1;
      if (fighter.mana >= 4) {
        fighter.mana = 0;
        this.cast(fighter, target);
      }
    }
    const aliveAllies = this.fighters.filter((fighter) => fighter.team === 'ally' && fighter.hp > 0);
    const aliveEnemies = this.fighters.filter((fighter) => fighter.team === 'enemy' && fighter.hp > 0);
    if (!aliveAllies.length) this.result = 'loss';
    else if (!aliveEnemies.length) this.result = 'win';
    else if (this.elapsed >= 45) {
      const vitality = (team: Fighter[]): number => team.reduce((sum, fighter) => sum + fighter.hp / fighter.maxHp, 0);
      this.result = vitality(aliveAllies) > vitality(aliveEnemies) ? 'win' : 'loss';
      this.log = '时间到，按剩余生命比例总和判定胜负';
    }
    if (this.events.length > 24) this.events.splice(0, this.events.length - 24);
  }

  private findStep(fighter: Fighter, target: Fighter): number | null {
    const occupied = new Set(this.fighters.filter((unit) => unit.hp > 0 && unit.uid !== fighter.uid).map((unit) => unit.cell));
    const queue = [{ cell: fighter.cell, first: -1 }];
    const visited = new Set([fighter.cell]);
    for (let index = 0; index < queue.length; index++) {
      const current = queue[index];
      if (current.first >= 0 && distance(current.cell, target.cell) <= fighter.definition.range) return current.first;
      for (const cell of neighbours(current.cell)) {
        if (visited.has(cell) || occupied.has(cell)) continue;
        visited.add(cell);
        queue.push({ cell, first: current.first < 0 ? cell : current.first });
      }
    }
    return null;
  }

  private damage(source: Fighter, target: Fighter, amount: number): void {
    if (target.hp <= 0) return;
    const raw = Math.max(1, Math.round(amount * 100 / (100 + target.armor) * (this.elapsed > 30 ? 1.5 : 1)));
    const shieldDamage = Math.min(target.shield, raw);
    target.shield -= shieldDamage;
    const hpDamage = Math.min(target.hp, raw - shieldDamage);
    target.hp -= hpDamage;
    source.dealt += hpDamage + shieldDamage;
    this.events.push({ cell: target.cell, text: '−' + raw, kind: 'damage' });
  }

  private heal(target: Fighter, amount: number): void {
    if (target.hp <= 0) return;
    const healing = Math.min(target.maxHp - target.hp, Math.round(amount));
    target.hp += healing;
    if (healing > 0) this.events.push({ cell: target.cell, text: '+' + healing, kind: 'heal' });
  }

  private cast(source: Fighter, target: Fighter): void {
    this.log = source.definition.name + ' · ' + source.definition.skillName;
    this.events.push({ cell: source.cell, text: source.definition.skillName, kind: 'skill' });
    const enemies = this.fighters.filter((fighter) => fighter.team !== source.team && fighter.hp > 0);
    const spellAttack = source.attack * source.spell;
    switch (source.definition.skill) {
      case 'shield':
        source.shield = Math.min(source.maxHp * 0.7, source.shield + source.maxHp * 0.35 * source.spell);
        break;
      case 'heal':
        this.fighters.filter((fighter) => fighter.team === source.team && fighter.hp > 0)
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp).slice(0, 2)
          .forEach((fighter) => this.heal(fighter, 90 * starMultiplier(source.star) * source.spell));
        break;
      case 'volley':
        enemies.sort((a, b) => distance(source.cell, a.cell) - distance(source.cell, b.cell)).slice(0, 3)
          .forEach((fighter) => this.damage(source, fighter, spellAttack * 1.6));
        break;
      case 'nova':
        enemies.filter((fighter) => distance(target.cell, fighter.cell) <= 1).forEach((fighter) => this.damage(source, fighter, spellAttack * 2.3));
        break;
      case 'stun': {
        const liveTarget = target.hp > 0 ? target : enemies[0];
        if (liveTarget) { this.damage(source, liveTarget, spellAttack * 2.2); liveTarget.stunned = 1.3; }
        break;
      }
      case 'snipe': {
        const distant = enemies.sort((a, b) => distance(source.cell, b.cell) - distance(source.cell, a.cell))[0];
        if (distant) this.damage(source, distant, spellAttack * 4);
        break;
      }
    }
  }
}
