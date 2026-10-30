import { clamp, drawText, HEIGHT, roundedRect, WIDTH } from '../../core/Game';
import { audio } from '../../core/Audio';
import { ReturnTrail } from './ReturnTrail';
import { SteadyReel } from './SteadyReel';
import { fishingSpots, getFishingSpot, fishingSpotWeight, type FishingSpotId } from './FishingSpots';
import type { GameControls, GameSetupOption, MiniGame } from '../../core/Game';
import { fishSpecies, fishingBaits, fishingZones, getDailyFishingEvent, getDailyFishingSighting, getDailyFishingWeather, getFishingDayPhase, getFishingDailyQuest, getFishingRodStats, getFishCounts, getFishFriendship, getFishJournalSummary, getFishTrophyRanks, getFishingBaitOptions, getFishingZoneOptions, getPreferredBait, getPreferredZone, getSelectedCatAccessory, getTrackedFish, recordFishCatch, rollFishLengthCm, savePreferredBait, savePreferredZone, type BaitId, type CatAccessoryId, type FishSpecies, type FishingBait, type FishingDailyEvent, type FishingDayPhase, type FishingWeather, type FishingZoneId } from './FishJournal';

type FishingPhase = 'waiting' | 'bite' | 'reeling' | 'fake';
const catchFeedbackDuration = 1.2;
const catchFeedbackFadeDuration = 0.32;

const zonePalettes: Record<FishingZoneId, {
  skyTop: string;
  skyMid: string;
  waterTop: string;
  waterBottom: string;
  far: string;
  near: string;
  dock: string;
  dockTop: string;
  ripple: string;
}> = {
  lake: { skyTop: '#c9edf0', skyMid: '#e4f3df', waterTop: '#7dc9c9', waterBottom: '#47a8b4', far: '#a9dcae', near: '#80c89e', dock: '#b9794d', dockTop: '#d59662', ripple: 'rgba(231,255,246,.34)' },
  reef: { skyTop: '#ffd7b1', skyMid: '#fff0c9', waterTop: '#60d5ce', waterBottom: '#1697a8', far: '#ffbd83', near: '#ee9d79', dock: '#a66d55', dockTop: '#d39a70', ripple: 'rgba(235,255,237,.42)' },
  moon: { skyTop: '#1e315e', skyMid: '#53649a', waterTop: '#315a91', waterBottom: '#162f58', far: '#46588b', near: '#344a7c', dock: '#604f68', dockTop: '#89718a', ripple: 'rgba(188,223,255,.34)' },
  aurora: { skyTop: '#172b56', skyMid: '#375477', waterTop: '#256b83', waterBottom: '#17395f', far: '#547d81', near: '#386f79', dock: '#4f5c69', dockTop: '#71818c', ripple: 'rgba(194,255,231,.4)' },
};

export class FishingGame implements MiniGame {
  readonly id = 'fishing' as const;
  readonly title = '猫猫钓鱼';
  private elapsed = 0;
  private phase: FishingPhase = 'waiting';
  private phaseTimer = 1.8;
  private chain = 0;
  private catches = 0;
  private discoveries = 0;
  private trophyStarsEarned = 0;
  private friendshipPointsEarned = 0;
  private sizeRecordsEarned = 0;
  private milestoneRewards: Array<{ title: string; reward: number }> = [];
  private dailySightingFishId = '';
  private dailySightingCompleted = false;
  private dailySightingReward = 0;
  private sightingBitesSinceLast = 0;
  private journalDiscovered = 0;
  private currentFish: FishSpecies | null = null;
  private biteWindowMax = 0;
  private reelElapsed = 0;
  private reelDuration = 0;
  private reelTension = 0.5;
  private reelPhaseOffset = 0;
  private reelProgress = 0;
  private reelMistakes = 0;
  private reelPressCooldown = 0;
  private reelWindowResolved = false;
  private reelWasInSafeZone = false;
  private steadyReel = new SteadyReel();
  private tideStage = 0;
  private tideFlash = 0;
  private lastCaughtFish: FishSpecies | null = null;
  private lastCatchWasNew = false;
  private lastCatchTrophyRank = 0;
  private lastCatchTrophyStars = 0;
  private lastCatchLengthCm = 0;
  private lastCatchSizeRecord = false;
  private lastCatchSizeLabel = '';
  private lastCatchSizeBonus = 0;
  private lastCatchFriendshipUpdate = '';
  private shoreMomentAvailable = false;
  private shoreMomentResolved = false;
  private shoreMomentTimeLeft = 0;
  private shoreMomentBoost = false;
  private shoreMomentFocus: 'discovery' | 'trophy' | 'rare' = 'discovery';
  private shoreMomentFishBoost = false;
  private shoreMomentDownHeld = false;
  private trackedFish: FishSpecies | null = getTrackedFish();
  private trackedFishCatchCount = 0;
  private returnTrail = new ReturnTrail();
  private spotId: FishingSpotId = 'spot-open';
  private runSpot: FishingSpotId = 'spot-open';
  private zoneUnlockFlash = 0;
  private zoneUnlockText = '';
  private milestoneFlash = 0;
  private milestoneFlashText = '';
  private message = '鱼竿准备好了，等鱼上钩';
  private catchFlash = 0;
  private scoreValue = 0;
  private ended = false;
  private overtimeAnnounced = false;
  private baitId: BaitId = getPreferredBait();
  private zoneId: FishingZoneId = getPreferredZone();
  private readonly weather: FishingWeather = getDailyFishingWeather();
  private dayPhase: FishingDayPhase = getFishingDayPhase();
  private readonly dailyEvent: FishingDailyEvent = getDailyFishingEvent();
  private readonly rod = getFishingRodStats();
  private readonly catAccessoryId: CatAccessoryId = getSelectedCatAccessory();

  get score(): number { return this.scoreValue; }
  get resultTitle(): string { return this.discoveries > 0 ? '带回新发现！' : this.catches > 0 ? '鱼获上岸啦' : '下次再遇见'; }
  get resultSummary(): string { return `钓到 ${this.catches} 条 · 新发现 ${this.discoveries} 种 · 收线章 +${this.trophyStarsEarned} 星`; }
  get setupOptions(): readonly GameSetupOption[] {
    const baitOptions = getFishingBaitOptions().map((bait) => ({
      id: bait.id,
      group: '鱼饵',
      icon: bait.icon,
      label: bait.label,
      detail: bait.unlocked ? this.getBaitDetail(bait) : bait.unlockHint,
      unlocked: bait.unlocked,
      unlockHint: bait.unlockHint,
    }));
    const zoneOptions = getFishingZoneOptions().map((zone) => ({
      id: zone.id,
      group: '海域',
      icon: zone.icon,
      label: zone.label,
      detail: zone.unlocked
        ? zone.detail + (zone.id === this.dailyEvent.zone.id ? ' · 今日奇遇：' + this.dailyEvent.label + '，' + this.dailyEvent.detail : '') + ' · ' + this.dayPhase.icon + this.dayPhase.label + '：' + this.dayPhase.detail
        : zone.unlockHint,
      unlocked: zone.unlocked,
      unlockHint: zone.unlockHint,
    }));
    const spotOptions = fishingSpots.map(spot => ({ id: spot.id, group: '钓点', icon: spot.icon, label: spot.label, detail: spot.detail, unlocked: true }));
    return [...baitOptions, ...zoneOptions, ...spotOptions];
  }
  get selectedSetupOption(): string { return this.baitId; }
  get selectedSetupOptions(): Readonly<Record<string, string>> { return { 鱼饵: this.baitId, 海域: this.zoneId, 钓点: this.spotId }; }
  get timeLeft(): number { return Math.max(0, 60 - this.elapsed); }
  get over(): boolean { return this.ended; }
  get outcome(): string {
    const milestones = this.milestoneRewards.length > 0
      ? '，完成里程碑 ' + this.milestoneRewards.map((milestone) => milestone.title).join('、') + '（贝壳 +' + this.milestoneRewards.reduce((sum, milestone) => sum + milestone.reward, 0) + '）'
      : '';
    const sighting = this.dailySightingReward > 0 ? '，完成今日鱼影（贝壳 +' + this.dailySightingReward + '）' : '';
    const sizeRecords = this.sizeRecordsEarned > 0 ? '，刷新鱼长纪录 ' + this.sizeRecordsEarned + ' 条' : '';
    const friendship = this.friendshipPointsEarned > 0 ? '，鱼友情升阶 +' + this.friendshipPointsEarned + ' 分' : '';
    const trackedCatch = this.trackedFishCatchCount > 0 ? '，追踪目标上岸 ' + this.trackedFishCatchCount + ' 条' : '';
    const event = (this.zoneId === this.dailyEvent.zone.id ? '，遇上' + this.dailyEvent.label : '') + '，在' + getFishingSpot(this.runSpot).label + '垂钓';
    return '在' + this.getZoneLabel() + '遇上' + this.dayPhase.label + '、' + this.weather.label + event + '，使用' + this.getBaitLabel() + '钓到 ' + this.catches + ' 条鱼，新发现 ' + this.discoveries + ' 个鱼种，收线章 +' + this.trophyStarsEarned + ' 星' + trackedCatch + friendship + sizeRecords + sighting + milestones + (this.returnTrail.recovered ? '，追回逃走的鱼 ' + this.returnTrail.recovered + ' 条' : '');
  }
  get statusText(): string {
    if (this.returnTrail.pendingId) return '鱼影仍在 · 下次真咬钩回游';
    if (this.returnTrail.active && (this.phase === 'bite' || this.phase === 'reeling')) return '回游机会 · 再试一次';
    if (this.isShoreMomentVisible()) return '岸边微光 · 可回应';
    if (this.shoreMomentBoost) return '微光引鱼中';
    return this.chain > 1 ? '连击 x' + this.chain : '收获 ' + this.catches + ' 条';
  }

