/*
 * This file implements the paid Puppetflow video replay (recording) feature
 * and is licensed under the Puppetflow Proprietary License.
 * See LICENSE_PROPRIETARY.md.
 */
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const crypto = require('crypto');

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const buffer = Buffer.alloc(1024 * 1024);
  const fd = fs.openSync(filePath, 'r');

  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(fd);
  }

  return hash.digest('hex');
}

function isPlausibleMp4(filePath) {
  let fd = null;

  try {
    const fileSize = fs.statSync(filePath).size;
    if (fileSize <= 1024) return false;

    fd = fs.openSync(filePath, 'r');
    const types = new Set();
    let offset = 0;
    let boxes = 0;

    while (offset + 8 <= fileSize && boxes < 10000) {
      const header = Buffer.alloc(16);
      if (fs.readSync(fd, header, 0, 8, offset) !== 8) return false;

      const size32 = header.readUInt32BE(0);
      const type = header.toString('ascii', 4, 8);
      let headerSize = 8;
      let boxSize = size32;

      if (size32 === 1) {
        if (fs.readSync(fd, header, 8, 8, offset + 8) !== 8) return false;
        const extendedSize = header.readBigUInt64BE(8);
        if (extendedSize > BigInt(Number.MAX_SAFE_INTEGER)) return false;
        boxSize = Number(extendedSize);
        headerSize = 16;
      } else if (size32 === 0) {
        boxSize = fileSize - offset;
      }

      if (boxSize < headerSize || offset + boxSize > fileSize) return false;
      if (offset === 0 && type !== 'ftyp') return false;

      types.add(type);
      offset += boxSize;
      boxes++;
    }

    return offset === fileSize
      && types.has('ftyp')
      && types.has('moov')
      && types.has('mdat');
  } catch (_) {
    return false;
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch (_) {}
    }
  }
}

// Click markers are burned in by a second ffmpeg pass once the replay is
// finalized: the live encoder consumes frames as they arrive, before the
// clicks that follow are known. A small ripple sprite is piped as raw RGBA
// frames and drawn by overlays whose x/y expressions follow the clicks over
// time. sendcmd cannot place it: ffmpeg decodes the main input ahead of the
// overlay, so commands would fire before the frames they belong to.
const CLICK_FPS = 30;
const CLICK_DURATION_S = 0.7;
const CLICK_MAX_MARKERS = 2000;
// Each overlay only evaluates its own group, and only within the group's time
// range, so per-frame expression cost stays bounded on long replays.
const CLICK_GROUP_SIZE = 250;
const CLICK_DEFAULT_BUDGET_MS = 120000;
const CLICK_MIN_BUDGET_MS = 5000;
const CLICK_COLOR = [239, 68, 68];

let filterScriptOption = null;
// The graph is passed as a file because it can exceed the per-argument limit.
// "-/filter_complex <file>" exists since ffmpeg 7, which also deprecated
// -filter_complex_script; development builds report "N-..." instead.
function ffmpegFilterScriptOption() {
  if (filterScriptOption === null) {
    let version = '';
    try {
      version = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', timeout: 5000 }).stdout || '';
    } catch (_) {}
    const match = /ffmpeg version (N-|n?(\d+))/.exec(version);
    const modern = !!match && (match[1] === 'N-' || Number(match[2]) >= 7);
    filterScriptOption = modern ? '-/filter_complex' : '-filter_complex_script';
  }
  return filterScriptOption;
}

