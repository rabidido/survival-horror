// Enemy actors: the Shambler (slow, tanky) and the Crawler (fast, fragile).
import * as THREE from '../vendor/three.module.min.js';
import { buildHumanoid, buildCrawler, poseShamble, poseShambleAttack, poseCrawl, poseCrawlLunge } from './actor.js';
import { blobShadow } from './world.js';

const TYPES = {
  shambler: {
    hp: 100, speed: 0.78, chaseSpeed: 1.05, sense: 9.5, reach: 1.35,
    windup: 0.55, recover: 1.25, damage: 18, staggerChance: 0.45, mass: 1,
    name: 'Shambler',
  },
  crawler: {
    hp: 58, speed: 1.4, chaseSpeed: 3.4, sense: 11, reach: 1.7,
    windup: 0.38, recover: 1.0, damage: 13, staggerChance: 0.75, mass: 0.6,
    name: 'Crawler',
  },
};

let uid = 0;

export class Enemy {
  constructor(spec) {
    this.type = spec.type;
    this.def = TYPES[spec.type];
    this.id = 'e' + (uid++);
    this.x = spec.x; this.z = spec.z;
    this.angle = spec.facing || 0;
    this.hp = this.def.hp;
    this.state = spec.sleep ? 'sleep' : 'idle';
    this.timer = 0;
    this.anim = Math.random() * 6.28;
    this.radius = spec.type === 'crawler' ? 0.42 : 0.38;
    this.alerted = false;
    this.flash = 0;
    this.attackCooldown = 0;
    this.deadTime = 0;
    this.wanderAngle = this.angle;
    this.wanderTimer = 0;

    if (spec.type === 'crawler') {
      const m = buildCrawler();
      this.group = m.group; this.parts = m.parts;
    } else {
      const m = buildHumanoid({
        skin: 0x86756a, top: 0x3c3a33, bottom: 0x2a2622, hair: 0x14100c,
        scale: 1.0, hunch: 0.35,
      });
      this.group = m.group; this.parts = m.parts;
    }
    this.shadow = blobShadow(this.radius * 1.6);
    this.group.add(this.shadow);
    this.materials = [];
    this.group.traverse(o => { if (o.material && o.material.emissive) this.materials.push(o.material); });
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.angle;
  }

  get dead() { return this.state === 'dead'; }

  hit(dmg, fromAngle, ctx) {
    if (this.dead) return;
    this.hp -= dmg;
    this.flash = 1;
    this.alerted = true;
    if (this.hp <= 0) {
      this.state = 'dead'; this.timer = 0;
      if (ctx && ctx.onKill) ctx.onKill(this);
      return;
    }
    if (this.state !== 'attack' || Math.random() < 0.3) {
      if (Math.random() < this.def.staggerChance) {
        this.state = 'stagger';
        this.timer = this.type === 'crawler' ? 0.4 : 0.7;
        // knock back a little
        this.x -= Math.cos(fromAngle) * 0.12;
        this.z -= Math.sin(fromAngle) * 0.12;
      }
    }
  }

  update(dt, ctx) {
    const d = this.def;
    this.anim += dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 4);
    const fc = this.flash * 0.9;
    for (const m of this.materials) m.emissive.setRGB(fc * 0.7, fc * 0.06, fc * 0.06);

    if (this.state === 'dead') {
      this.deadTime += dt;
      const k = Math.min(1, this.deadTime * 2.2);
      this.group.rotation.z = k * (this.type === 'crawler' ? 0.9 : 1.5);
      this.group.position.y = -k * (this.type === 'crawler' ? 0.18 : 0.35);
      this.shadow.material.opacity = 0.9 * (1 - Math.min(1, this.deadTime * 0.25));
      return;
    }

    const px = ctx.player.x, pz = ctx.player.z;
    const dx = px - this.x, dz = pz - this.z;
    const dist = Math.hypot(dx, dz);
    const toPlayer = Math.atan2(dx, dz);

    if (this.state === 'sleep') {
      if (dist < 3.2 || this.alerted) { this.state = 'idle'; this.alerted = true; this.timer = 0.6; }
      this.poseIdle();
      this.sync();
      return;
    }

