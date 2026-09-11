import fs from 'node:fs/promises';
import path from 'node:path';
import {packageCounts,validatePrices} from './model.mjs';
const data=JSON.parse(await fs.readFile('content.json','utf8'));
if(data.packages.length!==9||data.palette.length!==20)throw new Error('Ожидаются 9 пакетов и 20 цветов');
const guests=new Set(data.packages.map(p=>p.guests));if(guests.size!==9)throw new Error('Пакеты повторяются');
data.packages.forEach(p=>packageCounts(p.guests));validatePrices(Object.fromEntries(data.packages.map(p=>[p.guests,p.price])),data.packages);
const assets=new Set(['fonts/montserrat.ttf','fonts/cormorant.ttf','vendor/jspdf.umd.min.js']);
for(const key of ['ceremony','tableCompositions','presidiumFlorals','presidiumBackdrops','napkins'])for(const item of data[key]){
  if(!item.title||!item.id||!item.image||!item.sourceUrl)throw new Error('У варианта нет названия или кода');
  if(item.image){if(!/^assets\/[\w.-]+$/.test(item.image))throw new Error('Используйте локальные изображения assets/');assets.add(item.image);}
}
for(const asset of assets)await fs.access(asset);
await fs.rm('dist',{recursive:true,force:true});
await fs.mkdir('dist',{recursive:true});
for(const file of ['index.html','styles.css','app.js','model.mjs','pdf.mjs','content.json','robots.txt'])await fs.copyFile(file,path.join('dist',file));
for(const asset of assets){await fs.mkdir(path.dirname(path.join('dist',asset)),{recursive:true});await fs.copyFile(asset,path.join('dist',asset));}
console.log(`Готово: 9 пакетов, 20 цветов, ${assets.size} проверенных файлов.`);
