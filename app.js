import { parsePrice, formatPrice, packageCounts, validatePrices } from './model.mjs';
const $ = (selector) => document.querySelector(selector);
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const galleryCard = (item) => `<figure><button class="gallery-image" data-image="${escape(item.image)}" data-caption="${escape(item.title)}" aria-label="Увеличить: ${escape(item.title)}"><img src="${escape(item.image)}" alt="${escape(item.alt || item.title)}" loading="lazy" decoding="async"><span class="zoom" aria-hidden="true">↗</span></button><figcaption><div class="caption-title"><h3>${escape(item.title)}</h3><span class="caption-code">${escape(item.id)}</span></div><p>${escape(item.description)}</p></figcaption></figure>`;
const contentRows = (items) => items.map((item) => `<div class="content-row"><span>${escape(item.id)}</span><div><h3>${escape(item.title)}</h3><p>${escape(item.description)}</p>${item.draft ? '<span class="provisional">Предварительный вариант · фото уточняются</span>' : ''}</div></div>`).join('');
const extraGallery = (items) => items.some((item) => item.image) ? `<div class="gallery three detail-gallery">${items.filter((item) => item.image).map(galleryCard).join('')}</div>` : '';
let data;
try {
  const response = await fetch('content.json');
  if (!response.ok) throw new Error('content unavailable');
  data = await response.json(); render(data);
} catch (error) {
  document.querySelectorAll('[data-export]').forEach((button) => { button.disabled = true; });
  $('#price-rows').innerHTML = '<tr><td colspan="4">Не удалось загрузить коллекцию. Обновите страницу.</td></tr>';
  console.error('Не удалось загрузить коллекцию', error);
}
function render(content) {
  $('#ceremony-gallery').innerHTML = content.ceremony.filter((item) => item.image).map(galleryCard).join('');
  $('#tables').innerHTML = `<div class="split"><figure><button class="gallery-image split-picture" data-image="assets/table-green.jpg" data-caption="Пример цветового сочетания. В пакет входят флористика и салфетки." aria-label="Увеличить пример сервировки"><img src="assets/table-green.jpg" alt="Оливковые салфетки в сервировке гостевого стола" loading="lazy"><span class="zoom" aria-hidden="true">↗</span></button><figcaption class="small-note">Пример сочетания цветов. Мебель, посуда и свечи на фотографиях не входят в этот пакет.</figcaption></figure><div><span class="eyebrow">Гостевые столы</span><h2>Детали, которые<br>собирают всё вместе</h2><p>На каждый стол — одна флористическая композиция. На каждого гостя — цветная салфетка.</p><div class="content-rows">${contentRows(content.tableCompositions)}</div><p class="small-note">1 стол на 10 гостей. Для 60 гостей — 6 столов, 6 композиций и 60 салфеток.</p></div></div>${extraGallery(content.tableCompositions)}`;
  $('#presidium-content').innerHTML = `<div class="section-heading"><div><span class="eyebrow">Президиум</span><h2>Главный акцент<br>вашей истории</h2></div><p>Оформление стола пары: искусственная флористика и задник. По одному варианту из каждого раздела входит в пакет.</p></div><div class="presidium-columns"><div><h3>Флористика на столе</h3>${contentRows(content.presidiumFlorals)}</div><div><h3>Задник за президиумом</h3>${contentRows(content.presidiumBackdrops)}</div></div>${extraGallery([...content.presidiumFlorals, ...content.presidiumBackdrops])}`;
  $('#textile').innerHTML = `<div class="section-heading"><div><span class="eyebrow">Цветные салфетки</span><h2>Небольшая деталь.<br>Общее настроение.</h2></div><p>По одной салфетке на гостя. Текстиль поддерживает цвет церемонии, композиций и президиума.</p></div><div class="gallery three">${content.napkins.filter((item) => item.image).map(galleryCard).join('')}</div><p class="small-note">Примеры текстиля из коллекции. Остальные оттенки — в палитре ниже.</p>`;
  $('#swatches').innerHTML = content.palette.map((color,i) => `<div class="swatch"><span class="swatch-color" style="background:${/^#[0-9a-f]{6}$/i.test(color.hex) ? color.hex : '#eee'}" role="img" aria-label="Цвет ${escape(color.name)}"></span><span class="swatch-name">${escape(color.name)}</span><span class="swatch-number">${String(i+1).padStart(2,'0')}</span></div>`).join('');
  $('#terms-list').innerHTML = content.terms.map((term,i) => `<article class="term"><span>${String(i+1).padStart(2,'0')}</span><div><h3>${escape(term.title)}</h3><p>${escape(term.text)}</p></div></article>`).join('');
  $('#price-rows').innerHTML = content.packages.map((item) => { const c=packageCounts(item.guests); return `<tr><td>${item.guests}</td><td>${c.tables} / ${c.compositions}</td><td>${c.napkins} шт.</td><td>${item.price == null ? 'Цена уточняется' : formatPrice(item.price)}</td></tr>`; }).join('');
  if (content.packages.every((item) => item.price != null)) $('.price-note').textContent = 'Стоимость для организаторов. Цены для клиента вы задаёте при скачивании PDF.';
  $('#export-fields').innerHTML = content.packages.map((item) => `<label for="price-${item.guests}">${item.guests} гостей<span class="input-wrap"><input id="price-${item.guests}" name="price-${item.guests}" type="text" inputmode="numeric" autocomplete="off" placeholder="По запросу" maxlength="12" aria-describedby="export-error"><span aria-hidden="true">₽</span></span></label>`).join('');
}
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
