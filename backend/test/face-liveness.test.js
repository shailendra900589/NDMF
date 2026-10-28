const {test}=require('node:test');const assert=require('node:assert/strict');
const {actionPassed,digest,captureFeedback}=require('../src/lib/faceLiveness');
test('unchanged static face geometry cannot satisfy either randomized live action',()=>{
 const face={eyes:0.3,mouth:0.05};assert.equal(actionPassed(face,face,'open_mouth'),false);assert.equal(actionPassed(face,face,'close_eyes'),false);
 assert.equal(actionPassed(face,{eyes:0.3,mouth:0.6},'open_mouth'),true);
 assert.equal(actionPassed(face,{eyes:0.09,mouth:0.05},'close_eyes'),true);
 assert.equal(actionPassed(face,{eyes:0.3,mouth:0.6},'close_eyes'),false);
 assert.equal(digest(Buffer.from('same')),digest(Buffer.from('same')));
});
test('capture guidance distinguishes bad reference, wrong action and ready frames without weakening liveness',()=>{
 const neutral={eyes:0.30,mouth:0.05};
 assert.equal(captureFeedback(neutral,null,'close_eyes').ready,true);
 assert.equal(captureFeedback({eyes:0.10,mouth:0.05},null,'close_eyes').restartReference,true);
 assert.equal(captureFeedback({eyes:0.30,mouth:0.5},null,'open_mouth').restartReference,true);
 assert.match(captureFeedback(neutral,neutral,'open_mouth').message,/wider/);
 assert.equal(captureFeedback(neutral,neutral,'close_eyes').ready,false);
 assert.equal(captureFeedback(neutral,{eyes:0.09,mouth:0.05},'close_eyes').ready,true);
 assert.equal(captureFeedback(null,null,'open_mouth').ready,false);
});
