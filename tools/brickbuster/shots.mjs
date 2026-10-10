// Pictures of Brickbuster '96's room, as a desktop and a phone, from the built page (npm run build
// first): walking in, standing back, stepping up to play, the glass cracked, the heap of bricks, the
// glass breaking and the yarn ball escaping, the room left broken and the sign on its door. dist/shots/brickbuster/
//   node tools/brickbuster/shots.mjs
import { serve } from '../serve.mjs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, DEVICES } from '../browser.mjs';

const root = new URL('../..', import.meta.url).pathname, out = join(root, 'dist/shots/brickbuster');
mkdirSync(out, { recursive: true });

const server = await serve();
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await launch(['--autoplay-policy=no-user-gesture-required']);
for (const [device, opts] of [['desktop', DEVICES.desktop], ['phone', { ...DEVICES.phone, deviceScaleFactor: 1 }]]) {
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('page error:', e.message));
  await p.goto(url);
  await p.waitForFunction(() => window.__clubhouse && window.__clubhouse.frames() > 5 && window.__clubhouse.settled(), null, { timeout: 30000 });
  await p.click('#ok');
  const shot = async (name, wait = 1000) => { await p.waitForTimeout(wait); await p.screenshot({ path: join(out, `${device}-${name}.png`) }); console.log(`dist/shots/brickbuster/${device}-${name}.png`); };
  await p.evaluate(() => { const m = window.__clubhouse; m.faceDoor('hall', 'brickbuster', 2.4); });
  await shot('1-door');
  await p.evaluate(() => { const m = window.__clubhouse; m.faceDoor('room:brickbuster', 'door', 0.6); m.turnTo(m.where().yaw + Math.PI, 0.3); });
  await shot('2-walking-in');
  await p.evaluate(() => window.__clubhouse.put('room:brickbuster', 'case'));
  await shot('3-standing-back');
  await p.evaluate(() => { const m = window.__clubhouse; m.put('room:brickbuster', { x: -2.5, z: 1.5, yaw: Math.PI + 0.7, pitch: 0.1, y: 0 }); });
  await shot('4-sadie-and-poster');
  await p.evaluate(() => { const m = window.__clubhouse; m.put('room:brickbuster', { x: 1, z: -2, yaw: -Math.PI / 2 + 0.2, pitch: 0.05, y: 0 }); });
  await shot('5-poster');
  await p.evaluate(() => window.__clubhouse.put('room:brickbuster', 'case'));
  await p.waitForTimeout(300);
  if (opts.hasTouch) await p.tap('#clubhouse #use'); else await p.keyboard.press('KeyE');
  await shot('6-playing', 2500);
  await p.evaluate(() => window.__brickbuster.loseLife());
  await shot('7-missed', 1200);
  await p.evaluate(() => window.__brickbuster.crackTop());
  await shot('7b-cracked', 500);
  // knock out most of the bricks (they land on the heap), then break the top
  await p.evaluate(() => window.__brickbuster.knockOut(30));
  await p.keyboard.press('Escape').catch(() => {});
  await p.evaluate(() => window.__clubhouse.put('room:brickbuster', { x: -1.5, z: 1.2, yaw: Math.PI - 0.3, pitch: -0.15, y: 0 }));
  await shot('8-heap', 1200);
  await p.evaluate(() => window.__clubhouse.put('room:brickbuster', 'case'));
  await p.waitForTimeout(300);
  if (opts.hasTouch) await p.tap('#clubhouse #use'); else await p.keyboard.press('KeyE');
  await p.waitForTimeout(1500);
  await p.evaluate(() => window.__brickbuster.holdRepair(true));   // (it stays broken for the pictures; mended at the end)
  for (let i = 0; i < 8 && !(await p.evaluate(() => window.__brickbuster.state().broken)); i++) {
    await p.evaluate(() => window.__brickbuster.crackTop());
    await p.waitForTimeout(500);
  }
  await shot('9-shatter', 150);
  await shot('10-escaping', 1400);
  await p.evaluate(() => { const m = window.__clubhouse; m.put('room:brickbuster', { x: -1, z: -1, yaw: -1.2, pitch: 0.1, y: 0 }); });
  await shot('11-poster', 1500);
  await p.evaluate(() => { const m = window.__clubhouse; m.put('room:brickbuster', { x: 0, z: -2, yaw: 0, pitch: 0, y: 0 }); });
  await shot('12-out-the-door', 800);
  await p.waitForTimeout(3000);
  await p.evaluate(() => { const m = window.__clubhouse; m.put('room:brickbuster', { x: 0, z: 1.2, yaw: Math.PI, pitch: -0.1, y: 0 }); });
  await shot('13-broken-room', 1000);
  await p.evaluate(() => { const m = window.__clubhouse; m.faceDoor('room:brickbuster', 'door', 3.5); m.turnTo(m.where().yaw, -0.1); });
  await shot('13b-door-from-inside', 1000);
  await p.evaluate(() => { const m = window.__clubhouse; m.put('room:brickbuster', { x: -0.3, z: 2.6, yaw: Math.PI + 0.1, pitch: -0.45, y: 0 }); });
  await shot('14-sad-paddle', 800);
  await p.evaluate(() => window.__clubhouse.faceDoor('hall', 'brickbuster', 2.4));
  await shot('15-out-of-order', 1500);
  await p.evaluate(() => { const m = window.__clubhouse; m.faceDoor('hall', 'dropper-world', 2.4); m.turnTo(m.where().yaw, -0.3); });
  await shot('16-dirt-by-dropper-world', 1200);
  // out in the hall: stand back from the yarn ball and Sadie, looking at them
  const lookAtBall = () => p.evaluate(() => {
    const m = window.__clubhouse, h = window.__brickbuster.state().hall; if (!h) return;
    const [x, y, z] = h.ball, a = Math.atan2(x, z), r = Math.hypot(x, z), onLanding = y > 4;
    const sx = Math.sin(a + (onLanding ? 0.5 : 0)) * (onLanding ? 6.6 : Math.max(1.8, r - 3)), sz = Math.cos(a + (onLanding ? 0.5 : 0)) * (onLanding ? 6.6 : Math.max(1.8, r - 3));
    const fy = onLanding ? 4.6 : 0;
    m.put('hall', { x: sx, z: sz, y: fy, yaw: Math.atan2(-(x - sx), -(z - sz)), pitch: Math.atan2(y - fy - 1.6, Math.hypot(x - sx, z - sz)) });
  });
  for (const [name, wait] of [['17-hall-yarn-ball', 2500], ['18-hall-later', 9000], ['19-hall-later-still', 9000]]) {
    await p.waitForTimeout(wait); await lookAtBall(); await shot(name, 150);
  }
  // and now the machine mends itself
  await p.evaluate(() => { const m = window.__clubhouse; window.__brickbuster.holdRepair(false); m.put('room:brickbuster', { x: -1.2, z: 1.0, yaw: Math.PI + 0.25, pitch: -0.05, y: 0 }); });
  for (const [name, wait, until] of [['20-mending-paddle', 0, s => s.fixing && !s.mended], ['21-mending-glass', 600, s => s.glassBack], ['22-mending-heap', 2200, s => s.glassBack], ['23-mended', 1000, s => !s.fixing && s.canPlay]]) {
    await p.waitForFunction(`(${until})(window.__brickbuster.state())`, null, { timeout: 60000 }).catch(() => {});
    await shot(name, wait || 900);
  }
  console.log(JSON.stringify(await p.evaluate(() => window.__brickbuster.state())));
  await ctx.close();
}
await browser.close(); server.close();
