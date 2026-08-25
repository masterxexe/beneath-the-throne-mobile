export const AUDIO_CHANNELS = {
  music:"music",
  ambience:"ambience",
  combat:"combat",
  ui:"ui"
};

export const AUDIO_HOOKS = {
  "combat-enter": {channel:AUDIO_CHANNELS.combat, intent:"start-combat-bed"},
  "battle-music-start": {channel:AUDIO_CHANNELS.music, intent:"combat-theme"},
  "hero-levelup": {channel:AUDIO_CHANNELS.music, intent:"level-up-sting"},
  "combat-defeat": {channel:AUDIO_CHANNELS.music, intent:"defeat-sting"},
  "town-ambience": {channel:AUDIO_CHANNELS.ambience, intent:"settlement-loop"},
  "travel-ambience": {channel:AUDIO_CHANNELS.ambience, intent:"road-loop"},
  "encounter-warning": {channel:AUDIO_CHANNELS.ui, intent:"threat-warning"},
  "sand-ash-transition": {channel:AUDIO_CHANNELS.ambience, intent:"transition-whoosh"},
  "title-music": {channel:AUDIO_CHANNELS.music, intent:"title-music"},
  "dragon-music": {channel:AUDIO_CHANNELS.music, intent:"dragon-music"},
  "hero-swing": {channel:AUDIO_CHANNELS.combat, intent:"hero-swing"},
  "enemy-swing": {channel:AUDIO_CHANNELS.combat, intent:"enemy-swing"},
  "hero-hit": {channel:AUDIO_CHANNELS.combat, intent:"hero-hit"},
  "hero-hurt": {channel:AUDIO_CHANNELS.combat, intent:"hero-hurt"},
  "block": {channel:AUDIO_CHANNELS.combat, intent:"block"},
  "potion": {channel:AUDIO_CHANNELS.combat, intent:"potion"},
  "potion-mana": {channel:AUDIO_CHANNELS.combat, intent:"potion-mana"},
  "miss": {channel:AUDIO_CHANNELS.combat, intent:"miss"},
  "magic": {channel:AUDIO_CHANNELS.combat, intent:"magic"},
  "ui-click": {channel:AUDIO_CHANNELS.ui, intent:"ui-click"},
  "dragon-hit": {channel:AUDIO_CHANNELS.combat, intent:"dragon-hit"},
  "kael-hit": {channel:AUDIO_CHANNELS.combat, intent:"kael-hit"}
};

export function resolveAudioHook(name, detail = {}){
  const hook = AUDIO_HOOKS[name] || {channel:AUDIO_CHANNELS.ui, intent:name || "generic"};
  return {
    name,
    channel:detail.channel || hook.channel,
    intent:detail.intent || hook.intent,
    ...detail
  };
}

export function playAudioHook(name, detail = {}){
  window.dispatchEvent(new CustomEvent("fallen-empire-audio", {detail:resolveAudioHook(name, detail)}));
}
