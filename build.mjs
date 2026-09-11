import fs from 'node:fs/promises';
import path from 'node:path';
import {packageCounts,validatePrices} from './model.mjs';
const data=JSON.parse(await fs.readFile('content.json','utf8'));
if(data.packages.length!==9||data.palette.length!==20)throw new Error('Ожидаются 9 пакетов и 20 цветов');
const guests=new Set(data.packages.map(p=>p.guests));if(guests.size!==9)throw new Error('Пакеты повторяются');
data.packages.forEach(p=>packageCounts(p.guests));validatePrices(Object.fromEntries(data.packages.map(p=>[p.guests,p.price])),data.packages);
const assets=new Set(['assets/cover.jpg','assets/hero.jpg','assets/table-green.jpg','fonts/montserrat.ttf','fonts/cormorant.ttf','vendor/jspdf.umd.min.js']);
for(const key of ['ceremony','tableCompositions','presidiumFlorals','presidiumBackdrops','napkins'])for(const item of data[key]){
  if(!item.title||!item.id)throw new Error('У варианта нет названия или кода');
  if(item.image){if(!/^assets\/[\w.-]+$/.test(item.image))throw new Error('Используйте локальные изображения assets/');assets.add(item.image);}
}
for(const asset of assets)await fs.access(asset);
await fs.mkdir('dist',{recursive:true});
for(const file of ['index.html','styles.css','app.js','model.mjs','pdf.mjs','content.json','robots.txt'])await fs.copyFile(file,path.join('dist',file));
for(const dir of ['assets','fonts','vendor'])await fs.cp(dir,path.join('dist',dir),{recursive:true});
console.log(`Готово: 9 пакетов, 20 цветов, ${assets.size} проверенных файлов.`);
