const {test}=require('node:test');const assert=require('node:assert/strict');
const {actionPassed,digest}=require('../src/lib/faceLiveness');
test('unchanged static face geometry cannot satisfy either randomized live action',()=>{
 const face={eyes:0.3,mouth:0.05};assert.equal(actionPassed(face,face,'open_mouth'),false);assert.equal(actionPassed(face,face,'close_eyes'),false);
 assert.equal(actionPassed(face,{eyes:0.3,mouth:0.6},'open_mouth'),true);
 assert.equal(actionPassed(face,{eyes:0.09,mouth:0.05},'close_eyes'),true);
 assert.equal(actionPassed(face,{eyes:0.3,mouth:0.6},'close_eyes'),false);
 assert.equal(digest(Buffer.from('same')),digest(Buffer.from('same')));
});
