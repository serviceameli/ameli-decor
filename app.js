import { parsePrice, formatPrice, packageCounts, validatePrices, resolveSelection, selectionMessage, selectionSections, toggleItem } from './model.mjs';
const $ = (selector) => document.querySelector(selector);
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const plural = (n,one,few,many) => n%100>=11 && n%100<=14 ? many : n%10===1 ? one : n%10>=2 && n%10<=4 ? few : many;
const galleryCard = (item) => `<figure data-card="${escape(item.id)}"><div class="card-photo"><button class="gallery-image" data-details="${escape(item.id)}" aria-label="Фото и состав: ${escape(item.title)}"><img src="${escape(item.image)}" alt="${escape(item.alt || item.title)}" loading="lazy" decoding="async"><span class="selection-mark" aria-hidden="true" hidden>✓</span><span class="photo-detail-label">Фото и состав ↗</span></button></div><figcaption><span class="caption-code">${escape(item.id)}</span><h3><button class="card-title" data-details="${escape(item.id)}">${escape(item.title)}</button></h3><p>${escape(item.description)}</p><button class="choose-item" data-select="${escape(item.id)}" aria-pressed="false">Выбрать</button></figcaption></figure>`;
let activeDetail=null;
let data;
let state={guests:40,ids:[],colors:[]};
try {const saved=JSON.parse(localStorage.getItem('ameli-decor-selection-v1'));if(saved&&Array.isArray(saved.ids)&&Array.isArray(saved.colors)&&Number.isInteger(saved.guests)&&saved.guests>=20&&saved.guests<=100&&saved.guests%10===0)state=saved;}catch{}
let selectedGuests=state.guests;
try {
  const response=await fetch('content.json');if(!response.ok)throw new Error('content unavailable');
  data=await response.json();render(data);
} catch(error) {
  document.querySelectorAll('[data-export]').forEach(button=>{button.disabled=true;});
  $('#package-summary').textContent='Не удалось загрузить предложение. Обновите страницу.';
  console.error('Не удалось загрузить коллекцию',error);
}
function render(content) {
  $('#order-comment').value=typeof state.comment==='string'?state.comment:'';
  for(const [target,key] of [['ceremony-gallery','ceremony'],['presidium-gallery','presidiumBackdrops'],['table-gallery','tableCompositions'],['napkin-gallery','napkins']]) $(`#${target}`).innerHTML=content[key].map(galleryCard).join('');
  $('#guest-options').innerHTML=content.packages.map(item=>`<button class="guest-button" type="button" data-guests="${item.guests}" aria-pressed="${item.guests===selectedGuests}" aria-label="Пакет на ${item.guests} гостей">${item.guests}</button>`).join('');
  $('#swatches').innerHTML=content.palette.map(color=>`<button type="button" class="swatch" data-color="${escape(color.name)}" aria-pressed="false" aria-label="Выбрать цвет: ${escape(color.name)}"><span class="swatch-color" style="background:${/^#[0-9a-f]{6}$/i.test(color.hex)?color.hex:'#eee'}" role="img" aria-label="Цвет ${escape(color.name)}"></span><span class="swatch-name">${escape(color.name)}</span></button>`).join('');
  $('#terms-list').innerHTML=content.terms.map((term,i)=>`<article class="term"><span>${String(i+1).padStart(2,'0')}</span><div><h3>${escape(term.title)}</h3><p>${escape(term.text)}</p></div></article>`).join('');
  $('#export-fields').innerHTML=content.packages.map(item=>`<label for="price-${item.guests}">${item.guests} гостей<span class="input-wrap"><input id="price-${item.guests}" name="price-${item.guests}" type="text" inputmode="numeric" autocomplete="off" placeholder="По запросу" maxlength="12" aria-describedby="export-error"><span aria-hidden="true">₽</span></span></label>`).join('');
  updatePackage(selectedGuests);
}
function updatePackage(guests) {
  state.guests=guests;selectedGuests=guests;
  const notes=['Задник и искусственная флористика','Задник и оформление стола пары','Без флористики · на каждые 10 гостей','По одной на каждого гостя'];
  $('#package-summary').innerHTML=selectionSections.map((section,i)=>`<a class="summary-card" href="#${section.anchor}"><div class="summary-photo"><img src="${escape(data[section.key][0].image)}" alt="${escape(section.title)}" decoding="async"></div><div class="summary-copy"><h3>${section.title}</h3><p>${notes[i]}</p></div></a>`).join('');
  $('#table-quantity').textContent='1 композиция на каждые 10 гостей';
  $('#napkin-quantity').textContent='1 салфетка на гостя';
  document.querySelectorAll('[data-guests]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.guests)===guests)));
  refreshSelection();
}
function refreshSelection() {
  const selection=resolveSelection(data,state);
  state.ids=selection.sections.flatMap(section=>section.items.map(item=>item.id));
  state.colors=selection.palette.map(color=>color.name);
  try {localStorage.setItem('ameli-decor-selection-v1',JSON.stringify(state));}catch{}
  document.querySelectorAll('[data-select]').forEach(button=>{
    const checked=state.ids.includes(button.dataset.select);button.setAttribute('aria-pressed',String(checked));button.textContent=checked?'Выбрано ✓':'Выбрать';
    const card=button.closest('figure');if(card){card.classList.toggle('is-selected',checked);card.querySelector('.selection-mark').hidden=!checked;}
  });
  updateDetailChoice();
  document.querySelectorAll('[data-color]').forEach(button=>button.setAttribute('aria-pressed',String(state.colors.includes(button.dataset.color))));
  $('#header-selection-count').textContent=state.ids.length;
  $('#nav-selection-count').textContent=state.ids.length;
  $('#package-price').textContent=formatPrice(selection.price);
  const c=selection.counts;
  $('#package-inclusions').innerHTML=`<b>В пакет входит</b><ul><li>Зона церемонии — 1</li><li>Зона президиума — 1</li><li>Композиции без флористики — ${c.compositions}<br><span>на ${c.tables} гостевых столов</span></li><li>Цветные салфетки — ${c.napkins} шт.</li></ul>`;
  $('#selected-items').innerHTML=selection.sections.map(section=>`<div class="selected-group"><span>${section.title}</span><div>${section.items.length?section.items.map(item=>`<button class="selection-chip" data-remove="${escape(item.id)}" aria-label="Убрать: ${escape(item.title)}">${escape(item.id)} · ${escape(item.title)} <span aria-hidden="true">×</span></button>`).join(''):`<a class="empty-selection" href="#${section.anchor}">Выбрать варианты ↗</a>`}</div></div>`).join('')+`<div class="selected-group"><span>Цветовая гамма</span><div>${selection.palette.length?selection.palette.map(color=>`<button class="selection-chip" data-color="${escape(color.name)}" aria-pressed="true" aria-label="Убрать цвет: ${escape(color.name)}"><i style="background:${color.hex}"></i>${escape(color.name)} ×</button>`).join(''):'<a class="empty-selection" href="#palette">Выбрать цвета ↗</a>'}</div></div>`;
  $('#selection-text').value=selectionMessage(selection);
  $('#selection-status').textContent='';
}
document.addEventListener('click',event=>{
  if(!data)return;
  const item=event.target.closest('[data-select],[data-remove]');
  if(item){const id=item.dataset.select||item.dataset.remove;state=toggleItem(data,state,id);refreshSelection();return;}
  const color=event.target.closest('[data-color]');
  if(color){const name=color.dataset.color;state.colors=state.colors.includes(name)?state.colors.filter(value=>value!==name):[...state.colors,name];refreshSelection();}
});
$('#clear-selection').addEventListener('click',()=>{if(!data)return;state.ids=[];state.colors=[];refreshSelection();});
$('#order-comment').addEventListener('input',event=>{
  state.comment=event.target.value;
  try{localStorage.setItem('ameli-decor-selection-v1',JSON.stringify(state));}catch{}
  if(data)$('#selection-text').value=selectionMessage(resolveSelection(data,state));
  $('#selection-status').textContent='';
});
$('#copy-selection').addEventListener('click',async()=>{
  if(!data)return;
  try{await navigator.clipboard.writeText(selectionMessage(resolveSelection(data,state)));$('#selection-status').textContent='Скопировано. Вставьте сообщение в чат с менеджером.';}
  catch{$('.message-preview').open=true;$('#selection-text').focus();$('#selection-text').select();$('#selection-status').textContent='Текст выделен. Скопируйте его через меню устройства или Ctrl/Cmd+C.';}
});
$('#download-selection').addEventListener('click',async()=>{
  if(!data)return;const button=$('#download-selection');button.disabled=true;
  const selection=resolveSelection(data,state);
  $('#selection-status').textContent='Готовим презентацию с вашим выбором…';
  try{
    const {createPresentation}=await import('./pdf.mjs');
    const pdf=await createPresentation({jsPDF:window.jspdf.jsPDF,data,selection,readBase64});
    savePDF(pdf,`Ameli-${selection.guests}-guests.pdf`);
    $('#selection-status').textContent='Презентация скачана. Её можно отправить менеджеру.';
  }catch(error){console.error(error);$('#selection-status').textContent='Не удалось скачать PDF. Попробуйте ещё раз; ваш выбор сохранён.';}
  finally{button.disabled=false;}
});
async function readBase64(path){
  const response=await fetch(path);if(!response.ok)throw new Error(`Не удалось загрузить ${path}`);
  const bytes=new Uint8Array(await response.arrayBuffer());let binary='';
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);
}
function savePDF(pdf,name){
  const url=URL.createObjectURL(pdf.output('blob'));const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
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
function updateDetailChoice(){
  if(!activeDetail||!data)return;
  const item=selectionSections.flatMap(section=>data[section.key]).find(item=>item.id===activeDetail);
  if(!item)return;
  const selected=state.ids.includes(item.id);const button=$('#detail-select');
  button.dataset.select=item.id;button.setAttribute('aria-pressed',String(selected));button.textContent=selected?'Выбрано · убрать':'Выбрать этот вариант';
  const section=selectionSections.find(section=>data[section.key].some(i=>i.id===item.id));
  const counts=packageCounts(state.guests);
  const quantity=section.key==='napkins'?`${counts.napkins} салфеток`:section.key==='tableCompositions'?`${counts.compositions} ${plural(counts.compositions,'комплект','комплекта','комплектов')} на ${counts.tables} ${plural(counts.tables,'стол','стола','столов')}`:'1 зона';
  $('#detail-quantity').textContent=`В пакете на ${state.guests} гостей: ${quantity}.`;
}
document.addEventListener('click',event=>{
  const trigger=event.target.closest('[data-details]');if(!trigger||!data)return;
  const item=selectionSections.flatMap(section=>data[section.key]).find(item=>item.id===trigger.dataset.details);if(!item)return;
  activeDetail=item.id;
  $('#large-image').src=item.image;$('#large-image').alt=item.alt||item.title;
  $('#image-caption').textContent=item.title;
  $('#detail-code').textContent=`${item.id} · Артикул ${item.catalogId}`;
  $('#detail-description').textContent=item.description;
  $('#detail-composition-title').textContent=item.componentLabel||'Состав';
  $('#detail-components').innerHTML=(item.components||[]).map(text=>`<li>${escape(text)}</li>`).join('');
  $('#detail-note').textContent=item.detailsNote||'';
  $('#detail-source').href=item.sourceUrl;
  $('#detail-photo-frame').classList.remove('is-zoomed');$('#toggle-photo-zoom').setAttribute('aria-pressed','false');$('#toggle-photo-zoom').textContent='Увеличить фото +';
  updateDetailChoice();imageDialog.showModal();
});
$('#toggle-photo-zoom').addEventListener('click',()=>{
  const zoomed=$('#detail-photo-frame').classList.toggle('is-zoomed');
  $('#toggle-photo-zoom').setAttribute('aria-pressed',String(zoomed));$('#toggle-photo-zoom').textContent=zoomed?'Уменьшить фото −':'Увеличить фото +';
  if(!zoomed){$('#detail-photo-frame').scrollTop=0;$('#detail-photo-frame').scrollLeft=0;}
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
