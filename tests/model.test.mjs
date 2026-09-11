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