    if (!this.alerted && dist < d.sense && ctx.lineOfSight(this.x, this.z, px, pz)) {
      this.alerted = true;
      this.state = 'idle'; this.timer = 0.45;
      if (ctx.onAlert) ctx.onAlert(this);
    }

    let speed = 0, moving = 0;

    switch (this.state) {
      case 'idle': {
        this.timer -= dt;
        this.turnToward(toPlayer, dt * (this.alerted ? 2.6 : 1.0));
        if (this.timer <= 0) this.state = this.alerted ? 'chase' : 'wander';
        break;
      }
      case 'wander': {
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
          this.wanderTimer = 2 + Math.random() * 3;
          this.wanderAngle = this.angle + (Math.random() - 0.5) * 2.4;
        }
        this.turnToward(this.wanderAngle, dt * 1.1);
        speed = d.speed * 0.45; moving = 0.5;
        if (this.alerted) this.state = 'chase';
        break;
      }
      case 'chase': {
        this.turnToward(toPlayer, dt * (this.type === 'crawler' ? 4.5 : 1.8));
        speed = this.type === 'crawler' ? d.chaseSpeed : d.speed;
        moving = 1;
        this.attackCooldown -= dt;
        const facing = Math.abs(angDiff(this.angle, toPlayer));
        const lungeRange = this.type === 'crawler' ? 2.6 : d.reach;
        if (dist < lungeRange && facing < 0.7 && this.attackCooldown <= 0) {
          this.state = 'attack'; this.timer = 0; this.attackDone = false;
        }
        // crawlers hesitate, which is what makes them readable
        if (this.type === 'crawler' && dist > 4 && Math.random() < dt * 0.4) {
          this.state = 'idle'; this.timer = 0.3 + Math.random() * 0.4;
        }
        break;
      }
      case 'attack': {
        this.timer += dt;
        const k = this.timer / d.windup;
        if (this.type === 'crawler') {
          poseCrawlLunge(this.parts, k);
          if (this.timer < d.windup) { speed = 6.0 * Math.sin(Math.min(1, k) * Math.PI); moving = 0; }
        } else {
          poseShambleAttack(this.parts, k);
        }
        if (!this.attackDone && this.timer >= d.windup * 0.62) {
          this.attackDone = true;
          if (dist < d.reach + 0.5 && Math.abs(angDiff(this.angle, toPlayer)) < 1.1) {
            ctx.damagePlayer(d.damage, this);
          }
        }
        if (this.timer >= d.windup + d.recover * 0.5) {
          this.state = 'chase';
          this.attackCooldown = d.recover;
        }
        break;
      }
      case 'stagger': {
        this.timer -= dt;
        if (this.timer <= 0) { this.state = 'chase'; this.attackCooldown = 0.35; }
        break;
      }
    }

    if (speed > 0) {
      const nx = Math.sin(this.angle) * speed * dt;
      const nz = Math.cos(this.angle) * speed * dt;
      const res = ctx.moveWithCollision(this.x, this.z, nx, nz, this.radius, this);
      this.x = res.x; this.z = res.z;
    }

    // animation
    if (this.state !== 'attack') {
      if (this.type === 'crawler') poseCrawl(this.parts, this.anim * (moving ? 6 : 1.2), moving ? 1 : 0.25);
      else poseShamble(this.parts, this.anim * (moving ? 3.1 : 1.1), moving ? 1 : 0.3);
    }
    this.sync();
  }

  poseIdle() {
    if (this.type === 'crawler') poseCrawl(this.parts, this.anim * 1.2, 0.2);
    else poseShamble(this.parts, this.anim * 1.0, 0.25);
    this.sync();
  }

  turnToward(target, rate) {
    const diff = angDiff(this.angle, target);
    this.angle += Math.max(-rate, Math.min(rate, diff * 3.2));
  }

  sync() {
    this.group.position.x = this.x;
    this.group.position.z = this.z;
    this.group.rotation.y = this.angle;
    this.shadow.position.set(0, 0.02 - this.group.position.y, 0);
  }

  dispose() {
    this.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && o.material.map === null) o.material.dispose();
    });
  }
}

export function angDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export { TYPES as ENEMY_TYPES };