function clickRippleSprite(videoWidth, videoHeight) {
  const radius = Math.max(14, Math.min(40, Math.round(Math.min(videoWidth, videoHeight) * 0.035)));
  const ringWidth = Math.max(2, radius * 0.12);
  const size = 2 * Math.ceil(radius + ringWidth + 3);
  const center = size / 2;
  const frameCount = Math.round(CLICK_DURATION_S * CLICK_FPS);
  const frames = [];

  for (let index = 0; index < frameCount; index++) {
    const progress = index / frameCount;
    const ringRadius = radius * (0.3 + 0.7 * (1 - (1 - progress) * (1 - progress)));
    const fade = 1 - progress;
    const frame = Buffer.alloc(size * size * 4);

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const distance = Math.hypot(px + 0.5 - center, py + 0.5 - center);
        const ringDistance = Math.abs(distance - ringRadius);
        // Bottom to top: translucent fill, white halo for contrast on dark
        // and saturated pages, then the colored ring itself.
        const layers = [
          [CLICK_COLOR, 0.28 * Math.max(0, Math.min(1, ringRadius - distance + 0.5))],
          [[255, 255, 255], 0.85 * Math.max(0, Math.min(1, ringWidth / 2 + 2 - ringDistance))],
          [CLICK_COLOR, Math.max(0, Math.min(1, ringWidth / 2 + 0.5 - ringDistance))],
        ];
        let alpha = 0;
        const premultiplied = [0, 0, 0];
        for (const [color, layerAlpha] of layers) {
          for (let channel = 0; channel < 3; channel++) {
            premultiplied[channel] = color[channel] * layerAlpha + premultiplied[channel] * (1 - layerAlpha);
          }
          alpha = layerAlpha + alpha * (1 - layerAlpha);
        }
        const offset = (py * size + px) * 4;
        if (alpha > 0) {
          frame[offset] = Math.round(premultiplied[0] / alpha);
          frame[offset + 1] = Math.round(premultiplied[1] / alpha);
          frame[offset + 2] = Math.round(premultiplied[2] / alpha);
          frame[offset + 3] = Math.round(255 * alpha * fade);
        }
      }
    }
    frames.push(frame);
  }

  return { size, frames, blank: Buffer.alloc(size * size * 4) };
}

/**
 * Re-encodes inputPath into outputPath with a ripple drawn at every click.
 * Clicks are { t, x, y } in seconds and video pixels, in chronological order.
 * Resolves true only when a complete mp4 was produced before the deadline.
 */
