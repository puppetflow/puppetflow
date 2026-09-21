/* global $viewportWidth, $viewportHeight */

// Human-like input. A person moves the pointer along a curve before clicking,
// holds the button for a few tens of milliseconds, lands off-centre, types at
// an irregular rhythm and scrolls in wheel notches; bot detection scores the
// absence of all of that (instant teleporting clicks at exact centres, constant
// key intervals, window.scrollBy jumps). These helpers replace the raw
// puppeteer calls while keeping their contract: same target, same end state.

// Last pointer position per tab, so the next move starts where the previous
// one ended instead of teleporting.
const __humanMousePositions = new WeakMap();
const __humanRandom = (min, max) => min + Math.random() * (max - min);
const __humanJitterMs = (base, spread = 0.35) => Math.max(0, Math.round(base * __humanRandom(1 - spread, 1 + spread)));
const __humanPageOf = handle => {
  try {
    return handle.frame.page();
  } catch (_) {
    return $page;
  }
};

const __humanMousePosition = page => {
  let position = __humanMousePositions.get(page);
  if (!position) {
    const viewport = page.viewport() || { width: $viewportWidth, height: $viewportHeight };
    position = {
      x: __humanRandom(viewport.width * 0.3, viewport.width * 0.7),
      y: __humanRandom(viewport.height * 0.3, viewport.height * 0.7),
    };
    __humanMousePositions.set(page, position);
  }
  return position;
};

// Cubic Bezier from the current position with two randomised control points,
// eased so the pointer accelerates then settles on the target.
const __humanMoveTo = async function(page, x, y) {
  const from = __humanMousePosition(page);
  const distance = Math.hypot(x - from.x, y - from.y);
  if (distance < 1) return;
  const bend = Math.min(distance * 0.25, 120);
  const control1 = {
    x: from.x + (x - from.x) / 3 + __humanRandom(-bend, bend),
    y: from.y + (y - from.y) / 3 + __humanRandom(-bend, bend),
  };
  const control2 = {
    x: from.x + (2 * (x - from.x)) / 3 + __humanRandom(-bend, bend),
    y: from.y + (2 * (y - from.y)) / 3 + __humanRandom(-bend, bend),
  };
  const steps = Math.max(8, Math.min(40, Math.round(distance / 25)));
  const totalMs = __humanJitterMs(Math.min(120 + distance * 0.6, 700));
  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const u = 1 - eased;
    const pointX = u * u * u * from.x + 3 * u * u * eased * control1.x + 3 * u * eased * eased * control2.x + eased * eased * eased * x;
    const pointY = u * u * u * from.y + 3 * u * u * eased * control1.y + 3 * u * eased * eased * control2.y + eased * eased * eased * y;
    const last = step === steps;
    await page.mouse.move(last ? x : pointX + __humanRandom(-1, 1), last ? y : pointY + __humanRandom(-1, 1));
    await __internalSleep(totalMs / steps);
  }
  __humanMousePositions.set(page, { x, y });
};

// Move, settle, then press and release with a realistic hold time.
const __humanClickAt = async function(page, x, y, options = {}) {
  const { button = 'left', clickCount = 1 } = options;
  await __humanMoveTo(page, x, y);
  await __internalSleep(__humanJitterMs(70, 0.6));
  for (let count = 1; count <= clickCount; count++) {
    await page.mouse.down({ button, clickCount: count });
    await __internalSleep(__humanJitterMs(75, 0.5));
    await page.mouse.up({ button, clickCount: count });
    if (count < clickCount) await __internalSleep(__humanJitterMs(90, 0.4));
  }
};

// A notched mouse delivers an identical deltaY on every notch (about 100px in
// Chrome, 120 on some setups). A random per-notch delta in a fixed band matches
// neither that nor a touchpad's small variable deltas, so it reads as synthetic.
// One constant notch size is picked per run and reused for every notch; any
// sub-notch remainder is left to the caller (window.scrollBy) to finish.
let __wheelNotchPx = null;
const __humanWheel = async function(page, deltaY) {
  if (__wheelNotchPx === null) __wheelNotchPx = Math.random() < 0.5 ? 100 : 120;
  const direction = Math.sign(deltaY);
  let remaining = Math.abs(deltaY);
  while (remaining >= __wheelNotchPx) {
    await page.mouse.wheel({ deltaY: direction * __wheelNotchPx });
    remaining -= __wheelNotchPx;
    await __internalSleep(__humanJitterMs(45, 0.5));
  }
};

// A point over the document itself: wheel events go to the innermost
// scrollable container under the pointer, so scrolling the page from over a
// scrollable panel would scroll the panel instead. Null when none is found.
const __humanPageScrollPoint = async function(page) {
  const viewport = page.viewport() || { width: $viewportWidth, height: $viewportHeight };
  const current = __humanMousePosition(page);
  const candidates = [current];
  for (let attempt = 0; attempt < 5; attempt++) {
    candidates.push({
      x: __humanRandom(viewport.width * 0.2, viewport.width * 0.8),
      y: __humanRandom(viewport.height * 0.2, viewport.height * 0.8),
    });
  }
  const index = await page.evaluate(points => {
    const scrollsOnItsOwn = element => {
      const style = getComputedStyle(element);
      return /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
    };
    return points.findIndex(({ x, y }) => {
      let element = document.elementFromPoint(x, y);
      while (element && element !== document.documentElement && element !== document.body) {
        if (scrollsOnItsOwn(element)) return false;
        element = element.parentElement;
      }
      return true;
    });
  }, candidates);
  return index >= 0 ? candidates[index] : null;
};

