const valid = require('./valid-scenario.js');
const clone = JSON.parse(JSON.stringify(valid));
clone.id = 'broken_missing_challenge_and_bad_category';
delete clone.challenge.answer;
clone.tests[0].category = 'not-a-valid-category';

module.exports = clone;
