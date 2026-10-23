export function formatMissionNumber(value){
  const raw=String(value??'').trim();
  const digits=raw.replace(/\D/g,'');
  return /^[\d\s/.-]+$/.test(raw)&&digits.length===11
    ? digits.slice(0,2)+'/'+digits.slice(2,4)+'/'+digits.slice(4,7)+'/'+digits.slice(7)
    : raw;
}
export function treatmentYear(timestamp){
  return Number(new Intl.DateTimeFormat('en',{timeZone:'Europe/Brussels',year:'numeric'}).format(new Date(timestamp)));
}
