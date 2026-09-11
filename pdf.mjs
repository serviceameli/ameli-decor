import { packageCounts, formatPrice, validatePrices } from './model.mjs';

// This shared renderer runs in the browser and in the PDF validation script.
// It only receives client prices; partner prices are never read by the renderer.
export async function createPresentation({jsPDF, data, prices, readBase64}) {
  validatePrices(prices,data.packages);
  const pdf=new jsPDF({orientation:'landscape',unit:'pt',format:'a4',compress:true,putOnlyUsedFonts:true});
  const W=pdf.internal.pageSize.getWidth(),H=pdf.internal.pageSize.getHeight();
  const [sans,serif]=await Promise.all([readBase64('fonts/montserrat.ttf'),readBase64('fonts/cormorant.ttf')]);
  pdf.addFileToVFS('montserrat.ttf',sans);pdf.addFont('montserrat.ttf','Body','normal');
  pdf.addFileToVFS('cormorant.ttf',serif);pdf.addFont('cormorant.ttf','Display','normal');
  pdf.setProperties({title:'Декор под ключ · Ameli Rental',author:'Ameli Rental',subject:'Коллекция декора и цены для клиента',creator:'Ameli Rental'});
  const ink='#2d2c28',mid='#64635c',paper='#f2f1ec',rule='#d8d7d0';
  function text(value,x,y,size=12,font='Body',color=ink,width=null) {
    pdf.setFont(font,'normal');pdf.setFontSize(size);pdf.setTextColor(color);
    const clean=String(value).replace(/[\u00a0\u202f]/g,' ');
    const lines=width?pdf.splitTextToSize(clean,width):clean.split('\n');
    // jsPDF reads the base outlines of variable Montserrat (its light master).
    // A proportional outline keeps the embedded text legible at presentation size.
    pdf.setDrawColor(color);pdf.setLineWidth(font==='Body'?size*.025:0);
    pdf.text(lines,x,y,{lineHeightFactor:1.45,renderingMode:font==='Body'?'fillThenStroke':'fill'});return y+lines.length*size*1.45;
  }
  function line(x1,y,x2=W-42){pdf.setDrawColor(rule);pdf.setLineWidth(.6);pdf.line(x1,y,x2,y);}
  function page(label,title,subtitle=''){
    if(pdf.getNumberOfPages()>1||page.used)pdf.addPage();page.used=true;
    pdf.setFillColor(paper);pdf.rect(0,0,W,H,'F');pdf.setFillColor('#ffffff');pdf.rect(22,22,W-44,H-44,'F');
    text(label.toUpperCase(),48,55,9,'Body',mid);text(title,48,102,35,'Display');
    if(subtitle)text(subtitle,48,131,11,'Body',mid,W-96);
  }
  const images=new Map();
  async function photo(path,x,y,w,h){
    if(!images.has(path))images.set(path,readBase64(path));
    const base64=await images.get(path);const source=`data:image/${path.endsWith('.png')?'png':'jpeg'};base64,${base64}`;
    const props=pdf.getImageProperties(source);const scale=Math.min(w/props.width,h/props.height);const iw=props.width*scale,ih=props.height*scale;
    pdf.addImage(source,props.fileType,x+(w-iw)/2,y+(h-ih)/2,iw,ih,path,'FAST');
  }
  async function gallery(label,title,items,note){
    for(let offset=0;offset<items.length;offset+=3){
      const batch=items.slice(offset,offset+3);page(label,title);
      const gap=20,w=(W-96-gap*2)/3;
      for(let i=0;i<batch.length;i++){
        const item=batch[i],x=48+i*(w+gap);await photo(item.image,x,150,w,235);
        text(item.id,x,410,9,'Body',mid);text(item.title,x,440,24,'Display',ink,w);
        text(item.description,x,470,10,'Body',mid,w);
      }
      text(note,48,535,9,'Body',mid,W-96);
    }
  }
  // 1. Cover follows the original deck: photograph above, title below.
  pdf.setFillColor(paper);pdf.rect(0,0,W,H,'F');pdf.setFillColor('#fff');pdf.rect(26,26,W-52,H-52,'F');
  await photo('assets/cover.jpg',26,26,W-52,321);
  text('AMELI RENTAL',64,66,10,'Body','#fff');
  text('ГОТОВОЕ СВАДЕБНОЕ ОФОРМЛЕНИЕ',64,387,9,'Body',mid);
  text('Декор вашей свадьбы уже собран',64,432,35,'Display');
  text('Вам осталось выбрать детали',64,459,12,'Body',mid);
  text('20–100 гостей',64,509,19,'Display');text('20 оттенков',240,509,19,'Display');
  page.used=true;
  // 2. Complete package composition.
  page('Состав пакета','Всё главное для вашего дня','Во всех пакетах одинаковый состав. Меняются только количества для гостей.');
  const composition=[['Зона церемонии','Задник и искусственная флористика в выбранной палитре.'],['Гостевые столы','Одна композиция на стол. Один стол на каждые 10 гостей.'],['Президиум','Оформление стола пары, искусственная флористика и задник на выбор.'],['Цветные салфетки','По одной салфетке на каждого гостя.']];
  for(let i=0;i<composition.length;i++){const y=186+i*76;text(String(i+1).padStart(2,'0'),48,y,9,'Body',mid);text(composition[i][0],77,y,23,'Display');text(composition[i][1],77,y+24,10,'Body',mid,385);line(77,y+56,465);}
  await photo('assets/hero.jpg',508,170,277,340);
  text('Доставка, монтаж и вывоз включены в пределах МКАД.',48,532,10,'Body');
  // 3. Ceremony references.
  await gallery('Зона церемонии','Место для «да»',data.ceremony.filter(i=>i.image),'Примеры драпировок. Искусственную флористику согласуем отдельно. Посадочные места в пакет не входят.');
  // 4. Table compositions.
  page('Гостевые столы','Детали, которые собирают всё вместе');
  await photo('assets/table-green.jpg',48,160,370,310);
  text('Пример сочетания цветов. В пакет входят флористика и салфетки.',48,493,9,'Body',mid,370);
  let tableY=177;
  for(const item of data.tableCompositions){text(item.title,455,tableY,25,'Display');tableY=text(item.description,455,tableY+26,11,'Body',mid,325)+9;if(item.draft)tableY=text('Предварительный вариант. Фото уточняются.',455,tableY,8,'Body',mid,325)+24;}
  text('60 гостей = 6 столов, 6 композиций, 60 салфеток.',455,489,11,'Body',ink,320);
  // 5. Presidium: two explicit groups of alternatives.
  page('Президиум','Главный акцент вашей истории','В пакет входит по одному варианту флористики и задника.');
  for(const [column,items,title]of [[0,data.presidiumFlorals,'Флористика на столе'],[1,data.presidiumBackdrops,'Задник за президиумом']]){
    const x=48+column*392;text(title,x,182,26,'Display');line(x,195,x+355);
    let y=229;
    for(const item of items){text(`${item.id}  ${item.title}`,x,y,22,'Display');y=text(item.description,x,y+22,10,'Body',mid,348)+24;}
  }
  text('Предварительные варианты. Конкретное оформление и фотографии согласуем перед бронированием.',48,535,9,'Body',mid,W-96);
  // New reference images added to content automatically get their own PDF pages.
  for(const [key,title]of [['tableCompositions','Композиции на гостевые столы'],['presidiumFlorals','Флористика президиума'],['presidiumBackdrops','Задники президиума']]){
    const items=data[key].filter(i=>i.image);if(items.length)await gallery('Варианты оформления',title,items,'Цвет и конкретный вариант согласуем перед бронированием.');
  }
  // 6. Textile.
  await gallery('Цветные салфетки','Небольшая деталь. Общее настроение.',data.napkins.filter(i=>i.image),'По одной салфетке на каждого гостя. Наличие выбранного оттенка подтвердим перед бронированием.');
  // 7. Palette, all 20 colors.
  page('Цветовая палитра','Ваше настроение. Ваш оттенок.','Предварительная палитра коллекции. Цвет текстиля подтвердим перед бронированием.');
  const sw=128,gap=22;
  data.palette.forEach((color,i)=>{const x=48+(i%5)*(sw+gap),y=161+Math.floor(i/5)*86;pdf.setFillColor(color.hex);pdf.rect(x,y,sw,50,'F');text(`${String(i+1).padStart(2,'0')}  ${color.name}`,x,y+66,9,'Body',mid);});
  text('Оттенок на экране может отличаться от ткани.',48,535,9,'Body',mid);
  // 8. Client prices only, with a safe empty-price fallback.
  page('Стоимость под ключ','Готовый пакет для вашего количества гостей','Церемония и президиум входят в каждый пакет. Один гостевой стол на 10 человек.');
  const columns=[48,188,400,625];
  ['Гости','Столы / композиции','Салфетки','Стоимость пакета'].forEach((title,i)=>text(title,columns[i],176,10,'Body',mid));line(48,190);
  data.packages.forEach((item,i)=>{const y=218+i*31,c=packageCounts(item.guests);text(item.guests,48,y,20,'Display');text(`${c.tables} / ${c.compositions}`,188,y,11);text(`${c.napkins} шт.`,400,y,11);text(formatPrice(prices[item.guests]??null),625,y,12);line(48,y+11);});
  text('Доставка, монтаж и вывоз включены в пределах МКАД при стандартной логистике.',48,535,9,'Body',mid,W-96);
  // 9. Terms, reused from the landing.
  page('Организационные детали','Условия доставки, монтажа и оплаты');
  data.terms.forEach((term,i)=>{const x=48+(i%2)*392,y=185+Math.floor(i/2)*170;line(x,y-24,x+350);text(term.title,x,y,26,'Display');text(term.text,x,y+31,11,'Body',mid,345);});
  text('Оформление и наличие выбранных вариантов подтвердим перед бронированием.',48,535,9,'Body',mid,W-96);
  for(let i=1;i<=pdf.getNumberOfPages();i++){pdf.setPage(i);text('AMELI RENTAL',48,H-25,8,'Body',mid);text(`${String(i).padStart(2,'0')} / ${String(pdf.getNumberOfPages()).padStart(2,'0')}`,W-79,H-25,8,'Body',mid);}
  return pdf;
}
