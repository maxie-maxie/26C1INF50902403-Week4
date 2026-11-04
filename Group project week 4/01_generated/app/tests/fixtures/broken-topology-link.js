const valid = require('./valid-scenario.js');
const clone = JSON.parse(JSON.stringify(valid));
clone.id = 'broken_topology_ip_and_link';
clone.topology.devices[0].interfaces[0].ip = '999.168.10.10';
clone.topology.links.push({
  id: 'l_dangling',
  a: { dev: 'pc1', if: 'eth0' },
  b: { dev: 'ghost_router', if: 'g0/9' },
  up: true,
  cost: 1,
  delayMs: 1,
  bandwidthMbps: 100,
  kind: 'lan'
});

module.exports = clone;
