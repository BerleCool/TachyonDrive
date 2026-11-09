const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../.core-test/elevation.js');
const F = (time, h, accuracy = 2) => ({ timestamp: time, altitude: h, altitudeAccuracy: accuracy });
const fuel = { litresPer100Km: 6, pricePerLitre: 15, terrainMode: true, massKg: 1150, fuelType: 'petrol' };
test('unknown altitude never invents a climb', () => {
  const next = E.observeElevation(undefined, F(1000, null, null), 0, 0);
  assert.equal(next.stats.ascentM, 0);
  assert.equal(next.stats.anchor, null);
});
test('low-quality vertical fix never modifies ascent', () => {
  let v = E.observeElevation(undefined, F(1000, 20), 0, 0).stats;
  v = E.observeElevation(v, F(10000, 100, 100), 100, 100).stats;
  assert.equal(v.ascentM, 0); assert.equal(v.anchor, null);
});
test('stationary vertical jitter is ignored', () => {
  let v = E.observeElevation(undefined, F(1000, 50), 0, 0).stats;
  for (let i=1;i<25;i++) v = E.observeElevation(v, F(1000+i*1000, 50+(i%2?9:-9)), 0, 0).stats;
  assert.equal(v.ascentM, 0); assert.equal(v.descentM, 0);
});
test('gentle sustained hill is detected past accuracy threshold', () => {
  let v = E.observeElevation(undefined, F(1000, 50), 0, 0).stats;
  for (let i=1;i<=5;i++) v = E.observeElevation(v, F(1000+i*10000,50+i*2), i*60,60).stats;
  assert.ok(v.ascentM >= 8 && v.ascentM <= 10); assert.equal(v.descentM,0);
});
test('slope beyond realistic road threshold is rejected', () => {
  let v = E.observeElevation(undefined, F(1000, 50), 0, 0).stats;
  const out = E.observeElevation(v, F(12000,90),60,60);
  assert.equal(out.ascentDelta,0); assert.equal(out.stats.rejected,1);
});
test('downhill accumulates only measured descent', () => {
  let v=E.observeElevation(undefined,F(1000,100),0,0).stats;
  v=E.observeElevation(v,F(20000,92),100,100).stats;
  assert.equal(v.descentM,8);
});
test('a GPS gap resets the reference anchor', () => {
  let v=E.observeElevation(undefined,F(1000,50),0,0).stats;
  v=E.observeElevation(v,F(90000,80),600,0,true).stats;
  assert.equal(v.ascentM,0);
  assert.equal(v.anchor.altitudeM,80);
});
test('baseline unchanged without sufficient elevation coverage', () => {
  const v=E.terrainEstimate(10000,fuel,{ascentM:150,descentM:0,coveredMetres:0});
  assert.equal(v.cost,v.baselineCost);
});
test('uphill increases cost but is capped', () => {
  const v=E.terrainEstimate(10000,fuel,{ascentM:1000,descentM:0,coveredMetres:9000});
  assert.ok(v.cost>v.baselineCost);
  assert.ok(v.cost<=v.baselineCost*1.45+0.0001);
});
test('downhill never means free fuel', () => {
  const v=E.terrainEstimate(5000,fuel,{ascentM:0,descentM:900,coveredMetres:4000});
  assert.ok(v.litres>=v.baselineLitres*0.85);
  assert.ok(v.cost>0);
});
test('terrain correction is opt-in and fuel type influences physical coefficient', () => {
  const base=E.terrainEstimate(10000,{...fuel,terrainMode:false},{ascentM:100,descentM:0,coveredMetres:10000});
  assert.equal(base.correctionCost,0);
  const petrol=E.terrainEstimate(10000,fuel,{ascentM:100,descentM:0,coveredMetres:10000});
  const diesel=E.terrainEstimate(10000,{...fuel,fuelType:'diesel'},{ascentM:100,descentM:0,coveredMetres:10000});
  assert.ok(petrol.correctionLitres>diesel.correctionLitres);
});
test('zero distance remains zero', () => {
  const v=E.terrainEstimate(0,fuel,{ascentM:0,descentM:0,coveredMetres:0});
  assert.equal(v.cost,0); assert.equal(v.correctionCost,0);
});
test('negative and invalid rate inputs are rejected', () => {
  assert.equal(E.terrainEstimate(-1,fuel),null);
  assert.equal(E.terrainEstimate(10,{...fuel,litresPer100Km:0}),null);
});
test('missing vertical accuracy cannot make an elevation correction', () => {
  assert.equal(E.usableAltitude(F(1000,60,null)),false);
  assert.equal(E.usableAltitude(F(1000,60,3)),true);
});
