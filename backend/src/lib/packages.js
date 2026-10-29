const {MODULES,ACTIONS}=require('./companyPolicy');
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
function starterPackage(){
  const enabled=['dashboard','attendance','tracking','users','branches'];
  return {id:'PKG_STARTER',name:'Starter',description:'Attendance and field team essentials for a growing team.',
    monthlyPrice:1000,includedEmployees:5,extraEmployeeMonthlyPrice:200,billingMonths:1,currency:'INR',
    modules:Object.fromEntries(Object.keys(MODULES).map(k=>[k,enabled.includes(k)])),
    actions:Object.fromEntries(Object.keys(MODULES).map(k=>[k,Object.fromEntries(Object.keys(ACTIONS).map(a=>[a,true]))])),
    published:true,isArchived:false,createdAt:new Date().toISOString()};
}
function validatePackage(body){
  const name=String(body.name||'').trim(),description=String(body.description||'').trim();
  if(!name || name.length>80 || description.length>500)fail('Enter a package name (up to 80 characters) and description (up to 500).');
  for(const k of ['monthlyPrice','extraEmployeeMonthlyPrice','includedEmployees','billingMonths']){
    if(!Number.isSafeInteger(body[k]) || body[k]<0)fail(`Invalid ${k}`);
  }
  if(body.monthlyPrice>10000000 || body.extraEmployeeMonthlyPrice>10000000 || body.includedEmployees>100000 || body.billingMonths<1 || body.billingMonths>12)fail('Package price, employee count or billing period is outside the supported range.');
  if(typeof body.published!=='boolean' || typeof body.isArchived!=='boolean')fail('Choose publication and archive status.');
  const modules={},actions={};
  for(const k of Object.keys(MODULES)){
    if(typeof body.modules?.[k]!=='boolean')fail(`Choose access for ${MODULES[k]}`);
    modules[k]=body.modules[k];actions[k]={};
    for(const a of Object.keys(ACTIONS)){
      if(typeof body.actions?.[k]?.[a]!=='boolean')fail(`Choose function access for ${MODULES[k]}`);
      actions[k][a]=body.actions[k][a];
    }
  }
  if(!Object.values(modules).some(Boolean))fail('Include at least one module.');
  return {name,description,monthlyPrice:body.monthlyPrice,extraEmployeeMonthlyPrice:body.extraEmployeeMonthlyPrice,
    includedEmployees:body.includedEmployees,billingMonths:body.billingMonths,currency:'INR',modules,actions,
    published:body.published && !body.isArchived,isArchived:body.isArchived};
}
function quote(plan,employees){
  if(!Number.isSafeInteger(employees)||employees<0||employees>100000)fail('Enter an employee count between 0 and 100000.');
  const additionalEmployees=Math.max(0,employees-plan.includedEmployees);
  const extraMonthlyAmount=additionalEmployees*plan.extraEmployeeMonthlyPrice;
  return {currency:'INR',employees,includedEmployees:plan.includedEmployees,additionalEmployees,
    baseMonthlyAmount:plan.monthlyPrice,extraEmployeeMonthlyPrice:plan.extraEmployeeMonthlyPrice,extraMonthlyAmount,
    monthlyTotal:plan.monthlyPrice+extraMonthlyAmount,billingMonths:plan.billingMonths,
    periodTotal:(plan.monthlyPrice+extraMonthlyAmount)*plan.billingMonths};
}
function staffCount(companyId){return require('./db').getCollection('users').filter(u=>u.companyId===companyId &&
  ['fieldOfficer','branchManager'].includes(u.role) && u.isActive!==false && !u.isDeleted).length;}
function indiaToday(){return new Date(Date.now()+19800000).toISOString().slice(0,10);}
function endDate(start,months){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!Number.isFinite(Date.parse(start))||new Date(start).toISOString().slice(0,10)!==start)fail('Choose a valid start date.');
  const [y,m,d]=start.split('-').map(Number),last=new Date(Date.UTC(y,m-1+months+1,0)).getUTCDate();
  return new Date(Date.UTC(y,m-1+months,Math.min(d,last))).toISOString().slice(0,10);
}
module.exports={starterPackage,validatePackage,quote,staffCount,indiaToday,endDate};
