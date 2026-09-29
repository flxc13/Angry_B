/* Offline, dependency-free audio. Load once, before the game's integration code.
 * sound controls SFX only; music is independent. unlock() belongs in a real
 * pointer/key gesture, including the gesture that resumes a paused game.
 * No fetch or MediaElementAudioSource: the MP3 plays directly in HTMLAudioElement.
 * System/device volume is beyond this module's control; hearing safety cannot
 * be guaranteed. These conservative limits are not a hearing-safety guarantee.
 */
(function (global) {
  'use strict';
  if (global.BongiAudio) return;

  const CAPS = Object.freeze({ voices: 16, music: 0.4, master: 0.22, lowpass: 3500 });
  const MASTER = 0.18;
  const settings = { sound: false, sfxVolume: 0.45, music: true, musicVolume: 0.25 };
  const mp3Source = new URL('./resource/Bon Bon Bonji.mp3',
    document.currentScript ? document.currentScript.src || document.baseURI : document.baseURI).href;
  const music = new Audio();
  const oggSource = new URL('./Bon Bon Bonji.ogg', mp3Source).href;
  let source = music.canPlayType('audio/mpeg') ? mp3Source : oggSource;
  let fallbackUsed = source === oggSource;
  let blobFallbackUsed = false, objectURL = null;
  music.autoplay = false;
  music.loop = true;
  music.preload = 'metadata';
  music.volume = 0;

  let unlocked = false;
  let gamePaused = false;
  let hidden = document.hidden;
  let metadataLoaded = false;
  let loadError = null;
  let playError = null;
  let musicBlocked = false;
  let musicAttempt = null;
  let musicRevision = 0;
  let volumeTimer = null;
  let duckTimer = null;
  let duckUntil = 0;
  let volumeTarget = 0;
  let context = null;
  let bus = null;
  let master = null;
  let noiseBuffer = null;
  let sfxError = null;
  let sfxBlocked = false;
  let contextWanted = false;
  let contextOperation = null;
  let suspendTimer = null;
  let pendingSound = null;
  const voices = new Set();
  const lastPlayed = new Map();
  const limits = { launch: 160, hit: 65, pop: 80, shield: 130, bomb: 300,
    win: 1200, loss: 1200, event: 700, giantBounce: 250 };
  const costs = { launch: 3, hit: 2, pop: 2, shield: 3, bomb: 3,
    win: 4, loss: 3, event: 3, giantBounce: 2 };

  const paused = () => gamePaused || hidden;
  const message = error => error && error.message ? error.message : String(error || 'Playback failed');
  const clampVolume = (value, fallback) => typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value)) : fallback;
  const wantsMusic = () => unlocked && !paused() && settings.music && settings.musicVolume > 0;

  function clearVolumeTimer() {
    if (volumeTimer !== null) clearTimeout(volumeTimer);
    volumeTimer = null;
  }

  function updateVolume(immediate) {
    clearVolumeTimer();
    volumeTarget = wantsMusic()
      ? Math.min(CAPS.music, settings.musicVolume) * (performance.now() < duckUntil ? 0.38 : 1)
      : 0;
    if (immediate || volumeTarget === 0) {
      music.volume = volumeTarget;
      return;
    }
    const start = music.volume;
    const started = performance.now();
    const duration = volumeTarget < start ? 100 : 320;
    function step() {
      volumeTimer = null;
      const fraction = Math.min(1, (performance.now() - started) / duration);
      const smooth = fraction * fraction * (3 - 2 * fraction);
      music.volume = Math.max(0, Math.min(CAPS.music, start + (volumeTarget - start) * smooth));
      if (fraction < 1) volumeTimer = setTimeout(step, 25);
    }
    step();
  }

  function clearDuck() {
    if (duckTimer !== null) clearTimeout(duckTimer);
    duckTimer = null;
    duckUntil = 0;
  }

  function duck(duration) {
    if (!wantsMusic()) return;
    if (duckTimer !== null) clearTimeout(duckTimer);
    duckUntil = Math.max(duckUntil, performance.now() + duration);
    updateVolume(false);
    duckTimer = setTimeout(() => {
      duckTimer = null;
      duckUntil = 0;
      updateVolume(false);
    }, Math.max(0, duckUntil - performance.now()));
  }

  // Exactly one unresolved play() at a time. Pause is synchronous; obsolete
  // promise results never overwrite the status of a newer state transition.
  function syncMusic(retry) {
    if (retry) {
      playError = null;
      musicBlocked = false;
    }
    if (!wantsMusic()) {
      music.pause();
      return;
    }
    if (loadError || playError || musicBlocked || musicAttempt || !music.paused) return;
    const attempt = { revision: musicRevision };
    musicAttempt = attempt;
    function settled(error) {
      if (musicAttempt !== attempt) return;
      musicAttempt = null;
      const stale = attempt.revision !== musicRevision;
      if (error && !stale && wantsMusic()) {
        playError = message(error);
        musicBlocked = error.name === 'NotAllowedError';
        music.pause();
      }
      if (!wantsMusic()) music.pause();
      // Only a newer transition may authorize a retry; never retry a current
      // failure from a render loop, media event, or timer.
      else if (stale) syncMusic(false);
    }
    try {
      const promise = music.play();
      if (promise && typeof promise.then === 'function') promise.then(() => settled(null), settled);
      else settled(null);
    } catch (error) {
      settled(error);
    }
  }

  music.addEventListener('loadedmetadata', () => { metadataLoaded = true; loadError = null; });
  music.addEventListener('error', () => {
    if(!fallbackUsed){
      fallbackUsed=true;source=oggSource;musicRevision++;musicAttempt=null;
      playError=null;musicBlocked=false;loadError=null;music.src=source;syncMusic(true);return;
    }
    // Some trusted-editor file bridges serve audio bytes correctly but reject
    // media range requests. Optional local-byte fallback; normal browsers use
    // the direct file path above and do not need fetch, a server, or a network.
    if(!blobFallbackUsed){
      blobFallbackUsed=true;musicRevision++;musicAttempt=null;
      fetch(oggSource).then(response=>{if(!response.ok)throw new Error('Local audio unavailable');return response.blob();})
        .then(blob=>{
          objectURL=URL.createObjectURL(new Blob([blob],{type:'audio/ogg'}));
          loadError=null;playError=null;musicBlocked=false;music.src=objectURL;syncMusic(false);
        }).catch(error=>{loadError={code:4,message:message(error)};});
      return;
    }
    const error = music.error;
    loadError = { code: error ? error.code : 0, message: error && error.message || 'Music could not load' };
    music.pause();
  });
  // Assignment requests only metadata, never autoplay. Missing music does not
  // disable synthesized SFX, and failed SFX never disable the MP3 fallback.
  music.src = source;

  function ensureContext() {
    if (context) return context.state !== 'closed';
    const AudioContext = global.AudioContext || global.webkitAudioContext;
    if (!AudioContext) { sfxError = 'Web Audio is unavailable'; return false; }
    try {
      context = new AudioContext();
      bus = context.createGain();
      bus.gain.value = settings.sound ? settings.sfxVolume * 0.65 : 0;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 3200;
      filter.Q.value = 0.5;
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -22;
      compressor.knee.value = 18;
      compressor.ratio.value = 8;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.16;
      const clip = context.createWaveShaper();
      const curve = new Float32Array(4097);
      for (let i = 0; i < curve.length; i++) {
        const x = 2 * i / (curve.length - 1) - 1;
        curve[i] = 0.82 * Math.tanh(2 * x);
      }
      // WaveShaper clamps inputs outside its curve domain. No oversampling
      // filter after the clipper; a conservative master is the final node.
      clip.curve = curve;
      clip.oversample = 'none';
      master = context.createGain();
      master.gain.value = Math.min(MASTER, CAPS.master);
      bus.connect(filter).connect(compressor).connect(clip).connect(master).connect(context.destination);
      noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      sfxError = null;
      return true;
    } catch (error) {
      sfxError = message(error);
      if (context) { try { context.close().catch(() => {}); } catch (_) { /* unsupported close */ } }
      context = null;
      bus = null;
      master = null;
      return false;
    }
  }

  // Serialize suspend/resume and reconcile only a changed target. A rejected
  // resume is latched until the next gesture, not retried continuously.
  function syncContext() {
    if (!context || context.state === 'closed' || contextOperation) return;
    const target = contextWanted && !paused();
    if (target ? context.state === 'running' : context.state === 'suspended') return;
    const operation = { target };
    contextOperation = operation;
    const settled = error => {
      if (contextOperation !== operation) return;
      contextOperation = null;
      if (error && target) { sfxError = message(error); sfxBlocked = error.name === 'NotAllowedError'; }
      else if (!error && target) {
        sfxError = null; sfxBlocked = false;
        if(pendingSound&&!paused()){const kind=pendingSound;pendingSound=null;play(kind);}
      }
      if (target !== (contextWanted && !paused())) syncContext();
    };
    try { Promise.resolve(target ? context.resume() : context.suspend()).then(() => settled(null), settled); }
    catch (error) { settled(error); }
  }

  function releaseVoice(voice) {
    if (!voices.delete(voice)) return;
    voice.source.onended = null;
    for (const node of voice.nodes) { try { node.disconnect(); } catch (_) { /* already disconnected */ } }
  }

  function stopVoices() {
    if (!context) return;
    const now = context.currentTime;
    for (const voice of voices) {
      const gain = voice.envelope.gain;
      // cancelAndHold preserves the exact instantaneous envelope when present.
      if (typeof gain.cancelAndHoldAtTime === 'function') gain.cancelAndHoldAtTime(now);
      else { const value = gain.value; gain.cancelScheduledValues(now); gain.setValueAtTime(value, now); }
      gain.linearRampToValueAtTime(0, now + 0.012);
      try { voice.source.stop(now + 0.015); } catch (_) { releaseVoice(voice); }
    }
  }

  function updateBus() {
    if (!bus) return;
    const gain = bus.gain;
    const now = context.currentTime;
    gain.cancelScheduledValues(now);
    // Mute is immediate; unmute/volume movement is smoothed.
    if (!settings.sound || settings.sfxVolume === 0) gain.setValueAtTime(0, now);
    else gain.setTargetAtTime(settings.sfxVolume * 0.65, now, 0.015);
  }

  function syncPause() {
    musicRevision++;
    if (paused()) {
      pendingSound=null;
      clearDuck();
      contextWanted = false;
      stopVoices();
      if (suspendTimer !== null) clearTimeout(suspendTimer);
      // Let the short release envelopes finish before freezing the audio clock.
      suspendTimer = setTimeout(() => {
        suspendTimer = null;
        syncContext();
      }, 25);
    }
    // Unpausing resumes music at its retained position. Web Audio stays
    // suspended until unlock() is called from the next resume/play gesture.
    updateVolume(paused());
    syncMusic(false);
  }

  function configure(options) {
    if (!options || typeof options !== 'object') return snapshot();
    const oldMusic = settings.music;
    const oldMusicVolume = settings.musicVolume;
    const oldSound = settings.sound;
    const oldSfxVolume = settings.sfxVolume;
    if (typeof options.sound === 'boolean') settings.sound = options.sound;
    if (typeof options.music === 'boolean') settings.music = options.music;
    settings.sfxVolume = clampVolume(options.sfxVolume, settings.sfxVolume);
    settings.musicVolume = clampVolume(options.musicVolume, settings.musicVolume);
    if (oldSound !== settings.sound || oldSfxVolume !== settings.sfxVolume) {
      updateBus();
      if (!settings.sound || settings.sfxVolume === 0) stopVoices();
    }
    if (oldMusic !== settings.music || oldMusicVolume !== settings.musicVolume) {
      musicRevision++;
      if (!settings.music || settings.musicVolume === 0) clearDuck();
      updateVolume(!settings.music || settings.musicVolume === 0);
      syncMusic((!oldMusic && settings.music) || (oldMusicVolume === 0 && settings.musicVolume > 0));
    }
    return snapshot();
  }

  function unlock() {
    unlocked = true;
    musicRevision++;
    if (!paused()) {
      if (suspendTimer !== null) clearTimeout(suspendTimer);
      suspendTimer = null;
    }
    if (!paused() && ensureContext()) {
      contextWanted = true;
      // Both browser playback requests occur synchronously in this gesture.
      syncContext();
    }
    updateVolume(false);
    syncMusic(true);
    return snapshot();
  }

  function setPaused(value) {
    const next = Boolean(value);
    if (next === gamePaused) return snapshot();
    gamePaused = next;
    syncPause();
    return snapshot();
  }

  // Each oscillator/buffer source counts as one voice, including scheduled
  // notes. All source-specific nodes disconnect in onended; graph nodes persist.
  function layer(type, frequency, endFrequency, duration, amplitude, cutoff, delay) {
    const start = context.currentTime + 0.006 + (delay || 0);
    const end = start + duration;
    const sourceNode = type === 'noise' ? context.createBufferSource() : context.createOscillator();
    if (type === 'noise') { sourceNode.buffer = noiseBuffer; sourceNode.loop = true; }
    else {
      sourceNode.type = type;
      sourceNode.frequency.setValueAtTime(Math.max(30, frequency), start);
      sourceNode.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), end);
    }
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.max(100, Math.min(CAPS.lowpass, cutoff)), start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(100, Math.min(CAPS.lowpass, cutoff * 0.45)), end);
    filter.Q.value = type === 'noise' ? 0.65 : 0.9;
    const envelope = context.createGain();
    envelope.gain.value = 0;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(amplitude, start + Math.min(0.025, duration * 0.12));
    envelope.gain.exponentialRampToValueAtTime(0.0001, end - 0.008);
    envelope.gain.linearRampToValueAtTime(0, end);
    sourceNode.connect(filter).connect(envelope).connect(bus);
    const voice = { source: sourceNode, envelope, nodes: [sourceNode, filter, envelope] };
    voices.add(voice);
    sourceNode.onended = () => releaseVoice(voice);
    try { sourceNode.start(start); sourceNode.stop(end + 0.005); }
    catch (error) { releaseVoice(voice); throw error; }
  }

  // Original procedural comic gestures, not recordings or recognizable tunes.
  function play(kind) {
    if (!Object.prototype.hasOwnProperty.call(costs, kind)) return false;
    if (!unlocked || paused()) return false;
    if(settings.sound&&settings.sfxVolume>0&&context&&context.state!=='running'&&contextOperation?.target){pendingSound=kind;return true;}
    const now = performance.now();
    if (now - (lastPlayed.get(kind) ?? -Infinity) < limits[kind]) return false;
    const canSfx = settings.sound && settings.sfxVolume > 0 && context && context.state === 'running';
    const canDuck = (kind === 'launch' || kind === 'event') && wantsMusic();
    if (!canSfx && !canDuck) return false;
    if (canSfx && voices.size + costs[kind] > CAPS.voices) return false;
    lastPlayed.set(kind, now);
    if (canDuck) duck(kind === 'launch' ? 700 : 1300);
    if (!canSfx) return true;
    try {
      switch (kind) {
        case 'giantBounce':
          layer('triangle', 160, 680, 0.24, 0.3, 1800);
          layer('sine', 620, 170, 0.32, 0.32, 1600, 0.12);
          break;
        case 'launch':
          layer('triangle', 170, 42, 0.46, 0.6, 750);
          layer('noise', 0, 0, 0.3, 0.28, 1700);
          layer('sawtooth', 240, 620, 0.38, 0.2, 1500, 0.025);
          break;
        case 'hit':
          layer('triangle', 125, 38, 0.2, 0.65, 600);
          layer('noise', 0, 0, 0.11, 0.3, 1100);
          break;
        case 'pop':
          layer('square', 390, 80, 0.17, 0.24, 1500);
          layer('triangle', 110, 280, 0.13, 0.4, 850, 0.035);
          break;
        case 'shield':
          layer('triangle', 410, 310, 0.34, 0.35, 2000);
          layer('square', 683, 550, 0.26, 0.16, 2200);
          layer('noise', 0, 0, 0.075, 0.2, 2600);
          break;
        case 'bomb':
          layer('triangle', 95, 30, 0.75, 0.7, 550);
          layer('noise', 0, 0, 0.55, 0.4, 1900);
          layer('sawtooth', 65, 32, 0.48, 0.2, 480, 0.04);
          break;
        case 'win':
          [196, 247, 294, 392].forEach((note, i) =>
            layer('triangle', note * 0.96, note, 0.32, 0.38, 1800, i * 0.11));
          break;
        case 'loss':
          [220, 185, 139].forEach((note, i) =>
            layer('sawtooth', note, note * 0.73, 0.42, 0.26, 1000, i * 0.22));
          break;
        case 'event':
          layer('sawtooth', 100, 540, 0.8, 0.24, 1800);
          layer('triangle', 135, 710, 0.85, 0.28, 2000, 0.035);
          layer('noise', 0, 0, 0.8, 0.2, 2600);
          break;
      }
      return true;
    } catch (error) { sfxError = message(error); stopVoices(); return false; }
  }

  function snapshot() {
    const status = loadError ? 'error' : musicBlocked ? 'blocked' : playError ? 'error'
      : !settings.music || settings.musicVolume === 0 ? 'muted' : !unlocked ? 'waiting-gesture'
        : paused() ? 'paused' : musicAttempt ? 'starting' : !music.paused ? 'playing'
          : metadataLoaded ? 'ready' : 'loading';
    return {
      ...settings, source, blobFallbackUsed, unlocked, paused: paused(), gamePaused, hidden,
      musicStatus: status, musicPaused: music.paused,
      currentTime: Number.isFinite(music.currentTime) ? music.currentTime : 0,
      duration: Number.isFinite(music.duration) ? music.duration : null,
      metadataLoaded, readyState: music.readyState, networkState: music.networkState,
      pendingPlay: Boolean(musicAttempt), blocked: musicBlocked || sfxBlocked,
      error: loadError ? loadError.message : playError || sfxError,
      errors: { musicLoad: loadError ? { ...loadError } : null, musicPlay: playError, sfx: sfxError },
      musicBlocked, sfxBlocked, contextState: context ? context.state : 'not-created',
      activeVoices: voices.size, ducked: performance.now() < duckUntil,
      musicElementVolume: music.volume, musicTargetVolume: volumeTarget,
      masterGain: master ? master.gain.value : MASTER,
      gainCaps: { ...CAPS, softclip: 0.82, sfxBus: 0.65 },
      timers: { volume: volumeTimer !== null, duck: duckTimer !== null, suspend: suspendTimer !== null }
    };
  }

  document.addEventListener('visibilitychange', () => {
    const next = document.hidden;
    if (next === hidden) return;
    hidden = next;
    syncPause();
  });
  global.addEventListener('pagehide',()=>{music.pause();if(objectURL)URL.revokeObjectURL(objectURL);});

  global.BongiAudio = Object.freeze({ configure, unlock, setPaused, play, snapshot });
})(globalThis);