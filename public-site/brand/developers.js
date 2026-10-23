document.querySelector('#onboarding').addEventListener('submit', async event => {
  event.preventDefault();
  const form=event.currentTarget, result=document.querySelector('#form-result'), button=form.querySelector('button');
  const values=new FormData(form), scopes=values.getAll('scope');
  if (!scopes.length) { result.textContent='Select at least one resource.'; return; }
  button.disabled=true;result.textContent='Submitting your application…';
  try {
    const response=await fetch('/api/v1/developer/applications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:values.get('name'),email:values.get('email'),organization:values.get('organization'),purpose:values.get('purpose'),scopes,requestedDays:Number(values.get('requestedDays')),consent:values.get('consent')==='on'})});
    const data=await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to submit request');
    result.textContent=`Application submitted. Save this reference: ${data.data.id}. The Super Admin will review your request and contact you using the email provided.`;
    form.reset();
  } catch(error) {result.textContent=error.message || 'Connection failed. Please try again.';} finally {button.disabled=false;}
});
