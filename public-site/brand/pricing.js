(function(){
  'use strict';
  var root=document.getElementById('pricing-catalog'),form=document.getElementById('package-enquiry');
  if(!root||!form)return;
  var plans=[],signature='',loading=false,select=form.elements.packageId,count=form.elements.employees;
  var estimate=document.getElementById('package-estimate'),status=document.getElementById('package-request-status');
  var money=function(n){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);};
  function node(tag,text,cls){var n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
  function calculate(){
    var p=plans.find(function(x){return x.id===select.value;}),employees=Number(count.value);
    if(!p||!Number.isSafeInteger(employees)||employees<0){estimate.textContent='Choose a package and team size to see your estimate.';return;}
    var extras=Math.max(0,employees-p.includedEmployees),total=p.monthlyPrice+extras*p.extraEmployeeMonthlyPrice;
    estimate.textContent=money(total)+'/month · '+money(total*p.billingMonths)+' for '+p.billingMonths+(p.billingMonths===1?' month. ':' months. ')+extras+(extras===1?' extra employee':' extra employees')+' × '+money(p.extraEmployeeMonthlyPrice)+'/month.';
  }
  function render(){
    var selected=select.value;root.replaceChildren();select.replaceChildren(node('option','Choose a package'));select.firstChild.value='';
    plans.forEach(function(p){
      var option=node('option',p.name);option.value=p.id;select.append(option);
      var card=node('article',undefined,'pricing-card');card.append(node('span','MONTHLY PLAN','eyebrow'),node('h3',p.name),node('p',p.description),node('strong',money(p.monthlyPrice),'pricing-amount'),node('p',p.billingMonths===1?'per month · billed monthly':'per month · billed every '+p.billingMonths+' months'),node('p',p.includedEmployees+' employees included'),node('p','Extra employees: '+money(p.extraEmployeeMonthlyPrice)+' each / month'));
      var list=node('ul');p.features.forEach(function(feature){list.append(node('li',feature));});card.append(list);
      var button=node('button','Request this package','button');button.type='button';button.addEventListener('click',function(){select.value=p.id;calculate();form.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});form.elements.name.focus({preventScroll:true});});card.append(button);root.append(card);
    });
    if(plans.some(function(p){return p.id===selected;}))select.value=selected;
    if(!plans.length)root.append(node('p','Packages are being updated. Please check back shortly.'));
    form.hidden=!plans.length;calculate();
  }
  async function load(){
    if(loading||document.hidden)return;loading=true;
    try{var response=await fetch('/api/v1/packages',{cache:'no-store'});if(!response.ok)throw Error('Pricing unavailable');var body=await response.json();if(!body.success||!Array.isArray(body.data))throw Error('Pricing unavailable');var next=JSON.stringify(body.data);if(next!==signature){plans=body.data;signature=next;render();}}
    catch(e){if(!signature){root.replaceChildren(node('p','Pricing is temporarily unavailable. Please try again.'));var retry=node('button','Retry pricing','button');retry.type='button';retry.addEventListener('click',load);root.append(retry);}}
    finally{loading=false;}
  }
  select.addEventListener('change',calculate);count.addEventListener('input',calculate);
  form.addEventListener('submit',async function(event){
    event.preventDefault();var button=form.querySelector('button[type="submit"]');button.disabled=true;status.textContent='Sending your enquiry…';
    try{var data=Object.fromEntries(new FormData(form));data.employees=Number(data.employees);var response=await fetch('/api/v1/packages/requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});var body=await response.json();if(!response.ok||!body.success)throw Error(body.message||'Please try again.');status.textContent='Thank you. Your package enquiry has been received. Reference: '+body.data.id;form.reset();calculate();}
    catch(e){status.textContent=e.message||'Could not send your enquiry. Please try again.';}
    finally{button.disabled=false;}
  });
  load();setInterval(load,60000);document.addEventListener('visibilitychange',load);
})();
