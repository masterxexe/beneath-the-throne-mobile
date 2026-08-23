import { MAJOR_TRAVEL_ROUTES, ROAD_SEGMENT_PATHS, roadKey } from "./roadNodes.js";

export function travelRouteStops(fromId,toId){
  const direct = majorRoute(fromId,toId);
  if(direct.length)return direct;
  return graphRoute(fromId,toId);
}

export function routeLegs(stops){
  return stops.slice(0,-1).map((from,index)=>({from, to:stops[index + 1]}));
}

export function routeStopDanger(stopId, allNodes = {}){
  return allNodes[stopId]?.danger ?? 1;
}

function majorRoute(fromId,toId){
  const key = `${fromId}__${toId}`;
  const reverseKey = `${toId}__${fromId}`;
  if(MAJOR_TRAVEL_ROUTES[key])return [...MAJOR_TRAVEL_ROUTES[key]];
  if(MAJOR_TRAVEL_ROUTES[reverseKey])return [...MAJOR_TRAVEL_ROUTES[reverseKey]].reverse();
  return [];
}

function graphRoute(fromId,toId){
  const graph = buildGraph();
  const queue = [[fromId]];
  const visited = new Set([fromId]);
  while(queue.length){
    const path = queue.shift();
    const current = path[path.length - 1];
    if(current === toId)return path;
    for(const next of graph[current] || []){
      if(visited.has(next))continue;
      visited.add(next);
      queue.push([...path,next]);
    }
  }
  return [fromId,toId];
}

function buildGraph(){
  const graph = {};
  Object.keys(ROAD_SEGMENT_PATHS).forEach(key=>{
    const [a,b] = key.split("__");
    graph[a] ||= [];
    graph[b] ||= [];
    if(!graph[a].includes(b))graph[a].push(b);
    if(!graph[b].includes(a))graph[b].push(a);
  });
  Object.values(MAJOR_TRAVEL_ROUTES).forEach(route=>{
    route.slice(0,-1).forEach((from,index)=>{
      const to = route[index + 1];
      const key = roadKey(from,to);
      if(ROAD_SEGMENT_PATHS[key])return;
      graph[from] ||= [];
      graph[to] ||= [];
      if(!graph[from].includes(to))graph[from].push(to);
      if(!graph[to].includes(from))graph[to].push(from);
    });
  });
  return graph;
}
