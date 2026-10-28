const { createHash } = require('node:crypto');
function metrics(points) {
  if (!Array.isArray(points) || points.length !== 68) return null;
  const d=(a,b)=>Math.hypot(points[a].x-points[b].x,points[a].y-points[b].y);
  const eye=(start)=>(d(start+1,start+5)+d(start+2,start+4))/(2*Math.max(d(start,start+3),1));
  return {eyes:(eye(36)+eye(42))/2,mouth:d(62,66)/Math.max(d(60,64),1)};
}
function actionPassed(neutral, action, type) {
  if (!neutral || !action || ![neutral.eyes,neutral.mouth,action.eyes,action.mouth].every(Number.isFinite)) return false;
  if (type==='close_eyes') return neutral.eyes>0.20 && action.eyes<0.19 && neutral.eyes-action.eyes>0.07;
  return type==='open_mouth' && neutral.mouth<0.30 && action.mouth>0.38 && action.mouth-neutral.mouth>0.18;
}
const digest=buffer=>createHash('sha256').update(buffer).digest('hex');
function captureFeedback(neutral, action, type, actionRequired=false) {
  if (!neutral || !['eyes','mouth'].every(k=>Number.isFinite(neutral[k]))) return {ready:false,message:'Keep your whole face visible in bright, even light.'};
  if(type==='close_eyes' && neutral.eyes<=0.20) return {ready:false,restartReference:true,message:'Retake the first photo with both eyes fully open. Remove dark glasses.'};
  if(type==='open_mouth' && neutral.mouth>=0.30) return {ready:false,restartReference:true,message:'Retake the first photo with lips gently closed and a relaxed expression.'};
  if(!action && !actionRequired)return {ready:true,message:'Reference ready. Now follow the live action instruction.'};
  if(!action || !['eyes','mouth'].every(k=>Number.isFinite(action[k])))return {ready:false,message:'The action photo could not be measured. Keep your whole face visible in even light and retake this photo.'};
  if(actionPassed(neutral,action,type))return {ready:true,message:'Live action captured. Checking your identity…'};
  return {ready:false,message:type==='close_eyes'?'Close both eyes completely and keep them closed until the photo is taken. Keep your head straight.':'Open your mouth wider and hold it open until the photo is taken. Keep your head straight.'};
}
module.exports={metrics,actionPassed,digest,captureFeedback};
