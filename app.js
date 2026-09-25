import { packageCounts, additionalSections, resolveSelection, selectionMessage, selectionSections, toggleItem } from './model.mjs';
const $ = (selector) => document.querySelector(selector);
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const plural = (n,one,few,many) => n%100>=11 && n%100<=14 ? many : n%10===1 ? one : n%10>=2 && n%10<=4 ? few : many;
const cardPhotoIndices=new Map();
const cardSizes='(max-width:700px) calc((100vw - 44px) / 2), (max-width:1100px) calc((100vw - 92px) / 4), (max-width:1424px) calc((100vw - 138px) / 5), 258px';
function previewAttributes(path,sizes=cardSizes){
  const variants=data.imagePreviews?.[path]?.variants;
  if(!variants?.length)return {src:path};
  const largest=variants[variants.length-1];
  return {src:largest.src,srcset:variants.map(image=>image.src+' '+image.width+'w').join(', '),sizes,width:largest.width,height:largest.height};
}
function previewMarkup(path,sizes){return Object.entries(previewAttributes(path,sizes)).map(([key,value])=>key+'="'+escape(value)+'"').join(' ');}
const galleryCard = (item,priority=false) => `<figure data-card="${escape(item.id)}"><div class="card-photo"><button class="gallery-image" data-details="${escape(item.id)}" aria-label="Фото и состав: ${escape(item.title)}"><img ${previewMarkup(item.image)} alt="${escape(item.alt || item.title)}" loading="${priority?'eager':'lazy'}" fetchpriority="${priority?'high':'auto'}" decoding="async"><span class="selection-mark" aria-hidden="true" hidden>✓</span></button>${item.photos?.length>1?`<div class="card-photo-nav" role="group" aria-label="Фотографии: ${escape(item.title)}">${[-1,1].map(step=>`<button class="card-photo-arrow ${step<0?'is-prev':'is-next'}" type="button" data-card-photo="${escape(item.id)}" data-step="${step}" aria-label="${step<0?'Предыдущее':'Следующее'} фото: ${escape(item.title)}"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="${step<0?'M10 3 5 8l5 5':'m6 3 5 5-5 5'}"/></svg></button>`).join('')}<span class="sr-only card-photo-status" aria-live="polite">Фото 1 из ${item.photos.length}</span></div>`:''}</div><figcaption><h3><button class="card-title" data-details="${escape(item.id)}" title="${escape(item.title)}">${escape(item.title)}</button></h3><button class="choose-item" data-select="${escape(item.id)}" aria-pressed="false">Выбрать</button></figcaption></figure>`;
const sectionIconPaths = [
  '<path d="M12 51V25a20 20 0 0 1 40 0v26M19 51V26a13 13 0 0 1 26 0v25M8 52h15m18 0h15"/><path d="M12 31c-8-1-9-8-4-11 6 0 9 5 4 11Zm0 0c7-1 10 4 7 8-5 2-9-2-7-8ZM49 15c-5-4-4-10 1-11 5 3 5 8-1 11Z"/>',
  '<path d="M9 13h46v28M15 13v20m7-20v20m20-20v20m7-20v20M9 40h46l3 13H6l3-13Zm9 0v13m28-13v13"/><path d="M25 40c-4-7 1-12 7-7 6-5 11 0 7 7m-7-7v-6m-4 0c0-5 8-5 8 0-2 3-6 3-8 0Z"/>',
  '<path d="M10 52h44M17 52V29m-5 0h10m-8 0V15h6v14m12 23V22m-5 0h10m-8 0V9h6v13m12 30V33m-5 0h10m-8 0V20h6v13"/><path d="M17 11c-3-3 0-6 0-6s3 3 0 6Zm15-6c-2-2 0-4 0-4s2 2 0 4Zm15 11c-3-3 0-6 0-6s3 3 0 6Z"/>',
  '<path d="m32 7 23 43-20-6-11 12L10 43 32 7Zm0 0 3 37m-3-37L24 56M10 43l17-5"/><path d="m38 19 10 27"/>',
  '<path d="M12 20h40l7 30c-6-5-12 5-18 0s-12 5-18 0-12 5-18 0l7-30Zm0 0c0-10 40-10 40 0M20 24l-3 25m27-25 3 25M16 53v5m32-5v5"/>'
];
const sectionIcon = (index) => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${sectionIconPaths[index]}</svg>`;
let activeDetail=null;
let activePhotos=[];
let activePhotoIndex=0;
let data;
let state={guests:40,ids:[],colors:[]};
try {const saved=JSON.parse(localStorage.getItem('ameli-decor-selection-v1'));if(saved&&Array.isArray(saved.ids)&&Array.isArray(saved.colors)&&Number.isInteger(saved.guests)&&saved.guests>=20&&saved.guests<=100&&saved.guests%10===0)state=saved;}catch{}
const requestFields={'order-comment':'comment','couple-names':'coupleNames','wedding-date':'weddingDate','wedding-venue':'venue','extra-items':'extraItems'};
let selectedGuests=state.guests;
try {
  const response=await fetch('content.json');if(!response.ok)throw new Error('content unavailable');
  data=await response.json();render(data);
} catch(error) {
  document.querySelectorAll('[data-export]').forEach(button=>{button.disabled=true;});
  $('#collection-status').hidden=false;
  $('#collection-status').textContent='Не удалось загрузить предложение. Обновите страницу.';
  console.error('Не удалось загрузить коллекцию',error);
}
function render(content) {
  renderPortfolio(content);
  const offer=content.tableclothOffer;
  $('#tablecloth-offer-title').textContent=offer.title;
  $('#tablecloth-offer-booking').textContent=offer.bookingNote;
  $('#tablecloth-offer-details').textContent=offer.availabilityNote+' '+offer.replacementNote;
  for(const section of additionalSections){
    const target=$(`#${section.anchor}-extras-list`);if(!target)continue;
    target.innerHTML=(content[section.key]||[]).map(item=>`<a class="extra-card" href="${escape(item.url)}" target="_blank" rel="noopener noreferrer"><img ${previewMarkup(item.image,'110px')} alt="${escape(item.alt)}" loading="lazy" decoding="async"><span><h4>${escape(item.title)}</h4><span class="extra-link">${escape(item.linkLabel)} ↗</span></span></a>`).join('');
  }
  for(const [id,key] of Object.entries(requestFields))$(`#${id}`).value=typeof state[key]==='string'?state[key]:'';
  $('#extras-needed').checked=state.extrasNeeded===true;updateExtraFields();
  for(const [target,key] of [['ceremony-gallery','ceremony'],['presidium-gallery','presidiumBackdrops'],['table-gallery','tableCompositions'],['napkin-gallery','napkins'],['tablecloth-gallery','tablecloths']]) $(`#${target}`).innerHTML=content[key].map((item,index)=>galleryCard(item,key==='ceremony'&&index<2)).join('');
  $('#guest-options').innerHTML=content.packages.map(item=>`<button class="guest-button" type="button" data-guests="${item.guests}" aria-pressed="${item.guests===selectedGuests}" aria-label="Пакет на ${item.guests} гостей">${item.guests}</button>`).join('');
  $('#swatches').innerHTML=content.palette.map(color=>`<button type="button" class="swatch" data-color="${escape(color.name)}" aria-pressed="false" aria-label="Выбрать цвет: ${escape(color.name)}"><span class="swatch-color" style="background:${/^#[0-9a-f]{6}$/i.test(color.hex)?color.hex:'#eee'}" role="img" aria-label="Цвет ${escape(color.name)}"></span><span class="swatch-name">${escape(color.name)}</span></button>`).join('');
  $('#terms-list').innerHTML=content.terms.map((term,i)=>`<article class="term"><span>${String(i+1).padStart(2,'0')}</span><div><h3>${escape(term.title)}</h3><p>${escape(term.text)}${term.title==='Изменения и дополнения'?' <a class="terms-catalog-link" href="https://catalog.ameli-rental.ru/" target="_blank" rel="noopener noreferrer">Открыть каталог ↗</a>':''}</p></div></article>`).join('');
  document.querySelectorAll('.section-nav a').forEach((link,i)=>{if(i<sectionIconPaths.length)link.innerHTML=sectionIcon(i)+'<span>'+escape(link.textContent)+'</span>';});
  $('#venue-examples').innerHTML=(content.venueVisualizations||[]).map((group,g)=>`<article class="venue-example"><h3>${escape(group.title)}</h3><div class="venue-photo-grid">${group.photos.map((photo,i)=>`<figure><button type="button" data-venue-group="${g}" data-venue-photo="${i}" aria-label="Увеличить: ${escape(photo.alt)}"><img ${previewMarkup(photo.src,'(max-width:700px) 30vw, 420px')} alt="${escape(photo.alt)}" loading="lazy" decoding="async"></button><figcaption>${escape(photo.label)}<span aria-hidden="true">↗</span></figcaption></figure>`).join('')}</div></article>`).join('');
  updatePackage(selectedGuests);
}
function updatePackage(guests) {
  state.guests=guests;selectedGuests=guests;
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
  const c=selection.counts;
  $('#package-inclusions').innerHTML=`<b>Состав оформления</b><ul><li>Зона церемонии — 1</li><li>Зона президиума — 1</li><li>Композиции на стол — ${c.compositions}<br><span>на ${c.tables} гостевых столов</span></li><li>Цветные салфетки — ${c.napkins} шт.</li><li>Бархатные скатерти — ${c.tablecloths} шт.<br><span>в подарок по спецпредложению</span></li></ul>`;
  $('#selected-items').innerHTML=selection.sections.map(section=>`<div class="selected-group"><span>${section.title}</span><div>${section.items.length?section.items.map(item=>`<button type="button" class="selection-chip" data-remove="${escape(item.id)}" aria-label="Убрать: ${escape(item.title)}">${escape(item.id)} · ${escape(item.title)} <span aria-hidden="true">×</span></button>`).join(''):`<a class="empty-selection" href="#${section.anchor}">Выбрать варианты ↗</a>`}</div></div>`).join('')+`<div class="selected-group"><span>Цветовая гамма</span><div>${selection.palette.length?selection.palette.map(color=>`<button type="button" class="selection-chip" data-color="${escape(color.name)}" aria-pressed="true" aria-label="Убрать цвет: ${escape(color.name)}"><i style="background:${color.hex}"></i>${escape(color.name)} ×</button>`).join(''):'<a class="empty-selection" href="#palette">Выбрать цвета ↗</a>'}</div></div>`;
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
function updateExtraFields(){
  const checked=$('#extras-needed').checked;
  $('#extra-items-fields').hidden=!checked;
  $('#extras-needed').setAttribute('aria-expanded',String(checked));
}
function saveRequestFields(){
  for(const [id,key] of Object.entries(requestFields))state[key]=$(`#${id}`).value;
  state.extrasNeeded=$('#extras-needed').checked;
  updateExtraFields();
  try{localStorage.setItem('ameli-decor-selection-v1',JSON.stringify(state));}catch{}
  if(data)$('#selection-text').value=selectionMessage(resolveSelection(data,state));
  $('#selection-status').textContent='';
}
for(const id of Object.keys(requestFields))$(`#${id}`).addEventListener('input',saveRequestFields);
$('#extras-needed').addEventListener('change',saveRequestFields);
$('#order-form').addEventListener('submit',event=>event.preventDefault());
$('#copy-selection').addEventListener('click',async()=>{
  if(!data)return;saveRequestFields();
  try{await navigator.clipboard.writeText(selectionMessage(resolveSelection(data,state)));$('#selection-status').textContent='Заявка скопирована. Вставьте её в чат с менеджером.';}
  catch{$('.message-preview').open=true;$('#selection-text').focus();$('#selection-text').select();$('#selection-status').textContent='Текст выделен. Скопируйте его через меню устройства или Ctrl/Cmd+C.';}
});
$('#download-selection').addEventListener('click',async()=>{
  if(!data)return;const button=$('#download-selection');button.disabled=true;
  const selection=resolveSelection(data,state);
  $('#selection-status').textContent='Готовим презентацию с вашим выбором…';
  try{
    const [{createPresentation},jsPDF]=await Promise.all([import('./pdf.mjs'),loadPdfLibrary()]);
    const pdf=await createPresentation({jsPDF,data,selection,readBase64});
    savePDF(pdf,`Ameli-${selection.guests}-guests.pdf`);
    $('#selection-status').textContent='Презентация скачана. Её можно отправить менеджеру.';
  }catch(error){console.error(error);$('#selection-status').textContent='Не удалось скачать PDF. Попробуйте ещё раз; ваш выбор сохранён.';}
  finally{button.disabled=false;}
});
let pdfLibraryPromise;
function loadPdfLibrary(){
  if(window.jspdf?.jsPDF)return Promise.resolve(window.jspdf.jsPDF);
  if(!pdfLibraryPromise){
    pdfLibraryPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='vendor/jspdf.umd.min.js';script.async=true;
      script.onload=()=>{if(window.jspdf?.jsPDF)resolve(window.jspdf.jsPDF);else{script.remove();reject(new Error('PDF library unavailable'));}};
      script.onerror=()=>{script.remove();reject(new Error('PDF library unavailable'));};
      document.head.append(script);
    }).catch(error=>{pdfLibraryPromise=undefined;throw error;});
  }
  return pdfLibraryPromise;
}
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
$('#export-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if(!data)return;
  try { await downloadPresentation(); } catch { /* Error is shown next to the form. */ }
});
async function downloadPresentation() {
  const button = $('#download-pdf');
  if (button.disabled) throw new Error('PDF уже готовится');
  button.disabled=true;$('#export-error').textContent='';$('#export-status').textContent='Готовим PDF. Это займёт несколько секунд…';
  try {
    const [{createPresentation},jsPDF]=await Promise.all([import('./pdf.mjs'),loadPdfLibrary()]);
    const readBase64 = async (path) => {
      const response = await fetch(path);if (!response.ok) throw new Error(`Не удалось загрузить ${path}`);
      const bytes = new Uint8Array(await response.arrayBuffer());let binary='';
      for (let i=0;i<bytes.length;i+=8192) binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);
    };
    const pdf = await createPresentation({ jsPDF, data, readBase64 });
    const blob=pdf.output('blob');const url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download='Ameli-Decor-Collection.pdf';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    $('#export-status').textContent='PDF готов. Скачивание началось.';
    return {status:'download_started',packages:data.packages.length,pages:pdf.getNumberOfPages()};
  } catch (error) {
    $('#export-error').textContent='Не удалось подготовить PDF. Проверьте соединение и попробуйте ещё раз.';
    $('#export-status').textContent='';console.error(error);throw error;
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
  const quantity=section.key==='tablecloths'?`${counts.tablecloths} ${plural(counts.tablecloths,'скатерть','скатерти','скатертей')} в подарок`:section.key==='napkins'?`${counts.napkins} салфеток`:section.key==='tableCompositions'?`${counts.compositions} ${plural(counts.compositions,'комплект','комплекта','комплектов')} на ${counts.tables} ${plural(counts.tables,'стол','стола','столов')}`:'1 зона';
  $('#detail-quantity').textContent=`На ${state.guests} гостей: ${quantity}.`;
}
document.addEventListener('click',event=>{
  const trigger=event.target.closest('[data-details]');if(!trigger||!data)return;
  const item=selectionSections.flatMap(section=>data[section.key]).find(item=>item.id===trigger.dataset.details);if(!item)return;
  activeDetail=item.id;
  activePhotos=item.photos?.length?item.photos:[{src:item.image,alt:item.alt||item.title,label:'Основное фото'}];
  $('#photo-thumbnails').innerHTML=activePhotos.map((photo,i)=>`<button type="button" data-photo-index="${i}" aria-label="${escape(photo.label)}" aria-pressed="false"><img ${previewMarkup(photo.src,'80px')} alt="" loading="lazy" decoding="async"></button>`).join('');
  $('#photo-thumbnails').hidden=activePhotos.length<2;
  $('.detail-gallery-controls').hidden=activePhotos.length<2;
  showDetailPhoto(cardPhotoIndices.get(item.id)||0);
  $('#image-caption').textContent=item.title;
  $('#detail-code').textContent=item.catalogId?`${item.id} · Артикул ${item.catalogId}`:item.id;
  $('#detail-description').textContent=item.description;
  $('#detail-composition-title').textContent=item.componentLabel||'Состав';
  $('#detail-components').innerHTML=(item.components||[]).map(text=>`<li>${escape(text)}</li>`).join('');
  $('#detail-note').textContent=item.detailsNote||'';
  $('#detail-source').hidden=!item.sourceUrl;
  if(item.sourceUrl)$('#detail-source').href=item.sourceUrl;else $('#detail-source').removeAttribute('href');
  $('#detail-photo-frame').classList.remove('is-zoomed');$('#toggle-photo-zoom').setAttribute('aria-pressed','false');$('#toggle-photo-zoom').textContent='Увеличить фото +';
  updateDetailChoice();imageDialog.showModal();
});
function showDetailPhoto(index){
  activePhotoIndex=(index+activePhotos.length)%activePhotos.length;
  const photo=activePhotos[activePhotoIndex];
  $('#large-image').src=photo.src;$('#large-image').alt=photo.alt;
  $('#photo-counter').textContent=`${activePhotoIndex+1} / ${activePhotos.length}`;
  $('#photo-caption').textContent=photo.caption?`${photo.label}. ${photo.caption}`:photo.label;
  document.querySelectorAll('[data-photo-index]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.photoIndex)===activePhotoIndex)));
  const frame=$('#detail-photo-frame');frame.classList.remove('is-zoomed');frame.scrollTop=0;frame.scrollLeft=0;
  $('#toggle-photo-zoom').setAttribute('aria-pressed','false');$('#toggle-photo-zoom').textContent='Увеличить фото +';
}
$('#photo-thumbnails').addEventListener('click',event=>{const button=event.target.closest('[data-photo-index]');if(button)showDetailPhoto(Number(button.dataset.photoIndex));});
$('#photo-prev').addEventListener('click',()=>showDetailPhoto(activePhotoIndex-1));
$('#photo-next').addEventListener('click',()=>showDetailPhoto(activePhotoIndex+1));
imageDialog.addEventListener('keydown',event=>{
  if(activePhotos.length<2||$('#detail-photo-frame').classList.contains('is-zoomed'))return;
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();showDetailPhoto(activePhotoIndex+(event.key==='ArrowRight'?1:-1));}
});
let photoTouch=null;
$('#detail-photo-frame').addEventListener('touchstart',event=>{photoTouch=event.touches.length===1?{x:event.touches[0].clientX,y:event.touches[0].clientY}:null;},{passive:true});
$('#detail-photo-frame').addEventListener('touchend',event=>{
  if(!photoTouch||activePhotos.length<2||$('#detail-photo-frame').classList.contains('is-zoomed'))return;
  const touch=event.changedTouches[0],dx=touch.clientX-photoTouch.x,dy=touch.clientY-photoTouch.y;photoTouch=null;
  if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5)showDetailPhoto(activePhotoIndex+(dx<0?1:-1));
},{passive:true});
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
      description:'Скачать PDF коллекции: варианты оформления, палитра, состав комплектов на 20–100 гостей и условия бронирования.',
      inputSchema:{type:'object',properties:{},additionalProperties:false},
      annotations:{readOnlyHint:false,untrustedContentHint:false},
      execute:async(input)=>{if(input&&Object.keys(input).length)throw new Error('Параметры не требуются');if(!exportDialog.open)exportDialog.showModal();return downloadPresentation();}
    },{signal:controller.signal});
  } catch(error) { console.info('WebMCP недоступен',error); }
}