function burnClickMarkers({ inputPath, outputPath, clicks, videoWidth, videoHeight, durationS, budgetMs, onProcess }) {
  const sprite = clickRippleSprite(videoWidth, videoHeight);
  const half = sprite.size / 2;
  const animationFrames = sprite.frames.length;
  const starts = clicks.map(click => Math.max(0, Math.round(click.t * CLICK_FPS)));
  const windows = [];
  clicks.forEach((click, index) => {
    const start = starts[index];
    const end = Math.min(start + animationFrames, index + 1 < clicks.length ? starts[index + 1] : Infinity);
    if (end > start) windows.push({ start, end, x: click.x - half, y: click.y - half });
  });
  if (windows.length === 0) return Promise.resolve(false);

  // Boundaries sit half a frame early so the comparisons against the
  // resampled frame timestamps never depend on float rounding.
  const at = frame => ((frame - 0.5) / CLICK_FPS).toFixed(4);
  const groups = [];
  for (let index = 0; index < windows.length; index += CLICK_GROUP_SIZE) {
    groups.push(windows.slice(index, index + CLICK_GROUP_SIZE));
  }
  const position = (group, key) => group
    .map(window => 'gte(t,' + at(window.start) + ')*lt(t,' + at(window.end) + ')*(' + window[key] + ')')
    .join('+');
  const rippleLabels = groups.map((_, index) => '[ripple' + index + ']');
  // The replay is variable frame rate (a static page only gets the 500ms
  // heartbeat frames), so it is resampled to the sprite rate for the ripple
  // to animate. eof_action=pass keeps the replay running past the end of the
  // sprite track; without shortest the output length always follows input 0.
  const graph = [
    '[1:v]format=rgba' + (groups.length > 1 ? ',split=' + groups.length : '') + rippleLabels.join(''),
    '[0:v]fps=' + CLICK_FPS + '[main0]',
    ...groups.map((group, index) => '[main' + index + ']' + rippleLabels[index]
      + "overlay=x='" + position(group, 'x') + "':y='" + position(group, 'y') + "'"
      + ":enable='gte(t," + at(group[0].start) + ')*lt(t,' + at(group[group.length - 1].end) + ")'"
      + ':eof_action=pass:repeatlast=0'
      + (index === groups.length - 1 ? '[video]' : '[main' + (index + 1) + ']')),
  ].join(';\n');
  const graphPath = outputPath + '.graph';
  fs.writeFileSync(graphPath, graph);

  return new Promise((resolve) => {
    let settled = false;
    let processClosed = false;
    let budgetTimer = null;
    const finish = (success) => {
      if (settled) return;
      settled = true;
      clearTimeout(budgetTimer);
      try { fs.rmSync(graphPath, { force: true }); } catch (_) {}
      if (!success) {
        try { fs.rmSync(outputPath, { force: true }); } catch (_) {}
      }
      resolve(success);
    };

    let ffmpegProc;
    try {
      ffmpegProc = spawn('ffmpeg', [
        '-y',
        '-i', inputPath,
        '-f', 'rawvideo',
        '-pix_fmt', 'rgba',
        '-s', sprite.size + 'x' + sprite.size,
        '-framerate', String(CLICK_FPS),
        '-i', 'pipe:3',
        ffmpegFilterScriptOption(), graphPath,
        '-map', '[video]',
        '-map', '0:a?',
        '-c:a', 'copy',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'ultrafast',
        '-movflags', '+faststart',
        '-f', 'mp4',
        outputPath,
      ], {
        stdio: ['ignore', 'ignore', 'pipe', 'pipe'],
      });
    } catch (_) {
      finish(false);
      return;
    }
    onProcess(ffmpegProc);

    budgetTimer = setTimeout(() => {
      console.debug('Recording click markers skipped: time budget exceeded');
      try { ffmpegProc.kill('SIGKILL'); } catch (_) {}
    }, budgetMs);
    budgetTimer.unref();

    ffmpegProc.stderr.on('data', () => {});
    ffmpegProc.on('error', () => finish(false));
    ffmpegProc.on('close', (code) => {
      processClosed = true;
      onProcess(null);
      finish(code === 0 && isPlausibleMp4(outputPath));
    });

    const spritePipe = ffmpegProc.stdio[3];
    spritePipe.on('error', () => {});
    (async () => {
      const totalFrames = Math.ceil(durationS * CLICK_FPS) + CLICK_FPS;
      let windowIndex = 0;
      for (let frameIndex = 0; frameIndex < totalFrames && !processClosed; frameIndex++) {
        while (windowIndex < windows.length && windows[windowIndex].end <= frameIndex) windowIndex++;
        const window = windows[windowIndex];
        const frame = window && frameIndex >= window.start ? sprite.frames[frameIndex - window.start] : sprite.blank;
        if (!spritePipe.writable) break;
        if (!spritePipe.write(frame)) {
          await new Promise(done => {
            const resume = () => {
              spritePipe.off('drain', resume);
              spritePipe.off('close', resume);
              done();
            };
            spritePipe.on('drain', resume);
            spritePipe.on('close', resume);
          });
        }
      }
      try { spritePipe.end(); } catch (_) {}
    })();
  });
}

/**
 * Spawns the ffmpeg encoder that turns CDP screencast frames into an mp4
 * replay. Returns a recorder handle, or null when ffmpeg could not start;
 * every method degrades to a no-op once the underlying process dies.
 */
