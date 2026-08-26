function currentLocation(){
  return typeof globalThis !== "undefined" ? globalThis.location : null;
}

export function isLoopbackHostname(hostname = ""){
  const value = String(hostname).trim().toLowerCase();
  return value === "localhost"
    || value.endsWith(".localhost")
    || value === "127.0.0.1"
    || value === "0.0.0.0"
    || value === "::1"
    || value === "[::1]";
}

export function isLocalDebugEnabled(locationLike = currentLocation()){
  if(!locationLike || !isLoopbackHostname(locationLike.hostname))return false;
  return new URLSearchParams(locationLike.search || "").has("debug");
}

export function isLocalDebugOverlaysEnabled(locationLike = currentLocation()){
  if(!locationLike || !isLoopbackHostname(locationLike.hostname))return false;
  return new URLSearchParams(locationLike.search || "").has("debugOverlays");
}