let venueGroup=0,venuePhoto=0;
const venueDialog=$('#venue-dialog');
function showVenuePhoto(index){const group=data.venueVisualizations[venueGroup];venuePhoto=(index+group.photos.length)%group.photos.length;const photo=group.photos[venuePhoto];$('#venue-large-image').src=photo.src;$('#venue-large-image').alt=photo.alt;$('#venue-photo-caption').textContent=`${group.title} · ${photo.label} · ${venuePhoto+1} / ${group.photos.length}`;}
$('#venue-examples').addEventListener('click',event=>{const button=event.target.closest('[data-venue-photo]');if(!button)return;venueGroup=Number(button.dataset.venueGroup);showVenuePhoto(Number(button.dataset.venuePhoto));venueDialog.showModal();});
$('#close-venue').addEventListener('click',()=>venueDialog.close());
$('#venue-prev').addEventListener('click',()=>showVenuePhoto(venuePhoto-1));
$('#venue-next').addEventListener('click',()=>showVenuePhoto(venuePhoto+1));
venueDialog.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();showVenuePhoto(venuePhoto+(event.key==='ArrowRight'?1:-1));}});

// Small previews first; full-size photographs are requested only in the viewer.
function renderPortfolio(content){
  const grid=$('#portfolio-grid'),photos=content.portfolio||[];
  const start=grid.children.length,end=Math.min(start+12,photos.length);
  grid.insertAdjacentHTML('beforeend',photos.slice(start,end).map((photo,i)=>`<button type="button" class="portfolio-photo" data-portfolio="${start+i}" aria-label="Увеличить: ${escape(photo.alt)}"><img src="${escape(photo.thumb)}" alt="${escape(photo.alt)}" width="${photo.width}" height="${photo.height}" loading="lazy" decoding="async"></button>`).join(''));
  $('#portfolio-count').textContent=`${end} из ${photos.length}`;
  $('#portfolio-more').hidden=end>=photos.length;
}
let portfolioIndex=0,portfolioTouch=null;
const portfolioDialog=$('#portfolio-dialog');
function showPortfolio(index){
  const photos=data.portfolio;if(!photos?.length)return;
  portfolioIndex=(index+photos.length)%photos.length;
  const photo=photos[portfolioIndex];$('#portfolio-image').src=photo.src;$('#portfolio-image').alt=photo.alt;
  $('#portfolio-caption').textContent=`${portfolioIndex+1} / ${photos.length}`;
}
$('#portfolio-more').addEventListener('click',()=>renderPortfolio(data));
$('#portfolio-grid').addEventListener('click',event=>{const button=event.target.closest('[data-portfolio]');if(!button)return;showPortfolio(Number(button.dataset.portfolio));portfolioDialog.showModal();});
$('#portfolio-close').addEventListener('click',()=>portfolioDialog.close());
$('#portfolio-prev').addEventListener('click',()=>showPortfolio(portfolioIndex-1));
$('#portfolio-next').addEventListener('click',()=>showPortfolio(portfolioIndex+1));
portfolioDialog.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();showPortfolio(portfolioIndex+(event.key==='ArrowRight'?1:-1));}});
portfolioDialog.addEventListener('click',event=>{if(event.target!==portfolioDialog)return;const r=portfolioDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)portfolioDialog.close();});
$('.portfolio-view').addEventListener('touchstart',event=>{portfolioTouch=event.touches.length===1?{x:event.touches[0].clientX,y:event.touches[0].clientY}:null;},{passive:true});
$('.portfolio-view').addEventListener('touchend',event=>{if(!portfolioTouch)return;const touch=event.changedTouches[0],dx=touch.clientX-portfolioTouch.x,dy=touch.clientY-portfolioTouch.y;portfolioTouch=null;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5)showPortfolio(portfolioIndex+(dx<0?1:-1));},{passive:true});

