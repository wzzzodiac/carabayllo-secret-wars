export const HUANCAVELICA_ID = 'huancavelica';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const hash = text => {
  let value = 2166136261;
  for (const char of String(text)) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
};

export const isHuancavelicaRoom = room => (
  room?.terrainPreset === HUANCAVELICA_ID || room?.arena?.phase10Theme === HUANCAVELICA_ID
);

function craterAffectsPlatform(crater, platform) {
  if (crater?.phase10PlatformId) return crater.phase10PlatformId === platform.id;
  const impactY = Number(crater?.y);
  return !Number.isFinite(impactY) || Math.abs(impactY - Number(platform.y)) <= 260;
}

export function huancavelicaPlatformY(room, platform, x) {
  let y = Number(platform?.y ?? 5000);
  for (const crater of room?.arena?.craters ?? []) {
    if (!craterAffectsPlatform(crater, platform)) continue;
    const radius = Math.max(1, Number(crater.radius ?? 0));
    const dx = Math.abs(Number(x) - Number(crater.x));
    if (dx >= radius) continue;
    y += Number(crater.depth ?? 0) * Math.sqrt(Math.max(0, 1 - (dx / radius) ** 2));
  }
  return clamp(y, 120, Number(room?.arena?.worldHeight ?? 5000));
}

export function huancavelicaTerrainY(room, x) {
  const platforms = room?.arena?.platforms ?? [];
  const matches = platforms
    .filter(platform => x >= Number(platform.x1) && x <= Number(platform.x2))
    .map(platform => huancavelicaPlatformY(room, platform, x));
  return matches.length ? Math.min(...matches) : Number(room?.arena?.worldHeight ?? 5000);
}

