import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {packageCounts,additionalSections} from './model.mjs';
const data=JSON.parse(await fs.readFile('content.json','utf8'));
if(data.packages.length!==9||data.palette.length!==20)throw new Error('Ожидаются 9 пакетов и 20 цветов');
const guests=new Set(data.packages.map(p=>p.guests));if(guests.size!==9)throw new Error('Пакеты повторяются');
data.packages.forEach(p=>packageCounts(p.guests));
const assets=new Set(['fonts/montserrat-regular.ttf','fonts/cormorant.ttf','fonts/montserrat.woff2','fonts/cormorant.woff2','vendor/jspdf.umd.min.js']);
const itemIds=new Set();
for(const key of ['ceremony','tableCompositions','presidiumFlorals','presidiumBackdrops','napkins','tablecloths'])for(const item of data[key]){
  if(!item.title||!item.id||!item.image)throw new Error('У варианта нет названия или кода');
  if(itemIds.has(item.id))throw new Error('У варианта повторяется код');
  if(item.sourceType!=='provided'&&(!item.sourceUrl||!item.catalogId))throw new Error('У каталожной позиции нет источника или артикула');
  itemIds.add(item.id);
  if(item.image){if(!/^assets\/[\w.-]+$/.test(item.image))throw new Error('Используйте локальные изображения assets/');assets.add(item.image);}
  for(const photo of item.photos||[]){
    if(!/^assets\/[\w.-]+$/.test(photo.src)||!photo.alt||!photo.label)throw new Error('У фотографии нет пути, описания или подписи');
    assets.add(photo.src);
  }
}
for(const group of data.venueVisualizations||[])for(const photo of group.photos){if(!/^assets\/[\w.-]+$/.test(photo.src)||!photo.alt||!photo.label)throw new Error('Проверьте фото визуализации');assets.add(photo.src);}
for(const section of additionalSections)for(const item of data[section.key]||[]){if(!/^assets\/[\w.-]+$/.test(item.image)||!item.title||!item.alt||!item.url.startsWith('https://catalog.ameli-rental.ru/catalog/'))throw new Error('Проверьте дополнительную позицию');assets.add(item.image);}
for(const photo of data.portfolio||[]){if(!photo.alt||!photo.width||!photo.height)throw new Error('Проверьте фото портфолио');for(const src of [photo.src,photo.thumb]){if(!/^assets\/[\w.-]+$/.test(src))throw new Error('Проверьте путь портфолио');assets.add(src);}}
for(const [source,preview] of Object.entries(data.imagePreviews||{})){
  if(!assets.has(source)||!preview.variants?.length)throw new Error('Превью не связано с фотографией коллекции');
  for(const image of preview.variants){
    if(!/^assets\/preview-[\w.-]+\.webp$/.test(image.src)||!Number.isInteger(image.width)||image.width<1||!Number.isInteger(image.height)||image.height<1)throw new Error('Проверьте изображение превью');
    assets.add(image.src);
  }
}
for(const asset of assets)await fs.access(asset);
await fs.rm('dist',{recursive:true,force:true});
await fs.mkdir('dist',{recursive:true});
const sourceFiles=['index.html','styles.css','app.js','model.mjs','pdf.mjs','robots.txt'];
const sources=Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,await fs.readFile(file,'utf8')])));
const content=JSON.stringify(data);
const version=createHash('sha256').update(Object.values(sources).join('')+content).digest('hex').slice(0,12);
for(const [file,source] of Object.entries(sources)){
  let output=source;
  if(file==='index.html')output=output.replace('href="styles.css"',`href="styles.css?v=${version}"`).replace('src="app.js"',`src="app.js?v=${version}"`);
  if(file==='app.js'||file==='pdf.mjs')output=output.replaceAll("'./model.mjs'",`'./model.mjs?v=${version}'`).replaceAll("'./pdf.mjs'",`'./pdf.mjs?v=${version}'`).replace("fetch('content.json')",`fetch('content.json?v=${version}')`);
  await fs.writeFile(path.join('dist',file),output);
}
await fs.writeFile('dist/content.json',content);
for(const asset of assets){await fs.mkdir(path.dirname(path.join('dist',asset)),{recursive:true});await fs.copyFile(asset,path.join('dist',asset));}
console.log(`Готово: 9 пакетов, 20 цветов, ${assets.size} проверенных файлов. Версия ${version}.`);
