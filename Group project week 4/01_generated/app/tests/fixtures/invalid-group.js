const valid = require('./valid-scenario.js');
const clone = JSON.parse(JSON.stringify(valid));
clone.id = 'broken_invalid_group';
clone.group = 'Z';

module.exports = clone;
