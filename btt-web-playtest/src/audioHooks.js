export const AUDIO_CHANNELS = {
  music:"music",
  ambience:"ambience",
  combat:"combat",
  ui:"ui"
};

export const AUDIO_HOOKS = {
  "combat-enter": {channel:AUDIO_CHANNELS.combat, intent:"start-combat-bed"},
  "battle-music-start": {channel:AUDIO_CHANNELS.music, intent:"combat-theme"},
  "combat-victory": {channel:AUDIO_CHANNELS.music, intent:"victory-sting"},
  "combat-defeat": {channel:AUDIO_CHANNELS.music, intent:"defeat-sting"},
  "town-ambience": {channel:AUDIO_CHANNELS.ambience, intent:"settlement-loop"},
  "travel-ambience": {channel:AUDIO_CHANNELS.ambience, intent:"road-loop"},
  "encounter-warning": {channel:AUDIO_CHANNELS.ui, intent:"threat-warning"},
  "sand-ash-transition": {channel:AUDIO_CHANNELS.ambience, intent:"transition-whoosh"}
};

export function resolveAudioHook(name, detail = {}){
  const hook = AUDIO_HOOKS[name] || {channel:AUDIO_CHANNELS.ui, intent:"generic"};
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
