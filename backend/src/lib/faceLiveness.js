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
module.exports={metrics,actionPassed,digest};
