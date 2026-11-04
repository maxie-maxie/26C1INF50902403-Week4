const valid = require('./valid-scenario.js');
const clone = JSON.parse(JSON.stringify(valid));
delete clone.id;

module.exports = clone;
