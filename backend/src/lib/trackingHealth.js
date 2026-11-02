function trackingHealth({lastFixAt,accuracy,heartbeat,checkedOut,now=Date.now()}) {
  const gpsAge=now-Date.parse(lastFixAt || '');
  const deviceAge=now-Date.parse(heartbeat?.receivedAt || '');
  const deviceOnline=Number.isFinite(deviceAge) && deviceAge>=-5000 && deviceAge<=60000;
  if(checkedOut)return {status:'checked_out',deviceOnline,reason:'Shift has ended'};
  if(deviceOnline && heartbeat.airplaneMode===true)return {status:'airplane_mode',deviceOnline,reason:'Phone is in airplane mode. Location and updates are interrupted until it is turned off.'};
  if(deviceOnline && heartbeat.locationEnabled===false)return {status:'location_off',deviceOnline,reason:'Phone location / GPS is switched off. Enable location in phone settings.'};
  if(deviceOnline && heartbeat.networkAvailable===false)return {status:'no_network',deviceOnline,reason:'Phone has no internet. GPS may still collect locally; admin updates resume when data returns.'};
  if(deviceOnline && heartbeat.permission!=='granted')return {status:'permission_required',deviceOnline,reason:'Location permission is missing on the phone.'};
  if(deviceOnline && heartbeat.backgroundAllowed===false)return {status:'background_required',deviceOnline,reason:'Background location is not allowed. Ask the employee to choose “Allow all the time”.'};
  if(deviceOnline && heartbeat.trackingActive===false)return {status:'gps_pending',deviceOnline,reason:'App connected; duty GPS service is not active. Open Attendance to resume duty tracking.'};
  if(Number.isFinite(gpsAge) && gpsAge>=-5000 && gpsAge<=45000){
    if(accuracy!=null && accuracy>35)return {status:'weak_gps',deviceOnline:true,reason:'Fresh GPS received with reduced accuracy; excluded from travelled distance.'};
    return {status:'live',deviceOnline:true,reason:'Recent GPS observation received'};
  }
  if(deviceOnline)return {status:'gps_pending',deviceOnline,reason:heartbeat.issue || 'App connected; waiting for a fresh GPS fix.'};
  if(Number.isFinite(gpsAge) && gpsAge<=300000)return {status:'delayed',deviceOnline:false,reason:'GPS updates are delayed. Check app background access and connection.'};
  return {status:'offline',deviceOnline:false,reason:'No recent app updates. Open the app and check background/battery permissions and internet.'};
}
module.exports={trackingHealth};
