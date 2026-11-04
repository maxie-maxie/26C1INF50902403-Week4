const valid = require('./valid-scenario.js');
const clone = JSON.parse(JSON.stringify(valid));
clone.id = 'broken_unknown_op';
clone.variants = [
  {
    id: 'bad_mut',
    label: 'Biến thể có op không tồn tại',
    mutations: [
      { op: 'link.explode', linkId: 'l_r1_r2' }
    ]
  }
];

module.exports = clone;
