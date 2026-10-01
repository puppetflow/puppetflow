/* @help Selectors
 * @sig $scanQrcode(options?)
 * @aliases scan qr code, read qr code, detect qr codes
 * @desc Capture the page in memory and return every QR code found. Scans the full page by default. Returns an empty array when none are found or the timeout is reached.
 * @nodal-desc Scan every QR code on the page, or only those in the current viewport.
 * @nodal-output array<object { type:string, data:string, contentType:string, rawData:string, position:object }>
 * @opt timeout: 10000, fullPage: true
 * @nodal-param options [object]: Configure the QR code scan.
 * @nodal-param options.timeout [number]: Maximum scan duration in milliseconds.
 * @nodal-param options.fullPage [boolean]: Scan the entire page. Disable to scan only the current viewport.
 */
const $scanQrcode = async function(options = {}) {
  const { timeout = 10000, fullPage = true } = options || {};
  const scanTimeout = Number(timeout);
  if (!Number.isFinite(scanTimeout) || scanTimeout <= 0) {
    throw new Error('$scanQrcode: timeout must be a positive number');
  }

  __emitAction('scanQrcode', (fullPage ? 'full page, ' : 'viewport, ') + scanTimeout + 'ms');

  const found = [];
  const foundData = new Set();
  const deadline = Date.now() + scanTimeout;
  const formatResults = () => found.map(({ center: _center, ...result }) => result);

  const scan = async () => {
    const { PNG } = __requireSandboxModule('pngjs');
    const { readBarcodes } = __requireSandboxModule('zxing-wasm/reader');
    const tileSize = 1024;
    const tileOverlap = 128;
    const tileStep = tileSize - tileOverlap;
    const axisStarts = length => {
      if (length <= tileSize) return [0];
      const starts = [];
      for (let offset = 0; offset < length - tileSize; offset += tileStep) starts.push(offset);
      starts.push(length - tileSize);
      return [...new Set(starts)];
    };

    const decodeScreenshot = async screenshot => {
      const image = PNG.sync.read(screenshot);
      const pixels = new Uint8ClampedArray(
        image.data.buffer,
        image.data.byteOffset,
        image.data.byteLength,
      );
      const positions = axisStarts(image.height).flatMap(top => (
        axisStarts(image.width).map(left => ({
          left,
          top,
          width: Math.min(tileSize, image.width - left),
          height: Math.min(tileSize, image.height - top),
        }))
      ));

      for (const tile of positions) {
        if (Date.now() >= deadline) return;
        const tilePixels = tile.left === 0
          && tile.top === 0
          && tile.width === image.width
          && tile.height === image.height
          ? pixels
          : new Uint8ClampedArray(tile.width * tile.height * 4);
        if (tilePixels !== pixels) {
          for (let row = 0; row < tile.height; row++) {
            const sourceStart = ((tile.top + row) * image.width + tile.left) * 4;
            tilePixels.set(
              pixels.subarray(sourceStart, sourceStart + tile.width * 4),
              row * tile.width * 4,
            );
          }
        }

        const results = await readBarcodes(
          { data: tilePixels, width: tile.width, height: tile.height },
          {
            formats: ['QRCode'],
            maxNumberOfSymbols: 0,
            tryHarder: true,
            tryInvert: true,
            tryRotate: true,
          },
        );
        for (const result of results) {
          if (foundData.has(result.text)) continue;
          foundData.add(result.text);
          const position = Object.fromEntries(
            Object.entries(result.position).map(([name, point]) => [
              name,
              { x: point.x + tile.left, y: point.y + tile.top },
            ]),
          );
          found.push({
            type: 'qr_code',
            data: result.text,
            contentType: result.contentType,
            rawData: Buffer.from(result.bytes).toString('base64'),
            position,
          });
        }
      }
    };

    const screenshot = await __retryOnContextDestroyed(() => $page.screenshot({
      type: 'png',
      fullPage: Boolean(fullPage),
    }));
    await decodeScreenshot(screenshot);

    if (fullPage && Date.now() < deadline) {
      const attribute = 'data-puppetflow-qr-scroll';
      const token = crypto.randomUUID();
      const scrollables = await $page.evaluate(({ attribute: attr, token: value }) => (
        Array.from(document.querySelectorAll('*'))
          .filter(element => {
            const style = getComputedStyle(element);
            const overflow = style.overflow + ' ' + style.overflowX + ' ' + style.overflowY;
            return /(auto|scroll)/.test(overflow)
              && (element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1);
          })
          .map((element, index) => {
            const id = value + '-' + index;
            element.setAttribute(attr, id);
            return {
              id,
              scrollTop: element.scrollTop,
              scrollLeft: element.scrollLeft,
              maxTop: Math.max(0, element.scrollHeight - element.clientHeight),
              maxLeft: Math.max(0, element.scrollWidth - element.clientWidth),
              stepY: Math.max(1, element.clientHeight - 128),
              stepX: Math.max(1, element.clientWidth - 128),
            };
          })
      ), { attribute, token });

      try {
        const scrollStarts = (maximum, step) => {
          if (maximum <= 0) return [0];
          const starts = [];
          for (let offset = 0; offset < maximum; offset += step) starts.push(offset);
          starts.push(maximum);
          return [...new Set(starts)];
        };
        for (const scrollable of scrollables) {
          const tops = scrollStarts(scrollable.maxTop, scrollable.stepY);
          const lefts = scrollStarts(scrollable.maxLeft, scrollable.stepX);
          for (const top of tops) {
            for (const left of lefts) {
              if (Date.now() >= deadline) return formatResults();
              await $page.evaluate(({ attribute: attr, id, top: y, left: x }) => {
                const element = document.querySelector('[' + attr + '="' + id + '"]');
                if (element) element.scrollTo(x, y);
              }, { attribute, id: scrollable.id, top, left });
              await __internalSleep(50);
              await decodeScreenshot(await __retryOnContextDestroyed(() => $page.screenshot({
                type: 'png',
                fullPage: false,
              })));
            }
          }
        }
      } finally {
        await $page.evaluate(({ attribute: attr, elements }) => {
          for (const state of elements) {
            const element = document.querySelector('[' + attr + '="' + state.id + '"]');
            if (!element) continue;
            element.scrollTo(state.scrollLeft, state.scrollTop);
            element.removeAttribute(attr);
          }
        }, { attribute, elements: scrollables }).catch(() => {});
      }
    }

    return formatResults();
  };

  let timeoutId;
  try {
    return await Promise.race([
      scan(),
      new Promise(resolve => {
        timeoutId = setTimeout(() => resolve(formatResults()), scanTimeout);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};
