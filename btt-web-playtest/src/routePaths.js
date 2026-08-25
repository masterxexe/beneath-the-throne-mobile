import { MAJOR_TRAVEL_ROUTES, ROAD_SEGMENT_PATHS, getMapNodes, roadKey } from "./roadNodes.js";

export function routePoints(a,b,locations = {}){
  const aId = typeof a === "string" ? a : a?.id;
  const bId = typeof b === "string" ? b : b?.id;
  const allNodes = getMapNodes(locations);
  const major = majorRoutePoints(aId,bId,allNodes);
  if(major.length)return major;
  const direct = directSegmentPoints(aId,bId);
  if(direct.length)return direct;
  const from = allNodes[aId];
  const to = allNodes[bId];
  return from && to ? [{x: from.x, y: from.y}, {x: to.x, y: to.y}] : [{x: 50, y: 50}];
}

export function routePathD(a,b,locations){
  const points = routePoints(a,b,locations);
  return points.map((point,index)=>`${index ? "L" : "M"} ${fmt(point.x)} ${fmt(point.y)}`).join(" ");
}

export function routePoint(a,b,t,locations){
  const points = routePoints(a,b,locations);
  return pointAlong(points,t);
}

export function routeAngle(a,b,t,locations){
  const before = routePoint(a,b,Math.max(0,t - .015),locations);
  const after = routePoint(a,b,Math.min(1,t + .015),locations);
  return Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI;
}

export function pointAlong(points,t){
  if(points.length === 1)return points[0];
  const distances = segmentDistances(points);
  const total = distances.reduce((sum,value)=>sum + value, 0) || 1;
  let target = clamp(t,0,1) * total;
  for(let i = 0; i < distances.length; i++){
    if(target <= distances[i]){
      const local = distances[i] ? target / distances[i] : 0;
      return lerpPoint(points[i], points[i + 1], local);
    }
    target -= distances[i];
  }
  return points[points.length - 1];
}

function majorRoutePoints(aId,bId,allNodes){
  const natural = MAJOR_TRAVEL_ROUTES[`${aId}__${bId}`];
  const reverse = MAJOR_TRAVEL_ROUTES[`${bId}__${aId}`];
  const stops = natural || (reverse ? [...reverse].reverse() : null);
  if(!stops)return [];
  return stops.slice(0,-1).flatMap((from,index)=>{
    const segment = directSegmentPoints(from,stops[index + 1]);
    const fallback = segment.length ? segment : nodeLine(from,stops[index + 1],allNodes);
    return index ? fallback.slice(1) : fallback;
  });
}

function directSegmentPoints(aId,bId){
  const directKey = `${aId}__${bId}`;
  const reverseKey = `${bId}__${aId}`;
  if(ROAD_SEGMENT_PATHS[directKey])return ROAD_SEGMENT_PATHS[directKey];
  if(ROAD_SEGMENT_PATHS[reverseKey])return [...ROAD_SEGMENT_PATHS[reverseKey]].reverse();
  const sorted = ROAD_SEGMENT_PATHS[roadKey(aId,bId)];
  return sorted ? sorted : [];
}

function nodeLine(fromId,toId,allNodes){
  const from = allNodes[fromId];
  const to = allNodes[toId];
  return from && to ? [{x: from.x, y: from.y}, {x: to.x, y: to.y}] : [];
}

function segmentDistances(points){
  return points.slice(0,-1).map((point,index)=>Math.hypot(points[index + 1].x - point.x, points[index + 1].y - point.y));
}

function lerpPoint(a,b,t){
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
  };
}

function clamp(value,min,max){
  return Math.max(min, Math.min(max, value));
}

function fmt(value){
  return Number(value).toFixed(2).replace(/\.?0+$/,"");
}