// Preview navigation does not change the chosen item or the presentation cover.
function showCardPhoto(button,index){
  const item=selectionSections.flatMap(section=>data[section.key]).find(item=>item.id===button.dataset.cardPhoto);
  if(!item?.photos?.length)return;
  index=(index+item.photos.length)%item.photos.length;
  cardPhotoIndices.set(item.id,index);
  const card=button.closest('figure'),photo=item.photos[index],img=card.querySelector('.gallery-image img');
  for(const [key,value] of Object.entries(previewAttributes(photo.src)))img.setAttribute(key,value);img.alt=photo.alt||item.title;
  card.querySelector('.card-photo-status').textContent=`Фото ${index+1} из ${item.photos.length}`;
}
document.addEventListener('click',event=>{
  const arrow=event.target.closest('[data-card-photo]');if(!arrow||!data)return;
  showCardPhoto(arrow,(cardPhotoIndices.get(arrow.dataset.cardPhoto)||0)+Number(arrow.dataset.step));
});
document.addEventListener('keydown',event=>{
  const arrow=event.target.closest('[data-card-photo]');if(!arrow||!data||!['ArrowLeft','ArrowRight'].includes(event.key))return;
  event.preventDefault();
  showCardPhoto(arrow,(cardPhotoIndices.get(arrow.dataset.cardPhoto)||0)+(event.key==='ArrowRight'?1:-1));
});
