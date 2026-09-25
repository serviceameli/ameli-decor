import test from 'node:test';
import assert from 'node:assert/strict';
import {packageCounts} from '../model.mjs';
test('Все девять пакетов содержат один стол и композицию на 10 гостей',()=>{
  for(let n=20;n<=100;n+=10)assert.deepEqual(packageCounts(n),{guests:n,tables:n/10,compositions:n/10,tablecloths:n/10,napkins:n,ceremony:1,presidium:1});
  for(const n of [0,19,25,101,110])assert.throws(()=>packageCounts(n));
});
import fs from 'node:fs';
import {resolveSelection,selectionMessage,toggleItem} from '../model.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../content.json',import.meta.url)));
test('Пакеты и заявка не содержат стоимость, в том числе из старого сохранённого выбора',()=>{
  for(const pack of data.packages){
    assert.ok(!Object.hasOwn(pack,'price'));
    const choice=resolveSelection(data,{guests:pack.guests,price:75000,ids:[],colors:[]});
    assert.ok(!Object.hasOwn(choice,'price'));
    assert.doesNotMatch(selectionMessage(choice),/Стоимость пакета|По запросу|₽|75\s?000/i);
  }
});
test('В сообщение попадают выбранные позиции, их состав и цвета',()=>{
  const choice=resolveSelection(data,{guests:70,ids:['C02','T01','T04','P07',data.napkins[0].id,'T01','unknown'],colors:['Роза','Олива','unknown']});
  const message=selectionMessage(choice);
  assert.equal(choice.counts.compositions,7);assert.equal(choice.counts.napkins,70);
  assert.equal(choice.sections.flatMap(s=>s.items).length,4);
  assert.match(message,/C02 — Кастор/);assert.match(message,/T01 — Равенкло/);assert.match(message,/Роза, Олива/);
  assert.doesNotMatch(message,/C01|T02|T04|unknown|Снежный/);
  assert.ok(message.includes(data.tableCompositions.find(item=>item.id==='T01').sourceUrl));
  assert.doesNotMatch(message,/undefined/);
  const empty=selectionMessage(resolveSelection(data,{guests:20,ids:[],colors:[]}));
  assert.match(empty,/Пока не выбрано/);assert.match(empty,/палитра: пока не выбрана/i);
});

test('Новая позиция заменяет выбор только в своём разделе; повторное нажатие снимает выбор',()=>{
  let state={guests:40,ids:['C01','P05','T01',data.napkins[0].id],colors:['Роза','Олива']};
  state=toggleItem(data,state,'C02');
  assert.deepEqual(new Set(state.ids),new Set(['C02','P05','T01',data.napkins[0].id]));
  state=toggleItem(data,state,'T04');assert.ok(!state.ids.includes('T01'));assert.ok(state.ids.includes('T04'));
  state=toggleItem(data,state,'T04');assert.ok(!state.ids.includes('T04'));assert.ok(state.ids.includes('C02'));
  assert.deepEqual(state.colors,['Роза','Олива']);
});
test('Старый множественный выбор нормализуется до одной позиции в каждом разделе',()=>{
  const selection=resolveSelection(data,{guests:40,ids:data.ceremony.concat(data.presidiumBackdrops,data.tableCompositions,data.napkins,data.tablecloths).map(i=>i.id),colors:[]});
  assert.equal(selection.sections.flatMap(s=>s.items).length,5);
  for(const section of selection.sections)assert.equal(section.items.length,1);
});
test('Каждая карточка имеет конкретный состав; сообщение показывает состав выбранного комплекта',()=>{
  for(const key of ['ceremony','presidiumBackdrops','tableCompositions','napkins','tablecloths'])for(const item of data[key])assert.ok(item.components.length>0,item.id);
  const message=selectionMessage(resolveSelection(data,{guests:20,ids:['T01'],colors:[]}));
  assert.ok(message.includes('Светодиодные свечи «Лавгуд» — 6 шт.'));
  assert.ok(message.includes('Состав одной композиции'));
});
test('Единая заявка включает детали свадьбы, дополнительные позиции и комментарий',()=>{
  const selection=resolveSelection(data,{guests:60,ids:['C02'],colors:['Роза'],coupleNames:' Анна и Александр ',weddingDate:'2027-06-12',venue:'Усадьба «Сад», Москва',extrasNeeded:true,extraItems:'Стулья — 60 шт.\nhttps://catalog.ameli-rental.ru/',comment:'Монтаж к 14:00.\nНужен тёплый свет.'});
  const message=selectionMessage(selection);
  for(const value of ['Заявка на оформление свадьбы','Молодожёны: Анна и Александр','Дата свадьбы: 12.06.2027','Площадка: Усадьба «Сад», Москва','Гостей: 60','C02 — Кастор','Стулья — 60 шт.\nhttps://catalog.ameli-rental.ru/','Монтаж к 14:00.\nНужен тёплый свет.'])assert.ok(message.includes(value),value);
  assert.ok(message.includes('рассчитать дополнительные позиции отдельно'));
});
test('Скрытые дополнительные позиции не попадают в заявку; незаполненные поля отмечены',()=>{
  const message=selectionMessage(resolveSelection(data,{guests:20,ids:[],colors:[],extrasNeeded:false,extraItems:'Не отправлять эту позицию'}));
  assert.ok(!message.includes('Не отправлять эту позицию'));assert.match(message,/Дополнительные позиции из каталога: не нужны/);assert.match(message,/Дата свадьбы: пока не указана/);
  const needed=selectionMessage(resolveSelection(data,{guests:20,ids:[],colors:[],extrasNeeded:true}));assert.match(needed,/Нужна помощь менеджера с подбором/);
});

