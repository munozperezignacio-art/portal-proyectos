export const isUfTariff = item => String(item?.unidad_costo_interno || '').startsWith('UF/');
const fraction=value=>{
  const [mantissa,exponent='0']=String(value).toLowerCase().split('e');
  const [whole,decimal='']=mantissa.split('.');
  const scale=decimal.length-Number(exponent);
  return scale>=0?[BigInt(whole+decimal),10n**BigInt(scale)]:[BigInt(whole+decimal)*10n**BigInt(-scale),1n];
};
export function ufDailyAmount(config, value, hours = null) {
  if (!config || !(Number(value) > 0)) return null;
  const rate = Number(config.valor), minimum = Number(config.minimo) || 0;
  if (!Number.isFinite(rate) || rate < 0) return null;
  let quantity = [1n,1n];
  if (config.unidad === 'UF/mes') {const divisor=fraction(config.tipo_minimo === 'dias_mes' && minimum > 0 ? Math.min(30,minimum) : 30);quantity=[divisor[1],divisor[0]];}
  if (config.unidad === 'UF/hr') {
    if (hours == null && !['horas_dia','horas_mes'].includes(config.tipo_minimo)) return null;
    quantity=fraction(Math.max(0,Number(hours)||0));
    const min=fraction(Math.max(0,minimum));
    if(config.tipo_minimo==='horas_mes')min[1]*=30n;
    if(['horas_dia','horas_mes'].includes(config.tipo_minimo)&&min[0]*quantity[1]>quantity[0]*min[1])quantity=min;
  }
  const r=fraction(rate),uf=fraction(value),n=r[0]*uf[0]*quantity[0],d=r[1]*uf[1]*quantity[1];
  return Number((2n*n+d)/(2n*d));
}
export const ufConfig = item => isUfTariff(item) ? {valor:Number(item.costo_interno),unidad:item.unidad_costo_interno,minimo:Number(item.cantidad_minima)||0,tipo_minimo:item.tipo_condicion_minima||'sin_minimo',modalidad:item.modalidad_dias||'laborales'} : null;
export function ufCost(config, date, values, hours = null) {
  return ufDailyAmount(config, values?.get(date)?.valor, hours);
}
export function parseUfInput(value) {
  const normalized=String(value).trim().replace(',', '.');
  return /^\d*(\.\d{0,6})?$/.test(normalized) ? normalized : null;
}
