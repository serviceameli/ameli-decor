import test from 'node:test';
import assert from 'node:assert/strict';
import {packageCounts,parsePrice,validatePrices} from '../model.mjs';
test('Все девять пакетов содержат один стол и композицию на 10 гостей',()=>{
  for(let n=20;n<=100;n+=10)assert.deepEqual(packageCounts(n),{guests:n,tables:n/10,compositions:n/10,napkins:n,ceremony:1,presidium:1});
  for(const n of [0,19,25,101,110])assert.throws(()=>packageCounts(n));
});
test('Цена распознаёт пробелы и пустые поля, отклоняет неправильные суммы',()=>{
  assert.equal(parsePrice('125 000'),125000);assert.equal(parsePrice('125\u202f000'),125000);assert.equal(parsePrice(''),null);
  for(const value of ['0','-200','12.5','1e3','abc','10000000'])assert.throws(()=>parsePrice(value));
});
test('Экспорт принимает только допустимые клиентские цены и пакеты',()=>{
  const packages=Array.from({length:9},(_,i)=>({guests:20+i*10}));
  assert.doesNotThrow(()=>validatePrices({'20':100000,'100':null},packages));
  for(const invalid of [{'25':1000},{'20':-1},{'20':'1000'},{'20':0},null,[]])assert.throws(()=>validatePrices(invalid,packages));
});

import fs from 'node:fs';
import {resolveSelection,selectionMessage,toggleItem} from '../model.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../content.json',import.meta.url)));
test('Фиксированная цена каждого пакета: от 45 до 125 тысяч',()=>{
  for(let guests=20;guests<=100;guests+=10){
    assert.equal(resolveSelection(data,{guests,ids:[],colors:[]}).price,45000+(guests-20)*1000);
  }
});
test('В сообщение попадают выбранные позиции, их состав и цвета',()=>{
  const choice=resolveSelection(data,{guests:70,ids:['C02','T01','T04','P03','N06','T01','unknown'],colors:['Роза','Олива','unknown']});
  const message=selectionMessage(choice);
  assert.equal(choice.price,95000);assert.equal(choice.counts.compositions,7);assert.equal(choice.counts.napkins,70);
  assert.equal(choice.sections.flatMap(s=>s.items).length,4);
  assert.match(message,/C02 — Кастор/);assert.match(message,/T01 — Равенкло/);assert.match(message,/Роза, Олива/);
  assert.doesNotMatch(message,/C01|T02|T04|unknown|Снежный/);
  assert.ok(message.includes(data.ceremony[1].sourceUrl));
  const empty=selectionMessage(resolveSelection(data,{guests:20,ids:[],colors:[]}));
  assert.match(empty,/Пока не выбрано/);assert.match(empty,/палитра: пока не выбрана/i);
});

test('Новая позиция заменяет выбор только в своём разделе; повторное нажатие снимает выбор',()=>{
  let state={guests:40,ids:['C01','P01','T01','N01'],colors:['Роза','Олива']};
  state=toggleItem(data,state,'C02');
  assert.deepEqual(new Set(state.ids),new Set(['C02','P01','T01','N01']));
  state=toggleItem(data,state,'T04');assert.ok(!state.ids.includes('T01'));assert.ok(state.ids.includes('T04'));
  state=toggleItem(data,state,'T04');assert.ok(!state.ids.includes('T04'));assert.ok(state.ids.includes('C02'));
  assert.deepEqual(state.colors,['Роза','Олива']);assert.equal(resolveSelection(data,state).price,65000);
});
test('Старый множественный выбор нормализуется до одной позиции в каждом разделе',()=>{
  const selection=resolveSelection(data,{guests:40,ids:data.ceremony.concat(data.presidiumBackdrops,data.tableCompositions,data.napkins).map(i=>i.id),colors:[]});
  assert.equal(selection.sections.flatMap(s=>s.items).length,4);
  for(const section of selection.sections)assert.equal(section.items.length,1);
});
test('Каждая карточка имеет конкретный состав; сообщение показывает состав выбранного комплекта',()=>{
  for(const key of ['ceremony','presidiumBackdrops','tableCompositions','napkins'])for(const item of data[key])assert.ok(item.components.length>0,item.id);
  const message=selectionMessage(resolveSelection(data,{guests:20,ids:['T02'],colors:[]}));
  assert.ok(message.includes('Светодиодные свечи «Лавгуд» — 9 шт.'));
  assert.ok(message.includes('Состав одной композиции'));
});
