import {packageCounts,formatPrice,validatePrices} from './model.mjs';

// Shared browser / Node renderer for the selected package and organizer collection.
export async function createPresentation({jsPDF,data,prices,selection,readBase64}) {
  if(!selection)validatePrices(prices,data.packages);
  const pdf=new jsPDF({orientation:'landscape',unit:'pt',format:'a4',compress:true,putOnlyUsedFonts:true});
  const W=pdf.internal.pageSize.getWidth(),H=pdf.internal.pageSize.getHeight();
  const [sans,serif]=await Promise.all([readBase64('fonts/montserrat.ttf'),readBase64('fonts/cormorant.ttf')]);
  pdf.addFileToVFS('montserrat.ttf',sans);pdf.addFont('montserrat.ttf','Body','normal');
  pdf.addFileToVFS('cormorant.ttf',serif);pdf.addFont('cormorant.ttf','Display','normal');
  pdf.setProperties({title:'Готовые пакеты декора · Ameli Rental',author:'Ameli Rental',subject:'Состав, варианты оформления и цены для клиента'});
  const ink='#2d2c28',mid='#64635c',paper='#f2f1ec',rule='#d8d7d0';
  function text(value,x,y,size=12,font='Body',color=ink,width=null){
    pdf.setFont(font,'normal');pdf.setFontSize(size);pdf.setTextColor(color);pdf.setDrawColor(color);pdf.setLineWidth(font==='Body'?size*.025:0);
    const clean=String(value).replace(/[\u00a0\u202f]/g,' ');const lines=width?pdf.splitTextToSize(clean,width):clean.split('\n');
    pdf.text(lines,x,y,{lineHeightFactor:1.35,renderingMode:font==='Body'?'fillThenStroke':'fill'});return y+lines.length*size*1.35;
  }
  function line(x1,y,x2=W-46){pdf.setDrawColor(rule);pdf.setLineWidth(.6);pdf.line(x1,y,x2,y);}
  let first=true;
  function page(label,title,subtitle=''){
    if(!first)pdf.addPage();first=false;
    pdf.setFillColor(paper);pdf.rect(0,0,W,H,'F');pdf.setFillColor('#fff');pdf.rect(22,22,W-44,H-44,'F');
    text(label.toUpperCase(),46,54,9,'Body',mid);text(title,46,100,34,'Display');
    if(subtitle)text(subtitle,46,129,11,'Body',mid,W-92);
  }
  const images=new Map();
  async function photo(path,x,y,w,h){
    if(!images.has(path))images.set(path,readBase64(path));const b64=await images.get(path);
    const src=`data:image/jpeg;base64,${b64}`,props=pdf.getImageProperties(src),scale=Math.min(w/props.width,h/props.height);
    const iw=props.width*scale,ih=props.height*scale;pdf.addImage(src,props.fileType,x+(w-iw)/2,y+(h-ih)/2,iw,ih,path,'FAST');
  }
  async function gallery(label,title,items,note){
    for(let offset=0;offset<items.length;offset+=6){
      const batch=items.slice(offset,offset+6);page(label,title);
      const rows=batch.length>4?2:1,cols=rows===2?3:Math.max(2,batch.length),gap=20,w=(W-92-gap*(cols-1))/cols;
      for(let i=0;i<batch.length;i++){
        const item=batch[i],x=batch.length===1?(W-w)/2:46+(i%cols)*(w+gap),top=rows===2?145+Math.floor(i/cols)*194:147;
        await photo(item.image,x,top,w,rows===2?104:225);
        const titleY=rows===2?top+134:402;
        text(`${item.id} · арт. ${item.catalogId}`,x,titleY-16,8,'Body',mid);
        let sz=rows===2?17:21;
        pdf.setFont('Display','normal');pdf.setFontSize(sz);
        while(pdf.splitTextToSize(item.title,w).length>2&&sz>12){sz--;pdf.setFontSize(sz);}
        const afterTitle=text(item.title,x,titleY,sz,'Display',ink,w);
        if(!selection)text(item.description,x,afterTitle+4,rows===2?8:9,'Body',mid,w);
        pdf.link(x,top,w,rows===2?170:330,{url:item.sourceUrl});
      }
      if(note)text(note,46,540,8.5,'Body',mid,W-92);
    }
  }
  if(selection){
    const c=selection.counts;
    page('Ваше оформление','Пакет декора на '+selection.guests+' гостей','Выбранное оформление для согласования с менеджером Ameli Rental.');
    text(formatPrice(selection.price),46,199,36,'Display');
    text('Стоимость пакета',46,224,10,'Body',mid);
    text(selection.palette.length?`Выбрано оттенков: ${selection.palette.length}`:'Цветовая гамма пока не выбрана',438,224,10,'Body',mid);
    const counts=['1 зона · задник и искусственная флористика','1 зона · задник и искусственная флористика',`Композиции без флористики: ${c.compositions}; столы: ${c.tables}`,`${c.napkins} цветных салфеток`];
    selection.sections.forEach((section,i)=>{
      const x=46+(i%2)*392,y=285+Math.floor(i/2)*102;
      text(section.title,x,y,25,'Display');text(counts[i],x,y+24,10,'Body',mid,350);
      text(section.items.length?`Отмечено вариантов: ${section.items.length}`:'Варианты пока не выбраны',x,y+45,9,'Body',mid);
    });
    text('Для каждого раздела — один вариант оформления. Цена зависит от количества гостей.',46,483,10,'Body',mid,W-92);
    text('Доставка, монтаж и вывоз в пределах МКАД включены. Доплаты за логистику — по условиям.',46,511,9,'Body',mid,W-92);
    for(const section of selection.sections)await gallery('Выбранные варианты',section.title,section.items,'Выбранный вариант оформления. Наличие на дату подтвердит менеджер.');
    if(selection.palette.length){
      page('Выбранная палитра','Цветовая гамма','Оттенки на экране приблизительные. Цвет готового текстиля согласуем по образцу.');
      selection.palette.forEach((color,i)=>{const x=46+(i%5)*150,y=160+Math.floor(i/5)*87;pdf.setFillColor(color.hex);pdf.rect(x,y,128,50,'F');text(color.name,x,y+67,9,'Body',mid);});
    }
  }else{
  // Open on the four actual package components, matching the landing.
  page('Декор под ключ','Всё, что входит в ваш пакет','Готовые предложения на 20, 30, 40, 50, 60, 70, 80, 90 и 100 гостей.');
  const summary=[
    ['Зона церемонии',data.ceremony[0].image,'1 зона на мероприятие','Задник и искусственная флористика.'],
    ['Зона президиума',data.presidiumBackdrops[0].image,'1 зона на мероприятие','Оформление стола пары и задник на выбор.'],
    ['Композиции на стол',data.tableCompositions[0].image,'2–10 композиций','Один комплект без флористики на 10 гостей.'],
    ['Салфетки',data.napkins[0].image,'20–100 салфеток','По одной цветной салфетке на гостя.']
  ];
  for(let i=0;i<summary.length;i++){
    const x=46+i*190;await photo(summary[i][1],x,175,176,192);text(summary[i][0],x,397,20,'Display',ink,176);
    text(summary[i][2],x,438,10,'Body',ink,176);text(summary[i][3],x,464,9,'Body',mid,176);
  }
  text('Доставка, монтаж и вывоз включены. Варианты оформления показаны на следующих страницах.',46,535,9,'Body',mid,W-92);
  await gallery('01 / Входит в пакет','Зона церемонии',data.ceremony,'Посадочные места и дорожка на фото показаны для примера и согласуются отдельно.');
  await gallery('02 / Входит в пакет','Зона президиума',data.presidiumBackdrops,'Варианты задников. Искусственную флористику на президиуме согласуем в палитре оформления.');
  await gallery('03 / Входит в пакет','Композиция на стол · без флористики',data.tableCompositions,'Один комплект на гостевой стол. На каждые 10 гостей — один стол и одна композиция.');
  await gallery('04 / Входит в пакет','Салфетки',data.napkins,'По одной салфетке на каждого гостя. Наличие ткани и оттенка подтвердим перед бронированием.');
  page('Палитра','20 оттенков для вашего оформления','Оттенки на экране приблизительные. Цвет готового текстиля согласуем по образцу.');
  data.palette.forEach((color,i)=>{const x=46+(i%5)*150,y=160+Math.floor(i/5)*87;pdf.setFillColor(color.hex);pdf.rect(x,y,128,50,'F');text(color.name,x,y+67,9,'Body',mid);});
  page('Стоимость под ключ','Пакеты на 20–100 гостей','Церемония и президиум входят в каждый пакет. Количество композиций и салфеток зависит от гостей.');
  const columns=[46,116,244,373,546,655];
  ['Гости','Церемония','Президиум','Столы / композиции','Салфетки','Стоимость'].forEach((label,i)=>text(label,columns[i],177,9,'Body',mid));line(46,192);
  data.packages.forEach((item,i)=>{const y=220+i*32,c=packageCounts(item.guests);text(item.guests,46,y,21,'Display');text('1 зона',116,y,10);text('1 зона',244,y,10);text(`${c.tables} / ${c.compositions}`,373,y,10);text(`${c.napkins} шт.`,546,y,10);text(formatPrice(prices[item.guests]??null),655,y,10);line(46,y+12);});
  text('Доставка, монтаж и вывоз в пределах МКАД включены при стандартной логистике площадки.',46,540,9,'Body',mid,W-92);
  }
  page('Перед бронированием','Условия');
  data.terms.forEach((term,i)=>{const x=46+(i%2)*392,y=184+Math.floor(i/2)*174;line(x,y-23,x+351);text(term.title,x,y,26,'Display');text(term.text,x,y+30,11,'Body',mid,345);});
  for(let i=1;i<=pdf.getNumberOfPages();i++){pdf.setPage(i);text('AMELI RENTAL',46,H-25,8,'Body',mid);text(`${String(i).padStart(2,'0')} / ${String(pdf.getNumberOfPages()).padStart(2,'0')}`,W-79,H-25,8,'Body',mid);}
  return pdf;
}