export function createHuancavelicaPainter(ctx, canvas, worldToScreen) {
  const pxScale = view => canvas.width / view.width;

  function cloud(x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    const shade = ctx.createLinearGradient(0, -35, 0, 38);
    shade.addColorStop(0, '#ffffff');
    shade.addColorStop(0.72, '#f4fbff');
    shade.addColorStop(1, '#c9e5f2');
    ctx.fillStyle = shade;
    ctx.shadowColor = 'rgba(78, 139, 177, .20)';
    ctx.shadowBlur = 9;
    ctx.beginPath();
    ctx.arc(-45, 9, 23, 0, Math.PI * 2);
    ctx.arc(-21, -5, 31, 0, Math.PI * 2);
    ctx.arc(14, -10, 29, 0, Math.PI * 2);
    ctx.arc(43, 8, 22, 0, Math.PI * 2);
    ctx.roundRect(-66, 3, 132, 37, 18);
    ctx.fill();
    ctx.restore();
  }

  function mountain(centerX, baseY, width, height, near = false) {
    const top = baseY - height;
    ctx.save();
    const rock = ctx.createLinearGradient(centerX - width / 2, top, centerX + width / 2, baseY);
    rock.addColorStop(0, near ? '#648fb1' : '#87abc2');
    rock.addColorStop(0.55, near ? '#47779f' : '#6f9bb8');
    rock.addColorStop(1, near ? '#315f88' : '#537f9e');
    ctx.fillStyle = rock;
    ctx.beginPath();
    ctx.moveTo(centerX - width / 2, baseY);
    ctx.lineTo(centerX, top);
    ctx.lineTo(centerX + width / 2, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = near ? '#fbfdff' : '#edf7fc';
    ctx.beginPath();
    ctx.moveTo(centerX, top);
    ctx.lineTo(centerX - width * .15, top + height * .31);
    ctx.lineTo(centerX - width * .05, top + height * .24);
    ctx.lineTo(centerX + width * .035, top + height * .36);
    ctx.lineTo(centerX + width * .12, top + height * .27);
    ctx.lineTo(centerX + width * .20, top + height * .42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(32, 79, 119, .22)';
    ctx.beginPath();
    ctx.moveTo(centerX, top);
    ctx.lineTo(centerX + width / 2, baseY);
    ctx.lineTo(centerX + width * .075, top + height * .38);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = near ? 'rgba(28, 74, 107, .20)' : 'rgba(55, 101, 129, .16)';
    ctx.beginPath();
    ctx.moveTo(centerX - width * .47, baseY);
    ctx.lineTo(centerX - width * .16, top + height * .31);
    ctx.lineTo(centerX - width * .02, top + height * .58);
    ctx.lineTo(centerX - width * .23, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = near ? 'rgba(221, 242, 249, .28)' : 'rgba(230, 246, 250, .18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - width * .16, top + height * .31);
    ctx.lineTo(centerX - width * .02, top + height * .58);
    ctx.lineTo(centerX + width * .12, top + height * .27);
    ctx.stroke();
    ctx.restore();
  }

  function forest(y, alpha, step) {
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let x = -45; x < canvas.width + 70; x += step) {
      const height = 42 + ((x * 17) % 58 + 58) % 58;
      const center = x + 9;
      ctx.fillStyle = '#173e38';
      for (let layer = 0; layer < 4; layer += 1) {
        const yy = y - height + 11 + layer * height * .21;
        const half = 6 + layer * 4.4;
        ctx.beginPath();
        ctx.moveTo(center, yy - 12);
        ctx.lineTo(center - half, yy + 16);
        ctx.quadraticCurveTo(center, yy + 10, center + half, yy + 16);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#2f6752';
      ctx.beginPath();
      ctx.moveTo(center, y - height);
      ctx.lineTo(center - 6, y - height * .46);
      ctx.lineTo(center + 4, y - height * .56);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBackdrop() {
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, '#158ee0');
    sky.addColorStop(.48, '#5bbbea');
    sky.addColorStop(1, '#d1edf7');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sunX = canvas.width * .84;
    const sunY = canvas.height * .10;
    const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 155);
    glow.addColorStop(0, 'rgba(255, 253, 218, .98)');
    glow.addColorStop(.30, 'rgba(255, 238, 145, .38)');
    glow.addColorStop(1, 'rgba(255, 238, 145, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 170, sunY - 170, 340, 340);
    ctx.fillStyle = '#fffbd8';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
    ctx.fill();

    cloud(canvas.width * .18, canvas.height * .10, 1.05);
    cloud(canvas.width * .67, canvas.height * .11, .88);
    cloud(canvas.width * .91, canvas.height * .27, .62);
    cloud(canvas.width * .45, canvas.height * .30, .40);

    const baseY = canvas.height * .94;
    mountain(canvas.width * .18, baseY, canvas.width * .34, canvas.height * .43, false);
    mountain(canvas.width * .42, baseY, canvas.width * .43, canvas.height * .56, true);
    mountain(canvas.width * .65, baseY, canvas.width * .36, canvas.height * .47, false);
    mountain(canvas.width * .83, baseY, canvas.width * .40, canvas.height * .53, true);
    const valleyMist = ctx.createLinearGradient(0, canvas.height * .56, 0, canvas.height);
    valleyMist.addColorStop(0, 'rgba(226, 246, 250, .08)');
    valleyMist.addColorStop(.48, 'rgba(183, 222, 232, .20)');
    valleyMist.addColorStop(1, 'rgba(72, 129, 137, .06)');
    ctx.fillStyle = valleyMist;
    ctx.fillRect(0, canvas.height * .55, canvas.width, canvas.height * .45);
    forest(canvas.height * .83, .18, 32);
    forest(canvas.height * .91, .34, 27);
    forest(canvas.height * .99, .56, 22);
  }

  function sampledTop(room, platform, view) {
    const left = worldToScreen(platform.x1, platform.y, view).x;
    const right = worldToScreen(platform.x2, platform.y, view).x;
    const width = Math.max(1, right - left);
    const samples = Math.max(14, Math.ceil(width / 13));
    const points = [];
    for (let index = 0; index <= samples; index += 1) {
      const x = Number(platform.x1) + (Number(platform.x2) - Number(platform.x1)) * (index / samples);
      points.push(worldToScreen(x, huancavelicaPlatformY(room, platform, x), view));
    }
    return { left, right, width, points, averageY: points.reduce((sum, point) => sum + point.y, 0) / points.length };
  }

  function traceOutline(outline) {
    ctx.beginPath();
    ctx.moveTo(outline.points[0].x, outline.points[0].y);
    for (const point of outline.points.slice(1)) ctx.lineTo(point.x, point.y);
    for (const point of outline.lower) ctx.lineTo(point.x, point.y);
    ctx.closePath();
  }

  function rockFacet(x, y, rx, ry, seed, bright = false) {
    const sides = 6 + (seed % 3);
    const gradient = ctx.createLinearGradient(x - rx, y - ry, x + rx * .7, y + ry);
    gradient.addColorStop(0, bright ? '#9d8253' : '#796344');
    gradient.addColorStop(.46, bright ? '#665238' : '#544631');
    gradient.addColorStop(1, '#302d28');
    ctx.fillStyle = gradient;
    ctx.strokeStyle = 'rgba(33, 31, 28, .54)';
    ctx.lineWidth = Math.max(1, Math.min(rx, ry) * .075);
    ctx.beginPath();
    for (let index = 0; index < sides; index += 1) {
      const angle = -Math.PI / 2 + index / sides * Math.PI * 2;
      const jitter = .78 + (((seed >>> (index % 16)) + index * 19) % 25) / 100;
      const px = x + Math.cos(angle) * rx * jitter;
      const py = y + Math.sin(angle) * ry * jitter;
      if (!index) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(239, 215, 151, .10)';
    ctx.beginPath();
    ctx.moveTo(x - rx * .62, y - ry * .18);
    ctx.lineTo(x - rx * .12, y - ry * .66);
    ctx.lineTo(x + rx * .34, y - ry * .36);
    ctx.lineTo(x - rx * .06, y - ry * .10);
    ctx.closePath();
    ctx.fill();
  }

  function paintRockMass(outline, cliff = false) {
    const body = ctx.createLinearGradient(0, outline.averageY, 0, outline.averageY + outline.depth);
    body.addColorStop(0, '#756143');
    body.addColorStop(.18, '#65533a');
    body.addColorStop(.62, '#413a30');
    body.addColorStop(1, '#242a28');
    ctx.fillStyle = body;
    ctx.fillRect(outline.left - 10, outline.averageY - 8, outline.width + 20, outline.depth + 42);

    const columns = Math.max(3, Math.ceil(outline.width / (cliff ? 86 : 78)));
    const rows = Math.max(3, Math.ceil(outline.depth / (cliff ? 76 : 64)));
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const value = (outline.seed + row * 1619 + column * 7919) >>> 0;
        const stagger = row % 2 ? .38 : 0;
        const x = outline.left + ((column + .5 + stagger) / columns) * outline.width;
        const y = outline.averageY + 18 + (row + .48) / rows * outline.depth * .88 + (((value >>> 7) % 17) - 8);
        const rx = outline.width / columns * (.58 + ((value >>> 13) % 20) / 100);
        const ry = outline.depth / rows * (.58 + ((value >>> 18) % 24) / 100);
        rockFacet(x, y, rx, ry, value, (row * 3 + column) % 7 === 0);
      }
    }

    ctx.lineCap = 'round';
    for (let index = 0; index < Math.max(3, Math.floor(outline.width / 130)); index += 1) {
      const value = (outline.seed + index * 12289) >>> 0;
      const x = outline.left + outline.width * (.12 + ((value % 75) / 100));
      const startY = outline.averageY + outline.depth * (.15 + ((value >>> 9) % 26) / 100);
      const length = outline.depth * (.16 + ((value >>> 15) % 23) / 100);
      ctx.strokeStyle = 'rgba(25, 28, 26, .68)';
      ctx.lineWidth = Math.max(1.2, outline.scale * 3.5);
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x + (((value >>> 4) % 25) - 12) * outline.scale, startY + length * .42);
      ctx.lineTo(x + (((value >>> 11) % 37) - 18) * outline.scale, startY + length);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(197, 173, 113, .13)';
      ctx.lineWidth = Math.max(1, outline.scale * 1.2);
      ctx.stroke();
    }

    const shade = ctx.createLinearGradient(0, outline.averageY, 0, outline.averageY + outline.depth);
    shade.addColorStop(0, 'rgba(22, 29, 25, 0)');
    shade.addColorStop(.7, 'rgba(17, 23, 23, .20)');
    shade.addColorStop(1, 'rgba(8, 18, 20, .58)');
    ctx.fillStyle = shade;
    ctx.fillRect(outline.left - 10, outline.averageY, outline.width + 20, outline.depth + 40);

    ctx.fillStyle = 'rgba(19, 29, 25, .58)';
    for (let index = 0; index < Math.max(2, Math.floor(outline.width / 170)); index += 1) {
      const value = (outline.seed + 31337 * (index + 1)) >>> 0;
      const x = outline.left + outline.width * (.12 + (value % 76) / 100);
      const y = outline.averageY + outline.depth * (.22 + ((value >>> 8) % 55) / 100);
      ctx.beginPath();
      ctx.ellipse(x, y, 7 + (value % 10), 3 + ((value >>> 6) % 6), -.28, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function grassCap(points, scale, seed) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(13, 29, 19, .52)';
    ctx.shadowBlur = Math.max(2, 7 * scale);
    ctx.shadowOffsetY = Math.max(1, 4 * scale);
    ctx.strokeStyle = '#173622';
    ctx.lineWidth = Math.max(10, 25 * scale);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#3f7429';
    ctx.lineWidth = Math.max(8, 19 * scale);
    ctx.stroke();
    ctx.strokeStyle = '#6ca32d';
    ctx.lineWidth = Math.max(5, 12 * scale);
    ctx.stroke();
    ctx.strokeStyle = '#b1d94a';
    ctx.lineWidth = Math.max(1.5, 3.4 * scale);
    ctx.stroke();
    for (let index = 0; index < points.length; index += 2) {
      const point = points[index];
      for (let blade = 0; blade < 5; blade += 1) {
        const height = (6 + ((seed + index * 13 + blade * 7) % 11)) * scale;
        ctx.strokeStyle = blade % 2 ? '#4d8a2a' : '#83b83b';
        ctx.lineWidth = Math.max(1, 1.6 * scale);
        ctx.beginPath();
        ctx.moveTo(point.x + (blade - 1.5) * 2, point.y - 2);
        ctx.quadraticCurveTo(point.x + (blade - 2) * 3, point.y - height * .55, point.x + (blade - 2.1) * 4, point.y - height);
        ctx.stroke();
      }
    }
    for (let index = 1; index < points.length - 1; index += 3) {
      const point = points[index];
      const drop = (5 + ((seed + index * 29) % 12)) * scale;
      ctx.strokeStyle = 'rgba(62, 116, 39, .86)';
      ctx.lineWidth = Math.max(1, 2.2 * scale);
      ctx.beginPath();
      ctx.moveTo(point.x, point.y + 2);
      ctx.quadraticCurveTo(point.x + 2 * scale, point.y + drop * .55, point.x - 2 * scale, point.y + drop);
      ctx.stroke();
    }
    ctx.restore();
  }

  function islandOutline(room, platform, view) {
    const scale = pxScale(view);
    const sampled = sampledTop(room, platform, view);
    const seed = hash(platform.id);
    const depth = Math.max(platform.kind === 'cliff' ? 120 : 72, Number(platform.depth) * canvas.height / view.height);
    const centerX = (sampled.left + sampled.right) / 2;
    const lower = [];
    if (platform.kind === 'cliff') {
      const count = Math.max(8, Math.floor(sampled.width / 52));
      for (let index = count; index >= 0; index -= 1) {
        const t = index / count;
        const edge = Math.abs(t - .5) * 2;
        lower.push({
          x: sampled.left + sampled.width * t,
          y: sampled.averageY + depth * (.70 + .28 * (1 - edge * .30) + (((seed + index * 97) % 25) / 100))
        });
      }
    } else {
      lower.push(
        { x: sampled.right, y: sampled.averageY + depth * .34 },
        { x: centerX + sampled.width * .32, y: sampled.averageY + depth * .58 },
        { x: centerX + sampled.width * .20, y: sampled.averageY + depth * .78 },
        { x: centerX + sampled.width * .08, y: sampled.averageY + depth * .94 },
        { x: centerX, y: sampled.averageY + depth },
        { x: centerX - sampled.width * .10, y: sampled.averageY + depth * .90 },
        { x: centerX - sampled.width * .23, y: sampled.averageY + depth * .73 },
        { x: centerX - sampled.width * .35, y: sampled.averageY + depth * .52 },
        { x: sampled.left, y: sampled.averageY + depth * .34 }
      );
    }
    return { ...sampled, scale, seed, depth, lower };
  }

  function drawIsland(room, platform, view) {
    const outline = islandOutline(room, platform, view);
    if (outline.right < -180 || outline.left > canvas.width + 180) return;
    ctx.save();
    traceOutline(outline);
    ctx.fillStyle = '#443a2e';
    ctx.fill();
    ctx.clip();
    paintRockMass(outline, platform.kind === 'cliff');
    ctx.restore();
    ctx.save();
    traceOutline(outline);
    ctx.strokeStyle = 'rgba(25, 35, 29, .76)';
    ctx.lineWidth = Math.max(1.2, 3.2 * outline.scale);
    ctx.stroke();
    ctx.restore();
    grassCap(outline.points, outline.scale, outline.seed);
  }

  function drawCliffFormation(room, platforms, view, side) {
    const shelves = platforms
      .filter(platform => platform.kind === 'cliff' && String(platform.id).startsWith(`${side}-`))
      .map(platform => islandOutline(room, platform, view))
      .filter(outline => outline.averageY < canvas.height + 220 && outline.averageY + outline.depth > -180)
      .sort((a, b) => a.averageY - b.averageY);
    if (!shelves.length) return;
    const inner = outline => side === 'left' ? outline.right : outline.left;
    const outer = side === 'left' ? -180 : canvas.width + 180;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(outer, shelves[0].averageY - 12);
    ctx.lineTo(inner(shelves[0]), shelves[0].averageY - 12);
    for (const [index, outline] of shelves.entries()) {
      const wobble = (((outline.seed >>> 6) % 31) - 15) * outline.scale;
      const inset = inner(outline) + (side === 'left' ? wobble : -wobble);
      ctx.lineTo(inset, outline.averageY + outline.depth * .18);
      ctx.lineTo(inset + (side === 'left' ? -1 : 1) * outline.width * (.08 + index % 2 * .05), outline.averageY + outline.depth * .92);
    }
    ctx.lineTo(outer, shelves.at(-1).averageY + shelves.at(-1).depth + 180);
    ctx.closePath();
    ctx.clip();
    const wall = ctx.createLinearGradient(side === 'left' ? 0 : canvas.width, 0, side === 'left' ? canvas.width * .34 : canvas.width * .66, canvas.height);
    wall.addColorStop(0, '#62543d');
    wall.addColorStop(.52, '#433c31');
    wall.addColorStop(1, '#26302d');
    ctx.fillStyle = wall;
    ctx.fillRect(-200, -200, canvas.width + 400, canvas.height + 400);
    ctx.strokeStyle = 'rgba(30, 32, 28, .54)';
    ctx.lineCap = 'round';
    for (let index = 0; index < 16; index += 1) {
      const seed = hash(`${side}-formation-${index}`);
      const anchor = shelves[index % shelves.length];
      const x = side === 'left'
        ? anchor.left + anchor.width * (.22 + (seed % 58) / 100)
        : anchor.left + anchor.width * (.18 + (seed % 58) / 100);
      const y = anchor.averageY + ((seed >>> 8) % 120) - 12;
      ctx.lineWidth = 2 + (seed % 4);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (((seed >>> 3) % 45) - 22), y + 55 + (seed % 45));
      ctx.lineTo(x + (((seed >>> 11) % 61) - 30), y + 110 + (seed % 70));
      ctx.stroke();
    }
    const edgeShade = ctx.createLinearGradient(side === 'left' ? canvas.width * .12 : canvas.width * .88, 0, side === 'left' ? canvas.width * .34 : canvas.width * .66, 0);
    edgeShade.addColorStop(0, 'rgba(13, 24, 23, .08)');
    edgeShade.addColorStop(1, 'rgba(10, 21, 23, .48)');
    ctx.fillStyle = edgeShade;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function pine(x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#604224';
    ctx.fillRect(-4, -39, 8, 40);
    ctx.fillStyle = '#9a7040';
    ctx.fillRect(-2.5, -38, 2, 38);
    const colors = ['#123a2a', '#175033', '#21653a', '#327941', '#438b47'];
    for (let layer = 0; layer < 6; layer += 1) {
      const yy = -91 + layer * 14;
      const width = 14 + layer * 6.7;
      ctx.fillStyle = colors[layer % colors.length];
      ctx.beginPath();
      ctx.moveTo(0, yy - 18);
      ctx.lineTo(-width * .58, yy + 2);
      ctx.lineTo(-width, yy + 17);
      ctx.quadraticCurveTo(-width * .22, yy + 12, 0, yy + 15);
      ctx.quadraticCurveTo(width * .24, yy + 11, width, yy + 17);
      ctx.lineTo(width * .56, yy + 1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(8, 35, 24, .44)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(130, 187, 87, .42)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -103);
    ctx.lineTo(-9, -78);
    ctx.lineTo(-18, -58);
    ctx.stroke();
    ctx.restore();
  }

  function bush(x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    for (let index = 0; index < 7; index += 1) {
      ctx.fillStyle = index % 3 === 0 ? '#2b6a31' : index % 3 === 1 ? '#3f8337' : '#5a963b';
      ctx.beginPath();
      ctx.arc((index - 3) * 5, -5 - (index % 2) * 4, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function fence(x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.strokeStyle = '#59351f';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-25, 1); ctx.lineTo(-25, -27);
    ctx.moveTo(25, 1); ctx.lineTo(25, -27);
    ctx.moveTo(-29, -19); ctx.lineTo(29, -19);
    ctx.moveTo(-29, -7); ctx.lineTo(29, -7);
    ctx.stroke();
    ctx.strokeStyle = '#a97438';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function sign(x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#60401f';
    ctx.fillRect(-3, -30, 6, 30);
    ctx.fillStyle = '#b67834';
    ctx.strokeStyle = '#4f2f19';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-18, -38, 34, 15, 3);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(16, -38);
    ctx.lineTo(26, -30.5);
    ctx.lineTo(16, -23);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function crate(x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#9a622e';
    ctx.strokeStyle = '#5a351b';
    ctx.lineWidth = 2.5;
    ctx.fillRect(-14, -27, 28, 27);
    ctx.strokeRect(-14, -27, 28, 27);
    ctx.beginPath();
    ctx.moveTo(-12, -25); ctx.lineTo(12, -2);
    ctx.moveTo(12, -25); ctx.lineTo(-12, -2);
    ctx.stroke();
    ctx.restore();
  }

  function flowers(x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    for (let index = 0; index < 7; index += 1) {
      const px = -16 + index * 5.3;
      ctx.strokeStyle = '#3d792f';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, -8 - (index % 3));
      ctx.stroke();
      ctx.fillStyle = index % 3 === 0 ? '#ffd84e' : index % 3 === 1 ? '#ff7587' : '#f4efff';
      ctx.beginPath();
      ctx.arc(px, -9 - (index % 3), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function vines(room, platform, view) {
    const seed = hash(platform.id);
    if (platform.kind !== 'cliff' && seed % 3 !== 0) return;
    const scale = pxScale(view);
    const worldX = Number(platform.x1) + (Number(platform.x2) - Number(platform.x1)) * (.18 + (seed % 48) / 100);
    const point = worldToScreen(worldX, huancavelicaPlatformY(room, platform, worldX), view);
    ctx.save();
    ctx.strokeStyle = 'rgba(42, 105, 43, .92)';
    ctx.lineWidth = Math.max(1.5, 3.2 * scale);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    for (let index = 1; index < 7; index += 1) {
      ctx.quadraticCurveTo(
        point.x + (index % 2 ? 13 : -10) * scale,
        point.y + index * 23 * scale,
        point.x + (index % 2 ? 5 : -4) * scale,
        point.y + index * 27 * scale
      );
    }
    ctx.stroke();
    ctx.restore();
  }

  function timberFrame(room, platform, view) {
    if (platform.kind !== 'cliff' || hash(platform.id) % 2) return;
    const scale = clamp(5000 / view.width * .55, .35, 1.1);
    const width = Number(platform.x2) - Number(platform.x1);
    const worldX = Number(platform.x1) + width * .62;
    const point = worldToScreen(worldX, huancavelicaPlatformY(room, platform, worldX), view);
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.scale(scale, scale);
    ctx.strokeStyle = '#624021';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-38, 0); ctx.lineTo(-38, 58);
    ctx.moveTo(38, 0); ctx.lineTo(38, 58);
    ctx.moveTo(-43, 5); ctx.lineTo(43, 5);
    ctx.moveTo(-38, 58); ctx.lineTo(38, 5);
    ctx.moveTo(38, 58); ctx.lineTo(-38, 5);
    ctx.stroke();
    ctx.restore();
  }

  function decorate(room, platform, view) {
    const scale = clamp(5000 / view.width * .58, .34, 1.18);
    const seed = hash(platform.id);
    const width = Number(platform.x2) - Number(platform.x1);
    const top = worldX => worldToScreen(worldX, huancavelicaPlatformY(room, platform, worldX), view);
    if (width > 500) {
      const first = top(Number(platform.x1) + width * (.18 + (seed % 16) / 100));
      pine(first.x, first.y - 2, scale * (platform.kind === 'cliff' ? 1.06 : .86));
      if (platform.kind === 'cliff' && width > 700) {
        const second = top(Number(platform.x1) + width * .82);
        pine(second.x, second.y - 2, scale * .92);
      }
    }
    if (width > 360) {
      const point = top(Number(platform.x1) + width * .42);
      bush(point.x, point.y - 2, scale * .72);
    }
    if (width > 560) {
      const point = top(Number(platform.x1) + width * .68);
      fence(point.x, point.y - 1, scale * .72);
    }
    if (seed % 4 === 0) {
      const point = top(Number(platform.x1) + width * .53);
      sign(point.x, point.y - 1, scale * .72);
    }
    if (seed % 6 === 0 && width > 420) {
      const point = top(Number(platform.x1) + width * .80);
      crate(point.x, point.y - 1, scale * .68);
    }
    const flowerX = clamp((Number(platform.x1) + Number(platform.x2)) / 2 + ((seed % 140) - 70), Number(platform.x1) + 32, Number(platform.x2) - 32);
    const flowerPoint = top(flowerX);
    flowers(flowerPoint.x, flowerPoint.y - 1, scale * .78);
    vines(room, platform, view);
    timberFrame(room, platform, view);
  }

  function drawTerrain(room, view) {
    const platforms = room?.arena?.platforms ?? [];
    drawCliffFormation(room, platforms, view, 'left');
    drawCliffFormation(room, platforms, view, 'right');
    for (const platform of [...platforms].sort((a, b) => Number(b.y) - Number(a.y))) drawIsland(room, platform, view);
    for (const platform of platforms) decorate(room, platform, view);
    const haze = ctx.createLinearGradient(0, canvas.height * .78, 0, canvas.height);
    haze.addColorStop(0, 'rgba(20, 60, 68, 0)');
    haze.addColorStop(1, 'rgba(7, 23, 30, .34)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, canvas.height * .78, canvas.width, canvas.height * .22);
  }

  return Object.freeze({ drawBackdrop, drawTerrain });
}