function startRecording({ recordingPath, completionMarkerPath, width, height, audioSampleRate = 0 }) {
  let ffmpeg = null;
  let closeResult = null;
  let spawnError = null;
  let lastWrittenFrame = null;
  let lastWriteTs = 0;
  let firstFrameTs = null;
  const clicks = [];
  let clickOverlayProcess = null;
  let clickOverlayCancelled = false;
  let heartbeatTimer = null;
  // Optional audio track: the page tap delivers PCM chunks on a wallclock
  // timeline; a pacer turns them into a continuous s16le stream on an extra
  // pipe so ffmpeg can interleave it with the video frames.
  let audioPipe = null;
  let audioTimeline = null;
  let audioPacerTimer = null;
  const AUDIO_PACER_INTERVAL_MS = 100;
  // CDP screencast only emits frames when the page visually changes, so
  // idle periods (sleeps, waits) would otherwise be missing from the
  // replay: ffmpeg timestamps frames as they arrive on the pipe, and the
  // video would end at the last visual change. Re-feeding the last frame
  // keeps wallclock time flowing so the replay matches the real duration.
  const HEARTBEAT_INTERVAL_MS = 500;
  completionMarkerPath = completionMarkerPath
    || path.join(path.dirname(path.dirname(recordingPath)), '.recording-complete');
  const temporaryPath = recordingPath + '.part';
  const markerTemporaryPath = completionMarkerPath + '.part-' + process.pid;
  const clickOverlayPath = recordingPath + '.clicks.part';
  // libx264 requires even dimensions.
  const recW = width % 2 === 0 ? width : width - 1;
  const recH = height % 2 === 0 ? height : height - 1;
  const writeCompletionMarker = (videoPath) => {
    fs.writeFileSync(markerTemporaryPath, JSON.stringify({
      size: fs.statSync(videoPath).size,
      sha256: sha256File(videoPath),
      completed_at: new Date().toISOString(),
    }));
  };
  let resolveClose;
  const closePromise = new Promise(resolve => {
    resolveClose = resolve;
  });

  try {
    const recDir = path.dirname(recordingPath);
    if (!fs.existsSync(recDir)) {
      fs.mkdirSync(recDir, { recursive: true });
    }
    for (const stalePath of [temporaryPath, recordingPath, completionMarkerPath, markerTemporaryPath, clickOverlayPath, clickOverlayPath + '.graph']) {
      try { fs.rmSync(stalePath, { force: true }); } catch (_) {}
    }

    const recFilter = 'scale=' + recW + ':' + recH + ':force_original_aspect_ratio=decrease,pad=' + recW + ':' + recH + ':(ow-iw)/2:(oh-ih)/2,setsar=1';
    const withAudio = Number.isInteger(audioSampleRate) && audioSampleRate > 0;
    if (withAudio) {
      const { createAudioTimeline } = require(path.join(__dirname, 'audio-capture.js'));
      audioTimeline = createAudioTimeline({ sampleRate: audioSampleRate });
    }
    const ffmpegArgs = [
      '-y',
      '-thread_queue_size', '1024',
      '-use_wallclock_as_timestamps', '1',
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      '-i', '-',
    ];
    if (withAudio) {
      ffmpegArgs.push(
        '-thread_queue_size', '1024',
        '-f', 's16le',
        '-ar', String(audioTimeline.sampleRate),
        '-ac', '1',
        '-i', 'pipe:3',
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:a', 'aac',
        '-b:a', '64k',
      );
    }
    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'ultrafast',
      '-vf', recFilter,
      '-movflags', '+faststart',
      '-f', 'mp4',
      temporaryPath,
    );
    const ffmpegProc = spawn('ffmpeg', ffmpegArgs, {
      stdio: withAudio ? ['pipe', 'ignore', 'pipe', 'pipe'] : ['pipe', 'ignore', 'pipe'],
    });
    if (withAudio) {
      audioPipe = ffmpegProc.stdio[3];
      audioPipe.on('error', () => {});
    }
    ffmpegProc.on('error', (err) => {
      console.debug('ffmpeg error: ' + err.message);
      spawnError = err;
    });
    ffmpegProc.on('exit', (code) => {
      if (code && code !== 0) {
        console.debug('ffmpeg exited with code ' + code);
      }
    });
    ffmpegProc.on('close', (code, signal) => {
      closeResult = { code, signal };
      resolveClose(closeResult);
    });
    ffmpegProc.stderr.on('data', () => {});
    ffmpeg = ffmpegProc;

    heartbeatTimer = setInterval(() => {
      if (!lastWrittenFrame || closeResult !== null || spawnError !== null) return;
      if (Date.now() - lastWriteTs < HEARTBEAT_INTERVAL_MS) return;
      if (ffmpegProc.stdin.writable) {
        try {
          ffmpegProc.stdin.write(lastWrittenFrame);
          lastWriteTs = Date.now();
        } catch (_) {}
      }
    }, HEARTBEAT_INTERVAL_MS);
    heartbeatTimer.unref();

    if (withAudio) {
      audioPacerTimer = setInterval(() => {
        if (!audioTimeline || !audioTimeline.started() || closeResult !== null || spawnError !== null) return;
        const pcm = audioTimeline.drain(Date.now());
        if (pcm && audioPipe && audioPipe.writable) {
          try { audioPipe.write(pcm); } catch (_) {}
        }
      }, AUDIO_PACER_INTERVAL_MS);
      audioPacerTimer.unref();
    }

    console.debug('Recording enabled: ' + recordingPath + (withAudio ? ' (with audio)' : ''));
  } catch (recErr) {
    console.debug('Recording skipped: ' + recErr.message);
    return null;
  }

  return {
    active() {
      return !!ffmpeg && closeResult === null && spawnError === null;
    },

    write(frameBuffer) {
      if (ffmpeg && ffmpeg.stdin.writable) {
        try {
          const isFirstFrame = lastWrittenFrame === null;
          ffmpeg.stdin.write(frameBuffer);
          // ffmpeg's mjpeg parser only emits a frame once the next one
          // arrives, and wallclock timestamps are taken at that moment.
          // Writing the first frame twice anchors the recording start at
          // the correct time instead of the second frame's arrival.
          if (isFirstFrame) {
            ffmpeg.stdin.write(frameBuffer);
            firstFrameTs = Date.now();
            // Audio sample 0 must line up with the first video frame: both
            // inputs are shifted by ffmpeg to start at zero.
            if (audioTimeline) audioTimeline.start(Date.now());
          }
          lastWrittenFrame = frameBuffer;
          lastWriteTs = Date.now();
        } catch (_) {}
      }
    },

    hasAudio() {
      return !!audioTimeline;
    },

    writeAudio(chunk) {
      if (!audioTimeline || closeResult !== null || spawnError !== null) return;
      try { audioTimeline.push(chunk); } catch (_) {}
    },

    /**
     * Records a click at viewport coordinates so stop() can draw it on the
     * replay. The screencast and the encoder both fit the viewport into the
     * video while keeping its aspect ratio, so the same fit maps the point.
     */
    markClick({ x, y, viewportWidth, viewportHeight }) {
      if (firstFrameTs === null || closeResult !== null || spawnError !== null) return;
      if (clicks.length >= CLICK_MAX_MARKERS) return;
      if (![x, y, viewportWidth, viewportHeight].every(Number.isFinite) || viewportWidth <= 0 || viewportHeight <= 0) return;
      const scale = Math.min(recW / viewportWidth, recH / viewportHeight);
      clicks.push({
        t: (Date.now() - firstFrameTs) / 1000,
        x: Math.round((recW - viewportWidth * scale) / 2 + x * scale),
        y: Math.round((recH - viewportHeight * scale) / 2 + y * scale),
      });
    },

    /** Aborts a running click marker pass; the finalized replay is kept as is. */
    cancelClickOverlay() {
      clickOverlayCancelled = true;
      if (clickOverlayProcess) {
        try { clickOverlayProcess.kill('SIGKILL'); } catch (_) {}
      }
    },

    /**
     * When no screencast frame was ever captured, grabs a fallback
     * screenshot so the replay is not empty, then lets ffmpeg drain the
     * remaining frames. Returns the last frame to use for the lastshot.
     */
    async captureFallback(page, lastFrame) {
      if (!ffmpeg) return lastFrame;

      if (!lastFrame) {
        try {
          const fallbackShot = await page.screenshot({ type: 'jpeg', quality: 60 });
          lastFrame = fallbackShot;
          this.write(fallbackShot);
          console.debug('Recording fallback frame captured');
        } catch (e) {
          console.debug('Recording fallback frame skipped: ' + e.message);
        }
      }
      await new Promise(r => setTimeout(r, 3000));

      return lastFrame;
    },

    /**
     * Finalizes the replay, then burns the click markers in unless
     * skipClickOverlay is set. clickOverlayDeadline (epoch ms) bounds that
     * second pass; when it fails or runs out of time the plain replay stays.
     */
    async stop({ skipClickOverlay = false, clickOverlayDeadline = null } = {}) {
      if (!ffmpeg) return false;

      const durationS = firstFrameTs === null ? 0 : (Date.now() - firstFrameTs) / 1000;
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (audioPacerTimer) {
        clearInterval(audioPacerTimer);
        audioPacerTimer = null;
      }

      let finalized = false;
      try {
        if (ffmpeg.stdin.writable) {
          // Emit the last frame one final time so the replay duration
          // extends to the actual end of the run, even if the page was
          // static since the previous frame.
          if (lastWrittenFrame) {
            try { ffmpeg.stdin.write(lastWrittenFrame); } catch (_) {}
          }
          ffmpeg.stdin.end();
        }
        if (audioPipe) {
          try {
            if (audioTimeline && audioTimeline.started() && audioPipe.writable) {
              const tail = audioTimeline.drain(Date.now(), true);
              if (tail) audioPipe.write(tail);
            }
          } catch (_) {}
          try { audioPipe.end(); } catch (_) {}
        }
        await Promise.race([
          closePromise,
          new Promise(resolve => setTimeout(resolve, 10000)),
        ]);
        if (closeResult === null) {
          try { ffmpeg.kill('SIGKILL'); } catch (_) {}
          await Promise.race([
            closePromise,
            new Promise(resolve => setTimeout(resolve, 1000)),
          ]);
        }

        if (
          closeResult === null
          || closeResult.code !== 0
          || spawnError !== null
          || !isPlausibleMp4(temporaryPath)
        ) {
          throw new Error('ffmpeg did not produce a complete MP4 recording');
        }

        fs.renameSync(temporaryPath, recordingPath);
        writeCompletionMarker(recordingPath);
        fs.renameSync(markerTemporaryPath, completionMarkerPath);
        finalized = true;
      } catch (e) {
        console.warn('Recording finalize error: ' + e.message);
      } finally {
        try { fs.rmSync(temporaryPath, { force: true }); } catch (_) {}
        try { fs.rmSync(markerTemporaryPath, { force: true }); } catch (_) {}
        if (!finalized) {
          try { fs.rmSync(recordingPath, { force: true }); } catch (_) {}
          try { fs.rmSync(completionMarkerPath, { force: true }); } catch (_) {}
        }
      }
      try {
        const recSize = recordingPath && fs.existsSync(recordingPath) ? fs.statSync(recordingPath).size : 0;
        console.debug('Recording finalized: ' + (recSize > 0 ? (recSize + ' bytes') : 'no file'));
      } catch (e) {
        console.debug('Recording finalize check skipped: ' + e.message);
      }

      if (finalized && clicks.length > 0 && !skipClickOverlay && !clickOverlayCancelled) {
        const budgetMs = clickOverlayDeadline === null
          ? CLICK_DEFAULT_BUDGET_MS
          : clickOverlayDeadline - Date.now();
        if (budgetMs < CLICK_MIN_BUDGET_MS) {
          console.debug('Recording click markers skipped: not enough time left');
        } else {
          try {
            const burned = await burnClickMarkers({
              inputPath: recordingPath,
              outputPath: clickOverlayPath,
              clicks,
              videoWidth: recW,
              videoHeight: recH,
              durationS,
              budgetMs,
              onProcess: (proc) => {
                clickOverlayProcess = proc;
                if (proc && clickOverlayCancelled) {
                  try { proc.kill('SIGKILL'); } catch (_) {}
                }
              },
            });
            if (burned && !clickOverlayCancelled) {
              writeCompletionMarker(clickOverlayPath);
              fs.renameSync(clickOverlayPath, recordingPath);
              fs.renameSync(markerTemporaryPath, completionMarkerPath);
              console.debug('Recording click markers burned: ' + clicks.length + ' click(s)');
            }
          } catch (e) {
            console.debug('Recording click markers skipped: ' + e.message);
          } finally {
            try { fs.rmSync(clickOverlayPath, { force: true }); } catch (_) {}
            try { fs.rmSync(markerTemporaryPath, { force: true }); } catch (_) {}
          }
        }
      }

      return finalized;
    },
  };
}

module.exports = { startRecording };
