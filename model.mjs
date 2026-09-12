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

export const selectionSections = [
  {key:'ceremony',title:'Зона церемонии',anchor:'ceremony'},
  {key:'presidiumBackdrops',title:'Зона президиума',anchor:'presidium'},
  {key:'tableCompositions',title:'Композиции на стол',anchor:'tables'},
  {key:'napkins',title:'Салфетки',anchor:'textile'}
];
export function resolveSelection(data, state) {
  const counts=packageCounts(state.guests);
  const pack=data.packages.find(p=>p.guests===state.guests);
  if(!pack)throw new Error('Пакет не найден');
  const ids=new Set(Array.isArray(state.ids)?state.ids:[]);
  const colors=new Set(Array.isArray(state.colors)?state.colors:[]);
  return {guests:state.guests,price:pack.price,counts,comment:typeof state.comment==='string'?state.comment.trim():'',
    sections:selectionSections.map(section=>({...section,items:data[section.key].filter(item=>ids.has(item.id)).slice(0,1)})),
    palette:data.palette.filter(color=>colors.has(color.name))};
}
export function toggleItem(data,state,id) {
  const section=selectionSections.find(section=>data[section.key].some(item=>item.id===id));
  if(!section)return state;
  const current=resolveSelection(data,state);
  const selected=current.sections.flatMap(section=>section.items.map(item=>item.id));
  const ids=selected.filter(value=>!data[section.key].some(item=>item.id===value));
  if(!selected.includes(id))ids.push(id);
  return {...state,ids};
}
export function selectionMessage(selection) {
  const {counts:c}=selection;
  const lines=['AMELI RENTAL · Пожелания к оформлению',`Гостей: ${selection.guests}`,`Стоимость пакета: ${formatPrice(selection.price)}`,'',
    'Состав пакета:', '• Зона церемонии: 1, задник и искусственная флористика.',
    '• Зона президиума: 1, задник и искусственная флористика.',
    `• Композиции без флористики: ${c.compositions} на ${c.tables} гостевых столов.`,
    `• Цветные салфетки: ${c.napkins} шт.`,
    '• Доставка, монтаж и вывоз в пределах МКАД. Доплаты за логистику — по условиям.','',
    'Выбранное оформление (по одному варианту в разделе):'];
  for(const section of selection.sections){
    lines.push('',section.title+':');
    if(!section.items.length)lines.push('— Пока не выбрано.');
    for(const item of section.items){
      lines.push(`• ${item.id} — ${item.title} (арт. ${item.catalogId})`,item.sourceUrl);
      if(item.components?.length)lines.push(item.componentLabel+':',...item.components.map(text=>'  — '+text));
      if(item.detailsNote)lines.push(item.detailsNote);
    }
  }
  lines.push('',`Палитра: ${selection.palette.map(c=>c.name).join(', ')||'пока не выбрана'}.`,
    '', 'Прошу подтвердить наличие на дату и согласовать итоговое оформление.');
  if(selection.comment)lines.push('', 'Комментарий к заказу:', selection.comment);
  return lines.join('\n');
}
