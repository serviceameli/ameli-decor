import {packageCounts,additionalSections} from './model.mjs';

// One typographic system for the personal proposal and the complete collection.
export async function createPresentation({jsPDF,data,selection,readBase64}) {
  const pdf=new jsPDF({orientation:'landscape',unit:'pt',format:'a4',compress:true,putOnlyUsedFonts:true});
  const W=pdf.internal.pageSize.getWidth(),H=pdf.internal.pageSize.getHeight(),M=48,CW=W-2*M;
  const [sans,serif]=await Promise.all([readBase64('fonts/montserrat-regular.ttf'),readBase64('fonts/cormorant.ttf')]);
  pdf.addFileToVFS('montserrat-regular.ttf',sans);pdf.addFont('montserrat-regular.ttf','Body','normal');
  pdf.addFileToVFS('cormorant.ttf',serif);pdf.addFont('cormorant.ttf','Display','normal');
  pdf.setProperties({title:selection?'Ваше свадебное оформление · Ameli Rental':'Коллекция свадебного декора · Ameli Rental',author:'Ameli Rental',subject:'Свадебный декор под ключ'});
  const ink='#302f2b',mid='#68675f',accent='#887a60',rule='#dedbd3',tint='#f6f4ef';
  const extraGroups=additionalSections.map(section=>({...section,items:data[section.key]||[]})).filter(section=>section.items.length);
  const clean=value=>String(value??'').replace(/[\u00a0\u202f]/g,' ');
  function lines(value,width,size=10,font='Body'){
    pdf.setFont(font,'normal');pdf.setFontSize(size);
    return pdf.splitTextToSize(clean(value),width);
  }
  function text(value,x,y,size=10,font='Body',color=ink,width=null){
    const content=width?lines(value,width,size,font):clean(value).split('\n');
    pdf.setFont(font,'normal');pdf.setFontSize(size);pdf.setTextColor(color);
    pdf.text(content,x,y,{lineHeightFactor:1.4});
    return y+(content.length-1)*size*1.4;
  }
  function line(x,y,right=W-M,color=rule){pdf.setDrawColor(color);pdf.setLineWidth(.5);pdf.line(x,y,right,y);}
  function label(value,x,y){return text(clean(value).toUpperCase(),x,y,7.3,'Body',accent);}
  function fittedTitle(value,x,y,width,size=17,maxLines=2){
    while(lines(value,width,size,'Display').length>maxLines&&size>12)size-=.5;
    return text(value,x,y,size,'Display',ink,width);
  }
  function note(value,y=538){text(value,M,y,8,'Body',mid,CW);}
  let first=true;
  function page(labelText,title,subtitle=''){
    if(!first)pdf.addPage();first=false;
    pdf.setFillColor('#ffffff');pdf.rect(0,0,W,H,'F');
    text('ameli',M,37,25,'Display');text('R E N T A L',M+65,35,6.3,'Body',ink);
    pdf.setFont('Body','normal');pdf.setFontSize(7.3);
    text(labelText.toUpperCase(),W-M-pdf.getTextWidth(labelText.toUpperCase()),34,7.3,'Body',accent);
    line(M,54);fittedTitle(title,M,91,CW,28,1);
    if(subtitle)text(subtitle,M,113,9,'Body',mid,CW);
  }
  const images=new Map();
  async function photo(path,x,y,w,h){
    if(!images.has(path))images.set(path,readBase64(path));const b64=await images.get(path);
    const src=`data:image/jpeg;base64,${b64}`,props=pdf.getImageProperties(src);
    const frame=data.imageFrames?.[path]||{x:0,y:0,width:props.width,height:props.height};
    const scale=Math.min(w/frame.width,h/frame.height),left=x+(w-frame.width*scale)/2,top=y+(h-frame.height*scale)/2;
    pdf.saveGraphicsState();pdf.rect(left,top,frame.width*scale,frame.height*scale,null);pdf.clip();pdf.discardPath();
    pdf.addImage(src,props.fileType,left-frame.x*scale,top-frame.y*scale,props.width*scale,props.height*scale,path,'FAST');
    pdf.restoreGraphicsState();
  }
  function code(item){return item.catalogId?`${item.id} · арт. ${item.catalogId}`:item.id;}
  function palette(colors,x,y,width,cols=10){
    const gap=12,cell=(width-gap*(cols-1))/cols;
    colors.forEach((color,i)=>{
      const left=x+(i%cols)*(cell+gap),top=y+Math.floor(i/cols)*39;
      pdf.setFillColor(color.hex);pdf.rect(left,top,cell,16,'F');
      pdf.setDrawColor(rule);pdf.setLineWidth(.3);pdf.rect(left,top,cell,16);
      text(color.name,left,top+28,6.8,'Body',mid,cell);
    });
  }
  async function gallery(labelText,title,items,footnote){
    const pageCount=Math.ceil(items.length/6),baseCount=Math.floor(items.length/pageCount);
    let offset=0;
    for(let sheet=0;sheet<pageCount;sheet++){
      const count=baseCount+(sheet<items.length%pageCount?1:0),batch=items.slice(offset,offset+count);
      const cols=batch.length===4?2:3,gap=28,w=(CW-gap*(cols-1))/cols;
      page(labelText,title,`Коллекция Ameli Rental · ${offset+1}–${offset+batch.length} из ${items.length}`);
      for(let i=0;i<batch.length;i++){
        const item=batch[i],row=Math.floor(i/cols),inRow=Math.min(cols,batch.length-row*cols);
        const x=M+(CW-inRow*w-(inRow-1)*gap)/2+(i%cols)*(w+gap),top=143+row*193;
        await photo(item.image,x,top,w,108);
        const bottom=fittedTitle(item.title,x,top+127,w,16,2);
        text(code(item),x,bottom+15,7.3,'Body',mid);
        text(item.description,x,bottom+31,8.2,'Body',mid,w);
        if(item.sourceUrl)pdf.link(x,top,w,179,{url:item.sourceUrl});
      }
      if(footnote)note(footnote);
      offset+=batch.length;
    }
  }
  if(selection){
    const c=selection.counts,chosen=selection.sections.filter(section=>section.items.length);
    const quantities={ceremony:'1 зона церемонии',presidiumBackdrops:'1 зона президиума',tableCompositions:`${c.compositions} композиций на ${c.tables} столов`,napkins:`${c.napkins} салфеток`,tablecloths:`${c.tablecloths} скатертей в подарок`};
    const shortQuantities={ceremony:'1 зона',presidiumBackdrops:'1 зона',tableCompositions:`${c.compositions} шт.`,napkins:`${c.napkins} шт.`,tablecloths:`${c.tablecloths} шт.`};
    let shortened=false;
    function compact(value,x,y,width,maxLines,size=10,font='Body',color=ink){
      let content=lines(value,width,size,font);
      if(content.length>maxLines){
        shortened=true;content=content.slice(0,maxLines);
        let last=content[maxLines-1];while(last&&pdf.getTextWidth(last+'…')>width)last=last.slice(0,-1);
        content[maxLines-1]=last+'…';
      }
      return text(content.join('\n'),x,y,size,font,color);
    }
    page('Персональное предложение','Свадебный декор под ключ',`${selection.guests} гостей · Ameli Rental`);
    if(selection.coupleNames){
      label('Молодожёны',M,152);compact(selection.coupleNames,M,181,447,2,24,'Display');
    }else{
      text('Оформление вашего события',M,167,21,'Display');
      text('Цветовую гамму, текстиль и флористику\nподберём индивидуально.',M,193,10,'Body',mid);
    }
    if(selection.weddingDate){
      const date=/^\d{4}-\d{2}-\d{2}$/.test(selection.weddingDate)?selection.weddingDate.split('-').reverse().join('.'):selection.weddingDate;
      label('Дата свадьбы',M,239);text(date,M,257,10.5);
    }
    if(selection.venue){label('Площадка',220,239);compact(selection.venue,220,257,276,2,10);}
    if(chosen.length){
      const x=548,w=W-M-x;
      pdf.setFillColor(tint);pdf.rect(x,141,w,59+chosen.length*30,'F');
      text('В вашей подборке',x+20,168,17,'Display');
      chosen.forEach((section,i)=>{
        const y=195+i*30;
        text(section.title,x+20,y,8.2,'Body',ink,w-74);
        text(shortQuantities[section.key],x+w-49,y,8.2,'Body',mid);
        if(i<chosen.length-1)line(x+20,y+12,x+w-20);
      });
    }
    if(selection.comment){label('Пожелания',M,301);compact(selection.comment,M,320,447,4,9.5,'Body',mid);}
    if(selection.extrasNeeded){
      label('Дополнительные позиции',M,391);
      compact(selection.extraItems||'Поможем подобрать дополнительные позиции.',M,410,447,3,9.5,'Body',mid);
      text('Заказываются отдельно · Открыть каталог',548,394,8,'Body',accent);
      pdf.link(548,382,W-M-548,18,{url:'https://catalog.ameli-rental.ru/'});
    }
    if(selection.palette.length){
      text('Цветовая гамма',M,466,17,'Display');
      palette(selection.palette,M,481,CW);
      if(selection.palette.length<=10)note('Оттенки на экране приблизительные. Цвет текстиля согласуем по образцу.',539);
    }
    if(shortened)note('Длинные поля сокращены. Полный текст сохранён в заявке менеджеру.',132);

    // Empty sections never produce a card, quantity or reserved grid cell.
    if(chosen.length){
      page('Персональная подборка','Выбранное оформление',`${selection.guests} гостей · ${chosen.length} ${chosen.length===1?'вариант':chosen.length<5?'варианта':'вариантов'} оформления`);
      const cols=chosen.length>4?3:2,gap=32,w=(CW-gap*(cols-1))/cols,rows=Math.ceil(chosen.length/cols);
      for(let i=0;i<chosen.length;i++){
        const section=chosen[i],item=section.items[0],row=Math.floor(i/cols),inRow=Math.min(cols,chosen.length-row*cols);
        const x=M+(CW-inRow*w-(inRow-1)*gap)/2+(i%cols)*(w+gap),top=(rows===1?174:141)+row*194;
        label(section.title,x,top);line(x,top+10,x+w);
        await photo(item.image,x,top+22,w,100);
        const bottom=fittedTitle(item.title,x,top+141,w,17,1);
        text(quantities[section.key],x,bottom+19,9,'Body',ink);
        text(code(item),x,bottom+34,7.2,'Body',mid);
        if(item.sourceUrl)pdf.link(x,top+20,w,158,{url:item.sourceUrl});
      }
      if(chosen.some(section=>section.key==='tablecloths'))note(selection.tableclothOffer.bookingNote+' Форму, цвет и наличие скатертей на дату подтвердит менеджер.');
      else note('Наличие выбранного декора на дату мероприятия подтвердит менеджер.');
    }
  }else{
    page('Коллекция Ameli Rental','Свадебный декор под ключ','Готовые комплекты на 20–100 гостей. Цветовую гамму, текстиль и флористику подберём индивидуально.');
    const summary=[
      ['Зона церемонии',data.ceremony[0].image,'1 зона на мероприятие','Задник и искусственная флористика.'],
      ['Зона президиума',data.presidiumBackdrops[0].image,'1 зона на мероприятие','Оформление стола пары и задник на выбор.'],
      ['Композиции на стол',data.tableCompositions[0].image,'2–10 композиций','Одна композиция на 10 гостей.'],
      ['Салфетки',data.napkins[0].image,'20–100 салфеток','По одной цветной салфетке на гостя.'],
      ['Скатерти в подарок',data.tablecloths[0].image,'2–10 скатертей',data.tableclothOffer.bookingNote]
    ];
    const gap=28,w=(CW-gap*2)/3;
    for(let i=0;i<summary.length;i++){
      const x=M+(i%3)*(w+gap),top=149+Math.floor(i/3)*192;
      await photo(summary[i][1],x,top,w,100);
      text(summary[i][0],x,top+123,17,'Display');
      text(summary[i][2],x,top+143,9);
      text(summary[i][3],x,top+163,8.2,'Body',mid,w);
    }
    const tx=M+2*(w+gap);label('Индивидуальные детали',tx,371);
    text('Декор, мебель и посуда',tx,397,18,'Display');
    text('Дополните оформление позициями\nиз каталога Ameli Rental.',tx,420,9,'Body',mid);
    text('Открыть каталог',tx,467,8.5,'Body',accent);pdf.link(tx,455,w,20,{url:'https://catalog.ameli-rental.ru/'});
    await gallery('01 / Оформление','Зона церемонии',data.ceremony,'Посадочные места и дорожка на фото показаны для примера и согласуются отдельно.');
    await gallery('02 / Оформление','Зона президиума',data.presidiumBackdrops,'Варианты задников. Искусственную флористику на президиуме согласуем в палитре оформления.');
    await gallery('03 / Оформление','Композиции на стол',data.tableCompositions,'Один комплект на гостевой стол. На каждые 10 гостей — один стол и одна композиция.');
    await gallery('04 / Текстиль','Салфетки',data.napkins,'По одной салфетке на каждого гостя. Наличие ткани и оттенка подтвердим перед бронированием.');
    await gallery('05 / Специальное предложение',data.tableclothOffer.title,data.tablecloths,data.tableclothOffer.bookingNote+' Форму и наличие на дату подтвердит менеджер.');
    page('Палитра','Цветовая гамма','20 оттенков для вашего оформления. Цвет готового текстиля согласуем по образцу.');
    const paletteGap=22,paletteWidth=(CW-paletteGap*4)/5;
    data.palette.forEach((color,i)=>{
      const x=M+(i%5)*(paletteWidth+paletteGap),y=156+Math.floor(i/5)*89;
      pdf.setFillColor(color.hex);pdf.rect(x,y,paletteWidth,49,'F');
      pdf.setDrawColor(rule);pdf.setLineWidth(.4);pdf.rect(x,y,paletteWidth,49);
      text(color.name,x,y+67,9,'Body',mid);
    });
    note('Оттенки на экране приблизительные.');
    page('Дополнить оформление','Дополнительные позиции','Декор и сервировка из каталога. Заказываются отдельно; наличие и стоимость уточняйте у менеджера.');
    for(let groupIndex=0;groupIndex<extraGroups.length;groupIndex++){
      const group=extraGroups[groupIndex],top=147+groupIndex*124;
      label(group.title,M,top+10);
      const itemWidth=(CW-172-28)/3;
      for(let itemIndex=0;itemIndex<group.items.length;itemIndex++){
        const item=group.items[itemIndex],x=M+172+itemIndex*(itemWidth+14);
        await photo(item.image,x,top,itemWidth,66);
        fittedTitle(item.title,x,top+85,itemWidth,14,2);
        pdf.link(x,top,itemWidth,112,{url:item.url});
      }
      if(groupIndex<extraGroups.length-1)line(M,top+111);
    }
    note('Нажмите на фотографию или название, чтобы открыть позицию в каталоге.');
    page('Состав оформления','Комплекты на 20–100 гостей','Церемония и президиум входят в каждый комплект. Количество текстиля и композиций зависит от числа гостей.');
    const columns=[M,136,259,382,581,706];
    pdf.setFillColor(tint);pdf.rect(M,150,CW,35,'F');
    ['Гости','Церемония','Президиум','Столы / композиции','Салфетки','Скатерти*'].forEach((value,i)=>text(value,columns[i]+8,172,8.2,'Body',mid));
    data.packages.forEach((item,i)=>{
      const y=208+i*33,c=packageCounts(item.guests);
      text(item.guests,columns[0]+8,y,17,'Display');
      ['1 зона','1 зона',`${c.tables} / ${c.compositions}`,`${c.napkins} шт.`,`${c.tablecloths} шт.`].forEach((value,j)=>text(value,columns[j+1]+8,y,9));
      line(M,y+12);
    });
    note('* Скатерти в подарок. '+data.tableclothOffer.bookingNote);
  }
  page('Перед бронированием','Условия оформления','Основные условия работы и согласования декора.');
  const terms=data.terms.filter(term=>term.showInPresentation!==false);
  const gift={title:'Скатерти в подарок',text:[data.tableclothOffer.bookingNote,data.tableclothOffer.availabilityNote,data.tableclothOffer.replacementNote].join(' ')};
  const groups=[terms.filter(term=>term.title!=='Визуализация на площадке'),[...terms.filter(term=>term.title==='Визуализация на площадке'),gift]];
  const termWidth=(CW-48)/2;
  groups.forEach((group,column)=>{
    const x=M+column*(termWidth+48);let y=155;
    for(const term of group){
      line(x,y-13,x+termWidth);
      const bottom=text(term.title,x,y+9,18,'Display',ink,termWidth);
      const bodyBottom=text(term.text,x,bottom+23,9.5,'Body',mid,termWidth);
      if(term.title==='Изменения и дополнения'){
        text('Открыть каталог Ameli Rental',x,bodyBottom+22,8,'Body',accent);
        pdf.link(x,bodyBottom+11,termWidth,17,{url:'https://catalog.ameli-rental.ru/'});
        y=bodyBottom+67;
      }else y=bodyBottom+45;
    }
  });
  for(let i=1;i<=pdf.getNumberOfPages();i++){
    pdf.setPage(i);line(M,H-33);
    text('AMELI RENTAL · СВАДЕБНЫЙ ДЕКОР',M,H-17,6.8,'Body',mid);
    const number=`${String(i).padStart(2,'0')} / ${String(pdf.getNumberOfPages()).padStart(2,'0')}`;
    pdf.setFont('Body','normal');pdf.setFontSize(7.3);text(number,W-M-pdf.getTextWidth(number),H-17,7.3,'Body',mid);
  }
  return pdf;
}
