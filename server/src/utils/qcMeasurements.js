const present=v=>v!==undefined&&v!==null&&!(typeof v==='string'&&!v.trim());
function numeric(v,label,min=0,max=1e9){if(!present(v))return null;const n=Number(v);if(!['string','number'].includes(typeof v)||!Number.isFinite(n)||n<min||n>max)throw new Error(`${label} must be between ${min} and ${max}.`);return n;}
export function viscosityBounds(body){const min=numeric(body.viscosity_min_cp,'Minimum viscosity'),max=numeric(body.viscosity_max_cp,'Maximum viscosity');if(min!==null&&max!==null&&min>max)throw new Error('Minimum viscosity exceeds maximum viscosity.');return {min,max};}
export function requiresQc(spec){return Boolean(spec&&(present(spec.ph_min)||present(spec.ph_max)||present(spec.viscosity_min_cp)||present(spec.viscosity_max_cp)||String(spec.viscosity||'').trim()||String(spec.appearance||'').trim()));}
export function validateQcMeasurements(spec={},body={},status){
 const ph=numeric(body.ph,'Measured pH',0,14),viscosity=numeric(body.viscosityCp,'Measured viscosity (cP)');
 const appearance=String(body.appearance??'').trim(),viscosityNote=String(body.viscosityNote??'').trim();
 if(appearance.length>1000||viscosityNote.length>1000)throw new Error('QC observations must not exceed 1000 characters.');
 const matchesAppearance=body.appearanceMatches===true,matchesViscosity=body.viscosityMatches===true;
 if(status==='PASSED'){
  if(present(spec.ph_min)||present(spec.ph_max)){if(ph===null)throw new Error('Enter measured pH before passing QC.');if(present(spec.ph_min)&&ph<spec.ph_min||present(spec.ph_max)&&ph>spec.ph_max)throw new Error('Measured pH is outside the formula specification.');}
  if(present(spec.viscosity_min_cp)||present(spec.viscosity_max_cp)){if(viscosity===null)throw new Error('Enter measured viscosity (cP) before passing QC.');if(present(spec.viscosity_min_cp)&&viscosity<spec.viscosity_min_cp||present(spec.viscosity_max_cp)&&viscosity>spec.viscosity_max_cp)throw new Error('Measured viscosity is outside the formula specification.');}
  if(String(spec.viscosity||'').trim()&&(!matchesViscosity||!viscosityNote))throw new Error('Record the viscosity observation/method and confirm the qualitative specification.');
  if(String(spec.appearance||'').trim()&&(!matchesAppearance||!appearance))throw new Error('Record the appearance and confirm it meets the specification.');
 }
 return {ph,viscosityCp:viscosity,appearance,viscosityNote,appearanceMatches:matchesAppearance,viscosityMatches:matchesViscosity};
}
