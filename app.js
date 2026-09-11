import { parsePrice, formatPrice, packageCounts, validatePrices } from './model.mjs';
const $ = (selector) => document.querySelector(selector);
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const plural = (n,one,few,many) => n%100>=11 && n%100<=14 ? many : n%10===1 ? one : n%10>=2 && n%10<=4 ? few : many;
const galleryCard = (item) => `<figure><button class="gallery-image" data-image="${escape(item.image)}" data-caption="${escape(item.catalogName || item.title)}" aria-label="Увеличить: ${escape(item.title)}"><img src="${escape(item.image)}" alt="${escape(item.alt || item.title)}" loading="lazy" decoding="async"><span class="zoom" aria-hidden="true">↗</span></button><figcaption><span class="caption-code">${escape(item.id)}</span><h3>${escape(item.title)}</h3><p>${escape(item.description)}</p><a class="catalog-source" href="${escape(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">В каталоге ↗</a></figcaption></figure>`;
let data;
let selectedGuests=40;
try {
  const response=await fetch('content.json');if(!response.ok)throw new Error('content unavailable');
  data=await response.json();render(data);
} catch(error) {
  document.querySelectorAll('[data-export]').forEach(button=>{button.disabled=true;});
  $('#package-summary').textContent='Не удалось загрузить предложение. Обновите страницу.';
  console.error('Не удалось загрузить коллекцию',error);
}
function render(content) {
  for(const [target,key] of [['ceremony-gallery','ceremony'],['presidium-gallery','presidiumBackdrops'],['table-gallery','tableCompositions'],['napkin-gallery','napkins']]) $(`#${target}`).innerHTML=content[key].map(galleryCard).join('');
  $('#guest-options').innerHTML=content.packages.map(item=>`<button class="guest-button" type="button" data-guests="${item.guests}" aria-pressed="${item.guests===selectedGuests}" aria-label="Пакет на ${item.guests} гостей">${item.guests}</button>`).join('');
  $('#swatches').innerHTML=content.palette.map(color=>`<div class="swatch"><span class="swatch-color" style="background:${/^#[0-9a-f]{6}$/i.test(color.hex)?color.hex:'#eee'}" role="img" aria-label="Цвет ${escape(color.name)}"></span><span class="swatch-name">${escape(color.name)}</span></div>`).join('');
  $('#terms-list').innerHTML=content.terms.map((term,i)=>`<article class="term"><span>${String(i+1).padStart(2,'0')}</span><div><h3>${escape(term.title)}</h3><p>${escape(term.text)}</p></div></article>`).join('');
  $('#price-rows').innerHTML=content.packages.map(item=>{const c=packageCounts(item.guests);return `<tr data-package-row="${item.guests}"><td>${item.guests}</td><td>1 зона</td><td>1 зона</td><td>${c.tables} / ${c.compositions}</td><td>${c.napkins} шт.</td><td>${item.price==null?'Цена уточняется':formatPrice(item.price)}</td></tr>`;}).join('');
  if(content.packages.every(item=>item.price!=null))$('.price-note').textContent='Стоимость для организаторов. Цены для клиента вы задаёте при скачивании PDF.';
  $('#export-fields').innerHTML=content.packages.map(item=>`<label for="price-${item.guests}">${item.guests} гостей<span class="input-wrap"><input id="price-${item.guests}" name="price-${item.guests}" type="text" inputmode="numeric" autocomplete="off" placeholder="По запросу" maxlength="12" aria-describedby="export-error"><span aria-hidden="true">₽</span></span></label>`).join('');
  updatePackage(selectedGuests);
}
function updatePackage(guests) {
  const c=packageCounts(guests);selectedGuests=guests;
  const cards=[
    {href:'ceremony',title:'Зона церемонии',image:data.ceremony[0].image,count:'1 зона',note:'на выбор'},
    {href:'presidium',title:'Зона президиума',image:data.presidiumBackdrops[0].image,count:'1 зона',note:'на выбор'},
    {href:'tables',title:'Композиции на стол',image:data.tableCompositions[0].image,count:`${c.compositions} ${plural(c.compositions,'композиция','композиции','композиций')}`,note:`на ${c.tables} ${plural(c.tables,'стол','стола','столов')}`},
    {href:'textile',title:'Салфетки',image:data.napkins[0].image,count:`${c.napkins} ${plural(c.napkins,'салфетка','салфетки','салфеток')}`,note:'по числу гостей'}
  ];
  $('#package-summary').innerHTML=cards.map(card=>`<a class="summary-card" href="#${card.href}"><div class="summary-photo"><img src="${escape(card.image)}" alt="${escape(card.title)}" decoding="async"></div><div class="summary-copy"><h3>${card.title}</h3><div class="summary-count"><b>${card.count}</b><span>${card.note} ↗</span></div></div></a>`).join('');
  $('#table-quantity').textContent=`${c.compositions} ${plural(c.compositions,'композиция','композиции','композиций')} на ${c.tables} ${plural(c.tables,'стол','стола','столов')}`;
  $('#napkin-quantity').textContent=`${c.napkins} ${plural(c.napkins,'салфетка','салфетки','салфеток')}`;
  document.querySelectorAll('[data-guests]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.guests)===guests)));
  document.querySelectorAll('[data-package-row]').forEach(row=>row.classList.toggle('is-selected',Number(row.dataset.packageRow)===guests));
}
$('#guest-options').addEventListener('click',event=>{const button=event.target.closest('[data-guests]');if(button&&data)updatePackage(Number(button.dataset.guests));});
const exportDialog = $('#export-dialog');
document.querySelectorAll('[data-export]').forEach((button) => button.addEventListener('click', () => { if (data) exportDialog.showModal(); }));
$('#close-export').addEventListener('click', () => exportDialog.close());
$('#clear-prices').addEventListener('click', () => { $('#export-form').reset(); $('#export-error').textContent=''; document.querySelectorAll('[aria-invalid]').forEach((input) => input.removeAttribute('aria-invalid')); });
$('#export-fields').addEventListener('blur', (event) => {
  const input = event.target;if (!(input instanceof HTMLInputElement)) return;
  try { const value=parsePrice(input.value); input.value=value == null ? '' : new Intl.NumberFormat('ru-RU').format(value); input.removeAttribute('aria-invalid'); } catch { input.setAttribute('aria-invalid','true'); }
}, true);
$('#export-form').addEventListener('submit', async (event) => {
  event.preventDefault();const prices = {};$('#export-error').textContent = '';
  for (const item of data.packages) {
    const input = $(`#price-${item.guests}`);
    try { prices[item.guests] = parsePrice(input.value); input.removeAttribute('aria-invalid'); }
    catch { input.setAttribute('aria-invalid','true'); $('#export-error').textContent=`Проверьте цену для ${item.guests} гостей: введите целую сумму от 1 до 9 999 999 ₽ или оставьте поле пустым.`; input.focus(); return; }
  }
  try { await downloadPresentation(prices); } catch { /* Error is shown next to the form. */ }
});
async function downloadPresentation(prices) {
  validatePrices(prices, data.packages);const button = $('#download-pdf');
  if (button.disabled) throw new Error('PDF уже готовится');
  button.disabled=true;$('#export-status').textContent='Готовим PDF. Это займёт несколько секунд…';
  try {
    const { createPresentation } = await import('./pdf.mjs');
    if (!window.jspdf?.jsPDF) throw new Error('PDF library unavailable');
    const readBase64 = async (path) => {
      const response = await fetch(path);if (!response.ok) throw new Error(`Не удалось загрузить ${path}`);
      const bytes = new Uint8Array(await response.arrayBuffer());let binary='';
      for (let i=0;i<bytes.length;i+=8192) binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);
    };
    const pdf = await createPresentation({ jsPDF:window.jspdf.jsPDF, data, prices, readBase64 });
    const blob=pdf.output('blob');const url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download='Ameli-Decor-Collection.pdf';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    $('#export-status').textContent='PDF готов. Скачивание началось. В презентации указаны только ваши цены.';
    return {status:'download_started',packages:data.packages.length,pages:pdf.getNumberOfPages()};
  } catch (error) {
    $('#export-error').textContent='Не удалось подготовить PDF. Проверьте соединение и попробуйте ещё раз.';
    $('#export-status').textContent='Введённые цены сохранены в открытом окне.';console.error(error);throw error;
  } finally { button.disabled=false; }
}
const imageDialog=$('#image-dialog');
document.addEventListener('click', (event) => {
  const trigger=event.target.closest('[data-image]');if (!trigger) return;
  $('#large-image').src=trigger.dataset.image;$('#large-image').alt=trigger.dataset.caption;$('#image-caption').textContent=trigger.dataset.caption;imageDialog.showModal();
});
$('#close-image').addEventListener('click',()=>imageDialog.close());
for (const dialog of [exportDialog,imageDialog]) dialog.addEventListener('click',(event)=>{ if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();} });
if (document.modelContext?.registerTool && data) {
  const controller=new AbortController();window.addEventListener('pagehide',()=>controller.abort(),{once:true});
  try {
    await document.modelContext.registerTool({
      name:'download_decor_presentation',title:'Скачать презентацию декора',
      description:'Скачать PDF коллекции с ценами клиента для пакетов на 20–100 гостей. Пустые цены отображаются как «По запросу». Прайс сайта не меняется.',
      inputSchema:{type:'object',properties:{prices:{type:'object',properties:Object.fromEntries(data.packages.map((item)=>[String(item.guests),{type:['integer','null'],minimum:1,maximum:9999999}])),additionalProperties:false}},required:['prices'],additionalProperties:false},
      annotations:{readOnlyHint:false,untrustedContentHint:false},
      execute:async(input)=>{if(!input||Object.keys(input).some(k=>k!=='prices'))throw new Error('Укажите только prices');validatePrices(input.prices,data.packages);for(const item of data.packages)$(`#price-${item.guests}`).value=input.prices[item.guests]??'';if(!exportDialog.open)exportDialog.showModal();return downloadPresentation(input.prices);}
    },{signal:controller.signal});
  } catch(error) { console.info('WebMCP недоступен',error); }
}