test('Скатерть выбирается отдельно, сохраняет остальные разделы и попадает в подарок',()=>{
  let state={guests:100,ids:['C01','P05','T01',data.napkins[0].id],colors:[]};
  state=toggleItem(data,state,data.tablecloths[0].id);
  state=toggleItem(data,state,data.tablecloths[1].id);
  const selected=resolveSelection(data,state);
  assert.equal(selected.counts.tablecloths,10);
  assert.deepEqual(state.ids,['C01','P05','T01',data.napkins[0].id,data.tablecloths[1].id]);
  const message=selectionMessage(selected);
  for(const value of [data.tablecloths[1].title,'Бархатные скатерти в подарок: 10 шт.','31 декабря 2026','Круглая или прямоугольная','100+'])assert.ok(message.includes(value),value);
});
test('Подарочные скатерти — Бета и Бета+ без повторов цвета, с остатком больше пяти',()=>{
  const sources=JSON.parse(fs.readFileSync(new URL('../tablecloth-stock-sources.json',import.meta.url)));
  for(const item of data.tablecloths){
    const source=sources.items.find(x=>x.catalogId===item.catalogId);
    assert.ok(source&&source.quantityOnHand>5);
    assert.ok(['Бета','Бета+'].includes(source.name.split('"')[1]));
  }
  assert.deepEqual(data.tablecloths.map(x=>x.catalogId),sources.items.filter(x=>x.eligible&&!x.excludedFromLanding).map(x=>x.catalogId));
  assert.equal(new Set(data.tablecloths.map(x=>x.title.toLowerCase().replaceAll('ё','е'))).size,data.tablecloths.length);
});

test('Объявления о дополнительном пошиве исключены из фотографий и превью текстиля',()=>{
  const cleanup=JSON.parse(fs.readFileSync(new URL('../image-cleanup.json',import.meta.url)));
  const paths=new Set(data.napkins.concat(data.tablecloths).flatMap(item=>[item.image,...item.photos.map(photo=>photo.src)]));
  for(const item of cleanup.excluded){
    assert.ok(!paths.has(item.src),item.src);
    assert.ok(!data.imagePreviews[item.src],item.src);
  }
  for(const item of data.napkins.concat(data.tablecloths))assert.ok(item.photos.length>=1,item.id);
});

test('Первый ряд превью укладывается в фиксированный бюджет загрузки',()=>{
  // A fixed byte budget remains meaningful when full-size photos are optimized too.
  let desktop=0,mobile=0;
  for(const item of data.ceremony.slice(0,5)){
    const variants=data.imagePreviews[item.image].variants;
    assert.ok(variants.length>0);
    desktop+=fs.statSync(new URL('../'+variants.at(-1).src,import.meta.url)).size;
    mobile+=fs.statSync(new URL('../'+variants[0].src,import.meta.url)).size;
  }
  assert.ok(desktop<=320000,desktop+' bytes desktop previews');
  assert.ok(mobile<=120000,mobile+' bytes mobile previews');
});