  selectSetupOption(id: string): void {
    const spot = fishingSpots.find(option => option.id === id);
    if (spot) { this.spotId = spot.id; return; }
    const bait = getFishingBaitOptions().find((option) => option.id === id && option.unlocked);
    if (bait) {
      this.baitId = bait.id;
      savePreferredBait(bait.id);
      return;
    }
    const zone = getFishingZoneOptions().find((option) => option.id === id && option.unlocked);
    if (!zone) return;
    this.zoneId = zone.id;
    savePreferredZone(zone.id);
  }

  start(): void {
    this.runSpot = this.spotId;
    this.dayPhase = getFishingDayPhase();
    this.elapsed = 0;
    this.phase = 'waiting';
    this.phaseTimer = 1.5;
    this.chain = 0;
    this.catches = 0;
    this.discoveries = 0;
    this.trophyStarsEarned = 0;
    this.friendshipPointsEarned = 0;
    this.sizeRecordsEarned = 0;
    this.milestoneRewards = [];
    const sighting = getDailyFishingSighting();
    this.dailySightingFishId = sighting.fish.id;
    this.dailySightingCompleted = sighting.completed;
    this.dailySightingReward = 0;
    this.sightingBitesSinceLast = 0;
    this.journalDiscovered = getFishJournalSummary().discovered;
    this.currentFish = null;
    this.biteWindowMax = 0;
    this.resetReel();
    this.tideStage = 0;
    this.tideFlash = 0;
    this.scoreValue = 0;
    this.overtimeAnnounced = false;
    this.catchFlash = 0;
    this.zoneUnlockFlash = 0;
    this.zoneUnlockText = '';
    this.milestoneFlash = 0;
    this.milestoneFlashText = '';
    this.lastCaughtFish = null;
    this.lastCatchWasNew = false;
    this.lastCatchTrophyRank = 0;
    this.lastCatchTrophyStars = 0;
    this.lastCatchLengthCm = 0;
    this.lastCatchSizeRecord = false;
    this.lastCatchSizeLabel = '';
    this.lastCatchSizeBonus = 0;
    this.lastCatchFriendshipUpdate = '';
    this.shoreMomentAvailable = false;
    this.shoreMomentResolved = false;
    this.shoreMomentTimeLeft = 0;
    this.shoreMomentBoost = false;
    this.shoreMomentFocus = 'discovery';
    this.shoreMomentFishBoost = false;
    this.shoreMomentDownHeld = false;
    this.trackedFish = getTrackedFish();
    this.trackedFishCatchCount = 0;
    this.returnTrail = new ReturnTrail();
    this.ended = false;
    this.message = '鱼竿准备好了，等鱼上钩';
  }

  update(dt: number, controls: GameControls): void {
    if (this.ended) return;
    this.elapsed += dt;
    const nextTideStage = this.getTideStage();
    if (nextTideStage > this.tideStage) {
      this.tideStage = nextTideStage;
      this.tideFlash = 2.5;
    }
    this.catchFlash = Math.max(0, this.catchFlash - dt);
    this.tideFlash = Math.max(0, this.tideFlash - dt);
    this.zoneUnlockFlash = Math.max(0, this.zoneUnlockFlash - dt);
    this.milestoneFlash = Math.max(0, this.milestoneFlash - dt);
    if (this.elapsed >= 60) {
      this.elapsed = 60;
      if (this.phase !== 'reeling') {
        this.ended = true;
        return;
      }
      if (!this.overtimeAnnounced) {
        this.overtimeAnnounced = true;
        this.message = '时间到啦，先把手上的鱼拉上岸';
      }
    }

    this.updateShoreMoment(dt, controls);
    this.phaseTimer -= dt;
    if (this.phase === 'reeling') {
      this.reelElapsed += dt;
      this.steadyReel.update(dt);
      this.reelPressCooldown = Math.max(0, this.reelPressCooldown - dt);
      this.reelTension = this.getReelTension(this.steadyReel.phaseTime);
      const inSafeZone = this.isInSafeZone(this.reelTension);
      if (inSafeZone && !this.reelWasInSafeZone) this.reelWindowResolved = false;
      this.reelWasInSafeZone = inSafeZone;
      if (this.phaseTimer <= 0) {
        this.chain = 0;
        this.message = (this.currentFish?.name || '鱼') + '挣脱了鱼线，再找机会吧';
        if (this.returnTrail.reserve(this.currentFish?.id, this.elapsed)) this.message = '鱼影还在附近！下一次真咬钩会再回来';
        audio.play('miss');
        this.nextWait();
      }
      return;
    }

    if (this.phase === 'waiting' && this.phaseTimer <= 0) {
      const fakeBiteChance = this.weather.id === 'drizzle' ? 0.12 : 0.25;
      this.phase = Math.random() < fakeBiteChance ? 'fake' : 'bite';
      if (this.phase === 'fake') {
        this.currentFish = null;
        this.biteWindowMax = 0;
        this.phaseTimer = 0.62;
      } else {
        this.currentFish = this.pickFish();
        this.biteWindowMax = this.getBiteWindow(this.currentFish);
        this.phaseTimer = this.biteWindowMax;
      }
      audio.play(this.phase === 'fake' ? 'fake' : 'bite');
      this.message = this.phase === 'fake'
        ? '好像动了一下？'
        : this.getBiteMessage(this.currentFish) + (this.shoreMomentFishBoost ? ' · 水花引来' : '');
    } else if (this.phase !== 'waiting' && this.phaseTimer <= 0) {
      if (this.phase === 'bite') {
        this.chain = 0;
        this.message = (this.currentFish ? this.currentFish.rarity + '鱼影溜走了，再等等看' : '鱼溜走了，再等等看');
        audio.play('miss');
      } else {
        this.message = '差点上当，继续等鱼';
      }
      this.nextWait();
    }
  }

  press(x?: number, y?: number): void {
    if (this.ended) return;
    if (x !== undefined && y !== undefined && this.isShoreMomentHit(x, y)) {
      this.activateShoreMoment();
      return;
    }
    if (this.phase === 'bite') {
      this.beginReeling();
    } else if (this.phase === 'reeling') {
      this.tryReel();
    } else if (this.phase === 'fake') {
      this.chain = 0;
      this.message = '嘿嘿，是假动作！';
      audio.play('fake');
      this.nextWait();
    } else {
      this.chain = 0;
      this.message = '太心急啦，等等浮标动起来';
    }
  }