// Scroll the page by deltaY the way a wheel would, then make up any shortfall
// (end of document, nested scroller) so the result equals window.scrollBy.
const __humanScrollBy = async function(page, deltaY) {
  if (!Number.isFinite(deltaY) || deltaY === 0) return;
  const point = await __retryOnContextDestroyed(() => __humanPageScrollPoint(page)).catch(() => null);
  if (point) {
    const before = await page.evaluate(() => window.scrollY);
    await __humanMoveTo(page, point.x, point.y);
    await __humanWheel(page, deltaY);
    await __internalSleep(__humanJitterMs(120, 0.4));
    const after = await page.evaluate(() => window.scrollY);
    const remainder = deltaY - (after - before);
    if (Math.abs(remainder) <= 2) return;
    deltaY = remainder;
  }
  await page.evaluate(px => window.scrollBy(0, px), deltaY);
};

// Bring an element into the viewport as a reader would: wheel towards it,
// then let scrollIntoView settle the exact position. No-op when it is
// already fully visible, like puppeteer's own click().
const __humanScrollIntoView = async function(handle, options = {}) {
  const { block = 'center', force = false } = options;
  const page = __humanPageOf(handle);
  const visible = await handle.isIntersectingViewport({ threshold: 1 }).catch(() => false);
  if (visible && !force) return;
  const offset = await handle.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.top + rect.height / 2 - window.innerHeight / 2;
  }).catch(() => 0);
  if (Math.abs(offset) > 40) await __humanScrollBy(page, Math.round(offset)).catch(() => {});
  const settled = await handle.isIntersectingViewport({ threshold: 1 }).catch(() => false);
  if (settled && block === 'center') return;
  await handle.evaluate((element, blockPosition) => element.scrollIntoView({
    behavior: 'auto',
    block: blockPosition,
    inline: 'nearest',
  }), block);
};

// Where a person would click: near the clickable point, offset by a few pixels
// but never outside the element's box.
const __humanClickTarget = async function(handle) {
  const box = await handle.boundingBox();
  const point = await handle.clickablePoint();
  if (!box) return point;
  const spreadX = Math.min(box.width, 60) * 0.3;
  const spreadY = Math.min(box.height, 60) * 0.3;
  return {
    x: Math.min(box.x + box.width - 2, Math.max(box.x + 2, point.x + __humanRandom(-spreadX, spreadX))),
    y: Math.min(box.y + box.height - 2, Math.max(box.y + 2, point.y + __humanRandom(-spreadY, spreadY))),
  };
};

// A control kept out of sight for styling (an sr-only checkbox or radio behind
// a decorated label: 1px box, clipped away) has no surface a pointer can land
// on; the click goes to whatever is painted there and the control never
// toggles, while element.click() from the console does. A person clicks its
// label, which activates the control the same way.
const __humanIsPointerHidden = function(handle) {
  return handle.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.width < 2 || rect.height < 2
      || /^rect\(0px,? 0px,? 0px,? 0px\)$/.test(getComputedStyle(element).clip);
  });
};

const __humanLabelOf = async function(handle) {
  const label = await handle.evaluateHandle(element => {
    const candidates = [...(element.labels ? Array.from(element.labels) : []), element.closest('label')];
    return candidates.find(candidate => {
      if (!candidate) return false;
      const box = candidate.getBoundingClientRect();
      return box.width >= 2 && box.height >= 2;
    }) || null;
  });
  const element = label.asElement();
  if (!element) await label.dispose();
  return element;
};

const __humanClickElement = async function(handle, options = {}) {
  const page = __humanPageOf(handle);
  await __humanScrollIntoView(handle);
  if (await __humanIsPointerHidden(handle).catch(() => false)) {
    const label = await __humanLabelOf(handle).catch(() => null);
    if (label) {
      try {
        await __humanClickElement(label, options);
      } finally {
        await label.dispose().catch(() => {});
      }
      return;
    }
    // No label to stand in for it: a DOM click is the only thing that reaches it.
    await handle.evaluate(element => element.click());
    return;
  }
  let target;
  try {
    target = await __humanClickTarget(handle);
  } catch (_) {
    // Not clickable the way puppeteer computes it (no layout box): let its
    // own click() raise the same error the flow has always seen.
    await handle.click({ button: options.button, clickCount: options.clickCount });
    return;
  }
  await __humanClickAt(page, target.x, target.y, options);
};

const __humanHoverElement = async function(handle) {
  const page = __humanPageOf(handle);
  await __humanScrollIntoView(handle);
  const target = await __humanClickTarget(handle);
  await __humanMoveTo(page, target.x, target.y);
};

// Keystrokes at an irregular rhythm around the requested speed: a longer
// pause after spaces and punctuation, an occasional hesitation. Speed 0 keeps
// instant typing, as before.
const __humanType = async function(handle, text, speed) {
  const value = String(text);
  await handle.focus();
  const page = __humanPageOf(handle);
  if (!(speed > 0)) {
    await page.keyboard.type(value);
    return;
  }
  for (const char of value) {
    // Hold each key for a few tens of milliseconds before releasing it. A
    // back-to-back down/up (keyboard.type) leaves a near-zero hold time that
    // no physical keystroke has. Characters with no key mapping (accents,
    // emoji) fall back to type(), which inserts them without key events.
    try {
      await page.keyboard.down(char);
      await __internalSleep(__humanJitterMs(55, 0.5));
      await page.keyboard.up(char);
    } catch (_) {
      await page.keyboard.type(char);
    }
    let delay = speed * __humanRandom(0.55, 1.6);
    if (/[\s.,;:!?]/.test(char)) delay *= __humanRandom(1.4, 2.6);
    if (Math.random() < 0.03) delay *= __humanRandom(3, 6);
    await __internalSleep(Math.round(delay));
  }
};

