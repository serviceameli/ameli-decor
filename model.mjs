export function packageCounts(guests) {
  if (!Number.isInteger(guests) || guests<20 || guests>100 || guests%10!==0) throw new Error('Количество гостей должно быть от 20 до 100 с шагом 10');
  return {guests,tables:guests/10,compositions:guests/10,napkins:guests,ceremony:1,presidium:1};
}
export function parsePrice(raw) {
  const value=String(raw??'').replace(/[\s\u00a0\u202f]/g,'');
  if(!value) return null;
  if(!/^\d+$/.test(value)) throw new Error('Введите целую цену');
  const number=Number(value);
  if(!Number.isSafeInteger(number)||number<1||number>9999999)throw new Error('Цена вне диапазона');
  return number;
}
export function formatPrice(price) {return price==null?'По запросу':new Intl.NumberFormat('ru-RU').format(price)+' ₽';}
export function validatePrices(prices,packages) {
  if(!prices || typeof prices!=='object' || Array.isArray(prices))throw new Error('Цены должны быть объектом');
  const keys=new Set(packages.map(p=>String(p.guests)));
  for(const [key,value]of Object.entries(prices)){
    if(!keys.has(key))throw new Error('Неизвестный пакет');
    if(value!==null && (!Number.isInteger(value)||value<1||value>9999999))throw new Error('Некорректная цена');
  }
}