  render(ctx: CanvasRenderingContext2D, now: number): void {
    const palette = zonePalettes[this.zoneId];
    const hudColor = this.zoneId === 'moon' || this.zoneId === 'aurora' ? '#fff1c9' : '#315d61';
    const hudMuted = this.zoneId === 'moon' || this.zoneId === 'aurora' ? '#d2def4' : '#52797b';
    const waterline = this.getWaterlineY();
    const tideOffset = waterline - 292;
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, palette.skyTop);
    sky.addColorStop(Math.max(0, waterline / HEIGHT - 0.012), palette.skyMid);
    sky.addColorStop(waterline / HEIGHT, palette.waterTop);
    sky.addColorStop(1, palette.waterBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    this.drawDayPhaseEffect(ctx, now, waterline);
    this.drawZoneDecor(ctx, now);

    ctx.fillStyle = palette.far;
    ctx.beginPath();
    ctx.ellipse(130, 180, 210, 75, -0.13, 0, Math.PI * 2);
    ctx.ellipse(840, 170, 250, 90, 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.near;
    ctx.beginPath();
    ctx.ellipse(0, 220, 280, 74, 0, 0, Math.PI * 2);
    ctx.ellipse(950, 215, 270, 85, 0, 0, Math.PI * 2);
    ctx.fill();

    this.drawZoneWaterDecor(ctx, now);
    this.drawDailyEventEffect(ctx, now);
    this.drawWeatherEffect(ctx, now);
    this.drawShoreMoment(ctx);

    for (let i = 0; i < 7; i += 1) {
      const x = (i * 163 + now * (10 + i) % 110) % 1000;
      const y = 350 + (i % 3) * 57 + tideOffset + Math.sin(now * 1.4 + i) * 5;
      ctx.strokeStyle = palette.ripple;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, y, 34 + i * 2, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 木码头
    ctx.fillStyle = palette.dock;
    roundedRect(ctx, 0, 390, 300, 42, 14);
    ctx.fill();
    ctx.fillStyle = palette.dockTop;
    roundedRect(ctx, 0, 380, 300, 20, 10);
    ctx.fill();
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = 'rgba(112,67,43,.22)';
      ctx.fillRect(14 + i * 60, 400, 2, 24);
    }

    this.drawCat(ctx, 175, 345, now);
    ctx.strokeStyle = '#574638';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(205, 316);
    ctx.quadraticCurveTo(340, 276, 505, 292);
    ctx.stroke();

    const biteRatio = this.phase === 'bite' && this.biteWindowMax > 0
      ? clamp(this.phaseTimer / this.biteWindowMax, 0, 1)
      : 1;
    const signalColor = this.getSignalColor(this.currentFish);
    const biteMotion = this.phase === 'bite' ? this.getBiteMotion(this.currentFish) : { amplitude: 8, frequency: 35 };
    const bobX = 505;
    const bobY = this.phase === 'bite'
      ? 337 + tideOffset + Math.sin(now * biteMotion.frequency) * biteMotion.amplitude + (1 - biteRatio) * 10
      : this.phase === 'fake'
        ? 337 + tideOffset + Math.sin(now * 29) * 5
        : 340 + tideOffset + Math.sin(now * 2.2) * 4;
    if (this.phase === 'bite' && this.currentFish && (this.currentFish.rarity === '稀有' || this.currentFish.rarity === '传说')) {
      ctx.strokeStyle = this.currentFish.rarity === '传说' ? 'rgba(255,239,157,.72)' : 'rgba(186,151,255,.64)';
      ctx.lineWidth = 2;
      for (let ring = 0; ring < 2; ring += 1) {
        ctx.beginPath();
        ctx.ellipse(bobX, bobY + 7, 18 + ring * 12 + Math.sin(now * 8 + ring) * 3, 5 + ring * 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,.78)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(505, 292);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();
    ctx.fillStyle = this.phase === 'bite' ? signalColor : '#ff7d72';
    ctx.beginPath();
    ctx.ellipse(bobX, bobY, 9, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6dd';
    ctx.beginPath();
    ctx.ellipse(bobX, bobY + 8, 7, 6, 0, 0, Math.PI);
    ctx.fill();

    if (this.phase === 'bite') {
      ctx.fillStyle = 'rgba(255,255,255,.62)';
      roundedRect(ctx, bobX - 24, bobY - 31, 48, 6, 3);
      ctx.fill();
      ctx.fillStyle = signalColor;
      roundedRect(ctx, bobX - 24, bobY - 31, 48 * biteRatio, 6, 3);
      ctx.fill();
    }

    if (this.catchFlash > 0 && this.lastCaughtFish) {
      const catchProgress = 1 - clamp(this.catchFlash / catchFeedbackDuration, 0, 1);
      const fishX = 505 - catchProgress * 285;
      const fishY = 337 - Math.sin(catchProgress * Math.PI) * 112;
      ctx.save();
      ctx.globalAlpha = clamp(this.catchFlash / catchFeedbackFadeDuration, 0, 1);
      ctx.fillStyle = this.lastCatchWasNew ? 'rgba(255,239,157,.62)' : 'rgba(255,243,178,.42)';
      ctx.beginPath();
      const fishDisplaySize = 25 + this.lastCatchSizeBonus * 0.7;
      ctx.ellipse(fishX, fishY, fishDisplaySize, fishDisplaySize, 0, 0, Math.PI * 2);
      ctx.fill();
      drawText(ctx, this.lastCaughtFish.icon, fishX, fishY, 31 + this.lastCatchSizeBonus * 0.8, '#fff3b2', 900);
      if (this.lastCatchWasNew) drawText(ctx, '✦', fishX + 19, fishY - 19, 15, '#fff3b2', 900);
      let catchDetailLine = 0;
      if (this.lastCatchTrophyStars > 0) {
        drawText(ctx, '收线章 ' + '★'.repeat(this.lastCatchTrophyRank) + '☆'.repeat(3 - this.lastCatchTrophyRank), fishX, fishY - (34 + catchDetailLine * 17), 12, '#fff3b2', 900);
        catchDetailLine += 1;
        drawText(ctx, '贝壳 +' + this.lastCatchTrophyStars, fishX, fishY - (34 + catchDetailLine * 17), 11, '#ffe9a4', 800);
        catchDetailLine += 1;
      }
      if (this.lastCatchLengthCm > 0) {
        drawText(ctx, this.lastCatchSizeLabel + ' · ' + this.lastCatchLengthCm + ' cm' + (this.lastCatchSizeRecord ? ' · 新纪录' : ''), fishX, fishY - (34 + catchDetailLine * 17), 11, '#fff3b2', 900);
        catchDetailLine += 1;
      }
      if (this.lastCatchFriendshipUpdate) drawText(ctx, this.lastCatchFriendshipUpdate, fishX, fishY - (34 + catchDetailLine * 17), 11, '#ffe1f2', 900);
      ctx.restore();
    }

    const messageLines = this.wrapMessageLines(ctx, this.message, 18, 450);
    messageLines.slice(0, 2).forEach((line, index) => {
      drawText(ctx, line, 690, 198 + index * 22, 18, this.phase === 'bite' || this.phase === 'reeling' ? signalColor : hudColor, 800);
    });
    drawText(ctx, this.phase === 'reeling' ? '看准绿色区再拉线' : '点一下或按空格收竿', 690, 250, 14, hudMuted, 600);
    drawText(ctx, '本局鱼饵：' + this.getBaitLabel(), 690, 280, 14, hudMuted, 700);
    drawText(ctx, '天气：' + this.weather.icon + ' ' + this.weather.label + ' · ' + this.getWeatherHint(), 690, 310, 12, hudMuted, 700);
    drawText(ctx, '潮汐：' + ['平潮', '回游潮', '星潮'][this.tideStage] + ' · ' + this.dayPhase.icon + this.dayPhase.label + ' · ' + this.dayPhase.detail, 690, 338, 12, this.tideFlash > 0 ? '#f3d488' : hudMuted, 800);
    const isReeling = Boolean(this.currentFish && (this.phase === 'bite' || this.phase === 'reeling'));
    const lineOffset = isReeling ? 22 : 0;
    drawText(ctx, '今日奇遇 · ' + this.dailyEvent.icon + ' ' + this.dailyEvent.label + (this.zoneId === this.dailyEvent.zone.id ? '（已生效）' : ' · ' + this.dailyEvent.zone.label), 690, 362 + lineOffset, 12, hudMuted, 700);
    drawText(ctx, this.getZoneLabel() + ' · ' + getFishingSpot(this.runSpot).label, 690, 386 + lineOffset, 14, hudMuted, 700);
    drawText(ctx, '猫猫装备 · ' + this.rod.label + ' Lv.' + this.rod.level, 690, 414 + lineOffset, 14, hudMuted, 700);
    const sightingFish = fishSpecies.find((fish) => fish.id === this.dailySightingFishId);
    if (this.trackedFish) {
      const trackedZone = fishingZones.find((zone) => zone.id === this.trackedFish?.zoneId);
      const trackedAvailable = this.trackedFish.zoneId === this.zoneId && (!this.trackedFish.eventId || this.trackedFish.eventId === this.dailyEvent.id);
      drawText(ctx, '追踪目标 · ' + this.trackedFish.name + (trackedAvailable ? ' · 出现率提升' : ' · 前往' + (trackedZone?.label || '目标海域')), 690, 442 + lineOffset, 12, hudMuted, 700);
    } else if (sightingFish) {
      drawText(ctx, '今日鱼影 · ' + sightingFish.name + (this.dailySightingCompleted ? ' ✓' : ' · 出现率提升'), 690, 442 + lineOffset, 13, hudMuted, 700);
    }
    if (this.currentFish && (this.phase === 'bite' || this.phase === 'reeling')) {
      drawText(ctx, '挣扎习性 · ' + this.currentFish.pullHint, 690, 362, 14, hudMuted, 700);
    }
    if (this.zoneUnlockFlash > 0) {
      ctx.fillStyle = 'rgba(255,240,188,.94)';
      roundedRect(ctx, 573, 165, 234, 28, 14);
      ctx.fill();
      drawText(ctx, this.zoneUnlockText, 690, 179, 12, '#7c5d36', 900);
    }
    if (this.milestoneFlash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.milestoneFlash);
      ctx.fillStyle = 'rgba(255,248,218,.95)';
      roundedRect(ctx, 230, 112, 500, 34, 17);
      ctx.fill();
      drawText(ctx, this.milestoneFlashText, WIDTH / 2, 129, 13, '#926a31', 900);
      ctx.restore();
    }
    if (this.phase === 'reeling') this.drawReelMeter(ctx, now);
    drawText(ctx, this.phase === 'reeling' ? '指针进入绿色区时点按 / 按空格 · 连续拉线 3 次' : '看浮标信号收竿：稀有鱼更急，假动作别上当', 480, 500, 14, 'rgba(255,255,255,.82)', 600);
    drawText(ctx, '鱼图鉴 ' + this.journalDiscovered + '/' + fishSpecies.length + ' · 本局新发现 ' + this.discoveries + ' 种', 480, 474, 14, '#fff8df', 700);
  }

  private getAvailableFish(): FishSpecies[] {
    return fishSpecies.filter((fish) => fish.zoneId === this.zoneId && (!fish.eventId || fish.eventId === this.dailyEvent.id));
  }

  private pickFish(): FishSpecies {
    const availableFish = this.getAvailableFish();
    const returningId = this.returnTrail.take();
    const returningFish = availableFish.find(fish => fish.id === returningId);
    if (returningFish) {
      if (returningFish.id === this.dailySightingFishId) this.sightingBitesSinceLast = 0;
      this.consumeShoreMomentBoost();
      return returningFish;
    }
    this.returnTrail.active = false;
    const sightingFish = availableFish.find((fish) => fish.id === this.dailySightingFishId);
    if (!this.dailySightingCompleted && sightingFish) {
      this.sightingBitesSinceLast += 1;
      if (this.sightingBitesSinceLast >= 5) {
        this.sightingBitesSinceLast = 0;
        this.consumeShoreMomentBoost();
        return sightingFish;
      }
    }
    const needsCatchCounts = this.baitId === 'echo' || this.weather.id === 'mist' || this.dayPhase.id === 'dawn' || this.shoreMomentBoost || (this.zoneId === this.dailyEvent.zone.id && this.dailyEvent.effect === 'undiscovered');
    const catchCounts = needsCatchCounts ? getFishCounts() : undefined;
    const trophyRanks = this.baitId === 'echo' || this.shoreMomentBoost ? getFishTrophyRanks() : undefined;
    const totalWeight = availableFish.reduce((sum, fish) => sum + this.getFishWeight(fish, catchCounts, trophyRanks), 0);
    let roll = Math.random() * totalWeight;
    for (const fish of availableFish) {
      roll -= this.getFishWeight(fish, catchCounts, trophyRanks);
      if (roll < 0) {
        if (fish.id === this.dailySightingFishId) this.sightingBitesSinceLast = 0;
        this.consumeShoreMomentBoost();
        return fish;
      }
    }
    const fallback = availableFish[0] || fishSpecies[0];
    if (fallback.id === this.dailySightingFishId) this.sightingBitesSinceLast = 0;
    this.consumeShoreMomentBoost();
    return fallback;
  }

  private getFishWeight(fish: FishSpecies, catchCounts?: Record<string, number>, trophyRanks?: Record<string, number>): number {
    let weight = fish.weight * fishingSpotWeight(this.runSpot, fish.rarity);
    if (this.baitId === 'cloud') {
      if (fish.rarity === '常见') weight *= 1.28;
      else if (fish.rarity === '稀有' || fish.rarity === '传说') weight *= 0.78;
    } else if (this.baitId === 'starlight') {
      if (fish.rarity === '传说') weight *= 3;
      else if (fish.rarity === '稀有') weight *= 1.16;
      else if (fish.rarity === '常见') weight *= 0.62;
    } else if (this.baitId === 'glow') {
      if (fish.rarity === '稀有') weight *= 2;
      else if (fish.rarity === '传说') weight *= 2.2;
      else if (fish.rarity === '常见') weight *= 0.72;
    } else if (this.baitId === 'shrimp') {
      const favoredFish = this.zoneId === 'reef' ? 'pearl-clam' : this.zoneId === 'moon' ? 'glass-whale' : this.zoneId === 'aurora' ? 'aurora-skate' : 'crystal-shrimp';
      if (fish.id === favoredFish) weight *= 3.5;
      else if (this.zoneId === 'lake' && fish.id === 'coral-octopus') weight *= 2.2;
      else weight *= 0.82;
    } else if (this.baitId === 'echo') {
      if (!catchCounts?.[fish.id]) weight *= 3.2;
      else {
        const rank = trophyRanks?.[fish.id] || 0;
        weight *= rank >= 3 ? 0.68 : rank === 2 ? 1.08 : 1.38;
      }
    }
    if (this.weather.id === 'sunny' && fish.rarity === '常见') weight *= 1.3;
    if (this.weather.id === 'drizzle' && fish.rarity === '少见') weight *= 1.3;
    if (this.weather.id === 'moon-tide' && (fish.rarity === '稀有' || fish.rarity === '传说')) weight *= 1.3;
    if (this.weather.id === 'breeze' && fish.pullStyle === 'dart') weight *= 1.35;
    if (this.weather.id === 'mist' && !catchCounts?.[fish.id]) weight *= 1.5;
    if (this.shoreMomentBoost) {
      if (this.shoreMomentFocus === 'discovery' && !catchCounts?.[fish.id]) weight *= 1.8;
      else if (this.shoreMomentFocus === 'trophy' && (trophyRanks?.[fish.id] || 0) < 3) weight *= 1.45;
      else if (this.shoreMomentFocus === 'rare' && (fish.rarity === '稀有' || fish.rarity === '传说')) weight *= 1.25;
    }
    if (this.dayPhase.id === 'dawn' && !catchCounts?.[fish.id]) weight *= 1.2;
    if (this.dayPhase.id === 'day' && fish.rarity === '常见') weight *= 1.16;
    if (this.dayPhase.id === 'sunset' && fish.rarity === '稀有') weight *= 1.2;
    if (this.dayPhase.id === 'night' && fish.rarity === '传说') weight *= 1.22;
    if (this.tideStage === 0 && fish.rarity === '常见') weight *= 1.12;
    if (this.tideStage === 1 && fish.rarity === '少见') weight *= 1.18;
    if (this.tideStage === 2 && (fish.rarity === '稀有' || fish.rarity === '传说')) weight *= 1.25;
    if (!this.dailySightingCompleted && fish.id === this.dailySightingFishId) weight *= 3.2;
    if (this.zoneId === this.dailyEvent.zone.id) {
      if (this.dailyEvent.effect === 'school' && (fish.rarity === '常见' || fish.rarity === '少见')) weight *= 1.25;
      else if (this.dailyEvent.effect === 'undiscovered' && !catchCounts?.[fish.id]) weight *= 1.35;
      else if (this.dailyEvent.effect === 'legendary' && fish.rarity === '传说') weight *= 1.45;
    }
    if (this.trackedFish?.id === fish.id) weight *= 2.5;
    return weight;
  }

  private getTideStage(): number {
    return this.elapsed >= 40 ? 2 : this.elapsed >= 20 ? 1 : 0;
  }

  private getWaterlineY(): number {
    return 292 - this.tideStage * 7;
  }

  private getWeatherHint(): string {
    switch (this.weather.id) {
      case 'sunny': return '常见鱼更靠岸，提示更久';
      case 'drizzle': return '少见鱼更多，假动作更少';
      case 'moon-tide': return '稀有鱼更多，星潮时线更急';
      case 'breeze': return '变速鱼更多，拉线更急';
      case 'mist': return '新鱼更易出现，提示更久';
    }
  }

  private drawDayPhaseEffect(ctx: CanvasRenderingContext2D, now: number, waterline: number): void {
    ctx.save();
    if (this.dayPhase.id === 'dawn' || this.dayPhase.id === 'sunset') {
      const color = this.dayPhase.id === 'dawn' ? '255,204,145' : '255,132,112';
      const glow = ctx.createRadialGradient(660, waterline - 35, 8, 660, waterline - 35, 330);
      glow.addColorStop(0, 'rgba(' + color + ',.25)');
      glow.addColorStop(1, 'rgba(' + color + ',0)');
      ctx.fillStyle = glow;
      ctx.fillRect(280, 0, 680, waterline);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = this.dayPhase.id === 'dawn' ? '#ffe6b4' : '#ffb39a';
      ctx.beginPath();
      ctx.ellipse(660, waterline - 15, 76, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.dayPhase.id === 'day') {
      const daylight = ctx.createRadialGradient(750, 42, 12, 750, 42, 320);
      daylight.addColorStop(0, 'rgba(255,250,221,.18)');
      daylight.addColorStop(1, 'rgba(255,250,221,0)');
      ctx.fillStyle = daylight;
      ctx.fillRect(400, 0, 560, waterline);
    } else if (this.dayPhase.id === 'night') {
      ctx.fillStyle = 'rgba(19,35,77,.12)';
      ctx.fillRect(0, 0, WIDTH, waterline);
      for (let index = 0; index < 18; index += 1) {
        const x = 42 + (index * 149) % 875;
        const y = 28 + (index * 67) % Math.max(80, waterline - 115);
        ctx.globalAlpha = 0.3 + (Math.sin(now * 1.6 + index) + 1) * 0.2;
        ctx.fillStyle = '#fff3c2';
        ctx.beginPath();
        ctx.arc(x, y, index % 5 === 0 ? 2 : 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private getShoreMomentLabel(): string {
    switch (this.zoneId) {
      case 'lake': return '湖边萤火';
      case 'reef': return '珍珠气泡';
      case 'moon': return '星屑水花';
      case 'aurora': return '极光冰纹';
    }
  }

  private getShoreMomentColor(): string {
    switch (this.zoneId) {
      case 'lake': return '#fff0a8';
      case 'reef': return '#ffd9bd';
      case 'moon': return '#ddceff';
      case 'aurora': return '#b9ffed';
    }
  }

  private updateShoreMoment(dt: number, controls: GameControls): void {
    const downHeld = controls.keys.has('down');
    const canShow = this.phase === 'waiting' && this.catchFlash <= 0 && this.elapsed < 60;
    if (!this.shoreMomentResolved && this.elapsed >= 12 && canShow) {
      this.shoreMomentAvailable = true;
      this.shoreMomentResolved = true;
      this.shoreMomentTimeLeft = 7;
      this.message = this.getShoreMomentLabel() + '出现了，点一下回应（也可按 ↓）';
    } else if (this.isShoreMomentVisible()) {
      // Only spend the response window while waiting; a bite or catch animation takes priority.
      const visibleTime = Math.min(dt, Math.max(0, this.phaseTimer));
      this.shoreMomentTimeLeft = Math.max(0, this.shoreMomentTimeLeft - visibleTime);
      if (this.shoreMomentTimeLeft <= 0) {
        this.shoreMomentAvailable = false;
        this.message = '水花散开啦，继续等浮标';
      }
    }
    if (this.isShoreMomentVisible() && downHeld && !this.shoreMomentDownHeld) this.activateShoreMoment();
    this.shoreMomentDownHeld = downHeld;
  }

  private isShoreMomentVisible(): boolean {
    return this.shoreMomentAvailable && this.phase === 'waiting' && this.catchFlash <= 0 && !this.ended && this.elapsed < 60;
  }

  private getShoreMomentPoint(): { x: number; y: number } {
    return { x: 390, y: 324 + (this.getWaterlineY() - 292) + Math.sin(this.elapsed * 3) * 3 };
  }

  private isShoreMomentHit(x: number, y: number): boolean {
    if (!this.isShoreMomentVisible()) return false;
    const point = this.getShoreMomentPoint();
    return Math.hypot(x - point.x, y - point.y) <= 34
      || (Math.abs(x - point.x) <= 132 && y >= point.y + 24 && y <= point.y + 54);
  }

  private activateShoreMoment(): void {
    if (!this.isShoreMomentVisible()) return;
    const availableFish = this.getAvailableFish();
    const counts = getFishCounts();
    const trophies = getFishTrophyRanks();
    this.shoreMomentFocus = availableFish.some((fish) => !counts[fish.id])
      ? 'discovery'
      : availableFish.some((fish) => (trophies[fish.id] || 0) < 3) ? 'trophy' : 'rare';
    this.shoreMomentAvailable = false;
    this.shoreMomentBoost = true;
    const hint = this.shoreMomentFocus === 'discovery' ? '带来新发现' : this.shoreMomentFocus === 'trophy' ? '遇见未满三星的鱼' : '遇见稀有鱼';
    this.message = this.getShoreMomentLabel() + '回应了你！下一次鱼影更容易' + hint;
  }

  private consumeShoreMomentBoost(): void {
    this.shoreMomentFishBoost = this.shoreMomentBoost;
    this.shoreMomentBoost = false;
  }

  private drawShoreMoment(ctx: CanvasRenderingContext2D): void {
    if (!this.isShoreMomentVisible()) return;
    const point = this.getShoreMomentPoint();
    const color = this.getShoreMomentColor();
    const pulse = (Math.sin(this.elapsed * 5) + 1) * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.22 + pulse * 0.18;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(point.x, point.y + 6, 15 + pulse * 8, 4 + pulse * 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.5 + pulse * 0.35;
    drawText(ctx, this.zoneId === 'reef' ? '◉' : '✦', point.x, point.y, 22 + pulse * 4, color, 900);
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 29, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.shoreMomentTimeLeft / 7);
    ctx.stroke();
    ctx.fillStyle = 'rgba(31,61,77,.88)';
    roundedRect(ctx, point.x - 132, point.y + 24, 264, 30, 15);
    ctx.fill();
    drawText(ctx, this.getShoreMomentLabel() + ' · 点击 / ↓ 回应', point.x, point.y + 39, 13, color, 800);
    ctx.restore();
  }

  private getBiteWindow(fish: FishSpecies): number {
    const eventBonus = this.zoneId === this.dailyEvent.zone.id && this.dailyEvent.effect === 'calm' ? 0.2 : 0;
    const baitBonus = this.baitId === 'cloud' ? 0.18 : this.baitId === 'starlight' ? -0.12 : 0;
    const weatherBonus = (this.weather.id === 'sunny' && fish.rarity === '常见') || this.weather.id === 'mist' ? 0.15 : 0;
    switch (fish.rarity) {
      case '常见': return Math.max(0.35, 1.15 + eventBonus + baitBonus + weatherBonus);
      case '少见': return Math.max(0.35, 0.98 + eventBonus + baitBonus + weatherBonus);
      case '稀有': return Math.max(0.35, 0.82 + eventBonus + baitBonus + weatherBonus);
      case '传说': return Math.max(0.35, 0.68 + eventBonus + baitBonus + weatherBonus);
    }
  }

  private wrapMessageLines(ctx: CanvasRenderingContext2D, message: string, size: number, maxWidth: number): string[] {
    ctx.save();
    ctx.font = '800 ' + size + 'px "Trebuchet MS", "Microsoft YaHei", sans-serif';
    const lines: string[] = [];
    let line = '';
    for (const character of Array.from(message)) {
      const candidate = line + character;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = character;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    ctx.restore();
    return lines;
  }

  private beginReeling(): void {
    if (!this.currentFish) {
      this.nextWait();
      return;
    }
    this.phase = 'reeling';
    this.steadyReel = new SteadyReel();
    this.reelElapsed = 0;
    this.reelDuration = this.getReelDuration(this.currentFish);
    this.phaseTimer = this.reelDuration;
    this.reelPhaseOffset = Math.random() * Math.PI * 2;
    this.reelProgress = 0;
    this.reelMistakes = 0;
    this.reelPressCooldown = 0;
    this.reelTension = this.getReelTension();
    this.message = '鱼线绷紧了！等指针进绿区';
    audio.play('reel');
  }

  private getReelDuration(fish: FishSpecies): number {
    const baitBonus = (this.baitId === 'cloud' ? 1.5 : this.baitId === 'starlight' ? -1.5 : 0) + getFishingSpot(this.runSpot).timeBonus;
    switch (fish.rarity) {
      case '常见': return Math.max(5, 12 + this.rod.timeBonus + baitBonus);
      case '少见': return Math.max(5, 11 + this.rod.timeBonus + baitBonus);
      case '稀有': return Math.max(5, 10 + this.rod.timeBonus + baitBonus);
      case '传说': return Math.max(5, 9 + this.rod.timeBonus + baitBonus);
    }
  }

  private getReelTension(at = this.reelElapsed): number {
    const fish = this.currentFish;
    const speed = fish?.pullSpeed ?? 1.78;
    const weatherSpeed = this.weather.id === 'breeze' ? 1.15 : 1;
    const tideSpeed = this.weather.id === 'moon-tide' && this.tideStage === 2 ? 1.1 : 1;
    const time = at * speed * weatherSpeed * tideSpeed;
    const offset = this.reelPhaseOffset;
    const mainPull = Math.sin(time + offset) * (fish?.pullAmplitude ?? 0.31) * getFishingSpot(this.runSpot).pullScale;
    const afterPull = Math.sin(time * (fish?.secondarySpeed ?? 0.47) + offset * 0.6) * (fish?.secondaryAmplitude ?? 0.04);
    return clamp(0.5 + mainPull + afterPull, 0.04, 0.96);
  }

  private tryReel(): void {
    if (this.reelPressCooldown > 0) return;
    this.reelPressCooldown = 0.34;
    if (this.isInSafeZone(this.reelTension)) {
      if (this.reelWindowResolved) {
        this.message = '这次绿区已经拉过了，等下一次';
        return;
      }
      this.reelWindowResolved = true;
      this.reelProgress += 1;
      const zone = this.getSafeZone();
      const centered = Math.abs(this.reelTension - (zone.start + zone.end) / 2) <= (zone.end - zone.start) / 6;
      if (centered) this.steadyReel.steady();
      audio.play('reel');
      if (this.reelProgress >= 3) {
        this.finishCatch();
      } else {
        this.message = (centered ? '精准稳线！指针暂时变慢 · 再拉 ' : '拉得漂亮！再稳住 ') + (3 - this.reelProgress) + ' 次';
      }
      return;
    }

    if (this.reelTension < 0.18 || this.reelTension > 0.82) {
      this.reelMistakes += 1;
      audio.play('strain');
      if (this.reelMistakes >= 3) {
        this.chain = 0;
        this.message = (this.currentFish?.name || '鱼') + '挣脱了！下一次盯住绿色区';
        if (this.returnTrail.reserve(this.currentFish?.id, this.elapsed)) this.message = '鱼影还在附近！下一次真咬钩会再回来';
        audio.play('miss');
        this.nextWait();
        return;
      }
      this.message = this.reelTension < 0.5 ? '线松了！先等指针回到绿色区' : '线要绷断了！等指针回落';
      return;
    }

    this.message = '再等一下，指针快到绿色区了';
  }

  private finishCatch(): void {
    const fish = this.currentFish;
    if (!fish) {
      this.nextWait();
      return;
    }
    this.returnTrail.caught();
    const shellsBefore = getFishingDailyQuest().shells;
    const friendshipBefore = getFishFriendship(fish.id);
    const catchRecord = recordFishCatch(fish.id, this.reelMistakes, rollFishLengthCm(fish.id));
    const friendshipAfter = getFishFriendship(fish.id);
    const friendshipScoreBonus = friendshipAfter.level > friendshipBefore.level ? friendshipAfter.scoreReward : 0;
    if (this.trackedFish?.id === fish.id) this.trackedFishCatchCount += 1;
    this.friendshipPointsEarned += friendshipScoreBonus;
    this.lastCatchFriendshipUpdate = friendshipScoreBonus > 0
      ? (friendshipAfter.story && !friendshipBefore.story
        ? '熟络伙伴 · 新故事解锁 · +' + friendshipScoreBonus + '分'
        : '鱼友情提升 · ' + friendshipAfter.title + ' · +' + friendshipScoreBonus + '分')
      : '';
    if (catchRecord.dailySightingReward > 0) {
      this.dailySightingCompleted = true;
      this.dailySightingReward += catchRecord.dailySightingReward;
    }
    const isNew = catchRecord.isNew;
    if (catchRecord.sizeRecord) this.sizeRecordsEarned += 1;
    this.trophyStarsEarned += catchRecord.trophyShells;
    this.milestoneRewards.push(...catchRecord.milestones);
    if (catchRecord.milestones.length > 0) {
      const reward = catchRecord.milestones.reduce((sum, milestone) => sum + milestone.reward, 0);
      this.milestoneFlashText = catchRecord.milestones.length === 1
        ? '里程碑达成 · ' + catchRecord.milestones[0].title + ' · 贝壳 +' + reward
        : '里程碑达成 ×' + catchRecord.milestones.length + ' · 贝壳 +' + reward;
      this.milestoneFlash = 2.8;
    }
    const quest = getFishingDailyQuest();
    this.catches += 1;
    this.chain += 1;
    if (isNew) {
      this.discoveries += 1;
      this.journalDiscovered += 1;
    }
    const unlockedZone = isNew ? fishingZones.find((zone) => zone.unlockAt > 0 && zone.unlockAt === this.journalDiscovered) : undefined;
    if (unlockedZone) {
      this.zoneUnlockText = '新海域开放：' + unlockedZone.label;
      this.zoneUnlockFlash = 2.8;
      audio.play('unlock');
    }
    const precisionBonus = Math.max(0, 3 - this.reelMistakes) * 4;
    const points = fish.points + Math.min(this.chain - 1, 5) * 3 + (isNew ? 20 : 0) + (catchRecord.sizeRecord ? 6 : 0) + catchRecord.sizeBonus + precisionBonus + friendshipScoreBonus;
    this.scoreValue += points;
    const shellsEarned = Math.max(0, quest.shells - shellsBefore);
    const trophyMessage = catchRecord.trophyImproved
      ? ' · 章 ' + '★'.repeat(catchRecord.trophyRank)
      : '';
    const sizeMessage = ' · ' + catchRecord.sizeLabel + ' ' + catchRecord.lengthCm + ' cm' + (catchRecord.sizeRecord ? ' · 最大鱼获' : '') + ' · 尺寸加分 +' + catchRecord.sizeBonus;
    this.message = (isNew ? '新发现：' : '钓到') + fish.name + sizeMessage + trophyMessage + ' · +' + points + '分' + (shellsEarned > 0 ? ' · 贝壳 +' + shellsEarned : '');
    audio.play('catch');
    this.lastCaughtFish = fish;
    this.lastCatchWasNew = isNew;
    this.lastCatchTrophyRank = catchRecord.trophyRank;
    this.lastCatchTrophyStars = catchRecord.trophyShells;
    this.lastCatchLengthCm = catchRecord.lengthCm;
    this.lastCatchSizeRecord = catchRecord.sizeRecord;
    this.lastCatchSizeLabel = catchRecord.sizeLabel;
    this.lastCatchSizeBonus = catchRecord.sizeBonus;
    this.catchFlash = catchFeedbackDuration;
    this.nextWait();
  }

  private drawReelMeter(ctx: CanvasRenderingContext2D, now: number): void {
    const x = 290;
    const y = 406;
    const width = 380;
    const height = 20;
    const zone = this.getSafeZone();
    const goodStart = zone.start, goodEnd = zone.end;
    const needleX = x + width * this.reelTension;
    const danger = this.reelTension < 0.18 || this.reelTension > 0.82;
    const inSafeZone = this.isInSafeZone(this.reelTension);
    const cooling = this.reelPressCooldown > 0;
    const prompt = cooling ? '稳住 · 鱼线回弹中'
      : inSafeZone
      ? this.reelWindowResolved
        ? '拉得好！等指针离开绿区后再按'
        : '现在按空格 / 点击 · 拉线 ' + (this.reelProgress + 1) + '/3'
      : danger
        ? '先稳住鱼线，等指针回到绿色区'
        : '盯住白色指针，进入绿色区就按';
    const promptIsActionable = inSafeZone && !this.reelWindowResolved && !cooling;

    ctx.fillStyle = promptIsActionable
      ? 'rgba(192,245,207,.96)'
      : inSafeZone || danger
        ? 'rgba(255,231,177,.94)'
        : 'rgba(36,79,82,.82)';
    roundedRect(ctx, 292, 349, 376, 23, 11);
    ctx.fill();
    drawText(ctx, prompt, WIDTH / 2, 360.5, 12, promptIsActionable ? '#20533d' : inSafeZone || danger ? '#765019' : '#fff8df', 800);

    const future = this.getReelTension(this.steadyReel.forecast(.16));
    const trend = future - this.reelTension;
    drawText(ctx, (this.steadyReel.active ? '稳线中 ' : '鱼线张力 ') + (Math.abs(trend) < .008 ? '· 转向' : trend > 0 ? '→ 收紧' : '← 回落'), WIDTH / 2, y - 27, 14, '#fff8df', 700);
    ctx.fillStyle = 'rgba(30,77,79,.9)';
    roundedRect(ctx, x, y, width, height, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(239,119,102,.72)';
    roundedRect(ctx, x, y, width * 0.18, height, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(241,185,79,.64)';
    ctx.fillRect(x + width * 0.18, y, width * (goodStart - 0.18), height);
    ctx.fillStyle = 'rgba(105,205,155,.95)';
    ctx.fillRect(x + width * goodStart, y, width * (goodEnd - goodStart), height);
    ctx.fillStyle = this.steadyReel.active ? '#e9e6a3' : '#b4e5a4';
    ctx.fillRect(x + width * (goodStart + (goodEnd - goodStart) / 3), y + 2, width * (goodEnd - goodStart) / 3, height - 4);
    ctx.fillStyle = 'rgba(241,185,79,.64)';
    ctx.fillRect(x + width * goodEnd, y, width * (0.82 - goodEnd), height);
    ctx.fillStyle = 'rgba(239,119,102,.72)';
    ctx.fillRect(x + width * 0.82, y, width * 0.18, height);
    drawText(ctx, '稳住', x + width * (goodStart + goodEnd) / 2, y + height / 2, 10, '#27654f', 900);
    // A faint forecast uses the same tension function; it never advances the simulation.
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(x + width * future, y - 4); ctx.lineTo(x + width * future, y + height + 4); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = '#fffdf4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(needleX, y - 5 + Math.sin(now * 7) * 1.5);
    ctx.lineTo(needleX, y + height + 5);
    ctx.stroke();
    ctx.fillStyle = danger ? '#ff8173' : inSafeZone ? '#fff5ba' : '#f6c46c';
    ctx.beginPath();
    ctx.arc(needleX, y - 8, 5, 0, Math.PI * 2);
    ctx.fill();

    drawText(ctx, '拉线 ' + this.reelProgress + '/3', 420, 449, 14, '#fff8df', 700);
    drawText(ctx, '失误 ' + this.reelMistakes + '/3', 545, 449, 14, this.reelMistakes > 0 ? '#ffe3bc' : '#fff8df', 700);
    const timeRatio = this.reelDuration > 0 ? clamp(this.phaseTimer / this.reelDuration, 0, 1) : 0;
    ctx.fillStyle = 'rgba(255,255,255,.32)';
    roundedRect(ctx, 414, 462, 132, 5, 3);
    ctx.fill();
    ctx.fillStyle = '#fff2b0';
    roundedRect(ctx, 414, 462, 132 * timeRatio, 5, 3);
    ctx.fill();
  }

  private resetReel(): void {
    this.steadyReel = new SteadyReel();
    this.reelElapsed = 0;
    this.reelDuration = 0;
    this.reelTension = 0.5;
    this.reelPhaseOffset = 0;
    this.reelProgress = 0;
    this.reelMistakes = 0;
    this.reelPressCooldown = 0;
    this.reelWindowResolved = false;
    this.reelWasInSafeZone = false;
  }

  private getSafeZone(): { start: number; end: number } {
    const eventBonus = this.zoneId === this.dailyEvent.zone.id && this.dailyEvent.effect === 'calm' ? 0.025 : 0;
    const baitZoneBonus = this.baitId === 'cloud' ? 0.02 : 0;
    const spotBonus = getFishingSpot(this.runSpot).safeBonus;
    return { start: this.rod.safeStart - eventBonus - baitZoneBonus - spotBonus, end: this.rod.safeEnd + eventBonus + baitZoneBonus + spotBonus };
  }
  private isInSafeZone(tension: number): boolean { const zone = this.getSafeZone(); return tension >= zone.start && tension <= zone.end; }

  private getBiteMessage(fish: FishSpecies | null): string {
    if (!fish) return '咬钩啦！快点收竿！';
    switch (fish.rarity) {
      case '常见': return '浮标轻轻下沉！收竿！';
      case '少见': return '浮标连续点了两下！快收竿！';
      case '稀有': return '水面泛起紫色波纹！快收竿！';
      case '传说': return '浮标猛地沉下去！马上收竿！';
    }
  }

  private getSignalColor(fish: FishSpecies | null): string {
    switch (fish?.rarity) {
      case '少见': return '#f1b94f';
      case '稀有': return '#a77cf3';
      case '传说': return '#4bd8d0';
      default: return '#ff7d72';
    }
  }

  private getBiteMotion(fish: FishSpecies | null): { amplitude: number; frequency: number } {
    switch (fish?.rarity) {
      case '少见': return { amplitude: 10, frequency: 41 };
      case '稀有': return { amplitude: 13, frequency: 48 };
      case '传说': return { amplitude: 17, frequency: 56 };
      default: return { amplitude: 7, frequency: 34 };
    }
  }

  private getBaitLabel(): string {
    return fishingBaits.find((bait) => bait.id === this.baitId)?.label || '面包屑';
  }

  private getBaitDetail(bait: FishingBait): string {
    if (bait.id === 'cloud') return '绿区两侧更宽，咬钩与拉线都多一些时间；常见鱼更多，稀有鱼较少';
    if (bait.id === 'starlight') return '传说鱼更易上钩；咬钩窗口和拉线时间更短，适合冲高分';
    if (bait.id === 'echo') {
      const counts = getFishCounts();
      const availableFish = fishSpecies.filter((fish) => fish.zoneId === this.zoneId && (!fish.eventId || fish.eventId === this.dailyEvent.id));
      const undiscovered = availableFish.filter((fish) => !counts[fish.id]);
      if (undiscovered.length > 0) return '偏爱本海域 ' + undiscovered.length + ' 种未发现鱼；今天鱼影也可能被吸引';
      const trophies = getFishTrophyRanks();
      const unfinishedTrophies = availableFish.filter((fish) => (trophies[fish.id] || 0) < 3);
      return unfinishedTrophies.length > 0
        ? '本海域图鉴已收齐；偏爱还未拿到三星收线章的 ' + unfinishedTrophies.length + ' 种鱼'
        : '本海域图鉴与收线章已集满；换个海域继续探索';
    }
    if (bait.id === 'glow' && this.weather.id === 'moon-tide') {
      return '月潮也会提高稀有和传说鱼出现机会；常见鱼机会略低';
    }
    if (bait.id !== 'shrimp') return bait.detail;
    const targetId = this.zoneId === 'reef' ? 'pearl-clam' : this.zoneId === 'moon' ? 'glass-whale' : this.zoneId === 'aurora' ? 'aurora-skate' : 'crystal-shrimp';
    const targetFish = fishSpecies.find((fish) => fish.id === targetId);
    const targetName = targetFish?.name || '深水鱼';
    const bonusTarget = this.zoneId === 'lake' ? '和珊瑚章鱼' : '';
    const weatherHelpsTarget = (this.weather.id === 'sunny' && targetFish?.rarity === '常见')
      || (this.weather.id === 'drizzle' && targetFish?.rarity === '少见')
      || (this.weather.id === 'moon-tide' && (targetFish?.rarity === '稀有' || targetFish?.rarity === '传说'));
    return '偏爱' + targetName + bonusTarget + (weatherHelpsTarget ? ' · 今日天气也有帮助' : '') + '；其他鱼机会略低，换海域会改目标';
  }

  private getZoneLabel(): string {
    return fishingZones.find((zone) => zone.id === this.zoneId)?.label || '青叶湖';
  }

  private drawZoneDecor(ctx: CanvasRenderingContext2D, now: number): void {
    if (this.zoneId === 'aurora') {
      ctx.save();
      ctx.globalAlpha = 0.58;
      for (let band = 0; band < 4; band += 1) {
        ctx.strokeStyle = band % 2 === 0 ? '#7dffd0' : '#9d9cff';
        ctx.lineWidth = 13 - band * 2;
        ctx.beginPath();
        ctx.moveTo(-40, 80 + band * 23);
        ctx.bezierCurveTo(165, 18 + Math.sin(now * 0.7 + band) * 25, 330, 145 + Math.sin(now + band) * 32, 520, 68 + band * 20);
        ctx.bezierCurveTo(690, 10 + Math.cos(now * 0.65 + band) * 28, 802, 105 + band * 13, 1010, 38 + band * 30);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.82;
      for (let i = 0; i < 23; i += 1) {
        const x = (i * 149 + 37) % WIDTH;
        const y = 23 + (i * 53) % 185;
        ctx.fillStyle = '#f2f9db';
        ctx.beginPath();
        ctx.arc(x, y, i % 6 === 0 ? 2 : 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return;
    }
    if (this.zoneId !== 'moon') return;
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = '#fff0ad';
    ctx.beginPath();
    ctx.arc(795, 90, 31, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#53649a';
    ctx.beginPath();
    ctx.arc(810, 78, 27, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 13; i += 1) {
      const x = (i * 79 + 37) % 960;
      const y = 24 + (i * 31) % 90;
      ctx.globalAlpha = 0.45 + (Math.sin(now * 2 + i) + 1) * 0.25;
      drawText(ctx, i % 3 === 0 ? '✦' : '·', x, y, i % 3 === 0 ? 13 : 17, '#fff5c7', 700);
    }
    ctx.restore();
  }

  private drawZoneWaterDecor(ctx: CanvasRenderingContext2D, now: number): void {
    if (this.zoneId === 'reef') {
      ctx.save();
      for (let i = 0; i < 7; i += 1) {
        const x = 325 + i * 100;
        const y = 281 + Math.sin(now * 1.4 + i) * 12;
        ctx.globalAlpha = 0.32 + (i % 3) * 0.08;
        ctx.strokeStyle = '#e8ffec';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 6 + (i % 3) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const coral of [{ x: 336, color: '#e87978' }, { x: 919, color: '#b278b6' }]) {
        ctx.globalAlpha = 0.72;
        ctx.strokeStyle = coral.color;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(coral.x, HEIGHT + 4);
        ctx.lineTo(coral.x, 474);
        ctx.lineTo(coral.x - 17, 458);
        ctx.moveTo(coral.x, 488);
        ctx.lineTo(coral.x + 16, 470);
        ctx.moveTo(coral.x, 501);
        ctx.lineTo(coral.x - 19, 489);
        ctx.stroke();
      }
      ctx.restore();
    } else if (this.zoneId === 'moon') {
      ctx.save();
      for (let i = 0; i < 6; i += 1) {
        const y = 323 + i * 31;
        const width = 27 + Math.sin(now * 2 + i) * 12;
        ctx.globalAlpha = 0.34 - i * 0.035;
        ctx.strokeStyle = '#fff0ad';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(799 + Math.sin(now + i) * 8, y, width, 3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    } else if (this.zoneId === 'aurora') {
      ctx.save();
      ctx.strokeStyle = 'rgba(201,245,231,.5)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i += 1) {
        const x = 85 + i * 275;
        const y = 482 - (i % 2) * 16;
        ctx.beginPath();
        ctx.moveTo(x - 42, HEIGHT + 3);
        ctx.lineTo(x - 12, y);
        ctx.lineTo(x + 22, HEIGHT + 3);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawDailyEventEffect(ctx: CanvasRenderingContext2D, now: number): void {
    if (this.zoneId !== this.dailyEvent.zone.id) return;
    ctx.save();
    if (this.dailyEvent.effect === 'school') {
      for (let index = 0; index < 5; index += 1) {
        const x = 338 + index * 96;
        const y = 300 + Math.sin(now * 1.1 + index * 1.7) * 8;
        ctx.globalAlpha = 0.18 + (Math.sin(now * 2 + index) + 1) * 0.08;
        ctx.strokeStyle = '#fff0b0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, y, 15 + Math.sin(now + index) * 4, 3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (this.dailyEvent.effect === 'undiscovered') {
      for (let index = 0; index < 8; index += 1) {
        const x = 328 + (index * 67) % 245;
        const y = 277 + (index * 31) % 71 + Math.sin(now * 1.3 + index) * 5;
        ctx.globalAlpha = 0.25 + (Math.sin(now * 2.2 + index) + 1) * 0.16;
        ctx.fillStyle = index % 2 ? '#fff0dc' : '#b9fff0';
        ctx.beginPath();
        ctx.arc(x, y, 2.2 + (index % 3), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.dailyEvent.effect === 'legendary') {
      for (let index = 0; index < 4; index += 1) {
        const x = (now * (36 + index * 7) + index * 149) % 550;
        const y = 115 + (index * 43) % 125;
        ctx.globalAlpha = 0.35 + (Math.sin(now * 3 + index) + 1) * 0.18;
        ctx.strokeStyle = '#fff1b8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 17, y + 8);
        ctx.stroke();
        ctx.fillStyle = '#fff6cb';
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.dailyEvent.effect === 'calm') {
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#d8fff7';
      ctx.fillRect(310, 284 + Math.sin(now * 0.7) * 8, 292, 7);
      for (let index = 0; index < 7; index += 1) {
        const x = 326 + index * 39;
        const y = 310 + Math.sin(now * 0.8 + index * 1.4) * 15;
        ctx.globalAlpha = 0.28 + (Math.sin(now * 2.5 + index) + 1) * 0.12;
        ctx.strokeStyle = '#ddfff7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y - 4);
        ctx.lineTo(x + 4, y);
        ctx.lineTo(x, y + 4);
        ctx.lineTo(x - 4, y);
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawWeatherEffect(ctx: CanvasRenderingContext2D, now: number): void {
    if (this.weather.id === 'sunny' && this.zoneId !== 'moon' && this.zoneId !== 'aurora') {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#fff0a8';
      ctx.beginPath();
      ctx.arc(705, 91, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.32;
      ctx.strokeStyle = '#fff4c8';
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i += 1) {
        const angle = (Math.PI * 2 * i) / 8;
        ctx.beginPath();
        ctx.moveTo(705 + Math.cos(angle) * 29, 91 + Math.sin(angle) * 29);
        ctx.lineTo(705 + Math.cos(angle) * 36, 91 + Math.sin(angle) * 36);
        ctx.stroke();
      }
      ctx.restore();
    } else if (this.weather.id === 'drizzle') {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = '#f1fff5';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 28; i += 1) {
        const x = (i * 157 + now * 43) % WIDTH;
        const y = (i * 103 + now * 190) % HEIGHT;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 5, y + 15);
        ctx.stroke();
      }
      ctx.restore();
    } else if (this.weather.id === 'moon-tide') {
      ctx.save();
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 5; i += 1) {
        const x = 610 + i * 61;
        const y = 297 + (i % 2) * 39 + (this.getWaterlineY() - 292);
        drawText(ctx, i % 2 === 0 ? '✦' : '·', x, y + Math.sin(now * 2 + i) * 4, i % 2 === 0 ? 13 : 17, '#fff0ad', 700);
      }
      ctx.restore();
    } else if (this.weather.id === 'breeze') {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = this.zoneId === 'moon' || this.zoneId === 'aurora' ? '#d9f5ff' : '#f3fff0';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let i = 0; i < 8; i += 1) {
        const x = WIDTH - ((now * (42 + i * 3) + i * 163) % (WIDTH + 90));
        const y = 150 + i * 44 + Math.sin(now * 1.6 + i) * 7;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x - 23, y - 5, x - 48, y + 2);
        ctx.stroke();
      }
      ctx.restore();
    } else if (this.weather.id === 'mist') {
      ctx.save();
      ctx.globalAlpha = 0.11;
      ctx.fillStyle = '#f5fff6';
      for (let i = 0; i < 5; i += 1) {
        const x = (i * 238 + now * (5 + i)) % (WIDTH + 220) - 110;
        const y = 298 + i * 37 + Math.sin(now * 0.6 + i) * 8;
        ctx.beginPath();
        ctx.ellipse(x, y, 150 + (i % 2) * 28, 11 + (i % 3) * 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private nextWait(): void {
    this.phase = 'waiting';
    this.phaseTimer = 1.1 + Math.random() * 2.1;
    this.currentFish = null;
    this.shoreMomentFishBoost = false;
    this.biteWindowMax = 0;
    this.resetReel();
  }

  private drawCat(ctx: CanvasRenderingContext2D, x: number, y: number, now: number): void {
    const bob = Math.sin(now * 2.1) * 2;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.fillStyle = '#f2a76d';
    ctx.beginPath();
    ctx.ellipse(0, 31, 39, 31, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-32, -10);
    ctx.lineTo(-26, -53);
    ctx.lineTo(-1, -34);
    ctx.closePath();
    ctx.moveTo(3, -34);
    ctx.lineTo(28, -53);
    ctx.lineTo(34, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe1bb';
    ctx.beginPath();
    ctx.ellipse(0, -12, 34, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#35494b';
    ctx.beginPath();
    ctx.ellipse(-12, -16, 3, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(12, -16, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e7796e';
    ctx.beginPath();
    ctx.moveTo(-4, -7);
    ctx.lineTo(4, -7);
    ctx.lineTo(0, -2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8b6d5b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(-4, 4, -9, 1);
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(4, 4, 9, 1);
    ctx.stroke();
    ctx.strokeStyle = '#a98268';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-19, -6);
    ctx.lineTo(-37, -10);
    ctx.moveTo(-18, 0);
    ctx.lineTo(-37, 0);
    ctx.moveTo(19, -6);
    ctx.lineTo(37, -10);
    ctx.moveTo(18, 0);
    ctx.lineTo(37, 0);
    ctx.stroke();
    this.drawCatAccessory(ctx, this.catAccessoryId);
    ctx.restore();
  }

  private drawCatAccessory(ctx: CanvasRenderingContext2D, accessory: CatAccessoryId): void {
    if (accessory === 'none') return;
    ctx.save();
    if (accessory === 'flower') {
      const flowers = [{ x: -13, y: -39 }, { x: -5, y: -43 }, { x: 4, y: -42 }, { x: 12, y: -38 }];
      for (const flower of flowers) {
        ctx.fillStyle = '#f28ba0';
        for (let petal = 0; petal < 5; petal += 1) {
          const angle = Math.PI * 2 * petal / 5;
          ctx.beginPath();
          ctx.arc(flower.x + Math.cos(angle) * 3.2, flower.y + Math.sin(angle) * 3.2, 2.1, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#ffd879';
        ctx.beginPath();
        ctx.arc(flower.x, flower.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (accessory === 'sailor') {
      ctx.fillStyle = '#fff2dd';
      ctx.beginPath();
      ctx.moveTo(-15, 7);
      ctx.quadraticCurveTo(0, 12, 15, 7);
      ctx.lineTo(0, 24);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#477c9a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-10, 9);
      ctx.quadraticCurveTo(0, 12, 10, 9);
      ctx.stroke();
    } else if (accessory === 'moon-charm') {
      ctx.strokeStyle = '#e8bf69';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-19, 8);
      ctx.quadraticCurveTo(0, 17, 19, 8);
      ctx.stroke();
      ctx.fillStyle = '#ffe18a';
      ctx.beginPath();
      ctx.arc(0, 15, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2a76d';
      ctx.beginPath();
      ctx.arc(2, 13, 4.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (accessory === 'aurora-scarf') {
      ctx.strokeStyle = '#84d4be';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-19, 8);
      ctx.quadraticCurveTo(0, 17, 18, 8);
      ctx.stroke();
      ctx.fillStyle = '#b784d8';
      ctx.beginPath();
      ctx.moveTo(8, 12);
      ctx.lineTo(18, 13);
      ctx.lineTo(14, 28);
      ctx.lineTo(9, 20);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#dcfff0';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(10, 15);
      ctx.lineTo(15, 17);
      ctx.stroke();
    }
    ctx.restore();
  }
}
