// Brickbuster '96 in a real (hidden) browser, as a phone and as a desktop: run by tools/check.mjs
// (never on its own) with the built page. It lives in the clubhouse, so these run whenever the clubhouse
// changes too.
//
// It walks through Brickbuster's door on the landing into its room, steps up to the case (the view
// eases back to fit it), moves the paddle with the keys and the mouse (a finger on the phone), lets
// the ball drop (a life lost), steps back with the ball in the air and finds it where it was after a
// reload, cracks the top of the glass three times and breaks it (the shatter, the heap, the yarn ball's
// escape, the sign on the door), watches the machine mend itself (the paddle home, the glass back, the
// heap gone, a new board), breaks it again and finds it mends itself after a reload, and in the test
// version starts it over from the pause menu. Screenshots in dist/check/brickbuster/.
// Any error on the page is a failure.
import { bothDevices, pressPause } from '../shared/browser.mjs';

export default async function ({ browser, page, check, outDir }) {
  await bothDevices(browser, outDir, async ({ device, opts, ctx, p, errors, shot, M, up, walk, use, modeIs, until }) => {
    const B = () => p.evaluate(() => window.__brickbuster.state());
    // a finger sliding across the screen (dx pixels), or the mouse moving
    const slide = dx => p.evaluate(async dx => {
      const c = document.querySelector('#clubhouse #view'), y = innerHeight * 0.6, x0 = innerWidth / 2 - dx / 2;
      const ev = (type, x) => c.dispatchEvent(new PointerEvent(type, { pointerId: 9, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
      ev('pointerdown', x0);
      for (let i = 1; i <= 10; i++) { ev('pointermove', x0 + dx * i / 10); await new Promise(ok => setTimeout(ok, 20)); }
      ev('pointerup', x0 + dx);
    }, dx);

    await p.goto(page);
    if (!await up()) { check(`${device}: the clubhouse opens`, false, errors[0]); await ctx.close(); return; }
    await p.click('#ok');

    // through its door on the landing, into the room
    await M('faceDoor', 'hall', 'brickbuster', 1.3);
    await walk(1200);
    await shot('1-room');
    check(`${device}: Brickbuster's door on the landing leads to its room`, (await M('where')).place === 'room:brickbuster');

    // step up to the case
    await M('put', 'room:brickbuster', 'case');
    await p.waitForTimeout(300);
    check(`${device}: looking at the case, it offers to play`, /BRICKBUSTER/.test(await M('target') || ''), await M('target'));
    const stood = await M('where');
    await use();
    const playing = await modeIs('arcade');
    // the ball waits on the paddle until you touch the screen (or click, or press a key)
    await p.waitForTimeout(2500);
    const waited = (await B()).serving;
    await shot('2-waiting');
    if (opts.hasTouch) await p.evaluate(() => { const c = document.querySelector('#clubhouse #view'); for (const t of ['pointerdown', 'pointerup']) c.dispatchEvent(new PointerEvent(t, { pointerId: 11, pointerType: 'touch', clientX: innerWidth / 2, clientY: innerHeight * 0.6, bubbles: true })); });
    else await p.keyboard.press('Space');
    await until(() => !window.__brickbuster.state().serving, null, 10000);   // (sent off once you do, however slow the computer)
    await shot('2-playing');
    let s = await B();
    check(`${device}: stepping up starts the game, the view eased back to fit the case`, playing && s.active && (await M('where')).z < stood.z - 0.3);
    check(`${device}: ...the yarn ball waits on the paddle till you touch the screen or press a key, then it's sent off`, waited && (!s.serving || s.lives < 3));
    await p.evaluate(() => window.__brickbuster.catchBall());   // (so it can't miss on its own while we check other things)

    // the paddle: keys and the mouse on a desktop, a finger on a phone
    if (opts.hasTouch) {
      const a = (await B()).paddle; await slide(-120); const b = (await B()).paddle; await slide(160); const c = (await B()).paddle;
      check(`${device}: sliding a finger moves the paddle along with it`, b < a - 0.3 && c > b + 0.4, `${a.toFixed(2)} → ${b.toFixed(2)} → ${c.toFixed(2)}`);
    } else {
      const a = (await B()).paddle;
      await p.keyboard.down('KeyA'); await p.waitForTimeout(250); await p.keyboard.up('KeyA');
      const b = (await B()).paddle;
      await p.keyboard.down('KeyD'); await p.waitForTimeout(400); await p.keyboard.up('KeyD');
      const c = (await B()).paddle;
      check(`${device}: A and D move the paddle`, b < a - 0.3 && c > b + 0.5, `${a.toFixed(2)} → ${b.toFixed(2)} → ${c.toFixed(2)}`);
      await p.mouse.move(640, 500); await p.mouse.move(400, 500, { steps: 8 });
      const d = (await B()).paddle;
      check(`${device}: ...and so does the mouse`, d < c - 0.3, `${c.toFixed(2)} → ${d.toFixed(2)}`);
      check(`${device}: ...and walking doesn't (you're playing)`, Math.abs((await M('where')).x - stood.x) < 5);
    }

    // missing, on a machine that hasn't broken yet: the ball drops out of the bottom, which cracks the glass there (no life lost), with a sound, and a new ball on the paddle
    const { lives: lives0, sounds: played0 } = await B();
    const since = s => s.heard.slice(-(s.sounds - played0) || s.heard.length);   // (the sounds since: the log keeps the last 200)
    await p.evaluate(() => window.__brickbuster.loseLife());
    // (until it's happened, however slow the computer: a set wait could end before, or long after)
    await until(() => window.__brickbuster.state().bottomCracks >= 1, null, 8000);
    s = await B();
    await shot('3-missed');
    check(`${device}: missing on a machine that hasn't broken cracks the glass at the bottom, with a sound, and costs no life`, s.lives === lives0 && s.bottomCracks === 1 && !s.broken && since(s).includes('crack1'), `lives ${s.lives}, heard ${since(s).join(' ')}`);
    check(`${device}: ...and a new ball waits on the paddle`, await until(() => window.__brickbuster.state().serving, null, 4000) || !(await B()).serving);
    check(`${device}: ...the marquee has the score, the level and the lives (nothing to see here, just no errors)`, (await B()).level === 1);

    // leaving with the ball in the air: it's put back exactly where it was (and carries on from there)
    await p.evaluate(() => window.__brickbuster.throwBall(2.2, 3.1, 1.2, -3.4));
    await p.waitForTimeout(100);
    const flying = await B();
    // stepping back: the game stops where it was
    // (on a phone STEP BACK is held a moment: a quick tap does nothing)
    const stepBack = async () => {
      if (!opts.hasTouch) return p.keyboard.press('Escape');
      await p.tap('#clubhouse #use');
      await p.waitForTimeout(900);
      check(`${device}: a quick tap on STEP BACK does not leave`, await modeIs('arcade'));
      await p.dispatchEvent('#clubhouse #use', 'pointerdown');
      await p.waitForTimeout(900);
      await p.dispatchEvent('#clubhouse #use', 'pointerup');
    };
    await stepBack();
    await modeIs('play');
    const left = await B();
    // the game is kept after a reload: the lives, the level, the ball where it was
    await p.reload(); await up();
    s = await B();
    check(`${device}: stepping back stops the game where it was; after a reload the lives are still ${left.lives}, and the ball is where it was going the same way`,
      flying.lives >= left.lives && s.lives === left.lives && s.level === 1 && Math.hypot(s.ball.x - left.ball.x, s.ball.y - left.ball.y) < 0.05 && s.serving === left.serving && Math.sign(s.ball.vy) === Math.sign(left.ball.vy),
      `left at (${left.ball.x.toFixed(2)}, ${left.ball.y.toFixed(2)}), back at (${s.ball.x.toFixed(2)}, ${s.ball.y.toFixed(2)}), lives ${s.lives}`);

    // breaking it: the glass cracks at the top, three times. It shatters, you're stepped back to watch, every
    // brick left spills onto the heap, the paddle falls to the floor, and the yarn ball bounces round the room,
    // hits the poster (squeak, then silence) and goes out the door with Sadie after it; the door gets her sign
    await M('put', 'room:brickbuster', 'case');
    await p.waitForTimeout(300);
    await use();
    await modeIs('arcade');
    await p.evaluate(() => window.__brickbuster.catchBall());   // (so it can't miss on its own meanwhile)
    await p.waitForTimeout(400);
    const { bricks: board, pile: pile0 } = await B();
    for (let i = 1; i <= 3; i++) {
      await p.evaluate(() => window.__brickbuster.crackTop());
      await until(n => window.__brickbuster.state().cracks >= n || window.__brickbuster.state().broken, i, 8000);
      if (i === 1) { s = await B(); await shot('4-cracked'); check(`${device}: the ball hitting the top cracks the glass, with a crack sound`, s.cracks === 1 && s.heard.includes('crack1'), `cracks ${s.cracks}`); }
      await p.evaluate(() => window.__brickbuster.catchBall());
    }
    await until(() => window.__brickbuster.state().broken, null, 8000);
    s = await B();
    await shot('5-shattered');
    check(`${device}: the third crack breaks the glass, with the big shatter`, s.broken === 'top' && s.heard.includes('shatter') && !s.heard.includes('crack3'), `broken ${s.broken}, heard ${s.heard.slice(-4).join(' ')}`);
    check(`${device}: ...and you're stepped back to watch`, await modeIs('play'));
    check(`${device}: ...and the yarn ball gets out`, await until(() => window.__brickbuster.state().escape === 'gone', null, 30000));
    // (Sadie gone after it and the door shut behind her, or as long as that could take)
    await until(() => { const s = window.__brickbuster.state(); return !s.sadie && s.sign && !s.doorHeld; }, null, 15000);
    s = await B();
    check(`${device}: every brick left lands on the heap, and the door has her sign`, s.bricks === 0 && s.pile >= pile0 + board && s.sign && !s.sadie, `${s.pile} on the heap, ${board} on the board and ${pile0} on the heap before`);

    // ...then the machine fixes itself: the paddle goes home, a new ball pops out, the glass comes back, the heap
    // dances out of the top, a new board pops in, the sign comes off
    check(`${device}: ...and the machine starts to fix itself`, await until(() => window.__brickbuster.state().fixing, null, 15000));
    check(`${device}: ...with your view held on the machine while it does`, (await B()).watched);
    await until(() => window.__brickbuster.state().mended, null, 15000);
    await shot('6-mending');
    s = await B();
    check(`${device}: ...the paddle goes back into the machine (a new game, the lives and level kept)`, s.mended && !s.broken && s.lives === lives0 && s.level === 1, `lives ${s.lives}, level ${s.level}`);
    await until(() => window.__brickbuster.state().glassBack, null, 15000);
    check(`${device}: ...the glass puts itself back together`, (await B()).glassBack);
    await until(() => !window.__brickbuster.state().fixing, null, 40000);
    await p.waitForTimeout(500);
    check(`${device}: ...and you're let go once it's done`, !(await B()).watched);
    await p.waitForTimeout(300);
    s = await B();
    await shot('7-mended');
    check(`${device}: ...the heap is gone, a new board is up, the sign's off the door, and it can be played again`,
      !s.fixing && s.canPlay && s.pile === 0 && s.bricks >= 20 && !s.sign && !s.broken && s.cracks === 0 && s.serving && !s.sadie, `${s.pile} on the heap, ${s.bricks} bricks, sign ${s.sign}`);
    await M('put', 'room:brickbuster', 'case');
    await p.waitForTimeout(300);
    check(`${device}: ...the case offers to play again`, /BRICKBUSTER/.test(await M('target') || ''), await M('target'));

    // from now on a miss costs a life, as in any Breakout
    await use();
    await modeIs('arcade');
    await p.evaluate(() => window.__brickbuster.loseLife());
    await until(n => window.__brickbuster.state().lives < n, lives0, 8000);
    s = await B();
    check(`${device}: once mended, missing costs a life and cracks nothing`, s.lives === lives0 - 1 && s.bottomCracks === 0 && !s.broken, `lives ${s.lives}`);
    // every 3000 points a life back (up to 3): the 1UP sign pops up where the ball hit
    await p.evaluate(() => window.__brickbuster.catchBall());
    await p.waitForTimeout(300);
    const before = Math.min((await B()).lives, 2);
    await p.evaluate(() => window.__brickbuster.oneUp());
    await until(n => window.__brickbuster.state().lives > n, before, 8000);
    s = await B();
    check(`${device}: 3000 points with a life missing gives it back, with a 1UP sign`, s.lives === before + 1, `lives ${before} -> ${s.lives}, signs ${s.ups}`);
    check(`${device}: ...the sign is up`, s.ups >= 1);
    await shot('8-oneup');
    await p.evaluate(() => window.__brickbuster.catchBall());
    // once mended it's mended for good: hitting the top again never cracks it, and that's kept across a reload
    for (let i = 0; i < 4; i++) {
      await p.evaluate(() => window.__brickbuster.catchBall());
      await p.waitForTimeout(300);
      await p.evaluate(() => window.__brickbuster.crackTop());
      await p.waitForTimeout(700);
    }
    s = await B();
    check(`${device}: once mended, the glass never cracks or breaks again`, !s.broken && s.cracks === 0 && s.canPlay, `cracks ${s.cracks}, broken ${s.broken}`);
    await p.reload(); await up();
    await M('put', 'room:brickbuster', 'case');
    await use();
    await modeIs('arcade');
    await p.evaluate(() => window.__brickbuster.catchBall());
    await p.waitForTimeout(300);
    await p.evaluate(() => window.__brickbuster.crackTop());
    await p.waitForTimeout(700);
    s = await B();
    check(`${device}: ...and after a reload it is still unbreakable`, !s.broken && s.cracks === 0, `cracks ${s.cracks}, broken ${s.broken}`);
    await stepBack();
    await modeIs('play');
    await p.waitForTimeout(1500);
    // put away when you're far off (the clubhouse does it after a while three doors away) and built
    // again as you come back: the yarn ball and Sadie leave the hall with it, and come back with it
    await M('faceDoor', 'hall', 'brickbuster', 2.4);   // (out in the hall: a room you're in is never put away)
    await p.waitForTimeout(300);
    const gone = await p.evaluate(() => { const ok = window.__clubhouse.putAway('room:brickbuster'); return { ok, meshes: window.__clubhouse.built().includes('room:brickbuster') }; });
    await M('build', 'room:brickbuster');
    await p.waitForTimeout(300);
    s = await B();
    check(`${device}: put away and built again, it's whole, with the ball and Sadie back in the hall`, gone.ok && !gone.meshes && !s.broken && s.canPlay && s.hall?.shown && !s.hall.napping && !s.sadie, JSON.stringify({ ok: gone.ok, meshes: gone.meshes, broken: s.broken, canPlay: s.canPlay, hall: s.hall && { shown: s.hall.shown, napping: s.hall.napping }, sadie: s.sadie }));

    // the pause menu can start it over (after asking)
    await pressPause(p, opts);
    await p.waitForTimeout(200);
    await p.click('#resets button:has-text("BRICKBUSTER")');
    await p.click('#sureYes');
    await up();
    s = await B();
    check(`${device}: the pause menu can start Brickbuster over: Sadie's back, level 1, three lives, no high score`, !s.cracks && !s.broken && !s.pile && s.bricks >= 20 && s.sadie && !s.sign && !s.hall && s.level === 1 && s.lives === 3 && s.high === 0 && s.score === 0);
    check(`${device}: no errors on the page`, !errors.length, errors.slice(0, 3).join(' | '));
    await ctx.close();
  });
}
